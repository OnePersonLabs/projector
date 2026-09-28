import {
  hydrateCapturedInventory
} from "../chunks/shared-IVNK7NJ5.js";
import {
  assertBoundedObservationData
} from "../chunks/shared-IFEDFPQ4.js";
import "../chunks/shared-EHAKQ7RC.js";
import "../chunks/shared-T66EWDMN.js";
import {
  DerivedObservationBudget,
  ObservationBudget,
  ObservationError,
  hashFramedDomain,
  observationLimitValue
} from "../chunks/shared-AJ5KBTH5.js";
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
var maxDerivedBytes = null;
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
  assertBoundedObservationData(request, observationLimitValue(maxDerivedBytes), deadline);
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
function endSemanticLease(scope, token) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    requests.set(id, { resolve: () => resolve(), reject });
    parentPort.postMessage({ id, semanticLeaseEnding: { scope, token } });
  });
}
async function execute(task, derivedBudget) {
  switch (task.type) {
    case "observe-indexed":
      return start((await import("../chunks/shared-LTYFRTTJ.js")).executeIndexedObservationTask, task.input, derivedBudget);
    case "code-operation":
      return start((await import("../chunks/shared-NN6D3CBL.js")).executeCodeWorker, task.input, deadline, maxDerivedBytes, endSemanticLease);
    case "indexed-knowledge-context":
    case "indexed-knowledge-reconcile": {
      const { SqliteObservationStore } = await import("../chunks/shared-I2AGHOP2.js");
      const { IndexedKnowledgeGraph } = await import("../chunks/shared-IOXOMYIE.js");
      const { IndexedGovernance } = await import("../chunks/shared-ZRCGKA72.js");
      const { RepositoryKnowledgeService } = await import("../chunks/shared-PS3BL5P5.js");
      const { IndexedSemanticGraph } = await import("../chunks/shared-CQLWJ3OW.js");
      return start(async () => {
        const { descriptor } = task.input;
        const budget = new ObservationBudget({ ...descriptor.metadata.analysisHeader.observationDescriptor.limits, timeoutMs: Number.isFinite(deadline) ? Math.max(1, deadline - Date.now()) : null });
        const store = await SqliteObservationStore.open(descriptor.repositoryRoot, { budget });
        let semantic;
        try {
          const head = store.head();
          assertIndexedDescriptor(descriptor, head);
          semantic = await IndexedSemanticGraph.open(descriptor);
          const decisionHost = { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } };
          const graph = new IndexedKnowledgeGraph(descriptor, store, (registry) => new IndexedGovernance(descriptor, store, registry, decisionHost, derivedBudget), derivedBudget, semantic);
          const failures = store.getAt(descriptor.generation, "knowledge-global", "failures");
          if (failures === void 0)
            throw new Error("Indexed analyzer failure population is missing; rebuild the complete observation");
          const observation = { repositoryRoot: descriptor.repositoryRoot, state: descriptor.metadata.state, analysis: { ...descriptor.metadata.analysisHeader, failures } };
          const result = task.type === "indexed-knowledge-context" ? await RepositoryKnowledgeService.computeContext(task.input.request, observation, decisionHost, host, derivedBudget, graph) : await RepositoryKnowledgeService.computeReconciliation(task.input.retained, observation, decisionHost, host, derivedBudget, graph);
          store.verifyGeneration(descriptor.generation);
          const delta = graph.memo.delta();
          if ((delta.upserts?.length ?? 0) > 0)
            await store.publishWhenReady(descriptor.generation, head, delta, { retainGeneration: true, preserveMetadata: true });
          if (task.type === "indexed-knowledge-context" && "result" in result && result.result.persisted && result.result.code !== void 0) {
            semantic.store.endReadSnapshot();
            semantic.store.pinRetained(result.result.code.generation, result.result.id);
          }
          return result;
        } finally {
          semantic?.close();
          store.close();
        }
      });
    }
    case "indexed-graph-query": {
      const { SqliteObservationStore } = await import("../chunks/shared-I2AGHOP2.js");
      const { QueryDependencyRegistry } = await import("../chunks/shared-UDNMBUD7.js");
      const { IndexedGraphReader } = await import("../chunks/shared-E7RBUVOV.js");
      const { IndexedQueryMemo } = await import("../chunks/shared-REL7E62N.js");
      return start(async () => {
        const { descriptor } = task.input;
        const budget = new ObservationBudget({ ...descriptor.metadata.analysisHeader.observationDescriptor.limits, timeoutMs: Number.isFinite(deadline) ? Math.max(1, deadline - Date.now()) : null });
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
            await store.publishWhenReady(descriptor.generation, head, delta, { retainGeneration: true, preserveMetadata: true });
          return result;
        } finally {
          store.close();
        }
      });
    }
    case "change-relevance":
      return start((await import("../chunks/shared-DVJMI6AN.js")).calculateRepositoryRelevance, task.input.observation, task.input.editedPaths, derivedBudget);
    case "change-query": {
      const { createChangeQueryRegistry } = await import("../chunks/shared-DVJMI6AN.js");
      return start(() => createChangeQueryRegistry({ observation: task.input.observation, now: task.input.now, derivedBudget }).evaluate(task.input.query, { ...task.input.context, signal: new AbortController().signal }));
    }
    case "cache-protection":
      return start((await import("../chunks/shared-UZGOOQFC.js")).authenticateCacheProtectionSources, task.input);
    case "analyze-collected": {
      const { analyzeCollectedLocalRepository } = await import("../chunks/shared-DEYGWEVT.js");
      return start(() => {
        const hydrated = hydrateCapturedInventory(task.input.collected.inventoryResult);
        try {
          return analyzeCollectedLocalRepository({ ...task.input.collected, inventoryResult: hydrated.inventory }, derivedBudget);
        } finally {
          hydrated.close();
        }
      });
    }
    case "analyze-javascript": {
      const { analyzeJavaScript } = await import("../chunks/shared-DEYGWEVT.js");
      return start(() => {
        const hydrated = hydrateCapturedInventory(task.input.inventory);
        try {
          return analyzeJavaScript(hydrated.inventory.entries, derivedBudget);
        } finally {
          hydrated.close();
        }
      });
    }
    case "analyze-incremental": {
      const { analyzeCollectedLocalRepository } = await import("../chunks/shared-DEYGWEVT.js");
      return start(() => {
        const hydrated = hydrateCapturedInventory(task.input.collected.inventoryResult);
        try {
          return analyzeCollectedLocalRepository({ ...task.input.collected, inventoryResult: hydrated.inventory }, derivedBudget, task.input.context);
        } finally {
          hydrated.close();
        }
      });
    }
    case "authenticate-impact":
      return start((await import("../chunks/shared-ZV77665V.js")).authenticateRepositoryImpactSource, task.input.source, task.input.reference);
    case "prepare-impact": {
      const { KnowledgeGraph } = await import("../chunks/shared-QOWFMBU4.js");
      const { buildRepositoryImpactSnapshot, predictRepositoryImpact, verifiedCurrentCodeGeneration } = await import("../chunks/shared-ZV77665V.js");
      return start(async () => {
        const graph = new KnowledgeGraph(task.input.observation, {}, derivedBudget);
        const codeGeneration = await verifiedCurrentCodeGeneration(task.input.observation.repositoryRoot, task.input.observation.state);
        const baseline = buildRepositoryImpactSnapshot(task.input.observation, graph, codeGeneration);
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
      return start((await import("../chunks/shared-FJDNITIU.js")).computeRepositoryCoverage, task.input.observation, task.input.request, task.input.mode, host, task.input.now, derivedBudget);
    case "architecture":
      return start((await import("../chunks/shared-NOE2F2QU.js")).computeRepositoryArchitecture, task.input.observation, host, task.input.now, derivedBudget);
    case "hash-content":
      return start(() => hashFramedDomain("transform-content", task.input.content));
    case "authenticate-context":
      return start((await import("../chunks/shared-NSODUW3E.js")).authenticateKnowledgeContextSource, task.input.source);
    case "decision-baseline-data":
      return start((await import("../chunks/shared-TJAEAGR6.js")).executeDecisionBaselineData, task.input);
    case "knowledge-context":
      return start((await import("../chunks/shared-PS3BL5P5.js")).RepositoryKnowledgeService.computeContext, task.input.request, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } }, host, derivedBudget);
    case "knowledge-reconcile":
      return start((await import("../chunks/shared-PS3BL5P5.js")).RepositoryKnowledgeService.computeReconciliation, task.input.retained, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...task.input.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines } }, host, derivedBudget);
    case "canonical":
      return start((await import("../chunks/shared-I2AGHOP2.js")).parseCanonicalSnapshotSources, task.input.sources, derivedBudget);
    case "observe": {
      const { analyzeCollectedLocalRepository } = await import("../chunks/shared-DEYGWEVT.js");
      const { parseCanonicalSnapshotSources } = await import("../chunks/shared-I2AGHOP2.js");
      const { realizeChangeRepositoryData } = await import("../chunks/shared-UCNPLTKU.js");
      return start(() => {
        const hydrated = hydrateCapturedInventory(task.input.collected.inventoryResult);
        try {
          const collected = { ...task.input.collected, inventoryResult: hydrated.inventory };
          return realizeChangeRepositoryData(collected.options.repositoryRoot, analyzeCollectedLocalRepository(collected, derivedBudget), parseCanonicalSnapshotSources(task.input.canonicalSources, derivedBudget), derivedBudget);
        } finally {
          hydrated.close();
        }
      });
    }
    case "build-impact": {
      const { KnowledgeGraph } = await import("../chunks/shared-QOWFMBU4.js");
      const { buildRepositoryImpactSnapshot, verifiedCurrentCodeGeneration } = await import("../chunks/shared-ZV77665V.js");
      return start(async () => buildRepositoryImpactSnapshot(task.input.observation, new KnowledgeGraph(task.input.observation, {}, derivedBudget), await verifiedCurrentCodeGeneration(task.input.observation.repositoryRoot, task.input.observation.state)));
    }
    case "predict-impact":
      return start((await import("../chunks/shared-ZV77665V.js")).predictRepositoryImpact, task.input.snapshot, task.input.editedPaths, task.input.canonicalChanges, derivedBudget);
    case "reconcile-impact":
      return start((await import("../chunks/shared-ZV77665V.js")).reconcileRepositoryImpact, task.input.before, task.input.after, task.input.predictedUnitIds, task.input.planId, task.input.predictedPaths, task.input.hasPrediction, derivedBudget);
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
    assertBoundedObservationData(result, observationLimitValue(maxDerivedBytes), deadline);
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    const failure = error;
    parentPort.postMessage({ ok: false, error: { message: failure.message ?? String(error), name: failure.name, code: failure.code, stage: failure.stage, scope: failure.scope, limit: failure.limit, observed: failure.observed } });
  } finally {
    busy = false;
  }
}
