import { describe, expect, it } from "vitest";

import { hashFramedDomain, type CompletionContract, type StateBinding, type ValidatorBinding } from "@projector/core";

import {
  PlanningClaimConflictError,
  PlanningDependencyCycleError,
  PlanningFixedPointError,
  convergePlannedTransforms,
  createExecutionCapsule,
  createExecutionPlan,
  normalizeValidationSet,
  orderPlannedTransforms,
  type PlanningTransformRegistry,
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

  it("derives normalized exclusive claims from registry metadata and orders sources first", () => {
    const registry: PlanningTransformRegistry = {
      getMetadata(id, version) {
        if (version !== "1") return undefined;
        return {
          predecessors: [],
          unitClaim: id === "shared" ? "shared" : "exclusive",
          convergence: { kind: "idempotent" },
        };
      },
    };
    expect(orderPlannedTransforms([
      { id: "generated", version: "1", provenance: "generated", unitIds: ["unit:generated"] },
      { id: "source", version: "1", provenance: "source", unitIds: ["unit:source", "unit:source"] },
    ], registry)).toEqual([
      { id: "source", version: "1", provenance: "source", unitIds: ["unit:source"] },
      { id: "generated", version: "1", provenance: "generated", unitIds: ["unit:generated"] },
    ]);

    const callerAttemptsToDisableClaims = [
      {
        id: "left", version: "1", provenance: "source", unitIds: ["unit:same", "unit:same"],
        exclusiveUnitClaim: false,
      },
      { id: "right", version: "1", provenance: "source", unitIds: ["unit:same"], exclusiveUnitClaim: false },
    ] as unknown as Parameters<typeof orderPlannedTransforms>[0];
    expect(() => orderPlannedTransforms(callerAttemptsToDisableClaims, registry)).toThrow(PlanningClaimConflictError);
  });

  it("accepts only registry-declared bounded SCCs and converges them deterministically", async () => {
    const registry: PlanningTransformRegistry = {
      getMetadata(id, version) {
        if (version !== "1" || (id !== "left" && id !== "right")) return undefined;
        return {
          predecessors: [id === "left" ? "right" : "left"],
          unitClaim: "exclusive",
          convergence: { kind: "bounded-fixed-point", maximumIterations: 3 },
        };
      },
    };
    const transforms = [
      { id: "right", version: "1", provenance: "generated" as const, unitIds: ["unit:right"] },
      { id: "left", version: "1", provenance: "source" as const, unitIds: ["unit:left"] },
    ];

    expect(orderPlannedTransforms(transforms, registry).map((transform) => transform.id)).toEqual(["left", "right"]);
    const visits: string[] = [];
    await expect(convergePlannedTransforms(transforms, registry, async (transform, iteration) => {
      visits.push(`${iteration}:${transform.id}`);
      return { changed: iteration === 1 };
    })).resolves.toEqual({ converged: true, iterations: 2 });
    expect(visits).toEqual(["1:left", "1:right", "2:left", "2:right"]);

    await expect(convergePlannedTransforms(transforms, registry, async () => ({ changed: true })))
      .rejects.toBeInstanceOf(PlanningFixedPointError);
  });

  it("rejects undeclared transform cycles", () => {
    const registry: PlanningTransformRegistry = {
      getMetadata(id) {
        return {
          predecessors: [id === "left" ? "right" : "left"],
          unitClaim: "shared",
          convergence: { kind: "idempotent" },
        };
      },
    };
    expect(() => orderPlannedTransforms([
      { id: "left", version: "1", provenance: "source", unitIds: [] },
      { id: "right", version: "1", provenance: "generated", unitIds: [] },
    ], registry)).toThrow(PlanningDependencyCycleError);
  });
});
