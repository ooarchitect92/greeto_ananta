# Greeto frontend implementation guide

7 September 2026 • Increment 1.0 • Scope: frontend only

## 1. Delivery decision

Retain the original Greeto frontend and make the next implementation steps explicit. Do not replace the application with a disconnected mock dashboard. Existing screens remain in their feature folders, retain their API integration paths through domain facades, and are mounted by the authenticated workspace. New Action OS domains receive configuration and inspection surfaces without fake backend execution.

The 55 registered workspace entries comprise 29 retained screens, 25 parameterized configuration pages and the implementation center. The public/authentication and admin surfaces are mapped separately in `SURFACE_MAP.md`. These counts describe frontend organization, not a claim that all architecture work packages are implemented.

## 2. Source precedence

The newer Customer Action OS v1 baseline and its original delivery tracker govern Mission-led scope, safety invariants and work-package IDs. `greeto_archtecture(1).md` supplies the older Greeto screen inventory and visual/product organization. The uploaded source ZIP defines which files, components and API calls actually exist. Proposed document paths are not relabeled as existing code.

The three related Action OS documents are `Customer_Action_OS_Production_Architecture_v1(1).docx`, `Customer_Action_OS_Architecture_Source_v1(1).md`, and `Customer_Action_OS_Delivery_Tracker_v1(1).xlsx`. `SOURCE_REGISTER.json` records all four source-document SHA-256 hashes. Originals were not edited or reissued. Raw source documents are not duplicated into the frontend package; their relevant work-package/acceptance records and source references are retained.

Where the architecture proposes Next.js/TypeScript, this increment deliberately retains the existing React 19/Vite JavaScript application. New types are documented in `src/contracts/types.d.ts`; a complete TypeScript or Next.js migration is **not implemented**. ADR-0001 records that deviation rather than silently claiming compliance. UX-001, which explicitly names Next.js, remains open.

## 3. Folder ownership

```text
front end/
  src/
    App.jsx                         Lightweight lazy entry and dev-preview gate
    main.jsx                        React root, global and workspace styles
    app/
      GreetoWorkspace.jsx            Retained legacy workspace/controller
      FrontendPreview.jsx           Isolated dev-only review shell
      navigation/                   Registry, aliases, role-aware feature filtering
      layouts/WorkspaceSidebar.jsx  Stable-width grouped navigation/mobile drawer
    features/
      auth/ marketing/ admin/       Existing public and operator surfaces
      inbox/ contacts/ crm/         Existing customer-work screens and hooks
      campaigns/ content/           Campaigns and message/email templates
      automation/ whatsapp-flows/   Existing workflow and provider-flow editors
      channels/ voice/ media/       Existing communication and media screens
      ai-agent/                     Existing AI agent feature and hooks
      dashboard/ onboarding/        Existing overview and setup flows
      billing/ settings/ workforce/ reports/
      studio/                       New schema-driven configuration forms
      implementation/               Work-package, feature and API workbench
    services/
      api/legacy.js                 Original API client, preserved as adapter
      realtime/socket.js            Existing socket client
      notifications.js              Existing push-notification adapter
    shared/
      forms/validation.js           Pure validation, cross-field rules, handoff format
      state/drafts.js               Scope-isolated session drafts
      ui/PageLayout.jsx             Shared page/header/notice/state components
    contracts/                      Navigation, fields, sources, API and task inventories
    styles/workspace.css            Scoped layout tokens and responsive rules
    components/ui/                  Retained original design primitives
  tests/                            Native Node contract tests
  e2e/frontend/                     New browser tests; require installed dependencies
  scripts/audit-frontend.mjs         File, import, schema and source-coverage audit
  docs/                             Handoff, detailed contracts and verification evidence
  tools/archive/                    Inactive historical one-off rewrite scripts
```

`FILE_MOVE_MAP.json` records 72 exact old-to-new paths. Relative imports were reconciled, including previously aliased API imports. Domain `api.js` facades expose only functions used by that feature while delegating to the original adapter. `component-inventory.json` records source-level signatures and locations; `legacy-api-inventory.json` records observed exported API function parameters and path literals. Dynamic request construction still requires inspecting the function body.

The inbox state/controller remains large inside `GreetoWorkspace.jsx`. It has not been fully decomposed into new hooks in this increment because that would materially expand regression risk without the original live environment. Future extraction should move one state/side-effect concern at a time and preserve its tests. The new configuration modules do not add more domain logic to that controller.

## 4. Navigation and naming

The nine groups are Workspace; Customers & conversations; Missions & growth; Automation & trust; AI workforce; Channels & integrations; Business operations; Workspace management; and Implementation.

Stable feature IDs and routes are defined in `src/contracts/features.json`; a lightweight `navigation.json` projection (regenerated with `npm run sync:navigation`) avoids loading the full work-package/API inventory for sidebar rendering. Existing WhatsApp templates, email templates, workflow automation and WhatsApp Flows retain distinct names. Teams and team members are separate entries. `/payments` is a compatibility alias for subscriptions. The existing `/create-template` path still opens the email-template creation mode; it is documented rather than silently relabeled as WhatsApp-template creation.

Navigation is explicit and role-filtered. Unknown workspace routes receive a not-found surface, and restricted routes receive a non-executing access notice. UI role checks are only affordance/visibility checks: the server remains responsible for authentication, tenant/workspace/object authorization and privileges. Admin routes remain inside the original admin shell.

The old hover-expanding sidebar is replaced by a fixed-width layout. The mobile drawer has an explicit open/close control, Escape handling and a focus loop. Page padding, header alignment, input sizing, form grids, table scroll containers, focus outlines and reduced-motion rules share one scoped stylesheet. Legacy feature internals were not all visually re-reviewed; the strongest visual checks in this increment cover the new shared layout fixtures.

## 5. Configuration pages and parameter contracts

Each new configuration page has Configure, Parameters and Implementation views. Fields carry stable keys, human labels, types, defaults, requiredness, bounded values/options and explanations. `PARAMETERS.md` contains all 231 documented fields, including selected integration-planning schemas for existing screens; not every legacy form has been rewritten to consume this validator.

The Configure view edits values, validates them, optionally saves a session draft and exports JSON. The Parameters view describes the contract and identifies any proposed endpoint. The Implementation view links source work packages and prerequisites. The backend-apply control is intentionally disabled with an explanation. Simulation parameters configure a future runner; no deterministic journey engine, AI invocation, provider connection, workflow publication, support action or message send is implemented by these forms.

Important field rules include finite bounded numbers, integer minor-currency amounts, enumerated channels, valid IANA timezones, timestamps with explicit timezone, valid calendar dates, bounded JSON and schema keys, unique multi-select values and opaque reference formats. Cross-field rules keep opt-outs excluded, disallow unapproved cross-tenant AI reuse, require evidence references for identity links and observed outcomes, keep simulation synthetic, bind approval input to a SHA-256 digest, and limit AI fallbacks. These are browser checks, not policy enforcement guarantees.

JSON handoff format:

```json
{
  "schema_version": "1.0",
  "feature_id": "missions",
  "status": "draft",
  "validation": "browser_only",
  "authorization": "server_must_resolve_scope_and_permissions",
  "execution": "not_requested",
  "contract_status": "proposed",
  "parameters": {}
}
```

The real exported `parameters` object is populated only after validation. No credentials or forged authorization claims are appended. A reference to evidence is not proof that the evidence exists: the future server adapter must resolve and verify it.

## 6. Session drafts and scope

A draft storage key includes tenant, workspace, environment, user and feature. Missing scope disables session persistence rather than inventing a tenant or workspace. Browser drafts use `sessionStorage`, not a cross-tenant global cache. Storage availability/quota errors, corrupt payloads and incompatible schemas produce a failure message rather than a false saved status. Stored data is limited in size and known credential-shaped keys and private-key/token patterns are rejected. This is defensive validation, not a complete data-loss-prevention scanner; do not enter production secrets or customer records.

Saving is explicit. Restored drafts are still drafts, not server records. Internal navigation and hard reload warn about unsaved changes; browser history handling also attempts to preserve a rejected navigation. Those React interaction paths are covered by supplied browser tests but were not executed here. Logout attempts to remove drafts belonging to the active user scope without deleting another user scope's drafts. Synthetic preview scope is fixed and dev-only.

The hard-coded fallback team UUID found in the original source was removed. Scope-dependent inbox/socket/assignment work no longer fabricates that context. Existing authentication/session storage remains legacy code and has not been redesigned into a new security architecture. The future backend must revalidate every session claim.

## 7. Source work packages and implementation sequencing

All 262 original IDs, names, domain names, gates, priorities, squads, predecessor IDs, acceptance text, acceptance-test IDs and source rows are preserved. `baselineStatus` and `deliveryStatus` remain uncompleted. `frontendStatus` identifies a configuration or dependency view separately. A backend-heavy package such as Kafka, data retention or deployment is linked to its frontend visibility/configuration surface or to the implementation center; the linkage does not imply backend code exists.

Use the implementation center to search an exact ID, filter by domain/gate/priority, open its detail and review its dependencies and test. `/implementation?task=MIS-001` is a stable selector; in the dev preview use `/frontend-preview?feature=implementation&task=MIS-001`. Query parameters do not grant scope or authority. `IMPLEMENTATION_ORDER.md` lists a topological ordering derived from the actual predecessor graph.

For the next frontend pass, close the environment gap first: install the locked dependencies under a supported Node version and run build, unit tests and browser tests. Then review UX-001 through UX-010 against actual acceptance, retaining the explicit Next.js deviation. Do not mark them done just because navigation and configuration forms exist. Choose the next source work package whose predecessors are satisfied, not simply the next row number.

A safe per-package loop is: inspect the exact source criterion; open the registered feature and parameter schema; implement one approved frontend behavior; wire only an authoritative API contract; add fixtures for loading, empty, forbidden, conflict, failure, pending and unknown; run the relevant tests; attach evidence; then update a separate implementation status record. Do not rewrite the source-baseline status as a shortcut.

## 8. Backend handoff rules for later increments

The current frontend adapters remain intact through domain facades; live compatibility was not reverified. New endpoint specifications are marked proposed and are not invoked. Before connecting one, agree on the OpenAPI/schema version, server-derived scope, object authorization, concurrency/version behavior, idempotency for side effects, error envelope and evidence semantics. Avoid embedding backend execution in a React click handler.

Accepted by an API, accepted by a provider, delivered, read and verified business success are independent facts. Unknown outcomes must not be relabeled as success or automatically resubmitted as new actions. Browser readiness dropdowns are draft intentions/observations, never proof of provider eligibility. Billing values are configuration fields, not posted transactions or reconciled invoices. Model/provider names in a form are configuration choices, not current provider approval claims.

HTTP URL validation in the browser is only a basic public-HTTPS sanity check. Real SSRF protection requires server DNS resolution, redirect controls, destination policies and egress enforcement. An opaque credential reference is resolved server-side; no raw provider credentials should be shipped to the browser. Private connectivity, KMS, durable workflows, queues and model execution are backend/infrastructure responsibilities, excluded from this package.

## 9. Verification and remaining gates

See `QUALITY_REPORT.md` and `docs/qa/`. Native contract tests passed. Static source parsing, local import binding checks, file/route/schema coverage and static CSS layout checks passed. All original public/assets media files were checked against the source hash manifest. The original API client was relocated, not replaced with invented endpoints.

Dependency installation encountered npm-registry DNS errors, incompatible locked development-engine requirements on Node 22.16.0, and an npm exit-handler failure. The build attempt ended with `vite: not found`. Therefore the full React application, existing live screens, browser E2E suite, production build, deployment, backend integration and provider flows remain unverified. Static layout fixture screenshots are explicitly labeled and must not be presented as working application screenshots.

GitHub has not received this increment. The delivery publisher must be reviewed and run locally; it creates a separate review branch, rejects unknown/conflicting frontend files, stages only `front end/`, and never merges or force-pushes. Keep the source ZIP and original documents as the baseline for comparison.
