/** F02 browser adapter for the pinned Meta sample's two callback channels.
 * Source shapes: Fbl4bLauncher.tsx and types/api.ts at
 * 14703a3e1fdba9bcf75b2360b00817b6fcc9f79b. No Meta runtime/version is selected here.
 * Keep docs/architecture/licenses/META_SAMPLE_MIT.txt with derived integrations.
 */
export class CallbackInputError extends Error {
  constructor() { super('META_CALLBACK_INPUT_INVALID'); this.name = 'CallbackInputError'; }
}
const fail = () => { throw new CallbackInputError(); };
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const bytes = s => new TextEncoder().encode(s).length;
const providerID = s => typeof s === 'string' && /^[1-9][0-9]{0,63}$/.test(s);
const word = s => typeof s === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(s);
function dataObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && [Object.prototype, null].includes(Object.getPrototypeOf(v));
}
function unicodeOK(s) {
  for (const c of s) { const n = c.codePointAt(0); if (n >= 0xd800 && n <= 0xdfff) return false; }
  return true;
}
function freeze(v) {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
}

/** Validate a HOST-selected event profile; not independent provider qualification.
 * @param {unknown} input Explicit distinct finish/cancel/error names and nullable
 * numeric sessionVersion. These values must be reviewed for the actual signup route.
 * @returns {object} Frozen profile copy. Throws only CallbackInputError.
 * No defaults, fetches, permissions, external state or runtime registration.
 */
export function validateCallbackProfile(input) {
  const keys = ['finishEvent', 'cancelEvent', 'errorEvent', 'sessionVersion'];
  if (!dataObject(input) || Reflect.ownKeys(input).length !== keys.length
    || !keys.every(k => own(Object.getOwnPropertyDescriptor(input, k) ?? {}, 'value'))) fail();
  if (![input.finishEvent, input.cancelEvent, input.errorEvent].every(word)
    || new Set([input.finishEvent, input.cancelEvent, input.errorEvent]).size !== 3
    || !(input.sessionVersion === null || Number.isSafeInteger(input.sessionVersion)
      && input.sessionVersion >= 1 && input.sessionVersion <= 99)) fail();
  return Object.freeze({...input});
}

// A deliberately bounded JSON reader. JSON.parse owns string/number grammar;
// this tokenizer adds duplicate-member, depth and token limits before any mapping.
// It is private to this narrow callback profile, not an arbitrary JSON service.
function boundedJSON(raw) {
  if (typeof raw !== 'string' || raw.length > 32768 || bytes(raw) > 32768 || !unicodeOK(raw)) fail();
  let at = 0, tokens = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(raw[at] ?? 'x')) at++; };
  function string() {
    const start = at++;
    while (at < raw.length) {
      const c = raw[at++];
      if (c === '\\') at++;
      else if (c === '"') {
        let value; try { value = JSON.parse(raw.slice(start, at)); } catch { fail(); }
        if (!unicodeOK(value)) fail();
        return value;
      }
    }
    fail();
  }
  function value(depth) {
    if (++tokens > 1024 || depth > 4) fail();
    whitespace();
    const c = raw[at];
    if (c === '"') return string();
    if (c === '{') {
      at++; whitespace(); const result = Object.create(null);
      if (raw[at] === '}') { at++; return result; }
      while (at < raw.length) {
        if (++tokens > 1024 || raw[at] !== '"') fail();
        const key = string();
        if (key.length > 80 || ['__proto__', 'prototype', 'constructor'].includes(key) || own(result, key)) fail();
        whitespace(); if (raw[at++] !== ':') fail(); result[key] = value(depth + 1); whitespace();
        const end = raw[at++]; if (end === '}') return result;
        if (end !== ',') fail(); whitespace();
      }
      fail();
    }
    if (c === '[') {
      at++; whitespace(); const result = [];
      if (raw[at] === ']') { at++; return result; }
      while (at < raw.length) {
        if (result.length >= 32) fail(); result.push(value(depth + 1)); whitespace();
        const end = raw[at++]; if (end === ']') return result;
        if (end !== ',') fail(); whitespace();
      }
      fail();
    }
    const match = /^(?:null|true|false|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(raw.slice(at));
    if (!match) fail(); at += match[0].length;
    const result = JSON.parse(match[0]);
    if (typeof result === 'number' && !Number.isSafeInteger(result)) fail();
    return result;
  }
  const result = value(1); whitespace(); if (at !== raw.length || !dataObject(result)) fail();
  return result;
}
const mappings = Object.freeze({page_ids:'pageIds', ad_account_ids:'adAccountIds', dataset_ids:'datasetIds',
  catalog_ids:'catalogIds', instagram_account_ids:'instagramAccountIds'});

/** Map exact-origin/source-filtered string data into the existing INC-017 claims.
 * @param {unknown} raw MessageEvent.data; only bounded JSON TEXT is supported.
 * @param {object} selectedProfile Explicit reviewed event/version profile.
 * @returns {object|null} Frozen session/cancel/provider_error fragment, or null for
 * an unrelated type/event. Session IDs are unverified claims, never tenant authority.
 * @throws {CallbackInputError} For malformed/duplicate/unsupported data. No raw error
 * or diagnostic text is returned. Terminal event data is never copied or interpreted.
 * No code exchange, storage, listener, network, or provider ACK is performed.
 */
export function decodeSignupMessage(raw, selectedProfile) {
  const profile = validateCallbackProfile(selectedProfile);
  const envelope = boundedJSON(raw);
  if (envelope.type !== 'WA_EMBEDDED_SIGNUP') return null;
  if (![profile.finishEvent, profile.cancelEvent, profile.errorEvent].includes(envelope.event)) return null;
  const keys = ['type', 'event', 'data', ...(profile.sessionVersion === null ? [] : ['version'])];
  if (Object.keys(envelope).length !== keys.length || !keys.every(k => own(envelope, k))
    || !dataObject(envelope.data) || profile.sessionVersion !== null && envelope.version !== profile.sessionVersion) fail();
  if (envelope.event === profile.cancelEvent) return Object.freeze({kind:'cancel'});
  if (envelope.event === profile.errorEvent) return Object.freeze({kind:'provider_error'});
  const data = envelope.data;
  const allowed = ['business_id', 'waba_id', 'phone_number_id', ...Object.keys(mappings)];
  if (!providerID(data.business_id) || Object.keys(data).some(k => !allowed.includes(k))) fail();
  const session = {businessId:data.business_id, wabaIds:[], phoneNumberId:null};
  if (own(data, 'waba_id')) { if (!providerID(data.waba_id)) fail(); session.wabaIds.push(data.waba_id); }
  if (own(data, 'phone_number_id')) { if (!providerID(data.phone_number_id)) fail(); session.phoneNumberId = data.phone_number_id; }
  for (const [input, output] of Object.entries(mappings)) {
    const list = own(data, input) ? data[input] : [];
    if (!Array.isArray(list) || list.length > 32 || !list.every(providerID) || new Set(list).size !== list.length) fail();
    session[output] = [...list].sort();
  }
  return freeze({kind:'session', session});
}

/** Extract ONLY the code from the attempt-local FB.login callback, using data
 * descriptors so getters are not invoked. Other SDK response metadata is not copied.
 * @param {unknown} response SDK callback object (not a postMessage or a URL).
 * @returns {object} Frozen code fragment or sdk_no_code; no cancellation inference.
 * @throws {CallbackInputError} On malformed/oversized code or accessor-shaped input.
 * The raw code is sensitive ephemeral data for the authenticated host, never logs/UI.
 */
export function decodeSignupCode(response) {
  if (!dataObject(response) || Reflect.ownKeys(response).length > 16) fail();
  const a = Object.getOwnPropertyDescriptor(response, 'authResponse');
  if (!a) return Object.freeze({kind:'sdk_no_code'});
  if (!own(a, 'value')) fail();
  if (a.value === null) return Object.freeze({kind:'sdk_no_code'});
  if (!dataObject(a.value) || Reflect.ownKeys(a.value).length > 16) fail();
  const c = Object.getOwnPropertyDescriptor(a.value, 'code');
  if (!c || !own(c, 'value') || typeof c.value !== 'string' || c.value.length < 1
    || c.value.length > 8192 || bytes(c.value) > 8192 || !unicodeOK(c.value)
    || /[\x00-\x20\x7f]/.test(c.value)) fail();
  return Object.freeze({kind:'code', code:c.value});
}
