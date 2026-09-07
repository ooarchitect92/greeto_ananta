import test from 'node:test';
import assert from 'node:assert/strict';
import {outboxView} from '../src/features/implementation/outbox-view.mjs';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const scope={tenantId:id(1),workspaceId:id(2),environmentId:id(3)};
const observedAt='2026-09-07T12:00:00.000Z',expiresAt='2026-09-07T12:00:30.000Z',now=Date.parse(observedAt)+1000;
const observation=()=>({kind:'control_status_outbox_page',source:'authorized_adapter',scope,
  observedAt,expiresAt,counts:{scanned:3,published:1,alreadyPublished:1,pending:1,blocked:0}});
const view=(o=observation(),extra={})=>outboxView({expectedScope:scope,observation:o,now,...extra});
test('missing adapter does not invent zero counts or ready health',()=>{
  assert.equal(outboxView().state,'not_connected');assert.equal(view(null).counts,null);
});
test('missing expected authority scope withholds observations',()=>{
  assert.equal(view(observation(),{expectedScope:null}).state,'not_connected');
});
test('each scope dimension is isolated',()=>{
  for(const key of Object.keys(scope))assert.equal(view({...observation(),scope:{...scope,[key]:id(99)}}).counts,null);
});
test('nil scope UUIDs are rejected',()=>{
  assert.equal(view({...observation(),scope:{...scope,tenantId:id(0)}}).state,'unavailable');
});
test('wrong observation source or kind is not trusted',()=>{
  for(const patch of [{source:'demo'},{kind:'global_health'}])assert.equal(view({...observation(),...patch}).state,'unavailable');
});
test('fresh consistent counts stay a page observation, not readiness',()=>{
  const v=view();assert.equal(v.state,'pending');assert.deepEqual(v.counts,observation().counts);
  assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.counts));
});
test('blocked events remain visibly blocking even when other events published',()=>{
  assert.equal(view({...observation(),counts:{scanned:3,published:2,alreadyPublished:0,pending:0,blocked:1}}).state,'blocked');
});
test('all observed markers do not assert business success or total backlog',()=>{
  const v=view({...observation(),counts:{scanned:2,published:1,alreadyPublished:1,pending:0,blocked:0}});
  assert.equal(v.state,'observed');assert.match(v.reason,/does not prove/);
});
test('empty page is observed, never global healthy',()=>{
  assert.equal(view({...observation(),counts:{scanned:0,published:0,alreadyPublished:0,pending:0,blocked:0}}).state,'observed');
});
test('expiry boundary immediately suppresses counters',()=>{
  const v=view(observation(),{now:Date.parse(expiresAt)});assert.equal(v.state,'stale');assert.equal(v.counts,null);
});
test('future, inverted and excessive freshness intervals are rejected',()=>{
  for(const patch of [{observedAt:expiresAt},{expiresAt:observedAt},{expiresAt:'2026-09-07T12:02:00.000Z'}])
    assert.equal(view({...observation(),...patch}).state,'unavailable');
});
test('invalid clock and noncanonical calendar values withhold counts',()=>{
  for(const patch of [{observedAt:'2026-02-30T12:00:00.000Z'},{expiresAt:'yesterday'}])
    assert.equal(view({...observation(),...patch}).state,'unavailable');
  assert.equal(view(observation(),{now:NaN}).state,'unavailable');
});
test('negative, fractional and oversized counts are rejected',()=>{
  for(const value of [-1,0.5,Infinity,101,'1'])assert.equal(view({...observation(),counts:{...observation().counts,pending:value}}).state,'unavailable');
});
test('missing, extra and inconsistent counters are not filled silently',()=>{
  for(const counts of [{scanned:2},{...observation().counts,scanned:99},{...observation().counts,secret:'do not show'}])
    assert.equal(view({...observation(),counts}).counts,null);
});
test('unrelated raw input fields never appear in the display result',()=>{
  const v=view({...observation(),rawBody:'SECRET',error:'SECRET',credential:'SECRET'});
  assert.equal(JSON.stringify(v).includes('SECRET'),false);
});
