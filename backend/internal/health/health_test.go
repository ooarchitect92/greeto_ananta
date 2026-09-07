package health

import (
	"testing"
	"time"
)

func TestReadinessRequiresPositiveFreshEvidence(t *testing.T) {
	now := time.Date(2026, 9, 7, 0, 0, 0, 0, time.UTC)
	good := Check{ID: "kafka", State: "pass", ObservedAt: now.Add(-time.Second), MaxAgeSeconds: 10, EvidenceRef: "proof-1"}
	tests := []struct {
		name     string
		required []string
		checks   []Check
		ready    bool
	}{
		{"no_requirements", nil, nil, false}, {"missing", []string{"kafka"}, nil, false}, {"fresh", []string{"kafka"}, []Check{good}, true},
		{"missing_second_dependency", []string{"kafka", "kms"}, []Check{good}, false}, {"duplicate_conflict", []string{"kafka"}, []Check{good, good}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := Evaluate(tt.required, tt.checks, now)
			if r.Ready != tt.ready {
				t.Fatalf("%+v", r)
			}
		})
	}
	for _, state := range []string{"fail", "unknown", "not_configured", "stale", ""} {
		t.Run("state_"+state, func(t *testing.T) {
			c := good
			c.State = state
			if Evaluate([]string{"kafka"}, []Check{c}, now).Ready {
				t.Fatal("nonpass ready")
			}
		})
	}
	for _, change := range []struct {
		name  string
		apply func(*Check)
	}{
		{"expired", func(c *Check) { c.ObservedAt = now.Add(-11 * time.Second) }}, {"future", func(c *Check) { c.ObservedAt = now.Add(time.Second) }}, {"zero_time", func(c *Check) { c.ObservedAt = time.Time{} }}, {"no_evidence", func(c *Check) { c.EvidenceRef = "" }}, {"no_max_age", func(c *Check) { c.MaxAgeSeconds = 0 }}, {"overflow_age", func(c *Check) { c.MaxAgeSeconds = 1 << 62 }},
	} {
		t.Run(change.name, func(t *testing.T) {
			c := good
			change.apply(&c)
			if Evaluate([]string{"kafka"}, []Check{c}, now).Ready {
				t.Fatal("bad freshness accepted")
			}
		})
	}
}
