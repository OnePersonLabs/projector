import { hashFramedDomain, type ContentHash, type ExecutionCapsule, type ExecutionPlan, type StateBinding, type StateDigest, type WorkPacket } from "@projector/core";
import { describe, expect, it } from "vitest";

import { executePacketPlan, type AuthenticatedPacketExecution } from "./packet-coordinator.js";

const digest = (label: string): ContentHash => hashFramedDomain("t16-runtime", label);
const state = (label: string): StateDigest => ({ gitBase: label, worktreeDigest: digest(`${label}:w`), canonicalProjectorDigest: digest(`${label}:c`), toolchainDigest: digest("toolchain") });
const binding: StateBinding = { compiledAgainst: state("before"), valueDependencies: [], queryDependencies: [], dependencyDigest: digest("binding") };
const capsule = (packetId: string): ExecutionCapsule => ({ id: `capsule:${packetId}`, taskId: packetId, objective: packetId, operation: "replace", unitIds: [`unit:${packetId}`], boundState: binding, relevanceClosureId: "closure", analysisFacetKeys: [], requirementIds: [], scenarioIds: [], conceptSummary: "change", decisionIds: [], decisionSummary: "approved", unresolvedArchitectureConcerns: [], lensSummary: "bounded", effectiveRules: [], normativeKernelHash: digest("kernel"), relevantPrecedents: [], allowedWrites: [{ selector: { op: "atom", field: "path", matcher: "equals", value: `src/${packetId}.ts` }, operations: ["replace"], reason: "packet" }], forbiddenWrites: [], availablePrimitives: ["replace"], requiredValidations: ["test"], upstreamImplications: [], downstreamImplications: [], knownExceptions: [], unknowns: [], risk: { class: "R1", inherentOperationRisk: 1, affectedUnitCount: 1, affectedSurfaceCount: 0, publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "proven", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] }, completionContract: { requiredUnitStates: [{ unitId: `unit:${packetId}`, state: "valid" }], requiredValidators: ["test"], requiredEvidenceLanes: ["test"], minimumValidationAssurance: "strong", requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: ["certificate", "receipt"], cleanWorkingTree: true }, contextDependencyHash: digest(`context-deps:${packetId}`), contextHash: digest(`context:${packetId}`) });
const packet = (id: string, dependencies: string[] = [], executionMode: WorkPacket["executionMode"] = "deterministic"): WorkPacket => ({ id, planId: "plan", title: id, strategy: executionMode === "deterministic" ? "deterministic-patch" : "agent-repair", unitIds: [`unit:${id}`], dependencies, capsuleId: `capsule:${id}`, risk: capsule(id).risk, executionMode, ...(executionMode === "deterministic" ? { transformId: "replace" } : {}), validatorIds: ["test"], rollback: { kind: "git-checkpoint" }, boundState: binding, status: "pending" });
const observation = (packetId: string, phase: "before" | "after", path = `src/${packetId}.ts`) => { const value = { state: state(`${phase}:${packetId}`), pathContentHashes: { [path]: digest(`${phase}:${packetId}:content`) }, renames: [], deletedPaths: [], unitStates: { [`unit:${packetId}`]: "valid" as const }, canonicalEntityHashes: {}, externalStateHashes: {}, generatedArtifactHashes: {}, cleanWorkingTree: true, unknownCount: 0, divergenceCount: 0 }; return { value, contentHash: hashFramedDomain("authenticated-packet-observation", value) }; };
const validation = (packetId: string, postState: StateDigest) => { const postStateHash = hashFramedDomain("packet-post-state", postState); const provenance = { validatorId: "test", validatorVersion: "1", authorSource: "independent-validator", independenceGroup: "validation", evidenceLane: "test", assurance: "strong" as const }; const provenanceHash = hashFramedDomain("packet-validator-provenance", provenance); return { ...provenance, provenanceHash, invocationHash: hashFramedDomain("packet-validator-invocation", { packetId, validatorId: "test", validatorVersion: "1", postStateHash, provenanceHash }), postStateHash, status: "passed" as const }; };
const envelope = (packets: WorkPacket[]): AuthenticatedPacketExecution => {
  const plan: ExecutionPlan = { id: "plan", revision: 1, semanticChangeId: "change", sourceRunId: "run", boundState: binding, relevanceClosureId: "closure", boundary: ["src"], assumptions: [], knownAffectedUnitIds: packets.flatMap((item) => item.unitIds), possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: packets.map(({ id }) => id), checkpoints: packets.map(({ id }) => ({ id: `checkpoint:${id}`, afterPacketIds: [id], requiredValidators: ["test"], rollback: { kind: "git-checkpoint" } })), completionCriteria: capsule(packets[0]!.id).completionContract };
  const value = { plan, packets: packets.map((item) => ({ packet: item, capsule: capsule(item.id), packetHash: hashFramedDomain("semantic-change-work-packet", item), capsuleHash: hashFramedDomain("semantic-change-execution-capsule", capsule(item.id)) })), executionOrder: packets.map(({ id }) => id), approval: { planHash: hashFramedDomain("semantic-change-execution-plan", plan), approvedRiskClass: "R1" as const, authorityProofHash: digest("authority") } };
  return { value, contentHash: hashFramedDomain("authenticated-packet-execution", value) };
};

describe("packet execution coordinator", () => {
  it("authenticates packet-to-packet currentness and commits only after authoritative diff, validation, and durable artifacts", async () => {
    const events: string[] = []; let current = state("before"); const input = envelope([packet("contract"), packet("consumer", ["contract"])]);
    const result = await executePacketPlan(input, {
      lease: { acquire: async () => ({ assertOwned: async () => { events.push("lease"); }, release: async () => { events.push("release"); } }) },
      authority: { verify: async ({ subjectHash, risk }) => subjectHash === input.value.approval.planHash && risk === "R1" },
      currentness: { validate: async ({ packet, predecessorOutputHashes }) => ({ currentState: current, valid: packet.id === "contract" || predecessorOutputHashes.length === 1, proofHash: digest(`current:${packet.id}`) }) },
      transaction: { begin: async ({ packet }) => ({ apply: async () => { events.push(`apply:${packet.id}`); }, commit: async () => { events.push(`commit:${packet.id}`); }, rollback: async () => { events.push(`rollback:${packet.id}`); } }) },
      effect: { run: async ({ packet }) => ({ claimedChangedPaths: ["outside/forged.ts"], outputHash: digest(`output:${packet.id}`), authorSource: "transform" }) },
      observe: { capture: async ({ packet, phase }) => { const observed = observation(packet.id, phase); current = observed.value.state; return observed; } },
      validate: { run: async ({ packet, postState }) => [validation(packet.id, postState)] },
      artifacts: { put: async (artifact) => { events.push(`artifact:${artifact.status}:${artifact.packetId}`); return { contentHash: hashFramedDomain("packet-execution-artifact", artifact), replayed: false }; } },
    });
    expect(result.status).toBe("completed");
    expect(result.packetResults.map(({ changedPaths }) => changedPaths)).toEqual([["src/contract.ts"], ["src/consumer.ts"]]);
    expect(events.indexOf("artifact:intent:contract")).toBeLessThan(events.indexOf("commit:contract"));
    expect(result).toMatchObject({ certificateHash: expect.stringMatching(/^sha256:v1:/u), receiptHash: expect.stringMatching(/^sha256:v1:/u), reconciliation: { converged: true }, recovery: "not-required" });
  });

  it("fails closed on lease loss, scope widening, invalid post-state proof, and unauthenticated host continuations", async () => {
    let effects = 0; const base = envelope([packet("contract")]);
    const ports = { lease: { acquire: async () => ({ assertOwned: async () => {}, release: async () => {} }) }, authority: { verify: async () => true }, currentness: { validate: async () => ({ currentState: state("before"), valid: true, proofHash: digest("current") }) }, transaction: { begin: async () => ({ apply: async () => {}, commit: async () => {}, rollback: async () => {} }) }, effect: { run: async () => { effects += 1; return { claimedChangedPaths: [], outputHash: digest("out"), authorSource: "transform" }; } }, observe: { capture: async ({ phase }: { packet: WorkPacket; phase: "before" | "after" }) => observation("contract", phase, "outside/file.ts") }, validate: { run: async ({ packet, postState }: { packet: WorkPacket; postState: StateDigest }) => [validation(packet.id, postState)] }, artifacts: { put: async (artifact: unknown) => ({ contentHash: hashFramedDomain("packet-execution-artifact", artifact), replayed: false }) } };
    expect(await executePacketPlan(base, ports)).toMatchObject({ status: "partial", recovery: "rolled-back" });
    expect(effects).toBe(1);
    const continuation = envelope([packet("agent", [], "agent")]);
    await expect(executePacketPlan(continuation, { ...ports, continuation: { read: async () => undefined } })).rejects.toThrow(/continuation/iu);
  });

  it("detects same-path content mutation, rejects forged approval/independence, and replaces commit intent with failure truth", async () => {
    const input = envelope([packet("contract")]); const artifacts: Array<{ status: string }> = [];
    const common = { lease: { acquire: async () => ({ assertOwned: async () => {}, release: async () => {} }) }, authority: { verify: async () => true }, currentness: { validate: async () => ({ currentState: state("before"), valid: true, proofHash: digest("current") }) }, transaction: { begin: async () => ({ apply: async () => {}, commit: async () => { throw new Error("commit crashed"); }, rollback: async () => {} }) }, effect: { run: async () => ({ claimedChangedPaths: [], outputHash: digest("out"), authorSource: "transform" }) }, observe: { capture: async ({ packet, phase }: { packet: WorkPacket; phase: "before" | "after" }) => observation(packet.id, phase) }, validate: { run: async ({ packet, postState }: { packet: WorkPacket; postState: StateDigest }) => [validation(packet.id, postState)] }, artifacts: { put: async (artifact: { status: string }) => { artifacts.push(artifact); return { contentHash: hashFramedDomain("packet-execution-artifact", artifact), replayed: false }; } } };
    expect(await executePacketPlan(input, common)).toMatchObject({ status: "partial", recovery: "rolled-back" });
    expect(artifacts.map(({ status }) => status)).toEqual(["intent", "failure"]);
    expect(artifacts).not.toContainEqual(expect.objectContaining({ status: "success" }));
    let effectsRun = 0;
    await expect(executePacketPlan(input, { ...common, authority: { verify: async () => false }, effect: { run: async () => { effectsRun += 1; return { claimedChangedPaths: [], outputHash: digest("out") }; } } })).rejects.toThrow(/authority|approval/iu);
    expect(effectsRun).toBe(0);
  });

  it("executes a declared SCC to a bounded fixed point", async () => {
    const raw = envelope([packet("contract", ["consumer"]), packet("consumer", ["contract"])]);
    const value = { ...raw.value, packets: raw.value.packets.map((item) => ({ ...item, convergence: { group: "contract-cycle", maximumIterations: 3 } })) };
    const input = { value, contentHash: hashFramedDomain("authenticated-packet-execution", value) };
    const ports = { lease: { acquire: async () => ({ assertOwned: async () => {}, release: async () => {} }) }, authority: { verify: async () => true }, currentness: { validate: async () => ({ currentState: state("before"), valid: true, proofHash: digest("current") }) }, transaction: { begin: async () => ({ apply: async () => {}, commit: async () => {}, rollback: async () => {} }) }, effect: { run: async ({ packet }: { packet: WorkPacket }) => ({ claimedChangedPaths: [], outputHash: digest(`stable:${packet.id}`), authorSource: "transform" }) }, observe: { capture: async ({ packet, phase }: { packet: WorkPacket; phase: "before" | "after" }) => observation(packet.id, phase) }, validate: { run: async ({ packet, postState }: { packet: WorkPacket; postState: StateDigest }) => [validation(packet.id, postState)] }, artifacts: { put: async (artifact: unknown) => ({ contentHash: hashFramedDomain("packet-execution-artifact", artifact), replayed: false }) } };
    const result = await executePacketPlan(input, ports);
    expect(result).toMatchObject({ status: "completed", reconciliation: { converged: true, iterations: 2 } });
  });
});
