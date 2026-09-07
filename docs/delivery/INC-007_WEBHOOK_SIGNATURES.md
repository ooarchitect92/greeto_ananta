# INC-007 — customer-webhook signing and receiver helpers

8 September 2026. Repository `ooarchitect92/greeto_ananta`, main only.
Base inspected: `b55342894253b58e5aeb443fb5d28a6ba7624828` (includes INC-006).

## Scope and authority

Implements the existing F07 section 16.2 signature formula, with real Go, Node and
Python standard-library HMAC operations. Source contribution to WHK-003, WHK-009
and DEV-006; UX-003 receives the same source-status projection in its existing
Implementation Center. This is not a provider callback verifier, new public API,
HTTP sender, durable receiver, endpoint provisioning flow or a complete SDK.

Original F01-F18 ordering, Action Gateway ownership, SQL migration, existing
OpenAPI paths, dependency versions, frontend layout and release gates are unchanged.
No process imports the new helpers into production in this increment. The Go code
belongs to the selected dispatcher data plane; the TypeScript/Node and Python
files are the baseline's first receiver-helper SDKs, not a replacement framework.

Original predecessor gates remain:
- WHK-003 and WHK-009: EVT-002, PLT-008.
- DEV-006: PLT-003, EVT-002.
- UX-003: PLT-001.
No parent work package is certified Done by these source tests.

## Actual files and callable parameters

| Owner / file | Public symbols | Inputs and output | Effects / failure boundary |
|---|---|---|---|
| `backend/services/webhook-dispatcher/signing/signature.go` | `Sign`, `Verify`, `KeyVersion`, `Policy`, `Proof` | Raw bytes, stable event/delivery IDs, route-owned key(s), trusted Unix-second clock, explicit bounds -> headers or authenticated delivery/body proof | Synchronous crypto only; neutral proof rejection; separate configuration error; no HTTP, storage or key lookup |
| `backend/sdk/typescript/webhook-signature.mjs` | `signWebhook`, `verifyWebhook`, `WebhookProofError`, `HEADER_NAMES` | Uint8Array body; original Node rawHeaders for verification; typed key/policy -> frozen result | Server-only Node crypto. No browser secret imports. Shared mutable byte buffers and collapsed headers rejected |
| `backend/sdk/typescript/webhook-signature.d.mts` | `KeyVersion`, `Policy`, `Proof`, function declarations | Strict consumer signatures and readonly metadata | Compile-time API, not a substitute for runtime validation |
| `backend/sdk/python/greeto_webhooks/signature.py` | `sign_webhook`, `verify_webhook`, `KeyVersion`, `Policy`, `Proof`, `WebhookProofError` | Immutable bytes and duplicate-preserving header pairs -> read-only headers or frozen proof | Python stdlib only; no package installation or network operations |
| `backend/contracts/fixtures/webhook-signature-v1.json` | Six public test vectors | Synthetic keys, raw-body hex and independent expected HMAC/digest | Test fixtures, NEVER production keys; empty, JSON, Unicode, binary, whitespace and maximum-ID cases |
| `tools/check_webhook_signing.py` | `main`, `run` | Installed Go/Node/TypeScript/Python -> local evidence | No install, Git push, API call or deployment. Stops on missing tools/failure |

### Exact wire contract retained

```text
X-Platform-Event-Id: <canonical event ID>
X-Platform-Delivery-Id: <stable delivery ID for retries>
X-Platform-Timestamp: <attempt creation Unix seconds>
X-Platform-Key-Id: <endpoint signing-key version>
X-Platform-Signature: v1=<lowercase hex HMAC-SHA256>

Signed bytes = timestamp + '.' + delivery_id + '.' + exact_raw_body
```

Serialize once; pass and send those same bytes. JSON whitespace, field ordering,
Unicode encodings and line endings are not normalized. A new retry uses its existing
durable delivery ID and a fresh timestamp. A governed replay creates its separate
replay delivery upstream; these helpers never generate a new action/delivery ID.

### Parameter bounds and rotation

The implementation profile accepts 1-128 ASCII token characters for event/delivery
IDs, including UUIDs and underscore example IDs. A delivery ID cannot include the
`.` framing delimiter: accepting it would make delivery/body concatenation ambiguous.
Key IDs allow ASCII letters/numbers, underscore, dash, dot and colon. No trimming or
numeric coercion is performed. Attempt timestamps are canonical decimal seconds.

Each host supplies `maxAgeSeconds` / `max_age_seconds` (1-86400), future skew
(0 through max age), and `maxBodyBytes` / `max_body_bytes` (1-1048576). These are
validation ceilings, NOT silently selected production defaults or retention terms.
The 300-second age and 30-second skew in tests are fixtures only. Actual endpoint
profiles still need qualification and documented receiver agreement.

One or two endpoint/environment-owned key versions are accepted. Secret material
is 32-4096 bytes; generation must use a qualified cryptographic source. The helpers
cannot measure entropy or prove keys are unique across different endpoints.
Duplicate key IDs or identical secrets within a rotation ring fail configuration.
Signing uses `[notBefore, signUntil)`; verification also requires receiver time in
`[notBefore, verifyUntil)`. A former key may verify a still-fresh old attempt during
its overlap, but cannot create new attempts after signUntil. Revocation always wins.

Keys are supplied only from trusted route-owned configuration. Header key IDs cannot
select arbitrary vault paths/URLs or another tenant's keys. No token, raw body,
secret or HTTP authorization header is logged. Memory zeroization and KMS lifecycle
are not claimed by a standard-library helper or garbage-collected SDK.

## Important security boundaries, including a source wording gap

The detailed F07 v1 formula signs the delivery ID, timestamp and body; it does NOT
independently sign `X-Platform-Event-Id` or `X-Platform-Key-Id`. WHK-003's workbook
acceptance mentions the stable event ID. Preserve the formula: the receiver must
validate the canonical event ID inside the authenticated body and compare it with
the header before treating it as authoritative. The returned Proof intentionally
omits the unsigned event header. A test deliberately changes that header and proves
it is not promoted into trusted output. This is NOT full WHK-003 event-schema
acceptance. A different wire formula requires an explicitly approved versioned
contract change; no such change has been made here.

Likewise, a valid HMAC is not replay protection or acknowledgement durability.
WHK-009 still requires a real processed-delivery ledger. The receiver must atomically
record `(authorized endpoint/environment, delivery ID, body digest)` with its durable
queue/effect. An identical retry must not repeat the effect; a changed body under an
existing delivery ID is a conflict. A temporary storage failure is not success.
These stateless helpers deliberately accept an authentic fresh retry, so they must
never be advertised as a complete exactly-once receiver or replay ledger.

The intended unchanged F07 integration remains:

```text
Authorized subscription -> durable delivery record -> fair queue
  -> selected current key + exact payload signing -> approved HTTPS egress
  -> endpoint verification + schema/event binding + durable receipt
  -> endpoint 2xx -> ACCEPTED_BY_ENDPOINT (not business success)
```

Ingress F03 Meta/Telegram signatures are separate and untouched. Do not apply this
receiver timestamp window to provider callbacks. No actual HTTPS request, receiver
2xx, Kafka ACK, database receipt or Action Gateway permit is created by this increment.

## Frontend status, not another disconnected screen

The existing ProductionReadinessPanel already renders `delivery.items` and
`delivery.controls`. Its shared cards/tables will show these new source contributions
and pending webhook-security gates from the synchronized status JSON. No new theme,
route, browser signing key, auto-enable switch or shell-execution button is introduced.
The full earlier frontend/media import and browser build remain incomplete.

## Local verification and reproduction

Run from the repository root with the installed toolchain:

```sh
python tools/check_webhook_signing.py
```

The runner writes `.local-build/webhook-signing/report.json` and individual logs.
Results: 60 Go leaf tests with race detector, 65 Node tests, and 56 Python tests:
**181 passed; 0 failures, skips or cancellations.** Go vet and strict TypeScript
consumer compilation also passed. Go, Node and Python all match the same six
independently generated expected signatures/digests. Cases cover malformed and
duplicate headers, body alteration, unsafe framing, time boundaries, revoked/expired
keys, bounded rotation, invalid config and the absence of replay-ledger authority.

Observed local tools: Go 1.23.2, Node 22.16.0, TypeScript 5.8.3, Python 3.13.5.
These are observations, not approval/pinning of a production bill of materials.
Python annotations and runtime validation are included; an independent Python
static type checker was not run. TypeScript checking covers the SDK declaration
consumer, not a new NestJS host or the entire JavaScript implementation.

Not run: full repository regression, React/browser/accessibility, KMS/key delivery,
real endpoint authorization, durable replay ledger, HTTP transport/proxy integration,
Kafka/database integration, SDK distribution, security review or production rollout.
Preserve all original release gates. Hash-matched GitHub publication is recorded
separately after a successful main ref readback.

## Engineering references, not architecture amendments

Requirement basis: uploaded Customer Action OS v1 sections 1.2, 16.2-16.4, 22.3,
28.1, 31 and 35.2; original tracker rows WHK-003, WHK-009, DEV-006, UX-003.
Official references checked for the crypto APIs on 8 September 2026:

- https://pkg.go.dev/crypto/hmac
- https://nodejs.org/download/release/v22.16.0/docs/api/crypto.html
- https://docs.python.org/3/library/hmac.html

Constant-time digest comparisons use hmac.Equal, timingSafeEqual and compare_digest.
That does not prove the surrounding HTTP system has no timing side channels.
