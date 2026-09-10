import { AnalyzerFailureSchema, ContentHashSchema, CoverageLaneSchema, CoverageSnapshotSchema, StateBindingSchema, StateBindingValidationSchema, type AnalyzerFailure, type ContentHash, type CoverageSnapshot, type StateBinding, type StateBindingValidation } from "@projector/core";
import { z } from "zod";
import type { CompletionQuestion } from "./issues.js";

export const CompletionQuestionSchema = z.object({
  id: z.string(), kind: z.enum(["governance", "unmapped-group", "unrealized-requirement", "unrealized-scenario", "identity-overlap", "architecture-concern"]), blocking: z.boolean(), ownerIds: z.array(z.string()), affectedCount: z.number().int().nonnegative(), subjectCount: z.number().int().nonnegative(), examples: z.array(z.string()), question: z.string(), reasons: z.array(z.string()), reasonCount: z.number().int().nonnegative(), evidenceHash: ContentHashSchema,
  resolution: z.object({ context: z.object({ command: z.literal("context"), request: z.string(), entities: z.array(z.string()), namedTargets: z.array(z.string()) }).strict(), route: z.literal("canonical-proposal"), instruction: z.string() }).strict(),
}).strict();

const disclosureSchema = z.object({ total: z.number().int().nonnegative(), included: z.number().int().nonnegative(), omitted: z.number().int().nonnegative(), blocking: z.number().int().nonnegative() }).strict();
const completionSchema = z.object({
  readOnly: z.literal(true), disclosure: disclosureSchema, questions: z.array(CompletionQuestionSchema), questionDisclosure: disclosureSchema,
  questionPage: z.object({ offset: z.number().int().nonnegative(), nextOffset: z.number().int().nonnegative().nullable(), note: z.string() }).strict(), ranking: z.string(), limits: z.array(z.string()), estimatedQuestionTokens: z.number().int().nonnegative(),
  repairPlan: z.array(z.object({ order: z.number().int().positive(), questionId: z.string(), evidenceHash: ContentHashSchema, resolution: CompletionQuestionSchema.shape.resolution }).strict()).optional(), execution: z.literal("not-performed").optional(),
}).strict();

const RepositoryCoverageResultBaseSchema = z.object({
  proofStatement: z.enum(["proven-within-boundary", "bounded", "high-confidence", "partial", "not-established"]), boundary: z.array(z.string()), lanes: z.array(CoverageLaneSchema), unavailableSurfaceIds: z.array(z.string()), approvalRequired: z.literal(false), budgetExhausted: z.boolean(), continuationPersisted: z.literal(false), snapshot: CoverageSnapshotSchema, boundState: StateBindingSchema, bindingValidation: StateBindingValidationSchema, bindingIdentity: ContentHashSchema,
  localAnalysis: z.object({ artifactCount: z.number().int().nonnegative(), projectionUnitCount: z.number().int().nonnegative(), dependencyCount: z.number().int().nonnegative(), analyzerFailureCount: z.number().int().nonnegative(), analyzerFailures: z.array(AnalyzerFailureSchema) }).strict(), completion: completionSchema,
}).strict();

export const RepositoryCoverageOutputSchema = RepositoryCoverageResultBaseSchema.superRefine((value, context) => {
  if (value.completion.questions.length !== 0 || value.completion.repairPlan !== undefined || value.completion.execution !== undefined) context.addIssue({ code: "custom", message: "coverage output cannot disclose questions or a repair plan", path: ["completion"] });
});
export const RepositoryCompletionOutputSchema = RepositoryCoverageResultBaseSchema.superRefine((value, context) => {
  if (value.completion.repairPlan !== undefined || value.completion.execution !== undefined) context.addIssue({ code: "custom", message: "completion output cannot claim a cleanup plan", path: ["completion"] });
});
export const RepositoryCleanupOutputSchema = RepositoryCoverageResultBaseSchema.superRefine((value, context) => {
  if (value.completion.repairPlan === undefined || value.completion.execution !== "not-performed") context.addIssue({ code: "custom", message: "cleanup output must expose its non-executed repair plan", path: ["completion"] });
});

interface CoverageDisclosure { readonly total: number; readonly included: number; readonly omitted: number; readonly blocking: number }
export interface RepositoryCoverageResult {
  readonly proofStatement: CoverageSnapshot["proofStatement"];
  readonly boundary: readonly string[];
  readonly lanes: CoverageSnapshot["lanes"];
  readonly unavailableSurfaceIds: readonly string[];
  readonly approvalRequired: false;
  readonly budgetExhausted: boolean;
  readonly continuationPersisted: false;
  readonly snapshot: CoverageSnapshot;
  readonly boundState: StateBinding;
  readonly bindingValidation: StateBindingValidation;
  readonly bindingIdentity: ContentHash;
  readonly localAnalysis: { readonly artifactCount: number; readonly projectionUnitCount: number; readonly dependencyCount: number; readonly analyzerFailureCount: number; readonly analyzerFailures: readonly AnalyzerFailure[] };
  readonly completion: { readonly readOnly: true; readonly disclosure: CoverageDisclosure; readonly questions: readonly CompletionQuestion[]; readonly questionDisclosure: CoverageDisclosure; readonly questionPage: { readonly offset: number; readonly nextOffset: number | null; readonly note: string }; readonly ranking: string; readonly limits: readonly string[]; readonly estimatedQuestionTokens: number; readonly repairPlan?: readonly { readonly order: number; readonly questionId: string; readonly evidenceHash: ContentHash; readonly resolution: CompletionQuestion["resolution"] }[]; readonly execution?: "not-performed" };
}
export type RepositoryCoverageMode = "coverage" | "complete" | "cleanup";

export function parseRepositoryCoverageResult(mode: RepositoryCoverageMode, value: unknown): RepositoryCoverageResult {
  const schema = mode === "coverage" ? RepositoryCoverageOutputSchema : mode === "complete" ? RepositoryCompletionOutputSchema : RepositoryCleanupOutputSchema;
  return schema.parse(value) as RepositoryCoverageResult;
}
