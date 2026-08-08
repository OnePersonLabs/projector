import { describe, expect, it } from "vitest";
import { hashFramedDomain, type ExecutionPlan, type StateBindingValidation } from "@projector/core";
import { createExecutionPlan } from "./index.js";
import { InMemoryPlanRevisionStore, rebaseExecutionPlan, type CapsuleProof, type CapsuleInventoryEntry } from "./revisions.js";

const digest = (name: string) => ({ gitBase: name, worktreeDigest: hashFramedDomain("test", `${name}:w`), canonicalProjectorDigest: hashFramedDomain("test", `${name}:c`), toolchainDigest: hashFramedDomain("test", "tool") });
const binding = (name: string) => ({ compiledAgainst: digest(name), valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) });
const completion = { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "strong" as const, requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: true };
const plan = (): Readonly<ExecutionPlan> => createExecutionPlan({ id: "plan:1", revision: 1, sourceRunId: "run:1", boundState: binding("old"), boundary: ["src/**"], assumptions: ["closed consumers"], knownAffectedUnitIds: ["unit:a"], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: ["packet:a", "packet:b"], checkpoints: [], completionCriteria: completion });
const packetHash = (id: string) => hashFramedDomain("execution-packet", id);
const capsule = (packetId: string, capsuleId: string, stateName: string, approvalIds: string[] = []): CapsuleProof => ({
  packetId, packetHash: packetHash(packetId), capsuleId, capsuleContentHash: hashFramedDomain("capsule-content", capsuleId), boundState: binding(stateName), approvalIds,
});
const oldCapsules = (): CapsuleInventoryEntry[] => [
  { planId: "plan:1", ...capsule("packet:a", "capsule:a", "old", ["approval:a"]) },
  { planId: "plan:1", ...capsule("packet:b", "capsule:b", "old", ["approval:b"]) },
];
const replacements = (): CapsuleProof[] => [capsule("packet:c", "capsule:c", "new")];
const ports = (inventory = oldCapsules(), compiled = replacements()) => ({
  capsuleInventoryPort: { enumerateAuthenticated: async () => inventory },
  capsuleCompilerVerifier: { compileAndVerify: async () => compiled },
});
const recompute = () => ({
  boundState: binding("new"), boundary: ["new/**"], packetIds: ["packet:c"], assumptions: ["new assumption"],
  relevanceClosureId: "closure:new", predictedImpactClosureHash: hashFramedDomain("test", "impact:new"),
  knownAffectedUnitIds: ["unit:new"], possibleFrontierUnitIds: ["unit:frontier"], unavailableSurfaceIds: ["surface:down"],
  checkpoints: [], completionCriteria: { ...completion, requiredArtifacts: ["artifact:new"] },
});
const stale: StateBindingValidation = { status: "stale", currentState: digest("new"), changedValueDependencyIds: ["requirement:x"], changedQueryDependencyIds: ["consumers"], reasons: ["changed"] };

describe("immutable plan revision rebind and semantic rebase", () => {
  it("emits a deterministic lightweight rebind without recompiling semantic work", async () => {
    let recompiles = 0;
    const original = plan();
    const result = await rebaseExecutionPlan({
      original, validation: { status: "rebound", currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [], rebound: binding("new") },
      completedPackets: [], isCompletedPacketCurrent: async () => true, recompile: async () => { recompiles += 1; return {}; },
    });
    expect(result.kind).toBe("lightweight-rebind");
    expect(result.plan).toMatchObject({ revision: 2, supersedesPlanId: "plan:1", packetIds: ["packet:a", "packet:b"] });
    expect(recompiles).toBe(0);
  });

  it("semantically rebases complete fields and carries only independently current completion", async () => {
    const nextCapsules = [capsule("packet:a", "capsule:a2", "new"), capsule("packet:c", "capsule:c", "new")];
    const result = await rebaseExecutionPlan({
      original: plan(), validation: stale, completedPackets: ["packet:a", "packet:b"], isCompletedPacketCurrent: async (id) => id === "packet:a",
      ...ports(oldCapsules(), nextCapsules),
      recompile: async () => ({ ...recompute(), packetIds: ["packet:a", "packet:c"], assumptions: ["recomputed consumers"] }),
    });
    expect(result.kind).toBe("semantic-rebase");
    expect(result.carriedCompletedPacketIds).toEqual(["packet:a"]);
    expect(result.invalidatedPacketIds).toEqual(["packet:b"]);
    expect(result.plan).toMatchObject({ boundary: ["new/**"], packetIds: ["packet:a", "packet:c"], assumptions: ["recomputed consumers"], knownAffectedUnitIds: ["unit:new"] });
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
    expect(result.invalidatedApprovalIds).toEqual(["approval:a", "approval:b"]);
    expect(result.recompiledCapsuleIds).toEqual(["capsule:a2", "capsule:c"]);
  });

  it("stores isolated immutable revisions and blocks conflicting duplicate IDs", async () => {
    const store = new InMemoryPlanRevisionStore();
    const mutable = structuredClone(plan()) as ExecutionPlan;
    await store.put(mutable);
    (mutable.boundary as string[]).push("caller/**");
    const read = await store.get(mutable.id);
    expect(read?.boundary).toEqual(["src/**"]);
    expect(() => (read!.boundary as string[]).push("reader/**")).toThrow();
    await expect(store.put({ ...plan(), boundary: ["other/**"] })).rejects.toThrow(/different content/u);
  });

  it("blocks unavailable, stale-bound, and incomplete semantic refreshes", async () => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: { status: "rebound", currentState: digest("new"), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] },
      completedPackets: [], isCompletedPacketCurrent: async () => true, recompile: async () => ({}),
    })).rejects.toThrow(/rebound binding/u);
    await expect(rebaseExecutionPlan({ original: plan(), validation: { ...stale, status: "unavailable" }, completedPackets: [], isCompletedPacketCurrent: async () => true, recompile: async () => recompute() }))
      .rejects.toThrow(/cannot be safely rebased/u);
    await expect(rebaseExecutionPlan({ original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true, ...ports(), recompile: async () => ({ ...recompute(), boundState: binding("old") }) }))
      .rejects.toThrow(/current state/u);
    const { knownAffectedUnitIds: _omitted, ...incomplete } = recompute();
    await expect(rebaseExecutionPlan({ original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true, ...ports(), recompile: async () => incomplete }))
      .rejects.toThrow(/complete semantic recomputation/u);
  });

  it("routes suspect state through complete semantic recomputation and trusted capsule invalidation", async () => {
    const result = await rebaseExecutionPlan({
      original: plan(), validation: { ...stale, status: "suspect" }, completedPackets: [], isCompletedPacketCurrent: async () => true,
      ...ports(), recompile: async () => recompute(),
    });
    expect(result.kind).toBe("semantic-rebase");
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
    expect(result.plan.knownAffectedUnitIds).toEqual(["unit:new"]);
  });

  it("requires complete unique authenticated inventory from the trusted store", async () => {
    const adversaries: CapsuleInventoryEntry[][] = [
      oldCapsules().slice(0, 1),
      [{ ...oldCapsules()[0]!, planId: "plan:other" }, oldCapsules()[1]!],
      [{ ...oldCapsules()[0]!, packetId: "packet:b" }, oldCapsules()[1]!],
      [{ ...oldCapsules()[0]!, capsuleId: "capsule:b" }, oldCapsules()[1]!],
      [{ ...oldCapsules()[0]!, boundState: binding("new") }, oldCapsules()[1]!],
      [{ ...oldCapsules()[0]!, approvalIds: ["approval:same"] }, { ...oldCapsules()[1]!, approvalIds: ["approval:same"] }],
    ];
    for (const inventory of adversaries) {
      await expect(rebaseExecutionPlan({ original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true, ...ports(inventory), recompile: async () => recompute() }))
        .rejects.toThrow(/trusted|inventory|capsule|approval|plan|state/u);
    }
  });

  it("derives no-capsule absence only from trusted complete enumeration", async () => {
    const trustedAbsence: CapsuleInventoryEntry = { planId: "plan:1", packetId: "packet:b", packetHash: packetHash("packet:b") };
    const result = await rebaseExecutionPlan({
      original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      ...ports([oldCapsules()[0]!, trustedAbsence]), recompile: async () => recompute(),
    });
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a"]);
    expect(result.oldCapsuleMapping).toContainEqual(trustedAbsence);

    await expect(rebaseExecutionPlan({
      original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      recompile: async () => recompute(),
      capsuleInventory: [oldCapsules()[0]!, { packetId: "packet:b", packetHash: packetHash("packet:b"), noCapsuleProof: "caller-self-hash" }],
    } as Parameters<typeof rebaseExecutionPlan>[0] & Record<string, unknown>)).rejects.toThrow(/trusted.*inventory port/u);
  });

  it("ignores malicious caller inventory when the trusted store reveals a hidden capsule", async () => {
    const input = {
      original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      ...ports(), recompile: async () => recompute(),
      capsuleInventory: [{ planId: "plan:1", packetId: "packet:a", packetHash: packetHash("packet:a") }, { planId: "plan:1", packetId: "packet:b", packetHash: packetHash("packet:b") }],
    } as Parameters<typeof rebaseExecutionPlan>[0] & Record<string, unknown>;
    const result = await rebaseExecutionPlan(input);
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
    expect(result.invalidatedApprovalIds).toEqual(["approval:a", "approval:b"]);
  });

  it("accepts replacement capsules only from the separate trusted compiler/verifier", async () => {
    const result = await rebaseExecutionPlan({
      original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      ...ports(), recompile: async () => ({ ...recompute(), recompiledCapsules: [capsule("packet:c", "caller:forged", "new")] } as ReturnType<typeof recompute>),
    });
    expect(result.recompiledCapsuleIds).toEqual(["capsule:c"]);
    const badReplacements: CapsuleProof[][] = [
      [capsule("packet:c", "capsule:a", "new")],
      [capsule("packet:c", "capsule:c", "old")],
      [capsule("packet:wrong", "capsule:c", "new")],
      [{ ...capsule("packet:c", "capsule:c", "new"), capsuleContentHash: "" as CapsuleProof["capsuleContentHash"] }],
    ];
    for (const bad of badReplacements) {
      await expect(rebaseExecutionPlan({ original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true, ...ports(oldCapsules(), bad), recompile: async () => recompute() }))
        .rejects.toThrow(/capsule|packet|state|content hash/u);
    }
  });

  it("accepts authenticated nonempty-to-empty rebases and invalidates old capsules and approvals", async () => {
    const result = await rebaseExecutionPlan({
      original: plan(), validation: stale, completedPackets: ["packet:a"], isCompletedPacketCurrent: async () => true,
      ...ports(oldCapsules(), []), recompile: async () => ({ ...recompute(), packetIds: [] }),
    });

    expect(result.plan.packetIds).toEqual([]);
    expect(result.carriedCompletedPacketIds).toEqual([]);
    expect(result.invalidatedPacketIds).toEqual(["packet:a", "packet:b"]);
    expect(result.invalidatedCapsuleIds).toEqual(["capsule:a", "capsule:b"]);
    expect(result.invalidatedApprovalIds).toEqual(["approval:a", "approval:b"]);
    expect(result.recompiledCapsuleIds).toEqual([]);
    expect(result.newCapsuleMapping).toEqual([]);
  });

  it("accepts authenticated empty-to-empty rebases", async () => {
    const original = createExecutionPlan({ ...plan(), id: "plan:empty", packetIds: [] });
    const result = await rebaseExecutionPlan({
      original, validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      capsuleInventoryPort: { enumerateAuthenticated: async () => [] },
      capsuleCompilerVerifier: { compileAndVerify: async () => [] },
      recompile: async () => ({ ...recompute(), packetIds: [] }),
    });

    expect(result.plan.packetIds).toEqual([]);
    expect(result.oldCapsuleMapping).toEqual([]);
    expect(result.newCapsuleMapping).toEqual([]);
    expect(result.invalidatedPacketIds).toEqual([]);
    expect(result.invalidatedCapsuleIds).toEqual([]);
  });

  it("rejects empty packet or capsule proofs whenever the corresponding plan still has packets", async () => {
    await expect(rebaseExecutionPlan({
      original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      ...ports([], replacements()), recompile: async () => recompute(),
    })).rejects.toThrow(/inventory|packet|every original/u);
    await expect(rebaseExecutionPlan({
      original: plan(), validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      ...ports(oldCapsules(), []), recompile: async () => recompute(),
    })).rejects.toThrow(/packet|capsule|recompile/u);

    const emptyOriginal = createExecutionPlan({ ...plan(), id: "plan:empty", packetIds: [] });
    await expect(rebaseExecutionPlan({
      original: emptyOriginal, validation: stale, completedPackets: [], isCompletedPacketCurrent: async () => true,
      capsuleInventoryPort: { enumerateAuthenticated: async () => [{ ...oldCapsules()[0]!, planId: "plan:empty" }] },
      capsuleCompilerVerifier: { compileAndVerify: async () => [] },
      recompile: async () => ({ ...recompute(), packetIds: [] }),
    })).rejects.toThrow(/inventory|packet|original/u);
  });
});
