import {
  canonicalJson,
  hashFramedDomain,
  hashSemantic,
  type ArchitectureConcern,
  type ArchitectureDecision,
  type AuthorityRecord,
  type ContentHash,
  type DecisionOption,
  type EntityId,
  type ExecutionPlan,
  type RiskClass,
  type StateBinding,
  type StateQueryDependency,
} from "@projector/core";

import {
  authorityRecordHashIsValid,
  evaluateDecisionOptions,
  type ArchitectureResearchPort,
  type AuthenticatedAuthorityPort,
  type AuthenticatedPreferencePort,
} from "../architecture/evaluation.js";
import { compileSemanticChangePlan, type AuthenticatedChangePlanningInput, type CompiledSemanticChangePlan } from "../planning/change-plan.js";
import { createStateBinding } from "../state/index.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
function deepFreeze<T>(value: T): Readonly<T> { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value; }

export type FrictionTrigger =
  | "repeated-divergence" | "repeated-agent-difficulty" | "planning-surprise" | "high-invalidation-fan-out"
  | "duplicated-abstraction" | "unsupported-dependency" | "security-or-support" | "slow-feedback"
  | "architecture-erosion" | "migration-overlay" | "platform-incompatibility" | "user-request";

export interface FrictionObservation {
  readonly id: EntityId;
  readonly trigger: FrictionTrigger;
  readonly recurrenceKey: string;
  readonly sourceId: string;
  readonly sourceRevision: string;
  readonly sourceContentHash: ContentHash;
  readonly observedAt: string;
  readonly endogenous: boolean;
  readonly affectedUnitIds: readonly EntityId[];
  readonly semanticHash: ContentHash;
}

type FrictionObservationInput = Omit<FrictionObservation, "affectedUnitIds" | "semanticHash"> & { readonly affectedUnitIds: readonly EntityId[] };

export function createFrictionObservation(input: FrictionObservationInput): Readonly<FrictionObservation> {
  if (input.id.trim() === "" || input.recurrenceKey.trim() === "" || input.sourceId.trim() === "" || input.sourceRevision.trim() === "") {
    throw new TypeError("friction observation requires stable identity, recurrence, source, and revision");
  }
  const semantic = { ...structuredClone(input), affectedUnitIds: unique(input.affectedUnitIds) };
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new TypeError("friction observation requires a valid observed-at timestamp");
  return deepFreeze({ ...semantic, semanticHash: hashFramedDomain("modernization-friction-observation", semantic) });
}

export interface EvidenceRevisionPort {
  read(sourceId: string, sourceRevision: string): Promise<{ readonly contentHash: ContentHash; readonly current: boolean; readonly origin: "independent" | "projector-generated"; readonly independenceKey: string; readonly metadataHash: ContentHash } | undefined>;
}

export interface FrictionSignal {
  readonly recurrenceKey: string;
  readonly triggers: readonly FrictionTrigger[];
  readonly observationIds: readonly EntityId[];
  readonly affectedUnitIds: readonly EntityId[];
  readonly authenticatedOccurrences: number;
  readonly independentOccurrences: number;
  readonly repeated: boolean;
}

async function aggregateFriction(observations: readonly FrictionObservation[], sources: EvidenceRevisionPort): Promise<ReadonlyArray<Readonly<FrictionSignal>>> {
  const byId = new Map<string, FrictionObservation>();
  const revisions = new Map<string, NonNullable<Awaited<ReturnType<EvidenceRevisionPort["read"]>>>>();
  for (const raw of observations) {
    const { semanticHash, ...semantic } = structuredClone(raw);
    if (semanticHash !== hashFramedDomain("modernization-friction-observation", semantic)) throw new Error(`friction observation ${raw.id} failed semantic authentication`);
    const existing = byId.get(raw.id);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(raw)) throw new Error(`conflicting friction observation ${raw.id}`);
    const revision = await sources.read(raw.sourceId, raw.sourceRevision);
    if (revision === undefined || !revision.current || revision.contentHash !== raw.sourceContentHash) throw new Error(`source revision authentication failed for ${raw.sourceId}@${raw.sourceRevision}`);
    if (revision.metadataHash !== hashFramedDomain("authenticated-evidence-origin", { sourceId: raw.sourceId, sourceRevision: raw.sourceRevision, contentHash: revision.contentHash, origin: revision.origin, independenceKey: revision.independenceKey })) throw new Error(`source origin authentication failed for ${raw.sourceId}@${raw.sourceRevision}`);
    byId.set(raw.id, { ...structuredClone(raw), endogenous: revision.origin === "projector-generated" });
    revisions.set(raw.id, revision);
  }
  const groups = new Map<string, FrictionObservation[]>();
  for (const item of byId.values()) groups.set(item.recurrenceKey, [...(groups.get(item.recurrenceKey) ?? []), item]);
  return [...groups.entries()].sort(([left], [right]) => compare(left, right)).map(([recurrenceKey, items]) => {
    const independent = new Set(items.map(({ id }) => revisions.get(id)!).filter(({ origin }) => origin === "independent").map(({ independenceKey }) => independenceKey));
    return deepFreeze({ recurrenceKey, triggers: unique(items.map(({ trigger }) => trigger)) as FrictionTrigger[], observationIds: unique(items.map(({ id }) => id)), affectedUnitIds: unique(items.flatMap(({ affectedUnitIds }) => affectedUnitIds)), authenticatedOccurrences: items.length, independentOccurrences: independent.size, repeated: independent.size >= 2 });
  });
}

export interface ConcernResearchRecord {
  readonly id: EntityId;
  readonly concernId: EntityId;
  readonly sourceId: string;
  readonly sourceRevision: string;
  readonly sourceContentHash: ContentHash;
  readonly observedAt: string;
  readonly validUntil: string;
  readonly options: readonly DecisionOption[];
  readonly evidenceIds: readonly EntityId[];
  readonly assumptions: readonly string[];
  readonly uncertainty: readonly string[];
  readonly semanticHash: ContentHash;
}

type ResearchRecordInput = Omit<ConcernResearchRecord, "options" | "evidenceIds" | "assumptions" | "uncertainty" | "semanticHash"> & {
  readonly options: readonly DecisionOption[]; readonly evidenceIds: readonly EntityId[]; readonly assumptions: readonly string[]; readonly uncertainty: readonly string[];
};

function normalizeOptions(options: readonly DecisionOption[]): DecisionOption[] {
  const byKey = new Map<string, DecisionOption>();
  for (const option of options) {
    const candidate = structuredClone(option);
    const existing = byKey.get(candidate.key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(candidate)) throw new Error(`conflicting researched option ${candidate.key}`);
    byKey.set(candidate.key, candidate);
  }
  return [...byKey.values()].sort((left, right) => compare(left.key, right.key));
}

export function createResearchRecord(input: ResearchRecordInput): Readonly<ConcernResearchRecord> {
  const observedAt = Date.parse(input.observedAt); const validUntil = Date.parse(input.validUntil);
  if (!Number.isFinite(observedAt) || !Number.isFinite(validUntil) || validUntil < observedAt) throw new TypeError("research record requires a valid freshness interval");
  const semantic = { ...structuredClone(input), options: normalizeOptions(input.options), evidenceIds: unique(input.evidenceIds), assumptions: unique(input.assumptions), uncertainty: unique(input.uncertainty) };
  return deepFreeze({ ...semantic, semanticHash: hashFramedDomain("modernization-concern-research", semantic) });
}

export interface ResearchConcernInput {
  readonly concern: ArchitectureConcern;
  readonly candidateOptions: readonly DecisionOption[];
  readonly affectedEvidenceIds: readonly EntityId[];
  readonly mode: "online" | "offline";
  readonly now: string;
  readonly pinned: readonly ConcernResearchRecord[];
}

export async function researchConcern(input: ResearchConcernInput, ports: { readonly sources: EvidenceRevisionPort; readonly fetch?: (concern: ArchitectureConcern, options: readonly DecisionOption[]) => Promise<ConcernResearchRecord> }): Promise<{ options: readonly DecisionOption[]; evidenceIds: readonly EntityId[]; unavailable: boolean; uncertainty: readonly string[]; recordIds: readonly EntityId[] }> {
  const records = input.mode === "online" && ports.fetch !== undefined
    ? [await ports.fetch(structuredClone(input.concern), normalizeOptions(input.candidateOptions))]
    : input.pinned.filter(({ concernId }) => concernId === input.concern.id);
  const valid: ConcernResearchRecord[] = [];
  const byId = new Map<string, string>();
  const uncertainty: string[] = [];
  for (const record of records) {
    const { semanticHash, ...semantic } = structuredClone(record);
    if (semanticHash !== hashFramedDomain("modernization-concern-research", semantic)) throw new Error(`research ${record.id} failed semantic authentication`);
    const serialized = canonicalJson(record); const existing = byId.get(record.id);
    if (existing !== undefined && existing !== serialized) throw new Error(`conflicting research identity ${record.id}`);
    byId.set(record.id, serialized);
    const source = await ports.sources.read(record.sourceId, record.sourceRevision);
    if (source === undefined || source.contentHash !== record.sourceContentHash) throw new Error(`research source revision authentication failed for ${record.sourceId}@${record.sourceRevision}`);
    if (source.metadataHash !== hashFramedDomain("authenticated-evidence-origin", { sourceId: record.sourceId, sourceRevision: record.sourceRevision, contentHash: source.contentHash, origin: source.origin, independenceKey: source.independenceKey })) throw new Error(`research source origin authentication failed for ${record.sourceId}@${record.sourceRevision}`);
    if (!source.current || Date.parse(record.validUntil) < Date.parse(input.now)) {
      uncertainty.push(`research ${record.id} is stale for concern ${input.concern.id}`);
      continue;
    }
    valid.push(structuredClone(record));
  }
  if (valid.length === 0) return { options: normalizeOptions(input.candidateOptions), evidenceIds: [], unavailable: true, uncertainty: unique([...uncertainty, `${input.mode} current research unavailable for concern ${input.concern.id}`]), recordIds: [] };
  return { options: normalizeOptions(valid.flatMap(({ options }) => options)), evidenceIds: unique(valid.flatMap(({ evidenceIds }) => evidenceIds)), unavailable: false, uncertainty: unique(valid.flatMap((record) => [...record.assumptions.map((item) => `assumption: ${item}`), ...record.uncertainty])), recordIds: unique(valid.map(({ id }) => id)) };
}

export interface ModernizationProblem {
  readonly currentState: string;
  readonly observedCost: string;
  readonly targetOutcome: string;
  readonly affectedConceptIds: readonly EntityId[];
  readonly affectedRequirementIds: readonly EntityId[];
  readonly relevanceClosureIds: readonly EntityId[];
  readonly estimatedAffectedUnits?: number;
  readonly compatibilityStrategy: string;
  readonly phases: readonly string[];
  readonly rollback: string;
  readonly cleanupCriteria: readonly string[];
  readonly risk: RiskClass;
  readonly confidence: number;
  readonly evidenceIds: readonly EntityId[];
  readonly counterEvidenceIds: readonly EntityId[];
  readonly alternatives: readonly string[];
  readonly currentMeetsRequirementsAtLowerCost?: boolean;
  readonly targetSupportImmature?: boolean;
  readonly speculativeScaleBenefit?: boolean;
  readonly poorReversibility?: boolean;
}

export interface UpgradeRecommendation {
  readonly id: EntityId;
  readonly concernId: EntityId;
  readonly problem: ModernizationProblem;
  readonly evaluationId: EntityId;
  readonly boundState: StateBinding;
  readonly semanticHash: ContentHash;
}

export interface ModernizationRecommendationInput {
  readonly concern: ArchitectureConcern;
  readonly problem: ModernizationProblem;
  readonly preferenceIds: readonly EntityId[];
  readonly baseBinding: StateBinding;
  readonly research: { readonly required: boolean; readonly affectedEvidenceIds: readonly EntityId[] };
  readonly acceptance: { readonly kind: "automatic" } | { readonly kind: "explicit-user"; readonly authorityRecordId: EntityId };
  readonly evaluatedAt?: string;
}

export interface UpgradeApprovalPort {
  authenticate(input: { concernId: EntityId; evaluationId: EntityId; recommendedOptionKey: string }): Promise<{ decision: ArchitectureDecision; authority: AuthorityRecord; current: boolean }>;
}

export interface CurrentOptionEnumerationPort {
  enumerate(concern: ArchitectureConcern, compiledAgainst: StateBinding["compiledAgainst"]): Promise<{ readonly value: { readonly options: readonly DecisionOption[]; readonly dependency: StateQueryDependency }; readonly contentHash: ContentHash }>;
  assertCurrent(dependency: StateQueryDependency, compiledAgainst: StateBinding["compiledAgainst"]): Promise<boolean>;
}

export interface CurrentModernizationEvidencePort {
  read(evidenceId: EntityId): Promise<{ readonly value: { readonly id: EntityId; readonly semanticHash: ContentHash; readonly current: boolean }; readonly contentHash: ContentHash } | undefined>;
}

function validateViableEnumeration(concernId: string, dependency: StateQueryDependency): void {
  if (dependency.role !== "modernization-viable-options" || dependency.query.programId !== "modernization.viable-options" || dependency.query.input.concernId !== concernId) throw new Error("viable-option enumeration is not bound to the current concern");
  if (dependency.priorResult.queryHash !== dependency.query.semanticHash) throw new Error("viable-option enumeration query hash mismatch");
  const queryHash = hashFramedDomain("state-query", { kind: dependency.query.kind, programId: dependency.query.programId, programVersion: dependency.query.programVersion, input: dependency.query.input });
  if (dependency.query.semanticHash !== queryHash || !dependency.priorResult.dependencyKeys.includes(`concern:${concernId}`)) throw new Error("viable-option enumeration query is unauthenticated");
  if (dependency.priorResult.observability !== "closed" || dependency.priorResult.unavailableLanes.length > 0) throw new Error("viable-option enumeration must be closed and available, including empty results");
}

async function recommend(input: ModernizationRecommendationInput, ports: { readonly preferences: AuthenticatedPreferencePort; readonly authority: AuthenticatedAuthorityPort; readonly enumeration: CurrentOptionEnumerationPort; readonly evidence: CurrentModernizationEvidencePort; readonly research?: ArchitectureResearchPort; readonly approval?: UpgradeApprovalPort }): Promise<{ status: "candidate" | "approved" | "rejected"; reasons: readonly string[]; recommendation: Readonly<UpgradeRecommendation>; boundState: StateBinding; evaluation: Awaited<ReturnType<typeof evaluateDecisionOptions>>["evaluation"] }> {
  const normalizedBase = createStateBinding(input.baseBinding);
  if (normalizedBase.dependencyDigest !== input.baseBinding.dependencyDigest) throw new Error("modernization base binding is unauthenticated");
  const enumerationEnvelope = await ports.enumeration.enumerate(structuredClone(input.concern), structuredClone(input.baseBinding.compiledAgainst));
  if (enumerationEnvelope.contentHash !== hashFramedDomain("authenticated-modernization-option-enumeration", enumerationEnvelope.value)) throw new Error("viable-option enumeration store result is unauthenticated");
  const enumerated = enumerationEnvelope.value;
  validateViableEnumeration(input.concern.id, enumerated.dependency);
  if (!(await ports.enumeration.assertCurrent(enumerated.dependency, input.baseBinding.compiledAgainst))) throw new Error("viable-option enumeration is not current in the registered query store");
  const evaluationResult = await evaluateDecisionOptions({ concern: input.concern, options: enumerated.options, preferenceIds: input.preferenceIds, research: input.research, acceptance: input.acceptance, ...(input.evaluatedAt === undefined ? {} : { evaluatedAt: input.evaluatedAt }) }, ports);
  const currentViableOptions = evaluationResult.evaluation.options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "passes").map(({ key }) => key).sort(compare);
  const viableResultHash = hashFramedDomain("modernization-viable-option-result", currentViableOptions);
  if (enumerated.dependency.priorResult.resultCount !== currentViableOptions.length || enumerated.dependency.priorResult.resultHash !== viableResultHash) throw new Error("viable-option enumeration is stale or unauthenticated");
  const evidenceIds = unique([...input.problem.evidenceIds, ...input.problem.counterEvidenceIds, ...evaluationResult.evaluation.researchEvidenceIds, ...evaluationResult.evaluation.options.flatMap(({ evidence }) => evidence.map(({ evidenceId }) => evidenceId))]);
  const evidenceDependencies = [];
  for (const evidenceId of evidenceIds) {
    const evidenceEnvelope = await ports.evidence.read(evidenceId);
    if (evidenceEnvelope === undefined || evidenceEnvelope.contentHash !== hashFramedDomain("authenticated-modernization-evidence", evidenceEnvelope.value) || evidenceEnvelope.value.id !== evidenceId || !evidenceEnvelope.value.current) throw new Error(`modernization evidence ${evidenceId} is unavailable, stale, or unauthenticated`);
    evidenceDependencies.push({ kind: "canonical-entity" as const, id: evidenceId, versionHash: evidenceEnvelope.value.semanticHash, role: "modernization-evidence" });
  }
  const boundState = createStateBinding({ compiledAgainst: input.baseBinding.compiledAgainst, valueDependencies: [...input.baseBinding.valueDependencies, ...evidenceDependencies], queryDependencies: [...input.baseBinding.queryDependencies, enumerated.dependency] });
  const fashionReasons = unique([
    ...(input.problem.currentState.trim() === "" || input.problem.observedCost.trim() === "" || input.problem.targetOutcome.trim() === "" ? ["problem, observed cost, and target outcome must precede technology"] : []),
    ...(input.problem.currentMeetsRequirementsAtLowerCost === true ? ["current state meets requirements at lower total cost"] : []),
    ...(input.problem.targetSupportImmature === true ? ["target support is immature"] : []),
    ...(input.problem.speculativeScaleBenefit === true ? ["benefit depends on speculative scale"] : []),
    ...(input.problem.poorReversibility === true && input.problem.confidence < 0.8 ? ["reversibility is poor and evidence is weak"] : []),
    ...(evidenceIds.length === 0 ? ["recommendation lacks authenticated observed evidence"] : []),
    ...(input.problem.estimatedAffectedUnits === undefined ? ["affected-unit denominator is unavailable"] : []),
  ]);
  const stable = { concernId: input.concern.id, problem: structuredClone(input.problem), evaluationId: evaluationResult.evaluation.id, evaluationHash: evaluationResult.evaluation.semanticHash, boundState };
  const semanticHash = hashFramedDomain("modernization-upgrade-recommendation", stable);
  const recommendation = deepFreeze({ id: `upgrade:${semanticHash.slice(-24)}`, concernId: input.concern.id, problem: structuredClone(input.problem), evaluationId: evaluationResult.evaluation.id, boundState, semanticHash });
  if (fashionReasons.some((reason) => reason !== "affected-unit denominator is unavailable")) return { status: "rejected", reasons: fashionReasons, recommendation, boundState, evaluation: evaluationResult.evaluation };
  if (evaluationResult.acceptanceBlocked || evaluationResult.evaluation.outcome !== "recommended" || evaluationResult.evaluation.recommendedOptionKey === undefined || ports.approval === undefined) return { status: "candidate", reasons: unique([...fashionReasons, ...evaluationResult.evaluation.unknowns]), recommendation, boundState, evaluation: evaluationResult.evaluation };
  const proof = await ports.approval.authenticate({ concernId: input.concern.id, evaluationId: evaluationResult.evaluation.id, recommendedOptionKey: evaluationResult.evaluation.recommendedOptionKey });
  const decisionValid = proof.decision.semanticHash === hashSemantic("architecture-decision", proof.decision) && proof.decision.concernId === input.concern.id && proof.decision.selectedOptionKey === evaluationResult.evaluation.recommendedOptionKey && proof.decision.governanceBasis.length > 0;
  const authorityValid = proof.authority.id === proof.decision.authorityRecordId && proof.authority.subjectId === input.concern.id && authorityRecordHashIsValid(proof.authority) && (proof.authority.status === "approved" || proof.authority.status === "auto-approved") && proof.authority.conclusion !== "unknown" && proof.authority.conclusion !== "exception";
  return proof.current && decisionValid && authorityValid
    ? { status: "approved", reasons: fashionReasons, recommendation, boundState, evaluation: evaluationResult.evaluation }
    : { status: "candidate", reasons: unique([...fashionReasons, "current authority, decision, and governance basis are required"]), recommendation, boundState, evaluation: evaluationResult.evaluation };
}

export const evaluateModernization = Object.freeze({ aggregateFriction, recommend });

export type UpgradePhaseKind = "compatibility-bridge" | "all-consumers" | "incremental-cutover" | "residue-zero-cleanup";
export interface UpgradePhase { readonly key: string; readonly kind: UpgradePhaseKind; readonly title: string; readonly unitIds: readonly EntityId[]; readonly writeSelectors: readonly string[]; readonly validatorIds: readonly string[]; readonly transformId: string; readonly dependencies?: readonly string[] }
export interface UpgradeExecutionApproval { readonly recommendationId: EntityId; readonly decisionId: EntityId; readonly authorityRecordId: EntityId; readonly recommendationHash: ContentHash; readonly stateDependencyDigest: ContentHash }
export interface CurrentMigrationClosureProof { readonly consumerEnumeration: StateQueryDependency; readonly consumerUnitIds: readonly EntityId[]; readonly residueEnumeration: StateQueryDependency; readonly residueUnitIds: readonly EntityId[]; readonly current: boolean }

function validateMigrationQuery(dependency: StateQueryDependency, resultIds: readonly EntityId[], programId: "modernization.all-consumers" | "modernization.residue-zero"): void {
  if (dependency.query.programId !== programId || dependency.priorResult.queryHash !== dependency.query.semanticHash || dependency.priorResult.observability !== "closed" || dependency.priorResult.unavailableLanes.length > 0) throw new Error(`${programId} requires a current exhaustive closed query proof`);
  const expectedQueryHash = hashFramedDomain("state-query", { kind: dependency.query.kind, programId: dependency.query.programId, programVersion: dependency.query.programVersion, input: dependency.query.input });
  if (dependency.query.semanticHash !== expectedQueryHash) throw new Error(`${programId} query proof is unauthenticated`);
  const ids = unique(resultIds); const resultHash = hashFramedDomain("state-query-result", ids.map((id) => ({ id })));
  if (dependency.priorResult.resultCount !== ids.length || dependency.priorResult.resultHash !== resultHash) throw new Error(`${programId} query results are unauthenticated`);
  if (programId === "modernization.residue-zero" && ids.length !== 0) throw new Error("upgrade cleanup requires authenticated zero residue");
}

export async function compileUpgradePlan(input: { readonly recommendationId: EntityId; readonly semanticChangeId: EntityId; readonly revision: number; readonly sourceRunId: EntityId; readonly approval: UpgradeExecutionApproval; readonly phases: readonly UpgradePhase[] }, ports: {
  readonly approvals: { authenticate(approval: UpgradeExecutionApproval): Promise<{ current: boolean; decisionCurrent: boolean; governanceBasisCurrent: boolean; recommendationHash: ContentHash; stateDependencyDigest: ContentHash }> };
  readonly changes: { read(changeId: string): Promise<AuthenticatedChangePlanningInput> };
  readonly migrationProof: { verify(input: { recommendationId: EntityId; semanticChangeId: EntityId }): Promise<CurrentMigrationClosureProof> };
}): Promise<CompiledSemanticChangePlan> {
  if (input.approval.recommendationId !== input.recommendationId) throw new Error("upgrade approval is bound to another recommendation");
  const proof = await ports.approvals.authenticate(input.approval);
  if (!proof.current || !proof.decisionCurrent || !proof.governanceBasisCurrent || proof.recommendationHash !== input.approval.recommendationHash || proof.stateDependencyDigest !== input.approval.stateDependencyDigest) throw new Error("stale upgrade approval requires refresh or rebase");
  const kinds = new Set(input.phases.map(({ kind }) => kind));
  for (const required of ["compatibility-bridge", "all-consumers", "incremental-cutover", "residue-zero-cleanup"] as const) if (!kinds.has(required)) throw new Error(`upgrade migration is missing ${required}`);
  if (input.phases.length !== 4 || new Set(input.phases.map(({ key }) => key)).size !== input.phases.length) throw new Error("upgrade migration requires exactly one uniquely identified phase of each kind");
  if (input.phases.some(({ validatorIds }) => validatorIds.length === 0)) throw new Error("every upgrade phase requires validation");
  const byKind = new Map(input.phases.map((phase) => [phase.kind, phase]));
  const bridge = byKind.get("compatibility-bridge")!; const consumers = byKind.get("all-consumers")!; const cutover = byKind.get("incremental-cutover")!; const residue = byKind.get("residue-zero-cleanup")!;
  if ((bridge.dependencies ?? []).length > 0 || canonicalJson(unique(consumers.dependencies ?? [])) !== canonicalJson([bridge.key]) || canonicalJson(unique(cutover.dependencies ?? [])) !== canonicalJson([consumers.key]) || canonicalJson(unique(residue.dependencies ?? [])) !== canonicalJson([cutover.key])) throw new Error("upgrade phases must prove bridge → all consumers → cutover → residue-zero order");
  const closure = await ports.migrationProof.verify({ recommendationId: input.recommendationId, semanticChangeId: input.semanticChangeId });
  if (!closure.current) throw new Error("migration closure proof is stale");
  validateMigrationQuery(closure.consumerEnumeration, closure.consumerUnitIds, "modernization.all-consumers"); validateMigrationQuery(closure.residueEnumeration, closure.residueUnitIds, "modernization.residue-zero");
  if (canonicalJson(unique(consumers.unitIds)) !== canonicalJson(unique(closure.consumerUnitIds))) throw new Error("all-consumers phase does not cover the authenticated exhaustive consumer set");
  const authenticatedChange = await ports.changes.read(input.semanticChangeId);
  if (authenticatedChange.contentHash !== hashFramedDomain("authenticated-change-planning-input", authenticatedChange.value)) throw new Error("change planning input is unauthenticated");
  const closureBoundState = createStateBinding({ compiledAgainst: authenticatedChange.value.boundState.compiledAgainst, valueDependencies: authenticatedChange.value.boundState.valueDependencies, queryDependencies: [...authenticatedChange.value.boundState.queryDependencies, closure.consumerEnumeration, closure.residueEnumeration] });
  if (closureBoundState.dependencyDigest !== input.approval.stateDependencyDigest) throw new Error("migration closure no longer matches approved state");
  const closureChangeValue = { ...authenticatedChange.value, boundState: closureBoundState };
  const result = await compileSemanticChangePlan({ changeId: input.semanticChangeId, revision: input.revision, sourceRunId: input.sourceRunId }, {
    changes: { read: async () => ({ value: closureChangeValue, contentHash: hashFramedDomain("authenticated-change-planning-input", closureChangeValue) }) },
    packets: { compile: async () => {
      const proposals = input.phases.map((phase) => ({ key: phase.key, title: phase.title, stage: phase.kind === "compatibility-bridge" ? "bridge" as const : phase.kind === "all-consumers" ? "consumer" as const : phase.kind === "incremental-cutover" ? "cutover" as const : "cleanup" as const, executionMode: "deterministic" as const, transformId: phase.transformId, unitIds: [...phase.unitIds], semanticOwnerIds: [...phase.unitIds], writeSelectors: [...phase.writeSelectors], dependencies: [...(phase.dependencies ?? [])], validatorIds: [...phase.validatorIds] }));
      const completionContract = { requiredUnitStates: unique(input.phases.flatMap(({ unitIds }) => unitIds)).map((unitId) => ({ unitId, state: "valid" as const })), requiredValidators: unique(input.phases.flatMap(({ validatorIds }) => validatorIds)), requiredEvidenceLanes: ["test" as const], minimumValidationAssurance: "strong" as const, requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: ["residue-zero-certificate", "rollback-checkpoints"], cleanWorkingTree: true };
      const value = { proposals, completionContract };
      return { value, contentHash: hashFramedDomain("authenticated-change-packet-proposals", value) };
    } },
  });
  if (result.plan.boundState.dependencyDigest !== input.approval.stateDependencyDigest) throw new Error("compiled upgrade plan no longer matches approved state");
  return result;
}

export type ImmutableUpgradePlan = Readonly<ExecutionPlan>;
