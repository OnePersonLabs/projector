import { describe, expect, it } from "vitest";
import { hashFramedDomain, type ExecutionPlan, type StateBindingValidation } from "@projector/core";
import { createExecutionPlan } from "./index.js";
import { InMemoryPlanRevisionStore, rebaseExecutionPlan } from "./revisions.js";

const digest = (name: string) => ({ gitBase: name, worktreeDigest: hashFramedDomain("test", `${name}:w`), canonicalProjectorDigest: hashFramedDomain("test", `${name}:c`), toolchainDigest: hashFramedDomain("test", "tool") });
const binding = (name: string) => ({ compiledAgainst: digest(name), valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) });
const completion = { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "strong" as const, requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: true };
const plan = (): Readonly<ExecutionPlan> => createExecutionPlan({ id: "plan:1", revision: 1, sourceRunId: "run:1", boundState: binding("old"), boundary: ["src/**"], assumptions: ["closed consumers"], knownAffectedUnitIds: ["unit:a"], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: ["packet:a", "packet:b"], checkpoints: [], completionCriteria: completion });
const packetHash = (id: string) => hashFramedDomain("execution-packet", id);
const capsuleProof = (packetId: string, capsuleId: string, stateName: string, approvalIds: string[] = []) => {
  const proof = { packetId, packetHash: packetHash(packetId), capsuleId, boundState: binding(stateName), approvalIds };
  return { ...proof, capsuleHash: hashFramedDomain("rebase-capsule-proof", proof) };
};
const originalPacketHashes = [{ packetId: "packet:a", packetHash: packetHash("packet:a") }, { packetId: "packet:b", packetHash: packetHash("packet:b") }];
const authenticateOriginalPacketHash = async (packetId: string, hash: string) => hash === packetHash(packetId);
const oldCapsules = () => [
  capsuleProof("packet:a", "capsule:a", "old", ["approval:a"]),
  capsuleProof("packet:b", "capsule:b", "old", ["approval:b"]),
];
const completeRecompute = () => ({
  boundState: binding("new"), boundary: ["new/**"], packetIds: ["packet:c"], assumptions: ["new assumption"],
  relevanceClosureId: "closure:new", predictedImpactClosureHash: hashFramedDomain("test", "impact:new"),
  knownAffectedUnitIds: ["unit:new"], possibleFrontierUnitIds: ["unit:frontier"], unavailableSurfaceIds: ["surface:down"],
  checkpoints: [], completionCriteria: { ...completion, requiredArtifacts: ["artifact:new"] },
  packetHashes: [{ packetId: "packet:c", packetHash: packetHash("packet:c") }],
  recompiledCapsules: [capsuleProof("packet:c", "capsule:c", "new")],
});

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
      originalPacketHashes, authenticateOriginalPacketHash, capsuleInventory: oldCapsules(),
      recompile: async () => ({ ...completeRecompute(), packetIds: ["packet:a", "packet:c"], packetHashes: [{ packetId: "packet:a", packetHash: packetHash("packet:a") }, { packetId: "packet:c", packetHash: packetHash("packet:c") }], assumptions: ["recomputed consumers"], relevanceClosureId: "closure:2", predictedImpactClosureHash: hashFramedDomain("test", "impact:2"), recompiledCapsules: [capsuleProof("packet:a", "capsule:a2", "new"), capsuleProof("packet:c", "capsule:c", "new")] }),
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

  it("blocks an unavailable binding instead of carrying stale claims", async () => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "unavailable", currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: ["unavailable"] },
      completedPackets: ["packet:a"], isCompletedPacketCurrent: async () => true, recompile: async () => ({ boundState: binding("new") }),
    })).rejects.toThrow(/cannot be safely rebased/u);
  });

  it("refreshes suspect state only through the same complete semantic recomputation gate", async () => {
    const result = await rebaseExecutionPlan({
      original: plan(),
      validation: { status: "suspect", currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: ["uncertain"], reasons: ["widen"] },
      completedPackets: [], isCompletedPacketCurrent: async () => true,
      originalPacketHashes, authenticateOriginalPacketHash, capsuleInventory: oldCapsules(),
      recompile: async () => completeRecompute(),
    });
    expect(result.kind).toBe("semantic-rebase");
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
    expect(result.plan.knownAffectedUnitIds).toEqual(["unit:new"]);
  });

  it("rejects rebound and semantic outputs that remain compiled against stale state", async () => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "rebound", currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true, recompile: async () => ({}),
    })).rejects.toThrow(/rebound binding/u);
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true,
      originalPacketHashes, authenticateOriginalPacketHash, capsuleInventory: oldCapsules(), recompile: async () => ({ ...completeRecompute(), boundState: binding("old") }),
    })).rejects.toThrow(/current state/u);
  });

  it("requires complete semantic recomputation and invalidates every stale packet and capsule", async () => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true,
      originalPacketHashes, authenticateOriginalPacketHash, capsuleInventory: oldCapsules(),
      recompile: async () => ({ boundState: binding("new") }),
    })).rejects.toThrow(/complete semantic recomputation/u);
    const result = await rebaseExecutionPlan({
      original: plan(), validation: { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true,
      originalPacketHashes, authenticateOriginalPacketHash, capsuleInventory: oldCapsules(),
      recompile: async () => completeRecompute(),
    });
    expect(result.invalidatedPacketIds).toEqual(["packet:a", "packet:b"]);
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
  });

  it("replaces every scope and closure dependent field and requires explicit complete capsule inventories", async () => {
    const validation: StateBindingValidation = { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] };
    const result = await rebaseExecutionPlan({
      original: plan(), validation, completedPackets: [], isCompletedPacketCurrent: async () => true,
      originalPacketHashes, authenticateOriginalPacketHash, capsuleInventory: oldCapsules(),
      recompile: async () => completeRecompute(),
    });
    expect(result.plan).toMatchObject({
      boundary: ["new/**"], assumptions: ["new assumption"], knownAffectedUnitIds: ["unit:new"],
      possibleFrontierUnitIds: ["unit:frontier"], unavailableSurfaceIds: ["surface:down"], packetIds: ["packet:c"],
      completionCriteria: { requiredArtifacts: ["artifact:new"] },
    });
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
    expect(result.recompiledCapsuleIds).toEqual(["capsule:c"]);

    await expect(rebaseExecutionPlan({
      original: plan(), validation, completedPackets: [], isCompletedPacketCurrent: async () => true,
      recompile: async () => completeRecompute(),
    })).rejects.toThrow(/capsule inventory/u);
    await expect(rebaseExecutionPlan({
      original: plan(), validation, completedPackets: [], isCompletedPacketCurrent: async () => true, capsuleInventory: [],
      recompile: async () => {
        const { knownAffectedUnitIds: _omitted, ...incomplete } = completeRecompute();
        return incomplete;
      },
    })).rejects.toThrow(/complete semantic recomputation/u);
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

  it("cryptographically binds complete old and new capsule mappings to packets and state", async () => {
    const validation: StateBindingValidation = { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] };
    const valid = await rebaseExecutionPlan({
      original: plan(), validation, completedPackets: [], isCompletedPacketCurrent: async () => true,
      originalPacketHashes, authenticateOriginalPacketHash, capsuleInventory: oldCapsules(), recompile: async () => completeRecompute(),
    });
    expect(valid.invalidatedApprovalIds).toEqual(["approval:a", "approval:b"]);
    expect(valid.oldCapsuleMapping).toHaveLength(2);
    expect(valid.newCapsuleMapping).toHaveLength(1);

    const adversaries = [
      { originalPacketHashes, capsuleInventory: oldCapsules().slice(0, 1), recompile: async () => completeRecompute() },
      { originalPacketHashes: [], capsuleInventory: oldCapsules(), recompile: async () => completeRecompute() },
      { originalPacketHashes, capsuleInventory: [{ ...oldCapsules()[0]!, packetId: "packet:b" }, oldCapsules()[1]!], recompile: async () => completeRecompute() },
      { originalPacketHashes, capsuleInventory: [{ ...oldCapsules()[0]!, capsuleId: "capsule:b" }, oldCapsules()[1]!], recompile: async () => completeRecompute() },
      { originalPacketHashes, capsuleInventory: [{ ...oldCapsules()[0]!, boundState: binding("new") }, oldCapsules()[1]!], recompile: async () => completeRecompute() },
      { originalPacketHashes, capsuleInventory: oldCapsules(), recompile: async () => ({ ...completeRecompute(), recompiledCapsules: [{ ...completeRecompute().recompiledCapsules[0]!, boundState: binding("old") }] }) },
      { originalPacketHashes, capsuleInventory: oldCapsules(), recompile: async () => ({ ...completeRecompute(), recompiledCapsules: [{ ...completeRecompute().recompiledCapsules[0]!, packetHash: packetHash("lie") }] }) },
    ];
    for (const adversary of adversaries) {
      await expect(rebaseExecutionPlan({ original: plan(), validation, completedPackets: [], isCompletedPacketCurrent: async () => true, authenticateOriginalPacketHash, ...adversary }))
        .rejects.toThrow(/capsule|packet|state|inventory/u);
    }
    const falseHashes = originalPacketHashes.map(({ packetId }) => ({ packetId, packetHash: packetHash(`false:${packetId}`) }));
    const falseCapsules = falseHashes.map(({ packetId, packetHash: falseHash }, index) => {
      const proof = { packetId, packetHash: falseHash, capsuleId: `capsule:false:${index}`, boundState: binding("old"), approvalIds: [] };
      return { ...proof, capsuleHash: hashFramedDomain("rebase-capsule-proof", proof) };
    });
    await expect(rebaseExecutionPlan({
      original: plan(), validation, completedPackets: [], isCompletedPacketCurrent: async () => true, authenticateOriginalPacketHash,
      originalPacketHashes: falseHashes, capsuleInventory: falseCapsules, recompile: async () => completeRecompute(),
    })).rejects.toThrow(/authenticate|packet hash|proven/u);
  });

  it("accepts an explicit cryptographic proof that an original packet had no capsule and rejects an unproven claim", async () => {
    const validation: StateBindingValidation = { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["x"], changedQueryDependencyIds: [], reasons: [] };
    const packet = { packetId: "packet:b", packetHash: packetHash("packet:b") };
    const noCapsule = { ...packet, noCapsuleProof: hashFramedDomain("rebase-no-capsule-proof", packet) };
    const input = { original: plan(), validation, completedPackets: [], isCompletedPacketCurrent: async () => true, originalPacketHashes, authenticateOriginalPacketHash, recompile: async () => completeRecompute() };
    await expect(rebaseExecutionPlan({ ...input, capsuleInventory: [oldCapsules()[0]!, noCapsule] })).resolves.toMatchObject({ invalidatedCapsuleIds: ["capsule:a"] });
    await expect(rebaseExecutionPlan({ ...input, capsuleInventory: [oldCapsules()[0]!, { ...noCapsule, noCapsuleProof: hashFramedDomain("test", "lie") }] }))
      .rejects.toThrow(/no-capsule|proven/u);
  });
});
