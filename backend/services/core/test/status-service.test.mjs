import test from 'node:test';
import assert from 'node:assert/strict';
import {StatusService} from '../../../../.local-build/core/status-service.js';
// In-memory ports exist only here. They test the domain rules, not PostgreSQL RLS.
const scope={tenantId:'00000000-0000-0000-0000-000000000001',workspaceId:'00000000-0000-0000-0000-000000000002',environmentId:'00000000-0000-0000-0000-000000000003'};
const actor={id:'00000000-0000-0000-0000-000000000004',permissions:[]};
function fixture(status='Not started') {
 const state={current:{id:'GOV-001',status,version:1,predecessors:[]},receipts:new Map(),writes:0,parents:true,denied:false,proof:true,proofFails:false};
 const tx={findReceipt:async key=>state.receipts.get(key)||null,loadForUpdate:async()=>state.current,predecessorsVerified:async()=>state.parents,
 persist:async(change,who,key,receipt)=>{state.writes++;state.receipts.set(key,receipt);state.current={...state.current,status:change.status,version:receipt.version};}};
 const repo={findReceipt:async(s,key)=>tx.findReceipt(key),transaction:async(s,fn)=>fn(tx)};
 const auth={require:async()=>{if(state.denied)throw new Error('DENIED');}};
 const verifier={verify:async()=>{if(state.proofFails)throw new Error('unavailable');return {implementation:state.proof,automatedAcceptance:state.proof,securityReview:state.proof,documentation:state.proof,rolloutRollback:state.proof,externalApprovals:state.proof};}};
 return {state,service:new StatusService(repo,auth,verifier)};
}
const intent=(status='In progress')=>({id:'GOV-001',status,expectedVersion:1,idempotencyKey:'stable-key-123456789',reasonCode:'implementation_started'});
test('authorized transition returns a durable-port receipt',async()=>{const {state,service}=fixture();const r=await service.change(scope,actor,intent());assert.equal(r.version,2);assert.equal(state.writes,1);});
test('identical retry returns the same event and does not write twice',async()=>{const {state,service}=fixture();const a=await service.change(scope,actor,intent());const b=await service.change(scope,actor,intent());assert.deepEqual(a,b);assert.equal(state.writes,1);});
test('same key with a changed intent is a conflict',async()=>{const {service}=fixture();await service.change(scope,actor,intent());await assert.rejects(()=>service.change(scope,actor,intent('Blocked')),/IDEMPOTENCY_CONFLICT/);});
test('scope field insertion order cannot change idempotency',async()=>{const {state,service}=fixture();await service.change(scope,actor,intent());await service.change({environmentId:scope.environmentId,tenantId:scope.tenantId,workspaceId:scope.workspaceId},actor,intent());assert.equal(state.writes,1);});
test('authorization denial happens before writes',async()=>{const {state,service}=fixture();state.denied=true;await assert.rejects(()=>service.change(scope,actor,intent()),/DENIED/);assert.equal(state.writes,0);});
test('stale versions do not overwrite another developer',async()=>{const {state,service}=fixture();state.current.version=2;await assert.rejects(()=>service.change(scope,actor,intent()),/VERSION_CONFLICT/);assert.equal(state.writes,0);});
test('unfinished prerequisites block implementation progression',async()=>{const {state,service}=fixture();state.parents=false;await assert.rejects(()=>service.change(scope,actor,intent()),/PREDECESSORS_BLOCKED/);});
test('recording a blocker does not require pretending prerequisites passed',async()=>{const {state,service}=fixture();state.parents=false;const r=await service.change(scope,actor,intent('Blocked'));assert.equal(r.status,'Blocked');});
test('Not started cannot jump directly to Done',async()=>{const {service}=fixture();await assert.rejects(()=>service.change(scope,actor,{...intent('Done'),evidenceRef:'proof-1'}),/INVALID_TRANSITION/);});
test('Done requires all independent evidence categories',async()=>{const {state,service}=fixture('Review');state.proof=false;await assert.rejects(()=>service.change(scope,actor,{...intent('Done'),evidenceRef:'proof-1'}),/ACCEPTANCE_INCOMPLETE/);assert.equal(state.writes,0);});
test('Done replay survives evidence-provider outage without another write',async()=>{const {state,service}=fixture('Review');const change={...intent('Done'),evidenceRef:'proof-1'};const a=await service.change(scope,actor,change);state.proofFails=true;const b=await service.change(scope,actor,change);assert.deepEqual(a,b);assert.equal(state.writes,1);});
test('bad keys scope and reason fields are rejected',async()=>{const {service}=fixture();for(const patch of [{idempotencyKey:'x'},{reasonCode:'payload\nsecret'},{expectedVersion:0}])await assert.rejects(()=>service.change(scope,actor,{...intent(),...patch}),/INVALID_INPUT/);await assert.rejects(()=>service.change({...scope,tenantId:'client-claim'},actor,intent()),/INVALID_INPUT/);});
