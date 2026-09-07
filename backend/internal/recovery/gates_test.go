package recovery

import (
	"testing"
	"time"
)

func evidence(now time.Time) []Evidence {
	out := []Evidence{}
	for i, s := range OrderedSteps() {
		out = append(out, Evidence{Step: s, Reference: "proof", RecoveryID: "restore-1", Verified: true, ObservedAt: now.Add(time.Duration(i-10) * time.Second)})
	}
	return out
}
func TestRecoveryRequiresEveryOrderedVerifiedGate(t *testing.T) {
	now := time.Now().UTC()
	if CanReopen("restore-1", evidence(now), now, time.Minute) != nil {
		t.Fatal("valid ordered proof rejected")
	}
	for i := range OrderedSteps() {
		e := evidence(now)
		e[i].Verified = false
		if CanReopen("restore-1", e, now, time.Minute) == nil {
			t.Fatalf("missing gate %d allowed", i)
		}
	}
}
func TestRecoveryRejectsReorderingReplayAndStaleness(t *testing.T) {
	now := time.Now().UTC()
	for _, which := range []string{"order", "wrong_recovery", "stale", "missing", "future", "empty_reference"} {
		t.Run(which, func(t *testing.T) {
			e := evidence(now)
			switch which {
			case "order":
				e[0], e[1] = e[1], e[0]
			case "wrong_recovery":
				e[0].RecoveryID = "another"
			case "stale":
				e[0].ObservedAt = now.Add(-time.Hour)
			case "missing":
				e = e[:len(e)-1]
			case "future":
				e[7].ObservedAt = now.Add(time.Hour)
			case "empty_reference":
				e[2].Reference = ""
			}
			if CanReopen("restore-1", e, now, time.Minute) == nil {
				t.Fatal("unsafe reopen")
			}
		})
	}
}
func TestRecoveryOrderCannotBeMutatedByCaller(t *testing.T) {
	s := OrderedSteps()
	s[0] = "bypass"
	if OrderedSteps()[0] != "owner_approval" {
		t.Fatal("shared mutable order")
	}
}
