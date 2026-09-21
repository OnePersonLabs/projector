import { z } from "zod";

import type { ContentHash, StateValueDependencyRef } from "../domain/contracts.js";
import { canonicalJson, hashFramedDomain } from "../hashing/canonical-json.js";
import { ApplicationEvidencePredicateBindingSchema, ContentHashSchema, StateValueDependencyRefSchema } from "./contracts.js";

export const applicationEvidenceAssessmentRequestSchemaVersion = "application-evidence-assessment-request@1" as const;
export const applicationEvidenceAssessmentSchemaVersion = "application-evidence-assessment@1" as const;

const identity = z.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
const reason = z.string().min(1).max(4_096);
const owner = z.strictObject({
  kind: z.enum(["requirement", "behavioral-scenario"]),
  id: identity,
  canonicalDocumentHash: ContentHashSchema,
});

export const ApplicationEvidenceAssessmentRequestSchema = z.strictObject({
  schemaVersion: z.literal(applicationEvidenceAssessmentRequestSchemaVersion),
  owner,
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z.array(identity).min(1).max(64),
}).superRefine((value, context) => {
  if (new Set(value.evidenceIds).size !== value.evidenceIds.length) {
    context.addIssue({ code: "custom", path: ["evidenceIds"], message: "application evidence IDs must be unique" });
  }
});
export type ApplicationEvidenceAssessmentRequest = z.infer<typeof ApplicationEvidenceAssessmentRequestSchema>;

const custody = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("authenticated"), receiptHash: ContentHashSchema }),
  z.strictObject({ status: z.literal("unavailable"), reason }),
]);
const currentness = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("current"), observationHash: ContentHashSchema }),
  z.strictObject({ status: z.literal("stale"), observationHash: ContentHashSchema, reason }),
  z.strictObject({ status: z.literal("unknown"), reason }),
]);
const fulfillment = z.strictObject({ status: z.enum(["satisfied", "violated", "unknown"]), reason });

/**
 * A host attests to these fields. The hash protects exact response reuse and
 * binding; it does not prove the host, producer, artifact, or observation.
 */
export const ApplicationEvidenceAssessmentSchema = z.strictObject({
  schemaVersion: z.literal(applicationEvidenceAssessmentSchemaVersion),
  request: ApplicationEvidenceAssessmentRequestSchema,
  custody,
  currentness,
  fulfillment,
  dependencies: z.array(StateValueDependencyRefSchema).max(256),
  contentHash: ContentHashSchema,
}).superRefine((value, context) => {
  if (value.fulfillment.status !== "unknown" && (value.custody.status !== "authenticated" || value.currentness.status !== "current")) {
    context.addIssue({ code: "custom", path: ["fulfillment", "status"], message: "satisfied or violated evidence requires authenticated custody and current observation" });
  }
  const { contentHash: _contentHash, ...basis } = value;
  if (value.contentHash !== hashApplicationEvidenceAssessment(basis)) {
    context.addIssue({ code: "custom", path: ["contentHash"], message: "application evidence assessment hash does not match its exact response" });
  }
});
export type ApplicationEvidenceAssessment = z.infer<typeof ApplicationEvidenceAssessmentSchema>;

export interface ApplicationEvidencePort {
  /** A trusted host must establish producer, artifact custody, and currentness before asserting a result. */
  assess(request: ApplicationEvidenceAssessmentRequest, environment: { readonly signal: AbortSignal }): Promise<ApplicationEvidenceAssessment>;
}

export function hashApplicationEvidenceAssessment(value: Omit<ApplicationEvidenceAssessment, "contentHash">): ContentHash {
  return hashFramedDomain("application-evidence-assessment/v1", value);
}

/** Validates a trusted-host result is strict, hashed, and bound to this exact request. */
export async function assessApplicationEvidence(
  port: ApplicationEvidencePort,
  request: ApplicationEvidenceAssessmentRequest,
  environment: { readonly signal: AbortSignal },
): Promise<ApplicationEvidenceAssessment> {
  const expected = ApplicationEvidenceAssessmentRequestSchema.parse(request);
  const assessment = ApplicationEvidenceAssessmentSchema.parse(await port.assess(expected, environment));
  if (canonicalJson(assessment.request) !== canonicalJson(expected)) {
    throw new Error("Application evidence host returned an assessment for a different exact request");
  }
  return assessment;
}

export function applicationEvidenceDependencies(assessment: ApplicationEvidenceAssessment): readonly StateValueDependencyRef[] {
  // The enclosing Zod object intentionally keeps its inferred dependency
  // elements opaque. Re-parse at the typed boundary rather than widening the
  // port contract or trusting a cast.
  return assessment.dependencies.map((dependency) => StateValueDependencyRefSchema.parse(dependency) as StateValueDependencyRef);
}
