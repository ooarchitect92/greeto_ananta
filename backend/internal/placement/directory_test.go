package placement

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

// All stores/keys/identities below are synthetic test fixtures. This store is NOT
// linked into production, and passing these tests is not database durability proof.
type testStore struct {
	mu                                             sync.Mutex
	value                                          Checkpoint
	loadError, writeError, loseResponse, rejectCAS bool
	beforeLoad, beforeWrite                        func()
	loads, writes                                  int
}

func (s *testStore) Load(ctx context.Context, _ string) (Checkpoint, error) {
	if s.beforeLoad != nil {
		s.beforeLoad()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.loads++
	if ctx.Err() != nil {
		return Checkpoint{}, ctx.Err()
	}
	if s.loadError {
		return Checkpoint{}, errors.New("synthetic_offline")
	}
	v := s.value
	v.Entries = append([]Entry(nil), v.Entries...)
	return v, nil
}
func (s *testStore) CompareAndSwap(ctx context.Context, _ string, version int64, digest string, next Checkpoint) (bool, error) {
	if s.beforeWrite != nil {
		s.beforeWrite()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.writes++
	if ctx.Err() != nil {
		return false, ctx.Err()
	}
	if s.writeError {
		return false, errors.New("synthetic_write_failure")
	}
	if s.rejectCAS || s.value.Version != version || s.value.Digest != digest {
		return false, nil
	}
	s.value = next
	s.value.Entries = append([]Entry(nil), next.Entries...)
	if s.loseResponse {
		return false, errors.New("synthetic_lost_commit_response")
	}
	return true, nil
}

type fixture struct {
	directory *Directory
	options   Options
	store     *testStore
	private   ed25519.PrivateKey
	now       time.Time
	snapshot  Snapshot
}

func setup(t *testing.T) *fixture {
	t.Helper()
	pub, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	f := &fixture{store: &testStore{}, private: private, now: time.Date(2026, 9, 7, 9, 0, 0, 0, time.UTC)}
	f.options = Options{DirectoryID: "dir-test", Issuer: "test-controller", Audience: "ingress-test", EnvironmentID: "sandbox", Keys: map[string]Key{"key-one": {pub, f.now.Add(-time.Hour), f.now.Add(time.Hour)}}, AllowedRegions: []string{"eu-test-1"}, MaxBytes: 32768, MaxEntries: 32, MaxLifetime: 5 * time.Minute, Checkpoints: f.store, Now: func() time.Time { return f.now }}
	f.directory, err = New(f.options)
	if err != nil {
		t.Fatal(err)
	}
	f.snapshot = Snapshot{1, "dir-test", "test-controller", "ingress-test", "sandbox", "key-one", 1, f.now.Add(-time.Minute), f.now.Add(time.Minute), []Entry{{Provider: "test", AppRef: "app-test", AssetID: "asset-one", TenantID: "tenant-one", WorkspaceID: "workspace-one", EnvironmentID: "sandbox", Region: "eu-test-1", CellID: "cell-one", Epoch: 1, State: "active"}}}
	return f
}
func (f *fixture) sign(t *testing.T, s Snapshot) ([]byte, []byte) {
	t.Helper()
	raw, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	return raw, ed25519.Sign(f.private, append([]byte(SignatureDomain), raw...))
}
func (f *fixture) install(t *testing.T, s Snapshot) error {
	t.Helper()
	raw, sig := f.sign(t, s)
	return f.directory.Install(context.Background(), s.KeyID, raw, sig)
}
func expectError(t *testing.T, err error, want string) {
	t.Helper()
	if err == nil || err.Error() != want {
		t.Fatalf("got %v; want %s", err, want)
	}
}

func TestSignedSnapshotActivatesAfterCheckpoint(t *testing.T) {
	f := setup(t)
	if f.directory.Status().Ready {
		t.Fatal("new directory falsely ready")
	}
	f.store.beforeWrite = func() {
		if f.directory.Status().Ready {
			t.Error("visible before durable checkpoint")
		}
	}
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	b, err := f.directory.Resolve(context.Background(), "test", "app-test", "asset-one")
	if err != nil {
		t.Fatal(err)
	}
	if b.TenantID != "tenant-one" || b.Epoch != 1 || b.SnapshotVersion != 1 || len(b.Digest) != 64 || f.store.writes != 1 {
		t.Fatal("incorrect authority")
	}
	b.TenantID = "forged"
	again, _ := f.directory.Resolve(context.Background(), "test", "app-test", "asset-one")
	if again.TenantID != "tenant-one" {
		t.Fatal("mutable binding alias")
	}
	before := f.store.loads
	f.directory.Status()
	f.directory.Resolve(context.Background(), "test", "app-test", "asset-one")
	if f.store.loads != before {
		t.Fatal("lookup did checkpoint I/O")
	}
}
func TestSignatureAndBoundaries(t *testing.T) {
	cases := []string{"tampered_body", "wrong_signature", "wrong_domain", "short_signature", "unknown_key", "oversized_body", "empty_body"}
	for _, name := range cases {
		t.Run(name, func(t *testing.T) {
			f := setup(t)
			raw, sig := f.sign(t, f.snapshot)
			key := "key-one"
			switch name {
			case "tampered_body":
				raw = append(raw, ' ')
			case "wrong_signature":
				sig[0] ^= 1
			case "wrong_domain":
				sig = ed25519.Sign(f.private, raw)
			case "short_signature":
				sig = sig[:63]
			case "unknown_key":
				key = "missing"
			case "oversized_body":
				raw = make([]byte, f.options.MaxBytes+1)
			case "empty_body":
				raw = nil
			}
			if f.directory.Install(context.Background(), key, raw, sig) == nil || f.directory.Status().Ready || f.store.writes != 0 {
				t.Fatal("untrusted snapshot accepted")
			}
		})
	}
}
func TestSignedInvalidDocuments(t *testing.T) {
	cases := map[string]func(*Snapshot){
		"issuer": func(s *Snapshot) { s.Issuer = "other" }, "audience": func(s *Snapshot) { s.Audience = "other" }, "environment": func(s *Snapshot) { s.EnvironmentID = "production" }, "directory": func(s *Snapshot) { s.DirectoryID = "other" }, "key_hint": func(s *Snapshot) { s.KeyID = "key-other" }, "schema": func(s *Snapshot) { s.SchemaVersion = 2 }, "zero_version": func(s *Snapshot) { s.Version = 0 }, "unsafe_version": func(s *Snapshot) { s.Version = maxSafeInteger + 1 },
		"future": func(s *Snapshot) { s.IssuedAt = s.ExpiresAt }, "expired": func(s *Snapshot) { s.ExpiresAt = s.IssuedAt }, "long_ttl": func(s *Snapshot) { s.ExpiresAt = s.IssuedAt.Add(time.Hour) }, "before_key": func(s *Snapshot) { s.IssuedAt = s.IssuedAt.Add(-time.Hour) },
		"missing_entries": func(s *Snapshot) { s.Entries = nil }, "duplicate_asset": func(s *Snapshot) { s.Entries = append(s.Entries, s.Entries[0]) }, "region": func(s *Snapshot) { s.Entries[0].Region = "forbidden-1" }, "entry_environment": func(s *Snapshot) { s.Entries[0].EnvironmentID = "production" }, "zero_epoch": func(s *Snapshot) { s.Entries[0].Epoch = 0 }, "unsafe_epoch": func(s *Snapshot) { s.Entries[0].Epoch = maxSafeInteger + 1 }, "invalid_id": func(s *Snapshot) { s.Entries[0].AssetID = "bad id" }, "bad_state": func(s *Snapshot) { s.Entries[0].State = "ready" }, "topic_injection": func(s *Snapshot) { s.Entries[0].CellID = "one.provider" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			f := setup(t)
			mutate(&f.snapshot)
			raw, sig := f.sign(t, f.snapshot)
			if f.directory.Install(context.Background(), "key-one", raw, sig) == nil || f.store.writes != 0 {
				t.Fatal("invalid signed data accepted")
			}
		})
	}
}
func TestStrictSignedJSON(t *testing.T) {
	for _, name := range []string{"duplicate", "case_variant", "uppercase", "unknown", "trailing", "invalid_utf8", "fractional_version", "deep", "null"} {
		t.Run(name, func(t *testing.T) {
			f := setup(t)
			raw, _ := f.sign(t, f.snapshot)
			text := string(raw)
			switch name {
			case "duplicate":
				text = strings.Replace(text, `"version":1`, `"version":1,"version":2`, 1)
			case "case_variant":
				text = strings.Replace(text, `"version":1`, `"version":1,"Version":2`, 1)
			case "uppercase":
				text = strings.Replace(text, `"version":1`, `"VERSION":1`, 1)
			case "unknown":
				text = strings.Replace(text, `"version":1`, `"version":1,"unapproved":true`, 1)
			case "trailing":
				text += "{}"
			case "invalid_utf8":
				text = strings.Replace(text, "tenant-one", "tenant-\xff", 1)
			case "fractional_version":
				text = strings.Replace(text, `"version":1`, `"version":1.5`, 1)
			case "deep":
				text = strings.Repeat("[", 10) + "0" + strings.Repeat("]", 10)
			case "null":
				text = "null"
			}
			raw = []byte(text)
			sig := ed25519.Sign(f.private, append([]byte(SignatureDomain), raw...))
			if f.directory.Install(context.Background(), "key-one", raw, sig) == nil || f.store.writes != 0 {
				t.Fatal("ambiguous JSON accepted")
			}
		})
	}
}
func TestEpochsTombstonesAndNamespaceIsolation(t *testing.T) {
	f := setup(t)
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"tenant", "workspace", "cell", "state", "epoch_rollback", "removal"} {
		t.Run(name, func(t *testing.T) {
			s := f.snapshot
			s.Entries = append([]Entry(nil), s.Entries...)
			s.Version = 2
			switch name {
			case "tenant":
				s.Entries[0].TenantID = "tenant-two"
			case "workspace":
				s.Entries[0].WorkspaceID = "workspace-two"
			case "cell":
				s.Entries[0].CellID = "cell-two"
			case "state":
				s.Entries[0].State = "suspended"
			case "epoch_rollback":
				s.Entries[0].Epoch = 0
			case "removal":
				s.Entries[0].AssetID = "replacement"
			}
			if f.install(t, s) == nil {
				t.Fatal("unversioned change accepted")
			}
			if !f.directory.Status().Ready {
				t.Fatal("bad candidate destroyed valid cache")
			}
		})
	}
	s := f.snapshot
	s.Version = 2
	s.Entries = append([]Entry(nil), s.Entries...)
	s.Entries[0].State = "revoked"
	s.Entries[0].Epoch = 2
	if err := f.install(t, s); err != nil {
		t.Fatal(err)
	}
	_, err := f.directory.Resolve(context.Background(), "test", "app-test", "asset-one")
	expectError(t, err, "placement_unavailable")
	s.Version = 3
	s.Entries[0].State = "active"
	if f.install(t, s) == nil {
		t.Fatal("revoked epoch reactivated")
	}
	s.Entries[0].Epoch = 3
	s.Entries[0].TenantID = "tenant-two"
	if err = f.install(t, s); err != nil {
		t.Fatal(err)
	}
	for _, tuple := range [][3]string{{"other", "app-test", "asset-one"}, {"test", "other", "asset-one"}, {"test", "app-test", "other"}} {
		if _, err = f.directory.Resolve(context.Background(), tuple[0], tuple[1], tuple[2]); err == nil {
			t.Fatal("namespace crossed")
		}
	}
}
func TestRestartIdempotencyAndRollback(t *testing.T) {
	f := setup(t)
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	if err := f.install(t, f.snapshot); err != nil || f.store.writes != 1 {
		t.Fatal("identical install not idempotent")
	}
	conflicting := f.snapshot
	conflicting.ExpiresAt = conflicting.ExpiresAt.Add(time.Second)
	expectError(t, f.install(t, conflicting), "placement_rollback_rejected")
	s := f.snapshot
	s.Version = 2
	if err := f.install(t, s); err != nil {
		t.Fatal(err)
	}
	restarted, err := New(f.options)
	if err != nil {
		t.Fatal(err)
	}
	f.directory = restarted
	expectError(t, f.install(t, f.snapshot), "placement_rollback_rejected")
	if err = f.install(t, s); err != nil {
		t.Fatal(err)
	}
	if !f.directory.Status().Ready || f.store.writes != 2 {
		t.Fatal("restart checkpoint lost")
	}
}
func TestUnavailableAndUncertainCheckpoint(t *testing.T) {
	for _, name := range []string{"load", "write", "cas", "lost_response", "corrupt"} {
		t.Run(name, func(t *testing.T) {
			f := setup(t)
			switch name {
			case "load":
				f.store.loadError = true
			case "write":
				f.store.writeError = true
			case "cas":
				f.store.rejectCAS = true
			case "lost_response":
				f.store.loseResponse = true
			case "corrupt":
				f.store.value = Checkpoint{Version: 1, Digest: "broken"}
			}
			if f.install(t, f.snapshot) == nil || f.directory.Status().Ready {
				t.Fatal("checkpoint failure acknowledged")
			}
			if name == "lost_response" {
				f.store.loseResponse = false
				if err := f.install(t, f.snapshot); err != nil {
					t.Fatal(err)
				}
				if f.store.writes != 1 {
					t.Fatal("duplicate durable write on uncertainty recovery")
				}
			}
		})
	}
}
func TestExpiryClockRollbackAndRevocation(t *testing.T) {
	for _, name := range []string{"expiry", "key_expiry", "clock_rollback", "revoke", "suspended"} {
		t.Run(name, func(t *testing.T) {
			f := setup(t)
			if name == "suspended" {
				f.snapshot.Entries[0].State = "suspended"
			}
			if err := f.install(t, f.snapshot); err != nil {
				t.Fatal(err)
			}
			switch name {
			case "expiry":
				f.now = f.snapshot.ExpiresAt
			case "key_expiry":
				f.now = f.now.Add(time.Hour)
			case "clock_rollback":
				f.now = f.now.Add(-time.Second)
			case "revoke":
				if err := f.directory.RevokeKey("key-one"); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := f.directory.Resolve(context.Background(), "test", "app-test", "asset-one"); err == nil {
				t.Fatal("invalid authority returned")
			}
		})
	}
}
func TestKeyRotationAndCopiedTrust(t *testing.T) {
	f := setup(t)
	pub, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	f.options.Keys["key-two"] = Key{pub, f.now.Add(-time.Hour), f.now.Add(time.Hour)}
	f.directory, err = New(f.options)
	if err != nil {
		t.Fatal(err)
	}
	// Caller mutations after construction cannot replace trusted key material.
	f.options.Keys["key-one"].Public[0] ^= 1
	if err = f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	if err = f.directory.RevokeKey("key-one"); err != nil {
		t.Fatal(err)
	}
	if f.install(t, f.snapshot) == nil {
		t.Fatal("revoked key accepted")
	}
	f.snapshot.Version = 2
	f.snapshot.KeyID = "key-two"
	f.private = private
	if err = f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	if !f.directory.Status().Ready {
		t.Fatal("valid key rotation not active")
	}
}
func TestCheckpointIODoesNotBlockActiveLookups(t *testing.T) {
	f := setup(t)
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}), make(chan struct{})
	f.store.beforeLoad = func() { close(entered); <-release }
	raw, sig := f.sign(t, f.snapshot)
	done := make(chan error, 1)
	go func() { done <- f.directory.Install(context.Background(), "key-one", raw, sig) }()
	<-entered
	lookup := make(chan error, 1)
	go func() {
		_, err := f.directory.Resolve(context.Background(), "test", "app-test", "asset-one")
		lookup <- err
	}()
	select {
	case err := <-lookup:
		if err != nil {
			t.Error(err)
		}
	case <-time.After(time.Second):
		t.Error("control-plane I/O blocked data-plane cache")
	}
	// Queued installers honor cancellation even while another store operation waits.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := f.directory.Install(ctx, "key-one", raw, sig); !errors.Is(err, context.Canceled) {
		t.Error(err)
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}
func TestExpiryAndRevocationDuringCheckpoint(t *testing.T) {
	for _, name := range []string{"expired", "revoked", "cancelled"} {
		t.Run(name, func(t *testing.T) {
			f := setup(t)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			f.store.beforeWrite = func() {
				switch name {
				case "expired":
					f.now = f.snapshot.ExpiresAt
				case "revoked":
					f.directory.RevokeKey("key-one")
				case "cancelled":
					cancel()
				}
			}
			raw, sig := f.sign(t, f.snapshot)
			if f.directory.Install(ctx, "key-one", raw, sig) == nil || f.directory.Status().Ready {
				t.Fatal("late invalidation missed")
			}
		})
	}
}
func TestConcurrentReadersAndRefreshes(t *testing.T) {
	f := setup(t)
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	var group sync.WaitGroup
	for i := 0; i < 12; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for j := 0; j < 100; j++ {
				binding, err := f.directory.Resolve(context.Background(), "test", "app-test", "asset-one")
				if err != nil || binding.TenantID != "tenant-one" {
					t.Error("concurrent cache mismatch", err)
				}
				f.directory.Status()
			}
		}()
	}
	for i := 2; i < 22; i++ {
		s := f.snapshot
		s.Version = int64(i)
		if err := f.install(t, s); err != nil {
			t.Error(err)
		}
	}
	group.Wait()
}
func TestConfigurationAndContextFailures(t *testing.T) {
	for _, name := range []string{"store", "clock", "keys", "short_key", "regions", "duplicate_region", "ttl", "bytes", "entries"} {
		t.Run(name, func(t *testing.T) {
			f := setup(t)
			o := f.options
			switch name {
			case "store":
				o.Checkpoints = nil
			case "clock":
				o.Now = nil
			case "keys":
				o.Keys = nil
			case "short_key":
				o.Keys["key-one"] = Key{Public: []byte{1}, NotBefore: f.now, NotAfter: f.now.Add(time.Hour)}
			case "regions":
				o.AllowedRegions = nil
			case "duplicate_region":
				o.AllowedRegions = []string{"eu-test-1", "eu-test-1"}
			case "ttl":
				o.MaxLifetime = 0
			case "bytes":
				o.MaxBytes = 0
			case "entries":
				o.MaxEntries = 0
			}
			if _, err := New(o); err == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
	f := setup(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := f.directory.Resolve(ctx, "test", "app-test", "asset-one"); !errors.Is(err, context.Canceled) {
		t.Fatal("cancel ignored")
	}
}
func TestRegressedOrAlteredCheckpointFailsClosed(t *testing.T) {
	f := setup(t)
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	f.store.value.Entries[0].Epoch = 2
	if err := f.install(t, f.snapshot); err == nil {
		t.Fatal("altered checkpoint trusted")
	}
	if f.directory.Status().Ready {
		t.Fatal("corrupt checkpoint left directory ready")
	}
	f = setup(t)
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	f.store.value = Checkpoint{}
	s := f.snapshot
	s.Version = 2
	expectError(t, f.install(t, s), "placement_checkpoint_regressed")
	if f.directory.Status().Ready {
		t.Fatal("regressed durable high-water remained ready")
	}
}

func TestCachedRoutingSurvivesControlPlaneReadOutageUntilExpiry(t *testing.T) {
	f := setup(t)
	if err := f.install(t, f.snapshot); err != nil {
		t.Fatal(err)
	}
	f.store.loadError = true
	expectError(t, f.install(t, f.snapshot), "placement_checkpoint_unavailable")
	if _, err := f.directory.Resolve(context.Background(), "test", "app-test", "asset-one"); err != nil {
		t.Fatal("lost still-valid local routing", err)
	}
	f.now = f.snapshot.ExpiresAt
	if f.directory.Status().Ready {
		t.Fatal("stale snapshot used indefinitely")
	}
}

func FuzzStrictPlacementJSON(f *testing.F) {
	for _, seed := range []string{`{}`, `{"version":1,"Version":2}`, `{"entries":[{}]}`, `null`, `[]`} {
		f.Add([]byte(seed))
	}
	f.Fuzz(func(t *testing.T, raw []byte) {
		if len(raw) > 32768 {
			return
		}
		var snapshot Snapshot
		_ = strictDecode(raw, &snapshot)
	})
}
