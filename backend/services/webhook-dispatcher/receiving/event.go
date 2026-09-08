// Package receiving binds the F07 event identity to the already authenticated
// raw JSON body. It is an opt-in customer-webhook receiver helper, not a Meta or
// Telegram verifier, public endpoint, schema registry, or durable replay ledger.
package receiving

import (
	"bytes"
	"errors"
	"net/http"
	"strings"

	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/signing"
)

var (
	// ErrEnvelope is deliberately independent of customer payload/error text.
	ErrEnvelope = errors.New("WEBHOOK_EVENT_ENVELOPE_INVALID")
	ErrLimits   = errors.New("WEBHOOK_EVENT_LIMITS_INVALID")
)

// Limits are explicit receiver-owned parser budgets, not webhook-provided values.
// MaxDepth counts the root object as 1; MaxTokens includes keys and delimiters.
// MaxKeyBytes applies to decoded UTF-8 property names, including nested objects.
// Signing.Policy independently bounds total raw bytes and the replay time window.
type Limits struct {
	MaxDepth, MaxTokens, MaxKeyBytes int
}

// Event is an in-process authenticated-byte snapshot. Its zero value is invalid.
// Fields are private: JSON decoding cannot manufacture a valid Event. Do not use
// an Event as a persistent authorization grant, durable receipt or trust token.
// Retain only minimized Proof metadata under the receiver's approved policy.
type Event struct {
	id    string
	proof signing.Proof
	raw   []byte
}

// Valid reports local verification success only, not schema/permission/processing.
func (e Event) Valid() bool { return e.id != "" && e.raw != nil }

// String and GoString redact normal fmt formatting, including %+v and %#v.
// Explicit RawBody access is sensitive and must never be sent to operational logs.
func (e Event) String() string {
	if e.Valid() {
		return "[verified webhook event: body omitted]"
	}
	return "[unverified webhook event]"
}
func (e Event) GoString() string { return e.String() }

// EventID returns the exact top-level event_id authenticated within the body.
func (e Event) EventID() string { return e.id }

// Proof returns copied delivery ID, key ID, attempt time and raw-body digest.
// The endpoint-scoped receiver ledger still owns repeated-delivery suppression.
func (e Event) Proof() signing.Proof { return e.proof }

// RawBody returns a defensive copy of the exact verified bytes, without JSON
// reserialization. Schema validation and downstream processing must use this
// snapshot, not the caller's original mutable request buffer. No I/O occurs.
func (e Event) RawBody() []byte { return bytes.Clone(e.raw) }

// VerifyEvent first invokes the EXISTING signing.Verify contract unchanged, then
// validates one bounded JSON object and compares its event_id to the event header.
// Parameters: raw body and duplicate-preserving HTTP headers are untrusted; keys,
// signingPolicy, limits and Unix-second now come from authorized endpoint context.
// Callers MUST NOT mutate input buffers/maps/key bytes concurrently during entry.
// A successful result owns a copy of the body, retaining no signing keys/headers.
// Authentication errors are signing.ErrProof/ErrConfig; parser failures are the
// neutral ErrEnvelope; invalid parser budgets return ErrLimits. Errors return a
// zero Event and never include raw JSON, key material or a parser diagnostic.
// No network, replay write, success HTTP response, tenant grant, event-schema or
// business-outcome validation occurs. Durable receiver acceptance is a later gate.
func VerifyEvent(body []byte, headers http.Header, keys []signing.KeyVersion, now int64, signingPolicy signing.Policy, limits Limits) (Event, error) {
	if limits.MaxDepth < 1 || limits.MaxDepth > 64 || limits.MaxTokens < 4 || limits.MaxTokens > 65536 ||
		limits.MaxKeyBytes < 8 || limits.MaxKeyBytes > 4096 {
		return Event{}, ErrLimits
	}
	if signingPolicy.MaxBodyBytes < 1 || signingPolicy.MaxBodyBytes > 1048576 {
		return Event{}, signing.ErrConfig
	}
	if len(body) > signingPolicy.MaxBodyBytes || len(headers) > 128 {
		return Event{}, signing.ErrProof
	}
	// Snapshot only the five relevant headers. No unbounded copy of unrelated
	// multi-value headers is made, and duplicate security headers remain invalid.
	selected := make(http.Header, 5)
	for _, name := range []string{signing.EventHeader, signing.DeliveryHeader, signing.TimestampHeader, signing.KeyHeader, signing.SignatureHeader} {
		count, value := 0, ""
		for key, values := range headers {
			if strings.EqualFold(key, name) {
				if len(values) != 1 || len(values[0]) > 256 || count != 0 {
					return Event{}, signing.ErrProof
				}
				count, value = 1, values[0]
			}
		}
		if count != 1 {
			return Event{}, signing.ErrProof
		}
		selected.Set(name, value)
	}
	raw := bytes.Clone(body)
	proof, err := signing.Verify(raw, selected, keys, now, signingPolicy)
	if err != nil {
		return Event{}, err
	}
	id, err := eventID(raw, limits)
	if err != nil || id != selected.Get(signing.EventHeader) {
		return Event{}, ErrEnvelope
	}
	return Event{id: id, proof: proof, raw: raw}, nil
}
