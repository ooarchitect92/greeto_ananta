// Package health separates process liveness from evidence-backed readiness.
// A green process is not evidence that Kafka, a provider, or a backup is healthy.
package health

import "time"

// Check is a server-collected observation. Never populate it from untrusted UI flags.
// EvidenceRef references restricted proof, not credentials or raw customer payloads.
type Check struct {
	ID            string    `json:"id"`
	State         string    `json:"state"`
	ObservedAt    time.Time `json:"observed_at"`
	MaxAgeSeconds int64     `json:"max_age_seconds"`
	EvidenceRef   string    `json:"evidence_ref"`
}

// Result includes all blocking checks, not a percentage that could hide a failure.
type Result struct {
	Ready    bool     `json:"ready"`
	Checks   []Check  `json:"checks"`
	Blocking []string `json:"blocking"`
}

// Evaluate takes the dependency IDs for ONE operation and their latest observations.
// now is injected for reproducible stale/future/clock-boundary tests. An empty
// required list fails closed: no observations never means "everything is ready".
func Evaluate(required []string, observations []Check, now time.Time) Result {
	r := Result{Ready: true, Checks: []Check{}, Blocking: []string{}}
	if len(required) == 0 {
		r.Ready = false
		r.Blocking = append(r.Blocking, "requirements_not_configured")
		return r
	}
	byID := map[string]Check{}
	duplicates := map[string]bool{}
	for _, c := range observations {
		if _, ok := byID[c.ID]; ok {
			duplicates[c.ID] = true
		}
		byID[c.ID] = c
	}
	seen := map[string]bool{}
	for _, id := range required {
		if seen[id] {
			continue
		}
		seen[id] = true
		c, ok := byID[id]
		if !ok {
			c = Check{ID: id, State: "not_configured"}
		}
		if duplicates[id] {
			c.State = "unknown"
		}
		if c.State == "pass" {
			if c.ObservedAt.IsZero() || c.ObservedAt.After(now) || c.MaxAgeSeconds <= 0 || c.MaxAgeSeconds > 86400 || c.EvidenceRef == "" {
				c.State = "unknown"
			} else if now.Sub(c.ObservedAt) > time.Duration(c.MaxAgeSeconds)*time.Second {
				c.State = "stale"
			}
		}
		r.Checks = append(r.Checks, c)
		if id == "" || c.State != "pass" {
			r.Ready = false
			r.Blocking = append(r.Blocking, id)
		}
	}
	return r
}
