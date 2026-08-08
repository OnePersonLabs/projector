import {
  AuthorityRecordSchema,
  CanonicalDocumentEnvelopeSchema,
  EvidenceSchema,
  SemanticIdentityResolutionSchema,
  StateBindingValidationSchema,
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
} from "@projector/core";

import { createStateBinding } from "../state/index.js";

export type IdentityAssessment = "same" | "overlap" | "split" | "merge" | "replace" | "delete" | "distinct" | "ambiguous";
export type IdentityLifecycle = "active" | "deprecated" | "superseded" | "tombstone";

type OutcomeFact =
  | { kind: "same"; equivalentMeaning: true }
  | { kind: "overlap"; sharedOwnership: true }
  | { kind: "split"; partitionMeanings: readonly string[] }
  | { kind: "merge"; convergentTargetMeaning: string }
  | { kind: "replace"; incompatibility: string }
  | { kind: "delete"; durableMeaningCeased: true }
  | { kind: "distinct"; independentBoundary: true }
  | { kind: "ambiguous"; unresolvedConflict: string };

interface VerifiedIdentityClaimRef {
  evidenceId: string;
  subjectKey: string;
  predicate: string;
  object: unknown;
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
  adjudication?: IdentityAdjudication;
  lineageProposals: IdentityLineageProposal[];
  tombstoneProposals: IdentityTombstoneProposal[];
}

export interface IdentityAdjudication {
  kind: IdentityAssessment;
  evidenceIds: string[];
  claims: VerifiedIdentityClaimRef[];
  claimHashes: ContentHash[];
  contentHash: ContentHash;
}

export interface TrustedIdentityEvidenceRepository {
  loadEvidence(evidenceId: string): Promise<unknown>;
}

const verifiedOutcomeEvidence = new WeakSet<object>();

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

function normalizeCandidate(candidate: SemanticIdentityCandidate): SemanticIdentityCandidate {
  return {
    ...structuredClone(candidate),
    evidence: [...candidate.evidence].sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right))),
  };
}

function activeTargets(records: readonly IdentityCandidateRecord[]): string[] {
  return sortedUnique(records.flatMap(({ candidate, lifecycle, replacementIds }) =>
    (lifecycle === "superseded" || lifecycle === "tombstone")
      ? replacementIds
      : [candidate.entityId]));
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
  input: Pick<ResolveSemanticIdentityInput, "requestedMeaning" | "records">,
): IdentityOutcomeEvidence | undefined {
  const evidenceIds = sortedUnique(evidence.map(({ id }) => id));
  const applicableSubjects = new Set([
    input.requestedMeaning.normalize("NFKC").trim(),
    ...input.records.map(({ candidate }) => candidate.entityId),
  ]);
  const claims = evidence.flatMap((item) => item.claims
    .filter(({ subjectKey }) => applicableSubjects.has(subjectKey))
    .map((claim) => ({ evidenceId: item.id, claim })));
  const matching = <T>(predicate: string, accept: (value: unknown) => T | undefined): Array<{ evidenceId: string; value: T }> =>
    claims.flatMap(({ evidenceId, claim }) => {
      if (claim.predicate !== predicate) return [];
      const value = accept(claim.object);
      return value === undefined ? [] : [{ evidenceId, value }];
    });
  const facts: IdentityOutcomeEvidence[] = [];
  if (matching("identity-equivalent", (value) => value === true ? true : undefined).length > 0) {
    facts.push({ kind: "same", equivalentMeaning: true, evidenceIds, rationale: "verified identity equivalence claim" });
  }
  if (matching("identity-shared-ownership", (value) => value === true ? true : undefined).length > 0) {
    facts.push({ kind: "overlap", sharedOwnership: true, evidenceIds, rationale: "verified coordination claim" });
  }
  const partitions = matching("identity-partition", (value) => Array.isArray(value) && value.length >= 2 && value.every((item) => typeof item === "string" && item.trim().length > 0) ? value as string[] : undefined);
  if (partitions.length > 0) facts.push({ kind: "split", partitionMeanings: partitions[0]!.value, evidenceIds, rationale: "verified partition claim" });
  const convergence = matching("identity-convergence", (value) => typeof value === "string" && value.trim().length > 0 ? value : undefined);
  if (convergence.length > 0) facts.push({ kind: "merge", convergentTargetMeaning: convergence[0]!.value, evidenceIds, rationale: "verified convergence claim" });
  const supersession = matching("identity-supersession", (value) => typeof value === "string" && value.trim().length > 0 ? value : undefined);
  if (supersession.length > 0) facts.push({ kind: "replace", incompatibility: supersession[0]!.value, evidenceIds, rationale: "verified continuity and supersession claim" });
  const cessation = matching("identity-cessation", (value) => value === true ? true : undefined).length > 0;
  const noDurable = matching("identity-no-durable-entity", (value) => value === true ? true : undefined).length > 0;
  if (cessation && noDurable) facts.push({ kind: "delete", durableMeaningCeased: true, evidenceIds, rationale: "verified cessation and no-durable-entity claims" });
  if (matching("identity-distinct-boundary", (value) => value === true ? true : undefined).length > 0) {
    facts.push({ kind: "distinct", independentBoundary: true, evidenceIds, rationale: "verified distinct boundary claim" });
  }
  const conflicts = matching("identity-conflict", (value) => typeof value === "string" && value.trim().length > 0 ? value : undefined);
  if (conflicts.length > 0) facts.push({ kind: "ambiguous", unresolvedConflict: conflicts[0]!.value, evidenceIds, rationale: "verified conflicting identity claims" });
  if (facts.length > 1) throw new Error(`mutually inconsistent identity outcome facts: ${facts.map(({ kind }) => kind).join(", ")}`);
  const fact = facts[0];
  if (fact?.kind !== assessment) return undefined;
  const predicatesByKind: Record<IdentityAssessment, readonly string[]> = {
    same: ["identity-equivalent"],
    overlap: ["identity-shared-ownership"],
    split: ["identity-partition"],
    merge: ["identity-convergence"],
    replace: ["identity-supersession"],
    delete: ["identity-cessation", "identity-no-durable-entity"],
    distinct: ["identity-distinct-boundary"],
    ambiguous: ["identity-conflict"],
  };
  return {
    ...fact,
    verifiedClaims: claims
      .filter(({ claim }) => predicatesByKind[fact.kind].includes(claim.predicate))
      .map(({ evidenceId, claim }) => ({ evidenceId, ...structuredClone(claim) }))
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

function validBoundary(boundary: NewSemanticBoundary | undefined): boundary is NewSemanticBoundary {
  return boundary !== undefined
    && boundary.owns.some((value) => value.trim().length > 0)
    && boundary.excludes.some((value) => value.trim().length > 0)
    && boundary.rationale.trim().length > 0;
}

function decision(input: ResolveSemanticIdentityInput, records: readonly IdentityCandidateRecord[]): {
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
  const supported = records.filter((record) => supportsRequestedIdentity(record, input.requestedKind));
  const targets = activeTargets(supported);
  const historicalBlockers = supported.filter(({ lifecycle, replacementIds }) => lifecycle === "tombstone" && replacementIds.length === 0);
  if (input.assessment === "ambiguous") {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique([...unknowns, "semantic ownership remains ambiguous"]) };
  }
  if (input.assessment === "distinct") {
    const unresolvedSearchResults = records.length === 0 && input.boundState.queryDependencies.some(({ query, priorResult }) =>
      ["identity.exact-search", "identity.alias-search", "identity.lineage", "identity.tombstone"].includes(query.programId)
      && priorResult.resultCount > 0);
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
  if (input.requestedMeaning.trim().length === 0) throw new Error("requested semantic meaning cannot be blank");
  if (input.durableEntity) validateIdentityBinding(input.boundState, input.requestedMeaning, input.requestedKind, input.queryRegistry);
  const records = normalizeRecords(input.records);
  if (input.durableEntity) validateCandidateValueDependencies(input.boundState, records);
  const candidates = records.map(({ candidate }) => candidate);
  const resolved = decision(input, records);
  const evidence = [...input.evidence].sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  const candidateScores = candidates.map(({ similarity, ownershipFit, boundaryFit }) => Math.min(similarity, ownershipFit, boundaryFit));
  const confidence = resolved.outcome === "no-durable-entity" ? 1
    : resolved.outcome === "unresolved" ? Math.min(0.49, ...candidates.map(({ similarity, ownershipFit, boundaryFit }) => Math.min(similarity, ownershipFit, boundaryFit)), 0.49)
      : resolved.outcome === "create-new" ? candidates.length === 0 ? 1 : 1 - Math.max(...candidateScores)
        : candidates.length === 0 ? 1 : Math.min(...candidateScores);
  const proposedTargetIds = sortedUnique(input.proposedTargetIds ?? []);
  const sourceIds = resolved.selectedEntityIds;
  const lineageKind: IdentityLineageProposal["kind"] | undefined = resolved.outcome === "split-existing" ? "split"
    : resolved.outcome === "merge-existing" ? "merge"
      : resolved.outcome === "replace-existing" ? "replace"
        : input.assessment === "delete" && resolved.outcome === "no-durable-entity" && input.durableEntity ? "delete" : undefined;
  if (lineageKind !== undefined && (proposedTargetIds.some((id) => id.trim().length === 0) || proposedTargetIds.some((id) => sourceIds.includes(id)))) {
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
  if (resolved.outcome === "replace-existing" && (sourceIds.length !== 1 || proposedTargetIds.length < 1)) throw new Error("replace lineage requires one source and at least one replacement");
  if (input.assessment === "delete" && resolved.outcome === "no-durable-entity" && sourceIds.length !== 1) throw new Error("delete lineage requires exactly one source");
  const lineageBasis = lineageKind === undefined ? undefined : {
    kind: lineageKind, fromIds: sourceIds, toIds: proposedTargetIds,
    reason: `evidence-backed ${lineageKind} of requested meaning`, stateDigest: input.boundState.compiledAgainst.canonicalProjectorDigest,
  };
  const lineageProposals: IdentityLineageProposal[] = lineageBasis === undefined ? [] : [{
    id: `lineage_proposal_${hashFramedDomain("identity-lineage-proposal", lineageBasis).slice(-32)}`,
    canonical: false, ...lineageBasis,
  }];
  const tombstoneProposals: IdentityTombstoneProposal[] = lineageKind === "replace" || lineageKind === "delete"
    ? sourceIds.map((entityId) => {
      const semanticDependencies = input.boundState.valueDependencies.filter(({ kind, id, role }) =>
        kind === "canonical-entity" && id === entityId && role === "identity candidate semantic value");
      if (semanticDependencies.length !== 1) {
        throw new Error(`identity candidate ${entityId} requires exactly one explicit semantic value dependency for tombstone continuity`);
      }
      const lastSemanticHash = semanticDependencies[0]!.versionHash;
      const basis = { entityId, lastSemanticHash, replacementIds: proposedTargetIds, reason: lineageBasis!.reason };
      return { id: `tombstone_proposal_${hashFramedDomain("identity-tombstone-proposal", basis).slice(-32)}`, canonical: false as const, ...basis };
    }) : [];
  const semantic = {
    requestedMeaning: input.requestedMeaning.normalize("NFKC").trim(),
    requestedKind: input.requestedKind,
    outcome: resolved.outcome,
    candidates,
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
  const adjudication = input.outcomeEvidence !== undefined && verifiedOutcomeEvidence.has(input.outcomeEvidence) ? {
    kind: input.outcomeEvidence.kind,
    evidenceIds: sortedUnique(input.outcomeEvidence.evidenceIds),
    claims: [...(input.outcomeEvidence.verifiedClaims ?? [])].map((claim) => structuredClone(claim)),
    claimHashes: sortedUnique((input.outcomeEvidence.verifiedClaims ?? []).map((claim) => hashFramedDomain("identity-adjudication-claim-ref", claim))) as ContentHash[],
  } : undefined;
  const adjudicationWithHash = adjudication === undefined ? undefined : {
    ...adjudication,
    contentHash: hashFramedDomain("identity-adjudication", adjudication),
  };
  const contentHash = hashFramedDomain("semantic-identity-resolution", {
    ...semantic,
    ...(adjudicationWithHash === undefined ? {} : { adjudication: adjudicationWithHash }),
  });
  return {
    id: `identity_resolution_${contentHash.slice(-32)}`,
    ...semantic,
    ...(adjudicationWithHash === undefined ? {} : { adjudication: adjudicationWithHash }),
    lineageProposals,
    tombstoneProposals,
    contentHash,
  };
}

/** Loads and hash-verifies directly applicable typed claims before deciding any durable identity outcome. */
export async function resolveSemanticIdentityFromEvidence(
  input: ResolveSemanticIdentityInput,
  repository: TrustedIdentityEvidenceRepository,
): Promise<AdjudicatedSemanticIdentityResolution> {
  const supportingIds = sortedUnique(input.evidence.filter(({ stance }) => stance === "supports").map(({ evidenceId }) => evidenceId));
  const evidence = await Promise.all(supportingIds.map(async (id) => parseVerifiedEvidence(await repository.loadEvidence(id), id)));
  const applicable = evidence.filter((item) => item.applicability === "direct" && item.reliability !== "low" && item.reliability !== "untrusted");
  const outcomeEvidence = outcomeFactFromEvidence(input.assessment, applicable, input);
  if (outcomeEvidence !== undefined) verifiedOutcomeEvidence.add(outcomeEvidence);
  const { outcomeEvidence: _callerOutcome, ...trustedInput } = input;
  return resolveSemanticIdentity(outcomeEvidence === undefined ? trustedInput : { ...trustedInput, outcomeEvidence });
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("trusted identity adjudication is invalid");
  const record = value as Record<string, unknown>;
  if (!requiredIdentityAssessment(record.kind)
    || !Array.isArray(record.evidenceIds) || record.evidenceIds.some((id) => typeof id !== "string" || id.length === 0)
    || !Array.isArray(record.claims) || record.claims.some((claim) => {
      if (typeof claim !== "object" || claim === null || Array.isArray(claim)) return true;
      const candidate = claim as Record<string, unknown>;
      return typeof candidate.evidenceId !== "string" || candidate.evidenceId.length === 0
        || typeof candidate.subjectKey !== "string" || typeof candidate.predicate !== "string" || !("object" in candidate);
    })
    || !Array.isArray(record.claimHashes) || record.claimHashes.some((hash) => typeof hash !== "string" || !hash.startsWith("sha256:v1:"))
    || typeof record.contentHash !== "string") {
    throw new Error("trusted identity adjudication is invalid");
  }
  const claims = (record.claims as VerifiedIdentityClaimRef[])
    .map((claim) => structuredClone(claim))
    .sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  const expectedClaimHashes = sortedUnique(claims.map((claim) => hashFramedDomain("identity-adjudication-claim-ref", claim))) as ContentHash[];
  const basis = {
    kind: record.kind,
    evidenceIds: sortedUnique(record.evidenceIds as string[]),
    claims,
    claimHashes: sortedUnique(record.claimHashes as string[]) as ContentHash[],
  };
  if (canonicalJson(basis.claimHashes) !== canonicalJson(expectedClaimHashes)
    || claims.some(({ evidenceId }) => !basis.evidenceIds.includes(evidenceId))) {
    throw new Error("trusted identity adjudication claim references are invalid");
  }
  if (hashFramedDomain("identity-adjudication", basis) !== record.contentHash) throw new Error("trusted identity adjudication content hash mismatch");
  return { ...basis, contentHash: record.contentHash as ContentHash };
}

function requiredIdentityAssessment(value: unknown): value is IdentityAssessment {
  return ["same", "overlap", "split", "merge", "replace", "delete", "distinct", "ambiguous"].includes(String(value));
}

/** Explicit mutation gate. All provenance is loaded from an injected authoritative repository. */
export async function assertCanonicalCreationAllowed(
  request: CanonicalCreationRequest,
  repository: TrustedIdentityCreationRepository,
): Promise<StateBinding> {
  const storedResolution = await repository.loadResolution(request.resolutionId);
  if (typeof storedResolution !== "object" || storedResolution === null || Array.isArray(storedResolution)) {
    throw new Error("canonical creation refused: trusted resolution schema is invalid");
  }
  const { adjudication: storedAdjudication, lineageProposals: _lineage, tombstoneProposals: _tombstones, ...publicResolution } = storedResolution as Record<string, unknown>;
  const resolution = SemanticIdentityResolutionSchema.parse(publicResolution) as SemanticIdentityResolution;
  if (resolution.id !== request.resolutionId) throw new Error("canonical creation refused: trusted resolution ID mismatch");
  const { id: _id, contentHash: _contentHash, ...resolutionSemantic } = resolution;
  const adjudication = storedAdjudication === undefined ? undefined : parseIdentityAdjudication(storedAdjudication);
  if (hashFramedDomain("semantic-identity-resolution", {
    ...resolutionSemantic,
    ...(adjudication === undefined ? {} : { adjudication }),
  }) !== resolution.contentHash) {
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
  const evidence = await Promise.all(authority.evidence.map(async ({ evidenceId }) => parseVerifiedEvidence(await repository.loadEvidence(evidenceId), evidenceId)));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  if (authority.evidence.length === 0 || authority.evidence.some(({ evidenceId, stance }) => {
    const item = evidenceById.get(evidenceId);
    return evidenceId.trim().length === 0 || item === undefined || item.id !== evidenceId || item.applicability !== "direct"
      || item.reliability === "low" || item.reliability === "untrusted"
      || stance !== "supports"
      || (item.normativeAuthority !== "binding-decision" && item.normativeAuthority !== "hard-constraint")
      || !item.claims.some(({ subjectKey, predicate, object }) =>
        subjectKey === resolution.id && predicate === "canonical-creation-approved" && object === true);
  })) throw new Error("canonical creation refused: validated nonblank authoritative evidence is required");
  return structuredClone(mutationBinding);
}
