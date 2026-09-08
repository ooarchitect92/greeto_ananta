import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Buffer} from 'node:buffer';
import {inspect} from 'node:util';
import {createHash} from 'node:crypto';
import {verifyWebhookEvent} from './webhook-event.mjs';
import {signWebhook, verifyWebhook} from './webhook-signature.mjs';

const fixture = JSON.parse(readFileSync(new URL('../../testdata/webhook-event-v1.json', import.meta.url)));
const key = {id:'test-key',secret:Buffer.alloc(32,0x42),notBefore:1,signUntil:9000,verifyUntil:9100,revoked:false};
const policy = {maxAgeSeconds:300,maxFutureSkewSeconds:10,maxBodyBytes:4096};
const limits = fixture.defaults.limits;
const body = () => Buffer.from('{"event_id":"evt-001","data":"private_test_note"}');
const headers = raw => Object.entries(signWebhook(raw,'evt-001','delivery-001',key,1000,policy)).flat();
const verify = (raw=body(), h=headers(raw), ks=[key], now=1000, p=policy, l=limits) => verifyWebhookEvent(raw,h,ks,now,p,l);
const observations = [];
for (const c of fixture.cases) {
  test(`conformance/${c.name}`, () => {
    const raw = Buffer.from(c.body_base64,'base64');
    const hs = [ ...(c.event_headers || ['evt-001']).flatMap(v => ['X-Platform-Event-Id',v]),
      'X-Platform-Delivery-Id','delivery-001','X-Platform-Timestamp','1000',
      'X-Platform-Key-Id',c.key_header || 'test-key','X-Platform-Signature',c.signature];
    if (c.lowercase_headers) for(let i=0;i<hs.length;i+=2) hs[i]=hs[i].toLowerCase();
    let result;
    try {
      const event = verify(raw,hs,[key],c.now ?? 1000,policy,c.limits || limits);
      assert.equal(event.eventId,'evt-001');
      assert.deepEqual(event.rawBody(),raw);
      assert.equal(event.proof.bodySha256,createHash('sha256').update(raw).digest('hex'));
      result={name:c.name,code:'ok',event_id:event.eventId,body_sha256:event.proof.bodySha256};
    } catch(error) {
      if (!error.code?.startsWith('WEBHOOK_')) throw error;
      result={name:c.name,code:error.code,event_id:'',body_sha256:''};
    }
    assert.equal(result.code,c.expected);
    observations.push(result);
  });
}

test('ownership/snapshot remains unchanged after caller mutation', () => {
  const raw=body(), original=Buffer.from(raw), hs=headers(raw), e=verify(raw,hs);
  raw.fill(0); hs[1]='other'; e.rawBody().fill(0);
  assert.deepEqual(e.rawBody(),original); assert.equal(e.eventId,'evt-001');
});
test('ownership/metadata and event are frozen', () => {
  const e=verify(); assert.ok(Object.isFrozen(e)); assert.ok(Object.isFrozen(e.proof));
  assert.throws(()=>{e.eventId='other';},TypeError);
  assert.throws(()=>{e.proof.deliveryId='other';},TypeError);
});
test('privacy/normal inspection and JSON omit bodies and IDs', () => {
  const e=verify(); for (const v of [String(e),inspect(e),JSON.stringify(e)]) {
    assert.ok(v.includes('body omitted')); assert.ok(!v.includes('private_test_note')); assert.ok(!v.includes('evt-001'));
  }
});
test('boundary/proof alone does not authenticate event header', () => {
  const raw=body(), hs=headers(raw); hs[1]='evt-other';
  assert.doesNotThrow(()=>verifyWebhook(raw,hs,[key],1000,policy));
  assert.throws(()=>verify(raw,hs),{code:'WEBHOOK_EVENT_ENVELOPE_INVALID'});
});
test('boundary/repeated delivery still needs separate durable receiver ledger', () => {
  const raw=body(), hs=headers(raw);
  assert.deepEqual(verify(raw,hs).proof,verify(raw,hs).proof);
});
test('input/shared body rejected before copy', () => {
  const raw=new Uint8Array(new SharedArrayBuffer(10));
  assert.throws(()=>verify(raw,headers(body())),{code:'WEBHOOK_PROOF_INVALID'});
});
test('input/string body and collapsed headers are rejected', () => {
  assert.throws(()=>verify('text'),{code:'WEBHOOK_PROOF_INVALID'});
  assert.throws(()=>verify(body(),{}),{code:'WEBHOOK_PROOF_INVALID'});
});
test('input/invalid limits do not silently choose defaults', () => {
  for (const l of [null,{}, {...limits,maxDepth:65},{...limits,maxTokens:3},{...limits,maxKeyBytes:7},{...limits,maxDepth:true}])
    assert.throws(()=>verify(body(),headers(body()),[key],1000,policy,l),{code:'WEBHOOK_EVENT_LIMITS_INVALID'});
});
test('input/invalid policy and oversized raw bytes are separate', () => {
  assert.throws(()=>verify(body(),headers(body()),[key],1000,{...policy,maxBodyBytes:0}),{code:'WEBHOOK_SIGNING_CONFIG_INVALID'});
  assert.throws(()=>verify(body(),headers(body()),[key],1000,{...policy,maxBodyBytes:1}),{code:'WEBHOOK_PROOF_INVALID'});
});
test('keys/revocation and explicit rotation overlap use unchanged verifier', () => {
  assert.throws(()=>verify(body(),headers(body()),[{...key,revoked:true}]),{code:'WEBHOOK_PROOF_INVALID'});
  const old={...key,signUntil:1001,verifyUntil:1200};
  const next={...key,id:'next',secret:Buffer.alloc(32,0x33),notBefore:1001,signUntil:2000,verifyUntil:2100};
  assert.equal(verify(body(),headers(body()),[next,old],1010).eventId,'evt-001');
});
test('input/security headers retain duplicate and size checks', () => {
  const h=headers(body()); h[1]='a'.repeat(257);
  assert.throws(()=>verify(body(),h),{code:'WEBHOOK_PROOF_INVALID'});
  assert.throws(()=>verify(body(),[...headers(body()),'X-Platform-Key-Id','test-key']),{code:'WEBHOOK_PROOF_INVALID'});
});
test('input/unrelated headers are not part of proof snapshot', () => {
  assert.equal(verify(body(),[...headers(body()),'X-Extra','ordinary']).eventId,'evt-001');
});
test.after(()=> {
  if (process.env.GREETO_CONFORMANCE_REPORT) writeFileSync(process.env.GREETO_CONFORMANCE_REPORT,JSON.stringify(observations,null,2)+'\n');
});
