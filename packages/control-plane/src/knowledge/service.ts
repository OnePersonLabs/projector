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
  type DerivedObservationBudget,
} from "@projector/core";
import {
  DependencyScopedStateBindingValidator,
  compileContext,
  compileRelevanceClosure,
  createStateBinding,
} from "@projector/engine";
import { currentObservationScope, withObservationScope, withDerivedCacheAdmission, type DerivedCacheWrite } from "@projector/runtime";

import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { KnowledgeGraph } from "./graph.js";
import { buildRepositoryImpactSnapshot, impactReference, impactSnapshotWrite, readRepositoryImpactSnapshot, reconcileRetainedImpact, type RepositoryImpactSnapshot } from "../impact/service.js";
import { assessKnowledgeDecisions, knowledgeGovernanceStatus, type KnowledgeDecisionHost } from "./governance.js";
import { KnowledgeValidatorRun, type KnowledgeValidatorHost } from "./validators.js";
import {
  applicationEvidenceDependencies,
  applicationEvidenceDisposition,
  assessKnowledgeApplicationEvidence,
  type ApplicationEvidencePort,
} from "./application-evidence.js";
import { KnowledgeContextStore, finalizeKnowledgeContext, knowledgeContextWrite } from "./store.js";
import { DecisionBaselineReader } from "./decision-baselines.js";
import { runObservationTask } from "../observation/task-runner.js";
import type { KnowledgeComputeHost, KnowledgeHostRequest } from "../observation/knowledge-host.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import { assertKnowledgeContextResponseSize } from "./transport.js";
import { inspectRepositoryContinuation } from "../coverage/continuation.js";
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

export function createKnowledgeComputeHostHandler(observation: ChangeRepositoryObservation, host: KnowledgeDecisionHost & KnowledgeValidatorHost & { readonly applicationEvidence?: ApplicationEvidencePort } = {}): (request: KnowledgeHostRequest, signal: AbortSignal) => Promise<unknown> {
  const baselines = new DecisionBaselineReader(observation);
  let validators: KnowledgeValidatorRun | undefined;
  return async (request, signal) => {
    const scope = currentObservationScope()!;
    const combined = AbortSignal.any([scope.signal, signal, AbortSignal.timeout(Math.max(1, scope.budget.remainingMs()))]);
    return withObservationScope({ signal: combined }, async () => {
    switch (request.type) {
      case "coverage-continuation": return inspectRepositoryContinuation(observation.repositoryRoot, request.request, { signal: combined, ...(host.applicationEvidence === undefined ? {} : { applicationEvidence: host.applicationEvidence }) });
      case "baseline": return baselines.read(request.decision, request.authority);
      case "validators": {
        validators ??= new KnowledgeValidatorRun(observation, combined, host);
        return { findings: await validators.evaluateAll(request.requests), executed: validators.executed };
      }
      case "application-evidence": return assessKnowledgeApplicationEvidence({ observation, ownerIds: request.ownerIds, signal: combined, ...(host.applicationEvidence === undefined ? {} : { port: host.applicationEvidence }) });
      case "fresh-state": return (await observeChangeRepository(observation.repositoryRoot)).state;
      case "read-impact": return readRepositoryImpactSnapshot(observation.repositoryRoot, request.reference);
    }
    });
  };
}

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
  candidates: readonly KnowledgeInterpretationCandidate[],
  compiledAgainst: AdapterContext["stateDigest"],
  identityDependency: StateQueryDependency,
  graph: KnowledgeGraph,
): SemanticIdentityResolution {
  const eligible = candidates.filter((candidate) => candidate.direct && coreCandidate(candidate) !== undefined);
  const kinds = unique(eligible.map(({ entityKind }) => entityKind));
  const requestedKind = kinds.length === 1 ? kinds[0]! as "concept" | "requirement" | "scenario" : "unknown" as const;
  const boundState = createStateBinding({
    compiledAgainst,
    valueDependencies: graph.valueDependencies(eligible.map(({ entityId }) => entityId)),
    queryDependencies: [identityDependency],
  });
  const basis = {
    requestedMeaning: request,
    requestedKind,
    outcome: eligible.length > 0 ? "reuse-existing" as const : "unresolved" as const,
    candidates: eligible.map(coreCandidate).filter((item): item is SemanticIdentityCandidate => item !== undefined),
    selectedEntityIds: eligible.map(({ entityId }) => entityId).sort(),
    confidence: eligible.length > 0 ? 1 : Math.max(...candidates.map(({ score }) => score), 0),
    evidence: [],
    unknowns: eligible.length > 0 ? [] : ["interpretation remains a candidate; context compilation does not prove semantic identity"],
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
    private readonly store: KnowledgeContextStore | undefined,
    private readonly host: KnowledgeDecisionHost & KnowledgeValidatorHost & { readonly applicationEvidence?: ApplicationEvidencePort },
    private readonly computeHost?: KnowledgeComputeHost,
    private readonly derivedBudget?: DerivedObservationBudget,
  ) {}

  static async create(input: string | ({ readonly repositoryRoot: string; readonly applicationEvidence?: ApplicationEvidencePort } & KnowledgeDecisionHost & KnowledgeValidatorHost)): Promise<RepositoryKnowledgeService> {
    const repositoryRoot = typeof input === "string" ? input : input.repositoryRoot;
    return new RepositoryKnowledgeService(repositoryRoot, await KnowledgeContextStore.create(repositoryRoot), typeof input === "string" ? {} : input);
  }

  async context(input: KnowledgeContextRequest): Promise<KnowledgeContextResult> {
    return withObservationScope({ ...(input.signal === undefined ? {} : { signal: input.signal }) }, async (scope) => {
      const observation = await observeChangeRepository(this.repositoryRoot);
      const { independentValidator: _validator, ...data } = observation;
      const { signal: _signal, ...request } = input;
      const prepared = await runObservationTask("knowledge-context", { observation: data, request, now: (this.host.now ?? (() => new Date().toISOString()))(), ...(this.host.acceptedDecisionBaselines === undefined ? {} : { acceptedDecisionBaselines: this.host.acceptedDecisionBaselines }) }, {
        ...scope, onHostRequest: this.hostRequests(observation),
      });
      scope.signal.throwIfAborted();
      scope.budget.check("context-publication");
      if (prepared.writes.length > 0) await withDerivedCacheAdmission(this.repositoryRoot, (cache) => cache.publishAll(prepared.writes), { signal: scope.signal, deadline: scope.deadline });
      return prepared.result;
    });
  }

  private hostRequests(observation: ChangeRepositoryObservation): (request: KnowledgeHostRequest, signal: AbortSignal) => Promise<unknown> {
    return createKnowledgeComputeHostHandler(observation, this.host);
  }

  static async computeContext(input: Omit<KnowledgeContextRequest, "signal">, observation: RepositoryObservationData, host: KnowledgeDecisionHost, computeHost: KnowledgeComputeHost, derivedBudget?: DerivedObservationBudget): Promise<{ result: KnowledgeContextResult; writes: DerivedCacheWrite[] }> {
    let impact: RepositoryImpactSnapshot | undefined;
    const service = new RepositoryKnowledgeService(observation.repositoryRoot, undefined, host, { ...computeHost, stageImpact(snapshot) { impact = snapshot; } }, derivedBudget);
    const result = await service.compileContext(input, observation, new KnowledgeGraph(observation, host, derivedBudget));
    if (impact === undefined) throw new Error("Knowledge computation did not produce its impact snapshot");
    assertKnowledgeContextResponseSize(result, input.view ?? "agent");
    return { result, writes: result.persisted ? [impactSnapshotWrite(impact), knowledgeContextWrite(result)] : [] };
  }

  private async compileContext(
    input: KnowledgeContextRequest,
    observation: RepositoryObservationData,
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
    const directCandidates = identity.value.filter(({ direct }) => direct);
    const directAddressGroup = entities.length > 1 && namedTargets.length === 0 && directCandidates.length > 1;
    // Several explicit accepted addresses name one requested body of meaning.
    // They are not rival interpretations. Compile their direct closure once so
    // no address disappears merely because it follows the candidate cap.
    const candidates = directAddressGroup ? identity.value : identity.value.slice(0, selectedPolicy.maxCandidates);
    const branchCandidates = directAddressGroup
      ? [directCandidates[0]!, ...candidates.filter(({ direct }) => !direct)]
      : candidates;
    const missingAddresses = entities.filter((address) => graph.search(request, [address], 1).length === 0);
    const missingTargets = namedTargets.filter((target) => graph.resolveNamedTargets([target]).length === 0);
    const interpretationUnknowns = unique([
      ...missingAddresses.map((address) => `explicit canonical address ${address} did not resolve`),
      ...missingTargets.map((target) => `named repository target ${target} did not resolve`),
      ...(candidates.length === 0 ? ["no supported canonical or observed interpretation candidate was found"] : []),
    ]);
    const discoveryBinding = createStateBinding({ compiledAgainst: observation.state, valueDependencies: [], queryDependencies: [identity.dependency] });
    const branches: KnowledgeContextBranch[] = [];
    const computeHost = this.computeHost;
    if (computeHost === undefined) throw new Error("Knowledge compilation requires its observation worker host");
    let validatorsExecuted = false;
    for (const candidate of branchCandidates) {
      const selectedCandidates = directAddressGroup && candidate.entityId === directCandidates[0]!.entityId ? directCandidates : [candidate];
      const resolution = identityResolution(request, selectedCandidates, observation.state, identity.dependency, graph);
      const collectedQueries: StateQueryDependency[] = [];
      const seeds = selectedCandidates.filter((selected) => coreCandidate(selected) === undefined).map((selected) => ({
        kind: selected.entityKind === "projection-unit" ? "projection-unit" as const : selected.entityKind === "architecture-decision" ? "decision" as const : "manual" as const,
        subjectId: selected.entityId,
        reason: selected.explanation,
        confidence: selected.score,
      }));
      const compilation = await compileRelevanceClosure({
        request,
        seeds: seeds.length > 0 ? seeds : candidate.direct ? [] : [{ kind: candidate.entityKind === "projection-unit" ? "projection-unit" : candidate.entityKind === "architecture-decision" ? "decision" : "manual", subjectId: candidate.entityId, reason: `hypothetical interpretation branch: ${candidate.explanation}`, confidence: candidate.score }],
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
      const applicationEvidence = await computeHost.applicationEvidence(closureIds);
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
      const validation = await computeHost.validators(graph.validatorRequests(new Set(closureIds), operation));
      validatorsExecuted ||= validation.executed;
      const validatorFindings = validation.findings;
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
    if (validatorsExecuted) {
      const after = await computeHost.freshState();
      input.signal?.throwIfAborted();
      if (hashFramedDomain("knowledge-validation-state", after) !== hashFramedDomain("knowledge-validation-state", observation.state)) throw new Error("Repository changed while custom validators ran; discard these observations and request fresh context.");
    }
    const requestOptions = { entities, namedTargets, operation, policy: selectedPolicy };
    const unknowns = unique([
      ...interpretationUnknowns,
      ...(graph.lensCompilationUnknown === undefined ? [] : [`lens obligations unavailable: ${graph.lensCompilationUnknown}`]),
      ...branches.flatMap(({ closure, context }) => [...closure.unknowns, ...context.unknowns]),
    ]);
    const impactSnapshot = buildRepositoryImpactSnapshot(observation, graph);
    input.signal?.throwIfAborted();
    computeHost.stageImpact(impactSnapshot);
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
    return parsed;
  }

  read(contextId: string): Promise<KnowledgeContextResult> {
    return this.store!.read(contextId);
  }

  async reconcile(contextId: string, options: { readonly signal?: AbortSignal } = {}): Promise<KnowledgeReconciliationResult> {
    return withObservationScope(options, async (scope) => {
      const retained = await this.store!.read(contextId);
      const observation = await observeChangeRepository(this.repositoryRoot);
      const { independentValidator: _validator, ...data } = observation;
      return runObservationTask("knowledge-reconcile", { observation: data, retained, now: (this.host.now ?? (() => new Date().toISOString()))(), ...(this.host.acceptedDecisionBaselines === undefined ? {} : { acceptedDecisionBaselines: this.host.acceptedDecisionBaselines }) }, { ...scope, onHostRequest: this.hostRequests(observation) });
    });
  }

  static computeReconciliation(retained: KnowledgeContextResult, observation: RepositoryObservationData, host: KnowledgeDecisionHost, computeHost: KnowledgeComputeHost, derivedBudget?: DerivedObservationBudget): Promise<KnowledgeReconciliationResult> {
    return new RepositoryKnowledgeService(observation.repositoryRoot, undefined, host, computeHost, derivedBudget).reconcileObserved(retained, observation);
  }

  private async reconcileObserved(retained: KnowledgeContextResult, observation: RepositoryObservationData): Promise<KnowledgeReconciliationResult> {
    const contextId = retained.id;
    const options: { signal?: AbortSignal } = {};
    const graph = new KnowledgeGraph(observation, this.host, this.derivedBudget);
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
    const impact = retained.impactBaseline === undefined ? undefined : await reconcileRetainedImpact(this.repositoryRoot, retained.impactBaseline, buildRepositoryImpactSnapshot(observation, graph), unique(retained.branches.flatMap(({ closure }) => closure.entries.filter(({ band }) => band !== "possible").map(({ entityId }) => entityId))), contextId, false, (_root, reference) => this.computeHost!.readImpact(reference), this.derivedBudget);
    options.signal?.throwIfAborted();
    const basis = { apiVersion: KNOWLEDGE_API_VERSION, contextId, capturedState: retained.capturedState, currentState: observation.state, status, discoveryValidation, branches, governance, applicationEvidence, ...(impact === undefined ? {} : { impact }), reasons };
    const result = { ...basis, contentHash: hashFramedDomain("knowledge-reconciliation", basis) };
    const parsed = KnowledgeReconciliationResultSchema.parse(result);
    options.signal?.throwIfAborted();
    return parsed;
  }
}
