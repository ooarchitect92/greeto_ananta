import { assertSafeData } from '../forms/validation.js';
const PREFIX = 'greeto:frontend-draft:v1:';
const MAX_BYTES = 64000;
/** Per-user session drafts only. No tokens, auth grants or API responses are stored here. */
export function draftKey(scope, featureId) {
  const parts = ['tenantId','workspaceId','environment','userId'].map(k => scope?.[k]);
  if (parts.some(v => typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v))) throw new Error('A complete tenant, workspace, environment and user scope is required to save a draft.');
  if (!/^[a-z][a-z0-9-]{0,80}$/.test(featureId)) throw new Error('Invalid feature ID.');
  return PREFIX + [...parts, featureId].map(encodeURIComponent).join('|');
}
export function saveDraft(storage, scope, feature, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Draft values must be an object.');
  const key = draftKey(scope, feature.id); assertSafeData(values);
  for (const field of feature.fields.filter(f => f.type === 'json')) {
    const raw = values[field.name];
    if (typeof raw === 'string' && raw.trim()) { try { assertSafeData(JSON.parse(raw)); } catch(error) { throw new Error(`Cannot save ${field.name}: ${error.message}`); } }
  }
  const keys = new Set(feature.fields.map(f => f.name));
  if (Object.keys(values).some(k => !keys.has(k))) throw new Error('Unknown draft parameter.');
  const payload = JSON.stringify({schema_version:'1.0', feature_id:feature.id, saved_at: new Date().toISOString(), values});
  if (payload.length > MAX_BYTES) throw new Error('Draft exceeds the 64 KB limit.');
  try {storage.setItem(key, payload);} catch {throw new Error('Draft could not be saved: browser storage is unavailable or full.');}
}
export function loadDraft(storage, scope, feature) {
  const key = draftKey(scope, feature.id);
  let raw; try {raw = storage.getItem(key);} catch {throw new Error('Browser draft storage is unavailable.');}
  if (!raw) return null;
  if (raw.length > MAX_BYTES) throw new Error('Stored draft exceeds the size limit.');
  let payload; try {payload = JSON.parse(raw);} catch {throw new Error('Stored draft is corrupt; reset it before continuing.');}
  assertSafeData(payload);
  if (payload.schema_version !== '1.0' || payload.feature_id !== feature.id || !payload.values || Array.isArray(payload.values) || typeof payload.values !== 'object') throw new Error('Stored draft is incompatible with this feature.');
  const names = new Set(feature.fields.map(f => f.name));
  if (Object.keys(payload.values).some(k => !names.has(k))) throw new Error('Stored draft contains unknown parameters.');
  return payload;
}
export function clearDraft(storage, scope, featureId) { storage.removeItem(draftKey(scope, featureId)); }
export function clearScopedDrafts(storage, scope) {
  const prefix = draftKey(scope, 'scope').slice(0, -'scope'.length);
  for (let index = storage.length - 1; index >= 0; index--) { const key = storage.key(index); if (key?.startsWith(prefix)) storage.removeItem(key); }
}
