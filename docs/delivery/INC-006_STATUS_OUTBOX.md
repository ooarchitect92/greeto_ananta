# INC-006 — delivery-status outbox relay and acknowledgement inspection

7 September 2026. Repository: `ooarchitect92/greeto_ananta`. Branch: `main` only.
Source base: `881fe3f242f2a141363bce1b6cb1a1e2f7d09b78`.
Read `INC-006_PUBLICATION.json` for the later, remotely verified source commit.
This document does not treat a local test or source push as a production deployment.

## Requirement and unchanged ownership

This increment continues the control-data outbox introduced in INC-005. It contributes
to EVT-009, DAT-001 and UX-003 under the original prerequisites. The baseline section
7.1 requires transactional control changes plus a pending outbox and reconciliation.
Sections 8.2, 9 and 31.4 keep transport acknowledgement separate from downstream
processing and business effects. Section 32.2 requires bounded cancellation and
redacted diagnostics. All 262 work-package IDs, acceptance criteria and dependencies
remain unchanged. No parent work package is certified complete.

This is NOT the DynamoDB message-command journal, a general provider sender, a new
business-event broker or an alternative to the Go data plane. The TypeScript code
owns only its existing low-volume core delivery-status SQL records. The selected
NestJS host, Go data plane, Kafka/MSK, OPA, Temporal, public API and F01–F18 ordering
remain as selected. Nothing is added before the F03 webhook acknowledgement.

No dependencies, public endpoints, database columns, migration, Kafka topics,
infrastructure, CI/CD or release gates are changed. No background worker, HTTP
route or fake runtime adapter is automatically registered.

## Implemented path

1. The existing StatusService and INC-005 repository commit a status transition,
   status history and pending `platform.outbox` row atomically.
2. A host-authenticated workload obtains current publish authority for the exact
   tenant/workspace/environment. Matching strings are not authorization.
3. `PostgresStatusOutbox` validates scope, role/RLS diagnostics, active lifecycle,
   home cell, ownership epoch and environment kind. It loads the existing outbox
   record and its matching history, then commits the read before returning.
4. `StatusOutboxRelay` validates and hashes a minimized, immutable status fact.
   Publication never holds a SQL transaction or database connection open.
5. It rechecks the current grant and calls the certified transport port with the
   SAME event ID and deterministic fact hash. No provider action is called.
6. Only a matching `configured_quorum` transport acknowledgement can reach marking.
   Rejection, exception, invalid acknowledgement and unknown result do not mark.
7. It rechecks authority, starts a separate scoped SQL write transaction, locks the
   outbox and history, re-hashes the persisted fact, and marks the row only if it
   has not changed. Success is returned only after COMMIT.

An acknowledgement-shaped object is not independent proof of a Kafka quorum.
The real transport adapter must enforce and demonstrate the approved replication,
minimum-ISR, idempotence and acknowledgement policy. These ports are not public
endpoints: a browser must not submit a fabricated receipt to `confirmPublished`.

The existing SQL schema retains a publication marker and timestamp, not the
transport receipt reference. That reference is validated in memory; durable
broker-evidence collection/retention is still an explicit integration gate.

## Actual files, functions and parameters

| Owner file | Public boundary | Inputs and result |
|---|---|---|
| `backend/services/core/src/delivery/status-outbox-contract.ts` | `decodeFact`, `serializeFact`, `hashFact` | Existing committed status fact -> immutable canonical payload/UTF-8 JSON/SHA-256 |
| Same | `decodeCursor`, `requireTime` | Exact UTC microsecond timestamp plus event UUID; preserves keyset precision |
| Same | `decodeAck` | Exact trusted transport response -> identity/hash-bound acknowledgement or ACK_INVALID |
| `backend/services/core/src/delivery/postgres-status-outbox.ts` | `PostgresStatusOutbox(pool, context)` | Existing ScopeSqlPool and host-authenticated scope/placement; no constructor I/O |
| Same | `listPending(cursor, limit, signal)` | Null/new-sweep or exact page cursor; 1–100 events; bounded committed page |
| Same | `load(eventId, signal)` | Existing scoped event -> committed immutable fact/state/hash or null |
| Same | `confirmPublished(ack, signal)` | Matching transport ACK -> freshly checked marker COMMIT; no network publish inside SQL |
| `backend/services/core/src/delivery/status-outbox-relay.ts` | `StatusOutboxRelay(store, transport, authority, options)` | Narrow certified ports; workload UUID; pageSize default 25, deadlineMs default 5000 |
| Same | `relayOne(eventId, signal)` | One authorized CDC/recovery event -> published/already_published/pending/blocked outcome |
| Same | `runPage(cursor, signal)` | One bounded recovery page -> per-event outcomes, next cursor and local operation ID |
| `front end/src/features/implementation/outbox-view.mjs` | `outboxView(options)` | Authenticated expected scope, authorized observation and clock -> safe display state/counters |
| `front end/src/features/implementation/OutboxStatusPanel.jsx` | `OutboxStatusPanel(props)` | Optional scope/observation -> existing-design explanation and evidence; no network/actions |
| `tools/check_status_outbox.py` | `main()` | Existing Node/TypeScript -> strict compilation, test report and syntax checks |

### Internal fact contract

`eventId`, `eventType=delivery.status.changed.v1`, `scope` (three UUIDs),
`baselineId`, `workPackageId`, `previousStatus`, `status`, `previousVersion`,
`version`, `occurredAt` and `payloadRef=delivery-status:<event UUID>`.

Versions remain exact decimal strings; `version = previousVersion + 1`.
The timestamp retains six fractional digits in UTC. Serialization reconstructs
the field order, so insertion-order differences do not alter the fact digest.
Actor identity, raw evidence, reason text, tokens and retry keys are not copied
into this minimized payload.

This is the internal payload for the already named event, NOT a replacement for
the baseline canonical envelope. The transport adapter must add approved source,
received time, trace/correlation and routing metadata under the event catalog.
No missing original trace metadata is fabricated here. Schema-registry compatibility,
canonical-envelope mapping and the authorized topic/lane are unconfigured gates.
No undocumented public Swagger endpoint is created.

### Store and relay parameters

- Store `timeoutMs`: 100–5000 milliseconds, default 3000; bounds one SQL operation
  sequence. The actual driver must implement connect/query/protocol cancellation.
- Relay `pageSize`: 1–100, default 25. One event in flight per relay instance.
- Relay `deadlineMs`: 100–60000 milliseconds, default 5000 for one run/page.
  Concurrency is rejected with BUSY; no unbounded local queue is created.
- Optional observers are synchronous bounded local enqueue functions. SQL observers
  report stage/result/elapsedMs; relay observers add operationId and optional eventId.
  Those identifiers are for bounded logs/traces, not global metric labels.
- An observation window in the UI must be canonical UTC milliseconds, not exceed
  60 seconds and match the authenticated scope. This is a presentation freshness
  guard, not a contractual SLO or permission lease.

## Retry, crash and recovery semantics

A lost transport response can leave a fact in Kafka while its outbox row remains
pending. A later authorized retry emits the SAME logical event and content digest.
Consumers still require their own effect deduplication. This is not exactly-once
delivery and it never creates another business action.

A failed or lost marker COMMIT is reported unconfirmed. The next same-event read
can observe `published` and avoid another emission. If it still reads pending,
another emission may occur; that is an expected duplicate transport event.

Each recovery sweep starts at `cursor=null`. Follow the returned cursor only
within that sweep. A transaction may commit with an earlier created_at after a
scan has passed that point; a failed event can also remain behind the scan cursor.
Persisting the final cursor forever would strand those records. Tests explicitly
exercise late-committing earlier timestamps and retrying an earlier unresolved row.

An unresolved/orphan history is retained and reported, not skipped as success or
deleted. Later rows in the page may still progress. A null next cursor means that
bounded scan ended; it is NOT proof of an empty fleet backlog or completed recovery.
A production host still needs rate-bounded sweep cadence, fairness, backlog alerts
and approved handling for repeatedly unresolvable records.

## SQL boundary and remaining qualification

Only the existing `platform.tenants`, `platform.workspaces`, `platform.environments`,
`platform.outbox` and `delivery.status_events` are read; only the outbox publication
marker/timestamp is updated. Every variable is parameterized; table names are static.
All transactions set transaction-local scope and row-security/search-path/timeouts.
Role and FORCE-RLS checks are diagnostics, not a complete privilege certification.

The existing pending index is not changed. Real query-plan, scan-cost, scope
cardinality and timeout testing are required before scheduling recovery at cell
scale. An additional index or a different scan ownership model would need a
separately reviewed migration/approval; this increment does not silently add one.

No maintained PostgreSQL driver, real database, real Kafka producer, OIDC/OPA
service, CDC source or scheduler is installed/configured by these files. Cancellation
ports must settle only when protocol completion is known; never race a still-running
query and return its connection to the pool. Failed sessions are discarded.

Live SQL syntax/RLS/privilege tests, transactional concurrency, actual disconnect
windows, consumer deduplication, verified broker configuration, runtime security,
KMS and backup/restore testing remain open. A broker ACK and a SQL marker say
nothing about downstream projection, message delivery or release approval.

## Frontend placement

The existing Implementation Center mounts `OutboxStatusPanel` after
`ProductionReadinessPanel` and `TenantScopePanel` in Readiness & evidence.
It reuses Notice and the greeto-card/stat/table/button classes, without a new theme
or dependency. The diagnostic action is disabled until an authenticated backend
supplies it. No direct source-write, replay or production-control button is added.

Optional observation: kind `control_status_outbox_page`, source
`authorized_adapter`, scope, observedAt, expiresAt and counts:
scanned/published/alreadyPublished/pending/blocked. Counts sum to scanned and
describe one page, not the complete pending backlog. Missing/stale/cross-scope
data is withheld instead of shown as zero or green.

The earlier full frontend/media import remains incomplete on main. These
components are not a claim that the full React application builds or renders.

## Local evidence

Run `python tools/check_status_outbox.py` from a checkout with existing Node and
TypeScript executables. No install, external network, Git write or database action
is performed by the runner.

- 49 new outbox contract, SQL-port and relay tests.
- 15 new frontend presentation tests.
- 55 existing tenant backend and 20 existing frontend-scope regression tests.
- 3 existing projection/pipeline-order tests.
- Total: 142 passing named tests; no failed, skipped or cancelled tests.
- Strict TypeScript compilation and two JSX syntax-transpilation checks pass.

The PostgreSQL and transport ports in the tests are scripted synthetic fixtures.
The deadline test uses a real AbortSignal/timer but not a real SQL protocol.
The concurrent-worker test demonstrates permitted duplicate identity in that
fixture, not PostgreSQL locking or Kafka performance. No Go/full-frontend/backend
integration or cloud acceptance suite is included in this count.

## Engineering references

PostgreSQL 17 documentation was consulted for transaction locks and UTC timestamp
formatting. This is an engineering reference, not a production version selection
or an architecture amendment:

- https://www.postgresql.org/docs/17/explicit-locking.html
- https://www.postgresql.org/docs/17/functions-datetime.html

Current publication is recorded only after a remote ref and source-file hash
readback. The updated Excel tracker distinguishes this source contribution from
the unmet original parent gates. No pipeline change is approved by this document.
