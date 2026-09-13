import { parentPort } from "node:worker_threads";
import { assertBoundedObservationData } from "./data-bound.js";
import type { ObservationTask } from "./tasks.js";
import type { KnowledgeComputeHost, KnowledgeHostRequest } from "./knowledge-host.js";
import { hashFramedDomain, ObservationError, DerivedObservationBudget } from "@projector/core";

interface WorkerTaskRequest { task: ObservationTask; deadline: number; maxDerivedBytes: number }
let deadline = 0;
let maxDerivedBytes = 0;
let busy = false;
let requestId = 0;
const requests = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
parentPort!.on("message", (message: WorkerTaskRequest | { id: number; ok: boolean; result?: unknown; error?: { message: string; name?: string; code?: string; stage?: string; scope?: string } }) => {
  if ("task" in message) { void run(message); return; }
  const request = requests.get(message.id);
  if (request === undefined) return;
  requests.delete(message.id);
  if (message.ok) request.resolve(message.result);
  else {
    const error = message.error?.code === "observation-limit-exceeded" || message.error?.code === "observation-failed"
      ? new ObservationError(message.error.code, message.error.stage ?? "host", message.error.scope ?? ".", message.error.message)
      : new Error(message.error?.message ?? "Knowledge host operation failed");
    error.name = message.error?.name ?? error.name;
    request.reject(error);
  }
});
function hostRequest<T>(request: KnowledgeHostRequest): Promise<T> {
  assertBoundedObservationData(request, maxDerivedBytes, deadline);
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    requests.set(id, { resolve: (value) => resolve(value as T), reject });
    parentPort!.postMessage({ id, hostRequest: request });
  });
}
function start<Args extends unknown[], Result>(operation: (...args: Args) => Result, ...args: Args): Result {
  parentPort!.postMessage({ started: true });
  return operation(...args);
}
const host: KnowledgeComputeHost = {
  continuation: (request) => hostRequest({ type: "coverage-continuation", request }),
  baseline: (decision, authority) => hostRequest({ type: "baseline", decision, authority }),
  validators: (requests) => hostRequest({ type: "validators", requests }),
  applicationEvidence: (ownerIds) => hostRequest({ type: "application-evidence", ownerIds }),
  freshState: () => hostRequest({ type: "fresh-state" }),
  readImpact: (reference) => hostRequest({ type: "read-impact", reference }),
  stageImpact: () => { /* Reconciliation does not publish a derived snapshot. */ },
};
async function execute(task: ObservationTask, derivedBudget: DerivedObservationBudget): Promise<unknown> {
  switch (task.type) {
    case "change-relevance": return start((await import("../change-lifecycle/query-programs.js")).calculateRepositoryRelevance, task.input.observation, task.input.editedPaths, derivedBudget);
    case "change-query": {
      const { createChangeQueryRegistry } = await import("../change-lifecycle/query-programs.js");
      return start(() => createChangeQueryRegistry({ observation: task.input.observation as import("../change-lifecycle/repository-observer.js").ChangeRepositoryObservation, now: task.input.now, derivedBudget }).evaluate(task.input.query, { ...task.input.context, signal: new AbortController().signal }));
    }
    case "cache-protection": return start((await import("../knowledge/cache-protection.js")).authenticateCacheProtectionSources, task.input);
    case "analyze-collected": return start((await import("@projector/analyzers")).analyzeCollectedLocalRepository, task.input.collected, derivedBudget);
    case "authenticate-impact": return start((await import("../impact/service.js")).authenticateRepositoryImpactSource, task.input.source, task.input.reference);
    case "prepare-impact": {
      const { KnowledgeGraph } = await import("../knowledge/graph.js");
      const { buildRepositoryImpactSnapshot, predictRepositoryImpact } = await import("../impact/service.js");
      return start(async () => {
        const graph = new KnowledgeGraph(task.input.observation, {}, derivedBudget);
        const baseline = buildRepositoryImpactSnapshot(task.input.observation, graph);
        const prediction = await predictRepositoryImpact(baseline, task.input.editedPaths, task.input.canonicalChanges, derivedBudget);
        const affected = new Set(task.input.affectedUnitIds);
        const governanceMemberships: { lensId: string; unitId: string; path: string }[] = [];
        const units = new Map(graph.units.map((unit) => [unit.id, unit]));
        for (const lens of graph.lenses) {
          if (lens.status !== "active") continue;
          for (const unitId of graph.lensCompilation?.memberships[lens.id] ?? []) {
            if (!affected.has(unitId)) continue;
            derivedBudget.reserveItems(1, 128, "governance-membership", lens.id);
            governanceMemberships.push({ lensId: lens.id, unitId, path: units.get(unitId)!.key });
          }
        }
        governanceMemberships.sort((a, b) => a.lensId < b.lensId ? -1 : a.lensId > b.lensId ? 1 : a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0);
        return { baseline, prediction, governanceMemberships };
      });
    }
    case "coverage": return start((await import("../coverage/service.js")).computeRepositoryCoverage, task.input.observation, task.input.request, task.input.mode, host, task.input.now, derivedBudget);
    case "architecture": return start((await import("../knowledge/architecture-inspection.js")).computeRepositoryArchitecture, task.input.observation, host, task.input.now, derivedBudget);
    case "hash-content": return start(() => hashFramedDomain("transform-content", task.input.content));
    case "authenticate-context": return start((await import("../knowledge/store.js")).authenticateKnowledgeContextSource, task.input.source);
    case "decision-baseline-data": return start((await import("../knowledge/decision-baseline-data.js")).executeDecisionBaselineData, task.input);
    case "knowledge-context": return start((await import("../knowledge/service.js")).RepositoryKnowledgeService.computeContext, task.input.request, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...(task.input.acceptedDecisionBaselines === undefined ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines }) }, host, derivedBudget);
    case "knowledge-reconcile": return start((await import("../knowledge/service.js")).RepositoryKnowledgeService.computeReconciliation, task.input.retained, task.input.observation, { now: () => task.input.now, readDecisionBaseline: host.baseline, ...(task.input.acceptedDecisionBaselines === undefined ? {} : { acceptedDecisionBaselines: task.input.acceptedDecisionBaselines }) }, host, derivedBudget);
    case "canonical": return start((await import("@projector/runtime")).parseCanonicalSnapshotSources, task.input.sources, derivedBudget);
    case "observe": {
      const { analyzeCollectedLocalRepository } = await import("@projector/analyzers");
      const { parseCanonicalSnapshotSources } = await import("@projector/runtime");
      const { realizeChangeRepositoryData } = await import("../change-lifecycle/repository-observer.js");
      return start(() => realizeChangeRepositoryData(task.input.collected.options.repositoryRoot, analyzeCollectedLocalRepository(task.input.collected, derivedBudget), parseCanonicalSnapshotSources(task.input.canonicalSources, derivedBudget), derivedBudget));
    }
    case "build-impact": {
      const { KnowledgeGraph } = await import("../knowledge/graph.js");
      const { buildRepositoryImpactSnapshot } = await import("../impact/service.js");
      return start(() => buildRepositoryImpactSnapshot(task.input.observation, new KnowledgeGraph(task.input.observation, {}, derivedBudget)));
    }
    case "predict-impact": return start((await import("../impact/service.js")).predictRepositoryImpact, task.input.snapshot, task.input.editedPaths, task.input.canonicalChanges, derivedBudget);
    case "reconcile-impact": return start((await import("../impact/service.js")).reconcileRepositoryImpact, task.input.before, task.input.after, task.input.predictedUnitIds, task.input.planId, task.input.predictedPaths, task.input.hasPrediction, derivedBudget);
    default: throw new Error("Unsupported observation worker task; rebuild the installed runtime together with its caller");
  }
}
async function run(request: WorkerTaskRequest): Promise<void> {
  try {
    if (busy) throw new Error("Observation worker received overlapping tasks");
    busy = true;
    deadline = request.deadline;
    maxDerivedBytes = request.maxDerivedBytes;
    if (Date.now() >= deadline) throw new ObservationError("observation-limit-exceeded", "worker", ".", "Observation deadline exceeded before analysis", "timeoutMs");
    const result = await execute(request.task, new DerivedObservationBudget(maxDerivedBytes));
    assertBoundedObservationData(result, maxDerivedBytes, deadline);
    parentPort!.postMessage({ ok: true, result });
  } catch (error) {
    const failure = error as { message?: string; name?: string; code?: string; stage?: string; scope?: string };
    parentPort!.postMessage({ ok: false, error: { message: failure.message ?? String(error), name: failure.name, code: failure.code, stage: failure.stage, scope: failure.scope } });
  } finally { busy = false; }
}
