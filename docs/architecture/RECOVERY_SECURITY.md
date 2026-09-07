# Recovery, secure logging and threat-control implementation notes

Status: implementation notes against the supplied baseline and backlog; no cloud resource was provisioned. Source: architecture sections 7-9, 12-16, 28-31. New owner emphasis is tracked without replacing F01-F18.

## Separate recovery resources, not one unqualified backup database

| Essential source | Recovery boundary | Evidence required before readiness |
|---|---|---|
| Aurora PostgreSQL control/ledger | Native PITR/snapshots; encrypted copies in independently controlled permitted account/region; restore to separate cluster | Latest recoverable time, copy status, checksums, role/RLS tests, migration compatibility, restore drill |
| DynamoDB command/action/message stores | PITR + protected backup copies; explicitly controlled DR replica where approved | Watermark, conditional-write/idempotency consistency, pending-index recovery and UNKNOWN-action reconciliation |
| S3 media and archives | Scoped encrypted objects/manifests, approved versioning/replication, separate recovery IAM | Object integrity, key access, erasure registry and denied resurrected content |
| Kafka | In-region quorum plus policy-approved archive/DR replication | Offsets/checkpoints, schema versions, replay and dedup proof; replication factor three is not a regional backup |
| Temporal | Recoverable persistence plus pinned workflow/artifact versions | Run-chain replay compatibility, cancellation and no duplicated external effects |
| Configuration, secrets and KMS | Versioned configuration, independent secret/key recovery policies | Ability to decrypt authorized restored data without restoring revoked access; test key loss/rotation |
| OpenSearch, ClickHouse and Redis | Rebuild from retained authorized sources; retain essential analytics evidence where required | Scope filters/erasure replay; Redis is never accepted-work authority |

The baseline RPO <=5 minutes and RTO <=60 minutes are proposed qualification targets, not measured guarantees. Contractual tiers, regions, retention and budget remain OD-05/GOV-007 decisions. Use protected/immutable backups only with an approved retention/deletion policy. Protect minimized integrity records; do not indiscriminately lock personal messages that may require erasure.

Recovery order: owner-authorized plan -> old-writer fence -> certified restore -> erasure/tombstone reapplication -> checkpoint replay -> UNKNOWN-action reconciliation -> policy verification -> canary -> controlled reopening. The Go guard checks supplied evidence only. It does not create backups, verify cloud attestations or promote databases. Gate references must be resolved by trusted adapters; a string supplied by a UI is not proof.

## Security monitoring and audit

| Threat | Preventive boundary | Detection/evidence | Current increment |
|---|---|---|---|
| Forged callbacks | Route-owned proof over raw bytes, bounded parser | Invalid-signature events, source rate and qualified fixtures | HMAC/token primitives + synthetic tests; official fixtures pending |
| Cross-tenant access | Authenticated scope, object authorization, scoped keys/FKs/RLS | Denied reads/writes/search/socket/export probes | SQL draft and status-service port; live identity/RLS tests pending |
| Lost acknowledged events | Kafka quorum, journal/outbox, no early offset | Unavailable ISR, pending age, consumer lag and reconciliation | Boundary primitives tested; real adapters pending |
| Duplicated external action | Stable action/intent ID, claims and evidence classification | UNKNOWN age, stale ownership epoch, duplicate provider evidence | Classifier tested; gateway/claims/reconciliation adapters pending |
| Credential/data exposure | KMS envelope encryption, TLS, scoped secret broker | Key-use/denial events, secret scanning, controlled audit export | AES-GCM primitive tested with test KMS only |
| Log injection/tampering | Allowlisted structured fields, bounded telemetry, durable privileged audit outbox | Drop/write-failure counters, externally anchored integrity proofs | Operational logger + audit schema; durable audit/SIEM pending |
| Boot/runtime compromise | Supported UEFI Secure Boot, approved AMI, signed image/admission, restricted non-root workload | Boot/attestation evidence, runtime detections and image policy decisions | Requirement only; no enabled-host claim |
| SSRF/malicious connectors | Revalidated DNS/IP egress, no redirects, isolated workers, response/decompression bounds | Denied destination classes, detector/fixture evidence | OpenAPI/control documentation only; egress implementation pending |
| Backup deletion/ransomware | Separate recovery IAM/account, protected vault and key recovery | Copy failures, restore failures, vault/key policy change alarms | Recovery design and guard only; no backup deployed |
| Insider/support misuse | Expiring scoped approval, read-only default, separation of duties | Privileged action audit and access review | Schema/planning only |

Operational telemetry is lossy under a bounded overload and reports dropped records. It is not the durable audit ledger. Mandatory privileged audit must be atomically stored with its configuration change or journal/outbox. Event payloads and PII are excluded from broad searchable logs. Export requires authorization, redaction, expiry and audit. Global metrics use cell/service/route/channel/result; do not label every global metric with millions of tenant IDs.

## Current primary-source checks (7 September 2026)

- Kafka acknowledgement/idempotence: https://kafka.apache.org/41/configuration/producer-configs/
- PostgreSQL owner/BYPASSRLS and FORCE RLS behavior: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- AWS protected recovery vault capabilities: https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html
- UEFI Secure Boot boundary: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/uefi-secure-boot.html
- Logging protection and sensitive-data exclusions: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- NestJS Swagger generation: https://docs.nestjs.com/openapi/introduction

These sources inform requirements; they do not demonstrate this application's deployment, security certification or successful recovery.
