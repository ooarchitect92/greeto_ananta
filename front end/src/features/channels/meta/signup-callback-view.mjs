/** Render-only inspection of a LOCAL bridge report, not a server authorization.
 * @param {unknown} observation Safe snapshot emitted by bindSignupCallbacks.
 * @param {unknown} expectedScope Current authenticated UI scope (UUIDs, not labels).
 * @param {number} nowMs Advisory browser time; future/older-than-30s reports withheld.
 * @returns {object} Fixed label and allowlisted facts only. Never uses a supplied
 * message as HTML/text, never exposes code/claims, never enables launch or retries.
 */
export function inspectSignupCallbackBridge(observation, expectedScope, nowMs) {
  const no = message => Object.freeze({message,details:null});
  if(observation===null||observation===undefined)return no('Callback bridge not attached. Live SDK and authenticated host bindings are still required.');
  const o=observation;
  if(!shape(o,['schemaVersion','attemptId','scope','state','message','observedAtMs','expiresAtMs','codeAcknowledged',
    'sessionAcknowledged','exchange','canRetry','canLaunch','requestId','diagnostic']) || o.schemaVersion!==1 || !uuid(o.attemptId)
    || !scope(o.scope) || !scope(expectedScope) || !Object.hasOwn(labels,o.state) || o.exchange!=='not_requested' || o.canLaunch!==false
    || typeof o.codeAcknowledged!=='boolean'||typeof o.sessionAcknowledged!=='boolean'||typeof o.canRetry!=='boolean'
    || !(o.requestId===null||uuid(o.requestId)) || !integer(o.observedAtMs)||!integer(o.expiresAtMs)||!integer(nowMs)
    || !shape(o.diagnostic,['stage','result','elapsedMs']) || !['collection','record','cancel'].includes(o.diagnostic.stage)
    || !['waiting','pending','response_received','acknowledged','invalid_receipt','unknown','input_rejected'].includes(o.diagnostic.result)
    || !Number.isSafeInteger(o.diagnostic.elapsedMs)||o.diagnostic.elapsedMs<0) return no('Callback bridge observation invalid; details withheld.');
  if(Object.keys(expectedScope).some(k=>o.scope[k]!==expectedScope[k]))return no('Callback bridge observation belongs to a different scope.');
  if(nowMs<o.observedAtMs||nowMs-o.observedAtMs>30000)return no('Refresh the local callback bridge observation.');
  if(nowMs>=o.expiresAtMs&&!['cancelled','stopped','expired','disposed'].includes(o.state))return no('Callback collection expired. Server state must be checked separately.');
  if(o.state==='recorded'&&(!o.codeAcknowledged||!o.sessionAcknowledged))return no('Callback bridge observation is contradictory.');
  return Object.freeze({message:labels[o.state],details:Object.freeze({attemptId:o.attemptId,
    codeAcknowledged:o.codeAcknowledged,sessionAcknowledged:o.sessionAcknowledged,
    requestId:o.requestId,stage:o.diagnostic.stage,result:o.diagnostic.result,elapsedMs:o.diagnostic.elapsedMs})});
}
const labels=Object.freeze({waiting:'Local collector waiting for callbacks; no channel activation.',recording:'Callback host request pending; no acknowledgement yet.',
  recorded:'Local bridge observed both host receipts. Token exchange is not requested.',recovery_required:'Host result unknown or invalid. No automatic retry occurred.',
  closing:'Cancellation requested; host receipt pending.',cancelled:'Local bridge observed a cancellation receipt. No asset deregistration.',
  stopped:'Collection stopped locally; this is not proof of server cancellation.',expired:'Local collection expired; server cleanup remains separate.',disposed:'Listener detached; previously submitted work may still exist.'});
const integer=x=>Number.isSafeInteger(x)&&x>0;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)&&x!=='00000000-0000-0000-0000-000000000000';
function shape(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||![Object.prototype,null].includes(Object.getPrototypeOf(x)))return false;
  const own=Reflect.ownKeys(x);return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k)??{},'value'));}
function scope(x){return shape(x,['tenantId','workspaceId','environmentId'])&&Object.values(x).every(uuid);}
