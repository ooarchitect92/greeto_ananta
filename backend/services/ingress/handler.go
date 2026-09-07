// Package ingress implements the architecture F03 acknowledgement boundary.
// Provider-specific cryptographic verification, parsing, authoritative placement
// and Kafka transport are explicit ports. No fake adapter is included in runtime.
package ingress

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"net/http"
	"regexp"
	"time"

	"github.com/ooarchitect92/greeto_ananta/backend/internal/events"
	"github.com/ooarchitect92/greeto_ananta/backend/internal/observe"
)

var opaque = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`)

// Candidate is parsed only AFTER verification of the exact original raw body.
// Provider IDs stay strings. Its payload cannot assert tenant authority.
type Candidate struct {
	AssetID, EventRef string
	Body              []byte
}

// Slice is created by an authoritative placement adapter, not JSON unmarshalling
// into a tenant object. It must encode a minimized, permitted-jurisdiction slice.
type Slice struct {
	Record         events.Record
	CellID         string
	PlacementEpoch int64
	AuthorityRef   string
}

// Proofs resolves the route's expected verifier from trusted app configuration.
// Implementations fail closed for an unknown route, missing secret or stale grant.
type Proofs interface {
	ForRoute(context.Context, string) (Verifier, error)
}

// Verifier uses original bytes; Meta challenge GET is a separate provider handler.
type Verifier interface {
	Verify(context.Context, http.Header, []byte) error
}

// Parser must bound nested structures and enumerate EVERY signed payload element.
// Unsupported signed types need an authorized restricted quarantine slice.
type Parser interface {
	Parse(context.Context, []byte) ([]Candidate, error)
}

// Binder enforces tenant/asset ownership, residency, cell and current epoch. Unknown
// assets go to restricted quarantine or fail; never guess another tenant's scope.
type Binder interface {
	Bind(context.Context, string, Candidate) (Slice, error)
}

// Journal routes to the bound home-cell Kafka and returns an in-sync-quorum ACK.
// It must not ACK a local memory buffer, Redis write or an HTTP proxy acceptance.
type Journal interface {
	Append(context.Context, Slice) (events.Commit, error)
}

// Options are server-owned; no client may override bounds, route or journal.
type Options struct {
	Route         string
	MaxBodyBytes  int64
	MaxSlices     int
	MaxConcurrent int
	Timeout       time.Duration
	Proofs        Proofs
	Parser        Parser
	Binder        Binder
	Journal       Journal
	Observer      observe.Sink
}

type Handler struct {
	options Options
	slots   chan struct{}
}

// New validates the dependency wiring. It does not certify any supplied adapter.
// TLS/WAF, raw signature fixtures, verified Kafka config and tenant-isolation tests
// remain release gates. Server ReadTimeout must also bound slow network bodies.
func New(o Options) (*Handler, error) {
	if !opaque.MatchString(o.Route) || o.MaxBodyBytes < 1 || o.MaxBodyBytes > 4<<20 || o.MaxSlices < 1 || o.MaxSlices > 1024 || o.MaxConcurrent < 1 || o.MaxConcurrent > 10000 || o.Timeout <= 0 || o.Timeout > 10*time.Second || o.Proofs == nil || o.Parser == nil || o.Binder == nil || o.Journal == nil || o.Observer == nil {
		return nil, errors.New("invalid_ingress_configuration")
	}
	return &Handler{options: o, slots: make(chan struct{}, o.MaxConcurrent)}, nil
}

// ServeHTTP records each F03 boundary, then acknowledges only after ALL required
// slices have confirmed durable commits. It never calls AI, CRM, workflow or search.
// Duplicate siblings after a partial failure must deduplicate downstream.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	requestBytes := make([]byte, 16)
	if _, err := rand.Read(requestBytes); err != nil {
		http.Error(w, "request_id_unavailable", http.StatusServiceUnavailable)
		return
	}
	requestID := hex.EncodeToString(requestBytes)
	w.Header().Set("X-Request-Id", requestID)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	sequence := 0
	record := func(name, outcome, reason string, start time.Time) {
		sequence++
		h.options.Observer.Record(observe.Stage{RequestID: requestID, Flow: "F03", Name: name, Outcome: outcome, Reason: reason, Sequence: sequence, Milliseconds: time.Since(start).Milliseconds(), At: time.Now().UTC()})
	}
	fail := func(status int, name, reason string, start time.Time) {
		record(name, "failed", reason, start)
		http.Error(w, reason, status)
	}
	started := time.Now()
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		fail(405, "edge_bounds", "method_not_allowed", started)
		return
	}
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" || r.Header.Get("Content-Encoding") != "" {
		fail(415, "edge_bounds", "unsupported_body_encoding", started)
		return
	}
	select {
	case h.slots <- struct{}{}:
		defer func() { <-h.slots }()
	default:
		w.Header().Set("Retry-After", "1")
		fail(503, "edge_bounds", "ingress_at_capacity", started)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), h.options.Timeout)
	defer cancel()
	// On actual HTTP transports this also bounds a peer that trickles the body.
	_ = http.NewResponseController(w).SetReadDeadline(time.Now().Add(h.options.Timeout))
	r.Body = http.MaxBytesReader(w, r.Body, h.options.MaxBodyBytes)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			fail(413, "edge_bounds", "body_too_large", started)
		} else {
			fail(400, "edge_bounds", "body_read_failed", started)
		}
		return
	}
	if len(raw) == 0 {
		fail(422, "edge_bounds", "empty_body", started)
		return
	}
	record("edge_bounds", "passed", "", started)
	started = time.Now()
	verifier, err := h.options.Proofs.ForRoute(ctx, h.options.Route)
	if err != nil || verifier == nil {
		fail(503, "expected_credential", "verifier_unavailable", started)
		return
	}
	record("expected_credential", "passed", "", started)
	started = time.Now()
	if err = verifier.Verify(ctx, r.Header, raw); err != nil {
		fail(401, "raw_proof", "proof_rejected", started)
		return
	}
	record("raw_proof", "passed", "", started)
	started = time.Now()
	candidates, err := h.options.Parser.Parse(ctx, raw)
	if err != nil || len(candidates) == 0 || len(candidates) > h.options.MaxSlices {
		fail(422, "bounded_parse", "unsupported_or_oversized_schema", started)
		return
	}
	record("bounded_parse", "passed", "", started)
	started = time.Now()
	slices := make([]Slice, 0, len(candidates))
	totalBytes := int64(0)
	for _, candidate := range candidates {
		s, bindErr := h.options.Binder.Bind(ctx, h.options.Route, candidate)
		if bindErr != nil || !opaque.MatchString(s.CellID) || s.PlacementEpoch < 1 || !opaque.MatchString(s.AuthorityRef) || !opaque.MatchString(s.Record.ID) || s.Record.Topic == "" || s.Record.Key == "" || len(s.Record.Body) == 0 {
			fail(503, "authorized_placement", "placement_or_quarantine_unavailable", started)
			return
		}
		totalBytes += int64(len(s.Record.Body))
		if totalBytes > h.options.MaxBodyBytes*4 {
			fail(422, "authorized_placement", "slice_expansion_limit", started)
			return
		}
		slices = append(slices, s)
	}
	record("authorized_placement", "passed", "", started)
	for _, s := range slices {
		started = time.Now()
		if ctx.Err() != nil {
			fail(503, "durable_append", "deadline_exceeded", started)
			return
		}
		commit, appendErr := h.options.Journal.Append(ctx, s)
		if appendErr != nil || commit.RecordID != s.Record.ID || commit.Topic != s.Record.Topic || commit.Partition < 0 || commit.Offset < 0 {
			fail(503, "durable_append", "durability_unconfirmed", started)
			return
		}
		record("durable_append", "passed", "", started)
	}
	// Even when all commits succeeded, expired/cancelled HTTP work does not assert
	// successful acknowledgement. A provider may retry; committed facts survive.
	started = time.Now()
	if ctx.Err() != nil {
		fail(503, "ack_boundary", "deadline_exceeded", started)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = io.WriteString(w, "EVENT_RECEIVED")
	if err != nil {
		record("ack_boundary", "unknown", "response_write_failed", started)
		return
	}
	// Server response write is not evidence that the remote provider received it.
	record("ack_boundary", "response_written", "durable_acceptance_only", started)
}
