import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectSignupCallbackBridge as inspect} from '../src/features/channels/meta/signup-callback-view.mjs';
const id=n=>`${n}0000000-0000-0000-0000-00000000000${n}`;
const scope={tenantId:id(1),workspaceId:id(2),environmentId:id(3)},now=1788912000000;
const sample=()=>({schemaVersion:1,attemptId:id(4),scope:{...scope},state:'recorded',message:'DO NOT RENDER INPUT MESSAGE',observedAtMs:now,
  expiresAtMs:now+60000,codeAcknowledged:true,sessionAcknowledged:true,exchange:'not_requested',canRetry:false,canLaunch:false,requestId:id(5),
  diagnostic:{stage:'record',result:'acknowledged',elapsedMs:12}});
test('fixed safe labels replace untrusted message text; only allowlisted details survive',()=>{const v=inspect(sample(),scope,now);assert.ok(v.details);assert.equal(JSON.stringify(v).includes('DO NOT RENDER'),false);assert.equal(v.details.elapsedMs,12);});
test('missing observation states that live bridge is not attached',()=>{assert.equal(inspect(null,scope,now).details,null);assert.match(inspect(null,scope,now).message,/not attached/);});
for(const key of Object.keys(scope))test(`cross-${key} suppresses browser evidence`,()=>{const x=sample();x.scope[key]=id(9);assert.equal(inspect(x,scope,now).details,null);});
for(const [name,change]of[['raw_code',v=>v.code='private'],['nonce',v=>v.nonce='private'],['wrong_state',v=>v.state='READY'],['launch_enabled',v=>v.canLaunch=true],['exchange_enabled',v=>v.exchange='done'],['contradictory_ack',v=>v.codeAcknowledged=false],['missing_request_id',v=>delete v.requestId],['raw_error',v=>v.diagnostic.result='private error'],['negative_elapsed',v=>v.diagnostic.elapsedMs=-1]])
 test(`presentation withholds ${name}`,()=>{const v=sample();change(v);assert.equal(inspect(v,scope,now).details,null);});
for(const clock of [now-1,now+30001,now+60000])test(`presentation freshness withholds clock ${clock-now}`,()=>assert.equal(inspect(sample(),scope,clock).details,null));
test('current terminal observation may explain local expiry without authorizing a launch',()=>{const v=sample();v.state='expired';v.observedAtMs=now+60001;assert.ok(inspect(v,scope,now+60001).details);});
test('data accessors are not evaluated during presentation',()=>{const v=sample();let hits=0;Object.defineProperty(v,'state',{get(){hits++;return'recorded';}});assert.equal(inspect(v,scope,now).details,null);assert.equal(hits,0);});
test('existing panel integrates observation only and retains disabled launch and design',()=>{
 const s=fs.readFileSync(new URL('../src/features/channels/meta/MetaSignupSetupPanel.jsx',import.meta.url),'utf8');
 assert.match(s,/inspectSignupCallbackBridge/);assert.match(s,/Step 3 — attempt-local SDK callback bridge/);
 assert.match(s,/disabled aria-describedby="meta-launch-boundary"/);assert.match(s,/className="greeto-details"/);
 for(const forbidden of [/FB\.login\(/,/bindSignupCallbacks\(/,/fetch\(/,/window\.open\s*=/,/sessionStorage/,/localStorage/,/dangerouslySetInnerHTML/])assert.doesNotMatch(s,forbidden);
});
