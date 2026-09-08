import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deliveryLifecycleView as view,lifecycleParameters} from '../src/features/implementation/delivery-lifecycle-view.mjs';
const scope={tenantId:'00000000-0000-0000-0000-000000000001',workspaceId:'00000000-0000-0000-0000-000000000002',environmentId:'00000000-0000-0000-0000-000000000003'};
const now=Date.parse('2026-09-08T00:00:10Z');
const sample=()=>({scope:{...scope},deliveryId:'delivery_example',attemptId:'00000000-0000-0000-0000-000000000005',state:'RETRY_WAIT',httpStatus:503,nextAttemptAt:'2026-09-08T00:00:20Z',observedAt:'2026-09-08T00:00:00Z',expiresAt:'2026-09-08T00:01:00Z',receiptCommitted:true});
const display=o=>view({expectedScope:scope,observation:o,now});
test('missing authenticated scope stays unconnected',()=>assert.equal(view().state,'not_connected'));
test('missing receipt stays unobserved',()=>assert.equal(display(null).state,'not_observed'));
test('valid future retry shows its persisted due time',()=>{const r=display(sample());assert.equal(r.state,'observed');assert.match(r.detail,/rechecks/);assert.equal(r.nextAttemptAt,sample().nextAttemptAt);});
test('elapsed due time is not reported as another send',()=>{const o=sample();o.nextAttemptAt='2026-09-08T00:00:05Z';assert.match(display(o).detail,/not proof/);});
test('unknown outcome explicitly withholds automatic retry',()=>{const o={...sample(),state:'UNKNOWN',httpStatus:0,nextAttemptAt:null};assert.match(display(o).detail,/does not authorize resending/);});
test('endpoint acceptance is not business completion',()=>{const o={...sample(),state:'ACCEPTED_BY_ENDPOINT',httpStatus:204,nextAttemptAt:null};assert.match(display(o).detail,/business completion is separate/);});
for(const field of Object.keys(scope))test(`mismatched ${field} is withheld`,()=>{const o=sample();o.scope[field]='00000000-0000-0000-0000-000000000099';assert.equal(display(o).state,'withheld');});
for(const [name,patch] of [
 ['uncommitted',{receiptCommitted:false}],['forged acceptance',{state:'ACCEPTED_BY_ENDPOINT',httpStatus:503}],['unknown scheduled',{state:'UNKNOWN',httpStatus:0}],
 ['missing due',{nextAttemptAt:null}],['invalid state',{state:'SUCCESS'}],['invalid identity',{deliveryId:'<script>'}],
 ['nil attempt',{attemptId:'00000000-0000-0000-0000-000000000000'}],['future observation',{observedAt:'2026-09-08T00:00:30Z'}],
 ['too long freshness',{expiresAt:'2026-09-08T00:02:00Z'}],['invalid calendar date',{observedAt:'2026-02-30T00:00:00Z'}],
 ['secret extra field',{secret:'not-real'}],['wrong status type',{httpStatus:'503'}],['body scope as array',{scope:[]}]
])test(`${name} is withheld`,()=>assert.equal(display({...sample(),...patch}).state,'withheld'));
test('expired result hides delivery and status',()=>{const r=display({...sample(),expiresAt:'2026-09-08T00:00:10Z'});assert.equal(r.state,'stale');assert.equal(r.deliveryId,undefined);assert.equal(r.httpStatus,undefined);});
test('input and parameter descriptions are not mutated',()=>{const o=sample(),copy=structuredClone(o);display(o);assert.deepEqual(o,copy);assert.ok(Object.isFrozen(lifecycleParameters));assert.ok(Object.isFrozen(lifecycleParameters[0]));});
test('same existing Implementation Center imports and mounts the panel once',async()=>{const text=await readFile(new URL('../src/features/implementation/ImplementationCenter.jsx',import.meta.url),'utf8');assert.equal((text.match(/<WebhookDeliveryPanel\/>/g)||[]).length,1);for(const p of ['ProductionReadinessPanel','TenantScopePanel','OutboxStatusPanel','EgressBoundaryPanel'])assert.ok(text.includes(`<${p}/>`));});
test('panel retains shared design and disabled diagnostics',async()=>{const text=await readFile(new URL('../src/features/implementation/WebhookDeliveryPanel.jsx',import.meta.url),'utf8');for(const expected of ['Notice','greeto-card','greeto-table-wrap','disabled','clearInterval'])assert.ok(text.includes(expected));assert.ok(!/fetch\(|localStorage|dangerouslySetInnerHTML/.test(text));});
