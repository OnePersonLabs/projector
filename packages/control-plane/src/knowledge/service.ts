import {
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type RelevanceClosure,
  type SemanticIdentityCandidate,
  type SemanticIdentityResolution,
  type StateBindingValidation,
  type StateQueryDependency,
  type StateValueDependencyRef,
} from "@projector/core";
import {
  DependencyScopedStateBindingValidator,
  compileContext,
  compileRelevanceClosure,
  createStateBinding,
} from "@projector/engine";

import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { KnowledgeGraph } from "./graph.js";
import { buildRepositoryImpactSnapshot, impactReference, persistRepositoryImpactSnapshot, reconcileRetainedImpact } from "../impact/service.js";
import { assessKnowledgeDecisions, knowledgeGovernanceStatus, type KnowledgeDecisionHost } from "./governance.js";
import { KnowledgeValidatorRun, type KnowledgeValidatorHost } from "./validators.js";
import {
  applicationEvidenceDependencies,
  applicationEvidenceDisposition,
  assessKnowledgeApplicationEvidence,
  type PsychordApplicationEvidenceHost,
} from "./application-evidence.js";
import { KnowledgeContextStore, finalizeKnowledgeContext } from "./store.js";
import {
  KNOWLEDGE_API_VERSION,
  KnowledgeContextResultSchema,
  KnowledgeReconciliationResultSchema,
  type KnowledgeContextBranch,
  type KnowledgeContextPolicy,
  type KnowledgeContextRequest,
  type KnowledgeContextResult,
  type KnowledgeInterpretationCandidate,
  type KnowledgeReconciliationResult,
} from "./types.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

const defaultPolicy: Required<KnowledgeContextPolicy> = {
  maxCandidates: 5,
  maxEntries: 40,
  maxDepth: 4,
  maxTraversalCost: 80,
  minimumScore: 0.3,
  maxContextCost: 24_000,
};

function policy(input: KnowledgeContextPolicy | undefined): Required<KnowledgeContextPolicy> {
  const result = { ...defaultPolicy, ...input };
  if (!Number.isSafeInteger(result.maxCandidates) || result.maxCandidates < 1
    || !Number.isSafeInteger(result.maxEntries) || result.maxEntries < 1
    || !Number.isSafeInteger(result.maxDepth) || result.maxDepth < 0
    || !Number.isFinite(result.maxTraversalCost) || result.maxTraversalCost < 0
    || !Number.isFinite(result.minimumScore) || result.minimumScore < 0 || result.minimumScore > 1
    || !Number.isFinite(result.maxContextCost) || result.maxContextCost < 0) {
    throw new Error("invalid knowledge context policy");
  }
  return result;
}

function coreCandidate(candidate: KnowledgeInterpretationCandidate): SemanticIdentityCandidate | undefined {
  if (candidate.entityKind !== "concept" && candidate.entityKind !== "requirement" && candidate.entityKind !== "scenario") return undefined;
  return {
    entityId: candidate.entityId,
    entityKind: candidate.entityKind,
    similarity: candidate.score,
    ownershipFit: 0,
    boundaryFit: 0,
    evidence: [],
    explanation: candidate.explanation,
  };
}

function identityResolution(
  request: string,
  candidate: KnowledgeInterpretationCandidate,
  compiledAgainst: AdapterContext["stateDigest"],
  identityDependency: StateQueryDependency,
  graph: KnowledgeGraph,
): SemanticIdentityResolution {
  const eligibleKind = candidate.entityKind === "concept" || candidate.entityKind === "requirement" || candidate.entityKind === "scenario";
  const selected = candidate.direct && eligibleKind;
  const boundState = createStateBinding({
    compiledAgainst,
    valueDependencies: selected ? graph.valueDependencies([candidate.entityId]) : [],
    queryDependencies: [identityDependency],
  });
  const basis = {
    requestedMeaning: request,
    requestedKind: eligibleKind ? candidate.entityKind : "unknown" as const,
    outcome: selected ? "reuse-existing" as const : "unresolved" as const,
    candidates: [coreCandidate(candidate)].filter((item): item is SemanticIdentityCandidate => item !== undefined),
    selectedEntityIds: selected ? [candidate.entityId] : [],
    confidence: selected ? 1 : candidate.score,
    evidence: [],
    unknowns: selected ? [] : ["interpretation remains a candidate; context compilation does not prove semantic identity"],
    boundState,
  };
  const contentHash = hashFramedDomain("semantic-identity-resolution", basis);
  return { id: `semantic_identity_resolution_${contentHash.slice(-32)}`, ...basis, contentHash };
}

function rebindClosure(
  closure: RelevanceClosure,
  graph: KnowledgeGraph,
  queryDependencies: readonly StateQueryDependency[],
  extraValueIds: readonly string[] = [],
  extraValueDependencies: readonly StateValueDependencyRef[] = [],
): RelevanceClosure {
  const boundState = createStateBinding({
    compiledAgainst: closure.boundState.compiledAgainst,
    valueDependencies: [...graph.valueDependencies(unique([...closure.entries.map(({ entityId }) => entityId), ...extraValueIds])), ...extraValueDependencies],
    queryDependencies,
  });
  const basis = {
    requestHash: closure.requestHash,
    seeds: closure.seeds,
    entries: closure.entries,
    activatedFacetKeys: closure.activatedFacetKeys,
    unknowns: closure.unknowns,
    unavailableLanes: closure.unavailableLanes,
    boundState,
  };
  const contentHash = hashFramedDomain("relevance-closure", basis);
  return { id: `relevance_closure_${contentHash.slice(-32)}`, ...basis, contentHash };
}

const validationRank: Record<StateBindingValidation["status"], number> = {
  current: 0,
  rebound: 1,
  suspect: 2,
  stale: 3,
  unavailable: 4,
};

export class RepositoryKnowledgeService {
  private constructor(
    readonly repositoryRoot: string,
    private readonly store: KnowledgeContextStore,
    private readonly host: KnowledgeDecisionHost & KnowledgeValidatorHost & { readonly applicationEvidence?: PsychordApplicationEvidenceHost },
  ) {}

  static async create(input: string | ({ readonly repositoryRoot: string; readonly applicationEvidence?: PsychordApplicationEvidenceHost } & KnowledgeDecisionHost & KnowledgeValidatorHost)): Promise<RepositoryKnowledgeService> {
    const repositoryRoot = typeof input === "string" ? input : input.repositoryRoot;
    return new RepositoryKnowledgeService(repositoryRoot, await KnowledgeContextStore.create(repositoryRoot), typeof input === "string" ? {} : input);
  }

  async context(input: KnowledgeContextRequest): Promise<KnowledgeContextResult> {
    input.signal?.throwIfAborted();
    const observation = await observeChangeRepository(this.repositoryRoot);
    return this.compileContext(input, observation, new KnowledgeGraph(observation, this.host));
  }

  private async compileContext(
    input: KnowledgeContextRequest,
    observation: ChangeRepositoryObservation,
    graph: KnowledgeGraph,
  ): Promise<KnowledgeContextResult> {
    input.signal?.throwIfAborted();
    const request = input.request.normalize("NFKC").trim();
    if (request.length === 0) throw new Error("knowledge context request must be nonblank");
    const entities = unique((input.entities ?? []).map((item) => item.normalize("NFKC").trim()).filter(Boolean));
    const namedTargets = unique((input.namedTargets ?? []).map((item) => item.replaceAll("\\", "/").normalize("NFKC").trim()).filter(Boolean));
    const operation = input.operation?.normalize("NFKC").trim() || "change";
    const selectedPolicy = policy(input.policy);
    const persist = input.persist ?? true;
    const adapterContext: AdapterContext = {
      repositoryRoot: observation.repositoryRoot,
      stateDigest: observation.state,
      config: {},
      signal: input.signal ?? new AbortController().signal,
    };
    const identity = await graph.bindIdentity(request, entities, namedTargets, adapterContext);
    const candidates = identity.value.slice(0, selectedPolicy.maxCandidates);
    const missingAddresses = entities.filter((address) => graph.search(request, [address], 1).length === 0);
    const missingTargets = namedTargets.filter((target) => graph.resolveNamedTargets([target]).length === 0);
    const interpretationUnknowns = unique([
      ...missingAddresses.map((address) => `explicit canonical address ${address} did not resolve`),
      ...missingTargets.map((target) => `named repository target ${target} did not resolve`),
      ...(candidates.length === 0 ? ["no supported canonical or observed interpretation candidate was found"] : []),
    ]);
    const discoveryBinding = createStateBinding({ compiledAgainst: observation.state, valueDependencies: [], queryDependencies: [identity.dependency] });
    const branches: KnowledgeContextBranch[] = [];
    const validators = new KnowledgeValidatorRun(observation, adapterContext.signal, this.host);
    for (const candidate of candidates) {
      const resolution = identityResolution(request, candidate, observation.state, identity.dependency, graph);
      const collectedQueries: StateQueryDependency[] = [];
      const eligibleSelected = candidate.direct && (candidate.entityKind === "concept" || candidate.entityKind === "requirement" || candidate.entityKind === "scenario");
      const compilation = await compileRelevanceClosure({
        request,
        seeds: eligibleSelected ? [] : [{ kind: candidate.entityKind === "projection-unit" ? "projection-unit" : candidate.entityKind === "architecture-decision" ? "decision" : "manual", subjectId: candidate.entityId, reason: candidate.direct ? candidate.explanation : `hypothetical interpretation branch: ${candidate.explanation}`, confidence: candidate.score }],
        identityResolution: resolution,
        activatedFacetKeys: [],
        compiledAgainst: observation.state,
        context: adapterContext,
        discovery: graph.discovery(adapterContext, collectedQueries),
        valueDependencies: [],
        policy: { maxEntries: selectedPolicy.maxEntries, maxDepth: selectedPolicy.maxDepth, maxCost: selectedPolicy.maxTraversalCost, minimumScore: selectedPolicy.minimumScore },
      });
      const closureIds = compilation.closure.entries.map(({ entityId }) => entityId);
      const decisionEvidence = await assessKnowledgeDecisions(graph, graph.relevantDecisions(new Set(closureIds)), operation, adapterContext);
      const decisionIds = decisionEvidence.decisions.map(({ decisionId }) => decisionId);
      const applicationEvidence = await assessKnowledgeApplicationEvidence({ observation, ownerIds: closureIds, signal: adapterContext.signal, ...(this.host.applicationEvidence === undefined ? {} : { host: this.host.applicationEvidence }) });
      const closure = rebindClosure(compilation.closure, graph, [identity.dependency, ...collectedQueries, ...decisionEvidence.dependencies], decisionIds, applicationEvidenceDependencies(applicationEvidence));
      const baseContext = await compileContext(closure, graph, { maxCost: selectedPolicy.maxContextCost });
      const contextUnknowns = unique([...baseContext.unknowns, ...graph.authorityUnknowns(closureIds), ...graph.topologyUnknowns(closureIds), ...graph.realizationUnknowns(closureIds), ...decisionEvidence.decisions.flatMap(({ checks }) => checks.filter(({ status }) => status === "unknown").map(({ reason }) => reason)), ...applicationEvidence.flatMap((item) => item.status === "unavailable" ? [item.reason] : [])]);
      const contextBasis = {
        sourceClosureId: baseContext.sourceClosureId,
        items: baseContext.items,
        unknowns: contextUnknowns,
        estimatedCost: baseContext.estimatedCost,
        requiredBudgetOverrun: baseContext.requiredBudgetOverrun,
        requiredExpansionIds: unique([...baseContext.requiredExpansionIds, ...decisionIds.filter((id) => !closureIds.includes(id))]),
      };
      const compiledContext = { ...contextBasis, contentHash: hashFramedDomain("compiled-semantic-context", contextBasis) };
      const valueDependencies = graph.valueDependencies(closureIds);
      const lensObligations = graph.lensObligations(new Set(closureIds), operation);
      const validatorFindings = await validators.evaluateAll(graph.validatorRequests(new Set(closureIds), operation));
      const governanceEvaluations = graph.governanceEvaluations(new Set(closureIds), operation, validatorFindings);
      const sourceFingerprint = hashFramedDomain("knowledge-context-sources", { values: valueDependencies.map(({ id, role }) => ({ id, role, sourceHash: graph.sourceHash(id) ?? null })), applicationEvidence: applicationEvidence.map(({ contentHash }) => contentHash) });
      const semanticFingerprint = hashFramedDomain("knowledge-context-semantics", { values: valueDependencies, applicationEvidence: applicationEvidence.map(({ contentHash }) => contentHash) });
      const queryFingerprint = hashFramedDomain("knowledge-context-queries", closure.boundState.queryDependencies);
      const branchBasis = { interpretation: candidate, hypothesis: !candidate.direct, closureHash: closure.contentHash, contextHash: compiledContext.contentHash, sourceFingerprint, semanticFingerprint, queryFingerprint, lensObligations, decisionValidity: decisionEvidence.decisions, governanceEvaluations, applicationEvidence };
      branches.push({
        id: `knowledge_branch_${hashFramedDomain("knowledge-context-branch", branchBasis).slice(-32)}`,
        interpretation: candidate,
        hypothesis: !candidate.direct,
        closure,
        context: compiledContext,
        metrics: compilation.metrics,
        frontier: compilation.frontier,
        lensObligations,
        decisionValidity: decisionEvidence.decisions,
        governanceEvaluations,
        applicationEvidence,
        sourceFingerprint,
        semanticFingerprint,
        queryFingerprint,
      });
    }
    if (validators.executed) {
      const after = await observeChangeRepository(this.repositoryRoot);
      input.signal?.throwIfAborted();
      if (hashFramedDomain("knowledge-validation-state", after.state) !== hashFramedDomain("knowledge-validation-state", observation.state)) throw new Error("Repository changed while custom validators ran; discard these observations and request fresh context.");
    }
    const requestOptions = { entities, namedTargets, operation, policy: selectedPolicy };
    const unknowns = unique([
      ...interpretationUnknowns,
      ...(graph.lensCompilationUnknown === undefined ? [] : [`lens obligations unavailable: ${graph.lensCompilationUnknown}`]),
      ...branches.flatMap(({ closure, context }) => [...closure.unknowns, ...context.unknowns]),
    ]);
    const impactSnapshot = buildRepositoryImpactSnapshot(observation, graph);
    input.signal?.throwIfAborted();
    if (persist) {
      await persistRepositoryImpactSnapshot(this.repositoryRoot, impactSnapshot);
      input.signal?.throwIfAborted();
    }
    const result = finalizeKnowledgeContext({
      impactBaseline: impactReference(impactSnapshot),
      apiVersion: KNOWLEDGE_API_VERSION,
      request,
      requestFingerprint: hashFramedDomain("knowledge-request", requestOptions),
      operation,
      requestOptions,
      capturedState: observation.state,
      discoveryBinding,
      interpretation: {
        status: candidates.length === 0 ? "unresolved" : candidates.every(({ direct }) => direct) ? "direct" : "candidates",
        candidates,
        unknowns: interpretationUnknowns,
      },
      branches,
      analyzerCapabilities: observation.analysis.capabilities,
      analyzerFailures: observation.analysis.failures,
      unknowns,
      persisted: persist,
    });
    const parsed = KnowledgeContextResultSchema.parse(result);
    input.signal?.throwIfAborted();
    return persist ? this.store.write(parsed) : parsed;
  }

  read(contextId: string): Promise<KnowledgeContextResult> {
    return this.store.read(contextId);
  }

  async reconcile(contextId: string, options: { readonly signal?: AbortSignal } = {}): Promise<KnowledgeReconciliationResult> {
    options.signal?.throwIfAborted();
    const retained = await this.store.read(contextId);
    options.signal?.throwIfAborted();
    const observation = await observeChangeRepository(this.repositoryRoot);
    options.signal?.throwIfAborted();
    const graph = new KnowledgeGraph(observation, this.host);
    const adapterContext: AdapterContext = { repositoryRoot: observation.repositoryRoot, stateDigest: observation.state, config: {}, signal: options.signal ?? new AbortController().signal };
    const current = await this.compileContext({
      request: retained.request,
      entities: retained.requestOptions.entities,
      namedTargets: retained.requestOptions.namedTargets,
      operation: retained.requestOptions.operation,
      policy: retained.requestOptions.policy,
      persist: false,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    }, observation, graph);
    options.signal?.throwIfAborted();
    const currentApplicationDependencies = new Map(current.branches
      .flatMap(({ applicationEvidence }) => applicationEvidenceDependencies(applicationEvidence))
      .map((dependency) => [dependency.id, dependency.versionHash] as const));
    const validator = new DependencyScopedStateBindingValidator({
      values: { readVersionHash: async (dependency) => currentApplicationDependencies.get(dependency.id) ?? graph.currentVersionHash(dependency) },
      queries: { evaluate: (query, context) => graph.registry.evaluate(query, context) },
    });
    const discoveryValidation = await validator.validate(retained.discoveryBinding, observation.state, adapterContext);
    options.signal?.throwIfAborted();
    const branches = [];
    for (const branch of retained.branches) {
      branches.push({ branchId: branch.id, validation: await validator.validate(branch.closure.boundState, observation.state, adapterContext) });
      options.signal?.throwIfAborted();
    }
    const validations = [discoveryValidation, ...branches.map(({ validation }) => validation)];
    let status = validations.reduce<StateBindingValidation["status"]>((worst, validation) => validationRank[validation.status] > validationRank[worst] ? validation.status : worst, "current");
    let reasons = unique(validations.flatMap(({ reasons: validationReasons }) => validationReasons));
    const namedTargetsReplaced = retained.requestOptions.entities.length === 0
      && retained.branches.every(({ interpretation }) => interpretation.entityKind === "projection-unit")
      && retained.requestOptions.namedTargets.length > 0
      && retained.requestOptions.namedTargets.every((target) => graph.resolveNamedTargets([target]).length > 0);
    if (status === "unavailable" && namedTargetsReplaced) {
      status = "stale";
      reasons = unique([...reasons, "a retained projection-unit identity disappeared while every explicitly named source target remains present with current observed membership"]);
    }
    const retainedByEntity = new Map(retained.branches.map((branch) => [branch.interpretation.entityId, branch]));
    const currentByEntity = new Map(current.branches.map((branch) => [branch.interpretation.entityId, branch]));
    const governanceBranches = unique([...retainedByEntity.keys(), ...currentByEntity.keys()]).map((interpretationEntityId) => {
      const retainedBranch = retainedByEntity.get(interpretationEntityId);
      const currentBranch = currentByEntity.get(interpretationEntityId);
      if (currentBranch === undefined) {
        return {
          interpretationEntityId,
          ...(retainedBranch === undefined ? {} : { retainedBranchId: retainedBranch.id }),
          status: "unknown" as const,
          evaluations: [],
          reasons: ["the retained interpretation is absent from the current repository observation"],
        };
      }
      if (graph.lensCompilationUnknown !== undefined) {
        return {
          interpretationEntityId,
          ...(retainedBranch === undefined ? {} : { retainedBranchId: retainedBranch.id }),
          currentBranchId: currentBranch.id,
          status: "unknown" as const,
          evaluations: [],
          reasons: [`current lens compilation is unavailable: ${graph.lensCompilationUnknown}`],
        };
      }
      const evaluations = currentBranch.governanceEvaluations ?? [];
      const decisionValidity = currentBranch.decisionValidity ?? [];
      const authorityUnknowns = graph.authorityUnknowns(currentBranch.closure.entries.map(({ entityId }) => entityId));
      const branchStatus = knowledgeGovernanceStatus(evaluations, decisionValidity, authorityUnknowns);
      return {
        interpretationEntityId,
        ...(retainedBranch === undefined ? {} : { retainedBranchId: retainedBranch.id }),
        currentBranchId: currentBranch.id,
        status: branchStatus,
        evaluations,
        decisionValidity,
        reasons: unique([
          ...authorityUnknowns,
          ...decisionValidity.filter(({ assessment }) => assessment.blocksCurrentChange).map(({ assessment }) => assessment.explanation),
          ...decisionValidity.flatMap(({ checks }) => checks.filter(({ status }) => status === "unknown").map(({ reason }) => reason)),
          ...evaluations.flatMap((evaluation) => [
            ...evaluation.findings.filter(({ status: findingStatus }) => findingStatus !== "satisfied").map(({ reason }) => reason),
            ...(evaluation.status === "unknown" ? evaluation.boundary : []),
          ]),
        ]),
      };
    });
    const governanceStatus = graph.lensCompilationUnknown !== undefined ? "unknown" as const
      : governanceBranches.some(({ status: branchStatus }) => branchStatus === "violated") ? "violated" as const
      : governanceBranches.some(({ status: branchStatus }) => branchStatus === "unknown") ? "unknown" as const
        : governanceBranches.some(({ status: branchStatus }) => branchStatus === "conformant") ? "conformant" as const : "not-applicable" as const;
    const governance = {
      status: governanceStatus,
      regeneratedContextId: current.id,
      branches: governanceBranches,
      reasons: unique([
        ...(graph.lensCompilationUnknown === undefined ? [] : [`current lens compilation is unavailable: ${graph.lensCompilationUnknown}`]),
        ...governanceBranches.flatMap(({ reasons: branchReasons }) => branchReasons),
      ]),
    };
    const applicationBranches = retained.branches.map((retainedBranch) => {
      const currentBranch = current.branches.find(({ interpretation }) => interpretation.entityId === retainedBranch.interpretation.entityId);
      if (currentBranch === undefined) return { branchId: retainedBranch.id, status: "unknown" as const, changed: true, reasons: ["The retained application-evidence branch is absent from the current repository observation."] };
      const currentStatus = applicationEvidenceDisposition(currentBranch.applicationEvidence);
      const changed = canonicalJson(retainedBranch.applicationEvidence.map(({ contentHash }) => contentHash)) !== canonicalJson(currentBranch.applicationEvidence.map(({ contentHash }) => contentHash));
      const reasons = unique([
        ...(changed ? ["Application evidence or its currentness disposition changed since context capture."] : []),
        ...currentBranch.applicationEvidence.flatMap((item) => item.status === "unavailable" ? [item.reason] : []),
        ...currentBranch.applicationEvidence.flatMap((item) => item.status === "assessed" && item.assessment.fulfillment.status !== "satisfied" ? [item.assessment.fulfillment.reason] : []),
      ]);
      return { branchId: retainedBranch.id, status: currentStatus, changed, reasons };
    });
    const directBranchIds = new Set(retained.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).map(({ id }) => id));
    const applicationStatuses = applicationBranches.filter(({ branchId }) => directBranchIds.has(branchId)).map(({ status: applicationStatus }) => applicationStatus);
    const applicationEvidence = {
      status: applicationStatuses.includes("violated") ? "violated" as const
        : applicationStatuses.includes("unknown") ? "unknown" as const
          : applicationStatuses.includes("satisfied") ? "satisfied" as const : "not-applicable" as const,
      branches: applicationBranches,
    };
    const impact = retained.impactBaseline === undefined ? undefined : await reconcileRetainedImpact(this.repositoryRoot, retained.impactBaseline, buildRepositoryImpactSnapshot(observation, graph), unique(retained.branches.flatMap(({ closure }) => closure.entries.filter(({ band }) => band !== "possible").map(({ entityId }) => entityId))), contextId);
    options.signal?.throwIfAborted();
    const basis = { apiVersion: KNOWLEDGE_API_VERSION, contextId, capturedState: retained.capturedState, currentState: observation.state, status, discoveryValidation, branches, governance, applicationEvidence, ...(impact === undefined ? {} : { impact }), reasons };
    const result = { ...basis, contentHash: hashFramedDomain("knowledge-reconciliation", basis) };
    const parsed = KnowledgeReconciliationResultSchema.parse(result);
    options.signal?.throwIfAborted();
    return parsed;
  }
}
