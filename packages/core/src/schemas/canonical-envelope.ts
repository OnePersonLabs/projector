import { z } from "zod";

import { verifyCanonicalEnvelope, type CanonicalDocumentEnvelope } from "../hashing/canonical-envelope.js";
import { ContentHashSchema, EntityIdSchema } from "./contracts.js";
import { applicationEvidenceBindingIssues } from "./application-evidence-binding.js";
import {
  ArchitectureDecisionSchema,
  ArchitectureConcernSchema,
  DeveloperPreferenceSchema,
  AuthorityRecordSchema,
  BehavioralScenarioSchema,
  ConceptSchema,
  GovernanceExceptionSchema,
  JsonValueSchema,
  LineageRecordSchema,
  MigrationOverlaySchema,
  ProjectionLensSchema,
  RelationSchema,
  RequirementSchema,
  RuleSchema,
  SemanticRepresentationProfileSchema,
  TombstoneSchema,
  TransactionReceiptSchema,
} from "./generated-contracts.js";

export const CanonicalKindSchema = z.enum([
  "concept",
  "requirement",
  "behavioral-scenario",
  "relation",
  "lineage",
  "tombstone",
  "rule",
  "projection-lens",
  "semantic-representation-profile",
  "authority-record",
  "architecture-decision",
  "architecture-concern",
  "developer-preference",
  "exception",
  "migration",
  "transaction-receipt",
]);

export type CanonicalKind = z.infer<typeof CanonicalKindSchema>;

export const CanonicalPayloadSchemas: Readonly<Record<CanonicalKind, z.ZodType>> = Object.freeze({
  "architecture-decision": ArchitectureDecisionSchema,
  "architecture-concern": ArchitectureConcernSchema,
  "developer-preference": DeveloperPreferenceSchema,
  "authority-record": AuthorityRecordSchema,
  "behavioral-scenario": BehavioralScenarioSchema,
  concept: ConceptSchema,
  exception: GovernanceExceptionSchema,
  lineage: LineageRecordSchema,
  migration: MigrationOverlaySchema,
  "projection-lens": ProjectionLensSchema,
  relation: RelationSchema,
  requirement: RequirementSchema,
  rule: RuleSchema,
  "semantic-representation-profile": SemanticRepresentationProfileSchema,
  tombstone: TombstoneSchema,
  "transaction-receipt": TransactionReceiptSchema,
});

const canonicalEnvelopeShape = {
  apiVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  kind: CanonicalKindSchema,
  id: EntityIdSchema,
  key: z.string().min(1),
  lifecycle: z.string().min(1),
  payload: z.record(z.string(), JsonValueSchema),
  semanticHash: ContentHashSchema,
  discoveryHash: ContentHashSchema.optional(),
  canonicalDocumentHash: ContentHashSchema,
};

const verifyEnvelope = (value: Record<string, unknown>, context: z.RefinementCtx): void => {
  for (const message of verifyCanonicalEnvelope(value as unknown as CanonicalDocumentEnvelope)) {
    context.addIssue({ code: "custom", message });
  }
};

const verifyCanonicalOwnerEvidence = (value: { readonly kind: CanonicalKind; readonly payload: unknown }, context: z.RefinementCtx): void => {
  if (value.kind !== "requirement" && value.kind !== "behavioral-scenario") return;
  const parsed = CanonicalPayloadSchemas[value.kind].safeParse(value.payload);
  if (!parsed.success) return;
  for (const issue of applicationEvidenceBindingIssues((parsed.data as { evidence: Parameters<typeof applicationEvidenceBindingIssues>[0] }).evidence)) {
    context.addIssue({ code: "custom", path: ["payload", "evidence", issue.index, "applicationPredicate", "observationRole"], message: issue.message });
  }
};

export const CanonicalDocumentEnvelopeSchema: z.ZodType = z.strictObject(canonicalEnvelopeShape).superRefine((value, context) => {
  const payloadResult = CanonicalPayloadSchemas[value.kind].safeParse(value.payload);
  if (!payloadResult.success) {
    for (const issue of payloadResult.error.issues) {
      context.addIssue({ code: "custom", path: ["payload", ...issue.path], message: issue.message });
    }
  }
  verifyCanonicalOwnerEvidence(value, context);
  verifyEnvelope(value, context);
});

export function canonicalDocumentEnvelopeSchemaForKind<const TKind extends CanonicalKind>(kind: TKind) {
  return z.strictObject({
    ...canonicalEnvelopeShape,
    kind: z.literal(kind),
    payload: CanonicalPayloadSchemas[kind],
  }).superRefine((value, context) => { verifyCanonicalOwnerEvidence(value as unknown as { kind: CanonicalKind; payload: unknown }, context); verifyEnvelope(value, context); });
}

export const CanonicalDocumentEnvelopeSchemasByKind = Object.freeze(Object.fromEntries(
  CanonicalKindSchema.options.map((kind) => [kind, canonicalDocumentEnvelopeSchemaForKind(kind)]),
) as Readonly<Record<CanonicalKind, ReturnType<typeof canonicalDocumentEnvelopeSchemaForKind>>>);

const canonicalDocumentEnvelopeSchemas = Object.values(CanonicalDocumentEnvelopeSchemasByKind) as unknown as [
  z.ZodType,
  z.ZodType,
  ...z.ZodType[],
];

/** Serialized/editor authority whose union arms retain each canonical kind's exact payload schema. */
export const CanonicalDocumentEnvelopeByKindSchema: z.ZodType = z.union(canonicalDocumentEnvelopeSchemas);
