# Prompt for the next implementation increment

Work only inside `front end/`. Read `README.md`, `docs/IMPLEMENTATION_GUIDE.md`, `docs/QUALITY_REPORT.md`, `src/contracts/features.json`, and the exact source work package in `src/contracts/work-packages.json` before editing. Confirm current Git history and preserve unrelated work. Do not modify any backend, migration, infrastructure, secret or provider configuration file.

First install locked dependencies with a Node version compatible with `package.json`. Run the full build and the supplied React browser tests, because they were blocked in the prior environment. Fix failures introduced by the restructuring before adding features.

Choose one original work-package ID whose predecessors are satisfied. Verify its actual acceptance criterion, existing component, imports, API facade and signatures; never invent a filename or function from an architecture diagram. Preserve the existing Greeto visual language and original working screens. Implement the selected frontend behavior and its loading/empty/invalid/forbidden/conflict/failure/unknown states. Keep proposed APIs disabled until there is an authoritative backend contract; never produce a fake send/publish/payment/approval success.

Use `src/contracts/features.json` as the parameter definition source. Update the lightweight `navigation.json` projection when labels/counts change. Keep user/tenant/workspace/environment isolation in drafts. Use credential references only and keep the dev preview separate from production auth. Update `types.d.ts`, tests and documents together. Retain all original source work-package IDs and baseline criteria. Record UI progress separately from whole-package completion.

Run `npm run audit:frontend`, `npm run test:contracts`, `npm run build`, relevant Vitest tests and `npm run test:e2e`. Report changed files, implemented behavior, exact tests actually run, remaining integration dependencies, and the next source work-package ID. Never mark a parent package Done without acceptance evidence. Review ADR-0001 before claiming Next.js/TypeScript compliance.
