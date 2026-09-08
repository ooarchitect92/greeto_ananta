// Login-option construction is adapted from Meta Platforms, Inc. and affiliates.
// Upstream: ClientDashboard.tsx:computeEsConfig at 14703a3e1fdba9bcf75b2360b00817b6fcc9f79b.
// Retained license: docs/architecture/licenses/META_SAMPLE_MIT.txt.
// Greeto additions: explicit scope/version/evidence checks and minimized output.

/** In-process inputs, NOT a new public API or an authorization implementation. */
export interface SetupScope {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly environmentId: string;
}
export interface SetupContext {
  readonly scope: SetupScope;
  readonly actorId: string;
  readonly appRef: string;
  readonly profileId: string;
  readonly profileRevision: number;
  readonly nowMs: number;
}
export interface SignupProfile {
  readonly schemaVersion: 1;
  readonly scope: SetupScope;
  readonly appRef: string;
  readonly profileId: string;
  readonly profileRevision: number;
  readonly appId: string;
  readonly configId: string;
  readonly graphApiVersion: string;
  readonly signupVersion: string;
  readonly featureType: string;
  readonly features: readonly string[];
  readonly enabled: boolean;
  readonly evidence: {
    readonly status: 'unverified' | 'verified' | 'revoked';
    readonly sourceRef: string;
    readonly reviewedAtMs: number;
    readonly expiresAtMs: number;
  };
}
export interface LoginOptions {
  readonly config_id: string;
  readonly response_type: 'code';
  readonly override_default_response_type: true;
  readonly extras: {
    readonly sessionInfoVersion: '3';
    readonly version: string;
    readonly featureType?: string;
    readonly features: readonly { readonly name: string }[];
  };
}
export interface PreparedSignup {
  readonly schemaVersion: 1;
  readonly status: 'prepared';
  readonly execution: 'not_requested';
  readonly scope: SetupScope;
  readonly appRef: string;
  readonly profileId: string;
  readonly profileRevision: number;
  readonly appId: string;
  readonly graphApiVersion: string;
  readonly checkedAtMs: number;
  readonly expiresAtMs: number;
  readonly loginOptions: LoginOptions;
}
export type SetupErrorCode = 'META_SETUP_CONTEXT_INVALID' | 'META_SETUP_NOT_CONFIGURED'
  | 'META_SETUP_PROFILE_INVALID' | 'META_SETUP_SCOPE_MISMATCH' | 'META_SETUP_DISABLED'
  | 'META_SETUP_EVIDENCE_REQUIRED' | 'META_SETUP_REVOKED' | 'META_SETUP_STALE';

/** Neutral error: never includes input, provider identifiers, keys or raw causes. */
export class SetupError extends Error {
  constructor(readonly code: SetupErrorCode) {
    super(code);
    this.name = 'SetupError';
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ref = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const providerId = /^[1-9][0-9]{0,63}$/;
const feature = /^[a-z][a-z0-9_]{0,63}$/;
const graph = /^v[1-9][0-9]{0,2}\.[0-9]{1,2}$/;
const signup = /^v[1-9][0-9]{0,2}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const isText = (v: unknown, pattern: RegExp): v is string => typeof v === 'string' && v.length <= 128 && pattern.test(v);
const isId = (v: unknown): v is string => isText(v, uuid) && v !== '00000000-0000-0000-0000-000000000000';
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

// Only ordinary data objects with precisely documented fields are accepted. These
// checks are not a sandbox for malicious in-process code or arbitrary JS proxies.
function record(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return false;
  const ownKeys = Reflect.ownKeys(v);
  return ownKeys.length === keys.length && ownKeys.every(k => typeof k === 'string' && keys.includes(k)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(v, k) ?? {}, 'value'));
}
function isScope(v: unknown): v is SetupScope {
  return record(v, ['tenantId', 'workspaceId', 'environmentId'])
    && isId(v.tenantId) && isId(v.workspaceId) && isId(v.environmentId);
}
function isContext(v: unknown): v is SetupContext {
  return record(v, ['scope', 'actorId', 'appRef', 'profileId', 'profileRevision', 'nowMs'])
    && isScope(v.scope) && isId(v.actorId) && isText(v.appRef, ref) && isText(v.profileId, ref)
    && integer(v.profileRevision) && integer(v.nowMs);
}
function isProfile(v: unknown): v is SignupProfile {
  if (!record(v, ['schemaVersion', 'scope', 'appRef', 'profileId', 'profileRevision', 'appId', 'configId',
    'graphApiVersion', 'signupVersion', 'featureType', 'features', 'enabled', 'evidence'])) return false;
  const e = v.evidence;
  return v.schemaVersion === 1 && isScope(v.scope) && isText(v.appRef, ref) && isText(v.profileId, ref)
    && integer(v.profileRevision) && isText(v.appId, providerId) && isText(v.configId, providerId)
    && isText(v.graphApiVersion, graph) && isText(v.signupVersion, signup)
    && (v.featureType === '' || isText(v.featureType, feature)) && typeof v.enabled === 'boolean'
    && Array.isArray(v.features) && v.features.length <= 16
    && Array.from(v.features).every(x => isText(x, feature)) && new Set(v.features).size === v.features.length
    && record(e, ['status', 'sourceRef', 'reviewedAtMs', 'expiresAtMs'])
    && typeof e.status === 'string' && ['unverified', 'verified', 'revoked'].includes(e.status)
    && isText(e.sourceRef, ref) && integer(e.reviewedAtMs) && integer(e.expiresAtMs)
    && e.reviewedAtMs < e.expiresAtMs;
}

/**
 * Prepare the sample-compatible PUBLIC login options for one selected registry profile.
 * @param profile Unknown data loaded from the server-owned configuration registry.
 *   NEVER accept it from a caller's request, query string or browser draft. The
 *   authenticated host must authorize the actor/object and qualify provider evidence.
 * @param context Server-derived scope, actor, exact selected profile/app/revision and
 *   current time in Unix milliseconds. It is not user-supplied authority or a clock.
 * @returns A deeply frozen, public-only snapshot labelled prepared/not_requested.
 *   It grants no permission, contains no connection attempt and does not mean READY.
 * @throws SetupError for malformed, mismatched, disabled, unverified, revoked or stale
 *   input. All messages are fixed codes. Callers may map them to authorized UI reasons.
 * @remarks Pure synchronous computation: no DB, vault, SDK, network, log or write.
 *   No version is defaulted to latest, no product/permission is added, and no retry
 *   or acknowledgement boundary is crossed. A verified label is trusted registry
 *   data, NOT proof established by this function. Revalidate before a later launch.
 */
export function prepareSignupConfiguration(profile: unknown, context: unknown): PreparedSignup {
  if (!isContext(context)) throw new SetupError('META_SETUP_CONTEXT_INVALID');
  if (profile === null || profile === undefined) throw new SetupError('META_SETUP_NOT_CONFIGURED');
  if (!isProfile(profile)) throw new SetupError('META_SETUP_PROFILE_INVALID');
  if (profile.appRef !== context.appRef || profile.profileId !== context.profileId
    || profile.profileRevision !== context.profileRevision
    || profile.scope.tenantId !== context.scope.tenantId || profile.scope.workspaceId !== context.scope.workspaceId
    || profile.scope.environmentId !== context.scope.environmentId) throw new SetupError('META_SETUP_SCOPE_MISMATCH');
  if (!profile.enabled) throw new SetupError('META_SETUP_DISABLED');
  if (profile.evidence.status === 'revoked') throw new SetupError('META_SETUP_REVOKED');
  if (profile.evidence.status !== 'verified') throw new SetupError('META_SETUP_EVIDENCE_REQUIRED');
  if (context.nowMs < profile.evidence.reviewedAtMs || context.nowMs >= profile.evidence.expiresAtMs)
    throw new SetupError('META_SETUP_STALE');
  // Meta's payload shape is retained, including omission of an empty featureType.
  // The complete version/feature combination comes from one qualified profile, not
  // independent user-editable allowlists or the last item in upstream configuration.
  const extras = Object.freeze({sessionInfoVersion: '3' as const, version: profile.signupVersion,
    ...(profile.featureType ? {featureType: profile.featureType} : {}),
    features: Object.freeze(profile.features.map(name => Object.freeze({name})))});
  return Object.freeze({schemaVersion: 1, status: 'prepared', execution: 'not_requested',
    scope: Object.freeze({...profile.scope}), appRef: profile.appRef, profileId: profile.profileId,
    profileRevision: profile.profileRevision, appId: profile.appId, graphApiVersion: profile.graphApiVersion,
    checkedAtMs: context.nowMs, expiresAtMs: profile.evidence.expiresAtMs,
    loginOptions: Object.freeze({config_id: profile.configId, response_type: 'code',
      override_default_response_type: true, extras})});
}
