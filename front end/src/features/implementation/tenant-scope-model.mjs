/**
 * Presentation-only decoder for the planned authorized scope observation.
 * This module never grants access, calls a backend or reads browser credentials.
 * Missing/stale observations cannot become a green runtime-readiness claim.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_KEYS = ['tenantId','workspaceId','environmentId'];
const STATES = ['provisioning','active','suspended','erasing'];
const KINDS = ['production','sandbox','shadow'];
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
const validIds = value => isRecord(value) && ID_KEYS.every(key => Object.hasOwn(value,key) && typeof value[key] === 'string' && UUID.test(value[key]) && value[key] !== '00000000-0000-0000-0000-000000000000');
const empty = (state,label,explanation) => ({state,label,explanation,details:[]});
const instant = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return NaN;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0,19)===value.slice(0,19) ? parsed : NaN;
};

/**
 * @param {object} options View inputs from an authorized, future host adapter.
 * @param {object|null} options.expectedScope Current server-resolved scope; no fallback ID.
 * @param {object|null} options.observation Snapshot plus server-owned observedAt/expiresAt.
 * @param {number} options.nowMs Explicit clock for deterministic tests and expiry refresh.
 * @returns {{state:string,label:string,explanation:string,details:Array}} Safe view fields only.
 * No effects. A rendered active lifecycle is NOT authorization or provider readiness.
 */
export function tenantScopeView({expectedScope=null,observation=null,nowMs=Date.now()}={}) {
  if (!validIds(expectedScope) || Object.keys(expectedScope).length !== 3) return empty('scope_required','Authenticated scope required','Select a workspace through the authenticated application. Do not supply tenant authority in a form.');
  if (observation === null) return empty('not_connected','Scope observation not connected','The new scope reader is not connected to a live authenticated API. No database health is inferred.');
  if (!isRecord(observation) || !validIds(observation.snapshot) || !Number.isFinite(nowMs)) return empty('invalid','Observation unavailable','The scope observation is invalid; no identifiers are displayed.');
  const snapshot=observation.snapshot;
  if (ID_KEYS.some(key=>snapshot[key].toLowerCase()!==expectedScope[key].toLowerCase())) return empty('scope_mismatch','Observation rejected','This observation does not belong to the selected scope.');
  const observedAt=instant(observation.observedAt),expiresAt=instant(observation.expiresAt);
  if (!Number.isFinite(observedAt)||!Number.isFinite(expiresAt)||observedAt>nowMs||expiresAt<=observedAt) return empty('invalid','Observation unavailable','Missing, future-dated or invalid observation timestamps.');
  if (expiresAt<=nowMs) return empty('stale','Scope observation expired','Refresh through the authorized service; old lifecycle data cannot demonstrate current readiness.');
  if (Object.keys(snapshot).length!==7 || !['tenantId','workspaceId','environmentId','homeCell','placementEpoch','state','kind'].every(key=>Object.hasOwn(snapshot,key)) || !STATES.includes(snapshot.state)||!KINDS.includes(snapshot.kind)||typeof snapshot.homeCell!=='string'||
      !/^[a-z0-9][a-z0-9_.:-]{0,127}$/.test(snapshot.homeCell)||typeof snapshot.placementEpoch!=='string'||
      !/^[1-9][0-9]{0,18}$/.test(snapshot.placementEpoch)||BigInt(snapshot.placementEpoch)>9223372036854775807n) {
    return empty('invalid','Observation unavailable','The returned lifecycle, environment or placement fields are unsupported.');
  }
  return {state:snapshot.state==='active'?'observed_active':'restricted',label:`Tenant lifecycle: ${snapshot.state}`,
    explanation:snapshot.state==='active'?'An observed active tenant is not proof of channel, backup, security or deployment readiness.':'Inspection is available; this lifecycle does not permit the new status-write guard to authorize a write.',
    details:[...ID_KEYS.map(key=>[key,snapshot[key].toLowerCase()]),['homeCell',snapshot.homeCell],['placementEpoch',snapshot.placementEpoch],['environmentKind',snapshot.kind],['observedAt',observation.observedAt],['expiresAt',observation.expiresAt]]};
}
