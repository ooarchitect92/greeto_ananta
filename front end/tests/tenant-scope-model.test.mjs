import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantScopeView } from '../src/features/implementation/tenant-scope-model.mjs';
const expectedScope={tenantId:'11111111-1111-4111-8111-111111111111',workspaceId:'22222222-2222-4222-8222-222222222222',environmentId:'33333333-3333-4333-8333-333333333333'};
const observation={snapshot:{...expectedScope,homeCell:'cell-a',placementEpoch:'9007199254740993',state:'active',kind:'sandbox'},observedAt:'2026-09-07T09:00:00Z',expiresAt:'2026-09-07T09:01:00Z'};
const nowMs=Date.parse('2026-09-07T09:00:30Z');
const view=(patch={})=>tenantScopeView({expectedScope,observation,nowMs,...patch});
test('missing scope never creates a fallback tenant',()=>assert.equal(tenantScopeView().state,'scope_required'));
test('valid scope without server observation stays disconnected',()=>assert.equal(view({observation:null}).state,'not_connected'));
test('active lifecycle is not called ready or authorized',()=>{const v=view();assert.equal(v.state,'observed_active');assert.match(v.explanation,/not proof/);assert.equal(v.details.find(([k])=>k==='placementEpoch')[1],'9007199254740993');});
for(const key of Object.keys(expectedScope))test(`no cross-scope ${key} shown`,()=>{const v=view({observation:{...observation,snapshot:{...observation.snapshot,[key]:'55555555-5555-4555-8555-555555555555'}}});assert.equal(v.state,'scope_mismatch');assert.deepEqual(v.details,[]);});
for(const state of ['provisioning','suspended','erasing'])test(`${state} remains restricted`,()=>assert.equal(view({observation:{...observation,snapshot:{...observation.snapshot,state}}}).state,'restricted'));
test('expired observation loses its displayed data',()=>{const v=view({nowMs:Date.parse(observation.expiresAt)});assert.equal(v.state,'stale');assert.deepEqual(v.details,[]);});
test('future timestamp cannot establish health',()=>assert.equal(view({nowMs:Date.parse('2026-09-07T08:59:59Z')}).state,'invalid'));
for(const patch of [{kind:'development'},{state:'ready'},{placementEpoch:9007199254740993},{placementEpoch:'9223372036854775808'},{homeCell:'<script>'},{token:'never-render'}])test(`invalid snapshot ${JSON.stringify(patch)} is suppressed`,()=>assert.equal(view({observation:{...observation,snapshot:{...observation.snapshot,...patch}}}).state,'invalid'));
test('malformed observation and invalid clock are handled',()=>{assert.equal(view({observation:[]}).state,'invalid');assert.equal(view({nowMs:NaN}).state,'invalid');});
test('invalid expiry and timezone-free timestamps are rejected',()=>{assert.equal(view({observation:{...observation,expiresAt:observation.observedAt}}).state,'invalid');assert.equal(view({observation:{...observation,observedAt:'2026-09-07T09:00:00'}}).state,'invalid');});

test('rolled calendar dates and inherited scope fields cannot be displayed as current',()=>{assert.equal(view({observation:{...observation,observedAt:'2026-02-30T09:00:00Z'}}).state,'invalid');const inherited=Object.assign(Object.create(expectedScope),{a:1,b:2,c:3});assert.equal(view({expectedScope:inherited}).state,'scope_required');});
