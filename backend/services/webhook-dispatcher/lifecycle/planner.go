// Package lifecycle owns F07 attempt-result decisions, not network dispatch.
// A delivery and attempt must already be durable before signing/HTTPS. No function
// here sends, sleeps, grants permission, registers a worker or bypasses the gateway.
package lifecycle

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	ErrConfiguration = errors.New("WEBHOOK_LIFECYCLE_CONFIGURATION")
	ErrInput         = errors.New("WEBHOOK_LIFECYCLE_INPUT")
	ErrConflict      = errors.New("WEBHOOK_RECEIPT_CONFLICT")
	ErrUnavailable   = errors.New("WEBHOOK_RECEIPT_UNAVAILABLE")
	ErrDenied        = errors.New("WEBHOOK_RECEIPT_DENIED")
)

const (
	Accepted  = "ACCEPTED_BY_ENDPOINT"
	RetryWait = "RETRY_WAIT"
	Failed    = "FAILED_DELIVERY"
	Paused    = "PAUSED"
	Unknown   = "UNKNOWN"
	Blocked   = "BLOCKED"
)

var uuid = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var token = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)

// Key is immutable host-authorized scope plus the existing delivery/attempt IDs.
// Epoch fences storage updates; it cannot undo a POST already received remotely.
// A retry retains DeliveryID; an explicit replay is a separately authorized record.
type Key struct {
	TenantID, WorkspaceID, EnvironmentID, EndpointID string
	EventID, DeliveryID, AttemptID                   string
	Epoch                                            uint64
}

// Attempt is read from authoritative durable state, never assembled from HTTP JSON.
// Version is the aggregate version observed before this attempt's outcome commits.
// Sequence starts at 1. JitterSample is persisted once (0..1,000,000 inclusive),
// not regenerated on every retry of the result-recording operation.
type Attempt struct {
	Key                            Key
	Version                        uint64
	Sequence                       int
	CreatedAt, StartedAt, Deadline time.Time
	PolicyVersion                  string
	JitterSample                   uint32
}

// Observation is a minimized result from the trusted INC-008 egress adapter.
// ObservedAt is the trusted time at which that result was captured, not a receiver
// Date header. Outcome/status remain authoritative even if response-body reading
// failed afterwards. Do not pass URLs, bodies, headers or underlying error text.
type Observation struct {
	AttemptID, Outcome, FailureCode, RetryAfter string
	StatusCode                                  int
	ObservedAt                                  time.Time
}

// Policy is an explicit, versioned, owner-approved host profile. There is NO
// installed default schedule. RetryDelays[i] is the minimum wait after observing
// failed attempt i+1. Positive jitter may extend it; Retry-After can only extend it.
// MaxAge/MaxAttempts bound automatic retries, not evidence retention or UNKNOWN.
// BeforeSendCodes may contain only safe pre-HTTP transient failures listed below.
type Policy struct {
	Version           string
	MaxAttempts       int
	MaxAge            time.Duration
	RetryDelays       []time.Duration
	MaxJitterPermille uint16
	RetryStatusCodes  []int
	BeforeSendCodes   []string
}

// Decision requests a durable state transition. NextAttemptAt is nonzero ONLY for
// RETRY_WAIT. PAUSED does not itself disable another module's endpoint record.
// UNKNOWN must be retained for reconciliation, including beyond deadline/budget.
// ACCEPTED_BY_ENDPOINT is not customer business completion or local commit proof.
type Decision struct {
	State, Reason string
	NextAttemptAt time.Time
	StatusCode    int
}

// Planner holds a copied immutable policy and is safe for concurrent calls.
type Planner struct {
	policy     Policy
	configured bool
}

// New validates the explicit profile with defensive ceilings (64 attempts, seven
// days age, 24h per delay), not production tuning defaults. No I/O or side effects.
// Invalid profiles fail before a result can create a schedule or durable receipt.
func New(p Policy) (*Planner, error) {
	if !token.MatchString(p.Version) || p.MaxAttempts < 1 || p.MaxAttempts > 64 ||
		p.MaxAge < time.Second || p.MaxAge > 7*24*time.Hour ||
		len(p.RetryDelays) != p.MaxAttempts-1 || p.MaxJitterPermille > 1000 ||
		len(p.RetryStatusCodes) > 104 || len(p.BeforeSendCodes) > 3 {
		return nil, ErrConfiguration
	}
	for _, d := range p.RetryDelays {
		if d < time.Millisecond || d > 24*time.Hour {
			return nil, ErrConfiguration
		}
	}
	seen := map[int]bool{}
	for _, code := range p.RetryStatusCodes {
		if seen[code] || !(code == 408 || code == 425 || code == 429 || code >= 500 && code <= 599) {
			return nil, ErrConfiguration
		}
		seen[code] = true
	}
	codes := map[string]bool{}
	for _, code := range p.BeforeSendCodes {
		if codes[code] || !(code == "EGRESS_BUSY" || code == "DNS_UNAVAILABLE" || code == "CONNECT_FAILED") {
			return nil, ErrConfiguration
		}
		codes[code] = true
	}
	p.RetryDelays = append([]time.Duration(nil), p.RetryDelays...)
	p.RetryStatusCodes = append([]int(nil), p.RetryStatusCodes...)
	p.BeforeSendCodes = append([]string(nil), p.BeforeSendCodes...)
	return &Planner{policy: p, configured: true}, nil
}

func validKey(k Key) bool {
	for _, id := range []string{k.TenantID, k.WorkspaceID, k.EnvironmentID, k.EndpointID, k.AttemptID} {
		if !uuid.MatchString(id) || id == "00000000-0000-0000-0000-000000000000" {
			return false
		}
	}
	// Signing v1 excludes the framing delimiter from event/delivery identities.
	return token.MatchString(k.EventID) && !strings.Contains(k.EventID, ".") &&
		token.MatchString(k.DeliveryID) && !strings.Contains(k.DeliveryID, ".") && k.Epoch > 0
}
func validTime(t time.Time) bool { return !t.IsZero() && t.Year() >= 1970 && t.Year() <= 9999 }
func has[T comparable](values []T, target T) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

// Plan deterministically maps one durable attempt and its trusted observation to
// a proposed next state. Params are value objects; no policy or input is mutated.
// The original observation time and persisted jitter make crash replay repeatable.
// Returns no permission to send: current gateway/endpoint/ownership checks remain
// mandatory when a RETRY_WAIT record becomes due. No database/network/clock I/O.
func (p *Planner) Plan(a Attempt, o Observation) (Decision, error) {
	if p == nil || !p.configured {
		return Decision{}, ErrConfiguration
	}
	if !validKey(a.Key) || a.Version == 0 || a.Version == ^uint64(0) || a.Sequence < 1 || a.Sequence > 64 ||
		a.PolicyVersion != p.policy.Version || a.JitterSample > 1000000 ||
		!validTime(a.CreatedAt) || !validTime(a.StartedAt) || !validTime(a.Deadline) || !validTime(o.ObservedAt) ||
		a.StartedAt.Before(a.CreatedAt) || !a.Deadline.After(a.CreatedAt) ||
		!a.StartedAt.Before(a.Deadline) || o.ObservedAt.Before(a.StartedAt) || o.AttemptID != a.Key.AttemptID ||
		len(o.RetryAfter) > 128 || len(o.FailureCode) > 64 {
		return Decision{}, ErrInput
	}
	// Allowlisted diagnostics only. New transport codes need explicit compatibility
	// handling; do not copy arbitrary customer text into durable operational records.
	if !has([]string{"", "EGRESS_CONFIGURATION", "CANCELLED", "EGRESS_BUSY", "SCOPE_INVALID", "REQUEST_TOO_LARGE",
		"DESTINATION_INVALID", "DESTINATION_BLOCKED", "PORT_BLOCKED", "HEADERS_INVALID", "EGRESS_DENIED", "DNS_UNAVAILABLE", "ADDRESS_BLOCKED",
		"CONNECT_FAILED", "PEER_MISMATCH", "TLS_FAILED", "HTTP_UNAVAILABLE", "CONNECTION_NOT_REPLAYABLE",
		"RESPONSE_ENCODING", "RESPONSE_TOO_LARGE", "RESPONSE_INCOMPLETE"}, o.FailureCode) {
		return Decision{}, ErrInput
	}
	// The current transport can attach only response-collection failures after
	// observing HTTP headers. Reject impossible cross-stage outcome combinations.
	responseFailure := has([]string{"", "RESPONSE_ENCODING", "RESPONSE_TOO_LARGE", "RESPONSE_INCOMPLETE"}, o.FailureCode)
	if (o.Outcome == "accepted_by_endpoint" || o.Outcome == "not_accepted") && !responseFailure {
		return Decision{}, ErrInput
	}
	if o.Outcome == "blocked" && responseFailure {
		return Decision{}, ErrInput
	}
	if o.Outcome == "unknown" && !has([]string{"", "HTTP_UNAVAILABLE", "CANCELLED"}, o.FailureCode) {
		return Decision{}, ErrInput
	}
	d := Decision{StatusCode: o.StatusCode}
	switch o.Outcome {
	case "accepted_by_endpoint":
		if o.StatusCode < 200 || o.StatusCode > 299 {
			return Decision{}, ErrInput
		}
		d.State, d.Reason = Accepted, "endpoint_acknowledged"
		return d, nil
	case "unknown":
		if o.StatusCode != 0 {
			return Decision{}, ErrInput
		}
		d.State, d.Reason = Unknown, "reconciliation_required"
		return d, nil
	case "blocked":
		if o.StatusCode != 0 || o.FailureCode == "" {
			return Decision{}, ErrInput
		}
		if !has(p.policy.BeforeSendCodes, o.FailureCode) {
			d.State, d.Reason = Blocked, "pre_send_blocked"
			return d, nil
		}
	case "not_accepted":
		if o.StatusCode < 300 || o.StatusCode > 599 {
			return Decision{}, ErrInput
		}
		if o.StatusCode < 400 {
			d.State, d.Reason = Paused, "destination_revalidation_required"
			return d, nil
		}
		if o.StatusCode == 401 || o.StatusCode == 403 {
			d.State, d.Reason = Paused, "authentication_attention_required"
			return d, nil
		}
		if o.StatusCode == 410 {
			d.State, d.Reason = Failed, "destination_removed"
			return d, nil
		}
		if !has(p.policy.RetryStatusCodes, o.StatusCode) {
			d.State, d.Reason = Failed, "non_retryable_response"
			return d, nil
		}
	default:
		return Decision{}, ErrInput
	}
	// Acceptance/uncertainty above outrank expiry. Never rewrite a real 2xx or an
	// unknown POST to FAILED_DELIVERY merely because a timer or retry budget ended.
	cutoff := a.CreatedAt.Add(p.policy.MaxAge)
	if a.Deadline.Before(cutoff) {
		cutoff = a.Deadline
	}
	if a.Sequence >= p.policy.MaxAttempts {
		d.State, d.Reason = Failed, "attempt_limit"
		return d, nil
	}
	if !o.ObservedAt.Before(cutoff) {
		d.State, d.Reason = Failed, "delivery_deadline"
		return d, nil
	}
	delay := p.policy.RetryDelays[a.Sequence-1]
	span := delay * time.Duration(p.policy.MaxJitterPermille) / 1000
	sample := time.Duration(a.JitterSample)
	// Divide before multiplying to avoid overflow even at the defensive ceilings.
	jitter := (span/1000000)*sample + (span%1000000)*sample/1000000
	next := o.ObservedAt.Add(delay + jitter)
	if o.Outcome == "not_accepted" && o.RetryAfter != "" {
		hint, beyond, err := retryAfter(o.RetryAfter, o.ObservedAt, cutoff)
		if err != nil {
			return Decision{}, err
		}
		if beyond {
			d.State, d.Reason = Failed, "retry_after_exceeds_deadline"
			return d, nil
		}
		if hint.After(next) {
			next = hint
		}
	}
	if !next.Before(cutoff) {
		d.State, d.Reason = Failed, "delivery_deadline"
		return d, nil
	}
	d.State, d.Reason, d.NextAttemptAt = RetryWait, "retry_scheduled", next.UTC().Round(0)
	return d, nil
}

// Parse only the normalized INC-008 hint. RFC 9110 delay seconds start when the
// response is received, not when a delayed scheduler eventually processes it.
// A huge valid hint expires the delivery rather than overflowing or being capped
// into an earlier-than-requested retry. Invalid text is never persisted as a reason.
func retryAfter(raw string, observed, cutoff time.Time) (time.Time, bool, error) {
	digits := raw != ""
	for _, c := range raw {
		if c < '0' || c > '9' {
			digits = false
		}
	}
	if digits {
		if len(raw) > 12 {
			return time.Time{}, false, ErrInput
		}
		seconds, err := strconv.ParseUint(raw, 10, 64)
		if err != nil {
			return time.Time{}, false, ErrInput
		}
		if seconds > uint64(cutoff.Sub(observed)/time.Second) {
			return time.Time{}, true, nil
		}
		t := observed.Add(time.Duration(seconds) * time.Second)
		return t, !t.Before(cutoff), nil
	}
	t, err := http.ParseTime(raw)
	if err != nil {
		return time.Time{}, false, ErrInput
	}
	return t, !t.Before(cutoff), nil
}
