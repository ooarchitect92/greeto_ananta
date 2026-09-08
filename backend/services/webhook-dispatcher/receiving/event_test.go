package receiving

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/signing"
)

// All keys are synthetic fixed test material; no vault or remote service is used.
func fixture() (signing.KeyVersion, signing.Policy, Limits) {
	return signing.KeyVersion{ID: "test-key", Secret: bytes.Repeat([]byte{0x42}, 32), NotBefore: 1, SignUntil: 9000, VerifyUntil: 9100},
		signing.Policy{MaxAgeSeconds: 300, MaxFutureSkewSeconds: 10, MaxBodyBytes: 4096}, Limits{MaxDepth: 8, MaxTokens: 128, MaxKeyBytes: 64}
}
func signed(t *testing.T, body []byte) (http.Header, signing.KeyVersion, signing.Policy, Limits) {
	t.Helper()
	key, p, limits := fixture()
	h, err := signing.Sign(body, "evt-001", "delivery-001", key, 1000, p)
	if err != nil {
		t.Fatal(err)
	}
	return h, key, p, limits
}
func TestEventSnapshot(t *testing.T) {
	body := []byte(" {\n\"event_id\":\"evt-001\",\"data\":{\"large\":9007199254740993}} \n")
	original := bytes.Clone(body)
	h, key, p, limits := signed(t, body)
	event, err := VerifyEvent(body, h, []signing.KeyVersion{key}, 1000, p, limits)
	if err != nil || !event.Valid() || event.EventID() != "evt-001" || !bytes.Equal(event.RawBody(), original) {
		t.Fatalf("unexpected verification result: %v", err)
	}
	digest := sha256.Sum256(original)
	if event.Proof().BodySHA256 != hex.EncodeToString(digest[:]) || event.Proof().DeliveryID != "delivery-001" {
		t.Fatal("proof is not bound to original bytes")
	}
	body[0] = 'X'
	copyBody := event.RawBody()
	copyBody[0] = 'Y'
	h.Set(signing.EventHeader, "evt-other")
	if !bytes.Equal(event.RawBody(), original) || event.EventID() != "evt-001" {
		t.Fatal("caller mutation changed the verified snapshot")
	}
}
func TestHeaderAloneIsNotAuthenticatedEventIdentity(t *testing.T) {
	body := []byte(`{"event_id":"evt-001"}`)
	h, key, p, limits := signed(t, body)
	h.Set(signing.EventHeader, "evt-other")
	if _, err := signing.Verify(body, h, []signing.KeyVersion{key}, 1000, p); err != nil {
		t.Fatal("the unchanged v1 MAC does not include this header")
	}
	if event, err := VerifyEvent(body, h, []signing.KeyVersion{key}, 1000, p, limits); !errors.Is(err, ErrEnvelope) || event.Valid() {
		t.Fatal("mismatched event header must not become a verified event")
	}
}
func TestEnvelopeCases(t *testing.T) {
	cases := []struct {
		name, body string
		valid      bool
	}{
		{"minimal", `{"event_id":"evt-001"}`, true},
		{"escaped_member", `{"event\u005fid":"evt-001"}`, true},
		{"escaped_identifier", `{"event_id":"evt-00\u0031"}`, true},
		{"unicode", `{"event_id":"evt-001","text":"हैलो世界😊"}`, true},
		{"surrogate_pair", `{"event_id":"evt-001","text":"\ud83d\ude00"}`, true},
		{"escaped_backslash", `{"event_id":"evt-001","text":"\\ud800"}`, true},
		{"unrelated_large_number", `{"event_id":"evt-001","n":1e999999}`, true},
		{"nested_id_not_top", `{"event_id":"evt-001","data":{"event_id":"other"}}`, true},
		{"same_key_separate_objects", `{"event_id":"evt-001","data":[{"x":1},{"x":2}]}`, true},
		{"values", `{"event_id":"evt-001","values":[true,false,null,0,-2,3.14,[],{}]}`, true},
		{"duplicate_top", `{"event_id":"evt-001","event_id":"evt-001"}`, false},
		{"duplicate_escaped", `{"event_id":"evt-001","event\u005fid":"evt-001"}`, false},
		{"duplicate_nested", `{"event_id":"evt-001","data":{"a":1,"a":2}}`, false},
		{"duplicate_inside_array", `{"event_id":"evt-001","data":[{"a":1,"\u0061":2}]}`, false},
		{"wrong_case_only", `{"Event_ID":"evt-001"}`, false},
		{"case_alias_coexisting", `{"event_id":"evt-001","EVENT_ID":"other"}`, false},
		{"missing", `{"type":"message"}`, false},
		{"nested_only", `{"data":{"event_id":"evt-001"}}`, false},
		{"null_id", `{"event_id":null}`, false},
		{"numeric_id", `{"event_id":9007199254740993}`, false},
		{"object_id", `{"event_id":{}}`, false},
		{"array_id", `{"event_id":[]}`, false},
		{"empty_id", `{"event_id":""}`, false},
		{"dot_id", `{"event_id":"evt.001"}`, false},
		{"long_id", `{"event_id":"` + strings.Repeat("a", 129) + `"}`, false},
		{"root_array", `[{"event_id":"evt-001"}]`, false},
		{"root_null", `null`, false},
		{"second_object", `{"event_id":"evt-001"}{}`, false},
		{"trailing_boolean", `{"event_id":"evt-001"}true`, false},
		{"trailing_comma", `{"event_id":"evt-001",}`, false},
		{"nan", `{"event_id":"evt-001","n":NaN}`, false},
		{"comment", `{"event_id":"evt-001"/* comment */}`, false},
		{"truncated", `{"event_id":"evt-001"`, false},
		{"bad_escape", `{"event_id":"evt-001","v":"\x20"}`, false},
		{"short_unicode", `{"event_id":"evt-001","v":"\u0"}`, false},
		{"bad_hex", `{"event_id":"evt-001","v":"\uZZZZ"}`, false},
		{"high_surrogate", `{"event_id":"evt-001","v":"\ud800"}`, false},
		{"low_surrogate", `{"event_id":"evt-001","v":"\udfff"}`, false},
		{"invalid_pair", `{"event_id":"evt-001","v":"\ud800\u0041"}`, false},
		{"invalid_utf8", "{\"event_id\":\"evt-001\",\"v\":\"\xff\"}", false},
		{"bom", "\xef\xbb\xbf{\"event_id\":\"evt-001\"}", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := []byte(tc.body)
			h, key, p, limits := signed(t, body)
			event, err := VerifyEvent(body, h, []signing.KeyVersion{key}, 1000, p, limits)
			if (err == nil) != tc.valid || event.Valid() != tc.valid {
				t.Fatalf("valid=%v error=%v", event.Valid(), err)
			}
			if !tc.valid && err != ErrEnvelope {
				t.Fatalf("unexpected exposed error: %v", err)
			}
		})
	}
}
func TestAuthenticationPrecedesParsing(t *testing.T) {
	body := []byte(`not JSON`)
	h, key, p, limits := signed(t, body)
	h.Set(signing.SignatureHeader, "v1="+strings.Repeat("0", 64))
	if _, err := VerifyEvent(body, h, []signing.KeyVersion{key}, 1000, p, limits); err != signing.ErrProof {
		t.Fatal(err)
	}
}
func TestInputAndConfigurationFailures(t *testing.T) {
	cases := []struct {
		name  string
		alter func(http.Header, *signing.KeyVersion, *signing.Policy, *Limits)
		want  error
	}{
		{"duplicate_header", func(h http.Header, _ *signing.KeyVersion, _ *signing.Policy, _ *Limits) {
			h.Add(signing.EventHeader, "evt-001")
		}, signing.ErrProof},
		{"duplicate_case", func(h http.Header, _ *signing.KeyVersion, _ *signing.Policy, _ *Limits) {
			h["x-platform-event-id"] = []string{"evt-001"}
		}, signing.ErrProof},
		{"missing_header", func(h http.Header, _ *signing.KeyVersion, _ *signing.Policy, _ *Limits) { h.Del(signing.EventHeader) }, signing.ErrProof},
		{"long_header", func(h http.Header, _ *signing.KeyVersion, _ *signing.Policy, _ *Limits) {
			h.Set(signing.EventHeader, strings.Repeat("a", 257))
		}, signing.ErrProof},
		{"revoked", func(_ http.Header, k *signing.KeyVersion, _ *signing.Policy, _ *Limits) { k.Revoked = true }, signing.ErrProof},
		{"short_key", func(_ http.Header, k *signing.KeyVersion, _ *signing.Policy, _ *Limits) { k.Secret = []byte{1} }, signing.ErrConfig},
		{"body_limit", func(_ http.Header, _ *signing.KeyVersion, p *signing.Policy, _ *Limits) { p.MaxBodyBytes = 2 }, signing.ErrProof},
		{"invalid_body_policy", func(_ http.Header, _ *signing.KeyVersion, p *signing.Policy, _ *Limits) { p.MaxBodyBytes = 0 }, signing.ErrConfig},
		{"depth_zero", func(_ http.Header, _ *signing.KeyVersion, _ *signing.Policy, l *Limits) { l.MaxDepth = 0 }, ErrLimits},
		{"depth_ceiling", func(_ http.Header, _ *signing.KeyVersion, _ *signing.Policy, l *Limits) { l.MaxDepth = 65 }, ErrLimits},
		{"token_ceiling", func(_ http.Header, _ *signing.KeyVersion, _ *signing.Policy, l *Limits) { l.MaxTokens = 65537 }, ErrLimits},
		{"token_floor", func(_ http.Header, _ *signing.KeyVersion, _ *signing.Policy, l *Limits) { l.MaxTokens = 3 }, ErrLimits},
		{"key_limit_floor", func(_ http.Header, _ *signing.KeyVersion, _ *signing.Policy, l *Limits) { l.MaxKeyBytes = 7 }, ErrLimits},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := []byte(`{"event_id":"evt-001"}`)
			h, k, p, l := signed(t, body)
			tc.alter(h, &k, &p, &l)
			event, err := VerifyEvent(body, h, []signing.KeyVersion{k}, 1000, p, l)
			if err != tc.want || event.Valid() {
				t.Fatal(err)
			}
		})
	}
}
func TestParserBudgetEdges(t *testing.T) {
	key, p, _ := fixture()
	cases := []struct {
		name, body string
		limits     Limits
		ok         bool
	}{
		{"exact_minimum", `{"event_id":"evt-001"}`, Limits{1, 4, 8}, true},
		{"extra_token", `{"event_id":"evt-001","a":1}`, Limits{1, 4, 8}, false},
		{"exact_depth", `{"event_id":"evt-001","a":[[]]}`, Limits{3, 20, 8}, true},
		{"past_depth", `{"event_id":"evt-001","a":[[]]}`, Limits{2, 20, 8}, false},
		{"long_member", `{"event_id":"evt-001","123456789":0}`, Limits{1, 20, 8}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h, err := signing.Sign([]byte(tc.body), "evt-001", "delivery-001", key, 1000, p)
			if err != nil {
				t.Fatal(err)
			}
			_, err = VerifyEvent([]byte(tc.body), h, []signing.KeyVersion{key}, 1000, p, tc.limits)
			if (err == nil) != tc.ok {
				t.Fatal(err)
			}
		})
	}
}
func TestHeaderCaseAndRepeatedDelivery(t *testing.T) {
	body := []byte(`{"event_id":"evt-001"}`)
	h, k, p, l := signed(t, body)
	for key, value := range h {
		delete(h, key)
		h[strings.ToLower(key)] = value
	}
	for i := 0; i < 2; i++ {
		e, err := VerifyEvent(body, h, []signing.KeyVersion{k}, 1000, p, l)
		if err != nil || !e.Valid() {
			t.Fatal(err)
		}
	}
	// Repeated requests pass stateless proof checks. No test falsely certifies a ledger.
}
func TestClockAndRotation(t *testing.T) {
	body := []byte(`{"event_id":"evt-001"}`)
	h, k, p, l := signed(t, body)
	if _, err := VerifyEvent(body, h, []signing.KeyVersion{k}, 1301, p, l); err != signing.ErrProof {
		t.Fatal(err)
	}
	k.SignUntil = 1001
	k.VerifyUntil = 1200
	next := k
	next.ID = "new-test-key"
	next.Secret = bytes.Repeat([]byte{0x33}, 32)
	next.NotBefore = 1001
	next.SignUntil = 2000
	next.VerifyUntil = 2100
	if _, err := VerifyEvent(body, h, []signing.KeyVersion{next, k}, 1010, p, l); err != nil {
		t.Fatal(err)
	}
}
func TestZeroValueAndConcurrentReads(t *testing.T) {
	var zero Event
	if zero.Valid() || zero.EventID() != "" || zero.RawBody() != nil {
		t.Fatal("zero value became verified")
	}
	body := []byte(`{"event_id":"evt-001"}`)
	h, k, p, l := signed(t, body)
	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			e, err := VerifyEvent(body, h, []signing.KeyVersion{k}, 1000, p, l)
			if err != nil || !e.Valid() {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
}
func FuzzEventIdentity(f *testing.F) {
	for _, b := range []string{`{"event_id":"evt-001"}`, `{"event_id":"x","event_id":"y"}`, `[]`, `{"event_id":"evt-001","x":"\ud800"}`} {
		f.Add([]byte(b))
	}
	f.Fuzz(func(t *testing.T, body []byte) {
		if len(body) > 4096 {
			t.Skip()
		}
		h, k, p, l := signed(t, body)
		e, err := VerifyEvent(body, h, []signing.KeyVersion{k}, 1000, p, l)
		if err == nil && (!e.Valid() || e.EventID() != "evt-001" || !bytes.Equal(e.RawBody(), body)) {
			t.Fatal("unbound successful result")
		}
	})
}

func TestSafeFormatting(t *testing.T) {
	body := []byte(`{"event_id":"evt-001","data":"private_customer_note"}`)
	h, k, p, l := signed(t, body)
	event, err := VerifyEvent(body, h, []signing.KeyVersion{k}, 1000, p, l)
	if err != nil {
		t.Fatal(err)
	}
	for _, pattern := range []string{"%v", "%+v", "%#v"} {
		out := fmt.Sprintf(pattern, event)
		if strings.Contains(out, "private_customer_note") || strings.Contains(out, "evt-001") || !strings.Contains(out, "body omitted") {
			t.Fatal("unredacted formatting")
		}
	}
	var empty Event
	if !strings.Contains(fmt.Sprintf("%#v", empty), "unverified") {
		t.Fatal("zero value was labelled verified")
	}
}
