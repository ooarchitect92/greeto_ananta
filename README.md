# Greeto / Customer Action OS

Universal Messaging & Customer Action OS: a Mission-led SaaS for permitted messaging channels, customer operations, governed automation, AI and integrations.

**Implementation status through INC-013 — 8 September 2026.** This README summarizes the published repository and its recorded evidence. The architecture is the target; a proposed feature, a local ZIP, a passing unit test and a deployed capability are not interchangeable.

> **Current position:** backend foundations, customer-webhook components, server-side SDK helpers and partial frontend evidence panels have been implemented and published. The complete customer application, real infrastructure bindings and production acceptance are not complete.

## 1. How much has been implemented?

| Measure | Recorded position |
|---|---|
| Architecture baseline | **262 work packages across 27 domains**, with F01–F18 retained. |
| Latest published implementation | **INC-013 — receiver HTTP acknowledgement boundary.** |
| Latest implementation commit | `d89d30e36d9d01ca453b622cae48c3379ebb5abf` |
| Implementation/status snapshot inspected for this README | `5d04400d876619fbf99385994a8e5d961bb6b322` on `main`; this README edit is documentation-only. |
| Rows in the current repository contribution projection | **25**: 3 `In progress`, 22 `Blocked`. These include documentation and partial source contributions; they are not 25 completed features or the complete 262-row tracker. |
| Baseline work packages certified Done | **0 of 262** according to the current published status record. |
| Full application build and end-to-end customer Mission | Not established by the published evidence. |
| Production deployment / provider approval / scale certification | Not established by the published evidence. |
| Unpublished implementation | **INC-010 DynamoDB sender result-ledger candidate** remains outside `main`. |

**The zero certified-Done count does not mean no code exists.** It means no parent work package has yet satisfied the complete implementation, automated acceptance, security/contract review, documentation and rollout/rollback gates. There is no evidence-backed overall coding-completion percentage; partial work and repeated test runs must not be converted into one.

Sources: [current contribution and blocker record](docs/delivery/status.json), [original work-package index](docs/delivery/baseline-index.csv), [architecture source register](docs/architecture/SOURCE_REGISTER.json), and [latest publication evidence](docs/delivery/INC-013_PUBLICATION.json). The source architecture's 10-million-tenant / 10-billion-message-per-day figures remain **design targets, not measured capacity**.

## 2. Implemented and published source

The following capabilities have source in `main`. The right-hand column is part of the status, not optional future hardening.

| Area | Implemented contribution | Remaining integration / acceptance |
|---|---|---|
| Governance and traceability | Owner directives, main-only publication rules, source register, baseline IDs/dependencies, implementation guides and publication manifests. | Named reviews, baseline approvals and release evidence. |
| Frontend configuration foundations | Shared parameter validation, scoped session-draft helpers and type declarations. | Full original/structured frontend import and its real API integrations. |
| Implementation Center | Readiness/evidence, tenant scope, status outbox, egress and delivery-lifecycle panel source; presentation models distinguish stale, missing, mismatched and unknown observations. | Complete React application, browser/accessibility checks and authenticated observation APIs. |
| Tenant/workspace/environment isolation | TypeScript scope domain and guarded read-only PostgreSQL scope adapter; scope, lifecycle and ownership checks. | Real identity/authorization service, database driver, RLS and isolation tests. |
| Signed placement | Go signed placement directory, snapshot validation, expiry/version/epoch/tombstone checks and F03 binder composition. | Authoritative controller, durable checkpoints, approved trust distribution/revocation and restart/restore tests. |
| Development-status persistence | Existing status domain plus `PostgresStatusRepository`: scoped status/history/outbox transaction, expected-version checks and same-key receipt recovery. | Actual PostgreSQL/NestJS/authentication wiring and database crash/concurrency acceptance. |
| Status-event outbox | Scoped fact resolution, bounded pending reads, publish/acknowledge/mark relay, payload/identity checks and restartable sweeps. | Approved Kafka mapping/client, quorum evidence, CDC and live recovery scheduling. |
| Provider-ingress foundation | F03 verification/parse/bind/commit-all/acknowledge ordering, raw-proof primitives and effect-before-offset boundaries. | Official provider fixtures, real parsers, quarantine/routing and Kafka integration. This is not completed Meta/Telegram onboarding. |
| Health, encryption, logging and recovery foundations | Freshness-aware readiness, scoped AES-256-GCM envelope primitive, bounded structured telemetry and ordered recovery guards. | KMS/identity bindings, collectors, durable audit, intrusion monitoring, independent backups, restore drills and host-integrity evidence. |
| F07 signing and SDK verification | Go signing plus Node/TypeScript and Python exact-byte signature verifiers; timestamp, key-version, rotation/revocation and duplicate-header checks. | Production endpoint/key lifecycle, real vault integration and independent acceptance. |
| F07 outbound network boundary | Proxy-side HTTPS destination checks, all-answer DNS validation, validated-IP connection, TLS verification, bounded responses and no redirects/transparent retries. | Deployed restricted proxy/network policy, current Action Gateway permits and actual sender attempt/result storage. |
| F07 retry and result-recording orchestration | Versioned retry decisions, bounded delay/jitter and Retry-After handling; preserve endpoint acceptance and UNKNOWN; verify matching acknowledged result receipts. | Production sender ledger, due scheduler, fairness, reconciliation and authorized worker bindings. |
| Authenticated event-body identity | Go, TypeScript and Python helpers bind the event header to `event_id` inside the signed body; bounded duplicate-aware parsing, exact-byte preservation and protected result access. | Complete event schemas, subscriptions, object/purpose authorization and durable replay prevention. |
| Receiver HTTP adapter | Required Keys/Gate/Inbox ports, bounded admission/body/headers/deadlines, exact receipt before HTTP 204, correlated stage reports and graceful drain. | Real key, schema/authorization and transactional receiver Inbox bindings; reviewed hosting and full sandbox acceptance. |

The sender's **WebhookDelivery ledger** and the customer's **receiver Inbox** are different storage boundaries. The receiver adapter is not a replacement for unpublished INC-010. Test-only stores and authorization adapters are not production persistence or production permission checks.

## 3. Published milestones and recorded tests

These are **historical, scoped evidence records**, not tests rerun by this README update. Later runs can include earlier regression tests; do not sum this table into a unique-test total or an implementation percentage. Current published reports are used rather than counts from older unpublished packages.

| Milestone | Published scope | Recorded evidence |
|---|---|---|
| Initial frontend helpers and backend foundation | Validation/drafts, ingress/event boundaries, security/health/recovery primitives, contracts and status domain. | [Foundation verification and open gates](docs/delivery/VERIFICATION.md). |
| PLT-004 signed placement | Signed local placement directory and ingress binder. | [Implementation](docs/delivery/PLT-004-IMPLEMENTATION.md) and [verification](docs/delivery/PLT-004-verification.json). |
| INC-003 + INC-005 | Tenant-scope code was published with atomic development-status persistence. | **150** scoped tests, including regressions/projection checks; strict TypeScript and two JSX syntax checks. [Publication record](docs/delivery/INC-005_PUBLICATION.json). |
| INC-006 | Development-status outbox relay and inspection. | **142** scoped tests: 49 new outbox, 15 frontend, 75 tenant regressions and 3 projection checks. [Verification](docs/delivery/INC-006_VERIFICATION.json). |
| INC-007 | F07 signing and server-side verification SDKs. | **181** tests: Go 60, Node 65, Python 56; six shared signature vectors. [Verification](docs/delivery/INC-007_VERIFICATION.json). |
| INC-008 | Proxy-side webhook egress boundary and frontend view. | **184** tests: Go 159, frontend 25; Go race/vet passed. [Verification](docs/delivery/INC-008_VERIFICATION.json). |
| INC-009 | Retry planner, outcome-recording orchestration and delivery panel. | **130** tests in the published report: Go 104, frontend 26; Go race/vet passed. [Verification](docs/delivery/INC-009_VERIFICATION.json). |
| INC-011 | Go authenticated event-body identity helper. | **66** named tests; four fuzz seeds reported separately; 98.3% package statement coverage. [Verification](docs/delivery/INC-011_VERIFICATION.json). |
| INC-012 | TypeScript/Python body-identity helpers and Go conformance. | **246 executions**: 74 shared cases in each of three languages plus 24 runtime-specific tests; outputs identical; strict TypeScript passed. [Verification](docs/delivery/INC-012_VERIFICATION.json). |
| INC-013 | Receiver HTTP acknowledgement boundary. | **85** named tests, including five real local HTTP/TLS scenarios; Go race/vet/format passed; 95.7% package statement coverage. [Verification](docs/delivery/INC-013_VERIFICATION.json). |

**INC-010 is deliberately not listed as published.** Its locally tested DynamoDB adapter remains a retained candidate following a blocked test-file upload. Unreferenced Git objects do not make it part of `main`; no production AWS SDK binding or table was established by that candidate.

The INC-013 wire tests cover withheld success during a held commit, lost-acknowledgement recovery, concurrent duplicates, a stalled partial request and chunked/identity-encoded input. They use real local HTTP/TLS and real signature code, but **synthetic Keys/Gate/Inbox bindings**. They do not prove a cloud database, vault, production receiver or full application works.

## 4. Frontend status: source present versus runnable application

Published frontend source lives under [`front end/`](front%20end/). The current Implementation Center includes:

- `ProductionReadinessPanel.jsx` and `TenantScopePanel.jsx`.
- `OutboxStatusPanel.jsx`, `EgressBoundaryPanel.jsx` and `WebhookDeliveryPanel.jsx`.
- Supporting presentation tests, `PageLayout.jsx`, shared validation/draft helpers and `src/contracts/delivery-status.json`.

The frontend status projection and `docs/delivery/status.json` have identical content at the inspected snapshot. This is **repository evidence synchronized by commits**, not an automatic live database-status feed. Execution controls remain disabled where their authenticated backend is missing.

**The complete earlier frontend/media package is still not imported into `main`.** In particular, the inspected frontend tree does not contain the full application/package manifest and assets needed for the earlier React/Vite setup. Do not treat the standalone panels as a completed UI or give `npm run dev` as a working root-repository launch instruction. The import blocker remains recorded in [issue #1](../../issues/1) and [frontend publication status](front%20end/docs/publication/STATUS.md).

The existing React/Vite frontend is retained pending the documented migration decision; the architecture's Next.js/TypeScript target is not reported as already implemented. No framework migration is authorized by this README.

## 5. API, data and operational status

| Surface | Current position |
|---|---|
| OpenAPI / Swagger | [`backend/contracts/openapi.json`](backend/contracts/openapi.json) contains initial OpenAPI contracts with implementation status. Contract existence is not a running endpoint or hosted Swagger UI. |
| PostgreSQL schema | [`0001_foundation.sql`](backend/db/migrations/0001_foundation.sql) is an **unapplied draft**. Adapter tests do not establish applied migrations, runtime roles or live RLS. |
| DynamoDB | [`dynamodb-tables.json`](backend/contracts/dynamodb-tables.json) documents access patterns. INC-010 sender result storage remains unpublished; actual runtime/cloud integration is incomplete. |
| Kafka | [`kafka-policy.json`](backend/contracts/kafka-policy.json) and code define acknowledgement, outbox and offset boundaries. A production broker/client/CDC connection is not established. |
| Backups and recovery | Ownership and recovery guards are documented/partially coded. An independent backup environment, restore drills and measured RPO/RTO are not established. |
| Encryption and security | Cryptographic/telemetry primitives exist; live KMS, rotation/revocation recovery, durable audit/SIEM, intrusion detectors and Secure Boot evidence remain open. |
| Provider integrations | Published primitives are not proof of complete WhatsApp, Instagram, Messenger or Telegram authorization, messaging, calling or provider approval. |
| Full business product | End-to-end Missions, Action Gateway execution, Temporal workflows, AI/RAG, CRM, campaigns, commerce, payments, voice, billing, helpdesk and marketplace are not established as working product features by the current publication evidence. Their baseline scope remains retained. |

[Recovery/security ownership](docs/architecture/RECOVERY_SECURITY.md) and [owner requirements](docs/requirements/OWNER_DIRECTIVES.md) remain authoritative for the next implementations. A standby alone is not recorded as a protected backup, a frontend flag is not Secure Boot evidence, and a unit test is not security certification.

## 6. Pipeline and acknowledgement boundaries retained

**F03 provider callback:** bounded request -> route-owned proof -> bounded parsing -> authorized placement -> durable acceptance of all required slices -> provider HTTP acknowledgement -> asynchronous processing. No AI, CRM, search or backup round trip is inserted before its acceptance acknowledgement.

**F07 customer webhook:** subscription match -> durable sender delivery record -> fair scheduling -> exact-byte signing -> restricted HTTPS delivery -> classified result and recorded retry/terminal/unknown state. The published components do not yet form a fully connected sender runtime.

**Opt-in customer receiver adapter:** bounds/deadline -> registered keys -> exact body -> signature/event verification -> required schema/authorization Gate -> atomic Inbox acceptance -> exact receipt check -> offer HTTP 204. Keys, Gate and Inbox must be supplied by production bindings; no permissive fallback is installed.

Queue acceptance, provider acceptance, delivery/read evidence, customer endpoint acceptance and verified business completion remain separate. UNKNOWN is not changed into success or permission for a new automatic business action. Main-only source publication does not waive these rules or the production release gates.

Details: [outbox](docs/delivery/INC-006_STATUS_OUTBOX.md), [signatures](docs/delivery/INC-007_WEBHOOK_SIGNATURES.md), [egress](docs/delivery/INC-008_WEBHOOK_EGRESS.md), [retry/result recording](docs/delivery/INC-009_WEBHOOK_LIFECYCLE.md), [receiver HTTP](docs/delivery/INC-013_RECEIVER_HTTP.md).

## 7. Local checks and diagnostic host

Run the appropriate existing check from the repository root. Go, Python and, for relevant suites, Node/TypeScript must already be available. These commands are local checks, not deployment commands or substitutes for full integration/release acceptance.

| Area | Command |
|---|---|
| Foundation | `python tools/check_foundation.py` |
| Tenant scope | `python tools/check_tenant_scope.py` |
| Status persistence | `python tools/check_status_store.py` |
| Status outbox | `python tools/check_status_outbox.py` |
| Webhook signing | `python tools/check_webhook_signing.py` |
| Webhook egress | `python tools/check_webhook_egress.py` |
| Webhook lifecycle | `python tools/check_webhook_lifecycle.py` |
| Go event-body receiver | `python tools/check_webhook_receiving.py` |
| Three-language SDK conformance | `python tools/check_webhook_sdk_events.py` |
| Receiver HTTP adapter | `python tools/check_receiver_http.py` |

To run the existing **loopback-only diagnostic host**, not the SaaS application:

```sh
cd backend
go run ./cmd/ingress
```

The host is documented to bind `127.0.0.1:8090`. `/health/live` indicates process liveness; `/health/ready` and the unconnected provider callback route intentionally return `503`. The added receiver HTTP package is not automatically registered by this command. See [backend foundation instructions](backend/README.md).

The reported tests above were recorded in their respective increments. **This README update does not rerun the application suites, qualify production toolchain versions, install dependencies, migrate data, send messages or deploy anything.**

## 8. Where to continue and how to keep status accurate

Read these records before development:

| Record | Purpose |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Main-only source delivery, no force-push and mandatory owner approval for pipeline changes. |
| [`OWNER_DIRECTIVES.md`](docs/requirements/OWNER_DIRECTIVES.md) | Scope, acknowledgement, security/recovery and developer documentation requirements. |
| [`SOURCE_REGISTER.json`](docs/architecture/SOURCE_REGISTER.json) | Original plans, hashes and persistent retrieval locations. |
| [`baseline-index.csv`](docs/delivery/baseline-index.csv) | Original work-package IDs, gates and predecessors. |
| [`status.json`](docs/delivery/status.json) | Current published contributions and remaining acceptance boundaries. |
| [`docs/delivery/`](docs/delivery/) | Increment implementation guides, recorded verification and publication manifests. |
| [`PIPELINE_CHANGE_REQUEST.md`](front%20end/docs/publication/PIPELINE_CHANGE_REQUEST.md) | Proposal and explicit approval record before any pipeline change. |

The original plans and complete structured frontend remain in the persistent **`/Greeto_Action_OS` Library workspace**. The latest Excel evidence register is **`/Greeto_Action_OS/delivery/Greeto_Action_OS_Delivery_Tracker_Updated.xlsx`**, currently carrying evidence through INC-013. These are Library locations, not files asserted to exist inside this Git checkout.

Outstanding work remains: complete the preserved frontend import/build; resolve unpublished sender-ledger delivery; supply reviewed database/Kafka/key/authorization bindings; qualify the receiver Inbox and hosting; demonstrate the approved end-to-end Mission; and complete security, backup/recovery, provider and release acceptance. **This is a gap summary, not a reordered implementation plan**: the original prerequisites and owner approvals govern scheduling.

For every subsequent increment, record changed paths, local test scope, remaining gates and the actual published commit; read back the remote reference before reporting delivery. Preserve previous evidence and keep unpublished candidates separate. Update this README when those facts change, without upgrading a parent task merely because one component exists.
