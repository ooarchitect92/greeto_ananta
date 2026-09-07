> Historical INC-003 preparation record. Source publication is tracked separately in `docs/delivery/status.json` and `INC-005_STATUS_STORE.md`; the original local-only report below is retained for traceability.

# INC-003 — tenant scope and PostgreSQL read boundary

Date: 7 September 2026. **LOCAL CANDIDATE — NOT PUBLISHED.**

Remote baseline inspected: `ooarchitect92/greeto_ananta`, `main`,
`38533a13540fe507416b025f3880bc72acb16485`.

## Contribution and acceptance boundary

Preparatory source for PLT-001, PLT-003, DAT-001 and UX-003. GOV-001 and the
original parent dependencies remain unaccepted. This increment does not complete
those work packages or activate a tenant. It is not a replacement for NestJS,
OIDC/OPA, signed placement, the F01 provisioning saga or the Action Gateway.

The existing F01–F18 ordering, original SQL migration, API contracts, dependency
versions, existing status service, Kafka/Temporal ownership and CI/CD gates are
unchanged. No production database, permissions, encryption keys or infrastructure
was created. No change request is silently approved by these files.

## Actual files and functions

| File | Public function / class | Inputs and returned value | Effects / failure boundary |
|---|---|---|---|
| `backend/services/core/src/platform/tenant-scope.ts` | `parseTenantScope(input)` | Unknown input -> frozen lowercase UUID tuple | Syntax only, never authority; unknown/nil/missing fields rejected |
| Same | `parseScopeSnapshot(input)` | Unknown adapter row -> frozen lifecycle/scope record | Accept only exact fields/states; epoch stays decimal text |
| Same | `TenantScopeService.inspect(principal, requested, binding, signal)` | Server identity, requested tuple, trusted placement, cancellation -> observed state | Object grant before storage; neutral denial/missing scope; no provisioning |
| Same | `TenantScopeService.requireStatusWrite(...)` | Same -> active scope observation | Only existing delivery-status permission; not a provider permit or reusable lease |
| `backend/services/core/src/platform/postgres-scope-reader.ts` | `PostgresScopeReader.read(scope, signal)` | Authorized scope -> snapshot or null after commit | Read-only scoped SQL; driver errors redacted; failed/uncertain sessions discarded |
| `front end/src/features/implementation/tenant-scope-model.mjs` | `tenantScopeView(options)` | Expected scope, authorized observation, clock -> display model | Cross-scope/malformed/stale fields suppressed; no auth or network |
| `front end/src/features/implementation/TenantScopePanel.jsx` | `TenantScopePanel(props)` | Optional expectedScope and observation -> existing-design diagnostic section | Expiry clock only; unconnected by default |
| `front end/src/features/implementation/ImplementationCenter.jsx` | Existing component | Existing props unchanged | Two-line insertion mounts TenantScopePanel beside Readiness & evidence |
| `tools/check_tenant_scope.py` | `main()` | Existing Node/TypeScript executables -> local JSON/TAP report | No install/network/database/Git write; does not replace prior validation runner |

Every exported boundary documents its input, output, scope source, effects and
failure behavior in code. No backend HTTP route is invented or advertised.

## Read sequence

1. Decode the requested UUID tuple and validate host-provided placement values.
2. Resolve/authorize the principal for the exact object scope using the grant port.
3. Lease a bounded, clean SQL session and start SERIALIZABLE READ ONLY.
4. Set all three context IDs, query/lock timeout, row security and safe search path
   with parameterized transaction-local settings.
5. Check current/session roles, table ownership membership and FORCE RLS flags.
6. Join tenants -> workspaces -> environments using all composite-key predicates.
7. Decode the result; reject multiple, unsupported or cross-scope rows. COMMIT.
8. Match trusted cell, ownership epoch and production/sandbox/shadow kind. Require
   active lifecycle only for the status-write check.

This is a control-plane READ boundary, not a new stage in the webhook ACK path.
The role/config checks are defence-in-depth diagnostics, not certification that
all policies, grants, schema owners and infrastructure are secure.

## Database adapter contract

`ScopeSqlPool`/`ScopeSqlConnection` are explicit injection ports, not an installed
PostgreSQL driver. A production host must supply a tested driver binding with
exclusive clean sessions, bounded row count, connect/query deadlines and actual
protocol cancellation. On query cancellation the adapter must settle only after
protocol completion; it must not return a session with a query still running.
`release(true)` must destroy the connection. Failed cleanup must never permit reuse.

The existing `0001_foundation.sql` remains unchanged and unapplied by this code.
This reader SELECTs only `platform.tenants`, `platform.workspaces` and
`platform.environments`. It does not create organization/workspace IDs, write role
assignments, modify tenant lifecycle or grant channel authorization.

A scope observation cannot authorize a later write or external action by itself.
The write owner must recheck current scope/version/epoch in its own transaction;
the Action Gateway retains every send-time safety check. No cached snapshot can
replace current consent, policy or ownership authority.

## Frontend integration

The inserted panel reuses `Notice`, greeto-card, greeto-badge, greeto-table-wrap and
greeto-details from the existing design. No new UI dependency or theme is added.
Until the host supplies both an authenticated expected scope and a fresh authorized
observation, the panel displays its missing integration rather than inventing IDs.

The future observation adapter supplies `snapshot` (the seven scope fields),
`observedAt` and `expiresAt` in UTC. These are presentation metadata, not a new
public API contract. A lifecycle of active is explicitly NOT a green provider,
backup, security or deployment check. Production/sandbox/shadow are kept distinct.

## Local verification

Run from repository root:

```sh
python tools/check_tenant_scope.py
```

- Strict TypeScript compilation, unchecked-index and exact-optional checks: PASS.
- Backend domain/SQL scripted-port tests: **55 passed, 0 failed**.
- Frontend presentation model tests: **20 passed, 0 failed**.
- Two JSX files: syntax transpilation checked with existing TypeScript.
- The base ImplementationCenter blob was reconstructed and verified against remote
  Git blob `1e1a276f78ef41396fe0337e1e595d8f01d5f9bc` before the two-line patch.

The SQL/auth ports in these tests are synthetic. No test claims live PostgreSQL,
RLS isolation, OIDC/OPA, signed placement, browser rendering, full React build,
existing full-suite regression, cloud recovery or production certification.
No parent work package is marked Done.

## Publication blocker

This session exposed 48 read-oriented GitHub actions and no create-file,
create-tree, create-commit or update-ref action. The installed GitHub plugin was
checked; there was no separate eligible write integration returned. Local Git also
failed to resolve github.com. No credentials, network-policy workaround, temporary
Actions workflow, extra branch or force-push was used.

The files/patch in this delivery are LOCAL ONLY. Re-read live main and check the
patch against the exact baseline before publishing with an authorized write tool.
After publication, read back the new remote SHA and update the evidence separately;
do not replace the prior verified commit with a fabricated commit reference.

## Requirement basis and engineering reference

Requirements: supplied Customer Action OS source §1.2, §5.1, §6.1–6.2, §7.1,
F01 §10, security §28.1 and coding contracts §32.2. Parent acceptance remains in
the original workbook (AT-PLT-001 / AT-PLT-003 / AT-DAT-001 / AT-UX-003).

Primary technical references checked for the SQL implementation on 7 Sep 2026:
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- https://www.postgresql.org/docs/17/sql-set.html

These are engineering references, not an approved production version selection or
an architecture amendment. No dependency version was changed.
