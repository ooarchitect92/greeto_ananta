import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectSignupSetup as inspect, META_CONNECTION_STEPS} from '../src/features/channels/meta/signup-setup-model.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('../../backend/testdata/meta-signup-configuration-v1.json',import.meta.url),'utf8'));
const now=fixture.context.nowMs;
const copy=()=>structuredClone(fixture.expected);
const view=d=>inspect(d,fixture.context.scope,now);

test('public prepared fixture is accepted without inventing execution readiness',()=>{
  const r=view(copy());
  assert.equal(r.state,'prepared');assert.equal(r.canLaunch,false);assert.equal(r.parameters.length,7);
  assert.deepEqual(JSON.parse(r.payload),fixture.expected.loginOptions);
});
test('nothing is configured by default; no synthetic profile is injected',()=>{
  assert.equal(view(null).state,'not_configured');assert.equal(view(undefined).canLaunch,false);
  assert.equal(view(null).payload,null);assert.deepEqual(view(null).parameters,[]);
});
test('evidence is withheld when session scope is missing or is a label',()=>{
  assert.equal(inspect(copy(),null,now).state,'unavailable');
  assert.equal(inspect(copy(),{...fixture.context.scope,environmentId:'production'},now).state,'unavailable');
});
test('freshness includes exact expiry and backwards clock checks',()=>{
  for(const clock of [now-1,fixture.expected.expiresAtMs,fixture.expected.expiresAtMs+1]){
    const r=inspect(copy(),fixture.context.scope,clock);assert.equal(r.state,'stale');assert.equal(r.payload,null);
  }
  assert.equal(inspect(copy(),fixture.context.scope,now+1).state,'prepared');
});
for(const key of ['tenantId','workspaceId','environmentId'])test(`cross-${key} suppresses all provider parameters`,()=>{
  const d=copy();d.scope[key]='90000000-0000-0000-0000-000000000009';const r=view(d);
  assert.equal(r.state,'scope_mismatch');assert.equal(r.payload,null);assert.deepEqual(r.parameters,[]);
});
for(const [name,alter]of[
  ['raw credential field',d=>d.access_token='synthetic-private-value'],
  ['nested raw credential',d=>d.loginOptions.client_secret='synthetic-private-value'],
  ['ready claim',d=>d.status='ready'],['execution request',d=>d.execution='requested'],
  ['numeric app ID',d=>d.appId=123],['noninteger revision',d=>d.profileRevision=1.5],
  ['unbounded ID',d=>d.appId='1'.repeat(129)],['latest Graph version',d=>d.graphApiVersion='latest'],
  ['numeric config ID',d=>d.loginOptions.config_id=123],['token response',d=>d.loginOptions.response_type='token'],
  ['response override',d=>d.loginOptions.override_default_response_type=false],
  ['unexpected extras',d=>d.loginOptions.extras.setup={password:'synthetic-private-value'}],
  ['wrong session version',d=>d.loginOptions.extras.sessionInfoVersion=3],
  ['invalid version',d=>d.loginOptions.extras.version='v4/evil'],
  ['empty optional type',d=>d.loginOptions.extras.featureType=''],
  ['duplicate features',d=>d.loginOptions.extras.features=[{name:'app_only_install'},{name:'app_only_install'}]],
  ['sparse features',d=>d.loginOptions.extras.features=Array(1)],
  ['unknown feature keys',d=>d.loginOptions.extras.features=[{name:'app_only_install',secret:'synthetic-private-value'}]],
  ['inverted observation interval',d=>d.checkedAtMs=d.expiresAtMs],
])test(`presentation rejects ${name}`,()=>{
  const d=copy();alter(d);const r=view(d);assert.equal(r.state,'invalid');assert.equal(r.payload,null);assert.equal(r.canLaunch,false);
  assert.equal(JSON.stringify(r).includes('synthetic-private-value'),false);
});
test('optional permitted combination is preserved by the frontend model',()=>{
  const d=copy();d.loginOptions.extras.features=[{name:'app_only_install'}];d.loginOptions.extras.featureType='whatsapp_business_app_onboarding';
  const r=view(d);assert.equal(r.state,'prepared');
  assert.equal(JSON.parse(r.payload).extras.featureType,'whatsapp_business_app_onboarding');
});
test('scope/accessor validation never invokes input getter',()=>{
  const d=copy();let count=0;Object.defineProperty(d,'appId',{enumerable:true,get(){count++;return'1';}});
  assert.equal(view(d).state,'invalid');assert.equal(count,0);
});
test('returned representation cannot change when input is mutated later',()=>{
  const d=copy();const r=view(d);d.appId='999';d.loginOptions.extras.features.push({name:'changed'});
  assert.equal(r.parameters.find(p=>p.name==='appId').value,fixture.expected.appId);
  assert.deepEqual(JSON.parse(r.payload).extras.features,[]);assert.equal(Object.isFrozen(r.parameters[0]),true);
});
test('stepwise checklist preserves the exact existing F02 operation order',()=>{
  assert.deepEqual(META_CONNECTION_STEPS.map(x=>x.key),['attempt','consent','callback','exchange','grants','binding','subscription','phone','capability','probe','completion']);
  assert.equal(META_CONNECTION_STEPS.some(x=>Object.hasOwn(x,'completed')),false);assert.equal(Object.isFrozen(META_CONNECTION_STEPS),true);
});
test('existing Channel Center mounts panel only on its configure tab',()=>{
  const text=fs.readFileSync(new URL('../src/features/studio/FeatureStudioPage.jsx',import.meta.url),'utf8');
  assert.ok(text.includes("import MetaSignupSetupPanel from '../channels/meta/MetaSignupSetupPanel.jsx';"));
  assert.ok(text.includes("featureId==='channel-center'&&tab==='configure'&&<MetaSignupSetupPanel/>"));
});
test('panel reuses shared design, exposes no editable credential or live launch',()=>{
  const text=fs.readFileSync(new URL('../src/features/channels/meta/MetaSignupSetupPanel.jsx',import.meta.url),'utf8');
  assert.match(text,/shared\/ui\/PageLayout\.jsx/);assert.match(text,/className="greeto-card"/);
  assert.match(text,/disabled aria-describedby="meta-launch-boundary"/);
  for(const pattern of [/FB\.login\(/,/fetch\(/,/localStorage/,/sessionStorage/,/<input/,/dangerouslySetInnerHTML/])assert.doesNotMatch(text,pattern);
  assert.match(text,/clearInterval/);
});
