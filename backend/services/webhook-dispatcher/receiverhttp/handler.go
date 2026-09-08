package receiverhttp

import (
	"context"
	"errors"
	"io"
	"mime"
	"net/http"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/receiving"
	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/signing"
)

var uuid = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var reference = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)

// Handler owns bounded admission and an irreversible in-process draining state.
// The enclosing host supplies TLS/host-path routing, header/idle timeouts, maximum
// headers, connection limits and authenticated dependencies. Do not register this
// helper as the platform's Meta/Telegram callback or as an unrestricted endpoint.
type Handler struct {
	keys     Keys
	gate     Gate
	inbox    Inbox
	cfg      Config
	mu       sync.Mutex
	active   int
	draining bool
	drained  chan struct{}
	dropped  atomic.Uint64
}

func absent(v interface{}) bool {
	if v == nil {
		return true
	}
	r := reflect.ValueOf(v)
	switch r.Kind() {
	case reflect.Pointer, reflect.Interface, reflect.Map, reflect.Func, reflect.Slice, reflect.Chan:
		return r.IsNil()
	}
	return false
}

// New checks explicit dependencies/configuration without I/O or registration.
// A nil/typed-nil port is an error, never replaced with a permissive test port.
// Signature and parser bounds retain their existing contracts. Returned Handler
// may be mounted only in an explicitly reviewed receiver host, not automatically.
func New(keys Keys, gate Gate, inbox Inbox, c Config) (*Handler, error) {
	if absent(keys) || absent(gate) || absent(inbox) || c.Clock == nil || c.RequestID == nil ||
		c.Timeout < 100*time.Millisecond || c.Timeout > 30*time.Second ||
		c.MaxConcurrent < 1 || c.MaxConcurrent > 256 || c.MaxHeaderBytes < 1024 || c.MaxHeaderBytes > 65536 ||
		c.Signing.MaxBodyBytes < 1 || c.Signing.MaxBodyBytes > 1048576 ||
		c.Signing.MaxAgeSeconds < 1 || c.Signing.MaxAgeSeconds > 86400 ||
		c.Signing.MaxFutureSkewSeconds < 0 || c.Signing.MaxFutureSkewSeconds > c.Signing.MaxAgeSeconds ||
		c.Parser.MaxDepth < 1 || c.Parser.MaxDepth > 64 || c.Parser.MaxTokens < 4 || c.Parser.MaxTokens > 65536 ||
		c.Parser.MaxKeyBytes < 8 || c.Parser.MaxKeyBytes > 4096 {
		return nil, ErrConfig
	}
	for _, id := range []string{c.Scope.TenantID, c.Scope.WorkspaceID, c.Scope.EnvironmentID, c.Scope.EndpointID} {
		if !uuid.MatchString(id) || id == "00000000-0000-0000-0000-000000000000" {
			return nil, ErrConfig
		}
	}
	return &Handler{keys: keys, gate: gate, inbox: inbox, cfg: c, drained: make(chan struct{})}, nil
}

func (h *Handler) admit() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.draining || h.active >= h.cfg.MaxConcurrent {
		return false
	}
	h.active++
	return true
}
func (h *Handler) release() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.active--
	if h.draining && h.active == 0 {
		close(h.drained)
	}
}

// Drain permanently rejects new requests and waits for admitted requests. It does
// not cancel an in-flight commit, falsely mark it absent, or reopen admission when
// the wait times out. ctx must be bounded. Safe to call concurrently/repeatedly.
// The host still owns http.Server.Shutdown, connection draining and port cleanup.
func (h *Handler) Drain(ctx context.Context) error {
	if h == nil || h.drained == nil || ctx == nil {
		return ErrConfig
	}
	if _, ok := ctx.Deadline(); !ok {
		return ErrConfig
	}
	h.mu.Lock()
	if !h.draining {
		h.draining = true
		if h.active == 0 {
			close(h.drained)
		}
	}
	done := h.drained
	h.mu.Unlock()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// DroppedReports returns a local diagnostic-drop counter only. It is not delivery
// loss, a persisted ledger count, a health check or a tenant-labelled global metric.
func (h *Handler) DroppedReports() uint64 {
	if h == nil {
		return 0
	}
	return h.dropped.Load()
}
func (h *Handler) report(r Report) {
	if h == nil || h.cfg.Reports == nil {
		return
	}
	defer func() {
		if recover() != nil {
			h.dropped.Add(1)
		}
	}()
	select {
	case h.cfg.Reports <- r:
	default:
		h.dropped.Add(1)
	}
}
func stage(r *Report, name, result string, start time.Time) {
	if r.StageCount < len(r.Stages) {
		r.Stages[r.StageCount] = Stage{Name: name, Result: result, ElapsedMS: max(0, time.Since(start).Milliseconds()), At: start.UTC()}
		r.StageCount++
	}
}

// ServeHTTP implements only POST application/json for a registered customer-owned
// receiver. It returns 204 solely after a matching acknowledged Inbox receipt.
// No business action occurs here. No caller-derived scope or credential reference
// is used. All adapter calls share one bounded context and occur synchronously;
// adapters MUST honor it. No detached worker or hidden retry is started.
// Request bodies are bounded via MaxBytesReader and original socket deadlines.
// Middleware must preserve ResponseController deadline support or fail closed.
// Response codes/diagnostics contain no request payload, IDs, headers or errors.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	report := Report{HTTPStatus: 503, Code: "RECEIVER_UNAVAILABLE"}
	admitted := false
	entered := time.Now()
	// One final response path prevents accidental implicit 200 on a port failure.
	// Recover only to a neutral failure; a port panic is not proof its write failed.
	defer func() {
		if admitted {
			defer h.release()
		}
		if recover() != nil {
			report.HTTPStatus = 503
			report.Code = "RECEIVER_UNAVAILABLE"
			stage(&report, "handler_fault", "unresolved", entered)
		}
		if admitted && report.StageCount == 1 {
			stage(&report, "request_bounds", "rejected", entered)
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if report.HTTPStatus != 204 {
			w.Header().Set("Content-Type", "application/json")
			if r != nil && r.ProtoMajor == 1 {
				w.Header().Set("Connection", "close")
			}
			w.WriteHeader(report.HTTPStatus)
			_, _ = io.WriteString(w, `{"code":"`+report.Code+`"}`+"\n")
		} else {
			w.WriteHeader(204)
		}
		h.report(report)
	}()
	if h == nil || h.drained == nil || r == nil || r.Body == nil {
		return
	}
	if !h.admit() {
		stage(&report, "admission", "rejected", entered)
		report.Code = "RECEIVER_NOT_ADMITTED"
		return
	}
	admitted = true
	stage(&report, "admission", "admitted", entered)
	ctx, cancel := context.WithTimeout(r.Context(), h.cfg.Timeout)
	defer cancel()
	id := h.cfg.RequestID(ctx)
	if !reference.MatchString(id) {
		report.Code = "RECEIVER_CORRELATION_INVALID"
		return
	}
	report.RequestID = id
	deadline, _ := ctx.Deadline()
	rc := http.NewResponseController(w)
	if rc.SetReadDeadline(deadline) != nil || rc.SetWriteDeadline(deadline) != nil {
		report.Code = "RECEIVER_HOST_UNSUPPORTED"
		return
	}
	if ctx.Err() != nil {
		return
	}
	start := time.Now()
	if r.Method != http.MethodPost {
		report.HTTPStatus = 405
		report.Code = "RECEIVER_METHOD"
		w.Header().Set("Allow", "POST")
		return
	}
	if !headerBounds(r.Header, h.cfg.MaxHeaderBytes) {
		report.HTTPStatus = 431
		report.Code = "RECEIVER_HEADERS"
		return
	}
	ct, ok := single(r.Header, "Content-Type", true)
	kind, params, err := mime.ParseMediaType(ct)
	if !ok || err != nil || kind != "application/json" || len(params) > 1 ||
		(len(params) == 1 && !strings.EqualFold(params["charset"], "utf-8")) {
		report.HTTPStatus = 415
		report.Code = "RECEIVER_MEDIA_TYPE"
		return
	}
	encoding, ok := single(r.Header, "Content-Encoding", false)
	if !ok || (encoding != "" && !strings.EqualFold(encoding, "identity")) || len(r.Trailer) > 0 || hasHeader(r.Header, "Trailer") {
		report.HTTPStatus = 415
		report.Code = "RECEIVER_ENCODING"
		return
	}
	if r.ContentLength > int64(h.cfg.Signing.MaxBodyBytes) {
		report.HTTPStatus = 413
		report.Code = "RECEIVER_BODY_LIMIT"
		return
	}
	stage(&report, "request_bounds", "passed", start)
	start = time.Now()
	keys, err := h.keys.Resolve(ctx, h.cfg.Scope)
	if err != nil || ctx.Err() != nil {
		if errors.Is(err, ErrDenied) {
			report.HTTPStatus = 403
			report.Code = "RECEIVER_DENIED"
		}
		stage(&report, "endpoint_keys", "failed", start)
		return
	}
	stage(&report, "endpoint_keys", "resolved", start)
	start = time.Now()
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, int64(h.cfg.Signing.MaxBodyBytes)))
	if err != nil || ctx.Err() != nil {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			report.HTTPStatus = 413
			report.Code = "RECEIVER_BODY_LIMIT"
		} else {
			report.HTTPStatus = 400
			report.Code = "RECEIVER_BODY_INCOMPLETE"
		}
		stage(&report, "body", "failed", start)
		return
	}
	stage(&report, "body", "read", start)
	start = time.Now()
	event, err := receiving.VerifyEvent(body, r.Header, keys, h.cfg.Clock().Unix(), h.cfg.Signing, h.cfg.Parser)
	if err != nil {
		if errors.Is(err, signing.ErrProof) {
			report.HTTPStatus = 401
			report.Code = "RECEIVER_PROOF"
		}
		if errors.Is(err, receiving.ErrEnvelope) {
			report.HTTPStatus = 422
			report.Code = "RECEIVER_EVENT_REJECTED"
		}
		stage(&report, "proof_and_identity", "failed", start)
		return
	}
	stage(&report, "proof_and_identity", "verified", start)
	if ctx.Err() != nil {
		return
	}
	start = time.Now()
	err = h.gate.Check(ctx, h.cfg.Scope, event)
	if err != nil || ctx.Err() != nil {
		if errors.Is(err, ErrDenied) {
			report.HTTPStatus = 403
			report.Code = "RECEIVER_DENIED"
		}
		if errors.Is(err, ErrRejected) {
			report.HTTPStatus = 422
			report.Code = "RECEIVER_EVENT_REJECTED"
		}
		stage(&report, "schema_and_authority", "failed", start)
		return
	}
	stage(&report, "schema_and_authority", "passed", start)
	proof := event.Proof()
	intent := Identity{h.cfg.Scope, event.EventID(), proof.DeliveryID, proof.BodySHA256}
	start = time.Now()
	receipt, err := h.inbox.Accept(ctx, intent, event)
	if err != nil {
		if errors.Is(err, ErrConflict) {
			report.HTTPStatus = 409
			report.Code = "RECEIVER_DELIVERY_CONFLICT"
		}
		stage(&report, "durable_acceptance", "unacknowledged", start)
		return
	}
	if receipt.Identity != intent || !reference.MatchString(receipt.Ref) || (receipt.State != "accepted" && receipt.State != "duplicate") {
		stage(&report, "durable_acceptance", "mismatched", start)
		return
	}
	// A real acknowledged receipt remains a fact after late cancellation. The
	// original write deadline still bounds response delivery; no deadline is reset.
	report.DurableAccepted = true
	report.HTTPStatus = 204
	report.Code = "RECEIVER_ACCEPTED"
	stage(&report, "durable_acceptance", receipt.State, start)
}

func headerBounds(h http.Header, maximum int) bool {
	if len(h) > 128 {
		return false
	}
	size, count := 0, 0
	for name, values := range h {
		if len(name) > maximum {
			return false
		}
		for _, v := range values {
			count++
			if count > 256 || len(v) > maximum {
				return false
			}
			size += len(name) + len(v) + 4
			if size > maximum {
				return false
			}
		}
	}
	return true
}
func single(h http.Header, name string, required bool) (string, bool) {
	value, count := "", 0
	for k, vs := range h {
		if strings.EqualFold(k, name) {
			if len(vs) != 1 || count != 0 {
				return "", false
			}
			value = vs[0]
			count++
		}
	}
	return value, count == 1 || (!required && count == 0)
}

func hasHeader(h http.Header, name string) bool {
	for k := range h {
		if strings.EqualFold(k, name) {
			return true
		}
	}
	return false
}
