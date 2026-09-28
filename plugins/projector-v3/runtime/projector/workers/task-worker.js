import {
  assertBoundedObservationData
} from "../chunks/shared-VNGUL66Q.js";
import {
  DerivedObservationBudget,
  ObservationBudget,
  ObservationError,
  hashFramedDomain
} from "../chunks/shared-ZRBELDV4.js";
import "../chunks/shared-WC2OT3WX.js";

// node_modules/@projector/control-plane/dist/observation/task-worker.js
import { parentPort } from "node:worker_threads";
function assertIndexedDescriptor(descriptor, head) {
  const metadata = head?.metadata;
  if (head?.generation !== descriptor.generation || head.contract !== descriptor.contractHash || metadata?.checkoutId !== descriptor.checkoutId || metadata.repositoryRoot !== descriptor.repositoryRoot || hashFramedDomain("indexed-descriptor-state", metadata.state) !== hashFramedDomain("indexed-descriptor-state", descriptor.metadata.state)) {
    throw new Error("Indexed observation descriptor no longer matches its completed generation; retry observation");
  }
}
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
  readImpact: (reference) => hostRequest({ type: "read-impact", reference })
};
async function execute(task, derivedBudget) {
  switch (task.type) {
    case "indexed-knowledge-context":
    case "indexed-knowledge-reconcile": {
      const { SqliteObservationStore } = await import("../chunks/shared-L2OHLWQU.js");
      const { IndexedKnowledgeGraph } = await import("../chunks/shared-XD6QIG6K.js");
      const { IndexedGovernance } = await import("../chunks/shared-X6LHTV6B.js");
      const { RepositoryKnowledgeService } = await import("../chunks/shared-WXIDPJ4R.js");
      return start(async () => {
        const { descriptor } = task.input;
        const budget = new ObservationBudget({ ...descriptor.metadata.analysisHeader.observationDescriptor.limits, timeoutMs: Math.max(1, deadline - Date.now()) });
        const store = await SqliteObservationStore.open(descriptor.repositoryRoot, { budget });
        try {
          const head = store.head();
          assertIndexedDescriptor(descriptor, head);
          const decisionHost = { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } };
          const graph = new IndexedKnowledgeGraph(descriptor, store, (registry) => new IndexedGovernance(descriptor, store, registry, decisionHost, derivedBudget), derivedBudget);
          const failures = store.getAt(descriptor.generation, "knowledge-global", "failures");
          if (failures === void 0)
            throw new Error("Indexed analyzer failure population is missing; rebuild the complete observation");
          const observation = { repositoryRoot: descriptor.repositoryRoot, state: descriptor.metadata.state, analysis: { ...descriptor.metadata.analysisHeader, failures } };
          const result = task.type === "indexed-knowledge-context" ? await RepositoryKnowledgeService.computeContext(task.input.request, observation, decisionHost, host, derivedBudget, graph) : await RepositoryKnowledgeService.computeReconciliation(task.input.retained, observation, decisionHost, host, derivedBudget, graph);
          store.verifyGeneration(descriptor.generation);
          const delta = graph.memo.delta();
          if ((delta.upserts?.length ?? 0) > 0)
            store.publish(descriptor.generation, head, delta, { retainGeneration: true, preserveMetadata: true });
          return result;
        } finally {
          store.close();
        }
      });
    }
    case "indexed-graph-query": {
      const { SqliteObservationStore } = await import("../chunks/shared-L2OHLWQU.js");
      const { QueryDependencyRegistry } = await import("../chunks/shared-LQ4OM6AN.js");
      const { IndexedGraphReader } = await import("../chunks/shared-E7RBUVOV.js");
      const { IndexedQueryMemo } = await import("../chunks/shared-AO2JYUEJ.js");
      return start(async () => {
        const { descriptor } = task.input;
        const budget = new ObservationBudget({ ...descriptor.metadata.analysisHeader.observationDescriptor.limits, timeoutMs: Math.max(1, deadline - Date.now()) });
        const store = await SqliteObservationStore.open(descriptor.repositoryRoot, { budget });
        try {
          const head = store.head();
          assertIndexedDescriptor(descriptor, head);
          const memo = new IndexedQueryMemo(store, descriptor.generation);
          const registry = new QueryDependencyRegistry(new IndexedGraphReader(store, descriptor.generation), true, memo);
          const result = await registry.evaluate(task.input.query, { ...task.input.context, signal: new AbortController().signal });
          store.verifyGeneration(descriptor.generation);
          const delta = memo.delta();
          if ((delta.upserts?.length ?? 0) > 0)
            store.publish(descriptor.generation, head, delta, { retainGeneration: true, preserveMetadata: true });
          return result;
        } finally {
          store.close();
        }
      });
    }
    case "change-relevance":
      return start((await import("../chunks/shared-V6WFICRN.js")).calculateRepositoryRelevance, task.input.observation, task.input.editedPaths, derivedBudget);
    case "change-query": {
      const { createChangeQueryRegistry } = await import("../chunks/shared-V6WFICRN.js");
      return start(() => createChangeQueryRegistry({ observation: task.input.observation, now: task.input.now, derivedBudget }).evaluate(task.input.query, { ...task.input.context, signal: new AbortController().signal }));
    }
    case "cache-protection":
      return start((await import("../chunks/shared-AJWQW7IW.js")).authenticateCacheProtectionSources, task.input);
    case "analyze-collected":
      return start((await import("../chunks/shared-4SKQT65J.js")).analyzeCollectedLocalRepository, task.input.collected, derivedBudget);
    case "analyze-incremental":
      return start((await import("../chunks/shared-4SKQT65J.js")).analyzeCollectedLocalRepository, task.input.collected, derivedBudget, task.input.context);
    case "authenticate-impact":
      return start((await import("../chunks/shared-V7ZZCQSI.js")).authenticateRepositoryImpactSource, task.input.source, task.input.reference);
    case "prepare-impact": {
      const { KnowledgeGraph } = await import("../chunks/shared-G5F54GO3.js");
      const { buildRepositoryImpactSnapshot, predictRepositoryImpact } = await import("../chunks/shared-V7ZZCQSI.js");
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
      return start((await import("../chunks/shared-E4ZPBIXJ.js")).computeRepositoryCoverage, task.input.observation, task.input.request, task.input.mode, host, task.input.now, derivedBudget);
    case "architecture":
      return start((await import("../chunks/shared-CJNKDVVH.js")).computeRepositoryArchitecture, task.input.observation, host, task.input.now, derivedBudget);
    case "hash-content":
      return start(() => hashFramedDomain("transform-content", task.input.content));
    case "authenticate-context":
      return start((await import("../chunks/shared-LMB6OUCS.js")).authenticateKnowledgeContextSource, task.input.source);
    case "decision-baseline-data":
      return start((await import("../chunks/shared-GJQA5UOK.js")).executeDecisionBaselineData, task.input);
    case "knowledge-context":
      return start((await import("../chunks/shared-WXIDPJ4R.js")).RepositoryKnowledgeService.computeContext, task.input.request, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } }, host, derivedBudget);
    case "knowledge-reconcile":
      return start((await import("../chunks/shared-WXIDPJ4R.js")).RepositoryKnowledgeService.computeReconciliation, task.input.retained, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } }, host, derivedBudget);
    case "canonical":
      return start((await import("../chunks/shared-L2OHLWQU.js")).parseCanonicalSnapshotSources, task.input.sources, derivedBudget);
    case "observe": {
      const { analyzeCollectedLocalRepository } = await import("../chunks/shared-4SKQT65J.js");
      const { parseCanonicalSnapshotSources } = await import("../chunks/shared-L2OHLWQU.js");
      const { realizeChangeRepositoryData } = await import("../chunks/shared-DWP6Q3EW.js");
      return start(() => realizeChangeRepositoryData(task.input.collected.options.repositoryRoot, analyzeCollectedLocalRepository(task.input.collected, derivedBudget), parseCanonicalSnapshotSources(task.input.canonicalSources, derivedBudget), derivedBudget));
    }
    case "build-impact": {
      const { KnowledgeGraph } = await import("../chunks/shared-G5F54GO3.js");
      const { buildRepositoryImpactSnapshot } = await import("../chunks/shared-V7ZZCQSI.js");
      return start(() => buildRepositoryImpactSnapshot(task.input.observation, new KnowledgeGraph(task.input.observation, {}, derivedBudget)));
    }
    case "predict-impact":
      return start((await import("../chunks/shared-V7ZZCQSI.js")).predictRepositoryImpact, task.input.snapshot, task.input.editedPaths, task.input.canonicalChanges, derivedBudget);
    case "reconcile-impact":
      return start((await import("../chunks/shared-V7ZZCQSI.js")).reconcileRepositoryImpact, task.input.before, task.input.after, task.input.predictedUnitIds, task.input.planId, task.input.predictedPaths, task.input.hasPrediction, derivedBudget);
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
