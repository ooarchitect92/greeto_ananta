# INC-014: Windows frontend preview launcher

Date: 8 September 2026. Bounded local frontend utility, related to UX-003;
no original work-package status is certified complete.

The owner requested a one-click `start.bat`. The checkout lacked the frontend
manifest and entry points. The supplied structured-v1 ZIP was found in Downloads;
its SHA-256 is `9fe4185159b137cd94346265dd3e385b5aa9e3803bffbee9b31591a4f6291c23`,
exactly matching the persistent source register. The baseline tracker was also
found locally with its registered SHA-256. No re-upload was needed.

## Changed paths and value

- `start.bat`: location-independent Windows entry point, Node/npm prerequisite
  checks, locked `npm ci` on first launch, existing `dev:frontend` command and
  browser opening at `http://127.0.0.1:5174/frontend-preview`. Port conflicts fail
  visibly; Ctrl+C stops the foreground server. Error messages remain visible.
- `front end/`: restore 232 missing archive files and the supplied lockfile.
  The empty untracked lockfile was backed up to
  `.local-build/package-lock.before-frontend-restore.json` before restoration.
  All 238 frontend archive paths are present; 233 are byte-identical to the ZIP.
  The five differing tracked files were preserved: `src/contracts/types.d.ts`,
  `src/features/implementation/ImplementationCenter.jsx`,
  `src/shared/forms/validation.js`, `src/shared/state/drafts.js` and
  `src/shared/ui/PageLayout.jsx`. Existing backend and frontend source was not edited.
- `README.md`, `front end/docs/publication/STATUS.md`, this record and the Excel
  evidence workbook document usage, restoration and actual checks.

## Validation

Node 24.18.0 / npm 11.16.0, Windows. Correct-directory `npm ci --no-audit --no-fund`
installed 263 packages without lockfile changes. An earlier invocation from the
repository root failed because no root lockfile exists; it made no source changes.
The npm install reported an esbuild install-script policy warning; no npm policy
or lifecycle-script approval setting was changed.

- `npm run audit:frontend`: 55 features, 231 parameters, 262 work packages,
  449 imports, zero errors.
- `npm run test:contracts`: 180 passed, zero failed/skipped.
- `npm test`: two files, three tests passed.
- `npm run build`: passed, 2,921 modules transformed.
- `npm run test:e2e`: seven passed, two failed, one skipped. Both failures are
  the mission draft reload assertion at `e2e/frontend/frontend.spec.js:24`:
  expected `example-ref`, actual `Appointment follow-up`, desktop and mobile.
  The skip is the desktop-inapplicable mobile navigation test. The suite and
  application were left unchanged; this is an outstanding acceptance gate.
- Executed the actual `start.bat` from outside the repository. Vite started
  successfully on loopback port 5174 using the documented preview route.
- Browser smoke against that launcher: HTTP 200, Implementation center visible,
  zero JavaScript page errors. The test server was then stopped.
- `git diff --check` passes for the authored launcher/documentation. The full
  staged source import reports existing whitespace in supplied archive files;
  original source formatting is preserved.

## Scope and remaining gates

No framework, dependency versions, APIs, authentication, authorization, provider
integration, CI/CD, infrastructure, migration, test gate or release policy changes.
The launcher invokes the existing preview command with strict port selection.
Source restoration uses the owner's existing main-only frontend publication scope.
No publisher from the ZIP was run, and no review branch was created.

The preview remains draft-only. The complete backend/runtime, original live
integration environment, independent security review and production release remain
unconnected/unverified. Go is not installed here, and the diagnostic host is not
started by this frontend launcher. The separate original-import snapshot/history
in issue #1 is not delivered by this increment. UX-001 remains open. No parent
work-package status or predecessor order was modified.

Rollback: revert this source increment on main with a normal commit. The original
ZIP and baseline workbook in Downloads remain untouched. The source register's
ChatGPT Library is not mounted in this session; the updated workbook is delivered
in `docs/delivery/INC-014_EVIDENCE.xlsx`, with original baseline sheets preserved.
