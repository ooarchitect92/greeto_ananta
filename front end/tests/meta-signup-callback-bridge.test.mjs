import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindSignupCallbacks,CallbackBridgeError} from '../src/features/channels/meta/signup-callback-bridge.mjs';
const id=n=>`${n}0000000-0000-0000-0000-00000000000${n}`;
const scope={tenantId:id(1),workspaceId:id(2),environmentId:id(3)};
const now=1788912000000;
const profile={finishEvent:'FINISH',cancelEvent:'CANCEL',errorEvent:'ERROR',sessionVersion:null};
const wire=JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{business_id:'10',waba_id:'20'}});
const next=()=>new Promise(r=>setImmediate(r));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await next();}assert.fail('bounded test wait exhausted');}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(t,overrides={}){
  let time=now;const listeners=new Set();
  const target={addEventListener(name,fn){assert.equal(name,'message');listeners.add(fn);},removeEventListener(_name,fn){listeners.delete(fn);}};
  const source={};const ticket={attemptId:id(4),appId:'123',scope,createdAtMs:now,expiresAtMs:now+60000};
  const calls=[],notifications=[];let flags={code:false,session:false};let currentVersion=1;
  const receipt=()=>({schemaVersion:1,attemptId:ticket.attemptId,scope:{...scope},status:flags.code?(flags.session?'CALLBACK_CORRELATED':'CODE_RECEIVED'):(flags.session?'SESSION_RECEIVED':'AWAITING_CALLBACK'),
    version:currentVersion,createdAtMs:now,observedAtMs:time,requestId:id(5),expiresAtMs:ticket.expiresAtMs,
    codeReceived:flags.code,sessionReceived:flags.session,exchange:'not_requested',durable:true});
  const transport={async submit(f){calls.push(f);if(!flags[f.kind]){flags[f.kind]=true;currentVersion++;}return receipt();},
    async cancel(attemptId){calls.push({kind:'cancel',attemptId});const r=receipt();return{...r,status:'CANCELLED',version:r.version+1};}};
  const options={target,expectedSource:source,origin:'https://www.facebook.com',ticket,expectedScope:scope,profile,transport,operationTimeoutMs:1000,clock:()=>time,observe:v=>notifications.push(v),...overrides};
  const bridge=bindSignupCallbacks(options);t.after(()=>bridge.dispose());
  const emit=async(data=wire,changes={})=>{const e={isTrusted:true,origin:options.origin,source,data,...changes};await Promise.all([...listeners].map(fn=>fn(e)));};
  return{bridge,emit,options,calls,listeners,notifications,receipt,transport,setTime:n=>{time=n;}};
}
for(const order of ['code_first','session_first'])test(`${order} uses one serialized host path and keeps exchange not_requested`,async t=>{
  const f=fixture(t);const sdk=()=>f.bridge.sdkCallback({authResponse:{code:'synthetic-code'}});
  if(order==='code_first'){await sdk();await f.emit();}else{await f.emit();await sdk();}
  await until(()=>f.bridge.snapshot().state==='recorded');assert.equal(f.calls.length,2);
  assert.ok(f.calls.every(c=>c.attemptId===id(4)&&c.appId==='123'));assert.equal(f.bridge.snapshot().exchange,'not_requested');
});
for(const [name,change]of[['suffix_origin',{origin:'https://evilfacebook.com'}],['origin_path',{origin:'https://www.facebook.com/x'}],['http_origin',{origin:'http://www.facebook.com'}],['wrong_window',{source:{}}],['no_window',{source:null}],['synthetic_event',{isTrusted:false}]])
  test(`ignore ${name} before reading payload`,async t=>{const f=fixture(t);let reads=0;const e={isTrusted:true,origin:f.options.origin,source:f.options.expectedSource,...change};Object.defineProperty(e,'data',{get(){reads++;throw new Error('must not read');}});await Promise.all([...f.listeners].map(fn=>fn(e)));assert.equal(reads,0);assert.equal(f.calls.length,0);});
test('bound SDK callbacks do not share code between two simultaneous attempts',async t=>{
  const a=fixture(t),b=fixture(t);await a.bridge.sdkCallback({authResponse:{code:'code-A'}});await b.emit();
  await until(()=>a.calls.length===1&&b.calls.length===1);assert.equal(a.bridge.snapshot().sessionAcknowledged,false);assert.equal(b.bridge.snapshot().codeAcknowledged,false);
});
test('same native source cannot be rebound after disposal',t=>{const f=fixture(t);f.bridge.dispose();assert.throws(()=>bindSignupCallbacks(f.options),CallbackBridgeError);});
test('same source on same target is refused while first attempt is active',t=>{const f=fixture(t);assert.throws(()=>bindSignupCallbacks(f.options),CallbackBridgeError);});
test('duplicate recorded code is not posted a second time',async t=>{const f=fixture(t);const r={authResponse:{code:'synthetic-code'}};await f.bridge.sdkCallback(r);await until(()=>f.bridge.snapshot().codeAcknowledged);await f.bridge.sdkCallback(r);assert.equal(f.calls.length,1);});
test('conflicting second code stops local collection without replacing first',async t=>{const f=fixture(t);await f.bridge.sdkCallback({authResponse:{code:'code-A'}});await until(()=>f.bridge.snapshot().codeAcknowledged);await f.bridge.sdkCallback({authResponse:{code:'code-B'}});assert.equal(f.bridge.snapshot().state,'stopped');assert.equal(f.calls.length,1);});
test('reordered asset set is the same duplicate, changed selection is not',async t=>{
  const f=fixture(t),msg=JSON.parse(wire);msg.data.page_ids=['1','2'];await f.emit(JSON.stringify(msg));await until(()=>f.bridge.snapshot().sessionAcknowledged);
  msg.data.page_ids.reverse();await f.emit(JSON.stringify(msg));assert.equal(f.calls.length,1);msg.data.page_ids=['3'];await f.emit(JSON.stringify(msg));assert.equal(f.bridge.snapshot().state,'stopped');
});
test('no acknowledgement while a host call is held, second kind occupies only its bounded slot',async t=>{
  const gate=deferred(),f=fixture(t);const base=f.transport.submit;f.bridge.dispose();
  const g=fixture(t,{transport:{submit:async body=>{await gate.promise;return base(body);},cancel:f.transport.cancel}});
  await g.bridge.sdkCallback({authResponse:{code:'code'}});await g.emit();await next();
  assert.equal(g.bridge.snapshot().codeAcknowledged,false);assert.equal(g.bridge.snapshot().sessionAcknowledged,false);gate.resolve();
  await until(()=>g.bridge.snapshot().state==='recorded');
});
for(const [name,alter]of[['scope',v=>v.scope.tenantId=id(9)],['attempt',v=>v.attemptId=id(9)],['expiry',v=>v.expiresAtMs++],['no_durability',v=>v.durable=false],['raw_field',v=>v.code='synthetic-secret'],['wrong_version',v=>v.version=8],['false_flag',v=>v.codeReceived=false],['future_observation',v=>v.observedAtMs++],['activation',v=>v.exchange='completed']])
 test(`mismatched ${name} receipt never becomes acknowledged`,async t=>{
  const base=fixture(t);base.bridge.dispose();const f=fixture(t,{transport:{submit:async body=>{const r=await base.transport.submit(body);alter(r);return r;},cancel:base.transport.cancel}});
  await f.bridge.sdkCallback({authResponse:{code:'code'}});await until(()=>f.bridge.snapshot().state==='recovery_required');assert.equal(f.bridge.snapshot().codeAcknowledged,false);
 });
test('lost host ACK keeps same payload for explicit retry only',async t=>{
  const base=fixture(t);base.bridge.dispose();let count=0;const f=fixture(t,{transport:{submit:async body=>{const r=await base.transport.submit(body);if(count++===0)throw new Error('private transport reason');return r;},cancel:base.transport.cancel}});
  await f.bridge.sdkCallback({authResponse:{code:'code'}});await until(()=>f.bridge.snapshot().canRetry);assert.equal(count,1);
  await f.bridge.retryPending();assert.equal(count,2);assert.deepEqual(base.calls[0],base.calls[1]);assert.equal(f.bridge.snapshot().codeAcknowledged,true);
});
test('unknown ACK pauses the queued second callback, then resumes after explicit same-fragment retry',async t=>{
  const base=fixture(t);base.bridge.dispose();let fail=true;const f=fixture(t,{transport:{submit:async body=>{if(fail){fail=false;throw new Error();}return base.transport.submit(body);},cancel:base.transport.cancel}});
  await f.bridge.sdkCallback({authResponse:{code:'code'}});await f.emit();await until(()=>f.bridge.snapshot().canRetry);assert.equal(base.calls.length,0);
  await f.bridge.retryPending();await until(()=>f.bridge.snapshot().state==='recorded');assert.equal(base.calls.length,2);
});
test('timeout leaves uncooperative transport bounded; late settlement does not silently certify receipt',async t=>{
  const gate=deferred(),f=fixture(t,{operationTimeoutMs:10,transport:{submit:()=>gate.promise,cancel:async()=>null}});
  await f.bridge.sdkCallback({authResponse:{code:'code'}});await new Promise(r=>setTimeout(r,20));
  assert.equal(f.bridge.snapshot().state,'recovery_required');assert.equal(f.bridge.snapshot().canRetry,false);await f.bridge.retryPending();
  gate.resolve({});await next();assert.equal(f.bridge.snapshot().codeAcknowledged,false);assert.equal(f.bridge.snapshot().canRetry,true);
});
test('host-acknowledged cancellation is distinct from local stop',async t=>{
  const f=fixture(t);await f.emit(JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'CANCEL',data:{current_step:'synthetic-step'}}));
  assert.equal(f.bridge.snapshot().state,'cancelled');assert.equal(f.listeners.size,0);assert.equal(f.calls[0].kind,'cancel');
});
test('cancellation waits for active recording and does not submit a queued session',async t=>{
  const base=fixture(t);base.bridge.dispose();const gate=deferred();const f=fixture(t,{transport:{submit:async body=>{await gate.promise;return base.transport.submit(body);},cancel:base.transport.cancel}});
  await f.bridge.sdkCallback({authResponse:{code:'code'}});await f.emit();const closing=f.bridge.cancel();await next();assert.equal(base.calls.length,0);gate.resolve();await closing;
  assert.equal(f.bridge.snapshot().state,'cancelled');assert.deepEqual(base.calls.map(x=>x.kind),['code','cancel']);
});
test('failed cancel is not labelled durable cancellation',async t=>{const f=fixture(t,{transport:{submit:async()=>null,cancel:async()=>{throw new Error('private');}}});await f.bridge.cancel();assert.equal(f.bridge.snapshot().state,'stopped');});
for(const event of ['ERROR','SDK_NO_CODE'])test(`${event} stops locally without inventing server cancellation`,async t=>{
  const f=fixture(t);if(event==='ERROR')await f.emit(JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event,data:{error_message:'private'}}));else await f.bridge.sdkCallback({});
  assert.equal(f.bridge.snapshot().state,'stopped');assert.equal(f.calls.length,0);
});
test('dispose removes listeners and rejects old SDK closure callbacks',async t=>{const f=fixture(t);f.bridge.dispose();f.bridge.dispose();await f.bridge.sdkCallback({authResponse:{code:'old-code'}});await f.emit();assert.equal(f.listeners.size,0);assert.equal(f.calls.length,0);});
test('local expiry does not depend on timer scheduling',async t=>{const f=fixture(t);f.setTime(now+60000);await f.emit();assert.equal(f.bridge.snapshot().state,'expired');assert.equal(f.calls.length,0);});
test('backwards clock stops collection and cannot extend the attempt',t=>{const f=fixture(t);f.setTime(now-1);assert.equal(f.bridge.snapshot().state,'stopped');});
test('diagnostic observer exceptions cannot alter a matching receipt',async t=>{const f=fixture(t,{observe(){throw new Error('sink');}});await f.bridge.sdkCallback({authResponse:{code:'code'}});await until(()=>f.bridge.snapshot().codeAcknowledged);});
test('snapshots, normal formatting and notifications contain no code, asset data, state or nonce',async t=>{
  const f=fixture(t);await f.bridge.sdkCallback({authResponse:{code:'very-private-synthetic-code'}});await f.emit();await until(()=>f.bridge.snapshot().state==='recorded');
  const text=JSON.stringify({bridge:f.bridge,view:f.bridge.snapshot(),observations:f.notifications});
  for(const secret of ['very-private-synthetic-code','businessId','wabaIds','codeDigest','nonce'])assert.equal(text.includes(secret),false);
});
test('caller ticket mutation cannot change an established bridge binding',async t=>{const f=fixture(t);f.options.ticket.attemptId=id(9);await f.bridge.sdkCallback({authResponse:{code:'code'}});await until(()=>f.calls.length===1);assert.equal(f.calls[0].attemptId,id(4));});
for(const [name,alter]of[['missing_source',x=>x.expectedSource=null],['self_source',x=>x.expectedSource=x.target],['wildcard_origin',x=>x.origin='*'],['oversized_budget',x=>x.operationTimeoutMs=30001],['expired',x=>x.clock=()=>now+60000],['cross_scope',x=>x.expectedScope={...scope,workspaceId:id(9)}],['missing_transport',x=>x.transport=null]])
 test(`binding rejects ${name} before listening`,t=>{const f=fixture(t);f.bridge.dispose();const o={...f.options,expectedSource:{}};alter(o);assert.throws(()=>bindSignupCallbacks(o),CallbackBridgeError);assert.equal(f.listeners.size,0);});
test('malformed message from the selected source reports a neutral rejection without cancellation',async t=>{
 const f=fixture(t);await f.emit('not JSON private');assert.equal(f.bridge.snapshot().state,'waiting');
 assert.equal(f.bridge.snapshot().diagnostic.result,'input_rejected');assert.equal(f.calls.length,0);
});
test('matching host receipt exposes only its request reference and bounded stage timing',async t=>{
 const f=fixture(t);await f.bridge.sdkCallback({authResponse:{code:'code'}});await until(()=>f.bridge.snapshot().codeAcknowledged);
 const v=f.bridge.snapshot();assert.equal(v.requestId,id(5));assert.equal(v.diagnostic.result,'acknowledged');assert.equal(v.diagnostic.stage,'record');assert.ok(v.diagnostic.elapsedMs>=0);
});
test('large concurrent repeats do not allocate an unbounded queue or duplicate a recording',async t=>{
 const gate=deferred(),base=fixture(t);base.bridge.dispose();let count=0;
 const f=fixture(t,{transport:{submit:async body=>{count++;await gate.promise;return base.transport.submit(body);},cancel:base.transport.cancel}});
 await Promise.all(Array.from({length:100},()=>f.bridge.sdkCallback({authResponse:{code:'code'}})));await until(()=>count===1);
 gate.resolve();await until(()=>f.bridge.snapshot().codeAcknowledged);assert.equal(count,1);
});
test('clock exceptions return a stopped snapshot rather than raw integration error',t=>{
 let fail=false;const f=fixture(t,{clock(){if(fail)throw new Error('private');return now;}});fail=true;assert.equal(f.bridge.snapshot().state,'stopped');
});
