import { StatusError } from '../status-service.js';
import type { Actor, Change, Receipt, Repository, Scope, Status, StatusTransaction, WorkPackage } from '../status-service.js';
import { parseTenantScope, parseScopeSnapshot } from '../platform/tenant-scope.js';
import type { PlacementBinding, TenantScope } from '../platform/tenant-scope.js';
import { scopeSql } from '../platform/postgres-scope-reader.js';
import type { ScopeSqlConnection, ScopeSqlPool } from '../platform/postgres-scope-reader.js';

/** Diagnostic events contain no SQL, bound values, credentials or evidence body. */
export type StatusStoreStage = 'begin' | 'scope' | 'guard' | 'placement' | 'receipt' |
  'lock' | 'dependencies' | 'predecessors' | 'status_write' | 'history_write' | 'outbox_write' | 'commit' | 'rollback';
export interface StatusStoreObservation {
  readonly stage: StatusStoreStage;
  readonly result: 'started' | 'succeeded' | 'failed' | 'unknown';
  readonly elapsedMs: number;
}
export interface StatusStoreContext {
  /** Authenticated host context: NEVER construct this object from a request body. */
  readonly scope: TenantScope;
  readonly actorId: string;
  readonly baselineId: string;
  readonly placement: PlacementBinding;
  readonly signal: AbortSignal;
  readonly timeoutMs?: number;
  /** Synchronous bounded local telemetry enqueue only; not an audit persistence port. */
  readonly observe?: (event: StatusStoreObservation) => void;
}

// Existing 0001_foundation.sql only. These statements do not migrate or grant access.
// All caller/actor values use positional parameters. Dynamic schema/table names are forbidden.
const scopeColumns = 'tenant_id::text AS "tenantId", workspace_id::text AS "workspaceId", environment_id::text AS "environmentId", baseline_id::text AS "baselineId"';
const scopeWhere = 'tenant_id=$1::uuid AND workspace_id=$2::uuid AND environment_id=$3::uuid AND baseline_id=$4::uuid';
export const statusSql = Object.freeze({
  beginRead: 'BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY',
  beginWrite: 'BEGIN ISOLATION LEVEL SERIALIZABLE READ WRITE',
  context: scopeSql.context,
  guard: `SELECT r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls,
    (SELECT count(*)::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE (n.nspname,c.relname) IN (('platform','tenants'),('platform','workspaces'),('platform','environments'),
       ('delivery','baselines'),('delivery','work_packages'),('delivery','dependencies'),('delivery','status_events'),('platform','outbox'))
     AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
     AND NOT pg_catalog.pg_has_role(current_user,c.relowner,'USAGE')
     AND NOT pg_catalog.pg_has_role(session_user,c.relowner,'MEMBER')) AS guarded_tables,
    (SELECT s.rolsuper OR s.rolbypassrls FROM pg_catalog.pg_roles s WHERE s.rolname=session_user) AS unsafe_session
    FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`,
  placementRead: scopeSql.lookup,
  // Holding these row locks until COMMIT also serializes lifecycle/epoch/kind changes.
  placementWrite: `${scopeSql.lookup} FOR SHARE OF t,w,e`,
  // Idempotency uniqueness is scope-wide in the existing schema, not per baseline.
  receipt: `SELECT ${scopeColumns}, work_package_id AS id, requested_status AS status,
    resulting_version::text AS version, event_id::text AS "eventId", intent_hash AS "intentHash", actor_id::text AS "actorId"
    FROM delivery.status_events WHERE tenant_id=$1::uuid AND workspace_id=$2::uuid
    AND environment_id=$3::uuid AND idempotency_hash=$4 LIMIT 2`,
  lock: `SELECT ${scopeColumns}, work_package_id AS id, status, version::text AS version
    FROM delivery.work_packages WHERE ${scopeWhere} AND work_package_id=$5 FOR UPDATE`,
  dependencies: `SELECT predecessor_id AS id FROM delivery.dependencies
    WHERE ${scopeWhere} AND work_package_id=$5 ORDER BY predecessor_id LIMIT 513`,
  predecessors: `SELECT (count(*)=$6::integer AND coalesce(bool_and(status='Done'
    AND evidence_ref IS NOT NULL AND length(trim(evidence_ref))>0),false)) AS verified
    FROM delivery.work_packages WHERE ${scopeWhere}
    AND work_package_id IN (SELECT jsonb_array_elements_text($5::jsonb))`,
  update: `UPDATE delivery.work_packages SET status=$8, version=version+1,
    evidence_ref=nullif($9,''), updated_at=now() WHERE ${scopeWhere}
    AND work_package_id=$5 AND version=$6::bigint AND status=$7
    RETURNING ${scopeColumns}, work_package_id AS id, status, version::text AS version`,
  history: `INSERT INTO delivery.status_events (tenant_id,workspace_id,environment_id,baseline_id,work_package_id,
    event_id,actor_id,idempotency_hash,intent_hash,previous_status,requested_status,previous_version,resulting_version,evidence_ref,reason_code)
    VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid,$7::uuid,$8,$9,$10,$11,$12::bigint,$13::bigint,nullif($14,''),$15)
    RETURNING event_id::text AS "eventId"`,
  outbox: `INSERT INTO platform.outbox (tenant_id,workspace_id,environment_id,event_id,event_type,payload_ref)
    VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'delivery.status.changed.v1',$5)
    RETURNING event_id::text AS "eventId"`,
  commit: 'COMMIT', rollback: 'ROLLBACK',
});
const statuses: readonly string[] = ['Not started','In progress','Blocked','Review','Done'];
const isStatus = (v: unknown): v is Status => typeof v === 'string' && statuses.includes(v);
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000';
const isHash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const isPackage = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{2,4}-[0-9]{3}$/.test(v);
const fail = (code = 'STORE_UNAVAILABLE'): never => { throw new StatusError(code); };
const version = (v: unknown): number => {
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,15}$/.test(v) || !Number.isSafeInteger(Number(v))) return fail();
  return Number(v);
};
type Rows = readonly Record<string, unknown>[];
type Query = (stage: StatusStoreStage, sql: string, params: readonly string[]) => Promise<Rows>;

/**
 * Request-scoped implementation of the existing StatusService Repository port.
 * @param pool Maintained PostgreSQL driver binding with clean exclusive sessions,
 *             actual protocol cancellation, bounded results and destroy-on-discard.
 * @param context Server-authenticated scope, actor, baseline, verified placement,
 *                host cancellation/deadline and optional nonblocking diagnostic sink.
 * Authorization/evidence verification remain in StatusService and its host ports.
 * This adapter is NOT exposed as an independent API or a permission grant.
 *
 * Effects: READ ONLY receipt lookup; or one SERIALIZABLE transaction that updates
 * the package and inserts status history + pending outbox. No Kafka/provider call.
 * Returns only after COMMIT. Ambiguous COMMIT errors never become success; retry
 * the same status intent/key through StatusService to recover the original receipt.
 * No automatic transaction retry, no migration, no runtime fake-store fallback.
 */
export class PostgresStatusRepository implements Repository {
  private readonly scope: TenantScope;
  private readonly actorId: string;
  private readonly baselineId: string;
  private readonly placement: PlacementBinding;
  private readonly timeoutMs: number;
  private readonly signal: AbortSignal;
  private readonly observe: ((event: StatusStoreObservation) => void) | undefined;

  constructor(private readonly pool: ScopeSqlPool, context: StatusStoreContext) {
    this.scope = parseTenantScope(context.scope);
    this.actorId = context.actorId;
    this.baselineId = context.baselineId;
    this.placement = Object.freeze({...context.placement});
    this.timeoutMs = context.timeoutMs ?? 3000;
    this.signal = context.signal;
    this.observe = context.observe;
    if (!isId(this.actorId) || !isId(this.baselineId) || !Number.isInteger(this.timeoutMs) ||
        this.timeoutMs < 100 || this.timeoutMs > 5000 || !(this.signal instanceof AbortSignal)) fail('STORE_CONFIGURATION');
    // Reuse the exact ownership/environment decoder; no Number conversion of epochs.
    try { parseScopeSnapshot({...this.scope, homeCell:this.placement.cellId,
      placementEpoch:this.placement.placementEpoch, state:'active', kind:this.placement.environmentKind}); }
    catch { fail('STORE_CONFIGURATION'); }
  }

  /**
   * @param scope Previously authorized object scope; must match this host context.
   * @param keyHash Hash calculated by StatusService, never a raw idempotency key.
   * @returns An original committed receipt (including its original version), or null.
   * Authorization still runs before every replay. Receipt content is scope/actor/baseline checked.
   */
  async findReceipt(scope: Scope, keyHash: string): Promise<Receipt | null> {
    if (!isHash(keyHash)) fail('INVALID_INPUT');
    return this.withTransaction(scope,true,tx => tx.findReceipt(keyHash));
  }

  /** Execute the existing domain callback on one bounded session; success follows COMMIT. */
  async transaction<T>(scope: Scope, operation: (tx: StatusTransaction) => Promise<T>): Promise<T> {
    return this.withTransaction(scope,false,operation);
  }

  private assertScope(requested: Scope): void {
    const parsed = parseTenantScope(requested);
    if (parsed.tenantId !== this.scope.tenantId || parsed.workspaceId !== this.scope.workspaceId ||
        parsed.environmentId !== this.scope.environmentId) fail('NOT_FOUND');
  }
  private parameters(): string[] { return [this.scope.tenantId,this.scope.workspaceId,this.scope.environmentId,this.baselineId]; }
  private bound(row: Record<string, unknown>, checkBaseline = true): void {
    if (row.tenantId !== this.scope.tenantId || row.workspaceId !== this.scope.workspaceId ||
        row.environmentId !== this.scope.environmentId || (checkBaseline && row.baselineId !== this.baselineId)) fail();
  }
  private decodeReceipt(rows: Rows): Receipt | null {
    if (rows.length > 1) fail();
    const row = rows[0]; if (!row) return null;
    this.bound(row,false);
    if (!isId(row.baselineId)) return fail();
    if (row.baselineId !== this.baselineId) return fail('IDEMPOTENCY_CONFLICT');
    if (!isPackage(row.id) || !isStatus(row.status) || !isId(row.eventId) ||
        !isHash(row.intentHash) || row.actorId !== this.actorId) return fail();
    return Object.freeze({id:row.id, status:row.status, version:version(row.version), eventId:row.eventId, intentHash:row.intentHash});
  }
  private emit(stage: StatusStoreStage, result: StatusStoreObservation['result'], start: number): void {
    // Durable audit is status_events, not this best-effort local telemetry callback.
    try { this.observe?.(Object.freeze({stage,result,elapsedMs:Math.max(0,Math.round(performance.now()-start))})); }
    catch { /* A broken metrics/log sink must not change the database outcome. */ }
  }

  private async withTransaction<T>(requested: Scope, readOnly: boolean, operation: (tx: StatusTransaction) => Promise<T>): Promise<T> {
    this.assertScope(requested);
    if (this.signal.aborted) fail('CANCELLED');
    const signal = AbortSignal.any([this.signal,AbortSignal.timeout(this.timeoutMs)]);
    let connection: ScopeSqlConnection | null = null, mayHaveTransaction = false, discard = false;
    let open = true, apiOpen = true, failed = false;
    const flight: {busy: boolean; pending: Promise<Rows> | null} = {busy:false,pending:null};
    const run: Query = async (stage,sql,params) => {
      if (!open || flight.busy) return fail('TRANSACTION_USAGE');
      if (signal.aborted) return fail(this.signal.aborted ? 'CANCELLED' : 'STORE_UNAVAILABLE');
      if (!connection) return fail();
      flight.busy = true; const start = performance.now(); this.emit(stage,'started',start);
      try {
        flight.pending = connection.query(sql,params,signal);
        const rows = await flight.pending;
        if (signal.aborted) fail(this.signal.aborted ? 'CANCELLED' : 'STORE_UNAVAILABLE');
        this.emit(stage,'succeeded',start); return rows;
      } catch (error) { this.emit(stage,stage === 'commit' ? 'unknown' : 'failed',start); throw error; }
      finally { flight.busy = false; flight.pending = null; }
    };
    try {
      connection = await this.pool.connect(signal);
      if (signal.aborted) fail(this.signal.aborted ? 'CANCELLED' : 'STORE_UNAVAILABLE');
      mayHaveTransaction = true; // Even a timed-out BEGIN can have reached the server.
      await run('begin',readOnly ? statusSql.beginRead : statusSql.beginWrite,[]);
      await run('scope',statusSql.context,[...this.parameters().slice(0,3),`${this.timeoutMs}ms`]);
      const guard = await run('guard',statusSql.guard,[]);
      if (guard.length !== 1 || guard[0]?.superuser !== false || guard[0]?.bypass_rls !== false ||
          guard[0]?.unsafe_session !== false || guard[0]?.guarded_tables !== '8') fail('STORE_CONFIGURATION');
      const scopeRows = await run('placement',readOnly ? statusSql.placementRead : statusSql.placementWrite,this.parameters().slice(0,3));
      if (scopeRows.length !== 1) fail('NOT_FOUND');
      const snapshot = parseScopeSnapshot(scopeRows[0]);
      if (snapshot.tenantId !== this.scope.tenantId || snapshot.workspaceId !== this.scope.workspaceId || snapshot.environmentId !== this.scope.environmentId) fail('NOT_FOUND');
      if (snapshot.homeCell !== this.placement.cellId || snapshot.placementEpoch !== this.placement.placementEpoch || snapshot.kind !== this.placement.environmentKind) fail('PLACEMENT_MISMATCH');
      if (!readOnly && snapshot.state !== 'active') fail('SCOPE_INACTIVE');
      const raw = this.makeTransaction(run,readOnly,() => { if (!apiOpen) fail('TRANSACTION_USAGE'); });
      const tracked = async <V>(action: () => Promise<V>): Promise<V> => {
        try { return await action(); } catch (error) { failed = true; throw error; }
      };
      const tx: StatusTransaction = {
        findReceipt:key => tracked(() => raw.findReceipt(key)),
        loadForUpdate:id => tracked(() => raw.loadForUpdate(id)),
        predecessorsVerified:ids => tracked(() => raw.predecessorsVerified(ids)),
        persist:(change,actor,key,receipt) => tracked(() => raw.persist(change,actor,key,receipt)),
      };
      const value = await operation(tx);
      apiOpen = false;
      // A domain callback must await every SQL method before returning.
      if (flight.busy) { if (flight.pending) await flight.pending.catch(() => undefined); fail('TRANSACTION_USAGE'); }
      if (failed) fail('TRANSACTION_USAGE'); // Catching a method error cannot commit a partial mutation.
      await run('commit',statusSql.commit,[]);
      mayHaveTransaction = false;
      return value;
    } catch (error) {
      discard = true; apiOpen = false;
      if (flight.pending) await flight.pending.catch(() => undefined);
      if (connection && mayHaveTransaction) {
        const start = performance.now(); this.emit('rollback','started',start);
        try { await connection.query(statusSql.rollback,[],AbortSignal.timeout(1000)); this.emit('rollback','succeeded',start); }
        catch { this.emit('rollback','failed',start); }
      }
      if (this.signal.aborted) fail('CANCELLED');
      if (error instanceof StatusError) throw error;
      return fail(); // Do not expose driver SQLSTATE messages, SQL or credentials.
    } finally {
      open = false; apiOpen = false;
      if (connection) { try { connection.release(discard); } catch { fail(); } }
    }
  }

  private makeTransaction(run: Query, readOnly: boolean, checkOpen: () => void): StatusTransaction {
    let loaded: WorkPackage | null = null, persisted = false;
    const parameters = this.parameters();
    return {
      findReceipt: async keyHash => {
        checkOpen(); if (!isHash(keyHash)) return fail('INVALID_INPUT');
        return this.decodeReceipt(await run('receipt',statusSql.receipt,[...parameters.slice(0,3),keyHash]));
      },
      loadForUpdate: async id => {
        checkOpen(); if (readOnly || loaded || !isPackage(id)) return fail('TRANSACTION_USAGE');
        const rows = await run('lock',statusSql.lock,[...parameters,id]);
        if (rows.length > 1) return fail();
        const row = rows[0]; if (!row) return null;
        this.bound(row); if (row.id !== id || !isStatus(row.status)) return fail();
        const dependencies = await run('dependencies',statusSql.dependencies,[...parameters,id]);
        const ids = dependencies.map(item => { if (!isPackage(item.id)) return fail(); return item.id; });
        if (ids.length > 512 || new Set(ids).size !== ids.length || ids.includes(id)) return fail();
        loaded = Object.freeze({id,status:row.status,version:version(row.version),predecessors:Object.freeze(ids)});
        return loaded;
      },
      predecessorsVerified: async ids => {
        checkOpen();
        if (!loaded || ids.length !== loaded.predecessors.length || ids.some((id,i) => id !== loaded?.predecessors[i])) return fail('TRANSACTION_USAGE');
        if (!ids.length) return true;
        const rows = await run('predecessors',statusSql.predecessors,[...parameters,JSON.stringify(ids),`${ids.length}`]);
        if (rows.length !== 1 || typeof rows[0]?.verified !== 'boolean') return fail();
        return rows[0].verified;
      },
      persist: async (change: Change,actor: Actor,keyHash: string,receipt: Receipt) => {
        checkOpen();
        if (readOnly || !loaded || persisted || change.id !== loaded.id || change.expectedVersion !== loaded.version ||
            !isStatus(change.status) || receipt.id !== change.id || receipt.status !== change.status ||
            receipt.version !== loaded.version+1 || !Number.isSafeInteger(receipt.version) ||
            actor.id !== this.actorId || !isHash(keyHash) || !isHash(receipt.intentHash) || !isId(receipt.eventId) ||
            !/^[a-z][a-z0-9_]{0,127}$/.test(change.reasonCode) ||
            (change.evidenceRef !== undefined && (typeof change.evidenceRef !== 'string' || change.evidenceRef.length > 2048))) return fail('INVALID_INPUT');
        const current = loaded, next = Object.freeze({...receipt}), evidence = change.evidenceRef ?? '', reason = change.reasonCode;
        const historyParams = [...parameters,current.id,next.eventId,this.actorId,keyHash,next.intentHash,
          current.status,next.status,`${current.version}`,`${next.version}`,evidence,reason];
        persisted = true;
        const rows = await run('status_write',statusSql.update,[...parameters,current.id,`${current.version}`,current.status,next.status,evidence]);
        if (!rows.length) return fail('VERSION_CONFLICT');
        if (rows.length !== 1 || !rows[0]) return fail();
        this.bound(rows[0]);
        if (rows[0].id !== next.id || rows[0].status !== next.status || version(rows[0].version) !== next.version) return fail();
        const history = await run('history_write',statusSql.history,historyParams);
        if (history.length !== 1 || history[0]?.eventId !== next.eventId) return fail();
        const outbox = await run('outbox_write',statusSql.outbox,[...parameters.slice(0,3),next.eventId,`delivery-status:${next.eventId}`]);
        if (outbox.length !== 1 || outbox[0]?.eventId !== next.eventId) return fail();
        // No durable receipt is returned here: only withTransaction's COMMIT can do so.
      },
    };
  }
}
