import { z } from "zod";
import { EntityIdSchema, DecisionOptionSchema, EvidenceSchema, DecisionEvaluationSchema, AppliedPreferenceRefSchema } from "./contracts.js";

/** Candidate evaluation inputs are proposals, never canonical mutation authority. */
export const ArchitectureEvaluationRequestSchema = z.strictObject({
  concernId: EntityIdSchema,
  options: z.array(DecisionOptionSchema).min(1),
  preferenceIds: z.array(EntityIdSchema).optional(),
  research: z.strictObject({
    required: z.boolean().optional(),
    records: z.array(EvidenceSchema).optional(),
    maxAgeDays: z.number().finite().nonnegative().optional(),
  }).optional(),
  acceptance: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("automatic") }),
    z.strictObject({ kind: z.literal("explicit-user"), authorityRecordId: EntityIdSchema }),
  ]).optional(),
});
export type ArchitectureEvaluationRequest = z.infer<typeof ArchitectureEvaluationRequestSchema>;
export const ArchitectureEvaluationOutputSchema = z.strictObject({
  evaluation: DecisionEvaluationSchema,
  acceptanceBlocked: z.boolean(),
  appliedPreferences: z.array(AppliedPreferenceRefSchema),
  preferenceConflicts: z.array(z.string()),
  governanceConsequences: z.array(z.never()),
  canonicalMutationAuthorized: z.literal(false),
});
