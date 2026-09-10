import { hashFramedDomain, parseChangeProposal, type ExecutionPlan, type StateBinding } from "@projector/core";
import { describe, expect, it } from "vitest";

import type { CompiledRepositoryChange, RepositoryIntentReview } from "./compiler.js";
import type { CapturedRepositoryChange } from "./service.js";
import { LifecycleApplyOutputSchema, LifecyclePlanOutputSchema, projectLifecycleCapture, projectLifecyclePlan, projectLifecycleRecovery, summarizeRepositoryIntentReview } from "./transport.js";

const hash = hashFramedDomain("test", "lifecycle-transport");
const binding: StateBinding = { compiledAgainst: { gitBase: "abc", worktreeDigest: hash, canonicalProjectorDigest: hash, toolchainDigest: hash }, valueDependencies: [], queryDependencies: [], dependencyDigest: hash };
const plan: ExecutionPlan = { id: "plan:change-1", semanticChangeId: "change:1", revision: 1, sourceRunId: "run:1", packetIds: [], boundary: [], knownAffectedUnitIds: [], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], relevanceClosureId: "relevance:1", predictedImpactClosureHash: hash, checkpoints: [], assumptions: [], completionCriteria: { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "weak", requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: false }, boundState: binding };
const proposal = parseChangeProposal({ apiVersion: "projector.change-proposal/v1", requirements: [{ key: "value", title: "Value", statement: "The value changes.", aliases: [] }], scenarios: [{ key: "change-value", title: "Change value", aliases: [], steps: [{ role: "trigger", statement: "The value changes." }, { role: "expected-outcome", statement: "The new value is visible." }] }], architecture: null, edits: [{ path: "src/value.ts", before: null, after: "value" }], validation: { independentNodeTests: ["test/value.test.mjs"], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"] });
const proposalHash = hashFramedDomain("repository-change-proposal", proposal);

const review: RepositoryIntentReview = {
  subjects: [{ id: "requirement:value", kind: "requirement", operation: "revise", before: null, after: {} as never, rationale: "Retain value." }],
  relations: [], canonicalMutations: [{ id: "concept:value", kind: "concept", operation: "add", before: null, after: { private: "not-public" }, rationale: "Own value." }],
  relatedObligations: [{ id: "decision:value", kind: "architecture-decision", payload: { private: "not-public" } }], unknowns: [], blockingUnknowns: [], contentHash: hash,
};

describe("change lifecycle transport projections", () => {
  it("projects capture and plan results without private canonical payloads", () => {
    const capture = { semanticChangeId: "change:1", planHash: hash, proposalHash, proposal, knowledgeContextId: "context:1" };
    const compiled = { intentReview: review, compiledPlan: { plan }, exactPatchInput: { edits: [{ path: "src/value.ts", before: null, after: "value" }] } } as unknown as CompiledRepositoryChange;
    const value = { capture, compiled } as unknown as CapturedRepositoryChange;

    expect(projectLifecycleCapture(value)).toEqual({ kind: "lifecycle-change", selector: "change:1", immutablePlanHash: hash, proposalHash, knowledgeContextId: "context:1" });
    const projected = projectLifecyclePlan("change:1", value);
    expect(projected.preview.expectedDiff).toBe("create src/value.ts");
    expect(projected.preview.proposal.requirements[0]?.statement).toBe("The value changes.");
    expect(projected.preview.intentReview).toEqual({ subjects: [{ id: "requirement:value", kind: "requirement", operation: "revise", rationale: "Retain value." }], relations: [], canonicalMutations: [{ id: "concept:value", kind: "concept", operation: "add", rationale: "Own value." }], relatedObligations: [{ id: "decision:value", kind: "architecture-decision" }], unknowns: [], blockingUnknowns: [], contentHash: hash });
    expect(JSON.stringify(projected)).not.toContain("not-public");
    expect(LifecyclePlanOutputSchema.safeParse(projected).success).toBe(true);
    const differentProposal = parseChangeProposal({ ...proposal, requirements: [{ ...proposal.requirements[0]!, statement: "The value is removed." }] });
    const materiallyDifferent = projectLifecyclePlan("change:1", { ...value, capture: { ...value.capture, proposal: differentProposal, proposalHash: hashFramedDomain("repository-change-proposal", differentProposal) } } as CapturedRepositoryChange);
    expect(materiallyDifferent.preview.proposal).not.toEqual(projected.preview.proposal);
    expect(LifecyclePlanOutputSchema.safeParse({ ...projected, preview: { ...projected.preview, proposalHash: hash } }).success).toBe(false);
  });

  it("keeps recovery explicit and rejects incomplete state-bound outputs", () => {
    expect(projectLifecycleRecovery("attempt:1", [{ attemptId: "attempt:1", transactionId: "tx:1", action: "recovery-required", reason: "journal unavailable" }])).toMatchObject({ kind: "lifecycle-recovery", outcomes: [{ action: "recovery-required" }] });
    expect(LifecycleApplyOutputSchema.safeParse({ kind: "lifecycle-apply", selector: "approval:1", outcome: "success", reasons: [] }).success).toBe(false);
  });

  it("rejects private fields at the summary boundary", () => {
    const summary = summarizeRepositoryIntentReview(review);
    expect(LifecyclePlanOutputSchema.shape.preview.shape.intentReview.safeParse({ ...summary, payload: {} }).success).toBe(false);
  });
});
