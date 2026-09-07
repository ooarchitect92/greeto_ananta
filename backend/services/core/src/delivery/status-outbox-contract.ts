import { parseTenantScope } from '../platform/tenant-scope.js';
import type { TenantScope, PlacementBinding } from '../platform/tenant-scope.js';

/** Internal control-domain payload. This is NOT a new public API or Kafka topic. */
export const STATUS_EVENT = 'delivery.status.changed.v1' as const;
export type DeliveryState = 'Not started' | 'In progress' | 'Blocked' | 'Review' | 'Done';
export interface StatusFact {
  readonly eventId: string;
  readonly eventType: typeof STATUS_EVENT;
  readonly scope: TenantScope;
  readonly baselineId: string;
  readonly workPackageId: string;
  readonly previousStatus: DeliveryState;
  readonly status: DeliveryState;
  /** Exact PostgreSQL bigint text; transport must not round versions to Number. */
  readonly previousVersion: string;
  readonly version: string;
  readonly occurredAt: string;
  readonly payloadRef: string;
}
export interface OutboxCursor { readonly createdAt: string; readonly eventId: string }
export interface PendingPage {
  readonly entries: readonly OutboxCursor[];
  /** Continue this sweep, then restart at null on the NEXT sweep; not a watermark. */
  readonly next: OutboxCursor | null;
}
export interface StoredStatusFact {
  readonly fact: StatusFact;
  readonly payloadSha256: string;
  readonly state: 'pending' | 'published';
}
/** A certified Kafka adapter must only return this after its real durability ACK. */
export interface PublicationAck {
  readonly result: 'committed';
  readonly eventId: string;
  readonly payloadSha256: string;
  readonly acknowledgement: 'configured_quorum';
  readonly transportRef: string;
}
export type PublicationResult = PublicationAck | Readonly<{result:'unknown' | 'rejected'}>;
export interface StatusFactTransport {
  /**
   * Publish the immutable minimized fact through the approved event-envelope/topic
   * adapter. Keep fact.eventId as logical identity on all re-emissions. The hash
   * covers serializeFact(fact), NOT the eventual transport envelope.
   * placement is verified host routing, never supplied by a browser.
   * Honor cancellation/deadline and wait for protocol settlement before returning.
   * No provider send, automatic business action, topic creation or fake ACK.
   */
  publish(fact: StatusFact, payloadSha256: string, placement: PlacementBinding, signal: AbortSignal): Promise<PublicationResult>;
}
export interface StatusOutboxStore {
  readonly scope: TenantScope;
  readonly placement: PlacementBinding;
  listPending(cursor: OutboxCursor | null, limit: number, signal: AbortSignal): Promise<PendingPage>;
  load(eventId: string, signal: AbortSignal): Promise<StoredStatusFact | null>;
  /** Re-read/lock and match exact fact identity/hash. Success only after SQL COMMIT. */
  confirmPublished(ack: PublicationAck, signal: AbortSignal): Promise<void>;
}
export interface OutboxAuthority {
  /** Resolve workload identity and current object-level publish grant; fail closed. */
  requirePublish(workerId: string, scope: TenantScope, signal: AbortSignal): Promise<void>;
}
export type OutboxCode = 'INVALID_INPUT' | 'CONFIGURATION' | 'AUTHORIZATION_UNAVAILABLE' |
  'SCOPE_UNAVAILABLE' | 'PLACEMENT_MISMATCH' | 'SCOPE_INACTIVE' | 'STORE_UNAVAILABLE' |
  'COMMIT_UNKNOWN' | 'FACT_UNRESOLVED' | 'FACT_CHANGED' | 'ACK_INVALID' | 'CANCELLED' | 'BUSY';
/** Only stable codes cross this boundary; no driver/credential/payload error text. */
export class OutboxError extends Error {
  constructor(public readonly code: OutboxCode) { super(code); this.name='OutboxError'; }
}
export const requireId = (v: unknown): string => {
  if (typeof v!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ||
      v==='00000000-0000-0000-0000-000000000000') throw new OutboxError('INVALID_INPUT');
  return v;
};
export const requireHash = (v: unknown): string => {
  if (typeof v!=='string' || !/^[0-9a-f]{64}$/.test(v)) throw new OutboxError('INVALID_INPUT');
  return v;
};
export function exactRecord(v: unknown, keys: readonly string[]): Record<string,unknown> {
  if (!v || typeof v!=='object' || Array.isArray(v) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(v)) ||
      Object.keys(v).length!==keys.length || keys.some(k=>!Object.hasOwn(v,k))) throw new OutboxError('INVALID_INPUT');
  return v as Record<string,unknown>;
}
/** Exact UTC microseconds survive keyset pagination, including same-millisecond rows. */
export function requireTime(v: unknown): string {
  if (typeof v!=='string' || !/^[1-9]\d{3}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}Z$/.test(v)) throw new OutboxError('INVALID_INPUT');
  const date=new Date(v);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,19)!==v.slice(0,19)) throw new OutboxError('INVALID_INPUT');
  return v;
}
/** Syntax only; scope must already be independently authorized by the host. */
export function decodeCursor(value: unknown): OutboxCursor {
  const v=exactRecord(value,['createdAt','eventId']);
  return Object.freeze({createdAt:requireTime(v.createdAt),eventId:requireId(v.eventId)});
}
const states: readonly string[] = ['Not started','In progress','Blocked','Review','Done'];
const state = (v:unknown):DeliveryState => {
  if(typeof v!=='string'||!states.includes(v)) throw new OutboxError('INVALID_INPUT');
  return v as DeliveryState;
};
const version = (v:unknown):string => {
  if(typeof v!=='string'||!/^[1-9]\d{0,18}$/.test(v)||BigInt(v)>9223372036854775807n) throw new OutboxError('INVALID_INPUT');
  return v;
};
/**
 * Decode a minimized, committed status history fact. Never include actor identity,
 * raw evidence, tokens, reason text or idempotency keys in this transport payload.
 * A persisted Done status is a fact ABOUT the record, not new release approval.
 */
export function decodeFact(value: unknown): StatusFact {
  const v=exactRecord(value,['eventId','eventType','scope','baselineId','workPackageId','previousStatus','status','previousVersion','version','occurredAt','payloadRef']);
  const eventId=requireId(v.eventId);
  if(v.eventType!==STATUS_EVENT || v.payloadRef!==`delivery-status:${eventId}` ||
     typeof v.workPackageId!=='string'||!/^[A-Z]{2,4}-[0-9]{3}$/.test(v.workPackageId)) throw new OutboxError('INVALID_INPUT');
  const before=version(v.previousVersion), after=version(v.version);
  if(BigInt(after)!==BigInt(before)+1n) throw new OutboxError('INVALID_INPUT');
  return Object.freeze({eventId,eventType:STATUS_EVENT,scope:parseTenantScope(v.scope),
    baselineId:requireId(v.baselineId),workPackageId:v.workPackageId,
    previousStatus:state(v.previousStatus),status:state(v.status),
    previousVersion:before,version:after,occurredAt:requireTime(v.occurredAt),payloadRef:`delivery-status:${eventId}`});
}
/** Canonical field order and UTF-8 JSON; independent of source property insertion order. */
export function serializeFact(value: StatusFact): string { return JSON.stringify(decodeFact(value)); }
/** No salt or random request/attempt ID: unchanged facts have unchanged digests on retry. */
export async function hashFact(value: StatusFact): Promise<string> {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serializeFact(value)));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
/** This validates a trusted adapter's receipt shape, not the real broker configuration. */
export function decodeAck(value: unknown): PublicationAck {
  try {
    const v=exactRecord(value,['result','eventId','payloadSha256','acknowledgement','transportRef']);
    if(v.result!=='committed'||v.acknowledgement!=='configured_quorum'||typeof v.transportRef!=='string'||
       !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,255}$/.test(v.transportRef)) throw new OutboxError('ACK_INVALID');
    return Object.freeze({result:'committed',eventId:requireId(v.eventId),payloadSha256:requireHash(v.payloadSha256),
      acknowledgement:'configured_quorum',transportRef:v.transportRef});
  } catch { throw new OutboxError('ACK_INVALID'); }
}
/** Compare only the already-authenticated tuple; matching strings alone grant nothing. */
export function sameScope(a: TenantScope,b: TenantScope): boolean {
  return a.tenantId===b.tenantId&&a.workspaceId===b.workspaceId&&a.environmentId===b.environmentId;
}
