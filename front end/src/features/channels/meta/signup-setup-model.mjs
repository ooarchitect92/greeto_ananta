/** Public setup observation only: never an OAuth grant or executable SDK controller. */
const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ref = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const digits = /^[1-9][0-9]{0,63}$/;
const graph = /^v[1-9][0-9]{0,2}\.[0-9]{1,2}$/;
const version = /^v[1-9][0-9]{0,2}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const feature = /^[a-z][a-z0-9_]{0,63}$/;
const text = (v, re) => typeof v === 'string' && v.length <= 128 && re.test(v);
const integer = v => Number.isSafeInteger(v) && v > 0;
function record(v, fields) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if (![null, Object.prototype].includes(Object.getPrototypeOf(v))) return false;
  const keys = Reflect.ownKeys(v);
  return keys.length === fields.length && keys.every(k => typeof k === 'string' && fields.includes(k)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(v, k) ?? {}, 'value'));
}
function validScope(v) {
  return record(v, ['tenantId', 'workspaceId', 'environmentId']) && Object.values(v).every(x =>
    text(x, id) && x !== '00000000-0000-0000-0000-000000000000');
}

/** Original F02 order, for explanation only. None is marked done by preparation. */
export const META_CONNECTION_STEPS = Object.freeze([
  ['attempt', 'Create a server-owned connection attempt', 'State, nonce, expiry and expected app.'],
  ['consent', 'Open provider-controlled authorization', 'A qualified SDK host is still required.'],
  ['callback', 'Validate the correlated callback', 'Check server session, state, expiry and app.'],
  ['exchange', 'Exchange the code and protect credentials', 'Server-to-server exchange; vault references only.'],
  ['grants', 'Verify granted assets and ownership', 'Browser asset IDs remain untrusted claims.'],
  ['binding', 'Bind the authorized assets', 'Tenant, workspace, environment, cell and epoch.'],
  ['subscription', 'Subscribe the required app and fields', 'Idempotent, with its own acknowledged result.'],
  ['phone', 'Verify or register the number where required', 'Selected onboarding route controls this step.'],
  ['capability', 'Evaluate capability, restriction and billing evidence', 'Missing or stale observations do not pass.'],
  ['probe', 'Run a permitted send-and-receive test', 'Use existing Action Gateway and ingress.'],
  ['completion', 'Report READY or required actions', 'Only independently passed gates establish readiness.'],
].map(([key, label, detail]) => Object.freeze({key, label, detail})));

/**
 * @param {unknown} observation Public DTO from an authenticated host, never a draft.
 * @param {unknown} expectedScope Exact tenant/workspace/environment ID tuple from the
 *   current server session. Do not equate the UI's environment label to environmentId.
 * @param {number} nowMs Current local observation time; server checks remain authoritative.
 * @returns {{state:string, message:string, parameters:Array, payload:string|null, canLaunch:false}}
 * Returns allowlisted display data or a fixed failure reason. No untrusted error/raw
 * object is rendered. Clock rollback, expiry and cross-scope data withhold parameters.
 * Pure: no storage, fetch, SDK, event listener, logging or token/attempt management.
 * A valid DTO is not authenticated by this function, and never enables execution.
 */
export function inspectSignupSetup(observation, expectedScope, nowMs) {
  const empty = (state, message) => Object.freeze({state, message, parameters: Object.freeze([]), payload: null, canLaunch: false});
  if (observation === null || observation === undefined) return empty('not_configured', 'No authenticated Meta setup profile has been supplied.');
  if (!integer(nowMs) || !validScope(expectedScope)) return empty('unavailable', 'A verified scope and current observation time are required.');
  if (!record(observation, ['schemaVersion', 'status', 'execution', 'scope', 'appRef', 'profileId', 'profileRevision', 'appId',
    'graphApiVersion', 'checkedAtMs', 'expiresAtMs', 'loginOptions'])) return empty('invalid', 'The setup observation is invalid.');
  const d = observation;
  if (d.schemaVersion !== 1 || d.status !== 'prepared' || d.execution !== 'not_requested' || !validScope(d.scope)
    || !text(d.appRef, ref) || !text(d.profileId, ref) || !integer(d.profileRevision)
    || !text(d.appId, digits) || !text(d.graphApiVersion, graph)
    || !integer(d.checkedAtMs) || !integer(d.expiresAtMs) || d.checkedAtMs >= d.expiresAtMs)
    return empty('invalid', 'The setup observation is invalid.');
  if (Object.keys(expectedScope).some(k => d.scope[k] !== expectedScope[k]))
    return empty('scope_mismatch', 'Setup evidence does not match the current workspace scope.');
  if (nowMs < d.checkedAtMs || nowMs >= d.expiresAtMs) return empty('stale', 'Setup evidence is expired or its clock is inconsistent. Refresh it through the authorized host.');
  const options = d.loginOptions;
  if (!record(options, ['config_id', 'response_type', 'override_default_response_type', 'extras'])
    || !text(options.config_id, digits) || options.response_type !== 'code' || options.override_default_response_type !== true)
    return empty('invalid', 'The setup observation is invalid.');
  const e = options.extras;
  if (!record(e, ['sessionInfoVersion', 'version', 'features']) && !record(e, ['sessionInfoVersion', 'version', 'features', 'featureType']))
    return empty('invalid', 'The setup observation is invalid.');
  if (e.sessionInfoVersion !== '3' || !text(e.version, version) || (Object.hasOwn(e, 'featureType') && !text(e.featureType, feature))
    || !Array.isArray(e.features) || e.features.length > 16
    || !Array.from(e.features).every(f => record(f, ['name']) && text(f.name, feature))
    || new Set(e.features.map(f => f.name)).size !== e.features.length)
    return empty('invalid', 'The setup observation is invalid.');
  const safeOptions = {config_id: options.config_id, response_type: 'code', override_default_response_type: true,
    extras: {sessionInfoVersion: '3', version: e.version, ...(e.featureType ? {featureType: e.featureType} : {}),
      features: e.features.map(f => ({name: f.name}))}};
  const parameters = [
    ['appId', d.appId], ['graphApiVersion', d.graphApiVersion], ['config_id', options.config_id],
    ['extras.version', e.version], ['extras.sessionInfoVersion', '3'],
    ['extras.featureType', e.featureType || 'Omitted'], ['extras.features', e.features.map(f => f.name).join(', ') || 'None selected'],
  ].map(([name, value]) => Object.freeze({name, value}));
  return Object.freeze({state: 'prepared', message: 'Configuration shape checked. No connection attempt, consent, token exchange or channel activation has occurred.',
    parameters: Object.freeze(parameters), payload: JSON.stringify(safeOptions, null, 2), canLaunch: false});
}
