/**
 * Server-side F07 customer-webhook v1 helpers using Node's maintained crypto.
 * Not a browser bundle or a Meta/Telegram callback verifier. No network, logging,
 * key lookup, durable receipt, HTTP ACK or tenant authorization occurs here.
 */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ID = /^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$/;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const TIMESTAMP = /^(0|[1-9][0-9]{0,9})$/;
const SIGNATURE = /^v1=[0-9a-f]{64}$/;
const MAX_UNIX = 9999999999;
export const HEADER_NAMES = Object.freeze({
  event: 'X-Platform-Event-Id', delivery: 'X-Platform-Delivery-Id',
  timestamp: 'X-Platform-Timestamp', key: 'X-Platform-Key-Id',
  signature: 'X-Platform-Signature',
});

/** Stable, payload-free errors. Do not include request data when mapping to HTTP. */
export class WebhookProofError extends Error {
  /** @param {'WEBHOOK_SIGNING_CONFIG_INVALID'|'WEBHOOK_PROOF_INVALID'} code */
  constructor(code) { super(code); this.name = 'WebhookProofError'; this.code = code; }
}
const fail = (config = false) => { throw new WebhookProofError(config ? 'WEBHOOK_SIGNING_CONFIG_INVALID' : 'WEBHOOK_PROOF_INVALID'); };
const integer = (n, lo, hi) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const matches = (pattern, value) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
function bytes(value, config = false) {
  // Copy to make later caller mutation irrelevant. Shared backing memory could
  // mutate during hashing, so it is not an accepted HTTP/secret input here.
  if (!(value instanceof Uint8Array) || (typeof SharedArrayBuffer !== 'undefined' && value.buffer instanceof SharedArrayBuffer)) fail(config);
  return Buffer.from(value);
}
function policy(p, now) {
  if (!p || !integer(now, 0, MAX_UNIX) || !integer(p.maxAgeSeconds, 1, 86400) ||
      !integer(p.maxFutureSkewSeconds, 0, p.maxAgeSeconds) || !integer(p.maxBodyBytes, 1, 1048576)) fail(true);
}
function key(k) {
  if (!k || !matches(KEY_ID, k.id) || !integer(k.notBefore, 0, MAX_UNIX) ||
      !integer(k.signUntil, k.notBefore + 1, MAX_UNIX) || !integer(k.verifyUntil, k.signUntil, MAX_UNIX) || typeof k.revoked !== 'boolean') fail(true);
  if (!(k.secret instanceof Uint8Array) || k.secret.byteLength < 32 || k.secret.byteLength > 4096) fail(true);
  return { ...k, secret: bytes(k.secret, true) };
}
const mac = (body, delivery, at, secret) => createHmac('sha256', secret).update(`${at}.${delivery}.`, 'utf8').update(body).digest();
function one(raw, name) {
  let result, count = 0;
  for (let i = 0; i < raw.length; i += 2) {
    if (raw[i].toLowerCase() === name.toLowerCase()) { result = raw[i + 1]; count++; }
  }
  if (count !== 1) fail();
  return result;
}

/**
 * @param {Uint8Array} rawBody Exact serialized bytes; caller sends these same bytes.
 * @param {string} eventId Stable event ID from the durable authorized delivery.
 * @param {string} deliveryId Stable retry identity; '.' is forbidden as framing.
 * @param {import('./webhook-signature.mjs').KeyVersion} signingKey Route-owned key.
 * @param {number} now Trusted Unix seconds; each attempt obtains a fresh timestamp.
 * @param {import('./webhook-signature.mjs').Policy} limits Explicit endpoint policy.
 * @returns {Readonly<Record<string,string>>} F07 headers; no publication occurs.
 * @throws {WebhookProofError} Invalid config, size, identity or key interval/revocation.
 */
export function signWebhook(rawBody, eventId, deliveryId, signingKey, now, limits) {
  policy(limits, now);
  const k = key(signingKey);
  if (!(rawBody instanceof Uint8Array) || rawBody.byteLength > limits.maxBodyBytes) fail();
  const body = bytes(rawBody);
  if (!matches(ID, eventId) || !matches(ID, deliveryId) || k.revoked || now < k.notBefore || now >= k.signUntil) fail();
  const at = String(now);
  return Object.freeze({
    [HEADER_NAMES.event]: eventId, [HEADER_NAMES.delivery]: deliveryId,
    [HEADER_NAMES.timestamp]: at, [HEADER_NAMES.key]: k.id,
    [HEADER_NAMES.signature]: `v1=${mac(body, deliveryId, at, k.secret).toString('hex')}`,
  });
}

/**
 * @param {Uint8Array} rawBody Original HTTP entity bytes before JSON parsing.
 * @param {readonly string[]} rawHeaders Node IncomingMessage.rawHeaders; do not
 *   collapse duplicates into an object first. Case-insensitive repeats are rejected.
 * @param {readonly import('./webhook-signature.mjs').KeyVersion[]} endpointKeys
 *   One/two keys from authenticated endpoint/environment config, never request URLs.
 * @param {number} now Trusted receiver Unix-second clock, not the event timestamp.
 * @param {import('./webhook-signature.mjs').Policy} limits Explicit freshness/size policy.
 * @returns {import('./webhook-signature.mjs').Proof} Authenticated delivery/body digest.
 *   No trusted eventId: its header is NOT independently signed by the v1 contract.
 * @throws {WebhookProofError} Neutral errors on invalid proof; config errors separate.
 * Side effects: none. Signature success is not a processed-delivery claim or a 2xx.
 * Receiver must validate signed body, atomically record endpoint-scoped delivery ID
 * and body digest with its durable effect/queue, then acknowledge. Fresh retries
 * have new timestamps/signatures but the same delivery ID and body digest.
 */
export function verifyWebhook(rawBody, rawHeaders, endpointKeys, now, limits) {
  policy(limits, now);
  if (!Array.isArray(endpointKeys) || endpointKeys.length < 1 || endpointKeys.length > 2) fail(true);
  const keys = endpointKeys.map(key);
  if (keys.length === 2 && (keys[0].id === keys[1].id || (keys[0].secret.length === keys[1].secret.length && timingSafeEqual(keys[0].secret, keys[1].secret)))) fail(true);
  if (!(rawBody instanceof Uint8Array) || rawBody.byteLength > limits.maxBodyBytes || !Array.isArray(rawHeaders) ||
      rawHeaders.length > 256 || rawHeaders.length % 2 || rawHeaders.some(v => typeof v !== 'string' || v.length > 8192)) fail();
  const body = bytes(rawBody);
  const event = one(rawHeaders, HEADER_NAMES.event), delivery = one(rawHeaders, HEADER_NAMES.delivery);
  const at = one(rawHeaders, HEADER_NAMES.timestamp), kid = one(rawHeaders, HEADER_NAMES.key), sig = one(rawHeaders, HEADER_NAMES.signature);
  if (!matches(ID, event) || !matches(ID, delivery) || !matches(TIMESTAMP, at) || !matches(KEY_ID, kid) || !matches(SIGNATURE, sig)) fail();
  const attemptedAt = Number(at);
  if ((attemptedAt <= now && now - attemptedAt > limits.maxAgeSeconds) ||
      (attemptedAt > now && attemptedAt - now > limits.maxFutureSkewSeconds)) fail();
  const k = keys.find(candidate => candidate.id === kid);
  if (!k || k.revoked || attemptedAt < k.notBefore || attemptedAt >= k.signUntil || now < k.notBefore || now >= k.verifyUntil) fail();
  // Both values are fixed-length Buffers. Timing safety of equality alone does
  // not imply the surrounding application or HTTP handler is timing-safe.
  if (!timingSafeEqual(Buffer.from(sig.slice(3), 'hex'), mac(body, delivery, at, k.secret))) fail();
  return Object.freeze({ deliveryId: delivery, keyId: kid, attemptedAt, bodySha256: createHash('sha256').update(body).digest('hex') });
}
