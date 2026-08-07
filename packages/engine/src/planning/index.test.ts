import { describe, expect, it } from "vitest";

import { hashFramedDomain, type CompletionContract, type StateBinding, type ValidatorBinding } from "@projector/core";

import {
  PlanningClaimConflictError,
  createExecutionCapsule,
  createExecutionPlan,
  normalizeValidationSet,
  orderPlannedTransforms,
} from "./index.js";

const state = {
  gitBase: "base",
  worktreeDigest: hashFramedDomain("test", "worktree"),
  canonicalProjectorDigest: hashFramedDomain("test", "canonical"),
  toolchainDigest: hashFramedDomain("test", "toolchain"),
};

const binding: StateBinding = {
  compiledAgainst: state,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }),
};

const completion: CompletionContract = {
  requiredUnitStates: [{ unitId: "unit:source", state: "valid" }],
  requiredValidators: ["test", "schema", "test"],
  requiredEvidenceLanes: ["test", "schema", "test"],
  minimumValidationAssurance: "strong",
  requireIndependentValidation: true,
  maximumNewDivergences: 0,
  maximumUnknowns: 0,
  allowUnavailableExternalActions: false,
  requiredArtifacts: ["certificate", "receipt", "certificate"],
  cleanWorkingTree: true,
};

describe("minimal execution planning", () => {
  it("creates a deeply immutable, deterministically normalized plan bound to the global state digest", () => {
    const plan = createExecutionPlan({
      id: "plan:move",
      revision: 1,
      sourceRunId: "run:1",
      boundState: binding,
      boundary: ["scripts/**", "package.json", "scripts/**"],
      assumptions: ["package scripts are closed", "package scripts are closed"],
      knownAffectedUnitIds: ["unit:test", "unit:source"],
      possibleFrontierUnitIds: [],
      unavailableSurfaceIds: [],
      packetIds: ["packet:move"],
      checkpoints: [{
        id: "checkpoint:move",
        afterPacketIds: ["packet:move"],
        requiredValidators: ["test", "schema", "test"],
        rollback: { kind: "git-checkpoint", checkpointId: "before-move" },
      }],
      completionCriteria: completion,
    });

    expect(plan.boundState.compiledAgainst).toEqual(state);
    expect(plan.boundary).toEqual(["package.json", "scripts/**"]);
    expect(plan.knownAffectedUnitIds).toEqual(["unit:source", "unit:test"]);
    expect(plan.completionCriteria.requiredValidators).toEqual(["schema", "test"]);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.boundState)).toBe(true);
    expect(() => plan.boundary.push("outside/**")).toThrow();
  });

  it("addresses an immutable capsule independently of unordered context input", () => {
    const capsuleInput = {
      id: "capsule:move",
      taskId: "task:move",
      objective: "move misplaced repository automation",
      operation: "move-reference-update",
      unitIds: ["unit:test", "unit:source"],
      boundState: binding,
      relevanceClosureId: "closure:1",
      analysisFacetKeys: ["placement", "architecture"],
      requirementIds: [], scenarioIds: [],
      conceptSummary: "Repository automation belongs under scripts.",
      decisionIds: [], decisionSummary: "",
      unresolvedArchitectureConcerns: [], lensSummary: "repository script lens",
      effectiveRules: [],
      normativeKernelHash: hashFramedDomain("test", "kernel"),
      relevantPrecedents: [], allowedWrites: [], forbiddenWrites: [],
      availablePrimitives: ["validate", "move artifact"],
      requiredValidations: ["test", "schema"],
      upstreamImplications: [], downstreamImplications: [], knownExceptions: [], unknowns: [],
      risk: {
        class: "R1" as const, inherentOperationRisk: 1, affectedUnitCount: 2, affectedSurfaceCount: 1,
        publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full" as const,
        validationStrength: "strong" as const, closureConfidence: "bounded" as const,
        unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false,
        unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [],
      },
      completionContract: completion,
    };
    const left = createExecutionCapsule(capsuleInput);
    const right = createExecutionCapsule({
      ...capsuleInput,
      unitIds: [...capsuleInput.unitIds].reverse(),
      analysisFacetKeys: [...capsuleInput.analysisFacetKeys].reverse(),
      availablePrimitives: [...capsuleInput.availablePrimitives].reverse(),
      requiredValidations: [...capsuleInput.requiredValidations].reverse(),
    });

    expect(left.contextHash).toBe(right.contextHash);
    expect(left.contextDependencyHash).toBe(right.contextDependencyHash);
    expect(left.contextDependencyHash).not.toBe(left.boundState.compiledAgainst.worktreeDigest);
    expect(Object.isFrozen(left.completionContract.requiredArtifacts)).toBe(true);
  });

  it("normalizes validation bindings and refuses conflicting definitions", () => {
    const validators: ValidatorBinding[] = [
      { id: "test", version: "1", provider: "command", input: { argv: ["pnpm", "test"] }, required: true },
      { id: "schema", version: "1", provider: "builtin", input: {}, required: true },
      { id: "test", version: "1", provider: "command", input: { argv: ["pnpm", "test"] }, required: true },
    ];
    expect(normalizeValidationSet(validators).map((validator) => validator.id)).toEqual(["schema", "test"]);
    expect(() => normalizeValidationSet([
      ...validators,
      { id: "test", version: "1", provider: "other", input: {}, required: true },
    ])).toThrow(/conflicting validator/u);
  });

  it("orders source transforms before generated transforms and rejects overlapping exclusive claims", () => {
    expect(orderPlannedTransforms([
      { id: "generated", provenance: "generated", predecessors: [], unitIds: ["unit:generated"], exclusiveUnitClaim: true },
      { id: "source", provenance: "source", predecessors: [], unitIds: ["unit:source"], exclusiveUnitClaim: true },
    ]).map((transform) => transform.id)).toEqual(["source", "generated"]);

    expect(() => orderPlannedTransforms([
      { id: "left", provenance: "source", predecessors: [], unitIds: ["unit:same"], exclusiveUnitClaim: true },
      { id: "right", provenance: "source", predecessors: [], unitIds: ["unit:same"], exclusiveUnitClaim: true },
    ])).toThrow(PlanningClaimConflictError);
  });
});
