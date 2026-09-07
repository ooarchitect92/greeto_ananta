// Package recovery evaluates readiness evidence; it does not promote a database.
// Real restoration, fencing and erasure reapplication require privileged adapters
// and independent review. A UI boolean cannot authorize regional takeover.
package recovery

import (
	"errors"
	"time"
)

// OrderedSteps preserves architecture section 29.1. Copies prevent callers from
// mutating the package's recovery order through a shared slice.
func OrderedSteps() []string {
	return []string{"owner_approval", "old_writers_fenced", "certified_restore", "erasures_reapplied", "checkpoints_replayed", "unknown_actions_reconciled", "policies_verified", "canary_verified"}
}

// Evidence is attested by a trusted recovery adapter. Reference alone is NOT proof;
// the adapter must verify its issuer, signature/scope and actual restored resource.
type Evidence struct {
	Step, Reference, RecoveryID string
	Verified                    bool
	ObservedAt                  time.Time
}

// CanReopen checks a single recovery's ordered evidence with bounded freshness.
// It intentionally does not implement automatic primary/backup dual writes.
func CanReopen(recoveryID string, evidence []Evidence, now time.Time, maxAge time.Duration) error {
	if recoveryID == "" || maxAge <= 0 || maxAge > 24*time.Hour {
		return errors.New("invalid_recovery_request")
	}
	steps := OrderedSteps()
	if len(evidence) != len(steps) {
		return errors.New("incomplete_recovery_evidence")
	}
	var previous time.Time
	for i, step := range steps {
		e := evidence[i]
		if e.Step != step || e.RecoveryID != recoveryID || !e.Verified || e.Reference == "" || e.ObservedAt.IsZero() || e.ObservedAt.After(now) || now.Sub(e.ObservedAt) > maxAge || e.ObservedAt.Before(previous) {
			return errors.New("recovery_gate_blocked: " + step)
		}
		previous = e.ObservedAt
	}
	return nil
}
