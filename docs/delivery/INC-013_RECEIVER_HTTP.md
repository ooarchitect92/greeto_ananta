# INC-013 — F07 receiver HTTP acknowledgement boundary

Date: 8 September 2026. Repository: `ooarchitect92/greeto_ananta`; `main` only.
Inspected base: `882c0a926be3a0d0a80b81293703c40766f07825`.

## Requirement and scope

The architecture's sections 1.2, 9, 16.2–16.3 and 32.2 require authenticated scoped
inputs, separate acknowledgement levels, durable receiver acceptance before 2xx,
bounded work and graceful shutdown. This increment implements the HTTP adapter
around the already-published Go `receiving.VerifyEvent` helper. It is an opt-in
customer-owned receiver/sandbox adapter, not a new public platform API or a change
to the provider callback path. Contributions: WHK-009; QAT-004 crash-window checks.
Neither work package gains completed parent acceptance from this code alone.

All existing Go/TypeScript/Python signing and event-verification implementations
remain unchanged. INC-010's blocked sender-ledger candidate is not retried or
included. This receiver's Inbox is a DIFFERENT, customer-side storage boundary;
it does not implement or substitute for the sender's WebhookDelivery store.

## Execution and acknowledgement

```text
Bounded admission and original socket/request deadline
  -> Registered endpoint context and current keys
  -> Bounded exact body read
  -> Existing signature and signed-body event identity verification
  -> Required complete-schema/subscription/object-authorization Gate
  -> One atomic Inbox.Accept call
  -> Validate exact returned acceptance identity and durable receipt state
  -> Offer HTTP 204 to net/http
```

An HTTP 204 is offered only when the Inbox binding acknowledges the required local
transaction or returns a strongly read matching earlier receipt. It does not mean
business processing completed. No side effect, queue publication or database write
is performed by a fake fallback. All three host ports are required explicitly.
The HTTP writer is never passed to these ports; they cannot acknowledge early.

A pending commit produces no success response. A failed, uncertain, panicked or
mismatched commit does not produce a success receipt. Retrying the same delivery
and exact body can recover a previously committed receipt. The Inbox contract
requires same-delivery/different-event-or-body conflicts and atomic receipt plus
required local work. This implementation DOES NOT supply a durable Inbox database.
The test-only map models that boundary; it is not production persistence.

If a matching commit acknowledgement is returned after cancellation, that known
local acceptance is retained. The ORIGINAL response deadline is not extended;
the client may receive EOF instead of 204 and must retry the same delivery. The
report therefore distinguishes durable acceptance from the HTTP status offered
to net/http. A written header is not proof the client received it.

## Files and typed public parameters

| Owning file / function | Inputs and returned value | Validation, authority, side effects and failures |
|---|---|---|
| `backend/services/webhook-dispatcher/receiverhttp/types.go` | `Scope`, `Identity`, `Receipt`, `Config`, `Report` | Host-owned endpoint scope, immutable verified identity and minimized stage evidence. No caller-supplied tenant authority. |
| `handler.go` / `New(keys, gate, inbox, config)` | Three explicit ports and typed Config -> Handler/error | Rejects nil/typed-nil ports and invalid profiles; no I/O, provisioning or registration. |
| `Keys.Resolve(ctx, scope)` | Bounded context + registered scope -> current immutable signing keys/error | Binding must authorize active endpoint and secret namespace; never resolve keys from incoming headers. No permissive runtime binding is supplied. |
| `Gate.Check(ctx, scope, event)` | Registered scope + authenticated byte snapshot -> error | Binding validates full schema, subscription, tenant/environment/object/purpose and current permissions. HMAC validation does not replace this gate. |
| `Inbox.Accept(ctx, identity, event)` | Exact scope/event/delivery/body digest + protected bytes -> Receipt/error | Binding must commit receipt and local work atomically, enforce current grants/erasure controls, and deduplicate before returning. Unknown write outcomes remain errors. |
| `Handler.ServeHTTP(writer, request)` | Go request/response adapters -> one final HTTP response | POST JSON only; bounded reads, signature/gate/inbox order, sanitized failure mapping. No detached processing, hidden store retry or external action. |
| `Handler.Drain(ctx)` | Explicit bounded shutdown context -> error | Permanently closes admission, waits through final response handling, and does not cancel admitted commits. Timeout does not reopen admission. Safe repeated/concurrent calls. |
| `Handler.DroppedReports()` | No parameters -> uint64 | Diagnostic loss only, not delivery loss or health. |
| `tools/check_receiver_http.py` | Existing Go toolchain -> local JSON/text evidence | Bounded local tests/race/vet/format/coverage and source hashes. No install, Git write, SDK publication or deployment. |

### Host-controlled configuration

| Parameter | Allowed values / meaning |
|---|---|
| Scope | Nonzero UUID tenant, workspace, environment and endpoint IDs from authenticated registration. Never use URL/query/payload scope. |
| Signing | Existing signing.Policy: age 1–86,400 seconds; future skew 0–age; raw body 1–1,048,576 bytes. No signing-rule change. |
| Parser | Existing receiving.Limits: depth 1–64; tokens 4–65,536; decoded key bytes 8–4,096. |
| Timeout | Explicit 100 milliseconds–30 seconds. Earlier parent deadlines always win. Includes key lookup, body, verification, gate and inbox. |
| MaxConcurrent | Explicit 1–256. Refuse immediately when full; no unbounded admission queue. |
| MaxHeaderBytes | Explicit 1,024–65,536 parsed-header budget, plus bounded header/value counts. Server/edge pre-parse limits are still required. |
| Clock | Trusted host wall-clock callback for signature freshness. Not a request timestamp, receiver Date header or deadline override. |
| RequestID | Nonblocking local callback reading an opaque middleware-generated correlation ID from context. Validate 1–128 allowlisted characters; no arbitrary caller header. |
| Reports | Optional best-effort channel of minimized Report values. Full/closed channels drop reports without delaying or invalidating acceptance. Host owns channel lifetime and alerting. |

These are defensive ceilings, not production throughput settings. Aggregate body
memory depends on the concurrency/body profile and verification copies. There is
no load or capacity certification. Adapter bindings must be synchronous,
cancellation-aware and concurrency-safe. An interface cannot forcibly terminate
a broken implementation that ignores context; no such binding is approved here.

## Receiver HTTP profile (not the platform REST API)

| Status | Meaning in this opt-in adapter |
|---|---|
| 204 | Exact receiver acceptance receipt acknowledged, or same acceptance recovered. Empty response body. No business-completion claim. |
| 400 | Body read incomplete; no accepted partial event. A deadline may instead close the connection. |
| 401 | Missing/malformed/invalid signature proof. Neutral payload-free reason. |
| 403 | Endpoint or object/purpose access denied by a required host binding. |
| 405 | Method is not POST; Allow: POST. |
| 409 | Inbox reports conflicting use of the same scoped delivery identity. |
| 413 | Declared or actual body exceeds the configured limit. |
| 415 | Unsupported JSON/content-encoding profile, duplicate media-type headers or trailers. No decompressor is invoked. |
| 422 | Invalid event envelope, or unsupported schema reported by Gate. |
| 431 | Parsed headers exceed the bounded profile. |
| 503 | Not admitted/draining, missing deadline support/correlation, unavailable keys/gate/inbox, uncertain commit, mismatch or host-port panic. |

Error responses contain only a fixed code, Cache-Control: no-store and nosniff.
They never include raw bytes, parse locations, receipt IDs, keys or upstream error
text. No retry policy is inferred from a 503. The sender retains its own F07 policy
and stable delivery identity. The adapter does not follow redirects or make sends.

The host must preserve duplicate security headers and original body bytes. Only
application/json (optionally charset=UTF-8), no compression or identity encoding,
and no trailers are accepted by this profile. Chunked transport is dechunked by
Go's HTTP server and tested. The wrapper does not alter the existing low-level
signature functions or their accepted byte format.

## Deadlines, draining and diagnostics

ResponseController sets the original read/write deadline before calling host
ports. Unsupported middleware fails closed; it must expose the original writer
through Unwrap or equivalent supported deadline methods. The server still owns
TLS/hostname/path routing, ReadHeaderTimeout, IdleTimeout, maximum headers and
connection limits. No listener is registered or deployed by this package.

Admission remains held until the final response path finishes. Drain stops future
admission but lets existing bounded calls settle. The enclosing server must also
run its approved Shutdown sequence. HTTP/1.1 was exercised with real local TLS and
plain TCP slow-body input. HTTP/2, edge/WAF integration and production server
configuration are not qualified by this increment.

Reports include middleware request correlation, stage start time, elapsed
milliseconds, fixed result/code, offered status and a separate durable-acceptance
flag. They exclude payloads, credential/header values, customer IDs and object
URLs. Metadata remains on the same request context through every host port. A
full diagnostic channel never becomes a new durability dependency. Map this
private report to the existing telemetry collector under the host's approved
correlation and cardinality rules; no fleet metrics or durable audit are installed.

## Local verification and evidence limits

85 named tests passed with Go's race detector, no failures/skips; Go vet and gofmt
passed. New receiverhttp package statement coverage: 95.7%. Five of those tests
exercise actual local HTTP/TLS: no early ACK during a held commit, lost ACK retry,
concurrent duplicates, chunked/identity bytes and a stalled partial request. They
are INCLUDED in the 85, not additional tests. Additional checks cover exact receipt
scope/hash matching, signature errors, authorization failures, nil bindings,
cooperative cancellation/timeouts, bounded admission, drain timing and log drops.

The cryptographic/Event dependencies were copied from and hash-matched to main:
`backend/go.mod`, `signing/signature.go`, `receiving/event.go`, `receiving/json.go`.
No edits to those files are part of the increment. All host storage/authority/key
bindings in the tests are explicitly synthetic. Their local atomicity model does
not prove actual database transactions, IAM, vault freshness or disk persistence.
Full repository regression, full frontend/media build, browser/accessibility,
production runtime, independent security review, backup/recovery and deployment
remain open. Go 1.23.2 is the observed local tool, not a new production version.

## Frontend, pipeline and publication

The existing Implementation Center's data-driven delivery/control tables receive
source evidence via the synchronized status JSON in the publication follow-up.
No navigation, design component, browser secret, replay button or readiness flag
is changed. A source update is not proof the complete frontend is built or deployed.
Original work-package IDs, statuses, prerequisites and independent gates remain.
No existing F01–F18 order, schema migration, public REST contract, dependency,
framework, runtime route, infrastructure or release policy is changed. Source
publication is verified separately from local tests; INC-010 remains unpublished.

Engineering reference checked 8 September 2026: https://pkg.go.dev/net/http
(MaxBytesReader, ResponseController deadlines, server-owned header/idle limits).
It supports standard-library API usage only, not a baseline amendment.
