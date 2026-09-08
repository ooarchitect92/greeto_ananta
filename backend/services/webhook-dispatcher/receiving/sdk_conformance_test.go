package receiving

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/ooarchitect92/greeto_ananta/backend/services/webhook-dispatcher/signing"
)

// Shared synthetic fixtures independently specify signatures and expected results.
// This test compares the unchanged Go receiver to the new Node/Python wrappers.
// No provider service, replay ledger, endpoint, key vault or network is contacted.
func TestSDKConformance(t *testing.T) {
	type limits struct {
		MaxDepth    int `json:"maxDepth"`
		MaxTokens   int `json:"maxTokens"`
		MaxKeyBytes int `json:"maxKeyBytes"`
	}
	type vector struct {
		Name         string   `json:"name"`
		Body         string   `json:"body_base64"`
		Expected     string   `json:"expected"`
		Signature    string   `json:"signature"`
		EventHeaders []string `json:"event_headers"`
		KeyHeader    string   `json:"key_header"`
		Lowercase    bool     `json:"lowercase_headers"`
		Now          *int64   `json:"now"`
		Limits       *limits  `json:"limits"`
	}
	var fixture struct {
		Defaults struct {
			Limits limits `json:"limits"`
		} `json:"defaults"`
		Cases []vector `json:"cases"`
	}
	b, err := os.ReadFile("../../../testdata/webhook-event-v1.json")
	if err != nil || json.Unmarshal(b, &fixture) != nil || len(fixture.Cases) == 0 {
		t.Fatal("shared fixture is unavailable or invalid")
	}
	type observation struct {
		Name    string `json:"name"`
		Code    string `json:"code"`
		EventID string `json:"event_id"`
		Hash    string `json:"body_sha256"`
	}
	results := make([]observation, 0, len(fixture.Cases))
	for _, c := range fixture.Cases {
		t.Run(c.Name, func(t *testing.T) {
			raw, err := base64.StdEncoding.DecodeString(c.Body)
			if err != nil {
				t.Fatal(err)
			}
			events := c.EventHeaders
			if events == nil {
				events = []string{"evt-001"}
			}
			kid := c.KeyHeader
			if kid == "" {
				kid = "test-key"
			}
			h := http.Header{}
			for _, id := range events {
				h.Add(signing.EventHeader, id)
			}
			h.Set(signing.DeliveryHeader, "delivery-001")
			h.Set(signing.TimestampHeader, "1000")
			h.Set(signing.KeyHeader, kid)
			h.Set(signing.SignatureHeader, c.Signature)
			if c.Lowercase {
				lower := http.Header{}
				for k, v := range h {
					lower[strings.ToLower(k)] = v
				}
				h = lower
			}
			l := fixture.Defaults.Limits
			if c.Limits != nil {
				l = *c.Limits
			}
			now := int64(1000)
			if c.Now != nil {
				now = *c.Now
			}
			k := signing.KeyVersion{ID: "test-key", Secret: bytes.Repeat([]byte{0x42}, 32), NotBefore: 1, SignUntil: 9000, VerifyUntil: 9100}
			p := signing.Policy{MaxAgeSeconds: 300, MaxFutureSkewSeconds: 10, MaxBodyBytes: 4096}
			e, err := VerifyEvent(raw, h, []signing.KeyVersion{k}, now, p, Limits{l.MaxDepth, l.MaxTokens, l.MaxKeyBytes})
			result := observation{Name: c.Name, Code: "ok"}
			if err != nil {
				result.Code = err.Error()
			} else {
				result.EventID = e.EventID()
				result.Hash = e.Proof().BodySHA256
				sum := sha256.Sum256(raw)
				if !e.Valid() || result.EventID != "evt-001" || result.Hash != hex.EncodeToString(sum[:]) || !bytes.Equal(e.RawBody(), raw) {
					t.Fatal("verified metadata/raw bytes disagree")
				}
			}
			if result.Code != c.Expected {
				t.Fatalf("got %s, want %s", result.Code, c.Expected)
			}
			results = append(results, result)
		})
	}
	if path := os.Getenv("GREETO_CONFORMANCE_REPORT"); path != "" {
		out, err := json.MarshalIndent(results, "", "  ")
		if err != nil || os.WriteFile(path, append(out, '\n'), 0600) != nil {
			t.Fatal("cannot write conformance report")
		}
	}
}
