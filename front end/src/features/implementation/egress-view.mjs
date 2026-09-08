/** Read-only presentation of ONE authorized F07 attempt, not aggregate health.
 * @param {object} options Host-authenticated expectedScope, authorized observation,
 * and trusted now (epoch milliseconds). No URL, keys or payload are accepted here.
 * @returns {object} Minimized display state. Invalid/cross-scope/stale observations
 * suppress every result field. This function performs no I/O or authorization.
 */
export function egressView({expectedScope, observation, now = Date.now()} = {}) {
  const missing = (state, reason) => ({state, reason, details: null});
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000';
  const fields = ['tenantId', 'workspaceId', 'environmentId'];
  if (!expectedScope || !fields.every(key => uuid(expectedScope[key])) || !observation) return missing('not_connected', 'Authenticated attempt observations are not connected.');
  if (!fields.every(key => observation.scope?.[key] === expectedScope[key])) return missing('withheld', 'Observation scope does not match this workspace.');
  const utc = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  if (!utc(observation.observedAt) || !utc(observation.expiresAt) || !Number.isFinite(now)) return missing('withheld', 'Observation time is invalid.');
  const from = Date.parse(observation.observedAt), until = Date.parse(observation.expiresAt);
  if (until <= from || until - from > 60000 || from > now) return missing('withheld', 'Observation freshness bounds are invalid.');
  if (until <= now) return missing('stale', 'Refresh through the authorized observation service.');
  const {outcome, statusCode, bodyComplete, responseBytes, failureCode} = observation;
  const codes = ['', 'EGRESS_CONFIGURATION', 'CANCELLED', 'EGRESS_BUSY', 'SCOPE_INVALID', 'REQUEST_TOO_LARGE', 'DESTINATION_INVALID', 'DESTINATION_BLOCKED', 'PORT_BLOCKED', 'HEADERS_INVALID', 'EGRESS_DENIED', 'DNS_UNAVAILABLE', 'ADDRESS_BLOCKED', 'CONNECT_FAILED', 'PEER_MISMATCH', 'TLS_FAILED', 'HTTP_UNAVAILABLE', 'RESPONSE_ENCODING', 'RESPONSE_TOO_LARGE', 'RESPONSE_INCOMPLETE'];
  if (!['blocked','unknown','accepted_by_endpoint','not_accepted'].includes(outcome) || !Number.isInteger(statusCode) || typeof bodyComplete !== 'boolean' || !Number.isInteger(responseBytes) || responseBytes < 0 || responseBytes > 1048577 || !codes.includes(failureCode)) return missing('withheld', 'Attempt observation is invalid.');
  const accepted = statusCode >= 200 && statusCode <= 299;
  if ((outcome === 'accepted_by_endpoint') !== accepted || (['blocked','unknown'].includes(outcome) && (statusCode !== 0 || bodyComplete || responseBytes !== 0)) || (outcome === 'not_accepted' && !((statusCode >= 300 && statusCode <= 599) || statusCode === 101))) return missing('withheld', 'Acknowledgement fields disagree.');
  if ((!bodyComplete && !failureCode) || (bodyComplete && failureCode)) return missing('withheld', 'Incomplete failure evidence.');
  return {state: 'observed', reason: accepted ? 'Endpoint acceptance only; no business or ledger completion is implied.' : outcome === 'unknown' ? 'No conclusive HTTP response. Do not invent success or retry as a new action.' : 'No endpoint acceptance was observed.', details: {outcome, statusCode, bodyComplete, responseBytes, failureCode}};
}

/** Documentation metadata; these are host parameters, never browser authority. */
export const egressParameters = Object.freeze([
  ['Authority.Check', 'context + Intent → error', 'Current workload/Action Gateway permit; exact scope, URL, delivery, attempt and hashes.'],
  ['AllowedPorts', '1–16 unique uint16 ports', 'Explicit approved public HTTPS destination ports; zero is rejected.'],
  ['RequestBytes', '1–4,194,304 bytes', 'Bound on the immutable already-signed request body.'],
  ['ResponseBytes', '1–1,048,576 bytes', 'At most this limit plus one detection byte is read and discarded.'],
  ['ResponseHeaderBytes', '256–65,536 bytes', 'HTTP header parser limit; no response content is exported.'],
  ['Timeout', '100 ms–30 s', 'One deadline covers permit, DNS, TCP, TLS, HTTP and response read.'],
  ['MaxConcurrent', '1–256', 'Immediate refusal when full; no unbounded waiting queue.'],
  ['MaxDNSAnswers', '1–64', 'Every A/AAAA result must pass the public-network policy.'],
]);
