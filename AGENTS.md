# Greeto repository delivery rules

Owner instruction recorded on 7 September 2026. Applies to human and AI-assisted changes.

## Authorized scope

- The owner requested publication of the original frontend import and the structured frontend v1 package in `ooarchitect92/greeto_ananta`.
- Application changes are restricted to `front end/`. Leave `backend/`, infrastructure and deployment configuration unchanged.
- Preserve the supplied source assets, existing APIs, route compatibility and the documented frontend-only boundary. Configuration drafts must not be represented as live backend execution.
- Repository-level delivery documentation may record these instructions. It does not authorize application or CI/CD pipeline changes.

## Pipeline approval is mandatory

Follow the Customer Action OS v1 architecture, original delivery tracker, source register and documented implementation order. Do not invent missing pipeline steps or mark predecessor work complete merely because a page exists.

Before changing the application/data/action pipeline, dependency order, API contract, authentication or authorization flow, provider integration, framework, infrastructure, dependency versions, CI/CD workflow, deployment trigger, test gate or release policy:

1. Stop the affected change and document the failing test or concrete requirement.
2. Submit a change request with the current behavior, proposed behavior, affected files and work-package IDs, alternatives, risks, validation and rollback.
3. Obtain the owner's explicit approval for that specific proposal. Silence, a failing test and an earlier general development instruction are not approval.
4. Record the approval reference and scope before implementation. A materially different proposal needs renewed approval.

Never add a temporary workflow, relax a test, bypass a safety control, substitute assets or change the pipeline just to make an import or build succeed. Continue unrelated, already authorized work where safe.

## Delivery means verified remote publication

Work in small increments tied to a documented work package or bounded frontend utility. For each increment, record changed paths, value delivered, tests actually run, outstanding gates and pipeline impact. Commit and push to the authorized branch without force-pushing or overwriting concurrent changes. Read the remote ref/tree afterwards and report the exact branch and commit SHA.

A local commit, ZIP, Git bundle or generated script is not a pushed change. Report it as local-only until remote verification succeeds. Do not mark delivery complete when upload or verification is blocked. A partial publication must list the missing files/features explicitly. Do not call a source push a production deployment.

## Baseline and current status

See `front end/docs/publication/STATUS.md` and `front end/docs/publication/PIPELINE_CHANGE_REQUEST.md`.
The documented React/Vite retention is not approval for a future Next.js/TypeScript migration. UX-001 remains open. Do not modify the original source work-package statuses without acceptance evidence.
