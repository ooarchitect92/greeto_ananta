/** Display an authenticated attempt observation; never a source of authorization.
 * @param {unknown} observation Minimized AttemptView from the current server host.
 * @param {unknown} expectedScope Server-derived UUID tuple, not environment labels.
 * @param {number} nowMs Browser time for advisory freshness only.
 * @returns {object} Frozen safe label/counters. Missing, stale, cross-scope or malformed
 * observations are withheld. No state/nonce/code/vault/asset data is ever rendered.
 * No network, storage, provider SDK, launch or exchange occurs. Not server readiness.
 */
export function inspectSignupAttempt(observation, expectedScope, nowMs) {
  const withheld=(state,message)=>Object.freeze({state,message,progress:null,canLaunch:false,canExchange:false});
  if(observation===null||observation===undefined)return withheld('not_observed','No authenticated connection attempt has been supplied.');
  if(!scope(expectedScope)||!positive(nowMs))return withheld('unavailable','Server-owned attempt scope is unavailable.');
  const o=observation;
  if(!shape(o,['schemaVersion','attemptId','scope','status','version','createdAtMs','observedAtMs','requestId','expiresAtMs','codeReceived','sessionReceived','exchange','durable'])
    ||o.schemaVersion!==1||!id(o.attemptId)||!id(o.requestId)||!scope(o.scope)||typeof o.status!=='string'||!Object.hasOwn(labels,o.status)
    ||![o.version,o.createdAtMs,o.observedAtMs,o.expiresAtMs].every(positive)||o.createdAtMs>o.observedAtMs
    ||o.expiresAtMs<=o.createdAtMs||typeof o.codeReceived!=='boolean'||typeof o.sessionReceived!=='boolean'
    ||o.exchange!=='not_requested'||o.durable!==true)return withheld('invalid','Attempt evidence is invalid; details are withheld.');
  if(Object.keys(expectedScope).some(k=>expectedScope[k]!==o.scope[k]))return withheld('scope_mismatch','Attempt evidence belongs to a different scope.');
  if(nowMs<o.observedAtMs||nowMs-o.observedAtMs>30000)return withheld('stale','Refresh the authenticated attempt observation.');
  // Expired evidence cannot make an old callback look actionable. Recorded terminal
  // facts remain visible only within the separate 30-second presentation window.
  if(nowMs>=o.expiresAtMs&&!['CANCELLED','EXPIRED'].includes(o.status))return withheld('stale','The connection attempt has expired; no exchange is enabled.');
  if(o.status==='EXPIRED'&&o.observedAtMs<o.expiresAtMs)return withheld('invalid','Expiry evidence is contradictory.');
  const inferred=o.codeReceived?(o.sessionReceived?'CALLBACK_CORRELATED':'CODE_RECEIVED'):(o.sessionReceived?'SESSION_RECEIVED':'AWAITING_CALLBACK');
  if(!['CANCELLED','EXPIRED'].includes(o.status)&&o.status!==inferred)return withheld('invalid','Callback observations are contradictory.');
  return Object.freeze({state:o.status,message:labels[o.status],canLaunch:false,canExchange:false,
    progress:Object.freeze({attemptId:o.attemptId,version:o.version,codeReceived:o.codeReceived,sessionReceived:o.sessionReceived,
      observedAtMs:o.observedAtMs,expiresAtMs:o.expiresAtMs,requestId:o.requestId})});
}
const labels=Object.freeze({AWAITING_CALLBACK:'Attempt recorded; waiting for the two correlated callback parts.',
  CODE_RECEIVED:'Code custody acknowledged; waiting for signup-session claims.',
  SESSION_RECEIVED:'Session claims recorded; waiting for code custody.',
  CALLBACK_CORRELATED:'Both callback parts recorded. Token exchange and grant verification have not run.',
  CANCELLED:'Attempt cancelled. No account activation or provider deregistration was performed.',
  EXPIRED:'Attempt expiry recorded. Start a new authorized consent attempt.'});
const positive=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0;
const id=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)&&x!=='00000000-0000-0000-0000-000000000000';
function shape(x,keys){
  if(!x||typeof x!=='object'||Array.isArray(x)||![Object.prototype,null].includes(Object.getPrototypeOf(x)))return false;
  const own=Reflect.ownKeys(x);return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k)??{},'value'));
}
function scope(x){return shape(x,['tenantId','workspaceId','environmentId'])&&Object.values(x).every(id);}
