import test from 'node:test';
import assert from 'node:assert/strict';
import { TenantScopeService, ScopeError, parseTenantScope, parseScopeSnapshot } from '../../../../.local-build/tenant-scope/tenant-scope.js';
import { PostgresScopeReader, scopeSql } from '../../../../.local-build/tenant-scope/postgres-scope-reader.js';

// Scripted ports only: no assertion here is a live PostgreSQL/RLS or OIDC test.
const scope = Object.freeze({tenantId:'11111111-1111-4111-8111-111111111111', workspaceId:'22222222-2222-4222-8222-222222222222', environmentId:'33333333-3333-4333-8333-333333333333'});
const principal = {id:'44444444-4444-4444-8444-444444444444'};
const binding = {cellId:'cell-a',placementEpoch:'9007199254740993',environmentKind:'sandbox'};
const snapshot = Object.freeze({...scope,homeCell:binding.cellId,placementEpoch:binding.placementEpoch,state:'active',kind:'sandbox'});
const signal = () => new AbortController().signal;
const code = expected => error => error instanceof ScopeError && error.code === expected;
const otherId = '55555555-5555-4555-8555-555555555555';
function domain({deny=false,row=snapshot,failRead=false,onGrant=()=>{}}={}) {
  const calls=[];
  return {calls,service:new TenantScopeService({async require(actor,tuple,permission,sig){calls.push(['grant',actor,tuple,permission]);onGrant();if(deny)throw new Error('secret provider detail');}},
    {async read(tuple,sig){calls.push(['read',tuple]);if(failRead)throw new Error('password=do-not-expose');return row;}})};
}
function pool({rows=[snapshot],guard={superuser:false,bypass_rls:false,unsafe_session:false,guarded_tables:'3'},failAt=null,rollbackFails=false,onQuery=()=>{},releaseFails=false}={}) {
  const calls=[], releases=[];
  return {calls,releases,async connect(sig){calls.push(['connect']);return {
    async query(sql,params,sig){calls.push([sql,[...params]]);onQuery(sql,params);
      if(sql===failAt || (rollbackFails && sql===scopeSql.rollback))throw new Error('sensitive SQL failure');
      if(sql===scopeSql.guard)return [guard];if(sql===scopeSql.lookup)return rows;return [];
    },release(discard){releases.push(discard);if(releaseFails)throw new Error('driver cleanup secret');}
  };}};
}

test('normalization creates frozen independent lowercase scope without granting access',()=>{
  const input={...scope,tenantId:'AAAA1111-1111-4111-8111-111111111111'};const out=parseTenantScope(input);
  assert.equal(out.tenantId,input.tenantId.toLowerCase());assert.ok(Object.isFrozen(out));input.workspaceId=otherId;assert.equal(out.workspaceId,scope.workspaceId);
});
for(const input of [null,[],{}, {...scope,extra:true}, {...scope,tenantId:1}, {...scope,environmentId:'00000000-0000-0000-0000-000000000000'}, {...scope,workspaceId:"';DROP TABLE tenants;--"}]) {
  test(`invalid scope rejected: ${JSON.stringify(input)}`,()=>assert.throws(()=>parseTenantScope(input),code('INVALID_SCOPE')));
}
test('inherited IDs are not accepted as own scope fields',()=>assert.throws(()=>parseTenantScope(Object.create(scope)),code('INVALID_SCOPE')));
for(const epoch of ['0','01','-1','9223372036854775808',9007199254740993]) {
  test(`unsafe epoch rejected: ${epoch}`,()=>assert.throws(()=>parseScopeSnapshot({...snapshot,placementEpoch:epoch}),code('STORE_UNAVAILABLE')));
}
test('signed bigint maximum is preserved losslessly as a string',()=>assert.equal(parseScopeSnapshot({...snapshot,placementEpoch:'9223372036854775807'}).placementEpoch,'9223372036854775807'));
test('unknown state and extra adapter data fail closed',()=>{
  assert.throws(()=>parseScopeSnapshot({...snapshot,state:'ready'}),code('STORE_UNAVAILABLE'));
  assert.throws(()=>parseScopeSnapshot({...snapshot,token:'do-not-copy'}),code('STORE_UNAVAILABLE'));
});
test('grant precedes lookup, ignores caller claimed permission array',async()=>{
  const {service,calls}=domain();const result=await service.inspect({...principal,permissions:['admin']},scope,binding,signal());
  assert.equal(result.state,'active');assert.deepEqual(calls.map(c=>c[0]),['grant','read']);assert.equal(calls[0][3],'platform.scope.read');assert.deepEqual(calls[0][1],principal);
});
test('denied grants prevent all storage reads and expose neutral errors',async()=>{
  const {service,calls}=domain({deny:true});await assert.rejects(service.inspect(principal,scope,binding,signal()),code('SCOPE_UNAVAILABLE'));assert.equal(calls.length,1);
});
test('missing row and denied scope share one error code',async()=>{
  await assert.rejects(domain({row:null}).service.inspect(principal,scope,binding,signal()),code('SCOPE_UNAVAILABLE'));
});
for(const key of Object.keys(scope))test(`cross-scope ${key} never returned`,async()=>{
  await assert.rejects(domain({row:{...snapshot,[key]:otherId}}).service.inspect(principal,scope,binding,signal()),code('SCOPE_UNAVAILABLE'));
});
for(const [key,value] of [['cellId','cell-b'],['placementEpoch','2'],['environmentKind','production']])test(`placement mismatch ${key}`,async()=>{
  await assert.rejects(domain().service.inspect(principal,scope,{...binding,[key]:value},signal()),code('PLACEMENT_MISMATCH'));
});
for(const state of ['provisioning','suspended','erasing'])test(`${state} can be inspected but cannot authorize a status write`,async()=>{
  const {service,calls}=domain({row:{...snapshot,state}});assert.equal((await service.inspect(principal,scope,binding,signal())).state,state);
  await assert.rejects(service.requireStatusWrite(principal,scope,binding,signal()),code('SCOPE_INACTIVE'));assert.equal(calls.at(-2)[3],'delivery.status.write');
});
test('active tenant is not automatically a provider action permission',async()=>{
  const {service,calls}=domain();await service.requireStatusWrite(principal,scope,binding,signal());assert.equal(calls[0][3],'delivery.status.write');assert.equal(calls.length,2);
});
test('pre-cancelled scope call does not touch grant or store ports',async()=>{
  const controller=new AbortController();controller.abort();const {service,calls}=domain();await assert.rejects(service.inspect(principal,scope,binding,controller.signal),code('CANCELLED'));assert.deepEqual(calls,[]);
});
test('cancellation after grant prevents store access',async()=>{
  const controller=new AbortController();const {service,calls}=domain({onGrant:()=>controller.abort()});await assert.rejects(service.inspect(principal,scope,binding,controller.signal),code('CANCELLED'));assert.equal(calls.length,1);
});
test('mutable placement cannot be swapped during authorization',async()=>{
  const copy={...binding};const {service}=domain({onGrant:()=>{copy.cellId='cell-b';}});assert.equal((await service.inspect(principal,scope,copy,signal())).homeCell,'cell-a');
});
test('unexpected database errors are redacted',async()=>await assert.rejects(domain({failRead:true}).service.inspect(principal,scope,binding,signal()),code('STORE_UNAVAILABLE')));

test('SQL adapter uses read-only transaction, local scope, role guard, exact join and commit order',async()=>{
  const p=pool();const result=await new PostgresScopeReader(p).read(scope,signal());assert.deepEqual(result,snapshot);
  assert.deepEqual(p.calls.map(c=>c[0]),['connect',scopeSql.begin,scopeSql.context,scopeSql.guard,scopeSql.lookup,scopeSql.commit]);
  assert.deepEqual(p.calls[2][1],[scope.tenantId,scope.workspaceId,scope.environmentId,'3000ms']);assert.deepEqual(p.calls[4][1],Object.values(scope));assert.deepEqual(p.releases,[false]);
});
test('query strings never contain bound scope UUIDs',async()=>{
  const p=pool();await new PostgresScopeReader(p).read(scope,signal());for(const [sql]of p.calls)for(const id of Object.values(scope))assert.ok(!sql.includes(id));
});
test('two sequential tenants receive separate BEGIN/context/COMMIT sequences',async()=>{
  const p1=pool(),p2=pool({rows:[{...snapshot,tenantId:otherId}]});await new PostgresScopeReader(p1).read(scope,signal());await new PostgresScopeReader(p2).read({...scope,tenantId:otherId},signal());
  assert.notEqual(p1.calls[2][1][0],p2.calls[2][1][0]);assert.deepEqual(p1.releases,[false]);assert.deepEqual(p2.releases,[false]);
});
for(const patch of [{superuser:true},{bypass_rls:true},{unsafe_session:true},{guarded_tables:'2'},{guarded_tables:3}])test(`unsafe/missing database guard rejected: ${JSON.stringify(patch)}`,async()=>{
  const p=pool({guard:{superuser:false,bypass_rls:false,unsafe_session:false,guarded_tables:'3',...patch}});
  await assert.rejects(new PostgresScopeReader(p).read(scope,signal()),code('STORE_CONFIGURATION'));assert.ok(!p.calls.some(c=>c[0]===scopeSql.lookup));assert.equal(p.calls.at(-1)[0],scopeSql.rollback);assert.deepEqual(p.releases,[true]);
});
for(const sql of [scopeSql.begin,scopeSql.context,scopeSql.guard,scopeSql.lookup,scopeSql.commit])test(`SQL failure at ${sql.split(/\s/)[0]} is not success`,async()=>{
  const p=pool({failAt:sql});await assert.rejects(new PostgresScopeReader(p).read(scope,signal()),code('STORE_UNAVAILABLE'));assert.equal(p.calls.at(-1)[0],scopeSql.rollback);assert.deepEqual(p.releases,[true]);
});
test('failed rollback still destroys session exactly once',async()=>{
  const p=pool({failAt:scopeSql.lookup,rollbackFails:true});await assert.rejects(new PostgresScopeReader(p).read(scope,signal()),code('STORE_UNAVAILABLE'));assert.deepEqual(p.releases,[true]);
});
test('release failure cannot leak driver details or return successful result',async()=>{
  const p=pool({releaseFails:true});await assert.rejects(new PostgresScopeReader(p).read(scope,signal()),code('STORE_UNAVAILABLE'));assert.equal(p.releases.length,1);
});
test('scope not found commits read-only lookup and returns null',async()=>{
  const p=pool({rows:[]});assert.equal(await new PostgresScopeReader(p).read(scope,signal()),null);assert.equal(p.calls.at(-1)[0],scopeSql.commit);
});
for(const rows of [[snapshot,snapshot],[{...snapshot,tenantId:otherId}],[{...snapshot,placementEpoch:2}]])test('invalid/multiple/out-of-scope rows are rejected and not committed',async()=>{
  const p=pool({rows});await assert.rejects(new PostgresScopeReader(p).read(scope,signal()),code('STORE_UNAVAILABLE'));assert.ok(!p.calls.some(c=>c[0]===scopeSql.commit));assert.deepEqual(p.releases,[true]);
});
test('cancelled query rolls back with independent cleanup signal',async()=>{
  const controller=new AbortController();const p=pool({onQuery:sql=>{if(sql===scopeSql.lookup)controller.abort();}});
  await assert.rejects(new PostgresScopeReader(p).read(scope,controller.signal),code('CANCELLED'));assert.equal(p.calls.at(-1)[0],scopeSql.rollback);assert.deepEqual(p.releases,[true]);
});
test('failed pool acquisition is redacted without a fake release',async()=>{
  await assert.rejects(new PostgresScopeReader({async connect(){throw new Error('credential leak');}}).read(scope,signal()),code('STORE_UNAVAILABLE'));
});
test('unsafe query deadlines are rejected without database I/O',()=>{
  for(const value of [0,99,5001,1.5,NaN])assert.throws(()=>new PostgresScopeReader(pool(),value),code('STORE_CONFIGURATION'));
});
