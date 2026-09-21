import {
  ChangeCertificateSchema,
  ChangeProposalSchema,
  ContentHashSchema,
  ExecutionPlanSchema,
  RelationSchema,
  TransactionReceiptSchema,
  TransformPreviewSchema,
  TransformResultSchema,
  ValidationResultSchema,
  hashFramedDomain,
  type ChangeProposal,
  type ContentHash,
  type ExecutionPlan,
  type Relation,
} from "@projector/core";
import type { StateBoundChangeResult } from "@projector/engine";
import { z } from "zod";

import type { CompiledRepositoryChange, RepositoryIntentReview } from "./compiler.js";
import type { CapturedRepositoryChange, LifecycleRecoveryOutcome, PlannedRepositoryChange } from "./service.js";
import type { LifecycleApprovalRecord } from "./store.js";

const reviewRelationSchema = z.object({ fromId: z.string(), toId: z.string(), type: z.string(), active: z.boolean().optional() }).strict();
const reviewMetadataSchema = z.object({ scope: z.unknown().optional(), evidence: z.array(z.unknown()).optional(), relation: reviewRelationSchema.optional() }).strict();
const intentSubjectSchema = z.object({ id: z.string(), kind: z.enum(["requirement", "scenario"]), operation: z.enum(["preserve", "add", "revise"]), before: reviewMetadataSchema.optional(), after: reviewMetadataSchema.optional(), rationale: z.string().nullable() }).strict();
const intentMutationSchema = z.object({ id: z.string(), kind: z.enum(["requirement", "behavioral-scenario", "concept", "relation", "lineage", "tombstone", "architecture-decision", "architecture-concern", "developer-preference", "projection-lens", "authority-record"]), operation: z.enum(["add", "revise", "retire"]), before: reviewMetadataSchema.optional(), after: reviewMetadataSchema.optional(), rationale: z.string() }).strict();
const identityResolutionSummarySchema = z.object({ contextId: z.string(), contextHash: ContentHashSchema, outcome: z.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity"]), selectedEntityIds: z.array(z.string()), rationale: z.string(), newBoundary: z.object({ owns: z.array(z.string()), excludes: z.array(z.string()), nearestEntityIds: z.array(z.string()), rationale: z.string() }).strict().optional() }).strict();

export const RepositoryIntentReviewSummarySchema = z.object({
  subjects: z.array(intentSubjectSchema),
  identityResolution: identityResolutionSummarySchema.optional(),
  relations: z.array(RelationSchema),
  canonicalMutations: z.array(intentMutationSchema),
  relatedObligations: z.array(z.object({ id: z.string(), kind: z.string() }).strict()),
  unknowns: z.array(z.string()),
  blockingUnknowns: z.array(z.string()),
  contentHash: ContentHashSchema,
}).strict();

export interface RepositoryIntentReviewSummary {
  readonly subjects: readonly { readonly id: string; readonly kind: "requirement" | "scenario"; readonly operation: "preserve" | "add" | "revise"; readonly before?: ReviewMetadata; readonly after?: ReviewMetadata; readonly rationale: string | null }[];
  readonly identityResolution?: NonNullable<RepositoryIntentReview["identityResolution"]>;
  readonly relations: readonly Relation[];
  readonly canonicalMutations: readonly { readonly id: string; readonly kind: string; readonly operation: "add" | "revise" | "retire"; readonly before?: ReviewMetadata; readonly after?: ReviewMetadata; readonly rationale: string }[];
  readonly relatedObligations: readonly { readonly id: string; readonly kind: string }[];
  readonly unknowns: readonly string[];
  readonly blockingUnknowns: readonly string[];
  readonly contentHash: ContentHash;
}

type ReviewMetadata = z.infer<typeof reviewMetadataSchema>;
function reviewMetadata(value: object | null): ReviewMetadata | undefined {
  if (value === null) return undefined;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (source.scope !== undefined) result.scope = source.scope;
  if (Array.isArray(source.evidence)) result.evidence = source.evidence;
  if (typeof source.fromId === "string" && typeof source.toId === "string" && typeof source.type === "string") {
    result.relation = { fromId: source.fromId, toId: source.toId, type: source.type, ...(typeof source.active === "boolean" ? { active: source.active } : {}) };
  }
  return Object.keys(result).length === 0 ? undefined : reviewMetadataSchema.parse(result);
}

export const LifecycleCaptureOutputSchema = z.object({ kind: z.literal("lifecycle-change"), selector: z.string(), immutablePlanHash: ContentHashSchema, proposalHash: ContentHashSchema, knowledgeContextId: z.string().min(1).optional() }).strict();
export const LifecyclePlanOutputSchema = z.object({ kind: z.literal("lifecycle-plan"), selector: z.string(), immutablePlanHash: ContentHashSchema, preview: z.object({ proposal: ChangeProposalSchema, proposalHash: ContentHashSchema, expectedDiff: z.string(), intentReview: RepositoryIntentReviewSummarySchema }).strict(), plan: ExecutionPlanSchema }).strict().superRefine((value, context) => {
  if (value.preview.proposalHash !== hashFramedDomain("repository-change-proposal", value.preview.proposal)) context.addIssue({ code: "custom", message: "proposal hash does not authenticate the public review payload", path: ["preview", "proposalHash"] });
});
export const LifecycleApprovalOutputSchema = z.object({ kind: z.literal("lifecycle-approval"), selector: z.string(), changeSelector: z.string(), immutablePlanHash: ContentHashSchema }).strict();
export const LifecycleRecoveryOutcomeSchema = z.object({ attemptId: z.string(), transactionId: z.string(), action: z.enum(["finalized", "rolled-back", "no-transaction", "recovery-required"]), reason: z.string().optional() }).strict();
export const LifecycleRecoveryOutputSchema = z.object({ kind: z.literal("lifecycle-recovery"), selector: z.string(), outcomes: z.array(LifecycleRecoveryOutcomeSchema) }).strict();

export const StateBoundChangeResultSchema = z.object({
  outcome: z.enum(["success", "failure", "partial"]), reasons: z.array(z.string()), preview: TransformPreviewSchema.optional(), transformResult: TransformResultSchema.optional(), validations: z.array(ValidationResultSchema), certificate: ChangeCertificateSchema, certificateHash: ContentHashSchema, certificateRef: z.string(), receipt: TransactionReceiptSchema, receiptHash: ContentHashSchema, receiptRef: z.string(),
}).strict();
export const LifecycleApplyOutputSchema = StateBoundChangeResultSchema.extend({ kind: z.literal("lifecycle-apply"), selector: z.string() });

export type LifecycleCaptureOutput = z.infer<typeof LifecycleCaptureOutputSchema>;
export type LifecyclePlanOutput = Omit<z.infer<typeof LifecyclePlanOutputSchema>, "plan" | "preview"> & { readonly preview: { readonly proposal: ChangeProposal; readonly proposalHash: ContentHash; readonly expectedDiff: string; readonly intentReview: RepositoryIntentReviewSummary }; readonly plan: ExecutionPlan };
export type LifecycleApprovalOutput = z.infer<typeof LifecycleApprovalOutputSchema>;
export type LifecycleRecoveryOutput = z.infer<typeof LifecycleRecoveryOutputSchema>;
export type LifecycleApplyOutput = StateBoundChangeResult & { readonly kind: "lifecycle-apply"; readonly selector: string };

export function summarizeRepositoryIntentReview(review: RepositoryIntentReview): RepositoryIntentReviewSummary {
  return RepositoryIntentReviewSummarySchema.parse({
    subjects: review.subjects.map(({ id, kind, operation, before, after, rationale }) => ({ id, kind, operation, ...(reviewMetadata(before) === undefined ? {} : { before: reviewMetadata(before) }), ...(reviewMetadata(after) === undefined ? {} : { after: reviewMetadata(after) }), rationale })),
    ...(review.identityResolution === undefined ? {} : { identityResolution: review.identityResolution }),
    relations: review.relations,
    canonicalMutations: (review.canonicalMutations ?? []).map(({ id, kind, operation, before, after, rationale }) => ({ id, kind, operation, ...(reviewMetadata(before) === undefined ? {} : { before: reviewMetadata(before) }), ...(reviewMetadata(after) === undefined ? {} : { after: reviewMetadata(after) }), rationale })),
    relatedObligations: review.relatedObligations.map(({ id, kind }) => ({ id, kind })),
    unknowns: review.unknowns,
    blockingUnknowns: review.blockingUnknowns,
    contentHash: review.contentHash,
  }) as RepositoryIntentReviewSummary;
}

export function projectLifecycleCapture(value: CapturedRepositoryChange): LifecycleCaptureOutput {
  return LifecycleCaptureOutputSchema.parse({ kind: "lifecycle-change", selector: value.capture.semanticChangeId, immutablePlanHash: value.capture.planHash, proposalHash: value.capture.proposalHash, ...(value.capture.knowledgeContextId === undefined ? {} : { knowledgeContextId: value.capture.knowledgeContextId }) });
}

export function projectLifecyclePlan(selector: string, value: PlannedRepositoryChange): LifecyclePlanOutput {
  return LifecyclePlanOutputSchema.parse({ kind: "lifecycle-plan", selector, immutablePlanHash: value.capture.planHash, preview: { proposal: value.capture.proposal, proposalHash: value.capture.proposalHash, expectedDiff: expectedDiff(value.compiled), intentReview: summarizeRepositoryIntentReview(value.compiled.intentReview) }, plan: value.compiled.compiledPlan.plan }) as LifecyclePlanOutput;
}

export function projectLifecycleApproval(value: LifecycleApprovalRecord): LifecycleApprovalOutput {
  return LifecycleApprovalOutputSchema.parse({ kind: "lifecycle-approval", selector: value.id, changeSelector: value.semanticChangeId, immutablePlanHash: value.planHash });
}

export function projectLifecycleApply(selector: string, value: StateBoundChangeResult): LifecycleApplyOutput { return LifecycleApplyOutputSchema.parse({ kind: "lifecycle-apply", selector, ...value }) as LifecycleApplyOutput; }
export function projectLifecycleRecovery(selector: string, outcomes: readonly LifecycleRecoveryOutcome[]): LifecycleRecoveryOutput { return LifecycleRecoveryOutputSchema.parse({ kind: "lifecycle-recovery", selector, outcomes }); }

function expectedDiff(compiled: CompiledRepositoryChange): string {
  return compiled.exactPatchInput.edits.map(({ path, before, after }) => `${before === null ? "create" : after === null ? "delete" : "replace"} ${path}`).join("\n");
}
