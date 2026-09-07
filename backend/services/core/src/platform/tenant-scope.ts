/**
 * PLT-001 preparation: tenant/workspace/environment lookup, not provisioning.
 * Implements the baseline section 6 hierarchy without granting provider access,
 * activating tenants, changing F01 or substituting for OIDC/OPA authorization.
 */
export type EnvironmentKind = 'production' | 'sandbox' | 'shadow';
export type TenantState = 'provisioning' | 'active' | 'suspended' | 'erasing';
export type ScopePermission = 'platform.scope.read' | 'delivery.status.write';
export interface TenantScope { readonly tenantId: string; readonly workspaceId: string; readonly environmentId: string }
export interface ScopeSnapshot extends TenantScope {
  readonly homeCell: string;
  /** PostgreSQL bigint as decimal text: never round an ownership epoch to Number. */
  readonly placementEpoch: string;
  readonly state: TenantState;
  readonly kind: EnvironmentKind;
}
export interface ScopePrincipal { readonly id: string }
export interface PlacementBinding {
  /** Trusted, verified routing/workload context supplied by the host, never JSON. */
  readonly cellId: string;
  readonly placementEpoch: string;
  readonly environmentKind: EnvironmentKind;
}
export interface ScopeGrantPort {
  /**
   * Authenticate/resolve the principal and authorize THIS object scope/permission.
   * Deny expired/revoked grants. A principal ID or caller permission array is not
   * authorization. Implement using the selected identity/policy boundary.
   * Return only after verification; reject on denial or unavailable authority.
   */
  require(principal: ScopePrincipal, scope: TenantScope, permission: ScopePermission, signal: AbortSignal): Promise<void>;
}
export interface ScopeReader {
  /** One scoped, consistent lookup. Null must not disclose another tenant's row. */
  read(scope: TenantScope, signal: AbortSignal): Promise<ScopeSnapshot | null>;
}
export type ScopeCode = 'INVALID_SCOPE' | 'INVALID_PLACEMENT' | 'SCOPE_UNAVAILABLE' |
  'SCOPE_INACTIVE' | 'PLACEMENT_MISMATCH' | 'STORE_UNAVAILABLE' | 'STORE_CONFIGURATION' | 'CANCELLED';
/** Stable redacted error codes; underlying driver errors/SQL/credentials stay private. */
export class ScopeError extends Error {
  constructor(public readonly code: ScopeCode) { super(code); this.name = 'ScopeError'; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds: readonly string[] = ['production','sandbox','shadow'];
const states: readonly string[] = ['provisioning','active','suspended','erasing'];
const maxEpoch = 9223372036854775807n;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validId = (v: unknown): v is string => typeof v === 'string' && uuid.test(v) && v !== '00000000-0000-0000-0000-000000000000';
const validEpoch = (v: unknown): v is string => typeof v === 'string' && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= maxEpoch;
const validCell = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9_.:-]{0,127}$/.test(v);

/**
 * @param input Untrusted candidate IDs; unknown fields and the nil UUID are rejected.
 * @returns Frozen, lowercase UUID tuple. Normalization is NOT authorization.
 * @throws ScopeError INVALID_SCOPE. No network, storage or mutation occurs.
 */
export function parseTenantScope(input: unknown): TenantScope {
  const keys = ['tenantId','workspaceId','environmentId'] as const;
  if (!record(input) || Object.keys(input).length !== keys.length || keys.some(k => !Object.hasOwn(input,k) || !validId(input[k]))) {
    throw new ScopeError('INVALID_SCOPE');
  }
  return Object.freeze({tenantId:(input.tenantId as string).toLowerCase(), workspaceId:(input.workspaceId as string).toLowerCase(), environmentId:(input.environmentId as string).toLowerCase()});
}
/** Runtime decoder for database/adapter data; never accept a typed cast as proof. */
export function parseScopeSnapshot(input: unknown): ScopeSnapshot {
  if (!record(input) || Object.keys(input).length !== 7 ||
      !['tenantId','workspaceId','environmentId','homeCell','placementEpoch','state','kind'].every(k => Object.hasOwn(input,k)) || !validCell(input.homeCell) || !validEpoch(input.placementEpoch) ||
      typeof input.state !== 'string' || !states.includes(input.state) || typeof input.kind !== 'string' || !kinds.includes(input.kind)) {
    throw new ScopeError('STORE_UNAVAILABLE');
  }
  try {
    const scope = parseTenantScope({tenantId:input.tenantId, workspaceId:input.workspaceId, environmentId:input.environmentId});
    return Object.freeze({...scope, homeCell:input.homeCell, placementEpoch:input.placementEpoch, state:input.state as TenantState, kind:input.kind as EnvironmentKind});
  } catch { throw new ScopeError('STORE_UNAVAILABLE'); }
}
/** Check cancellation between trust/durability boundaries, never treat it as success. */
export function checkScopeSignal(signal: AbortSignal): void { if (signal.aborted) throw new ScopeError('CANCELLED'); }

/** Read-only domain boundary; no request handler or production adapter is auto-mounted. */
export class TenantScopeService {
  constructor(private readonly grants: ScopeGrantPort, private readonly reader: ScopeReader) {}

  /**
   * @param principal Identity resolved by the selected authentication host.
   * @param requested Tuple to inspect. Still passed through object authorization.
   * @param binding Verified routing/workload placement; no browser-supplied binding.
   * @param signal Host deadline/cancellation propagated to every adapter call.
   * @returns Current scope state; provisioning/suspended is visible, not made ready.
   * @throws ScopeError Neutral unavailability on denied/missing scope; never leaks rows.
   * Side effects: authorized database SELECT only; no sends, provisioning or cache grants.
   */
  async inspect(principal: ScopePrincipal, requested: unknown, binding: PlacementBinding, signal: AbortSignal): Promise<ScopeSnapshot> {
    return this.resolve(principal,requested,binding,'platform.scope.read',false,signal);
  }

  /**
   * Authorize the existing delivery-status write permission and require active
   * tenant placement. The caller must still perform object/version/evidence checks
   * and recheck ownership in its write transaction. This snapshot is not a lease,
   * an Action Gateway permit or authority reusable for a future external effect.
   */
  async requireStatusWrite(principal: ScopePrincipal, requested: unknown, binding: PlacementBinding, signal: AbortSignal): Promise<ScopeSnapshot> {
    return this.resolve(principal,requested,binding,'delivery.status.write',true,signal);
  }

  private async resolve(principal: ScopePrincipal, requested: unknown, binding: PlacementBinding,
    permission: ScopePermission, active: boolean, signal: AbortSignal): Promise<ScopeSnapshot> {
    checkScopeSignal(signal);
    const scope = parseTenantScope(requested);
    if (!record(principal) || !validId(principal.id)) throw new ScopeError('SCOPE_UNAVAILABLE');
    if (!record(binding) || !validCell(binding.cellId) || !validEpoch(binding.placementEpoch) || !kinds.includes(binding.environmentKind)) {
      throw new ScopeError('INVALID_PLACEMENT');
    }
    // Copy before awaits: mutable caller objects cannot swap identity/placement mid-call.
    const actor = Object.freeze({id:principal.id.toLowerCase()});
    const placement = Object.freeze({...binding});
    try { await this.grants.require(actor,scope,permission,signal); }
    catch { checkScopeSignal(signal); throw new ScopeError('SCOPE_UNAVAILABLE'); }
    checkScopeSignal(signal);
    let raw: ScopeSnapshot | null;
    try { raw = await this.reader.read(scope,signal); }
    catch (error) { checkScopeSignal(signal); if (error instanceof ScopeError) throw error; throw new ScopeError('STORE_UNAVAILABLE'); }
    checkScopeSignal(signal);
    if (raw === null) throw new ScopeError('SCOPE_UNAVAILABLE');
    const snapshot = parseScopeSnapshot(raw);
    if (snapshot.tenantId !== scope.tenantId || snapshot.workspaceId !== scope.workspaceId || snapshot.environmentId !== scope.environmentId) {
      throw new ScopeError('SCOPE_UNAVAILABLE');
    }
    if (snapshot.homeCell !== placement.cellId || snapshot.placementEpoch !== placement.placementEpoch || snapshot.kind !== placement.environmentKind) {
      throw new ScopeError('PLACEMENT_MISMATCH');
    }
    if (active && snapshot.state !== 'active') throw new ScopeError('SCOPE_INACTIVE');
    return snapshot;
  }
}
