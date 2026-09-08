# Greeto frontend — structured implementation baseline

**Delivery:** 7 September 2026 • Frontend only • Review increment 1.0

This package restructures the frontend from the uploaded `greeto-2.0-main(1).zip`, preserving the React/Vite application, original media and Greeto purple visual language. It adds grouped navigation, parameterized configuration pages and a source-linked implementation workbench. It is **not** a backend implementation or a production certification.

## What is included

| Item | Count / status |
|---|---|
| Workspace entries | 55: 29 existing screens, 25 configuration pages, 1 implementation center |
| Navigation groups | 9 |
| Baseline work packages | All 262 exact IDs across 27 domains |
| Documented configuration parameters | 231 |
| Existing API function signatures inventoried | 251 |
| UI/component and hook signatures inventoried | 238 |
| Source files relocated with import reconciliation | 72 |
| Pure contract tests | 68 passed |
| Full production build / React E2E | Not verified; see quality report |

Start with **`docs/IMPLEMENTATION_GUIDE.md`**. Use `docs/FEATURE_MAP.md` for ownership and routes, `docs/PARAMETERS.md` for field definitions, and `docs/IMPLEMENTATION_ORDER.md` for predecessor-aware sequencing. The exact original tracker IDs and acceptance criteria are in `src/contracts/work-packages.json` and `docs/WORK_PACKAGES.csv`.

## Run the isolated frontend review

Use Node **24.15.0** (the `.nvmrc` target), or another Node version allowed by `package.json` and the locked dependencies. The execution environment used for this delivery had Node 22.16.0, which is below some locked development dependencies' requirements.

From this `front end` directory:

```bash
npm ci
npm run dev:frontend
```

The development browser opens `/frontend-preview`. This dev-only review route uses a synthetic scope and **does not mount the legacy API clients**. Existing live-integrated screens are represented by their actual source entry and an explanation in this isolated view; they are not replaced by fake working screens. New configuration forms and the implementation center can be reviewed without a backend after installing dependencies.

For the original application with a separately configured backend:

```bash
npm run dev
```

The dev server uses port 5174. The optional `.env.example` describes the development API proxy and public URL settings. Browser-exposed variables must contain public configuration only. No provider keys, passwords or access tokens belong in frontend environment files.

## Quality commands

```bash
npm run audit:frontend
npm run test:contracts
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

The new Playwright suite starts its own isolated development server on port 5274. The original Windows live-integration harness remains available as `npm run test:e2e:legacy`; it requires the original integration environment. It was not executed here.

## Scope boundaries

No backend files, database migrations, provider credentials, infrastructure, message-send implementations or billing operations are included. New pages save optional per-user **session drafts** and export validated draft JSON; they never claim live authorization or delivery. Every parent work package retains its original `Not started` delivery status until acceptance evidence is supplied. UI implementation status is tracked separately.

GitHub was not updated by this increment. The enclosing delivery ZIP includes a guarded PowerShell publisher that creates a review branch, stages only `front end/`, and never merges or force-pushes.
