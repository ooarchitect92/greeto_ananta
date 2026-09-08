# ADR-0001: Preserve the uploaded React/Vite frontend for the restructuring increment

Status: implemented as a frontend compatibility decision; production architecture deviation remains open.

The newer Action OS baseline selects Next.js with TypeScript. The actual uploaded application uses React 19 and Vite with JavaScript, existing auth/API behavior and a provider-specific workflow editor. Replacing the framework while also restructuring every feature would broaden this increment and complicate regression evidence.

Decision: keep React/Vite and the existing lockfile dependency versions, split feature ownership, add explicit schemas and documented types, and isolate the new frontend review route to development. Do not build a new backend/BFF or claim a Next.js migration was completed. Update package metadata/scripts only, retaining locked package versions and integrity hashes.

Consequence: UX-001 is not satisfied by this change. The framework migration needs a separately reviewed frontend increment, approved routing/SSR requirements, an auth/API compatibility plan and actual build/browser evidence. Existing large controllers/API implementations are retained behind clear boundaries and should be extracted gradually.

Navigation role checks and session draft scoping are frontend safeguards only. Authentication, permission grants, durable simulation separation, idempotency and Action Gateway execution are not implemented here.
