# INC-018 — Meta adoption step 3: attempt-local callback collection and host handoff

Date: 9 September 2026. Repository: `ooarchitect92/greeto_ananta`; `main` only.
Inspected base: `ffad77266c27ea65965f7f220887ff7ce60073fb`.

## Delivered scope

This increment adds a browser-side callback bridge and input adapter, plus read-only
status in the existing Channel Center panel. It advances M03/M04, WHA-003/WHA-004
and UX-005, retaining their original prerequisites and parent acceptance states.
It does **not** add the public HTTP controller, actual database/custody bindings,
Facebook SDK loading/launch, token exchange, grants, subscriptions or production hosting.
Those are separate steps, not certified by the tests below.

The existing INC-017 server `SignupAttempts` contract is unchanged. The bridge hands
one normalized fragment at a time to a REQUIRED authenticated host transport. The
host still owns the state/nonce channel and must invoke the existing server methods.
There is no in-memory runtime fallback, automatic API route or direct Graph request.

## Baseline and source provenance

The baseline F02 section 11.2 requires server attempt -> consent -> callback validation
-> server exchange/vault -> grants -> binding -> subscription -> route-specific phone
setup -> capability/billing -> authorized test -> readiness. Sections 22.1, 28.1 and
32.2 require attempt/scope binding, session/CSRF defense and bounded validated inputs.
These requirements are preserved, not replaced with a second onboarding pipeline.

The reviewed Meta sample is pinned to `14703a3e1fdba9bcf75b2360b00817b6fcc9f79b`:

- `app/components/Fbl4bLauncher.tsx`, blob `13d698a1367d6e4a7e9306d9f0f7af9e210eee02`,
  establishes separate FB.login code and WA_EMBEDDED_SIGNUP session channels.
- `app/types/api.ts`, blob `c1d5fec131d047ce624268cea45b0b97115ef279`, provides the
  SessionInfo business/WABA/phone/Page/ad/dataset/catalog/Instagram claim field names.
- `docs/architecture/licenses/META_SAMPLE_MIT.txt` remains the retained source notice.

The bridge does not reuse the sample's module-global code/session values,
`endsWith('facebook.com')` check, raw event display, window.open monkeypatch or inline
onSaveToken/exchange. It does not select the sample's hardcoded Graph version.

Current Meta implementation documentation retrieval was attempted on 9 September
2026 and failed (retrieval/internal service error). No current origin/source-window,
finish-event, version, optional-product or account-eligibility qualification is claimed.
Third-party tutorials are NOT used to certify these details. A required reviewed
profile supplies exact terminal event names and the expected version field presence.
Fixtures named FINISH/CANCEL/ERROR and synthetic IDs are test inputs, not production
configuration or new external permissions.

## Step 1: bind one attempt before collecting messages

`bindSignupCallbacks(options)` requires a ticket from an already-created attempt,
its exact UI scope, the selected Meta origin, and the specific owned WindowProxy
expected to send messages. It registers one listener on the supplied target Window.

Both the exact origin string and `event.source` identity, plus a native-event check,
are evaluated BEFORE event.data is accessed. No suffix match, arbitrary URL, wildcard,
first-message source discovery or event-provided attempt ID is trusted. Each bound
SDK callback is a closure belonging to this attempt only.

The allowed syntactic origin choices are https://www.facebook.com and
https://web.facebook.com, with exactly one selected per bridge. This is a conservative
adapter restriction, NOT proof that a particular current Meta flow uses that source.
A supported SDK host must establish the exact source in advance. The sample's popup
capture workaround is not installed here. Missing or unsupported source identity
blocks this binding; it must not cause an origin-only fallback.

A weak ownership registry prevents the same target/source pair from being rebound
on the page, including after disposal. This prevents late messages from an earlier
attempt from being assigned to a replacement attempt. A new consent launch requires
a new supported source binding. This is not cross-tab/session server authority.

## Step 2: normalize bounded callback inputs

`decodeSignupCode` reads only data properties for `authResponse.code`, validates its
shape and byte limit, and excludes unrelated SDK metadata. No-code results stop local
collection without pretending that the server recorded cancellation.

`decodeSignupMessage` accepts JSON text only. A bounded tokenizer using JSON.parse for
scalar grammar rejects duplicate decoded property names, prototype-shaped keys,
invalid Unicode, unsafe numeric values, trailing documents, excessive depth/tokens
and oversized arrays/text. Exact profile-selected event/version fields are checked.
Unrelated message types and unrecognized intermediate events are ignored.

Finish data maps to the existing server SessionClaims:

| Sample field | Internal field | Rule |
|---|---|---|
| business_id | businessId | Required decimal string; never guessed from another asset. |
| waba_id | wabaIds | Optional singular claim becomes one-element list; absent means no claim. |
| phone_number_id | phoneNumberId | Optional decimal string; absent becomes null, not an invented phone. |
| page_ids | pageIds | Optional array, unique decimal strings, sorted as a set. |
| ad_account_ids | adAccountIds | Same bounded set rule. |
| dataset_ids | datasetIds | Same bounded set rule. |
| catalog_ids | catalogIds | Same bounded set rule. |
| instagram_account_ids | instagramAccountIds | Same bounded set rule. |

Unsupported/missing required fields are rejected. In particular, this initial profile
does not accept a finish payload without business_id or synthesize it from WABA data.
Any needed alternate provider profile/discovery route requires actual source evidence
and the existing review process. Submitted IDs remain claims until server grant and
ownership verification. Callback origin is not proof of asset ownership.

Cancel/error payload details are discarded. Only the selected event class survives;
localized error messages and selected-business data never enter bridge diagnostics.

## Step 3: bounded, serialized host recording

There are at most two fragment slots (one code, one session), one active host call and
one cancellation intent. Either arrival order is supported. The second part waits
behind the current host recording, avoiding unnecessary optimistic-version races.
Duplicate intent is compared by a WebCrypto SHA-256 digest of the normalized fragment.
Repeated input while that kind is being hashed is refused rather than queued without
bound. No duplicate acknowledgement is fabricated for such refused input.

An acknowledged duplicate is not resubmitted. Changed intent stops collection without
overwriting the earlier selection. Raw fragment references are dropped after a matching
receipt, disposal or expiry. This is reference minimization, not guaranteed memory
erasure in JavaScript or a guarantee about what an injected transport retains.

Host results are checked using the unchanged `inspectSignupAttempt` projection and
additional exact attempt, scope, creation/expiry, state/flag and version checks.
A successful HTTP status alone is not enough: a valid minimized AttemptView must match.
No UI READY status, provider result or grant is inferred from a host receipt.

A failed, invalid or unknown receipt pauses recording. `retryPending()` explicitly
reuses the same pending fragment; it does not initiate another OAuth exchange or
provider action. No retry is automatic. A transport that ignores abort remains one
outstanding call and prevents repeated pending calls from accumulating. A late result
does not silently turn an unknown observation into a new acknowledged state.

## Step 4: cancellation, expiry and lifecycle cleanup

`cancel()` closes admissions, drops unsent queued work, waits for the bounded active
call and asks the host to cancel this attempt. Only a matching CANCELLED/EXPIRED
receipt produces an acknowledged cancellation state. Unknown or uncooperative host
results remain a local stop, not a claim of durable cancellation.

An SDK no-code response or profile-selected ERROR stops locally without a server
cancellation claim. `dispose()` removes the listener and cancels local waiting, but
cannot undo a server write already submitted. Expiry is checked synchronously during
input/status handling as well as by a timer, so a throttled browser timer cannot extend
an attempt. Server time, fencing, expiry and cleanup remain authoritative.

## Actual public functions and ownership

| File / symbol | Inputs and outputs | Effects / failure boundary |
|---|---|---|
| `signup-callback-parser.mjs` / validateCallbackProfile | Unknown host profile -> frozen validated profile | No defaults or provider qualification. Fixed neutral input error. |
| Same / decodeSignupCode | Unknown SDK response -> code or sdk_no_code fragment | Sensitive code only for ephemeral transport; no storage or logging. |
| Same / decodeSignupMessage | Raw text + selected profile -> claims/terminal fragment or null | No authorization, grant, acknowledgement or side effect. |
| `signup-callback-bridge.mjs` / bindSignupCallbacks | Explicit options -> frozen controller | Installs a listener/timer only, not SDK initialization or HTTP routes. |
| Controller / sdkCallback | One SDK response -> Promise<void> | Collection result, not synchronous proof of host commit. |
| Controller / retryPending | No arguments -> snapshot | Explicit retry of same internal recording only; no provider exchange. |
| Controller / cancel | No arguments -> snapshot | One scoped host close request, exact receipt check. |
| Controller / snapshot | No arguments -> minimized report | Local/advisory states, copied diagnostic fields and known request reference. |
| Controller / dispose | No arguments -> void | Detach, abort local waiting, drop buffered payload references. |
| `signup-callback-view.mjs` / inspectSignupCallbackBridge | Unknown report, expected scope, now -> safe labels/details | Rejects malformed, cross-scope, old and contradictory observations. Never renders supplied message text. |
| `MetaSignupSetupPanel.jsx` | Existing props + optional callbackObservation | Same design; adds step-3 diagnostic subsection. Preview passes no observation or live bridge. |
| `signup-callback-bridge.d.mts` | TypeScript consumer declarations | Not a runtime validator, generated API contract or strict TS conversion of the JS source. |

All paths above are under `front end/src/features/channels/meta/`.

### Explicit resource/parameter bounds

- Ticket: nonzero UUID attempt/scope IDs; decimal-string app ID; positive creation and
  expiry values, at most 900,000 ms apart. These are host-selected data, not authority.
- Host operation timeout: explicit positive integer, at most 30,000 ms, capped by the
  remaining ticket lifetime. No automatic provider timeout/retry profile is chosen.
- JSON: 32,768 UTF-8 bytes, depth 4 (root at 1), 1,024 tokens; decoded keys at most
  80 characters; arrays at most 32 values. Provider IDs stay strings, up to 64 digits.
- Code: at most 8,192 UTF-8 bytes, no whitespace/control characters or lone surrogates.
- Profile: three distinct uppercase event names, nullable sessionVersion or integer
  1..99. Null requires version absence; an integer requires exact matching presence.
- UI report freshness: at most 30 seconds, exact UUID scope. Neither the browser clock
  nor a snapshot grants launch, token exchange, or access to another object.

## Authenticated host integration still required

The REQUIRED transport has these internal methods:

```text
submit({attemptId, appId, kind, code OR session}, AbortSignal) -> AttemptView
cancel(attemptId, AbortSignal) -> AttemptView
```

The future same-origin HTTP host must authenticate the current session, enforce CSRF
and object permission, resolve the server-owned profile/placement and retrieve the
attempt-local correlation channel. It must NOT trust the browser's app/attempt/scope
as permission. Then it constructs the existing Callback and invokes
`SignupAttempts.receive`; cancellation invokes `SignupAttempts.close(...,'cancel',...)`.
Real transactional record/history/outbox and encrypted idempotent code custody are
mandatory before these transport methods can truthfully return their receipts.

No proposed public endpoint or OpenAPI payload is changed by these private adapter
methods. HTTP mapping, request-level idempotency, deployment, callback-window/SDK
qualification and real database/vault integration remain separate reviewed work.
The server still revalidates state, nonce, session, expected app and expiry. Neither
state nor nonce is assumed to be echoed by Meta or stored in browser session drafts.

## Frontend and diagnostic integration

Channel Center -> Configure retains the INC-016 preparation and INC-017 attempt
sections, and adds **Step 3 — attempt-local SDK callback bridge**. It shows fixed
explanations by default. When a host later supplies a minimized callbackObservation,
only receipt flags, stage/result, elapsed time and a known server request ID are shown.
No SDK loading, bridge construction, fetch, arbitrary URL, code/secret form or enabled
launch/retry control is added to the panel.

The bridge observer receives scoped local snapshots, not raw provider events. Global
metrics must not use these IDs as labels. A snapshot's `recorded` state means the
browser observed both host receipts; it is not independent database/Meta evidence.
The actual server attempt observation and all later F02 gates remain distinct.

## Verification

Run from the repository root:

```sh
python tools/check_meta_signup_callback_bridge.py
```

162 named tests passed: **134 new parser/bridge/view checks + 28 unchanged INC-017
frontend regressions**. The existing attempt model and regression file were restored
locally from GitHub and their Git blob hashes matched; neither is changed by this
increment. Real WebCrypto performs the digests; source windows, native-event metadata
and host receipts are explicitly synthetic Node test fixtures.

Three JavaScript syntax checks, one JSX parse-only check and strict TypeScript
consumer-declaration checks passed. The implementation is JavaScript; these results
are NOT a strict TypeScript source build, a React render, a real browser/Meta SDK run,
a full repository regression, backend-domain rerun or live HTTP/database/KMS test.
No dependency version, installation policy or existing test expectation was changed.

Current source qualification, supported source-window binding, authenticated HTTP,
real attempt/custody stores and a permitted account-level signup are still required.
The existing two Mission browser failures / specific INC-015 approval remain open.
INC-010 remains unpublished. No parent task or release gate is promoted.

**Next step:** implement the reviewed same-origin HTTP mapping and real scoped
attempt/custody adapters, then qualify the SDK launch against an authorized account.
Only after those boundaries work should the exchange-claim worker progress the
existing F02 sequence. This source publication is not production deployment.
