import {
  canonicalJson,
  hashFramedDomain,
  type AuthorityRecord,
  type AdapterContext,
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
  type StateValueDependencyRef,
} from "@projector/core";

import { createStateBinding } from "../state/index.js";

export type IdentityAssessment = "same" | "overlap" | "split" | "merge" | "replace" | "delete" | "distinct" | "ambiguous";
export type IdentityLifecycle = "active" | "deprecated" | "superseded" | "tombstone";

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
  records: readonly IdentityCandidateRecord[];
  newBoundary?: NewSemanticBoundary;
  boundState: StateBinding;
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
  lineageProposals: IdentityLineageProposal[];
  tombstoneProposals: IdentityTombstoneProposal[];
}

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

function validateIdentityBinding(binding: StateBinding): void {
  const normalized = createStateBinding(binding);
  if (normalized.dependencyDigest !== binding.dependencyDigest) throw new Error("identity dependency binding digest is invalid");
  const programs = new Set(binding.queryDependencies.map(({ query }) => query.programId));
  const missing = requiredIdentityPrograms.filter((program) => !programs.has(program));
  if (missing.length > 0) throw new Error(`identity dependency binding is incomplete: ${missing.join(", ")}`);
  for (const dependency of binding.queryDependencies) {
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
    .filter(({ kind, role }) => kind === "canonical-entity" && role.includes("identity candidate"))
    .map(({ id }) => String(id)));
  const requiredIds = sortedUnique(records.flatMap(({ candidate, replacementIds }) => [candidate.entityId, ...replacementIds]));
  const missing = requiredIds.filter((id) => !boundIds.has(id));
  if (missing.length > 0) throw new Error(`identity candidate value hashes are incomplete: ${missing.join(", ")}`);
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
  if (input.durableEntity) validateIdentityBinding(input.boundState);
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
  if (resolved.outcome === "split-existing" && (sourceIds.length !== 1 || proposedTargetIds.length < 2)) throw new Error("split lineage requires exactly one source and at least two targets");
  if (resolved.outcome === "merge-existing" && (sourceIds.length < 2 || proposedTargetIds.length !== 1)) throw new Error("merge lineage requires at least two sources and exactly one target");
  if (resolved.outcome === "replace-existing" && (sourceIds.length !== 1 || proposedTargetIds.length < 1)) throw new Error("replace lineage requires one source and at least one replacement");
  if (input.assessment === "delete" && sourceIds.length !== 1) throw new Error("delete lineage requires exactly one source");
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
      const lastSemanticHash = input.boundState.valueDependencies.find(({ id }) => id === entityId)?.versionHash
        ?? input.boundState.valueDependencies[0]!.versionHash;
      const basis = { entityId, lastSemanticHash, replacementIds: proposedTargetIds, reason: lineageBasis!.reason };
      return { id: `tombstone_proposal_${hashFramedDomain("identity-tombstone-proposal", basis).slice(-32)}`, canonical: false as const, ...basis };
    }) : [];
  const semantic = {
    requestedMeaning: input.requestedMeaning.normalize("NFKC").trim(),
    requestedKind: input.requestedKind,
    assessment: input.assessment,
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
    lineageProposals,
    tombstoneProposals,
  };
  const contentHash = hashFramedDomain("semantic-identity-resolution", semantic);
  return {
    id: `identity_resolution_${contentHash.slice(-32)}`,
    ...semantic,
    contentHash,
  };
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
  const { compiledAgainst: _compiledAgainst, context: _context, search: _search, ...resolutionInput } = input;
  return resolveSemanticIdentity({ ...resolutionInput, records: search.records, boundState });
}

/** Explicit mutation gate: inferred resolution evidence cannot silently mint authority. */
export function assertCanonicalCreationAllowed(
  resolution: SemanticIdentityResolution,
  acceptance?: { authority: AuthorityRecord; evidence: readonly Evidence[] },
): void {
  if (resolution.outcome !== "create-new") {
    throw new Error(`canonical creation refused: identity outcome ${resolution.outcome} is unresolved or overlaps existing authority`);
  }
  if (!validBoundary(resolution.newBoundary)) throw new Error("canonical creation refused: inspectable semantic boundary is required");
  if (resolution.confidence < 0.75 || resolution.evidence.every(({ evidenceId, stance }) => evidenceId.trim().length === 0 || stance !== "supports")) {
    throw new Error("canonical creation refused: identity resolution evidence and confidence do not meet the authoritative acceptance threshold");
  }
  if (acceptance === undefined) {
    throw new Error("canonical creation refused: derived identity resolution requires explicit user or policy acceptance authority");
  }
  const { authority, evidence } = acceptance;
  if ((authority.status !== "approved" && authority.status !== "auto-approved") || (authority.decidedBy !== "user" && authority.decidedBy !== "policy")) {
    throw new Error("canonical creation refused: approved user or policy Authority Record is required");
  }
  if (authority.subjectId !== resolution.id || authority.rationale.trim().length === 0) {
    throw new Error("canonical creation refused: Authority Record must directly govern this identity resolution");
  }
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  if (authority.evidence.length === 0 || authority.evidence.some(({ evidenceId }) => {
    const item = evidenceById.get(evidenceId);
    return evidenceId.trim().length === 0 || item === undefined || item.applicability !== "direct"
      || item.reliability === "low" || item.reliability === "untrusted"
      || (item.normativeAuthority !== "binding-decision" && item.normativeAuthority !== "hard-constraint");
  })) throw new Error("canonical creation refused: validated nonblank authoritative evidence is required");
}
