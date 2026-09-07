// Compile-only consumer contract. No generated JS is run or published.
import {signWebhook, verifyWebhook, type KeyVersion, type Policy, type Proof} from './webhook-signature.mjs';
const k: KeyVersion={id:'test-only',secret:new Uint8Array(32),notBefore:1,signUntil:2,verifyUntil:3,revoked:false};
const p: Policy={maxAgeSeconds:300,maxFutureSkewSeconds:30,maxBodyBytes:4096};
const headers=signWebhook(new Uint8Array(), 'evt_example', 'dlv_example', k, 1, p);
const proof: Proof=verifyWebhook(new Uint8Array(), Object.entries(headers).flat(), [k], 1, p);
void proof.bodySha256;
// @ts-expect-error Strings are not original request bytes.
signWebhook('decoded JSON', 'evt_example', 'dlv_example', k, 1, p);
// @ts-expect-error No authenticated eventId is returned from the unsigned header.
void proof.eventId;
// @ts-expect-error Raw headers must preserve original key/value pairs, not an object.
verifyWebhook(new Uint8Array(), headers, [k], 1, p);
