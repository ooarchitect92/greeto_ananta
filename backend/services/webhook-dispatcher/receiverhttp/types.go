// Package receiverhttp supplies an opt-in customer-owned F07 HTTP receiver
// adapter. No public platform route, listener, secret, store or worker is
// registered. It never replaces the provider-specific F03 callback path.
package receiverhttp

import (
	"context"
	"errors"
	"time"

	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/receiving"
	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/signing"
)

var (
	ErrConfig   = errors.New("RECEIVER_CONFIGURATION")
	ErrDenied   = errors.New("RECEIVER_DENIED")
	ErrRejected = errors.New("RECEIVER_EVENT_REJECTED")
	ErrConflict = errors.New("RECEIVER_DELIVERY_CONFLICT")
)

// Scope is fixed by the authenticated endpoint registration, never by the URL,
// query, a supplied tenant header, or signed JSON. IDs are nonzero UUID strings.
type Scope struct {
	TenantID, WorkspaceID, EnvironmentID, EndpointID string
}

// Keys supplies the current route-owned key ring. Resolve must authorize this
// exact active endpoint, use its secret namespace and honor ctx. It returns one
// or two immutable key versions; it must not use incoming headers to pick a vault
// namespace. Runtime must never bind the synthetic test implementation.
type Keys interface {
	Resolve(context.Context, Scope) ([]signing.KeyVersion, error)
}

// Gate validates the COMPLETE registered event schema, subscription, purpose,
// object permissions and scoped tenant/workspace/environment against the verified
// bytes. VerifyEvent alone does not implement these domain checks. ErrDenied maps
// to 403, ErrRejected to 422, all other failures to 503; no error text is exposed.
// Check has no business side effects. It must honor the original request deadline.
type Gate interface {
	Check(context.Context, Scope, receiving.Event) error
}

// Identity is an acceptance intent, not a bearer grant. The delivery ID and body
// digest remain identical across retries; the signed timestamp is NOT a key.
// Do not replace a repeated delivery with a new ID to mask an uncertain commit.
type Identity struct {
	Scope                           Scope
	EventID, DeliveryID, BodySHA256 string
}

// Receipt is returned only for an acknowledged atomic inbox transaction or a
// strongly read matching prior acceptance. State is accepted or duplicate. Ref
// identifies its minimized durable record, not a URL or raw message body.
// Neither the HTTP 204 nor this receipt proves that business processing completed.
type Receipt struct {
	Identity Identity
	Ref      string
	State    string
}

// Inbox owns the receiver's local durability boundary, NOT the sender's
// WebhookDelivery ledger from INC-010. Accept must atomically persist the scoped
// delivery receipt + required local work (or an encrypted reference) before nil
// error. Same delivery/different event or bytes returns ErrConflict. Same input
// returns the original acceptance without a second effect. Do not key by time.
// Current grants, expiry and erasure controls must be enforced by the binding.
// Store failure/unknown commit returns an error, never an optimistic receipt.
// A nil error after a late cancellation is an acknowledged fact; do not erase it.
// This interface alone is not durable persistence and has NO in-memory fallback.
type Inbox interface {
	Accept(context.Context, Identity, receiving.Event) (Receipt, error)
}

// Stage contains only static names/results and elapsed milliseconds. Scope IDs,
// event IDs, URLs, keys, headers, payloads and underlying errors are excluded.
type Stage struct {
	Name, Result string
	ElapsedMS    int64
	At           time.Time
}

// Report separates local store acknowledgement from an attempted HTTP response.
// HTTPStatus is the status offered to net/http, not proof the peer received it.
// Diagnostics never constitute a durable security audit or processing receipt.
type Report struct {
	RequestID       string
	HTTPStatus      int
	Code            string
	DurableAccepted bool
	Stages          [8]Stage
	StageCount      int
}

// Config is an explicit host-approved profile, with no production defaults.
// Timeout includes key resolution, body, verification, gate and inbox. It is
// 100ms..30s. MaxConcurrent is 1..256; admission never queues. MaxHeaderBytes is
// 1024..65536 for the parsed header set, in ADDITION to server/edge header limits.
// RequestID reads a locally generated or authenticated middleware correlation ID
// from ctx (never a raw caller header). It must be nonblocking. Clock supplies
// trusted UTC wall time solely for signature freshness. It never
// chooses deadlines (which use the actual host clock). Reports is optional and
// best-effort: a full/closed channel drops diagnostics, never delays acceptance.
// The host owns the channel lifetime, approved profile and server shutdown.
type Config struct {
	Scope          Scope
	Signing        signing.Policy
	Parser         receiving.Limits
	Timeout        time.Duration
	MaxConcurrent  int
	MaxHeaderBytes int
	Clock          func() time.Time
	RequestID      func(context.Context) string
	Reports        chan<- Report
}
