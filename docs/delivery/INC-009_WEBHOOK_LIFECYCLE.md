# INC-009 — F07 retry decisions and outcome receipt recording

8 September 2026. Repository: `ooarchitect92/greeto_ananta`, `main` only.
Inspected base: `70749d9a62417348d7fd3840ecef8d6c20aafcec`.

## Requirement and scope

The registered Customer Action OS v1 baseline §16.1–16.3 requires durable delivery state before HTTPS, stable delivery identity across retries, bounded retries, receiver Retry-After, explicit endpoint acceptance, and retained attempt evidence. §1.2, §9 and §14.3 preserve UNKNOWN outcomes and distinguish remote acceptance from database acknowledgement and business completion. §7.2 and §31.4 assign WebhookDelivery to the cell-scoped high-volume store. §32.2 requires bounded and cancellable operations. §35 keeps independent acceptance separate from source publication.

This increment contributes to WHK-004, WHK-005 and UX-003. WHK-004/005 retain predecessors EVT-002 and PLT-008; UX-003 retains PLT-001. They remain Blocked at parent acceptance. No source work package is certified Done.

Implemented: a deterministic Go retry/outcome planner, result-recording orchestration through a durable-store port, tests, and an existing-design frontend panel. **A production WebhookDelivery ledger adapter, HTTP worker, due-index scheduler and result API are not implemented or registered by this increment.** The test ledger is synthetic and exists only in `_test.go`. There is no runtime fallback to it.

Existing signing bytes/headers, egress policy, F01–F18 order, SQL migration, public OpenAPI, dependency files and release gates are unchanged. No default retry profile, listener, job, destination, credentials, deployment or infrastructure is installed. This fills the existing post-HTTPS F07 boundary; nothing is inserted into the F03 acknowledgement path.

## Implemented boundaries

1. An authenticated workload supplies the exact existing scope, endpoint, event, delivery, attempt and ownership epoch. The attempt must already exist durably.
2. `Recorder.Record` requires a bounded context and calls the result-recording authorizer before any store read. This is not dispatch permission.
3. The store returns the immutable original attempt and any previously committed outcome from an authoritative, strongly consistent read.
4. `Planner.Plan` checks identity, version, policy version, attempt sequence, trusted times, outcome/status agreement and allowlisted failure codes.
5. A valid 2xx maps to ACCEPTED_BY_ENDPOINT even after response-body failure or deadline/attempt exhaustion. An ambiguous send maps to UNKNOWN without a retry time, even after the automatic retry horizon.
6. Only explicitly configured transient HTTP or pre-send failures can produce RETRY_WAIT. Jitter is positive and reproducible. Retry-After can extend but never shorten the minimum wait. A due time at or beyond the delivery cutoff produces a terminal delivery decision, never an earlier retry that ignores the receiver.
7. The recorder binds the minimized observation to an SHA-256 identity and requests an atomic compare-and-set outcome commit through its ledger port.
8. It returns only an exact matching acknowledged receipt. A lost store acknowledgement yields a sanitized unavailable error. Repeating result recording with the same observation retrieves the original receipt without another write or HTTP request. Changed observations conflict instead of overwriting history.

The recorder deliberately has no sender method. Retrying storage and retrying HTTP are different operations. A conditional conflict does not start a new send. Later reconciliation or explicit replay needs its own authorized path, not mutation of a recorded receipt.

## State semantics

| Input | Decision | Automatic retry |
|---|---|---|
| Valid 2xx, including later response-body errors | ACCEPTED_BY_ENDPOINT | Never |
| Request may have been sent; no conclusive response | UNKNOWN | Never in this implementation; retain for reconciliation |
| 3xx | PAUSED, destination revalidation required | Never follows a redirect |
| 401 / 403 | PAUSED, authentication attention required | No blind authentication retries |
| 410 | FAILED_DELIVERY, destination removed | Never |
| Explicitly allowlisted transient HTTP failure | RETRY_WAIT within budget/deadline | Scheduler must reauthorize at execution |
| Explicitly allowlisted pre-send busy/DNS/connect failure | RETRY_WAIT within budget/deadline | No HTTP was observed to start |
| Other pre-send denial/configuration/security failure | BLOCKED | Never |
| Other non-2xx response | FAILED_DELIVERY | Not automatically retried |

PAUSED is a delivery decision, not a direct write to another module's endpoint configuration. Endpoint-wide authentication counters, disable/reenable behavior, operator approval and notification remain integration work. The chosen first handling is conservative: pause the failed authentication delivery, rather than retry a bad credential repeatedly.

## Actual symbols and parameters

| File / symbol | Inputs | Return / side-effect contract |
|---|---|---|
| `backend/services/webhook-dispatcher/lifecycle/planner.go`: `New` | Explicit versioned Policy | Copied immutable planner, or configuration error; no I/O |
| Same: `Planner.Plan` | Durable Attempt + trusted minimized Observation | Decision, or stable validation error; no writes, sleeps, clock reads or sends |
| `lifecycle/recorder.go`: `NewRecorder` | Ledger, Authority and configured Planner | Recorder, or configuration error; no registration |
| Same: `Recorder.Record` | Bounded authenticated context, exact Key, Observation | Exact acknowledged Receipt or sanitized error; reads/conditional writes only through the port |
| Same: `Ledger.Read` / `Ledger.Commit` | Scoped key / original Attempt and desired Receipt | Strong read / atomic conditional commit required of the future real adapter |
| Same: `Authority.RequireRecord` | Authenticated workload context + scoped Key | Permit to record the existing outcome, not a new external action |
| `front end/src/features/implementation/delivery-lifecycle-view.mjs`: `deliveryLifecycleView` | Authorized expectedScope, private read-model observation, now | Immutable display model; suppresses malformed, cross-scope, stale and uncommitted data |
| `WebhookDeliveryPanel.jsx` | Optional expectedScope and observation | Existing design components; one cleaned-up freshness timer, no network or replay |
| `tools/check_webhook_lifecycle.py` | Existing Go, Node and TypeScript tools | Local JSON/log/coverage report; no installs or Git writes |

### Host-owned Policy

`Version` is an opaque immutable profile reference. `MaxAttempts` is 1–64. `MaxAge` is 1 second–7 days. `RetryDelays` has exactly MaxAttempts minus one entries, each 1 millisecond–24 hours. These ceilings bound code, not customer plan entitlements or approved production tuning.

Each delay means minimum wait **after observing the corresponding failed attempt**. No interpretation of the baseline's proposed schedule is silently deployed. A host must explicitly supply and approve its concrete profile before connecting a scheduler.

`MaxJitterPermille` is 0–1000. `Attempt.JitterSample` is 0–1,000,000 and is persisted once with that attempt. The planner scales this sample into a positive jitter allowance; result-recording retries must not choose a new sample. Random-number generation and policy publication remain host responsibilities.

`RetryStatusCodes` permits an explicit subset of 408, 425, 429 and 500–599. It cannot enable redirects, authentication failures or permanent destination removal. `BeforeSendCodes` permits only an explicit subset of EGRESS_BUSY, DNS_UNAVAILABLE and CONNECT_FAILED. No profile exists by default.

`Attempt` includes original timestamps, policy version, sequence and pre-outcome aggregate version. Ownership epochs and versions remain exact unsigned values in Go; future JSON/DB bindings must preserve their precision. `Observation.ObservedAt` is the trusted time the transport result was captured, not the receiver's Date header. No raw response text is accepted as an error code.

## Ledger and host integration requirements

The selected DynamoDB WebhookDelivery adapter must atomically compare scope, endpoint/delivery/attempt identity, ownership epoch and expected aggregate version; write the immutable outcome receipt, current state, due-index changes and required local effect/outbox evidence; and return only after the defined database acknowledgement. GSI absence is not authority to recreate a delivery. Commit uncertainty must remain visible. No production table layout or migration is introduced here.

The Read snapshot contains the **original immutable attempt**, not an invented fresh version. Existing outcomes are write-once. The retention owner must keep UNKNOWN and unresolved accepted work until reconciliation or a separately authorized terminal decision; automatic retry limits do not justify deleting that evidence.

The host maps the existing egress Result to Observation. It must retain observed 2xx even when Send also returned a body error. Validate any returned AttemptID against the original durable attempt. Early pre-send errors may have no transport AttemptID; the trusted host must bind those to its original invocation, never a client claim. Do not expose Recorder directly to customer-supplied result JSON.

Result-recording authority is separate from permission to dispatch. A production policy must allow authorized evidence capture/recovery for in-flight historical attempts without granting new sends after revocation. The owning storage adapter still checks the current fencing/epoch rules; old workers cannot overwrite new ownership.

All adapters must honor context cancellation and deadlines and settle only when their operation is complete/failed. The recorder accepts a host deadline no greater than 30 seconds. It does not race a still-running store operation or invent cancellation guarantees. After a matching commit acknowledgement, late caller cancellation does not erase the known commit fact.

## Frontend boundary

The panel mounts beside the existing readiness, tenant, outbox and egress panels. Shared cards, notices, tables, details and badges are retained. Its model shows one committed observation with a maximum 60-second presentation lifetime, not global backlog or provider health. A due time in the past says that authorized scheduling is pending, not that a second request already ran. UNKNOWN is never green or automatically retryable.

The button remains disabled pending a real authenticated read API. No browser keys, URL entry, shell execution, approval or replay bypass is provided. This private projection is not a new public OpenAPI operation. Full frontend/media import, React build and browser/accessibility acceptance remain open.

## Local verification and publication

Run `python tools/check_webhook_lifecycle.py` from the repository root.

The targeted run passed **104 Go named leaf tests and 26 Node presentation/source tests (130 total)**, zero failures; Go race, vet and formatting checks passed. Two JSX files passed syntax transpilation. New lifecycle-package statement coverage: 96.9%. Two fuzz seeds are excluded from the named-test total. No fuzz campaign or load result is claimed.

Go tests exercise deterministic classification/timing, huge Retry-After overflow defense, copied policies, inconsistent observations, zero-value safety, concurrency, authorization-before-read, no receipt before commit, lost-commit acknowledgement recovery, version conflicts and redacted errors. The ledger is scripted in tests: no real DynamoDB, Kafka, Action Gateway, vault, HTTP worker or production recovery is certified. Existing full backend/frontend regression suites were not rerun.

The runner also verifies identical current repository/frontend status projections and the unchanged eight F03 stage IDs. That projection check is not proof that every future deployed service follows the pipeline; integration/independent acceptance remain required. Remote publication is recorded separately after branch/ref and source-hash verification.

## Engineering references

The requirement basis is the registered user baseline, not a new architecture. RFC 9110 §10.2.3 was checked on 8 September 2026 for HTTP-date and nonnegative delay-seconds Retry-After semantics: https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3 . Go standard-library time behavior was checked at https://pkg.go.dev/time . These references do not select a new dependency version or authorize a pipeline change.
