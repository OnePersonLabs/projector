import { ArchitectureConcernSchema, ArchitectureDecisionSchema, canonicalJson, type AdapterContext, type ArchitectureConcern, type ArchitectureDecision, type DecisionValidityAssessment, type DerivedObservationBudget } from "@projector/core";
import type { DecisionOverlapAssessment } from "@projector/engine";
import { withObservationScope } from "@projector/runtime";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { KnowledgeGraph } from "./graph.js";
import { assessKnowledgeDecisions } from "./governance.js";
import { createKnowledgeComputeHostHandler } from "./service.js";
import { runObservationTask } from "../observation/task-runner.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import type { KnowledgeComputeHost } from "../observation/knowledge-host.js";

/** One observed snapshot for both architecture audit and progressive explanation. */
export async function inspectRepositoryArchitecture(repositoryRoot: string) {
  const result = await withObservationScope({}, async (scope) => {
    const observation = await observeChangeRepository(repositoryRoot);
    const { independentValidator: _validator, ...data } = observation;
    return runObservationTask("architecture", { observation: data, now: new Date().toISOString() }, {
      ...scope, onHostRequest: createKnowledgeComputeHostHandler(observation, {}),
    });
  });
  return architectureInspection(result);
}

export async function computeRepositoryArchitecture(observation: RepositoryObservationData, host: KnowledgeComputeHost, now: string, derivedBudget?: DerivedObservationBudget) {
  const repositoryRoot = observation.repositoryRoot;
  const graph = new KnowledgeGraph(observation, { now: () => now, readDecisionBaseline: host.baseline }, derivedBudget);
  const decisions = observation.canonical.documents.filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => ArchitectureDecisionSchema.parse(payload) as ArchitectureDecision);
  const concerns = observation.canonical.documents.filter(({ kind }) => kind === "architecture-concern").map(({ payload }) => ArchitectureConcernSchema.parse(payload) as ArchitectureConcern);
  const context: AdapterContext = { repositoryRoot, stateDigest: observation.state, config: {}, signal: new AbortController().signal };
  const validity = await assessKnowledgeDecisions(graph, graph.decisions, "inspect", context);
  const populations = await Promise.all(graph.decisions.map(async (decision) => {
    const dependency = await graph.bindDecisionApplicability(decision.id, context);
    return [decision.id, { count: dependency.priorResult.resultCount, observability: dependency.priorResult.observability,
      memberIds: graph.implementationBindings(decision.id).map(({ id }) => String(id)), assumptions: dependency.priorResult.assumptions }] as const;
  }));
  return { decisions, concerns, state: observation.state, decisionValidity: validity.decisions, populations };
}

function architectureInspection(result: Awaited<ReturnType<typeof computeRepositoryArchitecture>>) {
  const { decisions, concerns, state, decisionValidity } = result;
  const populations = new Map(result.populations);
  return {
    decisions, concerns, state, decisionValidity,
    population: {
      async inspect(decision: ArchitectureDecision) { return populations.get(decision.id) ?? { count: 0, observability: "unavailable" as const, memberIds: [], assumptions: [] }; },
    },
    overlap: {
      async assess(left: ArchitectureDecision, right: ArchitectureDecision): Promise<DecisionOverlapAssessment> {
        const a = populations.get(left.id); const b = populations.get(right.id);
        if (a?.observability !== "closed" || b?.observability !== "closed") return "unknown";
        const leftMembers = new Set(a.memberIds);
        if (!b.memberIds.some((id) => leftMembers.has(id))) return "disjoint";
        // Overlap alone neither establishes conflict nor semantic compatibility.
        if (left.concernId === right.concernId && left.selectedOptionKey !== right.selectedOptionKey) return "incompatible";
        if (left.concernId === right.concernId && left.decision === right.decision && canonicalJson(left.consequences) === canonicalJson(right.consequences)) return "compatible";
        return "unknown";
      },
    },
    async validity(decisionId: string): Promise<DecisionValidityAssessment> {
      const known = decisionValidity.find((entry) => entry.decisionId === decisionId);
      if (known !== undefined) return known.assessment;
      const decision = decisions.find(({ id }) => id === decisionId);
      if (decision === undefined) throw new Error(`architecture decision ${decisionId} is unavailable`);
      return { decisionId, scope: decision.scope, state: "invalid-for-scope", firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], blocksCurrentChange: true, explanation: "Canonical decision is no longer active." };
    },
  };
}
