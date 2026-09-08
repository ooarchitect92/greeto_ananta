# INC-011 — authenticated F07 event-body identity

Date: 8 September 2026. Target: `ooarchitect92/greeto_ananta`, `main` only.
Inspected base: `3a38a192cac4926c403691f88977e2db9d6296bd`.

## Scope and baseline

This is an independent addition to the EXISTING `signing` implementation on main.
It does not depend on the unpublished INC-010 ledger. The renewed INC-010 test-file
upload was again blocked by the tool safety check; no alternate encoding, partial
commit or other route was used to upload that blocked content. INC-010 remains an
unpublished candidate and is not included in this source increment.

Baseline references: section 6.3 (canonical event_id), 16.2 (exact signed bytes and
endpoint-owned keys), 16.3 (receiver durability), 28.1 (object authorization), and
32.2 (bounded validation). Source contributions: WHK-003 and WHK-009. No parent task
is certified Done. The existing v1 MAC formula and five headers are unchanged.

The v1 MAC covers timestamp, delivery_id and raw body, but NOT the separate event-ID
header. The existing low-level `signing.Verify` deliberately does not attest that
header. This increment provides an opt-in Go receiver helper that validates the
canonical event_id INSIDE the signed JSON and compares the header to it. The
low-level verifier and every existing caller remain unchanged.

## Implemented path

1. Validate explicit parser budgets and raw-body/header bounds.
2. Copy only the five relevant, single-valued signature headers and the bounded body.
3. Invoke existing `signing.Verify` on that exact snapshot. On signature/key/time
   failure, no JSON parser is invoked.
4. Require valid UTF-8 and paired Unicode surrogate escapes, then tokenize ONE JSON
   object with Go's standard `encoding/json` decoder and `UseNumber`.
5. Enforce object/array depth, token and decoded-property-name limits. Reject duplicate
   decoded member names in every object, trailing values and case aliases for the
   top-level event_id. JSON escape spelling does not bypass duplicate detection.
6. Require a single top-level event_id string in the existing opaque ID format and
   exact equality with X-Platform-Event-Id.
7. Return an in-process Event that owns the exact authenticated bytes. Downstream
   schema checks must consume RawBody() rather than the original caller buffer.

Nothing writes a replay receipt, sends an HTTP acknowledgement, resolves a secret,
changes a signing key, sends a webhook, registers a route or activates production.
No processing step enters the F03 provider callback path. This package is not a
Meta/Telegram signature verifier.

## Actual functions and parameters

| Owning file / symbol | Inputs and return | Ownership, effects and failure behavior |
|---|---|---|
| `backend/services/webhook-dispatcher/receiving/event.go` / `VerifyEvent` | `body []byte`, duplicate-preserving `http.Header`, endpoint-owned `[]signing.KeyVersion`, trusted Unix `now`, existing `signing.Policy`, explicit `Limits`; returns `Event,error` | No I/O. Uses copied body/header snapshot; does not retain keys. Signature failure returns existing neutral signing errors; parser failure returns ErrEnvelope; invalid budgets return ErrLimits. |
| Same / `Limits` | MaxDepth 1–64; MaxTokens 4–65,536; MaxKeyBytes 8–4,096 | Explicit host-approved resource profile, no runtime defaults; raw body remains bounded by the existing signing policy (at most 1 MiB). |
| Same / `Event.Valid`, `Event.EventID`, `Event.Proof` | No inputs; local success flag, authenticated body ID, copied low-level metadata | No database/authorization result is implied. A zero Event is invalid; private fields prevent deserialization from creating a verified object. |
| Same / `Event.RawBody` | No inputs; new byte slice | Defensive copy of the verified bytes; no reserialization or numeric conversion. Sensitive data must not be logged. |
| Same / `Event.String`, `Event.GoString` | Normal fmt formatting | Redacted constant description, excluding body, event/delivery IDs, keys and headers. Explicit RawBody access remains sensitive. |
| `receiving/json.go` / private parser helpers | Verified bounded raw bytes and Limits | Standard JSON grammar; duplicate/depth/token/Unicode safety checks; other domain fields are NOT schema validated. |
| `tools/check_webhook_receiving.py` | No arguments; existing Go executable | Bounded compile/test/race/vet/format run, source hashes and local report. No installs, Git writes, infrastructure or runtime registration. |

Root object depth is 1. Token count includes delimiters, member names and values;
`{"event_id":"evt-001"}` needs four tokens. Arrays count toward nesting depth.
MaxKeyBytes counts decoded UTF-8 bytes rather than JSON escape-text length.
Input buffers/maps and shared key bytes must not be mutated concurrently DURING
entry. Subsequent caller mutation cannot change Event's stored bytes or identity.

## Receiver integration boundary

The caller still has to validate the complete event schema, event-type subscription,
permitted tenant/workspace/environment and object/purpose BEFORE performing an effect.
A correctly signed payload is not proof that a user may access every tenant named
inside it. This helper does not interpret tenant fields as authority and does not
validate the source/version/data semantics of arbitrary events.

A receiver that needs durable acceptance must atomically persist its endpoint-scoped
delivery receipt and required local work before responding 2xx, then process
idempotently. Same delivery/different body is a conflict. A retry gets a fresh signed
timestamp but keeps its delivery identity. The repeated-delivery test deliberately
passes verification twice: stateless authentication is NOT durable replay prevention.

Event is not a serialized bearer token and does not renew authorization or key
freshness after verification. Do not persist it as a reusable permission grant.
The Node/TypeScript and Python low-level SDKs are unchanged; equivalent body-binding
helpers for those SDKs and their interoperability tests remain follow-up work.

## Frontend and publication

The existing ProductionReadinessPanel renders source evidence from delivery.items
and delivery.controls. The publication follow-up adds this Go receiver contribution
there and keeps runtime readiness explicitly unconnected. No new panel, style,
arbitrary URL/key form, replay button or framework is introduced.

The complete earlier frontend/media import and full React/browser/accessibility
acceptance remain incomplete. Updating a status projection is not an assembled or
deployed UI. Source hashes/ref readback are recorded separately after a successful
publication; a local report alone does not establish publication.

## Local evidence

Run `python tools/check_webhook_receiving.py` from the repository root.
66 named Go leaf tests passed with the race detector; four fuzz seed cases are
reported separately and are not added to the named count. Go vet and gofmt passed.
New receiving-package statement coverage is 98.3% in this scoped run.

Tests use the real unchanged signing implementation (verified Git blob
`eb1e5fd24a014b8a49ce7b2118832fc110383f07`) with synthetic fixed keys. They cover
header-only tampering, duplicate/escaped/case-aliased fields, nested input, Unicode,
large unrelated numbers, truncation, exact parser budgets, key/time rejection,
rotation overlap, defensive copying, redacted formatting and concurrent reads.
No customer endpoint, cloud database, KMS, replay ledger or runtime host is contacted.
The full repository regression suite, production toolchain qualification and
independent security review were NOT completed by these tests.

The pending INC-010 candidate's original 79 tests were separately rerun before its
publication attempt. They are not part of this increment's 66-test count and do not
make that candidate published.

## Engineering references (not architecture amendments)

- Go standard library JSON token and number APIs: https://pkg.go.dev/encoding/json
- JSON interoperability/duplicate-member and Unicode considerations: https://www.rfc-editor.org/rfc/rfc8259

These references were checked on 8 September 2026. The observed local toolchain was
Go 1.23.2, not a newly selected production image. No dependency version, migration,
public API, F01–F18 execution order, workload permission or release gate changed.
The receiver wrapper is additive and opt-in; existing deployed routes are untouched.
