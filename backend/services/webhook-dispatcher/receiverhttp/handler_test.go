package receiverhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/receiving"
	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/signing"
)

type keyFunc func(context.Context, Scope) ([]signing.KeyVersion, error)

func (f keyFunc) Resolve(c context.Context, s Scope) ([]signing.KeyVersion, error) { return f(c, s) }

type gateFunc func(context.Context, Scope, receiving.Event) error

func (f gateFunc) Check(c context.Context, s Scope, e receiving.Event) error { return f(c, s, e) }

type inboxFunc func(context.Context, Identity, receiving.Event) (Receipt, error)

func (f inboxFunc) Accept(c context.Context, i Identity, e receiving.Event) (Receipt, error) {
	return f(c, i, e)
}

// A deadline-capable recorder for unit cases; real socket/TLS cases are separate.
type writer struct {
	*httptest.ResponseRecorder
	readDeadline, writeDeadline time.Time
	deadlineErr                 error
}

func (w *writer) SetReadDeadline(t time.Time) error  { w.readDeadline = t; return w.deadlineErr }
func (w *writer) SetWriteDeadline(t time.Time) error { w.writeDeadline = t; return w.deadlineErr }
func newWriter() *writer                             { return &writer{ResponseRecorder: httptest.NewRecorder()} }

func key() signing.KeyVersion {
	return signing.KeyVersion{ID: "fixture-key", Secret: bytes.Repeat([]byte{0x35}, 32), NotBefore: 1, SignUntil: 2000, VerifyUntil: 2100}
}
func config() Config {
	return Config{
		Scope:   Scope{"10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000002", "30000000-0000-0000-0000-000000000003", "40000000-0000-0000-0000-000000000004"},
		Signing: signing.Policy{MaxAgeSeconds: 300, MaxFutureSkewSeconds: 10, MaxBodyBytes: 1024},
		Parser:  receiving.Limits{MaxDepth: 8, MaxTokens: 128, MaxKeyBytes: 128},
		Timeout: time.Second, MaxConcurrent: 8, MaxHeaderBytes: 8192, Clock: func() time.Time { return time.Unix(1000, 0) }, RequestID: func(context.Context) string { return "req-fixture" },
	}
}
func payload() []byte {
	return []byte(`{"event_id":"evt-001","event_type":"test.fixture","tenant_id":"10000000-0000-0000-0000-000000000001","data":"private_note"}`)
}
func request(t *testing.T, body []byte) *http.Request {
	t.Helper()
	h, err := signing.Sign(body, "evt-001", "delivery-001", key(), 1000, signing.Policy{MaxAgeSeconds: 300, MaxBodyBytes: 1048576})
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "https://receiver.example/callback", bytes.NewReader(body))
	r.Header = h
	r.Header.Set("Content-Type", "application/json")
	return r
}
func mustHandler(t *testing.T, k Keys, g Gate, i Inbox, c Config) *Handler {
	t.Helper()
	h, err := New(k, g, i, c)
	if err != nil {
		t.Fatal(err)
	}
	return h
}
func ports() (Keys, Gate, Inbox) {
	return keyFunc(func(context.Context, Scope) ([]signing.KeyVersion, error) { return []signing.KeyVersion{key()}, nil }),
		gateFunc(func(_ context.Context, s Scope, e receiving.Event) error {
			// Synthetic schema/authority gate, not a production schema registry.
			var p struct {
				Type   string `json:"event_type"`
				Tenant string `json:"tenant_id"`
			}
			if json.Unmarshal(e.RawBody(), &p) != nil || p.Type != "test.fixture" {
				return ErrRejected
			}
			if p.Tenant != s.TenantID {
				return ErrDenied
			}
			return nil
		}),
		inboxFunc(func(_ context.Context, i Identity, _ receiving.Event) (Receipt, error) {
			return Receipt{i, "receipt-fixture", "accepted"}, nil
		})
}
func call(t *testing.T, h *Handler, r *http.Request, w *writer, intended int) {
	t.Helper()
	h.ServeHTTP(w, r)
	if w.Code != intended {
		t.Fatalf("status %d want %d, response %s", w.Code, intended, w.Body.String())
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("response may be cached")
	}
	for _, secret := range []string{"private_note", "fixture-key", "delivery-001", "10000000-", "secret upstream error"} {
		if strings.Contains(w.Body.String(), secret) {
			t.Fatal("response leaked input")
		}
	}
	if intended == 204 && w.Body.Len() != 0 {
		t.Fatal("success must have no body")
	}
}

func TestOrderedAcceptance(t *testing.T) {
	k, g, i := ports()
	c := config()
	reports := make(chan Report, 1)
	c.Reports = reports
	var order []string
	h := mustHandler(t, keyFunc(func(ctx context.Context, s Scope) ([]signing.KeyVersion, error) {
		order = append(order, "keys")
		if s != c.Scope {
			t.Fatal("scope changed")
		}
		return k.Resolve(ctx, s)
	}), gateFunc(func(ctx context.Context, s Scope, e receiving.Event) error {
		order = append(order, "gate")
		return g.Check(ctx, s, e)
	}), inboxFunc(func(ctx context.Context, id Identity, e receiving.Event) (Receipt, error) {
		order = append(order, "inbox")
		if !bytes.Equal(payload(), e.RawBody()) || id.BodySHA256 != e.Proof().BodySHA256 {
			t.Fatal("not exact verified bytes")
		}
		return i.Accept(ctx, id, e)
	}), c)
	w := newWriter()
	call(t, h, request(t, payload()), w, 204)
	if strings.Join(order, ",") != "keys,gate,inbox" {
		t.Fatal(order)
	}
	if w.readDeadline.IsZero() || !w.readDeadline.Equal(w.writeDeadline) {
		t.Fatal("one original deadline required")
	}
	r := <-reports
	if r.RequestID != "req-fixture" || !r.DurableAccepted || r.StageCount != 7 || r.Stages[6].Result != "accepted" {
		t.Fatal(r)
	}
	b, _ := json.Marshal(r)
	if bytes.Contains(b, []byte("private_note")) || bytes.Contains(b, []byte("delivery-001")) {
		t.Fatal("unsafe report")
	}
}
func TestRequestRejections(t *testing.T) {
	cases := []struct {
		name   string
		edit   func(*http.Request)
		status int
	}{
		{"get", func(r *http.Request) { r.Method = "GET" }, 405},
		{"head", func(r *http.Request) { r.Method = "HEAD" }, 405},
		{"missing_type", func(r *http.Request) { r.Header.Del("Content-Type") }, 415},
		{"wrong_type", func(r *http.Request) { r.Header.Set("Content-Type", "text/plain") }, 415},
		{"wrong_charset", func(r *http.Request) { r.Header.Set("Content-Type", "application/json; charset=latin1") }, 415},
		{"unknown_parameter", func(r *http.Request) { r.Header.Set("Content-Type", "application/json; foo=bar") }, 415},
		{"duplicate_type", func(r *http.Request) { r.Header.Add("Content-Type", "application/json") }, 415},
		{"case_duplicate_type", func(r *http.Request) { r.Header["content-type"] = []string{"application/json"} }, 415},
		{"gzip", func(r *http.Request) { r.Header.Set("Content-Encoding", "gzip") }, 415},
		{"duplicate_encoding", func(r *http.Request) { r.Header["Content-Encoding"] = []string{"identity", "identity"} }, 415},
		{"trailers", func(r *http.Request) { r.Trailer = http.Header{"X-Proof": nil} }, 415},
		{"announced_trailer", func(r *http.Request) { r.Header.Set("Trailer", "X-Proof") }, 415},
		{"length_bound", func(r *http.Request) { r.ContentLength = 2000 }, 413},
		{"header_bound", func(r *http.Request) { r.Header.Set("X-Unrelated", strings.Repeat("x", 9000)) }, 431},
		{"duplicate_proof", func(r *http.Request) { r.Header.Add(signing.SignatureHeader, r.Header.Get(signing.SignatureHeader)) }, 401},
		{"missing_proof", func(r *http.Request) { r.Header.Del(signing.SignatureHeader) }, 401},
		{"event_header_tamper", func(r *http.Request) { r.Header.Set(signing.EventHeader, "evt-other") }, 422},
		{"bad_signature", func(r *http.Request) { r.Header.Set(signing.SignatureHeader, "v1="+strings.Repeat("0", 64)) }, 401},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			k, g, _ := ports()
			entered := false
			inbox := inboxFunc(func(context.Context, Identity, receiving.Event) (Receipt, error) {
				entered = true
				return Receipt{}, nil
			})
			h := mustHandler(t, k, g, inbox, config())
			r := request(t, payload())
			tc.edit(r)
			call(t, h, r, newWriter(), tc.status)
			if entered {
				t.Fatal("invalid request reached store")
			}
		})
	}
}
func TestBodyAndDomainRejections(t *testing.T) {
	cases := []struct {
		name   string
		body   []byte
		status int
	}{
		{"malformed", []byte(`{`), 422},
		{"duplicated_identity", []byte(`{"event_id":"evt-001","event_id":"evt-001"}`), 422},
		{"unsupported_schema", []byte(`{"event_id":"evt-001","event_type":"unsupported"}`), 422},
		{"other_tenant", []byte(`{"event_id":"evt-001","event_type":"test.fixture","tenant_id":"other"}`), 403},
		{"empty", nil, 422},
		{"actual_size_bound", []byte(strings.Repeat(" ", 1025)), 413},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			k, g, _ := ports()
			writes := 0
			i := inboxFunc(func(context.Context, Identity, receiving.Event) (Receipt, error) { writes++; return Receipt{}, nil })
			h := mustHandler(t, k, g, i, config())
			r := request(t, tc.body)
			r.ContentLength = -1
			call(t, h, r, newWriter(), tc.status)
			if writes != 0 {
				t.Fatal("rejected input reached inbox")
			}
		})
	}
}
func TestPortFailures(t *testing.T) {
	cases := []struct {
		name, port string
		failure    error
		panic      bool
		status     int
	}{
		{"keys_unavailable", "keys", errors.New("secret upstream error"), false, 503},
		{"keys_denied", "keys", ErrDenied, false, 403},
		{"keys_panic", "keys", nil, true, 503},
		{"gate_denied", "gate", ErrDenied, false, 403},
		{"gate_rejected", "gate", ErrRejected, false, 422},
		{"gate_unavailable", "gate", errors.New("secret upstream error"), false, 503},
		{"gate_panic", "gate", nil, true, 503},
		{"commit_unknown", "inbox", errors.New("secret upstream error"), false, 503},
		{"commit_conflict", "inbox", ErrConflict, false, 409},
		{"commit_panic", "inbox", nil, true, 503},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			k, g, i := ports()
			fault := func() error {
				if tc.panic {
					panic("secret upstream error")
				}
				return tc.failure
			}
			switch tc.port {
			case "keys":
				k = keyFunc(func(context.Context, Scope) ([]signing.KeyVersion, error) { return nil, fault() })
			case "gate":
				g = gateFunc(func(context.Context, Scope, receiving.Event) error { return fault() })
			case "inbox":
				i = inboxFunc(func(context.Context, Identity, receiving.Event) (Receipt, error) { return Receipt{}, fault() })
			}
			h := mustHandler(t, k, g, i, config())
			call(t, h, request(t, payload()), newWriter(), tc.status)
			if h.active != 0 {
				t.Fatal("admission leaked")
			}
		})
	}
}
func TestExactReceipt(t *testing.T) {
	cases := []struct {
		name string
		edit func(*Receipt)
	}{
		{"tenant", func(r *Receipt) { r.Identity.Scope.TenantID = "other" }},
		{"workspace", func(r *Receipt) { r.Identity.Scope.WorkspaceID = "other" }},
		{"environment", func(r *Receipt) { r.Identity.Scope.EnvironmentID = "other" }},
		{"endpoint", func(r *Receipt) { r.Identity.Scope.EndpointID = "other" }},
		{"event", func(r *Receipt) { r.Identity.EventID = "other" }},
		{"delivery", func(r *Receipt) { r.Identity.DeliveryID = "other" }},
		{"digest", func(r *Receipt) { r.Identity.BodySHA256 = "other" }},
		{"receipt_reference", func(r *Receipt) { r.Ref = "" }},
		{"raw_reference", func(r *Receipt) { r.Ref = "https://bad.example/secret" }},
		{"pending", func(r *Receipt) { r.State = "pending" }},
		{"empty", func(r *Receipt) { *r = Receipt{} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			k, g, _ := ports()
			i := inboxFunc(func(_ context.Context, id Identity, _ receiving.Event) (Receipt, error) {
				r := Receipt{id, "receipt-fixture", "accepted"}
				tc.edit(&r)
				return r, nil
			})
			h := mustHandler(t, k, g, i, config())
			call(t, h, request(t, payload()), newWriter(), 503)
		})
	}
}
func TestContextAndDiagnostics(t *testing.T) {
	t.Run("earlier_deadline", func(t *testing.T) {
		k, g, i := ports()
		h := mustHandler(t, k, g, i, config())
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()
		r := request(t, payload()).WithContext(ctx)
		w := newWriter()
		call(t, h, r, w, 204)
		want, _ := ctx.Deadline()
		if !w.readDeadline.Equal(want) {
			t.Fatal("deadline extended")
		}
	})
	t.Run("cancelled_before_entry", func(t *testing.T) {
		k, g, i := ports()
		h := mustHandler(t, k, g, i, config())
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		call(t, h, request(t, payload()).WithContext(ctx), newWriter(), 503)
	})
	t.Run("cancelled_during_gate", func(t *testing.T) {
		k, _, i := ports()
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		g := gateFunc(func(context.Context, Scope, receiving.Event) error { cancel(); return nil })
		h := mustHandler(t, k, g, i, config())
		call(t, h, request(t, payload()).WithContext(ctx), newWriter(), 503)
	})
	t.Run("known_ack_after_cancel", func(t *testing.T) {
		k, g, _ := ports()
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		i := inboxFunc(func(_ context.Context, id Identity, _ receiving.Event) (Receipt, error) {
			cancel()
			return Receipt{id, "receipt-fixture", "accepted"}, nil
		})
		h := mustHandler(t, k, g, i, config())
		call(t, h, request(t, payload()).WithContext(ctx), newWriter(), 204)
	})
	t.Run("full_diagnostic_channel", func(t *testing.T) {
		k, g, i := ports()
		c := config()
		c.Reports = make(chan Report)
		h := mustHandler(t, k, g, i, c)
		call(t, h, request(t, payload()), newWriter(), 204)
		if h.DroppedReports() != 1 {
			t.Fatal("missing dropped count")
		}
	})
	t.Run("closed_diagnostic_channel", func(t *testing.T) {
		k, g, i := ports()
		c := config()
		ch := make(chan Report)
		close(ch)
		c.Reports = ch
		h := mustHandler(t, k, g, i, c)
		call(t, h, request(t, payload()), newWriter(), 204)
		if h.DroppedReports() != 1 {
			t.Fatal("closed channel changed result")
		}
	})
	t.Run("unsupported_writer", func(t *testing.T) {
		k, g, i := ports()
		h := mustHandler(t, k, g, i, config())
		w := httptest.NewRecorder()
		h.ServeHTTP(w, request(t, payload()))
		if w.Code != 503 {
			t.Fatal(w.Code)
		}
	})
	t.Run("deadline_method_failure", func(t *testing.T) {
		k, g, i := ports()
		h := mustHandler(t, k, g, i, config())
		w := newWriter()
		w.deadlineErr = http.ErrNotSupported
		call(t, h, request(t, payload()), w, 503)
	})
	t.Run("nil_handler", func(t *testing.T) { var h *Handler; call(t, h, request(t, payload()), newWriter(), 503) })
}

// Synthetic inbox uses a single critical section to MODEL receipt+local work.
// It is test-only and proves orchestration, not disk/database durability or IAM.
type fakeInbox struct {
	mu       sync.Mutex
	receipts map[string]Receipt
	effects  int
	loseOnce bool
}

func (f *fakeInbox) Accept(_ context.Context, id Identity, _ receiving.Event) (Receipt, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	key := id.Scope.TenantID + "|" + id.Scope.WorkspaceID + "|" + id.Scope.EnvironmentID + "|" + id.Scope.EndpointID + "|" + id.DeliveryID
	if prior, ok := f.receipts[key]; ok {
		if prior.Identity != id {
			return Receipt{}, ErrConflict
		}
		prior.State = "duplicate"
		return prior, nil
	}
	r := Receipt{id, "fixture-receipt", "accepted"}
	f.receipts[key] = r
	f.effects++
	if f.loseOnce {
		f.loseOnce = false
		return Receipt{}, errors.New("lost acknowledgement")
	}
	return r, nil
}
func TestDuplicateAndLostACK(t *testing.T) {
	for _, lost := range []bool{false, true} {
		name := "repeat"
		first := 204
		if lost {
			name = "lost_ack"
			first = 503
		}
		t.Run(name, func(t *testing.T) {
			k, g, _ := ports()
			f := &fakeInbox{receipts: map[string]Receipt{}, loseOnce: lost}
			h := mustHandler(t, k, g, f, config())
			call(t, h, request(t, payload()), newWriter(), first)
			call(t, h, request(t, payload()), newWriter(), 204)
			if f.effects != 1 {
				t.Fatal("duplicate effect")
			}
			other := bytes.Replace(payload(), []byte("private_note"), []byte("other_note"), 1)
			call(t, h, request(t, other), newWriter(), 409)
			if f.effects != 1 {
				t.Fatal("conflicting effect")
			}
		})
	}
}
func TestConfiguration(t *testing.T) {
	cases := []struct {
		name string
		edit func(*Config)
	}{
		{"missing_clock", func(c *Config) { c.Clock = nil }},
		{"invalid_scope", func(c *Config) { c.Scope.EnvironmentID = "production" }},
		{"zero_scope", func(c *Config) { c.Scope.EndpointID = "00000000-0000-0000-0000-000000000000" }},
		{"timeout_floor", func(c *Config) { c.Timeout = 0 }},
		{"timeout_ceiling", func(c *Config) { c.Timeout = 31 * time.Second }},
		{"concurrency", func(c *Config) { c.MaxConcurrent = 257 }},
		{"headers", func(c *Config) { c.MaxHeaderBytes = 65537 }},
		{"body", func(c *Config) { c.Signing.MaxBodyBytes = 1048577 }},
		{"age", func(c *Config) { c.Signing.MaxAgeSeconds = 0 }},
		{"skew", func(c *Config) { c.Signing.MaxFutureSkewSeconds = 301 }},
		{"depth", func(c *Config) { c.Parser.MaxDepth = 0 }},
		{"tokens", func(c *Config) { c.Parser.MaxTokens = 3 }},
		{"key_bytes", func(c *Config) { c.Parser.MaxKeyBytes = 4097 }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			k, g, i := ports()
			c := config()
			tc.edit(&c)
			if h, err := New(k, g, i, c); err != ErrConfig || h != nil {
				t.Fatal("invalid configuration accepted")
			}
		})
	}
	t.Run("nil_ports", func(t *testing.T) {
		k, g, i := ports()
		if _, err := New(nil, g, i, config()); err != ErrConfig {
			t.Fatal(err)
		}
		if _, err := New(k, nil, i, config()); err != ErrConfig {
			t.Fatal(err)
		}
		if _, err := New(k, g, nil, config()); err != ErrConfig {
			t.Fatal(err)
		}
	})
	t.Run("typed_nil", func(t *testing.T) {
		_, g, i := ports()
		var k keyFunc
		if _, err := New(k, g, i, config()); err != ErrConfig {
			t.Fatal(err)
		}
	})
}

type brokenBody struct{}

func (brokenBody) Read([]byte) (int, error) { return 0, io.ErrUnexpectedEOF }
func (brokenBody) Close() error             { return nil }
func TestIncompleteBody(t *testing.T) {
	k, g, i := ports()
	h := mustHandler(t, k, g, i, config())
	r := request(t, payload())
	r.Body = brokenBody{}
	call(t, h, r, newWriter(), 400)
}

func TestContextMetadataAndTimeouts(t *testing.T) {
	type traceKey struct{}
	t.Run("context_preserved", func(t *testing.T) {
		k, g, i := ports()
		c := config()
		c.RequestID = func(ctx context.Context) string { v, _ := ctx.Value(traceKey{}).(string); return v }
		reports := make(chan Report, 1)
		c.Reports = reports
		wrapped := inboxFunc(func(ctx context.Context, id Identity, e receiving.Event) (Receipt, error) {
			if ctx.Value(traceKey{}) != "trace-fixture" {
				t.Fatal("metadata lost")
			}
			return i.Accept(ctx, id, e)
		})
		h := mustHandler(t, k, g, wrapped, c)
		ctx := context.WithValue(context.Background(), traceKey{}, "trace-fixture")
		call(t, h, request(t, payload()).WithContext(ctx), newWriter(), 204)
		if (<-reports).RequestID != "trace-fixture" {
			t.Fatal("missing correlation")
		}
	})
	t.Run("missing_correlation", func(t *testing.T) {
		k, g, i := ports()
		c := config()
		c.RequestID = func(context.Context) string { return "" }
		h := mustHandler(t, k, g, i, c)
		call(t, h, request(t, payload()), newWriter(), 503)
	})
	for _, port := range []string{"keys", "gate", "inbox"} {
		t.Run("deadline_"+port, func(t *testing.T) {
			k, g, i := ports()
			c := config()
			c.Timeout = 100 * time.Millisecond
			switch port {
			case "keys":
				k = keyFunc(func(ctx context.Context, _ Scope) ([]signing.KeyVersion, error) { <-ctx.Done(); return nil, ctx.Err() })
			case "gate":
				g = gateFunc(func(ctx context.Context, _ Scope, _ receiving.Event) error { <-ctx.Done(); return ctx.Err() })
			case "inbox":
				i = inboxFunc(func(ctx context.Context, _ Identity, _ receiving.Event) (Receipt, error) {
					<-ctx.Done()
					return Receipt{}, ctx.Err()
				})
			}
			h := mustHandler(t, k, g, i, c)
			call(t, h, request(t, payload()), newWriter(), 503)
		})
	}
}
