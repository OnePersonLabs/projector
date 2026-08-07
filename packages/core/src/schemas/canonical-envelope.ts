import { z } from "zod";

import { verifyCanonicalEnvelope, type CanonicalDocumentEnvelope } from "../hashing/canonical-envelope.js";
import { ContentHashSchema, EntityIdSchema } from "./contracts.js";
import {
  ArchitectureDecisionSchema,
  AuthorityRecordSchema,
  BehavioralScenarioSchema,
  ConceptSchema,
  JsonValueSchema,
  LineageRecordSchema,
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
  "transaction-receipt",
]);

export const CanonicalDocumentEnvelopeSchema: z.ZodType = z.strictObject({
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
}).superRefine((value, context) => {
  const payloadSchemas: Readonly<Record<typeof value.kind, z.ZodType>> = {
    "architecture-decision": ArchitectureDecisionSchema,
    "authority-record": AuthorityRecordSchema,
    "behavioral-scenario": BehavioralScenarioSchema,
    concept: ConceptSchema,
    lineage: LineageRecordSchema,
    "projection-lens": ProjectionLensSchema,
    relation: RelationSchema,
    requirement: RequirementSchema,
    rule: RuleSchema,
    "semantic-representation-profile": SemanticRepresentationProfileSchema,
    tombstone: TombstoneSchema,
    "transaction-receipt": TransactionReceiptSchema,
  };
  const payloadResult = payloadSchemas[value.kind].safeParse(value.payload);
  if (!payloadResult.success) {
    for (const issue of payloadResult.error.issues) {
      context.addIssue({ code: "custom", path: ["payload", ...issue.path], message: issue.message });
    }
  }
  for (const message of verifyCanonicalEnvelope(value as CanonicalDocumentEnvelope)) {
    context.addIssue({ code: "custom", message });
  }
});
