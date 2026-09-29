import {
  createKnowledgeComputeHostHandler
} from "./shared-CPHR3K42.js";
import {
  observeChangeRepository
} from "./shared-WPJ24CHV.js";
import {
  KnowledgeGraph,
  assessKnowledgeDecisions
} from "./shared-BEDSHOK5.js";
import {
  runObservationTask
} from "./shared-AIE6IGAJ.js";
import {
  withObservationScope
} from "./shared-QSFRBEBN.js";
import {
  ArchitectureConcernSchema,
  ArchitectureDecisionSchema,
  canonicalJson
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/knowledge/architecture-inspection.js
async function inspectRepositoryArchitecture(repositoryRoot) {
  const result = await withObservationScope({}, async (scope) => {
    const observation = await observeChangeRepository(repositoryRoot);
    const { independentValidator: _validator, ...data } = observation;
    return runObservationTask("architecture", { observation: data, now: (/* @__PURE__ */ new Date()).toISOString() }, {
      ...scope,
      onHostRequest: createKnowledgeComputeHostHandler(observation, {})
    });
  });
  return architectureInspection(result);
}
async function computeRepositoryArchitecture(observation, host, now, derivedBudget) {
  const repositoryRoot = observation.repositoryRoot;
  const graph = new KnowledgeGraph(observation, { now: () => now, readDecisionBaseline: host.baseline }, derivedBudget);
  const decisions = observation.canonical.documents.filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => ArchitectureDecisionSchema.parse(payload));
  const concerns = observation.canonical.documents.filter(({ kind }) => kind === "architecture-concern").map(({ payload }) => ArchitectureConcernSchema.parse(payload));
  const context = { repositoryRoot, stateDigest: observation.state, config: {}, signal: new AbortController().signal };
  const validity = await assessKnowledgeDecisions(graph, graph.decisions, "inspect", context);
  const populations = await Promise.all(graph.decisions.map(async (decision) => {
    const dependency = await graph.bindDecisionApplicability(decision.id, context);
    return [decision.id, {
      count: dependency.priorResult.resultCount,
      observability: dependency.priorResult.observability,
      memberIds: graph.implementationBindings(decision.id).map(({ id }) => String(id)),
      assumptions: dependency.priorResult.assumptions
    }];
  }));
  return { decisions, concerns, state: observation.state, decisionValidity: validity.decisions, populations };
}
function architectureInspection(result) {
  const { decisions, concerns, state, decisionValidity } = result;
  const populations = new Map(result.populations);
  return {
    decisions,
    concerns,
    state,
    decisionValidity,
    population: {
      async inspect(decision) {
        return populations.get(decision.id) ?? { count: 0, observability: "unavailable", memberIds: [], assumptions: [] };
      }
    },
    overlap: {
      async assess(left, right) {
        const a = populations.get(left.id);
        const b = populations.get(right.id);
        if (a?.observability !== "closed" || b?.observability !== "closed")
          return "unknown";
        const leftMembers = new Set(a.memberIds);
        if (!b.memberIds.some((id) => leftMembers.has(id)))
          return "disjoint";
        if (left.concernId === right.concernId && left.selectedOptionKey !== right.selectedOptionKey)
          return "incompatible";
        if (left.concernId === right.concernId && left.decision === right.decision && canonicalJson(left.consequences) === canonicalJson(right.consequences))
          return "compatible";
        return "unknown";
      }
    },
    async validity(decisionId) {
      const known = decisionValidity.find((entry) => entry.decisionId === decisionId);
      if (known !== void 0)
        return known.assessment;
      const decision = decisions.find(({ id }) => id === decisionId);
      if (decision === void 0)
        throw new Error(`architecture decision ${decisionId} is unavailable`);
      return { decisionId, scope: decision.scope, state: "invalid-for-scope", firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], blocksCurrentChange: true, explanation: "Canonical decision is no longer active." };
    }
  };
}

export {
  inspectRepositoryArchitecture,
  computeRepositoryArchitecture
};
