import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import {
  BehavioralScenarioSchema,
  ArchitectureDecisionSchema,
  AuthorityRecordSchema,
  DeveloperPreferenceSchema,
  ConceptSchema,
  LineageRecordSchema,
  ProjectionLensSchema,
  ArchitectureConcernSchema,
  RelationSchema,
  RequirementSchema,
  TombstoneSchema,
  canonicalJson,
  deriveEntityId,
  hashFramedDomain,
  hashSemantic,
  withCanonicalHashes,
  type BehavioralScenario,
  type ArchitectureDecision,
  type AuthorityRecord,
  type ChangeProposal,
  type ArchitectureConcern,
  type CanonicalDocumentEnvelope,
  type ChangeOperation,
  type ContentHash,
  type DecisionDeferral,
  type RelevanceClosure,
  type Requirement,
  type ProposedRequirement,
  type ProposedScenario,
  type ProposedCanonicalMutation,
  type ProjectionLens,
  type SelectorExpr,
  type StateQueryDependency,
  type Relation,
  type LineageRecord,
  type Tombstone,
} from "@projector/core";
import {
  RepresentationCompiler,
  assessDecisionDeferral,
  canonicalRepresentationSourceFromSemanticChange,
  compileSemanticChange,
  compileSemanticChangePlan,
  compileProjectionLenses,
  createStateBinding,
  discoverArchitectureConcerns,
  executionPlanHash,
  runArchitecturePreflight,
  type ArchitectureActivationFacet,
  type CompiledSemanticChange,
  type CompiledSemanticChangePlan,
} from "@projector/engine";
import { CanonicalFileRepository, RepositoryPathService, type ExactTextPatchInput } from "@projector/runtime";

import { observeChangeRepository, type IndependentValidatorObservation } from "./repository-observer.js";
import { CHANGE_QUERY_PROGRAM_IDS, calculateRepositoryRelevance, createChangeQueryRegistry, exactIdentityCandidates } from "./query-programs.js";
import type { KnowledgeContextResult } from "../knowledge/types.js";
import { KnowledgeGraph } from "../knowledge/graph.js";
import { validateArchitectureProducts } from "./architecture-products.js";
import { buildRepositoryImpactSnapshot, predictRepositoryImpact, repositoryImpactProofHash, type RepositoryImpactSnapshot, type RepositoryImpactReport } from "../impact/service.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const placeholder = hashFramedDomain("repository-change-canonical-placeholder", null);

async function withCancellation<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const result = await operation;
  signal?.throwIfAborted();
  return result;
}

export interface SemanticIdentityResolutionEvidence {
  readonly id: string;
  readonly kind: "requirement" | "scenario";
  readonly requestedKey: string;
  readonly searchedClaims: readonly string[];
  readonly candidateIds: readonly string[];
  readonly outcome: "reuse-existing" | "create-new";
  readonly targetId: string;
  readonly canonicalRootDigest: ContentHash;
  readonly contentHash: ContentHash;
}

export interface CanonicalChangeWrite {
  readonly id: string;
  readonly kind: "requirement" | "behavioral-scenario" | "concept" | "relation" | "lineage" | "tombstone" | "architecture-decision" | "architecture-concern" | "developer-preference" | "projection-lens" | "authority-record";
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly envelope: CanonicalDocumentEnvelope;
}

export interface ArchitectureDeferralEvidence {
  readonly id: string;
  readonly authoritativeDecision: false;
  readonly concernKey: string;
  readonly materiality: "material-soon" | "deferable";
  readonly rationale: string;
  readonly reconsiderWhen: string;
  readonly validUntil: string;
  readonly preservedOptions: readonly string[];
  readonly forbiddenCommitments: readonly string[];
  readonly forbiddenWritePaths: readonly string[];
  readonly concernId: string;
  readonly discoveryHash: ContentHash;
  readonly preflightHash: ContentHash;
  readonly contentHash: ContentHash;
}

export interface RepositoryRelevanceEvidence {
  readonly id: string;
  readonly knownAffectedPaths: readonly string[];
  readonly knownAffectedUnitIds: readonly string[];
  readonly possibleFrontierUnitIds: readonly string[];
  readonly unavailableSurfaceIds: readonly string[];
  readonly reasons: readonly { readonly unitId: string; readonly kind: "exact" | "open"; readonly reason: string }[];
  readonly queryDependency: StateQueryDependency;
  readonly contentHash: ContentHash;
}

export interface RepresentationArtifactStore {
  put(contentHash: ContentHash, content: string): Promise<void>;
  get(contentHash: ContentHash): Promise<string | undefined>;
}

export interface CompiledRepositoryChange {
  readonly derivationImpact: { readonly baseline: RepositoryImpactSnapshot; readonly prediction: RepositoryImpactReport; readonly contentHash: ContentHash };
  readonly executionKind: "canonical-only" | "repository-code";
  readonly proposalHash: ContentHash;
  readonly identityResolutions: readonly SemanticIdentityResolutionEvidence[];
  readonly architectureDeferral?: ArchitectureDeferralEvidence;
  readonly relevance: RepositoryRelevanceEvidence;
  readonly canonicalWrites: readonly CanonicalChangeWrite[];
  readonly intentReview: RepositoryIntentReview;
  readonly knowledgeContext?: KnowledgeContextResult;
  readonly governanceBefore: {
    readonly memberships: readonly { readonly lensId: string; readonly unitId: string; readonly path: string }[];
    readonly contentHash: ContentHash;
  };
  readonly independentValidators: readonly IndependentValidatorObservation[];
  readonly baselineObservation: RepositoryBaselineObservation;
  readonly compiledChange: CompiledSemanticChange;
  readonly representation: {
    readonly projectionId: string;
    readonly profileId: string;
    readonly profileVersion: string;
    readonly contentHash: ContentHash;
    readonly preservationHash: ContentHash;
  };
  readonly compiledPlan: CompiledSemanticChangePlan;
  readonly planHash: ContentHash;
  readonly exactPatchInput: ExactTextPatchInput;
}

export interface RepositoryIntentReview {
  readonly identityResolution?: ChangeProposal["identityResolution"];
  readonly subjects: readonly {
    readonly id: string;
    readonly kind: "requirement" | "scenario";
    readonly operation: "preserve" | "add" | "revise";
    readonly before: Requirement | BehavioralScenario | null;
    readonly after: Requirement | BehavioralScenario;
    readonly rationale: string | null;
  }[];
  readonly relations: readonly Relation[];
  readonly canonicalMutations?: readonly {
    readonly id: string;
    readonly kind: CanonicalChangeWrite["kind"];
    readonly operation: "add" | "revise" | "retire";
    readonly before: Record<string, unknown> | null;
    readonly after: Record<string, unknown> | null;
    readonly rationale: string;
  }[];
  readonly relatedObligations: readonly { readonly id: string; readonly kind: string; readonly payload: unknown }[];
  readonly unknowns: readonly string[];
  readonly blockingUnknowns: readonly string[];
  readonly contentHash: ContentHash;
}

export interface RepositoryBaselineObservation {
  readonly files: readonly { readonly path: string; readonly contentHash: ContentHash }[];
  readonly canonicalEntries: readonly { readonly entityId: string; readonly canonicalDocumentHash: ContentHash }[];
  readonly units: readonly { readonly id: string; readonly key: string; readonly membershipHash: ContentHash; readonly validity: string }[];
  readonly analyzerFailures: readonly { readonly analyzerId: string; readonly capability: string; readonly scope: string; readonly message: string; readonly affectedClaimKinds: readonly string[] }[];
  readonly contentHash: ContentHash;
}

function baselineObservation(observation: Awaited<ReturnType<typeof observeChangeRepository>>): RepositoryBaselineObservation {
  const value = {
    files: observation.analysis.files.map(({ path, contentHash }) => ({ path, contentHash })).sort((left, right) => compare(left.path, right.path)),
    canonicalEntries: observation.canonical.entries.map(({ entityId, canonicalDocumentHash }) => ({ entityId, canonicalDocumentHash })).sort((left, right) => compare(left.entityId, right.entityId)),
    units: observation.analysis.projectionUnits.map(({ id, key, membershipHash, validity }) => ({ id, key, membershipHash, validity })).sort((left, right) => compare(left.id, right.id)),
    analyzerFailures: observation.analysis.failures.map(({ analyzerId, capability, scope, message, affectedClaimKinds }) => ({ analyzerId, capability, scope, message, affectedClaimKinds: [...affectedClaimKinds].sort(compare) })).sort((left, right) => compare(canonicalJson(left), canonicalJson(right))),
  };
  return { ...value, contentHash: hashFramedDomain("repository-change-baseline-observation", value) };
}

export interface CompileRepositoryChangeInput {
  readonly repositoryRoot: string;
  readonly request: string;
  readonly proposal: ChangeProposal;
  readonly now?: string;
  readonly knowledgeContext?: KnowledgeContextResult;
}

export interface CompileRepositoryChangeOptions {
  readonly representationArtifacts?: RepresentationArtifactStore;
  readonly signal?: AbortSignal;
}

function identityEvidence(
  kind: "requirement" | "scenario",
  requestedKey: string,
  claims: readonly string[],
  candidates: readonly { id: string }[],
  targetId: string,
  canonicalRootDigest: ContentHash,
): SemanticIdentityResolutionEvidence {
  const value = {
    kind,
    requestedKey,
    searchedClaims: unique(claims.map((claim) => claim.normalize("NFKC").trim().toLocaleLowerCase("en-US"))),
    candidateIds: unique(candidates.map(({ id }) => id)),
    outcome: candidates.length === 0 ? "create-new" as const : "reuse-existing" as const,
    targetId,
    canonicalRootDigest,
  };
  const contentHash = hashFramedDomain("repository-change-identity-resolution", value);
  const id = `identity_resolution_${contentHash.slice(-32)}`;
  return { id, ...value, contentHash };
}

function scopeFor(paths: readonly string[]): SelectorExpr {
  const atoms = unique(paths).map((path) => ({ op: "atom" as const, field: "path" as const, matcher: "equals" as const, value: path }));
  return atoms.length === 1 ? atoms[0]! : { op: "any", items: atoms };
}

function proposedRequirementPayload(
  proposal: ProposedRequirement,
  existing: Requirement | undefined,
  id: string,
  proposalHash: ContentHash,
  paths: readonly string[],
): Requirement {
  assertExplicitRevision(proposal, existing, existing !== undefined && (proposal.title !== existing.title || proposal.statement !== existing.statement));
  if (existing !== undefined && proposal.revision === undefined) return existing;
  const key = existing?.key ?? proposal.key;
  const origin = [...(existing?.origin ?? []), { kind: "document" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash,
    description: proposal.revision === undefined ? "Structured interpretation proposed for approval; not a verbatim user request."
      : `Proposed revision of ${proposal.revision.id} at ${proposal.revision.expectedSemanticHash}: ${proposal.revision.rationale}` }];
  return {
    ...(existing ?? {}),
    id,
    key,
    title: proposal.title,
    aliases: unique([...(existing?.aliases ?? []), ...proposal.aliases, ...(key === proposal.key ? [] : [proposal.key])]),
    statement: proposal.statement,
    status: "active",
    sourceClass: "authored",
    scope: existing?.scope ?? scopeFor(paths),
    origin: [...new Map(origin.map((item) => [canonicalJson(item), item])).values()],
    evidence: existing?.evidence ?? [],
    discoveryHash: existing?.discoveryHash ?? placeholder,
    semanticHash: existing?.semanticHash ?? placeholder,
  };
}

function proposedScenarioPayload(
  proposal: ProposedScenario,
  existing: BehavioralScenario | undefined,
  id: string,
  paths: readonly string[],
): BehavioralScenario {
  assertExplicitRevision(proposal, existing, existing !== undefined && (proposal.title !== existing.title || canonicalJson(proposal.steps) !== canonicalJson(existing.steps)));
  if (existing !== undefined && proposal.revision === undefined) return existing;
  const key = existing?.key ?? proposal.key;
  return {
    ...(existing ?? {}),
    id,
    key,
    title: proposal.title,
    aliases: unique([...(existing?.aliases ?? []), ...proposal.aliases, ...(key === proposal.key ? [] : [proposal.key])]),
    status: "active",
    sourceClass: "authored",
    scope: existing?.scope ?? scopeFor(paths),
    steps: proposal.steps.map((step) => ({ ...step })),
    evidence: existing?.evidence ?? [],
    discoveryHash: existing?.discoveryHash ?? placeholder,
    semanticHash: existing?.semanticHash ?? placeholder,
  };
}

function assertExplicitRevision(
  proposal: ProposedRequirement | ProposedScenario,
  existing: Requirement | BehavioralScenario | undefined,
  contentChanged: boolean,
): void {
  const revision = proposal.revision;
  if (revision !== undefined && (existing === undefined || revision.id !== existing.id || revision.expectedSemanticHash !== existing.semanticHash)) {
    throw new Error(`canonical revision target or semantic hash is stale: ${proposal.key}`);
  }
  if (existing !== undefined && existing.status !== "active") throw new Error(`canonical intent is not active: ${existing.id}`);
  if (contentChanged && revision === undefined) {
    throw new Error(`implicit canonical revision is forbidden for ${existing!.id}; preserve its exact title and meaning, or supply revision.id, expectedSemanticHash, and rationale`);
  }
  if (revision !== undefined && !contentChanged) throw new Error(`canonical revision does not change title or meaning: ${existing!.id}`);
}

async function optionalText(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return null; throw error; }
}

async function canonicalWrite(
  repositoryRoot: string,
  repository: CanonicalFileRepository,
  kind: CanonicalChangeWrite["kind"],
  id: string,
  key: string,
  payload: Requirement | BehavioralScenario | Record<string, unknown>,
): Promise<CanonicalChangeWrite> {
  const body = { ...payload } as Record<string, unknown>;
  const lifecycle = kind === "relation" ? body.active === true ? "active" : "inactive"
    : kind === "tombstone" ? "deleted"
    : typeof body.lifecycle === "string" ? body.lifecycle
      : typeof body.status === "string" ? body.status
        : "active";
  const envelope = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id, key, lifecycle, payload: body });
  const prepared = repository.prepareWrite(envelope);
  return {
    id,
    kind,
    path: relative(repositoryRoot, prepared.path).replaceAll("\\", "/"),
    before: await optionalText(prepared.path),
    after: prepared.contents,
    envelope,
  };
}

async function canonicalDelete(
  repositoryRoot: string,
  repository: CanonicalFileRepository,
  document: CanonicalDocumentEnvelope,
): Promise<CanonicalChangeWrite> {
  const kind = document.kind as CanonicalChangeWrite["kind"];
  const absolutePath = repository.pathFor(kind, document.id);
  const before = await optionalText(absolutePath);
  if (before === null) throw new Error(`canonical retirement source disappeared: ${document.id}`);
  return {
    id: document.id,
    kind,
    path: relative(repositoryRoot, absolutePath).replaceAll("\\", "/"),
    before,
    after: null,
    envelope: document,
  };
}

const canonicalMutationSchemas = {
  requirement: RequirementSchema,
  "behavioral-scenario": BehavioralScenarioSchema,
  concept: ConceptSchema,
  relation: RelationSchema,
  "architecture-decision": ArchitectureDecisionSchema,
  "architecture-concern": ArchitectureConcernSchema,
  "developer-preference": DeveloperPreferenceSchema,
  "projection-lens": ProjectionLensSchema,
  "authority-record": AuthorityRecordSchema,
} as const;

type PayloadCanonicalMutation = Exclude<ProposedCanonicalMutation, { kind: "lineage" }>;

function parsedMutationPayload(mutation: PayloadCanonicalMutation): Record<string, unknown> {
  const supplied = mutation.payload as Record<string, unknown>;
  const payloadWithNestedHashes = mutation.kind === "projection-lens" ? {
    ...supplied,
    rules: (supplied.rules as readonly Record<string, unknown>[]).map((rule) => ({ ...rule, semanticHash: hashSemantic("rule", rule) })),
    impactRules: (supplied.impactRules as readonly Record<string, unknown>[]).map((rule) => ({ ...rule, semanticHash: hashFramedDomain("impact-rule", rule) })),
  } : supplied;
  const result = canonicalMutationSchemas[mutation.kind].safeParse({
    ...payloadWithNestedHashes,
    semanticHash: mutation.kind === "behavioral-scenario" ? hashSemantic("behavioral-scenario", payloadWithNestedHashes) : placeholder,
    ...(["concept", "requirement", "behavioral-scenario"].includes(mutation.kind) ? { discoveryHash: placeholder } : {}),
  });
  if (!result.success) throw new Error(`invalid ${mutation.kind} mutation payload: ${result.error.message}`);
  const payload = result.data as Record<string, unknown>;
  if (["concept", "requirement", "behavioral-scenario", "relation", "architecture-concern", "developer-preference"].includes(mutation.kind) && payload.sourceClass !== "authored") {
    throw new Error(`${mutation.kind} mutations must be explicitly authored; observed or inferred material cannot be promoted`);
  }
  if (mutation.kind === "developer-preference" && payload.scope !== "project") throw new Error("repository preferences must be explicitly adopted with project scope; local user and organization preferences cannot become shared authority implicitly");
  return payload;
}

function mutationKey(kind: PayloadCanonicalMutation["kind"], payload: Record<string, unknown>): string {
  if (kind === "relation") return `relation:${String(payload.id)}`;
  if (typeof payload.key !== "string" || payload.key.trim() === "") throw new Error(`${kind} mutation payload requires a key`);
  return payload.key;
}

function assertEligibleAuthority(record: AuthorityRecord, subjectId: string, label: string): void {
  if (record.subjectId !== subjectId) throw new Error(`${label} authority ${record.id} is bound to ${record.subjectId}, expected ${subjectId}`);
  if (record.status !== "approved" && record.status !== "auto-approved") throw new Error(`${label} authority ${record.id} is not approved`);
  if (record.conclusion === "unknown" || record.conclusion === "exception") throw new Error(`${label} authority ${record.id} does not authorize activation`);
  if (record.decidedBy === "system" && record.status !== "auto-approved") throw new Error(`system authority ${record.id} lacks auto-approval`);
}

function isEligibleAuthority(record: AuthorityRecord): boolean {
  return (record.status === "approved" || record.status === "auto-approved")
    && record.conclusion !== "unknown"
    && record.conclusion !== "exception"
    && (record.decidedBy !== "system" || record.status === "auto-approved");
}

function defaultRepresentationArtifacts(): RepresentationArtifactStore {
  const values = new Map<ContentHash, string>();
  return { put: async (hash, content) => { const prior = values.get(hash); if (prior !== undefined && prior !== content) throw new Error("representation artifact hash collision"); values.set(hash, content); }, get: async (hash) => values.get(hash) };
}

async function compileRepresentation(change: CompiledSemanticChange, artifacts: RepresentationArtifactStore) {
  const tokenizer = { profileId: "projector.whitespace@1", measure: (text: string) => text.trim() === "" ? 0 : text.trim().split(/\s+/u).length };
  const compiler = new RepresentationCompiler({
    artifacts,
    tokenizer,
    utility: { profileId: "projector.instruction-cost@1", measure: ({ source, candidate, profileOverheadTokens }) => ({ netInstructionEfficiency: tokenizer.measure(source.statements.map(({ text }) => text).join("\n")) - tokenizer.measure(candidate) - profileOverheadTokens, evidence: "deterministic total instruction payload cost including profile overhead" }) },
  });
  const { projection } = await compiler.compileBest({ source: canonicalRepresentationSourceFromSemanticChange(change.change), binding: change.boundState, requestedProfileKey: "agent-compact@1" });
  return { projectionId: projection.id, profileId: projection.profileId, profileVersion: projection.profileVersion, contentHash: projection.contentHash, preservationHash: projection.preservation.semanticHash };
}

export async function compileRepositoryChange(
  input: CompileRepositoryChangeInput,
  options: CompileRepositoryChangeOptions = {},
): Promise<CompiledRepositoryChange> {
  options.signal?.throwIfAborted();
  const request = input.request.normalize("NFKC").trim();
  if (request.length === 0 || request.length > 16_384 || request.includes("\0")) throw new Error("natural-language change request must be nonblank bounded UTF-8 text");
  const now = input.now ?? new Date().toISOString();
  const executionKind = input.proposal.edits.length === 0 ? "canonical-only" as const : "repository-code" as const;
  const semanticAnalysisFacets = input.proposal.analysisFacets.filter((facet) => facet !== "workspace-expansion");
  if (input.proposal.architecture !== null) {
    const deferralDurationMs = Date.parse(input.proposal.architecture.deferral.validUntil) - Date.parse(now);
    if (deferralDurationMs <= 0) throw new Error("architecture deferral is expired");
    if (deferralDurationMs > 366 * 24 * 60 * 60 * 1_000) throw new Error("architecture deferral horizon exceeds one year");
  }

  const observation = await withCancellation(observeChangeRepository(input.repositoryRoot), options.signal);
  const queryRegistry = createChangeQueryRegistry({ observation, now });
  const proposalHash = hashFramedDomain("repository-change-proposal", input.proposal);
  const context = { repositoryRoot: input.repositoryRoot, stateDigest: observation.state, config: {}, signal: options.signal ?? new AbortController().signal };
  const paths = await withCancellation(RepositoryPathService.create(input.repositoryRoot), options.signal);
  for (const edit of input.proposal.edits) {
    options.signal?.throwIfAborted();
    let actual: string | null;
    try {
      const resolved = await withCancellation(paths.resolveRead(edit.path), options.signal);
      actual = await withCancellation(readFile(resolved.realTarget, "utf8"), options.signal);
    }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") actual = null; else throw error; }
    if (actual !== edit.before) throw new Error(`proposal exact before content is stale: ${edit.path}`);
  }
  const independentValidators = await withCancellation(Promise.all(input.proposal.validation.independentNodeTests.map((path) => observation.independentValidator(path))), options.signal);
  const canonical = new CanonicalFileRepository(input.repositoryRoot);
  const retiredEntityIds = new Set(observation.canonical.documents
    .filter(({ kind }) => kind === "tombstone")
    .map(({ payload }) => String(payload.entityId)));
  const assertAdditionIsNotRetired = (kind: "requirement" | "behavioral-scenario" | "concept", id: string): void => {
    if (retiredEntityIds.has(id)) throw new Error(`${kind} stable ID is retired by an immutable tombstone: ${id}`);
  };
  const existingRequirements = observation.canonical.documents.filter(({ kind }) => kind === "requirement").map(({ payload }) => RequirementSchema.parse(payload) as Requirement);
  const existingScenarios = observation.canonical.documents.filter(({ kind }) => kind === "behavioral-scenario").map(({ payload }) => BehavioralScenarioSchema.parse(payload) as BehavioralScenario);
  const editedPaths = input.proposal.edits.map(({ path }) => path);
  const identityResolutions: SemanticIdentityResolutionEvidence[] = [];
  const identityQueries: StateQueryDependency[] = [];
  const canonicalWrites: CanonicalChangeWrite[] = [];
  const operations: ChangeOperation[] = [];
  const reviewSubjects: RepositoryIntentReview["subjects"][number][] = [];

  for (const proposed of input.proposal.requirements) {
    const claims = [proposed.key, ...proposed.aliases];
    const candidates = exactIdentityCandidates(observation, "requirement", claims) as Requirement[];
    if (candidates.length > 1) throw new Error(`ambiguous duplicate requirement identity: ${proposed.key}`);
    const derivedId = deriveEntityId("projector.requirement", proposed.key);
    if (candidates.length === 0 && existingRequirements.some(({ id }) => id === derivedId)) throw new Error(`requirement stable ID is occupied by an unrelated identity: ${derivedId}`);
    const existing = candidates[0];
    const targetId = existing?.id ?? derivedId;
    if (existing === undefined) assertAdditionIsNotRetired("requirement", targetId);
    const resolution = identityEvidence("requirement", proposed.key, claims, candidates, targetId, observation.canonical.rootDigest);
    const query = queryRegistry.createSpec({ id: `identity:requirement:${resolution.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.identityExact, input: { kind: "requirement", claims } });
    const priorResult = await withCancellation(queryRegistry.evaluate(query, context), options.signal);
    if (priorResult.resultCount !== candidates.length) throw new Error(`authenticated requirement identity query disagrees with resolved candidates: ${proposed.key}`);
    identityResolutions.push(resolution); identityQueries.push({ query, priorResult, role: "exact requirement key and alias negative-space search" });
    const payload = proposedRequirementPayload(proposed, existing, targetId, proposalHash, editedPaths);
    reviewSubjects.push({ id: targetId, kind: "requirement", operation: existing === undefined ? "add" : proposed.revision === undefined ? "preserve" : "revise", before: existing ?? null, after: payload, rationale: proposed.revision?.rationale ?? null });
    if (existing !== undefined && proposed.revision === undefined) continue;
    const write = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, "requirement", targetId, payload.key, payload), options.signal);
    reviewSubjects[reviewSubjects.length - 1] = { ...reviewSubjects.at(-1)!, after: RequirementSchema.parse(write.envelope.payload) as Requirement };
    if (write.before !== write.after) {
      canonicalWrites.push(write);
      operations.push({ subjectType: "requirement", kind: existing === undefined ? "add" : "modify", requirementId: targetId, proposedRequirement: payload, rationale: proposed.revision?.rationale ?? `structured proposal ${proposalHash}` });
    }
  }
  for (const proposed of input.proposal.scenarios) {
    const claims = [proposed.key, ...proposed.aliases];
    const candidates = exactIdentityCandidates(observation, "scenario", claims) as BehavioralScenario[];
    if (candidates.length > 1) throw new Error(`ambiguous duplicate scenario identity: ${proposed.key}`);
    const derivedId = deriveEntityId("projector.scenario", proposed.key);
    if (candidates.length === 0 && existingScenarios.some(({ id }) => id === derivedId)) throw new Error(`scenario stable ID is occupied by an unrelated identity: ${derivedId}`);
    const existing = candidates[0];
    const targetId = existing?.id ?? derivedId;
    if (existing === undefined) assertAdditionIsNotRetired("behavioral-scenario", targetId);
    const resolution = identityEvidence("scenario", proposed.key, claims, candidates, targetId, observation.canonical.rootDigest);
    const query = queryRegistry.createSpec({ id: `identity:scenario:${resolution.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.identityExact, input: { kind: "scenario", claims } });
    const priorResult = await withCancellation(queryRegistry.evaluate(query, context), options.signal);
    if (priorResult.resultCount !== candidates.length) throw new Error(`authenticated scenario identity query disagrees with resolved candidates: ${proposed.key}`);
    identityResolutions.push(resolution); identityQueries.push({ query, priorResult, role: "exact scenario key and alias negative-space search" });
    const payload = proposedScenarioPayload(proposed, existing, targetId, editedPaths);
    reviewSubjects.push({ id: targetId, kind: "scenario", operation: existing === undefined ? "add" : proposed.revision === undefined ? "preserve" : "revise", before: existing ?? null, after: payload, rationale: proposed.revision?.rationale ?? null });
    if (existing !== undefined && proposed.revision === undefined) continue;
    const write = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, "behavioral-scenario", targetId, payload.key, payload), options.signal);
    reviewSubjects[reviewSubjects.length - 1] = { ...reviewSubjects.at(-1)!, after: BehavioralScenarioSchema.parse(write.envelope.payload) as BehavioralScenario };
    if (write.before !== write.after) {
      canonicalWrites.push(write);
      operations.push({ subjectType: "scenario", kind: existing === undefined ? "add" : "modify", scenarioId: targetId, proposedScenario: payload, rationale: proposed.revision?.rationale ?? `structured proposal ${proposalHash}` });
    }
  }
  const mutationReviews: NonNullable<RepositoryIntentReview["canonicalMutations"]>[number][] = [];
  const documentsAfter = new Map(observation.canonical.documents.map((document) => [document.id, document]));
  for (const write of canonicalWrites) documentsAfter.set(write.id, write.envelope);
  for (const mutation of input.proposal.canonicalMutations ?? []) {
    if (mutation.kind === "lineage") continue;
    const payload = parsedMutationPayload(mutation);
    const id = String(payload.id);
    const existing = documentsAfter.get(id);
    if (mutation.operation === "add") {
      if (existing !== undefined) throw new Error(`canonical addition expected ${id} to be absent`);
      if (mutation.kind === "concept" || mutation.kind === "requirement" || mutation.kind === "behavioral-scenario") assertAdditionIsNotRetired(mutation.kind, id);
      const duplicateKey = [...documentsAfter.values()].find((document) => document.kind === mutation.kind && document.key === mutationKey(mutation.kind, payload));
      if (duplicateKey !== undefined) throw new Error(`${mutation.kind} key is already owned by ${duplicateKey.id}`);
    } else {
      if (existing === undefined || existing.kind !== mutation.kind) throw new Error(`canonical revision target is absent or has another kind: ${id}`);
      if (existing.semanticHash !== mutation.expectedSemanticHash || existing.canonicalDocumentHash !== mutation.expectedDocumentHash) {
        throw new Error(`canonical revision target hashes are stale: ${id}`);
      }
    }
    const write = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, mutation.kind, id, mutationKey(mutation.kind, payload), payload), options.signal);
    if (mutation.operation === "revise" && existing?.canonicalDocumentHash === write.envelope.canonicalDocumentHash) {
      throw new Error(`canonical revision is a no-op: ${id}`);
    }
    canonicalWrites.push(write);
    documentsAfter.set(id, write.envelope);
    mutationReviews.push({ id, kind: mutation.kind, operation: mutation.operation, before: existing?.payload ?? null, after: write.envelope.payload, rationale: mutation.rationale });
    if (mutation.kind === "requirement") operations.push({ subjectType: "requirement", kind: mutation.operation === "add" ? "add" : "modify", requirementId: id, proposedRequirement: RequirementSchema.parse(write.envelope.payload) as Requirement, rationale: mutation.rationale });
    else if (mutation.kind === "behavioral-scenario") operations.push({ subjectType: "scenario", kind: mutation.operation === "add" ? "add" : "modify", scenarioId: id, proposedScenario: BehavioralScenarioSchema.parse(write.envelope.payload) as BehavioralScenario, rationale: mutation.rationale });
    else operations.push({
      subjectType: mutation.kind === "architecture-decision" ? "decision" : mutation.kind === "projection-lens" ? "lens" : mutation.kind === "concept" || mutation.kind === "relation" ? mutation.kind : "other",
      subjectKey: mutationKey(mutation.kind, payload),
      subjectId: id,
      kind: mutation.operation === "add" ? mutation.kind === "projection-lens" ? "adopt-rule" : "add" : "modify",
      payload: { ...write.envelope.payload, revisionRationale: mutation.rationale },
    });
  }
  for (const mutation of input.proposal.canonicalMutations ?? []) {
    if (mutation.kind !== "lineage") continue;
    const sources = mutation.sources.map((source) => {
      if (canonicalWrites.some(({ id }) => id === source.id)) {
        throw new Error(`lineage source cannot also be revised in the same proposal: ${source.id}`);
      }
      const document = documentsAfter.get(source.id);
      if (document === undefined || document.kind !== source.kind) {
        throw new Error(`lineage source is absent or has another kind: ${source.id}`);
      }
      if (document.semanticHash !== source.expectedSemanticHash || document.canonicalDocumentHash !== source.expectedDocumentHash) {
        throw new Error(`lineage source hashes are stale: ${source.id}`);
      }
      return document;
    });
    const sourceKind = sources[0]!.kind;
    if (sources.some(({ kind }) => kind !== sourceKind)) throw new Error("lineage sources must have one canonical kind");
    for (const replacementId of mutation.replacementIds) {
      const replacement = documentsAfter.get(replacementId);
      if (replacement === undefined || replacement.kind !== sourceKind) {
        throw new Error(`lineage replacement is absent or has another kind: ${replacementId}`);
      }
    }
    const fromIds = sources.map(({ id }) => id).sort(compare);
    const toIds = [...mutation.replacementIds].sort(compare);
    const lineageId = deriveEntityId("projector.lineage", canonicalJson({
      kind: mutation.lineageKind,
      fromIds,
      toIds,
      stateDigest: observation.state.canonicalProjectorDigest,
    }));
    if (documentsAfter.has(lineageId)) throw new Error(`immutable lineage record already exists: ${lineageId}`);
    const lineage = LineageRecordSchema.parse({
      id: lineageId,
      kind: mutation.lineageKind,
      fromIds,
      toIds,
      reason: mutation.rationale,
      stateDigest: observation.state.canonicalProjectorDigest,
    }) as LineageRecord;
    const lineageWrite = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, "lineage", lineageId, `lineage:${lineageId}`, lineage as unknown as Record<string, unknown>), options.signal);
    canonicalWrites.push(lineageWrite);
    documentsAfter.set(lineageId, lineageWrite.envelope);
    mutationReviews.push({ id: lineageId, kind: "lineage", operation: "add", before: null, after: lineageWrite.envelope.payload, rationale: mutation.rationale });
    operations.push({ subjectType: "other", subjectKey: `lineage:${lineageId}`, subjectId: lineageId, kind: "add", payload: lineageWrite.envelope.payload });

    for (const source of sources) {
      const duplicateTombstone = [...documentsAfter.values()].find((document) => document.kind === "tombstone" && document.payload.entityId === source.id);
      if (duplicateTombstone !== undefined) throw new Error(`immutable tombstone already exists for ${source.id}`);
      const tombstoneId = deriveEntityId("projector.tombstone", source.id);
      if (documentsAfter.has(tombstoneId)) throw new Error(`tombstone stable ID is occupied: ${tombstoneId}`);
      const tombstone = TombstoneSchema.parse({
        entityId: source.id,
        deletedAtRevision: 1,
        lastSemanticHash: source.semanticHash,
        replacementIds: toIds,
        reason: mutation.rationale,
      }) as Tombstone;
      const tombstoneWrite = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, "tombstone", tombstoneId, `tombstone:${source.id}`, tombstone as unknown as Record<string, unknown>), options.signal);
      const deletionWrite = await withCancellation(canonicalDelete(input.repositoryRoot, canonical, source), options.signal);
      canonicalWrites.push(tombstoneWrite, deletionWrite);
      documentsAfter.set(tombstoneId, tombstoneWrite.envelope);
      documentsAfter.delete(source.id);
      mutationReviews.push(
        { id: tombstoneId, kind: "tombstone", operation: "add", before: null, after: tombstoneWrite.envelope.payload, rationale: mutation.rationale },
        { id: source.id, kind: source.kind as CanonicalChangeWrite["kind"], operation: "retire", before: source.payload, after: null, rationale: mutation.rationale },
      );
      operations.push(
        { subjectType: "other", subjectKey: `tombstone:${source.id}`, subjectId: tombstoneId, kind: "add", payload: tombstoneWrite.envelope.payload },
        source.kind === "requirement"
          ? { subjectType: "requirement", kind: "remove", requirementId: source.id, rationale: mutation.rationale }
          : source.kind === "behavioral-scenario"
            ? { subjectType: "scenario", kind: "remove", scenarioId: source.id, rationale: mutation.rationale }
            : { subjectType: "concept", subjectKey: source.key, subjectId: source.id, kind: "remove", payload: { rationale: mutation.rationale } },
      );
    }
  }
  const retiredIds = new Set((input.proposal.canonicalMutations ?? []).filter((mutation) => mutation.kind === "lineage").flatMap(({ sources }) => sources.map(({ id }) => id)));
  for (const mutation of input.proposal.canonicalMutations ?? []) {
    if (mutation.kind !== "requirement" && mutation.kind !== "behavioral-scenario") continue;
    const changed = documentsAfter.get(String(mutation.payload.id))!;
    if (changed.payload.status !== "active") continue;
    const claims = (document: CanonicalDocumentEnvelope) => new Set([document.key, ...(document.payload.aliases as string[])].map((value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US")));
    const selectedClaims = claims(changed);
    const overlap = [...documentsAfter.values()].find((document) => document.id !== changed.id && document.kind === changed.kind && document.payload.status === "active" && [...claims(document)].some((claim) => selectedClaims.has(claim)));
    if (overlap !== undefined) throw new Error(`${changed.kind} identity claims are already owned by ${overlap.id}; revise or explicitly retire the existing identity`);
  }
  const knownAfterIds = new Set([...documentsAfter.keys(), ...observation.analysis.projectionUnits.map(({ id }) => id)]);
  for (const relation of [...documentsAfter.values()].filter(({ kind }) => kind === "relation").map(({ payload }) => RelationSchema.parse(payload) as Relation).filter(({ active }) => active)) {
    if (retiredIds.has(relation.fromId) || retiredIds.has(relation.toId)) throw new Error(`active relation ${relation.id} still references a retired identity`);
  }
  for (const review of mutationReviews.filter(({ kind, after }) => kind === "relation" && after !== null)) {
    const relation = RelationSchema.parse(documentsAfter.get(review.id)!.payload) as Relation;
    if (relation.active && (!knownAfterIds.has(relation.fromId) || !knownAfterIds.has(relation.toId))) throw new Error(`relation ${relation.id} has a dangling endpoint`);
  }
  const authoritiesAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload) as AuthorityRecord);
  const authorityById = new Map(authoritiesAfter.map((record) => [record.id, record]));
  const decisionsAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => ArchitectureDecisionSchema.parse(payload) as ArchitectureDecision);
  const lensesAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "projection-lens").map(({ payload }) => ProjectionLensSchema.parse(payload) as ProjectionLens);
  validateArchitectureProducts([...documentsAfter.values()], now, new Set(canonicalWrites.map(({ id }) => id)));
  if (mutationReviews.length > 0) {
    const decisionConcernIds = new Set(decisionsAfter.map(({ concernId }) => concernId));
    for (const authority of authoritiesAfter.filter(isEligibleAuthority)) if (!knownAfterIds.has(authority.subjectId) && !decisionConcernIds.has(authority.subjectId)) {
      throw new Error(`authority ${authority.id} has a dangling subject ${authority.subjectId}`);
    }
    for (const decision of decisionsAfter.filter(({ lifecycle }) => lifecycle === "active")) {
      const authority = authorityById.get(decision.authorityRecordId);
      if (authority === undefined) throw new Error(`active decision ${decision.id} has no authority record ${decision.authorityRecordId}`);
      assertEligibleAuthority(authority, decision.concernId, `active decision ${decision.id}`);
    }
    const activeByConcern = new Map<string, string[]>();
    for (const decision of decisionsAfter) {
      if (decision.lifecycle === "active") activeByConcern.set(decision.concernId, [...(activeByConcern.get(decision.concernId) ?? []), decision.id]);
      for (const supersededId of decision.supersedesDecisionIds) {
        const targetDocument = documentsAfter.get(supersededId);
        if (targetDocument?.kind !== "architecture-decision") throw new Error(`decision ${decision.id} supersedes a missing or non-decision target ${supersededId}`);
        const target = ArchitectureDecisionSchema.parse(targetDocument.payload) as ArchitectureDecision;
        if (target.concernId !== decision.concernId) throw new Error(`decision ${decision.id} cannot supersede ${supersededId} from another concern`);
        if (target.lifecycle !== "superseded") throw new Error(`superseded decision ${supersededId} must be superseded in the proposed final state`);
      }
    }
    for (const [concernId, ids] of activeByConcern) if (ids.length > 1) throw new Error(`concern ${concernId} has multiple active decisions: ${ids.sort(compare).join(", ")}`);
    for (const governed of [...decisionsAfter.filter(({ lifecycle }) => lifecycle === "active"), ...lensesAfter.filter(({ status }) => status === "active")]) for (const basis of governed.governanceBasis) {
      const referencedId = basis.kind === "architecture-decision" ? basis.decisionId
        : basis.kind === "hard-constraint" ? basis.conceptId
          : basis.kind === "adopted-standard" ? basis.authorityRecordId
            : basis.kind === "migration-overlay" ? basis.migrationId
              : basis.kind === "active-lens" ? basis.lensId
                : undefined;
      if (referencedId === undefined) continue;
      const target = documentsAfter.get(referencedId);
      const expectedKind = basis.kind === "architecture-decision" ? "architecture-decision"
        : basis.kind === "hard-constraint" ? "concept"
          : basis.kind === "adopted-standard" ? "authority-record"
            : basis.kind === "migration-overlay" ? "migration"
              : "projection-lens";
      if (target?.kind !== expectedKind) throw new Error(`${governed.id} governance basis ${basis.kind} references missing or wrong-kind ${referencedId}`);
      if (basis.kind === "hard-constraint") {
        const concept = ConceptSchema.parse(target.payload) as { status: string };
        if (concept.status !== "active") throw new Error(`${governed.id} hard constraint ${referencedId} is not active`);
      } else if (basis.kind === "architecture-decision") {
        const decision = ArchitectureDecisionSchema.parse(target.payload) as ArchitectureDecision;
        if (decision.lifecycle !== "active") throw new Error(`${governed.id} decision basis ${referencedId} is not active`);
      } else if (basis.kind === "adopted-standard") {
        const authority = AuthorityRecordSchema.parse(target.payload) as AuthorityRecord;
        const subjectId = "concernId" in governed ? governed.concernId : governed.id;
        assertEligibleAuthority(authority, subjectId, `${governed.id} adopted-standard basis`);
      } else if (basis.kind === "active-lens") {
        const lens = ProjectionLensSchema.parse(target.payload) as ProjectionLens;
        if (lens.status !== "active") throw new Error(`${governed.id} lens basis ${referencedId} is not active`);
      }
    }
    compileProjectionLenses({ lenses: lensesAfter, units: [], authorityRecords: authoritiesAfter });
  }
  if (executionKind === "canonical-only" && canonicalWrites.length === 0) throw new Error("canonical-only proposal produces no model change");
  canonicalWrites.sort((left, right) => compare(left.path, right.path));
  const contextIds = input.knowledgeContext?.branches
    .filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)
    .flatMap(({ closure }) => closure.entries.map(({ entityId }) => entityId)) ?? [];
  const requiredContextIds = input.knowledgeContext?.branches
    .filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)
    .flatMap(({ closure }) => closure.entries.filter(({ requiredForPlanning }) => requiredForPlanning).map(({ entityId }) => entityId)) ?? [];
  const contextRootIds = input.knowledgeContext?.branches
    .filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)
    .map(({ interpretation }) => interpretation.entityId) ?? [];
  const relationMutationEndpointIds = mutationReviews
    .filter(({ kind }) => kind === "relation")
    .flatMap(({ before, after }) => [before, after])
    .filter((payload): payload is Record<string, unknown> => payload !== null)
    .flatMap((payload) => {
      const relation = RelationSchema.parse(payload) as Relation;
      return [relation.fromId, relation.toId];
    });
  const semanticRootIds = unique([
    ...identityResolutions.map(({ targetId }) => targetId),
    ...mutationReviews.filter(({ kind }) => kind !== "relation").map(({ id }) => id),
    ...relationMutationEndpointIds,
    ...contextRootIds,
  ]).sort(compare);
  // Context entries also carry implementation manifestations such as projection units.
  // Keep them available to review without turning them into conceptual traversal roots.
  const relatedIds = new Set(contextIds);
  const relations = [...documentsAfter.values()]
    .filter(({ kind }) => kind === "relation")
    .map(({ payload }) => RelationSchema.parse(payload) as Relation)
    .filter(({ active }) => active)
    .sort((left, right) => compare(left.id, right.id));
  const relatedRelations = new Map<string, Relation>();
  const candidateRelationIds = new Set<string>();
  const commitmentFrontier = new Set<string>();
  const unresolvedCommitmentIds = new Set<string>();
  const maximumCommitments = 128;
  // True semantic roots start two independent directed traversals. Prerequisite
  // discoveries never become dependent roots (and vice versa), which prevents two
  // subjects that share one prerequisite from recruiting each other as siblings.
  // Ownership, realization, scenario, and governance edges expand only forward.
  // Descriptive edges (documents, observes, variants, etc.) do not impose obligations.
  const dependencyRelations = new Set(["requires", "depends-on", "constrains"]);
  const forwardRelations = new Set(["owns", "has-requirement", "realizes", "demonstrated-by", "governed-by"]);
  const canonicalObligationIds = new Set([...documentsAfter.values()].filter(({ kind }) => kind !== "relation").map(({ id }) => id));
  const observedProjectionIds = new Set(observation.analysis.projectionUnits.map(({ id }) => id));
  const countedObligationIds = new Set<string>();
  const prerequisiteQueue: string[] = [];
  const dependentQueue: string[] = [];
  const prerequisiteVisited = new Set<string>();
  const dependentVisited = new Set<string>();
  for (const id of requiredContextIds) {
    if (!canonicalObligationIds.has(id) && !observedProjectionIds.has(id)) unresolvedCommitmentIds.add(id);
  }
  const enqueue = (id: string, direction: "prerequisite" | "dependent"): void => {
    relatedIds.add(id);
    if (!canonicalObligationIds.has(id)) {
      if (!observedProjectionIds.has(id)) unresolvedCommitmentIds.add(id);
      return;
    }
    if (!countedObligationIds.has(id)) {
      if (countedObligationIds.size >= maximumCommitments) { commitmentFrontier.add(id); return; }
      countedObligationIds.add(id);
    }
    const enqueueDirection = (nextDirection: "prerequisite" | "dependent"): void => {
      const visited = nextDirection === "prerequisite" ? prerequisiteVisited : dependentVisited;
      const queue = nextDirection === "prerequisite" ? prerequisiteQueue : dependentQueue;
      if (!visited.has(id)) { visited.add(id); queue.push(id); }
    };
    enqueueDirection(direction);
    // A dependent is itself impacted, so retain its own forward prerequisites and
    // governance. Those discoveries remain prerequisite-only and cannot recruit
    // other dependents that happen to share them.
    if (direction === "dependent") enqueueDirection("prerequisite");
  };
  for (const id of semanticRootIds) {
    enqueue(id, "prerequisite");
    enqueue(id, "dependent");
  }
  const traverse = (queue: string[], direction: "prerequisite" | "dependent"): void => {
    for (let offset = 0; offset < queue.length; offset += 1) {
      const currentId = queue[offset]!;
      for (const relation of relations) {
        const dependency = dependencyRelations.has(relation.type);
        const forward = forwardRelations.has(relation.type);
        let nextId: string | undefined;
        if (direction === "prerequisite" && (dependency || forward) && relation.fromId === currentId) nextId = relation.toId;
        if (direction === "dependent" && dependency && relation.toId === currentId) nextId = relation.fromId;
        if (nextId === undefined) continue;
        if (relation.sourceClass === "inferred") { candidateRelationIds.add(relation.id); continue; }
        relatedRelations.set(relation.id, relation);
        enqueue(nextId, direction);
      }
    }
  };
  traverse(dependentQueue, "dependent");
  traverse(prerequisiteQueue, "prerequisite");
  const knownIds = new Set([...documentsAfter.keys(), ...retiredIds, ...observation.analysis.projectionUnits.map(({ id }) => id), ...identityResolutions.map(({ targetId }) => targetId)]);
  const blockingUnknowns = unique([
    ...[...unresolvedCommitmentIds].filter((id) => !knownIds.has(id)).sort(compare).map((id) => `related commitment has no current canonical entity or observed projection: ${id}`),
    ...[...commitmentFrontier].sort(compare).map((id) => `conceptual obligation traversal reached its ${maximumCommitments}-entity bound before resolving ${id}`),
  ]);
  const reviewBasis = {
    ...(input.proposal.identityResolution === undefined ? {} : { identityResolution: input.proposal.identityResolution }),
    subjects: reviewSubjects.sort((a, b) => compare(a.id, b.id)),
    relations: [...relatedRelations.values()].sort((a, b) => compare(a.id, b.id)),
    canonicalMutations: mutationReviews.sort((a, b) => compare(a.id, b.id)),
    relatedObligations: observation.canonical.documents.filter(({ id, kind }) => relatedIds.has(id) && kind !== "relation").map(({ id, kind, payload }) => ({ id, kind, payload })).sort((a, b) => compare(a.id, b.id)),
    blockingUnknowns,
    unknowns: unique([
      ...blockingUnknowns,
      ...[...candidateRelationIds].map((id) => `inferred relation remains a candidate and has not been adopted as an obligation: ${id}`),
      "Independent validator provenance does not establish coverage of every requirement or scenario outcome.",
      ...(input.knowledgeContext === undefined ? ["No retained pre-edit conceptual context was supplied; relevance starts from proposal identities."] : input.knowledgeContext.unknowns),
    ]),
  };
  const intentReview: RepositoryIntentReview = { ...reviewBasis, contentHash: hashFramedDomain("repository-intent-review", reviewBasis) };
  if (blockingUnknowns.length > 0) throw new Error(`unresolved conceptual obligations prevent planning: ${blockingUnknowns.join("; ")}`);
  const boundary = unique([...editedPaths, ...canonicalWrites.map(({ path }) => path)]);
  const calculatedRelevance = calculateRepositoryRelevance(observation, editedPaths);
  if (calculatedRelevance.unavailableSurfaceIds.length > 0) {
    throw new Error(`repository change compilation requires unavailable analyzer evidence: ${calculatedRelevance.unavailableSurfaceIds.join(", ")}`);
  }
  const relevanceSpec = queryRegistry.createSpec({ id: `relevance:${hashFramedDomain("repository-change-relevance-query-id", editedPaths).slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.reverseImporters, input: { editedPaths } });
  const relevancePrior = await withCancellation(queryRegistry.evaluate(relevanceSpec, context), options.signal);
  const relevanceValue = {
    knownAffectedPaths: calculatedRelevance.knownAffectedPaths,
    knownAffectedUnitIds: calculatedRelevance.knownAffectedUnitIds,
    possibleFrontierUnitIds: calculatedRelevance.possibleFrontierUnitIds,
    unavailableSurfaceIds: calculatedRelevance.unavailableSurfaceIds,
    reasons: calculatedRelevance.reasons,
    queryDependency: { query: relevanceSpec, priorResult: relevancePrior, role: "edited units, transitive reverse importers, and bounded negative space" },
  };
  const relevanceHash = hashFramedDomain("repository-change-relevance", relevanceValue);
  const relevance: RepositoryRelevanceEvidence = { id: `relevance_${relevanceHash.slice(-32)}`, ...relevanceValue, contentHash: relevanceHash };
  const knowledgeGraph = new KnowledgeGraph(observation);
  const impactBaseline = buildRepositoryImpactSnapshot(observation, knowledgeGraph);
  const impactPrediction = await withCancellation(predictRepositoryImpact(impactBaseline, editedPaths, canonicalWrites), options.signal);
  const derivationImpact = { baseline: impactBaseline, prediction: impactPrediction, contentHash: repositoryImpactProofHash(impactBaseline, impactPrediction) };
  if (impactPrediction.blockedUnitIds.length > 0) throw new Error(`active Impact Rules block planning for ${impactPrediction.blockedUnitIds.join(", ")}`);
  const affectedBefore = new Set(relevance.knownAffectedUnitIds);
  const memberships = knowledgeGraph.lenses.filter(({ status }) => status === "active").flatMap(({ id: lensId }) =>
    (knowledgeGraph.lensCompilation?.memberships[lensId] ?? []).filter((unitId) => affectedBefore.has(unitId))
      .map((unitId) => ({ lensId, unitId, path: knowledgeGraph.units.find(({ id }) => id === unitId)!.key })))
    .sort((a, b) => compare(a.lensId, b.lensId) || compare(a.unitId, b.unitId));
  const governanceBefore = { memberships, contentHash: hashFramedDomain("repository-pre-change-governance", memberships) };
  const valueDependencies = [
    { kind: "artifact" as const, id: "repository-impact-proof", versionHash: derivationImpact.contentHash, role: "exact observed derivation snapshot and known-delta impact prediction" },
    ...input.proposal.edits.map((edit) => ({ kind: "projection-unit" as const, id: `path:${edit.path}`, versionHash: hashFramedDomain("transform-content", edit.before), role: `exact before content for ${edit.path}` })),
    ...independentValidators.map((validator) => ({ kind: "artifact" as const, id: `independent-validator:${validator.path}`, versionHash: validator.contentHash, role: `Git-base-bound independent validator introduced by ${validator.introductionCommit}` })),
    { kind: "canonical-governance" as const, id: "canonical-root", versionHash: observation.canonical.rootDigest, role: "canonical identity and decision search root" },
    { kind: "adapter" as const, id: "projector.local-repository", versionHash: observation.state.toolchainDigest, role: "no-exec local analyzer versions" },
    { kind: "artifact" as const, id: `proposal:${proposalHash}`, versionHash: proposalHash, role: "authenticated structured interpretation of the user request" },
    ...(input.knowledgeContext === undefined ? [] : [{ kind: "artifact" as const, id: `knowledge-context:${input.knowledgeContext.id}`, versionHash: input.knowledgeContext.contentHash, role: "retained pre-edit conceptual context" }]),
  ];
  const preliminaryBinding = createStateBinding({ compiledAgainst: observation.state, valueDependencies, queryDependencies: [...identityQueries, relevance.queryDependency] });
  const closureBasis = {
    requestHash: hashFramedDomain("repository-change-request", request),
    seeds: [{ kind: "request-term" as const, value: request, reason: "authenticated user request", confidence: 1 }],
    entries: [
      ...relevance.knownAffectedUnitIds.map((entityId) => ({ entityId, band: "direct" as const, score: 1, requiredForPlanning: true, reasons: [{ kind: "package-dependency" as const, weight: 1, provenance: "derived" as const, confidence: 1, explanation: "exact edit or static reverse importer", evidenceIds: [] }] })),
      ...relevance.possibleFrontierUnitIds.map((entityId) => ({ entityId, band: "possible" as const, score: 0.25, requiredForPlanning: false, reasons: [{ kind: "open-world-widening" as const, weight: 0.25, provenance: "derived" as const, confidence: 0.5, explanation: "bounded analyzer dynamic frontier", evidenceIds: [] }] })),
    ],
    activatedFacetKeys: [...input.proposal.analysisFacets],
    unknowns: relevance.possibleFrontierUnitIds.map((id) => `unresolved dynamic frontier ${id}`),
    unavailableLanes: [...relevance.unavailableSurfaceIds],
    boundState: preliminaryBinding,
  };
  const closureHash = hashFramedDomain("relevance-closure", closureBasis);
  const closure: RelevanceClosure = { id: `relevance_closure_${closureHash.slice(-32)}`, ...closureBasis, contentHash: closureHash };
  const activationFacets: ArchitectureActivationFacet[] = [];
  if (input.proposal.analysisFacets.includes("public-contract")) activationFacets.push("public-contract");
  if (input.proposal.analysisFacets.includes("workspace-expansion")) {
    const provesWorkspaceExpansion = input.proposal.edits.some(({ path, before, after }) => before === null && after !== null && /^packages\/[^/]+\/package\.json$/u.test(path));
    if (!provesWorkspaceExpansion) throw new Error("workspace-expansion facet lacks an exact new workspace manifest edit");
    activationFacets.push("workspace-expansion");
  }
  if (input.proposal.analysisFacets.includes("distribution")) activationFacets.push("distribution");
  const discovery = discoverArchitectureConcerns({
    closure,
    changes: [{ kind: "user-request", subjectIds: identityResolutions.map(({ targetId }) => targetId), activationFacets, explanation: "deterministic architecture activation from authenticated change facts", scope: scopeFor(editedPaths) }],
    inferred: [],
  });
  const proposedArchitecture = input.proposal.architecture;
  let architectureDeferral: ArchitectureDeferralEvidence | undefined;
  let architectureQuery: StateQueryDependency | undefined;
  let governedConcerns = [...discovery.concerns];
  const deferralAssessmentPort = {
    assess: async () => ({ compatibilityPreserving: independentValidators.length > 0, optionalityPreserved: false, secretlySelectsOption: false, irreversibleCommitments: [] as string[] }),
  };
  if (proposedArchitecture !== null) {
    const matching = discovery.concerns.filter(({ key }) => key === proposedArchitecture.concernKey);
    if (matching.length !== 1) throw new Error(`architecture concern response is not uniquely derived: ${proposedArchitecture.concernKey}`);
    const discoveredConcern = matching[0]!;
    if (discoveredConcern.materiality === "blocking-now") throw new Error(`blocking architecture concern requires a current canonical decision: ${discoveredConcern.key}`);
    if (discoveredConcern.title !== proposedArchitecture.title || discoveredConcern.question !== proposedArchitecture.question || discoveredConcern.materiality !== proposedArchitecture.materiality) {
      throw new Error(`architecture concern response mismatches engine-derived concern: ${proposedArchitecture.concernKey}`);
    }
    const decisionDeferral: DecisionDeferral = {
      rationale: proposedArchitecture.deferral.rationale,
      preserveOptionality: [...proposedArchitecture.deferral.preservedOptions],
      forbiddenCommitments: [...proposedArchitecture.deferral.forbiddenCommitments, ...proposedArchitecture.deferral.forbiddenWritePaths.map((path) => `forbid-write:${path}`)],
      reconsiderWhen: [{ type: "manual-review" }, { type: "date", at: proposedArchitecture.deferral.validUntil }],
      reviewBy: proposedArchitecture.deferral.validUntil,
    };
    const dispositionText = [decisionDeferral.rationale, proposedArchitecture.deferral.reconsiderWhen, ...decisionDeferral.preserveOptionality, ...proposedArchitecture.deferral.forbiddenCommitments];
    const dispositionAssessmentPort = {
      assess: async () => ({
        compatibilityPreserving: independentValidators.length > 0,
        optionalityPreserved: decisionDeferral.preserveOptionality.length > 0 && proposedArchitecture.deferral.forbiddenWritePaths.length > 0,
        secretlySelectsOption: dispositionText.some((value) => /\b(?:adopt|choose|standardize on|must use|use (?:redis|postgres|mysql|mongodb|react|vue|angular))\b/iu.test(value)),
        irreversibleCommitments: input.proposal.edits.filter(({ path }) => proposedArchitecture.deferral.forbiddenWritePaths.includes(path)).map(({ path }) => path),
      }),
    };
    const deferralValidation = await withCancellation(assessDecisionDeferral(decisionDeferral, dispositionAssessmentPort), options.signal);
    if (!deferralValidation.valid) throw new Error(`architecture deferral is invalid: ${deferralValidation.reasons.join("; ")}`);
    const { semanticHash: _concernHash, ...concernWithoutHash } = discoveredConcern;
    const deferredWithoutHash = { ...concernWithoutHash, status: "deferred" as const, deferral: decisionDeferral };
    const deferredConcern = ArchitectureConcernSchema.parse({ ...deferredWithoutHash, semanticHash: hashFramedDomain("architecture-concern", deferredWithoutHash) }) as ArchitectureConcern;
    governedConcerns = discovery.concerns.map((concern) => concern.id === deferredConcern.id ? deferredConcern : concern);
    deferralAssessmentPort.assess = dispositionAssessmentPort.assess;
    const deferralValue = { concern: deferredConcern, authoritativeDecision: false as const, proposalHash, discoveryHash: discovery.contentHash };
    const deferralHash = hashFramedDomain("repository-change-architecture-deferral", deferralValue);
    architectureDeferral = {
      id: `architecture_deferral_${deferralHash.slice(-32)}`,
      authoritativeDecision: false,
      concernId: deferredConcern.id,
      concernKey: deferredConcern.key,
      materiality: deferredConcern.materiality as "material-soon" | "deferable",
      rationale: decisionDeferral.rationale,
      reconsiderWhen: proposedArchitecture.deferral.reconsiderWhen,
      validUntil: proposedArchitecture.deferral.validUntil,
      preservedOptions: decisionDeferral.preserveOptionality,
      forbiddenCommitments: proposedArchitecture.deferral.forbiddenCommitments,
      forbiddenWritePaths: proposedArchitecture.deferral.forbiddenWritePaths,
      discoveryHash: discovery.contentHash,
      preflightHash: placeholder,
      contentHash: deferralHash,
    };
  }
  const preflight = await withCancellation(runArchitecturePreflight({ closure, concerns: governedConcerns, validity: [], overrideAuthorityRecordIds: [], mode: "govern", risk: "R2" }, {
    authority: { read: async () => undefined },
    deferral: deferralAssessmentPort,
    validity: { verify: async () => false },
  }), options.signal);
  if (!preflight.planningAllowed || !preflight.governedCompletion) throw new Error(`architecture preflight blocked: ${preflight.reasons.join("; ")}`);
  if (architectureDeferral !== undefined) {
    const { id: _priorId, contentHash: _priorHash, preflightHash: _priorPreflight, ...evidenceBasis } = architectureDeferral;
    const finalizedBasis = { ...evidenceBasis, preflightHash: preflight.contentHash };
    const finalizedHash = hashFramedDomain("repository-change-architecture-deferral", finalizedBasis);
    architectureDeferral = { id: `architecture_deferral_${finalizedHash.slice(-32)}`, ...finalizedBasis, contentHash: finalizedHash };
    const architectureSpec = queryRegistry.createSpec({ id: `architecture-deferral:${architectureDeferral.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.boundedDeferral, input: { concernId: architectureDeferral.concernId, concernKey: architectureDeferral.concernKey, discoveryHash: discovery.contentHash, deferralId: architectureDeferral.id, validUntil: architectureDeferral.validUntil, forbiddenWritePaths: architectureDeferral.forbiddenWritePaths, editedPaths } });
    const architecturePrior = await withCancellation(queryRegistry.evaluate(architectureSpec, context), options.signal);
    if (architecturePrior.resultCount !== 1) throw new Error("architecture deferral query did not authenticate a current narrowing disposition");
    architectureQuery = { query: architectureSpec, priorResult: architecturePrior, role: "bounded non-authoritative architecture deferral and reconsideration condition" };
  }
  const boundState = createStateBinding({ compiledAgainst: observation.state, valueDependencies: [...valueDependencies, { kind: "adapter", id: "architecture-discovery", versionHash: discovery.contentHash, role: "deterministic concern discovery from bounded relevance and authenticated facts" }], queryDependencies: [...identityQueries, relevance.queryDependency, ...(architectureQuery === undefined ? [] : [architectureQuery])] });
  const intentBase = {
    id: `intent_${proposalHash.slice(-32)}`,
    request,
    normalizedIntent: request,
    statements: [
      ...input.proposal.requirements.map(({ statement }) => ({ kind: "behavior" as const, statement, origin: [{ kind: "document" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash, description: "Proposed interpretation; semantic fidelity to the user request is unverified." }], confidence: 1 })),
      ...input.proposal.scenarios.flatMap(({ steps }) => steps.map(({ statement }) => ({ kind: "behavior" as const, statement, origin: [{ kind: "document" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash, description: "Proposed interpretation; semantic fidelity to the user request is unverified." }], confidence: 1 }))),
      ...mutationReviews.map(({ kind, id, after }) => ({
        kind: (kind === "architecture-decision" || kind === "projection-lens" || kind === "relation" ? "constraint" : "behavior") as "constraint" | "behavior",
        statement: after === null ? `Retire ${kind} ${id}` : [after.statement, after.decision, after.purpose, after.rationale, after.reason, after.name].find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? `${kind} ${id}`,
        origin: [{ kind: "document" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash, description: "Explicit canonical mutation proposed for approval." }],
        confidence: 1,
      })),
      ...(architectureDeferral?.forbiddenCommitments ?? []).map((statement) => ({ kind: "constraint" as const, statement, origin: [{ kind: "user-request" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash }], confidence: 1 })),
    ],
    ambiguity: [] as string[],
    assumptions: architectureDeferral === undefined ? [] : [`bounded architecture deferral ${architectureDeferral.id} remains current through ${architectureDeferral.validUntil}`],
  };
  const intentAnalysis = { ...intentBase, contentHash: hashFramedDomain("change-intent-analysis", intentBase) };
  const factsValue = {
    intentAnalysis,
    identityResolutionIds: [
      ...identityResolutions.map(({ id }) => id),
      ...mutationReviews.map(({ kind, id, operation }) => `explicit-canonical-${operation}:${kind}:${id}`),
    ],
    relevanceClosureId: relevance.id,
    analysisFacetKeys: semanticAnalysisFacets,
    operations: operations.map((operation) => ({ provenance: "authenticated" as const, operation })),
    relations: intentReview.relations.map(({ id, fromId, toId }) => ({ id, subjectIds: [fromId, toId] })),
    assumptions: [
      `Preserve reviewed conceptual commitments except the explicit revisions in intent review ${intentReview.contentHash}.`,
      `Preserve or explicitly reconcile pre-change architectural applicability ${governanceBefore.contentHash}.`,
      ...intentReview.subjects.filter(({ operation }) => operation === "preserve").flatMap(({ id, after }) => "statement" in after
        ? [`Preserve ${id}: ${after.statement}`]
        : after.steps.map(({ role, statement }) => `Preserve ${id} ${role}: ${statement}`)),
      ...intentReview.relatedObligations.filter(({ id, kind }) => (kind === "requirement" || kind === "behavioral-scenario") && !intentReview.subjects.some((subject) => subject.id === id)).flatMap(({ id, kind, payload }) => kind === "requirement"
        ? [`Related commitment ${id}: ${(RequirementSchema.parse(payload) as Requirement).statement}`]
        : (BehavioralScenarioSchema.parse(payload) as BehavioralScenario).steps.map(({ role, statement }) => `Related commitment ${id} ${role}: ${statement}`)),
      ...(architectureDeferral === undefined ? [] : [
      `architecture deferral ${architectureDeferral.id}: ${architectureDeferral.rationale}`,
      ...architectureDeferral.preservedOptions.map((value) => `preserve option: ${value}`),
      ...architectureDeferral.forbiddenCommitments.map((value) => `forbidden commitment: ${value}`),
      ]),
    ],
    boundary,
    boundState,
  };
  const factsHash = hashFramedDomain("authenticated-change-compiler-facts", factsValue);
  const knownAffectedUnitIds = unique([...relevance.knownAffectedUnitIds, ...impactPrediction.knownAffectedUnitIds, ...canonicalWrites.map(({ id }) => id)]);
  const impactValue = {
    knownAffectedUnitIds,
    possibleFrontierUnitIds: unique([...relevance.possibleFrontierUnitIds, ...impactPrediction.possibleFrontierUnitIds]),
    unavailableSurfaceIds: relevance.unavailableSurfaceIds,
    reasons: [
      ...relevance.reasons,
      ...canonicalWrites.map(({ id }) => ({ unitId: id, kind: "exact" as const, reason: "canonical semantic entity in the same transaction" })),
    ],
    queryDependencyIds: [relevance.queryDependency.query.id],
  };
  const mutatesGovernanceAuthority = (input.proposal.canonicalMutations ?? []).some(({ kind }) => kind === "architecture-decision" || kind === "projection-lens" || kind === "authority-record");
  const risk = {
    class: "R2" as const,
    inherentOperationRisk: executionKind === "repository-code" || mutatesGovernanceAuthority ? 2 : 1,
    affectedUnitCount: knownAffectedUnitIds.length,
    affectedSurfaceCount: 1,
    publicContractImpact: input.proposal.analysisFacets.includes("public-contract"),
    externalImpact: false,
    dataImpact: input.proposal.analysisFacets.includes("persistence"),
    reversibility: "full" as const,
    validationStrength: executionKind === "canonical-only" ? "exact" as const : "strong" as const,
    closureConfidence: "bounded" as const,
    unresolvedIdentityCount: 0,
    relevanceFrontierCount: relevance.possibleFrontierUnitIds.length,
    openWorldDependencies: relevance.possibleFrontierUnitIds.length > 0 || relevance.unavailableSurfaceIds.length > 0,
    unresolvedBlockingConcernCount: 0,
    suspectDecisionCount: 0,
    compensationAvailable: true,
    reasons: executionKind === "canonical-only"
      ? [mutatesGovernanceAuthority ? "canonical authority or executable governance mutation is R2" : "canonical meaning mutation is reversible R1", "validation covers canonical integrity and eligible lens compilation; implementation fidelity is not claimed"]
      : ["canonical requirement/scenario mutation requires explicit approval", "bounded local static relevance with an independent Git-base validator"],
  };
  const compiledChange = await withCancellation(compileSemanticChange({ request, currentState: observation.state, context }, {
    facts: { load: async () => ({ value: factsValue, contentHash: factsHash }) },
    bindingValidator: { validate: async () => ({ status: "current", currentState: observation.state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) },
    authority: { verify: async ({ subjectHash }) => subjectHash === factsHash },
    architecture: { preflight: async () => { const value = { allowed: preflight.planningAllowed && preflight.governedCompletion, decisionIds: [] as string[] }; return { ...value, contentHash: hashFramedDomain("change-architecture-preflight", value) }; } },
    impact: { compile: async () => ({ value: impactValue, contentHash: hashFramedDomain("authenticated-impact-closure", impactValue) }) },
    risk: { assess: async () => ({ value: risk, contentHash: hashFramedDomain("authenticated-change-risk", risk) }) },
  }), options.signal);
  const representation = await withCancellation(compileRepresentation(compiledChange, options.representationArtifacts ?? defaultRepresentationArtifacts()), options.signal);
  const validatorIds = [
    "exact-text-patch.verify",
    "projector.repository-post-observation",
    ...(executionKind === "canonical-only" ? ["projector.canonical-model-integrity"] : ["projector.post-change-knowledge"]),
    ...independentValidators.map(({ path }) => `node-independent:${path}`),
    ...input.proposal.validation.supplementalNodeTests.map((path) => `node-supplemental:${path}`),
  ];
  const completionContract = {
    requiredUnitStates: knownAffectedUnitIds.map((unitId) => ({ unitId, state: "valid" as const })),
    requiredValidators: validatorIds,
    requiredEvidenceLanes: executionKind === "canonical-only" ? ["runtime" as const] : ["runtime" as const, "test" as const],
    minimumValidationAssurance: executionKind === "canonical-only" ? "exact" as const : "strong" as const,
    requireIndependentValidation: executionKind !== "canonical-only",
    maximumNewDivergences: 0,
    maximumUnknowns: 0,
    allowUnavailableExternalActions: false,
    requiredArtifacts: ["certificate", "receipt"],
    cleanWorkingTree: false,
  };
  const planningValue = { change: compiledChange.change, boundState: compiledChange.boundState, compilerFactsHash: compiledChange.compilerFactsHash };
  const packetValue = {
    proposals: [{
      key: executionKind === "canonical-only" ? "canonical-model-change" : "exact-text-change",
      title: input.proposal.requirements.map(({ title }) => title).join("; ") || mutationReviews.map(({ kind, id }) => `${kind} ${id}`).join("; "),
      stage: "source" as const,
      executionMode: "deterministic" as const,
      transformId: executionKind === "canonical-only" ? "canonical-model-write" : "exact-text-patch",
      unitIds: knownAffectedUnitIds,
      semanticOwnerIds: identityResolutions.map(({ targetId }) => targetId),
      writeSelectors: boundary,
      forbiddenWriteSelectors: unique([".git/**", ".projector/runtime/**", ...(architectureDeferral?.forbiddenWritePaths ?? [])]),
      dependencies: [] as string[],
      validatorIds,
    }],
    completionContract,
  };
  const compiledPlan = await withCancellation(compileSemanticChangePlan({ changeId: compiledChange.change.id, revision: 1, sourceRunId: `run:${compiledChange.change.id}` }, {
    changes: { read: async () => ({ value: planningValue, contentHash: hashFramedDomain("authenticated-change-planning-input", planningValue) }) },
    packets: { compile: async () => ({ value: packetValue, contentHash: hashFramedDomain("authenticated-change-packet-proposals", packetValue) }) },
    representations: { compile: async () => representation },
  }), options.signal);
  const planHash = executionPlanHash(compiledPlan.plan);
  const exactPatchInput: ExactTextPatchInput = {
    edits: [
      ...input.proposal.edits.map((edit) => ({ unitId: observation.analysis.projectionUnits.find(({ key }) => key === edit.path)?.id ?? deriveEntityId("projector.proposed-unit", edit.path), ...edit })),
      ...canonicalWrites.map(({ id, path, before, after }) => ({ unitId: id, path, before, after })),
    ].sort((left, right) => compare(left.path, right.path)),
  };
  return {
    derivationImpact,
    executionKind,
    proposalHash,
    identityResolutions: identityResolutions.sort((left, right) => compare(left.id, right.id)),
    ...(architectureDeferral === undefined ? {} : { architectureDeferral }),
    relevance,
    canonicalWrites,
    intentReview,
    governanceBefore,
    ...(input.knowledgeContext === undefined ? {} : { knowledgeContext: input.knowledgeContext }),
    independentValidators,
    baselineObservation: baselineObservation(observation),
    compiledChange,
    representation,
    compiledPlan,
    planHash,
    exactPatchInput,
  };
}
