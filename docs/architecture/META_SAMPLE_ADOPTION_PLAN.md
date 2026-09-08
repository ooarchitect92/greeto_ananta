# Meta sample adoption plan — Greeto / Customer Action OS

**Record:** META-REF-001 · **Reviewed:** 9 September 2026 · **Status:** planned integration; source review only.
**Greeto base:** `3335b1844e5b54e8515e457c4c96e536ef9c8500`, `main`.
**Upstream:** `fbsamples/business-messaging-sample-tech-provider-app`, pinned to `14703a3e1fdba9bcf75b2360b00817b6fcc9f79b`.

This addendum implements the owner's request to use Meta's sample as the concrete reference for faster development. It does not replace the approved architecture, its 262 work packages, F01–F18, dependency order, G0–G4 gates or existing design. This publication adds a plan and traceability, not an integrated channel or production approval. No sample runtime code or dependencies are installed by this change.

## 1. Decision and source precedence

Use Meta's actual request construction, response fields, Embedded Signup interactions, phone-registration flow, message/template payloads, calling examples and test scenarios as implementation inputs. Do not invent these details from a diagram. Extract compatible logic and port provider-specific behavior into the existing owners; do not paste the sample application over Greeto.

Precedence remains: owner directives and approved Action OS architecture → original work-package dependencies and acceptance criteria → versioned official provider contracts and account evidence → pinned Meta sample as implementation reference → Greeto adaptation and tests. When these differ, record the discrepancy and stop the affected integration; never silently change the pipeline. A source-code example is not a provider entitlement or proof of current eligibility.

The upstream README calls this a reference application. Its production checklist still requires provider configuration, business verification, review, publication and callback/redirect configuration [R01]. Its MIT license allows reuse subject to its notice condition and supplies the software without warranty [R02]. Preserve copyright/license notices in copied or substantially derived portions; record modifications and dependency licenses. This plan does not make the entire Greeto repository MIT-licensed or grant Meta branding/endorsement.

Review scope: repository directory inventories plus the source sections identified in `META_SAMPLE_REFERENCE.json`. Core onboarding, Graph wrappers, callback handling, message sending and source configuration were read. Other UI and test files are inventoried, not claimed line-by-line audited. The sample was not installed, executed, penetration-tested or run against a Meta business account here. No upstream test result is claimed. The three Meta documentation URLs in the reference record returned HTTP 429; their current contract details remain verification gates.

## 2. What to adopt, with nothing silently discarded

The companion `docs/delivery/META_SAMPLE_ADOPTION_MATRIX.csv` maps 22 adoption slices to original work-package IDs, exact upstream paths, Greeto ownership, prerequisites and acceptance. Slices are child planning references, not 22 new baseline features or completed tasks.

| Upstream capability / actual source | Adoption in the existing product | Boundary retained |
|---|---|---|
| `ClientDashboard.tsx`, `Fbl4bLauncher.tsx`, `publicConfig.ts` | Embed the configuration/review/launch interaction in the existing channel/onboarding area; use source-defined `config_id`, code response and session metadata shapes. | F02, WHA-003 / UX-002 / UX-005; no arbitrary production preview-version or JSON execution control. |
| `beUtils.ts:getAppDetails` | Server-owned app/configuration discovery and administrator readiness. | App ID belongs to the selected environment; private app token never reaches the browser. |
| `token/route.ts`, `getToken`, `saveTokens` | Code exchange, verified asset discovery and resumable onboarding. | Existing F02 order, server-owned state/nonce and vault references; not client-posted identity authority. |
| `getWabas`, `getClientPhones`, WABA/phone cards | Account inventory, number details, registration and health explanation. | Each lookup verifies tenant/workspace/environment/app/asset and freshness. |
| `request-code`, `verify-code`, `register`, `deregister` | Phone verification/registration operations and explicit operator states. | Onboarding route-specific prerequisites; disconnect is not unconditional number deregistration. |
| `send/route.ts`, `beUtils.ts:send` | Reuse the WhatsApp text payload inside the provider dispatch adapter. | F05 durable command acceptance and F10 Action Gateway precede the provider POST. |
| `paid_messaging/*`, template helpers/dashboard | Template inventory, variables, approved sending and billing-readiness explanation. | F05/F06/F14; current template/consent/budget checks, no proof of delivery or payment from a UI Boolean. |
| `webhooks/route.ts` GET/POST | Challenge/signature construction and event shapes become Go ingress fixtures/adapters. | F03: verify, parse ALL relevant entries, bind, durably accept every required slice, then ACK. |
| `AckBotStatus.tsx` and callback auto-reply | Preserve the auto-reply user capability as an authorized automation after normalization. | F03 → F04 → F05/F10; no inline reply before provider ACK, and no echo loop. |
| `InboxLayout`, `ConversationView`, `MessageBubble`, phone sidebar | Reuse interaction/rendering ideas within the existing inbox, with tested DTOs. | Durable timeline/cursors and permission-checked realtime; not a transient socket as the message store. |
| `LiveWebhooks`, `LivePhones`, `ably-auth` | Scoped diagnostics and state notifications through the planned realtime/operations services. | Do not introduce Ably or a global raw-webhook channel as a new source of truth. |
| Pages, Ad Accounts, Datasets, Catalogs, Instagram cards and lookup helpers | Authorized shared-asset inventory in Meta/channel control centers; richer actions remain in their existing work packages. | Asset discovery is not implemented Messenger/Instagram DM, Ads/CAPI or commerce execution. |
| `calls/*`, `CallingClient`, call banners/status/ribbon, `utils/calling.ts` | Preserve calling settings, permission request/status, signaling and UI examples for the voice workstream. | F15 and existing G3 voice gates; not automatically enabled during messaging onboarding. |
| Auth0 wrapper/middleware, Vercel/Neon SQL, Ably configuration | Reference-only comparison for equivalent responsibilities. | Keep chosen OIDC/RBAC/OPA, Aurora/DynamoDB/Kafka and AWS deployment boundaries. |
| Privacy/setup pages, environment checker, errors, common UI | Reuse checklist intent and safe parameter descriptions; restyle with existing components. | No copied placeholder legal policy, raw secret display, arbitrary HTML or new theme. |
| All inventoried unit/E2E/configuration/license files | Preserve provenance and useful test scenarios; adapt independently from the runtime. | No replacement of Greeto tests, gates, dependency versions or CI/CD by upstream tooling. |

The sample is predominantly WhatsApp and related Meta assets. It does not fulfill Telegram, full Instagram/Messenger messaging, CRM synchronization, Mission compilation/runtime, RAG, billing ledger, backups, regional recovery or hyperscale qualification. Those remain in the original plan, not deleted and not renamed “implemented by Meta sample.”

## 3. Source differences that must not enter Greeto unchanged

These are observations in the pinned files, not a comprehensive security certification or claims about every revision of the project.

1. **Callback execution order [R04].** The sample publishes raw data to Ably and may query SQL/send an AckBot reply before returning. Its inner handling selects the first message/call/status in relevant arrays. Greeto must enumerate all relevant records and use its Kafka durability boundary before downstream fanout/replies. HMAC verification is useful; the sample's orchestration is not the F03 implementation.
2. **Missing/invalid proof [R04].** Verification is conditional on a configured app secret, and some invalid/missing-signature paths return an OK response while ignoring input. Greeto must fail closed for missing credentials and must not report authenticated durable acceptance on invalid proof. The GET challenge remains a distinct verify-token handshake.
3. **Signup correlation [R03].** The launcher uses module-level code/session variables and a suffix origin test. Greeto requires exact approved origin matching, relevant window/source checks where supported, bounded messages and transaction-local attempt state. Handle callback/event arrival in either order, duplication, concurrent tabs, cancellation and expiry without mixing users or attempts.
4. **Token exchange/parallel operations [R05].** The sample receives asset IDs/app ID from the browser, keys its flow by session email, and starts saving, registration, subscription and optional calling concurrently. Greeto derives actor/scope/app server-side, validates granted ownership, and resumes the existing F02 sequence. Server verification precedes activation; partial outcomes are individually persisted, not a green aggregate HTTP response.
5. **Storage [R06].** Helpers store `access_token` in several relational asset tables; queries often scope by user ID, with some webhook/phone queries by provider ID alone. Greeto stores credential references in scoped records, secrets behind the approved broker/KMS boundary, composite identity and ownership epoch. Preserve IDs as opaque strings; do not copy a numeric conversion assumption into JavaScript. Never return token-bearing helper rows to client components.
6. **HTTP wrappers [R06].** The sample Graph helpers return parsed error bodies and some callers must explicitly inspect `data.error`; wrappers shown do not establish Greeto's deadlines, retries, receipt persistence or complete response validation. Adapt to structured errors, bounded response bytes, HTTP + provider codes, cancellation and policy-controlled retry. An uncertain external POST remains UNKNOWN.
7. **Sensitive query parameters [R06].** The source token/verification helpers construct URLs containing code/client-secret/OTP data. Verify the current supported provider exchange contract; do not invent an alternate encoding. Suppress/redact full URLs, request bodies and exception text at every logger/proxy/export boundary. Retain the source's use of bearer headers for ordinary Graph calls.
8. **Health/template assumptions [R06].** Payment checks infer health from error text, and template filtering includes `QUALITY_PENDING`. Preserve these as sample fixtures, not universal permission. Current provider contract/account evidence decides allowed statuses; absent/malformed/stale evidence is unknown, never payment-ready by default. Paginate bounded reads instead of assuming the first 100/1000 entries are complete.
9. **Global realtime [R04/R08].** The callback publishes raw events to `get-started`; the auth route shown does not set a per-resource capability in its token request. Greeto uses permission-checked subscriptions and minimized events after durable projection. No shared customer-data broadcast or unrestricted token is inherited.
10. **Version mismatch [R03/R07/R09].** The launcher hardcodes SDK `v24.0`, the server Graph version is environment-driven, and sample setup/test examples have other values. Pin a reviewed SDK/Graph/Embedded Signup compatibility profile; do not copy every alpha/preview option or select “latest.” No version upgrade is performed by this plan.
11. **Optional calling [R05/R06].** An onboarding option can enable calling. Greeto records it as an explicit requested capability, blocked until existing account, consent, policy and voice gates pass. Messaging readiness cannot silently imply call readiness.
12. **Source tests [R10].** Tests exist, including mocked SQL/fetch cases. Reuse scenarios, but distinguish source-derived fixtures, local mocks, official captured responses and account-level interoperability. Passing upstream mock tests is not production acceptance.

## 4. Existing pipeline integration contract

### F01 / F02 — setup, consent, assets and readiness

```text
Existing authenticated Greeto tenant admin
 → server creates connection attempt (scope + state + nonce + expiry + expected app)
 → existing Greeto UI launches approved Meta configuration using adapted sample logic
 → code and signup session arrive; correlate to the one active attempt
 → server validates session/state/expiry/app; exchanges code server-to-server
 → credentials enter the approved secret broker; record only references
 → verify token grants, business/asset ownership and conflicting bindings
 → bind asset to tenant/workspace/environment/cell/epoch
 → idempotently subscribe required app/webhook fields
 → register/verify number when the selected onboarding route requires it
 → collect authorization, sender, billing, capability and policy evidence
 → permitted send/receive test through existing action/ingress owners
 → READY or exact ACTION_REQUIRED/UNKNOWN status
```

“Config saved”, “OAuth exchanged”, “subscription accepted” and “channel ready” are different results. Lost exchange or registration responses require reconciliation; do not blindly reuse a consumed authorization code. Store the attempt checkpoint and operation result independently. Optional asset families only require the permissions of the selected implemented use case. WABA sharing, new-number registration, migration and Business App coexistence keep their separate existing state machines; do not assume history import or auto-register every number.

### F03 / F04 — callback to durable inbox

GET validates the route-owned verify token and returns the exact challenge. POST enforces bounds, verifies original bytes using route-owned credentials, parses and enumerates every entry/change/message/status, resolves verified asset placement, and durably commits all required authorized slices to Kafka with the existing quorum policy. Only then return the provider success ACK. Unknown authorized schemas/assets take the baseline's restricted durable quarantine path; no mixed-tenant raw record is assigned to one tenant.

After ACK, normalizers/projectors retain provider timestamp and receipt time, deterministic dedup identity, status-before-message orphans and separate delivery facts. Commit consumer offsets only after their own durable effect. Realtime uses authorized cursors/resync. Move sample auto-reply and diagnostics here, not into the provider callback. Do not add CRM, AI, backup, remote log or health-ping round trips before ACK.

### F05 / F06 / F10 — sending and outcomes

```text
Existing UI or authorized API
 → validate and durably accept the idempotent command (202 with stable identity)
 → existing outbox/Kafka lane and scheduler
 → Action Gateway: ownership → authorization → connection/capability
   → consent/policy → approval → budget/rates → idempotency claim
 → Meta adapter uses source-derived text/template payload via approved egress
 → classify provider accepted / rejected / safe retry / UNKNOWN
 → persist result and outbox; later callbacks update distinct delivery/read facts
 → independently evaluate business outcome and billable evidence
```

The sample's `/api/send` and `/api/paid_messaging/send` are not copied as alternate bypass routes. Browser-facing API semantics remain the approved `/v1/...` contracts and separately reviewed legacy compatibility. `biz_opaque_callback_data` can aid correlation, but is not assumed to be provider-enforced idempotency. “Paid messaging” is not Greeto's financial ledger and does not prove a captured payment.

### F07 / F15 / F18

Meta incoming callback signatures are different from Greeto's outgoing customer-webhook HMAC contract. Retain all existing F07 signing, receiver, egress, retry and receipt work; the sample does not replace it. Calling uses existing F15 signaling/permission/state and separate media plane. Disconnect revokes authorized access and future sends; do not automatically invoke the sample deregister operation or delete customer-owned assets. Erasure and backup restore retain F18 tombstone checks.

## 5. Greeto ownership and frontend placement

Existing roots inspected: `front end/src/features/channels/`, `front end/src/features/studio/`, `front end/src/features/implementation/`, `front end/src/shared/ui/`, `backend/services/core/`, `backend/services/ingress/` and `backend/services/webhook-dispatcher/`. Existing React/Vite remains in place; future Next.js migration is still the separate UX-001 decision.

**Proposed additions, not files claimed to exist:** `front end/src/features/channels/meta/` for the scoped signup launcher, attempt-progress view, asset selector and capability details; `backend/services/core/src/channels/meta/` for onboarding/configuration/readiness domain adapters; the Meta adapter beneath existing Go ingress for verification/splitting. Sender and voice adapters belong to the baseline Action Gateway/messaging/voice owners when those services are implemented. Do not misplace high-volume callbacks in a Next.js BFF to avoid implementing Go.

Use existing `PageLayout`, notices, badges, tabs, parameter controls, navigation registry and styles. The channel center should display provider account/number details; signup progress belongs to onboarding; messages/templates stay in their existing inbox/template areas; call controls stay in voice. The Implementation Center aggregates evidence and links to these features, not another disconnected Meta admin application. Sample UI markup/interaction can be adapted; its layout/router/theme does not replace Greeto.

Each capability independently displays not supported, not authorized, not eligible, not configured, temporarily unhealthy or ready, with source/version/time/expiry and next action. Provide separate authorization, asset-binding, subscription, number, template, billing and calling gates. An empty result, stale health or token-exchange success cannot turn the entire account green. Browser-visible data contains references and approved public metadata only, never access tokens, app secrets, PINs or authorization codes in stored drafts.

## 6. Parameters, status and API documentation

| Parameter group | Sample values / planned Greeto treatment |
|---|---|
| Public launch | `appId`, `config_id`, `response_type=code`, `override_default_response_type`, `extras.sessionInfoVersion`, version/featureType/features. Select from a server-issued permitted configuration; do not execute arbitrary browser JSON. |
| Attempt authority | Existing authenticated actor, tenant/workspace/environment, `connection_attempt_id`, state/nonce binding, expiry, expected app/config, home cell and epoch. Server-owned; sample email is not a substitute. |
| Callback | Short-lived `code`; singular/plural WABA IDs, phone ID, business ID, Page/Ads/Dataset/Catalog/Instagram ID arrays. Validate type/count/length, then confirm actual grants; submitted IDs are claims. |
| Operation choices | Registration, subscription and calling flags are requested intent. Server chooses allowed onboarding route and order; consented calling remains separately gated. |
| Credentials | App-secret/token/verify-token/PIN references and versions; no raw credentials in persisted UI/API DTOs. Provider-required temporary values remain in authorized server memory only. |
| Message/template | Connection, recipient, purpose, content or template/name/language/components, deadline, stable idempotency key, approved callback correlation. Reuse sample provider shapes inside the adapter, not its API authority model. |
| Phone operations | Verified phone/WABA binding, selected verification method/language, transient OTP, credential version and expected lifecycle state. No unbounded OTP retries or log output. |
| Calling | Verified connection/phone/call ID, permission evidence/expiry, approved signaling operation and bounded SDP/session fields. Never claim recording/SIP/TURN production readiness from a sample file. |
| Diagnostics | Request/attempt/event/action IDs, operation stage, start/end time, elapsed duration, result class, HTTP/provider error code/subcode, retry classification, credential version reference, evidence pointer and observed freshness. Minimize identifiers and never log full payloads/URLs/secrets. |

This is an additive parameter plan, not an applied API/schema migration. Reconcile fields against the existing OpenAPI before coding. For each operation document scope and permission, request/response schema, errors, pagination, limits, idempotency retention, deadline, exact acknowledgement meaning, samples and implementation status. Document database ownership/indexes/encryption/restore requirements separately from public DTOs.

Instrument stages such as attempt creation, SDK launch, callback verification, exchange, grant verification, vault write, binding commit, subscription, registration and readiness. Return structured per-stage status (pending/running/succeeded/failed/unknown/blocked) and evidence; persist checkpoints with current ownership/version. Cache/reuse measured health with explicit freshness where appropriate. A health probe is not proof that the immediately following write succeeded; the operation's actual acknowledgement is authoritative.

For Graph calls bound connect/read/total time, response size, concurrency and retries; validate both HTTP status and provider body. Preserve provider error codes and retry headers after sanitization. No automatic retry of duplicate-intolerant uncertain writes. Logging outage cannot invent success; mandatory audit persistence retains its defined gate. Kafka events retain schema version, stable event identity and correlation across the already selected outbox/consumer boundaries.

## 7. Adoption work packets and acceptance evidence

Use the matrix to choose the next dependency-ready child task; do not equate this ordering with permission to skip a predecessor. Candidate parallel work is limited to pure DTO fixtures, source mapping and isolated UI using disabled execution. Runtime activation waits for original G0/G1 prerequisites.

1. **Source qualification (GOV-002/GOV-003).** Pin commit and reviewed blobs, retain MIT attribution, inventory all feature families and lockfile, record official-document retrieval gaps, capture dependency/license/security evidence. Build the pinned sample only in a separately approved sandbox with test assets; never copy its entire environment into production. No changing versions to make a build pass without approval.
2. **F02 connection adapter (WHA-003/WHA-004).** Implement attempt-local SDK state, strict origins, schema bounds, server callback/ownership verification and resumable ordered steps. Tests: wrong app/state/user/nonce, expired/reused code, duplicate callbacks, event/code ordering, concurrent tabs, declined grants, revoked rights and partial persistence. No copied asset activation before verification.
3. **WABA/phone/capability UI and operations (WHA-005/WHA-006).** Reuse source request shapes and registration interactions. Tests: phone not under granted WABA, stale epoch, absent billing/template data, pagination, invalid OTP must not advance, registration uncertainty, coexistence constraints and permission-specific status.
4. **F03 provider adapter (EVT-003/EVT-004).** Turn sample challenge/HMAC and payload examples into explicit fixtures in the existing Go pipeline. Tests: missing config, forged proof, original byte differences, all multi-entry records, status-only/call events, mixed assets, partial Kafka commit, duplicate rebatching and safe quarantine. No auto-reply/network notification before ACK.
5. **Message/template adapters (MSG-001/MSG-002/WHA-007/WHA-008).** Port payload builders and response mapping. Tests: stable command identity, same-key/different-content conflict, revoked consent after queueing, template unavailable, rate limits, timeout after send, callbacks arriving before response and no billing twice. Only a recorded provider ID means provider acceptance; delivery and business outcomes need their own evidence.
6. **Inbox/diagnostics and permitted automation (MSG-005/MSG-006/WFL-007/SUP-004).** Adapt the presentation into current components; use durable read cursors and scoped notifications. Tests: reconnect, stale membership, slow-client resync, redaction, out-of-order status and auto-reply dedup/loop prevention.
7. **Shared assets and voice at their existing gates (INS/COM/VOC).** Retain inventory without broadening scopes. Calling tests require current eligible account and permission fixtures, connect/pre-accept/accept/reject/terminate order, revocation, cancellation and media isolation. No moving G3 calls into G1 just because the sample contains routes.
8. **Independent vertical-slice acceptance (QAT-002/004/006/007).** One authorized business completes signup → verified binding → inbound durable ACK → inbox → policy-aware action → provider evidence → customer webhook → independently verified outcome/recoverable failure. Capture reviewer-friendly evidence without real customer secrets. No load tests against Meta without permission.

Every child contribution records source path/symbol/hash, existing requirement, proposed target, adapted differences, parameters, checks run, exclusions and verified remote commit. Tests using synthetic data are labeled; real provider, DB/Kafka, crash/recovery, security and rollout evidence stay separate. Keep all original baseline IDs/statuses/formulas and attach evidence notes rather than declaring a whole work package Done.

## 8. Recovery, cybersecurity and deployment are retained

The source's Vercel/Neon/Auth0/Ably setup is a runnable-sample environment, not a decision to replace AWS cell services, Aurora, DynamoDB, Kafka, existing identity or realtime. Do not install a new broker, replace storage ownership or expose a new hosting route through this adoption plan.

Use the existing vault/KMS and scoped encryption/decryption boundaries, least-privilege DB roles and RLS, sanitized audit/telemetry and intrusion signals for failed callbacks, cross-scope attempts, token misuse and unauthorized changes. Secrets and message bodies do not go into a global raw webhook viewer. Independent backups, point-in-time recovery, writer fencing, erasure replay, unknown-action reconciliation and measured restore drills remain required. A second live DB alone is not a protected backup. Secure Boot remains a host evidence requirement, not a setting this sample turns on.

Release/provider approval, legal notices and dependency qualification are unchanged. Keep the current main-only source publication instruction; no new branch, force-push, unsolicited deployment or temporary workflow. The unrelated INC-015 Mission browser-input correction still awaits the owner's specific approval. This sample request is not approval for that test change.

## 9. Developer continuation instruction

Read AGENTS.md, OWNER_DIRECTIVES.md, current status, baseline prerequisites, this plan and the source reference. Work from the latest main and pin the reviewed upstream commit. Select one dependency-ready matrix slice. Reuse exact source shapes where compatible, with notices; explicitly label new Greeto files as additions. Keep controllers, domains, repositories and provider clients under their actual owner. No raw secret persistence, direct provider side-effect bypass or altered F03 ACK sequence. Write parameter/return/error/scope/side-effect/retry comments and appropriate negative/contract/integration tests. Stop for approval if a proposed solution changes a pipeline, public contract, dependency, framework, authority or gate. Publish tested changes to main without overwriting concurrent commits; read back hashes. Update README, source evidence and Excel without marking a parent complete on the strength of mock tests.

## 10. Evidence register and disposition

[R01] Pinned upstream README (feature/setup and production checklist); [R02] LICENSE; [R03] Fbl4bLauncher and reviewed ClientDashboard sections; [R04] webhook route; [R05] token route; [R06] beUtils; [R07] publicConfig; [R08] Ably auth route; [R09] package manifest; [R10] reviewed beUtils test section and test-directory inventory; [R11] text-send route; [R12] calling utilities. Exact URLs, Git blob hashes and review limits are in `META_SAMPLE_REFERENCE.json`.

The matrix retains all discovered API families: auth/Ably, token, send, paid messaging, phones, register/deregister, request/verify code, webhooks, and calls (accept/connect/permissions/pre-accept/reject/request-permission/settings/terminate). All component/page families are accounted for, including asset cards, registration, inbox/messages, calling, privacy, configuration and shared UI. Build/test/configuration/license files are reference-only unless explicitly adopted later. This is capability coverage and a targeted code review, not proof every file was executed or fully audited.

**Delivered by this change:** pinned source registration, adoption plan, 22 mapped slices, README navigation and updated Excel planning evidence. **Not delivered:** a copied/running sample, new provider adapters, dependency installs, granted permissions, provisioned backups or a production deployment. These limitations are not omissions from the plan; they are the existing implementation and acceptance gates.
