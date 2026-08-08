import { hashFramedDomain, type CompletionContract, type ExecutionPlan, type StateBinding } from "@projector/core";
import { createExecutionPlan } from "@projector/engine";
import { describe, expect, it, vi } from "vitest";

import { composeUpgradePlan } from "./upgrade.js";

const state = { gitBase: "base", worktreeDigest: hashFramedDomain("test", "worktree"), canonicalProjectorDigest: hashFramedDomain("test", "canonical"), toolchainDigest: hashFramedDomain("test", "toolchain") };
const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
const completion: CompletionContract = { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "supporting", requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: true };
const immutablePlan = (): Readonly<ExecutionPlan> => createExecutionPlan({ id: "plan:upgrade", revision: 1, semanticChangeId: "change:upgrade", sourceRunId: "run:upgrade", boundState: binding, boundary: [], assumptions: [], knownAffectedUnitIds: [], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: [], checkpoints: [], completionCriteria: completion });

describe("upgrade CLI composition", () => {
  it("returns the exact deeply immutable Task16 plan and rejects mutable or rebound compiler output", async () => {
    const compile = vi.fn().mockResolvedValue({ plan: immutablePlan(), packets: [], executionOrder: [], packetHash: hashFramedDomain("test", "packets") });
    const result = await composeUpgradePlan({ recommendationId: "upgrade:one", semanticChangeId: "change:upgrade", revision: 1, sourceRunId: "run:upgrade" }, { compile });
    expect(result).toMatchObject({ selector: "upgrade:plan:upgrade", packetCount: 0, plan: { semanticChangeId: "change:upgrade" } });
    expect(Object.isFrozen(result.plan.boundState)).toBe(true);
    const mutable = structuredClone(immutablePlan());
    await expect(composeUpgradePlan({ recommendationId: "upgrade:one", semanticChangeId: "change:upgrade", revision: 1, sourceRunId: "run:upgrade" }, { compile: async () => ({ plan: mutable, packets: [], executionOrder: [], packetHash: hashFramedDomain("test", "mutable") }) })).rejects.toThrow(/mutable/iu);
    await expect(composeUpgradePlan({ recommendationId: "upgrade:one", semanticChangeId: "change:other", revision: 1, sourceRunId: "run:upgrade" }, { compile })).rejects.toThrow(/outside|revision/iu);
  });
});
