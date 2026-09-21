import {
  ContentHashSchema,
  canonicalJson,
  type ContentHash,
  type ExecutionCapsule,
  type RepresentationProjectionRef,
} from "@projector/core";
import {
  BUILT_IN_REPRESENTATION_PROFILES,
  currentBuiltInRepresentationProfile,
  executionCapsuleHash,
  planUpgradeInvalidation,
  reconcileRepresentationProfileUpgrade,
} from "@projector/engine";
import { z } from "zod";

import { RepositoryChangeLifecycleService } from "../change-lifecycle/service.js";
import { ChangeLifecycleStore, type LifecycleCaptureRecord } from "../change-lifecycle/store.js";
import type { ApplicationEvidencePort } from "../knowledge/application-evidence.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { RepositoryRepresentationArtifactStore } from "./artifact-store.js";
import { RepositoryRepresentationInspectionService } from "./service.js";

const reconciliationFields = {
  kind: z.literal("representation-profile-reconciliation"),
  profile: z.strictObject({
    id: z.string().min(1),
    fromVersion: z.string().min(1),
    toVersion: z.string().min(1),
    fromSemanticHash: ContentHashSchema,
    toSemanticHash: ContentHashSchema,
  }),
  historical: z.strictObject({
    changeSelector: z.string().min(1),
    planHash: ContentHashSchema,
    projectionId: z.string().min(1),
    capsuleIds: z.array(z.string().min(1)).min(1),
    approvalStatus: z.enum(["not-supplied", "authenticated-stale"]),
  }),
  context: z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("not-bound") }),
    z.strictObject({
      status: z.enum(["current", "rebound"]),
      contextId: z.string().min(1),
      observedContextId: z.string().min(1),
      contentHash: ContentHashSchema,
    }),
  ]),
  invalidation: z.strictObject({
    invalidatedIds: z.array(z.string().min(1)).min(1),
    preservedCanonicalEntityIds: z.array(z.string().min(1)),
  }),
  reconciliation: z.strictObject({
    status: z.literal("reconciled"),
    refreshedIds: z.array(z.string().min(1)).min(1),
    receiptHash: ContentHashSchema,
  }),
  replacement: z.strictObject({
    changeSelector: z.string().min(1),
    planHash: ContentHashSchema,
    projectionId: z.string().min(1),
    capsuleIds: z.array(z.string().min(1)).min(1),
    artifactStatus: z.literal("valid"),
    dependencyStatus: z.literal("current"),
    approvalStatus: z.literal("not-supplied"),
  }),
  automaticApprovalCreated: z.literal(false),
} as const;

export const RepresentationProfileReconciliationOutputSchema = z.strictObject({
  ...reconciliationFields,
  delivery: z.strictObject({
    stage: z.literal("reconciliation-service"),
    deliveredToRunnerBoundary: z.literal(false),
  }),
});

export const RepresentationProfileReconciliationOperationOutputSchema = z.strictObject({
  ...reconciliationFields,
  delivery: z.strictObject({
    stage: z.literal("operation-runner"),
    deliveredToRunnerBoundary: z.literal(true),
  }),
});

export type RepresentationProfileReconciliationOutput = z.infer<typeof RepresentationProfileReconciliationOutputSchema>;
export type RepresentationProfileReconciliationOperationOutput = z.infer<typeof RepresentationProfileReconciliationOperationOutputSchema>;

export function projectRepresentationProfileReconciliationOperation(
  value: RepresentationProfileReconciliationOutput,
): RepresentationProfileReconciliationOperationOutput {
  return RepresentationProfileReconciliationOperationOutputSchema.parse({
    ...RepresentationProfileReconciliationOutputSchema.parse(value),
    delivery: { stage: "operation-runner", deliveredToRunnerBoundary: true },
  });
}

function selectedRepresentation(capture: LifecycleCaptureRecord): RepresentationProjectionRef {
  const references = capture.capsules.map(({ representation }) => representation);
  if (references.some((reference) => reference === undefined)) throw new Error("every captured capsule must bind a representation projection");
  const unique = new Map(references.map((reference) => [canonicalJson(reference), reference!]));
  if (unique.size !== 1) throw new Error("representation reconciliation requires one profile projection shared by the selected plan capsules");
  return [...unique.values()][0]!;
}

function currentProfile(profileId: string) {
  const profile = currentBuiltInRepresentationProfile(profileId);
  if (profile === undefined) throw new Error("selected representation profile does not have a current packaged version");
  return profile;
}

function replacementCapsule(oldCapsule: ExecutionCapsule, oldCapture: LifecycleCaptureRecord, replacement: LifecycleCaptureRecord): ExecutionCapsule {
  const index = oldCapture.capsules.findIndex(({ id }) => id === oldCapsule.id);
  const value = replacement.capsules[index];
  if (index < 0 || value === undefined || replacement.capsules.length !== oldCapture.capsules.length) {
    throw new Error("replacement lifecycle capture does not preserve capsule cardinality and ordering");
  }
  return value;
}

export class RepositoryRepresentationProfileReconciliationService {
  private constructor(
    private readonly lifecycle: RepositoryChangeLifecycleService,
    private readonly store: ChangeLifecycleStore,
    private readonly artifacts: RepositoryRepresentationArtifactStore,
    private readonly inspection: RepositoryRepresentationInspectionService,
    private readonly knowledge: RepositoryKnowledgeService,
  ) {}

  static async create(repositoryRoot: string, options: { readonly applicationEvidence?: ApplicationEvidencePort } = {}) {
    const [lifecycle, store, artifacts, inspection, knowledge] = await Promise.all([
      RepositoryChangeLifecycleService.create(repositoryRoot, options),
      ChangeLifecycleStore.create(repositoryRoot),
      RepositoryRepresentationArtifactStore.create(repositoryRoot),
      RepositoryRepresentationInspectionService.create(repositoryRoot, options),
      RepositoryKnowledgeService.create(options.applicationEvidence === undefined ? repositoryRoot : { repositoryRoot, applicationEvidence: options.applicationEvidence }),
    ]);
    return new RepositoryRepresentationProfileReconciliationService(lifecycle, store, artifacts, inspection, knowledge);
  }

  async reconcile(input: { readonly changeSelector: string; readonly approvalSelector?: string; readonly signal?: AbortSignal }): Promise<RepresentationProfileReconciliationOutput> {
    input.signal?.throwIfAborted();
    const historical = await this.store.readCapture(input.changeSelector);
    const oldReference = selectedRepresentation(historical);
    const oldArtifact = await this.artifacts.read(oldReference);
    if (oldArtifact === undefined) throw new Error("historical representation artifact is unavailable");
    const oldProfile = Object.values(BUILT_IN_REPRESENTATION_PROFILES).find(({ id, version }) => id === oldReference.profileId && version === oldReference.profileVersion);
    if (oldProfile === undefined) throw new Error("historical representation profile is not authenticated by the packaged profile catalog");
    const boundProfile = oldArtifact.projection.boundState.valueDependencies.find(({ kind, id }) => kind === "representation-profile" && id === oldProfile.id);
    if (boundProfile?.versionHash !== oldProfile.semanticHash) throw new Error("historical representation profile binding is invalid");
    const nextProfile = currentProfile(oldProfile.id);
    if (nextProfile.version === oldProfile.version) throw new Error("selected representation profile is already current");

    const oldInspection = await this.inspection.inspect({
      changeSelector: historical.semanticChangeId,
      view: "summary",
      ...(input.approvalSelector === undefined ? {} : { approvalSelector: input.approvalSelector }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (oldInspection.artifactIntegrity.status !== "valid" || oldInspection.semanticFidelity.status !== "valid"
      || oldInspection.dependencyFreshness.status !== "stale") {
      throw new Error("historical representation must be authentic and stale before reconciliation");
    }
    if (input.approvalSelector !== undefined && oldInspection.executionAuthorization.status !== "authenticated-stale") {
      throw new Error("historical approval is not authenticated as stale");
    }

    let preservedCanonicalEntityIds: string[] = [];
    const context = historical.knowledgeContextId === undefined ? { status: "not-bound" as const } : await (async () => {
      const retained = await this.knowledge.read(historical.knowledgeContextId!);
      preservedCanonicalEntityIds = [...new Set(retained.branches.flatMap(({ context: branchContext }) => branchContext.items
        .filter(({ kind }) => kind === "concept" || kind === "requirement" || kind === "scenario" || kind === "decision")
        .map(({ entityId }) => entityId)))].sort();
      const result = await this.knowledge.reconcile(historical.knowledgeContextId!, input.signal === undefined ? {} : { signal: input.signal });
      if (result.status !== "current" && result.status !== "rebound") throw new Error(`bound knowledge context is ${result.status}: ${result.reasons.join("; ")}`);
      return { status: result.status, contextId: historical.knowledgeContextId!, observedContextId: result.governance.regeneratedContextId, contentHash: result.contentHash };
    })();

    const profileKey = `representation-profile:${oldProfile.id}`;
    const projectionKey = `representation:${oldReference.projectionId}`;
    const dependents = [
      { id: oldReference.projectionId, kind: "representation" as const, dependencyKeys: [profileKey] },
      ...historical.capsules.map(({ id }) => ({ id, kind: "capsule" as const, dependencyKeys: [projectionKey] })),
      ...preservedCanonicalEntityIds.map((id) => ({ id, kind: "canonical-entity" as const, dependencyKeys: [] })),
    ];
    const plan = planUpgradeInvalidation({
      kind: "representation-profile",
      id: oldProfile.id,
      fromVersion: oldProfile.version,
      toVersion: nextProfile.version,
      affectedDependencyKeys: [profileKey],
      requiredAction: "revalidate",
    }, dependents, {
      knownDependencyKeys: [profileKey, projectionKey],
      ownedDependencyKeys: { [profileKey]: { kind: "representation-profile", id: oldProfile.id } },
      directDependentIdsByDependencyKey: {
        [profileKey]: [oldReference.projectionId],
        [projectionKey]: historical.capsules.map(({ id }) => id),
      },
    });

    let replacement: LifecycleCaptureRecord | undefined;
    const reconciled = await reconcileRepresentationProfileUpgrade(plan, {
      invalidate: async (ids) => {
        if (canonicalJson(ids) !== canonicalJson(plan.invalidatedIds)) throw new Error("representation invalidation set changed before refresh");
        const captured = await this.lifecycle.capture({
          request: historical.request,
          proposal: historical.proposal,
          ...(historical.knowledgeContextId === undefined ? {} : { knowledgeContextId: historical.knowledgeContextId }),
        }, input.signal === undefined ? {} : { signal: input.signal });
        replacement = captured.capture;
        if (replacement.semanticChangeId === historical.semanticChangeId) throw new Error("profile upgrade did not produce a distinct lifecycle identity");
      },
      refresh: async (id): Promise<string> => {
        if (replacement === undefined) throw new Error("replacement capture was not created after invalidation");
        if (id === oldReference.projectionId) {
          return selectedRepresentation(replacement).contentHash;
        }
        const oldCapsule = historical.capsules.find((capsule) => capsule.id === id);
        if (oldCapsule === undefined) throw new Error(`unknown invalidated representation dependent: ${id}`);
        return executionCapsuleHash(replacementCapsule(oldCapsule, historical, replacement)) as ContentHash;
      },
    });
    if (replacement === undefined) throw new Error("representation reconciliation did not produce a replacement lifecycle capture");
    const replacementReference = selectedRepresentation(replacement);
    if (replacementReference.profileId !== nextProfile.id || replacementReference.profileVersion !== nextProfile.version) {
      throw new Error("replacement lifecycle capture does not use the active profile version");
    }
    const replacementInspection = await this.inspection.inspect({ changeSelector: replacement.semanticChangeId, view: "summary", ...(input.signal === undefined ? {} : { signal: input.signal }) });
    if (replacementInspection.artifactIntegrity.status !== "valid" || replacementInspection.semanticFidelity.status !== "valid"
      || replacementInspection.dependencyFreshness.status !== "current" || replacementInspection.executionAuthorization.status !== "not-supplied") {
      throw new Error("replacement representation is not valid, current, and unapproved");
    }

    return RepresentationProfileReconciliationOutputSchema.parse({
      kind: "representation-profile-reconciliation",
      profile: { id: oldProfile.id, fromVersion: oldProfile.version, toVersion: nextProfile.version, fromSemanticHash: oldProfile.semanticHash, toSemanticHash: nextProfile.semanticHash },
      historical: {
        changeSelector: historical.semanticChangeId,
        planHash: historical.planHash,
        projectionId: oldReference.projectionId,
        capsuleIds: historical.capsules.map(({ id }) => id),
        approvalStatus: input.approvalSelector === undefined ? "not-supplied" : "authenticated-stale",
      },
      context,
      invalidation: { invalidatedIds: plan.invalidatedIds, preservedCanonicalEntityIds: plan.preservedCanonicalEntityIds },
      reconciliation: { status: reconciled.status, refreshedIds: reconciled.refreshedIds, receiptHash: reconciled.receiptHash },
      replacement: {
        changeSelector: replacement.semanticChangeId,
        planHash: replacement.planHash,
        projectionId: replacementReference.projectionId,
        capsuleIds: replacement.capsules.map(({ id }) => id),
        artifactStatus: "valid",
        dependencyStatus: "current",
        approvalStatus: "not-supplied",
      },
      automaticApprovalCreated: false,
      delivery: { stage: "reconciliation-service", deliveredToRunnerBoundary: false },
    });
  }
}
