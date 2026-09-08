import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { draftKey, saveDraft, loadDraft, clearDraft, clearScopedDrafts } from '../src/shared/state/drafts.js';
import { defaultValues, validateFeature } from '../src/shared/forms/validation.js';

// Synthetic session storage only: these checks do not certify a running browser,
// user authorization, durable storage, encryption, or production data retention.
const scope = { tenantId: 'tenant-a', workspaceId: 'workspace-a', environment: 'preview', userId: 'user-a' };
const schemas = JSON.parse(fs.readFileSync(new URL('../src/contracts/features.json', import.meta.url), 'utf8'));
const mission = schemas.find(f => f.id === 'missions');
const connector = schemas.find(f => f.id === 'connector-studio');
const large = { id: 'test-draft', fields: [{ name: 'text', type: 'textarea' }] };
function storage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v),
    removeItem: k => data.delete(k), key: i => [...data.keys()][i] ?? null, get length() { return data.size; } };
}
function envelope(feature, values) {
  return { schema_version: '1.0', feature_id: feature.id, saved_at: '2026-09-09T00:00:00.000Z', values };
}
function put(store, feature, payload) { store.setItem(draftKey(scope, feature.id), JSON.stringify(payload)); }
function roundTrip(feature, values) {
  const store = storage(); saveDraft(store, scope, feature, values);
  return loadDraft(store, scope, feature).values;
}

for (const feature of schemas.filter(f => f.fields.length)) {
  test(`${feature.id}: partial documented defaults survive save/load unchanged`, () => {
    assert.deepEqual(roundTrip(feature, defaultValues(feature)), defaultValues(feature));
  });
}
test('custom Mission name restores exactly, without applying default or requiring valid business fields', () => {
  const values = { ...defaultValues(mission), name: 'My changed Mission', audience_ref: '' };
  assert.equal(validateFeature(mission, values).valid, false);
  assert.deepEqual(roundTrip(mission, values), values);
});
test('documented Mission name round-trips without replacement by a fixture placeholder', () => {
  const defaults = defaultValues(mission);
  assert.equal(defaults.name, 'Appointment follow-up');
  assert.equal(roundTrip(mission, defaults).name, defaults.name);
  // Store regression only, not a replacement for the existing browser test.
});
test('missing optional/required fields, blanks, false, zero and editing number strings remain drafts', () => {
  const feature = { id: 'test-partial', fields: [
    { name: 'title', type: 'text' }, { name: 'on', type: 'boolean' },
    { name: 'n', type: 'number' }, { name: 'items', type: 'multiselect' }] };
  for (const values of [{}, { title: '' }, { on: false, n: 0, items: [] }, { n: '-' }]) {
    assert.deepEqual(roundTrip(feature, values), values);
  }
});
test('non-ASCII content is preserved as text', () => {
  assert.deepEqual(roundTrip(large, { text: 'नमस्ते 世界 🙂' }), { text: 'नमस्ते 世界 🙂' });
});
for (const [name, value] of [
  ['secret in nested JSON string', '{"nested":{"api_key":"synthetic-marker"}}'],
  ['unsafe key in JSON string', '{"__proto__":{"flag":true}}'],
  ['malformed JSON string', '{"private_customer_note":'],
]) {
  test(`load rejects ${name} without deleting or rewriting the stored draft`, () => {
    const store = storage();
    put(store, connector, envelope(connector, { input_schema: value }));
    const before = store.getItem(draftKey(scope, connector.id));
    assert.throws(() => loadDraft(store, scope, connector));
    assert.equal(store.getItem(draftKey(scope, connector.id)), before);
  });
}
test('JSON errors in save/load never echo the input or parser diagnostics', () => {
  const store = storage(), values = { input_schema: 'private_customer_note=not-json' };
  for (const action of [() => saveDraft(store, scope, connector, values),
    () => { put(store, connector, envelope(connector, values)); loadDraft(store, scope, connector); }]) {
    assert.throws(action, e => !e.message.includes('private_customer_note') && !e.message.includes('not-json'));
  }
});
for (const [name, feature, values] of [
  ['object as text', large, { text: { injected: true } }],
  ['array as text', large, { text: [] }],
  ['text as checkbox', mission, { human_approval_required: 'false' }],
  ['object as number', mission, { budget_minor: {} }],
  ['string as multiselect', mission, { channels: 'whatsapp' }],
  ['object in multiselect', mission, { channels: [{}] }],
]) test(`both boundaries reject ${name}`, () => {
  const store = storage(); assert.throws(() => saveDraft(store, scope, feature, values));
  put(store, feature, envelope(feature, values)); assert.throws(() => loadDraft(store, scope, feature));
});
for (const [name, value] of [['infinity', Infinity], ['NaN', NaN], ['function', () => 1], ['bigint', 1n], ['undefined', undefined], ['Date', new Date()]]) {
  test(`save rejects ${name} instead of silently changing it during JSON serialization`, () => {
    assert.throws(() => saveDraft(storage(), scope, mission, { budget_minor: value }));
  });
}
test('save does not invoke getter or toJSON hooks', () => {
  let invoked = false;
  const values = Object.defineProperty({}, 'name', { enumerable: true, get() { invoked = true; return 'unsafe'; } });
  assert.throws(() => saveDraft(storage(), scope, mission, values)); assert.equal(invoked, false);
  assert.throws(() => saveDraft(storage(), scope, connector, { input_schema: { toJSON() { invoked = true; return {}; } } }));
  assert.equal(invoked, false);
});
test('cyclic, sparse, symbol-keyed and non-plain data are rejected', () => {
  const cycle = {}; cycle.self = cycle;
  for (const values of [{ input_schema: cycle }, { input_schema: new Array(3) },
    { input_schema: { [Symbol('hidden')]: 1 } }, { input_schema: new Map() }]) {
    assert.throws(() => saveDraft(storage(), scope, connector, values));
  }
});
for (const [name, payload] of [
  ['null', null], ['array', []], ['string', 'bad'],
  ['wrong schema', { ...envelope(large, {}), schema_version: '9' }],
  ['wrong feature', { ...envelope(large, {}), feature_id: 'other' }],
  ['array values', envelope(large, [])],
  ['null values', envelope(large, null)],
  ['unknown value', envelope(large, { extra: true })],
  ['unknown metadata', { ...envelope(large, {}), grant: true }],
  ['missing timestamp', { schema_version: '1.0', feature_id: large.id, values: {} }],
  ['impossible date', { ...envelope(large, {}), saved_at: '2026-02-30T00:00:00.000Z' }],
]) test(`load rejects ${name} envelope`, () => {
  const store = storage(); put(store, large, payload); assert.throws(() => loadDraft(store, scope, large));
});
test('64,000-byte limit is enforced before parsing multilingual stored content', () => {
  const store = storage(); const raw = JSON.stringify(envelope(large, { text: '界'.repeat(22000) }));
  assert.ok(raw.length < 64000 && new TextEncoder().encode(raw).length > 64000);
  store.setItem(draftKey(scope, large.id), raw);
  assert.throws(() => loadDraft(store, scope, large), /size limit/);
  assert.throws(() => saveDraft(store, scope, large, { text: '界'.repeat(22000) }), /64/);
});
test('exact byte-size envelope loads; one additional byte does not', () => {
  const empty = JSON.stringify(envelope(large, { text: '' }));
  const raw = JSON.stringify(envelope(large, { text: 'a'.repeat(64000 - new TextEncoder().encode(empty).length) }));
  const store = storage(); store.setItem(draftKey(scope, large.id), raw);
  assert.ok(loadDraft(store, scope, large));
  store.setItem(draftKey(scope, large.id), raw + ' ');
  assert.throws(() => loadDraft(store, scope, large), /size limit/);
});
test('failed validation and quota errors preserve an earlier valid draft', () => {
  const store = storage(); saveDraft(store, scope, mission, { name: 'keep this' });
  const original = store.getItem(draftKey(scope, mission.id));
  assert.throws(() => saveDraft(store, scope, mission, { name: {} }));
  assert.equal(store.getItem(draftKey(scope, mission.id)), original);
  const limited = { ...store, setItem() { throw new Error('private_customer_note'); } };
  assert.throws(() => saveDraft(limited, scope, mission, { name: 'change' }), /could not be saved/);
  assert.equal(store.getItem(draftKey(scope, mission.id)), original);
});
test('get/remove failures use safe messages and do not masquerade as missing data', () => {
  const failing = { getItem() { throw new Error('private_customer_note'); }, removeItem() { throw new Error('private_customer_note'); } };
  assert.throws(() => loadDraft(failing, scope, mission), /storage is unavailable/);
  assert.throws(() => clearDraft(failing, scope, mission.id), e => !e.message.includes('private_customer_note'));
});
test('invalid empty/non-string storage payload is not a missing draft', () => {
  for (const value of ['', {}, 0]) assert.throws(() => loadDraft({ getItem: () => value }, scope, mission));
  assert.equal(loadDraft({ getItem: () => null }, scope, mission), null);
});
test('scope isolation and prefix-safe cleanup preserve all neighboring keys', () => {
  const store = storage(); saveDraft(store, scope, mission, { name: 'mine' });
  const other = { ...scope, userId: 'user-ab' }; saveDraft(store, other, mission, { name: 'other' });
  store.setItem('unrelated', 'keep');
  for (const dimension of Object.keys(scope)) assert.equal(loadDraft(store, { ...scope, [dimension]: 'different' }, mission), null);
  clearScopedDrafts(store, scope);
  assert.equal(loadDraft(store, scope, mission), null);
  assert.equal(loadDraft(store, other, mission).values.name, 'other');
  assert.equal(store.getItem('unrelated'), 'keep');
});
test('loaded values are detached and load never writes', () => {
  const store = storage(); saveDraft(store, scope, mission, { name: 'keep', channels: ['whatsapp'] });
  const first = loadDraft(store, scope, mission); first.values.channels.push('email');
  assert.deepEqual(loadDraft(store, scope, mission).values.channels, ['whatsapp']);
});
