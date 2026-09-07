import { checkScopeSignal, parseTenantScope, parseScopeSnapshot, ScopeError } from './tenant-scope.js';
import type { ScopeReader, ScopeSnapshot, TenantScope } from './tenant-scope.js';

/**
 * Driver boundary, not a new database dependency. The selected PostgreSQL driver
 * adapter must enforce connect/query/cancel deadlines and bounded rows, and must
 * confirm protocol completion before resolving/rejecting. Never use this port
 * with an untrusted pool, table-owner role or an adapter that ignores deadlines.
 */
export interface ScopeSqlConnection {
  query(sql: string, parameters: readonly string[], signal: AbortSignal): Promise<readonly Record<string, unknown>[]>;
  /** Release once; discard=true means destroy, not return to the reusable pool. */
  release(discard: boolean): void;
}
export interface ScopeSqlPool {
  /** Lease one clean idle session exclusively, with no pre-existing transaction. */
  connect(signal: AbortSignal): Promise<ScopeSqlConnection>;
}
export const scopeSql = Object.freeze({
  begin:'BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY',
  context:`SELECT pg_catalog.set_config('app.tenant_id',$1,true),
    pg_catalog.set_config('app.workspace_id',$2,true), pg_catalog.set_config('app.environment_id',$3,true),
    pg_catalog.set_config('statement_timeout',$4,true), pg_catalog.set_config('lock_timeout',$4,true),
    pg_catalog.set_config('row_security','on',true), pg_catalog.set_config('search_path','pg_catalog',true)`,
  guard:`SELECT r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls,
    (SELECT count(*)::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='platform' AND c.relname IN ('tenants','workspaces','environments')
      AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
      AND NOT pg_catalog.pg_has_role(current_user,c.relowner,'USAGE')
      AND NOT pg_catalog.pg_has_role(session_user,c.relowner,'MEMBER')) AS guarded_tables,
    (SELECT s.rolsuper OR s.rolbypassrls FROM pg_catalog.pg_roles s WHERE s.rolname=session_user) AS unsafe_session
    FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`,
  lookup:`SELECT t.tenant_id::text AS "tenantId", w.workspace_id::text AS "workspaceId",
    e.environment_id::text AS "environmentId", t.home_cell AS "homeCell",
    t.placement_epoch::text AS "placementEpoch", t.state, e.kind
    FROM platform.tenants t JOIN platform.workspaces w ON w.tenant_id=t.tenant_id
    JOIN platform.environments e ON e.tenant_id=w.tenant_id AND e.workspace_id=w.workspace_id
    WHERE t.tenant_id=$1::uuid AND w.workspace_id=$2::uuid AND e.environment_id=$3::uuid LIMIT 2`,
  commit:'COMMIT', rollback:'ROLLBACK',
});

/**
 * Read-only implementation against the EXISTING 0001_foundation.sql tables.
 * No schema migration, grants, database provisioning or runtime registration.
 * A successful read is returned only after COMMIT. Failures are redacted, bounded
 * rollback is attempted, and uncertain/broken sessions are discarded.
 */
export class PostgresScopeReader implements ScopeReader {
  constructor(private readonly pool: ScopeSqlPool, private readonly timeoutMs = 3000) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5000) throw new ScopeError('STORE_CONFIGURATION');
  }

  /**
   * @param requested Authorized server scope; validation alone is NOT authorization.
   * @param callerSignal Outer host timeout/cancellation. Must be honored by the driver.
   * @returns Zero or one decoded scope after a read-only scoped transaction commits.
   * @throws ScopeError CANCELLED / STORE_CONFIGURATION / STORE_UNAVAILABLE.
   * No automatic retries: the caller retains its request identity. No SQL text is
   * assembled from input; no input or underlying error is logged or returned.
   */
  async read(requested: TenantScope, callerSignal: AbortSignal): Promise<ScopeSnapshot | null> {
    const scope = parseTenantScope(requested);
    checkScopeSignal(callerSignal);
    const signal = AbortSignal.any([callerSignal,AbortSignal.timeout(this.timeoutMs)]);
    let connection: ScopeSqlConnection | null = null;
    let transactionMayExist = false;
    let discard = false;
    try {
      connection = await this.pool.connect(signal);
      checkScopeSignal(signal);
      // BEGIN can reach the server before a driver timeout: uncertain BEGIN needs cleanup.
      transactionMayExist = true;
      await connection.query(scopeSql.begin,[],signal);
      checkScopeSignal(signal);
      const parameters = [scope.tenantId,scope.workspaceId,scope.environmentId];
      await connection.query(scopeSql.context,[...parameters,`${this.timeoutMs}ms`],signal);
      checkScopeSignal(signal);
      const guards = await connection.query(scopeSql.guard,[],signal);
      if (guards.length !== 1 || guards[0]?.superuser !== false || guards[0]?.bypass_rls !== false ||
          guards[0]?.unsafe_session !== false || guards[0]?.guarded_tables !== '3') throw new ScopeError('STORE_CONFIGURATION');
      checkScopeSignal(signal);
      const rows = await connection.query(scopeSql.lookup,parameters,signal);
      if (rows.length > 1) throw new ScopeError('STORE_UNAVAILABLE');
      const row = rows[0];
      const snapshot = row === undefined ? null : parseScopeSnapshot(row);
      if (snapshot && (snapshot.tenantId !== scope.tenantId || snapshot.workspaceId !== scope.workspaceId || snapshot.environmentId !== scope.environmentId)) {
        throw new ScopeError('STORE_UNAVAILABLE');
      }
      checkScopeSignal(signal);
      await connection.query(scopeSql.commit,[],signal);
      transactionMayExist = false;
      checkScopeSignal(signal);
      return snapshot;
    } catch (error) {
      // Do not reuse a session after any failed/uncertain operation. A successful
      // rollback is still attempted to leave the server clean before destruction.
      discard = true;
      if (connection && transactionMayExist) {
        try { await connection.query(scopeSql.rollback,[],AbortSignal.timeout(1000)); }
        catch { /* Discard rather than leak a transaction or tenant setting. */ }
      }
      if (callerSignal.aborted) throw new ScopeError('CANCELLED');
      if (error instanceof ScopeError && error.code === 'STORE_CONFIGURATION') throw error;
      throw new ScopeError('STORE_UNAVAILABLE');
    } finally {
      if (connection) {
        try { connection.release(discard); }
        catch { throw new ScopeError('STORE_UNAVAILABLE'); }
      }
    }
  }
}
