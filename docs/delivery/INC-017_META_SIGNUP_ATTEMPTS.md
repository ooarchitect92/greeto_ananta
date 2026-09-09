# INC-017 — Meta adoption step 2: connection attempts and callback correlation

**Date:** 9 September 2026. **Repository:** `ooarchitect92/greeto_ananta`. **Target:** `main` only.
**Inspected base:** `ceb12503a624939eb82d17771b4539abaa7ec25d`.

## 1. Delivered boundary and source basis

This increment implements the server-side attempt orchestration domain and extends the existing Channel Center panel with its minimized progress view. It composes the unchanged INC-016 `prepareSignupConfiguration` function. It does not implement an HTTP controller, launch the Facebook SDK, exchange a code, activate an asset or deploy any infrastructure.

The owner's baseline section 11.2 / F02 requires a server-side attempt with state and nonce, followed by provider consent, callback validation, token exchange, grant verification and asset binding. Section 7.1 requires transactional control writes, history/outbox and optimistic versions. Section 28.1 requires authenticated object scope. These are implemented boundaries, not a newly invented onboarding order.

META-REF-001 child slices M03/M04 and original WHA-003/WHA-004 are the source associations; UX-005 owns the existing channel center. Original prerequisites remain WHA-003/WHA-004 <- PLT-008, EVT-003; UX-005 <- PLT-001. Parent acceptance is not promoted. Pure domain and disabled-UI work was explicitly permitted by the adoption plan while runtime prerequisites remain incomplete.

Provider reference: `fbsamples/business-messaging-sample-tech-provider-app` at `14703a3e1fdba9bcf75b2360b00817b6fcc9f79b`. Its `app/types/api.ts` SessionInfo fields (blob `c1d5fec131d047ce624268cea45b0b97115ef279`) inform the bounded asset-claim normalization. Its `Fbl4bLauncher.tsx` illustrates separate code/session arrival. We do not copy its module-global correlation variables, suffix origin test or direct side effects. Existing Meta MIT attribution remains in INC-016; no upstream application or dependency is installed.

## 2. Step-by-step implemented path

### A. Begin one attempt

1. Validate and snapshot the server-owned actor/session/scope/app/profile/cell/epoch context.
2. Require current object authorization through the mandatory authority adapter before storage access.
3. Invoke the existing configuration producer against the selected profile and server clock.
4. Generate an attempt UUID and independent 256-bit random state/nonce values using Node's cryptographic library. Store only their SHA-256 digests in the attempt row; compare them using `timingSafeEqual`.
5. Pin the app, selected profile payload digest, original scope/session/actor, ownership epoch and expiry. Expiry cannot exceed the supplied evidence expiry or explicit attempt lifetime.
6. Request an atomic insert of attempt, history and pending outbox fact. Verify the exact acknowledgement's attempt ID, version and full-record digest.
7. Only then return `StartedAttempt`. Normal JSON/inspection redacts the correlation secrets. The authorized host obtains them explicitly through `correlation()`; it must not put them in drafts, logs or general diagnostic DTOs.

An insert timeout can leave an abandoned row but returns no launch ticket. No provider consent or external side effect was started. Request-level HTTP idempotency, session-channel persistence and cleanup scheduling are still host responsibilities. This code does not manufacture a second attempt to hide an unknown insert result.

### B. Capture code and session fragments in either order

1. Accept a bounded **normalized internal** fragment with attempt ID, state, nonce, expected app ID and either a raw code or asset-session claims.
2. Reauthorize the authenticated context, reload the exact authoritative row and verify its complete immutable binding and record invariants.
3. Match state/nonce digests and expected app. Revalidate the selected profile; reject a changed config even when a caller reuses its revision number. Reject expiry, backwards clock, cancellation and conflicting fragments.
4. A code fragment is handed only to the required `CallbackVault.seal` port. Verify its custody receipt matches the exact attempt, binding, raw-code digest and expiry. Only an opaque reference and digest enter the attempt row. The implementation does not encrypt/store a code using a test fallback.
5. Session fields are bounded provider-ID strings. Asset arrays are canonicalized as sets; duplicate/numeric IDs and unsupported keys fail. These are **claims**, not verified ownership or provider grants.
6. Recheck authority and time after custody work. Atomically compare-and-set the expected row to the next version together with history and a pending outbox fact.
7. Verify the storage acknowledgement before returning a minimized `AttemptView`.

Internal states are `AWAITING_CALLBACK`, `CODE_RECEIVED`, `SESSION_RECEIVED`, `CALLBACK_CORRELATED`, `CANCELLED` and `EXPIRED`. A correlated callback is NOT token exchange, consent certification, READY, subscription success or a granted ability to send.

### C. Duplicate, concurrent and uncertain outcomes

An identical recorded fragment returns the existing version without resealing/reappending. Same attempt with a different code or asset intent is a conflict. Concurrent updates compare the entire prior record; a loser retries its **same fragment** after reading rather than overwriting the winner. This permits either callback order without combining two attempts.

Unknown database acknowledgements remain unavailable. Retrying the identical fragment can recover the committed state. A lost vault acknowledgement similarly cannot advance callback state; the vault's required attempt/digest idempotency permits a later custody lookup/retry. A ciphertext orphan from a failed state transaction is not a valid callback and must be cleaned under the custody policy.

Cancellation/expiry use the same conditional state boundary, retain the recorded facts and stop later callbacks. Expiry is checked on reads/presentation and writes; no asynchronous TTL deletion timing is assumed. This module never calls provider deregistration, token revocation or deletion as a cancellation side effect.

## 3. Actual files and public symbols

| File / symbol | Purpose, parameters and result |
|---|---|
| `backend/services/core/src/channels/meta/signup-attempt.ts` / `SignupAttempts` | Requires repository, current authority, callback vault, explicit policy, trusted clock and optional nonblocking stage observer. No startup network operation. |
| `begin(profile, context, signal)` | Server-owned profile/context; bounded cancellation signal. Returns a redacted launch result only after exact insert receipt. |
| `receive(profile, context, fragment, signal)` | Normalized fragment; validates and atomically records its custody/claims. Returns local durable progress, never a provider grant. |
| `inspect(context, attemptId, signal)` | Authorizes first, reads exact scope and emits a secret-free observation. No write or expiry deletion. |
| `close(context, attemptId, 'cancel'/'expire', signal)` | Conditional terminal transition. No provider operation; expiry before deadline conflicts. |
| `StartedAttempt.correlation()` | Explicit sensitive correlation snapshot for the approved host bridge. Not a bearer authorization grant. JSON and normal inspection omit these values. |
| `attemptDigest(validatedInternalData)` | Deterministic hash for the private record/receipt protocol. Call only on bounded validated internal records; not an untrusted arbitrary-JSON HTTP hashing service. |
| `front end/src/features/channels/meta/signup-attempt-model.mjs` / `inspectSignupAttempt` | Validates the minimized DTO, exact UUID scope and observation freshness; never enables launch/exchange. |
| `MetaSignupSetupPanel.jsx` | Adds optional `attempt` prop and step-2 details to the existing panel. Existing mount still passes none. Reuses current styles and cleans up its freshness timer. |
| `tools/check_meta_signup_attempts.py` | Strict compilation, readonly consumer check, backend/frontend tests and JSX syntax check. No installs, migration, SDK/network call or Git operation. |

## 4. Parameter contract

| Field | Owner and rule |
|---|---|
| tenantId / workspaceId / environmentId / actorId | Authenticated host; nonzero lowercase UUID strings. Payload fields are not authority. |
| sessionRef | Stable opaque authenticated-session reference, 1–128 allowed characters. Never the raw cookie, access token or email. |
| appRef / profileId / revision | Current server-selected configuration. The existing INC-016 registry checks remain unchanged. |
| cellId / epoch | Current authorized placement. Checked again at the transactional write boundary by the real repository implementation. |
| lifetimeMs | Explicit host policy, positive integer up to a 900,000-ms resource ceiling; no default provider lifetime is selected. |
| operationTimeoutMs | Explicit host policy, positive integer up to 30,000 ms. One budget covers all stages; abort propagates to adapters. |
| state / nonce | Independent cryptographic values, 64 lowercase hex characters. Neither is assumed to be echoed by Meta. |
| raw code | 1–8,192 UTF-8 bytes without whitespace/control characters; copied only into the required custody port. Not in status/history/outbox. |
| normalized session | businessId; nullable phoneNumberId; wabaIds/pageIds/adAccountIds/datasetIds/catalogIds/instagramAccountIds, each at most 32 unique decimal string IDs. |
| IDs from provider | Nonzero decimal strings up to 64 digits. They remain claims until the later grant/ownership step. |
| acknowledgement | Exact attempt ID, revision and full-record digest; true means the required local transaction completed, not Meta accepted a request. |
| frontend observation | Server projection only, at most 30 seconds old by advisory browser clock; expired active attempts are withheld. Terminal facts have the same freshness window. |

These are **private adapter contracts**, not a change to the proposed `/v1/channel-connections/authorizations` or `/callbacks` API. Public OpenAPI request/response mapping remains an explicit host-integration task; no undocumented public endpoint was added.

## 5. Mandatory runtime bindings; no synthetic fallback

`AttemptRepository` must implement scoped authoritative reads and a transaction for record/history/outbox. Insert is conditional on absence. Updates must compare version, full prior record, tenant/workspace/environment, actor/session and writer epoch, and enforce current DB-time expiry/fencing. Configure non-owner application roles/RLS and parameterized SQL under the existing control-plane owner. No migration is applied by this increment.

`AttemptAuthority` must check the real authenticated session, current permissions, selected configuration and placement. It must fail closed when these are revoked or uncertain, including rechecks after code custody work. The class cannot authenticate arbitrary in-process objects by their syntax.

`CallbackVault` must use the existing scoped credential/KMS boundary. Its acknowledged result must mean encrypted custody, not merely an in-process enqueue. It must preserve same-attempt/same-digest identity, reject changed codes, and maintain bounded expiry and orphan cleanup. No token may appear in a public response, index, exception or operational log. The test adapter records only synthetic digests/references; it is not cryptographic storage evidence.

The future browser/HTTP bridge MUST bind the actual SDK callback and `WA_EMBEDDED_SIGNUP` message to one launch, validate exact approved origin and supported window/source identity, enforce CSRF and server session checks, and map supported version-specific finish/cancel events. **This increment does not implement that bridge or claim that Meta echoes Greeto state/nonce.** Unknown provider details must not be guessed. The sample's stateful globals are not reused.

## 6. Diagnostics and retained pipeline

Each adapter call records a sanitized stage, generated per-operation correlation ID, succeeded/failed result and elapsed milliseconds. The public view carries that request ID. Detailed identifiers, raw errors, code, state/nonce, asset claims and vault references are excluded from these diagnostics. The observer must enqueue locally without blocking; an observer exception cannot alter a store outcome. The mandatory transactional event is distinct from best-effort telemetry.

The unchanged F02 sequence still proceeds from attempt creation to actual provider consent/callback validation, then server exchange/vault, granted assets, binding, subscription, phone operations, capability/billing/policy and authorized testing. Nothing runs exchange on `CALLBACK_CORRELATED` in this source increment. Its later worker must conditionally claim exchange, recheck permissions/expiry and preserve UNKNOWN for a possibly consumed code; generic retry cannot consume it twice.

F03 Kafka-before-ACK, F05/F10 governed action execution, F07 customer-webhook handling, F15 calling gates and all original release/security/recovery requirements are untouched. INC-010 remains unpublished. The INC-015 browser-fixture change request remains pending and no existing browser test/default is changed.

## 7. Verification and next step

Run `python tools/check_meta_signup_attempts.py` with existing Node, TypeScript and Node type declarations. `GREETO_NODE_TYPE_ROOT` can identify already-installed declarations; the runner never installs or changes a dependency. Local tools: Node 22.16.0 and TypeScript 5.8.3; the frontend's existing engine requirement is unchanged.

**93 named tests passed:** 65 backend/orchestration cases and 28 presentation/source checks. Both callback-order cases compose the actual compiled service output with the frontend model. Strict TypeScript and readonly consumer checks passed. One JSX file passed parsing only. Synthetic transactional/custody/authority adapters test races, uncertain receipts and rollback boundaries; they do not prove real PostgreSQL/KMS/Meta behavior. Existing configuration source is byte-identical to INC-016.

The full React production build, browser/accessibility tests, complete repository regression, production database/vault integration and independent security acceptance were not run. No parent is certified Done. The Excel records INC-016's published 82-test evidence as historical carry-forward separately from these new 93 tests.

Next implementation is the reviewed SDK/HTTP attempt bridge and actual scoped attempt-store/custody bindings, followed by an exchange-claim worker under the original gates. Do not enable the launch button just because these unit tests pass. Any required public contract, dependency, pipeline or deployment change needs its specific owner approval.

## 8. Dated primary engineering references

- Baseline: `/Greeto_Action_OS/architecture/Customer_Action_OS_Architecture_Source_v1.md`, sections 7.1, 11.2, 22.1 and 28.1.
- Pinned sample: https://github.com/fbsamples/business-messaging-sample-tech-provider-app/blob/14703a3e1fdba9bcf75b2360b00817b6fcc9f79b/app/types/api.ts
- OAuth security background, not an override of Meta's actual supported flow: https://www.rfc-editor.org/rfc/rfc9700.html
- Standard cryptographic-library API: https://nodejs.org/api/crypto.html
- Meta implementation reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/ — HTTP 429 when retried on 9 September 2026. Current wire-contract/eligibility qualification remains open.

No source reference, schema name, successful unit test or UI state constitutes Meta approval, a durable production deployment or a permission grant.
