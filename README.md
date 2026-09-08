# Greeto / Customer Action OS

Universal Messaging & Customer Action OS: a Mission-led SaaS for permitted messaging channels, customer operations, governed automation, AI and integrations.

**Implementation status through INC-015 — 9 September 2026.** Latest source contribution: `8efd08454d245edf01ead4bb9c5da3693c6c7b81`, based on `37d9831d850b866ee08df45debc86d07349ca857`. Source publication, local tests, integration acceptance and deployment are separate milestones.

> **Current position:** the registered structured frontend and original media were restored in INC-014; its Windows preview and production build passed. Backend foundations and customer-webhook/SDK components through INC-013 are published. INC-015 hardens session-draft restoration in the existing frontend. This is **not yet a connected end-to-end or production-certified SaaS**. The two recorded Mission browser failures remain open, and real infrastructure/provider/authorization integrations are not complete.

## Start the frontend on Windows

Double-click [`start.bat`](start.bat) in the repository root. It checks Node/npm, installs locked dependencies when Vite is missing, and opens:

```text
http://127.0.0.1:5174/frontend-preview
```

Keep its console open; press **Ctrl+C** to stop. A port conflict fails visibly. The existing manifest requires **Node 24.15.0 or later within 24.x, or Node 26+**, with npm on PATH. First installation needs registry access. This launcher starts only the draft-only frontend, not the backend, Kafka, databases or provider execution.

Manual equivalent from the repository root:

```sh
cd "front end"
npm ci
npm run dev:frontend -- --strictPort
```

Run `npm ci` inside `front end/`, not the root. Existing backend-dependent screens are not made operational by opening the isolated preview. See [INC-014 launch evidence](docs/delivery/INC-014_LOCAL_LAUNCH.md) and its [repository Excel workbook](docs/delivery/INC-014_EVIDENCE.xlsx).

## 1. How much is implemented?

| Measure | Evidence-backed position |
|---|---|
| Architecture scope | **262 work packages across 27 domains**; F01–F18 retained. |
| Frontend restoration | INC-014 restored all **238 archive paths**: 233 matched the archive, five kept newer tracked implementations. Source coverage is not product-completion percentage. |
| Frontend inventory | **55 workspace entries**: 29 existing screens, 25 configuration pages and one Implementation Center; nine navigation groups and **231 parameters**. |
| Recorded INC-014 audit | 262 work-package references, 449 imports; zero errors. |
| Recorded INC-014 build and launch | Production build passed (2,921 modules); actual Windows launcher/browser smoke returned HTTP 200 with Implementation Center visible and no page errors. |
| Recorded INC-014 tests | **180 contract + 3 component tests passed**. Browser suite: **7 passed / 2 failed / 1 skipped**. These were not rerun in INC-015. |
| New INC-015 source | Existing scoped draft save/load now checks raw types, embedded JSON, metadata and UTF-8 byte size before restoration. Partial drafts remain supported. |
| New INC-015 local checks | **138 passed**: 68 existing core contracts + 70 new boundary cases. Synthetic session storage; not React/browser/server acceptance. |
| Backend | Published domains, primitives and adapters through INC-013; real runtime bindings incomplete. |
| Current contribution projection | **25 rows**: 3 In progress, 22 Blocked; partial contributions, not 25 completed features or the complete tracker. |
| Certified parent completion | **0 of 262**. No parent acceptance gate is waived by these increments. |
| Unpublished work | **INC-010 DynamoDB sender result-ledger candidate** remains outside main. |
| Production / complete customer Mission | Not established by recorded evidence. |

Zero certified-Done parents does not mean no code exists. Done requires implementation, acceptance tests, security/contract review, documentation and rollout/rollback evidence. No evidence-backed overall coding percentage is available. Overlapping test runs and restored file counts must not be converted into one. The architecture's 10-million-tenant / 10-billion-logical-message-per-day figures remain design targets, not measured capacity.

The synchronized [repository status](docs/delivery/status.json) and [frontend status](front%20end/src/contracts/delivery-status.json) now record INC-015 and explicitly carry INC-014 restoration/build evidence. They are commit-based source evidence, **not live runtime health**. Original historical contribution records remain retained.

## 2. Latest increment: safe frontend draft restoration

The existing [draft module](front%20end/src/shared/state/drafts.js) is used by the existing configuration studio; no new design or navigation was introduced.

Save and load now share raw-value/safety checks. Restoration rejects unsafe embedded JSON, malformed envelopes and incompatible control values before they reach React. Unsupported values cannot silently disappear or change under JSON serialization. The existing 64,000-byte limit is enforced as UTF-8 bytes. Storage errors use neutral messages; rejected drafts are not automatically deleted or rewritten.

Valid partial values, blanks, false, zero, editable number strings, v1 envelope structure and tenant/workspace/environment/user keys remain unchanged. A session save is **not** server validation, authorization, a database write or a durable acceptance acknowledgement.

See [implementation and parameters](docs/delivery/INC-015_DRAFT_RESTORE.md), [local verification](docs/delivery/INC-015_VERIFICATION.json) and [publication evidence](docs/delivery/INC-015_PUBLICATION.json).

### Browser failure remains open — proposed correction awaits approval

The INC-014 test fills the documented Mission-name default `Appointment follow-up`, then expects `example-ref` after reload. The reported actual value matches what the test filled. This explains the fixture mismatch; it is not a browser rerun or proof that every draft scenario works.

The proposed correction is to explicitly enter `example-ref` before validating/saving, retaining the existing reload assertion and all validation, no-API, export, disabled-server-action and viewport checks. **It has not been applied.** See the [pending owner review](docs/delivery/INC-015_BROWSER_ASSERTION_REVIEW.md). Existing Playwright tests, feature defaults, dependencies and release gates remain unchanged. No failure has been waived.

## 3. Published modules and remaining integration

| Area | Published contribution | Remaining acceptance |
|---|---|---|
| Governance | Source register, owner directives, baseline IDs/dependencies, evidence manifests. | Named approvals, independent reviews and release evidence. |
| Frontend | Registered source/media, grouped navigation, parameter contracts, Windows preview, scoped drafts. | Current full browser/accessibility/security acceptance and actual APIs. React/Vite remains; UX-001 Next.js migration is open. |
| Implementation Center | Readiness, tenant-scope, outbox, egress and delivery-lifecycle panels; missing/stale/unknown observations stay explicit. | Authenticated live observation APIs and runtime evidence. |
| Tenant isolation | TypeScript scope domain and guarded PostgreSQL read adapter. | Real identity/authorization, driver, RLS and isolation tests. |
| Signed placement | Signed directory, expiry/version/epoch/tombstone checks, F03 binder. | Controller, durable checkpoints, trust distribution and recovery tests. |
| Status persistence | Scoped status/history/outbox transaction, expected versions and same-key receipt recovery. | Real PostgreSQL/NestJS/authentication and crash/concurrency evidence. |
| Status outbox | Scoped fact resolver, bounded pending reads, publish/ACK/mark relay and restartable sweeps. | Kafka mapping/client/quorum, CDC and live recovery scheduling. |
| Provider ingress | F03 verify/parse/bind/commit-all/ACK ordering, raw-proof and effect-before-offset primitives. | Official provider fixtures, parsers, quarantine/routing and Kafka binding. Not complete Meta/Telegram onboarding. |
| Operational foundations | Freshness-aware readiness, AES-256-GCM envelope primitive, bounded telemetry and recovery guards. | KMS, collectors, durable audit/SIEM, intrusion monitoring, independent backups, restore drills and Secure Boot evidence. |
| Customer-webhook signing | Go signing and Node/TypeScript/Python exact-byte verifiers; key/time/rotation checks. | Actual endpoint/key lifecycle, vault and independent review. |
| Restricted egress | HTTPS/DNS/IP/TLS checks, bounded responses, no redirects or transparent replay. | Deployed restricted proxy/network policy, current Action Gateway permits and sender storage. |
| Retry/result recording | Versioned retry planner, Retry-After, preserved UNKNOWN/2xx and exact receipt checks. | Sender ledger, scheduler/fairness, reconciliation and worker authority. |
| Signed-body identity | Go/TypeScript/Python event-ID binding, bounded duplicate-aware parsing and protected bytes. | Full schema, subscription, object/purpose authorization and replay prevention. |
| Receiver HTTP | Required Keys/Gate/Inbox ports, bounds/deadlines, exact receipt before 204, diagnostics and drain. | Real transactional Inbox, key/schema/authorization bindings and reviewed hosting. |

The sender's WebhookDelivery ledger and customer's receiver Inbox are separate boundaries. Receiver code is not a substitute for unpublished INC-010. Synthetic stores/permissions in tests are not production bindings.

OpenAPI/Swagger contracts are in [backend/contracts/openapi.json](backend/contracts/openapi.json); existence is not a running endpoint or hosted Swagger UI. [PostgreSQL schema](backend/db/migrations/0001_foundation.sql) remains an unapplied draft; [DynamoDB access patterns](backend/contracts/dynamodb-tables.json) and [Kafka policy](backend/contracts/kafka-policy.json) remain subject to runtime qualification. A standby alone is not a protected backup, a UI flag is not Secure Boot, and a passing unit test is not security certification.

End-to-end Missions, Action Gateway execution, Temporal workflows, AI/RAG, CRM, campaigns, commerce/payments, calling, billing, helpdesk and marketplace are not established as working product features by the source evidence. Their scope remains retained in the baseline. See [recovery/security ownership](docs/architecture/RECOVERY_SECURITY.md) and [owner directives](docs/requirements/OWNER_DIRECTIVES.md).

## 4. Milestones and historical tests

These are separate scoped runs. Later tests can repeat earlier regressions; do not add them into a unique-test count. Historical results were not all rerun by INC-015.

| Milestone | Evidence |
|---|---|
| Initial foundation | [Primitives, contracts and open gates](docs/delivery/VERIFICATION.md). |
| Signed placement | [PLT-004 implementation](docs/delivery/PLT-004-IMPLEMENTATION.md) and [verification](docs/delivery/PLT-004-verification.json). |
| INC-003 + INC-005 | Tenant scope/status store; **150** scoped checks, including projections. [Publication](docs/delivery/INC-005_PUBLICATION.json). |
| INC-006 | Status outbox; **142** checks including regressions. [Verification](docs/delivery/INC-006_VERIFICATION.json). |
| INC-007 | Signing/SDKs; **181** tests (Go 60, Node 65, Python 56). [Verification](docs/delivery/INC-007_VERIFICATION.json). |
| INC-008 | Egress/UI; **184** tests (Go 159, frontend 25). [Verification](docs/delivery/INC-008_VERIFICATION.json). |
| INC-009 | Retry/receipt/UI; **130** published tests (Go 104, frontend 26). [Verification](docs/delivery/INC-009_VERIFICATION.json). |
| INC-011 | Go body identity; **66** named tests + four separate seeds, 98.3% package coverage. [Verification](docs/delivery/INC-011_VERIFICATION.json). |
| INC-012 | SDK conformance; **246 executions** (74 shared cases in three languages + 24 language-specific checks), identical shared results. [Verification](docs/delivery/INC-012_VERIFICATION.json). |
| INC-013 | Receiver HTTP; **85** named tests including five real local HTTP/TLS cases, 95.7% package coverage. [Verification](docs/delivery/INC-013_VERIFICATION.json). |
| INC-014 | Registered frontend restoration and launcher; build/audit/smoke and **180 contract + 3 component** tests passed; browser **7 pass / 2 fail / 1 skip**. [Report](docs/delivery/INC-014_LOCAL_LAUNCH.md). |
| INC-015 | Session-draft safety; **138** Node tests (68 existing + 70 new). New suite before repair: 46 pass / 24 fail. [Verification](docs/delivery/INC-015_VERIFICATION.json). |

INC-013's wire tests use real local HTTP/TLS/signatures but synthetic Keys/Gate/Inbox. INC-014 recorded Node 24.18.0 / npm 11.16.0 on Windows, 263 packages installed without lockfile changes and an esbuild policy warning without changing install policy. INC-015 used Node 22.16.0 for dependency-free tests only; full frontend installation was unavailable (offline ENOTCACHED and engine constraints). No version was changed. Current build/browser acceptance remains open.

The restored frontend handoff includes [routes/ownership](front%20end/docs/FEATURE_MAP.md), [parameters](front%20end/docs/PARAMETERS.md), [implementation order](front%20end/docs/IMPLEMENTATION_ORDER.md), [API inventory](front%20end/docs/API_INVENTORY.md) and [component inventory](front%20end/docs/COMPONENT_INVENTORY.md). Inventoried server functions are not live endpoints. [ADR-0001](front%20end/docs/ADR-0001-react-vite-compatibility.md) records React/Vite compatibility; no migration is authorized here.

## 5. Pipeline boundaries retained

**F03:** request bounds -> route-owned proof -> bounded parsing -> authorized placement -> durable acceptance of every required slice -> HTTP ACK -> asynchronous processing. No AI, CRM, search or backup round trip is added before ACK.

**F07 sender:** subscription match -> durable delivery -> fair scheduling -> exact-byte signing -> restricted HTTPS -> classified result and recorded retry/terminal/unknown state. These components are not yet a fully connected runtime.

**Customer receiver:** bounds/deadline -> registered keys -> exact bytes -> verification -> required schema/authorization Gate -> atomic Inbox -> exact receipt -> offer 204. Real bindings remain required.

Queue, provider, delivery/read, endpoint and business acknowledgements remain distinct. UNKNOWN is not success or authority to resend a new business action. The frontend preview executes none of these live paths. Existing F01–F18, schemas, permissions, dependencies and release gates were not reordered or waived.

## 6. Reproduce checks

Frontend (locked dependencies and compatible engine required):

```sh
cd "front end"
npm run audit:frontend
npm run test:contracts
npm test
npm run build
npm run test:e2e
```

Playwright browser binaries are required. The original `test:e2e:legacy` needs its original live integration environment. Do not replace the failing browser suite with the narrower INC-015 tests.

Run relevant dependency-free/domain checks from the repository root; required tools must already exist:

```sh
python tools/check_frontend_drafts.py
python tools/check_foundation.py
python tools/check_tenant_scope.py
python tools/check_status_store.py
python tools/check_status_outbox.py
python tools/check_webhook_signing.py
python tools/check_webhook_egress.py
python tools/check_webhook_lifecycle.py
python tools/check_webhook_receiving.py
python tools/check_webhook_sdk_events.py
python tools/check_receiver_http.py
```

These commands do not establish deployment or replace independent integration/release gates. The existing diagnostic host is separate from the frontend launcher:

```sh
cd backend
go run ./cmd/ingress
```

It is documented to bind `127.0.0.1:8090`; liveness is process-only, while readiness and the unconnected provider callback return 503. It does not automatically mount the receiver adapter. See [backend instructions](backend/README.md). It was not run in INC-014 or INC-015.

## 7. Project records and next gates

Read [AGENTS.md](AGENTS.md), [owner directives](docs/requirements/OWNER_DIRECTIVES.md), [source register](docs/architecture/SOURCE_REGISTER.json), [baseline index](docs/delivery/baseline-index.csv), [current status](docs/delivery/status.json) and [delivery evidence](docs/delivery/) before continuing. Original plans remain in `/Greeto_Action_OS` Library. The canonical tracker is `/Greeto_Action_OS/delivery/Greeto_Action_OS_Delivery_Tracker_Updated.xlsx`; the INC-015 workbook preserves prior increment sheets and adds a cited INC-014 carry-forward summary. The separate repository [INC-014 workbook](docs/delivery/INC-014_EVIDENCE.xlsx) remains unchanged.

Outstanding gates include the reviewed browser-input correction and rerun; current frontend/browser/accessibility acceptance; live status APIs; unpublished sender ledger; reviewed database/Kafka/KMS/identity and receiver bindings; a full permitted customer Mission; provider approval; security, backup/recovery and release certification. Original-import snapshot/history remains separate from the restored structured frontend. **This is a gap summary, not a new implementation order.** Original predecessors and owner approvals govern scheduling.

Use main only, no force-push and no overwritten concurrent work. Record actual changes/tests/exclusions and remote commit/hash readback. Preserve historical evidence and unpublished candidates separately. A pipeline change requires its specific proposal, risks/tests/rollback and explicit owner approval in the [change-request record](front%20end/docs/publication/PIPELINE_CHANGE_REQUEST.md). A passing helper test cannot upgrade a blocked parent or authorize production deployment.
