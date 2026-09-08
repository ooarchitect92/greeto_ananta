import { assertSafeData } from '../forms/validation.js';

const PREFIX = 'greeto:frontend-draft:v1:';
const MAX_BYTES = 64000;
const encoder = new TextEncoder();
const isRecord = value => value !== null && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/**
 * Build the existing per-user session key; this is separation, NOT authorization.
 * @param {{tenantId:string,workspaceId:string,environment:string,userId:string}} scope
 *   Existing session/preview scope. No value is inferred or granted here.
 * @param {string} featureId Registered lowercase feature ID.
 * @returns {string} Unchanged v1 key; throws before storage access if incomplete.
 */
export function draftKey(scope, featureId) {
  const parts = ['tenantId','workspaceId','environment','userId'].map(k => scope?.[k]);
  if (parts.some(v => typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v))) throw new Error('A complete tenant, workspace, environment and user scope is required to save a draft.');
  if (!/^[a-z][a-z0-9-]{0,80}$/.test(featureId)) throw new Error('Invalid feature ID.');
  return PREFIX + [...parts, featureId].map(encodeURIComponent).join('|');
}

// Reject values JSON.stringify would silently drop/coerce or execute via hooks.
// Descriptors avoid invoking getters. Inputs must be ordinary UI data, not Proxies
// or arbitrary executable objects. This is not a JavaScript sandbox.
function assertPlainData(value, depth = 0) {
  if (depth > 16) throw new Error('Draft data exceeds the nesting limit.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!Array.isArray(value) && !isRecord(value)) throw new Error('Draft data must contain only plain JSON values.');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string')) throw new Error('Draft data contains unsupported keys.');
  const names = keys.filter(key => !(Array.isArray(value) && key === 'length'));
  if (names.length > 500 || (Array.isArray(value) && (value.length !== names.length ||
    names.some((key, index) => key !== String(index))))) throw new Error('Draft data exceeds the collection limit or contains sparse values.');
  for (const key of names) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new Error('Draft data cannot contain accessors or hidden values.');
    assertPlainData(descriptor.value, depth + 1);
  }
}

// Partial/invalid business parameters may be saved for editing. Only the raw UI
// representation and data-safety boundary are checked here. Required fields,
// ranges, capabilities and authorization remain with their existing validators.
function assertDraftValues(feature, values) {
  if (!isRecord(values)) throw new Error('Draft values must be an object.');
  assertPlainData(values);
  assertSafeData(values);
  const fields = new Map(feature.fields.map(field => [field.name, field]));
  for (const [name, value] of Object.entries(values)) {
    const field = fields.get(name);
    if (!field) throw new Error('Draft contains unknown parameters.');
    if (field.type === 'json') {
      // The editor supports structured JSON or JSON text. Recheck embedded text
      // on BOTH save and restore; never display JSON.parse's input-bearing error.
      if (typeof value === 'string' && value.trim()) {
        let parsed;
        try { parsed = JSON.parse(value); } catch { throw new Error('Draft JSON is invalid; correct or reset the draft.'); }
        assertPlainData(parsed);
        assertSafeData(parsed);
      }
      continue;
    }
    const valid = field.type === 'boolean' ? typeof value === 'boolean' :
      field.type === 'number' ? typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) :
      field.type === 'multiselect' ? Array.isArray(value) && value.every(item => typeof item === 'string') :
      typeof value === 'string';
    if (!valid) throw new Error('Draft parameter types do not match this form; reset the draft.');
  }
}

function fits(raw) {
  // Short-circuit huge strings before allocating encoded bytes. The documented
  // bound is bytes, not UTF-16 code units; it applies to the entire envelope.
  return typeof raw === 'string' && raw.length <= MAX_BYTES && encoder.encode(raw).byteLength <= MAX_BYTES;
}

/**
 * Save one partial draft using the existing v1 envelope, with one setItem call.
 * @param {Storage} storage Caller-supplied sessionStorage; no fallback is selected.
 * @param {object} scope Complete session scope consumed by draftKey.
 * @param {{id:string,fields:Array}} feature Code-owned registered field contract.
 * @param {object} values Plain raw editor values, including incomplete parameters.
 * @returns {void} Returns only after setItem succeeds; throws a safe error otherwise.
 * No server write, validation approval, durable ACK, encryption or retry occurs.
 * Validation failure leaves existing storage untouched; quota handling is explicit.
 */
export function saveDraft(storage, scope, feature, values) {
  const key = draftKey(scope, feature.id);
  assertDraftValues(feature, values);
  const payload = JSON.stringify({schema_version:'1.0', feature_id:feature.id, saved_at: new Date().toISOString(), values});
  if (!fits(payload)) throw new Error('Draft exceeds the 64 KB limit (64,000 UTF-8 bytes).');
  try { storage.setItem(key, payload); }
  catch { throw new Error('Draft could not be saved: browser storage is unavailable or full.'); }
}

/**
 * Read a single scoped draft and validate it BEFORE handing values to React.
 * @param {Storage} storage Existing sessionStorage; no network or fallback lookup.
 * @param {object} scope Complete existing session scope, never derived from payload.
 * @param {{id:string,fields:Array}} feature Trusted form contract to restore into.
 * @returns {object|null} Detached v1 payload, or null ONLY for a missing storage key.
 * Corruption/unsafe data/unsupported types throw; no deletion, rewriting, defaults
 * or business validation is performed. saved_at is metadata, not authorization,
 * freshness proof or a new TTL. The UI's existing catch displays the safe message.
 */
export function loadDraft(storage, scope, feature) {
  const key = draftKey(scope, feature.id);
  let raw;
  try { raw = storage.getItem(key); }
  catch { throw new Error('Browser draft storage is unavailable.'); }
  if (raw === null) return null;
  if (!fits(raw)) throw new Error('Stored draft exceeds the size limit or has an invalid representation.');
  let payload;
  try { payload = JSON.parse(raw); }
  catch { throw new Error('Stored draft is corrupt; reset it before continuing.'); }
  if (!isRecord(payload) || payload.schema_version !== '1.0' || payload.feature_id !== feature.id ||
    Object.keys(payload).length !== 4 || !['schema_version','feature_id','saved_at','values'].every(key => Object.hasOwn(payload, key))) {
    throw new Error('Stored draft is incompatible with this feature.');
  }
  const timestamp = payload.saved_at;
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp) ||
    !Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) {
    throw new Error('Stored draft has invalid save metadata; reset it before continuing.');
  }
  assertDraftValues(feature, payload.values);
  return payload;
}

/** Remove only this feature's scoped key. Storage failures throw without raw diagnostics. */
export function clearDraft(storage, scope, featureId) {
  const key = draftKey(scope, featureId);
  try { storage.removeItem(key); }
  catch { throw new Error('Draft could not be cleared: browser storage is unavailable.'); }
}

/**
 * Remove keys for exactly the active four-dimensional scope; preserve other users.
 * @param {Storage} storage Session store; removals are individual, NOT a transaction.
 * @param {object} scope Complete active scope. Invalid scope fails before access.
 * @returns {void} Throws safely on a storage failure; earlier removals may have run.
 * This is browser cleanup only, not sign-out, server revocation or an erasure job.
 */
export function clearScopedDrafts(storage, scope) {
  const prefix = draftKey(scope, 'scope').slice(0, -'scope'.length);
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (typeof key === 'string' && key.startsWith(prefix)) storage.removeItem(key);
    }
  } catch { throw new Error('Scoped drafts could not all be cleared: browser storage is unavailable.'); }
}
