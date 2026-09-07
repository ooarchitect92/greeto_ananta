import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeData, defaultValues, validateFeature, buildHandoff } from '../src/shared/forms/validation.js';
import { draftKey, saveDraft, loadDraft, clearDraft, clearScopedDrafts } from '../src/shared/state/drafts.js';

// Small synthetic fixtures: these test published helpers, not production feature schemas.
const feature = {id:'publication-test', contract:{status:'proposed'}, fields:[
  {name:'title',type:'text',required:true,default:'Example',maxLength:50},
  {name:'limit',type:'number',required:true,default:5,min:1,max:10},
  {name:'enabled',type:'boolean',required:true,default:false},
  {name:'channel',type:'select',required:true,default:'whatsapp',options:['whatsapp','email']},
  {name:'channels',type:'multiselect',required:true,default:['whatsapp'],options:['whatsapp','email']},
  {name:'schema',type:'json',required:true,default:{type:'object'}},
  {name:'url',type:'url',required:true,default:'https://example.com/hook'},
  {name:'expires_at',type:'datetime',required:true,default:'2026-09-07T09:00:00+05:30'},
  {name:'timezone',type:'text',typeHint:'iana-timezone',required:true,default:'Asia/Kolkata'}
]};
const scope={tenantId:'tenant-example',workspaceId:'workspace-example',environment:'development',userId:'user-example'};
const sample=()=>defaultValues(feature);
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};}

test('valid synthetic parameters normalize without executing actions',()=>{const r=validateFeature(feature,sample());assert.equal(r.valid,true);assert.deepEqual(r.values.schema,{type:'object'});});
test('defaults are independent copies',()=>{const a=sample(),b=sample();a.channels.push('email');assert.deepEqual(b.channels,['whatsapp']);});
test('required and unknown parameters are rejected',()=>{assert.equal(validateFeature(feature,{...sample(),title:''}).valid,false);assert.equal(validateFeature(feature,{...sample(),extra:1}).valid,false);assert.equal(validateFeature(feature,null).valid,false);});
test('numbers are finite bounded integers',()=>{for(const limit of [0,11,1.5,Infinity,'text'])assert.equal(validateFeature(feature,{...sample(),limit}).valid,false);});
test('booleans and channel selections are typed',()=>{assert.equal(validateFeature(feature,{...sample(),enabled:'false'}).valid,false);assert.equal(validateFeature(feature,{...sample(),channel:'invented'}).valid,false);assert.equal(validateFeature(feature,{...sample(),channels:['email','email']}).valid,false);});
test('raw credential and prototype-shaped data are rejected',()=>{assert.throws(()=>assertSafeData({access_token:'example'}));assert.throws(()=>assertSafeData(JSON.parse('{"__proto__":{"admin":true}}')));assert.doesNotThrow(()=>assertSafeData({credential_ref:'vault-example'}));});
test('JSON must be structured and within size limits',()=>{for(const schema of ['null','true','5','x'.repeat(16001)])assert.equal(validateFeature(feature,{...sample(),schema}).valid,false);});
test('URL sanity checks reject local and credential-bearing URLs',()=>{for(const url of ['http://example.com','https://localhost','https://127.0.0.1','https://user:pass@example.com','https://example.com/?access_token=example'])assert.equal(validateFeature(feature,{...sample(),url}).valid,false);});
test('date and timezone sanity checks reject invalid values',()=>{assert.equal(validateFeature(feature,{...sample(),expires_at:'2026-02-30T09:00:00Z'}).valid,false);assert.equal(validateFeature(feature,{...sample(),timezone:'Moon/Crater'}).valid,false);});
test('export remains a draft without tenant authorization or execution',()=>{const result=buildHandoff(feature,sample());assert.equal(result.status,'draft');assert.equal(result.execution,'not_requested');assert.equal(result.validation,'browser_only');assert.equal(result.authorization,'server_must_resolve_scope_and_permissions');assert.equal(Object.hasOwn(result,'tenantId'),false);assert.throws(()=>buildHandoff(feature,{}));});
test('draft keys require complete scope and a safe feature identifier',()=>{assert.throws(()=>draftKey({...scope,userId:''},feature.id));assert.throws(()=>draftKey(scope,'../unsafe'));});
test('drafts round-trip and isolate all four scope dimensions',()=>{const store=storage();saveDraft(store,scope,feature,sample());assert.deepEqual(loadDraft(store,scope,feature).values,sample());for(const key of Object.keys(scope))assert.equal(loadDraft(store,{...scope,[key]:'different'},feature),null);});
test('corrupt and incompatible stored drafts are rejected',()=>{const store=storage(),key=draftKey(scope,feature.id);store.setItem(key,'{broken');assert.throws(()=>loadDraft(store,scope,feature));store.setItem(key,JSON.stringify({schema_version:'9',feature_id:feature.id,values:{}}));assert.throws(()=>loadDraft(store,scope,feature));});
test('unsafe embedded JSON and unknown draft fields cannot be saved',()=>{assert.throws(()=>saveDraft(storage(),scope,feature,{...sample(),schema:'{"api_key":"example"}'}));assert.throws(()=>saveDraft(storage(),scope,feature,{...sample(),unknown:true}));assert.throws(()=>saveDraft(storage(),scope,feature,[]));});
test('storage failures are reported rather than treated as success',()=>{assert.throws(()=>saveDraft({setItem(){throw new Error('quota');}},scope,feature,sample()),/could not be saved/);});
test('clearing one scope preserves other users',()=>{const store=storage(),other={...scope,userId:'another-user'};saveDraft(store,scope,feature,sample());saveDraft(store,other,feature,sample());clearScopedDrafts(store,scope);assert.equal(loadDraft(store,scope,feature),null);assert.ok(loadDraft(store,other,feature));clearDraft(store,other,feature.id);assert.equal(store.length,0);});
