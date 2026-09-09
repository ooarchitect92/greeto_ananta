import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeSignupCode as code,decodeSignupMessage as message,validateCallbackProfile,CallbackInputError} from '../src/features/channels/meta/signup-callback-parser.mjs';
// Synthetic reviewed-profile examples, NOT provider eligibility or supported-version evidence.
const profile={finishEvent:'FINISH',cancelEvent:'CANCEL',errorEvent:'ERROR',sessionVersion:null};
const valid={type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{business_id:'100000000000000001',waba_id:'200000000000000002',phone_number_id:'300000000000000003'}};
const decoded=x=>message(JSON.stringify(x),profile);
const clone=()=>structuredClone(valid);
const reject=fn=>assert.throws(fn,CallbackInputError);

test('sample field names normalize into the existing server claim tuple without integer conversion',()=>{
  assert.deepEqual(decoded(valid),{kind:'session',session:{businessId:valid.data.business_id,wabaIds:[valid.data.waba_id],
    phoneNumberId:valid.data.phone_number_id,pageIds:[],adAccountIds:[],datasetIds:[],catalogIds:[],instagramAccountIds:[]}});
});
test('absent optional phone and WABA do not invent an asset or granted permission',()=>{
  const r=decoded({...valid,data:{business_id:'123'}});assert.equal(r.session.phoneNumberId,null);assert.deepEqual(r.session.wabaIds,[]);
});
test('asset arrays are copied, sorted, frozen and preserve exact string IDs',()=>{
  const d=clone();d.data.page_ids=['9007199254740993','11'];const r=decoded(d);
  assert.deepEqual(r.session.pageIds,['11','9007199254740993']);assert.equal(Object.isFrozen(r.session.pageIds),true);
  d.data.page_ids.push('333');assert.equal(r.session.pageIds.length,2);
});
for(const key of ['page_ids','ad_account_ids','dataset_ids','catalog_ids','instagram_account_ids']){
  test(`normalizes all ${key} selections without dropping one`,()=>{const d=clone();d.data[key]=['2','1'];const r=decoded(d);assert.ok(Object.values(r.session).some(v=>Array.isArray(v)&&v.join() === '1,2'));});
  test(`rejects duplicate ${key}`,()=>{const d=clone();d.data[key]=['1','1'];reject(()=>decoded(d));});
}
for(const [name,mutate]of[
  ['numeric_business_id',d=>d.data.business_id=123],['zero_business_id',d=>d.data.business_id='0'],
  ['missing_business_id',d=>delete d.data.business_id],['numeric_phone_id',d=>d.data.phone_number_id=123],
  ['null_phone_id',d=>d.data.phone_number_id=null],['numeric_waba_id',d=>d.data.waba_id=123],
  ['overlong_id',d=>d.data.waba_id='1'.repeat(65)],['unexpected_scope',d=>d.data.tenant_id='tenant-other'],
  ['raw_secret',d=>d.data.access_token='synthetic-sensitive'],['unexpected_top_level',d=>d.secret='synthetic-sensitive'],
  ['array_instead_of_object',d=>d.data=[]],['null_data',d=>d.data=null],
  ['mixed_id_array',d=>d.data.page_ids=['1',2]],['array_limit',d=>d.data.page_ids=Array.from({length:33},(_,i)=>String(i+1))],
  ['string_not_array',d=>d.data.page_ids='1'],['unreviewed_version',d=>d.version=3],
])test(`parser rejects ${name}`,()=>{const d=clone();mutate(d);reject(()=>decoded(d));});
for(const [name,raw]of[
  ['duplicate_event','{"type":"WA_EMBEDDED_SIGNUP","event":"FINISH","event":"FINISH","data":{}}'],
  ['escaped_duplicate','{"type":"WA_EMBEDDED_SIGNUP","event":"FINISH","data":{"business_id":"1","business\\u005fid":"2"}}'],
  ['trailing_data',JSON.stringify(valid)+'{}'],['unpaired_surrogate',JSON.stringify(valid).replace('FINISH','\\ud800')],
  ['prototype_key','{"__proto__":{},"type":"WA_EMBEDDED_SIGNUP"}'],['truncated','{"type":'],
  ['excessive_depth','{"a":{"b":{"c":{"d":{"e":1}}}}}'],['unsafe_number','{"a":9007199254740993}'],
  ['bad_string_escape','{"a":"\\x00"}'],['root_array','[]'],['root_primitive','null'],
  ['oversized',' '.repeat(32769)],['utf8_size','{"text":"'+'界'.repeat(12000)+'"}'],
])test(`bounded JSON rejects ${name}`,()=>reject(()=>message(raw,profile)));
test('exactly 32 distinct selections and JSON whitespace/escapes are supported',()=>{
  const d=clone();d.data.page_ids=Array.from({length:32},(_,i)=>String(i+1));
  assert.equal(message('\n'+JSON.stringify(d).replace('business_id','business\\u005fid')+'\t',profile).session.pageIds.length,32);
});
test('reviewed version is mandatory when present in the selected profile',()=>{
  assert.equal(message(JSON.stringify({...valid,version:3}),{...profile,sessionVersion:3}).kind,'session');
  reject(()=>message(JSON.stringify(valid),{...profile,sessionVersion:3}));
});
test('unrelated type or intermediate event is ignored, not treated as FINISH',()=>{
  assert.equal(decoded({...valid,type:'OTHER'}),null);assert.equal(decoded({...valid,event:'PARTNER_APP_INSTALLED'}),null);
});
for(const event of ['CANCEL','ERROR'])test(`${event} discards raw diagnostic details`,()=>{
  const r=decoded({...valid,event,data:{error_message:'synthetic-sensitive-note'}});
  assert.equal(r.kind,event==='CANCEL'?'cancel':'provider_error');assert.equal(JSON.stringify(r).includes('sensitive'),false);
});
for(const [name,p]of[
  ['missing',{}],['identical_events',{...profile,cancelEvent:'FINISH'}],['wildcard_event',{...profile,finishEvent:'*'}],
  ['invalid_version',{...profile,sessionVersion:'3'}],['unknown_option',{...profile,approved:true}],
])test(`configuration rejects ${name}`,()=>reject(()=>validateCallbackProfile(p)));
test('profile fields are read from data properties without invoking accessors',()=>{
  const p={...profile};let hits=0;Object.defineProperty(p,'finishEvent',{get(){hits++;return'FINISH';}});
  reject(()=>validateCallbackProfile(p));assert.equal(hits,0);
});
test('SDK extraction returns only code and excludes metadata',()=>{
  assert.deepEqual(code({authResponse:{code:'synthetic-code',userID:'1'},status:'connected'}),{kind:'code',code:'synthetic-code'});
});
test('missing SDK code response is not proof of provider cancellation',()=>{
  assert.deepEqual(code({}),{kind:'sdk_no_code'});assert.deepEqual(code({authResponse:null}),{kind:'sdk_no_code'});
});
for(const [name,value]of[['numeric',1],['blank',''],['space','a b'],['control','a\nb'],['unicode_size','界'.repeat(2800)],['too_long','a'.repeat(8193)],['unpaired','\ud800']])
  test(`SDK rejects ${name} code`,()=>reject(()=>code({authResponse:{code:value}})));
test('SDK accepts exact bounded bytes',()=>assert.equal(code({authResponse:{code:'a'.repeat(8192)}}).code.length,8192));
test('SDK accessors are not executed',()=>{let hits=0;const r={};Object.defineProperty(r,'authResponse',{get(){hits++;return{};}});reject(()=>code(r));assert.equal(hits,0);});
test('SDK code accessor and nonobject input are rejected',()=>{let hits=0;const a={};Object.defineProperty(a,'code',{get(){hits++;return'raw';}});reject(()=>code({authResponse:a}));reject(()=>code(null));assert.equal(hits,0);});
