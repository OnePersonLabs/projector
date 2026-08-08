import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain, type AdapterContext, type Artifact, type ContentHash, type ExecutionCapsule, type ExecutionPlan, type Surface } from "@projector/core";
import { describe, expect, it } from "vitest";

import { FakeSurfaceAdapter, FileExternalOperationJournal, FileSurfaceSnapshotStore, InMemoryExternalOperationJournal, captureAndPersistSurfaceSnapshot, captureSurfaceSnapshot, executeSurfacePlan, rebuildPinnedSurfaceSnapshot } from "./index.js";

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
    await expect(captureSurfaceSnapshot(first, context(), "not-a-timestamp")).rejects.toThrow(/timestamp/iu);
    const root = await mkdtemp(join(tmpdir(), "projector-snapshot-"));
    try {
      const persisted = await captureAndPersistSurfaceSnapshot(first, context(), "2026-08-10T01:00:00Z", new FileSurfaceSnapshotStore(root));
      const rebuilt = await rebuildPinnedSurfaceSnapshot(state(persisted.snapshotDigest), new FileSurfaceSnapshotStore(root));
      expect(rebuilt).toEqual(persisted);
    } finally { await rm(root, { recursive: true, force: true }); }
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
    const capsule: ExecutionCapsule = { id: "capsule:one", taskId: "task:one", objective: "external", operation: "change", unitIds: [surface.id], boundState: pinnedBinding, relevanceClosureId: "closure:one", analysisFacetKeys: [], requirementIds: [], scenarioIds: [], conceptSummary: "", decisionIds: [], decisionSummary: "", unresolvedArchitectureConcerns: [], lensSummary: "", effectiveRules: [], normativeKernelHash: hash("kernel"), relevantPrecedents: [], allowedWrites: [], forbiddenWrites: [], availablePrimitives: [], requiredValidations: [], upstreamImplications: [], downstreamImplications: [], knownExceptions: [], unknowns: [], risk, completionContract: plan.completionCriteria, contextDependencyHash: hash("dep"), contextHash: hash("capsule") };
    const planHash = hashFramedDomain("execution-plan", plan);
    const approval = { id: "approval:one", planId: plan.id, planRevision: plan.revision, planHash, dependencyDigest: pinnedBinding.dependencyDigest, capsuleId: capsule.id, capsuleHash: hashFramedDomain("approved-execution-capsule", capsule) };
    const surfacePlan = { adapterId: "fake", surfaceId: surface.id, riskClass: "R3" as const, operations: [{ operation: "change" }], requiredApprovals: [approval.id], validatorIds: ["validate:fake"], boundState: pinnedBinding };
    const journal = new InMemoryExternalOperationJournal();
    const ports = { state: { current: async () => state(snapshot.snapshotDigest) }, bindingValidator: { validate: async () => ({ status: "current" as const, currentState: state(snapshot.snapshotDigest), changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, journal, clock: { now: () => "2026-08-08T02:00:00Z" } };
    const reservation = { reservationOwnerId: "executor:one" };
    await expect(executeSurfacePlan({ plan, capsule, approval: { ...approval, planRevision: 2 }, surfacePlan, snapshot, manualContinuation: true, ...reservation }, adapter, context(snapshot.snapshotDigest), ports)).resolves.toMatchObject({ outcome: "refused", reasons: expect.arrayContaining([expect.stringMatching(/stale approval/iu)]) });
    const ambiguous = await executeSurfacePlan({ plan, capsule, approval, surfacePlan, snapshot, manualContinuation: true, ...reservation }, adapter, context(snapshot.snapshotDigest), ports);
    expect(ambiguous).toMatchObject({ outcome: "partial", compensated: true });
    expect(adapter.applyCalls).toBe(1);
    const resumed = await executeSurfacePlan({ plan, capsule, approval, surfacePlan, snapshot, manualContinuation: true, ...reservation }, adapter, context(snapshot.snapshotDigest), ports);
    expect(resumed.outcome).toBe("partial");
    expect(adapter.applyCalls).toBe(1);
    const escalationCapsule = { ...capsule, operation: "read", unitIds: [surface.id], risk: { ...risk, class: "R1" as const } };
    const escalationApproval = { ...approval, capsuleHash: hashFramedDomain("approved-execution-capsule", escalationCapsule), capsuleId: escalationCapsule.id };
    const escalation = await executeSurfacePlan({ plan, capsule: escalationCapsule, approval: escalationApproval, surfacePlan: { ...surfacePlan, surfaceId: "surface:not-present", riskClass: "R4", operations: [{ operation: "delete-production" }] }, snapshot, manualContinuation: true, reservationOwnerId: "executor:attack" }, adapter, context(snapshot.snapshotDigest), ports);
    expect(escalation).toMatchObject({ outcome: "refused", reasons: expect.arrayContaining([expect.stringMatching(/absent|risk|approved/iu)]) });
  });

  it("keeps a concurrent owner in-flight until its durable lease expires", async () => {
    const journal = new InMemoryExternalOperationJournal(); const base = { operationId: "operation:one", planHash: hash("plan"), snapshotDigest: hash("snapshot"), leaseDurationMs: 60_000 };
    const first = await journal.reserve({ ...base, ownerId: "owner:a", now: "2026-08-08T00:00:00Z" });
    expect(first).toMatchObject({ state: "acquired" });
    if (first.state !== "acquired") throw new Error("expected lease acquisition");
    await expect(journal.markAmbiguous(base.operationId, "owner:a", hash("forged-lease"))).rejects.toThrow(/owned/iu);
    expect(await journal.reserve({ ...base, ownerId: "owner:b", now: "2026-08-08T00:00:01Z" })).toMatchObject({ state: "in-flight", ownerId: "owner:a" });
    expect(await journal.reserve({ ...base, ownerId: "owner:b", now: "2026-08-08T00:02:00Z" })).toMatchObject({ state: "ambiguous" });
    expect(await journal.reserve({ ...base, ownerId: "owner:a", now: "2026-08-08T00:02:01Z" })).toMatchObject({ state: "in-flight", ownerId: "owner:b" });
    const root = await mkdtemp(join(tmpdir(), "projector-operation-journal-"));
    try {
      expect(await new FileExternalOperationJournal(root).reserve({ ...base, ownerId: "owner:file-a", now: "2026-08-08T00:00:00Z" })).toMatchObject({ state: "acquired" });
      expect(await new FileExternalOperationJournal(root).reserve({ ...base, ownerId: "owner:file-b", now: "2026-08-08T00:00:01Z" })).toMatchObject({ state: "in-flight", ownerId: "owner:file-a" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
