// Package placement verifies bounded, signed routing snapshots for PLT-004.
// It resolves routing authority, NOT permission to perform a provider side effect.
// Production controllers, checkpoint persistence and writer fencing are separate
// adapters; this package never silently installs an in-memory production store.
package placement

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"sync"
	"time"
)

// SignatureDomain prevents a signature from another protocol becoming placement
// authority. Sign ordinary Ed25519 over these bytes followed by EXACT payload bytes.
const SignatureDomain = "greeto-placement-snapshot/v1\x00"
const maxSafeInteger = int64(9007199254740991)

var idPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)
var topicPart = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

// Entry is server-issued placement data. Identity is provider/app/asset; IDs are
// opaque strings. Changing ownership, location or state requires a higher epoch.
// Suspended/revoked entries are retained as tombstones, not silently removed.
type Entry struct {
	Provider      string `json:"provider"`
	AppRef        string `json:"app_ref"`
	AssetID       string `json:"asset_id"`
	TenantID      string `json:"tenant_id"`
	WorkspaceID   string `json:"workspace_id"`
	EnvironmentID string `json:"environment_id"`
	Region        string `json:"region"`
	CellID        string `json:"cell_id"`
	Epoch         int64  `json:"placement_epoch"`
	State         string `json:"state"`
}

// Snapshot is a full replacement within ONE configured directory namespace.
// It is an internal implementation contract, not an authorization API for browsers.
type Snapshot struct {
	SchemaVersion int       `json:"schema_version"`
	DirectoryID   string    `json:"directory_id"`
	Issuer        string    `json:"issuer"`
	Audience      string    `json:"audience"`
	EnvironmentID string    `json:"environment_id"`
	KeyID         string    `json:"key_id"`
	Version       int64     `json:"version"`
	IssuedAt      time.Time `json:"issued_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	Entries       []Entry   `json:"entries"`
}

// Key is an out-of-band trusted public key with a validity interval. The private
// key never enters this package. Constructor copies key bytes and configuration.
type Key struct {
	Public              ed25519.PublicKey
	NotBefore, NotAfter time.Time
}

// Checkpoint is the durable anti-rollback record. Digest covers raw signed payload
// bytes. Entries retain epoch/ownership history, including suspended/revoked assets.
// A zero-version record is allowed ONLY after explicit trusted provisioning.
type Checkpoint struct {
	Version int64
	Digest  string
	Entries []Entry
}

// Checkpoints must provide authoritative reads and atomic, durable compare-and-swap.
// Missing/corrupt records MUST return an error, not invent a fresh zero record.
// CompareAndSwap returns true ONLY after next is durable; an uncertain write errors.
// Implementations deep-copy input/output; callers may modify their own copies.
// expectedVersion+expectedDigest compare the entire previous accepted checkpoint.
// The namespace is server configuration, never a caller's tenant field.
type Checkpoints interface {
	Load(ctx context.Context, namespace string) (Checkpoint, error)
	CompareAndSwap(ctx context.Context, namespace string, expectedVersion int64, expectedDigest string, next Checkpoint) (bool, error)
}

// Options is trusted local configuration. Now is a trusted nonblocking local clock, not a request
// timestamp or remote clock query. AllowedRegions must contain only jurisdictions approved for this
// ingress directory. MaxLifetime bounds stale snapshots during control-plane loss.
type Options struct {
	DirectoryID, Issuer, Audience, EnvironmentID string
	Keys                                         map[string]Key
	AllowedRegions                               []string
	MaxBytes, MaxEntries                         int
	MaxLifetime                                  time.Duration
	Checkpoints                                  Checkpoints
	Now                                          func() time.Time
}

// Binding is a copy of verified placement plus its exact source version/digest.
// Returning it does not acquire an action claim or prove the provider is ready.
type Binding struct {
	Entry
	SnapshotVersion int64
	Digest          string
	ExpiresAt       time.Time
}

// Status contains bounded routing-readiness metadata, not tenant data or an SLA.
// Ready means THIS local directory has a usable snapshot, not the whole app is up.
type Status struct {
	Ready     bool      `json:"ready"`
	Reason    string    `json:"reason"`
	Version   int64     `json:"version"`
	ExpiresAt time.Time `json:"expires_at,omitempty"`
}

type activeSnapshot struct {
	document Snapshot
	digest   string
	entries  map[string]Entry
}

// Directory has atomic snapshot activation and lock-protected local lookups.
// Installation may access its checkpoint adapter. Resolve and Status never do I/O.
type Directory struct {
	installSlot chan struct{}
	mu          sync.Mutex
	options     Options
	regions     map[string]bool
	revoked     map[string]bool
	active      *activeSnapshot
	lastClock   time.Time
}

// New validates explicit bounds, trust anchors and persistence wiring. It does NOT
// activate a snapshot, create storage, generate keys, change placement or do I/O.
// Returns an unready directory or a sanitized configuration error.
func New(o Options) (*Directory, error) {
	if !validID(o.DirectoryID) || !validID(o.Issuer) || !validID(o.Audience) || !validID(o.EnvironmentID) || o.Now == nil || o.Checkpoints == nil || o.MaxBytes < 1 || o.MaxBytes > 4<<20 || o.MaxEntries < 1 || o.MaxEntries > 100000 || o.MaxLifetime <= 0 || o.MaxLifetime > 24*time.Hour || len(o.Keys) < 1 || len(o.Keys) > 16 || len(o.AllowedRegions) < 1 || len(o.AllowedRegions) > 64 {
		return nil, errors.New("placement_configuration_invalid")
	}
	keys := make(map[string]Key, len(o.Keys))
	for id, key := range o.Keys {
		if !validID(id) || len(key.Public) != ed25519.PublicKeySize || key.NotBefore.IsZero() || !key.NotAfter.After(key.NotBefore) {
			return nil, errors.New("placement_key_invalid")
		}
		key.Public = append(ed25519.PublicKey(nil), key.Public...)
		keys[id] = key
	}
	regions := make(map[string]bool, len(o.AllowedRegions))
	for _, region := range o.AllowedRegions {
		if !topicPart.MatchString(region) || regions[region] {
			return nil, errors.New("placement_region_invalid")
		}
		regions[region] = true
	}
	o.Keys = keys
	o.AllowedRegions = append([]string(nil), o.AllowedRegions...)
	return &Directory{options: o, regions: regions, revoked: map[string]bool{}, installSlot: make(chan struct{}, 1)}, nil
}

// Install authenticates exact bytes, validates scope/time/schema/epochs, then
// durably advances the anti-rollback checkpoint BEFORE making routes visible.
// keyID is merely a lookup hint; it must also appear in the signed payload.
// Invalid candidates leave a still-valid current snapshot intact. Uncertain store
// writes invalidate the local cache; retrying identical bytes recovers by readback.
// No webhook, provider action or success HTTP acknowledgement is performed here.
func (d *Directory) Install(ctx context.Context, keyID string, payload, signature []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !validID(keyID) || len(payload) == 0 || len(payload) > d.options.MaxBytes || len(signature) != ed25519.SignatureSize {
		return errors.New("placement_bounds_invalid")
	}
	// The caller owns these slices; do not retain aliases after activation.
	raw := append([]byte(nil), payload...)
	proof := append([]byte(nil), signature...)
	select {
	case d.installSlot <- struct{}{}:
		defer func() { <-d.installSlot }()
	case <-ctx.Done():
		return ctx.Err()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	d.mu.Lock()
	now, err := d.clockLocked()
	key, ok := d.options.Keys[keyID]
	revoked := d.revoked[keyID]
	d.mu.Unlock()
	if err != nil {
		return err
	}
	if !ok || revoked || now.Before(key.NotBefore) || !now.Before(key.NotAfter) {
		return errors.New("placement_key_unavailable")
	}
	message := append([]byte(SignatureDomain), raw...)
	if !ed25519.Verify(key.Public, message, proof) {
		return errors.New("placement_signature_rejected")
	}
	var s Snapshot
	if err = strictDecode(raw, &s); err != nil {
		return errors.New("placement_schema_invalid")
	}
	if s.SchemaVersion != 1 || s.DirectoryID != d.options.DirectoryID || s.Issuer != d.options.Issuer || s.Audience != d.options.Audience || s.EnvironmentID != d.options.EnvironmentID || s.KeyID != keyID || s.Version < 1 || s.Version > maxSafeInteger {
		return errors.New("placement_scope_invalid")
	}
	if s.IssuedAt.IsZero() || s.IssuedAt.After(now) || !s.ExpiresAt.After(now) || !s.ExpiresAt.After(s.IssuedAt) || s.ExpiresAt.Sub(s.IssuedAt) > d.options.MaxLifetime || s.IssuedAt.Before(key.NotBefore) || s.ExpiresAt.After(key.NotAfter) {
		return errors.New("placement_validity_invalid")
	}
	entries, err := d.validateEntries(s.Entries)
	if err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	previous, err := d.options.Checkpoints.Load(ctx, d.options.DirectoryID)
	if err != nil {
		return errors.New("placement_checkpoint_unavailable")
	}
	if err = d.validateCheckpoint(previous); err != nil {
		d.mu.Lock()
		d.active = nil
		d.mu.Unlock()
		return err
	}
	digest := sha256.Sum256(raw)
	hash := hex.EncodeToString(digest[:])
	if previous.Version > s.Version || (previous.Version == s.Version && previous.Digest != hash) {
		return errors.New("placement_rollback_rejected")
	}
	// A checkpoint that unexpectedly regresses even below our live state is unsafe.
	d.mu.Lock()
	if d.active != nil && (previous.Version < d.active.document.Version || (previous.Version == d.active.document.Version && previous.Digest != d.active.digest)) {
		d.active = nil
		d.mu.Unlock()
		return errors.New("placement_checkpoint_regressed")
	}
	d.mu.Unlock()
	if previous.Version == s.Version && !sameEntries(previous.Entries, entries) {
		d.mu.Lock()
		d.active = nil
		d.mu.Unlock()
		return errors.New("placement_checkpoint_corrupt")
	}
	if err = validateEpochs(previous.Entries, entries); err != nil {
		return err
	}
	if previous.Version != s.Version {
		next := Checkpoint{s.Version, hash, append([]Entry(nil), s.Entries...)}
		committed, writeErr := d.options.Checkpoints.CompareAndSwap(ctx, d.options.DirectoryID, previous.Version, previous.Digest, next)
		if writeErr != nil || !committed {
			d.mu.Lock()
			d.active = nil
			d.mu.Unlock()
			return errors.New("placement_checkpoint_unconfirmed")
		}
	}
	// Checkpoint I/O never holds the lookup lock. Recheck revocation and time after it.
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.revoked[keyID] {
		d.active = nil
		return errors.New("placement_key_unavailable")
	}
	// Persistence may have taken long enough for the signed document to expire.
	now, err = d.clockLocked()
	if err != nil {
		d.active = nil
		return err
	}
	if ctx.Err() != nil {
		d.active = nil
		return ctx.Err()
	}
	if !now.Before(s.ExpiresAt) || !now.Before(key.NotAfter) {
		d.active = nil
		return errors.New("placement_expired_during_install")
	}
	d.active = &activeSnapshot{document: s, digest: hash, entries: entries}
	return nil
}

// Resolve returns only an active, valid, authorized provider/app/asset placement.
// All lookup values are opaque identifiers, never tenant authority from a body.
// This is cache-only so F03 adds no checkpoint/network/health round trip before ACK.
// Unknown, suspended and revoked assets share a non-disclosing failure reason.
func (d *Directory) Resolve(ctx context.Context, provider, appRef, assetID string) (Binding, error) {
	if err := ctx.Err(); err != nil {
		return Binding{}, err
	}
	if !validID(provider) || !validID(appRef) || !validID(assetID) {
		return Binding{}, errors.New("placement_unavailable")
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	if status := d.statusLocked(); !status.Ready {
		return Binding{}, errors.New(status.Reason)
	}
	entry, ok := d.active.entries[identity(provider, appRef, assetID)]
	if !ok || entry.State != "active" {
		return Binding{}, errors.New("placement_unavailable")
	}
	return Binding{entry, d.active.document.Version, d.active.digest, d.active.document.ExpiresAt}, nil
}

// Status reports cached directory readiness only. It performs no external probe,
// never returns customer IDs, and fails closed on clock rollback or key expiry.
func (d *Directory) Status() Status { d.mu.Lock(); defer d.mu.Unlock(); return d.statusLocked() }

// RevokeKey is an internal control-plane hook, NOT a public user action. Its caller
// must authorize and persist the trust revocation before invoking it, and fan it out
// to all affected processes. Revocation is irreversible for this instance. It does
// not claim cluster-wide writer fencing or persist a revocation by itself.
func (d *Directory) RevokeKey(keyID string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if _, ok := d.options.Keys[keyID]; !ok {
		return errors.New("placement_key_unavailable")
	}
	d.revoked[keyID] = true
	if d.active != nil && d.active.document.KeyID == keyID {
		d.active = nil
	}
	return nil
}

func (d *Directory) clockLocked() (time.Time, error) {
	now := d.options.Now().UTC()
	if now.IsZero() || (!d.lastClock.IsZero() && now.Before(d.lastClock)) {
		return time.Time{}, errors.New("placement_clock_invalid")
	}
	d.lastClock = now
	return now, nil
}
func (d *Directory) statusLocked() Status {
	now, err := d.clockLocked()
	if err != nil {
		return Status{Reason: "placement_clock_invalid"}
	}
	if d.active == nil {
		return Status{Reason: "placement_not_loaded"}
	}
	s := d.active.document
	status := Status{Version: s.Version, ExpiresAt: s.ExpiresAt}
	key, ok := d.options.Keys[s.KeyID]
	switch {
	case !ok || d.revoked[s.KeyID] || now.Before(key.NotBefore) || !now.Before(key.NotAfter):
		status.Reason = "placement_key_unavailable"
	case now.Before(s.IssuedAt) || !now.Before(s.ExpiresAt):
		status.Reason = "placement_expired"
	default:
		status.Ready = true
		status.Reason = "verified_snapshot_only"
	}
	return status
}
func validID(v string) bool { return idPattern.MatchString(v) }
func identity(provider, app, asset string) string {
	raw, _ := json.Marshal([3]string{provider, app, asset})
	return string(raw)
}
func (d *Directory) validateEntries(entries []Entry) (map[string]Entry, error) {
	if len(entries) == 0 || len(entries) > d.options.MaxEntries {
		return nil, errors.New("placement_entry_bounds")
	}
	index := make(map[string]Entry, len(entries))
	for _, e := range entries {
		if !validID(e.Provider) || !validID(e.AppRef) || !validID(e.AssetID) || !validID(e.TenantID) || !validID(e.WorkspaceID) || e.EnvironmentID != d.options.EnvironmentID || !d.regions[e.Region] || !topicPart.MatchString(e.CellID) || e.Epoch < 1 || e.Epoch > maxSafeInteger || (e.State != "active" && e.State != "suspended" && e.State != "revoked") {
			return nil, errors.New("placement_entry_invalid")
		}
		id := identity(e.Provider, e.AppRef, e.AssetID)
		if _, exists := index[id]; exists {
			return nil, errors.New("placement_duplicate_asset")
		}
		index[id] = e
	}
	return index, nil
}
func (d *Directory) validateCheckpoint(c Checkpoint) error {
	if c.Version == 0 && c.Digest == "" && len(c.Entries) == 0 {
		return nil
	}
	digest, err := hex.DecodeString(c.Digest)
	if c.Version < 1 || c.Version > maxSafeInteger || err != nil || len(digest) != sha256.Size || c.Digest != hex.EncodeToString(digest) {
		return errors.New("placement_checkpoint_corrupt")
	}
	if _, err = d.validateEntries(c.Entries); err != nil {
		return errors.New("placement_checkpoint_corrupt")
	}
	return nil
}
func validateEpochs(previous []Entry, next map[string]Entry) error {
	for _, old := range previous {
		entry, ok := next[identity(old.Provider, old.AppRef, old.AssetID)]
		if !ok {
			return errors.New("placement_tombstone_required")
		}
		if entry.Epoch < old.Epoch {
			return errors.New("placement_epoch_rollback")
		}
		if entry.Epoch == old.Epoch && entry != old {
			return errors.New("placement_epoch_increment_required")
		}
	}
	return nil
}

// decodeTyped is separate from the token walk so field types, unknown fields and
// single-value semantics are checked in addition to duplicate-key/UTF-8 checks.
func decodeTyped(raw []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(out)
}

func sameEntries(previous []Entry, next map[string]Entry) bool {
	if len(previous) != len(next) {
		return false
	}
	for _, old := range previous {
		if candidate, ok := next[identity(old.Provider, old.AppRef, old.AssetID)]; !ok || candidate != old {
			return false
		}
	}
	return true
}
