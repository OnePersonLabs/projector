import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  assertBoundedObservationData
} from "../chunks/shared-GHTLNEBM.js";
import {
  DerivedObservationBudget,
  ObservationError,
  hashFramedDomain
} from "../chunks/shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/observation/task-worker.js
import { parentPort } from "node:worker_threads";
var deadline = 0;
var maxDerivedBytes = 0;
var busy = false;
var requestId = 0;
var requests = /* @__PURE__ */ new Map();
parentPort.on("message", (message) => {
  if ("task" in message) {
    void run(message);
    return;
  }
  const request = requests.get(message.id);
  if (request === void 0)
    return;
  requests.delete(message.id);
  if (message.ok)
    request.resolve(message.result);
  else {
    const error = message.error?.code === "observation-limit-exceeded" || message.error?.code === "observation-failed" ? new ObservationError(message.error.code, message.error.stage ?? "host", message.error.scope ?? ".", message.error.message, message.error.limit, message.error.observed) : new Error(message.error?.message ?? "Knowledge host operation failed");
    error.name = message.error?.name ?? error.name;
    request.reject(error);
  }
});
function hostRequest(request) {
  assertBoundedObservationData(request, maxDerivedBytes, deadline);
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    requests.set(id, { resolve: (value) => resolve(value), reject });
    parentPort.postMessage({ id, hostRequest: request });
  });
}
function start(operation, ...args) {
  parentPort.postMessage({ started: true });
  return operation(...args);
}
var host = {
  continuation: (request) => hostRequest({ type: "coverage-continuation", request }),
  baseline: (decision, authority) => hostRequest({ type: "baseline", decision, authority }),
  validators: (requests2) => hostRequest({ type: "validators", requests: requests2 }),
  applicationEvidence: (ownerIds) => hostRequest({ type: "application-evidence", ownerIds }),
  freshState: () => hostRequest({ type: "fresh-state" }),
  readImpact: (reference) => hostRequest({ type: "read-impact", reference }),
  stageImpact: () => {
  }
};
async function execute(task, derivedBudget) {
  switch (task.type) {
    case "change-relevance":
      return start((await import("../chunks/shared-ATXHUUMZ.js")).calculateRepositoryRelevance, task.input.observation, task.input.editedPaths, derivedBudget);
    case "change-query": {
      const { createChangeQueryRegistry } = await import("../chunks/shared-ATXHUUMZ.js");
      return start(() => createChangeQueryRegistry({ observation: task.input.observation, now: task.input.now, derivedBudget }).evaluate(task.input.query, { ...task.input.context, signal: new AbortController().signal }));
    }
    case "cache-protection":
      return start((await import("../chunks/shared-Z4D2GOXC.js")).authenticateCacheProtectionSources, task.input);
    case "analyze-collected":
      return start((await import("../chunks/shared-HK7WFI7Q.js")).analyzeCollectedLocalRepository, task.input.collected, derivedBudget);
    case "authenticate-impact":
      return start((await import("../chunks/shared-NVKV7C6O.js")).authenticateRepositoryImpactSource, task.input.source, task.input.reference);
    case "prepare-impact": {
      const { KnowledgeGraph } = await import("../chunks/shared-Q54IBT3I.js");
      const { buildRepositoryImpactSnapshot, predictRepositoryImpact } = await import("../chunks/shared-NVKV7C6O.js");
      return start(async () => {
        const graph = new KnowledgeGraph(task.input.observation, {}, derivedBudget);
        const baseline = buildRepositoryImpactSnapshot(task.input.observation, graph);
        const prediction = await predictRepositoryImpact(baseline, task.input.editedPaths, task.input.canonicalChanges, derivedBudget);
        const affected = new Set(task.input.affectedUnitIds);
        const governanceMemberships = [];
        const units = new Map(graph.units.map((unit) => [unit.id, unit]));
        for (const lens of graph.lenses) {
          if (lens.status !== "active")
            continue;
          for (const unitId of graph.lensCompilation?.memberships[lens.id] ?? []) {
            if (!affected.has(unitId))
              continue;
            derivedBudget.reserveItems(1, 128, "governance-membership", lens.id);
            governanceMemberships.push({ lensId: lens.id, unitId, path: units.get(unitId).key });
          }
        }
        governanceMemberships.sort((a, b) => a.lensId < b.lensId ? -1 : a.lensId > b.lensId ? 1 : a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0);
        return { baseline, prediction, governanceMemberships };
      });
    }
    case "coverage":
      return start((await import("../chunks/shared-34MF6JXV.js")).computeRepositoryCoverage, task.input.observation, task.input.request, task.input.mode, host, task.input.now, derivedBudget);
    case "architecture":
      return start((await import("../chunks/shared-BASMSKCX.js")).computeRepositoryArchitecture, task.input.observation, host, task.input.now, derivedBudget);
    case "hash-content":
      return start(() => hashFramedDomain("transform-content", task.input.content));
    case "authenticate-context":
      return start((await import("../chunks/shared-77VO7BSL.js")).authenticateKnowledgeContextSource, task.input.source);
    case "decision-baseline-data":
      return start((await import("../chunks/shared-EG55OUWN.js")).executeDecisionBaselineData, task.input);
    case "knowledge-context":
      return start((await import("../chunks/shared-RHQGORBM.js")).RepositoryKnowledgeService.computeContext, task.input.request, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } }, host, derivedBudget);
    case "knowledge-reconcile":
      return start((await import("../chunks/shared-RHQGORBM.js")).RepositoryKnowledgeService.computeReconciliation, task.input.retained, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } }, host, derivedBudget);
    case "canonical":
      return start((await import("../chunks/shared-H34MRAB2.js")).parseCanonicalSnapshotSources, task.input.sources, derivedBudget);
    case "observe": {
      const { analyzeCollectedLocalRepository } = await import("../chunks/shared-HK7WFI7Q.js");
      const { parseCanonicalSnapshotSources } = await import("../chunks/shared-H34MRAB2.js");
      const { realizeChangeRepositoryData } = await import("../chunks/shared-K5B6SHXC.js");
      return start(() => realizeChangeRepositoryData(task.input.collected.options.repositoryRoot, analyzeCollectedLocalRepository(task.input.collected, derivedBudget), parseCanonicalSnapshotSources(task.input.canonicalSources, derivedBudget), derivedBudget));
    }
    case "build-impact": {
      const { KnowledgeGraph } = await import("../chunks/shared-Q54IBT3I.js");
      const { buildRepositoryImpactSnapshot } = await import("../chunks/shared-NVKV7C6O.js");
      return start(() => buildRepositoryImpactSnapshot(task.input.observation, new KnowledgeGraph(task.input.observation, {}, derivedBudget)));
    }
    case "predict-impact":
      return start((await import("../chunks/shared-NVKV7C6O.js")).predictRepositoryImpact, task.input.snapshot, task.input.editedPaths, task.input.canonicalChanges, derivedBudget);
    case "reconcile-impact":
      return start((await import("../chunks/shared-NVKV7C6O.js")).reconcileRepositoryImpact, task.input.before, task.input.after, task.input.predictedUnitIds, task.input.planId, task.input.predictedPaths, task.input.hasPrediction, derivedBudget);
    default:
      throw new Error("Unsupported observation worker task; rebuild the installed runtime together with its caller");
  }
}
async function run(request) {
  try {
    if (busy)
      throw new Error("Observation worker received overlapping tasks");
    busy = true;
    deadline = request.deadline;
    maxDerivedBytes = request.maxDerivedBytes;
    if (Date.now() >= deadline)
      throw new ObservationError("observation-limit-exceeded", "worker", ".", "Observation deadline exceeded before analysis", "timeoutMs");
    const result = await execute(request.task, new DerivedObservationBudget(maxDerivedBytes));
    assertBoundedObservationData(result, maxDerivedBytes, deadline);
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    const failure = error;
    parentPort.postMessage({ ok: false, error: { message: failure.message ?? String(error), name: failure.name, code: failure.code, stage: failure.stage, scope: failure.scope, limit: failure.limit, observed: failure.observed } });
  } finally {
    busy = false;
  }
}
