# Greeto / Customer Action OS

Development follows the supplied Customer Action OS architecture v1, its 262 work packages and the owner instructions in `AGENTS.md`. Source publication uses `main` only. This repository is not a deployed or production-certified platform.

## Current increment

Backend foundation: durable webhook acknowledgement ordering, outbox and offset boundaries, raw signature primitives, evidence-based readiness, scoped AES-GCM envelope encryption, bounded structured telemetry, recovery gates and a TypeScript delivery-status domain. Real provider, Kafka, PostgreSQL, KMS and recovery adapters remain unconnected.

Frontend: an additional **Readiness & evidence** tab is prepared in the existing Implementation Center using the original shared page components. It shows source status separately from live operational evidence. The earlier full frontend/media import is still blocked and is tracked in issue #1; the complete React application is not yet present on `main`.

## Run local foundation checks

```sh
python tools/check_foundation.py
```

Go, Node and TypeScript must already be installed. This command does not install packages, change the pipeline, migrate databases, send messages, push code or deploy. It is not a substitute for the full release gates.

## Project records

- `docs/architecture/SOURCE_REGISTER.json`: persistent original plans, hashes and retrieval locations.
- `docs/requirements/OWNER_DIRECTIVES.md`: main-only delivery, prior approval and security/recovery requirements.
- `docs/delivery/status.json`: work-package contributions and explicit blockers; no certified parent completion.
- `docs/delivery/baseline-index.csv`: all original IDs, gates and predecessors.
- `backend/contracts/openapi.json`: detailed OpenAPI 3.1 contracts with implementation status, not a claim that all endpoints are running.
- `backend/db/migrations/0001_foundation.sql`: unexecuted PostgreSQL schema draft; DynamoDB access patterns are documented separately.
- `docs/architecture/RECOVERY_SECURITY.md`: datastore recovery ownership and threat controls.
- `docs/delivery/VERIFICATION.md`: checks actually run and remaining gates.

Original plans and the full structured frontend are retained in the owner's persistent `/Greeto_Action_OS` Library workspace. Updated Excel evidence trackers belong in `/Greeto_Action_OS/delivery`. A stored file is not a deployed database or an automated live status feed.
