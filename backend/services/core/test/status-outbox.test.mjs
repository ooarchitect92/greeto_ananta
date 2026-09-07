import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {STATUS_EVENT,OutboxError,decodeFact,decodeAck,decodeCursor,serializeFact,hashFact,requireTime} from '../../../../.local-build/status-outbox/delivery/status-outbox-contract.js';
import {PostgresStatusOutbox,outboxSql} from '../../../../.local-build/status-outbox/delivery/postgres-status-outbox.js';
import {StatusOutboxRelay} from '../../../../.local-build/status-outbox/delivery/status-outbox-relay.js';

// All identities, PostgreSQL sessions and transport acknowledgements below are
// synthetic test fixtures. These do not certify a real driver, Kafka or database.
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const scope=Object.freeze({tenantId:id(1),workspaceId:id(2),environmentId:id(3)});
const placement=Object.freeze({cellId:'cell-test',placementEpoch:'9007199254740993',environmentKind:'sandbox'});
const workerId=id(4),eventId=id(5),baselineId=id(6),time='2026-09-07T12:00:00.123456Z';
const signal=()=>new AbortController().signal;
const makeFact=(patch={})=>({eventId,eventType:STATUS_EVENT,scope,baselineId,workPackageId:'GOV-001',
  previousStatus:'Not started',status:'In progress',previousVersion:'1',version:'2',occurredAt:time,payloadRef:`delivery-status:${eventId}`,...patch});
const ack=(fact,hash,patch={})=>({result:'committed',eventId:fact.eventId,payloadSha256:hash,acknowledgement:'configured_quorum',transportRef:'test-only/partition-0/offset-1',...patch});
const code=(want)=>error=>error instanceof OutboxError&&error.code===want;

/** Scripted SQL port: transaction-local writes become visible only at COMMIT. */
function fixture(options={}){
  const facts=options.facts??[makeFact()];
  const state={records:new Map(facts.map(f=>[f.eventId,{...scope,eventId:f.eventId,eventType:STATUS_EVENT,payloadRef:f.payloadRef,state:'pending',createdAt:f.occurredAt,publishedAt:null}])),
    facts:new Map(facts.map(f=>[f.eventId,structuredClone(f)])),calls:[],releases:[],connections:0,open:0,marks:0,published:[],observed:[],sqlObserved:[],grants:0};
  const pool={async connect(sig){
    state.connections++;if(options.connectFails)throw new Error('SECRET driver connection');
    if(options.onConnect)await options.onConnect(sig);
    state.open++;let write=false,staged=new Map();
    return {async query(sql,p,sig){
      state.calls.push({sql,p:[...p]});
      if(options.beforeQuery)await options.beforeQuery(sql,p,sig,state);
      if(sql===outboxSql.beginWrite||sql===outboxSql.beginRead){write=sql===outboxSql.beginWrite;return [];}
      if(sql===outboxSql.context)return [];
      if(sql===outboxSql.guard)return [{superuser:false,bypass_rls:false,unsafe_session:false,guarded_tables:'5',...options.guard}];
      if(sql===outboxSql.placementRead||sql===outboxSql.placementWrite)return options.noPlacement?[]:[{...scope,homeCell:placement.cellId,placementEpoch:placement.placementEpoch,state:'active',kind:'sandbox',...options.placementRow}];
      if(sql===outboxSql.pending){
        const rows=[...state.records.values()].filter(r=>r.state==='pending'&&r.eventType===STATUS_EVENT)
          .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.eventId.localeCompare(b.eventId))
          .filter(r=>!p[3]||r.createdAt>p[3]||r.createdAt===p[3]&&r.eventId>p[4])
          .slice(0,Number(p[5])).map(r=>({...scope,eventId:r.eventId,createdAt:r.createdAt}));
        return options.pendingRows??rows;
      }
      if(sql===outboxSql.record||sql===outboxSql.record+' FOR UPDATE'){
        const row=staged.get(p[3])??state.records.get(p[3]);
        const rows=row?[structuredClone(row)]:[];
        return options.recordRows?options.recordRows(rows):rows;
      }
      if(sql===outboxSql.history||sql===outboxSql.history+' FOR SHARE'){
        const f=state.facts.get(p[3]);
        const rows=f?[{...f.scope,eventId:f.eventId,baselineId:f.baselineId,workPackageId:f.workPackageId,previousStatus:f.previousStatus,
          status:f.status,previousVersion:f.previousVersion,version:f.version,occurredAt:f.occurredAt}]:[];
        return options.historyRows?options.historyRows(rows):rows;
      }
      if(sql===outboxSql.mark){
        assert.equal(write,true);state.marks++;
        const r=state.records.get(p[3]);if(!r||r.state!=='pending'||r.payloadRef!==p[4])return [];
        staged.set(p[3],{...r,state:'published',publishedAt:'2026-09-07T12:01:00.000001Z'});
        return options.markRows??[{eventId:p[3]}];
      }
      if(sql===outboxSql.commit){
        if(options.beforeCommit)await options.beforeCommit({write,staged,state,sig});
        for(const [id,row]of staged)state.records.set(id,row);staged.clear();
        if(write&&options.lostCommit)throw new Error('SECRET commit disconnected after success');
        return [];
      }
      if(sql===outboxSql.rollback){staged.clear();if(options.rollbackFails)throw new Error('SECRET rollback');return [];}
      throw new Error('Unexpected scripted SQL');
    },release(discard){state.open--;state.releases.push(discard);if(options.releaseFails)throw new Error('SECRET pool');}};
  }};
  const store=new PostgresStatusOutbox(pool,{scope,placement,observe:e=>state.sqlObserved.push(e)});
  const transport={async publish(fact,hash,route,sig){
    assert.equal(state.open,0,'No SQL transaction/lease is held across publication');
    state.published.push({fact,hash,route});
    if(options.publish)return options.publish(fact,hash,route,sig,state);
    return ack(fact,hash);
  }};
  const authority={async requirePublish(worker,sc,sig){
    state.grants++;assert.equal(worker,workerId);assert.deepEqual(sc,scope);
    if(options.authorize)return options.authorize(worker,sc,sig,state);
  }};
  const relay=new StatusOutboxRelay(store,transport,authority,{workerId,pageSize:options.pageSize??2,
    deadlineMs:options.deadlineMs??5000,observe:options.observe??(e=>state.observed.push(e))});
  return {state,pool,store,relay,authority,transport};
}

test('canonical fact serialization is stable and minimized',async()=>{
  const raw=makeFact(),f=decodeFact(raw);
  const reordered=Object.fromEntries(Object.entries(raw).reverse());
  assert.equal(serializeFact(f),serializeFact(reordered));
  assert.equal(await hashFact(f),createHash('sha256').update(serializeFact(f),'utf8').digest('hex'));
  assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.scope));
  assert.equal(Object.hasOwn(f,'actorId'),false);
  assert.equal(Object.hasOwn(f,'evidenceRef'),false);
});
test('exact bigint versions remain strings beyond Number precision',()=>{
  const f=decodeFact(makeFact({previousVersion:'9007199254740993',version:'9007199254740994'}));
  assert.equal(f.previousVersion,'9007199254740993');assert.equal(f.version,'9007199254740994');
});
test('unsupported, nonadjacent, extra-field and credential-shaped facts are rejected',()=>{
  for(const patch of [{eventType:'message.delivered'},{version:'4'},{version:2},{previousVersion:'0'},
    {previousVersion:'9223372036854775807',version:'9223372036854775808'},{payloadRef:'https://example.test/secret'},
    {workPackageId:'../../secret'},{status:'Ready'},{access_token:'SECRET'}])assert.throws(()=>decodeFact(makeFact(patch)));
});
test('timestamps validate actual dates and retain six-digit precision',()=>{
  assert.equal(requireTime(time),time);
  assert.equal(decodeCursor({eventId,createdAt:time}).createdAt,time);
  for(const t of ['2026-02-30T12:00:00.000000Z','2026-09-07T24:00:00.000000Z','2026-09-07T12:00:00.123Z',
    '2026-09-07T12:00:00.000000+00:00'])assert.throws(()=>requireTime(t));
});
test('ACK requires exact identity, hash, configured-quorum and a bounded reference',()=>{
  const a=ack(makeFact(),'a'.repeat(64));assert.deepEqual(decodeAck(a),a);
  for(const patch of [{acknowledgement:'leader_only'},{eventId:'nil'},{payloadSha256:'xx'},{transportRef:'bad\nsecret'},{fake:true}])
    assert.throws(()=>decodeAck({...a,...patch}),code('ACK_INVALID'));
});
test('SQL pool and relay reject invalid configuration without work',()=>{
  const f=fixture();
  assert.throws(()=>new PostgresStatusOutbox(f.pool,{scope,placement,timeoutMs:0}),code('CONFIGURATION'));
  assert.throws(()=>new StatusOutboxRelay(f.store,f.transport,f.authority,{workerId,pageSize:101}),code('CONFIGURATION'));
  assert.equal(f.state.connections,0);
});
test('load returns only a committed scoped fact, with no open lease',async()=>{
  const {store,state}=fixture();const result=await store.load(eventId,signal());
  assert.equal(result.state,'pending');assert.equal(result.payloadSha256,await hashFact(makeFact()));
  assert.deepEqual(state.releases,[false]);assert.equal(state.calls.at(-1).sql,'COMMIT');
});
test('each SQL transaction sets all scope dimensions with parameters',async()=>{
  const {store,state}=fixture();await store.load(eventId,signal());
  const settings=state.calls.find(c=>c.sql===outboxSql.context);
  assert.deepEqual(settings.p.slice(0,3),Object.values(scope));
  assert.ok(outboxSql.context.includes("set_config('app.environment_id',$3,true)"));
  for(const q of [outboxSql.pending,outboxSql.record,outboxSql.history,outboxSql.mark]){
    for(const name of ['tenant_id=$1::uuid','workspace_id=$2::uuid','environment_id=$3::uuid'])assert.ok(q.includes(name));
  }
});
test('unsafe role or missing FORCE RLS diagnostics block lookup',async()=>{
  for(const guard of [{superuser:true},{bypass_rls:true},{unsafe_session:true},{guarded_tables:'4'}]){
    const {store,state}=fixture({guard});await assert.rejects(store.load(eventId,signal()),code('CONFIGURATION'));
    assert.equal(state.calls.some(c=>c.sql===outboxSql.record),false);assert.deepEqual(state.releases,[true]);
  }
});
test('wrong cell, epoch or environment fail before record lookup',async()=>{
  for(const placementRow of [{homeCell:'other-cell'},{placementEpoch:'9007199254740994'},{kind:'production'}]){
    const {store}=fixture({placementRow});await assert.rejects(store.load(eventId,signal()),code('PLACEMENT_MISMATCH'));
  }
});
test('inactive tenant blocks source and publication marking',async()=>{
  for(const state of ['suspended','provisioning','erasing']){
    const f=fixture({placementRow:{state}});
    await assert.rejects(f.store.load(eventId,signal()),code('SCOPE_INACTIVE'));
    await assert.rejects(f.store.confirmPublished(ack(makeFact(),await hashFact(makeFact())),signal()),code('SCOPE_INACTIVE'));
    assert.equal(f.state.marks,0);
  }
});
test('cross-scope row data is suppressed',async()=>{
  const {store}=fixture({recordRows:rows=>rows.map(r=>({...r,tenantId:id(99)}))});
  await assert.rejects(store.load(eventId,signal()),code('SCOPE_UNAVAILABLE'));
});
test('missing event is null but missing history is unresolved, not silently dropped',async()=>{
  const f=fixture();assert.equal(await f.store.load(id(999),signal()),null);
  f.state.facts.delete(eventId);await assert.rejects(f.store.load(eventId,signal()),code('FACT_UNRESOLVED'));
  assert.equal(f.state.records.get(eventId).state,'pending');
});
test('history ID and object scope cannot be swapped',async()=>{
  for(const patch of [{eventId:id(70)},{workspaceId:id(70)},{environmentId:id(70)}]){
    const f=fixture({historyRows:rows=>rows.map(r=>({...r,...patch}))});
    await assert.rejects(f.store.load(eventId,signal()));assert.equal(f.state.marks,0);
  }
});
test('malformed or unsupported outbox rows are retained',async()=>{
  for(const patch of [{eventType:'unsupported'},{payloadRef:'other'},{state:'deleted'},{state:new String('pending')},{publishedAt:time}]){
    const f=fixture({recordRows:rows=>rows.map(r=>({...r,...patch}))});
    await assert.rejects(f.store.load(eventId,signal()),code('FACT_UNRESOLVED'));
    assert.equal(f.state.records.get(eventId).state,'pending');
  }
});
test('pending pagination preserves events within one millisecond',async()=>{
  const facts=[1,2,3].map(n=>makeFact({eventId:id(n+20),payloadRef:`delivery-status:${id(n+20)}`,occurredAt:`2026-09-07T12:00:00.12345${n}Z`}));
  const {store}=fixture({facts});const page=await store.listPending(null,2,signal());
  assert.deepEqual(page.entries.map(e=>e.eventId),[id(21),id(22)]);assert.equal(page.next.createdAt,facts[1].occurredAt);
  const last=await store.listPending(page.next,2,signal());
  assert.deepEqual(last.entries.map(e=>e.eventId),[id(23)]);assert.equal(last.next,null);
});
test('same-timestamp cursor uses UUID tie-break without duplicating rows',async()=>{
  const facts=[30,31,32].map(n=>makeFact({eventId:id(n),payloadRef:`delivery-status:${id(n)}`}));
  const {store}=fixture({facts});const a=await store.listPending(null,2,signal());
  const b=await store.listPending(a.next,2,signal());assert.deepEqual(b.entries.map(e=>e.eventId),[id(32)]);
});
test('pending limits and cursors reject unbounded or malformed inputs before connect',async()=>{
  const {store,state}=fixture();
  for(const limit of [0,101,1.5,Infinity])await assert.rejects(store.listPending(null,limit,signal()),code('INVALID_INPUT'));
  await assert.rejects(store.listPending({eventId,createdAt:time,extra:true},2,signal()),code('INVALID_INPUT'));
  assert.equal(state.connections,0);
});
test('pending rows reject cross-scope, duplicates and out-of-order results',async()=>{
  const row={...scope,eventId,createdAt:time};
  for(const pendingRows of [[{...row,tenantId:id(99)}],[row,row],[{...row,eventId:id(60)},row]]){
    const {store}=fixture({pendingRows});await assert.rejects(store.listPending(null,2,signal()));
  }
});
test('transport ACK is followed by a separate marker transaction and commit',async()=>{
  const {relay,state}=fixture();const r=await relay.relayOne(eventId,signal());
  assert.equal(r.state,'published');assert.equal(r.transport,'committed');assert.equal(r.marker,'committed');
  assert.equal(state.records.get(eventId).state,'published');assert.equal(state.connections,2);
  assert.equal(state.grants,3);assert.deepEqual(state.releases,[false,false]);
  const markAt=state.calls.findIndex(c=>c.sql===outboxSql.mark);
  assert.ok(state.calls.slice(markAt).some(c=>c.sql==='COMMIT'));
});
test('authorization denial precedes every database and transport operation',async()=>{
  const {relay,state}=fixture({authorize:async()=>{throw new Error('SECRET denial');}});
  await assert.rejects(relay.relayOne(eventId,signal()),code('AUTHORIZATION_UNAVAILABLE'));
  await assert.rejects(relay.runPage(null,signal()),code('AUTHORIZATION_UNAVAILABLE'));
  assert.equal(state.connections,0);assert.equal(state.published.length,0);
});
test('revocation after publication stops the marker write',async()=>{
  const {relay,state}=fixture({authorize:async(_w,_s,_sig,st)=>{if(st.grants>2)throw new Error('revoked');}});
  const r=await relay.relayOne(eventId,signal());assert.equal(r.state,'pending');
  assert.equal(r.transport,'committed');assert.equal(state.marks,0);
});
test('a published record is idempotently observed without publishing again',async()=>{
  const f=fixture();await f.relay.relayOne(eventId,signal());const again=await f.relay.relayOne(eventId,signal());
  assert.equal(again.state,'already_published');assert.equal(f.state.published.length,1);
});
test('duplicate marker ACK does not update twice',async()=>{
  const f=fixture();const a=ack(makeFact(),await hashFact(makeFact()));
  await f.store.confirmPublished(a,signal());await f.store.confirmPublished(a,signal());assert.equal(f.state.marks,1);
});
test('rejected transport leaves the row pending and exposes the refusal',async()=>{
  const f=fixture({publish:async()=>({result:'rejected'})});const r=await f.relay.relayOne(eventId,signal());
  assert.equal(r.reasonCode,'TRANSPORT_REJECTED');assert.equal(r.transport,'rejected');assert.equal(f.state.marks,0);
  assert.ok(f.state.observed.some(e=>e.stage==='publish'&&e.result==='failed'));
});
test('unknown transport result is not recorded as a successful publish stage',async()=>{
  const f=fixture({publish:async()=>({result:'unknown'})});const r=await f.relay.relayOne(eventId,signal());
  assert.equal(r.transport,'unknown');assert.equal(f.state.marks,0);
  assert.ok(f.state.observed.some(e=>e.stage==='publish'&&e.result==='unknown'));
  assert.equal(f.state.observed.some(e=>e.stage==='publish'&&e.result==='succeeded'),false);
});
test('a lost transport ACK retries the same event and same payload hash',async()=>{
  let first=true;
  const f=fixture({publish:async(fact,hash)=>{if(first){first=false;throw new Error('SECRET network response lost');}return ack(fact,hash);}});
  assert.equal((await f.relay.relayOne(eventId,signal())).state,'pending');
  assert.equal((await f.relay.relayOne(eventId,signal())).state,'published');
  assert.equal(f.state.published.length,2);
  assert.deepEqual(f.state.published[0],f.state.published[1]);assert.equal(f.state.marks,1);
});
test('mismatched event, content hash and weak ACK never mark publication',async()=>{
  for(const patch of [{eventId:id(77)},{payloadSha256:'a'.repeat(64)},{acknowledgement:'leader_only'}]){
    const f=fixture({publish:async(fact,hash)=>ack(fact,hash,patch)});
    const r=await f.relay.relayOne(eventId,signal());assert.equal(r.state,'pending');assert.equal(f.state.marks,0);
  }
});
test('changing history during publication cannot acknowledge a different fact',async()=>{
  const f=fixture({publish:async(fact,hash,_p,_sig,state)=>{
    state.facts.get(eventId).workPackageId='GOV-002';return ack(fact,hash);
  }});
  const r=await f.relay.relayOne(eventId,signal());
  assert.equal(r.reasonCode,'FACT_CHANGED');assert.equal(r.transport,'committed');assert.equal(f.state.marks,0);
});
test('mark locks both the outbox row and its history until commit',async()=>{
  const f=fixture();await f.relay.relayOne(eventId,signal());
  assert.ok(f.state.calls.some(c=>c.sql===outboxSql.record+' FOR UPDATE'));
  assert.ok(f.state.calls.some(c=>c.sql===outboxSql.history+' FOR SHARE'));
});
test('failure before SQL marker COMMIT leaves the row pending',async()=>{
  const f=fixture({beforeCommit:async({write})=>{if(write)throw new Error('SECRET commit not reached');}});
  const r=await f.relay.relayOne(eventId,signal());
  assert.equal(r.marker,'unknown');assert.equal(f.state.records.get(eventId).state,'pending');
  assert.equal(f.state.releases.at(-1),true);
});
test('lost marker COMMIT ACK recovers without republishing an observed published row',async()=>{
  const f=fixture({lostCommit:true});const a=await f.relay.relayOne(eventId,signal());
  assert.equal(a.reasonCode,'MARK_UNCONFIRMED');assert.equal(f.state.records.get(eventId).state,'published');
  const b=await f.relay.relayOne(eventId,signal());assert.equal(b.state,'already_published');
  assert.equal(f.state.published.length,1);assert.ok(f.state.sqlObserved.some(e=>e.stage==='commit'&&e.result==='unknown'));
});
test('invalid mark result rolls back and discards its connection',async()=>{
  const f=fixture({markRows:[{eventId:id(99)}]});const a=ack(makeFact(),await hashFact(makeFact()));
  await assert.rejects(f.store.confirmPublished(a,signal()),code('STORE_UNAVAILABLE'));
  assert.equal(f.state.records.get(eventId).state,'pending');assert.deepEqual(f.state.releases,[true]);
});
test('scope can be suspended between read and marker transaction',async()=>{
  const options={};const f=fixture(options);
  options.publish=async(fact,hash)=>{options.placementRow={state:'suspended'};return ack(fact,hash);};
  const r=await f.relay.relayOne(eventId,signal());assert.equal(r.marker,'unknown');assert.equal(f.state.marks,0);
});
test('pre-cancellation prevents any connection or publication',async()=>{
  const f=fixture();const c=new AbortController();c.abort();
  await assert.rejects(f.relay.relayOne(eventId,c.signal),code('CANCELLED'));
  await assert.rejects(f.store.load(eventId,c.signal),code('CANCELLED'));assert.equal(f.state.connections,0);
});
test('cancellation after lease acquisition discards the lease',async()=>{
  const c=new AbortController();const f=fixture({onConnect:async()=>c.abort()});
  await assert.rejects(f.store.load(eventId,c.signal),code('CANCELLED'));assert.deepEqual(f.state.releases,[true]);
});
test('cancellation after possible publication is unknown, never marked',async()=>{
  const c=new AbortController();const f=fixture({publish:async(fact,hash)=>{c.abort();return ack(fact,hash);}});
  const r=await f.relay.relayOne(eventId,c.signal);assert.equal(r.transport,'unknown');assert.equal(f.state.marks,0);
});
test('read COMMIT failure does not return an apparently durable fact',async()=>{
  const f=fixture({beforeCommit:async()=>{throw new Error('SECRET read response');}});
  await assert.rejects(f.store.load(eventId,signal()),code('STORE_UNAVAILABLE'));
});
test('rollback and pool failures never leak underlying error messages',async()=>{
  const f=fixture({guard:{superuser:true},rollbackFails:true,releaseFails:true});
  await assert.rejects(f.store.load(eventId,signal()),e=>e.message==='STORE_UNAVAILABLE'&&!e.message.includes('SECRET'));
  assert.equal(f.state.releases.length,1);
});
test('broken telemetry cannot change the durable result',async()=>{
  const f=fixture({observe:()=>{throw new Error('SECRET logger');}});
  assert.equal((await f.relay.relayOne(eventId,signal())).state,'published');
});
test('diagnostic events have bounded names and correlation but no raw data',async()=>{
  const f=fixture();await f.relay.relayOne(eventId,signal());
  for(const e of f.state.observed){assert.match(e.operationId,/^[0-9a-f-]{36}$/);assert.ok(Number.isInteger(e.elapsedMs)&&e.elapsedMs>=0);
    for(const k of Object.keys(e))assert.ok(['operationId','eventId','stage','result','elapsedMs'].includes(k));}
  for(const e of f.state.sqlObserved)for(const k of Object.keys(e))assert.ok(['stage','result','elapsedMs'].includes(k));
  assert.ok(!JSON.stringify([...f.state.observed,...f.state.sqlObserved]).includes(baselineId));
});
test('one bounded page can progress a later event despite an unresolved predecessor in the scan',async()=>{
  const a=makeFact(),b=makeFact({eventId:id(7),payloadRef:`delivery-status:${id(7)}`});
  const f=fixture({facts:[a,b],pageSize:1});f.state.facts.delete(eventId);
  const first=await f.relay.runPage(null,signal());assert.equal(first.results[0].state,'blocked');assert.ok(first.next);
  const last=await f.relay.runPage(first.next,signal());assert.equal(last.results[0].state,'published');assert.equal(last.next,null);
  f.state.facts.set(eventId,a);
  const sweep=await f.relay.runPage(null,signal());assert.equal(sweep.results[0].state,'published');
});
test('a new sweep finds an earlier timestamp committed after a prior scan',async()=>{
  const f=fixture();await f.relay.runPage(null,signal());
  const late=makeFact({eventId:id(20),payloadRef:`delivery-status:${id(20)}`,occurredAt:'2026-09-07T11:00:00.000001Z'});
  f.state.facts.set(late.eventId,late);f.state.records.set(late.eventId,{...scope,eventId:late.eventId,eventType:STATUS_EVENT,payloadRef:late.payloadRef,state:'pending',createdAt:late.occurredAt,publishedAt:null});
  const sweep=await f.relay.runPage(null,signal());assert.equal(sweep.results[0].eventId,late.eventId);
});
test('relay instance rejects concurrent work instead of building an unbounded queue',async()=>{
  let release;const gate=new Promise(r=>release=r);
  const f=fixture({publish:async(fact,hash)=>{await gate;return ack(fact,hash);}});
  const first=f.relay.relayOne(eventId,signal());
  await assert.rejects(f.relay.runPage(null,signal()),code('BUSY'));
  release();assert.equal((await first).state,'published');assert.equal(f.state.published.length,1);
});
test('two independent workers can emit duplicate facts without creating a new logical ID',async()=>{
  const f=fixture();let ready=0,release;const gate=new Promise(r=>release=r);
  const transport={async publish(fact,hash){ready++;if(ready===2)release();await gate;f.state.published.push({fact,hash});return ack(fact,hash);}};
  const a=new StatusOutboxRelay(f.store,transport,f.authority,{workerId});
  const b=new StatusOutboxRelay(f.store,transport,f.authority,{workerId});
  await Promise.all([a.relayOne(eventId,signal()),b.relayOne(eventId,signal())]);
  assert.equal(f.state.published.length,2);assert.equal(f.state.published[0].fact.eventId,f.state.published[1].fact.eventId);
  assert.equal(f.state.published[0].hash,f.state.published[1].hash);
  assert.equal(f.state.records.get(eventId).state,'published');
});
test('malformed store page is rejected before any event is published',async()=>{
  const f=fixture();const store={scope,placement,listPending:async()=>({entries:[],next:{createdAt:time,eventId}}),
    load:f.store.load.bind(f.store),confirmPublished:f.store.confirmPublished.bind(f.store)};
  const relay=new StatusOutboxRelay(store,f.transport,f.authority,{workerId});
  await assert.rejects(relay.runPage(null,signal()),code('STORE_UNAVAILABLE'));assert.equal(f.state.published.length,0);
});
test('host-owned identity values are copied before async work',async()=>{
  const f=fixture();const mutable={...scope};const store={...f.store,scope:mutable,placement,
    load:f.store.load.bind(f.store),confirmPublished:f.store.confirmPublished.bind(f.store)};
  const relay=new StatusOutboxRelay(store,f.transport,f.authority,{workerId});
  mutable.tenantId=id(77);assert.equal((await relay.relayOne(eventId,signal())).state,'published');
});

test('revocation while resolving a fact prevents its transport publication',async()=>{
  const f=fixture({authorize:async(_w,_s,_sig,state)=>{if(state.grants>1)throw new Error('revoked');}});
  const result=await f.relay.relayOne(eventId,signal());
  assert.equal(result.state,'blocked');assert.equal(f.state.published.length,0);
});
test('SQL driver sees and settles a real deadline signal before session release',async()=>{
  let observedAbort=false;
  const f=fixture({beforeQuery:async(sql,_p,sig)=>{
    if(sql===outboxSql.record){
      await new Promise(resolve=>{const timer=setTimeout(resolve,200);sig.addEventListener('abort',()=>{observedAbort=true;clearTimeout(timer);resolve();},{once:true});});
      if(sig.aborted)throw new Error('SECRET cancelled protocol settled');
    }
  }});
  const store=new PostgresStatusOutbox(f.pool,{scope,placement,timeoutMs:100});
  await assert.rejects(store.load(eventId,signal()),code('STORE_UNAVAILABLE'));
  assert.equal(observedAbort,true);assert.equal(f.state.open,0);assert.deepEqual(f.state.releases,[true]);
});
