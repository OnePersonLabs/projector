import { z } from "zod";

import type { ContentHash } from "../domain/contracts.js";
import { hashFramedDomain } from "../hashing/canonical-json.js";
import { ContentHashSchema, EntityIdSchema } from "./contracts.js";

export const applicationObservationPlanSchemaVersion = "application-observation-plan@1" as const;
export const applicationObservationResultSchemaVersion = "application-observation-result@1" as const;

const boundedIdentity = z.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
const diagnostic = z.strictObject({
  code: boundedIdentity,
  message: z.string().min(1).max(4_096),
});

const scenarioBinding = z.strictObject({
  id: EntityIdSchema,
  semanticHash: ContentHashSchema,
});

const cleanup = z.strictObject({
  complete: z.boolean(),
  resources: z.array(z.strictObject({
    kind: boundedIdentity,
    handle: boundedIdentity,
    outcome: z.enum(["released", "not-found", "retained-for-recovery", "release-failed"]),
  })).max(256),
  diagnostics: z.array(diagnostic).max(64),
});

const recovery = z.strictObject({
  code: boundedIdentity,
  message: z.string().min(1).max(4_096),
  action: z.string().min(1).max(4_096),
  artifactRefs: z.array(boundedIdentity).max(64),
});

export function hashApplicationObservationInput(adapterId: string, adapterVersion: string, input: unknown) {
  return hashFramedDomain("application-observation-adapter-input:v1", { adapterId, adapterVersion, input });
}

export function hashApplicationObservationOutput(adapterId: string, adapterVersion: string, output: unknown) {
  return hashFramedDomain("application-observation-adapter-output:v1", { adapterId, adapterVersion, output });
}

export function createApplicationObservationContractSchemas<
  const TAdapterId extends string,
  const TAdapterVersion extends string,
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
>(input: {
  readonly adapterId: TAdapterId;
  readonly adapterVersion: TAdapterVersion;
  readonly adapterInputSchema: TInputSchema;
  readonly adapterOutputSchema: TOutputSchema;
}) {
  boundedIdentity.parse(input.adapterId);
  boundedIdentity.parse(input.adapterVersion);

  const ApplicationObservationPlanSchema = z.strictObject({
    schemaVersion: z.literal(applicationObservationPlanSchemaVersion),
    runId: boundedIdentity,
    scenario: scenarioBinding,
    case: boundedIdentity,
    adapter: z.strictObject({
      id: z.literal(input.adapterId),
      version: z.literal(input.adapterVersion),
      inputHash: ContentHashSchema,
      input: input.adapterInputSchema,
    }),
  }).superRefine((plan, context) => {
    const adapter = plan.adapter as { readonly input: unknown; readonly inputHash: string };
    const actual = hashApplicationObservationInput(input.adapterId, input.adapterVersion, adapter.input);
    if (actual !== adapter.inputHash) {
      context.addIssue({ code: "custom", path: ["adapter", "inputHash"], message: "adapter input hash does not match the strict parsed input" });
    }
  });

  const ApplicationObservationResultSchema = z.strictObject({
    schemaVersion: z.literal(applicationObservationResultSchemaVersion),
    runId: boundedIdentity,
    scenario: scenarioBinding,
    case: boundedIdentity,
    adapter: z.strictObject({
      id: z.literal(input.adapterId),
      version: z.literal(input.adapterVersion),
      inputHash: ContentHashSchema,
      outputHash: ContentHashSchema,
      output: input.adapterOutputSchema,
    }),
    operationalStatus: z.enum(["completed", "failed", "cancelled"]),
    outcome: z.enum(["passed", "failed", "unavailable"]),
    currentness: z.enum(["current", "stale", "unknown"]),
    assurance: z.literal("supporting"),
    diagnostics: z.array(diagnostic).max(64),
    cleanup,
    recovery: recovery.optional(),
  }).superRefine((result, context) => {
    const adapter = result.adapter as { readonly output: unknown; readonly outputHash: string };
    const actual = hashApplicationObservationOutput(input.adapterId, input.adapterVersion, adapter.output);
    if (actual !== adapter.outputHash) {
      context.addIssue({ code: "custom", path: ["adapter", "outputHash"], message: "adapter output hash does not match the strict parsed output" });
    }
    if (result.outcome === "passed" && (result.operationalStatus !== "completed" || result.currentness !== "current" || !result.cleanup.complete)) {
      context.addIssue({ code: "custom", path: ["outcome"], message: "passed evidence requires completed operation, current inputs, and complete cleanup" });
    }
    if (result.operationalStatus !== "completed" && result.outcome !== "unavailable") {
      context.addIssue({ code: "custom", path: ["outcome"], message: "an operation that did not complete cannot report a behavioral outcome" });
    }
    const resourcesReleased = result.cleanup.resources.every(({ outcome }) => outcome === "released" || outcome === "not-found");
    if (result.cleanup.complete !== resourcesReleased) {
      context.addIssue({ code: "custom", path: ["cleanup", "complete"], message: "cleanup is complete exactly when every owned resource was released or already absent" });
    }
    if (!result.cleanup.complete && result.recovery === undefined) {
      context.addIssue({ code: "custom", path: ["recovery"], message: "incomplete cleanup requires an explicit recovery action" });
    }
  });

  const ApplicationObservationExchangeSchema = z.strictObject({
    plan: ApplicationObservationPlanSchema,
    result: ApplicationObservationResultSchema,
  }).superRefine(({ plan, result }, context) => {
    const mismatches = [
      ["runId", plan.runId, result.runId],
      ["scenario.id", plan.scenario.id, result.scenario.id],
      ["scenario.semanticHash", plan.scenario.semanticHash, result.scenario.semanticHash],
      ["case", plan.case, result.case],
      ["adapter.id", plan.adapter.id, result.adapter.id],
      ["adapter.version", plan.adapter.version, result.adapter.version],
      ["adapter.inputHash", plan.adapter.inputHash, result.adapter.inputHash],
    ] as const;
    for (const [field, expected, actual] of mismatches) {
      if (expected !== actual) context.addIssue({ code: "custom", path: ["result", ...field.split(".")], message: `result ${field} does not match the exact observation plan` });
    }
  });

  return Object.freeze({ ApplicationObservationPlanSchema, ApplicationObservationResultSchema, ApplicationObservationExchangeSchema });
}

export type ApplicationObservationPlan<
  TInput,
  TAdapterId extends string = string,
  TAdapterVersion extends string = string,
> = {
  readonly schemaVersion: typeof applicationObservationPlanSchemaVersion;
  readonly runId: string;
  readonly scenario: { readonly id: string; readonly semanticHash: ContentHash };
  readonly case: string;
  readonly adapter: { readonly id: TAdapterId; readonly version: TAdapterVersion; readonly inputHash: ContentHash; readonly input: TInput };
};

export type ApplicationObservationResult<
  TOutput,
  TAdapterId extends string = string,
  TAdapterVersion extends string = string,
> = {
  readonly schemaVersion: typeof applicationObservationResultSchemaVersion;
  readonly runId: string;
  readonly scenario: { readonly id: string; readonly semanticHash: ContentHash };
  readonly case: string;
  readonly adapter: { readonly id: TAdapterId; readonly version: TAdapterVersion; readonly inputHash: ContentHash; readonly outputHash: ContentHash; readonly output: TOutput };
  readonly operationalStatus: "completed" | "failed" | "cancelled";
  readonly outcome: "passed" | "failed" | "unavailable";
  readonly currentness: "current" | "stale" | "unknown";
  readonly assurance: "supporting";
  readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
  readonly cleanup: {
    readonly complete: boolean;
    readonly resources: readonly { readonly kind: string; readonly handle: string; readonly outcome: "released" | "not-found" | "retained-for-recovery" | "release-failed" }[];
    readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
  };
  readonly recovery?: {
    readonly code: string;
    readonly message: string;
    readonly action: string;
    readonly artifactRefs: readonly string[];
  };
};
