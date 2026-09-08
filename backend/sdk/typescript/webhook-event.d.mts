import type {KeyVersion, Policy, Proof} from './webhook-signature.mjs';
/** Host-owned parser bounds, not a customer permission or runtime default. */
export interface EventLimits {
  readonly maxDepth: number; // 1..64; root object counts as one
  readonly maxTokens: number; // 4..65536; keys, values, opening/closing delimiters
  readonly maxKeyBytes: number; // 8..4096; decoded UTF-8 property-name bytes
}
/** Factory-only, immutable local result; not serializable authority or a receipt. */
declare class VerifiedEvent {
  private constructor();
  readonly eventId: string;
  readonly proof: Readonly<Proof>;
  /** Defensive copy. Sensitive: do not log or rebuild the payload before validation. */
  rawBody(): Uint8Array;
  toString(): string;
  toJSON(): string;
}
export declare class WebhookEventError extends Error {
  readonly code: 'WEBHOOK_EVENT_ENVELOPE_INVALID'|'WEBHOOK_EVENT_LIMITS_INVALID';
  constructor(code: WebhookEventError['code']);
}
/** Verify signature then bind header event ID to a bounded authenticated JSON body.
 * No I/O, full event schema, tenant authorization, replay suppression or HTTP ACK.
 * Throws unchanged WebhookProofError or neutral WebhookEventError. No keys retained.
 */
export declare function verifyWebhookEvent(rawBody: Uint8Array, rawHeaders: readonly string[],
  endpointKeys: readonly KeyVersion[], now: number, policy: Policy, limits: EventLimits): VerifiedEvent;
