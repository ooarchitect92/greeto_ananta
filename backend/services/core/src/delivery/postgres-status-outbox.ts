import { parseTenantScope, parseScopeSnapshot } from '../platform/tenant-scope.js';
import type { TenantScope, PlacementBinding } from '../platform/tenant-scope.js';
import { scopeSql } from '../platform/postgres-scope-reader.js';
import type { ScopeSqlPool, ScopeSqlConnection } from '../platform/postgres-scope-reader.js';
import { STATUS_EVENT, OutboxError, requireId, requireTime, exactRecord, decodeCursor, decodeFact, decodeAck, hashFact, sameScope } from './status-outbox-contract.js';
import type { StatusOutboxStore, OutboxCursor, PendingPage, StoredStatusFact, PublicationAck } from './status-outbox-contract.js';

export type OutboxSqlStage = 'begin'|'scope'|'guard'|'placement'|'pending'|'record'|'history'|'mark'|'commit'|'rollback';
export interface OutboxSqlObservation {
  readonly stage: OutboxSqlStage;
  readonly result: 'started'|'succeeded'|'failed'|'unknown';
  readonly elapsedMs: number;
}
export interface OutboxStoreContext {
  readonly scope: TenantScope;
  readonly placement: PlacementBinding;
  readonly timeoutMs?: number;
  /** Nonblocking local enqueue only. Bind request/worker correlation in the host. */
  readonly observe?: (event:OutboxSqlObservation)=>void;
}
type Rows = readonly Record<string,unknown>[];
type Query = (stage:OutboxSqlStage,sql:string,parameters:readonly string[])=>Promise<Rows>;
const where = 'tenant_id=$1::uuid AND workspace_id=$2::uuid AND environment_id=$3::uuid';
const scoped = 'tenant_id::text AS "tenantId",workspace_id::text AS "workspaceId",environment_id::text AS "environmentId"';
const utc = (column:string) => `pg_catalog.to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
// Static SQL ONLY. All variable values use positional parameters; no new migration.
export const outboxSql = Object.freeze({
  beginRead:'BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY',
  beginWrite:'BEGIN ISOLATION LEVEL SERIALIZABLE READ WRITE',
  context:scopeSql.context,
  guard:`SELECT r.rolsuper AS superuser,r.rolbypassrls AS bypass_rls,
    (SELECT count(*)::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE (n.nspname,c.relname) IN (('platform','tenants'),('platform','workspaces'),('platform','environments'),('platform','outbox'),('delivery','status_events'))
     AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
     AND NOT pg_catalog.pg_has_role(current_user,c.relowner,'USAGE')
     AND NOT pg_catalog.pg_has_role(session_user,c.relowner,'MEMBER')) AS guarded_tables,
    (SELECT s.rolsuper OR s.rolbypassrls FROM pg_catalog.pg_roles s WHERE s.rolname=session_user) AS unsafe_session
    FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`,
  placementRead:scopeSql.lookup,
  placementWrite:`${scopeSql.lookup} FOR SHARE OF t,w,e`,
  pending:`SELECT ${scoped},event_id::text AS "eventId",${utc('created_at')} AS "createdAt"
    FROM platform.outbox WHERE ${where} AND state='pending' AND event_type='${STATUS_EVENT}'
    AND ($4='' OR (created_at,event_id)>(nullif($4,'')::timestamptz,nullif($5,'')::uuid))
    ORDER BY created_at,event_id LIMIT $6::integer`,
  record:`SELECT ${scoped},event_id::text AS "eventId",event_type AS "eventType",payload_ref AS "payloadRef",
    state,${utc('created_at')} AS "createdAt",${utc('published_at')} AS "publishedAt"
    FROM platform.outbox WHERE ${where} AND event_id=$4::uuid LIMIT 2`,
  history:`SELECT ${scoped},event_id::text AS "eventId",baseline_id::text AS "baselineId",
    work_package_id AS "workPackageId",previous_status AS "previousStatus",requested_status AS status,
    previous_version::text AS "previousVersion",resulting_version::text AS version,${utc('created_at')} AS "occurredAt"
    FROM delivery.status_events WHERE ${where} AND event_id=$4::uuid LIMIT 2`,
  mark:`UPDATE platform.outbox SET state='published',published_at=pg_catalog.clock_timestamp()
    WHERE ${where} AND event_id=$4::uuid AND event_type='${STATUS_EVENT}'
    AND payload_ref=$5 AND state='pending' RETURNING event_id::text AS "eventId"`,
  commit:'COMMIT',rollback:'ROLLBACK',
});

/**
 * SQL owner adapter for the EXISTING delivery.status.changed.v1 outbox records.
 * @param pool Same ScopeSqlPool driver contract as INC-003/005: exclusive leases,
 *   real cancellation, bounded rows, clean protocol completion and destructive discard.
 * @param context Authenticated worker scope/verified placement, bounded timeout and
 *   optional synchronous diagnostics. The relay's authority port must run first.
 * No driver is installed, no job is scheduled and no schema/role is created here.
 * Reads commit before returning; marking never spans a network publication.
 */
export class PostgresStatusOutbox implements StatusOutboxStore {
  readonly scope: TenantScope;
  readonly placement: PlacementBinding;
  private readonly timeoutMs:number;
  private readonly observe:((event:OutboxSqlObservation)=>void)|undefined;
  constructor(private readonly pool:ScopeSqlPool, context:OutboxStoreContext) {
    try {
      this.scope=parseTenantScope(context.scope);
      this.placement=Object.freeze({...context.placement});
      parseScopeSnapshot({...this.scope,homeCell:this.placement.cellId,placementEpoch:this.placement.placementEpoch,
        kind:this.placement.environmentKind,state:'active'});
      this.timeoutMs=context.timeoutMs??3000;this.observe=context.observe;
      if(!Number.isInteger(this.timeoutMs)||this.timeoutMs<100||this.timeoutMs>5000) throw new Error();
    } catch { throw new OutboxError('CONFIGURATION'); }
  }
  private params():string[] { return [this.scope.tenantId,this.scope.workspaceId,this.scope.environmentId]; }
  private bind(row:Record<string,unknown>):void {
    const candidate=parseTenantScope({tenantId:row.tenantId,workspaceId:row.workspaceId,environmentId:row.environmentId});
    if(!sameScope(candidate,this.scope)) throw new OutboxError('SCOPE_UNAVAILABLE');
  }

  /**
   * @param cursor Null for a NEW sweep; otherwise the prior page's exact cursor.
   * @param limit 1..100 rows. The SQL query has both a row bound and a deadline.
   * @returns A bounded page. next=null means this scan ended, NOT all work is done.
   * Poison/orphan events are retained. Later sweeps MUST restart at null to catch
   * failed records and transactions that committed behind the prior time cursor.
   * This is low-volume control outbox recovery, NOT a DynamoDB command-journal scan.
   */
  async listPending(cursor:OutboxCursor|null,limit:number,signal:AbortSignal):Promise<PendingPage> {
    const after=cursor===null?null:decodeCursor(cursor);
    if(!Number.isInteger(limit)||limit<1||limit>100) throw new OutboxError('INVALID_INPUT');
    return this.transaction(false,signal,async query=>{
      const rows=await query('pending',outboxSql.pending,[...this.params(),after?.createdAt??'',after?.eventId??'',String(limit+1)]);
      if(rows.length>limit+1) throw new OutboxError('STORE_UNAVAILABLE');
      const entries:OutboxCursor[]=[];let previous=after;
      for(const row of rows) {
        exactRecord(row,['tenantId','workspaceId','environmentId','eventId','createdAt']);this.bind(row);
        const current=decodeCursor({eventId:row.eventId,createdAt:row.createdAt});
        if(previous && (current.createdAt<previous.createdAt ||
          (current.createdAt===previous.createdAt&&current.eventId<=previous.eventId))) throw new OutboxError('STORE_UNAVAILABLE');
        if(entries.some(e=>e.eventId===current.eventId)) throw new OutboxError('STORE_UNAVAILABLE');
        entries.push(current);previous=current;
      }
      return Object.freeze({entries:Object.freeze(entries.slice(0,limit)),next:entries.length>limit?entries[limit-1]!:null});
    });
  }

  /** Read one scoped event and its history. An absent history is a visible failure. */
  async load(eventId:string,signal:AbortSignal):Promise<StoredStatusFact|null> {
    requireId(eventId);
    return this.transaction(false,signal,query=>this.readFact(query,eventId,false));
  }

  /**
   * Match a certified transport ACK to a freshly read/locked, unchanged fact.
   * Repeated marking is idempotent. The caller receives success only after COMMIT.
   * Unknown commit response: leave reconciliation to a same-event retry; never
   * claim rollback proves that an earlier Kafka publication did not happen.
   */
  async confirmPublished(input:PublicationAck,signal:AbortSignal):Promise<void> {
    const ack=decodeAck(input);
    await this.transaction(true,signal,async query=>{
      const record=await this.readFact(query,ack.eventId,true);
      if(!record) throw new OutboxError('FACT_UNRESOLVED');
      if(record.payloadSha256!==ack.payloadSha256) throw new OutboxError('FACT_CHANGED');
      if(record.state==='published') return;
      const rows=await query('mark',outboxSql.mark,[...this.params(),ack.eventId,record.fact.payloadRef]);
      if(rows.length!==1 || rows[0]?.eventId!==ack.eventId) throw new OutboxError('STORE_UNAVAILABLE');
      exactRecord(rows[0],['eventId']);
    });
  }

  private async readFact(query:Query,eventId:string,lock:boolean):Promise<StoredStatusFact|null> {
    const rows=await query('record',outboxSql.record+(lock?' FOR UPDATE':''),[...this.params(),eventId]);
    if(rows.length>1) throw new OutboxError('STORE_UNAVAILABLE');
    const row=rows[0];if(!row)return null;
    exactRecord(row,['tenantId','workspaceId','environmentId','eventId','eventType','payloadRef','state','createdAt','publishedAt']);
    this.bind(row);requireTime(row.createdAt);
    if(row.eventId!==eventId || row.eventType!==STATUS_EVENT || row.payloadRef!==`delivery-status:${eventId}` ||
       (row.state!=='pending'&&row.state!=='published')) throw new OutboxError('FACT_UNRESOLVED');
    if(row.state==='pending'&&row.publishedAt!==null)throw new OutboxError('FACT_UNRESOLVED');
    if(row.state==='published')requireTime(row.publishedAt);
    const history=await query('history',outboxSql.history+(lock?' FOR SHARE':''),[...this.params(),eventId]);
    if(history.length!==1)throw new OutboxError('FACT_UNRESOLVED');
    const h=exactRecord(history[0],['tenantId','workspaceId','environmentId','eventId','baselineId','workPackageId','previousStatus','status','previousVersion','version','occurredAt']);
    this.bind(h);if(h.eventId!==eventId)throw new OutboxError('FACT_UNRESOLVED');
    const fact=decodeFact({eventId:h.eventId,eventType:STATUS_EVENT,scope:this.scope,
      baselineId:h.baselineId,workPackageId:h.workPackageId,previousStatus:h.previousStatus,status:h.status,
      previousVersion:h.previousVersion,version:h.version,occurredAt:h.occurredAt,payloadRef:row.payloadRef});
    return Object.freeze({fact,payloadSha256:await hashFact(fact),state:row.state as 'pending'|'published'});
  }

  private emit(stage:OutboxSqlStage,result:OutboxSqlObservation['result'],start:number):void {
    try { this.observe?.(Object.freeze({stage,result,elapsedMs:Math.max(0,Math.round(performance.now()-start))})); }
    catch { /* Best-effort telemetry is neither the outbox nor the durable audit. */ }
  }

  private async transaction<T>(write:boolean,caller:AbortSignal,operation:(query:Query)=>Promise<T>):Promise<T> {
    if(!(caller instanceof AbortSignal))throw new OutboxError('INVALID_INPUT');
    if(caller.aborted)throw new OutboxError('CANCELLED');
    const signal=AbortSignal.any([caller,AbortSignal.timeout(this.timeoutMs)]);
    let connection:ScopeSqlConnection|null=null,mayExist=false,discard=false,commitAttempted=false;
    const check=()=>{if(signal.aborted)throw new OutboxError(caller.aborted?'CANCELLED':'STORE_UNAVAILABLE');};
    const query:Query=async(stage,sql,parameters)=>{
      check();const start=performance.now();this.emit(stage,'started',start);
      try {
        const rows=await connection!.query(sql,parameters,signal);check();
        if(!Array.isArray(rows))throw new OutboxError('STORE_UNAVAILABLE');
        this.emit(stage,'succeeded',start);return rows;
      }catch(error){this.emit(stage,stage==='commit'?'unknown':'failed',start);throw error;}
    };
    try {
      connection=await this.pool.connect(signal);check();mayExist=true;
      await query('begin',write?outboxSql.beginWrite:outboxSql.beginRead,[]);
      await query('scope',outboxSql.context,[...this.params(),`${this.timeoutMs}ms`]);
      const guards=await query('guard',outboxSql.guard,[]);
      if(guards.length!==1||guards[0]?.superuser!==false||guards[0]?.bypass_rls!==false||
         guards[0]?.unsafe_session!==false||guards[0]?.guarded_tables!=='5')throw new OutboxError('CONFIGURATION');
      const placements=await query('placement',write?outboxSql.placementWrite:outboxSql.placementRead,this.params());
      if(placements.length!==1)throw new OutboxError('SCOPE_UNAVAILABLE');
      const s=parseScopeSnapshot(placements[0]);if(!sameScope(s,this.scope))throw new OutboxError('SCOPE_UNAVAILABLE');
      if(s.homeCell!==this.placement.cellId||s.placementEpoch!==this.placement.placementEpoch||s.kind!==this.placement.environmentKind)throw new OutboxError('PLACEMENT_MISMATCH');
      if(s.state!=='active')throw new OutboxError('SCOPE_INACTIVE');
      const value=await operation(query);check();commitAttempted=true;
      await query('commit',outboxSql.commit,[]);mayExist=false;return value;
    } catch(error) {
      discard=true;
      if(connection&&mayExist){
        const start=performance.now();this.emit('rollback','started',start);
        try{await connection.query(outboxSql.rollback,[],AbortSignal.timeout(1000));this.emit('rollback','succeeded',start);}
        catch{this.emit('rollback','failed',start);}
      }
      if(write&&commitAttempted)throw new OutboxError('COMMIT_UNKNOWN');
      if(caller.aborted)throw new OutboxError('CANCELLED');
      if(error instanceof OutboxError && error.code!=='INVALID_INPUT')throw error;
      throw new OutboxError('STORE_UNAVAILABLE');
    } finally {
      if(connection)try{connection.release(discard);}
      catch{throw new OutboxError(write&&commitAttempted?'COMMIT_UNKNOWN':'STORE_UNAVAILABLE');}
    }
  }
}
