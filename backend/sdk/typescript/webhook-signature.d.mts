/** F07 server-only signing contract. Keys must never be imported into the frontend. */
export interface Policy {
  /** Explicit accepted age in seconds, 1..86400; not a server default. */
  readonly maxAgeSeconds: number;
  /** Allowed future drift in seconds, 0..maxAgeSeconds. */
  readonly maxFutureSkewSeconds: number;
  /** Allowed exact-body bytes, 1..1048576. Empty bodies can authenticate, not validate. */
  readonly maxBodyBytes: number;
}
export interface KeyVersion {
  readonly id: string;
  /** Endpoint/environment-specific random key bytes, 32..4096; not a text password. */
  readonly secret: Uint8Array;
  /** Trusted Unix seconds; signing interval [notBefore, signUntil). */
  readonly notBefore: number;
  readonly signUntil: number;
  /** Verification overlap ends exclusively at verifyUntil. */
  readonly verifyUntil: number;
  readonly revoked: boolean;
}
export interface Proof {
  readonly deliveryId: string;
  readonly keyId: string;
  readonly attemptedAt: number;
  readonly bodySha256: string;
}
export declare const HEADER_NAMES: Readonly<Record<'event'|'delivery'|'timestamp'|'key'|'signature', string>>;
export declare class WebhookProofError extends Error {
  readonly code: 'WEBHOOK_SIGNING_CONFIG_INVALID'|'WEBHOOK_PROOF_INVALID';
  constructor(code: WebhookProofError['code']);
}
/** No network/ledger side effects. Reuse durable delivery ID, refresh attempt time. */
export declare function signWebhook(rawBody: Uint8Array, eventId: string, deliveryId: string, signingKey: KeyVersion, now: number, limits: Policy): Readonly<Record<string,string>>;
/** Authenticates raw bytes, not schema/tenant grants or replay-ledger durability. */
export declare function verifyWebhook(rawBody: Uint8Array, rawHeaders: readonly string[], endpointKeys: readonly KeyVersion[], now: number, limits: Policy): Proof;
