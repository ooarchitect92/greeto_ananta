/**
 * Read-only evidence projection shared by the operational panel and Node tests.
 * Browser validation improves clarity; the server still owns scope and permission.
 */
const ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const STATES = new Set(['pass','fail','unknown','not_configured','stale','blocked']);
const SCOPE_KEYS = ['tenant_id','workspace_id','environment_id'];

/** @param {unknown} value ISO timestamp with explicit timezone, not local time. */
function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

/**
 * @param {object} snapshot Server response from the authenticated operations API.
 * @param {object} expectedScope Scope resolved by the existing authenticated shell.
 * @returns {object} Allowlisted, bounded evidence; never returns raw headers/bodies.
 * @throws {Error} Stable error only, never provider exception text or credentials.
 */
export function validateRuntimeSnapshot(snapshot, expectedScope) {
  if (!snapshot || snapshot.schema_version !== '1.0' || snapshot.source !== 'runtime' ||
      !timestamp(snapshot.observed_at) || !snapshot.scope || !expectedScope ||
      !SCOPE_KEYS.every(key => typeof expectedScope[key] === 'string' && ID.test(expectedScope[key]) && snapshot.scope[key] === expectedScope[key]) ||
      !Array.isArray(snapshot.checks) || snapshot.checks.length > 256) throw new Error('INVALID_OPERATIONAL_EVIDENCE');
  const seen = new Set();
  const checks = snapshot.checks.map(check => {
    if (!check || typeof check.id !== 'string' || !ID.test(check.id) || seen.has(check.id) || !STATES.has(check.state) ||
        (check.observed_at !== null && !timestamp(check.observed_at)) ||
        !Number.isSafeInteger(check.max_age_seconds) || check.max_age_seconds < 0 || check.max_age_seconds > 86400 ||
        (check.evidence_ref !== null && (typeof check.evidence_ref !== 'string' || !ID.test(check.evidence_ref)))) throw new Error('INVALID_OPERATIONAL_EVIDENCE');
    seen.add(check.id);
    return {id:check.id,state:check.state,observed_at:check.observed_at,max_age_seconds:check.max_age_seconds,evidence_ref:check.evidence_ref};
  });
  return {schema_version:'1.0',source:'runtime',observed_at:snapshot.observed_at,
    scope:Object.fromEntries(SCOPE_KEYS.map(key => [key,expectedScope[key]])),checks};
}

/**
 * @param {string[]} required Dependency IDs for this operation, not the whole SaaS.
 * @param {object|null} snapshot Validated runtime snapshot; repository tests excluded.
 * @param {number} nowMs Injected epoch milliseconds for deterministic freshness tests.
 * @returns {{ready:boolean, checks:object[], blocking:string[]}} Explicit blockers.
 */
export function evaluateReadiness(required, snapshot, nowMs = Date.now()) {
  if (!Array.isArray(required) || !required.length || required.some(id => typeof id !== 'string' || !ID.test(id)) || !Number.isFinite(nowMs)) {
    return {ready:false,checks:[],blocking:['requirements_not_configured']};
  }
  const records = snapshot?.source === 'runtime' && Array.isArray(snapshot.checks) ? snapshot.checks : [];
  const checks = [...new Set(required)].map(id => {
    const matches = records.filter(check => check.id === id);
    const row = matches.length === 1 ? {...matches[0]} : {id,state:'unknown',observed_at:null,max_age_seconds:0,evidence_ref:null};
    if (row.state === 'pass') {
      const time = Date.parse(row.observed_at);
      if (!Number.isFinite(time) || time > nowMs || !Number.isSafeInteger(row.max_age_seconds) || row.max_age_seconds <= 0 || row.max_age_seconds > 86400 || !row.evidence_ref) row.state = 'unknown';
      else if (nowMs - time > row.max_age_seconds * 1000) row.state = 'stale';
    }
    return row;
  });
  const blocking = checks.filter(check => check.state !== 'pass').map(check => check.id);
  return {ready:blocking.length === 0,checks,blocking};
}
