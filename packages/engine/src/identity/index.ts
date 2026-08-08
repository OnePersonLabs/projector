import {
  AuthorityRecordSchema,
  CanonicalDocumentEnvelopeSchema,
  EvidenceSchema,
  EvidenceRefSchema,
  EntityIdSchema,
  ConfidenceSchema,
  ContentHashSchema,
  LineageRecordSchema,
  NewSemanticBoundarySchema,
  SemanticIdentityCandidateSchema,
  StateBindingSchema,
  StateBindingValidationSchema,
  TombstoneSchema,
  canonicalJson,
  hashFramedDomain,
  type AuthorityRecord,
  type AdapterContext,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type Evidence,
  type EvidenceRef,
  type IncidentalIdentityMetadata,
  type NewSemanticBoundary,
  type SemanticIdentityCandidate,
  type SemanticIdentityResolution,
  type StateBinding,
  type StateDigest,
  type StateQueryDependency,
  type StateBindingValidation,
  type StateValueDependencyRef,
  validateLineage,
} from "@projector/core";
import { z } from "zod";

import { createStateBinding } from "../state/index.js";

export type IdentityAssessment = "same" | "overlap" | "split" | "merge" | "replace" | "delete" | "distinct" | "ambiguous";
export type IdentityLifecycle = "active" | "deprecated" | "superseded" | "tombstone";

const IdentityAssessmentSchema = z.enum(["same", "overlap", "split", "merge", "replace", "delete", "distinct", "ambiguous"]);
const RequestedKindSchema = z.enum(["concept", "requirement", "scenario", "unknown"]);
const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

function canonicalJsonSet<T>(values: readonly T[]): T[] {
  const byCanonicalValue = new Map(values.map((value) => [canonicalJson(value), value]));
  return [...byCanonicalValue.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, value]) => structuredClone(value));
}

function isCanonicalJsonSet(values: readonly unknown[]): boolean {
  return canonicalJson(values) === canonicalJson(canonicalJsonSet(values));
}

function normalizedTerm(value: string): string {
  return value.normalize("NFKC").trim();
}

function reportCanonicalBoundaryIssues(
  boundary: NewSemanticBoundary,
  issue: (message: string, path?: PropertyKey[]) => void,
): void {
  for (const field of ["owns", "excludes", "nearestEntityIds"] as const) {
    const values = boundary[field];
    const normalized = values.map(normalizedTerm);
    if (normalized.some((value) => value.length === 0)) issue(`semantic boundary ${field} cannot contain blank values`, [field]);
    if (canonicalJson(values) !== canonicalJson(sortedUnique(normalized))) {
      issue(`semantic boundary ${field} must contain canonical normalized, sorted, unique values`, [field]);
    }
  }
  if (boundary.rationale.length === 0 || boundary.rationale !== normalizedTerm(boundary.rationale)) {
    issue("semantic boundary rationale must be canonical normalized, trimmed, and nonblank", ["rationale"]);
  }
  const excluded = new Set(boundary.excludes);
  if (boundary.owns.some((value) => excluded.has(value))) {
    issue("semantic boundary owns and excludes must be disjoint after normalization");
  }
}

/** Persisted normalize-once boundary contract shared by resolution and distinct facts. */
export const CanonicalSemanticBoundarySchema = NewSemanticBoundarySchema.superRefine((boundary, context) => {
  reportCanonicalBoundaryIssues(boundary as NewSemanticBoundary, (message, path) => context.addIssue({ code: "custom", message, path }));
});

const OperationFactCommon = {
  version: z.literal(1),
  requestId: EntityIdSchema,
  requestedMeaning: z.string().min(1),
  requestedKind: RequestedKindSchema,
  sourceIds: z.array(EntityIdSchema),
  targetIds: z.array(EntityIdSchema),
};

/** Version-1 typed, hash-bound facts selected from trusted identity Evidence. */
export const IdentityOperationFactSchema = z.union([
  z.strictObject({ ...OperationFactCommon, operation: z.literal("same"), equivalentMeaning: z.string().min(1) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("overlap"), coordinatedSourceIds: z.array(EntityIdSchema) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("split"), partitionTargetIds: z.array(EntityIdSchema) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("merge"), convergence: z.strictObject({ sourceIds: z.array(EntityIdSchema), targetId: EntityIdSchema }) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("replace"), supersession: z.strictObject({ sourceId: EntityIdSchema, targetIds: z.array(EntityIdSchema) }) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("delete"), durableMeaningCeased: z.literal(true) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("delete"), noDurableEntity: z.literal(true) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("distinct"), boundary: CanonicalSemanticBoundarySchema.nullable() }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("ambiguous"), unresolvedConflict: z.string().min(1) }),
]);
export type IdentityOperationFact = z.infer<typeof IdentityOperationFactSchema>;

export const VerifiedIdentityClaimRefSchema = z.strictObject({
  evidenceId: EntityIdSchema,
  subjectKey: EntityIdSchema,
  predicate: z.string().min(1),
  object: IdentityOperationFactSchema,
  inferenceConfidence: ConfidenceSchema.optional(),
});

export const IdentityLineageProposalSchema = z.strictObject({
  id: EntityIdSchema,
  canonical: z.literal(false),
  kind: z.enum(["split", "merge", "replace", "delete"]),
  fromIds: z.array(EntityIdSchema),
  toIds: z.array(EntityIdSchema),
  reason: z.string().min(1),
  stateDigest: ContentHashSchema,
}).superRefine((proposal, context) => {
  for (const message of validateLineage(proposal)) context.addIssue({ code: "custom", message });
  if (canonicalJson(proposal.fromIds) !== canonicalJson(sortedUnique(proposal.fromIds))
    || canonicalJson(proposal.toIds) !== canonicalJson(sortedUnique(proposal.toIds))) {
    context.addIssue({ code: "custom", message: "lineage proposal endpoints must be normalized, sorted, and unique" });
  }
  const overlaps = proposal.fromIds.some((id) => proposal.toIds.includes(id));
  if (overlaps) context.addIssue({ code: "custom", message: "lineage source and target endpoints must be disjoint" });
  const validCardinality = proposal.kind === "split" ? proposal.fromIds.length === 1 && proposal.toIds.length >= 2
    : proposal.kind === "merge" ? proposal.fromIds.length >= 2 && proposal.toIds.length === 1
      : proposal.kind === "replace" ? proposal.fromIds.length === 1 && proposal.toIds.length === 1
        : proposal.fromIds.length === 1 && proposal.toIds.length === 0;
  if (!validCardinality) context.addIssue({ code: "custom", message: `${proposal.kind} lineage endpoints violate operation cardinality` });
});

export const IdentityTombstoneProposalSchema = z.strictObject({
  id: EntityIdSchema,
  canonical: z.literal(false),
  entityId: EntityIdSchema,
  lastSemanticHash: ContentHashSchema,
  replacementIds: z.array(EntityIdSchema),
  reason: z.string().min(1),
}).superRefine((proposal, context) => {
  if (canonicalJson(proposal.replacementIds) !== canonicalJson(sortedUnique(proposal.replacementIds))) {
    context.addIssue({ code: "custom", message: "tombstone replacements must be normalized, sorted, and unique" });
  }
  if (proposal.replacementIds.includes(proposal.entityId)) {
    context.addIssue({ code: "custom", message: "tombstone replacement continuity cannot point to the deleted identity" });
  }
});

export const IdentityCandidateRecordSchema = z.strictObject({
  candidate: SemanticIdentityCandidateSchema,
  lifecycle: z.enum(["active", "deprecated", "superseded", "tombstone"]),
  replacementIds: z.array(EntityIdSchema),
}).superRefine((record, context) => {
  const candidate = record.candidate as SemanticIdentityCandidate;
  if (!sameJson(record.replacementIds, sortedUnique(record.replacementIds.map(normalizedTerm)))) {
    context.addIssue({ code: "custom", message: "candidate replacement IDs must be normalized, sorted, and unique" });
  }
  if (record.replacementIds.includes(candidate.entityId)) {
    context.addIssue({ code: "custom", message: "candidate lifecycle replacement cannot point to the same identity" });
  }
  if ((record.lifecycle === "active" || record.lifecycle === "deprecated") && record.replacementIds.length > 0) {
    context.addIssue({ code: "custom", message: `${record.lifecycle} candidate records cannot declare replacement continuity` });
  }
  if (!isCanonicalJsonSet(candidate.evidence)) {
    context.addIssue({ code: "custom", message: "candidate evidence references must be canonically ordered and unique", path: ["candidate", "evidence"] });
  }
});

export const IdentityAdjudicationSchema = z.strictObject({
  kind: IdentityAssessmentSchema,
  operation: IdentityAssessmentSchema,
  sourceIds: z.array(EntityIdSchema),
  proposedTargetIds: z.array(EntityIdSchema),
  factPayloads: z.array(IdentityOperationFactSchema),
  evidenceIds: z.array(EntityIdSchema),
  claims: z.array(VerifiedIdentityClaimRefSchema),
  claimHashes: z.array(ContentHashSchema),
  lineageProposals: z.array(IdentityLineageProposalSchema),
  tombstoneProposals: z.array(IdentityTombstoneProposalSchema),
  contentHash: ContentHashSchema,
}).superRefine((adjudication, context) => {
  if (adjudication.kind !== adjudication.operation) {
    context.addIssue({ code: "custom", message: "adjudication kind must equal operation" });
  }
  for (const [label, values] of [
    ["sourceIds", adjudication.sourceIds],
    ["proposedTargetIds", adjudication.proposedTargetIds],
    ["evidenceIds", adjudication.evidenceIds],
    ["claimHashes", adjudication.claimHashes],
  ] as const) {
    if (canonicalJson(values) !== canonicalJson(sortedUnique(values))) {
      context.addIssue({ code: "custom", message: `adjudication ${label} must be normalized, sorted, and unique` });
    }
  }
  if (!isCanonicalJsonSet(adjudication.claims)) {
    context.addIssue({ code: "custom", message: "adjudication claims must be canonically ordered and unique", path: ["claims"] });
  }
  if (!isCanonicalJsonSet(adjudication.lineageProposals)) {
    context.addIssue({ code: "custom", message: "adjudication lineage proposals must be canonically ordered and unique", path: ["lineageProposals"] });
  }
  if (!isCanonicalJsonSet(adjudication.tombstoneProposals)) {
    context.addIssue({ code: "custom", message: "adjudication tombstone proposals must be canonically ordered and unique", path: ["tombstoneProposals"] });
  }
  reportAdjudicationSemanticIssues(adjudication as unknown as IdentityAdjudication, (message, path) => context.addIssue({ code: "custom", message, path }));
});

/** Complete persistence/API contract for the engine-owned adjudicated resolution v1. */
export const AdjudicatedSemanticIdentityResolutionSchema = z.strictObject({
  contractVersion: z.literal(1),
  id: EntityIdSchema,
  requestedMeaning: z.string(),
  requestedKind: RequestedKindSchema,
  outcome: z.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity", "unresolved"]),
  candidates: z.array(SemanticIdentityCandidateSchema),
  candidateRecords: z.array(IdentityCandidateRecordSchema),
  selectedEntityIds: z.array(EntityIdSchema),
  newBoundary: CanonicalSemanticBoundarySchema.optional(),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceRefSchema),
  unknowns: z.array(z.string()),
  boundState: StateBindingSchema,
  operation: IdentityAssessmentSchema,
  proposedTargetIds: z.array(EntityIdSchema),
  adjudication: IdentityAdjudicationSchema.optional(),
  lineageProposals: z.array(IdentityLineageProposalSchema),
  tombstoneProposals: z.array(IdentityTombstoneProposalSchema),
  contentHash: ContentHashSchema,
}).superRefine((resolution, context) => {
  if (canonicalJson(resolution.selectedEntityIds) !== canonicalJson(sortedUnique(resolution.selectedEntityIds))
    || canonicalJson(resolution.proposedTargetIds) !== canonicalJson(sortedUnique(resolution.proposedTargetIds))) {
    context.addIssue({ code: "custom", message: "resolution operation targets must be normalized, sorted, and unique" });
  }
  if (!isCanonicalJsonSet(resolution.evidence)) {
    context.addIssue({ code: "custom", message: "resolution evidence references must be canonically ordered and unique", path: ["evidence"] });
  }
  if (canonicalJson(resolution.unknowns) !== canonicalJson(sortedUnique(resolution.unknowns))) {
    context.addIssue({ code: "custom", message: "resolution unknowns must be sorted and unique", path: ["unknowns"] });
  }
  if (!isCanonicalJsonSet(resolution.lineageProposals)) {
    context.addIssue({ code: "custom", message: "resolution lineage proposals must be canonically ordered and unique", path: ["lineageProposals"] });
  }
  if (!isCanonicalJsonSet(resolution.tombstoneProposals)) {
    context.addIssue({ code: "custom", message: "resolution tombstone proposals must be canonically ordered and unique", path: ["tombstoneProposals"] });
  }
  if (resolution.adjudication !== undefined) {
    if (resolution.operation !== resolution.adjudication.operation
      || canonicalJson(resolution.proposedTargetIds) !== canonicalJson(resolution.adjudication.proposedTargetIds)
      || canonicalJson(resolution.lineageProposals) !== canonicalJson(resolution.adjudication.lineageProposals)
      || canonicalJson(resolution.tombstoneProposals) !== canonicalJson(resolution.adjudication.tombstoneProposals)) {
      context.addIssue({ code: "custom", message: "resolution continuity must equal its adjudication" });
    }
    if ((resolution.operation === "same" || resolution.operation === "overlap")
      && resolution.adjudication.factPayloads.some((fact) => canonicalJson(fact.targetIds) !== canonicalJson(resolution.selectedEntityIds))) {
      context.addIssue({ code: "custom", message: "same/overlap fact targets must exactly equal selected entity IDs" });
    }
  }
  reportResolutionSemanticIssues(resolution as unknown as AdjudicatedSemanticIdentityResolution, (message, path) => context.addIssue({ code: "custom", message, path }));
});

type OutcomeFact =
  | { kind: "same"; equivalentMeaning: true }
  | { kind: "overlap"; sharedOwnership: true }
  | { kind: "split"; partitionMeanings: readonly string[] }
  | { kind: "merge"; convergentTargetMeaning: string }
  | { kind: "replace"; incompatibility: string }
  | { kind: "delete"; durableMeaningCeased: true }
  | { kind: "distinct"; independentBoundary: true }
  | { kind: "ambiguous"; unresolvedConflict: string };

export interface VerifiedIdentityClaimRef {
  evidenceId: string;
  subjectKey: string;
  predicate: string;
  object: IdentityOperationFact;
  inferenceConfidence?: number;
}

export type IdentityOutcomeEvidence = OutcomeFact & {
  evidenceIds: readonly string[];
  rationale: string;
  /** Present only on repository-loaded adjudication; direct caller values are never trusted. */
  verifiedClaims?: readonly VerifiedIdentityClaimRef[];
};

export interface IdentityCandidateRecord {
  candidate: SemanticIdentityCandidate;
  lifecycle: IdentityLifecycle;
  replacementIds: readonly string[];
}

export interface ResolveSemanticIdentityInput {
  requestedMeaning: string;
  requestedKind: SemanticIdentityResolution["requestedKind"];
  durableEntity: boolean;
  assessment: IdentityAssessment;
  /** Outcome-specific adjudication facts. The assessment label is never authoritative by itself. */
  outcomeEvidence?: IdentityOutcomeEvidence;
  records: readonly IdentityCandidateRecord[];
  newBoundary?: NewSemanticBoundary;
  boundState: StateBinding;
  queryRegistry: { assertCurrent(query: StateQueryDependency["query"]): void };
  evidence: readonly EvidenceRef[];
  unknowns: readonly string[];
  proposedTargetIds?: readonly string[];
  /** Accepted for callers that have location/discovery metadata; deliberately excluded from identity and hashes. */
  incidental?: IncidentalIdentityMetadata;
}

export interface IdentitySearchResult {
  records: readonly IdentityCandidateRecord[];
  valueDependencies: readonly StateValueDependencyRef[];
  queryDependencies: readonly StateQueryDependency[];
}

export interface IdentitySearchPort {
  inspect(input: {
    requestedMeaning: string;
    requestedKind: SemanticIdentityResolution["requestedKind"];
  }, context: AdapterContext): Promise<IdentitySearchResult>;
}

export interface ResolveSemanticIdentityFromSearchInput extends Omit<ResolveSemanticIdentityInput, "records" | "boundState"> {
  compiledAgainst: StateDigest;
  context: AdapterContext;
  search: IdentitySearchPort;
  evidenceRepository: TrustedIdentityEvidenceRepository;
}

export interface IdentityLineageProposal {
  id: string;
  canonical: false;
  kind: "split" | "merge" | "replace" | "delete";
  fromIds: string[];
  toIds: string[];
  reason: string;
  stateDigest: ContentHash;
}

export interface IdentityTombstoneProposal {
  id: string;
  canonical: false;
  entityId: string;
  lastSemanticHash: ContentHash;
  replacementIds: string[];
  reason: string;
}

export interface AdjudicatedSemanticIdentityResolution extends SemanticIdentityResolution {
  contractVersion: 1;
  candidateRecords: IdentityCandidateRecord[];
  operation: IdentityAssessment;
  proposedTargetIds: string[];
  adjudication?: IdentityAdjudication;
  lineageProposals: IdentityLineageProposal[];
  tombstoneProposals: IdentityTombstoneProposal[];
}

export interface IdentityAdjudication {
  kind: IdentityAssessment;
  operation: IdentityAssessment;
  sourceIds: string[];
  proposedTargetIds: string[];
  factPayloads: IdentityOperationFact[];
  evidenceIds: string[];
  claims: VerifiedIdentityClaimRef[];
  claimHashes: ContentHash[];
  lineageProposals: IdentityLineageProposal[];
  tombstoneProposals: IdentityTombstoneProposal[];
  contentHash: ContentHash;
}

type SemanticIssue = (message: string, path?: PropertyKey[]) => void;

const predicatesByOperation: Record<IdentityAssessment, readonly string[]> = {
  same: ["identity-equivalent"],
  overlap: ["identity-shared-ownership"],
  split: ["identity-partition"],
  merge: ["identity-convergence"],
  replace: ["identity-supersession"],
  delete: ["identity-cessation", "identity-no-durable-entity"],
  distinct: ["identity-distinct-boundary"],
  ambiguous: ["identity-conflict"],
};

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function reportNormalizedIds(values: readonly string[], label: string, issue: SemanticIssue, path: PropertyKey[]): void {
  if (!sameJson(values, sortedUnique(values.map(normalizedTerm)))) {
    issue(`${label} must contain canonical normalized, sorted, unique entity IDs`, path);
  }
}

function reportProposalIdentity(proposal: IdentityLineageProposal, issue: SemanticIssue, path: PropertyKey[]): void {
  const { id: _id, canonical: _canonical, ...basis } = proposal;
  const expected = `lineage_proposal_${hashFramedDomain("identity-lineage-proposal", basis).slice(-32)}`;
  if (proposal.id !== expected) issue("lineage proposal ID must be bound to its exact semantic basis", path);
}

function reportTombstoneIdentity(proposal: IdentityTombstoneProposal, issue: SemanticIssue, path: PropertyKey[]): void {
  const { id: _id, canonical: _canonical, ...basis } = proposal;
  const expected = `tombstone_proposal_${hashFramedDomain("identity-tombstone-proposal", basis).slice(-32)}`;
  if (proposal.id !== expected) issue("tombstone proposal ID must be bound to its exact semantic basis", path);
}

function reportAdjudicationSemanticIssues(adjudication: IdentityAdjudication, issue: SemanticIssue): void {
  const operation = adjudication.operation;
  const expectedPredicates = predicatesByOperation[operation];
  const actualPredicates = adjudication.claims.map(({ predicate }) => predicate).sort(compareStrings);
  if (adjudication.claims.length !== expectedPredicates.length
    || !sameJson(actualPredicates, [...expectedPredicates].sort(compareStrings))) {
    issue(`adjudication ${operation} claims must use the exact allowed predicate set`, ["claims"]);
  }
  if (adjudication.factPayloads.length !== expectedPredicates.length
    || !sameJson(adjudication.factPayloads, adjudication.claims.map(({ object }) => object))) {
    issue(`adjudication ${operation} facts must exactly equal its applicable claim payloads`, ["factPayloads"]);
  }
  if (!sameJson(adjudication.evidenceIds, sortedUnique(adjudication.claims.map(({ evidenceId }) => evidenceId)))) {
    issue("adjudication evidence IDs must exactly equal its claim evidence endpoints", ["evidenceIds"]);
  }

  for (const [index, fact] of adjudication.factPayloads.entries()) {
    reportNormalizedIds(fact.sourceIds, "fact source IDs", issue, ["factPayloads", index, "sourceIds"]);
    reportNormalizedIds(fact.targetIds, "fact target IDs", issue, ["factPayloads", index, "targetIds"]);
    if (fact.operation !== operation) issue(`adjudication ${operation} cannot contain a ${fact.operation} fact`, ["factPayloads", index, "operation"]);
    if (!sameJson(fact.sourceIds, adjudication.sourceIds)) issue("fact source IDs must exactly equal adjudication source IDs", ["factPayloads", index, "sourceIds"]);
  }
  for (const [index, claim] of adjudication.claims.entries()) {
    if (claim.object.operation !== operation) issue(`claim predicate ${claim.predicate} does not describe adjudication ${operation}`, ["claims", index]);
    const predicateMatchesFact = claim.predicate === "identity-equivalent" ? claim.object.operation === "same"
      : claim.predicate === "identity-shared-ownership" ? claim.object.operation === "overlap"
        : claim.predicate === "identity-partition" ? claim.object.operation === "split"
          : claim.predicate === "identity-convergence" ? claim.object.operation === "merge"
            : claim.predicate === "identity-supersession" ? claim.object.operation === "replace"
              : claim.predicate === "identity-cessation" ? claim.object.operation === "delete" && "durableMeaningCeased" in claim.object
                : claim.predicate === "identity-no-durable-entity" ? claim.object.operation === "delete" && "noDurableEntity" in claim.object
                  : claim.predicate === "identity-distinct-boundary" ? claim.object.operation === "distinct"
                    : claim.predicate === "identity-conflict" && claim.object.operation === "ambiguous";
    if (!predicateMatchesFact) issue(`claim predicate ${claim.predicate} does not match its typed fact`, ["claims", index, "predicate"]);
  }

  const facts = adjudication.factPayloads;
  const expectedTargets = operation === "same" || operation === "overlap"
    ? facts[0]?.targetIds ?? []
    : adjudication.proposedTargetIds;
  if (facts.some(({ targetIds }) => !sameJson(targetIds, expectedTargets))) {
    issue(`adjudication ${operation} facts must use one exact target endpoint set`, ["factPayloads"]);
  }

  const sourceCount = adjudication.sourceIds.length;
  const targetCount = adjudication.proposedTargetIds.length;
  const overlappingEndpoints = adjudication.sourceIds.filter((id) => adjudication.proposedTargetIds.includes(id));
  if (overlappingEndpoints.length > 0) {
    issue(`${operation} source and destination endpoints must be disjoint`, ["proposedTargetIds"]);
  }
  const exactLineage = (kind: IdentityLineageProposal["kind"]): void => {
    if (adjudication.lineageProposals.length !== 1) {
      issue(`${operation} requires exactly one ${kind} lineage proposal`, ["lineageProposals"]);
      return;
    }
    const proposal = adjudication.lineageProposals[0]!;
    if (proposal.kind !== kind || !sameJson(proposal.fromIds, adjudication.sourceIds)
      || !sameJson(proposal.toIds, adjudication.proposedTargetIds)) {
      issue(`${operation} lineage kind and endpoints must exactly describe the adjudicated operation`, ["lineageProposals"]);
    }
    reportProposalIdentity(proposal, issue, ["lineageProposals", 0, "id"]);
  };
  const noContinuity = (): void => {
    if (adjudication.lineageProposals.length > 0 || adjudication.tombstoneProposals.length > 0) {
      issue(`${operation} cannot authorize lineage or tombstone continuity`);
    }
  };

  switch (operation) {
    case "same": {
      if (sourceCount < 1 || adjudication.proposedTargetIds.length !== 0 || expectedTargets.length < 1) issue("same requires supported source identities and exact selected targets");
      const fact = facts[0];
      if (fact?.operation === "same" && fact.equivalentMeaning !== fact.requestedMeaning) issue("same equivalence must name the exact requested meaning", ["factPayloads", 0]);
      noContinuity();
      break;
    }
    case "overlap": {
      if (sourceCount < 1 || targetCount !== 0 || expectedTargets.length < 1) issue("coordinated overlap requires supported source identities and exact selected targets");
      const fact = facts[0];
      if (fact?.operation === "overlap" && !sameJson(fact.coordinatedSourceIds, adjudication.sourceIds)) issue("coordination facts must name the exact source identities", ["factPayloads", 0]);
      noContinuity();
      break;
    }
    case "split": {
      if (sourceCount !== 1 || targetCount < 2) issue("split requires exactly one source and at least two proposed targets");
      const fact = facts[0];
      if (fact?.operation === "split" && !sameJson(fact.partitionTargetIds, adjudication.proposedTargetIds)) issue("split partition targets must exactly equal proposed targets", ["factPayloads", 0]);
      exactLineage("split");
      if (adjudication.tombstoneProposals.length > 0) issue("split cannot create tombstone proposals", ["tombstoneProposals"]);
      break;
    }
    case "merge": {
      if (sourceCount < 2 || targetCount !== 1) issue("merge requires at least two sources and exactly one proposed target");
      const fact = facts[0];
      if (fact?.operation === "merge" && (!sameJson(fact.convergence.sourceIds, adjudication.sourceIds)
        || fact.convergence.targetId !== adjudication.proposedTargetIds[0])) issue("merge convergence must exactly describe sources and target", ["factPayloads", 0]);
      exactLineage("merge");
      if (adjudication.tombstoneProposals.length > 0) issue("merge cannot create tombstone proposals", ["tombstoneProposals"]);
      break;
    }
    case "replace": {
      if (sourceCount !== 1 || targetCount !== 1) issue("replace requires exactly one source and one proposed target");
      const fact = facts[0];
      if (fact?.operation === "replace" && (fact.supersession.sourceId !== adjudication.sourceIds[0]
        || !sameJson(fact.supersession.targetIds, adjudication.proposedTargetIds))) issue("replace supersession must exactly describe source and target", ["factPayloads", 0]);
      exactLineage("replace");
      break;
    }
    case "delete": {
      if (sourceCount !== 1 || targetCount !== 0 || facts.some(({ targetIds }) => targetIds.length > 0)) issue("delete requires exactly one source and empty destinations");
      exactLineage("delete");
      break;
    }
    case "distinct": {
      if (targetCount !== 0 || facts.some(({ targetIds }) => targetIds.length > 0)) issue("distinct facts cannot name target identities");
      noContinuity();
      break;
    }
    case "ambiguous": {
      if (targetCount !== 0 || facts.some(({ targetIds }) => targetIds.length > 0)) issue("conflict facts cannot authorize target continuity");
      noContinuity();
      break;
    }
  }

  if (operation === "replace" || operation === "delete") {
    if (adjudication.tombstoneProposals.length !== 1) issue(`${operation} requires exactly one source tombstone`, ["tombstoneProposals"]);
    for (const [index, proposal] of adjudication.tombstoneProposals.entries()) {
      if (proposal.entityId !== adjudication.sourceIds[0]
        || !sameJson(proposal.replacementIds, adjudication.proposedTargetIds)
        || proposal.reason !== adjudication.lineageProposals[0]?.reason) {
        issue(`${operation} tombstone must exactly preserve its source and replacement continuity`, ["tombstoneProposals", index]);
      }
      reportTombstoneIdentity(proposal, issue, ["tombstoneProposals", index, "id"]);
    }
  }
}

function reportResolutionSemanticIssues(resolution: AdjudicatedSemanticIdentityResolution, issue: SemanticIssue): void {
  const requestedMeaning = normalizedTerm(resolution.requestedMeaning);
  if (requestedMeaning.length === 0 || requestedMeaning !== resolution.requestedMeaning) {
    issue("resolution requested meaning must be canonical normalized, trimmed, and nonblank", ["requestedMeaning"]);
  }
  reportNormalizedIds(resolution.selectedEntityIds, "selected entity IDs", issue, ["selectedEntityIds"]);
  reportNormalizedIds(resolution.proposedTargetIds, "proposed target IDs", issue, ["proposedTargetIds"]);
  const analysis = candidateAnalysis(resolution.candidateRecords, resolution.requestedKind, resolution.boundState);
  for (const lifecycleIssue of analysis.lifecycleIssues) {
    issue(lifecycleIssue, ["candidateRecords"]);
  }
  if (!sameJson(resolution.candidateRecords, normalizeRecords(resolution.candidateRecords))) {
    issue("persisted candidate records must be canonical normalized and uniquely identified", ["candidateRecords"]);
  }
  if (!sameJson(resolution.candidates, resolution.candidateRecords.map(({ candidate }) => candidate))) {
    issue("persisted candidates must exactly equal the candidate-record projection", ["candidates"]);
  }
  const unresolvedDuplicateBlocker = hasUnresolvedCandidateSearchBlocker(resolution.boundState, resolution.candidateRecords);
  const allowedOutcomes: Record<IdentityAssessment, readonly SemanticIdentityResolution["outcome"][]> = {
    same: ["reuse-existing", "unresolved"],
    overlap: ["coordinated-modification", "unresolved"],
    split: ["split-existing", "unresolved"],
    merge: ["merge-existing", "unresolved"],
    replace: ["replace-existing", "unresolved"],
    delete: ["no-durable-entity", "unresolved"],
    distinct: ["create-new", "no-durable-entity", "unresolved"],
    ambiguous: ["unresolved"],
  };
  if (!allowedOutcomes[resolution.operation].includes(resolution.outcome)) {
    issue(`resolution operation ${resolution.operation} is incompatible with outcome ${resolution.outcome}`);
  }
  if (resolution.adjudication === undefined) {
    if (resolution.outcome !== "unresolved" && !(resolution.operation === "distinct" && resolution.outcome === "no-durable-entity")) {
      issue("a resolved identity outcome requires persisted adjudication facts", ["adjudication"]);
    }
    if (resolution.selectedEntityIds.length > 0 || resolution.proposedTargetIds.length > 0) {
      issue("unadjudicated identity cannot authorize selected or proposed targets");
    }
    if (resolution.lineageProposals.length > 0 || resolution.tombstoneProposals.length > 0) issue("unadjudicated resolution cannot authorize continuity");
    return;
  }

  const adjudication = resolution.adjudication;
  if (adjudication.kind !== resolution.operation || adjudication.operation !== resolution.operation) {
    issue("outer operation and adjudication discriminants must exactly agree", ["adjudication"]);
  }
  if (!sameJson(resolution.proposedTargetIds, adjudication.proposedTargetIds)) issue("outer proposed targets must exactly equal adjudication targets");
  if (!sameJson(adjudication.sourceIds, analysis.endpointIds)) {
    issue("adjudication sources must exactly equal operation-eligible persisted candidate endpoints", ["adjudication", "sourceIds"]);
  }
  const requestId = `identity_request_${hashFramedDomain("semantic-identity-request", {
    requestedMeaning, requestedKind: resolution.requestedKind,
  }).slice(-32)}`;
  for (const [index, fact] of adjudication.factPayloads.entries()) {
    if (fact.requestId !== requestId || fact.requestedMeaning !== requestedMeaning || fact.requestedKind !== resolution.requestedKind) {
      issue("fact request identity, meaning, and kind must exactly describe the outer resolution", ["adjudication", "factPayloads", index]);
    }
  }
  for (const [index, claim] of adjudication.claims.entries()) {
    if (claim.subjectKey !== requestId || !sameJson(claim.object, adjudication.factPayloads[index])) {
      issue("claim subject and payload endpoints must exactly describe the outer resolution", ["adjudication", "claims", index]);
    }
  }

  if (resolution.outcome === "unresolved") {
    if (resolution.selectedEntityIds.length > 0 || resolution.proposedTargetIds.length > 0
      || resolution.lineageProposals.length > 0 || resolution.tombstoneProposals.length > 0) {
      issue("unresolved identity cannot authorize selected targets, proposals, lineage, or tombstones");
    }
  } else if (resolution.operation === "same" || resolution.operation === "overlap") {
    const factTargets = adjudication.factPayloads[0]?.targetIds ?? [];
    if (!sameJson(resolution.selectedEntityIds, factTargets)) issue("same/coordinated selected identities must exactly equal fact targets");
  } else if (["split", "merge", "replace", "delete"].includes(resolution.operation)) {
    if (!sameJson(resolution.selectedEntityIds, adjudication.sourceIds)) issue("lifecycle selected identities must exactly equal operation sources");
  } else if (resolution.selectedEntityIds.length > 0) {
    issue(`${resolution.operation} cannot select canonical entity targets`, ["selectedEntityIds"]);
  }

  const distinctFact = adjudication.factPayloads.find((fact): fact is Extract<IdentityOperationFact, { operation: "distinct" }> => fact.operation === "distinct");
  if (distinctFact !== undefined) {
    const factBoundary = distinctFact.boundary ?? undefined;
    if ((resolution.newBoundary === undefined) !== (factBoundary === undefined)
      || (resolution.newBoundary !== undefined && !sameJson(resolution.newBoundary, factBoundary))) {
      issue("distinct-boundary fact must exactly equal the outer normalized new boundary");
    }
  }
  if (resolution.outcome === "create-new") {
    if (resolution.operation !== "distinct" || adjudication.sourceIds.length !== 0
      || analysis.supportedRecords.length > 0 || analysis.unresolvedHistoricalBlockers.length > 0 || unresolvedDuplicateBlocker
      || distinctFact?.boundary === null || distinctFact?.boundary === undefined
      || resolution.newBoundary === undefined || !sameJson(resolution.newBoundary, distinctFact.boundary)) {
      issue("create-new requires no eligible duplicate candidate or unresolved history and one exact distinct-boundary fact equal to the outer canonical boundary");
    }
  } else if (resolution.newBoundary !== undefined) {
    issue("only create-new may persist a new semantic boundary", ["newBoundary"]);
  }

  for (const [index, proposal] of adjudication.lineageProposals.entries()) {
    if (proposal.stateDigest !== resolution.boundState.compiledAgainst.canonicalProjectorDigest) {
      issue("lineage proposal state digest must equal the resolution canonical state digest", ["adjudication", "lineageProposals", index, "stateDigest"]);
    }
  }
  for (const [index, proposal] of adjudication.tombstoneProposals.entries()) {
    const semanticValues = resolution.boundState.valueDependencies.filter(({ kind, id, role }) =>
      kind === "canonical-entity" && id === proposal.entityId && role === "identity candidate semantic value");
    if (semanticValues.length !== 1 || semanticValues[0]!.versionHash !== proposal.lastSemanticHash) {
      issue("tombstone last semantic hash must equal its exact bound source value", ["adjudication", "tombstoneProposals", index, "lastSemanticHash"]);
    }
  }
}

export interface TrustedIdentityEvidenceRepository {
  loadEvidence(evidenceId: string): Promise<unknown>;
}

const verifiedOutcomeEvidence = new WeakSet<object>();

function normalizeCandidate(candidate: SemanticIdentityCandidate): SemanticIdentityCandidate {
  return {
    ...structuredClone(candidate),
    evidence: canonicalJsonSet(candidate.evidence),
  };
}

function hasUnresolvedCandidateSearchBlocker(binding: StateBinding, records: readonly IdentityCandidateRecord[]): boolean {
  return records.length === 0 && binding.queryDependencies.some(({ query, priorResult }) =>
    ["identity.exact-search", "identity.alias-search", "identity.lineage", "identity.tombstone"].includes(query.programId)
    && priorResult.resultCount > 0);
}

const requiredIdentityPrograms = [
  "identity.exact-search", "identity.alias-search", "identity.lineage",
  "identity.tombstone", "identity.relations", "identity.topology",
] as const;

function validateIdentityBinding(
  binding: StateBinding,
  requestedMeaning: string,
  requestedKind: ResolveSemanticIdentityInput["requestedKind"],
  queryRegistry: ResolveSemanticIdentityInput["queryRegistry"],
): void {
  const normalized = createStateBinding(binding);
  if (normalized.dependencyDigest !== binding.dependencyDigest) throw new Error("identity dependency binding digest is invalid");
  const programs = new Set(binding.queryDependencies.map(({ query }) => query.programId));
  const missing = requiredIdentityPrograms.filter((program) => !programs.has(program));
  if (missing.length > 0) throw new Error(`identity dependency binding is incomplete: ${missing.join(", ")}`);
  for (const dependency of binding.queryDependencies) {
    queryRegistry.assertCurrent(dependency.query);
    const queryMeaning = dependency.query.input.requestedMeaning;
    const queryKind = dependency.query.input.requestedKind;
    if (queryMeaning !== requestedMeaning.normalize("NFKC").trim() || queryKind !== requestedKind) {
      throw new Error(`identity query dependency ${dependency.query.id} is not bound to the normalized request meaning and kind`);
    }
    if (dependency.query.semanticHash !== dependency.priorResult.queryHash || dependency.priorResult.dependencyKeys.length === 0) {
      throw new Error(`identity query dependency ${dependency.query.id} is not re-evaluable`);
    }
    if (dependency.priorResult.observability !== "closed" && dependency.priorResult.observability !== "bounded") {
      throw new Error(`identity query dependency ${dependency.query.id} cannot establish negative space under ${dependency.priorResult.observability} observability`);
    }
  }
}

function validateCandidateValueDependencies(binding: StateBinding, records: readonly IdentityCandidateRecord[]): void {
  const boundIds = new Set(binding.valueDependencies
    .filter(({ kind, role }) => kind === "canonical-entity" && role === "identity candidate semantic value")
    .map(({ id }) => String(id)));
  const requiredIds = sortedUnique(records.flatMap(({ candidate, replacementIds }) => [candidate.entityId, ...replacementIds]));
  const missing = requiredIds.filter((id) => !boundIds.has(id));
  if (missing.length > 0) throw new Error(`identity candidate value hashes are incomplete: ${missing.join(", ")}`);
}

function hasOutcomeEvidence(input: ResolveSemanticIdentityInput): boolean {
  const basis = input.outcomeEvidence;
  if (basis === undefined || !verifiedOutcomeEvidence.has(basis) || basis.kind !== input.assessment || basis.rationale.trim().length === 0 || basis.evidenceIds.length === 0) return false;
  const supporting = new Set(input.evidence.filter(({ stance }) => stance === "supports").map(({ evidenceId }) => evidenceId));
  if (!basis.evidenceIds.every((id) => id.trim().length > 0 && supporting.has(id))) return false;
  switch (basis.kind) {
    case "same": return basis.equivalentMeaning === true;
    case "overlap": return basis.sharedOwnership === true;
    case "split": return basis.partitionMeanings.length >= 2 && basis.partitionMeanings.every((meaning) => meaning.trim().length > 0);
    case "merge": return basis.convergentTargetMeaning.trim().length > 0;
    case "replace": return basis.incompatibility.trim().length > 0;
    case "delete": return basis.durableMeaningCeased === true;
    case "distinct": return basis.independentBoundary === true;
    case "ambiguous": return basis.unresolvedConflict.trim().length > 0;
  }
}

/** Canonical complete Evidence projection. No claim-bearing or authority field is excluded. */
export function computeEvidenceContentHash(evidence: Evidence): ContentHash {
  const parsed = EvidenceSchema.parse(evidence) as Evidence;
  const { contentHash: _declared, ...projection } = parsed;
  return hashFramedDomain("evidence-content", projection);
}

function parseVerifiedEvidence(value: unknown, expectedId: string): Evidence {
  const evidence = EvidenceSchema.parse(value) as Evidence;
  if (evidence.id !== expectedId) throw new Error(`trusted Evidence ID mismatch for ${expectedId}`);
  if (computeEvidenceContentHash(evidence) !== evidence.contentHash) {
    throw new Error(`trusted Evidence content hash integrity mismatch for ${expectedId}`);
  }
  return evidence;
}

function outcomeFactFromEvidence(
  assessment: IdentityAssessment,
  evidence: readonly Evidence[],
  input: Pick<ResolveSemanticIdentityInput, "requestedMeaning" | "requestedKind" | "proposedTargetIds" | "newBoundary">,
  analysis: CandidateAnalysis,
): IdentityOutcomeEvidence | undefined {
  const requestedMeaning = input.requestedMeaning.normalize("NFKC").trim();
  const requestId = `identity_request_${hashFramedDomain("semantic-identity-request", {
    requestedMeaning, requestedKind: input.requestedKind,
  }).slice(-32)}`;
  const sourceIds = analysis.endpointIds;
  const proposedTargetIds = sortedUnique(input.proposedTargetIds ?? []);
  const targetIds = assessment === "same" || assessment === "overlap" ? analysis.endpointIds : proposedTargetIds;
  const common = {
    version: 1, requestId, requestedMeaning, requestedKind: input.requestedKind,
    operation: assessment, sourceIds, targetIds,
  };
  const expectedByPredicate: Partial<Record<string, unknown>> = assessment === "same"
    ? { "identity-equivalent": { ...common, equivalentMeaning: requestedMeaning } }
    : assessment === "overlap"
      ? { "identity-shared-ownership": { ...common, coordinatedSourceIds: sourceIds } }
      : assessment === "split"
        ? { "identity-partition": { ...common, partitionTargetIds: targetIds } }
        : assessment === "merge"
          ? { "identity-convergence": { ...common, convergence: { sourceIds, targetId: targetIds[0] } } }
          : assessment === "replace"
            ? { "identity-supersession": { ...common, supersession: { sourceId: sourceIds[0], targetIds } } }
            : assessment === "delete"
              ? {
                "identity-cessation": { ...common, durableMeaningCeased: true },
                "identity-no-durable-entity": { ...common, noDurableEntity: true },
              }
              : assessment === "distinct"
                ? { "identity-distinct-boundary": { ...common, boundary: input.newBoundary ?? null } }
                : { "identity-conflict": { ...common, unresolvedConflict: "ownership conflict" } };
  const expectedPredicates = Object.keys(expectedByPredicate);
  const claims = evidence.flatMap((item) => item.claims
    .filter(({ subjectKey, predicate }) => subjectKey === requestId && expectedPredicates.includes(predicate))
    .map((claim) => ({ evidenceId: item.id, claim })));
  for (const predicate of expectedPredicates) {
    const payloads = claims.filter(({ claim }) => claim.predicate === predicate).map(({ claim }) => claim.object);
    if (payloads.some((payload) => canonicalJson(payload) !== canonicalJson(expectedByPredicate[predicate]))) {
      throw new Error(`incompatible ${predicate} payload for the requested identity operation`);
    }
    if (payloads.length === 0) return undefined;
  }
  const evidenceIds = sortedUnique(claims.map(({ evidenceId }) => evidenceId));
  const fact: IdentityOutcomeEvidence = assessment === "same"
    ? { kind: "same", equivalentMeaning: true, evidenceIds, rationale: "verified request-bound identity equivalence claim" }
    : assessment === "overlap"
      ? { kind: "overlap", sharedOwnership: true, evidenceIds, rationale: "verified request-bound coordination claim" }
      : assessment === "split"
        ? { kind: "split", partitionMeanings: targetIds, evidenceIds, rationale: "verified request-bound partition claim" }
        : assessment === "merge"
          ? { kind: "merge", convergentTargetMeaning: targetIds[0] ?? "", evidenceIds, rationale: "verified request-bound convergence claim" }
          : assessment === "replace"
            ? { kind: "replace", incompatibility: `${sourceIds[0] ?? ""}->${targetIds.join(",")}`, evidenceIds, rationale: "verified request-bound supersession claim" }
            : assessment === "delete"
              ? { kind: "delete", durableMeaningCeased: true, evidenceIds, rationale: "verified request-bound cessation claims" }
              : assessment === "distinct"
                ? { kind: "distinct", independentBoundary: true, evidenceIds, rationale: "verified request-bound distinct boundary claim" }
                : { kind: "ambiguous", unresolvedConflict: "ownership conflict", evidenceIds, rationale: "verified request-bound conflict claim" };
  return {
    ...fact,
    verifiedClaims: claims
      .map(({ evidenceId, claim }) => ({
        evidenceId,
        subjectKey: claim.subjectKey,
        predicate: claim.predicate,
        object: IdentityOperationFactSchema.parse(claim.object),
        ...(claim.inferenceConfidence === undefined ? {} : { inferenceConfidence: claim.inferenceConfidence }),
      }))
      .sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right))),
  };
}

function normalizeRecords(records: readonly IdentityCandidateRecord[]): IdentityCandidateRecord[] {
  const byId = new Map<string, IdentityCandidateRecord>();
  for (const record of records) {
    const normalized = { ...structuredClone(record), replacementIds: sortedUnique(record.replacementIds), candidate: normalizeCandidate(record.candidate) };
    const existing = byId.get(record.candidate.entityId);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(normalized)) {
      throw new Error(`conflicting duplicate identity observation for ${record.candidate.entityId}`);
    }
    byId.set(record.candidate.entityId, normalized);
  }
  return [...byId.values()].sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
}

function supportsRequestedIdentity(record: IdentityCandidateRecord, requestedKind: ResolveSemanticIdentityInput["requestedKind"]): boolean {
  const { candidate } = record;
  return (requestedKind === "unknown" || candidate.entityKind === requestedKind)
    && candidate.similarity >= 0.75
    && candidate.ownershipFit >= 0.75
    && candidate.boundaryFit >= 0.7
    && candidate.explanation.trim().length > 0
    && candidate.evidence.some(({ evidenceId, stance }) => evidenceId.trim().length > 0 && stance === "supports");
}

interface CandidateAnalysis {
  supportedRecords: IdentityCandidateRecord[];
  endpointIds: string[];
  unresolvedHistoricalBlockers: IdentityCandidateRecord[];
  lifecycleIssues: string[];
}

function candidateAnalysis(
  records: readonly IdentityCandidateRecord[],
  requestedKind: ResolveSemanticIdentityInput["requestedKind"],
  binding: StateBinding,
): CandidateAnalysis {
  const supportedRecords = records.filter((record) => supportsRequestedIdentity(record, requestedKind));
  const recordsById = new Map(records.map((record) => [record.candidate.entityId, record]));
  const semanticDependencyCounts = new Map<string, number>();
  for (const dependency of binding.valueDependencies) {
    if (dependency.kind === "canonical-entity" && dependency.role === "identity candidate semantic value") {
      semanticDependencyCounts.set(String(dependency.id), (semanticDependencyCounts.get(String(dependency.id)) ?? 0) + 1);
    }
  }
  const lifecycleIssues = new Set<string>();
  const endpointIds = new Set<string>();

  const resolveReplacement = (record: IdentityCandidateRecord, path: readonly string[], reachedByReplacement: boolean): void => {
    const id = record.candidate.entityId;
    if (path.includes(id)) {
      lifecycleIssues.add(`identity lifecycle replacement cycle detected: ${[...path, id].join(" -> ")}`);
      return;
    }
    const isTerminal = record.lifecycle === "active" || record.lifecycle === "deprecated";
    if ((reachedByReplacement || isTerminal) && !supportsRequestedIdentity(record, requestedKind)) {
      lifecycleIssues.add(`identity lifecycle replacement ${id} is not eligible for the requested kind and meaning`);
      return;
    }
    if ((reachedByReplacement || isTerminal) && (semanticDependencyCounts.get(id) ?? 0) !== 1) {
      lifecycleIssues.add(`identity lifecycle replacement ${id} requires exactly one bound semantic candidate value`);
      return;
    }
    if (isTerminal) {
      endpointIds.add(id);
      return;
    }
    if (record.replacementIds.length === 0) {
      if (reachedByReplacement) {
        lifecycleIssues.add(`identity lifecycle replacement ${id} is a nonterminal historical endpoint`);
      }
      return;
    }

    // Tombstones may name multiple successors after a split. Every branch must
    // independently resolve; only its canonical terminal set becomes eligible.
    for (const replacementId of record.replacementIds) {
      if (replacementId === id) {
        lifecycleIssues.add(`identity lifecycle replacement ${id} cannot point to itself`);
        continue;
      }
      const replacement = recordsById.get(replacementId);
      if (replacement === undefined) {
        lifecycleIssues.add(`identity lifecycle replacement ${replacementId} is missing its persisted candidate record`);
        continue;
      }
      if (requestedKind !== "unknown" && replacement.candidate.entityKind !== requestedKind) {
        lifecycleIssues.add(`identity lifecycle replacement ${replacementId} has the wrong requested kind`);
        continue;
      }
      resolveReplacement(replacement, [...path, id], true);
    }
  };

  for (const record of records) {
    const matchesRequestedKind = requestedKind === "unknown" || record.candidate.entityKind === requestedKind;
    if (!matchesRequestedKind || (record.lifecycle !== "superseded" && record.lifecycle !== "tombstone")) continue;
    if (record.replacementIds.length > 0) resolveReplacement(record, [], false);
  }
  for (const record of supportedRecords) {
    if (record.lifecycle === "active" || record.lifecycle === "deprecated") resolveReplacement(record, [], false);
  }

  return {
    supportedRecords,
    endpointIds: sortedUnique([...endpointIds]),
    unresolvedHistoricalBlockers: records.filter(({ candidate, lifecycle, replacementIds }) =>
      (requestedKind === "unknown" || candidate.entityKind === requestedKind)
      && (lifecycle === "superseded" || lifecycle === "tombstone")
      && replacementIds.length === 0),
    lifecycleIssues: [...lifecycleIssues].sort(compareStrings),
  };
}

function assertValidLifecycleAnalysis(analysis: CandidateAnalysis): void {
  if (analysis.lifecycleIssues.length > 0) {
    throw new Error(`invalid identity lifecycle replacement graph: ${analysis.lifecycleIssues.join("; ")}`);
  }
}

function normalizeBoundary(boundary: NewSemanticBoundary | undefined): NewSemanticBoundary | undefined {
  if (boundary === undefined) return undefined;
  NewSemanticBoundarySchema.parse(boundary);
  const normalizeMembers = (values: readonly string[], label: string): string[] => {
    const normalized = values.map((value) => value.normalize("NFKC").trim());
    if (normalized.some((value) => value.length === 0)) throw new Error(`semantic boundary ${label} members cannot be blank`);
    return sortedUnique(normalized);
  };
  const owns = normalizeMembers(boundary.owns, "owns");
  const excludes = normalizeMembers(boundary.excludes, "excludes");
  const overlap = owns.filter((value) => excludes.includes(value));
  if (overlap.length > 0) throw new Error(`semantic boundary owns/excludes sets overlap: ${overlap.join(", ")}`);
  const nearestEntityIds = normalizeMembers(boundary.nearestEntityIds, "nearestEntityIds");
  nearestEntityIds.forEach((id) => EntityIdSchema.parse(id));
  const rationale = boundary.rationale.normalize("NFKC").trim();
  if (rationale.length === 0) throw new Error("semantic boundary rationale cannot be blank");
  return CanonicalSemanticBoundarySchema.parse({ owns, excludes, nearestEntityIds, rationale }) as NewSemanticBoundary;
}

function prepareIdentityInput(input: ResolveSemanticIdentityInput): ResolveSemanticIdentityInput {
  if ((input.proposedTargetIds ?? []).some((id) => id.trim().length === 0)) throw new Error("identity lineage target IDs cannot be blank");
  if (new Set(input.proposedTargetIds ?? []).size !== (input.proposedTargetIds ?? []).length) throw new Error("identity lineage target IDs must be unique");
  const proposedTargetIds = sortedUnique((input.proposedTargetIds ?? []).map((id) => id.normalize("NFKC").trim()));
  proposedTargetIds.forEach((id) => EntityIdSchema.parse(id));
  const newBoundary = normalizeBoundary(input.newBoundary);
  const { newBoundary: _rawBoundary, ...inputWithoutBoundary } = input;
  return {
    ...inputWithoutBoundary,
    requestedMeaning: input.requestedMeaning.normalize("NFKC").trim(),
    records: normalizeRecords(input.records),
    proposedTargetIds,
    ...(newBoundary === undefined ? {} : { newBoundary }),
  };
}

function validBoundary(boundary: NewSemanticBoundary | undefined): boundary is NewSemanticBoundary {
  return boundary !== undefined
    && boundary.owns.some((value) => value.trim().length > 0)
    && boundary.excludes.some((value) => value.trim().length > 0)
    && boundary.rationale.trim().length > 0;
}

function decision(input: ResolveSemanticIdentityInput, records: readonly IdentityCandidateRecord[], analysis: CandidateAnalysis): {
  outcome: SemanticIdentityResolution["outcome"];
  selectedEntityIds: string[];
  unknowns: string[];
  newBoundary?: NewSemanticBoundary;
} {
  const unknowns = sortedUnique(input.unknowns);
  if (!input.durableEntity) return { outcome: "no-durable-entity", selectedEntityIds: [], unknowns };
  if (!hasOutcomeEvidence(input)) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "identity outcome lacks outcome-specific supporting evidence"]) };
  }
  const supported = analysis.supportedRecords;
  const targets = analysis.endpointIds;
  const historicalBlockers = analysis.unresolvedHistoricalBlockers;
  if (input.assessment === "ambiguous") {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "semantic ownership remains ambiguous"]) };
  }
  if (input.assessment === "distinct") {
    const unresolvedSearchResults = hasUnresolvedCandidateSearchBlocker(input.boundState, records);
    if (unresolvedSearchResults) {
      return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "identity search returned candidates or history that were not resolved into candidate records"]) };
    }
    if (supported.length > 0) {
      return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "existing or historical identity overlaps the requested meaning"]) };
    }
    if (!validBoundary(input.newBoundary)) {
      return {
        outcome: "unresolved",
        selectedEntityIds: [],
        unknowns: sortedUnique([
          ...unknowns,
          input.records.length > 0
            ? "existing or historical identity overlaps the requested meaning"
            : "new semantic boundary is incomplete",
        ]),
      };
    }
    return { outcome: "create-new", selectedEntityIds: [], unknowns, newBoundary: structuredClone(input.newBoundary) };
  }
  if (historicalBlockers.length > 0) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "unreplaced tombstone blocks live identity reuse"]) };
  }
  if (targets.length === 0) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "no candidate supports the requested identity decision"]) };
  }
  if ((input.assessment === "same" || input.assessment === "split" || input.assessment === "replace" || input.assessment === "delete") && targets.length !== 1) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, `${input.assessment} identity adjudication requires exactly one supported live target`]) };
  }
  const outcome = input.assessment === "same" ? "reuse-existing"
    : input.assessment === "overlap" ? "coordinated-modification"
      : input.assessment === "split" ? "split-existing"
        : input.assessment === "merge" ? "merge-existing"
          : input.assessment === "delete" ? "no-durable-entity" : "replace-existing";
  if (outcome === "merge-existing" && targets.length < 2) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "merge requires at least two existing identities"]) };
  }
  return { outcome, selectedEntityIds: targets, unknowns };
}

/** Deterministically adjudicates an already evidence-backed semantic comparison. It never creates canonical state. */
export function resolveSemanticIdentity(input: ResolveSemanticIdentityInput): AdjudicatedSemanticIdentityResolution {
  const prepared = prepareIdentityInput(input);
  const analysis = candidateAnalysis(prepared.records, prepared.requestedKind, prepared.boundState);
  assertValidLifecycleAnalysis(analysis);
  return resolvePreparedSemanticIdentity(prepared, analysis);
}

function resolvePreparedSemanticIdentity(
  input: ResolveSemanticIdentityInput,
  analysis: CandidateAnalysis,
): AdjudicatedSemanticIdentityResolution {
  if (input.requestedMeaning.trim().length === 0) throw new Error("requested semantic meaning cannot be blank");
  if (input.durableEntity) validateIdentityBinding(input.boundState, input.requestedMeaning, input.requestedKind, input.queryRegistry);
  const records = input.records;
  if (input.durableEntity) validateCandidateValueDependencies(input.boundState, records);
  const candidates = records.map(({ candidate }) => candidate);
  const resolved = decision(input, records, analysis);
  const evidence = canonicalJsonSet(input.evidence);
  const candidateScores = candidates.map(({ similarity, ownershipFit, boundaryFit }) => Math.min(similarity, ownershipFit, boundaryFit));
  const confidence = resolved.outcome === "no-durable-entity" ? 1
    : resolved.outcome === "unresolved" ? Math.min(0.49, ...candidates.map(({ similarity, ownershipFit, boundaryFit }) => Math.min(similarity, ownershipFit, boundaryFit)), 0.49)
      : resolved.outcome === "create-new" ? candidates.length === 0 ? 1 : 1 - Math.max(...candidateScores)
        : candidates.length === 0 ? 1 : Math.min(...candidateScores);
  const proposedTargetIds = resolved.outcome === "unresolved" ? [] : sortedUnique(input.proposedTargetIds ?? []);
  const sourceIds = analysis.endpointIds;
  const lineageKind: IdentityLineageProposal["kind"] | undefined = resolved.outcome === "split-existing" ? "split"
    : resolved.outcome === "merge-existing" ? "merge"
      : resolved.outcome === "replace-existing" ? "replace"
        : input.assessment === "delete" && resolved.outcome === "no-durable-entity" && input.durableEntity ? "delete" : undefined;
  if (lineageKind !== undefined && proposedTargetIds.some((id) => sourceIds.includes(id))) {
    throw new Error(`${lineageKind} lineage targets must be nonblank and distinct from source identities to preserve continuity`);
  }
  if (lineageKind !== undefined && lineageKind !== "delete") {
    const targetDependencies = input.boundState.valueDependencies.filter(({ kind, role }) =>
      kind === "canonical-entity" && role === "identity candidate semantic value");
    const missingTargets = proposedTargetIds.filter((targetId) => targetDependencies.filter(({ id }) => id === targetId).length !== 1);
    if (missingTargets.length > 0) throw new Error(`identity lineage target semantic bindings are incomplete or ambiguous: ${missingTargets.join(", ")}`);
  }
  if (resolved.outcome === "split-existing" && (sourceIds.length !== 1 || proposedTargetIds.length < 2)) throw new Error("split lineage requires exactly one source and at least two targets");
  if (resolved.outcome === "merge-existing" && (sourceIds.length < 2 || proposedTargetIds.length !== 1)) throw new Error("merge lineage requires at least two sources and exactly one target");
  if (resolved.outcome === "replace-existing" && (sourceIds.length !== 1 || proposedTargetIds.length !== 1)) throw new Error("replace lineage requires exactly one source and one replacement");
  if (input.assessment === "delete" && resolved.outcome === "no-durable-entity" && sourceIds.length !== 1) throw new Error("delete lineage requires exactly one source");
  if (input.assessment === "delete" && proposedTargetIds.length !== 0) throw new Error("delete lineage cannot have destinations or replacements");
  const lineageBasis = lineageKind === undefined ? undefined : {
    kind: lineageKind, fromIds: sourceIds, toIds: proposedTargetIds,
    reason: `evidence-backed ${lineageKind} of requested meaning`, stateDigest: input.boundState.compiledAgainst.canonicalProjectorDigest,
  };
  const lineageProposals: IdentityLineageProposal[] = lineageBasis === undefined ? [] : (() => {
    const lineageErrors = validateLineage(lineageBasis);
    if (lineageErrors.length > 0) throw new Error(`invalid identity lineage proposal: ${lineageErrors.join("; ")}`);
    const proposal = {
      id: `lineage_proposal_${hashFramedDomain("identity-lineage-proposal", lineageBasis).slice(-32)}`,
      canonical: false as const, ...lineageBasis,
    };
    LineageRecordSchema.parse({
      id: proposal.id, kind: proposal.kind, fromIds: proposal.fromIds, toIds: proposal.toIds,
      reason: proposal.reason, stateDigest: proposal.stateDigest,
    });
    return [proposal];
  })();
  const tombstoneProposals: IdentityTombstoneProposal[] = lineageKind === "replace" || lineageKind === "delete"
    ? sourceIds.map((entityId) => {
      const semanticDependencies = input.boundState.valueDependencies.filter(({ kind, id, role }) =>
        kind === "canonical-entity" && id === entityId && role === "identity candidate semantic value");
      if (semanticDependencies.length !== 1) {
        throw new Error(`identity candidate ${entityId} requires exactly one explicit semantic value dependency for tombstone continuity`);
      }
      const lastSemanticHash = semanticDependencies[0]!.versionHash;
      const basis = { entityId, lastSemanticHash, replacementIds: proposedTargetIds, reason: lineageBasis!.reason };
      if (lineageKind === "delete" && basis.replacementIds.length !== 0) throw new Error("delete tombstone cannot have replacement IDs");
      TombstoneSchema.parse({ ...basis, deletedAtRevision: 0 });
      return { id: `tombstone_proposal_${hashFramedDomain("identity-tombstone-proposal", basis).slice(-32)}`, canonical: false as const, ...basis };
    }) : [];
  const semantic = {
    contractVersion: 1 as const,
    requestedMeaning: input.requestedMeaning.normalize("NFKC").trim(),
    requestedKind: input.requestedKind,
    outcome: resolved.outcome,
    candidates,
    candidateRecords: structuredClone(records),
    selectedEntityIds: resolved.selectedEntityIds,
    ...(resolved.newBoundary === undefined ? {} : {
      newBoundary: {
        owns: sortedUnique(resolved.newBoundary.owns),
        excludes: sortedUnique(resolved.newBoundary.excludes),
        nearestEntityIds: sortedUnique(resolved.newBoundary.nearestEntityIds),
        rationale: resolved.newBoundary.rationale,
      },
    }),
    confidence,
    evidence,
    unknowns: resolved.unknowns,
    boundState: structuredClone(input.boundState),
  };
  const adjudication = input.outcomeEvidence !== undefined && verifiedOutcomeEvidence.has(input.outcomeEvidence)
    && (resolved.outcome !== "unresolved" || input.assessment === "ambiguous") ? {
    kind: input.outcomeEvidence.kind,
    operation: input.assessment,
    sourceIds,
    proposedTargetIds,
    factPayloads: canonicalJsonSet(input.outcomeEvidence.verifiedClaims ?? []).map(({ object }) => structuredClone(object)),
    evidenceIds: sortedUnique(input.outcomeEvidence.evidenceIds),
    claims: canonicalJsonSet(input.outcomeEvidence.verifiedClaims ?? []),
    claimHashes: sortedUnique((input.outcomeEvidence.verifiedClaims ?? []).map((claim) => hashFramedDomain("identity-adjudication-claim-ref", claim))) as ContentHash[],
    lineageProposals: structuredClone(lineageProposals),
    tombstoneProposals: structuredClone(tombstoneProposals),
  } : undefined;
  const adjudicationWithHash = adjudication === undefined ? undefined : {
    ...adjudication,
    contentHash: hashFramedDomain("identity-adjudication", adjudication),
  };
  const contentHash = hashFramedDomain("semantic-identity-resolution", {
    ...semantic,
    operation: input.assessment,
    proposedTargetIds,
    lineageProposals,
    tombstoneProposals,
    ...(adjudicationWithHash === undefined ? {} : { adjudication: adjudicationWithHash }),
  });
  const result = {
    id: `identity_resolution_${contentHash.slice(-32)}`,
    ...semantic,
    operation: input.assessment,
    proposedTargetIds,
    ...(adjudicationWithHash === undefined ? {} : { adjudication: adjudicationWithHash }),
    lineageProposals,
    tombstoneProposals,
    contentHash,
  };
  return AdjudicatedSemanticIdentityResolutionSchema.parse(result) as AdjudicatedSemanticIdentityResolution;
}

/** Loads and hash-verifies directly applicable typed claims before deciding any durable identity outcome. */
export async function resolveSemanticIdentityFromEvidence(
  input: ResolveSemanticIdentityInput,
  repository: TrustedIdentityEvidenceRepository,
): Promise<AdjudicatedSemanticIdentityResolution> {
  const prepared = prepareIdentityInput(input);
  const analysis = candidateAnalysis(prepared.records, prepared.requestedKind, prepared.boundState);
  assertValidLifecycleAnalysis(analysis);
  const supportingIds = sortedUnique(prepared.evidence.filter(({ stance }) => stance === "supports").map(({ evidenceId }) => evidenceId));
  const evidence = await Promise.all(supportingIds.map(async (id) => parseVerifiedEvidence(await repository.loadEvidence(id), id)));
  const applicable = evidence.filter((item) => item.applicability === "direct" && item.reliability !== "low" && item.reliability !== "untrusted");
  const outcomeEvidence = outcomeFactFromEvidence(prepared.assessment, applicable, prepared, analysis);
  if (outcomeEvidence !== undefined) verifiedOutcomeEvidence.add(outcomeEvidence);
  const { outcomeEvidence: _callerOutcome, ...trustedInput } = prepared;
  return resolvePreparedSemanticIdentity(
    outcomeEvidence === undefined ? trustedInput : { ...trustedInput, outcomeEvidence },
    analysis,
  );
}

/** Executes the complete read-only identity boundary and binds its selected values and negative-space queries. */
export async function resolveSemanticIdentityFromSearch(
  input: ResolveSemanticIdentityFromSearchInput,
): Promise<AdjudicatedSemanticIdentityResolution> {
  if (canonicalJson(input.context.stateDigest) !== canonicalJson(input.compiledAgainst)) {
    throw new Error("identity search context snapshot differs from compiledAgainst state");
  }
  const search = await input.search.inspect({ requestedMeaning: input.requestedMeaning, requestedKind: input.requestedKind }, input.context);
  const boundState = createStateBinding({
    compiledAgainst: input.compiledAgainst,
    valueDependencies: search.valueDependencies,
    queryDependencies: search.queryDependencies,
  });
  const { compiledAgainst: _compiledAgainst, context: _context, search: _search, evidenceRepository, ...resolutionInput } = input;
  return resolveSemanticIdentityFromEvidence({ ...resolutionInput, records: search.records, boundState }, evidenceRepository);
}

export interface TrustedIdentityCreationRepository {
  loadResolution(resolutionId: string): Promise<unknown>;
  loadAuthorityEnvelope(authorityRecordId: string): Promise<unknown>;
  loadEvidence(evidenceId: string): Promise<unknown>;
  validateBinding(binding: StateBinding): Promise<unknown>;
  verifyAdjudication(resolution: SemanticIdentityResolution): Promise<boolean>;
}

export interface CanonicalCreationRequest {
  resolutionId: string;
  authorityRecordId: string;
}

function parseIdentityAdjudication(value: unknown): IdentityAdjudication {
  const record = IdentityAdjudicationSchema.parse(value) as IdentityAdjudication;
  if (record.kind !== record.operation) {
    throw new Error("trusted identity adjudication is invalid");
  }
  const claims = record.claims
    .map((claim) => structuredClone(claim))
    .sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  const expectedClaimHashes = sortedUnique(claims.map((claim) => hashFramedDomain("identity-adjudication-claim-ref", claim))) as ContentHash[];
  const expectedFactPayloads = claims.map(({ object }) => structuredClone(object));
  const basis = {
    kind: record.kind,
    operation: record.operation,
    sourceIds: sortedUnique(record.sourceIds),
    proposedTargetIds: sortedUnique(record.proposedTargetIds),
    factPayloads: structuredClone(record.factPayloads),
    evidenceIds: sortedUnique(record.evidenceIds),
    claims,
    claimHashes: sortedUnique(record.claimHashes) as ContentHash[],
    lineageProposals: structuredClone(record.lineageProposals),
    tombstoneProposals: structuredClone(record.tombstoneProposals),
  };
  if (canonicalJson(record.sourceIds) !== canonicalJson(basis.sourceIds)
    || canonicalJson(record.proposedTargetIds) !== canonicalJson(basis.proposedTargetIds)
    || canonicalJson(basis.factPayloads) !== canonicalJson(expectedFactPayloads)) {
    throw new Error("trusted identity adjudication endpoint sets are not normalized and unique");
  }
  for (const proposal of basis.lineageProposals) {
    if (proposal.canonical !== false || validateLineage(proposal).length > 0) throw new Error("trusted identity adjudication lineage proposal is invalid");
    LineageRecordSchema.parse({
      id: proposal.id, kind: proposal.kind, fromIds: proposal.fromIds, toIds: proposal.toIds,
      reason: proposal.reason, stateDigest: proposal.stateDigest,
    });
  }
  for (const proposal of basis.tombstoneProposals) {
    if (proposal.canonical !== false || new Set(proposal.replacementIds).size !== proposal.replacementIds.length) {
      throw new Error("trusted identity adjudication tombstone proposal is invalid");
    }
    TombstoneSchema.parse({
      entityId: proposal.entityId, deletedAtRevision: 0, lastSemanticHash: proposal.lastSemanticHash,
      replacementIds: proposal.replacementIds, reason: proposal.reason,
    });
  }
  if (canonicalJson(basis.claimHashes) !== canonicalJson(expectedClaimHashes)
    || claims.some(({ evidenceId }) => !basis.evidenceIds.includes(evidenceId))) {
    throw new Error("trusted identity adjudication claim references are invalid");
  }
  if (hashFramedDomain("identity-adjudication", basis) !== record.contentHash) throw new Error("trusted identity adjudication content hash mismatch");
  return { ...basis, contentHash: record.contentHash };
}

/** Explicit mutation gate. All provenance is loaded from an injected authoritative repository. */
export async function assertCanonicalCreationAllowed(
  request: CanonicalCreationRequest,
  repository: TrustedIdentityCreationRepository,
): Promise<StateBinding> {
  const resolution = AdjudicatedSemanticIdentityResolutionSchema.parse(
    await repository.loadResolution(request.resolutionId),
  ) as AdjudicatedSemanticIdentityResolution;
  if (resolution.id !== request.resolutionId) throw new Error("canonical creation refused: trusted resolution ID mismatch");
  const { id: _id, contentHash: _contentHash, ...resolutionSemantic } = resolution;
  const adjudication = resolution.adjudication === undefined ? undefined : parseIdentityAdjudication(resolution.adjudication);
  if (canonicalJson(sortedUnique(resolution.proposedTargetIds)) !== canonicalJson(resolution.proposedTargetIds)
    || (adjudication !== undefined && (adjudication.operation !== resolution.operation
      || canonicalJson(adjudication.proposedTargetIds) !== canonicalJson(resolution.proposedTargetIds)
      || canonicalJson(adjudication.lineageProposals) !== canonicalJson(resolution.lineageProposals)
      || canonicalJson(adjudication.tombstoneProposals) !== canonicalJson(resolution.tombstoneProposals)))) {
    throw new Error("canonical creation refused: resolution continuity differs from its adjudication");
  }
  if (hashFramedDomain("semantic-identity-resolution", resolutionSemantic) !== resolution.contentHash) {
    throw new Error("canonical creation refused: trusted resolution content hash mismatch");
  }
  if (resolution.id !== `identity_resolution_${resolution.contentHash.slice(-32)}`) {
    throw new Error("canonical creation refused: trusted resolution ID is not bound to its content hash");
  }
  if (createStateBinding(resolution.boundState).dependencyDigest !== resolution.boundState.dependencyDigest) {
    throw new Error("canonical creation refused: trusted resolution StateBinding digest mismatch");
  }
  if (!await repository.verifyAdjudication(resolution)) {
    throw new Error("canonical creation refused: trusted repository has no verified adjudication provenance for this resolution");
  }
  const validation = StateBindingValidationSchema.parse(await repository.validateBinding(resolution.boundState)) as StateBindingValidation;
  if (validation.changedValueDependencyIds.length > 0 || validation.changedQueryDependencyIds.length > 0) {
    throw new Error(`canonical creation refused: ${validation.status} binding validation is inconsistent with changed dependencies`);
  }
  let mutationBinding: StateBinding;
  if (validation.status === "current") {
    if (validation.rebound !== undefined || canonicalJson(validation.currentState) !== canonicalJson(resolution.boundState.compiledAgainst)) {
      throw new Error("canonical creation refused: current binding validation is internally inconsistent");
    }
    mutationBinding = resolution.boundState;
  } else if (validation.status === "rebound") {
    if (validation.rebound === undefined
      || canonicalJson(validation.rebound.compiledAgainst) !== canonicalJson(validation.currentState)
      || createStateBinding(validation.rebound).dependencyDigest !== validation.rebound.dependencyDigest
      || validation.rebound.dependencyDigest !== resolution.boundState.dependencyDigest) {
      throw new Error("canonical creation refused: rebound binding validation is internally inconsistent");
    }
    mutationBinding = validation.rebound;
  } else {
    throw new Error("canonical creation refused: identity resolution was not adjudicated against current authoritative state");
  }
  if (resolution.outcome !== "create-new") {
    throw new Error(`canonical creation refused: identity outcome ${resolution.outcome} is unresolved or overlaps existing authority`);
  }
  const candidateEligibility = candidateAnalysis(resolution.candidateRecords, resolution.requestedKind, resolution.boundState);
  assertValidLifecycleAnalysis(candidateEligibility);
  if (candidateEligibility.supportedRecords.length > 0
    || candidateEligibility.unresolvedHistoricalBlockers.length > 0
    || hasUnresolvedCandidateSearchBlocker(resolution.boundState, resolution.candidateRecords)) {
    throw new Error("canonical creation refused: persisted eligible candidates or unresolved identity history block duplicate creation");
  }
  if (adjudication?.kind !== "distinct" || adjudication.claims.length === 0) {
    throw new Error("canonical creation refused: persisted hash-bound distinct adjudication facts are required");
  }
  if (!validBoundary(resolution.newBoundary)) throw new Error("canonical creation refused: inspectable semantic boundary is required");
  if (resolution.confidence < 0.75 || resolution.evidence.every(({ evidenceId, stance }) => evidenceId.trim().length === 0 || stance !== "supports")) {
    throw new Error("canonical creation refused: identity resolution evidence and confidence do not meet the authoritative acceptance threshold");
  }
  const supportingResolutionRefs = resolution.evidence.filter(({ stance }) => stance === "supports");
  const resolutionEvidence = await Promise.all(supportingResolutionRefs.map(async ({ evidenceId }) => ({
    evidenceId,
    evidence: parseVerifiedEvidence(await repository.loadEvidence(evidenceId), evidenceId),
  })));
  if (resolutionEvidence.length === 0 || resolutionEvidence.some(({ evidenceId, evidence: item }) =>
    item.id !== evidenceId
    || item.applicability !== "direct"
    || item.reliability === "low"
    || item.reliability === "untrusted"
    || !item.claims.some(({ subjectKey, predicate, object }) =>
      subjectKey === resolution.id && predicate === "identity-create-new-supported" && object === true))) {
    throw new Error("canonical creation refused: trusted directly applicable resolution evidence claim is required");
  }
  const resolutionEvidenceById = new Map(resolutionEvidence.map(({ evidenceId, evidence: item }) => [evidenceId, item]));
  if (adjudication.claims.some(({ evidenceId, ...expectedClaim }) => {
    const item = resolutionEvidenceById.get(evidenceId);
    return item === undefined || !item.claims.some((claim) => canonicalJson(claim) === canonicalJson(expectedClaim));
  })) {
    throw new Error("canonical creation refused: persisted adjudication facts do not match hash-verified repository Evidence");
  }
  const authorityEnvelope = CanonicalDocumentEnvelopeSchema.parse(await repository.loadAuthorityEnvelope(request.authorityRecordId)) as CanonicalDocumentEnvelope;
  if (authorityEnvelope.kind !== "authority-record" || authorityEnvelope.id !== request.authorityRecordId) {
    throw new Error("canonical creation refused: trusted Authority Record envelope mismatch");
  }
  const authority = AuthorityRecordSchema.parse(authorityEnvelope.payload) as AuthorityRecord;
  if ((authority.status !== "approved" && authority.status !== "auto-approved") || (authority.decidedBy !== "user" && authority.decidedBy !== "policy")) {
    throw new Error("canonical creation refused: approved user or policy Authority Record is required");
  }
  if (authority.subjectId !== resolution.id || authority.rationale.trim().length === 0) {
    throw new Error("canonical creation refused: Authority Record must directly govern this identity resolution");
  }
  if (authority.conclusion !== "normalize") {
    throw new Error(`canonical creation refused: Authority Record conclusion ${authority.conclusion} does not normatively authorize create-new`);
  }
  const evidence = await Promise.all(authority.evidence.map(async ({ evidenceId }) => parseVerifiedEvidence(await repository.loadEvidence(evidenceId), evidenceId)));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  if (authority.evidence.length === 0 || authority.evidence.some(({ evidenceId, stance }) => {
    const item = evidenceById.get(evidenceId);
    const creationClaims = item?.claims.filter(({ subjectKey, predicate }) =>
      subjectKey === resolution.id && predicate === "canonical-creation-approved") ?? [];
    return evidenceId.trim().length === 0 || item === undefined || item.id !== evidenceId || item.applicability !== "direct"
      || item.reliability === "low" || item.reliability === "untrusted"
      || stance !== "supports"
      || (item.normativeAuthority !== "binding-decision" && item.normativeAuthority !== "hard-constraint")
      || creationClaims.length === 0 || creationClaims.some(({ object }) => object !== true);
  })) throw new Error("canonical creation refused: validated nonblank authoritative evidence is required");
  return structuredClone(mutationBinding);
}
