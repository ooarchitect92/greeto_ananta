/**
 * Delivery status domain service for the planned NestJS control plane.
 * This is not an alternative HTTP framework, identity provider or pipeline runner.
 * A production adapter must implement serializable scoped transactions, FORCE RLS,
 * event/outbox atomicity and verified authorization before exposing this service.
 */
export type Status = 'Not started' | 'In progress' | 'Blocked' | 'Review' | 'Done';
export interface Scope { tenantId: string; workspaceId: string; environmentId: string }
export interface Actor { id: string; permissions: readonly string[] }
export interface WorkPackage { id: string; status: Status; version: number; predecessors: readonly string[] }
export interface Change { id: string; status: Status; expectedVersion: number; idempotencyKey: string; reasonCode: string; evidenceRef?: string }
export interface Receipt { id: string; status: Status; version: number; eventId: string; intentHash: string }
export interface EvidenceGate { implementation: boolean; automatedAcceptance: boolean; securityReview: boolean; documentation: boolean; rolloutRollback: boolean; externalApprovals: boolean }

/** Trust boundary: these ports accept server-authenticated scope, never body scope. */
export interface StatusTransaction {
  findReceipt(keyHash: string): Promise<Receipt | null>;
  loadForUpdate(id: string): Promise<WorkPackage | null>;
  predecessorsVerified(ids: readonly string[]): Promise<boolean>;
  /** Compare expected version, update status, append history AND outbox atomically. */
  persist(change: Change, actor: Actor, keyHash: string, receipt: Receipt): Promise<void>;
}
export interface Repository {
  /** SERIALIZABLE transaction; SET LOCAL all scope fields; rollback before releasing. */
  findReceipt(scope: Scope, keyHash: string): Promise<Receipt | null>;
  transaction<T>(scope: Scope, operation: (tx: StatusTransaction) => Promise<T>): Promise<T>;
}
export interface Authorizer { require(scope: Scope, actor: Actor, permission: string): Promise<void> }
export interface EvidenceVerifier {
  /** Resolve and verify signed/owned evidence for THIS scope, package and version. */
  verify(scope: Scope, change: Change): Promise<EvidenceGate>;
}

const transitions: Record<Status, readonly Status[]> = {
  'Not started': ['In progress', 'Blocked'],
  'In progress': ['Review', 'Blocked'],
  'Blocked': ['In progress', 'Not started'],
  'Review': ['Done', 'In progress', 'Blocked'],
  'Done': [], // Reopening needs a separately governed correction, not silent edits.
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hash canonical positional fields with WebCrypto; no secret appears in a log. */
async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Errors contain stable codes only. The future HTTP adapter maps these to 4xx/503. */
export class StatusError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'StatusError'; }
}

export class StatusService {
  constructor(private readonly repository: Repository, private readonly authorizer: Authorizer,
    private readonly verifier: EvidenceVerifier) {}

  /**
   * @param scope Server-resolved tenant/workspace/environment (not request JSON).
   * @param actor Authenticated human/service identity checked by Authorizer.
   * @param change Bounded status intent with expected version and stable retry key.
   * @returns Durable receipt only after the transaction commits successfully.
   * @throws StatusError On conflict, unmet prerequisites, missing proof or denial.
   * Side effects: one scoped status transition + audit history + transactional outbox.
   * Pipeline impact: none; this cannot rewrite dependencies, approve or deploy code.
   */
  async change(scope: Scope, actor: Actor, change: Change): Promise<Receipt> {
    if (![scope.tenantId, scope.workspaceId, scope.environmentId, actor.id].every(id => uuid.test(id)) ||
        !/^[A-Z]{2,4}-\d{3}$/.test(change.id) || !Object.hasOwn(transitions, change.status) ||
        !Number.isSafeInteger(change.expectedVersion) || change.expectedVersion < 1 ||
        !/^[A-Za-z0-9_.:-]{16,128}$/.test(change.idempotencyKey) ||
        !/^[a-z][a-z0-9_]{0,127}$/.test(change.reasonCode) || (change.evidenceRef?.length ?? 0) > 2048) {
      throw new StatusError('INVALID_INPUT');
    }
    await this.authorizer.require(scope, actor, 'delivery.status.write');
    const keyHash = await sha256([scope.tenantId, scope.workspaceId, scope.environmentId, actor.id, change.idempotencyKey]);
    const intentHash = await sha256([change.id, change.status, change.expectedVersion, change.reasonCode, change.evidenceRef ?? null]);
    // An authorized replay returns the original durable receipt even if external
    // acceptance-evidence retrieval is currently unavailable. The transaction
    // repeats this lookup to close the concurrent-request race.
    const prior = await this.repository.findReceipt(scope, keyHash);
    if (prior) {
      if (prior.intentHash !== intentHash) throw new StatusError('IDEMPOTENCY_CONFLICT');
      return prior;
    }
    // Verification may involve external proof retrieval, so it is outside the SQL
    // transaction. The verifier binds evidence to the exact package/version; the
    // serializable transaction then enforces that version and prerequisites.
    let proof: EvidenceGate | null = null;
    if (change.status === 'Done') {
      if (!change.evidenceRef?.trim()) throw new StatusError('EVIDENCE_REQUIRED');
      proof = await this.verifier.verify(scope, change);
      const required = ['implementation','automatedAcceptance','securityReview','documentation','rolloutRollback','externalApprovals'] as const;
      if (!required.every(key => proof?.[key] === true)) throw new StatusError('ACCEPTANCE_INCOMPLETE');
    }
    return this.repository.transaction(scope, async tx => {
      const previous = await tx.findReceipt(keyHash);
      if (previous) {
        if (previous.intentHash !== intentHash) throw new StatusError('IDEMPOTENCY_CONFLICT');
        return previous;
      }
      const current = await tx.loadForUpdate(change.id);
      if (!current) throw new StatusError('NOT_FOUND'); // No cross-tenant existence hint.
      if (current.version !== change.expectedVersion) throw new StatusError('VERSION_CONFLICT');
      if (!transitions[current.status].includes(change.status)) throw new StatusError('INVALID_TRANSITION');
      if (['In progress','Review','Done'].includes(change.status) && !await tx.predecessorsVerified(current.predecessors)) {
        throw new StatusError('PREDECESSORS_BLOCKED');
      }
      const receipt: Receipt = {id: change.id, status: change.status, version: current.version + 1,
        eventId: crypto.randomUUID(), intentHash};
      await tx.persist(change, actor, keyHash, receipt);
      return receipt;
    });
  }
}
