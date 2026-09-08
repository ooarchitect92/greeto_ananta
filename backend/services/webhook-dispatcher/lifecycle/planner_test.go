package lifecycle

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

var clock = time.Date(2026, 9, 8, 0, 0, 0, 0, time.UTC)

func key() Key {
	return Key{"00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000004", "evt_example", "delivery_example", "00000000-0000-0000-0000-000000000005", 7}
}
func attempt() Attempt {
	return Attempt{Key: key(), Version: 11, Sequence: 1, CreatedAt: clock, StartedAt: clock.Add(time.Minute), Deadline: clock.Add(24 * time.Hour), PolicyVersion: "fixture-v1", JitterSample: 500000}
}
func policy() Policy {
	return Policy{Version: "fixture-v1", MaxAttempts: 4, MaxAge: 24 * time.Hour, RetryDelays: []time.Duration{10 * time.Second, time.Minute, 5 * time.Minute}, MaxJitterPermille: 100, RetryStatusCodes: []int{408, 425, 429, 500, 502, 503, 504}, BeforeSendCodes: []string{"EGRESS_BUSY", "DNS_UNAVAILABLE", "CONNECT_FAILED"}}
}
func observation() Observation {
	return Observation{AttemptID: key().AttemptID, Outcome: "not_accepted", StatusCode: 503, ObservedAt: clock.Add(62 * time.Second)}
}
func planner(t *testing.T) *Planner {
	t.Helper()
	p, e := New(policy())
	if e != nil {
		t.Fatal(e)
	}
	return p
}

func TestStates(t *testing.T) {
	cases := []struct {
		name, outcome       string
		status              int
		code, state, reason string
	}{
		{"accepted", "accepted_by_endpoint", 202, "", Accepted, "endpoint_acknowledged"},
		{"accepted_body_truncated", "accepted_by_endpoint", 204, "RESPONSE_INCOMPLETE", Accepted, "endpoint_acknowledged"},
		{"accepted_body_limit", "accepted_by_endpoint", 200, "RESPONSE_TOO_LARGE", Accepted, "endpoint_acknowledged"},
		{"accepted_bad_encoding", "accepted_by_endpoint", 299, "RESPONSE_ENCODING", Accepted, "endpoint_acknowledged"},
		{"unknown_http", "unknown", 0, "HTTP_UNAVAILABLE", Unknown, "reconciliation_required"},
		{"unknown_cancelled", "unknown", 0, "CANCELLED", Unknown, "reconciliation_required"},
		{"redirect", "not_accepted", 302, "", Paused, "destination_revalidation_required"},
		{"permanent_redirect", "not_accepted", 308, "", Paused, "destination_revalidation_required"},
		{"auth_required", "not_accepted", 401, "", Paused, "authentication_attention_required"},
		{"forbidden", "not_accepted", 403, "", Paused, "authentication_attention_required"},
		{"gone", "not_accepted", 410, "", Failed, "destination_removed"},
		{"bad_input", "not_accepted", 422, "", Failed, "non_retryable_response"},
		{"not_found", "not_accepted", 404, "", Failed, "non_retryable_response"},
		{"unlisted_5xx", "not_accepted", 501, "", Failed, "non_retryable_response"},
		{"rate_limited", "not_accepted", 429, "", RetryWait, "retry_scheduled"},
		{"service_unavailable", "not_accepted", 503, "", RetryWait, "retry_scheduled"},
		{"pre_send_dns", "blocked", 0, "DNS_UNAVAILABLE", RetryWait, "retry_scheduled"},
		{"pre_send_connect", "blocked", 0, "CONNECT_FAILED", RetryWait, "retry_scheduled"},
		{"pre_send_busy", "blocked", 0, "EGRESS_BUSY", RetryWait, "retry_scheduled"},
		{"revoked", "blocked", 0, "EGRESS_DENIED", Blocked, "pre_send_blocked"},
		{"ssrf", "blocked", 0, "ADDRESS_BLOCKED", Blocked, "pre_send_blocked"},
		{"tls", "blocked", 0, "TLS_FAILED", Blocked, "pre_send_blocked"},
		{"cancel_before_send", "blocked", 0, "CANCELLED", Blocked, "pre_send_blocked"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			o := observation()
			o.Outcome, o.StatusCode, o.FailureCode = c.outcome, c.status, c.code
			d, e := planner(t).Plan(attempt(), o)
			if e != nil || d.State != c.state || d.Reason != c.reason || d.StatusCode != c.status {
				t.Fatalf("%+v %v", d, e)
			}
			if (d.State == RetryWait) == d.NextAttemptAt.IsZero() {
				t.Fatal("incorrect due time")
			}
		})
	}
}
func TestTiming(t *testing.T) {
	cases := []struct {
		name, hint    string
		sequence      int
		age, deadline time.Duration
		state, reason string
		wait          time.Duration
	}{
		{"positive_jitter", "", 1, 62 * time.Second, 24 * time.Hour, RetryWait, "retry_scheduled", 10500 * time.Millisecond},
		{"second_delay", "", 2, 62 * time.Second, 24 * time.Hour, RetryWait, "retry_scheduled", 63 * time.Second},
		{"zero_hint_does_not_skip_backoff", "0", 1, 62 * time.Second, 24 * time.Hour, RetryWait, "retry_scheduled", 10500 * time.Millisecond},
		{"longer_hint", "120", 1, 62 * time.Second, 24 * time.Hour, RetryWait, "retry_scheduled", 120 * time.Second},
		{"http_date", clock.Add(5 * time.Minute).Format(http.TimeFormat), 1, 62 * time.Second, 24 * time.Hour, RetryWait, "retry_scheduled", 238 * time.Second},
		{"past_date", clock.Format(http.TimeFormat), 1, 62 * time.Second, 24 * time.Hour, RetryWait, "retry_scheduled", 10500 * time.Millisecond},
		{"attempts_exhausted", "", 4, 62 * time.Second, 24 * time.Hour, Failed, "attempt_limit", 0},
		{"deadline_elapsed", "", 1, 2 * time.Minute, 90 * time.Second, Failed, "delivery_deadline", 0},
		{"due_equals_deadline", "10", 1, 62 * time.Second, 72500 * time.Millisecond, Failed, "delivery_deadline", 0},
		{"hint_equals_deadline", "28", 1, 62 * time.Second, 90 * time.Second, Failed, "retry_after_exceeds_deadline", 0},
		{"huge_hint_no_overflow", "999999999999", 1, 62 * time.Second, 24 * time.Hour, Failed, "retry_after_exceeds_deadline", 0},
		{"max_age_not_extended", "", 1, 24 * time.Hour, 48 * time.Hour, Failed, "delivery_deadline", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a, o := attempt(), observation()
			a.Sequence, a.Deadline = c.sequence, clock.Add(c.deadline)
			o.RetryAfter, o.ObservedAt = c.hint, clock.Add(c.age)
			d, e := planner(t).Plan(a, o)
			if e != nil || d.State != c.state || d.Reason != c.reason {
				t.Fatalf("%+v %v", d, e)
			}
			if c.wait > 0 && !d.NextAttemptAt.Equal(o.ObservedAt.Add(c.wait)) {
				t.Fatalf("due %v", d.NextAttemptAt)
			}
		})
	}
}
func TestAcceptanceAndUnknownSurviveDeadlineAndBudget(t *testing.T) {
	for _, outcome := range []string{"accepted_by_endpoint", "unknown"} {
		t.Run(outcome, func(t *testing.T) {
			a, o := attempt(), observation()
			a.Sequence = 4
			o.ObservedAt = clock.Add(72 * time.Hour)
			o.Outcome = outcome
			o.StatusCode = 0
			if outcome == "accepted_by_endpoint" {
				o.StatusCode = 200
			}
			d, e := planner(t).Plan(a, o)
			if e != nil || d.State == Failed || !d.NextAttemptAt.IsZero() {
				t.Fatal(d, e)
			}
		})
	}
}
func TestInvalidPolicies(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Policy)
	}{
		{"empty_version", func(p *Policy) { p.Version = "" }}, {"zero_attempts", func(p *Policy) { p.MaxAttempts = 0 }},
		{"too_many_attempts", func(p *Policy) { p.MaxAttempts = 65 }}, {"zero_age", func(p *Policy) { p.MaxAge = 0 }},
		{"age_ceiling", func(p *Policy) { p.MaxAge = 8 * 24 * time.Hour }}, {"missing_delay", func(p *Policy) { p.RetryDelays = nil }},
		{"negative_delay", func(p *Policy) { p.RetryDelays[0] = -time.Second }}, {"delay_ceiling", func(p *Policy) { p.RetryDelays[0] = 25 * time.Hour }},
		{"jitter_ceiling", func(p *Policy) { p.MaxJitterPermille = 1001 }}, {"duplicate_status", func(p *Policy) { p.RetryStatusCodes = []int{503, 503} }},
		{"retry_redirect_forbidden", func(p *Policy) { p.RetryStatusCodes = []int{307} }}, {"retry_auth_forbidden", func(p *Policy) { p.RetryStatusCodes = []int{401} }},
		{"retry_removed_forbidden", func(p *Policy) { p.RetryStatusCodes = []int{410} }}, {"denial_not_transient", func(p *Policy) { p.BeforeSendCodes = []string{"EGRESS_DENIED"} }},
		{"duplicate_transient", func(p *Policy) { p.BeforeSendCodes = []string{"CONNECT_FAILED", "CONNECT_FAILED"} }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := policy()
			c.mutate(&p)
			if _, e := New(p); e != ErrConfiguration {
				t.Fatal(e)
			}
		})
	}
}
func TestInvalidObservationsAndAttempts(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Attempt, *Observation)
	}{
		{"scope", func(a *Attempt, o *Observation) { a.Key.TenantID = "foreign" }}, {"nil_id", func(a *Attempt, o *Observation) {
			a.Key.WorkspaceID = strings.Repeat("0", 8) + "-0000-0000-0000-000000000000"
		}},
		{"zero_epoch", func(a *Attempt, o *Observation) { a.Key.Epoch = 0 }}, {"framing_delimiter", func(a *Attempt, o *Observation) { a.Key.DeliveryID = "a.b" }},
		{"version_overflow", func(a *Attempt, o *Observation) { a.Version = ^uint64(0) }}, {"zero_sequence", func(a *Attempt, o *Observation) { a.Sequence = 0 }},
		{"wrong_policy", func(a *Attempt, o *Observation) { a.PolicyVersion = "other" }}, {"jitter_outside_range", func(a *Attempt, o *Observation) { a.JitterSample = 1000001 }},
		{"started_after_deadline", func(a *Attempt, o *Observation) { a.StartedAt = a.Deadline }}, {"observed_before_send", func(a *Attempt, o *Observation) { o.ObservedAt = a.CreatedAt }},
		{"unrelated_attempt", func(a *Attempt, o *Observation) { o.AttemptID = "00000000-0000-0000-0000-000000000009" }},
		{"wrong_accepted_status", func(a *Attempt, o *Observation) { o.Outcome = "accepted_by_endpoint" }},
		{"unknown_with_status", func(a *Attempt, o *Observation) { o.Outcome = "unknown" }},
		{"blocked_with_status", func(a *Attempt, o *Observation) { o.Outcome = "blocked" }},
		{"blocked_without_reason", func(a *Attempt, o *Observation) { o.Outcome = "blocked"; o.StatusCode = 0 }},
		{"unrecognized_outcome", func(a *Attempt, o *Observation) { o.Outcome = "success" }},
		{"nonfinal_status", func(a *Attempt, o *Observation) { o.StatusCode = 103 }},
		{"secret_error_text", func(a *Attempt, o *Observation) { o.FailureCode = "password=secret" }},
		{"malformed_hint", func(a *Attempt, o *Observation) { o.RetryAfter = "-4" }},
		{"fractional_hint", func(a *Attempt, o *Observation) { o.RetryAfter = "2.5" }},
		{"oversized_hint", func(a *Attempt, o *Observation) { o.RetryAfter = strings.Repeat("9", 129) }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a, o := attempt(), observation()
			c.mutate(&a, &o)
			if _, e := planner(t).Plan(a, o); e != ErrInput {
				t.Fatal(e)
			}
		})
	}
}
func TestCopiedPolicyAndDeterminism(t *testing.T) {
	cfg := policy()
	p, e := New(cfg)
	if e != nil {
		t.Fatal(e)
	}
	cfg.RetryDelays[0] = 24 * time.Hour
	cfg.RetryStatusCodes[0] = 401
	cfg.BeforeSendCodes[0] = "EGRESS_DENIED"
	a, o := attempt(), observation()
	x, e := p.Plan(a, o)
	y, e2 := p.Plan(a, o)
	if e != nil || e2 != nil || x != y || x.State != RetryWait {
		t.Fatal(x, y, e, e2)
	}
}
func TestMaximumJitterDoesNotOverflow(t *testing.T) {
	cfg := policy()
	cfg.MaxJitterPermille = 1000
	cfg.RetryDelays[0] = 24 * time.Hour
	cfg.MaxAge = 7 * 24 * time.Hour
	p, _ := New(cfg)
	a, o := attempt(), observation()
	a.Deadline = clock.Add(7 * 24 * time.Hour)
	a.JitterSample = 1000000
	d, e := p.Plan(a, o)
	if e != nil || !d.NextAttemptAt.Equal(o.ObservedAt.Add(48*time.Hour)) {
		t.Fatal(d, e)
	}
}
func TestNilPlanner(t *testing.T) {
	var p *Planner
	if _, e := p.Plan(attempt(), observation()); e != ErrConfiguration {
		t.Fatal(e)
	}
}
func TestNoRetriesProfile(t *testing.T) {
	cfg := Policy{Version: "fixture-v1", MaxAttempts: 1, MaxAge: time.Hour}
	p, e := New(cfg)
	if e != nil {
		t.Fatal(e)
	}
	d, e := p.Plan(attempt(), observation())
	if e != nil || d.State != Failed {
		t.Fatal(d, e)
	}
}
func TestPlannerConcurrentRead(t *testing.T) {
	p := planner(t)
	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			d, e := p.Plan(attempt(), observation())
			if e != nil || d.State != RetryWait {
				t.Error(d, e)
			}
		}()
	}
	wg.Wait()
}
func FuzzNeverSchedulePastDeadline(f *testing.F) {
	f.Add(uint32(12), uint32(0), uint16(503))
	f.Add(uint32(999999), uint32(1000000), uint16(429))
	f.Fuzz(func(t *testing.T, hint, jitter uint32, status uint16) {
		p, _ := New(policy())
		a, o := attempt(), observation()
		a.JitterSample = jitter % 1000001
		o.RetryAfter = fmt.Sprint(hint)
		o.StatusCode = 300 + int(status)%300
		d, e := p.Plan(a, o)
		if e == nil && d.State == RetryWait && (!d.NextAttemptAt.Before(a.Deadline) || d.NextAttemptAt.Before(o.ObservedAt)) {
			t.Fatal(d)
		}
	})
}

func TestZeroValuePlannerRejected(t *testing.T) {
	p := &Planner{}
	if _, e := p.Plan(attempt(), observation()); e != ErrConfiguration {
		t.Fatal(e)
	}
}
func TestInconsistentFailureStagesRejected(t *testing.T) {
	for _, outcome := range []string{"accepted_by_endpoint", "not_accepted", "unknown", "blocked"} {
		t.Run(outcome, func(t *testing.T) {
			o := observation()
			o.Outcome = outcome
			switch outcome {
			case "accepted_by_endpoint":
				o.StatusCode = 200
				o.FailureCode = "DNS_UNAVAILABLE"
			case "not_accepted":
				o.FailureCode = "EGRESS_DENIED"
			case "unknown":
				o.StatusCode = 0
				o.FailureCode = "RESPONSE_TOO_LARGE"
			case "blocked":
				o.StatusCode = 0
				o.FailureCode = "RESPONSE_INCOMPLETE"
			}
			if _, e := planner(t).Plan(attempt(), o); e != ErrInput {
				t.Fatal(e)
			}
		})
	}
}
