# Greeto / Customer Action OS

Mission-led SaaS for permitted messaging channels, customer operations, governed automation, AI and integrations.

**Implementation through INC-017 — 9 September 2026.** Latest verified source: `0b77d06f9a5f58f2d8ad1dfed263ca2383c842c0` on `main`. Source publication, local tests, integration acceptance and deployment are separate milestones.

> The registered structured frontend and media are restored; the INC-014 Windows preview and production build passed historically. Backend foundations and customer-webhook/SDK components through INC-013 are published; INC-015 strengthened scoped draft storage. **INC-016 added signup configuration preparation. INC-017 adds connection-attempt orchestration and callback correlation, with status in the same Channel Center panel. Live signup remains disabled until real host/store/vault bindings and the SDK bridge are qualified.** This is not yet a connected end-to-end or production-certified SaaS.

## 1. Latest step: Meta connection attempts and callback correlation

Read the [step-by-step implementation and parameters](docs/delivery/INC-017_META_SIGNUP_ATTEMPTS.md), [verification](docs/delivery/INC-017_VERIFICATION.json) and [publication manifest](docs/delivery/INC-017_PUBLICATION.json).

| Step | Implemented source | Remaining boundary |
|---|---|---|
| Begin an attempt | `SignupAttempts.begin` checks current authority and the unchanged configuration producer, generates state/nonce digests, and verifies the insert acknowledgement. | Real authenticated registry, transactional repository and launch/session host. No SDK is launched. |
| Correlate callbacks | `receive` accepts code/session fragments in either order, checks scope/session/actor/app/epoch and expiry, validates custody receipts and conditionally records the next revision. | The normalized fragment is not Meta's raw wire format or proof of provider consent. Actual SDK origin/window/CSRF bridge remains required. |
| Handle failures | Same-intent replay, conflicting intent, cancellation, expiry, concurrent CAS and uncertain acknowledgements have explicit outcomes. | Repository must atomically persist attempt/history/outbox; vault must encrypt custody. Synthetic test ports are not production bindings. |
| Show progress | Existing Meta panel displays only fresh, scoped, minimized observations. Code, nonce, state and vault/asset claims are not rendered. | Runtime supplies no attempt; launch/exchange remain disabled. |
| Verify | **93 named local tests passed: 65 backend + 28 frontend**; strict types, readonly consumer and one JSX syntax check. | Full React/browser, live DB/KMS/identity/Meta and independent security acceptance not run. |

The new domain is `backend/services/core/src/channels/meta/signup-attempt.ts`; its methods are `begin`, `receive`, `inspect` and `close`. Public progress is rendered by `front end/src/features/channels/meta/signup-attempt-model.mjs` inside the existing `MetaSignupSetupPanel.jsx`. The unchanged studio mount remains in Channel Center -> Configure. `CALLBACK_CORRELATED` means only that the two fragments are recorded; it does not authorize token exchange or activate any provider asset.

**Next bounded step:** the reviewed SDK/HTTP attempt bridge and real scoped transactional store/custody bindings, before an exchange-claim worker. Original prerequisites and public-contract/provider qualification remain mandatory. No general continue instruction approves a pipeline or release-gate change.

### Step 1 retained: configuration preparation (INC-016)

Read the [implementation and parameter guide](docs/delivery/INC-016_META_SIGNUP_CONFIGURATION.md), [verification](docs/delivery/INC-016_VERIFICATION.json) and [publication manifest](docs/delivery/INC-016_PUBLICATION.json).

| Step | Implemented now | Not implied |
|---|---|---|
| Validate configuration | Pure TypeScript helper checks exact scope/app/profile/revision, input shapes, enabled status and evidence expiry. | No authenticated registry, object authorization or actual provider eligibility is established by a verified string. |
| Build public login options | Adapts Meta's pinned computeEsConfig payload shape; explicit versions, code response and bounded feature list; deeply frozen result. | No SDK initialization, OAuth attempt, token exchange, number registration or permission grant. |
| Review in existing UI | Channel Center -> Configure shows MetaSignupSetupPanel, parameters when supplied, original F02 checklist and disabled launch. | Default runtime supplies no profile. No synthetic configuration is injected; prepared is not connected/READY. |
| Verify | **82 named tests passed: 50 backend + 32 frontend**; strict TypeScript and two JSX syntax checks passed. | No React render/build/browser, actual Meta account, database, Kafka or full-repository regression acceptance. |

The two-line mount in `FeatureStudioPage.jsx` preserves existing forms, navigation and design. Frontend tests run without a backend build. Backend tests additionally compose the real compiled producer with the frontend presentation model. The full MIT notice accompanies the adapted fragment; no sample dependency, theme, host or broker is imported.

To inspect the added panel after starting the preview, select **Channel Center -> Configure**, or open:

```text
http://127.0.0.1:5174/frontend-preview?feature=channel-center
```

Current code paths:

```text
backend/services/core/src/channels/meta/signup-configuration.ts
front end/src/features/channels/meta/signup-setup-model.mjs
front end/src/features/channels/meta/MetaSignupSetupPanel.jsx
```

**INC-017 builds on this preparation** with the attempt domain above; its real persistence and host bindings are still incomplete. Original WHA-003 prerequisites **PLT-008 and EVT-003**, and UX-005 prerequisite **PLT-001**, remain open. The adoption plan permits pure DTO fixtures and isolated disabled UI; it does not waive runtime activation gates.

## 2. Start the frontend on Windows

Double-click [`start.bat`](start.bat) in the root. It checks Node/npm, installs locked dependencies when Vite is missing, and opens the draft-only frontend on `127.0.0.1:5174`. Keep the console open; Ctrl+C stops it. A port conflict fails visibly. The existing manifest requires Node 24.15.0 or later within 24.x, or Node 26+, with npm on PATH. First installation requires registry access.

Manual equivalent:

```sh
cd "front end"
npm ci
npm run dev:frontend -- --strictPort
```

Run npm commands in `front end/`, not the root. The launcher does not start backend services, databases, Kafka or provider operations. Existing backend-dependent screens are not made live by opening the isolated preview. [INC-014 launch evidence](docs/delivery/INC-014_LOCAL_LAUNCH.md) and [its repository workbook](docs/delivery/INC-014_EVIDENCE.xlsx) document the historical Windows run.

## 3. How much is implemented?

| Measure | Evidence-backed position |
|---|---|
| Architecture | **262 work packages across 27 domains**; F01–F18 retained. |
| Frontend restoration | INC-014 restored **238 archive paths**; 233 matched the archive, five preserved newer files. This is restoration coverage, not product completion. |
| Registered frontend inventory | 55 workspace entries, nine navigation groups and 231 configuration fields. Additional INC-016 internal setup fields are documented separately, not silently added to this historical inventory count. |
| Historical INC-014 build and launch | Build passed (2,921 modules); actual Windows preview smoke returned HTTP 200, Implementation Center visible, no page errors. |
| Historical INC-014 tests | **180 contract + 3 component tests passed**; browser **7 passed / 2 failed / 1 skipped**. Not rerun in INC-016. |
| INC-015 | Draft save/load type, nested JSON, metadata and UTF-8-size checks; **138** scoped tests (68 existing + 70 new). |
| INC-016 | **12 source paths** including tests/docs/license and one two-line UI integration; **82 targeted tests**. Partial M02/M03 source adoption, not a completed Meta channel. |
| INC-017 | **9 source paths** (8 additions, 1 existing-panel change); **93 targeted tests**. Required real repository/authority/vault and SDK/HTTP bridge remain open. |
| Existing contribution rows | The original **25 rows** and their statuses/history remain unchanged: 3 In progress, 22 Blocked. New Meta child evidence is recorded separately in status.meta_adoption_increment and controls. |
| Certified parent completion | **0 of 262**. No original acceptance gate was waived. |
| Unpublished candidate | **INC-010 DynamoDB sender result-ledger** remains outside main. |
| Production / complete customer Mission | Not established by the evidence. |

Zero certified-Done parents does not mean no code exists. Done requires implementation, automated acceptance, security/contract review, documentation and rollout/rollback evidence. There is no evidence-backed overall coding percentage. Do not add overlapping test totals or convert restored path counts into business-product completion. The architecture's 10-million-tenant / 10-billion-message targets remain unmeasured design targets.

The [repository status](docs/delivery/status.json) and [frontend status](front%20end/src/contracts/delivery-status.json) now reference INC-017 with retained previous evidence. They describe source progress, not a live database/provider health feed.

## 4. Published modules and integration gaps

| Area | Published contribution | Still required |
|---|---|---|
| Governance | Baseline/source registers, owner directives, mappings, evidence and controlled changes. | Named approvals, independent reviews and release evidence. |
| Frontend | Structured source/media, grouped navigation, parameter contracts, Windows preview and scoped draft validation. | Current browser/accessibility/security acceptance and real APIs. React/Vite remains; UX-001 migration is open. |
| Implementation Center | Readiness, tenant-scope, outbox, egress and delivery-lifecycle views; explicit missing/stale/unknown observations. | Authenticated live observation APIs. |
| Meta preparation / attempts | Scoped configuration; server-attempt orchestration with conditional callbacks, expiry and receipts; existing-panel progress. | Real registry/identity/store/vault, reviewed SDK/HTTP bridge, exchange/grants/binding and original F02 operations. |
| Tenant isolation / placement | TypeScript scope domain, guarded PostgreSQL reads, signed directory and F03 binder. | Real identity/OPA, driver/RLS, controller/checkpoints, trust and recovery integration. |
| Status persistence / outbox | Scoped status/history/outbox transactions, versions/retry receipts, publish/ACK/mark and bounded sweeps. | Actual PostgreSQL/NestJS, Kafka mapping/client/quorum, CDC and crash/concurrency tests. |
| Provider ingress | F03 proof/parse/bind/commit-all/ACK and effect-before-offset primitives. | Official provider fixtures, complete parsers, quarantine, routing and Kafka binding. |
| Health/security/recovery | Freshness-aware readiness, AES-256-GCM primitive, bounded telemetry and recovery guards. | KMS, durable audit/SIEM, detectors, independent backups, restore drills and observed Secure Boot. |
| Customer webhooks / SDKs | Go signing, Node/TypeScript/Python raw-byte and event identity verification; restricted egress; retry/result semantics. | Actual endpoint/key lifecycle, sender ledger/scheduler, permits and live isolation tests. |
| Receiver HTTP | Required Keys/Gate/Inbox ports, deadlines, exact receipt before 204, diagnostics and draining. | Actual transactional Inbox, current keys, full schema/object authorization and reviewed hosting. |

Sender WebhookDelivery and customer receiver Inbox are separate stores; receiver code does not replace unpublished INC-010. Synthetic test stores/permissions are not runtime persistence or authority. The initial [OpenAPI](backend/contracts/openapi.json) is not proof of running endpoints or hosted Swagger. [SQL migration](backend/db/migrations/0001_foundation.sql) remains an unapplied draft; [DynamoDB](backend/contracts/dynamodb-tables.json) and [Kafka](backend/contracts/kafka-policy.json) contracts require runtime qualification.

End-to-end Missions, Action Gateway execution, Temporal, AI/RAG, CRM, campaigns, commerce/payments, calling, billing, support and marketplace scope remain in the plan, not claimed operational by helpers. See [recovery/security ownership](docs/architecture/RECOVERY_SECURITY.md).

## 5. Historical milestones and tests

Separate scoped runs can overlap. Counts below are not a cumulative unique-test total and were not all rerun in INC-017. Full reports retain each limitation.

| Milestone | Recorded evidence |
|---|---|
| Foundation | [Primitives, contracts and open gates](docs/delivery/VERIFICATION.md). |
| Signed placement | [Implementation](docs/delivery/PLT-004-IMPLEMENTATION.md), [verification](docs/delivery/PLT-004-verification.json). |
| INC-003 + INC-005 | Tenant/status persistence, **150** scoped checks. [Publication](docs/delivery/INC-005_PUBLICATION.json). |
| INC-006 | Status outbox, **142** including regressions. [Verification](docs/delivery/INC-006_VERIFICATION.json). |
| INC-007 | Signing/SDKs, **181** (Go 60, Node 65, Python 56). [Verification](docs/delivery/INC-007_VERIFICATION.json). |
| INC-008 | Egress/UI, **184** (Go 159, frontend 25). [Verification](docs/delivery/INC-008_VERIFICATION.json). |
| INC-009 | Retry/receipt/UI, **130** in the published report. [Verification](docs/delivery/INC-009_VERIFICATION.json). |
| INC-011 | Go event identity, **66** named + four separate seeds. [Verification](docs/delivery/INC-011_VERIFICATION.json). |
| INC-012 | SDK conformance, **246 executions**: 74 common cases x 3 plus 24 language-specific; identical shared outputs. [Verification](docs/delivery/INC-012_VERIFICATION.json). |
| INC-013 | Receiver HTTP, **85** named including five real local HTTP/TLS cases; synthetic Keys/Gate/Inbox. [Verification](docs/delivery/INC-013_VERIFICATION.json). |
| INC-014 | Restoration/launcher; audit/build/smoke and **180 + 3** tests passed; browser **7/2/1**. [Report](docs/delivery/INC-014_LOCAL_LAUNCH.md). |
| INC-015 | Draft boundaries, **138** Node tests. [Verification](docs/delivery/INC-015_VERIFICATION.json). |
| META-REF-001 | Source reference14703a3 and 22-slice adoption mapping; not an executed integration. [Plan](docs/architecture/META_SAMPLE_ADOPTION_PLAN.md). |
| INC-016 | Configuration preparation, **82** targeted tests, strict types and two JSX syntax checks. [Verification](docs/delivery/INC-016_VERIFICATION.json). |
| INC-017 | Attempt lifecycle/correlation, **93** tests (65 backend, 28 frontend), strict types and one JSX syntax check. [Verification](docs/delivery/INC-017_VERIFICATION.json). |

INC-014 used Windows Node24.18.0/npm11.16.0, without lockfile changes. INC-015 and INC-016 used Node22.16.0 for scoped dependency-free tests only; INC-016 used TypeScript5.8.3. These observed tools do not change the frontend's required engine or qualify a production image.

### Existing browser correction still requires approval

The Mission fixture fills `Appointment follow-up` but expects `example-ref` after reload. The proposed change explicitly enters `example-ref` before saving, retaining all assertions. It remains **unapplied**; the two browser failures have not been waived. See [specific pending review](docs/delivery/INC-015_BROWSER_ASSERTION_REVIEW.md). No existing test expectations, feature defaults or dependency versions changed in INC-016.

## 6. Meta sample adoption and unchanged pipelines

Pinned source: `fbsamples/business-messaging-sample-tech-provider-app` at `14703a3e1fdba9bcf75b2360b00817b6fcc9f79b`. Read the [adoption plan](docs/architecture/META_SAMPLE_ADOPTION_PLAN.md), [targeted source register](docs/architecture/META_SAMPLE_REFERENCE.json) and [22-slice mapping to 53 original work packages](docs/delivery/META_SAMPLE_ADOPTION_MATRIX.csv). That CSV is the original planning snapshot; INC-016/017 guides and current status record partial M02/M03/M04 contributions. No complete adoption slice is certified integrated.

The source review remains targeted, not a whole-repository audit. No upstream sample build/test run or real Meta account verification occurred. Current implementation/version documentation requests returned HTTP429. The fixture's version strings are test values, not a newly approved production profile. The adapted construction fragment retains [Meta's MIT notice](docs/architecture/licenses/META_SAMPLE_MIT.txt). Auth0/Ably/Neon/Vercel/Next.js sample infrastructure is not adopted over Greeto.

**F02:** server attempt/state/nonce -> provider consent -> callback validation -> exchange/vault -> verified grants -> asset binding -> subscription -> route-specific number setup -> capability/restriction/billing -> authorized test -> readiness. Configuration preparation neither completes nor reorders these steps.

**F03:** bounds -> route-owned proof -> parse every required element -> authorized placement -> durable Kafka acceptance of all required slices -> HTTP ACK -> asynchronous processing. No inline reply, AI, CRM, backup or remote health round trip before ACK.

**F05/F10:** durable idempotent command -> approved lane/scheduler -> current Action Gateway checks -> provider request -> persisted result/UNKNOWN -> later delivery and outcome evidence. No direct sample send-route bypass.

**F07:** durable delivery -> fair scheduling -> exact-byte signing -> restricted HTTPS -> classified/recorded result. Receiver bounds/keys/proof/Gate/atomic Inbox/exact receipt precede its offered204. Real bindings remain required. Calling stays at its F15/G3 eligibility gate.

Queue, provider, delivery/read, endpoint and business acknowledgements remain distinct. No existing F01–F18 order, public API, authentication flow, dependency, migration, infrastructure or release gate changed in INC-016.

## 7. Reproduce checks and continue

Frontend, with existing locked dependencies and compatible engine:

```sh
cd "front end"
npm run audit:frontend
npm run test:contracts
npm test
npm run build
npm run test:e2e
```

Playwright binaries are required. `test:e2e:legacy` needs the original live integration environment. Targeted tests are not replacements for failing browser or release gates.

From the repository root, with the existing required tools:

```sh
python tools/check_meta_signup_attempts.py
python tools/check_meta_signup_configuration.py
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

The separate diagnostic host is `cd backend` then `go run ./cmd/ingress`, documented on `127.0.0.1:8090`; process liveness is not readiness. Its unconnected callback/readiness remain503; no automatic receiver/Meta signup registration. See [backend README](backend/README.md).

Before further implementation read [AGENTS.md](AGENTS.md), [owner directives](docs/requirements/OWNER_DIRECTIVES.md), [source register](docs/architecture/SOURCE_REGISTER.json), [baseline index](docs/delivery/baseline-index.csv), [current status](docs/delivery/status.json) and the current guide. Frontend [routes](front%20end/docs/FEATURE_MAP.md), [parameters](front%20end/docs/PARAMETERS.md), [implementation order](front%20end/docs/IMPLEMENTATION_ORDER.md), [API inventory](front%20end/docs/API_INVENTORY.md), [component inventory](front%20end/docs/COMPONENT_INVENTORY.md) and [React/Vite ADR](front%20end/docs/ADR-0001-react-vite-compatibility.md) retain their defined roles.

Original plans and the canonical Excel tracker remain in `/Greeto_Action_OS` Library; tracker path `/Greeto_Action_OS/delivery/Greeto_Action_OS_Delivery_Tracker_Updated.xlsx`. The tracker now carries INC-016 historical publication separately from INC-017 evidence; earlier delivery records remain historical evidence. Preserve all262 IDs, statuses, prerequisites, acceptance criteria and prior evidence; append contributions rather than marking a parent Done on mock tests.

Use main only, no force-push and no overwritten concurrent work. Before changing a pipeline/API/authority/dependency/release gate, submit a [specific change request](front%20end/docs/publication/PIPELINE_CHANGE_REQUEST.md) and obtain the owner's approval. A general continue instruction is not a waiver. Published source is not production deployment.
