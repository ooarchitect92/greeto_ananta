import {decodeSignupCode, decodeSignupMessage, validateCallbackProfile} from './signup-callback-parser.mjs';
import {inspectSignupAttempt} from './signup-attempt-model.mjs';

// Identity-only weak ownership, never callback values. A window source cannot be
// rebound on this page, even after disposal: late messages have no attempt nonce.
const usedSources = new WeakMap();
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)
  && x !== '00000000-0000-0000-0000-000000000000';
const positive = x => Number.isSafeInteger(x) && x > 0;
const scopeOK = x => x && Object.keys(x).length === 3 && ['tenantId','workspaceId','environmentId'].every(k=>uuid(x[k]));
const states = Object.freeze({waiting:'Waiting for the SDK code and signup-session message.',
  recording:'Recording a bounded callback fragment; no acknowledgement yet.',
  recorded:'Both fragments acknowledged by the host. Exchange has not run.',
  recovery_required:'The host result is unknown or invalid. No automatic retry occurred.',
  closing:'Cancellation requested; waiting for the host receipt.',
  cancelled:'The host acknowledged cancellation of this attempt.',
  stopped:'Collection stopped locally. This does not prove server cancellation.',
  expired:'Local collection expired. Server expiry and cleanup remain required.',
  disposed:'Callback listener removed. Previously submitted work may still exist.'});

export class CallbackBridgeError extends Error {
  constructor() { super('META_CALLBACK_BRIDGE_INVALID'); this.name='CallbackBridgeError'; }
}

/** Bind one already-created attempt to its owned SDK callback and message source.
 * @param {object} options Authenticated-host ticket, exact expectedScope, reviewed
 * origin/profile, target Window, and expectedSource WindowProxy. The actual SDK host
 * must establish the source BEFORE messages; no first-message trust or window.open
 * patch is implemented. Missing source qualification must keep launch disabled.
 * @param {object} options.transport Required submit(fragment,signal) and cancel(id,
 * signal). The same-origin authenticated host enforces CSRF/session, restores its
 * correlation channel and invokes unchanged INC-017 receive/close. These methods
 * must resolve only a minimized AttemptView after the exact storage receipt.
 * @param {number} options.operationTimeoutMs Explicit 1..30000-ms transport budget.
 * @param {function} options.clock Browser clock for advisory bounds, NOT authority.
 * @param {function} [options.observe] Synchronous local notification; receives ONLY
 * a minimized snapshot. Must not block. Exceptions cannot change the host outcome.
 * @returns {object} Frozen sdkCallback/retryPending/cancel/snapshot/dispose methods.
 * No SDK loading/launch, fetch endpoint, browser persistence or provider exchange.
 * At most two callback slots, one active transport operation and one cancel intent.
 * No retry is automatic. Reusing the source on the same target is forbidden.
 */
export function bindSignupCallbacks(options) {
  const {target, expectedSource:source, origin, ticket, expectedScope, transport,
    operationTimeoutMs, clock, observe} = options ?? {};
  const invalid = () => { throw new CallbackBridgeError(); };
  if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function'
    || !source || typeof source !== 'object' || source === target
    || !['https://www.facebook.com','https://web.facebook.com'].includes(origin)
    || !scopeOK(expectedScope) || !ticket || !scopeOK(ticket.scope) || !uuid(ticket.attemptId)
    || typeof ticket.appId !== 'string' || !/^[1-9][0-9]{0,63}$/.test(ticket.appId)
    || !positive(ticket.createdAtMs) || !positive(ticket.expiresAtMs)
    || ticket.expiresAtMs <= ticket.createdAtMs || ticket.expiresAtMs-ticket.createdAtMs > 900000
    || Object.keys(expectedScope).some(k=>expectedScope[k]!==ticket.scope[k])
    || !transport || typeof transport.submit !== 'function' || typeof transport.cancel !== 'function'
    || typeof clock !== 'function' || !positive(operationTimeoutMs) || operationTimeoutMs > 30000
    || observe !== undefined && typeof observe !== 'function' || !globalThis.crypto?.subtle) invalid();
  const profile = validateCallbackProfile(options.profile);
  const t = Object.freeze({attemptId:ticket.attemptId, appId:ticket.appId,
    scope:Object.freeze({...expectedScope}), createdAtMs:ticket.createdAtMs, expiresAtMs:ticket.expiresAtMs});
  let now;try{now=clock();}catch{invalid();} if (!positive(now) || now<t.createdAtMs || now>=t.expiresAtMs) invalid();
  const owners = usedSources.get(target) ?? new WeakSet();
  if (owners.has(source)) invalid();
  owners.add(source); usedSources.set(target, owners);
  // Snapshot bound functions, not a mutable caller-controlled port object.
  const submit = transport.submit.bind(transport), close = transport.cancel.bind(transport);
  let state='waiting', lastClock=now, lastView=null, pending=null, disposed=false, closed=false;
  let pumping=false, transportOutstanding=false, cancelledIntent=false, cancelSent=false;
  let diagnostic={stage:'collection',result:'waiting',elapsedMs:0};
  let timer=null, lifeTimer=null, controller=null, pumpPromise=Promise.resolve();
  const slots = {code:null,session:null}, hashing={code:false,session:false};
  const queue=[];
  function stamp() {
    let n;try{n=clock();}catch{stop('stopped');return null;}
    if (!positive(n) || n<lastClock) { stop('stopped'); return null; }
    lastClock=n;
    if(n>=t.expiresAtMs){stop('expired');return null;}
    return n;
  }
  /** Secret-free local status. Time bounds are checked even when browser timers are throttled. */
  function snapshot() {
    if(!closed) stamp();
    return Object.freeze({schemaVersion:1,attemptId:t.attemptId,scope:t.scope,state,message:states[state],
      observedAtMs:lastClock,expiresAtMs:t.expiresAtMs,codeAcknowledged:slots.code?.ack===true,
      sessionAcknowledged:slots.session?.ack===true,exchange:'not_requested',
      canRetry:state==='recovery_required' && !transportOutstanding && pending!==null && !cancelledIntent,
      canLaunch:false,requestId:lastView?.requestId??null,diagnostic:Object.freeze({...diagnostic})});
  }
  function notify(){try{observe?.(snapshot());}catch{/* notifications are not durable receipts */}}
  function detach(){target.removeEventListener('message', listener);if(lifeTimer!==null)clearTimeout(lifeTimer);lifeTimer=null;}
  function clearBodies(){for(const s of Object.values(slots))if(s)s.body=null;queue.length=0;pending=null;}
  function stop(reason) {
    if(closed)return;closed=true;state=reason;detach();controller?.abort();clearBodies();
  }
  const hash = async v => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v)))))
    .map(x=>x.toString(16).padStart(2,'0')).join('');
  function ack(view,kind) {
    const inspected=inspectSignupAttempt(view,t.scope,clock());
    if(!inspected.progress || view.attemptId!==t.attemptId || view.createdAtMs!==t.createdAtMs || view.expiresAtMs!==t.expiresAtMs) return false;
    if(view.version!==1+Number(view.codeReceived)+Number(view.sessionReceived)+Number(['CANCELLED','EXPIRED'].includes(view.status)))return false;
    if(lastView&&(view.version<lastView.version||lastView.codeReceived&&!view.codeReceived||lastView.sessionReceived&&!view.sessionReceived))return false;
    if(kind==='cancel') {if(!['CANCELLED','EXPIRED'].includes(view.status))return false;}
    else if(['CANCELLED','EXPIRED'].includes(view.status) || !view[kind==='code'?'codeReceived':'sessionReceived']) return false;
    lastView=structuredClone(view);return true;
  }
  async function call(kind,body) {
    controller=new AbortController();transportOutstanding=true;const started=performance.now();
    diagnostic={stage:kind==='cancel'?'cancel':'record',result:'pending',elapsedMs:0};
    let abort;
    const timeout=new Promise((_,reject)=>{abort=()=>reject(new CallbackBridgeError());controller.signal.addEventListener('abort',abort,{once:true});});
    const signal=controller.signal;
    timer=setTimeout(()=>controller?.abort(),Math.min(operationTimeoutMs,Math.max(1,t.expiresAtMs-clock())));
    const request=Promise.resolve().then(()=>{if(signal.aborted)throw new CallbackBridgeError();return kind==='cancel'?close(t.attemptId,signal):submit(body,signal);});
    const settled=request.then(v=>{transportOutstanding=false;return v;},()=>{transportOutstanding=false;throw new CallbackBridgeError();});
    try{const result=await Promise.race([settled,timeout]);diagnostic={...diagnostic,result:'response_received'};return result;}
    catch{diagnostic={...diagnostic,result:'unknown'};throw new CallbackBridgeError();}
    finally{diagnostic={...diagnostic,elapsedMs:Math.max(0,Math.round(performance.now()-started))};clearTimeout(timer);timer=null;signal.removeEventListener('abort',abort);controller=null;}
  }
  async function pump() {
    if(pumping||closed||transportOutstanding)return;
    pumping=true;
    try {
      while(!closed && stamp()!==null) {
        if(cancelledIntent) {
          if(cancelSent)return;cancelSent=true;state='closing';notify();
          try{const view=await call('cancel',null);if(!closed&&ack(view,'cancel')){diagnostic={...diagnostic,result:'acknowledged'};stop('cancelled');}else if(!closed){diagnostic={...diagnostic,result:'invalid_receipt'};stop('stopped');}}
          catch{if(!closed)stop('stopped');} notify();return;
        }
        if(state==='recovery_required')return;
        const slot=queue.shift();if(!slot){state=slots.code?.ack&&slots.session?.ack?'recorded':'waiting';notify();return;}
        pending=slot;state='recording';notify();
        try {
          const view=await call(slot.kind,slot.body);
          if(closed)return;
          if(!ack(view,slot.kind)){diagnostic={...diagnostic,result:'invalid_receipt'};throw new CallbackBridgeError();}
          diagnostic={...diagnostic,result:'acknowledged'};slot.ack=true;slot.body=null;pending=null;
        } catch {if(!closed)state='recovery_required';notify();return;}
      }
    } finally {pumping=false;}
  }
  function kick(){if(pumping||transportOutstanding)return pumpPromise;pumpPromise=pump().catch(()=>{if(!closed)stop('stopped');notify();});return pumpPromise;}
  async function accept(fragment) {
    if(closed || cancelledIntent || stamp()===null)return;
    if(fragment.kind==='cancel'){await cancel();return;}
    if(['provider_error','sdk_no_code'].includes(fragment.kind)){stop('stopped');notify();return;}
    const kind=fragment.kind;if(hashing[kind])return;hashing[kind]=true;
    try {
      const fingerprint=await hash(fragment);
      if(closed||cancelledIntent||stamp()===null)return;
      const previous=slots[kind];
      if(previous){if(previous.hash!==fingerprint){stop('stopped');notify();}return;}
      const slot={kind,hash:fingerprint,ack:false,body:Object.freeze({attemptId:t.attemptId,appId:t.appId,...fragment})};
      slots[kind]=slot;queue.push(slot);void kick();
    } catch {if(!closed)stop('stopped');notify();}
    finally{hashing[kind]=false;}
  }
  /** Pass THIS closure only to the SDK call for this attempt. Never reuse it for another login.
   * Resolves after bounded collection, not necessarily the later host acknowledgement. */
  async function sdkCallback(response) {
    if(closed)return;
    try{await accept(decodeSignupCode(response));}catch{diagnostic={stage:'collection',result:'input_rejected',elapsedMs:0};notify();}
  }
  async function listener(event) {
    // Check the native source and EXACT origin before touching payload data.
    if(closed||event.isTrusted!==true||event.origin!==origin||event.source!==source)return;
    try{const fragment=decodeSignupMessage(event.data,profile);if(fragment)await accept(fragment);}catch{diagnostic={stage:'collection',result:'input_rejected',elapsedMs:0};notify();}
  }
  /** Explicitly retry only the identical pending correlation write. No provider request or
   * code exchange occurs. A still-running transport prevents another concurrent call. */
  async function retryPending() {
    if(closed||cancelledIntent||state!=='recovery_required'||transportOutstanding||!pending||stamp()===null)return snapshot();
    // Retrying the same internal recording is not retrying a provider code exchange.
    queue.unshift(pending);pending=null;state='waiting';await kick();return snapshot();
  }
  /** Stop admissions, then ask the authenticated host to cancel after the active call.
   * Uncertain/uncooperative results remain stopped, never a fabricated cancellation ACK. */
  async function cancel() {
    if(closed)return snapshot();cancelledIntent=true;detach();queue.length=0;
    if(!pumping&&!transportOutstanding)await kick();else await pumpPromise;
    if(!closed&&!transportOutstanding)await kick();
    // An uncooperative transport may still be executing. Never grow pending work.
    if(!closed&&transportOutstanding){stop('stopped');notify();}
    return snapshot();
  }
  /** Detach on unmount/session change; abort local waiting and drop retained payload references.
   * Does not undo server writes, unregister assets, or guarantee JavaScript memory erasure. */
  function dispose(){if(disposed)return;disposed=true;stop('disposed');notify();}
  try{target.addEventListener('message',listener);lifeTimer=setTimeout(()=>{stop('expired');notify();},t.expiresAtMs-now);}
  catch{stop('stopped');invalid();}
  notify();
  return Object.freeze({sdkCallback,retryPending,cancel,snapshot,dispose});
}
