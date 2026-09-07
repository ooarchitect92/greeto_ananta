# Greeto backend foundation

This is a tested foundation increment, not the complete production backend. Go owns the ingress/data-plane primitives; the TypeScript status domain is intended for the selected NestJS core. No alternate queue, database or workflow engine is introduced.

## Local diagnostic host

From `backend/`, run `go run ./cmd/ingress`. It binds only `127.0.0.1:8090`. `GET /health/live` returns process liveness. `GET /health/ready` and `POST /callbacks/...` intentionally return 503 because real provider/placement/Kafka adapters are not connected. This host sends no messages, creates no tenants and changes no database.

## Source ownership

| Path | Responsibility | Remaining production integration |
|---|---|---|
| `services/ingress/handler.go` | F03 verification/parse/bind/commit-all/ACK ordering and bounds | Official provider schema fixtures, authoritative routing/quarantine, real Kafka adapter |
| `services/ingress/proof.go` | Raw HMAC and secret-token verification primitives | Vault-backed route lifecycle, official provider conformance |
| `internal/events/` | Kafka durability policy, outbox/offset boundaries and attempt classification | Kafka client, CDC, DB transactions, retries and reconciliation workers |
| `internal/health/` | Operation-specific positive/fresh evidence evaluation | Bounded real probes, signed/current snapshots, alert ownership |
| `internal/observe/` | Allowlisted bounded structured telemetry with failure counters | OTel collector, durable audit outbox and SIEM integration |
| `internal/security/` | Scoped AES-256-GCM envelope with KMS port | KMS/workload identity, authorization, rotation and recovery |
| `internal/recovery/` | Ordered recovery evidence guard | Cloud restore/fence/erase/replay/canary adapters and approvals |
| `services/core/src/status-service.ts` | Authorized versioned/idempotent progress transitions with acceptance gates | NestJS controller, real SQL repository, auth and evidence-verification adapters |
| `db/migrations/0001_foundation.sql` | Additive scoped control/audit/recovery schema draft | Migration review, non-owner grants, live SQL tests and application |
| `contracts/` | OpenAPI and selected Kafka/DynamoDB contracts | Runtime contract tests and compatibility/release gates |

Every port's test implementation is confined to test files. No in-memory journal, fake KMS or test identity is wired into runtime. There is no generic decrypt, unrestricted HTTP proxy, arbitrary shell or automatic database-promotion API.

`../tools/check_foundation.py` runs the current local checks without installing dependencies, rewriting the pipeline, migrating data or pushing/deploying. Go, Node and TypeScript must already be available. Production toolchain versions and signed images remain GOV-002 qualification work. Full frontend, SQL/cloud/provider, integration, browser, security and capacity tests remain explicit blockers.
