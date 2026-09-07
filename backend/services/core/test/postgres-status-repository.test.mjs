import test from 'node:test';
import assert from 'node:assert/strict';
import { StatusService, StatusError } from '../../../../.local-build/status-store/status-service.js';
import { PostgresStatusRepository, statusSql } from '../../../../.local-build/status-store/delivery/postgres-status-repository.js';

// Scripted PostgreSQL protocol model ONLY. This is not a database, RLS or concurrency certification.
const scope = Object.freeze({tenantId:'11111111-1111-4111-8111-111111111111',workspaceId:'22222222-2222-4222-8222-222222222222',environmentId:'33333333-3333-4333-8333-333333333333'});
const actor = Object.freeze({id:'44444444-4444-4444-8444-444444444444',permissions:[]});
const baselineId='55555555-5555-4555-8555-555555555555', otherId='66666666-6666-4666-8666-666666666666';
const placement=Object.freeze({cellId:'cell-a',placementEpoch:'9007199254740993',environmentKind:'sandbox'});
const snapshot={...scope,homeCell:placement.cellId,placementEpoch:placement.placementEpoch,state:'active',kind:'sandbox'};
const change=Object.freeze({id:'PLT-001',status:'In progress',expectedVersion:1,idempotencyKey:'increment-test-key-001',reasonCode:'source_evidence'});
const proof={implementation:true,automatedAcceptance:true,securityReview:true,documentation:true,rolloutRollback:true,externalApprovals:true};
const goodGuard={superuser:false,bypass_rls:false,unsafe_session:false,guarded_tables:'8'};
const code=expected => error => error instanceof StatusError && error.code===expected && error.message===expected;
const bounded=(patch={})=>({...scope,baselineId,id:change.id,status:'Not started',version:'1',...patch});

/** Transactional model with failure hooks and committed-versus-staged visibility. */
function fixture(options={}) {
  let committed={row:bounded(options.row),history:{},outbox:[]};
  const calls=[],releases=[],events=[],authorizations=[];
  const control=new AbortController(); let verifierCalls=0,failCommitOnce=!!options.unknownCommit;
  const pool={async connect(signal){
    calls.push({stage:'connect',params:[]});if(options.connectFailure)throw Error('secret connection string');
    let working=null,write=false;
    return {async query(sql,params,signal){
      const stage=Object.keys(statusSql).find(key=>statusSql[key]===sql);
      calls.push({stage,params:[...params],sql});options.before?.(stage,params,control);
      if(options.failAt===stage && (options.onlyWrite===undefined || options.onlyWrite===write))throw Error('password=never-return; SQL failure');
      let rows=[];
      if(stage==='beginRead'||stage==='beginWrite'){write=stage==='beginWrite';working=structuredClone(committed);}
      else if(stage==='context')assert.deepEqual(params.slice(0,3),Object.values(scope));
      else if(stage==='guard')rows=[{...goodGuard,...options.guard}];
      else if(stage==='placementRead'||stage==='placementWrite')rows=options.missingScope?[]:[{...snapshot,...options.snapshot}];
      else if(stage==='receipt')rows=working.history[params[3]]?[structuredClone(working.history[params[3]])]:[];
      else if(stage==='lock')rows=options.missingPackage?[]:[structuredClone(working.row)];
      else if(stage==='dependencies')rows=(options.dependencies??[]).map(id=>({id}));
      else if(stage==='predecessors')rows=[{verified:options.predecessorsVerified??true}];
      else if(stage==='update'){
        assert.ok(write);assert.deepEqual(params.slice(0,4),[...Object.values(scope),baselineId]);
        if(!options.zeroUpdate && working.row.version===params[5] && working.row.status===params[6]){
          working.row={...working.row,status:params[7],version:`${BigInt(params[5])+1n}`};rows=[{...working.row}];
        }
      }else if(stage==='history'){
        assert.ok(write);if(working.history[params[7]])throw Error('duplicate key');
        working.history[params[7]]=bounded({id:params[4],eventId:params[5],actorId:params[6],intentHash:params[8],status:params[10],version:params[12]});
        rows=[{eventId:params[5]}];
      }else if(stage==='outbox'){
        assert.ok(write);working.outbox.push({eventId:params[3],ref:params[4]});rows=[{eventId:params[3]}];
      }else if(stage==='commit'){
        if(write){if(options.commitBarrier)await options.commitBarrier;committed=working;}
        working=null;
        if(write && failCommitOnce){failCommitOnce=false;throw Error('COMMIT completed; socket response lost');}
      }else if(stage==='rollback'){working=null;}
      if(options.rows?.[stage])rows=options.rows[stage](rows);
      return rows;
    },release(discard){releases.push(discard);if(options.releaseFailure)throw Error('private pool details');}};
  }};
  const repo=new PostgresStatusRepository(pool,{scope,actorId:actor.id,baselineId,placement,signal:control.signal,
    observe:event=>{events.push(event);options.observe?.(event);}});
  const service=new StatusService(repo,{async require(s,a,p){authorizations.push({s,a,p});if(options.deny)throw new StatusError('FORBIDDEN');}},
    {async verify(){verifierCalls++;if(options.evidenceUnavailable)throw new StatusError('EVIDENCE_UNAVAILABLE');return options.proof??proof;}});
  return {repo,service,pool,calls,releases,events,control,authorizations,get state(){return structuredClone(committed);},get verifierCalls(){return verifierCalls;}};
}

// Actual composition: unchanged StatusService -> new repository -> scripted driver.
test('authorized status update, immutable history and pending outbox become visible together after commit',async()=>{
  const f=fixture();const receipt=await f.service.change(scope,actor,change);
  assert.equal(receipt.version,2);assert.equal(f.state.row.status,'In progress');assert.equal(Object.keys(f.state.history).length,1);
  assert.equal(f.state.outbox.length,1);assert.equal(f.state.outbox[0].eventId,receipt.eventId);
  assert.equal(f.state.outbox[0].ref,`delivery-status:${receipt.eventId}`);
  assert.deepEqual(f.calls.filter(c=>['update','history','outbox','commit'].includes(c.stage)).map(c=>c.stage),['commit','update','history','outbox','commit']);
  assert.deepEqual(f.releases,[false,false]);assert.equal(f.authorizations[0].p,'delivery.status.write');
});
test('identical retry returns the same committed receipt and appends no second event',async()=>{
  const f=fixture();const first=await f.service.change(scope,actor,change),second=await f.service.change(scope,actor,change);
  assert.deepEqual(second,first);assert.equal(f.state.outbox.length,1);assert.equal(f.authorizations.length,2);
});
test('same key with a changed intent remains an idempotency conflict',async()=>{
  const f=fixture();await f.service.change(scope,actor,change);
  await assert.rejects(f.service.change(scope,actor,{...change,status:'Blocked'}),code('IDEMPOTENCY_CONFLICT'));assert.equal(f.state.outbox.length,1);
});
test('ambiguous commit is not success; same-key retry recovers the one original receipt',async()=>{
  const f=fixture({unknownCommit:true});await assert.rejects(f.service.change(scope,actor,change),code('STORE_UNAVAILABLE'));
  assert.equal(f.state.outbox.length,1);assert.ok(f.events.some(e=>e.stage==='commit'&&e.result==='unknown'));
  const receipt=await f.service.change(scope,actor,change);assert.equal(receipt.eventId,f.state.outbox[0].eventId);assert.equal(f.state.outbox.length,1);
});
test('a pending COMMIT cannot be returned as an acknowledged status change',async()=>{
  let release;const barrier=new Promise(resolve=>{release=resolve;});const f=fixture({commitBarrier:barrier});let completed=false;
  const call=f.service.change(scope,actor,change).then(v=>{completed=true;return v;});
  for(let i=0;i<100&&!f.calls.some(c=>c.stage==='outbox');i++)await new Promise(resolve=>setTimeout(resolve,1));
  assert.ok(f.calls.some(c=>c.stage==='outbox'));assert.equal(completed,false);assert.equal(f.state.outbox.length,0);
  release();await call;assert.equal(completed,true);assert.equal(f.state.outbox.length,1);
});
for(const stage of ['beginWrite','context','guard','placementWrite','receipt','lock','dependencies','update','history','outbox','commit'])test(`failure at ${stage} rolls back, discards once and creates no acknowledged partial change`,async()=>{
  const f=fixture({failAt:stage,onlyWrite:stage==='beginWrite'?false:true});
  await assert.rejects(f.service.change(scope,actor,change),code('STORE_UNAVAILABLE'));
  assert.equal(f.state.row.status,'Not started');assert.deepEqual(f.state.history,{});assert.deepEqual(f.state.outbox,[]);
  assert.equal(f.releases.at(-1),true);assert.equal(f.calls.at(-1).stage,'rollback');
});
for(const guard of [{superuser:true},{bypass_rls:true},{unsafe_session:true},{guarded_tables:'7'},{guarded_tables:8}])test(`unsafe role/RLS configuration blocks SQL mutation: ${JSON.stringify(guard)}`,async()=>{
  const f=fixture({guard});await assert.rejects(f.service.change(scope,actor,change),code('STORE_CONFIGURATION'));
  assert.ok(!f.calls.some(c=>c.stage==='lock'));assert.equal(f.state.outbox.length,0);
});
for(const key of Object.keys(scope))test(`repository rejects another ${key} before acquiring any session`,async()=>{
  const f=fixture();await assert.rejects(f.repo.findReceipt({...scope,[key]:otherId},'a'.repeat(64)),code('NOT_FOUND'));assert.equal(f.calls.length,0);
});
for(const patch of [{homeCell:'cell-b'},{placementEpoch:'2'},{kind:'production'}])test(`stored placement mismatch blocks control writes ${JSON.stringify(patch)}`,async()=>{
  const f=fixture({snapshot:patch});await assert.rejects(f.service.change(scope,actor,change),code('PLACEMENT_MISMATCH'));assert.equal(f.state.outbox.length,0);
});
for(const state of ['provisioning','suspended','erasing'])test(`${state} cannot authorize a new status write`,async()=>{
  const f=fixture({snapshot:{state}});await assert.rejects(f.service.change(scope,actor,change),code('SCOPE_INACTIVE'));assert.ok(!f.calls.some(c=>c.stage==='update'));
});
test('authorization denial does not acquire a database connection',async()=>{
  const f=fixture({deny:true});await assert.rejects(f.service.change(scope,actor,change),code('FORBIDDEN'));assert.equal(f.calls.length,0);
});
test('predecessor checks remain scoped and block advancement without acceptance',async()=>{
  const f=fixture({dependencies:['GOV-001'],predecessorsVerified:false});await assert.rejects(f.service.change(scope,actor,change),code('PREDECESSORS_BLOCKED'));
  const q=f.calls.find(c=>c.stage==='predecessors');assert.deepEqual(q.params,[...Object.values(scope),baselineId,'["GOV-001"]','1']);assert.equal(f.state.outbox.length,0);
});
test('Done requires all existing evidence gates; repository is not a self-approval path',async()=>{
  const f=fixture({row:{status:'Review'},proof:{...proof,securityReview:false}});
  await assert.rejects(f.service.change(scope,actor,{...change,status:'Done',evidenceRef:'evidence:test'}),code('ACCEPTANCE_INCOMPLETE'));
  assert.equal(f.state.outbox.length,0);assert.ok(!f.calls.some(c=>c.stage==='beginWrite'));
});
test('authorized Done replay does not re-run the evidence verifier',async()=>{
  const f=fixture({row:{status:'Review'}});const c={...change,status:'Done',evidenceRef:'evidence:approved-test'};
  const receipt=await f.service.change(scope,actor,c);assert.deepEqual(await f.service.change(scope,actor,c),receipt);assert.equal(f.verifierCalls,1);
});
test('optimistic version conflict cannot overwrite a newer status',async()=>{
  const f=fixture({row:{version:'2'}});await assert.rejects(f.service.change(scope,actor,change),code('VERSION_CONFLICT'));assert.equal(f.state.row.version,'2');assert.equal(f.state.outbox.length,0);
});
test('zero-row UPDATE rolls back before history or outbox',async()=>{
  const f=fixture({zeroUpdate:true});await assert.rejects(f.service.change(scope,actor,change),code('VERSION_CONFLICT'));assert.ok(!f.calls.some(c=>c.stage==='history'));
});
for(const field of ['tenantId','workspaceId','environmentId','baselineId'])test(`a ${field} leak in a result row is rejected`,async()=>{
  const f=fixture({row:{[field]:otherId}});await assert.rejects(f.service.change(scope,actor,change),code('STORE_UNAVAILABLE'));assert.equal(f.state.outbox.length,0);
});
for(const field of ['tenantId','workspaceId','environmentId','baselineId','actorId'])test(`a ${field} mismatch in replay evidence is not returned`,async()=>{
  const f=fixture({rows:{receipt:rows=>rows.map(r=>({...r,[field]:otherId}))}});await f.service.change(scope,actor,change);
  await assert.rejects(f.service.change(scope,actor,change),code(field==='baselineId'?'IDEMPOTENCY_CONFLICT':'STORE_UNAVAILABLE'));assert.equal(f.state.outbox.length,1);
});
for(const stage of ['update','history','outbox'])test(`unexpected ${stage} RETURNING data cannot certify a partial write`,async()=>{
  const f=fixture({rows:{[stage]:rows=>rows.map(r=>({...r,...(stage==='update'?{status:'Done'}:{eventId:otherId})}))}});
  await assert.rejects(f.service.change(scope,actor,change),code('STORE_UNAVAILABLE'));assert.equal(f.state.row.version,'1');assert.equal(f.state.outbox.length,0);
});
test('nil/corrupt/unsafe driver versions are not coerced into a valid revision',async()=>{
  for(const version of [1,'01','0','9007199254740992',null]){
    const f=fixture({row:{version}});await assert.rejects(f.service.change(scope,actor,change),code('STORE_UNAVAILABLE'));
  }
});
test('maximum safe JS version cannot overflow on the next mutation',async()=>{
  const f=fixture({row:{version:'9007199254740991'}});await assert.rejects(f.service.change(scope,actor,{...change,expectedVersion:9007199254740991}),code('INVALID_INPUT'));
  assert.equal(f.state.outbox.length,0);
});
test('expired outer request is cancelled before SQL acquisition',async()=>{
  const f=fixture();f.control.abort();await assert.rejects(f.service.change(scope,actor,change),code('CANCELLED'));assert.equal(f.calls.length,0);
});
test('cancellation after the outbox insert still withholds success and rolls back',async()=>{
  const f=fixture({before:(stage,params,c)=>{if(stage==='outbox')c.abort();}});
  await assert.rejects(f.service.change(scope,actor,change),code('CANCELLED'));assert.equal(f.state.outbox.length,0);assert.equal(f.releases.at(-1),true);
});
test('pool acquisition and cleanup errors are redacted',async()=>{
  for(const options of [{connectFailure:true},{releaseFailure:true}])await assert.rejects(fixture(options).service.change(scope,actor,change),code('STORE_UNAVAILABLE'));
});
test('SQL stays parameterized; raw retry keys never enter driver calls or telemetry',async()=>{
  const f=fixture();await f.service.change(scope,actor,change);
  for(const call of f.calls)if(call.sql)for(const id of [...Object.values(scope),actor.id,baselineId])assert.ok(!call.sql.includes(id));
  assert.ok(!JSON.stringify(f.calls).includes(change.idempotencyKey));
  for(const e of f.events){assert.deepEqual(Object.keys(e).sort(),['elapsedMs','result','stage']);assert.ok(Number.isInteger(e.elapsedMs)&&e.elapsedMs>=0);}
  assert.ok(!JSON.stringify(f.events).includes(scope.tenantId));assert.ok(!JSON.stringify(f.events).includes('evidence:'));
});
test('broken telemetry never converts a committed database change into failure',async()=>{
  const f=fixture({observe:()=>{throw Error('log backend down');}});await f.service.change(scope,actor,change);assert.equal(f.state.outbox.length,1);
});
test('returned transaction methods are closed after their callback completes',async()=>{
  const f=fixture();let escaped;await f.repo.transaction(scope,async tx=>{escaped=tx;});const count=f.calls.length;
  await assert.rejects(escaped.findReceipt('a'.repeat(64)),code('TRANSACTION_USAGE'));assert.equal(f.calls.length,count);
});
test('swallowing a transaction method failure cannot commit a partial update',async()=>{
  const f=fixture({rows:{outbox:()=>[]}});await assert.rejects(f.repo.transaction(scope,async tx=>{
    await tx.loadForUpdate(change.id);try{await tx.persist(change,actor,'a'.repeat(64),{id:change.id,status:change.status,version:2,eventId:otherId,intentHash:'b'.repeat(64)});}catch{}
  }),code('TRANSACTION_USAGE'));assert.equal(f.state.outbox.length,0);assert.equal(f.state.row.version,'1');
});
test('wrong actor cannot be attributed to the request-scoped status history',async()=>{
  const f=fixture();await assert.rejects(f.service.change(scope,{id:otherId,permissions:['admin']},change),code('INVALID_INPUT'));assert.equal(f.state.outbox.length,0);
});
test('unknown dependency rows, duplicates and self-dependencies fail closed',async()=>{
  for(const dependencies of [['invalid'],['GOV-001','GOV-001'],['PLT-001']])await assert.rejects(fixture({dependencies}).service.change(scope,actor,change),code('STORE_UNAVAILABLE'));
});
test('mutable request intent is copied before status/history/outbox asynchronous writes',async()=>{
  const c={...change,evidenceRef:'evidence:original'};const f=fixture({before:stage=>{if(stage==='update'){c.status='Done';c.evidenceRef='evidence:changed';c.reasonCode='tampered';}}});
  await f.service.change(scope,actor,c);const history=f.calls.find(c=>c.stage==='history');
  assert.equal(history.params[10],'In progress');assert.equal(history.params[13],'evidence:original');assert.equal(history.params[14],'source_evidence');
});
