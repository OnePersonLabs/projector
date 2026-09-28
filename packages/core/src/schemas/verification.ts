import { z } from "zod";
import { ContentHashSchema, StateBindingSchema } from "./contracts.js";
import type { StateBinding } from "../domain/contracts.js";
export const VerificationPopulationSchema = z.object({ directory: z.string().min(1), recursive: z.boolean() }).strict();
export const VerificationInputSnapshotSchema = z.object({
  files: z.record(z.string(), ContentHashSchema),
  populations: z.array(z.object({ directory: z.string().min(1), recursive: z.boolean(), members: z.array(z.string().min(1)) }).strict()),
  producerPath: z.string().min(1), producerHash: ContentHashSchema, environmentHash: ContentHashSchema,
  platform: z.string(), architecture: z.string(), nodeVersion: z.string(),
}).strict();

export const VerificationRequestSchema = z.object({
  executable: z.string().min(1), args: z.array(z.string()).max(1024),
  sourcePath: z.string().min(1).optional(),
  inputPaths: z.array(z.string().min(1)).min(1).max(10000),
  populations: z.array(VerificationPopulationSchema).max(128),
  environment: z.array(z.string().min(1)).max(256),
  timeoutMs: z.number().int().positive().max(300000),
  completeInputs: z.boolean().optional(),
}).strict();
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;
export const VerificationEvidenceSchema = z.object({
  id: z.string().regex(/^execution_[0-9a-f-]{36}$/u),
  request: VerificationRequestSchema, inputs: VerificationInputSnapshotSchema,
  basisHash: ContentHashSchema, profile: z.literal("native-observed/v1"),
  startedAt: z.string(), completedAt: z.string().optional(),
  status: z.enum(["running", "passed", "failed", "interrupted", "inputs-changed"]),
  exitCode: z.number().int().nullable().optional(), stdout: z.string().optional(), stderr: z.string().optional(),
  error: z.string().optional(), contentHash: ContentHashSchema,
}).strict();
export type VerificationEvidence = z.infer<typeof VerificationEvidenceSchema>;
export const VerificationInspectionSchema = z.object({ records: z.array(VerificationEvidenceSchema), pendingPublications: z.array(z.object({ artifactSetId: z.string(), state: z.enum(["staged", "finalizing"]), recoverable: z.boolean() }).strict()) }).strict();
export const VerificationRecoverySchema = z.object({ recoveredArtifactSetIds: z.array(z.string()), inspection: VerificationInspectionSchema }).strict();

export const BuiltinVerificationRequestSchema = z.strictObject({ check: z.literal("projector.canonical-integrity/v1"), target: z.string().min(1), timeoutMs: z.number().int().positive().max(300000).optional() });
export type BuiltinVerificationRequest = z.infer<typeof BuiltinVerificationRequestSchema>;
export const BuiltinVerificationArtifactSchema = z.strictObject({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/u) });
export const BuiltinVerificationEvidenceSchema = z.strictObject({
  id: z.string().regex(/^execution_[0-9a-f-]{36}$/u), profile: z.literal("projector-closed-static/v1"),
  request: BuiltinVerificationRequestSchema, targetObject: z.string(), targetTree: z.string(),
  binding: StateBindingSchema as z.ZodType<StateBinding>, basisHash: ContentHashSchema,
  producer: z.strictObject({ identity: z.string(), buildHash: ContentHashSchema, files: z.record(z.string(), ContentHashSchema), production: z.boolean() }),
  trustPolicyHash: ContentHashSchema, contractHash: ContentHashSchema, environmentHash: ContentHashSchema,
  artifacts: z.array(BuiltinVerificationArtifactSchema),
  status: z.enum(["running", "passed", "failed", "interrupted", "inputs-changed"]),
  startedAt: z.string(), completedAt: z.string().optional(), findings: z.array(z.string()), unknowns: z.array(z.string()),
  error: z.string().optional(), contentHash: ContentHashSchema,
});
export type BuiltinVerificationEvidence = z.infer<typeof BuiltinVerificationEvidenceSchema>;
export const BuiltinVerificationAssessmentSchema = z.strictObject({ eventId: z.string(), scope: z.literal("projector.canonical-integrity/v1"), reusable: z.boolean(), authorization: z.literal(false), bindingStatus: z.enum(["current", "rebound", "stale", "suspect", "unavailable"]), contradictory: z.boolean(), targetObject: z.string().optional(), targetTree: z.string().optional(), reasons: z.array(z.string()) });
export const BuiltinVerificationInspectionSchema = z.strictObject({ scope: z.literal("projector.canonical-integrity/v1"), records: z.array(BuiltinVerificationEvidenceSchema), pendingPublications: z.array(z.strictObject({ artifactSetId: z.string(), state: z.enum(["staged", "finalizing"]), recoverable: z.boolean() })) });
export const BuiltinVerificationRecoverySchema = z.strictObject({ recoveredArtifactSetIds: z.array(z.string()), inspection: BuiltinVerificationInspectionSchema });
export const BuiltinVerificationOperationSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("execute"), request: BuiltinVerificationRequestSchema }),
  z.strictObject({ action: z.literal("assess"), eventId: z.string().min(1), target: z.string().min(1) }),
  z.strictObject({ action: z.literal("inspect") }), z.strictObject({ action: z.literal("recover") }),
]);
