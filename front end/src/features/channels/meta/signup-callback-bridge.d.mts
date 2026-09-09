/** Consumer contract for the opt-in bridge; not an HTTP/API schema or bearer grant. */
export interface Scope {readonly tenantId:string;readonly workspaceId:string;readonly environmentId:string}
export interface Ticket {readonly attemptId:string;readonly appId:string;readonly scope:Scope;readonly createdAtMs:number;readonly expiresAtMs:number}
export interface CallbackProfile {readonly finishEvent:string;readonly cancelEvent:string;readonly errorEvent:string;readonly sessionVersion:number|null}
export interface SessionClaims {
  readonly businessId:string;readonly wabaIds:readonly string[];readonly phoneNumberId:string|null;
  readonly pageIds:readonly string[];readonly adAccountIds:readonly string[];readonly datasetIds:readonly string[];
  readonly catalogIds:readonly string[];readonly instagramAccountIds:readonly string[];
}
export type BridgeFragment=Readonly<{attemptId:string;appId:string} & ({kind:'code';code:string}|{kind:'session';session:SessionClaims})>;
export interface HostAttemptView {
  readonly schemaVersion:1;readonly attemptId:string;readonly scope:Scope;
  readonly status:'AWAITING_CALLBACK'|'CODE_RECEIVED'|'SESSION_RECEIVED'|'CALLBACK_CORRELATED'|'CANCELLED'|'EXPIRED';
  readonly version:number;readonly createdAtMs:number;readonly observedAtMs:number;readonly requestId:string;
  readonly expiresAtMs:number;readonly codeReceived:boolean;readonly sessionReceived:boolean;
  readonly exchange:'not_requested';readonly durable:true;
}
export interface BridgeSnapshot {
  readonly schemaVersion:1;readonly attemptId:string;readonly scope:Scope;
  readonly state:'waiting'|'recording'|'recorded'|'recovery_required'|'closing'|'cancelled'|'stopped'|'expired'|'disposed';
  readonly message:string;readonly observedAtMs:number;readonly expiresAtMs:number;
  readonly codeAcknowledged:boolean;readonly sessionAcknowledged:boolean;readonly exchange:'not_requested';
  readonly canRetry:boolean;readonly canLaunch:false;readonly requestId:string|null;
  readonly diagnostic:Readonly<{stage:string;result:string;elapsedMs:number}>;
}
export interface BridgeOptions {
  readonly target:Window;readonly expectedSource:WindowProxy;readonly origin:'https://www.facebook.com'|'https://web.facebook.com';
  readonly ticket:Ticket;readonly expectedScope:Scope;readonly profile:CallbackProfile;
  readonly transport:{submit(fragment:BridgeFragment,signal:AbortSignal):Promise<HostAttemptView>;
    cancel(attemptId:string,signal:AbortSignal):Promise<HostAttemptView>};
  readonly operationTimeoutMs:number;readonly clock:()=>number;readonly observe?:(snapshot:BridgeSnapshot)=>void;
}
export interface SignupCallbackBridge {
  sdkCallback(response:unknown):Promise<void>;
  retryPending():Promise<BridgeSnapshot>;
  cancel():Promise<BridgeSnapshot>;
  snapshot():BridgeSnapshot;
  dispose():void;
}
export class CallbackBridgeError extends Error {}
export function bindSignupCallbacks(options:BridgeOptions):Readonly<SignupCallbackBridge>;
