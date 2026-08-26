import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import {
  BehavioralScenarioSchema,
  ArchitectureConcernSchema,
  RequirementSchema,
  canonicalJson,
  deriveEntityId,
  hashFramedDomain,
  withCanonicalHashes,
  type BehavioralScenario,
  type ArchitectureConcern,
  type CanonicalDocumentEnvelope,
  type ChangeOperation,
  type ContentHash,
  type DecisionDeferral,
  type RelevanceClosure,
  type Requirement,
  type SelectorExpr,
  type StateQueryDependency,
} from "@projector/core";
import {
  RepresentationCompiler,
  assessDecisionDeferral,
  canonicalRepresentationSourceFromSemanticChange,
  compileSemanticChange,
  compileSemanticChangePlan,
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
import type { ChangeProposal, ProposedRequirement, ProposedScenario } from "./proposal.js";
import { CHANGE_QUERY_PROGRAM_IDS, calculateRepositoryRelevance, createChangeQueryRegistry, exactIdentityCandidates } from "./query-programs.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const placeholder = hashFramedDomain("repository-change-canonical-placeholder", null);

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
  readonly kind: "requirement" | "behavioral-scenario";
  readonly path: string;
  readonly before: string | null;
  readonly after: string;
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
  readonly proposalHash: ContentHash;
  readonly identityResolutions: readonly SemanticIdentityResolutionEvidence[];
  readonly architectureDeferral?: ArchitectureDeferralEvidence;
  readonly relevance: RepositoryRelevanceEvidence;
  readonly canonicalWrites: readonly CanonicalChangeWrite[];
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
}

export interface CompileRepositoryChangeOptions {
  readonly representationArtifacts?: RepresentationArtifactStore;
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
  const key = existing?.key ?? proposal.key;
  const origin = [...(existing?.origin ?? []), { kind: "user-request" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash }];
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
  payload: Requirement | BehavioralScenario,
): Promise<CanonicalChangeWrite> {
  const envelope = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id, key, lifecycle: "active", payload: { ...payload } });
  const absolutePath = repository.pathFor(kind, id);
  return {
    id,
    kind,
    path: relative(repositoryRoot, absolutePath).replaceAll("\\", "/"),
    before: await optionalText(absolutePath),
    after: `${canonicalJson(envelope)}\n`,
    envelope,
  };
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
  const request = input.request.normalize("NFKC").trim();
  if (request.length === 0 || request.length > 16_384 || request.includes("\0")) throw new Error("natural-language change request must be nonblank bounded UTF-8 text");
  const now = input.now ?? new Date().toISOString();
  const semanticAnalysisFacets = input.proposal.analysisFacets.filter((facet) => facet !== "workspace-expansion");
  if (input.proposal.architecture !== null) {
    const deferralDurationMs = Date.parse(input.proposal.architecture.deferral.validUntil) - Date.parse(now);
    if (deferralDurationMs <= 0) throw new Error("architecture deferral is expired");
    if (deferralDurationMs > 366 * 24 * 60 * 60 * 1_000) throw new Error("architecture deferral horizon exceeds one year");
  }

  const observation = await observeChangeRepository(input.repositoryRoot);
  const queryRegistry = createChangeQueryRegistry({ observation, now });
  const proposalHash = hashFramedDomain("repository-change-proposal", input.proposal);
  const context = { repositoryRoot: input.repositoryRoot, stateDigest: observation.state, config: {}, signal: new AbortController().signal };
  const paths = await RepositoryPathService.create(input.repositoryRoot);
  for (const edit of input.proposal.edits) {
    let actual: string | null;
    try { actual = await readFile((await paths.resolveRead(edit.path)).realTarget, "utf8"); }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") actual = null; else throw error; }
    if (actual !== edit.before) throw new Error(`proposal exact before content is stale: ${edit.path}`);
  }
  const independentValidators = await Promise.all(input.proposal.validation.independentNodeTests.map((path) => observation.independentValidator(path)));
  const canonical = new CanonicalFileRepository(input.repositoryRoot);
  const existingRequirements = observation.canonical.documents.filter(({ kind }) => kind === "requirement").map(({ payload }) => RequirementSchema.parse(payload) as Requirement);
  const existingScenarios = observation.canonical.documents.filter(({ kind }) => kind === "behavioral-scenario").map(({ payload }) => BehavioralScenarioSchema.parse(payload) as BehavioralScenario);
  const editedPaths = input.proposal.edits.map(({ path }) => path);
  const identityResolutions: SemanticIdentityResolutionEvidence[] = [];
  const identityQueries: StateQueryDependency[] = [];
  const canonicalWrites: CanonicalChangeWrite[] = [];
  const operations: ChangeOperation[] = [];

  for (const proposed of input.proposal.requirements) {
    const claims = [proposed.key, ...proposed.aliases];
    const candidates = exactIdentityCandidates(observation, "requirement", claims) as Requirement[];
    if (candidates.length > 1) throw new Error(`ambiguous duplicate requirement identity: ${proposed.key}`);
    const derivedId = deriveEntityId("projector.requirement", proposed.key);
    if (candidates.length === 0 && existingRequirements.some(({ id }) => id === derivedId)) throw new Error(`requirement stable ID is occupied by an unrelated identity: ${derivedId}`);
    const existing = candidates[0];
    const targetId = existing?.id ?? derivedId;
    const resolution = identityEvidence("requirement", proposed.key, claims, candidates, targetId, observation.canonical.rootDigest);
    const query = queryRegistry.createSpec({ id: `identity:requirement:${resolution.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.identityExact, input: { kind: "requirement", claims } });
    const priorResult = await queryRegistry.evaluate(query, context);
    if (priorResult.resultCount !== candidates.length) throw new Error(`authenticated requirement identity query disagrees with resolved candidates: ${proposed.key}`);
    identityResolutions.push(resolution); identityQueries.push({ query, priorResult, role: "exact requirement key and alias negative-space search" });
    const payload = proposedRequirementPayload(proposed, existing, targetId, proposalHash, editedPaths);
    canonicalWrites.push(await canonicalWrite(input.repositoryRoot, canonical, "requirement", targetId, payload.key, payload));
    operations.push({ subjectType: "requirement", kind: existing === undefined ? "add" : "modify", requirementId: targetId, proposedRequirement: payload, rationale: `authenticated proposal ${proposalHash}` });
  }
  for (const proposed of input.proposal.scenarios) {
    const claims = [proposed.key, ...proposed.aliases];
    const candidates = exactIdentityCandidates(observation, "scenario", claims) as BehavioralScenario[];
    if (candidates.length > 1) throw new Error(`ambiguous duplicate scenario identity: ${proposed.key}`);
    const derivedId = deriveEntityId("projector.scenario", proposed.key);
    if (candidates.length === 0 && existingScenarios.some(({ id }) => id === derivedId)) throw new Error(`scenario stable ID is occupied by an unrelated identity: ${derivedId}`);
    const existing = candidates[0];
    const targetId = existing?.id ?? derivedId;
    const resolution = identityEvidence("scenario", proposed.key, claims, candidates, targetId, observation.canonical.rootDigest);
    const query = queryRegistry.createSpec({ id: `identity:scenario:${resolution.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.identityExact, input: { kind: "scenario", claims } });
    const priorResult = await queryRegistry.evaluate(query, context);
    if (priorResult.resultCount !== candidates.length) throw new Error(`authenticated scenario identity query disagrees with resolved candidates: ${proposed.key}`);
    identityResolutions.push(resolution); identityQueries.push({ query, priorResult, role: "exact scenario key and alias negative-space search" });
    const payload = proposedScenarioPayload(proposed, existing, targetId, editedPaths);
    canonicalWrites.push(await canonicalWrite(input.repositoryRoot, canonical, "behavioral-scenario", targetId, payload.key, payload));
    operations.push({ subjectType: "scenario", kind: existing === undefined ? "add" : "modify", scenarioId: targetId, proposedScenario: payload, rationale: `authenticated proposal ${proposalHash}` });
  }
  canonicalWrites.sort((left, right) => compare(left.path, right.path));
  const boundary = unique([...editedPaths, ...canonicalWrites.map(({ path }) => path)]);
  const calculatedRelevance = calculateRepositoryRelevance(observation, editedPaths);
  const relevanceSpec = queryRegistry.createSpec({ id: `relevance:${hashFramedDomain("repository-change-relevance-query-id", editedPaths).slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.reverseImporters, input: { editedPaths } });
  const relevancePrior = await queryRegistry.evaluate(relevanceSpec, context);
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
  const valueDependencies = [
    ...input.proposal.edits.map((edit) => ({ kind: "projection-unit" as const, id: `path:${edit.path}`, versionHash: hashFramedDomain("transform-content", edit.before), role: `exact before content for ${edit.path}` })),
    ...independentValidators.map((validator) => ({ kind: "artifact" as const, id: `independent-validator:${validator.path}`, versionHash: validator.contentHash, role: `Git-base-bound independent validator introduced by ${validator.introductionCommit}` })),
    { kind: "canonical-governance" as const, id: "canonical-root", versionHash: observation.canonical.rootDigest, role: "canonical identity and decision search root" },
    { kind: "adapter" as const, id: "projector.local-repository", versionHash: observation.state.toolchainDigest, role: "no-exec local analyzer versions" },
    { kind: "artifact" as const, id: `proposal:${proposalHash}`, versionHash: proposalHash, role: "authenticated structured interpretation of the user request" },
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
    const deferralValidation = await assessDecisionDeferral(decisionDeferral, dispositionAssessmentPort);
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
  const preflight = await runArchitecturePreflight({ closure, concerns: governedConcerns, validity: [], overrideAuthorityRecordIds: [], mode: "govern", risk: "R2" }, {
    authority: { read: async () => undefined },
    deferral: deferralAssessmentPort,
    validity: { verify: async () => false },
  });
  if (!preflight.planningAllowed || !preflight.governedCompletion) throw new Error(`architecture preflight blocked: ${preflight.reasons.join("; ")}`);
  if (architectureDeferral !== undefined) {
    const { id: _priorId, contentHash: _priorHash, preflightHash: _priorPreflight, ...evidenceBasis } = architectureDeferral;
    const finalizedBasis = { ...evidenceBasis, preflightHash: preflight.contentHash };
    const finalizedHash = hashFramedDomain("repository-change-architecture-deferral", finalizedBasis);
    architectureDeferral = { id: `architecture_deferral_${finalizedHash.slice(-32)}`, ...finalizedBasis, contentHash: finalizedHash };
    const architectureSpec = queryRegistry.createSpec({ id: `architecture-deferral:${architectureDeferral.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.boundedDeferral, input: { concernId: architectureDeferral.concernId, concernKey: architectureDeferral.concernKey, discoveryHash: discovery.contentHash, deferralId: architectureDeferral.id, validUntil: architectureDeferral.validUntil, forbiddenWritePaths: architectureDeferral.forbiddenWritePaths, editedPaths } });
    const architecturePrior = await queryRegistry.evaluate(architectureSpec, context);
    if (architecturePrior.resultCount !== 1) throw new Error("architecture deferral query did not authenticate a current narrowing disposition");
    architectureQuery = { query: architectureSpec, priorResult: architecturePrior, role: "bounded non-authoritative architecture deferral and reconsideration condition" };
  }
  const boundState = createStateBinding({ compiledAgainst: observation.state, valueDependencies: [...valueDependencies, { kind: "adapter", id: "architecture-discovery", versionHash: discovery.contentHash, role: "deterministic concern discovery from bounded relevance and authenticated facts" }], queryDependencies: [...identityQueries, relevance.queryDependency, ...(architectureQuery === undefined ? [] : [architectureQuery])] });
  const intentBase = {
    id: `intent_${proposalHash.slice(-32)}`,
    request,
    normalizedIntent: request,
    statements: [
      ...input.proposal.requirements.map(({ statement }) => ({ kind: "behavior" as const, statement, origin: [{ kind: "user-request" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash }], confidence: 1 })),
      ...input.proposal.scenarios.flatMap(({ steps }) => steps.map(({ statement }) => ({ kind: "behavior" as const, statement, origin: [{ kind: "user-request" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash }], confidence: 1 }))),
      ...(architectureDeferral?.forbiddenCommitments ?? []).map((statement) => ({ kind: "constraint" as const, statement, origin: [{ kind: "user-request" as const, locator: `proposal:${proposalHash}`, contentHash: proposalHash }], confidence: 1 })),
    ],
    ambiguity: [] as string[],
    assumptions: architectureDeferral === undefined ? [] : [`bounded architecture deferral ${architectureDeferral.id} remains current through ${architectureDeferral.validUntil}`],
  };
  const intentAnalysis = { ...intentBase, contentHash: hashFramedDomain("change-intent-analysis", intentBase) };
  const factsValue = {
    intentAnalysis,
    identityResolutionIds: identityResolutions.map(({ id }) => id),
    relevanceClosureId: relevance.id,
    analysisFacetKeys: semanticAnalysisFacets,
    operations: operations.map((operation) => ({ provenance: "authenticated" as const, operation })),
    relations: [] as { id: string; subjectIds: string[] }[],
    assumptions: architectureDeferral === undefined ? [] : [
      `architecture deferral ${architectureDeferral.id}: ${architectureDeferral.rationale}`,
      ...architectureDeferral.preservedOptions.map((value) => `preserve option: ${value}`),
      ...architectureDeferral.forbiddenCommitments.map((value) => `forbidden commitment: ${value}`),
    ],
    boundary,
    boundState,
  };
  const factsHash = hashFramedDomain("authenticated-change-compiler-facts", factsValue);
  const knownAffectedUnitIds = unique([...relevance.knownAffectedUnitIds, ...canonicalWrites.map(({ id }) => id)]);
  const impactValue = {
    knownAffectedUnitIds,
    possibleFrontierUnitIds: relevance.possibleFrontierUnitIds,
    unavailableSurfaceIds: relevance.unavailableSurfaceIds,
    reasons: [
      ...relevance.reasons,
      ...canonicalWrites.map(({ id }) => ({ unitId: id, kind: "exact" as const, reason: "canonical semantic entity in the same transaction" })),
    ],
    queryDependencyIds: [relevance.queryDependency.query.id],
  };
  const risk = {
    class: "R2" as const,
    inherentOperationRisk: 2,
    affectedUnitCount: knownAffectedUnitIds.length,
    affectedSurfaceCount: 1,
    publicContractImpact: input.proposal.analysisFacets.includes("public-contract"),
    externalImpact: false,
    dataImpact: input.proposal.analysisFacets.includes("persistence"),
    reversibility: "full" as const,
    validationStrength: "strong" as const,
    closureConfidence: "bounded" as const,
    unresolvedIdentityCount: 0,
    relevanceFrontierCount: relevance.possibleFrontierUnitIds.length,
    openWorldDependencies: relevance.possibleFrontierUnitIds.length > 0 || relevance.unavailableSurfaceIds.length > 0,
    unresolvedBlockingConcernCount: 0,
    suspectDecisionCount: 0,
    compensationAvailable: true,
    reasons: ["canonical requirement/scenario mutation requires explicit approval", "bounded local static relevance with an independent Git-base validator"],
  };
  const compiledChange = await compileSemanticChange({ request, currentState: observation.state, context }, {
    facts: { load: async () => ({ value: factsValue, contentHash: factsHash }) },
    bindingValidator: { validate: async () => ({ status: "current", currentState: observation.state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) },
    authority: { verify: async ({ subjectHash }) => subjectHash === factsHash },
    architecture: { preflight: async () => { const value = { allowed: preflight.planningAllowed && preflight.governedCompletion, decisionIds: [] as string[] }; return { ...value, contentHash: hashFramedDomain("change-architecture-preflight", value) }; } },
    impact: { compile: async () => ({ value: impactValue, contentHash: hashFramedDomain("authenticated-impact-closure", impactValue) }) },
    risk: { assess: async () => ({ value: risk, contentHash: hashFramedDomain("authenticated-change-risk", risk) }) },
  });
  const representation = await compileRepresentation(compiledChange, options.representationArtifacts ?? defaultRepresentationArtifacts());
  const validatorIds = [
    "exact-text-patch.verify",
    "projector.repository-post-observation",
    ...independentValidators.map(({ path }) => `node-independent:${path}`),
    ...input.proposal.validation.supplementalNodeTests.map((path) => `node-supplemental:${path}`),
  ];
  const completionContract = {
    requiredUnitStates: knownAffectedUnitIds.map((unitId) => ({ unitId, state: "valid" as const })),
    requiredValidators: validatorIds,
    requiredEvidenceLanes: ["runtime" as const, "test" as const],
    minimumValidationAssurance: "strong" as const,
    requireIndependentValidation: true,
    maximumNewDivergences: 0,
    maximumUnknowns: 0,
    allowUnavailableExternalActions: false,
    requiredArtifacts: ["certificate", "receipt"],
    cleanWorkingTree: false,
  };
  const planningValue = { change: compiledChange.change, boundState: compiledChange.boundState, compilerFactsHash: compiledChange.compilerFactsHash };
  const packetValue = {
    proposals: [{
      key: "exact-text-change",
      title: input.proposal.requirements.map(({ title }) => title).join("; "),
      stage: "source" as const,
      executionMode: "deterministic" as const,
      transformId: "exact-text-patch",
      unitIds: knownAffectedUnitIds,
      semanticOwnerIds: identityResolutions.map(({ targetId }) => targetId),
      writeSelectors: boundary,
      forbiddenWriteSelectors: unique([".git/**", ".projector/runtime/**", ...(architectureDeferral?.forbiddenWritePaths ?? [])]),
      dependencies: [] as string[],
      validatorIds,
    }],
    completionContract,
  };
  const compiledPlan = await compileSemanticChangePlan({ changeId: compiledChange.change.id, revision: 1, sourceRunId: `run:${compiledChange.change.id}` }, {
    changes: { read: async () => ({ value: planningValue, contentHash: hashFramedDomain("authenticated-change-planning-input", planningValue) }) },
    packets: { compile: async () => ({ value: packetValue, contentHash: hashFramedDomain("authenticated-change-packet-proposals", packetValue) }) },
    representations: { compile: async () => representation },
  });
  const planHash = executionPlanHash(compiledPlan.plan);
  const exactPatchInput: ExactTextPatchInput = {
    edits: [
      ...input.proposal.edits.map((edit) => ({ unitId: observation.analysis.projectionUnits.find(({ key }) => key === edit.path)?.id ?? deriveEntityId("projector.proposed-unit", edit.path), ...edit })),
      ...canonicalWrites.map(({ id, path, before, after }) => ({ unitId: id, path, before, after })),
    ].sort((left, right) => compare(left.path, right.path)),
  };
  return {
    proposalHash,
    identityResolutions: identityResolutions.sort((left, right) => compare(left.id, right.id)),
    ...(architectureDeferral === undefined ? {} : { architectureDeferral }),
    relevance,
    canonicalWrites,
    independentValidators,
    baselineObservation: baselineObservation(observation),
    compiledChange,
    representation,
    compiledPlan,
    planHash,
    exactPatchInput,
  };
}
