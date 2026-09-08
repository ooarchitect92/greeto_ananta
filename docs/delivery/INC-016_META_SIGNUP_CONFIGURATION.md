# INC-016 — Meta adoption step 1: configuration preparation

Date: 9 September 2026. Repository: `ooarchitect92/greeto_ananta`; `main` only.
Inspected base: `46f39a844278f144c408918df49ccfb326e23a3f`.

## Delivered boundary

This is the first bounded implementation after META-REF-001: a pure TypeScript
configuration-preparation function and an existing-design Channel Center review
panel. It contributes to M02/M03, WHA-003 and UX-005; source/evidence validation also
supports GOV-003. The complete signup wizard is NOT implemented or connected.

Original prerequisites remain WHA-003 <- PLT-008, EVT-003 and UX-005 <- PLT-001.
The adoption plan explicitly permits pure DTO fixtures and isolated disabled UI
while those runtime prerequisites are incomplete. No parent status is promoted.

The payload-construction fragment is adapted from Meta's
`app/components/ClientDashboard.tsx:computeEsConfig` (lines 675–691 at the reviewed
commit). Upstream commit: `14703a3e1fdba9bcf75b2360b00817b6fcc9f79b`; file blob:
`01d7c5c0cbcfdc2b433c2602fe48bf7ad6192b55`. The copyright notice and full MIT license
are retained at `docs/architecture/licenses/META_SAMPLE_MIT.txt`. This does not
relicense all of Greeto or imply Meta endorsement.

## Step-by-step implementation

1. The eventual authenticated control-plane host authorizes the current actor and
   object, resolves an exact tenant/workspace/environment, and selects a registered
   app/profile/revision. That host/registry is not implemented in this increment.
2. `prepareSignupConfiguration(profile, context)` checks the unknown inputs against
   the strict internal schema. It rejects numeric provider IDs, unexpected fields,
   malformed versions, duplicate/unbounded feature names and invalid scope/clock data.
3. Compare scope, app reference, selected profile and revision. Mismatch returns a
   neutral code; no row, credentials or alternative tenant identity is exposed.
4. Require an enabled profile with reviewed, unrevoked, currently valid evidence.
   Missing/unverified/expired evidence fails closed. This validates registry data;
   it does NOT independently authenticate the registry or prove provider eligibility.
5. Build only the sample-shaped public options: config_id, response_type=code,
   override_default_response_type=true and extras with sessionInfoVersion='3', the
   explicitly selected signup version, optional featureType and feature-name objects.
   An empty featureType is omitted. No version, permission or product is invented.
6. Return a frozen public snapshot labelled prepared / not_requested. Scope is copied;
   option arrays are copied and frozen. No state/nonce, access token, OTP, PIN, secret,
   vault value or credential reference is sent to Meta by this function.
7. `inspectSignupSetup` validates the corresponding public DTO for rendering, requiring
   the current exact ID scope and unexpired observation. Invalid/cross-scope/stale data
   withholds all parameters. Only an allowlisted payload is formatted for review.
8. `MetaSignupSetupPanel` is mounted on Channel Center -> Configure. Existing cards,
   notices, badge, table, buttons and code styles are reused. It shows the unchanged
   F02 step list and a disabled Launch Embedded Signup control. Its default has no
   supplied setup profile; no synthetic registry is injected into runtime.

Preparing a configuration is not completing F02's connection-attempt step. All F02
steps remain in their original order: server attempt -> provider consent -> callback
validation -> exchange/vault -> grants -> asset binding -> subscription -> route-specific
phone operation -> capability/restriction/billing -> permitted test -> readiness result.
No F03 callback, F05/F10 action, F07 customer-webhook or F15 calling order changes.

## Actual files and public symbols

| File | Symbol and responsibility |
|---|---|
| `backend/services/core/src/channels/meta/signup-configuration.ts` | `prepareSignupConfiguration(profile: unknown, context: unknown): PreparedSignup`; pure guarded payload preparation. |
| Same | `SetupScope`, `SetupContext`, `SignupProfile`, `LoginOptions`, `PreparedSignup`; readonly internal types. |
| Same | `SetupError`, `SetupErrorCode`; neutral failure codes, no raw cause/payload. |
| `front end/src/features/channels/meta/signup-setup-model.mjs` | `inspectSignupSetup(observation, expectedScope, nowMs)`; scoped/fresh public presentation, always canLaunch=false. |
| Same | `META_CONNECTION_STEPS`; immutable explanation of original F02 order, not an execution engine. |
| `front end/src/features/channels/meta/MetaSignupSetupPanel.jsx` | `{setup=null, expectedScope=null}`; stepwise inspection and fixed disabled control; timer cleaned up on unmount. |
| `front end/src/features/studio/FeatureStudioPage.jsx` | Two-line integration: import and conditional mount only for channel-center/configure. No route, field or draft-default change. |
| `tools/check_meta_signup_configuration.py` | Local compile/strict type-consumer/test runner; no installation, Git mutation or hosting. |

## Parameter and authority contract

| Input | Type / bounds / owner | Meaning |
|---|---|---|
| scope.tenantId / workspaceId / environmentId | Nonzero lowercase UUID strings; authenticated host/registry | Exact isolation tuple. A UI environment label is not an environmentId. |
| context.actorId | Nonzero lowercase UUID; authenticated host | Identifies already-authorized caller. Syntax validation is not RBAC or object authorization. |
| appRef / profileId | Opaque reference, 1–128 characters; server selected | Expected registry selection; never arbitrary client-selected app authority. |
| profileRevision | Positive safe integer; server selected | A stale or swapped row cannot replace the expected revision. |
| appId / configId | Decimal nonzero strings, at most 64 digits | Preserve provider identifiers exactly; no JavaScript integer conversion. |
| graphApiVersion | Explicit vN.N string | Public SDK initialization version; no newest-version default. Not included as an extra FB.login field. |
| signupVersion | Explicit bounded vN[-suffix] string | Selected single reviewed profile, not a hardcoded production recommendation. |
| featureType | Empty or lowercase feature identifier, at most 64 chars | Empty omitted; otherwise retained from qualified profile. |
| features | 0–16 unique feature identifiers | One qualified combination, not independent editable UI flags. |
| enabled | Boolean in trusted registry | False prevents preparation; it cannot grant permission by itself. |
| evidence.status | unverified / verified / revoked | Only verified proceeds. Merely writing this string in a request does not qualify evidence. |
| evidence.sourceRef | Opaque reference, 1–128 chars | Points to separately reviewed provider/account evidence. Not an arbitrary URL fetch. |
| evidence.reviewedAtMs / expiresAtMs | Positive safe Unix-millisecond integers | reviewedAt < expiry; require reviewedAt <= now < expiry. |
| context.nowMs | Positive safe Unix-millisecond integer; server clock | No caller-supplied freshness authority. Browser time is an advisory rendering check only. |

There is deliberately no current external API handler for these internal types. The
baseline's /v1/channel-connections/authorizations and callbacks remain the owning
future operations. This increment does not change their public contract, add a new
route, apply a database schema, or claim hosted Swagger coverage for unimplemented
operations. Review their DTOs with the authenticated host before wiring this helper.

## Security and operation boundaries

No network, Facebook SDK import/initialization, fetch, OAuth code exchange, database,
vault read/write, Kafka publication or automatic retry is performed. The function
cannot create a nonce or durable receipt, verify business ownership, register a
number or enable calling. A fresh prepared snapshot must still be revalidated at
use; it is not a bearer grant or proof of channel readiness.

Runtime profiles must come from the server-owned, authorized registry. This module
cannot distinguish a fabricated in-process object from a real database read. It is
therefore not safe to expose prepareSignupConfiguration directly as a user-controlled
HTTP operation. The browser observation is similarly not self-authenticating.

Strict shapes are for decoded data, not sandboxing malicious JavaScript proxies.
No raw input/cause is logged. UI parameters are rendered with React text escaping,
not injected HTML. The current panel receives no profile and cannot launch even
when a test supplies a well-formed one. No grant/secret is stored in frontend drafts.

## Source qualification and current-document limit

Primary source: https://github.com/fbsamples/business-messaging-sample-tech-provider-app/blob/14703a3e1fdba9bcf75b2360b00817b6fcc9f79b/app/components/ClientDashboard.tsx

Meta implementation and version pages were retried on 9 September 2026; both returned
HTTP 429. No third-party mirror is used to certify the contract. The preserved sample
shape is an implementation reference, not a verified current production profile.
Required qualification URLs:
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions/

The synthetic fixture's v24.0/v4 strings are test data, not a newly approved software
or provider-version selection. Existing dependency files and API-version policy are
unchanged. No Auth0, Ably, Vercel, Neon or Next.js dependency is imported.

## Checks and remaining gates

Run `python tools/check_meta_signup_configuration.py` from the repository root with
an existing Node and TypeScript compiler. The observed local tools were Node 22.16.0
and TypeScript 5.8.3. The frontend's existing Node 24/26 engine requirement is not changed.

82 named tests passed: 50 backend preparation checks and 32 presentation/composition/
source-integration checks. The backend suite composes the actual compiled producer
with the frontend model and compares its DTO to an independent fixture. Frontend
tests run without a backend build, preserving the existing tests/*.test.mjs command. Strict TypeScript and a
readonly consumer test passed. Two JSX files passed separate TypeScript parser checks.
These are not React rendering, browser, real registry, authorization, OAuth, provider,
DB, Kafka, KMS or full-repository regression acceptance. No upstream test suite ran.

WHA-003 and UX-005 remain uncompleted at original parent acceptance. INC-010 remains
unpublished. INC-014 restoration/build evidence is retained; its two Mission browser
failures and the specific INC-015 correction approval remain open and unchanged.

**Next bounded step:** server-owned connection-attempt lifecycle and attempt-local
callback/code correlation, with wrong-state/app/actor, expiry, duplicate and concurrency
checks, before any provider exchange or asset activation. Runtime wiring waits for
original prerequisite and current provider-contract evidence; no general continue
instruction waives those gates. Source publication is separate from deployment.
