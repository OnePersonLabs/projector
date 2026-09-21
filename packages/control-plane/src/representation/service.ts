import {
  ContentHashSchema,
  ExecutionCapsuleSchema,
  RepresentationProjectionSchema,
  RepresentationProjectionRefSchema,
  StateDigestSchema,
  ValidationResultSchema,
  canonicalJson,
  type ExecutionCapsule,
} from "@projector/core";
import { currentBuiltInRepresentationProfile, executionCapsuleHash, executionPlanHash } from "@projector/engine";
import { z } from "zod";

import { RepositoryChangeLifecycleService } from "../change-lifecycle/service.js";
import { ChangeLifecycleStore, type LifecycleCaptureRecord } from "../change-lifecycle/store.js";
import type { ApplicationEvidencePort } from "../knowledge/application-evidence.js";
import { RepositoryRepresentationArtifactStore } from "./artifact-store.js";

const factStatusSchema = z.enum(["valid", "invalid", "unavailable"]);
const freshnessStatusSchema = z.enum(["current", "stale", "unknown"]);

const representationInspectionFields = {
  kind: z.literal("representation-inspection"),
  changeSelector: z.string().min(1),
  view: z.enum(["summary", "content"]),
  association: z.strictObject({
    planId: z.string().min(1),
    planRevision: z.number().int().positive(),
    planHash: ContentHashSchema,
    capsuleId: z.string().min(1),
    capsuleHash: ContentHashSchema,
    normativeKernelHash: ContentHashSchema,
    representation: RepresentationProjectionRefSchema,
  }),
  renderedText: z.string().optional(),
  artifactIntegrity: z.strictObject({ status: factStatusSchema, recordHash: ContentHashSchema.optional(), reason: z.string().min(1) }),
  dependencyFreshness: z.strictObject({ status: freshnessStatusSchema, currentState: StateDigestSchema.optional(), reasons: z.array(z.string().min(1)) }),
  semanticFidelity: z.strictObject({
    status: factStatusSchema,
    reason: z.string().min(1),
    projection: RepresentationProjectionSchema.optional(),
    validatorResults: z.array(ValidationResultSchema),
  }),
  executionAuthorization: z.strictObject({
    status: z.enum(["not-supplied", "authenticated-current", "authenticated-stale", "unknown"]),
    approvalSelector: z.string().min(1).optional(),
    reason: z.string().min(1),
  }),
} as const;

function validateInspectionOutput(value: {
  readonly view: "summary" | "content";
  readonly renderedText?: string | undefined;
  readonly artifactIntegrity: { readonly status: "valid" | "invalid" | "unavailable" };
}, context: z.RefinementCtx): void {
  if (value.view === "summary" && value.renderedText !== undefined) {
    context.addIssue({ code: "custom", path: ["renderedText"], message: "the summary view cannot expose rendered text" });
  }
  if (value.view === "content" && value.artifactIntegrity.status === "valid" && value.renderedText === undefined) {
    context.addIssue({ code: "custom", path: ["renderedText"], message: "a valid content view must expose the authenticated rendered text" });
  }
  if (value.renderedText !== undefined && value.artifactIntegrity.status !== "valid") {
    context.addIssue({ code: "custom", path: ["renderedText"], message: "invalid or unavailable artifacts cannot expose rendered text" });
  }
}

export const RepresentationInspectionOutputSchema = z.strictObject({
  ...representationInspectionFields,
  delivery: z.strictObject({
    stage: z.literal("inspection-service"),
    deliveredToRunnerBoundary: z.literal(false),
    agentUnderstandingEstablished: z.literal(false),
    behavioralCompletionEstablished: z.literal(false),
  }),
}).superRefine(validateInspectionOutput);

export type RepresentationInspectionOutput = z.infer<typeof RepresentationInspectionOutputSchema>;

export const RepresentationInspectionOperationOutputSchema = z.strictObject({
  ...representationInspectionFields,
  delivery: z.strictObject({
    stage: z.literal("operation-runner"),
    deliveredToRunnerBoundary: z.literal(true),
    agentUnderstandingEstablished: z.literal(false),
    behavioralCompletionEstablished: z.literal(false),
  }),
}).superRefine(validateInspectionOutput);

export type RepresentationInspectionOperationOutput = z.infer<typeof RepresentationInspectionOperationOutputSchema>;

export function projectRepresentationInspectionOperation(
  inspection: RepresentationInspectionOutput,
): RepresentationInspectionOperationOutput {
  return RepresentationInspectionOperationOutputSchema.parse({
    ...RepresentationInspectionOutputSchema.parse(inspection),
    delivery: {
      stage: "operation-runner",
      deliveredToRunnerBoundary: true,
      agentUnderstandingEstablished: false,
      behavioralCompletionEstablished: false,
    },
  });
}

function selectCapsule(capture: LifecycleCaptureRecord, capsuleId?: string): ExecutionCapsule {
  if (capsuleId === undefined) {
    if (capture.capsules.length !== 1) throw new Error("capsuleId is required when a plan has more than one execution capsule");
    return capture.capsules[0]!;
  }
  const capsule = capture.capsules.find(({ id }) => id === capsuleId);
  if (capsule === undefined) throw new Error("requested capsule is not bound to the authenticated lifecycle plan");
  return ExecutionCapsuleSchema.parse(capsule) as ExecutionCapsule;
}

function errorReason(error: unknown): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : "representation observation failed without a diagnostic";
}

function staleReason(reason: string): boolean {
  return /\b(?:stale|changed|mismatch|does not match|different repository states|binding is suspect|binding is violated|dependencies are violated)\b/iu.test(reason);
}

export class RepositoryRepresentationInspectionService {
  private constructor(
    private readonly lifecycle: RepositoryChangeLifecycleService,
    private readonly lifecycleStore: ChangeLifecycleStore,
    private readonly artifacts: RepositoryRepresentationArtifactStore,
  ) {}

  static async create(repositoryRoot: string, options: { readonly applicationEvidence?: ApplicationEvidencePort } = {}): Promise<RepositoryRepresentationInspectionService> {
    const [lifecycle, lifecycleStore, artifacts] = await Promise.all([
      RepositoryChangeLifecycleService.create(repositoryRoot, options),
      ChangeLifecycleStore.create(repositoryRoot),
      RepositoryRepresentationArtifactStore.create(repositoryRoot),
    ]);
    return new RepositoryRepresentationInspectionService(lifecycle, lifecycleStore, artifacts);
  }

  async inspect(input: {
    readonly changeSelector: string;
    readonly capsuleId?: string;
    readonly approvalSelector?: string;
    readonly view: "summary" | "content";
    readonly signal?: AbortSignal;
  }): Promise<RepresentationInspectionOutput> {
    input.signal?.throwIfAborted();
    const capture = await this.lifecycleStore.readCapture(input.changeSelector);
    const capsule = selectCapsule(capture, input.capsuleId);
    const reference = capsule.representation;
    if (reference === undefined) throw new Error("selected execution capsule has no representation projection");

    let durable: Awaited<ReturnType<RepositoryRepresentationArtifactStore["read"]>>;
    let artifactIntegrity: RepresentationInspectionOutput["artifactIntegrity"];
    try {
      durable = await this.artifacts.read(reference);
      artifactIntegrity = durable === undefined
        ? { status: "unavailable", reason: "durable representation artifact is unavailable" }
        : { status: "valid", recordHash: durable.recordHash, reason: "durable record, projection and rendered bytes match the selected capsule reference" };
    } catch (error) {
      durable = undefined;
      artifactIntegrity = { status: "invalid", reason: errorReason(error) };
    }

    input.signal?.throwIfAborted();
    let freshness: RepresentationInspectionOutput["dependencyFreshness"];
    try {
      const current = await this.lifecycle.inspectCurrentPlan(input.changeSelector, input.signal === undefined ? {} : { signal: input.signal });
      const currentCapsule = current.compiled.compiledPlan.packets.map(({ capsule: currentPacketCapsule }) => currentPacketCapsule).find(({ id }) => id === capsule.id);
      if (executionPlanHash(current.compiled.compiledPlan.plan) !== capture.planHash
        || currentCapsule === undefined
        || executionCapsuleHash(currentCapsule) !== executionCapsuleHash(capsule)
        || canonicalJson(currentCapsule.representation) !== canonicalJson(reference)) {
        freshness = { status: "stale", currentState: current.compiled.compiledPlan.plan.boundState.compiledAgainst, reasons: ["live lifecycle recompilation changed the plan, capsule, or representation association"] };
      } else {
        freshness = { status: "current", currentState: current.compiled.compiledPlan.plan.boundState.compiledAgainst, reasons: ["live lifecycle recompilation matched every bound plan, capsule, representation, value and query dependency"] };
      }
    } catch (error) {
      input.signal?.throwIfAborted();
      const reason = errorReason(error);
      freshness = { status: staleReason(reason) ? "stale" : "unknown", reasons: [reason] };
    }
    if (freshness.status === "current" && durable !== undefined) {
      const profile = currentBuiltInRepresentationProfile(reference.profileId);
      const boundProfile = durable.projection.boundState.valueDependencies.find(({ kind, id }) => kind === "representation-profile" && id === reference.profileId);
      if (profile === undefined || reference.profileVersion !== profile.version || boundProfile?.versionHash !== profile.semanticHash) {
        freshness = { status: "stale", ...(freshness.currentState === undefined ? {} : { currentState: freshness.currentState }), reasons: ["selected representation profile version or semantic hash changed"] };
      }
    }

    const fidelity: RepresentationInspectionOutput["semanticFidelity"] = durable === undefined
      ? { status: artifactIntegrity.status === "invalid" ? "invalid" : "unavailable", reason: "compiler fidelity evidence is unavailable without an authenticated durable projection", validatorResults: [] }
      : durable.projection.preservation.semanticHash !== reference.preservationHash
        || durable.projection.validatorResults.some(({ status }) => status !== "passed")
        ? { status: "invalid", reason: "compiler fidelity evidence does not authenticate the selected preservation result", projection: durable.projection, validatorResults: durable.projection.validatorResults }
        : { status: "valid", reason: "compiler-owned protected dimensions and validator results authenticate the selected representation", projection: durable.projection, validatorResults: durable.projection.validatorResults };

    const authorization = await this.authorization(input.approvalSelector, capture, capsule, freshness.status);
    input.signal?.throwIfAborted();
    return RepresentationInspectionOutputSchema.parse({
      kind: "representation-inspection",
      changeSelector: input.changeSelector,
      view: input.view,
      association: {
        planId: capture.planId,
        planRevision: capture.planRevision,
        planHash: capture.planHash,
        capsuleId: capsule.id,
        capsuleHash: executionCapsuleHash(capsule),
        normativeKernelHash: capsule.normativeKernelHash,
        representation: reference,
      },
      ...(input.view === "content" && durable !== undefined ? { renderedText: durable.content } : {}),
      artifactIntegrity,
      dependencyFreshness: freshness,
      semanticFidelity: fidelity,
      executionAuthorization: authorization,
      delivery: { stage: "inspection-service", deliveredToRunnerBoundary: false, agentUnderstandingEstablished: false, behavioralCompletionEstablished: false },
    });
  }

  private async authorization(
    approvalSelector: string | undefined,
    capture: LifecycleCaptureRecord,
    capsule: ExecutionCapsule,
    freshness: RepresentationInspectionOutput["dependencyFreshness"]["status"],
  ): Promise<RepresentationInspectionOutput["executionAuthorization"]> {
    if (approvalSelector === undefined) return { status: "not-supplied", reason: "inspection does not require or create execution approval" };
    try {
      const approval = await this.lifecycleStore.readApproval(approvalSelector);
      const capsuleApproval = approval.approvals.find(({ capsuleId }) => capsuleId === capsule.id);
      const valid = approval.semanticChangeId === capture.semanticChangeId
        && approval.planHash === capture.planHash
        && capsuleApproval?.planId === capture.planId
        && capsuleApproval.planRevision === capture.planRevision
        && capsuleApproval.planHash === capture.planHash
        && capsuleApproval.dependencyDigest === capture.stateBinding.dependencyDigest
        && capsuleApproval.capsuleHash === executionCapsuleHash(capsule);
      if (!valid) throw new Error("approval does not authenticate the selected plan revision and capsule");
      if (freshness === "current") return { status: "authenticated-current", approvalSelector, reason: "existing approval authenticates the selected current plan and capsule; inspection creates no new authority" };
      if (freshness === "stale") return { status: "authenticated-stale", approvalSelector, reason: "existing approval is authentic but the selected representation or its live dependencies are stale" };
      return { status: "unknown", approvalSelector, reason: "approval is authentic but live dependency currentness is unavailable" };
    } catch (error) { throw new Error(`approval selector is not bound to this inspection: ${errorReason(error)}`); }
  }
}
