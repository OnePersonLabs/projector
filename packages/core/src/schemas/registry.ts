import { z } from "zod";

import "../hashing/builtin-profiles.js";

import {
  ConfidenceSchema,
  ContentHashSchema,
  EntityIdSchema,
  GitRealizationLocatorSchema,
  SourceClassSchema,
} from "./contracts.js";
import * as generated from "./generated-contracts.js";
import { getHashProfile } from "../hashing/projections.js";
import { ChangeProposalSchema } from "./change-proposal.js";
import { CanonicalDocumentEnvelopeByKindSchema, CanonicalDocumentEnvelopeSchema, CanonicalDocumentWireByKindSchema } from "./canonical-envelope.js";
import { PreparedProjectorConfigSchema } from "./project-config.js";
import {
  PendingProjectDataMigrationSchema,
  LegacyUnversionedProjectDataSourceSchema,
  ProjectDataLegacyIngressManifestSchema,
  ProjectDataMigrationSourceAuthoritySchema,
  ProjectDataFormatSnapshotSchema,
  ProjectDataMigrationArtifactRefSchema,
  ProjectDataMigrationChainSchema,
  ProjectDataMigrationDraftSchema,
  ProjectDataMigrationManifestSchema,
  ProjectDataMigrationReceiptSchema,
  PortableRelativePathSchema,
} from "./project-data-migration.js";
import { DurableRepresentationArtifactRecordSchema } from "./representation-artifact.js";

export interface ContractRegistration {
  readonly schema?: z.ZodType;
  readonly serialized: boolean;
  readonly extensionDefined?: boolean;
  readonly hashProfileKind?: string;
}

export const normativeContractNames = [
  "AdapterContext",
  "AnalysisFacet",
  "AnalyzerCapabilities",
  "AnalyzerFailure",
  "AppliedPreferenceRef",
  "ArchitectureConcern",
  "ArchitectureDecision",
  "Artifact",
  "ArtifactFingerprint",
  "AuthorityAlternative",
  "AuthorityClass",
  "AuthorityReconsiderTrigger",
  "AuthorityRecord",
  "AuthorityVector",
  "BehavioralScenario",
  "BehavioralScenarioDelta",
  "BehavioralScenarioStep",
  "CausalOrigin",
  "ChangeCertificate",
  "ChangeIntentAnalysis",
  "ChangeOperation",
  "ChangeProposal",
  "CanonicalDocumentEnvelope",
  "CanonicalDocumentEnvelopeByKind",
  "CanonicalDocumentWireByKind",
  "CommandSpec",
  "CompletionContract",
  "Concept",
  "ConcernActivationReason",
  "ConcernMateriality",
  "Confidence",
  "ContentHash",
  "ContextPrecedent",
  "ControlPolicy",
  "CoverageLane",
  "CoverageSnapshot",
  "DecisionConsequence",
  "DecisionDeferral",
  "DecisionEvaluation",
  "DecisionOption",
  "DecisionValidityAssessment",
  "DerivationInput",
  "DerivationRecord",
  "DeveloperPreference",
  "DurableRepresentationArtifactRecord",
  "Divergence",
  "EffectiveRuleBundle",
  "EntityId",
  "EnumerationContract",
  "Evidence",
  "EvidenceClaim",
  "EvidenceKind",
  "EvidenceRef",
  "ApplicationEvidencePredicateBinding",
  "EvidenceRefreshPolicy",
  "ExecutionCapsule",
  "ExecutionPlan",
  "ExecutionPolicy",
  "GovernanceBasis",
  "GovernanceException",
  "GitRealizationLocator",
  "GraphReader",
  "IgnorePolicy",
  "ImpactClosureRef",
  "ImpactRule",
  "IntentOriginRef",
  "IntentStatement",
  "InvalidationCause",
  "InvalidationEvent",
  "InvalidationResult",
  "LensContributionRole",
  "LensExample",
  "LensRef",
  "LegacyUnversionedProjectDataSource",
  "LineageRecord",
  "MigrationBinding",
  "MigrationOverlay",
  "ModelProvider",
  "NewSemanticBoundary",
  "NormalizedPredicate",
  "ObservabilityClass",
  "OperationEvidence",
  "PatternCandidate",
  "PendingProjectDataMigration",
  "PlanCheckpoint",
  "PlanningSurprise",
  "PortableRelativePath",
  "PreservationDimension",
  "ProjectionExpectation",
  "ProjectionLens",
  "ProjectionSpec",
  "ProjectionUnit",
  "PreparedProjectorConfig",
  "ProjectDataFormatSnapshot",
  "ProjectDataLegacyIngressManifest",
  "ProjectDataMigrationArtifactRef",
  "ProjectDataMigrationChain",
  "ProjectDataMigrationDraft",
  "ProjectDataMigrationManifest",
  "ProjectDataMigrationReceipt",
  "ProjectDataMigrationSourceAuthority",
  "RecognizerBinding",
  "Relation",
  "RelationType",
  "RelevanceBand",
  "RelevanceClosure",
  "RelevanceEntry",
  "RelevanceReason",
  "RelevanceSeed",
  "RealizationBinding",
  "RealizationOriginRef",
  "RealizationSelectorExpr",
  "RepairCapabilities",
  "RepairStrategy",
  "RepresentationProjection",
  "RepresentationProjectionRef",
  "RepresentationStyleRule",
  "RepresentationTarget",
  "RepresentationTokenAccounting",
  "Requirement",
  "RequirementDelta",
  "RiskAssessment",
  "RiskClass",
  "RollbackSpec",
  "Rule",
  "RuleConflict",
  "RuleEffect",
  "ScopeGrant",
  "SelectorExpr",
  "SemanticAnchor",
  "SemanticChange",
  "SemanticIdentityCandidate",
  "SemanticIdentityResolution",
  "SemanticOperation",
  "SemanticPreservationFingerprint",
  "SemanticRepresentationProfile",
  "SemanticSignature",
  "SourceClass",
  "StateBinding",
  "StateBindingValidation",
  "StateBindingValidator",
  "StateDigest",
  "StateQueryDependency",
  "StateQueryKind",
  "StateQueryReader",
  "StateQueryResultFingerprint",
  "StateQuerySpec",
  "StateValueDependencyKind",
  "StateValueDependencyRef",
  "StructuredModelRequest",
  "StructuredModelResponse",
  "Surface",
  "SurfaceAdapter",
  "SurfaceApplyResult",
  "SurfaceCapabilities",
  "SurfaceChange",
  "SurfacePlan",
  "TokenCounter",
  "Tombstone",
  "TransactionJournalEntry",
  "TransactionPhase",
  "TransactionReceipt",
  "Transform",
  "TransformBinding",
  "TransformContext",
  "TransformPreview",
  "TransformResult",
  "ValidationResult",
  "ValidatorBinding",
  "ValidityState",
  "WorkPacket",
] as const;

const runtimeOnly = new Set<string>([
  "AdapterContext",
  "GraphReader",
  "ModelProvider",
  "StateBindingValidator",
  "StateQueryReader",
  "SurfaceAdapter",
  "TokenCounter",
  "Transform",
  "TransformContext",
]);

const hashProfileKinds: Readonly<Record<string, string>> = {
  ArchitectureDecision: "architecture-decision",
  AuthorityRecord: "authority-record",
  BehavioralScenario: "behavioral-scenario",
  Concept: "concept",
  GovernanceException: "exception",
  LineageRecord: "lineage",
  MigrationOverlay: "migration",
  ProjectionLens: "projection-lens",
  Relation: "relation",
  Requirement: "requirement",
  Rule: "rule",
  SemanticRepresentationProfile: "semantic-representation-profile",
  Tombstone: "tombstone",
  TransactionReceipt: "transaction-receipt",
};

const schemaExports: Record<string, z.ZodType> = {
  EntityIdSchema,
  ConfidenceSchema,
  ContentHashSchema,
  GitRealizationLocatorSchema,
  SourceClassSchema,
  ...generated,
  ChangeProposalSchema,
  CanonicalDocumentEnvelopeSchema,
  CanonicalDocumentEnvelopeByKindSchema,
  CanonicalDocumentWireByKindSchema,
  PreparedProjectorConfigSchema,
  PendingProjectDataMigrationSchema,
  LegacyUnversionedProjectDataSourceSchema,
  ProjectDataLegacyIngressManifestSchema,
  ProjectDataMigrationSourceAuthoritySchema,
  ProjectDataFormatSnapshotSchema,
  ProjectDataMigrationArtifactRefSchema,
  ProjectDataMigrationChainSchema,
  ProjectDataMigrationDraftSchema,
  ProjectDataMigrationManifestSchema,
  ProjectDataMigrationReceiptSchema,
  PortableRelativePathSchema,
  DurableRepresentationArtifactRecordSchema,
};

export const contractRegistry: Readonly<Record<string, ContractRegistration>> =
  Object.freeze(Object.fromEntries(normativeContractNames.map((name) => {
    const serialized = !runtimeOnly.has(name);
    const schema = schemaExports[`${name}Schema`];
    const hashProfileKind = hashProfileKinds[name];
    return [name, Object.freeze({
      ...(schema === undefined ? {} : { schema }),
      ...(hashProfileKind === undefined ? {} : { hashProfileKind }),
      serialized,
    })];
  })));

export function validateContractRegistry(): string[] {
  const errors: string[] = [];
  if (Object.keys(contractRegistry).length !== normativeContractNames.length) {
    errors.push("contract registry contains duplicate declaration names");
  }
  for (const [name, registration] of Object.entries(contractRegistry)) {
    if (registration.serialized && registration.schema === undefined && !registration.extensionDefined) {
      errors.push(`${name} is serialized but has no schema`);
    }
    if (!registration.serialized && registration.schema !== undefined) {
      errors.push(`${name} is runtime-only but has a serialized schema`);
    }
    if (registration.hashProfileKind !== undefined) {
      try {
        getHashProfile(registration.hashProfileKind);
      } catch {
        errors.push(`${name} has no registered hash profile`);
      }
    }
  }
  return errors;
}

export type ExportedJsonSchemas = Readonly<Record<string, z.core.JSONSchema.BaseSchema>>;

let exportedJsonSchemas: ExportedJsonSchemas | undefined;

function freezeJsonSchema(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freezeJsonSchema(child);
  Object.freeze(value);
}

export function exportContractJsonSchemas(): ExportedJsonSchemas {
  if (exportedJsonSchemas !== undefined) return exportedJsonSchemas;
  const schemas = Object.fromEntries(
    Object.entries(contractRegistry)
      .filter((entry): entry is [string, ContractRegistration & { schema: z.ZodType }] => entry[1].schema !== undefined)
      .map(([name, registration]) => [
        name,
        z.toJSONSchema(registration.schema, {
          target: "draft-2020-12",
          reused: "ref",
          cycles: "ref",
          io: "input",
        }),
      ]),
  );
  // This module identity owns a fixed registry. Freeze nested schema objects and
  // arrays before sharing the generated representation with any consumer.
  freezeJsonSchema(schemas);
  exportedJsonSchemas = schemas;
  return schemas;
}

function collectRefs(value: unknown, refs: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "$ref" && typeof item === "string") refs.push(item);
    else collectRefs(item, refs);
  }
}

function resolvePointer(root: unknown, pointer: string): unknown {
  if (pointer === "#") return root;
  if (!pointer.startsWith("#/")) return undefined;
  let current = root;
  for (const rawSegment of pointer.slice(2).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (typeof current !== "object" || current === null || !(segment in current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function validateJsonSchemaReferences(schemas = exportContractJsonSchemas()): string[] {
  const errors: string[] = [];
  for (const [name, schema] of Object.entries(schemas)) {
    const refs: string[] = [];
    collectRefs(schema, refs);
    for (const ref of refs) {
      if (ref.startsWith("#") && resolvePointer(schema, ref) === undefined) {
        errors.push(`${name} has unresolved JSON Schema reference ${ref}`);
      }
    }
  }
  return errors;
}
