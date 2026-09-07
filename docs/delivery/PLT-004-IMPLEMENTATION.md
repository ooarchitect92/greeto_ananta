# PLT-004 increment: authenticated local placement and F03 binding

7 September 2026. Source implementation only. Parent acceptance is **Blocked** on GOV-001 sign-off and the production integrations below. No production channel, database or infrastructure is activated.

## Baseline and scope

This increment implements part of **PLT-004 — Cell directory and signed placement**, an existing G0 prerequisite for event ingestion. Source requirements are the approved architecture sections 5.1 (signed placement), 12/F03 (authorized placement before durable acknowledgement), 28.1 (trusted identities) and 29.3 (ownership epochs). The original 262 IDs, predecessor links and F01–F18 flows are unchanged. The architecture workbook, not the existence of a class, decides parent completion.

No existing HTTP endpoint, OpenAPI contract, provider proof algorithm, framework, dependency version, CI/CD workflow, release gate or database migration is changed. `backend/services/ingress/handler.go` and `proof.go` are unchanged. The new adapter implements the existing `Binder` interface. The diagnostic command is not rewired to a synthetic production adapter.

The Ed25519/JSON snapshot below is an initial internal implementation profile for a previously unimplemented adapter, not a migration of an existing wire protocol. Controller compatibility, production key/TTL choices and independent security review remain required before activation. Any subsequent pipeline or contract change needs the owner's approval.

## Actual files and responsibilities

| File | Responsibility |
|---|---|
| `backend/internal/placement/directory.go` | Trust configuration, signed payload verification, scope/time/epoch validation, durable checkpoint-before-activation, local lookup and readiness |
| `backend/internal/placement/json.go` | Strict UTF-8 and bounded JSON token traversal; rejects duplicates, case variants, unknown fields and trailing values |
| `backend/services/ingress/placement.go` | Concrete signed-directory adapter for the unchanged F03 Binder port; creates authorized cell slices and stable transport identities |
| `backend/contracts/placement-snapshot.schema.json` | Documented internal payload fields, bounds and implementation status; schema validation is not cryptographic verification |
| `backend/internal/placement/directory_test.go` | Adversarial, restart, key-rotation, cache-outage and concurrent-lookup tests plus bounded JSON fuzz target |
| `backend/services/ingress/placement_test.go` | Real verifier/directory/binder/HTTP-handler composition with synthetic parser/checkpoint/broker fixtures |
| `docs/delivery/PLT-004-verification.json` | Measured local check results and explicit unverified gates |

## Data flow without changing F03

Control-plane refresh, outside the callback fast path:

`trusted public-key configuration + signed bytes -> bounds -> exact-byte signature verification -> strict typed decoding -> directory/issuer/audience/environment/time checks -> unique asset and epoch validation -> authoritative checkpoint read/CAS -> activate immutable local snapshot`

Existing callback path:

`request bounds -> route-owned provider proof -> bounded provider parsing -> NEW PlacementBinder using the local signed directory -> existing home-cell journal append -> existing all-slices durability check -> HTTP acknowledgement -> asynchronous downstream consumers`

Checkpoint I/O never holds the lookup lock. A stalled control-plane refresh cannot make `Resolve` wait for that database call. A still-valid cached snapshot can continue resolving known assets during a checkpoint read outage; it is rejected at expiry. New/unknown assets do not gain authority from a failed refresh.

This is **routing authority**, not an Action Gateway permit. It does not approve a send, consent, budget, caller role or provider grant, and does not fence an already-running remote side effect. Those later boundaries remain mandatory.

## Parameters and callable boundaries

| Symbol / parameter | Type and constraints | Meaning / failure behavior |
|---|---|---|
| `placement.New(options)` | `Options`; required keys, store, clock and explicit limits | Constructs an unready directory; performs no storage write or key generation |
| `DirectoryID` | Opaque string, 1–128 characters | Exact signed namespace and checkpoint partition; never taken from a customer body |
| `Issuer`, `Audience` | Opaque strings, 1–128 characters | Exact expected controller and consumer profile |
| `EnvironmentID` | Opaque string | Must match the snapshot and every entry; sandbox and production are not interchangeable |
| `Keys` | 1–16 named public keys | 32-byte Ed25519 public keys with nonempty validity intervals; private keys are never supplied |
| `AllowedRegions` | 1–64 unique region identifiers | Trusted jurisdiction allowlist, also enforced on checkpoint history |
| `MaxBytes` | 1–4,194,304 bytes | Maximum signed JSON bytes; production value must be qualified |
| `MaxEntries` | 1–100,000 entries | Additional count bound; byte bound also applies, so this is not a capacity claim |
| `MaxLifetime` | Positive duration, at most 24 hours | Upper bound on a signed snapshot's validity; tests use five minutes, not a production-approved TTL |
| `Checkpoints` | Required `Checkpoints` port | Authoritative read and durable atomic compare-and-swap; no built-in memory fallback |
| `Now` | Nonblocking local `func() time.Time` | Trusted clock; zero or backwards time fails closed; never a request timestamp or network query |
| `Install(ctx, keyID, payload, signature)` | Context; bounded hint; exact UTF-8 bytes; 64-byte signature | Returns only after checkpoint confirmation and final validity recheck. Unknown write result invalidates the cache; identical retries recover by readback |
| `Resolve(ctx, provider, appRef, assetID)` | Context plus opaque namespaced IDs | Returns a copied `Binding` from active local authority only; no database/network I/O |
| `Status()` | Bounded `Status` result | Local snapshot readiness/version/expiry only; never overall production or provider health |
| `RevokeKey(keyID)` | Internal trusted control-plane call | Disables a known key for this instance. Caller must first authorize/persist revocation and distribute it to all instances |
| `NewPlacementBinder(directory, routes, maxPayloadBytes)` | Concrete `*placement.Directory`; 1–1,024 trusted routes; positive byte bound at most 4 MiB | Copies route configuration; no automatic route, provider or environment fallback |
| `PlacementRoute` | Provider, AppRef, EnvironmentID, Lane | Must be derived from the same trusted callback registry as the proof adapter; no body-supplied app binding |
| `Bind(ctx, routeID, candidate)` | Existing `Candidate` after raw proof and parsing | Produces `Slice` with home cell, epoch, version/digest reference and minimized provider data; never sends or acknowledges |

Snapshot and entry fields are fully described in the JSON Schema. Versions and epochs are positive integers no greater than 9,007,199,254,740,991. Provider IDs remain strings. Every provider/app/asset tuple must be unique within the snapshot.

## Signature and trust profile

Use ordinary Ed25519 over:

`UTF8("greeto-placement-snapshot/v1") || 0x00 || exact UTF-8 payload bytes`

The lookup hint must equal `key_id` inside the signed payload. Do not reserialize JSON between signing and verification. The signed directory ID, issuer, audience and environment must match independently configured expectations. A public key contained in the payload is not a trust anchor. The runtime uses Go's standard `crypto/ed25519` implementation; no custom signature primitive is implemented.

Duplicate and case-variant object keys, invalid UTF-8, excess nesting, trailing JSON, unrecognized fields and wrong field types are rejected. A valid signature does not waive semantic validation or grant provider permissions. Public-key material and synthetic fixture secrets are distinct from production signing/provider credentials; production private keys are not in this repository.

Reference checks for the primitive and parser behavior: https://pkg.go.dev/crypto/ed25519 and https://pkg.go.dev/encoding/json . These references explain library behavior, not production security certification.

## Checkpoint, restart and tombstone contract

`Checkpoints.Load(namespace)` must fail on missing, corrupt or inaccessible storage. Only trusted provisioning may create an explicit zero-version checkpoint. Never reinterpret deletion of the checkpoint as a fresh install. The adapter must provide atomic durable CAS of prior version/digest and all next entry/epoch history, using the selected control datastore and scoped least-privilege access. This increment does not ship or configure that real datastore adapter.

A lower generation, or different bytes at the same generation, is rejected. Exact same-generation retries are idempotent only when digest and entry history match. Ownership, workspace, location or active/suspended/revoked state changes need a higher epoch. Entries cannot silently disappear: retain a suspended/revoked tombstone. The initial bounded profile requires at least one entry/tombstone; empty-directory bootstrap and history compaction are not implemented.

The CAS occurs before local activation. If the store commits but its acknowledgement is lost, the directory remains unready until an identical verified retry reads back the committed generation. Cancellation, key revocation or expiry during the write also prevents activation. Corrupt/regressed checkpoint evidence invalidates the affected local cache. A simple checkpoint read outage does not discard a still-valid signed cache.

Fleet invalidation, signer revocation persistence, checkpoint restore protection, approved history compaction and writer fencing are separate production obligations. A replica may hold a still-valid old snapshot until refresh/revocation or expiry; this package is not a distributed lock, not a global revocation service and not permission to dispatch from a stale epoch.

## Stable identities and scope

The adapter derives the ingestion record ID from a length-unambiguous JSON tuple of environment, provider, app, asset and the parser's EventRef. Snapshot refresh, request trace and raw HTTP batch formatting are not part of that ID. Different event kinds need different EventRefs; the provider parser must specify how statuses, edits and rebatching form this logical identity. This increment does not certify a Meta or Telegram parser.

The Kafka topic comes from trusted lane, signed region and signed cell. The actual journal adapter must additionally enforce broker identity, topic ACLs, jurisdiction and quorum policy. Route proof configuration and the binder's provider/app map must agree at real startup; no independent body assertion is authority.

The envelope has authoritative top-level tenant/workspace/environment/cell/epoch fields. Nested provider payload fields with the same names remain untrusted data. The parser still owns element-level minimization: this binder cannot prove that a buggy parser did not include another tenant's payload. Official fixtures and isolation tests remain release-blocking.

## Tests and limits

Reproduce from the repository root:

```sh
cd backend
go test -count=1 -race ./internal/placement ./services/ingress
go vet ./internal/placement ./services/ingress
go test ./internal/placement -run='^$' -fuzz=FuzzStrictPlacementJSON -fuzztime=3s -parallel=1
```

Recorded results: **119 passing test/subtest records, 106 leaf cases, zero failures**, across the two affected packages. The leaf count includes existing ingress regression cases and five fixed fuzz seeds. A separate three-second fuzz run exercised 8,032 inputs without failure. Go vet passed. These are local Go 1.23.2 observations, not an approved production toolchain, load test, database crash test or penetration test.

The existing handler, proof, events and observe dependencies used for this check were fetched at `38533a13540fe507416b025f3880bc72acb16485` and their Git blob hashes verified before testing. A full unrelated repository-wide regression, React build and browser test was not run in this session. The earlier full frontend import remains incomplete.

## Remaining acceptance / next integration boundary

PLT-004 stays Blocked until GOV-001 sign-off/named review and the real authoritative controller, durable checkpoint adapter, trusted key/config distribution, restart/restore tests, provider parser/proof fixtures and runtime wiring are verified. EVT-003 remains blocked on its original DAT-001 and PLT-004 prerequisites. No requirement, release gate or production health value is marked Done/green from these source tests.

Deployment, a new signed-wire profile rollout or any change to pipeline semantics requires the owner's applicable approval and the original security/release evidence. Main-only source publication is not that approval.
