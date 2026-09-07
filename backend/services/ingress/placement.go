package ingress

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"unicode/utf8"

	"github.com/ooarchitect92/greeto_ananta/backend/internal/events"
	"github.com/ooarchitect92/greeto_ananta/backend/internal/placement"
)

// PlacementRoute is fixed by server-owned callback configuration. Neither provider
// nor app can be selected by a field in the callback body. Lane is the trusted
// Kafka namespace prefix; EnvironmentID is the actual tenant environment ID.
type PlacementRoute struct{ Provider, AppRef, EnvironmentID, Lane string }

// PlacementBinder implements the EXISTING F03 Binder port; it does not alter the
// handler order or make a provider call. The parser remains responsible for
// enumerating/minimizing each signed element and its stable EventRef/event kind.
type PlacementBinder struct {
	directory       *placement.Directory
	routes          map[string]PlacementRoute
	maxPayloadBytes int
}

var _ Binder = (*PlacementBinder)(nil)

var lanePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

// NewPlacementBinder validates explicit route ownership and copies the routes.
// Production wiring must use the verified placement.Directory plus certified
// proof/parser/journal adapters. No fallback route or synthetic store is created.
func NewPlacementBinder(directory *placement.Directory, routes map[string]PlacementRoute, maxPayloadBytes int) (*PlacementBinder, error) {
	if directory == nil || len(routes) == 0 || len(routes) > 1024 || maxPayloadBytes < 1 || maxPayloadBytes > 4<<20 {
		return nil, errors.New("placement_binder_configuration_invalid")
	}
	copied := make(map[string]PlacementRoute, len(routes))
	for id, route := range routes {
		if !opaque.MatchString(id) || !opaque.MatchString(route.Provider) || !opaque.MatchString(route.AppRef) || !opaque.MatchString(route.EnvironmentID) || !lanePattern.MatchString(route.Lane) {
			return nil, errors.New("placement_route_invalid")
		}
		copied[id] = route
	}
	return &PlacementBinder{directory, copied, maxPayloadBytes}, nil
}

// boundEnvelope is a verified INGESTION SLICE, not an F04 normalized business fact.
// payload remains untrusted provider data: nested tenant/role claims cannot replace
// the authoritative top-level routing scope populated by the signed directory.
type boundEnvelope struct {
	SchemaVersion   int             `json:"schema_version"`
	Provider        string          `json:"provider"`
	AppRef          string          `json:"app_ref"`
	AssetID         string          `json:"asset_id"`
	EventRef        string          `json:"provider_event_ref"`
	TenantID        string          `json:"tenant_id"`
	WorkspaceID     string          `json:"workspace_id"`
	EnvironmentID   string          `json:"environment_id"`
	Region          string          `json:"region"`
	CellID          string          `json:"cell_id"`
	PlacementEpoch  int64           `json:"placement_epoch"`
	SnapshotVersion int64           `json:"placement_snapshot_version"`
	SnapshotDigest  string          `json:"placement_snapshot_digest"`
	Payload         json.RawMessage `json:"payload"`
}

// Bind validates a single post-proof Candidate and returns a home-cell Kafka slice.
// Context carries cancellation only; tenant authority comes from the directory.
// Event identity includes environment/provider/app/asset/EventRef, not a request
// trace or raw batch hash. A refresh or retry preserves its ID. EventRef must encode
// the provider adapter's logical event-kind identity, NOT just a message ID reused
// for multiple different statuses. This method performs no persistence or ACK.
func (b *PlacementBinder) Bind(ctx context.Context, routeID string, candidate Candidate) (Slice, error) {
	if err := ctx.Err(); err != nil {
		return Slice{}, err
	}
	route, ok := b.routes[routeID]
	if !ok || !opaque.MatchString(candidate.AssetID) || !opaque.MatchString(candidate.EventRef) || len(candidate.Body) == 0 || len(candidate.Body) > b.maxPayloadBytes || !utf8.Valid(candidate.Body) || !json.Valid(candidate.Body) {
		return Slice{}, errors.New("placement_candidate_rejected")
	}
	binding, err := b.directory.Resolve(ctx, route.Provider, route.AppRef, candidate.AssetID)
	if err != nil {
		return Slice{}, err
	}
	if binding.Provider != route.Provider || binding.AppRef != route.AppRef || binding.AssetID != candidate.AssetID || binding.EnvironmentID != route.EnvironmentID || binding.State != "active" || binding.Epoch < 1 || binding.SnapshotVersion < 1 || len(binding.Digest) != 64 {
		return Slice{}, errors.New("placement_binding_rejected")
	}
	envelope := boundEnvelope{1, route.Provider, route.AppRef, candidate.AssetID, candidate.EventRef, binding.TenantID, binding.WorkspaceID, binding.EnvironmentID, binding.Region, binding.CellID, binding.Epoch, binding.SnapshotVersion, binding.Digest, append(json.RawMessage(nil), candidate.Body...)}
	body, err := json.Marshal(envelope)
	if err != nil {
		return Slice{}, errors.New("placement_encoding_failed")
	}
	if err = ctx.Err(); err != nil {
		return Slice{}, err
	}
	eventID := digestIdentity(route.EnvironmentID, route.Provider, route.AppRef, candidate.AssetID, candidate.EventRef)
	partitionKey := digestIdentity(route.EnvironmentID, route.Provider, route.AppRef, candidate.AssetID)
	topic := fmt.Sprintf("%s.%s.%s.provider.received.v1", route.Lane, binding.Region, binding.CellID)
	return Slice{Record: events.Record{ID: "ing_" + eventID, Topic: topic, Key: partitionKey, Body: body}, CellID: binding.CellID, PlacementEpoch: binding.Epoch, AuthorityRef: fmt.Sprintf("ps_%d_%s", binding.SnapshotVersion, binding.Digest[:24])}, nil
}
func digestIdentity(parts ...string) string {
	raw, _ := json.Marshal(parts)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
