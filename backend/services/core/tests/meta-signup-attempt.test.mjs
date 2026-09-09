import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspect} from 'node:util';
import {inspectSignupAttempt} from '../../../../front end/src/features/channels/meta/signup-attempt-model.mjs';
import {SignupAttempts, AttemptError} from '../../../../.local-build/signup-attempts/signup-attempt.js';

// Test-only transactional model. It is not PostgreSQL, KMS, OIDC or Meta.
// Digests use independent canonical serialization; staging commits all three
// records together so injected failures can be checked for partial publication.
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const codeHash=x=>createHash('sha256').update(x).digest('hex');
const copy=x=>structuredClone(x);
const signal=()=>new AbortController().signal;
const claims=()=>({businessId:'800000000000000001',wabaIds:['700000000000000001'],phoneNumberId:'600000000000000001',pageIds:[],adAccountIds:[],datasetIds:[],catalogIds:[],instagramAccountIds:[]});
const error=code=>e=>e instanceof AttemptError && e.code===code;
const pause=()=>{let release;const promise=new Promise(r=>{release=r;});return {promise,release};};
function fixture(options={}) {
  const clock={now:1788912000000};
  const context={scope:{tenantId:'10000000-0000-0000-0000-000000000001',workspaceId:'20000000-0000-0000-0000-000000000002',environmentId:'30000000-0000-0000-0000-000000000003'},actorId:'40000000-0000-0000-0000-000000000004',appRef:'test-app',profileId:'test-profile',profileRevision:2,sessionRef:'test-session',cellId:'test-cell',epoch:7};
  const profile={schemaVersion:1,scope:copy(context.scope),appRef:context.appRef,profileId:context.profileId,profileRevision:2,appId:'100000000000000001',configId:'200000000000000002',graphApiVersion:'v24.0',signupVersion:'v4',featureType:'',features:[],enabled:true,evidence:{status:'verified',sourceRef:'synthetic-only',reviewedAtMs:clock.now-1000,expiresAtMs:clock.now+60000}};
  const calls=[], stages=[], records=new Map(),history=[],outbox=[], sealed=new Map();
  const auth={denied:false,require:async(c,op,id)=>{calls.push('authority:'+op);if(auth.denied)throw Error('private auth detail');}};
  const acknowledge=r=>({acknowledged:true,attemptId:r.attemptId,version:r.version,recordDigest:digest(r)});
  const repo={
    beforeWrite:null,afterWrite:null,ack:acknowledge,readTransform:x=>x,
    async insert(r,e,s){calls.push('insert');if(repo.beforeWrite)await repo.beforeWrite(r,e,s);if(s.aborted)throw Error('aborted');if(records.has(r.attemptId))throw new AttemptError('CONFLICT');
      records.set(r.attemptId,copy(r));history.push(copy(e));outbox.push(copy(e));if(repo.afterWrite)await repo.afterWrite(r);return repo.ack(r);},
    async read(c,id){calls.push('read');const r=records.get(id);return repo.readTransform(r?copy(r):null);},
    async compareAndSet(old,next,e,s){calls.push('cas');if(repo.beforeWrite)await repo.beforeWrite(next,e,s);if(s.aborted)throw Error('aborted');
      const row=records.get(old.attemptId);if(!row||digest(row)!==digest(old))throw new AttemptError('CONFLICT');
      // Model checks equivalent to required DB server-side fencing/expiry check.
      if(auth.denied)throw new AttemptError('DENIED');
      if(!['EXPIRED','CANCELLED'].includes(next.status)&&clock.now>=old.expiresAtMs)throw new AttemptError('STALE');
      records.set(next.attemptId,copy(next));history.push(copy(e));outbox.push(copy(e));if(repo.afterWrite)await repo.afterWrite(next);return repo.ack(next);
    }
  };
  const vault={before:null,transform:x=>x,async seal(c,id,code,d,expires,s){calls.push('seal');if(vault.before)await vault.before(s);if(s.aborted)throw Error('aborted');assert.equal(codeHash(code),d);
    if(sealed.has(id)&&sealed.get(id).codeDigest!==d)throw new AttemptError('CONFLICT');
    const value={attemptId:id,bindingDigest:digest(c),codeDigest:d,reference:'test-vault:'+id,expiresAtMs:expires,acknowledged:true};sealed.set(id,value);return vault.transform(copy(value));}};
  const service=new SignupAttempts(repo,auth,vault,{lifetimeMs:30000,operationTimeoutMs:options.timeout??1000},()=>clock.now,x=>{stages.push(x);if(options.brokenObserver)throw Error('observer failed');});
  const begin=()=>service.begin(profile,context,signal());
  const fragment=(ticket,kind='code',value=kind==='code'?'synthetic-code-A':claims())=>({...ticket.correlation(),appId:profile.appId,kind,[kind]:value});
  const receive=(ticket,kind,value)=>service.receive(profile,context,fragment(ticket,kind,value),signal());
  return {clock,context,profile,calls,stages,records,history,outbox,sealed,auth,repo,vault,service,begin,fragment,receive};
}

test('begin waits for exact durable acknowledgement and stores only correlation digests',async()=>{
  const f=fixture(), gate=pause();f.repo.beforeWrite=()=>gate.promise;let finished=false;
  const p=f.begin().then(x=>{finished=true;return x;});await new Promise(r=>setImmediate(r));assert.equal(finished,false);gate.release();const t=await p;
  assert.equal(t.view.status,'AWAITING_CALLBACK');assert.equal(t.view.durable,true);const secret=t.correlation();assert.match(secret.state,/^[0-9a-f]{64}$/);assert.notEqual(secret.state,secret.nonce);
  const row=f.records.get(t.view.attemptId);assert.equal(row.stateDigest,codeHash(secret.state));assert.equal(row.nonceDigest,codeHash(secret.nonce));
  assert.equal(JSON.stringify(row).includes(secret.state),false);assert.equal(JSON.stringify(t).includes(secret.nonce),false);assert.equal(inspect(t).includes(secret.state),false);
  assert.equal(f.history.length,1);assert.deepEqual(f.history,f.outbox);assert.equal(Object.isFrozen(t.view.scope),true);
});
for(const order of [['code','session'],['session','code']])test('correlates both callbacks in '+order.join(' then ')+' order',async()=>{
  const f=fixture(),t=await f.begin();const first=await f.receive(t,order[0]);assert.equal(first.status,order[0]==='code'?'CODE_RECEIVED':'SESSION_RECEIVED');
  const second=await f.receive(t,order[1]);assert.equal(second.status,'CALLBACK_CORRELATED');assert.equal(second.version,3);assert.equal(second.exchange,'not_requested');
  assert.equal(second.codeReceived,true);assert.equal(second.sessionReceived,true);assert.equal(inspectSignupAttempt(second,f.context.scope,f.clock.now).state,'CALLBACK_CORRELATED');assert.equal(JSON.stringify(second).includes('synthetic-code'),false);
  assert.equal(f.sealed.size,1);assert.equal(f.history.length,3);assert.equal(JSON.stringify(f.records.values().next().value).includes('synthetic-code-A'),false);
});
test('identical callback retries neither reseal code nor append history/outbox',async()=>{
  const f=fixture(),t=await f.begin();await f.receive(t,'code');await f.receive(t,'session');const count=f.calls.filter(x=>x==='seal').length;
  const retry=await f.receive(t,'code');assert.equal(retry.version,3);assert.equal(f.history.length,3);assert.equal(f.calls.filter(x=>x==='seal').length,count);
});
test('asset arrays are canonical sets, while IDs remain exact strings',async()=>{
  const f=fixture(),t=await f.begin(),c=claims();c.wabaIds.push('90071992547409931234');await f.receive(t,'session',c);
  c.wabaIds.reverse();const replay=await f.receive(t,'session',c);assert.equal(replay.version,2);assert.equal(f.records.get(t.view.attemptId).session.claims.wabaIds.includes('90071992547409931234'),true);
});
for(const kind of ['code','session'])test('changed '+kind+' conflicts rather than overwriting accepted intent',async()=>{
  const f=fixture(),t=await f.begin();await f.receive(t,kind);
  await assert.rejects(f.receive(t,kind,kind==='code'?'different-code':{...claims(),businessId:'999'}),error('CONFLICT'));
  assert.equal(f.history.length,2);
});
for(const key of ['state','nonce','appId'])test('wrong '+key+' cannot capture a callback',async()=>{
  const f=fixture(),t=await f.begin(),v=f.fragment(t);v[key]=key==='appId'?'999':'0'.repeat(64);
  await assert.rejects(f.service.receive(f.profile,f.context,v,signal()),error('DENIED'));assert.equal(f.sealed.size,0);assert.equal(f.history.length,1);
});
for(const key of ['actorId','sessionRef','cellId','epoch'])test('different '+key+' cannot adopt an existing attempt',async()=>{
  const f=fixture(),t=await f.begin(),c={...f.context,[key]:key==='actorId'?'90000000-0000-0000-0000-000000000009':key==='epoch'?8:'other'};
  await assert.rejects(f.service.receive(f.profile,c,f.fragment(t),signal()),error('DENIED'));assert.equal(f.sealed.size,0);
});
for(const key of ['tenantId','workspaceId','environmentId'])test('cross-'+key+' attempt lookup fails closed',async()=>{
  const f=fixture(),t=await f.begin(),c=copy(f.context);c.scope[key]='90000000-0000-0000-0000-000000000009';const p=copy(f.profile);p.scope=c.scope;
  await assert.rejects(f.service.receive(p,c,f.fragment(t),signal()),error('DENIED'));assert.equal(f.sealed.size,0);
});
test('two attempts in the same session cannot swap secrets or callback data',async()=>{
  const f=fixture(),a=await f.begin(),b=await f.begin();assert.notEqual(a.correlation().state,b.correlation().state);
  await assert.rejects(f.service.receive(f.profile,f.context,{...f.fragment(a),attemptId:b.view.attemptId},signal()),error('DENIED'));
  await f.receive(a,'code');await f.receive(b,'session');assert.equal(f.records.get(a.view.attemptId).session,null);assert.equal(f.records.get(b.view.attemptId).code,null);
});
test('authorization failure occurs before lookup or vault access',async()=>{
  const f=fixture(),t=await f.begin();f.auth.denied=true;f.calls.length=0;
  await assert.rejects(f.receive(t,'code'),error('DENIED'));assert.deepEqual(f.calls,['authority:callback']);
});
test('authority revoked while sealing blocks the following record write',async()=>{
  const f=fixture(),t=await f.begin();f.vault.before=async()=>{f.auth.denied=true;};
  await assert.rejects(f.receive(t,'code'),error('DENIED'));assert.equal(f.history.length,1);assert.equal(f.sealed.size,1); // orphan, not accepted
});
test('same profile revision cannot hide a changed config payload',async()=>{
  const f=fixture(),t=await f.begin();f.profile.configId='888';await assert.rejects(f.receive(t,'code'),error('CONFLICT'));assert.equal(f.sealed.size,0);
});
test('revoked profile blocks subsequent callbacks even with valid state',async()=>{
  const f=fixture(),t=await f.begin();f.profile.evidence.status='revoked';await assert.rejects(f.receive(t,'code'),e=>e.code==='META_SETUP_REVOKED');assert.equal(f.sealed.size,0);
});
test('attempt expiry is no later than its evidence expiry',async()=>{
  const f=fixture();f.profile.evidence.expiresAtMs=f.clock.now+2000;const t=await f.begin();assert.equal(t.view.expiresAtMs,f.clock.now+2000);
});
test('expiry and backwards clocks block callback writes',async()=>{
  const f=fixture(),t=await f.begin();f.clock.now=t.view.expiresAtMs;await assert.rejects(f.receive(t,'code'),error('STALE'));
  f.clock.now=t.view.createdAtMs-1;await assert.rejects(f.receive(t,'code'),error('STALE'));assert.equal(f.sealed.size,0);
});
test('expiry reached during vault work does not advance callback state',async()=>{
  const f=fixture(),t=await f.begin();f.vault.before=async()=>{f.clock.now=t.view.expiresAtMs;};await assert.rejects(f.receive(t,'code'),error('STALE'));assert.equal(f.history.length,1);
});
test('expired attempt retains its record and closes idempotently',async()=>{
  const f=fixture(),t=await f.begin();await assert.rejects(f.service.close(f.context,t.view.attemptId,'expire',signal()),error('CONFLICT'));
  f.clock.now=t.view.expiresAtMs;const v=await f.service.close(f.context,t.view.attemptId,'expire',signal());assert.equal(v.status,'EXPIRED');
  assert.equal((await f.service.close(f.context,t.view.attemptId,'expire',signal())).version,2);assert.equal(f.records.size,1);
});
test('cancel closes only its own attempt and blocks new callback fragments',async()=>{
  const f=fixture(),a=await f.begin(),b=await f.begin();await f.receive(a,'code');const v=await f.service.close(f.context,a.view.attemptId,'cancel',signal());
  assert.equal(v.status,'CANCELLED');await assert.rejects(f.receive(a,'session'),error('CLOSED'));assert.equal((await f.receive(b,'session')).status,'SESSION_RECEIVED');
});
test('concurrent complementary callbacks use CAS; loser can retry same fragment',async()=>{
  const f=fixture(),t=await f.begin(),gate=pause();let n=0;f.repo.beforeWrite=async()=>{if(++n===2)gate.release();await gate.promise;};
  const results=await Promise.allSettled([f.receive(t,'code'),f.receive(t,'session')]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.code,'CONFLICT');f.repo.beforeWrite=null;
  const loser=results[0].status==='rejected'?'code':'session';assert.equal((await f.receive(t,loser)).status,'CALLBACK_CORRELATED');assert.equal(f.history.length,3);
});
test('concurrent identical callbacks append exactly one transition in the model',async()=>{
  const f=fixture(),t=await f.begin();const result=await Promise.allSettled([f.receive(t,'code'),f.receive(t,'code')]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.receive(t,'code')).version,2);assert.equal(f.history.length,2);
});
test('cancel winning a race prevents a late callback CAS from reviving the attempt',async()=>{
  const f=fixture(),t=await f.begin(),gate=pause();let entered=pause();f.repo.beforeWrite=async next=>{if(next.status==='CODE_RECEIVED'){entered.release();await gate.promise;}};
  const response=f.receive(t,'code');await entered.promise;await f.service.close(f.context,t.view.attemptId,'cancel',signal());gate.release();
  await assert.rejects(response,error('CONFLICT'));assert.equal(f.records.get(t.view.attemptId).status,'CANCELLED');
});
test('lost callback commit acknowledgement is recovered from the same persisted intent',async()=>{
  const f=fixture(),t=await f.begin();f.repo.afterWrite=async()=>{throw Error('lost response');};
  await assert.rejects(f.receive(t,'code'),error('UNAVAILABLE'));assert.equal(f.records.get(t.view.attemptId).status,'CODE_RECEIVED');
  f.repo.afterWrite=null;assert.equal((await f.receive(t,'code')).version,2);assert.equal(f.history.length,2);
});
test('failed transaction leaves no partial history or outbox',async()=>{
  const f=fixture(),t=await f.begin();f.repo.beforeWrite=async()=>{throw Error('db down');};await assert.rejects(f.receive(t,'code'),error('UNAVAILABLE'));
  assert.equal(f.records.get(t.view.attemptId).code,null);assert.equal(f.history.length,1);assert.deepEqual(f.history,f.outbox);
});
for(const bad of ['acknowledged','attemptId','version','recordDigest'])test('rejects mismatched '+bad+' in store acknowledgement',async()=>{
  const f=fixture(),t=await f.begin(),old=f.repo.ack;f.repo.ack=r=>({...old(r),[bad]:bad==='acknowledged'?false:bad==='version'?999:'wrong'});
  await assert.rejects(f.receive(t,'session'),error('RECEIPT'));
});
for(const bad of ['acknowledged','attemptId','bindingDigest','codeDigest','reference','expiresAtMs'])test('rejects mismatched '+bad+' in vault acknowledgement',async()=>{
  const f=fixture(),t=await f.begin();f.vault.transform=r=>({...r,[bad]:bad==='acknowledged'?false:bad==='expiresAtMs'?1:bad==='reference'?'':'wrong'});
  await assert.rejects(f.receive(t,'code'),error('RECEIPT'));assert.equal(f.history.length,1);
});
test('hung store operation is bounded without claiming success',async()=>{
  const f=fixture({timeout:20});f.repo.beforeWrite=()=>new Promise(()=>{});const start=performance.now();await assert.rejects(f.begin(),error('UNAVAILABLE'));assert.ok(performance.now()-start<1000);
});
test('aborted operation does not start any port work',async()=>{
  const f=fixture(),a=new AbortController();a.abort();await assert.rejects(f.service.begin(f.profile,f.context,a.signal),error('UNAVAILABLE'));assert.equal(f.calls.length,0);
});
test('cancellation while sealing prevents storage transition',async()=>{
  const f=fixture(),t=await f.begin(),abort=new AbortController();f.vault.before=async()=>abort.abort();await assert.rejects(f.service.receive(f.profile,f.context,f.fragment(t),abort.signal),error('UNAVAILABLE'));assert.equal(f.history.length,1);
});
test('diagnostic sink failure cannot undo acceptance; stages share request correlation',async()=>{
  const f=fixture({brokenObserver:true}),t=await f.begin();const view=await f.receive(t,'code');assert.equal(view.status,'CODE_RECEIVED');
  const stages=f.stages.filter(x=>x.operationId===view.requestId);assert.ok(stages.length>=4);assert.ok(stages.every(x=>x.elapsedMs>=0));
  assert.equal(JSON.stringify(f.stages).includes(t.correlation().state),false);assert.equal(JSON.stringify(f.stages).includes('synthetic-code-A'),false);
});
test('caller mutation after entry cannot change context or callback intent',async()=>{
  const f=fixture(),t=await f.begin(),fragment=f.fragment(t,'session'),gate=pause();const old=f.auth.require;f.auth.require=async(...args)=>{await gate.promise;return old(...args);};
  const response=f.service.receive(f.profile,f.context,fragment,signal());fragment.session.businessId='999';f.context.actorId='90000000-0000-0000-0000-000000000009';gate.release();
  await response;assert.equal(f.records.get(t.view.attemptId).session.claims.businessId,claims().businessId);
});
for(const [label,change] of [
  ['extra code field',x=>x.access_token='secret'],['empty code',x=>x.code=''],['oversized code',x=>x.code='a'.repeat(8193)],
  ['code whitespace',x=>x.code='abc def'],['numeric app',x=>x.appId=123],['wrong fragment',x=>x.kind='finish'],
])test('bounded callback rejects '+label,async()=>{
  const f=fixture(),t=await f.begin(),x=f.fragment(t);change(x);await assert.rejects(f.service.receive(f.profile,f.context,x,signal()),error('INPUT'));assert.equal(f.sealed.size,0);
});
for(const [label,change] of [
  ['duplicate IDs',x=>x.wabaIds=['1','1']],['number IDs',x=>x.wabaIds=[123]],['too many IDs',x=>x.wabaIds=Array.from({length:33},(_,i)=>String(i+1))],
  ['unknown field',x=>x.token='secret'],['nested body',x=>x.businessId={}],['sparse array',x=>x.pageIds=Array(2)]
])test('session claims reject '+label,async()=>{
  const f=fixture(),t=await f.begin(),x=claims();change(x);await assert.rejects(f.receive(t,'session',x),error('INPUT'));assert.equal(f.history.length,1);
});
test('corrupt or cross-key store records never become durable public progress',async()=>{
  const f=fixture(),t=await f.begin();f.repo.readTransform=r=>({...r,status:'CALLBACK_CORRELATED'});await assert.rejects(f.service.inspect(f.context,t.view.attemptId,signal()),error('RECEIPT'));
  f.repo.readTransform=r=>({...r,attemptId:'90000000-0000-0000-0000-000000000009'});await assert.rejects(f.service.inspect(f.context,t.view.attemptId,signal()),error('DENIED'));
});
test('public view never exposes vault references, asset claims or state hashes',async()=>{
  const f=fixture(),t=await f.begin();await f.receive(t,'code');await f.receive(t,'session');const v=await f.service.inspect(f.context,t.view.attemptId,signal());
  const raw=JSON.stringify(v);for(const secret of ['test-vault','businessId','stateDigest','nonceDigest','test-session','synthetic-code-A'])assert.equal(raw.includes(secret),false);
});
test('constructor requires concrete adapters and explicit bounded policy',()=>{
  const f=fixture();for(const lifetimeMs of [0,900001,NaN])assert.throws(()=>new SignupAttempts(f.repo,f.auth,f.vault,{lifetimeMs,operationTimeoutMs:100},Date.now),error('INPUT'));
  assert.throws(()=>new SignupAttempts(null,f.auth,f.vault,{lifetimeMs:10,operationTimeoutMs:100},Date.now),error('INPUT'));
});

test('lost vault acknowledgement never creates a callback receipt; identical retry can recover custody',async()=>{
  const f=fixture(),t=await f.begin();f.vault.transform=()=>{throw Error('vault ACK lost');};await assert.rejects(f.receive(t,'code'),error('UNAVAILABLE'));assert.equal(f.history.length,1);
  f.vault.transform=x=>x;assert.equal((await f.receive(t,'code')).status,'CODE_RECEIVED');assert.equal(f.sealed.size,1);
});
test('lost begin acknowledgement never returns correlation or begins provider consent',async()=>{
  const f=fixture();f.repo.afterWrite=async()=>{throw Error('insert ACK lost');};await assert.rejects(f.begin(),error('UNAVAILABLE'));assert.equal(f.records.size,1);assert.equal(f.sealed.size,0);
});

test('callback discriminant and session-array accessors are rejected without invocation',async()=>{
  const f=fixture(),t=await f.begin();let touched=0;const x=f.fragment(t);Object.defineProperty(x,'kind',{get(){touched++;throw Error('sensitive');}});
  await assert.rejects(f.service.receive(f.profile,f.context,x,signal()),error('INPUT'));
  const c=claims();Object.defineProperty(c.wabaIds,'0',{get(){touched++;return'1';}});await assert.rejects(f.receive(t,'session',c),error('INPUT'));assert.equal(touched,0);
});
