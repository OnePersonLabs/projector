import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain, type ExecutionCapsule, type ExecutionPlan, type StateBinding } from "@projector/core";
import { createExecutionApproval, executionCapsuleHash, executionPlanHash } from "@projector/engine";
import { describe, expect, it } from "vitest";

import { ChangeLifecycleStore } from "./store.js";

const hash = hashFramedDomain("test", "lifecycle-store");
const proposal = { apiVersion: "projector.change-proposal/v1" as const, requirements: [{ key: "value", title: "Value", statement: "The value changes.", aliases: [] }], scenarios: [{ key: "change-value", title: "Change value", aliases: [], steps: [{ role: "trigger" as const, statement: "The value changes." }, { role: "expected-outcome" as const, statement: "The new value is visible." }] }], architecture: null, edits: [{ path: "src/value.mjs", before: "old", after: "new" }], validation: { independentNodeTests: ["test/value.test.mjs"], supplementalNodeTests: [] }, analysisFacets: ["architecture" as const, "behavior" as const] };
const proposalHash = hashFramedDomain("repository-change-proposal", proposal);
const binding: StateBinding = {
  compiledAgainst: { gitBase: "abc", worktreeDigest: hash, canonicalProjectorDigest: hash, toolchainDigest: hash },
  valueDependencies: [], queryDependencies: [], dependencyDigest: hash,
};

function plan(): ExecutionPlan {
  return {
    id: "plan:change-1", semanticChangeId: "change:1", revision: 1, sourceRunId: "run:1",
    packetIds: ["packet:1"], boundary: ["src/value.mjs"], knownAffectedUnitIds: ["unit:1"],
    possibleFrontierUnitIds: [], unavailableSurfaceIds: [], relevanceClosureId: "relevance:1",
    predictedImpactClosureHash: hash, checkpoints: [], recommendedNextChunk: "packet:1",
    assumptions: [],
    completionCriteria: {
      requiredUnitStates: [{ unitId: "unit:1", state: "valid" }], requiredValidators: ["exact-text-patch.verify"],
      requiredEvidenceLanes: ["runtime"], minimumValidationAssurance: "strong", requireIndependentValidation: false,
      maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false,
      requiredArtifacts: ["certificate", "receipt"], cleanWorkingTree: false,
    },
    boundState: binding,
  };
}

function capsule(): ExecutionCapsule {
  return {
    id: "capsule:1", taskId: "packet:1", objective: "change value", operation: "exact-text-patch", unitIds: ["unit:1"],
    boundState: binding, relevanceClosureId: "relevance:1", analysisFacetKeys: ["behavior"], requirementIds: [], scenarioIds: [],
    conceptSummary: "change value", decisionIds: [], decisionSummary: "none", unresolvedArchitectureConcerns: [], lensSummary: "exact",
    effectiveRules: [], normativeKernelHash: hash, relevantPrecedents: [],
    allowedWrites: [{ selector: { op: "atom", field: "path", matcher: "equals", value: "src/value.mjs" }, operations: ["exact-text-patch"], reason: "test" }],
    forbiddenWrites: [], availablePrimitives: ["exact-text-patch"], requiredValidations: ["exact-text-patch.verify"],
    upstreamImplications: [], downstreamImplications: [], knownExceptions: [], unknowns: [],
    risk: { class: "R1", inherentOperationRisk: 1, affectedUnitCount: 1, affectedSurfaceCount: 1, publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "proven", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] },
    completionContract: plan().completionCriteria, contextDependencyHash: hash, contextHash: hash,
  };
}

describe("change lifecycle store", () => {
  it("persists one immutable authenticated capture and returns it idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lifecycle-store-"));
    try {
      const store = await ChangeLifecycleStore.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const input = {
        request: "Change the value.", proposal, proposalHash,
        semanticChangeId: "change:1", plan: plan(), capsules: [capsule()], exactPatchInputHash: hash,
      };
      const first = await store.capture(input);
      const second = await store.capture(input);
      expect(second).toEqual(first);
      expect(await store.readCapture("change:1")).toEqual(first);
      expect(first).toMatchObject({ planHash: executionPlanHash(plan()), capsuleBindings: [{ capsuleHash: executionCapsuleHash(capsule()) }] });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects tampered captures and approval of any other plan hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lifecycle-store-"));
    try {
      const store = await ChangeLifecycleStore.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await store.capture({
        request: "Change the value.", proposal, proposalHash,
        semanticChangeId: "change:1", plan: plan(), capsules: [capsule()], exactPatchInputHash: hash,
      });
      await expect(store.approve("change:1", hash, plan(), [capsule()])).rejects.toThrow(/plan hash/iu);
      const approval = await store.approve("change:1", captured.planHash, plan(), [capsule()]);
      expect(approval.approvals).toEqual([createExecutionApproval(plan(), capsule(), approval.approvals[0]!.id)]);

      const directory = join(root, ".projector", "runtime", "change-lifecycles", "captures");
      const [name] = await readdir(directory);
      const path = join(directory, name!);
      const raw = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      raw.request = "tampered";
      await writeFile(path, `${JSON.stringify(raw)}\n`);
      await expect(store.readCapture("change:1")).rejects.toThrow(/authentication|content hash/iu);
      raw.request = captured.request;
      raw.unknownDurableAuthority = true;
      await writeFile(path, `${JSON.stringify(raw)}\n`);
      await expect(store.readCapture("change:1")).rejects.toThrow(/unrecognized|unknown|schema/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not confuse a conflicting lifecycle identity with an idempotent capture", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lifecycle-store-"));
    try {
      await mkdir(root, { recursive: true });
      const store = await ChangeLifecycleStore.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const base = { request: "Change the value.", proposal, proposalHash, semanticChangeId: "change:1", plan: plan(), capsules: [capsule()], exactPatchInputHash: hash };
      await store.capture(base);
      await expect(store.capture({ ...base, request: "Different request." })).rejects.toThrow(/conflicting.*lifecycle/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
