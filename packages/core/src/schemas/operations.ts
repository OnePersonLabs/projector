import { z } from "zod";

import { ContentHashSchema } from "./contracts.js";
import { ChangeProposalSchema } from "./change-proposal.js";

export const projectorOperationApiVersion = "projector.operation/v1" as const;
export const projectorOperationResultApiVersion = "projector.operation-result/v1" as const;

export const ProjectorOperationSchema = z.enum([
  "status",
  "init",
  "context",
  "reconcile",
  "change.capture",
  "change.plan",
  "change.approve",
  "change.apply",
  "change.recover",
  "change.resume",
  "coverage",
  "complete",
  "cleanup",
  "verify",
]);

export type ProjectorOperation = z.infer<typeof ProjectorOperationSchema>;

const requestBase = {
  apiVersion: z.literal(projectorOperationApiVersion),
  repositoryRoot: z.string().min(1),
  requestId: z.string().min(1).optional(),
};

const request = <TOperation extends ProjectorOperation, TInput extends z.core.$ZodLooseShape>(
  operation: TOperation,
  input: TInput,
) => z.strictObject({ ...requestBase, operation: z.literal(operation), input: z.strictObject(input) });

const boundedInspectionInput = {
  scope: z.string().min(1).optional(),
  budgetTokens: z.number().int().nonnegative().optional(),
  budgetCost: z.number().nonnegative().optional(),
  questionOffset: z.number().int().nonnegative().optional(),
};

const knowledgePolicy = z.strictObject({
  maxCandidates: z.number().int().positive().max(10_000).optional(),
  maxEntries: z.number().int().positive().max(10_000).optional(),
  maxDepth: z.number().int().nonnegative().max(1_000).optional(),
  maxTraversalCost: z.number().int().positive().max(10_000_000).optional(),
  minimumScore: z.number().min(0).max(1).optional(),
  maxContextCost: z.number().int().positive().max(10_000_000).optional(),
});

export const ProjectorOperationRequestSchema = z.discriminatedUnion("operation", [
  request("status", {}),
  request("init", {}),
  request("context", {
    request: z.string().min(1).max(4_096),
    entities: z.array(z.string().min(1).max(512)).max(64).optional(),
    namedTargets: z.array(z.string().min(1).max(1_024)).max(64).optional(),
    operation: z.string().min(1).max(160).optional(),
    persist: z.boolean().optional(),
    policy: knowledgePolicy.optional(),
  }),
  request("reconcile", { contextId: z.string().min(1) }),
  request("change.capture", { request: z.string().min(1), proposal: ChangeProposalSchema, contextId: z.string().min(1).optional() }),
  request("change.plan", { changeSelector: z.string().min(1) }),
  request("change.approve", { changeSelector: z.string().min(1), planHash: ContentHashSchema }),
  request("change.apply", { approvalSelector: z.string().min(1) }),
  request("change.recover", { approvalSelector: z.string().min(1) }),
  request("change.resume", { approvalSelector: z.string().min(1) }),
  request("coverage", boundedInspectionInput),
  request("complete", boundedInspectionInput),
  request("cleanup", boundedInspectionInput),
  request("verify", {}),
]);

export type ProjectorOperationRequest = z.infer<typeof ProjectorOperationRequestSchema>;

export interface ProjectorOperationEnvironment {
  readonly signal: AbortSignal;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

export const PackageVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u,
  "must be a numeric semantic version",
);

export const PackageIdentitySchema = z.strictObject({
  name: z.string().min(1),
  version: PackageVersionSchema,
});

export type PackageIdentity = z.infer<typeof PackageIdentitySchema>;

export const ProjectReadinessStatusSchema = z.enum([
  "ready",
  "inactive",
  "upgrade-required",
  "recovery-required",
  "busy",
  "unavailable",
]);

export const ProjectReadinessSchema = z.strictObject({
  status: ProjectReadinessStatusSchema,
  package: PackageIdentitySchema,
  observed: z.strictObject({
    configApiVersion: z.string().min(1),
    preparedProjectorVersion: PackageVersionSchema.optional(),
  }).optional(),
  reason: z.string().min(1).optional(),
  recovery: z.strictObject({
    code: z.string().min(1),
    location: z.string().min(1).optional(),
    action: z.string().min(1),
  }).optional(),
});

export type ProjectReadiness = z.infer<typeof ProjectReadinessSchema>;

export const ProjectorOperationErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  retriable: z.boolean(),
});

export const ProjectorOperationActionSchema = z.strictObject({
  kind: z.enum(["approval-required", "recovery-required", "retry", "activate", "upgrade"]),
  operation: ProjectorOperationSchema,
  selector: z.string().min(1).optional(),
  reason: z.string().min(1),
});

export type ProjectorOperationError = z.infer<typeof ProjectorOperationErrorSchema>;
export type ProjectorOperationAction = z.infer<typeof ProjectorOperationActionSchema>;

export function createProjectorOperationResultSchema<
  const TOperation extends ProjectorOperation,
  TOutputSchema extends z.ZodType,
>(operation: TOperation, outputSchema: TOutputSchema) {
  const base = {
    apiVersion: z.literal(projectorOperationResultApiVersion),
    operation: z.literal(operation),
    package: PackageIdentitySchema,
    requestId: z.string().min(1).optional(),
    exitCode: z.number().int(),
    readiness: ProjectReadinessSchema,
  };
  const unsuccessful = {
    ...base,
    error: ProjectorOperationErrorSchema,
    action: ProjectorOperationActionSchema.optional(),
    output: outputSchema.optional(),
  };
  return z.discriminatedUnion("status", [
    z.strictObject({ ...base, status: z.literal("succeeded"), output: outputSchema }),
    z.strictObject({ ...unsuccessful, status: z.literal("failed") }),
    z.strictObject({ ...unsuccessful, status: z.literal("unavailable") }),
    z.strictObject({ ...unsuccessful, status: z.literal("cancelled") }),
  ]);
}
