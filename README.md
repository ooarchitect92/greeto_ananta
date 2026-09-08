# Greeto / Customer Action OS

Universal Messaging & Customer Action OS: a Mission-led SaaS for permitted messaging channels, customer operations, governed automation, AI and integrations.

**Implementation status through INC-014 — 8 September 2026.** Repository snapshot inspected: `5de94732417fd364cca0812b1cdec0d53bd5b558` on `main`. This README update is documentation-only; the test results below are recorded implementation evidence, not suites rerun by this edit.

> **Current position:** the complete registered structured-v1 frontend source and original media are now in the repository, the Windows frontend preview launches, and the frontend production build passes. Backend foundations, customer-webhook components and server-side SDK helpers are also published. This is **not yet a connected end-to-end SaaS or a production-certified release**: two frontend browser assertions still fail, and real database, provider, authorization and operational integrations remain open.

## Start the frontend on Windows

Double-click **[`start.bat`](start.bat)** in the repository root. It checks Node.js/npm, installs the locked frontend dependencies when Vite is missing, and opens:

```text
http://127.0.0.1:5174/frontend-preview
```

Keep the console open; press **Ctrl+C** to stop. An occupied port causes a visible failure rather than silently choosing another port. The existing frontend manifest requires **Node 24.15.0 or later within 24.x, or Node 26+**, with npm on PATH. These are the repository's requirements, not a new production-toolchain selection.

**This launcher starts only the draft-only frontend preview.** It does not start the Go diagnostic host, databases, Kafka, provider integrations or the complete backend. Existing backend-dependent screens are not made operational by opening the preview. First-time dependency installation requires package-registry access.

Manual equivalent, from the repository root:

```sh
cd "front end"
npm ci
npm run dev:frontend -- --strictPort
```

Run `npm ci` in **`front end/`**, not the repository root. See [INC-014 launch verification](docs/delivery/INC-014_LOCAL_LAUNCH.md) and its [Excel evidence workbook](docs/delivery/INC-014_EVIDENCE.xlsx).

## 1. How much has been implemented?

| Measure | Evidence-backed position |
|---|---|
| Architecture scope | **262 work packages across 27 domains**, retaining F01–F18. |
| Latest published implementation | **INC-014 — structured frontend restoration and Windows preview launcher.** |
| Latest implementation commit inspected | `5de94732417fd364cca0812b1cdec0d53bd5b558` |
| Structured frontend source restoration | **All 238 archive paths present**; **233 byte-identical** to the registered ZIP; five newer tracked files preserved. This is source-restoration coverage, not product-completion percentage. |
| Frontend feature/parameter audit | **55 registered workspace entries, 231 parameters, 262 work-package references and 449 imports; zero audit errors.** Entries are not 55 completed production features. |
| Frontend local launch | Actual Windows launcher and browser smoke passed; HTTP 200, Implementation Center visible, no JavaScript page errors in that smoke. |
| Frontend production build | **Passed**; 2,921 modules transformed in the recorded Windows run. A build is not a deployment. |
| Frontend contract/component checks | **180 contract tests and three component tests passed.** |
| Frontend browser suite | **7 passed, 2 failed, 1 skipped**; not full browser acceptance. |
| Backend implementation | Published domains, helpers and adapters through **INC-013**, with scoped local verification; production bindings are not complete. |
| Last machine-readable contribution snapshot | `docs/delivery/status.json` still records **INC-013**: **25 contribution rows**, comprising 3 `In progress` and 22 `Blocked`. These are not 25 completed features or the full 262-row tracker. |
| Baseline work packages certified Done | **0 of 262 in the last contribution snapshot**; INC-014 explicitly certifies no additional parent task complete. |
| Connected customer Mission / production release | Not established by the recorded evidence. |
| Separate unpublished candidate | **INC-010 DynamoDB sender result-ledger adapter** remains outside `main`. |

**Code implementation, source publication, local tests, integration acceptance and production release are different milestones.** Zero certified-Done parents does not mean no code exists. The baseline requires implementation, automated acceptance, security/contract review, documentation and rollout/rollback evidence before a parent is Done. No evidence-backed overall coding-completion percentage is available; neither archive-path counts nor overlapping test runs measure the fraction of the business product completed.

**Evidence freshness:** the newer [INC-014 report](docs/delivery/INC-014_LOCAL_LAUNCH.md) supersedes the older frontend-import/build blockers for the restored structured snapshot. The existing [contribution projection](docs/delivery/status.json) and frontend evidence JSON still describe INC-013 and have not been refreshed by this README-only edit. Read them with the newer report, not as a live runtime status feed. The separate original-import snapshot/history in issue #1 remains outstanding.

The architecture's **10-million-tenant / 10-billion-logical-message-per-day** figures remain design targets, not measured capacity. Scope and acceptance definitions come from the [architecture source register](docs/architecture/SOURCE_REGISTER.json) and [original work-package index](docs/delivery/baseline-index.csv), not from the number of repository files.

## 2. Implemented and published source

The following areas have published source. Their remaining work is part of their current status, not optional future hardening.

| Area | Implemented contribution | Remaining integration / acceptance |
|---|---|---|
| Governance and traceability | Owner directives, main-only publication rules, source register, baseline IDs/dependencies, implementation guides and publication evidence. | Named reviews, baseline approvals and release evidence. |
| Structured frontend and local launcher | Complete registered frontend snapshot and original media restored alongside newer source; location-independent `start.bat`; locked dependency install, preview smoke and build recorded. | Two mission-draft browser failures, remaining browser/accessibility and backend integration acceptance; separate original-import history. |
| Frontend configuration foundations | Shared parameter validation, scoped session drafts, grouped navigation, parameter definitions and source-linked work-package inventories. | Configuration remains draft-only until authorized backend implementations are connected; no executed Mission or provider action is implied. |
| Implementation Center | Readiness/evidence, tenant-scope, status-outbox, egress and delivery-lifecycle panels; models distinguish stale, missing, mismatched and unknown observations. | Authenticated live-observation APIs and refreshed machine-readable contribution records; no automatic production-health claim. |
| Tenant/workspace/environment isolation | TypeScript scope domain and guarded read-only PostgreSQL scope adapter; scope, lifecycle and ownership checks. | Real identity/authorization service, database driver, RLS and isolation tests. |
| Signed placement | Go signed placement directory, snapshot validation, expiry/version/epoch/tombstone checks and F03 binder composition. | Authoritative controller, durable checkpoints, approved trust distribution/revocation and restart/restore tests. |
| Development-status persistence | Status domain plus `PostgresStatusRepository`: scoped status/history/outbox transaction, expected-version checks and same-key receipt recovery. | Actual PostgreSQL/NestJS/authentication wiring and database crash/concurrency acceptance. |
| Status-event outbox | Scoped fact resolution, bounded pending reads, publish/acknowledge/mark relay, payload/identity checks and restartable sweeps. | Approved Kafka mapping/client, quorum evidence, CDC and live recovery scheduling. |
| Provider-ingress foundation | F03 verification/parse/bind/commit-all/acknowledge ordering, raw-proof primitives and effect-before-offset boundaries. | Official provider fixtures, real parsers, quarantine/routing and Kafka integration. This is not completed Meta/Telegram onboarding. |
| Health, encryption, logging and recovery | Freshness-aware readiness, scoped AES-256-GCM envelope primitive, bounded structured telemetry and ordered recovery guards. | KMS/identity bindings, collectors, durable audit, intrusion monitoring, independent backups, restore drills and host-integrity evidence. |
| F07 signing and SDK verification | Go signing plus Node/TypeScript and Python exact-byte signature verifiers; timestamp, key-version, rotation/revocation and duplicate-header checks. | Production endpoint/key lifecycle, real vault integration and independent acceptance. |
| F07 outbound network boundary | Proxy-side HTTPS destination checks, all-answer DNS validation, validated-IP connection, TLS verification, bounded responses and no redirects/transparent retries. | Deployed restricted proxy/network policy, current Action Gateway permits and actual sender attempt/result storage. |
| F07 retry and result recording | Versioned retry decisions, bounded delay/jitter and Retry-After; preserve endpoint acceptance and UNKNOWN; verify matching acknowledged result receipts. | Production sender ledger, due scheduler, fairness, reconciliation and authorized worker bindings. |
| Authenticated event-body identity | Go, TypeScript and Python helpers bind the event header to `event_id` inside the signed body; bounded duplicate-aware parsing and exact-byte preservation. | Complete event schemas, subscriptions, object/purpose authorization and durable replay prevention. |
| Receiver HTTP adapter | Required Keys/Gate/Inbox ports, bounded admission/body/headers/deadlines, exact receipt before HTTP 204, correlated stage reports and graceful drain. | Real key, schema/authorization and transactional receiver Inbox bindings; reviewed hosting and full sandbox acceptance. |

The sender's **WebhookDelivery ledger** and the customer's **receiver Inbox** are different storage boundaries. The receiver adapter does not replace unpublished INC-010. Test-only stores and authorization adapters are not production persistence or production permission checks.

## 3. Frontend restoration, working preview and known failures

INC-014 recovered the supplied structured-v1 ZIP with the registered SHA-256, restored 232 missing archive files plus the supplied lockfile, and preserved newer repository work. All 238 archive paths are present; the five intentionally different existing files are:

```text
src/contracts/types.d.ts
src/features/implementation/ImplementationCenter.jsx
src/shared/forms/validation.js
src/shared/state/drafts.js
src/shared/ui/PageLayout.jsx
```

The restored source inventory organizes **55 workspace entries: 29 existing screens, 25 configuration pages and one Implementation Center**, across nine navigation groups. It documents **231 parameters**. These counts describe source inventory, not completed backend capabilities. The isolated preview uses synthetic scope, permits draft configuration review and does not make legacy live-integrated screens into fake working screens.

Useful frontend handoff records are [feature ownership/routes](front%20end/docs/FEATURE_MAP.md), [parameter definitions](front%20end/docs/PARAMETERS.md), [implementation order](front%20end/docs/IMPLEMENTATION_ORDER.md), [API inventory](front%20end/docs/API_INVENTORY.md) and [component inventory](front%20end/docs/COMPONENT_INVENTORY.md). Inventoried functions are not proof that their server endpoints are available.

### Recorded INC-014 checks

| Check | Recorded result and limit |
|---|---|
| Dependency installation | Node 24.18.0 / npm 11.16.0 on Windows; 263 packages installed without lockfile changes. An esbuild install-script policy warning was recorded; no policy setting was changed. |
| `npm run audit:frontend` | 55 entries, 231 parameters, 262 work packages, 449 imports; zero errors. |
| `npm run test:contracts` | 180 passed; zero failed/skipped. |
| `npm test` | Two files, three component tests passed. |
| `npm run build` | Passed; 2,921 modules transformed. |
| `npm run test:e2e` | Seven passed, two failed, one skipped. |
| Actual Windows launcher and smoke | Launched from outside the repository; loopback port 5174; HTTP 200, Implementation Center visible and zero page errors in the smoke. Test server stopped afterwards. |

**Known browser failures:** both are the mission-draft reload assertion at `e2e/frontend/frontend.spec.js:24`, on desktop and mobile: expected `example-ref`, received `Appointment follow-up`. The skipped test is mobile navigation on the desktop project. This README does not decide whether the expectation or application behavior should change, and does not waive either failure. The test suite and application were left unchanged by INC-014.

A passing production build and preview smoke do not mean every source screen or full user journey has passed. The original live-integration harness, complete backend/provider environment and independent accessibility/security acceptance remain open. The recorded Windows tooling is not a newly qualified production image.

**Framework position:** the existing React/Vite frontend is retained. The architecture's React/TypeScript/Next.js target is not reported as implemented; **UX-001 remains open**. See the supplied [frontend compatibility ADR](front%20end/docs/ADR-0001.md). No framework migration is authorized by this documentation update.

Sources: [INC-014 report](docs/delivery/INC-014_LOCAL_LAUNCH.md), [INC-014 Excel evidence](docs/delivery/INC-014_EVIDENCE.xlsx), [frontend publication update](front%20end/docs/publication/STATUS.md). Earlier source-package guides and INC-013 records may retain historical missing-import/build statements; they do not negate the newer restoration evidence.

## 4. Published milestones and historical test evidence

These are **scoped historical runs**, not tests rerun by this README update. Later runs can contain earlier regressions, and language conformance deliberately repeats shared cases. Do not sum this table into a unique-test total or an implementation percentage. Published reports take precedence over counts in older unpublished packages.

| Milestone | Published scope | Recorded evidence |
|---|---|---|
| Initial frontend helpers and backend foundation | Validation/drafts, ingress/event boundaries, security/health/recovery primitives, contracts and status domain. | [Foundation verification and open gates](docs/delivery/VERIFICATION.md). |
| PLT-004 signed placement | Signed placement directory and ingress binder. | [Implementation](docs/delivery/PLT-004-IMPLEMENTATION.md) and [verification](docs/delivery/PLT-004-verification.json). |
| INC-003 + INC-005 | Tenant-scope source published with atomic development-status persistence. | **150** scoped tests including regressions/projection checks; strict TypeScript and two JSX syntax checks. [Publication](docs/delivery/INC-005_PUBLICATION.json). |
| INC-006 | Development-status outbox relay and inspection. | **142**: 49 new outbox, 15 frontend, 75 tenant regressions and three projection checks. [Verification](docs/delivery/INC-006_VERIFICATION.json). |
| INC-007 | F07 signing and verification SDKs. | **181**: Go 60, Node 65, Python 56; six shared signature vectors. [Verification](docs/delivery/INC-007_VERIFICATION.json). |
| INC-008 | Proxy-side egress and frontend view. | **184**: Go 159, frontend 25; Go race/vet passed. [Verification](docs/delivery/INC-008_VERIFICATION.json). |
| INC-009 | Retry planner, result recorder and delivery panel. | **130** in the published report: Go 104, frontend 26; Go race/vet passed. [Verification](docs/delivery/INC-009_VERIFICATION.json). |
| INC-011 | Go authenticated event-body identity. | **66** named tests; four separate fuzz seeds; 98.3% package statement coverage. [Verification](docs/delivery/INC-011_VERIFICATION.json). |
| INC-012 | TypeScript/Python body identity and Go conformance. | **246 executions**: 74 shared cases in three languages plus 24 runtime-specific tests; outputs identical; strict TypeScript passed. [Verification](docs/delivery/INC-012_VERIFICATION.json). |
| INC-013 | Receiver HTTP acknowledgement boundary. | **85** named tests, including five real local HTTP/TLS scenarios; Go race/vet/format passed; 95.7% package coverage. [Verification](docs/delivery/INC-013_VERIFICATION.json). |
| INC-014 | Complete registered frontend restoration and Windows preview launcher. | **180 contract tests + three component tests passed**; build/audit/smoke passed; browser **7 passed / 2 failed / 1 skipped**. [Report](docs/delivery/INC-014_LOCAL_LAUNCH.md). |

**INC-010 is not published.** Its locally tested DynamoDB sender adapter remains a retained candidate after a blocked test-file upload. Unreferenced Git objects do not make it part of `main`, and no production AWS SDK binding/table is established by the candidate. The missing increment number must not be interpreted as completed work.

The INC-013 wire scenarios exercise withheld success during a held commit, lost-acknowledgement recovery, concurrent duplicates, a stalled partial request and chunked/identity input. They use real local HTTP/TLS and signature code, but synthetic Keys/Gate/Inbox bindings. Frontend tests in INC-014 do not upgrade that synthetic storage evidence into live database acceptance.

## 5. API, data, security and full-product gaps

| Surface | Current position |
|---|---|
| OpenAPI / Swagger | [Initial OpenAPI contract](backend/contracts/openapi.json) contains documented schemas and implementation status. It is not proof of running endpoints or a hosted Swagger UI. |
| PostgreSQL | [Foundation schema](backend/db/migrations/0001_foundation.sql) remains an **unapplied draft** in the evidence. Adapter tests do not establish migrations, production roles or live RLS. |
| DynamoDB | [Table/access-pattern contracts](backend/contracts/dynamodb-tables.json) exist. Sender-ledger INC-010 remains unpublished; runtime/cloud integration is incomplete. |
| Kafka | [Policy contract](backend/contracts/kafka-policy.json), outbox and offset boundaries exist. Production broker/client, schema mapping, quorum verification and CDC integration are not established. |
| Backups and recovery | Recovery ownership and guards are documented/partially coded; independent backup resources, restore drills, erasure reapplication, writer fencing and measured RPO/RTO remain open. |
| Encryption and security | Cryptographic and telemetry primitives exist. Live KMS/key lifecycle, durable audit/SIEM, intrusion detectors, host Secure Boot evidence and independent security acceptance remain open. |
| Provider integrations | Published primitives and restored screens are not proof of complete WhatsApp, Instagram, Messenger or Telegram authorization, messaging, calling or provider approval. |
| Customer business application | End-to-end Missions, Action Gateway dispatch, Temporal workflows, AI/RAG, CRM synchronization, campaigns, commerce/payments, voice, billing, helpdesk and marketplace are not established as connected production features. Their baseline scope remains retained. |
| Release and capacity | No completed production release, global scale certification or provider volume approval is established by the recorded implementation evidence. |

[Recovery/security ownership](docs/architecture/RECOVERY_SECURITY.md) and [owner requirements](docs/requirements/OWNER_DIRECTIVES.md) govern these integrations. A standby is not a protected backup, a browser flag is not Secure Boot evidence, and a unit test is not security certification.

## 6. Pipeline and acknowledgement boundaries retained

**F03 provider callback:** bounded request -> route-owned proof -> bounded parsing -> authorized placement -> durable acceptance of all required slices -> provider HTTP acknowledgement -> asynchronous processing. No AI, CRM, search or backup round trip is inserted before acknowledgement.

**F07 customer webhook:** subscription match -> durable sender delivery record -> fair scheduling -> exact-byte signing -> restricted HTTPS delivery -> classified result and recorded retry/terminal/unknown state. Published components do not yet form a connected production sender.

**Opt-in customer receiver:** bounds/deadline -> registered keys -> exact body -> signature/event verification -> required schema/authorization Gate -> atomic Inbox acceptance -> exact receipt check -> offer HTTP 204. Real Keys, Gate and Inbox bindings are still required; no permissive fallback is installed.

Queue acceptance, provider acceptance, delivery/read evidence, customer-endpoint acceptance and verified business completion remain separate facts. UNKNOWN is not success or permission for a new automatic business action. Opening the frontend preview does not execute these pipelines. Main-only source publication does not waive their safety or release gates.

Details: [outbox](docs/delivery/INC-006_STATUS_OUTBOX.md), [signatures](docs/delivery/INC-007_WEBHOOK_SIGNATURES.md), [egress](docs/delivery/INC-008_WEBHOOK_EGRESS.md), [retry/result recording](docs/delivery/INC-009_WEBHOOK_LIFECYCLE.md), [receiver HTTP](docs/delivery/INC-013_RECEIVER_HTTP.md).

## 7. Reproduce local checks

### Frontend

From the repository root, after installing the locked dependencies:

```sh
cd "front end"
npm run audit:frontend
npm run test:contracts
npm test
npm run build
npm run test:e2e
```

Browser binaries must be available for Playwright. The isolated frontend suite uses its own configuration; the existing `test:e2e:legacy` script requires the original live-integration environment and was not executed in INC-014. The recorded two browser failures remain open. See [package scripts and engine constraints](front%20end/package.json).

### Backend foundations and SDKs

Run the relevant existing command from the repository root. Go, Python and, where applicable, Node/TypeScript must already be installed. These are local checks, not deployment commands or replacements for integration/release acceptance.

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

The existing **loopback-only diagnostic host**, separate from `start.bat`, is documented as:

```sh
cd backend
go run ./cmd/ingress
```

It binds `127.0.0.1:8090`. `/health/live` indicates process liveness; `/health/ready` and the unconnected provider callback route intentionally return `503`. The receiver HTTP package is not automatically registered. See [backend instructions](backend/README.md). INC-014 did not run this host because Go was unavailable in that Windows session.

**This README edit did not run application suites, install packages, change dependencies, fix the failing assertions, migrate data, send messages or deploy services.** The historical results above remain scoped to their reports.

## 8. Evidence locations and continuation rules

| Record | Purpose and freshness |
|---|---|
| [AGENTS.md](AGENTS.md) | Main-only delivery, no force-push, no overwritten concurrent work and required owner approval before pipeline changes. |
| [Owner directives](docs/requirements/OWNER_DIRECTIVES.md) | Scope, acknowledgement, security/recovery and function/parameter documentation requirements. |
| [Source register](docs/architecture/SOURCE_REGISTER.json) | Original architecture/plan artifacts, hashes and persistent retrieval locations. |
| [Original work-package index](docs/delivery/baseline-index.csv) | All baseline IDs, gates and predecessors; not a generated completion percentage. |
| [Repository contribution projection](docs/delivery/status.json) | **INC-013 snapshot**, with 25 partial contribution rows and zero certified-Done parents; older frontend blockers must be read with INC-014. |
| [Frontend contribution projection](front%20end/src/contracts/delivery-status.json) | Repository evidence used by the existing UI; not an automatic database-health feed. |
| [INC-014 report](docs/delivery/INC-014_LOCAL_LAUNCH.md) | Latest restored frontend, launcher, build, test failures and limits. |
| [INC-014 Excel evidence](docs/delivery/INC-014_EVIDENCE.xlsx) | Workbook delivered in the repository with preserved original baseline sheets; not claimed to have merged the separate Library's complete increment history. |
| [Delivery records](docs/delivery/) | Historical implementation guides, verification and publication manifests. |
| [Pipeline change-request template](front%20end/docs/publication/PIPELINE_CHANGE_REQUEST.md) | Specific proposal, tests/risks/rollback and explicit owner approval before a pipeline change. |

The original plans and registered structured frontend are retained in the **`/Greeto_Action_OS` Library workspace**. The separate Library tracker at **`/Greeto_Action_OS/delivery/Greeto_Action_OS_Delivery_Tracker_Updated.xlsx`** was last recorded through INC-013. INC-014 states that Library was not mounted in its session and delivers its additional evidence in the repository workbook above. This README update does not assert a Library overwrite or synchronized tracker history.

Outstanding work includes the two browser assertions and remaining UI acceptance; connecting authenticated live status; publishing the separate sender-ledger candidate; reviewed database/Kafka/key/authorization and receiver-Inbox bindings; demonstrating the architecture's complete customer Mission; and provider, security, recovery and release acceptance. The original frontend-import history remains separate from the restored structured snapshot. **This is a gap summary, not a reordered implementation plan.** Original dependencies and owner approvals govern scheduling; UX-001 and other parent gates remain open.

For each subsequent increment, record actual changes, tests and exclusions, remaining gates and the published commit; read back the remote reference before reporting delivery. Preserve earlier evidence, retain unpublished candidates separately, and refresh this README and the relevant status/tracker records without upgrading a parent task merely because one component exists.
