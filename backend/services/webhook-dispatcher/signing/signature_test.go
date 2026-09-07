package signing

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"
)

// Fixed public fixture key; NEVER a production credential.
func setup(t *testing.T) ([]byte, KeyVersion, Policy, int64, http.Header) {
	t.Helper()
	now := int64(1788825600)
	key := KeyVersion{ID: "current", Secret: []byte(strings.Repeat("a", 32)), NotBefore: now - 1000, SignUntil: now + 1000, VerifyUntil: now + 2000}
	p := Policy{MaxAgeSeconds: 300, MaxFutureSkewSeconds: 30, MaxBodyBytes: 4096}
	body := []byte(`{"event_id":"evt_fixture"}`)
	h, err := Sign(body, "evt_fixture", "dlv_fixture", key, now, p)
	if err != nil {
		t.Fatal(err)
	}
	return body, key, p, now, h
}

func TestIndependentVectors(t *testing.T) {
	raw, err := os.ReadFile("../../../contracts/fixtures/webhook-signature-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var data struct {
		Vectors []struct {
			Name      string `json:"name"`
			Body      string `json:"body_hex"`
			Key       string `json:"key_hex"`
			KeyID     string `json:"key_id"`
			Event     string `json:"event_id"`
			Delivery  string `json:"delivery_id"`
			At        int64  `json:"at"`
			Signature string `json:"signature"`
			Digest    string `json:"body_sha256"`
		} `json:"vectors"`
	}
	if err = json.Unmarshal(raw, &data); err != nil {
		t.Fatal(err)
	}
	if len(data.Vectors) != 6 {
		t.Fatal("fixture count")
	}
	for _, v := range data.Vectors {
		t.Run(v.Name, func(t *testing.T) {
			body, e := hex.DecodeString(v.Body)
			if e != nil {
				t.Fatal(e)
			}
			secret, e := hex.DecodeString(v.Key)
			if e != nil {
				t.Fatal(e)
			}
			key := KeyVersion{ID: v.KeyID, Secret: secret, NotBefore: v.At - 1000, SignUntil: v.At + 1000, VerifyUntil: v.At + 2000}
			p := Policy{300, 30, 4096}
			headers, e := Sign(body, v.Event, v.Delivery, key, v.At, p)
			if e != nil {
				t.Fatal(e)
			}
			if headers.Get(SignatureHeader) != v.Signature {
				t.Fatal("independent HMAC mismatch")
			}
			proof, e := Verify(body, headers, []KeyVersion{key}, v.At, p)
			if e != nil {
				t.Fatal(e)
			}
			if proof.BodySHA256 != v.Digest || proof.DeliveryID != v.Delivery || proof.AttemptedAt != v.At {
				t.Fatal("proof mismatch")
			}
		})
	}
}

func TestInvalidHeaders(t *testing.T) {
	for _, name := range []string{EventHeader, DeliveryHeader, TimestampHeader, KeyHeader, SignatureHeader} {
		t.Run("missing/"+name, func(t *testing.T) {
			b, k, p, n, h := setup(t)
			h.Del(name)
			_, e := Verify(b, h, []KeyVersion{k}, n, p)
			if !errors.Is(e, ErrProof) {
				t.Fatal(e)
			}
		})
		t.Run("duplicate/"+name, func(t *testing.T) {
			b, k, p, n, h := setup(t)
			h[strings.ToLower(name)] = []string{h.Get(name)}
			_, e := Verify(b, h, []KeyVersion{k}, n, p)
			if !errors.Is(e, ErrProof) {
				t.Fatal(e)
			}
		})
	}
	for _, tc := range []struct{ name, header, value string }{
		{"comma", SignatureHeader, "v1=" + strings.Repeat("a", 64) + ",v1=" + strings.Repeat("b", 64)},
		{"short", SignatureHeader, "v1=aa"}, {"other_version", SignatureHeader, "v2=" + strings.Repeat("a", 64)},
		{"uppercase", SignatureHeader, "v1=" + strings.Repeat("A", 64)},
		{"hex_newline", SignatureHeader, "v1=" + strings.Repeat("a", 64) + "\n"},
		{"delivery_newline", DeliveryHeader, "dlv_fixture\n"}, {"delimiter", DeliveryHeader, "dlv.fixture"},
		{"delivery_change", DeliveryHeader, "dlv_changed"}, {"unknown_key", KeyHeader, "unknown"},
		{"time_zero_prefix", TimestampHeader, "01788825600"}, {"time_negative", TimestampHeader, "-1"},
		{"time_float", TimestampHeader, "1788825600.0"}, {"time_exponent", TimestampHeader, "1e9"},
		{"time_space", TimestampHeader, " 1788825600"}, {"time_newline", TimestampHeader, "1788825600\n"},
		{"time_overflow", TimestampHeader, "99999999999"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, k, p, n, h := setup(t)
			h.Set(tc.header, tc.value)
			_, e := Verify(b, h, []KeyVersion{k}, n, p)
			if !errors.Is(e, ErrProof) {
				t.Fatal(e)
			}
		})
	}
}

func TestBodyAndMetadata(t *testing.T) {
	t.Run("body_mutation", func(t *testing.T) {
		b, k, p, n, h := setup(t)
		b[0] = '['
		_, e := Verify(b, h, []KeyVersion{k}, n, p)
		if !errors.Is(e, ErrProof) {
			t.Fatal(e)
		}
	})
	t.Run("reserialized_json", func(t *testing.T) {
		_, k, p, n, h := setup(t)
		_, e := Verify([]byte(`{ "event_id": "evt_fixture" }`), h, []KeyVersion{k}, n, p)
		if !errors.Is(e, ErrProof) {
			t.Fatal(e)
		}
	})
	t.Run("body_limit", func(t *testing.T) {
		b, k, p, n, h := setup(t)
		p.MaxBodyBytes = len(b) - 1
		_, e := Verify(b, h, []KeyVersion{k}, n, p)
		if !errors.Is(e, ErrProof) {
			t.Fatal(e)
		}
		_, e = Sign(b, "evt_fixture", "dlv_fixture", k, n, p)
		if !errors.Is(e, ErrProof) {
			t.Fatal(e)
		}
	})
	t.Run("lowercase_names", func(t *testing.T) {
		b, k, p, n, h := setup(t)
		lower := make(http.Header)
		for name, v := range h {
			lower[strings.ToLower(name)] = v
		}
		if _, e := Verify(b, lower, []KeyVersion{k}, n, p); e != nil {
			t.Fatal(e)
		}
	})
	t.Run("unsigned_event_header_is_not_authority", func(t *testing.T) {
		b, k, p, n, h := setup(t)
		h.Set(EventHeader, "evt_untrusted")
		proof, e := Verify(b, h, []KeyVersion{k}, n, p)
		if e != nil {
			t.Fatal(e)
		}
		raw, _ := json.Marshal(proof)
		if strings.Contains(string(raw), "event_id") {
			t.Fatal("unsigned event header trusted")
		}
	})
	t.Run("retry_stable_identity_not_replay_prevention", func(t *testing.T) {
		b, k, p, n, h := setup(t)
		other, e := Sign(b, "evt_fixture", "dlv_fixture", k, n+1, p)
		if e != nil {
			t.Fatal(e)
		}
		a, _ := Verify(b, h, []KeyVersion{k}, n+1, p)
		z, _ := Verify(b, other, []KeyVersion{k}, n+1, p)
		if a.DeliveryID != z.DeliveryID || a.BodySHA256 != z.BodySHA256 || h.Get(SignatureHeader) == other.Get(SignatureHeader) {
			t.Fatal("retry identity")
		}
	})
}

func TestClockAndRotation(t *testing.T) {
	for _, delta := range []int64{-31, -30, 300, 301} {
		t.Run("clock/"+strconv.FormatInt(delta, 10), func(t *testing.T) {
			b, k, p, n, h := setup(t)
			_, e := Verify(b, h, []KeyVersion{k}, n+delta, p)
			valid := delta >= -30 && delta <= 300
			if (e == nil) != valid {
				t.Fatal(e)
			}
		})
	}
	t.Run("rotation_overlap", func(t *testing.T) {
		b, k, p, n, h := setup(t)
		k.SignUntil = n + 1
		k.VerifyUntil = n + 10
		next := KeyVersion{ID: "next", Secret: []byte(strings.Repeat("b", 32)), NotBefore: n + 1, SignUntil: n + 1000, VerifyUntil: n + 2000}
		if _, e := Verify(b, h, []KeyVersion{next, k}, n+5, p); e != nil {
			t.Fatal(e)
		}
		if _, e := Sign(b, "evt_fixture", "dlv_fixture", k, n+5, p); !errors.Is(e, ErrProof) {
			t.Fatal(e)
		}
		fresh, e := Sign(b, "evt_fixture", "dlv_fixture", next, n+5, p)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = Verify(b, fresh, []KeyVersion{next, k}, n+5, p); e != nil {
			t.Fatal(e)
		}
		if _, e = Verify(b, h, []KeyVersion{next, k}, n+10, p); !errors.Is(e, ErrProof) {
			t.Fatal(e)
		}
	})
	for _, mode := range []string{"revoked", "not_yet_valid", "attempt_after_signing", "expired"} {
		t.Run(mode, func(t *testing.T) {
			b, k, p, n, h := setup(t)
			switch mode {
			case "revoked":
				k.Revoked = true
			case "not_yet_valid":
				k.NotBefore = n + 1
			case "attempt_after_signing":
				k.SignUntil = n
			case "expired":
				k.SignUntil = n - 1
				k.VerifyUntil = n
			}
			_, e := Verify(b, h, []KeyVersion{k}, n, p)
			if !errors.Is(e, ErrProof) {
				t.Fatal(e)
			}
		})
	}
}

func TestConfigurationAndFraming(t *testing.T) {
	for _, mode := range []string{"no_keys", "many_keys", "same_id", "same_secret", "short_key", "bad_intervals", "bad_policy", "bad_now"} {
		t.Run(mode, func(t *testing.T) {
			b, k, p, n, h := setup(t)
			keys := []KeyVersion{k}
			switch mode {
			case "no_keys":
				keys = nil
			case "many_keys":
				keys = []KeyVersion{k, k, k}
			case "same_id":
				other := k
				other.Secret = []byte(strings.Repeat("b", 32))
				keys = append(keys, other)
			case "same_secret":
				other := k
				other.ID = "other"
				keys = append(keys, other)
			case "short_key":
				keys[0].Secret = []byte("short")
			case "bad_intervals":
				keys[0].VerifyUntil = k.SignUntil - 1
			case "bad_policy":
				p.MaxAgeSeconds = 0
			case "bad_now":
				n = -1
			}
			_, e := Verify(b, h, keys, n, p)
			if !errors.Is(e, ErrConfig) {
				t.Fatal(e)
			}
		})
	}
	for _, id := range []string{"", "d.bad", "d\n", strings.Repeat("d", 129), "नमस्ते"} {
		t.Run("invalid_sign_id/"+strconv.Itoa(len(id)), func(t *testing.T) {
			b, k, p, n, _ := setup(t)
			if _, e := Sign(b, "evt_fixture", id, k, n, p); !errors.Is(e, ErrProof) {
				t.Fatal(e)
			}
		})
	}
}
