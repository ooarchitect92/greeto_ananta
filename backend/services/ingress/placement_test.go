package ingress

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/ooarchitect92/greeto_ananta/backend/internal/events"
	"github.com/ooarchitect92/greeto_ananta/backend/internal/observe"
	"github.com/ooarchitect92/greeto_ananta/backend/internal/placement"
)

// Checkpoint storage, parser and broker below are synthetic. Verification, binding
// and the unchanged F03 HTTP handler are real source implementations under test.
type placementTestStore struct {
	checkpoint placement.Checkpoint
	loads      int
}

func (s *placementTestStore) Load(context.Context, string) (placement.Checkpoint, error) {
	s.loads++
	c := s.checkpoint
	c.Entries = append([]placement.Entry(nil), c.Entries...)
	return c, nil
}
func (s *placementTestStore) CompareAndSwap(_ context.Context, _ string, v int64, h string, next placement.Checkpoint) (bool, error) {
	if v != s.checkpoint.Version || h != s.checkpoint.Digest {
		return false, nil
	}
	s.checkpoint = next
	s.checkpoint.Entries = append([]placement.Entry(nil), next.Entries...)
	return true, nil
}

type placementTestFlow struct {
	verifier   Verifier
	candidates []Candidate
	records    []Slice
	stages     []observe.Stage
	failAt     int
	parsed     int
	sawProof   bool
}

func (f *placementTestFlow) ForRoute(_ context.Context, route string) (Verifier, error) {
	if route != "callback-one" {
		return nil, errors.New("unknown_route")
	}
	f.sawProof = true
	return f.verifier, nil
}
func (f *placementTestFlow) Parse(context.Context, []byte) ([]Candidate, error) {
	f.parsed++
	return f.candidates, nil
}
func (f *placementTestFlow) Append(_ context.Context, s Slice) (events.Commit, error) {
	f.records = append(f.records, s)
	if len(f.records) == f.failAt {
		return events.Commit{}, errors.New("synthetic_quorum_failure")
	}
	return events.Commit{RecordID: s.Record.ID, Topic: s.Record.Topic, Partition: 0, Offset: int64(len(f.records))}, nil
}
func (f *placementTestFlow) Record(s observe.Stage) { f.stages = append(f.stages, s) }

type placementHarness struct {
	directory *placement.Directory
	binder    *PlacementBinder
	store     *placementTestStore
	snapshot  placement.Snapshot
	private   ed25519.PrivateKey
	now       time.Time
}

func newPlacementHarness(t *testing.T) *placementHarness {
	t.Helper()
	pub, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	h := &placementHarness{store: &placementTestStore{}, private: private, now: time.Date(2026, 9, 7, 9, 0, 0, 0, time.UTC)}
	h.directory, err = placement.New(placement.Options{DirectoryID: "directory-one", Issuer: "controller-one", Audience: "ingress-one", EnvironmentID: "sandbox", Keys: map[string]placement.Key{"public-one": {Public: pub, NotBefore: h.now.Add(-time.Hour), NotAfter: h.now.Add(time.Hour)}}, AllowedRegions: []string{"eu-test-1"}, MaxBytes: 32768, MaxEntries: 16, MaxLifetime: 5 * time.Minute, Checkpoints: h.store, Now: func() time.Time { return h.now }})
	if err != nil {
		t.Fatal(err)
	}
	h.snapshot = placement.Snapshot{SchemaVersion: 1, DirectoryID: "directory-one", Issuer: "controller-one", Audience: "ingress-one", EnvironmentID: "sandbox", KeyID: "public-one", Version: 1, IssuedAt: h.now.Add(-time.Minute), ExpiresAt: h.now.Add(time.Minute), Entries: []placement.Entry{
		{Provider: "test", AppRef: "app-one", AssetID: "asset-one", TenantID: "tenant-one", WorkspaceID: "workspace-one", EnvironmentID: "sandbox", Region: "eu-test-1", CellID: "cell-one", Epoch: 3, State: "active"},
		{Provider: "test", AppRef: "app-one", AssetID: "asset-two", TenantID: "tenant-two", WorkspaceID: "workspace-two", EnvironmentID: "sandbox", Region: "eu-test-1", CellID: "cell-two", Epoch: 9, State: "active"},
		{Provider: "test", AppRef: "app-other", AssetID: "asset-one", TenantID: "tenant-other", WorkspaceID: "workspace-other", EnvironmentID: "sandbox", Region: "eu-test-1", CellID: "cell-other", Epoch: 1, State: "active"},
	}}
	h.install(t)
	h.binder, err = NewPlacementBinder(h.directory, map[string]PlacementRoute{"callback-one": {Provider: "test", AppRef: "app-one", EnvironmentID: "sandbox", Lane: "sandbox"}}, 32768)
	if err != nil {
		t.Fatal(err)
	}
	return h
}
func (h *placementHarness) install(t *testing.T) {
	t.Helper()
	raw, err := json.Marshal(h.snapshot)
	if err != nil {
		t.Fatal(err)
	}
	sig := ed25519.Sign(h.private, append([]byte(placement.SignatureDomain), raw...))
	if err = h.directory.Install(context.Background(), h.snapshot.KeyID, raw, sig); err != nil {
		t.Fatal(err)
	}
}
func placementCandidate(asset, event string) Candidate {
	return Candidate{AssetID: asset, EventRef: event, Body: []byte(`{"tenant_id":"attacker","workspace_id":"attacker","fixture":true}`)}
}

func TestPlacementBinderCreatesAuthoritativeSlices(t *testing.T) {
	h := newPlacementHarness(t)
	candidate := placementCandidate("asset-one", "message-one:received")
	got, err := h.binder.Bind(context.Background(), "callback-one", candidate)
	if err != nil {
		t.Fatal(err)
	}
	var envelope boundEnvelope
	if err = json.Unmarshal(got.Record.Body, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.TenantID != "tenant-one" || envelope.WorkspaceID != "workspace-one" || got.CellID != "cell-one" || got.PlacementEpoch != 3 || got.Record.Topic != "sandbox.eu-test-1.cell-one.provider.received.v1" {
		t.Fatal("untrusted payload selected routing")
	}
	if envelope.SnapshotDigest == "" || envelope.SnapshotVersion != 1 || !opaque.MatchString(got.AuthorityRef) {
		t.Fatal("missing placement evidence")
	}
	other, err := h.binder.Bind(context.Background(), "callback-one", placementCandidate("asset-two", "message-two:received"))
	if err != nil || other.CellID != "cell-two" {
		t.Fatal("mixed tenant slice misrouted", err)
	}
	candidate.Body[0] = 'x'
	if !json.Valid(got.Record.Body) {
		t.Fatal("caller retained body alias")
	}
}
func TestPlacementBinderIdentitySurvivesRefresh(t *testing.T) {
	h := newPlacementHarness(t)
	candidate := placementCandidate("asset-one", "message-one:received")
	first, err := h.binder.Bind(context.Background(), "callback-one", candidate)
	if err != nil {
		t.Fatal(err)
	}
	h.snapshot.Version = 2
	h.install(t)
	second, err := h.binder.Bind(context.Background(), "callback-one", candidate)
	if err != nil {
		t.Fatal(err)
	}
	if first.Record.ID != second.Record.ID || first.Record.Key != second.Record.Key || first.AuthorityRef == second.AuthorityRef {
		t.Fatal("refresh changed event identity or lost version evidence")
	}
	third, _ := h.binder.Bind(context.Background(), "callback-one", placementCandidate("asset-one", "message-one:delivered"))
	if first.Record.ID == third.Record.ID {
		t.Fatal("different facts collapsed")
	}
	if digestIdentity("a:b", "c") == digestIdentity("a", "b:c") {
		t.Fatal("delimiter collision")
	}
}
func TestPlacementBinderRejectsInvalidInputsAndConfiguration(t *testing.T) {
	h := newPlacementHarness(t)
	for _, name := range []string{"unknown_route", "unknown_asset", "empty_event", "invalid_json", "invalid_utf8", "oversized", "expired"} {
		t.Run(name, func(t *testing.T) {
			candidate := placementCandidate("asset-one", "fact-one")
			route := "callback-one"
			switch name {
			case "unknown_route":
				route = "payload-app"
			case "unknown_asset":
				candidate.AssetID = "unknown"
			case "empty_event":
				candidate.EventRef = ""
			case "invalid_json":
				candidate.Body = []byte("{")
			case "invalid_utf8":
				candidate.Body = []byte("{\"x\":\"\xff\"}")
			case "oversized":
				candidate.Body = make([]byte, 32769)
			case "expired":
				h.now = h.snapshot.ExpiresAt
			}
			if _, err := h.binder.Bind(context.Background(), route, candidate); err == nil {
				t.Fatal("invalid candidate accepted")
			}
		})
	}
	if _, err := NewPlacementBinder(nil, map[string]PlacementRoute{"x": {}}, 1); err == nil {
		t.Fatal("nil directory accepted")
	}
	if _, err := NewPlacementBinder(h.directory, nil, 1); err == nil {
		t.Fatal("empty routes accepted")
	}
	if _, err := NewPlacementBinder(h.directory, map[string]PlacementRoute{"x": {Provider: "test", AppRef: "app-one", EnvironmentID: "sandbox", Lane: "prod.bad"}}, 1); err == nil {
		t.Fatal("topic injection accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := h.binder.Bind(ctx, "callback-one", placementCandidate("asset-one", "fact-one")); !errors.Is(err, context.Canceled) {
		t.Fatal("cancellation ignored")
	}
}
func TestPlacementBinderEnvironmentAndRouteCopies(t *testing.T) {
	h := newPlacementHarness(t)
	routes := map[string]PlacementRoute{"callback-one": {Provider: "test", AppRef: "app-one", EnvironmentID: "sandbox", Lane: "sandbox"}}
	b, err := NewPlacementBinder(h.directory, routes, 32768)
	if err != nil {
		t.Fatal(err)
	}
	routes["callback-one"] = PlacementRoute{Provider: "other"}
	if _, err = b.Bind(context.Background(), "callback-one", placementCandidate("asset-one", "fact-one")); err != nil {
		t.Fatal("mutable route alias", err)
	}
	mismatch, _ := NewPlacementBinder(h.directory, map[string]PlacementRoute{"callback-one": {Provider: "test", AppRef: "app-one", EnvironmentID: "production", Lane: "prod"}}, 32768)
	if _, err = mismatch.Bind(context.Background(), "callback-one", placementCandidate("asset-one", "fact-one")); err == nil {
		t.Fatal("environment crossed")
	}
}
func TestF03WithSignedPlacementPreservesDurableAckOrder(t *testing.T) {
	for _, name := range []string{"success", "bad_raw_proof", "unknown_asset", "expired_placement", "partial_quorum"} {
		t.Run(name, func(t *testing.T) {
			h := newPlacementHarness(t)
			secret := []byte("synthetic-proof-secret-for-test")
			verifier, err := NewHMACVerifier(secret)
			if err != nil {
				t.Fatal(err)
			}
			flow := &placementTestFlow{verifier: verifier, candidates: []Candidate{placementCandidate("asset-one", "fact-one"), placementCandidate("asset-two", "fact-two")}}
			want, appends := 200, 2
			switch name {
			case "bad_raw_proof":
				want, appends = 401, 0
			case "unknown_asset":
				flow.candidates[1].AssetID = "unknown"
				want, appends = 503, 0
			case "expired_placement":
				h.now = h.snapshot.ExpiresAt
				want, appends = 503, 0
			case "partial_quorum":
				flow.failAt = 2
				want = 503
			}
			handler, err := New(Options{Route: "callback-one", MaxBodyBytes: 2048, MaxSlices: 8, MaxConcurrent: 2, Timeout: time.Second, Proofs: flow, Parser: flow, Binder: h.binder, Journal: flow, Observer: flow})
			if err != nil {
				t.Fatal(err)
			}
			raw := []byte(`{"synthetic_batch":true}`)
			mac := hmac.New(sha256.New, secret)
			mac.Write(raw)
			req := httptest.NewRequest(http.MethodPost, "/callbacks/test/callback-one", bytes.NewReader(raw))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Hub-Signature-256", "sha256="+hex.EncodeToString(mac.Sum(nil)))
			if name == "bad_raw_proof" {
				req.Header.Set("X-Hub-Signature-256", "invalid")
			}
			priorLoads := h.store.loads
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			if response.Code != want || len(flow.records) != appends {
				t.Fatalf("code=%d records=%d", response.Code, len(flow.records))
			}
			if h.store.loads != priorLoads {
				t.Fatal("F03 did checkpoint I/O")
			}
			if name == "bad_raw_proof" && flow.parsed != 0 {
				t.Fatal("parse before authentication")
			}
			if name == "success" {
				stages := []string{}
				for _, s := range flow.stages {
					stages = append(stages, s.Name)
				}
				if !reflect.DeepEqual(stages, []string{"edge_bounds", "expected_credential", "raw_proof", "bounded_parse", "authorized_placement", "durable_append", "durable_append", "ack_boundary"}) {
					t.Fatal("F03 pipeline reordered", stages)
				}
				if flow.stages[len(flow.stages)-1].Reason != "durable_acceptance_only" {
					t.Fatal("ACK misrepresented")
				}
			}
		})
	}
}
