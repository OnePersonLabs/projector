import { z } from "zod";
import { ContentHashSchema } from "./contracts.js";
import { VerificationEvidenceSchema, VerificationPopulationSchema } from "./verification.js";

export const GeneratedOutputRequestSchema = z.object({
  producerId: z.string().min(1), executable: z.string().min(1), sourcePath: z.string().min(1),
  args: z.array(z.string()), inputPaths: z.array(z.string().min(1)),
  outputs: z.array(z.object({ path: z.string().min(1), ownership: z.enum(["retained", "disposable"]) }).strict()).min(1),
  environment: z.array(z.string().min(1)), timeoutMs: z.number().int().positive().safe().nullable().default(null),
  completeInputs: z.boolean().optional(), populations: z.array(VerificationPopulationSchema),
}).strict();
export type GeneratedOutputRequest = z.infer<typeof GeneratedOutputRequestSchema>;
export const GeneratedOutputEvidenceSchema = z.object({
  id: z.string(), request: GeneratedOutputRequestSchema,
  check: VerificationEvidenceSchema,
  before: z.record(z.string(), ContentHashSchema), after: z.record(z.string(), ContentHashSchema),
  afterObservation: z.enum(["immediate", "recovery"]),
  contentHash: ContentHashSchema,
}).strict();
export type GeneratedOutputEvidence = z.infer<typeof GeneratedOutputEvidenceSchema>;
export const GeneratedOutputInspectionSchema = z.object({
  records: z.array(z.object({ evidence: GeneratedOutputEvidenceSchema, current: z.boolean(), reason: z.string(), outputs: z.array(z.object({ path: z.string(), ownership: z.enum(["retained", "disposable"]), observation: z.enum(["missing", "unchanged-after-invocation", "changed-after-invocation"]), disposition: z.enum(["current", "preserve-and-review", "regenerate", "removal-eligible"]) }).strict()) }).strict()),
  pendingPublications: z.array(z.object({ artifactSetId: z.string(), state: z.enum(["staged", "finalizing"]), recoverable: z.boolean() }).strict()),
}).strict();
export const GeneratedOutputRecoverySchema = z.object({ recoveredArtifactSetIds: z.array(z.string()), inspection: GeneratedOutputInspectionSchema }).strict();
