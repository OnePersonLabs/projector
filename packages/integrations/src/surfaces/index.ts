import {
  ArtifactFingerprintSchema,
  ArtifactSchema,
  SurfaceApplyResultSchema,
  SurfacePlanSchema,
  SurfaceSchema,
  hashFramedDomain,
  type AdapterContext,
  type Artifact,
  type ArtifactFingerprint,
  type ContentHash,
  type EnumerationContract,
  type ExecutionCapsule,
  type ExecutionPlan,
  type StateBindingValidator,
  type StateDigest,
  type Surface,
  type SurfaceAdapter,
  type SurfaceApplyResult,
  type SurfaceCapabilities,
  type SurfaceChange,
  type SurfacePlan,
  type ValidationResult,
} from "@projector/core";
import { executionCapsuleHash, executionPlanHash, type ExecutionApproval } from "@projector/engine";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export interface SurfaceInventoryPage {
  readonly artifacts: readonly Artifact[];
  readonly nextCursor?: string;
  readonly complete: boolean;
}

export interface SnapshotSurfaceAdapter extends SurfaceAdapter {
  readonly version: string;
  inventoryPage?(surface: Surface, cursor: string | undefined, context: AdapterContext): Promise<SurfaceInventoryPage>;
  compensate?(operationId: string, plan: SurfacePlan, context: AdapterContext): Promise<void>;
}

export interface SurfaceSnapshotRevision {
  readonly revisionId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly enumeration: EnumerationContract;
  readonly observedAt: string;
  readonly semanticDigest: ContentHash;
  readonly snapshotDigest: ContentHash;
  readonly surfaces: readonly Surface[];
  readonly artifacts: readonly Artifact[];
  readonly fingerprints: readonly ArtifactFingerprint[];
  readonly unavailableSurfaceIds: readonly string[];
  readonly observability: "closed" | "bounded" | "open" | "sampled" | "unavailable";
  readonly provesCompleteAbsence: boolean;
  readonly blindSpots: readonly string[];
}

function snapshotSemanticDigest(snapshot: Pick<SurfaceSnapshotRevision, "adapterId" | "adapterVersion" | "surfaces" | "artifacts" | "fingerprints"> & { readonly enumeration?: EnumerationContract }): ContentHash {
  const enumeration = snapshot.enumeration ?? snapshot.surfaces[0]?.enumeration ?? { observability: "unavailable" as const, method: "none", assumptions: [], blindSpots: [], dynamicMechanisms: [] };
  const semantic = {
    adapterId: snapshot.adapterId,
    adapterVersion: snapshot.adapterVersion,
    enumeration,
    surfaces: [...snapshot.surfaces].sort((left, right) => compare(left.id, right.id)).map(({ id, key, kind, adapter, access, enumeration: contract, capabilities, boundary }) => ({ id, key, kind, adapter, access, enumeration: contract, capabilities, boundary })),
    artifacts: [...snapshot.artifacts].sort((left, right) => compare(left.id, right.id)).map(({ observedAt: _observedAt, ...item }) => item),
    fingerprints: [...snapshot.fingerprints],
  };
  return hashFramedDomain("external-surface-snapshot-semantic", semantic);
}

function validateAdapterSurface(adapter: SnapshotSurfaceAdapter, raw: Surface): Surface {
  const surface = SurfaceSchema.parse(structuredClone(raw)) as Surface;
  if (surface.adapter !== adapter.id || surface.kind !== adapter.kind) throw new Error(`surface ${surface.id} is bound to another adapter or kind`);
  for (const key of Object.keys(surface.capabilities) as Array<keyof SurfaceCapabilities>) if (surface.capabilities[key] && !adapter.capabilities[key]) throw new Error(`surface ${surface.id} capability claims exceed adapter capability`);
  const observabilityRank = { unavailable: 0, sampled: 1, open: 1, bounded: 2, closed: 3 } as const;
  if (observabilityRank[surface.enumeration.observability] > observabilityRank[adapter.enumeration.observability]) throw new Error(`surface ${surface.id} enumeration claims exceed adapter observability`);
  if (surface.access === "read-write" && (!adapter.capabilities.read || !adapter.capabilities.write)) throw new Error(`surface ${surface.id} access inflates adapter capability`);
  if (surface.access === "read-only" && !adapter.capabilities.read) throw new Error(`surface ${surface.id} access inflates adapter read capability`);
  if ((surface.access === "declared-only" || surface.access === "unavailable") && surface.capabilities.write) throw new Error(`unavailable surface ${surface.id} cannot claim writes`);
  return surface;
}

async function collectArtifacts(adapter: SnapshotSurfaceAdapter, surface: Surface, context: AdapterContext): Promise<Artifact[]> {
  if (!adapter.capabilities.read || surface.access === "declared-only" || surface.access === "unavailable") return [];
  if (adapter.inventoryPage === undefined) {
    const artifacts = await adapter.inventory(structuredClone(surface), context);
    if (adapter.enumeration.observability === "closed" && adapter.enumeration.method.includes("pag")) throw new Error(`closed surface ${surface.id} requires authenticated pagination completion`);
    return artifacts;
  }
  const artifacts: Artifact[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const page = await adapter.inventoryPage(structuredClone(surface), cursor, context);
    artifacts.push(...page.artifacts.map((item) => structuredClone(item)));
    if (page.complete) {
      if (page.nextCursor !== undefined) throw new Error(`complete pagination for ${surface.id} returned a continuation cursor`);
      break;
    }
    if (page.nextCursor === undefined || cursors.has(page.nextCursor)) throw new Error(`incomplete pagination for closed surface ${surface.id}`);
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  return artifacts;
}

export async function captureSurfaceSnapshot(adapter: SnapshotSurfaceAdapter, context: AdapterContext, observedAt: string): Promise<Readonly<SurfaceSnapshotRevision>> {
  if (adapter.id.trim() === "" || adapter.version.trim() === "") throw new Error("surface adapter requires stable id and version");
  if (adapter.capabilities.write && (adapter.plan === undefined || adapter.apply === undefined || adapter.validate === undefined)) throw new Error(`writable adapter ${adapter.id} is missing mutation methods`);
  if (!adapter.capabilities.write && (adapter.plan !== undefined || adapter.apply !== undefined)) throw new Error(`read-only adapter ${adapter.id} must not expose mutation methods`);
  const rawSurfaces = await adapter.discover(context);
  const bySurfaceId = new Map<string, Surface>();
  for (const raw of rawSurfaces) {
    const surface = validateAdapterSurface(adapter, raw);
    if (bySurfaceId.has(surface.id)) throw new Error(`duplicate surface identity ${surface.id}`);
    bySurfaceId.set(surface.id, surface);
  }
  const surfaces = [...bySurfaceId.values()].sort((left, right) => compare(left.id, right.id));
  const artifactsById = new Map<string, Artifact>();
  const fingerprintsById = new Map<string, ArtifactFingerprint>();
  for (const surface of surfaces) {
    for (const raw of await collectArtifacts(adapter, surface, context)) {
      const artifact = ArtifactSchema.parse(raw) as Artifact;
      if (artifact.surfaceId !== surface.id) throw new Error(`artifact ${artifact.id} escaped surface ${surface.id}`);
      if (artifactsById.has(artifact.id)) throw new Error(`duplicate artifact identity ${artifact.id}`);
      if (artifact.metadata.observedContent !== undefined) {
        const recomputed = hashFramedDomain("fake-surface-artifact-content", artifact.metadata.observedContent);
        if (recomputed !== artifact.contentHash) throw new Error(`artifact ${artifact.id} content hash failed recomputation`);
      }
      const fingerprint = ArtifactFingerprintSchema.parse(await adapter.fingerprint(structuredClone(artifact), context)) as ArtifactFingerprint;
      if (fingerprint.adapterVersion !== adapter.version || fingerprint.contentHash !== artifact.contentHash) throw new Error(`artifact ${artifact.id} fingerprint failed adapter/revision authentication`);
      artifactsById.set(artifact.id, structuredClone(artifact));
      fingerprintsById.set(artifact.id, structuredClone(fingerprint));
    }
  }
  const artifacts = [...artifactsById.values()].sort((left, right) => compare(left.id, right.id));
  const fingerprints = artifacts.map(({ id }) => fingerprintsById.get(id)!);
  const semanticDigest = snapshotSemanticDigest({ adapterId: adapter.id, adapterVersion: adapter.version, surfaces, artifacts, fingerprints, enumeration: adapter.enumeration });
  const revision = { adapterId: adapter.id, adapterVersion: adapter.version, observedAt, semanticDigest };
  const snapshotDigest = hashFramedDomain("external-surface-snapshot-revision", revision);
  const unavailableSurfaceIds = surfaces.filter(({ access }) => access === "unavailable" || access === "declared-only").map(({ id }) => id);
  const observability = unavailableSurfaceIds.length > 0 ? "unavailable" as const : adapter.enumeration.observability;
  const blindSpots = [...new Set([...adapter.enumeration.blindSpots, ...adapter.enumeration.dynamicMechanisms, ...unavailableSurfaceIds.map((id) => `surface unavailable: ${id}`)])].sort(compare);
  return deepFreeze({ revisionId: `snapshot:${snapshotDigest.slice(-32)}`, ...revision, enumeration: structuredClone(adapter.enumeration), snapshotDigest, surfaces, artifacts, fingerprints, unavailableSurfaceIds, observability, provesCompleteAbsence: observability === "closed" && blindSpots.length === 0, blindSpots });
}

export type ExternalReservation =
  | { readonly state: "reserved" }
  | { readonly state: "completed"; readonly result: SurfaceApplyResult }
  | { readonly state: "ambiguous" | "compensated" };

export interface ExternalOperationJournal {
  reserve(input: { operationId: string; planHash: ContentHash; snapshotDigest: ContentHash }): Promise<ExternalReservation>;
  complete(operationId: string, result: SurfaceApplyResult): Promise<void>;
  markAmbiguous(operationId: string): Promise<void>;
  markCompensated(operationId: string): Promise<void>;
}

interface JournalRecord { state: "reserved" | "completed" | "ambiguous" | "compensated"; planHash: ContentHash; snapshotDigest: ContentHash; result?: SurfaceApplyResult }

export class InMemoryExternalOperationJournal implements ExternalOperationJournal {
  readonly #records = new Map<string, JournalRecord>();

  async reserve(input: { operationId: string; planHash: ContentHash; snapshotDigest: ContentHash }): Promise<ExternalReservation> {
    const existing = this.#records.get(input.operationId);
    if (existing !== undefined) {
      if (existing.planHash !== input.planHash || existing.snapshotDigest !== input.snapshotDigest) throw new Error("external operation id was reused for different authority or snapshot");
      if (existing.state === "completed") {
        if (existing.result === undefined) throw new Error("completed external operation is missing its durable result");
        return { state: "completed", result: structuredClone(existing.result) };
      }
      return { state: existing.state === "reserved" ? "ambiguous" : existing.state };
    }
    this.#records.set(input.operationId, { state: "reserved", planHash: input.planHash, snapshotDigest: input.snapshotDigest });
    return { state: "reserved" };
  }

  async complete(operationId: string, result: SurfaceApplyResult): Promise<void> { const record = this.required(operationId); this.#records.set(operationId, { ...record, state: "completed", result: structuredClone(result) }); }
  async markAmbiguous(operationId: string): Promise<void> { const record = this.required(operationId); this.#records.set(operationId, { ...record, state: "ambiguous" }); }
  async markCompensated(operationId: string): Promise<void> { const record = this.required(operationId); this.#records.set(operationId, { ...record, state: "compensated" }); }
  private required(operationId: string): JournalRecord { const record = this.#records.get(operationId); if (record === undefined) throw new Error(`unknown external operation ${operationId}`); return record; }
}

export interface SurfaceExecutionResult {
  readonly outcome: "success" | "partial" | "refused";
  readonly operationId?: string;
  readonly reasons: readonly string[];
  readonly validations: readonly ValidationResult[];
  readonly result?: SurfaceApplyResult;
  readonly compensated: boolean;
}

export async function executeSurfacePlan(input: { readonly plan: ExecutionPlan; readonly capsule: ExecutionCapsule; readonly approval: ExecutionApproval; readonly surfacePlan: SurfacePlan; readonly snapshot: SurfaceSnapshotRevision; readonly manualContinuation: boolean }, adapter: SnapshotSurfaceAdapter, context: AdapterContext, ports: { readonly state: { current(): Promise<StateDigest> }; readonly bindingValidator: StateBindingValidator; readonly journal: ExternalOperationJournal }): Promise<Readonly<SurfaceExecutionResult>> {
  const refuse = (reason: string): Readonly<SurfaceExecutionResult> => deepFreeze({ outcome: "refused", reasons: [reason], validations: [], compensated: false });
  if (!SurfacePlanSchema.safeParse(input.surfacePlan).success) return refuse("surface plan failed the normative contract");
  const recomputedSemanticDigest = snapshotSemanticDigest(input.snapshot);
  const recomputedSnapshotDigest = hashFramedDomain("external-surface-snapshot-revision", { adapterId: input.snapshot.adapterId, adapterVersion: input.snapshot.adapterVersion, observedAt: input.snapshot.observedAt, semanticDigest: recomputedSemanticDigest });
  if (recomputedSemanticDigest !== input.snapshot.semanticDigest || recomputedSnapshotDigest !== input.snapshot.snapshotDigest || input.snapshot.revisionId !== `snapshot:${recomputedSnapshotDigest.slice(-32)}`) return refuse("external snapshot revision failed content authentication");
  if (input.approval.planId !== input.plan.id || input.approval.planRevision !== input.plan.revision || input.approval.planHash !== executionPlanHash(input.plan) || input.approval.dependencyDigest !== input.plan.boundState.dependencyDigest || input.approval.capsuleId !== input.capsule.id || input.approval.capsuleHash !== executionCapsuleHash(input.capsule)) return refuse("stale approval requires Task16 refresh or rebase");
  if (input.surfacePlan.adapterId !== adapter.id || input.snapshot.adapterId !== adapter.id || input.snapshot.adapterVersion !== adapter.version) return refuse("surface plan or snapshot belongs to another adapter revision");
  if (!adapter.capabilities.write || adapter.apply === undefined || adapter.validate === undefined) return refuse("surface adapter is not writable");
  if ((input.surfacePlan.riskClass === "R3" || input.surfacePlan.riskClass === "R4") && !input.manualContinuation) return refuse("high-risk external operation requires explicit manual continuation");
  if (input.surfacePlan.requiredApprovals.length === 0 && adapter.capabilities.humanApprovalRequired) return refuse("surface adapter requires explicit approval");
  if (input.surfacePlan.boundState.dependencyDigest !== input.plan.boundState.dependencyDigest || input.capsule.boundState.dependencyDigest !== input.plan.boundState.dependencyDigest) return refuse("surface plan is outside the immutable Task16 state binding");
  const current = await ports.state.current();
  if (current.pinnedExternalSnapshotDigest !== input.snapshot.snapshotDigest || input.surfacePlan.boundState.compiledAgainst.pinnedExternalSnapshotDigest !== input.snapshot.snapshotDigest) return refuse("external snapshot is stale or not pinned by the approved plan");
  const binding = await ports.bindingValidator.validate(input.surfacePlan.boundState, current, context);
  if (binding.status !== "current" && binding.status !== "rebound") return refuse(`surface state binding is ${binding.status}`);
  const planHash = executionPlanHash(input.plan);
  const operationId = `external-operation:${hashFramedDomain("external-operation-reservation", { planId: input.plan.id, planRevision: input.plan.revision, planHash, surfacePlan: input.surfacePlan, snapshotDigest: input.snapshot.snapshotDigest }).slice(-32)}`;
  const reservation = await ports.journal.reserve({ operationId, planHash, snapshotDigest: input.snapshot.snapshotDigest });
  if (reservation.state === "completed") return deepFreeze({ outcome: "success", operationId, reasons: ["idempotent replay returned the durable result"], validations: [], result: reservation.result, compensated: false });
  const compensate = async (): Promise<boolean> => {
    if (reservation.state === "compensated") return true;
    if (adapter.compensate === undefined) return false;
    await adapter.compensate(operationId, input.surfacePlan, context);
    await ports.journal.markCompensated(operationId);
    return true;
  };
  if (reservation.state === "ambiguous" || reservation.state === "compensated") {
    const validations = await adapter.validate(input.surfacePlan, context);
    if (validations.length > 0 && validations.every(({ status }) => status === "passed")) return deepFreeze({ outcome: "partial", operationId, reasons: ["ambiguous operation validated but lacks an authenticated apply result; manual reconciliation required"], validations, compensated: false });
    const compensated = await compensate();
    return deepFreeze({ outcome: "partial", operationId, reasons: ["ambiguous external operation was not replayed"], validations, compensated });
  }
  try {
    const result = SurfaceApplyResultSchema.parse(await adapter.apply(input.surfacePlan, context)) as SurfaceApplyResult;
    const validations = await adapter.validate(input.surfacePlan, context);
    if (validations.length === 0 || validations.some(({ status }) => status !== "passed")) {
      await ports.journal.markAmbiguous(operationId);
      const compensated = await compensate();
      return deepFreeze({ outcome: "partial", operationId, reasons: ["external apply validation did not establish success"], validations, result, compensated });
    }
    await ports.journal.complete(operationId, result);
    return deepFreeze({ outcome: "success", operationId, reasons: [], validations, result, compensated: false });
  } catch (error) {
    await ports.journal.markAmbiguous(operationId);
    const compensated = await compensate();
    return deepFreeze({ outcome: "partial", operationId, reasons: [error instanceof Error ? error.message : "external operation outcome is ambiguous"], validations: [], compensated });
  }
}

export interface FakeSurfaceAdapterOptions {
  readonly id: string; readonly version: string; readonly kind: Surface["kind"];
  readonly capabilities: SurfaceCapabilities; readonly enumeration: EnumerationContract;
  readonly surfaces: readonly Surface[]; readonly pages: ReadonlyArray<readonly Artifact[]>;
  readonly complete?: boolean; readonly applyMode?: "success" | "ambiguous-failure";
}

export class FakeSurfaceAdapter implements SnapshotSurfaceAdapter {
  readonly id: string;
  readonly version: string;
  readonly kind: Surface["kind"];
  readonly capabilities: SurfaceCapabilities;
  readonly enumeration: EnumerationContract;
  readonly #surfaces: readonly Surface[];
  readonly #pages: ReadonlyArray<readonly Artifact[]>;
  readonly #complete: boolean;
  readonly #applyMode: "success" | "ambiguous-failure";
  applyCalls = 0;
  compensationCalls = 0;
  readonly plan?: (change: SurfaceChange, context: AdapterContext) => Promise<SurfacePlan>;
  readonly apply?: (plan: SurfacePlan, context: AdapterContext) => Promise<SurfaceApplyResult>;
  readonly validate?: (plan: SurfacePlan, context: AdapterContext) => Promise<ValidationResult[]>;
  readonly compensate?: (operationId: string, plan: SurfacePlan, context: AdapterContext) => Promise<void>;

  constructor(options: FakeSurfaceAdapterOptions) {
    this.id = options.id; this.version = options.version; this.kind = options.kind; this.capabilities = structuredClone(options.capabilities); this.enumeration = structuredClone(options.enumeration); this.#surfaces = structuredClone(options.surfaces); this.#pages = structuredClone(options.pages); this.#complete = options.complete ?? true; this.#applyMode = options.applyMode ?? "success";
    if (this.capabilities.write) {
      this.plan = async (change) => SurfacePlanSchema.parse({ adapterId: this.id, surfaceId: change.surfaceId, riskClass: "R3", operations: [{ operation: change.operation, payload: change.payload }], requiredApprovals: ["manual:operator"], validatorIds: [`validate:${this.id}`], boundState: contextlessBinding(change) }) as SurfacePlan;
      this.apply = async () => { this.applyCalls += 1; if (this.#applyMode === "ambiguous-failure") throw new Error("fake external operation outcome is ambiguous"); return { changed: true, operationEvidence: [], externalReferences: [`fake:${this.applyCalls}`] }; };
      this.validate = async () => [{ validatorId: `validate:${this.id}`, status: this.#applyMode === "success" ? "passed" : "failed", summary: "fake validation", evidenceIds: [], evidenceLane: "runtime", independenceGroup: `fake:${this.id}`, assurance: "strong", authorSource: "fake-surface-adapter", sideEffectClass: "read-only", details: {}, startedAt: "deterministic", completedAt: "deterministic" }];
      this.compensate = async () => { this.compensationCalls += 1; };
    }
  }

  async discover(_context: AdapterContext): Promise<Surface[]> { return this.#surfaces.map((surface) => structuredClone(surface)); }
  async inventory(_surface: Surface, _context: AdapterContext): Promise<Artifact[]> { return structuredClone(this.#pages.flat()); }
  async inventoryPage(_surface: Surface, cursor: string | undefined, _context: AdapterContext): Promise<SurfaceInventoryPage> { const index = cursor === undefined ? 0 : Number(cursor); const last = index >= this.#pages.length - 1; return { artifacts: structuredClone(this.#pages[index] ?? []), ...(last ? {} : { nextCursor: String(index + 1) }), complete: last && this.#complete }; }
  async fingerprint(artifact: Artifact, _context: AdapterContext): Promise<ArtifactFingerprint> { return { contentHash: artifact.contentHash, adapterVersion: this.version, ...(artifact.structuralSignature === undefined ? {} : { structuralSignature: artifact.structuralSignature }), ...(artifact.semanticSignature === undefined ? {} : { semanticSignature: artifact.semanticSignature }) }; }
}

function contextlessBinding(change: SurfaceChange): SurfacePlan["boundState"] {
  const compiledAgainst = { gitBase: change.semanticChangeId, worktreeDigest: hashFramedDomain("fake-binding", "worktree"), canonicalProjectorDigest: hashFramedDomain("fake-binding", "canonical"), toolchainDigest: hashFramedDomain("fake-binding", "toolchain") };
  return { compiledAgainst, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
}
