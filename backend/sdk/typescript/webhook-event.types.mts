import {verifyWebhookEvent, type EventLimits} from './webhook-event.mjs';
import type {KeyVersion, Policy, Proof} from './webhook-signature.mjs';
const limits: EventLimits = {maxDepth:8,maxTokens:128,maxKeyBytes:64};
const policy: Policy = {maxAgeSeconds:300,maxFutureSkewSeconds:10,maxBodyBytes:4096};
const key: KeyVersion = {id:'test',secret:new Uint8Array(32),notBefore:1,signUntil:9000,verifyUntil:9100,revoked:false};
// Consumer contract only; this file is compiled with --noEmit, not executed.
const event = verifyWebhookEvent(new Uint8Array(),[],[key],1000,policy,limits);
const id: string = event.eventId;
const raw: Uint8Array = event.rawBody();
const proof: Readonly<Proof> = event.proof;
void [id,raw,proof];
// @ts-expect-error verified metadata is read-only
 event.eventId = 'other';
// @ts-expect-error parser budget cannot omit required bounds
 verifyWebhookEvent(new Uint8Array(),[],[key],1000,policy,{maxDepth:8});
// @ts-expect-error body must remain bytes
 verifyWebhookEvent('{}',[],[key],1000,policy,limits);
// @ts-expect-error headers must preserve duplicate pairs, not a dictionary
 verifyWebhookEvent(new Uint8Array(),{},[key],1000,policy,limits);
