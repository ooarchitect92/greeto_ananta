# Greeto / Customer Action OS

Mission-led SaaS for permitted messaging channels, customer operations, governed automation, AI and integrations.

**Implementation through INC-018 — 9 September 2026.** Latest verified source on `main`: `57b305a5edebecc9bb39e038d82f9fc5d95273e3`. Source publication, local tests, integration acceptance and production deployment are separate milestones.

> The structured frontend/media are restored, with historical INC-014 Windows preview/build evidence. Backend foundations and customer-webhook/SDK components through INC-013 are published. INC-015 hardened frontend drafts; INC-016 prepared Meta signup configuration; INC-017 added server attempt orchestration. **INC-018 adds attempt-local callback collection and host-handoff code, with read-only status in the same Channel Center. Live Meta signup remains disabled.** This is not yet a connected end-to-end or production-certified SaaS.

## 1. Latest implementation: Meta adoption step 3

[Implementation and parameter guide](docs/delivery/INC-018_META_CALLBACK_BRIDGE.md) · [Verification](docs/delivery/INC-018_VERIFICATION.json) · [Publication](docs/delivery/INC-018_PUBLICATION.json)

| Step | Implemented source | Remaining boundary |
|---|---|---|
| Bind one attempt | `bindSignupCallbacks` requires the existing attempt ticket, exact scope, selected origin and owned message source before reading message data. SDK callbacks stay attempt-local. | Actual supported Meta WindowProxy/SDK host qualification. No first-message trust, global callback variables or popup monkeypatch is used. |
| Decode bounded input | Code extraction and session-field mapping preserve string IDs, reject duplicate/oversized/malformed data and require an explicit reviewed event profile. | Current provider wire/account evidence. Missing business_id is not guessed, and asset IDs remain unverified claims. |
| Record through host | Two bounded fragment slots, one active host call, exact minimized receipt checks and explicit same-fragment retry after uncertainty. | Actual authenticated same-origin HTTP controller, CSRF/session mapping, scoped transactional store and encrypted custody. No fetch route is implemented here. |
| Stop and recover safely | Cancellation waits for active recording; only a matching host receipt is acknowledged. Disposal/expiry detach locally without pretending server rollback. | Real server cleanup, durability, fencing and recovery tests. |
| Show stepwise status | Existing Channel Center panel adds step 3 using the same components and styles. | No live bridge instantiated, SDK loaded or launch/retry button enabled. |
| Verify | **162 named tests: 134 new + 28 unchanged INC-017 frontend regressions**, zero failures/skips; three JS syntax checks, one JSX parse and strict TypeScript consumer declarations. | Not a strict TS source build, React render, real browser/SDK, HTTP/backend, DB/KMS or full-repository regression run. |

New owning modules are in `front end/src/features/channels/meta/`: `signup-callback-parser.mjs`, `signup-callback-bridge.mjs`, its `.d.mts` consumer contract, and `signup-callback-view.mjs`. `MetaSignupSetupPanel.jsx` is the only existing application file modified. Backend attempt/configuration sources and prior test expectations are unchanged.

The host transport is a required private interface, not a completed API. It must authenticate and authorize the current session, enforce CSRF, restore the server-owned correlation channel, then invoke the existing INC-017 methods. Browser receipt inspection is defense-in-depth, not authority. A locally `recorded` callback is not exchanged credentials, verified grants or channel READY.

### Steps 1 and 2 remain in place

**INC-016:** `prepareSignupConfiguration` in `backend/services/core/src/channels/meta/signup-configuration.ts` checks the scoped app/profile/revision and qualified evidence before building sample-shaped public login options. No default production version, permission or live registry is invented. [Guide](docs/delivery/INC-016_META_SIGNUP_CONFIGURATION.md).

**INC-017:** `SignupAttempts` in `backend/services/core/src/channels/meta/signup-attempt.ts` exposes `begin`, `receive`, `inspect` and `close`. State/nonce digests, actor/session/app/epoch binding, either callback order, exact persistence/custody acknowledgements and cancellation/expiry are implemented through mandatory adapters. Its repository/authority/vault bindings are still not connected. [Guide](docs/delivery/INC-017_META_SIGNUP_ATTEMPTS.md).

Original prerequisites remain WHA-003/WHA-004 <- PLT-008, EVT-003; UX-005 <- PLT-001. Pure adapters and disabled UI do not promote parent acceptance or permit runtime activation.

## 2. Start the frontend

On Windows, double-click [`start.bat`](start.bat). It checks Node/npm, installs locked dependencies when Vite is missing, and launches the draft-only preview. Keep the console open; Ctrl+C stops it. Port conflicts fail visibly. The existing frontend manifest requires Node 24.15.0 or later within 24.x, or Node 26+, with npm on PATH; first installation needs registry access. No version was changed by this increment.

```sh
cd "front end"
npm ci
npm run dev:frontend -- --strictPort
```

Open Channel Center -> Configure, or:

```text
http://127.0.0.1:5174/frontend-preview?feature=channel-center
```

The preview supplies no synthetic configuration, attempt or callback observation. It does not start backend services, Kafka, databases, OAuth or provider operations. [INC-014 Windows report](docs/delivery/INC-014_LOCAL_LAUNCH.md) and [its evidence workbook](docs/delivery/INC-014_EVIDENCE.xlsx) remain historical records, not a current browser rerun.

## 3. How much is implemented?

| Measure | Recorded evidence |
|---|---|
| Baseline | **262 work packages / 27 domains**, original F01–F18 retained. |
| Structured frontend restoration | **238 archive paths** in INC-014: 233 archive-identical and five newer tracked implementations preserved. This is source coverage, not product completion. |
| Frontend inventory | 55 workspace entries, nine navigation groups and 231 configuration fields. Internal Meta adapter fields are documented separately. |
| Historical frontend acceptance | INC-014 build passed (2,921 modules), actual Windows smoke HTTP 200; **180 contract + 3 component tests passed**; browser **7 pass / 2 fail / 1 skip**. Not rerun by INC-018. |
| Latest source | **12 changed paths**, 134 new tests plus 28 unchanged frontend regressions. Actual SDK/HTTP/server/store integration remains open. |
| Existing contribution projection | 25 retained rows: 3 In progress and 22 Blocked. New Meta child evidence is separate; rows are not completed features. |
| Certified parent completion | **0 of 262**; implementation, automated acceptance, independent security/contract review and rollout evidence are all required. |
| Unpublished candidate | **INC-010 DynamoDB sender result-ledger** remains outside `main`. |
| Complete customer Mission / production | Not established by the evidence. |

Zero certified-Done parents does not mean no source code exists. No evidence-backed overall coding percentage is available. Do not add overlapping test totals or convert file counts to business completion. The 10-million-tenant / 10-billion-message scale figures remain unmeasured design targets.

[Repository status](docs/delivery/status.json) and [frontend status](front%20end/src/contracts/delivery-status.json) share identical INC-018 data and retain historical items, stages, approvals and evidence. They report published source, not live runtime health.

## 4. Published modules and integration gaps

| Area | Published implementation | Still required |
|---|---|---|
| Governance and UI | Source registers, controlled changes, grouped navigation, parameter contracts, restored media, scoped draft validation and Implementation Center panels. | Named approvals, current browser/accessibility/security acceptance, live observation APIs; UX-001 framework migration remains open. |
| Meta onboarding | Scoped configuration, server attempt domain, callback parser/collector and minimized existing-design status. | Current provider/window profile, identity/registry, HTTP/CSRF mapping, actual attempt/custody stores, exchange/grants/assets/subscriptions and permitted account tests. |
| Tenant isolation / placement | Scoped TS domain, guarded PostgreSQL reads, signed directory and F03 binder. | Actual identity/OPA, driver/RLS, authoritative controller/checkpoints and recovery qualification. |
| Status persistence / outbox | Scoped status/history/outbox transactions, versions/retry receipts, bounded publish/ACK/mark and pending sweeps. | Real PostgreSQL/NestJS, Kafka client/schema/quorum, CDC and crash/concurrency acceptance. |
| Provider ingress | F03 proof/parse/bind/commit-all/ACK and effect-before-offset boundaries. | Official complete provider parsers/fixtures, quarantine/routing and live Kafka binding. |
| Security / operations | Freshness-aware readiness, AES-256-GCM primitive, bounded telemetry and recovery guards. | KMS, durable audit/SIEM, detectors, protected independent backups, measured restore drills and observed host Secure Boot. |
| Customer webhooks / SDKs | Go signing, Node/TS/Python verification, signed-body identity, restricted egress, retry/result orchestration. | Real key lifecycle, sender ledger/scheduling, permits, provider/receiver network and isolation tests. |
| Receiver HTTP | Keys/Gate/Inbox interfaces, bounded requests/deadlines, exact receipt before 204, diagnostic reports and draining. | Actual transactional Inbox, complete schema/object checks, vault/identity and reviewed receiver hosting. |

Sender WebhookDelivery and the customer receiver Inbox are different boundaries; receiver work does not replace INC-010. Synthetic test ports are not production bindings. [OpenAPI](backend/contracts/openapi.json) is not a running endpoint/Swagger host. [SQL migration](backend/db/migrations/0001_foundation.sql) remains unapplied; [DynamoDB](backend/contracts/dynamodb-tables.json) and [Kafka](backend/contracts/kafka-policy.json) contracts need runtime qualification.

End-to-end Missions, Action Gateway execution, Temporal, AI/RAG, CRM, campaigns, commerce/payments, calling, billing, support and marketplace remain retained scope, not operational features certified by these helpers. [Recovery/security ownership](docs/architecture/RECOVERY_SECURITY.md) and [owner directives](docs/requirements/OWNER_DIRECTIVES.md) remain mandatory.

## 5. Historical milestones — separate scoped test runs

| Milestone | Evidence |
|---|---|
| Foundation | [Primitives/contracts/open gates](docs/delivery/VERIFICATION.md). |
| Signed placement | [Implementation](docs/delivery/PLT-004-IMPLEMENTATION.md), [verification](docs/delivery/PLT-004-verification.json). |
| INC-003 + INC-005 | Tenant/status store, 150 scoped checks. [Publication](docs/delivery/INC-005_PUBLICATION.json). |
| INC-006 | Outbox, 142 checks including regressions. [Verification](docs/delivery/INC-006_VERIFICATION.json). |
| INC-007 | Signing/SDKs, 181 tests. [Verification](docs/delivery/INC-007_VERIFICATION.json). |
| INC-008 | Egress/UI, 184 tests. [Verification](docs/delivery/INC-008_VERIFICATION.json). |
| INC-009 | Retry/receipt/UI, 130 published tests. [Verification](docs/delivery/INC-009_VERIFICATION.json). |
| INC-011 | Go body identity, 66 named tests and four separate seeds. [Verification](docs/delivery/INC-011_VERIFICATION.json). |
| INC-012 | SDK conformance, 246 executions: 74 shared cases in three languages plus 24 runtime-specific tests. [Verification](docs/delivery/INC-012_VERIFICATION.json). |
| INC-013 | Receiver HTTP, 85 tests including five local HTTP/TLS cases; synthetic storage/authority. [Verification](docs/delivery/INC-013_VERIFICATION.json). |
| INC-014 | Source/media restoration, Windows launcher/build; 180 + 3 tests; browser 7/2/1. [Report](docs/delivery/INC-014_LOCAL_LAUNCH.md). |
| INC-015 | Draft validation, 138 tests. [Verification](docs/delivery/INC-015_VERIFICATION.json). |
| META-REF-001 | Pinned source and 22 adoption slices mapped to 53 original tasks. [Plan](docs/architecture/META_SAMPLE_ADOPTION_PLAN.md). |
| INC-016 | Configuration, 82 tests (50 backend + 32 frontend). [Verification](docs/delivery/INC-016_VERIFICATION.json). |
| INC-017 | Attempts, 93 tests (65 backend + 28 frontend). [Verification](docs/delivery/INC-017_VERIFICATION.json). |
| INC-018 | Callback bridge, 162 tests (134 new + 28 unchanged frontend). [Verification](docs/delivery/INC-018_VERIFICATION.json). |

These runs overlap and are not a cumulative unique-test count. They were not all rerun in INC-018. The current run used Node 22.16.0 and TypeScript 5.8.3 for dependency-free checks; this does not change the frontend engine or qualify a production image. TypeScript checked consumer declarations, not the JavaScript source as strict TS. Native-window/event and host metadata in the Node tests are synthetic; real WebCrypto is used.

### Pending browser correction is unchanged

The Mission fixture fills `Appointment follow-up` but expects `example-ref` after reload. The proposed correction explicitly fills `example-ref`, retaining assertions. It is **not applied** and the two failures are not waived. [Specific owner review](docs/delivery/INC-015_BROWSER_ASSERTION_REVIEW.md) remains pending; no existing test expectations/defaults changed.

## 6. Meta reference and unchanged pipelines

Reference: `fbsamples/business-messaging-sample-tech-provider-app` at `14703a3e1fdba9bcf75b2360b00817b6fcc9f79b`. [Adoption plan](docs/architecture/META_SAMPLE_ADOPTION_PLAN.md), [targeted source review](docs/architecture/META_SAMPLE_REFERENCE.json), [original adoption matrix](docs/delivery/META_SAMPLE_ADOPTION_MATRIX.csv) and [retained MIT notice](docs/architecture/licenses/META_SAMPLE_MIT.txt).

The original matrix is a planning snapshot; current guides/status record partial M03/M04 work, not complete integrated slices. This was a targeted source review, not execution of the sample's whole application/test suite. Current Meta documentation retrieval failed again on 9 September 2026; exact SDK source identity, terminal event/version profiles, optional products and account eligibility remain unqualified. No third-party mirror, hardcoded latest version, Auth0/Ably/Neon/Vercel/Next.js stack replacement or popup interception is adopted.

**F02:** server attempt/state/nonce -> provider consent -> callback validation -> exchange/vault -> grants -> asset binding -> subscription -> route-specific phone setup -> capability/restriction/billing -> authorized test -> readiness. Callback collection does not bypass server checks or launch exchange.

**F03:** bounds -> route-owned proof -> every required element parsed -> authorized placement -> durable Kafka acceptance of all required slices -> HTTP ACK -> asynchronous processing. No AI/CRM/inline reply/backup/remote health round trip before ACK.

**F05/F10:** durable idempotent command -> approved lane/scheduler -> current Action Gateway -> provider request -> recorded result/UNKNOWN -> later delivery and outcome evidence. No direct sample-route bypass.

**F07:** durable delivery -> fair scheduling -> exact-byte signing -> restricted HTTPS -> classified/recorded result. Customer receiver verification/Gate/atomic Inbox/exact receipt precedes its offered 204. Real bindings remain required. F15 calling stays at its eligibility/release gate.

Queue, provider, delivery/read, endpoint and business acknowledgements remain distinct. INC-018 changes no public API, backend schema, dependency, migration, authentication flow, deployment or original release gate. It supplies an opt-in adapter, not an activated runtime path.

## 7. Reproduce and continue

```sh
python tools/check_meta_signup_callback_bridge.py
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

Run only the relevant checks; required tools must already exist. Commands are not installation/deployment approval. Frontend checks, with locked dependencies and compatible engine:

```sh
cd "front end"
npm run audit:frontend
npm run test:contracts
npm test
npm run build
npm run test:e2e
```

Playwright browsers are required. The legacy E2E suite needs its original integration environment. Targeted tests do not replace browser/release gates. The separate diagnostic host is `cd backend` then `go run ./cmd/ingress`, documented on `127.0.0.1:8090`; liveness is process-only and unconnected readiness/callback return 503. It does not mount Meta onboarding. [Backend instructions](backend/README.md).

Before continuation read [AGENTS.md](AGENTS.md), [owner directives](docs/requirements/OWNER_DIRECTIVES.md), [source register](docs/architecture/SOURCE_REGISTER.json), [baseline index](docs/delivery/baseline-index.csv), [current status](docs/delivery/status.json) and the current guide. Frontend [routes](front%20end/docs/FEATURE_MAP.md), [parameters](front%20end/docs/PARAMETERS.md), [implementation order](front%20end/docs/IMPLEMENTATION_ORDER.md), [API inventory](front%20end/docs/API_INVENTORY.md), [component inventory](front%20end/docs/COMPONENT_INVENTORY.md) and [React/Vite ADR](front%20end/docs/ADR-0001-react-vite-compatibility.md) retain their roles.

Plans and the canonical Excel tracker remain in `/Greeto_Action_OS` Library; tracker: `/Greeto_Action_OS/delivery/Greeto_Action_OS_Delivery_Tracker_Updated.xlsx`. Original 262 IDs/statuses/prerequisites/acceptance/evidence remain preserved; INC-018 adds its evidence rather than certifying parent completion.

**Next:** reviewed same-origin authenticated HTTP mapping and actual scoped attempt/custody bindings, then supported SDK launch qualification and the existing exchange/grant sequence. This is not permission to change the pipeline. Use `main` only, no force-push or overwritten concurrent work. A [specific change request](front%20end/docs/publication/PIPELINE_CHANGE_REQUEST.md) and explicit owner approval precede a pipeline/API/authority/dependency/release change. Published source is not production deployment.
