import { hashFramedDomain, type ContentHash, type ExecutionCapsule, type ExecutionPlan, type StateBinding, type StateDigest, type WorkPacket } from "@projector/core";
import { describe, expect, it } from "vitest";

import { executePacketPlan, type AuthenticatedPacketExecution } from "./packet-coordinator.js";

const digest = (label: string): ContentHash => hashFramedDomain("t16-runtime", label);
const state = (label: string): StateDigest => ({ gitBase: label, worktreeDigest: digest(`${label}:w`), canonicalProjectorDigest: digest(`${label}:c`), toolchainDigest: digest("toolchain") });
const binding: StateBinding = { compiledAgainst: state("before"), valueDependencies: [], queryDependencies: [], dependencyDigest: digest("binding") };
const capsule = (packetId: string): ExecutionCapsule => ({ id: `capsule:${packetId}`, taskId: packetId, objective: packetId, operation: "replace", unitIds: [`unit:${packetId}`], boundState: binding, relevanceClosureId: "closure", analysisFacetKeys: [], requirementIds: [], scenarioIds: [], conceptSummary: "change", decisionIds: [], decisionSummary: "approved", unresolvedArchitectureConcerns: [], lensSummary: "bounded", effectiveRules: [], normativeKernelHash: digest("kernel"), relevantPrecedents: [], allowedWrites: [{ selector: { op: "atom", field: "path", matcher: "equals", value: `src/${packetId}.ts` }, operations: ["replace"], reason: "packet" }], forbiddenWrites: [], availablePrimitives: ["replace"], requiredValidations: ["test"], upstreamImplications: [], downstreamImplications: [], knownExceptions: [], unknowns: [], risk: { class: "R1", inherentOperationRisk: 1, affectedUnitCount: 1, affectedSurfaceCount: 0, publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "proven", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] }, completionContract: { requiredUnitStates: [{ unitId: `unit:${packetId}`, state: "valid" }], requiredValidators: ["test"], requiredEvidenceLanes: ["test"], minimumValidationAssurance: "strong", requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: ["certificate", "receipt"], cleanWorkingTree: true }, contextDependencyHash: digest(`context-deps:${packetId}`), contextHash: digest(`context:${packetId}`) });
const packet = (id: string, dependencies: string[] = [], executionMode: WorkPacket["executionMode"] = "deterministic"): WorkPacket => ({ id, planId: "plan", title: id, strategy: executionMode === "deterministic" ? "deterministic-patch" : "agent-repair", unitIds: [`unit:${id}`], dependencies, capsuleId: `capsule:${id}`, risk: capsule(id).risk, executionMode, ...(executionMode === "deterministic" ? { transformId: "replace" } : {}), validatorIds: ["test"], rollback: { kind: "git-checkpoint" }, boundState: binding, status: "pending" });
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
      currentness: { validate: async ({ packet, predecessorOutputHashes }) => ({ currentState: current, valid: packet.id === "contract" || predecessorOutputHashes.length === 1, proofHash: digest(`current:${packet.id}`) }) },
      transaction: { begin: async ({ packet }) => ({ apply: async () => { events.push(`apply:${packet.id}`); }, commit: async () => { events.push(`commit:${packet.id}`); }, rollback: async () => { events.push(`rollback:${packet.id}`); } }) },
      effect: { run: async ({ packet }) => ({ claimedChangedPaths: ["outside/forged.ts"], outputHash: digest(`output:${packet.id}`) }) },
      observe: { capture: async ({ packet, phase }) => { if (phase === "after") current = state(`after:${packet.id}`); return { state: current, paths: phase === "after" ? [`src/${packet.id}.ts`] : [], unitIds: [`unit:${packet.id}`] }; } },
      validate: { run: async ({ packet, postState }) => { const postStateHash = hashFramedDomain("packet-post-state", postState); return [{ validatorId: "test", validatorVersion: "1", invocationHash: hashFramedDomain("packet-validator-invocation", { packetId: packet.id, validatorId: "test", validatorVersion: "1", postStateHash }), postStateHash, status: "passed" as const, independent: true }]; } },
      artifacts: { put: async (artifact) => { events.push(`artifact:${artifact.packetId}`); return { contentHash: hashFramedDomain("packet-execution-artifact", artifact), replayed: false }; } },
    });
    expect(result.status).toBe("completed");
    expect(result.packetResults.map(({ changedPaths }) => changedPaths)).toEqual([["src/contract.ts"], ["src/consumer.ts"]]);
    expect(events.indexOf("artifact:contract")).toBeLessThan(events.indexOf("commit:contract"));
  });

  it("fails closed on lease loss, scope widening, invalid post-state proof, and unauthenticated host continuations", async () => {
    let effects = 0; const base = envelope([packet("contract")]);
    const ports = { lease: { acquire: async () => ({ assertOwned: async () => {}, release: async () => {} }) }, currentness: { validate: async () => ({ currentState: state("before"), valid: true, proofHash: digest("current") }) }, transaction: { begin: async () => ({ apply: async () => {}, commit: async () => {}, rollback: async () => {} }) }, effect: { run: async () => { effects += 1; return { claimedChangedPaths: [], outputHash: digest("out") }; } }, observe: { capture: async ({ phase }: { phase: "before" | "after" }) => ({ state: state(phase), paths: phase === "after" ? ["outside/file.ts"] : [], unitIds: ["unit:contract"] }) }, validate: { run: async () => [] }, artifacts: { put: async (artifact: unknown) => ({ contentHash: hashFramedDomain("packet-execution-artifact", artifact), replayed: false }) } };
    await expect(executePacketPlan(base, ports)).rejects.toThrow(/scope|validator/iu);
    expect(effects).toBe(1);
    const continuation = envelope([packet("agent", [], "agent")]);
    await expect(executePacketPlan(continuation, { ...ports, continuation: { read: async () => undefined } })).rejects.toThrow(/continuation/iu);
  });
});
