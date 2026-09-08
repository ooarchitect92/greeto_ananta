# INC-015 — Mission browser fixture correction review

Status: PENDING OWNER APPROVAL. No approval is inferred from the continuation request.
Date: 9 September 2026. Base: `37d9831d850b866ee08df45debc86d07349ca857`.

## Observation

The existing `front end/e2e/frontend/frontend.spec.js` calls `fill(...)`, which uses
the nonempty Mission-name schema default `Appointment follow-up`. After save/reload
it expects `example-ref`. The two reported INC-014 failures have exactly that
expected/actual mismatch. Core storage tests also preserve the documented name.
This is code-path/recorded-failure diagnosis, not a browser rerun.

## Proposed bounded correction

After filling the Mission parameters and BEFORE validating/saving, explicitly fill
the existing `[name="name"]` control with `example-ref`.
Keep the existing reload `toHaveValue('example-ref')` assertion, validation checks,
no-API-request assertion, export check, disabled server action, viewport coverage,
timeouts and all other test conditions unchanged. This makes the test exercise a
user-edited nondefault name rather than assert a value it never entered.

Affected file: only `front end/e2e/frontend/frontend.spec.js`.
Related work: UX-003 / QAT-001. No feature default or runtime/pipeline change proposed.
Alternative: derive the expected value from the schema, but that proves less about
an explicit user edit. Do not change the application default just to make a test pass.

## Acceptance and rollback

After explicit approval, rerun the unskipped existing desktop/mobile suite with the
locked dependencies and compatible Node version; inspect any new failure without
relaxing assertions. Retain the original INC-014 failure record. A passing run is
frontend evidence only, not server integration or parent acceptance. Roll back the
single test-input edit with a normal commit; never force-push or waive a release gate.

Owner decision: PENDING
Approval reference/date/scope: not supplied
Implemented commit: none
