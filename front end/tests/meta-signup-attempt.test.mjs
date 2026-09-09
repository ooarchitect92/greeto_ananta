import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectSignupAttempt as inspect} from '../src/features/channels/meta/signup-attempt-model.mjs';
const scope={tenantId:'10000000-0000-0000-0000-000000000001',workspaceId:'20000000-0000-0000-0000-000000000002',environmentId:'30000000-0000-0000-0000-000000000003'};
const now=1788912000000;
const fixture=()=>({schemaVersion:1,attemptId:'40000000-0000-0000-0000-000000000004',requestId:'50000000-0000-0000-0000-000000000005',scope:{...scope},status:'AWAITING_CALLBACK',version:1,createdAtMs:now,observedAtMs:now,expiresAtMs:now+30000,codeReceived:false,sessionReceived:false,exchange:'not_requested',durable:true});
const view=o=>inspect(o,scope,now);
test('missing attempt never becomes ready or executable',()=>{const v=view(null);assert.equal(v.state,'not_observed');assert.equal(v.canExchange,false);assert.equal(v.canLaunch,false);assert.equal(v.progress,null);});
for(const [status,codeReceived,sessionReceived]of[['AWAITING_CALLBACK',false,false],['CODE_RECEIVED',true,false],['SESSION_RECEIVED',false,true],['CALLBACK_CORRELATED',true,true],['CANCELLED',false,false]])test('renders '+status+' without promoting provider readiness',()=>{
  const v=view({...fixture(),status,codeReceived,sessionReceived});assert.equal(v.state,status);assert.equal(v.canExchange,false);assert.ok(v.progress);assert.equal(Object.isFrozen(v.progress),true);
});
test('recorded expiry is shown as a fact, not active consent',()=>{const v=view({...fixture(),status:'EXPIRED',createdAtMs:now-40000,expiresAtMs:now-1000});assert.equal(v.state,'EXPIRED');assert.equal(v.canExchange,false);});
for(const k of Object.keys(scope))test('withholds cross-'+k+' evidence',()=>{const x=fixture();x.scope[k]='90000000-0000-0000-0000-000000000009';const v=view(x);assert.equal(v.state,'scope_mismatch');assert.equal(v.progress,null);});
for(const [label,change]of[
  ['raw code',x=>x.code='synthetic-secret'],['nonce',x=>x.nonce='synthetic-secret'],['vault ref',x=>x.credential_ref='synthetic-secret'],
  ['ready',x=>x.status='READY'],['uncommitted',x=>x.durable=false],['numeric bool',x=>x.codeReceived=1],['numeric ID',x=>x.attemptId=4],
  ['exchange requested',x=>x.exchange='requested'],['partial contradiction',x=>x.status='CODE_RECEIVED'],['correlated contradiction',x=>x.status='CALLBACK_CORRELATED'],
  ['expiry contradiction',x=>x.status='EXPIRED'],['invalid time',x=>x.createdAtMs=now+1],['unknown scope fields',x=>x.scope.role='admin'],
])test('rejects '+label+' rather than rendering sensitive or false evidence',()=>{const x=fixture();change(x);const v=view(x);assert.equal(v.state,'invalid');assert.equal(v.progress,null);assert.equal(JSON.stringify(v).includes('synthetic-secret'),false);});
test('missing UUID scope and bad clocks withhold observations',()=>{for(const s of [null,{...scope,environmentId:'production'}])assert.equal(inspect(fixture(),s,now).state,'unavailable');assert.equal(inspect(fixture(),scope,NaN).state,'unavailable');});
test('expired, too-old and future observations stay visibly stale',()=>{
  for(const delta of [-1,30000,31000])assert.equal(inspect(fixture(),scope,now+delta).state,'stale');
  const x=fixture();x.expiresAtMs=now+100000;assert.equal(inspect(x,scope,now+30001).state,'stale');
});
test('return values own their data; later caller edits cannot change display',()=>{const x=fixture(),v=view(x);x.version=99;assert.equal(v.progress.version,1);});
test('input getters are not executed for rendering',()=>{const x=fixture();let count=0;Object.defineProperty(x,'status',{get(){count++;return'AWAITING_CALLBACK';}});assert.equal(view(x).state,'invalid');assert.equal(count,0);});
test('existing panel owns attempt details without an alternate route or live button',()=>{
  const s=readFileSync(new URL('../src/features/channels/meta/MetaSignupSetupPanel.jsx',import.meta.url),'utf8');
  assert.match(s,/Step 2 — connection attempt/);assert.match(s,/inspectSignupAttempt/);assert.match(s,/disabled aria-describedby="meta-launch-boundary"/);
  for(const p of [/FB\.login\(/,/fetch\(/,/localStorage/,/sessionStorage/,/<input/,/dangerouslySetInnerHTML/])assert.doesNotMatch(s,p);
  assert.match(s,/clearInterval/);assert.match(s,/greeto-details/);
});
