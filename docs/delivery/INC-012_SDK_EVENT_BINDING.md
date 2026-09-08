# INC-012 — TypeScript and Python webhook event-body binding

Date: 8 September 2026. Repository: `ooarchitect92/greeto_ananta`; branch: `main`.
Inspected base: `750da6f5595bae03dde8d63bd2084d51501c9b92`.

## Scope, ownership and preserved pipeline

This completes the language-specific body-identity helper missing after INC-011.
The existing Go `receiving.VerifyEvent` and all three low-level signature helpers
remain unchanged. The addition is opt-in, server-side SDK code; no route, worker,
endpoint, secret, database, infrastructure or package publication is registered.
INC-010 remains an unpublished candidate. Its blocked upload is not retried,
re-encoded, split, substituted or included in this independent increment.

Source requirements: Customer Action OS v1 sections 6.2–6.3 (opaque IDs and event
envelope), 16.2–16.3 (F07 exact-byte proof and separate receiver durability), 22.3
(TypeScript/Python SDKs), 28.1 (scope/secret boundaries), and 32.2 (bounded and typed
validation). Contributions: WHK-003, WHK-009, DEV-006. Original prerequisites and
independent parent acceptance remain open. No F01–F18 ordering, public REST API,
existing signing formula, dependency version, schema migration or release gate changes.

## Implemented processing

1. Validate host-owned parser budgets, raw-body bounds and duplicate-preserving headers.
2. Capture the exact raw bytes and the five existing F07 signature headers.
3. Invoke the existing language's signature verifier with route-owned keys and clock.
4. Only after valid authentication, require UTF-8 and one bounded JSON object.
5. Check decoded duplicate property names at every nesting level, valid Unicode,
   depth, token count and UTF-8 property-name length. Reject trailing JSON and root
   event_id case aliases. JSON escape spellings cannot hide duplicate properties.
6. Match the top-level string event_id inside the signed body to the separate header.
7. Return that identity, delivery/body proof and the exact protected body snapshot.

The unchanged MAC is timestamp + '.' + delivery_id + '.' + exact_raw_body.
The separate event-ID header is not independently authenticated by this MAC.
The wrapper binds it to the authenticated body instead of changing the protocol.
Unrelated JSON numbers are scanned as lexemes, never converted to floats/integers;
large IDs/numbers cannot be silently rounded by these helpers. Unknown domain
fields are structurally inspected, not semantically validated or exposed as a parsed tree.

## Actual files and functions

| File | Boundary | Inputs, return and behavior |
|---|---|---|
| `backend/sdk/typescript/webhook-event.mjs` | `verifyWebhookEvent` | Uint8Array raw bytes, Node rawHeaders, existing KeyVersion[], trusted Unix seconds, existing Policy, EventLimits → immutable local result. Signature verification precedes JSON inspection; no I/O. |
| Same | result `.eventId`, `.proof`, `.rawBody()` | Verified body identity and frozen proof; rawBody returns a fresh byte copy. No signing key/header retained. Normal inspection and JSON serialization redact the body/IDs. |
| `backend/sdk/typescript/webhook-event.d.mts` | `EventLimits`, result declarations | Read-only metadata and required limits; constructor is not part of the public API. Byte input and duplicate-preserving header types are explicit. |
| `backend/sdk/python/greeto_webhooks/event.py` | `verify_webhook_event` | Immutable bytes, header-pair sequence, existing KeyVersion sequence, trusted Unix seconds, existing Policy, EventLimits → frozen VerifiedEvent. Mutable buffers/collapsed dictionaries are rejected. |
| Same | `VerifiedEvent.event_id`, `.proof`, `.raw_body()` | Immutable result/bytes with redacted normal repr/str. Python reflection/object construction is NOT a security boundary; never accept a result object from an untrusted caller as authority. |
| Same | `EventLimits` | Frozen typed host budget; booleans do not pass integer validation. No default production profile is chosen. |
| `backend/testdata/webhook-event-v1.json` | Shared synthetic corpus | 74 valid/invalid exact-byte inputs, independent HMAC values and expected neutral results. Fixed test material is not production key data. |
| `receiving/sdk_conformance_test.go` | `TestSDKConformance` | Feeds those same vectors to unchanged Go receiving/signing; compares event identity and exact-body SHA-256 as well as acceptance. |
| `tools/check_webhook_sdk_events.py` | `main()` | Runs bounded local Go/Node/Python/TypeScript checks, compares all three report sets and writes failure-first evidence. No install, network, Git write or deployment. |

### Parser parameters

| TypeScript | Python | Allowed values / meaning |
|---|---|---|
| maxDepth | max_depth | Integer 1–64; root object is depth 1. Objects and arrays both count. |
| maxTokens | max_tokens | Integer 4–65,536; keys, values and container opening/closing delimiters count. Commas/colons do not. |
| maxKeyBytes | max_key_bytes | Integer 8–4,096; decoded UTF-8 bytes per property, not JSON escape-text length. |

Raw-body size and timestamp/key intervals remain controlled by the existing Policy.
The raw body ceiling is at most 1 MiB; selected security-header values are at most
256 UTF-8 bytes. SDKs retain their existing bounded raw-header input representation.
Go's map representation and Node/Python's pair representation are not identical
HTTP parsers; conformance covers the common F07 proof/body profile, not every
possible HTTP-stack normalization. The host must preserve duplicate headers.

Error codes are WEBHOOK_EVENT_LIMITS_INVALID and WEBHOOK_EVENT_ENVELOPE_INVALID,
plus the unchanged WEBHOOK_SIGNING_CONFIG_INVALID and WEBHOOK_PROOF_INVALID.
No error includes raw body, a parser location, key bytes or headers. Hosts must not
attach those inputs to log messages or exception metadata. Explicit raw-body access
and Python reflection/serialization can expose content; redacted repr is not DLP.

## Integration boundary

Use the helpers on a server before consuming any parsed event ID. For Node, pass
IncomingMessage.rawHeaders, not the duplicate-collapsing headers object. For Python,
pass the framework's duplicate-preserving header pairs and original bytes.

The result is an in-process convenience, not a serialized bearer token, ongoing
authorization grant or durable receipt. The complete event schema, allowed event
subscription, tenant/workspace/environment/object/purpose and current permissions
must still be validated. Do not reuse an old proof to renew an expired permission.

The receiver must atomically record its scoped delivery receipt and required local
work before 2xx when it promises durable acceptance. Both wrappers deliberately
allow the same valid delivery twice; repeated authentication is NOT durable replay
suppression. Same delivery/different body must conflict in that separate ledger.
No receiver store, HTTP host, AWS binding or retry worker is implemented here.

## Verification and reproducibility

Run from any directory:

```sh
python tools/check_webhook_sdk_events.py
```

Observed tools: Go 1.23.2, Node 22.16.0, Python 3.13.5 and TypeScript 5.8.3.
These are local tools, not newly approved production versions or deployment images.

74 shared vectors pass in each of Go, Node and Python: 222 executions of 74 common
contract cases. Twelve additional Node and twelve Python tests cover each runtime's
immutability, input types, errors, header handling, rotation and logging boundaries.
Total: 246 test executions, zero failures. All 74 output records are identical
across the three languages (result code, event ID and body digest), not merely an
identical number of passing tests. Go race/vet/format and strict TypeScript consumer
contract checks pass. Python unit tests execute typed source; a separate Python
static type checker was not run. Fuzzing/coverage claims are not made for this increment.

The shared corpus includes header tampering, duplicate/escaped/case-alias keys,
trailing values, invalid Unicode/UTF-8/BOM, unusual JSON numbers, parser boundaries,
timestamp boundaries, malformed signatures, duplicate security headers and key IDs.
All keys/data are synthetic; no customer endpoint or cloud service is contacted.
The runner selects TestSDKConformance; it is not a full repository regression.

## Frontend, tracker and remaining acceptance

The existing data-driven Implementation Center uses synchronized delivery-status
JSON to show this SDK contribution. No frontend component, style, navigation,
browser signing key or disabled execution control changes. Source evidence is
not a runtime measurement. Full earlier frontend/media import and React/browser/
accessibility acceptance remain incomplete.

WHK-003, WHK-009 and DEV-006 retain their original parent status and prerequisites.
Remaining: full schema/subscription/object authorization, receiver replay storage,
HTTP integration, live key lifecycle, complete generated API SDKs, package release,
independent review and rollout evidence. INC-010 remains separately unpublished.

## Engineering references (checked 8 September 2026)

The architecture is the requirement authority. These primary library documents
support API use only and do not amend the signing format or implementation order:

- Node TextDecoder fatal UTF-8 and BOM behavior: https://nodejs.org/api/util.html
- Python JSONDecoder and exact numeric/duplicate considerations: https://docs.python.org/3/library/json.html

Native string decoders are used inside bounded structural readers to detect
ambiguity before producing a result. Neither helper evaluates code or imports a
new parser/cryptography dependency. Production qualification remains a release gate.
