import { hashFramedDomain, type AdapterContext, type Artifact, type ContentHash, type ExecutionCapsule, type ExecutionPlan, type Surface } from "@projector/core";
import { describe, expect, it } from "vitest";

import { FakeSurfaceAdapter, InMemoryExternalOperationJournal, captureSurfaceSnapshot, executeSurfacePlan } from "./index.js";

const hash = (value: string): ContentHash => hashFramedDomain("surface-test-fixture", value);
const state = (snapshot?: ContentHash) => ({ gitBase: "base", worktreeDigest: hash("worktree"), canonicalProjectorDigest: hash("canonical"), toolchainDigest: hash("toolchain"), ...(snapshot === undefined ? {} : { pinnedExternalSnapshotDigest: snapshot }) });
const binding = { compiledAgainst: state(), valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
const enumeration = { observability: "closed" as const, method: "fake-pages", assumptions: [], blindSpots: [], dynamicMechanisms: [] };
const capabilities = { read: true, write: true, watch: false, transactionalWrites: false, stableAnchors: true, humanApprovalRequired: true };
const surface = { id: "surface:fake", key: "fake", kind: "external", adapter: "fake", access: "read-write", enumeration, capabilities, boundary: {} } satisfies Surface;
const artifact = (id: string): Artifact => ({ id, surfaceId: surface.id, locator: id, mediaType: "application/json", contentHash: hashFramedDomain("fake-surface-artifact-content", { value: id }), observedAt: "2026-08-08T00:00:00Z", observationRevision: "remote:7", causalOrigin: { kind: "external" }, metadata: { observedContent: { value: id } } });
const context = (snapshot?: ContentHash): AdapterContext => ({ repositoryRoot: "/repo", stateDigest: state(snapshot), config: {}, signal: new AbortController().signal });

describe("surface snapshots and Task16 composition", () => {
  it("pins deterministic observations while distinguishing semantic content from timestamped revisions", async () => {
    const first = new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities, enumeration, surfaces: [surface], pages: [[artifact("artifact:b")], [artifact("artifact:a")]] });
    const reordered = new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities, enumeration, surfaces: [surface], pages: [[artifact("artifact:a")], [artifact("artifact:b")]] });
    const one = await captureSurfaceSnapshot(first, context(), "2026-08-08T01:00:00Z");
    const two = await captureSurfaceSnapshot(reordered, context(), "2026-08-09T01:00:00Z");
    expect(one.semanticDigest).toBe(two.semanticDigest);
    expect(one.revisionId).not.toBe(two.revisionId);
    expect(one.snapshotDigest).not.toBe(two.snapshotDigest);
    expect(one.artifacts.map(({ id }) => id)).toEqual(["artifact:a", "artifact:b"]);
  });

  it("fails closed for duplicate identities, incomplete closed pagination, and capability inflation", async () => {
    await expect(captureSurfaceSnapshot(new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities, enumeration, surfaces: [surface], pages: [[artifact("artifact:a")], [artifact("artifact:a")]] }), context(), "2026-08-08T01:00:00Z")).rejects.toThrow(/duplicate artifact/iu);
    await expect(captureSurfaceSnapshot(new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities, enumeration, surfaces: [surface], pages: [[artifact("artifact:a")]], complete: false }), context(), "2026-08-08T01:00:00Z")).rejects.toThrow(/incomplete pagination/iu);
    const inflated = { ...surface, capabilities: { ...capabilities, transactionalWrites: true } };
    await expect(captureSurfaceSnapshot(new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities, enumeration, surfaces: [inflated], pages: [] }), context(), "2026-08-08T01:00:00Z")).rejects.toThrow(/capabilit/iu);
  });

  it("keeps open/read-only and unavailable observations truthful without mutation methods or absence proof", async () => {
    const readOnlyCapabilities = { ...capabilities, write: false, humanApprovalRequired: false };
    const openEnumeration = { ...enumeration, observability: "open" as const, blindSpots: ["resources outside the granted account"] };
    const openSurface = { ...surface, access: "read-only" as const, capabilities: readOnlyCapabilities, enumeration: openEnumeration };
    const readOnly = new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities: readOnlyCapabilities, enumeration: openEnumeration, surfaces: [openSurface], pages: [[]] });
    const openSnapshot = await captureSurfaceSnapshot(readOnly, context(), "2026-08-08T01:00:00Z");
    expect(openSnapshot).toMatchObject({ observability: "open", provesCompleteAbsence: false, blindSpots: ["resources outside the granted account"] });
    expect(readOnly.plan).toBeUndefined(); expect(readOnly.apply).toBeUndefined();

    const unavailableCapabilities = { read: false, write: false, watch: false, transactionalWrites: false, stableAnchors: false, humanApprovalRequired: false };
    const unavailableEnumeration = { ...enumeration, observability: "unavailable" as const, blindSpots: ["credentials unavailable"] };
    const unavailableSurface = { ...surface, access: "unavailable" as const, capabilities: unavailableCapabilities, enumeration: unavailableEnumeration };
    const unavailable = await captureSurfaceSnapshot(new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities: unavailableCapabilities, enumeration: unavailableEnumeration, surfaces: [unavailableSurface], pages: [] }), context(), "2026-08-08T01:00:00Z");
    expect(unavailable).toMatchObject({ unavailableSurfaceIds: [surface.id], provesCompleteAbsence: false });
  });

  it("reserves one external operation, refuses stale approval, and compensates ambiguous failure before resume", async () => {
    const adapter = new FakeSurfaceAdapter({ id: "fake", version: "1", kind: "external", capabilities, enumeration, surfaces: [surface], pages: [[]], applyMode: "ambiguous-failure" });
    const snapshot = await captureSurfaceSnapshot(adapter, context(), "2026-08-08T01:00:00Z");
    const pinnedBinding = { ...binding, compiledAgainst: state(snapshot.snapshotDigest) };
    const risk = { class: "R3" as const, inherentOperationRisk: 3, affectedUnitCount: 0, affectedSurfaceCount: 1, publicContractImpact: false, externalImpact: true, dataImpact: false, reversibility: "partial" as const, validationStrength: "strong" as const, closureConfidence: "bounded" as const, unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: true, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] };
    const plan: ExecutionPlan = { id: "plan:one", revision: 1, semanticChangeId: "change:one", sourceRunId: "run:one", boundState: pinnedBinding, boundary: [], assumptions: [], knownAffectedUnitIds: [], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: [], checkpoints: [], completionCriteria: { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "supporting", requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: true } };
    const capsule: ExecutionCapsule = { id: "capsule:one", taskId: "task:one", objective: "external", operation: "apply", unitIds: [], boundState: pinnedBinding, relevanceClosureId: "closure:one", analysisFacetKeys: [], requirementIds: [], scenarioIds: [], conceptSummary: "", decisionIds: [], decisionSummary: "", unresolvedArchitectureConcerns: [], lensSummary: "", effectiveRules: [], normativeKernelHash: hash("kernel"), relevantPrecedents: [], allowedWrites: [], forbiddenWrites: [], availablePrimitives: [], requiredValidations: [], upstreamImplications: [], downstreamImplications: [], knownExceptions: [], unknowns: [], risk, completionContract: plan.completionCriteria, contextDependencyHash: hash("dep"), contextHash: hash("capsule") };
    const planHash = hashFramedDomain("execution-plan", plan);
    const approval = { id: "approval:one", planId: plan.id, planRevision: plan.revision, planHash, dependencyDigest: pinnedBinding.dependencyDigest, capsuleId: capsule.id, capsuleHash: hashFramedDomain("approved-execution-capsule", capsule) };
    const surfacePlan = { adapterId: "fake", surfaceId: surface.id, riskClass: "R3" as const, operations: [{ op: "change" }], requiredApprovals: ["manual:operator"], validatorIds: ["validate:fake"], boundState: pinnedBinding };
    const journal = new InMemoryExternalOperationJournal();
    const ports = { state: { current: async () => state(snapshot.snapshotDigest) }, bindingValidator: { validate: async () => ({ status: "current" as const, currentState: state(snapshot.snapshotDigest), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, journal };
    await expect(executeSurfacePlan({ plan, capsule, approval: { ...approval, planRevision: 2 }, surfacePlan, snapshot, manualContinuation: true }, adapter, context(snapshot.snapshotDigest), ports)).resolves.toMatchObject({ outcome: "refused", reasons: expect.arrayContaining([expect.stringMatching(/stale approval/iu)]) });
    const ambiguous = await executeSurfacePlan({ plan, capsule, approval, surfacePlan, snapshot, manualContinuation: true }, adapter, context(snapshot.snapshotDigest), ports);
    expect(ambiguous).toMatchObject({ outcome: "partial", compensated: true });
    expect(adapter.applyCalls).toBe(1);
    const resumed = await executeSurfacePlan({ plan, capsule, approval, surfacePlan, snapshot, manualContinuation: true }, adapter, context(snapshot.snapshotDigest), ports);
    expect(resumed.outcome).toBe("partial");
    expect(adapter.applyCalls).toBe(1);
  });
});
