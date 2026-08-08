import { describe, expect, it } from "vitest";
import { hashFramedDomain, type ExecutionPlan, type StateBindingValidation } from "@projector/core";
import { createExecutionPlan } from "./index.js";
import { InMemoryPlanRevisionStore, rebaseExecutionPlan } from "./revisions.js";

const digest = (name: string) => ({ gitBase: name, worktreeDigest: hashFramedDomain("test", `${name}:w`), canonicalProjectorDigest: hashFramedDomain("test", `${name}:c`), toolchainDigest: hashFramedDomain("test", "tool") });
const binding = (name: string) => ({ compiledAgainst: digest(name), valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) });
const completion = { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "strong" as const, requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: true };
const plan = (): Readonly<ExecutionPlan> => createExecutionPlan({ id: "plan:1", revision: 1, sourceRunId: "run:1", boundState: binding("old"), boundary: ["src/**"], assumptions: ["closed consumers"], knownAffectedUnitIds: ["unit:a"], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: ["packet:a", "packet:b"], checkpoints: [], completionCriteria: completion });

describe("immutable plan revision rebind and semantic rebase", () => {
  it("emits a deterministic lightweight rebind without recompiling semantic work", async () => {
    const original = plan();
    let recompiles = 0;
    const validation: StateBindingValidation = { status: "rebound", currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [], rebound: binding("new") };
    const result = await rebaseExecutionPlan({ original, validation, completedPackets: [], isCompletedPacketCurrent: async () => true, recompile: async () => { recompiles += 1; return {}; } });
    expect(result.kind).toBe("lightweight-rebind");
    expect(result.plan.revision).toBe(2);
    expect(result.plan.supersedesPlanId).toBe(original.id);
    expect(result.plan.packetIds).toEqual(original.packetIds);
    expect(result.invalidatedApprovalPlanIds).toEqual([original.id]);
    expect(recompiles).toBe(0);
    expect(original.boundState.compiledAgainst.gitBase).toBe("old");
  });

  it("semantically rebases stale dependencies and carries only independently current completion", async () => {
    const original = plan();
    const validation: StateBindingValidation = { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["requirement:x"], changedQueryDependencyIds: ["consumers"], reasons: ["changed"] };
    const result = await rebaseExecutionPlan({
      original, validation, completedPackets: ["packet:a", "packet:b"],
      isCompletedPacketCurrent: async (id) => id === "packet:a",
      capsuleIdsByPacket: { "packet:a": "capsule:a", "packet:b": "capsule:b" },
      recompile: async () => ({ boundState: binding("new"), packetIds: ["packet:a", "packet:c"], assumptions: ["recomputed consumers"], relevanceClosureId: "closure:2", predictedImpactClosureHash: hashFramedDomain("test", "impact:2"), checkpoints: [], recompiledCapsuleIds: ["capsule:a2", "capsule:c"] }),
    });
    expect(result.kind).toBe("semantic-rebase");
    expect(result.carriedCompletedPacketIds).toEqual(["packet:a"]);
    expect(result.invalidatedPacketIds).toEqual(["packet:b"]);
    expect(result.plan.packetIds).toEqual(["packet:a", "packet:c"]);
    expect(result.plan.assumptions).toEqual(["recomputed consumers"]);
    expect(result.plan.relevanceClosureId).toBe("closure:2");
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
    expect(result.recompiledCapsuleIds).toEqual(["capsule:a2", "capsule:c"]);
  });

  it("stores immutable revisions and blocks duplicate IDs with different content", async () => {
    const store = new InMemoryPlanRevisionStore();
    const original = plan();
    await store.put(original);
    expect(() => (original.boundary as string[]).push("mutated/**")).toThrow();
    await expect(store.put({ ...original, boundary: ["other/**"] })).rejects.toThrow(/different content/u);
    expect(await store.get(original.id)).toEqual(original);
  });

  it.each(["suspect", "unavailable"] as const)("blocks a %s binding instead of carrying stale claims", async (status) => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status, currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [status] },
      completedPackets: ["packet:a"], isCompletedPacketCurrent: async () => true, recompile: async () => ({ boundState: binding("new") }),
    })).rejects.toThrow(/cannot be safely rebased/u);
  });

  it("rejects rebound and semantic outputs that remain compiled against stale state", async () => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "rebound", currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true, recompile: async () => ({}),
    })).rejects.toThrow(/rebound binding/u);
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true,
      recompile: async () => ({ boundState: binding("old"), packetIds: [], assumptions: [], relevanceClosureId: "closure:new", predictedImpactClosureHash: hashFramedDomain("test", "impact"), checkpoints: [], recompiledCapsuleIds: [] }),
    })).rejects.toThrow(/current state/u);
  });

  it("requires complete semantic recomputation and invalidates every stale packet and capsule", async () => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true,
      recompile: async () => ({ boundState: binding("new") }),
    })).rejects.toThrow(/complete semantic recomputation/u);
    const result = await rebaseExecutionPlan({
      original: plan(), validation: { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true,
      capsuleIdsByPacket: { "packet:a": "capsule:a", "packet:b": "capsule:b" },
      recompile: async () => ({ boundState: binding("new"), packetIds: ["packet:c"], assumptions: [], relevanceClosureId: "closure:new", predictedImpactClosureHash: hashFramedDomain("test", "impact"), checkpoints: [], recompiledCapsuleIds: ["capsule:c"] }),
    });
    expect(result.invalidatedPacketIds).toEqual(["packet:a", "packet:b"]);
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
  });

  it("isolates mutable caller objects on both store writes and reads", async () => {
    const store = new InMemoryPlanRevisionStore();
    const mutable = structuredClone(plan()) as ExecutionPlan;
    await store.put(mutable);
    (mutable.boundary as string[]).push("caller/**");
    const first = await store.get(mutable.id);
    expect(first?.boundary).toEqual(["src/**"]);
    expect(() => (first!.boundary as string[]).push("reader/**")).toThrow();
    expect((await store.get(mutable.id))?.boundary).toEqual(["src/**"]);
  });
});
