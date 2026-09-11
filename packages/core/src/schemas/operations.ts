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
  "representation.inspect",
  "application.observe",
]);

export type ProjectorOperation = z.infer<typeof ProjectorOperationSchema>;

const requestBase = {
  apiVersion: z.literal(projectorOperationApiVersion),
  repositoryRoot: z.string().min(1),
  requestId: z.string().min(1).optional(),
};

export function createProjectorOperationRequestSchema<
  const TOperation extends ProjectorOperation,
  const TInputSchema extends z.ZodObject,
>(operation: TOperation, inputSchema: TInputSchema) {
  return z.strictObject({ ...requestBase, operation: z.literal(operation), input: inputSchema.strict() });
}

export type ProjectorOperationRequestFor<
  TOperation extends ProjectorOperation,
  TInputSchema extends z.ZodObject,
> = z.infer<ReturnType<typeof createProjectorOperationRequestSchema<TOperation, TInputSchema>>>;

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

export const ProjectorOperationInputSchemas = Object.freeze({
  status: z.strictObject({}),
  init: z.strictObject({}),
  context: z.strictObject({
    request: z.string().min(1).max(4_096),
    entities: z.array(z.string().min(1).max(512)).max(64).optional(),
    namedTargets: z.array(z.string().min(1).max(1_024)).max(64).optional(),
    operation: z.string().min(1).max(160).optional(),
    persist: z.boolean().optional(),
    policy: knowledgePolicy.optional(),
  }),
  reconcile: z.strictObject({ contextId: z.string().min(1) }),
  "change.capture": z.strictObject({ request: z.string().min(1), proposal: ChangeProposalSchema, contextId: z.string().min(1).optional() }),
  "change.plan": z.strictObject({ changeSelector: z.string().min(1) }),
  "change.approve": z.strictObject({ changeSelector: z.string().min(1), planHash: ContentHashSchema }),
  "change.apply": z.strictObject({ approvalSelector: z.string().min(1) }),
  "change.recover": z.strictObject({ approvalSelector: z.string().min(1) }),
  "change.resume": z.strictObject({ approvalSelector: z.string().min(1) }),
  coverage: z.strictObject(boundedInspectionInput),
  complete: z.strictObject(boundedInspectionInput),
  cleanup: z.strictObject({
    ...boundedInspectionInput,
    contextId: z.string().min(1).optional(),
    changeSelector: z.string().min(1).optional(),
    approvalSelector: z.string().min(1).optional(),
    evidenceOffset: z.number().int().nonnegative().optional(),
    evidenceLimit: z.number().int().positive().max(50).optional(),
    evidenceIdentity: ContentHashSchema.optional(),
  }),
  verify: z.strictObject({}),
  "representation.inspect": z.strictObject({
    changeSelector: z.string().min(1),
    capsuleId: z.string().min(1).optional(),
    approvalSelector: z.string().min(1).optional(),
    view: z.enum(["summary", "content"]),
  }),
});

export const ProjectorOperationRequestSchema = z.discriminatedUnion("operation", [
  createProjectorOperationRequestSchema("status", ProjectorOperationInputSchemas.status),
  createProjectorOperationRequestSchema("init", ProjectorOperationInputSchemas.init),
  createProjectorOperationRequestSchema("context", ProjectorOperationInputSchemas.context),
  createProjectorOperationRequestSchema("reconcile", ProjectorOperationInputSchemas.reconcile),
  createProjectorOperationRequestSchema("change.capture", ProjectorOperationInputSchemas["change.capture"]),
  createProjectorOperationRequestSchema("change.plan", ProjectorOperationInputSchemas["change.plan"]),
  createProjectorOperationRequestSchema("change.approve", ProjectorOperationInputSchemas["change.approve"]),
  createProjectorOperationRequestSchema("change.apply", ProjectorOperationInputSchemas["change.apply"]),
  createProjectorOperationRequestSchema("change.recover", ProjectorOperationInputSchemas["change.recover"]),
  createProjectorOperationRequestSchema("change.resume", ProjectorOperationInputSchemas["change.resume"]),
  createProjectorOperationRequestSchema("coverage", ProjectorOperationInputSchemas.coverage),
  createProjectorOperationRequestSchema("complete", ProjectorOperationInputSchemas.complete),
  createProjectorOperationRequestSchema("cleanup", ProjectorOperationInputSchemas.cleanup),
  createProjectorOperationRequestSchema("verify", ProjectorOperationInputSchemas.verify),
  createProjectorOperationRequestSchema("representation.inspect", ProjectorOperationInputSchemas["representation.inspect"]),
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
