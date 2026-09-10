import { z } from "zod";

import { verifyCanonicalEnvelope, withCanonicalHashes, type CanonicalDocumentEnvelope } from "../hashing/canonical-envelope.js";
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

const canonicalPayloadMirrorFields: Readonly<Record<CanonicalKind, Readonly<{
  id: boolean;
  key: boolean;
  lifecycle?: "status" | "lifecycle" | "active";
  semanticHash: boolean;
  discoveryHash: boolean;
}>>> = Object.freeze(Object.fromEntries(CanonicalKindSchema.options.map((kind) => {
  const payload = unwrapObjectSchema(CanonicalPayloadSchemas[kind]);
  const fields = payload.shape;
  return [kind, Object.freeze({
    id: Object.hasOwn(fields, "id"),
    key: Object.hasOwn(fields, "key"),
    ...(Object.hasOwn(fields, "lifecycle") ? { lifecycle: "lifecycle" as const }
      : Object.hasOwn(fields, "status") ? { lifecycle: "status" as const }
        : Object.hasOwn(fields, "active") ? { lifecycle: "active" as const }
          : {}),
    semanticHash: Object.hasOwn(fields, "semanticHash"),
    discoveryHash: Object.hasOwn(fields, "discoveryHash"),
  })];
})) as Readonly<Record<CanonicalKind, Readonly<{ id: boolean; key: boolean; lifecycle?: "status" | "lifecycle" | "active"; semanticHash: boolean; discoveryHash: boolean }>>>);

function canonicalDocumentWireSchemaForKind<const TKind extends CanonicalKind>(kind: TKind) {
  const payload = unwrapObjectSchema(CanonicalPayloadSchemas[kind]);
  const mirrors = canonicalPayloadMirrorFields[kind];
  const omitted = Object.fromEntries([
    ...(mirrors.id ? ["id"] : []),
    ...(mirrors.key ? ["key"] : []),
    ...(mirrors.lifecycle === undefined ? [] : [mirrors.lifecycle]),
    ...(mirrors.semanticHash ? ["semanticHash"] : []),
    ...(mirrors.discoveryHash ? ["discoveryHash"] : []),
  ].map((field) => [field, true])) as Record<string, true>;
  const authoredPayloadShape = Object.fromEntries(Object.entries(payload.shape).filter(([field]) => omitted[field] !== true));
  return z.strictObject({
    apiVersion: z.string().min(1),
    schemaVersion: z.string().min(1),
    kind: z.literal(kind),
    id: EntityIdSchema,
    key: z.string().min(1),
    lifecycle: z.string().min(1),
    payload: z.strictObject(authoredPayloadShape),
  }).superRefine((value, context) => {
    const result = CanonicalDocumentEnvelopeSchemasByKind[kind].safeParse(hydrateParsedCanonicalDocumentWire(value as unknown as CanonicalDocumentWireShape));
    if (!result.success) for (const issue of result.error.issues) context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
}

/** Strict authored form. Envelope hashes and exact root payload mirrors are hydrated by core. */
export const CanonicalDocumentWireSchemasByKind = Object.freeze(Object.fromEntries(
  CanonicalKindSchema.options.map((kind) => [kind, canonicalDocumentWireSchemaForKind(kind)]),
) as Readonly<Record<CanonicalKind, ReturnType<typeof canonicalDocumentWireSchemaForKind>>>);

const canonicalDocumentWireSchemas = Object.values(CanonicalDocumentWireSchemasByKind) as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]];
export const CanonicalDocumentWireByKindSchema: z.ZodType = z.union(canonicalDocumentWireSchemas);
export type CanonicalDocumentWire = z.infer<typeof CanonicalDocumentWireByKindSchema>;

export function hydrateCanonicalDocumentWire(unparsed: unknown): CanonicalDocumentEnvelope {
  const wire = CanonicalDocumentWireByKindSchema.parse(unparsed) as CanonicalDocumentWireShape;
  const hydrated = hydrateParsedCanonicalDocumentWire(wire);
  return CanonicalDocumentEnvelopeSchemasByKind[wire.kind].parse(hydrated) as CanonicalDocumentEnvelope;
}

type CanonicalDocumentWireShape = Record<string, unknown> & { kind: CanonicalKind; payload: Record<string, unknown> };

function hydrateParsedCanonicalDocumentWire(wire: CanonicalDocumentWireShape): CanonicalDocumentEnvelope {
  const mirrors = canonicalPayloadMirrorFields[wire.kind];
  const payload = {
    ...wire.payload,
    ...(mirrors.id ? { id: wire.id } : {}),
    ...(mirrors.key ? { key: wire.key } : {}),
    ...(mirrors.lifecycle === "lifecycle" ? { lifecycle: wire.lifecycle }
      : mirrors.lifecycle === "status" ? { status: wire.lifecycle }
        : mirrors.lifecycle === "active" ? { active: wire.lifecycle === "active" }
          : {}),
    ...(mirrors.semanticHash ? { semanticHash: "sha256:v1:placeholder" } : {}),
    ...(mirrors.discoveryHash ? { discoveryHash: "sha256:v1:placeholder" } : {}),
  };
  return withCanonicalHashes({
    apiVersion: wire.apiVersion as string,
    schemaVersion: wire.schemaVersion as string,
    kind: wire.kind,
    id: wire.id as string,
    key: wire.key as string,
    lifecycle: wire.lifecycle as string,
    payload,
  });
}

export function toCanonicalDocumentWire(unparsed: unknown): CanonicalDocumentWire {
  const envelope = CanonicalDocumentEnvelopeByKindSchema.parse(unparsed) as Record<string, unknown> & { kind: CanonicalKind; payload: Record<string, unknown> };
  const mirrors = canonicalPayloadMirrorFields[envelope.kind];
  const payload = { ...envelope.payload };
  if (mirrors.id) delete payload.id;
  if (mirrors.key) delete payload.key;
  if (mirrors.lifecycle !== undefined) delete payload[mirrors.lifecycle];
  if (mirrors.semanticHash) delete payload.semanticHash;
  if (mirrors.discoveryHash) delete payload.discoveryHash;
  return CanonicalDocumentWireSchemasByKind[envelope.kind].parse({
    apiVersion: envelope.apiVersion,
    schemaVersion: envelope.schemaVersion,
    kind: envelope.kind,
    id: envelope.id,
    key: envelope.key,
    lifecycle: envelope.lifecycle,
    payload,
  }) as CanonicalDocumentWire;
}

function unwrapObjectSchema(schema: z.ZodType): z.ZodObject {
  const candidate = schema as z.ZodType & { unwrap?: () => z.ZodType };
  const unwrapped = candidate.unwrap?.() ?? candidate;
  if (!(unwrapped instanceof z.ZodObject)) throw new Error("canonical payload schema must resolve to an object");
  return unwrapped;
}
