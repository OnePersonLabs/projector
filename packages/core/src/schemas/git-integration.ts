import { z } from "zod";

const ref = z.string().min(1);
const objectId = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
export const GitIntegrationRequestSchema = z.strictObject({ target: ref, incoming: ref, base: ref.optional(), result: ref.optional() });
export type GitIntegrationRequest = z.infer<typeof GitIntegrationRequestSchema>;
const contribution = z.strictObject({ side: z.enum(["target", "incoming"]), change: z.enum(["added", "modified", "removed"]), status: z.enum(["preserved", "altered", "lost"]) });
const population = z.strictObject({ dependencyPath: z.string(), targetConsumers: z.array(z.string()), incomingConsumers: z.array(z.string()), resultConsumers: z.array(z.string()), newlyRelevantConsumers: z.array(z.string()), removedConsumers: z.array(z.string()), fingerprint: z.string() });
const obligations = z.strictObject({ lensId: z.string(), targetMembers: z.array(z.string()), incomingMembers: z.array(z.string()), resultMembers: z.array(z.string()), newlyApplicableUnitIds: z.array(z.string()), resultObligations: z.array(z.strictObject({ unitId: z.string(), applicabilityFingerprint: z.string(), validatorIds: z.array(z.string()), ruleIds: z.array(z.string()) })) });
export const GitResultReconciliationSchema = z.strictObject({
  status: z.enum(["assessed", "incomplete", "failed", "not-assessed"]),
  scope: z.literal("immutable-result-static-consumers-and-obligations"),
  consumerQueries: z.array(population), lensPopulations: z.array(obligations),
  topologyQueries: z.array(z.strictObject({ subjectId: z.string(), subjectKind: z.enum(["event", "contract"]), targetConsumers: z.array(z.string()), incomingConsumers: z.array(z.string()), resultConsumers: z.array(z.string()), newlyRelevantConsumers: z.array(z.string()), observability: z.string(), fingerprint: z.string() })),
  semanticChanges: z.array(z.strictObject({ path: z.string(), targetHash: z.string().optional(), incomingHash: z.string().optional(), resultHash: z.string().optional() })),
  contradictions: z.array(z.string()), unknowns: z.array(z.string()),
  behavior: z.strictObject({ status: z.literal("not-assessed"), reusable: z.literal(false) }),
});
export const GitIntegrationAssessmentSchema = z.strictObject({
  baseCommit: objectId, targetCommit: objectId, incomingCommit: objectId, resultTree: objectId, resultCommit: objectId.optional(),
  baseSelection: z.enum(["inferred", "explicit"]), resultSource: z.enum(["calculated-merge", "supplied"]),
  status: z.enum(["review-required", "conflicted", "invalid"]), conflictPaths: z.array(z.string()),
  changedCodePaths: z.strictObject({ target: z.array(z.string()), incoming: z.array(z.string()) }),
  codeContributions: z.array(contribution.extend({ path: z.string() })),
  contributions: z.array(contribution.extend({ entityId: z.string(), kind: z.string(), baseSemanticHash: z.string().optional(), branchSemanticHash: z.string().optional(), resultSemanticHash: z.string().optional(), baseAuthoredHash: z.string().optional(), branchAuthoredHash: z.string().optional(), resultAuthoredHash: z.string().optional(), documentDrift: z.boolean() })),
  semanticOverlapIds: z.array(z.string()), resultOnlyPaths: z.array(z.string()),
  canonicalValidation: z.strictObject({ scope: z.literal("canonical-record-integrity"), status: z.enum(["passed", "failed", "not-assessed"]), issues: z.array(z.string()) }),
  staticGovernanceValidation: z.strictObject({ status: z.enum(["passed", "failed", "incomplete", "not-assessed"]), checks: z.array(z.string()), issues: z.array(z.string()) }),
  resultReconciliation: GitResultReconciliationSchema,
  assessedAt: z.iso.datetime(),
  requiresReview: z.literal(true), verificationGaps: z.array(z.string()),
});
export type GitIntegrationAssessment = z.infer<typeof GitIntegrationAssessmentSchema>;
