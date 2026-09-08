import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {inspectSignupSetup} from '../../../../front end/src/features/channels/meta/signup-setup-model.mjs';
const require = createRequire(import.meta.url);
const {prepareSignupConfiguration: prepare, SetupError} = require('../../../../.local-build/meta-signup/signup-configuration.js');
const fixture = JSON.parse(fs.readFileSync(new URL('../../../testdata/meta-signup-configuration-v1.json', import.meta.url), 'utf8'));
const input = () => structuredClone(fixture);
const rejected = (p, c, code) => assert.throws(() => prepare(p, c), e => e instanceof SetupError && e.code === code && e.message === code);

test('matches independent source-shaped options and public-only fixture exactly', () => {
  const {profile, context, expected} = input();
  const result = prepare(profile, context);
  assert.deepEqual(result, expected);
  const view = inspectSignupSetup(result, context.scope, context.nowMs);
  assert.equal(view.state, 'prepared');
  assert.deepEqual(JSON.parse(view.payload), expected.loginOptions);
  assert.equal(view.canLaunch, false);
});
test('derived optional featureType/features preserve exact values without adding scope', () => {
  const {profile, context} = input();
  profile.featureType = 'whatsapp_business_app_onboarding'; profile.features = ['app_only_install'];
  const result = prepare(profile, context);
  assert.deepEqual(result.loginOptions.extras, {sessionInfoVersion:'3', version:'v4', featureType:'whatsapp_business_app_onboarding', features:[{name:'app_only_install'}]});
  assert.equal('scope' in result.loginOptions, false);
  assert.equal(inspectSignupSetup(result, context.scope, context.nowMs).state, 'prepared');
});
test('blank featureType is omitted, not a null or empty provider parameter', () => {
  const {profile, context} = input(); assert.equal(Object.hasOwn(prepare(profile, context).loginOptions.extras, 'featureType'), false);
});
test('no default latest Graph or Embedded Signup version is selected', () => {
  const {profile, context} = input(); profile.graphApiVersion='v25.0'; profile.signupVersion='v3-public-preview';
  const r=prepare(profile, context); assert.equal(r.graphApiVersion, 'v25.0'); assert.equal(r.loginOptions.extras.version, 'v3-public-preview');
  // Explicit synthetic registry data only, not certification of this combination.
});
test('pure repeated preparation produces identical snapshots and changes no input', () => {
  const {profile, context} = input(); const before=JSON.stringify({profile,context});
  assert.deepEqual(prepare(profile, context),prepare(profile, context)); assert.equal(JSON.stringify({profile,context}),before);
});
test('deep freeze and copies prevent post-check profile mutation', () => {
  const {profile, context} = input(); profile.features=['app_only_install']; const r=prepare(profile,context);
  profile.scope.tenantId='changed'; profile.features[0]='changed';
  assert.equal(r.scope.tenantId, fixture.context.scope.tenantId); assert.equal(r.loginOptions.extras.features[0].name,'app_only_install');
  for (const o of [r,r.scope,r.loginOptions,r.loginOptions.extras,r.loginOptions.extras.features,r.loginOptions.extras.features[0]]) assert.equal(Object.isFrozen(o), true);
  assert.throws(()=>{r.scope.tenantId='wrong';},TypeError);
});
test('checked time may equal review time but never equal expiry',()=>{
  const {profile, context}=input(); context.nowMs=profile.evidence.reviewedAtMs; assert.equal(prepare(profile,context).status,'prepared');
  context.nowMs=profile.evidence.expiresAtMs; rejected(profile,context,'META_SETUP_STALE');
});
test('missing profile and disabled profile produce neutral explicit errors',()=>{
  const {profile, context}=input(); rejected(null,context,'META_SETUP_NOT_CONFIGURED');rejected(undefined,context,'META_SETUP_NOT_CONFIGURED');
  profile.enabled=false;rejected(profile,context,'META_SETUP_DISABLED');
});
for (const key of ['tenantId','workspaceId','environmentId']) test(`cross-${key} profile is rejected without revealing IDs`,()=>{
  const {profile,context}=input();profile.scope[key]='90000000-0000-0000-0000-000000000009';rejected(profile,context,'META_SETUP_SCOPE_MISMATCH');
});
for (const key of ['appRef','profileId','profileRevision']) test(`expected ${key} mismatch rejects stale/swapped registry row`,()=>{
  const {profile,context}=input();profile[key]=key==='profileRevision'?3:'different';rejected(profile,context,'META_SETUP_SCOPE_MISMATCH');
});
for (const [name, mutate, code] of [
  ['unverified evidence',p=>p.evidence.status='unverified','META_SETUP_EVIDENCE_REQUIRED'],
  ['revoked evidence',p=>p.evidence.status='revoked','META_SETUP_REVOKED'],
  ['future evidence',p=>p.evidence.reviewedAtMs=fixture.context.nowMs+1,'META_SETUP_STALE'],
  ['expired evidence',p=>p.evidence.expiresAtMs=fixture.context.nowMs-1,'META_SETUP_STALE'],
  ['wrong schema',p=>p.schemaVersion=2,'META_SETUP_PROFILE_INVALID'],
  ['numeric app ID',p=>p.appId=9007199254740992,'META_SETUP_PROFILE_INVALID'],
  ['numeric config ID',p=>p.configId=123,'META_SETUP_PROFILE_INVALID'],
  ['nondecimal ID',p=>p.appId='12e3','META_SETUP_PROFILE_INVALID'],
  ['zero ID',p=>p.configId='0','META_SETUP_PROFILE_INVALID'],
  ['missing Graph version',p=>delete p.graphApiVersion,'META_SETUP_PROFILE_INVALID'],
  ['implicit latest',p=>p.graphApiVersion='latest','META_SETUP_PROFILE_INVALID'],
  ['bad signup version',p=>p.signupVersion='v4/../../token','META_SETUP_PROFILE_INVALID'],
  ['null feature type',p=>p.featureType=null,'META_SETUP_PROFILE_INVALID'],
  ['duplicate features',p=>p.features=['app_only_install','app_only_install'],'META_SETUP_PROFILE_INVALID'],
  ['too many features',p=>p.features=Array.from({length:17},(_,i)=>`option_${i}`),'META_SETUP_PROFILE_INVALID'],
  ['sparse features',p=>p.features=Array(1),'META_SETUP_PROFILE_INVALID'],
  ['nonarray features',p=>p.features='app_only_install','META_SETUP_PROFILE_INVALID'],
  ['URL in feature',p=>p.features=['https://example.com'],'META_SETUP_PROFILE_INVALID'],
  ['invalid review interval',p=>p.evidence.reviewedAtMs=p.evidence.expiresAtMs,'META_SETUP_PROFILE_INVALID'],
  ['string clock',p=>p.evidence.expiresAtMs='tomorrow','META_SETUP_PROFILE_INVALID'],
  ['unknown credential field',p=>p.access_token='synthetic-should-not-be-accepted','META_SETUP_PROFILE_INVALID'],
  ['nested secret field',p=>p.evidence.client_secret='synthetic','META_SETUP_PROFILE_INVALID'],
  ['zero revision',p=>p.profileRevision=0,'META_SETUP_PROFILE_INVALID'],
  ['unsafe revision',p=>p.profileRevision=Number.MAX_SAFE_INTEGER+1,'META_SETUP_PROFILE_INVALID'],
  ['zero internal scope',p=>p.scope.tenantId='00000000-0000-0000-0000-000000000000','META_SETUP_PROFILE_INVALID'],
]) test(`profile rejects ${name}`,()=>{const {profile,context}=input();mutate(profile);rejected(profile,context,code);});
for(const [name,mutate] of [
  ['missing actor',c=>delete c.actorId],['invalid actor',c=>c.actorId='email@example.com'],
  ['NaN clock',c=>c.nowMs=NaN],['unsafe clock',c=>c.nowMs=Number.MAX_SAFE_INTEGER+1],
  ['negative clock',c=>c.nowMs=-1],['string revision',c=>c.profileRevision='2'],
  ['unknown context field',c=>c.allowed=true],['environment label is not ID',c=>c.scope.environmentId='production'],
]) test(`context rejects ${name}`,()=>{const{profile,context}=input();mutate(context);rejected(profile,context,'META_SETUP_CONTEXT_INVALID');});
test('accessor properties are rejected without invoking the getter',()=>{
  const{profile,context}=input();let calls=0;Object.defineProperty(profile,'appId',{enumerable:true,get(){calls++;return'1';}});
  rejected(profile,context,'META_SETUP_PROFILE_INVALID');assert.equal(calls,0);
});
test('inherited and symbol properties cannot pass strict registry schema',()=>{
  const{profile,context}=input();profile[Symbol('secret')]='test';rejected(profile,context,'META_SETUP_PROFILE_INVALID');
  rejected(Object.create(fixture.profile),context,'META_SETUP_PROFILE_INVALID');
});
test('null-prototype data remains valid when it contains precisely the schema',()=>{
  const{profile,context}=input();assert.equal(prepare(Object.assign(Object.create(null),profile),context).status,'prepared');
});
