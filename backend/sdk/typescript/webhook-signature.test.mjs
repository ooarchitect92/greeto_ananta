import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { signWebhook, verifyWebhook, WebhookProofError, HEADER_NAMES as H } from './webhook-signature.mjs';

// Synthetic public fixtures. No HTTP, credentials, database or ledger are mocked
// into production: these tests exercise the real stdlib cryptographic functions.
const at = 1788825600;
const key = { id:'current', secret:Buffer.alloc(32,97), notBefore:at-1000, signUntil:at+1000, verifyUntil:at+2000, revoked:false };
const policy = {maxAgeSeconds:300,maxFutureSkewSeconds:30,maxBodyBytes:4096};
const body = Buffer.from('{"event_id":"evt_fixture"}');
const raw = headers => Object.entries(headers).flat();
const signed = () => signWebhook(body,'evt_fixture','dlv_fixture',key,at,policy);
const verify = (headers=signed(), bytes=body, keys=[key], now=at, p=policy) => verifyWebhook(bytes,raw(headers),keys,now,p);
const invalid = fn => assert.throws(fn, error => error instanceof WebhookProofError && error.code==='WEBHOOK_PROOF_INVALID');
const config = fn => assert.throws(fn, error => error instanceof WebhookProofError && error.code==='WEBHOOK_SIGNING_CONFIG_INVALID');

const fixtures=JSON.parse(readFileSync(new URL('../../contracts/fixtures/webhook-signature-v1.json',import.meta.url),'utf8'));
assert.equal(fixtures.vectors.length,6);
for(const v of fixtures.vectors) test(`independent vector: ${v.name}`,()=>{
  const b=Buffer.from(v.body_hex,'hex'), k={...key,id:v.key_id,secret:Buffer.from(v.key_hex,'hex')};
  const h=signWebhook(b,v.event_id,v.delivery_id,k,v.at,policy);
  assert.equal(h[H.signature],v.signature);
  const proof=verifyWebhook(b,raw(h),[k],v.at,policy);
  assert.deepEqual(proof,{deliveryId:v.delivery_id,keyId:v.key_id,attemptedAt:v.at,bodySha256:v.body_sha256});
});
for(const name of Object.values(H)) {
  test(`missing ${name}`,()=>{const h={...signed()};delete h[name];invalid(()=>verify(h));});
  test(`duplicate ${name}`,()=>{const headers=raw(signed());headers.push(name.toLowerCase(),signed()[name]);invalid(()=>verifyWebhook(body,headers,[key],at,policy));});
}
for(const [name,header,value] of [
  ['comma',H.signature,`v1=${'a'.repeat(64)},v1=${'b'.repeat(64)}`],
  ['short',H.signature,'v1=aa'],['version',H.signature,`v2=${'a'.repeat(64)}`],
  ['uppercase',H.signature,`v1=${'A'.repeat(64)}`],['signature newline',H.signature,`v1=${'a'.repeat(64)}\n`],
  ['delivery newline',H.delivery,'dlv_fixture\n'],['delimiter',H.delivery,'dlv.fixture'],
  ['changed delivery',H.delivery,'dlv_changed'],['unknown key',H.key,'unknown'],
  ['leading zero',H.timestamp,'01788825600'],['negative',H.timestamp,'-1'],
  ['float',H.timestamp,'1788825600.0'],['exponent',H.timestamp,'1e9'],
  ['whitespace',H.timestamp,' 1788825600'],['timestamp newline',H.timestamp,'1788825600\n'],
  ['overflow',H.timestamp,'99999999999'],
]) test(`reject malformed ${name}`,()=>invalid(()=>verify({...signed(),[header]:value})));

test('body mutation invalidates proof',()=>invalid(()=>verify(signed(),Buffer.from('["event_id":"evt_fixture"}'))));
test('JSON reserialization invalidates proof',()=>invalid(()=>verify(signed(),Buffer.from('{ "event_id": "evt_fixture" }'))));
test('body limits apply before hashing for signing and verification',()=>{const p={...policy,maxBodyBytes:body.length-1};invalid(()=>verify(signed(),body,[key],at,p));invalid(()=>signWebhook(body,'evt_fixture','dlv_fixture',key,at,p));});
test('security header casing is insensitive',()=>{const entries=raw(signed()).map((v,i)=>i%2?v:v.toLowerCase());assert.equal(verifyWebhook(body,entries,[key],at,policy).deliveryId,'dlv_fixture');});
test('unsigned event header is not promoted into trusted proof',()=>{const proof=verify({...signed(),[H.event]:'evt_untrusted'});assert.equal(Object.hasOwn(proof,'eventId'),false);assert.equal(Object.hasOwn(proof,'event_id'),false);});
test('fresh retry is authentic but not independently replay-protected',()=>{const h=signWebhook(body,'evt_fixture','dlv_fixture',key,at+1,policy);const a=verify(),b=verify(h,body,[key],at+1);assert.equal(a.deliveryId,b.deliveryId);assert.equal(a.bodySha256,b.bodySha256);assert.notEqual(h[H.signature],signed()[H.signature]);});
for(const delta of [-31,-30,300,301]) test(`clock boundary ${delta}`,()=>{if(delta>=-30&&delta<=300)assert.ok(verify(signed(),body,[key],at+delta));else invalid(()=>verify(signed(),body,[key],at+delta));});
test('rotation permits bounded overlap, not further old-key signing',()=>{const old={...key,signUntil:at+1,verifyUntil:at+10};const next={...key,id:'next',secret:Buffer.alloc(32,98),notBefore:at+1};assert.ok(verify(signed(),body,[next,old],at+5));invalid(()=>signWebhook(body,'evt_fixture','dlv_fixture',old,at+5,policy));const h=signWebhook(body,'evt_fixture','dlv_fixture',next,at+5,policy);assert.ok(verify(h,body,[next,old],at+5));invalid(()=>verify(signed(),body,[next,old],at+10));});
for(const [name,patch] of [['revocation',{revoked:true}],['not yet valid',{notBefore:at+1}],['attempt after signing',{signUntil:at}],['expired',{signUntil:at-1,verifyUntil:at}]]) test(`key ${name}`,()=>invalid(()=>verify(signed(),body,[{...key,...patch}])));
for(const [name,keys,p,now] of [
  ['empty ring',[],policy,at],['large ring',[key,key,key],policy,at],
  ['same id',[key,{...key,secret:Buffer.alloc(32,98)}],policy,at],
  ['same secret',[key,{...key,id:'other'}],policy,at],
  ['short secret',[{...key,secret:Buffer.from('short')}],policy,at],
  ['intervals',[{...key,verifyUntil:key.signUntil-1}],policy,at],
  ['policy',[key],{...policy,maxAgeSeconds:0},at],['clock',[key],policy,-1],
]) test(`config ${name}`,()=>config(()=>verify(signed(),body,keys,now,p)));
for(const id of ['', 'd.bad', 'd\n', 'd'.repeat(129), 'नमस्ते']) test(`invalid signing ID ${JSON.stringify(id)}`,()=>invalid(()=>signWebhook(body,'evt_fixture',id,key,at,policy)));
test('body strings are rejected rather than implicitly encoded',()=>invalid(()=>verify(signed(),'text')));
test('raw headers must retain pairs',()=>invalid(()=>verifyWebhook(body,['odd'],[key],at,policy)));
test('non-string header values cannot reach crypto',()=>invalid(()=>verifyWebhook(body,[H.signature,42],[key],at,policy)));
test('shared mutable input is rejected',()=>invalid(()=>verify(signed(),new Uint8Array(new SharedArrayBuffer(32)))));
test('proof and generated headers are immutable',()=>{assert.ok(Object.isFrozen(signed()));assert.ok(Object.isFrozen(verify()));});
