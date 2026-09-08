/** Private read-only projection of one persisted F07 outcome, not a public API.
 * @param {object} options Server-resolved expectedScope, authorized observation, now.
 * @returns {object} Safe display state with no unverified customer text or controls.
 * No network, browser storage, signature keys, policy changes or retry side effects.
 * A receiptCommitted field is meaningful only from an authenticated backend adapter.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const token = /^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$/;
const scopeKeys = ['tenantId','workspaceId','environmentId'];
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const scopeOK = s => isObject(s) && Object.keys(s).length === 3 && scopeKeys.every(k => typeof s[k] === 'string' && uuid.test(s[k]) && s[k] !== '00000000-0000-0000-0000-000000000000');
const utc = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19);
const labels = Object.freeze({ACCEPTED_BY_ENDPOINT:'Accepted by endpoint',RETRY_WAIT:'Waiting for retry',FAILED_DELIVERY:'Delivery failed',PAUSED:'Operator attention required',UNKNOWN:'Outcome unknown',BLOCKED:'Blocked before sending'});
const fields = ['scope','deliveryId','attemptId','state','httpStatus','nextAttemptAt','observedAt','expiresAt','receiptCommitted'];
const unavailable = (state,label,detail) => Object.freeze({state,label,detail});
export function deliveryLifecycleView({expectedScope,observation,now=Date.now()}={}) {
 if (!scopeOK(expectedScope)) return unavailable('not_connected','Not connected','An authenticated scope and durable outcome adapter are required.');
 if (observation == null) return unavailable('not_observed','No receipt observed','No persisted delivery result has been supplied for this scope.');
 const o=observation;
 if (!isObject(o) || Object.keys(o).length !== fields.length || !fields.every(k=>Object.hasOwn(o,k)) || !scopeOK(o.scope) || !scopeKeys.every(k=>o.scope[k]===expectedScope[k])) return unavailable('withheld','Observation withheld','The observation is malformed or outside the authorized scope.');
 if (!Number.isFinite(now) || !utc(o.observedAt) || !utc(o.expiresAt) || Date.parse(o.observedAt)>now || Date.parse(o.expiresAt)<=Date.parse(o.observedAt) || Date.parse(o.expiresAt)-Date.parse(o.observedAt)>60000) return unavailable('withheld','Observation withheld','Freshness metadata is invalid.');
 if (Date.parse(o.expiresAt)<=now) return unavailable('stale','Observation expired','Refresh through the authorized backend; no action is inferred.');
 if (o.receiptCommitted!==true || typeof o.deliveryId!=='string' || !token.test(o.deliveryId) || typeof o.attemptId!=='string' || !uuid.test(o.attemptId) || o.attemptId==='00000000-0000-0000-0000-000000000000' || !Object.hasOwn(labels,o.state) || !Number.isInteger(o.httpStatus)) return unavailable('withheld','Receipt not verified','A valid persisted receipt is required; transport results alone are insufficient.');
 const status=o.httpStatus;
 if ((o.state==='ACCEPTED_BY_ENDPOINT' && !(status>=200&&status<=299)) ||
     (['UNKNOWN','BLOCKED'].includes(o.state)&&status!==0) ||
     (o.state==='PAUSED' && !((status>=300&&status<=399)||status===401||status===403)) ||
     (['RETRY_WAIT','FAILED_DELIVERY'].includes(o.state) && !(status===0||(status>=400&&status<=599)))) return unavailable('withheld','Observation withheld','State and HTTP evidence do not agree.');
 if ((o.state==='RETRY_WAIT' && !utc(o.nextAttemptAt)) || (o.state!=='RETRY_WAIT' && o.nextAttemptAt!==null)) return unavailable('withheld','Observation withheld','Only a retry-wait receipt may contain a next-attempt time.');
 let detail='No browser action is enabled. The owning service controls further progression.';
 if(o.state==='UNKNOWN') detail='Retain the unresolved attempt for reconciliation. Expiry does not authorize resending.';
 if(o.state==='ACCEPTED_BY_ENDPOINT') detail='Endpoint acknowledgement and local result receipt are recorded; business completion is separate.';
 if(o.state==='RETRY_WAIT') detail=Date.parse(o.nextAttemptAt)<=now?'Due; waiting for the authorized scheduler. This is not proof that another attempt ran.':'The persisted due time is advisory until the scheduler rechecks current authority and policy.';
 return Object.freeze({state:'observed',label:labels[o.state],detail,deliveryId:o.deliveryId,attemptId:o.attemptId,httpStatus:status,nextAttemptAt:o.nextAttemptAt});
}
export const lifecycleParameters = Object.freeze([
 ['Policy.Version','opaque reference','Pins the immutable profile; no browser overrides.'],
 ['MaxAttempts / MaxAge','integer / duration','Bound automatic retries, not retention of unknown outcomes.'],
 ['RetryDelays','duration array','Explicit minimum waits after each failed attempt; no default is installed.'],
 ['MaxJitterPermille / JitterSample','bounded integers','Positive jitter; the sample is stored once with the attempt.'],
 ['RetryStatusCodes / BeforeSendCodes','allowlists','Only approved transient outcomes can request another attempt.'],
 ['Observation / Receipt','scoped value objects','Endpoint acknowledgement, persisted result and business success remain separate.']
].map(row=>Object.freeze(row)));
