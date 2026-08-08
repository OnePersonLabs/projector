import { hashFramedDomain, type ContentHash, type StateBinding, type StateDigest } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { InMemoryCleanupPlanStore, createCleanupPlan, resumeCleanupPlan } from "./cleanup.js";
import { computeCoverageQualityMetrics } from "./metrics.js";

const hash = (value: string): ContentHash => hashFramedDomain("cleanup-test", value);
const state: StateDigest = { gitBase: "base", worktreeDigest: hash("w"), canonicalProjectorDigest: hash("c"), toolchainDigest: hash("t") };
const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
const context = { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal };

describe("resumable cleanup and metrics", () => {
  it("uses trusted selector/progress ports, persists budget interruption, and does not mint no-op revisions", async () => {
    const initial = createCleanupPlan({ key: "cleanup:api", revision: 1, boundState: binding, frontierIds: ["frontier:a"], completedWorkIds: [], remainingWork: [{ id: "work:a", tokenCost: 5, monetaryCost: 1 }, { id: "work:b", tokenCost: 5, monetaryCost: 1 }], checkpoints: [], assumptions: [], externalActions: [], recommendedNextChunk: "work:a" });
    const store = new InMemoryCleanupPlanStore(); await store.compareAndStore(undefined, initial);
    const runChunk = vi.fn(async (ids: readonly string[]) => ({ completedWorkIds: [...ids], externalActions: [] }));
    const result = await resumeCleanupPlan({ selector: "cleanup:api", currentState: state, context, budget: { tokens: 5, cost: 2 } }, { store, bindingValidator: { validate: async () => ({ status: "current" as const, currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, progress: { authenticate: async () => ({ completedWorkIds: [], remainingWorkIds: ["work:a", "work:b"], boundDependencyDigest: binding.dependencyDigest }) }, runChunk });
    expect(result).toMatchObject({ budgetExhausted: true, continuationPersisted: true });
    expect(result.plan.revision).toBe(2);
    const noOp = await resumeCleanupPlan({ selector: result.plan.id, currentState: state, context, budget: { tokens: 5, cost: 2 } }, { store, bindingValidator: { validate: async () => ({ status: "current" as const, currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, progress: { authenticate: async () => ({ completedWorkIds: ["work:a", "work:b"], remainingWorkIds: [], boundDependencyDigest: result.plan.boundState.dependencyDigest }) }, runChunk });
    expect(noOp).toMatchObject({ kind: "no-op", plan: { revision: 2 } });
    expect(runChunk).toHaveBeenCalledTimes(1);
  });

  it("fails closed for missing/ambiguous selectors and reports unavailable metrics without denominators", async () => {
    const store = new InMemoryCleanupPlanStore();
    await expect(resumeCleanupPlan({ selector: "missing", currentState: state, context, budget: { tokens: 1, cost: 1 } }, { store, bindingValidator: {} as never, progress: {} as never, runChunk: async () => ({ completedWorkIds: [], externalActions: [] }) })).rejects.toThrow(/missing|selector/iu);
    const metrics = computeCoverageQualityMetrics({ relevance: { retrievedIds: ["a"] }, planning: { predictedIds: ["a"], surpriseDispositions: [] }, analyzers: { failureCount: 1, observationCount: 4 } });
    expect(metrics.relevanceRecall.availability).toBe("unavailable");
    expect(metrics.planningSurpriseRate.availability).toBe("unavailable");
    expect(metrics.analyzerFailureRate).toMatchObject({ numerator: 1, denominator: 4, value: 0.25 });
  });

  it("does not mint a lightweight rebind revision when authenticated work is already complete", async () => {
    const initial = createCleanupPlan({ key: "cleanup:done", revision: 1, boundState: binding, frontierIds: [], completedWorkIds: ["work:a"], remainingWork: [], checkpoints: [], assumptions: [], externalActions: [], recommendedNextChunk: "done" });
    const store = new InMemoryCleanupPlanStore(); await store.compareAndStore(undefined, initial); const cas = vi.spyOn(store, "compareAndStore");
    const result = await resumeCleanupPlan({ selector: initial.id, currentState: state, context, budget: { tokens: 1, cost: 1 } }, { store, bindingValidator: { validate: async () => ({ status: "rebound" as const, currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [], rebound: binding }) }, progress: { authenticate: async () => ({ completedWorkIds: ["work:a"], remainingWorkIds: [], boundDependencyDigest: binding.dependencyDigest }) }, runChunk: async () => ({ completedWorkIds: [], externalActions: [] }) });
    expect(result).toMatchObject({ kind: "no-op", plan: { revision: 1 } });
    expect(cas).not.toHaveBeenCalled();
  });
});
