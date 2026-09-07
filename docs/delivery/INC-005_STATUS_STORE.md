# INC-005 — atomic delivery-status persistence

7 September 2026. Target: `ooarchitect92/greeto_ananta`, `main` only.

## Scope and source precedence

Builds on observed main `1ca19a71364cf15cae1a0b71d2196def72dc8840`, preserving the newer PLT-004 signed-placement work. Includes the previously unpublished INC-003 tenant-scope source and its two-line Implementation Center integration. Its historical local-only report remains labelled as historical; current remote evidence is in `docs/delivery/status.json`.

This increment implements the existing StatusService repository port against the unchanged `backend/db/migrations/0001_foundation.sql`. It does not introduce an HTTP framework, change existing routes or schemas, install a dependency, configure infrastructure, grant a role, run a migration or deploy production. The Go signed directory and F01–F18 order are unchanged.

The uploaded baseline §7.1 requires scope-local transactions, optimistic versions and an atomic outbox. §1.2 separates durable acceptance from later processing. §35 requires acceptance evidence and original prerequisites before parent completion. This is source contribution to PLT-001, PLT-003, DAT-001, DEV-001 and UX-003, not acceptance of those work packages.

## Actual implementation and parameters

`backend/services/core/src/delivery/postgres-status-repository.ts` owns the new adapter.

| Public symbol | Inputs | Return and boundary |
|---|---|---|
| `PostgresStatusRepository(pool, context)` | Existing ScopeSqlPool; host-authenticated scope, actorId, baselineId, verified placement, AbortSignal, optional timeoutMs and observe callback | A request-scoped implementation of Repository. No network or registration in the constructor. No body-derived authority. |
| `findReceipt(scope, keyHash)` | Same authorized scope; SHA-256 hash from StatusService, not the raw retry key | Original committed receipt or null, only after READ ONLY transaction commits. Wrong scope/actor data is suppressed. Another baseline using the same scoped key is a conflict. |
| `transaction(scope, operation)` | Authorized scope and the existing StatusService callback | Callback value only after SERIALIZABLE COMMIT. No automatic retry. Escaped transaction methods are closed. |
| `StatusStoreContext.observe` | Sanitized stage, result and integer elapsedMs | Bounded synchronous local enqueue; never raw SQL, parameters, credentials or evidence body. Failure does not change DB outcome. |
| `statusSql` | No caller input; static SQL constants with positional parameters | Schema-qualified statements for the existing tables; no dynamic table/schema names. |

Inputs are supplied by the future authenticated NestJS host, not by a browser or internal-network assumption. Normalize/freeze scope and request intent before handing them to the existing StatusService. The authorizer and evidence verifier remain required. This repository is not a general public write API and is not an Action Gateway permit.

## Transaction sequence

1. Match the supplied scope against the immutable request context; honor cancellation.
2. Lease a clean exclusive driver session. Begin SERIALIZABLE READ ONLY for receipt lookup, or READ WRITE for a mutation.
3. Apply parameterized transaction-local scope, search path, row-security and bounded timeouts.
4. Reject unsafe runtime/session roles or absent FORCE RLS on the eight owned tables. This check is not a full privilege or security certification.
5. Match persisted tenant/workspace/environment against verified cell, exact decimal ownership epoch and environment kind. Write transactions require active lifecycle and hold shared row locks until commit.
6. Check an existing scoped retry receipt. Work-package writes lock the current version and read bounded dependencies. The unchanged domain service decides transitions, proof requirements and predecessor acceptance.
7. UPDATE exactly the expected status/version; INSERT immutable status history; INSERT a pending outbox row, all on the same transaction/session.
8. Return only after COMMIT. Rollback and discard on failure or uncertainty. A callback cannot swallow a method error and then commit partial changes.

The outbox uses `event_type=delivery.status.changed.v1` and an internal `delivery-status:<event UUID>` payload reference to its scoped history record. It contains no sensitive evidence body. The eventual authorized resolver, event schema registration, CDC and pending reconciliation remain integration gates. This increment does not publish a Kafka message or add a topic.

## Acknowledgements, errors and retry identity

A successful receipt proves only that this adapter observed the SQL COMMIT. It does not prove Kafka publication, backend deployment, review approval, or completion of the parent feature. A lost COMMIT response is recorded as unknown by the diagnostic observer and reported as unavailable, never as success. The caller retries the same intent and idempotency key through StatusService, which returns the original durable receipt when it exists.

Same key/different intent remains IDEMPOTENCY_CONFLICT. Stored version mismatch remains VERSION_CONFLICT. Missing prerequisites remain PREDECESSORS_BLOCKED. Missing external acceptance remains blocked by the unchanged EvidenceVerifier. Driver errors are redacted to STORE_UNAVAILABLE; cancellation is explicit. There is no blind internal retry and no irreversible external call.

Scope-wide idempotency uniqueness is preserved across baselines: the receipt lookup does not incorrectly restrict its search to one baseline and then retry forever against a conflicting unique key.

## Driver and live acceptance requirements

ScopeSqlPool is an injection port, not an installed driver. A maintained production driver must implement real connect/query deadlines and protocol cancellation, bounded rows, clean exclusive leases, transaction completion before promise settlement and destructive `release(true)`. Never implement its deadline by racing a still-running query and returning the session to the pool.

Live PostgreSQL testing must still prove SQL syntax/constraints, FORCE RLS and least-privilege roles, concurrent status/version conflicts, unique-key races, lifecycle/ownership locks, connection reuse after cancellation, real disconnect-after-COMMIT recovery, and atomic history/outbox rollback. The current script model proves application orchestration against its defined port, not PostgreSQL behavior.

NestJS HTTP/OIDC/OPA binding, the event payload resolver and Kafka publisher, KMS, backups/restores, Secure Boot/runtime security, complete frontend/media publication, React build and browser/E2E checks remain unverified. No production role, DB or recovery system was provisioned. No release/security gate is waived.

## Reproduce local evidence

From repository root, with the existing Node and TypeScript executables:

```sh
python tools/check_tenant_scope.py
python tools/check_status_store.py
```

This session reran 55 tenant domain/SQL-port tests, 20 frontend model tests, 60 new status-store composition/failure tests and 12 unchanged status-domain regression tests: 147 passing named tests, zero failures. Strict TypeScript compilation passed. Two JSX files passed syntax transpilation; this is not browser rendering. Existing Go/full-frontend/infrastructure regression suites were not rerun in this session and are not included in that count.

Notable tests cover partial writes, pending/lost commit ACK, same-key replay, changed intent, cross-scope/baseline/actor response suppression, predecessor and evidence gates, stale versions, malformed adapter rows, cancellation, pool cleanup, redacted per-stage diagnostics and a failing telemetry sink.

## External engineering references, not architecture amendments

PostgreSQL 17 documentation was checked on 7 September 2026 for row-lock and transaction implementation details. This is not selection or qualification of a production database version.

- https://www.postgresql.org/docs/17/explicit-locking.html
- https://www.postgresql.org/docs/17/queries-with.html
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html

Remote publication is recorded only after the commit/ref and changed-file hashes are read back. The Excel tracker distinguishes published source from uncompleted production and parent acceptance.
