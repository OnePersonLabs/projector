import { z } from "zod";
import { ObservationLimitsOverrideSchema, ObservationLimitsSchema } from "../observation.js";

import { ContentHashSchema } from "./contracts.js";
import { ChangeProposalSchema } from "./change-proposal.js";
import { ArchitectureEvaluationRequestSchema } from "./architecture-evaluation.js";
import { VerificationRequestSchema, BuiltinVerificationOperationSchema } from "./verification.js";
import { GeneratedOutputRequestSchema } from "./generated-output.js";
import { GitIntegrationRequestSchema } from "./git-integration.js";
import { CodeQueryRequestSchema, CodeIndexRequestSchema, CodeIndexStatusRequestSchema, CodeIndexWaitRequestSchema, CodeIndexCancelRequestSchema, CodeImpactRequestSchema, CodeTestsRequestSchema, CodeTestRunRequestSchema, CodeEvidenceRequestSchema, CodeExportRequestSchema } from "../code-workflows.js";

export const projectorOperationApiVersion = "projector.operation/v1" as const;
export const projectorOperationResultApiVersion = "projector.operation-result/v1" as const;

export const ProjectorOperationSchema = z.enum([
  "status",
  "init",
  "context",
  "reconcile",
  "repository.check",
  "repository.integration",
  "operation-access.recover",
  "change.capture",
  "change.plan",
  "change.approve",
  "change.apply",
  "change.recover",
  "coverage",
  "complete",
  "cleanup",
  "verify",
  "representation.inspect",
  "representation.reconcile",
  "representation.recover",
  "representation.pending",
  "architecture.evaluate",
  "verification.execute",
  "verification.builtin",
  "verification.inspect",
  "verification.recover",
  "generated.execute",
  "generated.inspect",
  "generated.recover",
  "application.observe",
  "code.query",
  "code.index",
  "code.index-status",
  "code.index-wait",
  "code.index-cancel",
  "code.impact",
  "code.tests",
  "code.test-run",
  "code.evidence",
  "code.export",
]);

export type ProjectorOperation = z.infer<typeof ProjectorOperationSchema>;

const requestBase = {
  apiVersion: z.literal(projectorOperationApiVersion),
  repositoryRoot: z.string().min(1),
  requestId: z.string().min(1).optional(),
  observationLimits: ObservationLimitsOverrideSchema.optional(),
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
  "code.query": CodeQueryRequestSchema,
  "code.index": CodeIndexRequestSchema,
  "code.index-status": CodeIndexStatusRequestSchema,
  "code.index-wait": CodeIndexWaitRequestSchema,
  "code.index-cancel": CodeIndexCancelRequestSchema,
  "code.impact": CodeImpactRequestSchema,
  "code.tests": CodeTestsRequestSchema,
  "code.test-run": CodeTestRunRequestSchema,
  "code.evidence": CodeEvidenceRequestSchema,
  "code.export": CodeExportRequestSchema,
  status: z.strictObject({}),
  init: z.strictObject({}),
  context: z.strictObject({
    view: z.enum(["agent", "full"]).optional(),
    request: z.string().min(1).max(4_096),
    entities: z.array(z.string().min(1).max(512)).max(64).optional(),
    namedTargets: z.array(z.string().min(1).max(1_024)).max(64).optional(),
    operation: z.string().min(1).max(160).optional(),
    persist: z.boolean().optional(),
    policy: knowledgePolicy.optional(),
  }),
  reconcile: z.strictObject({ contextId: z.string().min(1), view: z.enum(["agent", "full"]).optional() }),
  "repository.check": z.strictObject({
    mode: z.enum(["full", "commit-only"]).optional(),
    sessionId: z.string().min(1).max(512).optional(),
    handled: z.strictObject({ findingId: z.string().min(1).max(128), evidenceIdentity: ContentHashSchema }).optional(),
  }),
  "repository.integration": GitIntegrationRequestSchema,
  "operation-access.recover": z.strictObject({}),
  "change.capture": z.strictObject({ request: z.string().min(1), proposal: ChangeProposalSchema, contextId: z.string().min(1).optional() }),
  "change.plan": z.strictObject({ changeSelector: z.string().min(1) }),
  "change.approve": z.strictObject({ changeSelector: z.string().min(1), planHash: ContentHashSchema }),
  "change.apply": z.strictObject({ approvalSelector: z.string().min(1) }),
  "change.recover": z.strictObject({ approvalSelector: z.string().min(1) }),
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
  "representation.reconcile": z.strictObject({
    changeSelector: z.string().min(1),
    approvalSelector: z.string().min(1).optional(),
  }),
  "representation.recover": z.strictObject({}),
  "representation.pending": z.strictObject({}),
  "architecture.evaluate": ArchitectureEvaluationRequestSchema,
  "verification.execute": VerificationRequestSchema,
  "verification.builtin": z.strictObject({ command: BuiltinVerificationOperationSchema }),
  "verification.inspect": z.strictObject({ eventIds: z.array(z.string().min(1)).optional() }),
  "verification.recover": z.strictObject({}),
  "generated.execute": z.strictObject({ generation: GeneratedOutputRequestSchema }),
  "generated.inspect": z.strictObject({ activeProducerIds: z.array(z.string().min(1)) }),
  "generated.recover": z.strictObject({ activeProducerIds: z.array(z.string().min(1)) }),
});

export const ProjectorOperationRequestSchema = z.discriminatedUnion("operation", [
  createProjectorOperationRequestSchema("code.query", ProjectorOperationInputSchemas["code.query"]),
  createProjectorOperationRequestSchema("code.index", ProjectorOperationInputSchemas["code.index"]),
  createProjectorOperationRequestSchema("code.index-status", ProjectorOperationInputSchemas["code.index-status"]),
  createProjectorOperationRequestSchema("code.index-wait", ProjectorOperationInputSchemas["code.index-wait"]),
  createProjectorOperationRequestSchema("code.index-cancel", ProjectorOperationInputSchemas["code.index-cancel"]),
  createProjectorOperationRequestSchema("code.impact", ProjectorOperationInputSchemas["code.impact"]),
  createProjectorOperationRequestSchema("code.tests", ProjectorOperationInputSchemas["code.tests"]),
  createProjectorOperationRequestSchema("code.test-run", ProjectorOperationInputSchemas["code.test-run"]),
  createProjectorOperationRequestSchema("code.evidence", ProjectorOperationInputSchemas["code.evidence"]),
  createProjectorOperationRequestSchema("code.export", ProjectorOperationInputSchemas["code.export"]),
  createProjectorOperationRequestSchema("status", ProjectorOperationInputSchemas.status),
  createProjectorOperationRequestSchema("init", ProjectorOperationInputSchemas.init),
  createProjectorOperationRequestSchema("context", ProjectorOperationInputSchemas.context),
  createProjectorOperationRequestSchema("reconcile", ProjectorOperationInputSchemas.reconcile),
  createProjectorOperationRequestSchema("repository.check", ProjectorOperationInputSchemas["repository.check"]),
  createProjectorOperationRequestSchema("repository.integration", ProjectorOperationInputSchemas["repository.integration"]),
  createProjectorOperationRequestSchema("operation-access.recover", ProjectorOperationInputSchemas["operation-access.recover"]),
  createProjectorOperationRequestSchema("change.capture", ProjectorOperationInputSchemas["change.capture"]),
  createProjectorOperationRequestSchema("change.plan", ProjectorOperationInputSchemas["change.plan"]),
  createProjectorOperationRequestSchema("change.approve", ProjectorOperationInputSchemas["change.approve"]),
  createProjectorOperationRequestSchema("change.apply", ProjectorOperationInputSchemas["change.apply"]),
  createProjectorOperationRequestSchema("change.recover", ProjectorOperationInputSchemas["change.recover"]),
  createProjectorOperationRequestSchema("coverage", ProjectorOperationInputSchemas.coverage),
  createProjectorOperationRequestSchema("complete", ProjectorOperationInputSchemas.complete),
  createProjectorOperationRequestSchema("cleanup", ProjectorOperationInputSchemas.cleanup),
  createProjectorOperationRequestSchema("verify", ProjectorOperationInputSchemas.verify),
  createProjectorOperationRequestSchema("representation.inspect", ProjectorOperationInputSchemas["representation.inspect"]),
  createProjectorOperationRequestSchema("representation.reconcile", ProjectorOperationInputSchemas["representation.reconcile"]),
  createProjectorOperationRequestSchema("representation.recover", ProjectorOperationInputSchemas["representation.recover"]),
  createProjectorOperationRequestSchema("representation.pending", ProjectorOperationInputSchemas["representation.pending"]),
  createProjectorOperationRequestSchema("architecture.evaluate", ProjectorOperationInputSchemas["architecture.evaluate"]),
  createProjectorOperationRequestSchema("verification.execute", ProjectorOperationInputSchemas["verification.execute"]),
  createProjectorOperationRequestSchema("verification.builtin", ProjectorOperationInputSchemas["verification.builtin"]),
  createProjectorOperationRequestSchema("verification.inspect", ProjectorOperationInputSchemas["verification.inspect"]),
  createProjectorOperationRequestSchema("verification.recover", ProjectorOperationInputSchemas["verification.recover"]),
  createProjectorOperationRequestSchema("generated.execute", ProjectorOperationInputSchemas["generated.execute"]),
  createProjectorOperationRequestSchema("generated.inspect", ProjectorOperationInputSchemas["generated.inspect"]),
  createProjectorOperationRequestSchema("generated.recover", ProjectorOperationInputSchemas["generated.recover"]),
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
  observation: z.strictObject({
    stage: z.string().min(1),
    scope: z.string().min(1),
    limit: ObservationLimitsSchema.keyof().optional(),
    observed: z.number().nonnegative().optional(),
  }).optional(),
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
