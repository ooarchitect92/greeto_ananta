package lifecycle

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
)

// Receipt records the exact observation intent and durable next-state decision.
// State acceptance describes the endpoint; returning this receipt separately means
// the storage adapter acknowledged its own atomic commit. Neither proves business success.
type Receipt struct {
	Key               Key
	Version           uint64
	ObservationSHA256 string
	Decision          Decision
}

// Snapshot returns the immutable original attempt, plus its existing outcome if any.
// Read must be strongly consistent and scoped. Unresolved attempts must not vanish
// via TTL; do not replace them with another delivery or infer they were never sent.
type Snapshot struct {
	Attempt  Attempt
	Recorded *Receipt
}

// Ledger is owned by the selected WebhookDelivery store, not PostgreSQL control
// data or Redis. A real adapter must implement these semantics before registration.
// Commit atomically compares scope/epoch/attempt + expected aggregate version and
// writes receipt, next due state and required local outbox/effect evidence. It must
// not rewrite recorded outcomes or silently retry a conditional conflict.
// A lost commit acknowledgement returns an error: retry Record with the SAME
// observation, never resend HTTP to discover whether storing the result succeeded.
type Ledger interface {
	Read(context.Context, Key) (Snapshot, error)
	Commit(context.Context, Attempt, Receipt) (Receipt, error)
}

// Authority checks the authenticated workload's exact record-result permission.
// A browser-submitted egress-looking object is not trustworthy. This grant permits
// recording an already-durable attempt only, not signing, sending, replay or deploy.
type Authority interface {
	RequireRecord(context.Context, Key) error
}

// Recorder has no timer, worker registration, fake fallback or network sender.
// Its bounded host context is propagated unchanged to every adapter operation.
type Recorder struct {
	ledger    Ledger
	authority Authority
	planner   *Planner
}

// NewRecorder validates explicit dependencies without I/O. The host must bind
// authorized workload identity, bounded deadlines, and a tested durable ledger.
func NewRecorder(ledger Ledger, authority Authority, planner *Planner) (*Recorder, error) {
	if ledger == nil || authority == nil || planner == nil || !planner.configured {
		return nil, ErrConfiguration
	}
	return &Recorder{ledger: ledger, authority: authority, planner: planner}, nil
}

// observationHash binds scope, delivery, attempt, epoch and minimized observation.
// UTC normalization removes formatting/monotonic-clock differences on replays.
// No sensitive response text or credentials are accepted. It is integrity/identity,
// not independent proof of endpoint truth. Record validates all fields first.
func observationHash(key Key, o Observation) string {
	o.ObservedAt = o.ObservedAt.UTC().Round(0)
	b, _ := json.Marshal(struct {
		Key         Key
		Observation Observation
	}{key, o})
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
func sameReceipt(a, b Receipt) bool {
	return a.Key == b.Key && a.Version == b.Version && a.ObservationSHA256 == b.ObservationSHA256 &&
		a.Decision.State == b.Decision.State && a.Decision.Reason == b.Decision.Reason &&
		a.Decision.StatusCode == b.Decision.StatusCode && a.Decision.NextAttemptAt.Equal(b.Decision.NextAttemptAt)
}

// Record authorizes before looking up state, deterministically plans the result,
// then returns only an exact acknowledged receipt. Repeating the same observation
// recovers the original receipt. Changed observations or concurrent version changes
// conflict; they never overwrite a previous result or cause a new external action.
// ctx MUST have a host deadline <=30s; no unbounded adapter call is accepted.
// On store failure/uncertainty the result is empty with a sanitized stable error.
// After an acknowledged commit, late cancellation does not erase that known fact.
func (r *Recorder) Record(ctx context.Context, key Key, o Observation) (Receipt, error) {
	if r == nil || ctx == nil || r.ledger == nil || r.authority == nil || r.planner == nil || !r.planner.configured {
		return Receipt{}, ErrConfiguration
	}
	deadline, ok := ctx.Deadline()
	if !ok || time.Until(deadline) > 30*time.Second {
		return Receipt{}, ErrConfiguration
	}
	if !validKey(key) {
		return Receipt{}, ErrInput
	}
	if ctx.Err() != nil {
		return Receipt{}, ErrUnavailable
	}
	if r.authority.RequireRecord(ctx, key) != nil {
		return Receipt{}, ErrDenied
	}
	if ctx.Err() != nil {
		return Receipt{}, ErrUnavailable
	}
	snapshot, err := r.ledger.Read(ctx, key)
	if err != nil || ctx.Err() != nil {
		return Receipt{}, ErrUnavailable
	}
	if snapshot.Attempt.Key != key {
		return Receipt{}, ErrUnavailable
	}
	decision, err := r.planner.Plan(snapshot.Attempt, o)
	if err != nil {
		return Receipt{}, err
	}
	desired := Receipt{Key: key, Version: snapshot.Attempt.Version + 1, ObservationSHA256: observationHash(key, o), Decision: decision}
	if snapshot.Recorded != nil {
		if !sameReceipt(*snapshot.Recorded, desired) {
			return Receipt{}, ErrConflict
		}
		return desired, nil
	}
	if ctx.Err() != nil {
		return Receipt{}, ErrUnavailable
	}
	receipt, err := r.ledger.Commit(ctx, snapshot.Attempt, desired)
	if err != nil {
		if err == ErrConflict {
			return Receipt{}, ErrConflict
		}
		return Receipt{}, ErrUnavailable
	}
	if !sameReceipt(receipt, desired) {
		return Receipt{}, ErrUnavailable
	}
	return desired, nil
}
