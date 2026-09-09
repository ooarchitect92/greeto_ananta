/** F02 connection-attempt orchestration. No route, SDK launch or token exchange.
 * All ports are REQUIRED: there is no in-memory production store or allow-all gate.
 * See INC-017_META_SIGNUP_ATTEMPTS.md for storage and callback adapter obligations.
 */
import {createHash, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {prepareSignupConfiguration, SetupContext, SetupScope, PreparedSignup} from './signup-configuration';

export type AttemptState = 'AWAITING_CALLBACK' | 'CODE_RECEIVED' | 'SESSION_RECEIVED'
  | 'CALLBACK_CORRELATED' | 'CANCELLED' | 'EXPIRED';
export interface AttemptContext extends Omit<SetupContext, 'nowMs'> {
  /** Opaque authenticated-session reference, NOT a cookie, bearer token or email. */
  readonly sessionRef: string;
  readonly cellId: string;
  readonly epoch: number;
}
/** Claimed provider IDs only; later grant/ownership verification is mandatory. */
export interface SessionClaims {
  readonly businessId: string;
  readonly wabaIds: readonly string[];
  readonly phoneNumberId: string | null;
  readonly pageIds: readonly string[];
  readonly adAccountIds: readonly string[];
  readonly datasetIds: readonly string[];
  readonly catalogIds: readonly string[];
  readonly instagramAccountIds: readonly string[];
}
export interface AttemptRecord {
  readonly schemaVersion: 1;
  readonly attemptId: string;
  readonly binding: AttemptContext;
  readonly appId: string;
  readonly profileDigest: string;
  readonly stateDigest: string;
  readonly nonceDigest: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly expiresAtMs: number;
  readonly version: number;
  readonly status: AttemptState;
  readonly code: {readonly digest: string; readonly reference: string} | null;
  readonly session: {readonly digest: string; readonly claims: SessionClaims} | null;
}
export interface AttemptView {
  readonly schemaVersion: 1;
  readonly attemptId: string;
  readonly scope: SetupScope;
  readonly status: AttemptState;
  readonly version: number;
  readonly createdAtMs: number;
  readonly observedAtMs: number;
  readonly requestId: string;
  readonly expiresAtMs: number;
  readonly codeReceived: boolean;
  readonly sessionReceived: boolean;
  readonly exchange: 'not_requested';
  readonly durable: true;
}
export interface StoreAck {
  readonly acknowledged: true;
  readonly attemptId: string;
  readonly version: number;
  readonly recordDigest: string;
}
/** Private outbox descriptor. Repository retains its row binding; the publisher
 * must resolve the complete scoped baseline envelope before Kafka publication. */
export interface AttemptEvent {
  readonly eventId: string;
  readonly attemptId: string;
  readonly version: number;
  readonly status: AttemptState;
  readonly occurredAtMs: number;
}
/** Each write atomically persists record, history and pending outbox. Expected
 * record digest + version + binding are checked in the SAME transaction, alongside
 * current writer fencing and database-clock expiry at write time. Reads are authoritative, scoped and not cached/GSI reads.
 * CAS rejection throws AttemptError('CONFLICT'); unknown commits throw another error.
 * A resolved ack means the entire transaction committed, not merely queued work.
 */
export interface AttemptRepository {
  insert(record: AttemptRecord, event: AttemptEvent, signal: AbortSignal): Promise<StoreAck>;
  read(binding: AttemptContext, attemptId: string, signal: AbortSignal): Promise<unknown>;
  compareAndSet(previous: AttemptRecord, next: AttemptRecord, event: AttemptEvent, signal: AbortSignal): Promise<StoreAck>;
}
export interface AttemptAuthority {
  /** Verify current session/actor/object, selected profile and cell/epoch. No boolean
   * supplied by a browser can implement this permission check. Reject on uncertainty. */
  require(context: AttemptContext, operation: 'begin' | 'callback' | 'cancel' | 'expire' | 'read',
    attemptId: string | null, signal: AbortSignal): Promise<void>;
}
export interface SealedCode {
  readonly attemptId: string;
  readonly bindingDigest: string;
  readonly codeDigest: string;
  readonly reference: string;
  readonly expiresAtMs: number;
  readonly acknowledged: true;
}
export interface CallbackVault {
  /** Store bounded raw code encrypted under this exact attempt/binding until expiry.
   * Same attempt+code digest MUST return the same reference; changed code conflicts.
   * Require scoped KMS/workload authority. No token exchange. Orphans from a later
   * failed CAS are quarantined and cleaned after expiry, never treated as accepted.
   * Raw code must not appear in storage indexes, diagnostic exceptions or logs. */
  seal(binding: AttemptContext, attemptId: string, rawCode: string, codeDigest: string,
    expiresAtMs: number, signal: AbortSignal): Promise<SealedCode>;
}
export interface AttemptPolicy { readonly lifetimeMs: number; readonly operationTimeoutMs: number }
/** Per-operation correlation only; no secrets or tenant IDs in global metric labels.
 * The host observer must enqueue locally without blocking or awaiting remote logs. */
export interface AttemptStage {
  readonly stage: string;
  readonly operationId: string;
  readonly result: 'succeeded' | 'failed';
  readonly elapsedMs: number;
}
export type AttemptErrorCode = 'INPUT' | 'DENIED' | 'STALE' | 'CONFLICT' | 'CLOSED' | 'UNAVAILABLE' | 'RECEIPT';
export class AttemptError extends Error {
  constructor(readonly code: AttemptErrorCode) { super(`META_ATTEMPT_${code}`); this.name = 'AttemptError'; }
}
/** Normalized host callback, NOT Meta's wire schema or proof Meta echoes a nonce.
 * The host must bind actual SDK messages to one launch, validate exact source/origin,
 * check CSRF/session and seal state/nonce in its approved attempt channel. */
export type Callback = {
  readonly attemptId: string; readonly state: string; readonly nonce: string; readonly appId: string;
} & ({readonly kind: 'code'; readonly code: string} | {readonly kind: 'session'; readonly session: SessionClaims});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ref = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const hex = /^[0-9a-f]{64}$/;
const provider = /^[1-9][0-9]{0,63}$/;
const states: readonly AttemptState[] = ['AWAITING_CALLBACK','CODE_RECEIVED','SESSION_RECEIVED','CALLBACK_CORRELATED','CANCELLED','EXPIRED'];
const arrays = ['wabaIds','pageIds','adAccountIds','datasetIds','catalogIds','instagramAccountIds'] as const;
const integer = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0;
const text = (x: unknown, p: RegExp): x is string => typeof x === 'string' && x.length <= 128 && p.test(x);
const id = (x: unknown): x is string => text(x, uuid) && x !== '00000000-0000-0000-0000-000000000000';
function shape(x: unknown, names: readonly string[]): x is Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(x))) return false;
  const keys = Reflect.ownKeys(x);
  return keys.length === names.length && keys.every(k => typeof k === 'string' && names.includes(k)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(x,k) ?? {}, 'value'));
}
function contextOK(x: unknown): x is AttemptContext {
  if (!shape(x, ['scope','actorId','appRef','profileId','profileRevision','sessionRef','cellId','epoch'])) return false;
  return shape(x.scope, ['tenantId','workspaceId','environmentId']) && Object.values(x.scope).every(id)
    && id(x.actorId) && text(x.appRef,ref) && text(x.profileId,ref) && integer(x.profileRevision)
    && text(x.sessionRef,ref) && text(x.cellId,ref) && integer(x.epoch);
}
function claims(x: unknown): SessionClaims {
  if (!shape(x, ['businessId','phoneNumberId',...arrays]) || !text(x.businessId,provider)
    || !(x.phoneNumberId === null || text(x.phoneNumberId,provider))) throw new AttemptError('INPUT');
  for (const key of arrays) {
    const a=x[key];
    if (!Array.isArray(a) || a.length > 32 || Object.getPrototypeOf(a)!==Array.prototype
      || Reflect.ownKeys(a).length!==a.length+1 || !Array.from({length:a.length},(_,i)=>Object.getOwnPropertyDescriptor(a,String(i))).every(d=>d&&Object.hasOwn(d,'value')&&text(d.value,provider))
      || new Set(a).size !== a.length)
      throw new AttemptError('INPUT');
  }
  return freeze({...x, ...Object.fromEntries(arrays.map(k => [k,[...(x[k] as string[])].sort()]))}) as unknown as SessionClaims;
}
function freeze<T>(x: T): T {
  if (x && typeof x === 'object') { for (const v of Object.values(x)) freeze(v); Object.freeze(x); } return x;
}
/** Canonical hashing for validated, bounded internal data. Object-key order is
 * normalized; arrays are ordered (asset sets are sorted before reaching this helper).
 * This digest is an integrity/idempotency input, NOT an authorization signature. */
export function attemptDigest(x: unknown): string {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
    if (v && typeof v === 'object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
    return JSON.stringify(v);
  };
  return createHash('sha256').update(canonical(x)).digest('hex');
}
const secretHash = (s: string) => createHash('sha256').update(s,'utf8').digest('hex');
function secretMatches(value: unknown, digest: string): boolean {
  return text(value,hex) && timingSafeEqual(Buffer.from(secretHash(value),'hex'),Buffer.from(digest,'hex'));
}
function expectedState(code: AttemptRecord['code'], session: AttemptRecord['session']): AttemptState {
  return code ? (session ? 'CALLBACK_CORRELATED' : 'CODE_RECEIVED') : (session ? 'SESSION_RECEIVED' : 'AWAITING_CALLBACK');
}
function validatedRecord(x: unknown): AttemptRecord {
  if (!shape(x,['schemaVersion','attemptId','binding','appId','profileDigest','stateDigest','nonceDigest',
    'createdAtMs','updatedAtMs','expiresAtMs','version','status','code','session']) || x.schemaVersion !== 1 || !id(x.attemptId)
    || !contextOK(x.binding) || !text(x.appId,provider) || ![x.profileDigest,x.stateDigest,x.nonceDigest].every(v=>text(v,hex))
    || ![x.createdAtMs,x.updatedAtMs,x.expiresAtMs,x.version].every(integer) || !states.includes(x.status as AttemptState)) throw new AttemptError('RECEIPT');
  const r=x as unknown as AttemptRecord;
  if (r.createdAtMs > r.updatedAtMs || r.expiresAtMs <= r.createdAtMs || r.version >= Number.MAX_SAFE_INTEGER) throw new AttemptError('RECEIPT');
  if (r.code !== null && (!shape(r.code,['digest','reference']) || !text(r.code.digest,hex) || !text(r.code.reference,ref))) throw new AttemptError('RECEIPT');
  if (r.session !== null) {
    if (!shape(r.session,['digest','claims']) || !text(r.session.digest,hex)) throw new AttemptError('RECEIPT');
    try { if(attemptDigest(claims(r.session.claims)) !== r.session.digest) throw new Error(); } catch { throw new AttemptError('RECEIPT'); }
  }
  const terminal = ['CANCELLED','EXPIRED'].includes(r.status);
  if ((!terminal && r.status !== expectedState(r.code,r.session))
    || r.version !== 1+Number(r.code!==null)+Number(r.session!==null)+Number(terminal)
    || (r.status==='EXPIRED' && r.updatedAtMs<r.expiresAtMs)
    || (r.status!=='EXPIRED' && r.updatedAtMs>=r.expiresAtMs)) throw new AttemptError('RECEIPT');
  return freeze(structuredClone(r));
}
const bindingEqual = (a: AttemptContext,b: AttemptContext) => attemptDigest(a) === attemptDigest(b);
const profileDigest = (p: PreparedSignup) => attemptDigest({scope:p.scope,appRef:p.appRef,profileId:p.profileId,
  profileRevision:p.profileRevision,appId:p.appId,graphApiVersion:p.graphApiVersion,loginOptions:p.loginOptions});

/** Redacted launch result. Secrets are accessible explicitly only to the authorized
 * hosting adapter; toJSON/ordinary logging reveal the public view, never state/nonce.
 * This does not load the SDK, create a cookie, or add nonce fields to FB.login. */
export class StartedAttempt {
  #state: string; #nonce: string;
  constructor(readonly view: AttemptView, readonly setup: PreparedSignup, state: string, nonce: string) {
    this.#state=state; this.#nonce=nonce; Object.freeze(this);
  }
  correlation(): Readonly<{attemptId:string;state:string;nonce:string}> {
    return Object.freeze({attemptId:this.view.attemptId,state:this.#state,nonce:this.#nonce});
  }
  toJSON(): unknown { return {view:this.view,setup:this.setup}; }
  [Symbol.for('nodejs.util.inspect.custom')](): string { return '[Meta signup attempt: correlation secrets omitted]'; }
}

export class SignupAttempts {
  #repo: AttemptRepository; #authority: AttemptAuthority; #vault: CallbackVault;
  #operations = new WeakMap<AbortSignal,string>();
  #policy: AttemptPolicy; #clock: () => number; #observe?: (stage: AttemptStage) => void;
  constructor(repo: AttemptRepository, authority: AttemptAuthority, vault: CallbackVault,
    policy: AttemptPolicy, clock: () => number, observe?: (stage: AttemptStage) => void) {
    if (!repo || !authority || !vault || !['insert','read','compareAndSet'].every(k=>typeof (repo as unknown as Record<string,unknown>)[k]==='function')
      || typeof authority.require !== 'function' || typeof vault.seal !== 'function' || typeof clock !== 'function'
      || !shape(policy,['lifetimeMs','operationTimeoutMs']) || !integer(policy.lifetimeMs) || policy.lifetimeMs > 900000
      || !integer(policy.operationTimeoutMs) || policy.operationTimeoutMs > 30000 || (observe !== undefined && typeof observe !== 'function')) throw new AttemptError('INPUT');
    this.#repo=repo;this.#authority=authority;this.#vault=vault;this.#policy=Object.freeze({...policy});this.#clock=clock;this.#observe=observe;
  }
  #now(): number { const n=this.#clock(); if(!integer(n)) throw new AttemptError('UNAVAILABLE'); return n; }
  async #run<T>(signal: AbortSignal, fn:(s:AbortSignal)=>Promise<T>): Promise<T> {
    if (!(signal instanceof AbortSignal) || signal.aborted) throw new AttemptError('UNAVAILABLE');
    const controller=new AbortController(); this.#operations.set(controller.signal,randomUUID()); const abort=()=>controller.abort();
    const timer=setTimeout(abort,this.#policy.operationTimeoutMs); signal.addEventListener('abort',abort,{once:true});
    try { return await fn(controller.signal); } finally {clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
  async #step<T>(name:string,signal:AbortSignal,fn:()=>Promise<T>):Promise<T> {
    if(signal.aborted) throw new AttemptError('UNAVAILABLE');
    const started=performance.now(); let abort=()=>{}; let result:'succeeded'|'failed'='failed';
    try {
      const pending=new Promise<never>((_,reject)=>{abort=()=>reject(new AttemptError('UNAVAILABLE'));signal.addEventListener('abort',abort,{once:true});});
      const value=await Promise.race([pending,Promise.resolve().then(()=>{if(signal.aborted)throw new AttemptError('UNAVAILABLE');return fn();})]); result='succeeded'; return value;
    } catch(e) { if(e instanceof AttemptError) throw e; throw new AttemptError('UNAVAILABLE'); }
    finally {signal.removeEventListener('abort',abort);try{this.#observe?.(Object.freeze({stage:name,operationId:this.#operations.get(signal)!,result,elapsedMs:Math.max(0,Math.round(performance.now()-started))}));}catch{/* diagnostics cannot change the transaction result */}}
  }
  #binding(c:unknown):AttemptContext {if(!contextOK(c))throw new AttemptError('INPUT');return freeze(structuredClone(c));}
  async #authorize(c:AttemptContext,op:Parameters<AttemptAuthority['require']>[1],id:string|null,s:AbortSignal):Promise<void> {
    await this.#step('authority',s,async()=>{try{await this.#authority.require(c,op,id,s);}catch{throw new AttemptError('DENIED');}});
  }
  #prepare(profile:unknown,c:AttemptContext):PreparedSignup {
    const {scope,actorId,appRef,profileId,profileRevision}=c;
    return prepareSignupConfiguration(profile,{scope,actorId,appRef,profileId,profileRevision,nowMs:this.#now()});
  }
  #view(r:AttemptRecord,s:AbortSignal):AttemptView {
    return freeze({schemaVersion:1,attemptId:r.attemptId,scope:{...r.binding.scope},status:r.status,version:r.version,
      createdAtMs:r.createdAtMs,observedAtMs:this.#now(),requestId:this.#operations.get(s)!,expiresAtMs:r.expiresAtMs,codeReceived:r.code!==null,
      sessionReceived:r.session!==null,exchange:'not_requested',durable:true});
  }
  #event(r:AttemptRecord):AttemptEvent {return freeze({eventId:`meta-attempt:${r.attemptId}:${r.version}`,attemptId:r.attemptId,version:r.version,status:r.status,occurredAtMs:r.updatedAtMs});}
  #ack(a:unknown,r:AttemptRecord):void {
    if(!shape(a,['acknowledged','attemptId','version','recordDigest']) || a.acknowledged !== true || a.attemptId !== r.attemptId
      || a.version !== r.version || a.recordDigest !== attemptDigest(r)) throw new AttemptError('RECEIPT');
  }
  async #load(c:AttemptContext,id:string,s:AbortSignal):Promise<AttemptRecord> {
    if(!isId(id)) throw new AttemptError('INPUT');
    const r=validatedRecord(await this.#step('read',s,()=>this.#repo.read(c,id,s)));
    if(r.attemptId!==id || !bindingEqual(c,r.binding)) throw new AttemptError('DENIED');
    return r;
  }
  /** Begin after current authorization and registry validation. Generates independent
   * 256-bit state/nonce, persists only digests, returns correlation ONLY after exact
   * create acknowledgement. Failed/unknown inserts never launch consent; abandoned
   * rows expire. Request-level begin idempotency belongs to the future HTTP host. */
  async begin(profile:unknown,context:unknown,signal:AbortSignal):Promise<StartedAttempt> {
    const c=this.#binding(context); const p=copyInput(profile);
    return this.#run(signal,async s=>{
      await this.#authorize(c,'begin',null,s); const setup=this.#prepare(p,c); const now=this.#now();
      const expiresAtMs=Math.min(now+this.#policy.lifetimeMs,setup.expiresAtMs);
      if(!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now)throw new AttemptError('STALE');
      const state=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex');
      const r:AttemptRecord=freeze({schemaVersion:1,attemptId:randomUUID(),binding:c,appId:setup.appId,
        profileDigest:profileDigest(setup),stateDigest:secretHash(state),nonceDigest:secretHash(nonce),
        createdAtMs:now,updatedAtMs:now,expiresAtMs,version:1,status:'AWAITING_CALLBACK',code:null,session:null});
      this.#ack(await this.#step('insert',s,()=>this.#repo.insert(r,this.#event(r),s)),r);
      if(this.#now()>=r.expiresAtMs)throw new AttemptError('STALE');
      return new StartedAttempt(this.#view(r,s),setup,state,nonce);
    });
  }
  /** Record one normalized callback fragment. Code and session may arrive in either
   * order. Raw code enters ONLY CallbackVault.seal; repository/outbox/view carry no
   * code or correlation secrets. Same intent is idempotent; different intent conflicts.
   * Concurrent CAS losers retry the SAME fragment after reading, never overwrite.
   * The returned durable view acknowledges local correlation, not OAuth/grants/READY. */
  async receive(profile:unknown,context:unknown,input:unknown,signal:AbortSignal):Promise<AttemptView> {
    const c=this.#binding(context);
    if(!input || typeof input!=='object')throw new AttemptError('INPUT');
    const descriptor=Object.getOwnPropertyDescriptor(input,'kind');
    if(!descriptor||!Object.hasOwn(descriptor,'value'))throw new AttemptError('INPUT');
    const kind:unknown=descriptor.value;
    if(!shape(input,['attemptId','state','nonce','appId','kind',kind==='code'?'code':'session'])
      || !isId(input.attemptId) || !text(input.state,hex) || !text(input.nonce,hex) || !text(input.appId,provider)
      || !['code','session'].includes(String(kind)))throw new AttemptError('INPUT');
    if(kind==='code' && (typeof input.code!=='string' || input.code.length<1 || Buffer.byteLength(input.code,'utf8')>8192 || /[\x00-\x20\x7f]/.test(input.code)))throw new AttemptError('INPUT');
    const session=kind==='session'?claims(input.session):null;
    const f=copyInput({...input,...(session?{session}: {})}) as unknown as Callback;const p=copyInput(profile);
    return this.#run(signal,async s=>{
      await this.#authorize(c,'callback',f.attemptId,s); const setup=this.#prepare(p,c);
      const r=await this.#load(c,f.attemptId,s);
      if(!secretMatches(f.state,r.stateDigest)||!secretMatches(f.nonce,r.nonceDigest)||f.appId!==r.appId)throw new AttemptError('DENIED');
      if(r.profileDigest!==profileDigest(setup))throw new AttemptError('CONFLICT');
      if(this.#now()<r.updatedAtMs||this.#now()>=r.expiresAtMs)throw new AttemptError('STALE');
      if(['CANCELLED','EXPIRED'].includes(r.status))throw new AttemptError('CLOSED');
      const incomingDigest=f.kind==='code'?secretHash(f.code):attemptDigest(session);
      const prior=f.kind==='code'?r.code:r.session;
      if(prior){if(prior.digest!==incomingDigest)throw new AttemptError('CONFLICT');return this.#view(r,s);}
      let code=r.code;
      if(f.kind==='code'){
        const sealed=await this.#step('seal_code',s,()=>this.#vault.seal(c,r.attemptId,f.code,incomingDigest,r.expiresAtMs,s));
        if(!shape(sealed,['attemptId','bindingDigest','codeDigest','reference','expiresAtMs','acknowledged']) || sealed.acknowledged!==true
          || sealed.attemptId!==r.attemptId||sealed.bindingDigest!==attemptDigest(c)||sealed.codeDigest!==incomingDigest
          || !text(sealed.reference,ref)||sealed.expiresAtMs!==r.expiresAtMs)throw new AttemptError('RECEIPT');
        code=Object.freeze({digest:incomingDigest,reference:sealed.reference});
      }
      await this.#authorize(c,'callback',r.attemptId,s);this.#prepare(p,c);
      const now=this.#now();if(now<r.updatedAtMs||now>=r.expiresAtMs)throw new AttemptError('STALE');
      const nextSession=session?Object.freeze({digest:incomingDigest,claims:session}):r.session;
      const next:AttemptRecord=freeze({...r,code,session:nextSession,status:expectedState(code,nextSession),version:r.version+1,updatedAtMs:now});
      this.#ack(await this.#step('commit_callback',s,()=>this.#repo.compareAndSet(r,next,this.#event(next),s)),next);
      return this.#view(next,s);
    });
  }
  /** Read authorized, minimized progress. Expiry does not erase an accepted fact.
   * The presentation must withhold stale execution; close(..., 'expire', ...) records terminal expiry. */
  async inspect(context:unknown,attemptId:string,signal:AbortSignal):Promise<AttemptView>{
    const c=this.#binding(context);return this.#run(signal,async s=>{await this.#authorize(c,'read',attemptId,s);return this.#view(await this.#load(c,attemptId,s),s);});
  }
  /** Stop this attempt only. No provider revocation, credential deletion or asset
   * deregistration occurs. CAS serializes cancel/expiry against callback recording. */
  async close(context:unknown,attemptId:string,reason:'cancel'|'expire',signal:AbortSignal):Promise<AttemptView>{
    const c=this.#binding(context);if(!['cancel','expire'].includes(reason))throw new AttemptError('INPUT');
    return this.#run(signal,async s=>{
      await this.#authorize(c,reason,attemptId,s);const r=await this.#load(c,attemptId,s);const now=this.#now();
      if(now<r.updatedAtMs)throw new AttemptError('STALE');
      if(['CANCELLED','EXPIRED'].includes(r.status))return this.#view(r,s);
      if(reason==='expire'&&now<r.expiresAtMs)throw new AttemptError('CONFLICT');
      const next:AttemptRecord=freeze({...r,status:now>=r.expiresAtMs?'EXPIRED':'CANCELLED',version:r.version+1,updatedAtMs:now});
      this.#ack(await this.#step('commit_close',s,()=>this.#repo.compareAndSet(r,next,this.#event(next),s)),next);return this.#view(next,s);
    });
  }
}
function isId(v:unknown):v is string{return id(v);}

function copyInput<T>(input:T):T {try{return structuredClone(input);}catch{throw new AttemptError('INPUT');}}
