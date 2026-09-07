# Owner requirements and development control

Recorded from the owner's 7 September 2026 instruction. This is a durable project record, not a claim that requirements are already implemented.

## Scope and delivery

Develop the existing Greeto frontend and the selected backend; keep the original components, layout, names and feature IDs. Use `main` only, no new branches, no force-push, no overwritten concurrent work. A source push is not production deployment. Preserve all 262 work-package IDs and their prerequisites. Update the Excel evidence tracker after each increment. The original source documents remain immutable in the Library workspace recorded by SOURCE_REGISTER.json.

The former frontend-only scope is superseded by this explicit backend request. The existing React/Vite frontend is retained pending the documented Next.js/TypeScript migration decision. NestJS remains the selected control-plane framework; Go is the selected ingress/data plane. Framework-neutral TypeScript domain code is not a substitute HTTP framework. No MongoDB, second event broker or alternate workflow engine is introduced.

## Required operational behavior

Every API/webhook stage needs correlation, time, result class, authoritative acknowledgement boundary and a sanitized reason. Authentication, tenant/workspace/environment/object authorization, signature verification, bounded inputs, capability/policy/consent checks, idempotency and durability are not optional. Unknown external results remain UNKNOWN until evidence resolves them.

Keep F03 fast: raw proof, bounded parsing, authoritative placement, durable Kafka acceptance, HTTP acknowledgement, then asynchronous processing. Do not add an AI call, CRM write, backup write, remote log query or health-ping round trip before the webhook acknowledgement. Read recent measured dependency health for diagnostics; the actual journal write/provider attempt remains the authority for its own result. Stale/missing health is visible, never green by default.

Kafka uses the baseline replication/quorum/idempotence policy, bounded retries and dead letters, stable event IDs, outbox reconciliation and effect-before-offset consumption. Queue acceptance, provider acceptance, delivery/read and business success are separate states.

## Data protection and cyber security priorities

Protect each essential store with its native recovery mechanism and an independent backup/recovery boundary. A standby is not an immutable backup: accidental deletion or corruption can replicate. Do not dual-write all stores into one global backup DB or activate two senders for one provider identity. Restore into a separately controlled environment; verify keys, fence writers, reapply erasures, replay checkpoints, reconcile UNKNOWN actions, verify policies and canary before reopening.

Use scoped envelope encryption and TLS, least-privilege non-owner DB roles, FORCE RLS where applicable, parameterized queries, constrained support access and explicit key rotation/revocation/recovery. No generic HTTP decrypt endpoint. No keys, tokens, passwords, sensitive bodies or authorization headers in browser storage, logs or version control.

UEFI Secure Boot is a host/AMI/firmware control. Signed images, admission verification, restricted workloads, runtime monitoring and secure audit are additional layers, not substitutes. Never claim the feature is enabled from an application flag or a missing observation. Intrusion/abuse monitoring must cover identity anomalies, denied cross-tenant access, forged webhooks, SSRF, DB privileges, key use, runtime behavior, backup tampering and unauthorized release changes. Detector/alert installation and independent security verification remain explicit gates.

## Developer clarity

Each public function/component must document purpose, parameters/types, returned value, validation, authorization/scope source, side effects, durability/retry boundary and failure behavior. Keep controllers, domain services, repositories, provider adapters and shared components in their actual owning modules. Tests may use clearly marked synthetic adapters; runtime must never silently substitute those adapters. OpenAPI describes payloads, errors, scope, pagination, idempotency, timeouts, acknowledgement semantics, examples and implementation status. DB schemas document indexes, scope keys, constraints, encrypted fields and restore ownership separately from public DTOs.

## One place, not one-click bypass

The existing Implementation Center is the intended home for status, blockers, API/event traces, contracts, backups, security and release evidence. An authorized diagnostic action can run bounded approved checks. A browser button must not execute arbitrary shell commands, write source code, approve its own changes, replay irreversible actions or bypass provider consent/release gates. Until the backend adapter is connected, that control stays disabled with an explanation.

## Change control

Before changing pipeline order, API semantics, authority, dependency versions, storage ownership, framework, deployment or release gates: record the observed failure, exact proposal, affected requirements/files, risks, tests and rollback, and obtain the owner's explicit approval. Main-only source publication has been approved; production pipeline changes have not. Continue unrelated authorized work without declaring blocked parent work complete.
