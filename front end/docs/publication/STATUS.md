# Frontend publication status

Date: 7 September 2026.

## This increment is partial, not the full application import

This increment contains the original structured-v1 implementations of:

- `src/shared/forms/validation.js`: parameter validation and draft-only handoff exports.
- `src/shared/state/drafts.js`: scope-isolated draft storage helpers.
- `src/contracts/types.d.ts`: documented frontend types, not a TypeScript migration.

These three files are copied without modification from the supplied structured-v1 package. The added `tests/publication-foundation.test.mjs` is a dependency-free test of these helpers using synthetic fixtures. It does not validate the complete production schemas or backend enforcement.

Repository delivery rules and the pipeline approval template are included. No application routes, runtime pipeline, backend files, CI/CD workflows or deployment settings are changed by this increment.

The complete original frontend import, structured navigation, feature screens, schemas/inventories and media assets have NOT been published by this increment. This repository is not yet a runnable full frontend. Do not interpret the presence of source code as completion of either full-package publication request.

## Evidence from this publication session

- Original ZIP frontend: 144 files; all 144 import-package files match the source ZIP byte-for-byte.
- Full structured package, checked locally: 68 contract tests passed; audit reported 55 entries, 231 parameters, 262 work packages, 27 domains and 432 checked imports, with no audit errors.
- This published helper subset: 16 tests passed with Node 22.16.0 using the command below.
- Full React build, npm dependency installation, browser integration tests and production deployment: NOT VERIFIED in this session.

Run the published subset from the repository root:

```sh
node --experimental-default-type=module --test "front end/tests/publication-foundation.test.mjs"
```

These are local test results, not GitHub Actions results. Existing full-package test and build gates are not weakened or replaced by this helper test.

## Bulk-publication blocker

The working environment cannot resolve GitHub or the npm registry and has no authenticated Git CLI connection. The available GitHub connector supports inline content writes but exposes no mounted-file bulk upload operation. The frontend includes binary media, including a 12,158,453-byte video. A complete binary-safe bulk import has not been performed. No temporary Actions workflow, external asset substitution or permission bypass was introduced to work around this limitation.

The remaining desired increments are: (1) publish the exact original frontend snapshot; (2) publish the complete structured-v1 frontend while preserving the original assets and documented compatibility. Keep these increments traceable and verify the resulting remote refs and file hashes. Local bundles or scripts are transfer aids only, not proof of publication.

## Source archive fingerprints

| Source | SHA-256 |
|---|---|
| `greeto-2.0-main(1).zip` | `4d44ecf10cb7440725782334ac6238162417037acfe12850bc4b5fa9752e917e` |
| `greeto_ananta_frontend_import.zip` | `a899ee9919ef9f79a7dc6c0373ee6a5f5b5c12a30d0a0962f289f65303dc96e8` |
| `greeto_ananta_frontend_structured_v1.zip` | `9fe4185159b137cd94346265dd3e385b5aa9e3803bffbee9b31591a4f6291c23` |

## Baseline precedence and approval

Customer Action OS v1 and its original delivery tracker govern Mission-led scope, safety invariants and work-package IDs. The older Greeto architecture supplies screen inventory. The supplied source ZIP defines actual existing files/APIs. This is taken from the supplied implementation guide, not a newly invented pipeline.

The owner requires explicit prior approval for any pipeline change discovered during testing. No such change is approved by this publication. Existing React/Vite compatibility and the deferred Next.js/TypeScript decision remain as documented; this increment does not resolve or complete UX-001 or any parent work package.
