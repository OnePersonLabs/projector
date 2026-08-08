import { hashFramedDomain, type CompletionContract, type RiskAssessment, type SemanticChange, type StateDigest } from "@projector/core";
import { describe, expect, it } from "vitest";

import { createStateBinding } from "../state/index.js";
import { compileSemanticChangePlan, type AuthenticatedPacketProposalSet, type ChangePacketProposal } from "./change-plan.js";

const state: StateDigest = { gitBase: "base", worktreeDigest: hashFramedDomain("t16-plan", "w"), canonicalProjectorDigest: hashFramedDomain("t16-plan", "c"), toolchainDigest: hashFramedDomain("t16-plan", "t") };
const binding = createStateBinding({ compiledAgainst: state, valueDependencies: [], queryDependencies: [] });
const risk: RiskAssessment = { class: "R1", inherentOperationRisk: 1, affectedUnitCount: 2, affectedSurfaceCount: 1, publicContractImpact: true, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "bounded", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] };
const change: SemanticChange = { id: "change:contract", request: "update event contract", normalizedIntent: "update event contract", intentAnalysisId: "intent:contract", identityResolutionIds: ["identity:contract"], relevanceClosureId: "relevance:contract", analysisFacetKeys: ["public-contract"], operations: [{ subjectType: "other", subjectKey: "event-contract", kind: "modify", payload: {} }], decisionIds: [], assumptions: [], boundary: ["packages/api", "packages/client"], predictedImpact: { contentHash: hashFramedDomain("impact", "contract"), knownAffectedUnitIds: ["unit:contract", "unit:consumer"], possibleFrontierUnitIds: [], unavailableSurfaceIds: [] }, risk, status: "analyzed" };
const completion: CompletionContract = { requiredUnitStates: [{ unitId: "unit:contract", state: "valid" }, { unitId: "unit:consumer", state: "valid" }], requiredValidators: ["test"], requiredEvidenceLanes: ["test"], minimumValidationAssurance: "strong", requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: ["certificate", "receipt"], cleanWorkingTree: true };
const baseProposals: ChangePacketProposal[] = [{ key: "consumer", title: "update consumer", stage: "consumer", executionMode: "deterministic", transformId: "update-consumer", unitIds: ["unit:consumer"], semanticOwnerIds: ["concept:consumer"], writeSelectors: ["packages/client/**"], dependencies: [], validatorIds: ["test"] }, { key: "contract", title: "update contract", stage: "contract", executionMode: "deterministic", transformId: "update-contract", unitIds: ["unit:contract"], semanticOwnerIds: ["concept:contract"], writeSelectors: ["packages/api/**"], dependencies: [], validatorIds: ["test"] }];
function proposalSet(proposals: readonly ChangePacketProposal[] = baseProposals): AuthenticatedPacketProposalSet { const value = { proposals, completionContract: completion }; return { value, contentHash: hashFramedDomain("authenticated-change-packet-proposals", value) }; }
const changePort = { read: async () => { const value = { change, boundState: binding, compilerFactsHash: hashFramedDomain("facts", "contract") }; return { value, contentHash: hashFramedDomain("authenticated-change-planning-input", value) }; } };

describe("impact-aware semantic change plan compiler", () => {
  it("orders contracts before consumers deterministically and binds immutable packets/capsules", async () => {
    const first = await compileSemanticChangePlan({ changeId: change.id, revision: 1, sourceRunId: "run:1" }, { changes: changePort, packets: { compile: async () => proposalSet() } });
    const reordered = await compileSemanticChangePlan({ changeId: change.id, revision: 1, sourceRunId: "run:1" }, { changes: changePort, packets: { compile: async () => proposalSet([...baseProposals].reverse()) } });
    expect(first.executionOrder.map(({ key }) => key)).toEqual(["contract", "consumer"]);
    expect(first.plan).toEqual(reordered.plan); expect(first.packetHash).toBe(reordered.packetHash);
    expect(first.packets.every(({ packet, capsule }) => packet.capsuleId === capsule.id && packet.boundState.dependencyDigest === binding.dependencyDigest)).toBe(true);
  });

  it("rejects semantic/write overlap and undeclared or nonconvergent SCCs before execution", async () => {
    const overlap = [{ ...baseProposals[0]!, writeSelectors: ["packages/shared/**"] }, { ...baseProposals[1]!, writeSelectors: ["packages/shared/file.ts"] }];
    await expect(compileSemanticChangePlan({ changeId: change.id, revision: 1, sourceRunId: "run:1" }, { changes: changePort, packets: { compile: async () => proposalSet(overlap) } })).rejects.toThrow(/overlap|write/iu);
    const cycle = [{ ...baseProposals[0]!, dependencies: ["contract"] }, { ...baseProposals[1]!, dependencies: ["consumer"] }];
    await expect(compileSemanticChangePlan({ changeId: change.id, revision: 1, sourceRunId: "run:1" }, { changes: changePort, packets: { compile: async () => proposalSet(cycle) } })).rejects.toThrow(/cycle|convergen/iu);
    const nonconvergent = cycle.map((item) => ({ ...item, convergence: { group: "contract-cycle", maximumIterations: 0 } }));
    await expect(compileSemanticChangePlan({ changeId: change.id, revision: 1, sourceRunId: "run:1" }, { changes: changePort, packets: { compile: async () => proposalSet(nonconvergent) } })).rejects.toThrow(/convergen|iteration/iu);
  });
});
