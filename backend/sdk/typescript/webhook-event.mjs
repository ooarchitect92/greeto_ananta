/** Server-only F07 event-body binding over the unchanged signature helper.
 * No network, schema lookup, authorization grant, replay claim or HTTP ACK.
 */
import { Buffer } from 'node:buffer';
import { TextDecoder, inspect } from 'node:util';
import { HEADER_NAMES, WebhookProofError, verifyWebhook } from './webhook-signature.mjs';

/** Stable errors omit input, parser positions, headers and key material. */
export class WebhookEventError extends Error {
  constructor(code) { super(code); this.name = 'WebhookEventError'; this.code = code; }
}
const reject = () => { throw new WebhookEventError('WEBHOOK_EVENT_ENVELOPE_INVALID'); };
const integer = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const whole = (pattern, value) => pattern.exec(value)?.[0] === value;
const ID = /^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$/;
const NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

/** Bounded structural reader: decode strings with native JSON.parse, but never
 * materialize arbitrary objects or convert unrelated numeric lexemes. Set tracks
 * duplicate decoded names, including __proto__, without assigning object fields.
 * Root depth=1. Tokens count delimiters, keys and values, not commas/colons.
 */
function bodyIdentity(text, limits) {
  let at = 0, tokens = 0, eventId = '';
  // Per-call regex state; concurrent callers never share a mutable lastIndex.
  const number = new RegExp(NUMBER.source, 'y');
  const space = () => { while (at < text.length && ' \t\r\n'.includes(text[at])) at++; };
  const tick = () => { if (++tokens > limits.maxTokens) reject(); };
  function string() {
    tick(); const start = at++;
    while (at < text.length) {
      const ch = text[at++];
      if (ch === '\\') { at++; continue; }
      if (ch !== '"') continue;
      let value;
      try { value = JSON.parse(text.slice(start, at)); } catch { reject(); }
      for (const point of value) {
        const code = point.codePointAt(0);
        if (code >= 0xD800 && code <= 0xDFFF) reject();
      }
      return value;
    }
    reject();
  }
  function value(depth) {
    space();
    const ch = text[at];
    if (ch === '{' || ch === '[') { container(depth); return null; }
    if (ch === '"') return string();
    tick();
    for (const literal of ['true', 'false', 'null']) {
      if (text.startsWith(literal, at)) { at += literal.length; return null; }
    }
    number.lastIndex = at;
    const match = number.exec(text);
    if (!match) reject();
    at = number.lastIndex;
    return null;
  }
  function container(depth) {
    if (depth > limits.maxDepth) reject();
    const open = text[at++], close = open === '{' ? '}' : ']';
    tick(); space();
    const seen = new Set();
    if (text[at] === close) { at++; tick(); return; }
    for (;;) {
      let key = null;
      if (open === '{') {
        if (text[at] !== '"') reject();
        key = string();
        if (Buffer.byteLength(key, 'utf8') > limits.maxKeyBytes || seen.has(key)) reject();
        seen.add(key);
        if (depth === 1 && key !== 'event_id' && key.toLowerCase() === 'event_id') reject();
        space(); if (text[at++] !== ':') reject();
      }
      const item = value(depth + 1);
      if (depth === 1 && key === 'event_id') {
        if (typeof item !== 'string' || !whole(ID, item)) reject();
        eventId = item;
      }
      space();
      if (text[at] === close) { at++; tick(); return; }
      if (text[at++] !== ',') reject();
      space();
    }
  }
  space(); if (text[at] !== '{') reject();
  container(1); space();
  if (at !== text.length || !eventId) reject();
  return eventId;
}

/** Immutable in-process snapshot, not a bearer token or authorization proof.
 * Factory-only construction prevents accidental public construction. No key or
 * header is retained. Explicit body access is sensitive; normal logging is redacted.
 */
class VerifiedEvent {
  #raw; #id; #proof;
  constructor(raw, id, proof) { this.#raw = raw; this.#id = id; this.#proof = proof; Object.freeze(this); }
  get eventId() { return this.#id; }
  get proof() { return this.#proof; }
  rawBody() { return Buffer.from(this.#raw); }
  toString() { return '[verified webhook event: body omitted]'; }
  toJSON() { return this.toString(); }
  [inspect.custom]() { return this.toString(); }
}

/**
 * @param {Uint8Array} rawBody Exact HTTP bytes before parsing; shared memory rejected.
 * @param {readonly string[]} rawHeaders Duplicate-preserving Node rawHeaders pairs.
 * @param {readonly import('./webhook-signature.mjs').KeyVersion[]} endpointKeys Authorized route-owned ring.
 * @param {number} now Trusted Unix seconds, not an incoming event timestamp.
 * @param {import('./webhook-signature.mjs').Policy} policy Existing signing limits.
 * @param {{maxDepth:number,maxTokens:number,maxKeyBytes:number}} limits Explicit host parser budget.
 * @returns {VerifiedEvent} Identity bound to authenticated bytes; body getter copies.
 * @throws {WebhookProofError|WebhookEventError} Neutral proof/config/envelope/limit errors.
 * Side effects: none. Validate complete schema, subscription and object authority,
 * then atomically persist the receiver's scoped receipt/work before acknowledging.
 * Repeated valid deliveries still pass: this function is NOT a replay ledger.
 */
export function verifyWebhookEvent(rawBody, rawHeaders, endpointKeys, now, policy, limits) {
  if (!limits || !integer(limits.maxDepth, 1, 64) || !integer(limits.maxTokens, 4, 65536) ||
      !integer(limits.maxKeyBytes, 8, 4096)) throw new WebhookEventError('WEBHOOK_EVENT_LIMITS_INVALID');
  if (!policy || !integer(policy.maxBodyBytes, 1, 1048576)) throw new WebhookProofError('WEBHOOK_SIGNING_CONFIG_INVALID');
  if (!(rawBody instanceof Uint8Array) || rawBody.byteLength > policy.maxBodyBytes ||
      (typeof SharedArrayBuffer !== 'undefined' && rawBody.buffer instanceof SharedArrayBuffer) ||
      !Array.isArray(rawHeaders) || rawHeaders.length > 256 || rawHeaders.length % 2 ||
      rawHeaders.some(v => typeof v !== 'string' || v.length > 8192)) throw new WebhookProofError('WEBHOOK_PROOF_INVALID');
  const selected = [];
  for (const name of Object.values(HEADER_NAMES)) {
    let count = 0, found = '';
    for (let i = 0; i < rawHeaders.length; i += 2) {
      if (rawHeaders[i].toLowerCase() === name.toLowerCase()) { count++; found = rawHeaders[i + 1]; }
    }
    if (count !== 1 || Buffer.byteLength(found, 'utf8') > 256) throw new WebhookProofError('WEBHOOK_PROOF_INVALID');
    selected.push(name, found);
  }
  const raw = Buffer.from(rawBody);
  const proof = verifyWebhook(raw, selected, endpointKeys, now, policy);
  // Preserve BOM in decoded text so it fails the JSON root check, like Go/Python.
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); } catch { reject(); }
  const id = bodyIdentity(text, limits);
  if (id !== selected[1]) reject();
  return new VerifiedEvent(raw, id, proof);
}
