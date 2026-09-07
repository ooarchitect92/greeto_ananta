import { parseTenantScope, parseScopeSnapshot } from '../platform/tenant-scope.js';
import type { PlacementBinding, TenantScope } from '../platform/tenant-scope.js';
import { OutboxError, requireId, decodeCursor, decodeFact, decodeAck, hashFact, sameScope, exactRecord } from './status-outbox-contract.js';
import type { StatusOutboxStore, StatusFactTransport, OutboxAuthority, OutboxCursor } from './status-outbox-contract.js';

export interface RelayResult {
  readonly eventId:string;
  readonly state:'published'|'already_published'|'pending'|'blocked';
  readonly reasonCode:string;
  readonly transport:'not_attempted'|'committed'|'unknown'|'rejected';
  readonly marker:'not_attempted'|'committed'|'unknown';
}
export interface RelayObservation {
  readonly operationId:string;
  readonly eventId?:string;
  readonly stage:'authorize'|'scan'|'load'|'publish'|'mark';
  readonly result:'started'|'succeeded'|'failed'|'unknown';
  readonly elapsedMs:number;
}
export interface RelayOptions {
  /** Authenticated service identity reference. Not sufficient authority by itself. */
  readonly workerId:string;
  readonly pageSize?:number;
  readonly deadlineMs?:number;
  /** Bounded synchronous enqueue. Correlation IDs belong in logs/traces, not metric labels. */
  readonly observe?:(event:RelayObservation)=>void;
}
export interface RelayPage {
  readonly results:readonly RelayResult[];
  readonly next:OutboxCursor|null;
  readonly operationId:string;
}

/**
 * Publish only existing committed delivery-status facts. No provider action,
 * workflow execution, automatic schema registration, migration or job scheduling.
 * Use one instance per host-authorized scope; concurrent calls fail BUSY rather
 * than creating an unbounded queue. There is one in-flight event per instance.
 *
 * CDC can call relayOne(eventId). A recovery worker can traverse runPage(next),
 * and MUST start each new sweep at null. A scan cursor is not an acceptance
 * watermark: late-committing earlier transactions and failed rows remain eligible.
 */
export class StatusOutboxRelay {
  private readonly scope:TenantScope;
  private readonly placement:PlacementBinding;
  private readonly workerId:string;
  private readonly pageSize:number;
  private readonly deadlineMs:number;
  private readonly observe:((event:RelayObservation)=>void)|undefined;
  private busy=false;
  constructor(private readonly store:StatusOutboxStore, private readonly transport:StatusFactTransport,
    private readonly authority:OutboxAuthority, options:RelayOptions) {
    try {
      this.scope=parseTenantScope(store.scope);
      this.placement=Object.freeze({...store.placement});
      parseScopeSnapshot({...this.scope,homeCell:this.placement.cellId,placementEpoch:this.placement.placementEpoch,kind:this.placement.environmentKind,state:'active'});
      this.workerId=requireId(options.workerId);this.pageSize=options.pageSize??25;
      this.deadlineMs=options.deadlineMs??5000;this.observe=options.observe;
      if(!Number.isInteger(this.pageSize)||this.pageSize<1||this.pageSize>100 ||
         !Number.isInteger(this.deadlineMs)||this.deadlineMs<100||this.deadlineMs>60000 ||
         typeof authority?.requirePublish!=='function'||typeof transport?.publish!=='function')throw new Error();
    }catch{throw new OutboxError('CONFIGURATION');}
  }

  /**
   * @param eventId Existing outbox event UUID from authorized CDC/recovery work.
   * @param callerSignal Host shutdown/deadline; forwarded to every port.
   * @returns A scoped attempt outcome. published means observed transport ACK AND
   *   observed marker COMMIT, not downstream consumption or business success.
   * No automatic retry. Unknown publish/mark outcomes retain the same event ID.
   */
  async relayOne(eventId:string,callerSignal:AbortSignal):Promise<RelayResult> {
    requireId(eventId);
    return this.exclusive(callerSignal,(signal,operationId)=>this.process(eventId,signal,operationId));
  }

  /**
   * @param cursor Null at each new sweep, or exact cursor from the current sweep.
   * @returns Bounded, ordered outcomes and next scan position; failures are not
   *   deleted or silently converted to a DLQ acknowledgement. Each event receives
   *   a fresh object-grant check. A revoked grant stops further publication.
   * A page is NOT a fleet backlog count; a later sweep must revisit earlier failures.
   */
  async runPage(cursor:OutboxCursor|null,callerSignal:AbortSignal):Promise<RelayPage> {
    const after=cursor===null?null:decodeCursor(cursor);
    return this.exclusive(callerSignal,async(signal,operationId)=>{
      await this.authorize(signal,operationId);
      const page=await this.stage('scan',signal,operationId,undefined,()=>this.store.listPending(after,this.pageSize,signal));
      exactRecord(page,['entries','next']);
      if(!Array.isArray(page.entries)||page.entries.length>this.pageSize)throw new OutboxError('STORE_UNAVAILABLE');
      const entries=page.entries.map(decodeCursor);const seen=new Set<string>();let previous=after;
      for(const entry of entries){
        if(seen.has(entry.eventId)||previous&&(entry.createdAt<previous.createdAt ||
           entry.createdAt===previous.createdAt&&entry.eventId<=previous.eventId))throw new OutboxError('STORE_UNAVAILABLE');
        seen.add(entry.eventId);previous=entry;
      }
      const next=page.next===null?null:decodeCursor(page.next);
      if(next && (entries.length!==this.pageSize||next.createdAt!==entries.at(-1)?.createdAt||next.eventId!==entries.at(-1)?.eventId))throw new OutboxError('STORE_UNAVAILABLE');
      const results:RelayResult[]=[];
      for(const entry of entries)results.push(await this.process(entry.eventId,signal,operationId));
      return Object.freeze({results:Object.freeze(results),next,operationId});
    });
  }
  private async exclusive<T>(caller:AbortSignal,operation:(signal:AbortSignal,id:string)=>Promise<T>):Promise<T>{
    if(!(caller instanceof AbortSignal))throw new OutboxError('INVALID_INPUT');
    if(caller.aborted)throw new OutboxError('CANCELLED');
    if(this.busy)throw new OutboxError('BUSY');
    this.busy=true;
    const signal=AbortSignal.any([caller,AbortSignal.timeout(this.deadlineMs)]),id=crypto.randomUUID();
    try{return await operation(signal,id);}
    finally{this.busy=false;}
  }
  private check(signal:AbortSignal):void{if(signal.aborted)throw new OutboxError('CANCELLED');}
  private emit(operationId:string,eventId:string|undefined,stage:RelayObservation['stage'],result:RelayObservation['result'],start:number):void{
    const base={operationId,stage,result,elapsedMs:Math.max(0,Math.round(performance.now()-start))};
    try{this.observe?.(Object.freeze(eventId?{...base,eventId}:base));}catch{/* Diagnostics cannot acknowledge or lose work. */}
  }
  private async stage<T>(stage:RelayObservation['stage'],signal:AbortSignal,operationId:string,eventId:string|undefined,call:()=>Promise<T>, classify?:(value:T)=>RelayObservation['result']):Promise<T>{
    this.check(signal);const start=performance.now();this.emit(operationId,eventId,stage,'started',start);
    try{const value=await call();this.check(signal);this.emit(operationId,eventId,stage,classify?classify(value):'succeeded',start);return value;}
    catch(error){this.emit(operationId,eventId,stage,['publish','mark'].includes(stage)?'unknown':'failed',start);throw error;}
  }
  private async authorize(signal:AbortSignal,id:string,eventId?:string):Promise<void>{
    try{await this.stage('authorize',signal,id,eventId,()=>this.authority.requirePublish(this.workerId,this.scope,signal));}
    catch{this.check(signal);throw new OutboxError('AUTHORIZATION_UNAVAILABLE');}
  }
  private async process(eventId:string,signal:AbortSignal,operationId:string):Promise<RelayResult>{
    // Outside the catch: denial cannot be interpreted as "object missing" or retried
    // through another identity, nor may it reveal a record's prior publication state.
    await this.authorize(signal,operationId,eventId);
    const result=(state:RelayResult['state'],reasonCode:string,transport:RelayResult['transport']='not_attempted',
      marker:RelayResult['marker']='not_attempted'):RelayResult=>Object.freeze({eventId,state,reasonCode,transport,marker});
    let phase:'load'|'publish'|'mark'='load';
    try{
      const stored=await this.stage('load',signal,operationId,eventId,()=>this.store.load(eventId,signal));
      if(stored===null)return result('blocked','FACT_UNRESOLVED');
      exactRecord(stored,['fact','payloadSha256','state']);
      const fact=decodeFact(stored.fact);
      if(fact.eventId!==eventId||!sameScope(fact.scope,this.scope)||
         stored.payloadSha256!==await hashFact(fact)||!['pending','published'].includes(stored.state))return result('blocked','FACT_UNRESOLVED');
      this.check(signal);
      if(stored.state==='published')return result('already_published','DURABLE_MARKER_OBSERVED');
      await this.authorize(signal,operationId,eventId);
      phase='publish';
      const reply=await this.stage('publish',signal,operationId,eventId,()=>this.transport.publish(fact,stored.payloadSha256,this.placement,signal),reply=>{
        if(reply?.result==='unknown')return 'unknown';
        if(reply?.result==='rejected')return 'failed';
        try{const ack=decodeAck(reply);return ack.eventId===eventId&&ack.payloadSha256===stored.payloadSha256?'succeeded':'unknown';}
        catch{return 'unknown';}
      });
      if(reply?.result==='unknown'||reply?.result==='rejected'){
        exactRecord(reply,['result']);
        return result('pending',reply.result==='unknown'?'TRANSPORT_UNKNOWN':'TRANSPORT_REJECTED',reply.result);
      }
      const ack=decodeAck(reply);
      if(ack.eventId!==eventId||ack.payloadSha256!==stored.payloadSha256)return result('pending','ACK_INVALID','unknown');
      phase='mark';
      await this.authorize(signal,operationId,eventId);
      await this.stage('mark',signal,operationId,eventId,()=>this.store.confirmPublished(ack,signal));
      return result('published','DURABILITY_BOUNDARIES_OBSERVED','committed','committed');
    }catch(error){
      // Publication may have reached Kafka even when the caller cannot observe it.
      // Retain the pending row; a repeated transport emission is not a new business action.
      if(phase==='mark')return result('pending',error instanceof OutboxError&&error.code==='FACT_CHANGED'?'FACT_CHANGED':'MARK_UNCONFIRMED','committed','unknown');
      if(phase==='publish')return result('pending','TRANSPORT_UNKNOWN','unknown');
      const code=error instanceof OutboxError&&['SCOPE_INACTIVE','PLACEMENT_MISMATCH','FACT_UNRESOLVED','CANCELLED'].includes(error.code)?error.code:'STORE_UNAVAILABLE';
      return result('blocked',code);
    }
  }
}
