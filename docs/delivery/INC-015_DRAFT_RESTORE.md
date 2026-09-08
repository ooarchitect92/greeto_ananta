# INC-015 — safe scoped frontend draft restoration

Date: 9 September 2026. Repository: `ooarchitect92/greeto_ananta`; `main` only.
Inspected base: `37d9831d850b866ee08df45debc86d07349ca857`.

## Delivered behavior

The existing configuration studio calls `saveDraft` and `loadDraft` in
`front end/src/shared/state/drafts.js`. This increment hardens that SAME module.
There is no new visual component, navigation, service, data store or API.
The existing error/notice handling displays the safe failures before field values
are restored. Configuration pages remain session-only drafts, not server commands.

The previous save boundary inspected embedded JSON strings for unsafe keys, but
load only inspected the outer object. A malformed or modified storage record could
therefore restore secret-shaped embedded JSON or object values into text controls.
The previous envelope-size check counted UTF-16 code units rather than its stated
byte limit, and JSON serialization could silently discard/coerce unsupported values.
These gaps were reproduced with the original module before implementation.

Implemented:

- Reuse raw editor-type and safe-data checks at both save and restore boundaries.
- Parse embedded JSON strings at restore too; omit raw parser/input text from errors.
- Reject malformed envelope metadata, unsupported value types, accessors, hidden or
  symbol properties, cycles, sparse arrays and non-finite numbers before serialization.
- Enforce the existing 64,000-byte envelope limit as UTF-8 bytes, before parsing on read.
- Preserve exact valid draft values, blanks, false, zero, missing fields and editable
  numeric strings. Do not trim, replace with defaults or require complete business input.
- Return null only for a missing key, not unreadable/corrupt storage. No automatic
  deletion/rewriting of rejected drafts. Failed validation never calls setItem.
- Keep the existing v1 key, four-dimensional scope, envelope version and exported
  function signatures. Make cleanup/storage failure messages neutral.

## Owning functions and parameters

| Function | Inputs / returned value | Validation and effects |
|---|---|---|
| `draftKey(scope, featureId)` | Existing tenantId/workspaceId/environment/userId and registered feature; string | Unchanged v1 key. Missing scope fails before storage access. Browser scope is not backend authority. |
| `saveDraft(storage, scope, feature, values)` | Existing sessionStorage, trusted feature contract, plain raw values; void | Checks representation and safe JSON, then performs one setItem. Return means that local storage call succeeded, not durable/server acceptance. No retries or alternate store. |
| `loadDraft(storage, scope, feature)` | Same scope/contract; detached v1 envelope or null | One getItem, bounded parse, metadata/type/safety checks before return. Does not write/delete. saved_at is save metadata, not new authorization freshness or a TTL. |
| `clearDraft(storage, scope, featureId)` | Existing store/scope/key; void | Removes only the specified key. Throws a safe failure message. |
| `clearScopedDrafts(storage, scope)` | Existing store and complete scope; void | Removes only exact scoped-prefix keys, preserving neighboring users. Individual removals are not atomic; failure may follow earlier removals. Not server sign-out or erasure. |

`feature` is a code-owned registered field contract, not customer-submitted schema.
Plain data validation is not a sandbox for executable JavaScript Proxies. The existing
`assertSafeData` recognizer remains defense in depth; this does not promise detection
of every possible secret or personal record. Users must not put such data in drafts.
The browser remains untrusted: all server authorization, business validation,
capability checks, version checks and durable persistence are still required.

Partial drafts deliberately remain saveable. The separate existing `validateFeature`
and `buildHandoff` still decide whether a parameter set may be exported as a valid
DRAFT. No new schema fields, provider permissions or execution capabilities are granted.
Legitimate records written by the current v1 UI remain compatible. Malformed or
unsupported older records show an error and remain available for explicit reset;
there is no automatic destructive migration or retention change.

## Existing browser failure investigation

INC-014 reported two Mission reload failures, one per viewport. The unchanged test
helper fills the schema default for `name`, which is `Appointment follow-up`, but
its reload assertion expects `example-ref`. The reported actual value matches the
filled default; that failure alone does not demonstrate lost storage.

The existing Playwright file, fixtures, feature defaults and assertions are unchanged.
See `INC-015_BROWSER_ASSERTION_REVIEW.md` for the exact proposed input correction.
It is PENDING approval and not implemented. This increment does not report those
browser failures as fixed or replace the browser gate with its Node tests.

## Validation and limitations

Run from repository root:

```sh
python tools/check_frontend_drafts.py
```

138 dependency-free Node tests passed: 68 existing core contract tests and 70 new
boundary tests. The new suite against the old module had 46 pass / 24 fail. Both
syntax checks pass. The tested original dependencies were hash-matched to main;
see `INC-015_VERIFICATION.json` for their exact hashes.

The new checks cover all 25 parameterized feature defaults, partial/custom Mission
round-trips, byte-limit edges, malformed metadata, unsafe embedded JSON, bad types,
nonserializable inputs, quota errors, detached values and scoped cleanup.
They use synthetic session storage, not React rendering, a browser or a database.

Observed Node: 22.16.0. It can run these dependency-free tests, but is below the
existing frontend package's engine requirement. A local offline dependency attempt
failed with ENOTCACHED; no source/lockfile/version or install policy was changed.
Full npm install/build, component tests and Playwright were NOT run in this session.
The recorded INC-014 Windows build/launch evidence remains historical, not rerun.
Backend regression, live provider/database/Kafka/KMS/recovery/security acceptance
and production deployment are outside this bounded frontend increment.

## Baseline and publication

Scope contributions: UX-003 (existing command-center/configuration usability) and
QAT-001 (boundary/contract regressions), retaining original predecessor gates.
Architecture sections 1.2, 17.1, 28.1 and 32.2 require distinct draft/execution states,
no browser secrets, explicit validation and failure behavior. This is a repair within
that boundary, not a change to F01–F18 or an approved production pipeline.

No backend, database migration, API, dependency, framework, authentication flow,
launch script, CI/CD or release gate is changed. No parent work package is certified
Done. INC-010 remains separately unpublished; no blocked source is retried here.

The status follow-up records INC-014 frontend restoration/build evidence separately
from INC-015 local tests, synchronizes the existing frontend status JSON with the
repository record, and updates README. Readback commit/hash evidence is recorded
only after publication succeeds. The canonical Library tracker retains previous
increment sheets; the repository's separate INC-014 workbook is not overwritten.
