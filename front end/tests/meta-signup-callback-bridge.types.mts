import {bindSignupCallbacks, type BridgeOptions, type BridgeSnapshot, type BridgeFragment} from '../src/features/channels/meta/signup-callback-bridge.mjs';
declare const options:BridgeOptions;
const bridge=bindSignupCallbacks(options);
const snapshot:BridgeSnapshot=bridge.snapshot();
const cannotLaunch:false=snapshot.canLaunch;
void cannotLaunch;
// @ts-expect-error snapshots cannot activate signup
snapshot.canLaunch=true;
// @ts-expect-error no raw code is exposed in diagnostic data
snapshot.code;
// @ts-expect-error state/nonce remain in the server-owned correlation channel
snapshot.nonce;
declare const fragment:BridgeFragment;
// @ts-expect-error readonly attempt identity
fragment.attemptId='changed';
// @ts-expect-error missing required source and authority-bound transport
bindSignupCallbacks({});
void bridge.sdkCallback({authResponse:{code:'synthetic-code'}});
