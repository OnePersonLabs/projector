import type {
  AuthorityRecord,
  ContentHash,
  Evidence,
  SemanticIdentityCandidate,
  StateBinding,
  StateDigest,
} from "@projector/core";
import { hashFramedDomain, withCanonicalHashes } from "@projector/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  assertCanonicalCreationAllowed,
  AdjudicatedSemanticIdentityResolutionSchema,
  computeEvidenceContentHash,
  resolveSemanticIdentityFromSearch,
  resolveSemanticIdentityFromEvidence,
  resolveSemanticIdentity,
  type AdjudicatedSemanticIdentityResolution,
  type IdentityCandidateRecord,
} from "./index.js";
import { createIdentityBoundaryQueryPrograms, InMemoryGraphReader, QueryDependencyRegistry } from "../query/index.js";
import { createStateBinding } from "../state/index.js";

const hash = (value: string): ContentHash => hashFramedDomain("identity-test", value);
const state: StateDigest = {
  gitBase: "base",
  worktreeDigest: hash("worktree"),
  canonicalProjectorDigest: hash("canonical"),
  toolchainDigest: hash("toolchain"),
};
const queryRegistry = new QueryDependencyRegistry(new InMemoryGraphReader());
for (const program of createIdentityBoundaryQueryPrograms({
  inspect: (lane) => ({
    results: [], observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: [`identity-boundary:${lane}`],
  }),
})) queryRegistry.register(program);
const binding: StateBinding = createStateBinding({
  compiledAgainst: state,
  valueDependencies: ["cap-midi-discovery", "concept-timing", "deleted", "existing", "same-id", "a", "b", "child-a", "child-b", "split-a", "split-b", "merged", "replacement", "req-device-enumeration", "old-midi-discovery"]
    .map((id) => ({ kind: "canonical-entity" as const, id, versionHash: hash(`candidate-${id}`), role: "identity candidate semantic value" })),
  queryDependencies: [
    ["identity-exact", "semantic-identity-search", "identity.exact-search"],
    ["identity-alias", "semantic-identity-search", "identity.alias-search"],
    ["identity-lineage", "custom", "identity.lineage"],
    ["identity-tombstones", "custom", "identity.tombstone"],
    ["identity-relations", "relation-neighborhood", "identity.relations"],
    ["identity-topology", "custom", "identity.topology"],
  ].map(([id, _kind, programId]) => {
    const query = queryRegistry.createSpec({ id: id!, programId: programId!, input: { requestedMeaning: "wireless MIDI device enumeration", requestedKind: "concept" } });
    return ({
    query,
    priorResult: { queryHash: query.semanticHash, resultHash: hash(`${id}-result`), resultCount: 1, observability: "closed" as const, assumptions: [], unavailableLanes: [], dependencyKeys: [`identity:${id}`] },
    role: `${programId} negative space`,
  }); }),
});
const emptyBinding: StateBinding = createStateBinding({
  compiledAgainst: state,
  valueDependencies: [],
  queryDependencies: binding.queryDependencies.map((dependency) => ({
    ...dependency,
    priorResult: { ...dependency.priorResult, resultCount: 0, resultHash: hash(`${dependency.query.id}-empty`) },
  })),
});

const candidate = (entityId: string, score = 0.95): SemanticIdentityCandidate => ({
  entityId,
  entityKind: "concept",
  similarity: score,
  ownershipFit: score,
  boundaryFit: score,
  evidence: [{ evidenceId: `evidence-${entityId}`, stance: "supports" }],
  explanation: `${entityId} owns the requested behavior`,
});

const record = (
  entityId: string,
  lifecycle: IdentityCandidateRecord["lifecycle"] = "active",
  replacementIds: string[] = [],
): IdentityCandidateRecord => ({ candidate: candidate(entityId), lifecycle, replacementIds });

const adjudication = (kind: import("./index.js").IdentityAssessment): import("./index.js").IdentityOutcomeEvidence => {
  const common = { evidenceIds: ["request"], rationale: `typed ${kind} semantic adjudication` };
  switch (kind) {
    case "same": return { ...common, kind, equivalentMeaning: true };
    case "overlap": return { ...common, kind, sharedOwnership: true };
    case "split": return { ...common, kind, partitionMeanings: ["partition A", "partition B"] };
    case "merge": return { ...common, kind, convergentTargetMeaning: "merged meaning" };
    case "replace": return { ...common, kind, incompatibility: "old meaning cannot satisfy the new lifecycle" };
    case "delete": return { ...common, kind, durableMeaningCeased: true };
    case "distinct": return { ...common, kind, independentBoundary: true };
    case "ambiguous": return { ...common, kind, unresolvedConflict: "conflicting ownership evidence" };
  }
};

const outcomeClaims = (
  kind: import("./index.js").IdentityAssessment,
  input: Pick<Parameters<typeof resolveSemanticIdentity>[0], "requestedMeaning" | "requestedKind" | "records" | "proposedTargetIds" | "newBoundary"> = base,
): Evidence["claims"] => {
  const requestedMeaning = input.requestedMeaning.normalize("NFKC").trim();
  const supportedRecords = input.records.filter(({ candidate }) =>
    (input.requestedKind === "unknown" || candidate.entityKind === input.requestedKind)
    && candidate.similarity >= 0.75 && candidate.ownershipFit >= 0.75 && candidate.boundaryFit >= 0.7
    && candidate.explanation.trim().length > 0
    && candidate.evidence.some(({ evidenceId, stance }) => evidenceId.trim().length > 0 && stance === "supports"));
  const proposedTargetIds = [...new Set(input.proposedTargetIds ?? [])].sort();
  const sourceIds = [...new Set(supportedRecords.flatMap(({ candidate, lifecycle, replacementIds }) =>
    lifecycle === "superseded" || lifecycle === "tombstone" ? replacementIds : [candidate.entityId]))].sort();
  const targetIds = kind === "same" || kind === "overlap"
    ? sourceIds
    : proposedTargetIds;
  const requestId = `identity_request_${hashFramedDomain("semantic-identity-request", {
    requestedMeaning, requestedKind: input.requestedKind,
  }).slice(-32)}`;
  const common = {
    version: 1, requestId, requestedMeaning, requestedKind: input.requestedKind,
    operation: kind, sourceIds, targetIds,
  };
  switch (kind) {
    case "same": return [{ subjectKey: requestId, predicate: "identity-equivalent", object: { ...common, equivalentMeaning: requestedMeaning } }];
    case "overlap": return [{ subjectKey: requestId, predicate: "identity-shared-ownership", object: { ...common, coordinatedSourceIds: sourceIds } }];
    case "split": return [{ subjectKey: requestId, predicate: "identity-partition", object: { ...common, partitionTargetIds: targetIds } }];
    case "merge": return [{ subjectKey: requestId, predicate: "identity-convergence", object: { ...common, convergence: { sourceIds, targetId: targetIds[0] } } }];
    case "replace": return [{ subjectKey: requestId, predicate: "identity-supersession", object: { ...common, supersession: { sourceId: sourceIds[0], targetIds } } }];
    case "delete": return [
      { subjectKey: requestId, predicate: "identity-cessation", object: { ...common, durableMeaningCeased: true } },
      { subjectKey: requestId, predicate: "identity-no-durable-entity", object: { ...common, noDurableEntity: true } },
    ];
    case "distinct": {
      const boundary = input.newBoundary === undefined ? null : {
        owns: [...new Set(input.newBoundary.owns.map((value) => value.normalize("NFKC").trim()))].sort(),
        excludes: [...new Set(input.newBoundary.excludes.map((value) => value.normalize("NFKC").trim()))].sort(),
        nearestEntityIds: [...new Set(input.newBoundary.nearestEntityIds.map((value) => value.normalize("NFKC").trim()))].sort(),
        rationale: input.newBoundary.rationale.normalize("NFKC").trim(),
      };
      return [{ subjectKey: requestId, predicate: "identity-distinct-boundary", object: { ...common, boundary } }];
    }
    case "ambiguous": return [{ subjectKey: requestId, predicate: "identity-conflict", object: { ...common, unresolvedConflict: "ownership conflict" } }];
  }
};

const base = {
  requestedMeaning: "wireless MIDI device enumeration",
  requestedKind: "concept" as const,
  durableEntity: true,
  queryRegistry,
  outcomeEvidence: adjudication("same"),
  records: [record("cap-midi-discovery")],
  boundState: binding,
  evidence: [{ evidenceId: "request", stance: "supports" as const }],
  unknowns: [],
};

const evidenceDocument = (input: Omit<Evidence, "contentHash"> | Evidence): Evidence => {
  const { contentHash: _contentHash, ...projection } = input as Evidence;
  const draft = { ...projection, contentHash: hash("placeholder") } as Evidence;
  return { ...draft, contentHash: computeEvidenceContentHash(draft) };
};

const authorityEvidence: Evidence = evidenceDocument({
  id: "user-approval", kind: "user-decision", locator: "decision:user-approval", capturedAt: "2026-08-07T00:00:00Z",
  claims: [{ subjectKey: "new-identity", predicate: "canonical-creation-approved", object: true }],
  reliability: "high", normativeAuthority: "binding-decision", independenceGroup: "user", applicability: "direct", freshness: 1,
  causalOrigin: { kind: "human" }, metadata: {},
});

const resolveTrusted = (
  input: Parameters<typeof resolveSemanticIdentity>[0],
): Promise<Awaited<ReturnType<typeof resolveSemanticIdentityFromEvidence>>> => {
  const evidence = evidenceDocument({
    ...authorityEvidence,
    id: "request",
    normativeAuthority: "supporting",
    claims: outcomeClaims(input.assessment, input),
  });
  const { outcomeEvidence: _callerOutcome, ...unverifiedInput } = input;
  return resolveSemanticIdentityFromEvidence({
    ...unverifiedInput,
    evidence: [{ evidenceId: evidence.id, stance: "supports" }],
  }, { loadEvidence: async () => evidence });
};

const resolveTrustedWithClaims = (
  input: Parameters<typeof resolveSemanticIdentity>[0],
  claims: Evidence["claims"],
): Promise<Awaited<ReturnType<typeof resolveSemanticIdentityFromEvidence>>> => {
  const evidence = evidenceDocument({
    ...authorityEvidence,
    id: "request",
    normativeAuthority: "supporting",
    claims,
  });
  const { outcomeEvidence: _callerOutcome, ...unverifiedInput } = input;
  return resolveSemanticIdentityFromEvidence({
    ...unverifiedInput,
    evidence: [{ evidenceId: evidence.id, stance: "supports" }],
  }, { loadEvidence: async () => evidence });
};

function publicResolution(resolution: ReturnType<typeof resolveSemanticIdentity>) {
  return structuredClone(resolution);
}

function rehashResolution(resolution: AdjudicatedSemanticIdentityResolution): AdjudicatedSemanticIdentityResolution {
  const rehashed = structuredClone(resolution);
  if (rehashed.adjudication !== undefined) {
    const { contentHash: _adjudicationHash, ...adjudicationBasis } = rehashed.adjudication;
    rehashed.adjudication.contentHash = hashFramedDomain("identity-adjudication", adjudicationBasis);
  }
  const { id: _id, contentHash: _resolutionHash, ...semantic } = rehashed;
  rehashed.contentHash = hashFramedDomain("semantic-identity-resolution", semantic);
  rehashed.id = `identity_resolution_${rehashed.contentHash.slice(-32)}`;
  return rehashed;
}

function trustedRepository(
  resolution: ReturnType<typeof resolveSemanticIdentity>,
  options: { evidence?: Evidence; authority?: AuthorityRecord; current?: boolean } = {},
) {
  const evidence = options.evidence ?? evidenceDocument({
    ...authorityEvidence,
    claims: [{ subjectKey: resolution.id, predicate: "canonical-creation-approved", object: true }],
  });
  const resolutionEvidence: Evidence = evidenceDocument({
    ...authorityEvidence,
    id: "request",
    normativeAuthority: "supporting",
    claims: [
      ...(resolution.adjudication?.claims.map(({ evidenceId: _evidenceId, ...claim }) => claim) ?? []),
      { subjectKey: resolution.id, predicate: "identity-create-new-supported", object: true },
    ],
  });
  const authorityPayload = { ...(options.authority ?? authority), subjectId: resolution.id, evidence: [{ evidenceId: evidence.id, stance: "supports" as const }] };
  const authorityEnvelope = withCanonicalHashes({
    apiVersion: "projector/v2", schemaVersion: "2", kind: "authority-record", id: authorityPayload.id,
    key: authorityPayload.key, lifecycle: authorityPayload.status, payload: authorityPayload,
  });
  return {
    loadResolution: async () => publicResolution(resolution),
    loadAuthorityEnvelope: async () => authorityEnvelope,
    loadEvidence: async (evidenceId: string) => evidenceId === resolutionEvidence.id ? resolutionEvidence : evidence,
    validateBinding: async () => ({
      status: options.current === false ? "stale" : "current", currentState: resolution.boundState.compiledAgainst,
      changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [],
    }),
    verifyAdjudication: async () => true,
  };
}
const authority: AuthorityRecord = {
  id: "authority-new-identity", key: "AUTH-NEW-IDENTITY", subjectId: "new-identity", status: "approved", conclusion: "normalize",
  rationale: "The boundary is independently governed", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }],
  vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 1, ecosystemHealth: 1, securitySupport: 1, reversibility: 1, migrationCost: 0, counterEvidence: 0 },
  assessmentConfidence: "high", evidence: [{ evidenceId: authorityEvidence.id, stance: "supports" }], governanceRiskClass: "R1",
  decidedBy: "user", createdAt: "2026-08-07T00:00:00Z", semanticHash: hash("authority"),
};

describe("semantic identity resolution", () => {
  it("binds same and overlap claims to exactly the eligible selected endpoint set", async () => {
    const weak = record("weak", "active");
    weak.candidate = candidate("weak", 0.1);
    const records = [record("cap-midi-discovery"), weak];
    const boundState = createStateBinding({
      ...binding,
      valueDependencies: [
        ...binding.valueDependencies,
        { kind: "canonical-entity", id: "weak", versionHash: hash("candidate-weak"), role: "identity candidate semantic value" },
      ],
    });
    for (const assessment of ["same", "overlap"] as const) {
      const input = { ...base, records, boundState, assessment };
      const overbroadClaims = structuredClone(outcomeClaims(assessment, input));
      const overbroadFact = overbroadClaims[0]!.object as { sourceIds: string[]; targetIds: string[] };
      overbroadFact.sourceIds.push("weak");
      overbroadFact.targetIds.push("weak");
      const overbroad = evidenceDocument({
        ...authorityEvidence, id: "request", normativeAuthority: "supporting", claims: overbroadClaims,
      });

      await expect(resolveSemanticIdentityFromEvidence(
        { ...input, evidence: [{ evidenceId: "request", stance: "supports" }] },
        { loadEvidence: async () => overbroad },
      )).rejects.toThrow(/target|eligible|selected|payload/i);

      const exactClaims = outcomeClaims(assessment, { ...input, records: [records[0]!] });
      const exact = evidenceDocument({ ...overbroad, claims: exactClaims });
      const resolution = await resolveSemanticIdentityFromEvidence(
        { ...input, evidence: [{ evidenceId: "request", stance: "supports" }] },
        { loadEvidence: async () => exact },
      );
      expect(resolution.selectedEntityIds).toEqual(["cap-midi-discovery"]);
      expect(resolution.adjudication?.sourceIds).toEqual(["cap-midi-discovery"]);
      expect(resolution.adjudication?.factPayloads).toMatchObject([{ targetIds: ["cap-midi-discovery"] }]);
    }
  });

  it("schema-validates and round-trips the complete trusted adjudicated resolution", async () => {
    const resolution = await resolveTrusted({ ...base, assessment: "same" });
    expect(AdjudicatedSemanticIdentityResolutionSchema.parse(resolution)).toEqual(resolution);
    expect(AdjudicatedSemanticIdentityResolutionSchema.parse(JSON.parse(JSON.stringify(resolution)))).toEqual(resolution);

    const extraNested = structuredClone(resolution) as typeof resolution & { adjudication: NonNullable<typeof resolution.adjudication> & { unexpected?: true } };
    extraNested.adjudication!.unexpected = true;
    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(extraNested).success).toBe(false);

    const malformedFact = structuredClone(resolution);
    malformedFact.adjudication!.factPayloads[0] = { operation: "same", equivalentMeaning: true } as never;
    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(malformedFact).success).toBe(false);
  });

  it("rejects a fully rehashed create-new resolution whose evidence set is not canonically ordered", async () => {
    const input = {
      ...base,
      assessment: "distinct" as const,
      records: [],
      boundState: emptyBinding,
      evidence: [
        { evidenceId: "context", stance: "context" },
        { evidenceId: "request", stance: "supports" as const },
      ] as const,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    };
    const requestEvidence = evidenceDocument({
      ...authorityEvidence,
      id: "request",
      normativeAuthority: "supporting",
      claims: outcomeClaims("distinct", input),
    });
    const authentic = await resolveSemanticIdentityFromEvidence(
      input,
      { loadEvidence: async () => requestEvidence },
    );
    const reordered = structuredClone(authentic);
    reordered.evidence.reverse();
    const rehashed = rehashResolution(reordered);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
    await expect(assertCanonicalCreationAllowed(
      { resolutionId: rehashed.id, authorityRecordId: authority.id },
      trustedRepository(rehashed),
    )).rejects.toThrow(/canonical|evidence|order|unique/i);
  });

  it("rejects a fully rehashed create-new resolution whose StateBinding dependency sets are not canonical", async () => {
    const authentic = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const forged = structuredClone(authentic);
    forged.boundState.queryDependencies.reverse();
    forged.boundState.dependencyDigest = createStateBinding(forged.boundState).dependencyDigest;
    const rehashed = rehashResolution(forged);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
    await expect(assertCanonicalCreationAllowed(
      { resolutionId: rehashed.id, authorityRecordId: authority.id },
      trustedRepository(rehashed),
    )).rejects.toThrow(/StateBinding|canonical|dependenc/i);
  });

  it("rejects rehashed adjudication claim and fact sets whose canonical order was changed", async () => {
    const authentic = await resolveTrusted({ ...base, assessment: "delete", proposedTargetIds: [] });
    const reordered = structuredClone(authentic);
    reordered.adjudication!.claims.reverse();
    reordered.adjudication!.factPayloads.reverse();
    const rehashed = rehashResolution(reordered);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
  });

  it("rejects a fully rehashed create-new resolution carrying a same fact and split lineage", async () => {
    const authentic = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const forged = structuredClone(authentic);
    const requestId = forged.adjudication!.claims[0]!.subjectKey;
    const sameFact = {
      version: 1 as const, requestId, requestedMeaning: forged.requestedMeaning, requestedKind: forged.requestedKind,
      operation: "same" as const, sourceIds: ["cap-midi-discovery"], targetIds: ["cap-midi-discovery"],
      equivalentMeaning: forged.requestedMeaning,
    };
    const claim = { evidenceId: "request", subjectKey: requestId, predicate: "identity-equivalent", object: sameFact };
    const lineageBasis = {
      kind: "split" as const, fromIds: ["cap-midi-discovery"], toIds: ["child-a", "child-b"],
      reason: "forged split continuity", stateDigest: state.canonicalProjectorDigest,
    };
    const lineage = {
      id: `lineage_proposal_${hashFramedDomain("identity-lineage-proposal", lineageBasis).slice(-32)}`,
      canonical: false as const, ...lineageBasis,
    };
    forged.adjudication = {
      ...forged.adjudication!, sourceIds: [], proposedTargetIds: [], factPayloads: [sameFact], claims: [claim],
      claimHashes: [hashFramedDomain("identity-adjudication-claim-ref", claim)], lineageProposals: [lineage], tombstoneProposals: [],
    };
    forged.lineageProposals = [lineage];
    const rehashed = rehashResolution(forged);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
    await expect(assertCanonicalCreationAllowed(
      { resolutionId: rehashed.id, authorityRecordId: authority.id }, trustedRepository(rehashed),
    )).rejects.toThrow(/operation|fact|predicate|lineage|continuity/i);
  });

  it("rejects a fully rehashed persisted boundary that is not canonical and disjoint", async () => {
    const authentic = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const forged = structuredClone(authentic);
    const malformedBoundary = {
      owns: [" x ", ""], excludes: ["x"], nearestEntityIds: [], rationale: " r ",
    };
    forged.newBoundary = malformedBoundary;
    const fact = { ...forged.adjudication!.factPayloads[0]!, boundary: malformedBoundary };
    const claim = { ...forged.adjudication!.claims[0]!, object: fact };
    forged.adjudication = {
      ...forged.adjudication!, factPayloads: [fact], claims: [claim],
      claimHashes: [hashFramedDomain("identity-adjudication-claim-ref", claim)],
    };
    const rehashed = rehashResolution(forged);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
    await expect(assertCanonicalCreationAllowed(
      { resolutionId: rehashed.id, authorityRecordId: authority.id }, trustedRepository(rehashed),
    )).rejects.toThrow(/boundary|normalized|blank|overlap|disjoint/i);
  });

  it("rejects a fully rehashed create-new resolution with a supported persisted duplicate candidate", async () => {
    const authentic = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const forged = structuredClone(authentic);
    const existing = candidate("existing", 0.99);
    existing.ownershipFit = 0.99;
    existing.boundaryFit = 0.99;
    forged.candidates = [existing];
    forged.candidateRecords = [{ candidate: existing, lifecycle: "active", replacementIds: [] }];
    forged.boundState = createStateBinding({
      ...forged.boundState,
      valueDependencies: [{
        kind: "canonical-entity", id: "existing", versionHash: hash("candidate-existing"),
        role: "identity candidate semantic value",
      }],
    });
    const rehashed = rehashResolution(forged);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
    await expect(assertCanonicalCreationAllowed(
      { resolutionId: rehashed.id, authorityRecordId: authority.id }, trustedRepository(rehashed),
    )).rejects.toThrow(/candidate|duplicate|overlap|eligible|source/i);
  });

  it("accepts a fully persisted distinct resolution only when candidate analysis proves no overlap", async () => {
    const weak = record("concept-timing");
    weak.candidate = candidate("concept-timing", 0.1);
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", records: [weak], boundState: binding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });

    expect(resolution.candidateRecords).toEqual([weak]);
    expect(AdjudicatedSemanticIdentityResolutionSchema.parse(resolution)).toEqual(resolution);
    await expect(assertCanonicalCreationAllowed(
      { resolutionId: resolution.id, authorityRecordId: authority.id }, trustedRepository(resolution),
    )).resolves.toEqual(resolution.boundState);
  });

  it("rejects unresolved exact-kind historical candidates even when overlap support has decayed", async () => {
    const authentic = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const forged = structuredClone(authentic);
    const unresolved = candidate("existing", 0.1);
    unresolved.evidence = [];
    unresolved.explanation = "";
    forged.candidates = [unresolved];
    forged.candidateRecords = [{ candidate: unresolved, lifecycle: "tombstone", replacementIds: [] }];
    forged.boundState = createStateBinding({
      ...forged.boundState,
      valueDependencies: [{
        kind: "canonical-entity", id: "existing", versionHash: hash("candidate-existing"),
        role: "identity candidate semantic value",
      }],
    });
    const rehashed = rehashResolution(forged);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
    await expect(assertCanonicalCreationAllowed(
      { resolutionId: rehashed.id, authorityRecordId: authority.id }, trustedRepository(rehashed),
    )).rejects.toThrow(/candidate|duplicate|histor|unresolved|source/i);
  });

  it.each([
    { assessment: "replace" as const, records: [record("a")], targets: ["replacement"], overlappingTargets: ["a"] },
    { assessment: "split" as const, records: [record("a")], targets: ["child-a", "child-b"], overlappingTargets: ["a", "child-b"] },
    { assessment: "merge" as const, records: [record("a"), record("b")], targets: ["merged"], overlappingTargets: ["a"] },
  ])("rejects fully rehashed $assessment continuity whose source and target endpoints overlap", async ({ assessment, records, targets, overlappingTargets }) => {
    const authentic = await resolveTrusted({ ...base, assessment, records, proposedTargetIds: targets });
    const forged = structuredClone(authentic);
    forged.proposedTargetIds = overlappingTargets;
    forged.selectedEntityIds = forged.adjudication!.sourceIds;
    const fact = structuredClone(forged.adjudication!.factPayloads[0]!);
    fact.targetIds = overlappingTargets;
    if (fact.operation === "replace") fact.supersession.targetIds = overlappingTargets;
    if (fact.operation === "split") fact.partitionTargetIds = overlappingTargets;
    if (fact.operation === "merge") fact.convergence.targetId = overlappingTargets[0]!;
    const claim = { ...forged.adjudication!.claims[0]!, object: fact };
    const lineageBasis = {
      ...forged.lineageProposals[0]!, id: undefined, canonical: undefined, toIds: overlappingTargets,
    };
    const { id: _lineageId, canonical: _lineageCanonical, ...lineageSemantic } = lineageBasis;
    const lineage = {
      id: `lineage_proposal_${hashFramedDomain("identity-lineage-proposal", lineageSemantic).slice(-32)}`,
      canonical: false as const, ...lineageSemantic,
    };
    forged.lineageProposals = [lineage];
    const tombstones = assessment === "replace" ? forged.tombstoneProposals.map((proposal) => {
      const basis = { ...proposal, id: undefined, canonical: undefined, replacementIds: overlappingTargets };
      const { id: _tombstoneId, canonical: _tombstoneCanonical, ...semantic } = basis;
      return {
        id: `tombstone_proposal_${hashFramedDomain("identity-tombstone-proposal", semantic).slice(-32)}`,
        canonical: false as const, ...semantic,
      };
    }) : [];
    forged.tombstoneProposals = tombstones;
    forged.adjudication = {
      ...forged.adjudication!, proposedTargetIds: overlappingTargets, factPayloads: [fact], claims: [claim],
      claimHashes: [hashFramedDomain("identity-adjudication-claim-ref", claim)],
      lineageProposals: [lineage], tombstoneProposals: tombstones,
    };
    const rehashed = rehashResolution(forged);

    expect(AdjudicatedSemanticIdentityResolutionSchema.safeParse(rehashed).success).toBe(false);
  });

  it("accepts valid disjoint split, merge, replace, and delete continuity", async () => {
    const resolutions = await Promise.all([
      resolveTrusted({ ...base, assessment: "split", records: [record("a")], proposedTargetIds: ["child-a", "child-b"] }),
      resolveTrusted({ ...base, assessment: "merge", records: [record("a"), record("b")], proposedTargetIds: ["merged"] }),
      resolveTrusted({ ...base, assessment: "replace", records: [record("a")], proposedTargetIds: ["replacement"] }),
      resolveTrusted({ ...base, assessment: "delete", records: [record("a")], proposedTargetIds: [] }),
    ]);

    for (const resolution of resolutions) {
      expect(AdjudicatedSemanticIdentityResolutionSchema.parse(resolution)).toEqual(resolution);
    }
  });

  it("normalizes semantic boundary sets once before claims and all identity hashes", async () => {
    const firstBoundary = {
      owns: [" transport ownership ", "device enumeration", "transport ownership"],
      excludes: ["wired transport", "legacy protocol"],
      nearestEntityIds: ["near-b", "near-a", "near-b"],
      rationale: " independently governed ",
    };
    const secondBoundary = {
      owns: ["device enumeration", "transport ownership"],
      excludes: ["legacy protocol", "wired transport"],
      nearestEntityIds: ["near-a", "near-b"],
      rationale: "independently governed",
    };
    const first = await resolveTrusted({ ...base, assessment: "distinct", records: [], boundState: emptyBinding, newBoundary: firstBoundary });
    const second = await resolveTrusted({ ...base, assessment: "distinct", records: [], boundState: emptyBinding, newBoundary: secondBoundary });

    expect(first).toEqual(second);
    expect(first.newBoundary).toEqual(secondBoundary);
    expect(first.adjudication?.contentHash).toBe(second.adjudication?.contentHash);
    expect(first.id).toBe(second.id);

    await expect(resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["shared"], excludes: [" shared "], nearestEntityIds: ["near"], rationale: "boundary" },
    })).rejects.toThrow(/boundary|overlap|owns|excludes/i);
    await expect(resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["valid"], excludes: [""], nearestEntityIds: ["bad/id"], rationale: "boundary" },
    })).rejects.toThrow(/boundary|blank|entity ID|nearest/i);
  });

  it("rejects repository evidence substitution when distinct claim payloads reuse one declared content hash", async () => {
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const repository = trustedRepository(resolution);
    const authentic = await repository.loadEvidence("request") as Evidence;
    const substituted: Evidence = {
      ...authentic,
      claims: [{ subjectKey: resolution.id, predicate: "canonical-creation-approved", object: true }],
      contentHash: authentic.contentHash,
    };

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, {
      ...repository,
      loadEvidence: async (evidenceId: string) => evidenceId === "request" ? substituted : repository.loadEvidence(evidenceId),
    })).rejects.toThrow(/evidence.*content hash|integrity/i);
  });

  it("loads typed outcome claims and refuses incompatible outcomes from the same evidence basis", async () => {
    const sameEvidence: Evidence = {
      ...authorityEvidence,
      id: "same-proof",
      normativeAuthority: "supporting",
      claims: outcomeClaims("same", base),
    };
    sameEvidence.contentHash = computeEvidenceContentHash(sameEvidence);
    const evidenceRepository = { loadEvidence: async () => sameEvidence };

    const { outcomeEvidence: _callerOutcome, ...unverifiedBase } = base;
    const same = await resolveSemanticIdentityFromEvidence({
      ...unverifiedBase,
      assessment: "same",
      evidence: [{ evidenceId: sameEvidence.id, stance: "supports" }],
    }, evidenceRepository);
    const replace = await resolveSemanticIdentityFromEvidence({
      ...unverifiedBase,
      assessment: "replace",
      proposedTargetIds: ["replacement"],
      evidence: [{ evidenceId: sameEvidence.id, stance: "supports" }],
    }, evidenceRepository);

    expect(same.outcome).toBe("reuse-existing");
    expect(same.adjudication).toMatchObject({ kind: "same", evidenceIds: ["same-proof"] });
    expect(replace.outcome).toBe("unresolved");
  });

  it("scopes conflict evaluation to the requested subject and operation", async () => {
    const conflicting = evidenceDocument({
      ...authorityEvidence,
      id: "conflicting-proof",
      normativeAuthority: "supporting",
      claims: [
        ...outcomeClaims("same", base),
        ...outcomeClaims("replace", { ...base, requestedMeaning: "other request", proposedTargetIds: ["replacement"] }),
      ],
    });

    await expect(resolveSemanticIdentityFromEvidence({
      ...base,
      assessment: "same",
      evidence: [{ evidenceId: conflicting.id, stance: "supports" }],
    }, { loadEvidence: async () => conflicting })).resolves.toMatchObject({ outcome: "reuse-existing" });
  });

  it("rejects cross-kind, cross-request, and cross-source typed claim replay", async () => {
    const intended = { ...base, assessment: "same" as const };
    const evidence = evidenceDocument({
      ...authorityEvidence, id: "scoped-same-proof", normativeAuthority: "supporting",
      claims: outcomeClaims("same", intended),
    });
    const repository = { loadEvidence: async () => evidence };
    const { outcomeEvidence: _ignored, ...unverified } = intended;

    const bindingFor = (requestedMeaning: string, requestedKind: "concept" | "requirement") => createStateBinding({
      ...binding,
      queryDependencies: binding.queryDependencies.map((dependency) => {
        const query = queryRegistry.createSpec({
          id: dependency.query.id, programId: dependency.query.programId,
          input: { requestedMeaning, requestedKind },
        });
        return { ...dependency, query, priorResult: { ...dependency.priorResult, queryHash: query.semanticHash } };
      }),
    });
    const crossKind = await resolveSemanticIdentityFromEvidence({
      ...unverified, requestedKind: "requirement", boundState: bindingFor(base.requestedMeaning, "requirement"),
      evidence: [{ evidenceId: evidence.id, stance: "supports" }],
    }, repository);
    const crossRequest = await resolveSemanticIdentityFromEvidence({
      ...unverified, requestedMeaning: "different request", boundState: bindingFor("different request", "concept"),
      evidence: [{ evidenceId: evidence.id, stance: "supports" }],
    }, repository);
    const crossSource = resolveSemanticIdentityFromEvidence({
      ...unverified, records: [record("other-source")],
      boundState: createStateBinding({
        ...binding,
        valueDependencies: [...binding.valueDependencies, { kind: "canonical-entity", id: "other-source", versionHash: hash("candidate-other-source"), role: "identity candidate semantic value" }],
      }),
      evidence: [{ evidenceId: evidence.id, stance: "supports" }],
    }, repository);

    expect([crossKind.outcome, crossRequest.outcome]).toEqual(["unresolved", "unresolved"]);
    await expect(crossSource).rejects.toThrow(/incompatible|source|applicable/i);
  });

  it("rejects incompatible same-predicate payloads but ignores facts scoped to another request", async () => {
    const splitInput = { ...base, assessment: "split" as const, proposedTargetIds: ["child-a", "child-b"] };
    const valid = outcomeClaims("split", splitInput)[0]!;
    const conflicting = { ...valid, object: { ...(valid.object as Record<string, unknown>), targetIds: ["split-a", "split-b"], partitionTargetIds: ["split-a", "split-b"] } };
    const otherRequest = outcomeClaims("replace", { ...base, requestedMeaning: "other request", proposedTargetIds: ["replacement"] })[0]!;
    const evidence = evidenceDocument({
      ...authorityEvidence, id: "conflicting-partitions", normativeAuthority: "supporting",
      claims: [valid, conflicting, otherRequest],
    });

    await expect(resolveSemanticIdentityFromEvidence({
      ...splitInput, evidence: [{ evidenceId: evidence.id, stance: "supports" }],
    }, { loadEvidence: async () => evidence })).rejects.toThrow(/incompatible|conflicting|partition.*payload/i);

    const scoped = evidenceDocument({ ...evidence, claims: [valid, otherRequest] });
    await expect(resolveSemanticIdentityFromEvidence({
      ...splitInput, evidence: [{ evidenceId: scoped.id, stance: "supports" }],
    }, { loadEvidence: async () => scoped })).resolves.toMatchObject({ outcome: "split-existing" });
  });

  it("requires split, merge, and replace facts to name the exact proposed continuity", async () => {
    const cases = [
      { assessment: "split" as const, records: base.records, proposedTargetIds: ["child-a", "child-b"], wrongTargets: ["split-a", "split-b"] },
      { assessment: "merge" as const, records: [record("a"), record("b")], proposedTargetIds: ["merged"], wrongTargets: ["replacement"] },
      { assessment: "replace" as const, records: base.records, proposedTargetIds: ["replacement"], wrongTargets: ["child-a"] },
    ];
    for (const item of cases) {
      const authorized = { ...base, ...item };
      const evidence = evidenceDocument({
        ...authorityEvidence, id: `wrong-${item.assessment}`, normativeAuthority: "supporting",
        claims: outcomeClaims(item.assessment, { ...authorized, proposedTargetIds: item.wrongTargets }),
      });
      await expect(resolveSemanticIdentityFromEvidence({
        ...authorized, evidence: [{ evidenceId: evidence.id, stance: "supports" }],
      }, { loadEvidence: async () => evidence })).rejects.toThrow(/incompatible|continuity|target/i);
    }
  });

  it("fails closed when the direct caller supplies unverified outcome booleans", () => {
    const result = resolveSemanticIdentity({ ...base, assessment: "same", outcomeEvidence: adjudication("same") });
    expect(result.outcome).toBe("unresolved");
  });

  it("refuses a hash-consistent create-new resolution without persisted distinct adjudication facts", async () => {
    const trusted = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const { adjudication: _adjudication, id: _id, contentHash: _contentHash, ...semantic } = trusted;
    const contentHash = hashFramedDomain("semantic-identity-resolution", semantic);
    const forged = { ...semantic, id: `identity_resolution_${contentHash.slice(-32)}`, contentHash } as typeof trusted;

    await expect(assertCanonicalCreationAllowed({ resolutionId: forged.id, authorityRecordId: authority.id }, trustedRepository(forged)))
      .rejects.toThrow(/adjudication|distinct.*facts/i);
  });

  it("accepts a dependency-local rebound and rejects an internally inconsistent current result", async () => {
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const reboundState = { ...state, worktreeDigest: hash("unrelated-change") };
    const rebound = createStateBinding({ ...emptyBinding, compiledAgainst: reboundState });
    const repository = trustedRepository(resolution);

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, {
      ...repository,
      validateBinding: async () => ({
        status: "rebound", currentState: reboundState, changedValueDependencyIds: [], changedQueryDependencyIds: [],
        reasons: ["bound facts unchanged"], rebound,
      }),
    })).resolves.toEqual(rebound);

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, {
      ...repository,
      validateBinding: async () => ({
        status: "current", currentState: resolution.boundState.compiledAgainst,
        changedValueDependencyIds: ["unexpected-change"], changedQueryDependencyIds: [], reasons: [],
      }),
    })).rejects.toThrow(/current.*changed|inconsistent/i);
  });

  it("rejects a dependency-local rebound whose raw StateBinding sets are not canonical", async () => {
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const reboundState = { ...state, worktreeDigest: hash("unrelated-change") };
    const rebound = createStateBinding({ ...emptyBinding, compiledAgainst: reboundState });
    rebound.queryDependencies.reverse();
    const repository = trustedRepository(resolution);

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, {
      ...repository,
      validateBinding: async () => ({
        status: "rebound", currentState: reboundState, changedValueDependencyIds: [], changedQueryDependencyIds: [],
        reasons: ["bound facts unchanged"], rebound,
      }),
    })).rejects.toThrow(/rebound|StateBinding|canonical/i);
  });

  it.each([
    ["same", "reuse-existing", ["cap-midi-discovery"]],
    ["overlap", "coordinated-modification", ["cap-midi-discovery"]],
    ["split", "split-existing", ["cap-midi-discovery"]],
    ["replace", "replace-existing", ["cap-midi-discovery"]],
    ["distinct", "create-new", []],
    ["ambiguous", "unresolved", []],
  ] as const)("maps a %s assessment to %s", async (assessment, outcome, selectedEntityIds) => {
    const resolution = await resolveTrusted({
      ...base,
      assessment,
      outcomeEvidence: adjudication(assessment),
      ...(assessment === "distinct" ? { records: [] } : {}),
      ...(assessment === "distinct" ? { boundState: emptyBinding } : {}),
      ...((assessment === "split") ? { proposedTargetIds: ["split-a", "split-b"] } : {}),
      ...((assessment === "replace") ? { proposedTargetIds: ["replacement"] } : {}),
      ...(assessment === "distinct" ? {
        newBoundary: {
          owns: ["BLE-specific discovery"],
          excludes: ["wired device discovery"],
          nearestEntityIds: ["cap-midi-discovery"],
          rationale: "transport-specific obligations change independently",
        },
      } : {}),
    });

    expect(resolution.outcome).toBe(outcome);
    expect(resolution.selectedEntityIds).toEqual(selectedEntityIds);
  });

  it("uses coordinated modification for multiple owners and merge only for an explicit merge assessment", async () => {
    const records = [record("cap-midi-discovery"), record("req-device-enumeration")];
    expect((await resolveTrusted({ ...base, assessment: "overlap", outcomeEvidence: adjudication("overlap"), records })).outcome)
      .toBe("coordinated-modification");
    expect((await resolveTrusted({ ...base, assessment: "merge", outcomeEvidence: adjudication("merge"), records, proposedTargetIds: ["merged"] })).outcome)
      .toBe("merge-existing");
  });

  it("returns no durable entity without searching for a path-shaped identity", () => {
    const resolution = resolveSemanticIdentity({
      ...base,
      durableEntity: false,
      assessment: "distinct",
      outcomeEvidence: adjudication("distinct"),
      records: [],
      incidental: { path: "packages/mobile/src/bluetooth.ts", aliases: ["BLE"] },
    });

    expect(resolution.outcome).toBe("no-durable-entity");
    expect(resolution.selectedEntityIds).toEqual([]);
  });

  it("follows a direct supersession edge to its persisted active replacement", async () => {
    const resolution = await resolveTrusted({
      ...base,
      assessment: "same",
      outcomeEvidence: adjudication("same"),
      records: [record("old-midi-discovery", "superseded", ["cap-midi-discovery"]), record("cap-midi-discovery")],
    });

    expect(resolution.outcome).toBe("reuse-existing");
    expect(resolution.selectedEntityIds).toEqual(["cap-midi-discovery"]);
    expect(resolution.adjudication?.sourceIds).toEqual(["cap-midi-discovery"]);
  });

  it("follows a weak historical root directly to its eligible active replacement", async () => {
    const weakHistoricalRoot = record("old-midi-discovery", "superseded", ["cap-midi-discovery"]);
    weakHistoricalRoot.candidate = candidate("old-midi-discovery", 0.1);
    const input = {
      ...base,
      assessment: "same" as const,
      records: [weakHistoricalRoot, record("cap-midi-discovery")],
    };

    const resolution = await resolveTrustedWithClaims(
      input,
      outcomeClaims("same", { ...input, records: [record("cap-midi-discovery")] }),
    );

    expect(resolution.outcome).toBe("reuse-existing");
    expect(resolution.selectedEntityIds).toEqual(["cap-midi-discovery"]);
    expect(resolution.adjudication?.sourceIds).toEqual(["cap-midi-discovery"]);
  });

  it("follows a weak historical root through eligible intermediates to the terminal identity", async () => {
    const weakHistoricalRoot = record("old-midi-discovery", "superseded", ["deleted"]);
    weakHistoricalRoot.candidate = candidate("old-midi-discovery", 0.1);
    const input = {
      ...base,
      assessment: "same" as const,
      records: [
        weakHistoricalRoot,
        record("deleted", "superseded", ["cap-midi-discovery"]),
        record("cap-midi-discovery"),
      ],
    };

    const resolution = await resolveTrustedWithClaims(
      input,
      outcomeClaims("same", { ...input, records: [record("cap-midi-discovery")] }),
    );

    expect(resolution.outcome).toBe("reuse-existing");
    expect(resolution.selectedEntityIds).toEqual(["cap-midi-discovery"]);
    expect(resolution.adjudication?.sourceIds).toEqual(["cap-midi-discovery"]);
  });

  it("rejects a supersession edge whose replacement record is missing", async () => {
    const input = {
      ...base,
      assessment: "same" as const,
      records: [record("old-midi-discovery", "superseded", ["replacement"])],
    };

    await expect(resolveTrustedWithClaims(
      input,
      outcomeClaims("same", { ...input, records: [record("replacement")] }),
    )).rejects.toThrow(/replacement|persisted|lifecycle|missing/i);
  });

  it("rejects a supersession edge whose persisted replacement is ineligible", async () => {
    const weakReplacement = record("replacement");
    weakReplacement.candidate = candidate("replacement", 0.1);
    const input = {
      ...base,
      assessment: "same" as const,
      records: [record("old-midi-discovery", "superseded", ["replacement"]), weakReplacement],
    };

    await expect(resolveTrustedWithClaims(
      input,
      outcomeClaims("same", { ...input, records: [record("replacement")] }),
    )).rejects.toThrow(/replacement|eligible|supported|lifecycle/i);
  });

  it("rejects a supersession edge whose replacement has the wrong requested kind", async () => {
    const wrongKindReplacement = record("concept-timing");
    wrongKindReplacement.candidate = { ...wrongKindReplacement.candidate, entityKind: "requirement" };
    const input = {
      ...base,
      assessment: "same" as const,
      records: [record("old-midi-discovery", "superseded", ["concept-timing"]), wrongKindReplacement],
    };

    await expect(resolveTrustedWithClaims(
      input,
      outcomeClaims("same", { ...input, records: [record("concept-timing")] }),
    )).rejects.toThrow(/replacement|kind|eligible|lifecycle/i);
  });

  it("resolves a persisted supersession chain only to its terminal active identity", async () => {
    const input = {
      ...base,
      assessment: "same" as const,
      records: [
        record("old-midi-discovery", "superseded", ["deleted"]),
        record("deleted", "superseded", ["cap-midi-discovery"]),
        record("cap-midi-discovery"),
      ],
    };

    const resolution = await resolveTrustedWithClaims(
      input,
      outcomeClaims("same", { ...input, records: [record("cap-midi-discovery")] }),
    );

    expect(resolution.outcome).toBe("reuse-existing");
    expect(resolution.selectedEntityIds).toEqual(["cap-midi-discovery"]);
    expect(resolution.adjudication?.sourceIds).toEqual(["cap-midi-discovery"]);
  });

  it("rejects a cyclic supersession chain instead of exposing historical endpoints", async () => {
    const input = {
      ...base,
      assessment: "same" as const,
      records: [
        record("old-midi-discovery", "superseded", ["deleted"]),
        record("deleted", "tombstone", ["old-midi-discovery"]),
      ],
    };

    await expect(resolveTrustedWithClaims(
      input,
      outcomeClaims("same", input),
    )).rejects.toThrow(/cycle|cyclic|replacement|lifecycle/i);
  });

  it("blocks create-new when an active, deprecated, superseded, or tombstoned identity still overlaps", async () => {
    for (const lifecycle of ["active", "deprecated", "superseded", "tombstone"] as const) {
      const resolution = await resolveTrusted({ ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [record("existing", lifecycle)] });
      await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, trustedRepository(resolution)))
        .rejects.toThrow(/duplicate|overlap|unresolved/i);
    }
  });

  it("requires an inspectable owns/excludes boundary before a genuinely distinct identity can be created", async () => {
    const resolution = await resolveTrusted({ ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], boundState: emptyBinding });
    expect(resolution.outcome).toBe("unresolved");
    expect(resolution.unknowns).toContain("new semantic boundary is incomplete");
    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, trustedRepository(resolution)))
      .rejects.toThrow(/unresolved/i);
  });

  it("keeps a create-new resolution as derived evidence until user or policy acceptance authorizes canonical creation", async () => {
    const resolution = await resolveTrusted({
      ...base,
      assessment: "distinct",
      outcomeEvidence: adjudication("distinct"),
      records: [],
      boundState: emptyBinding,
      newBoundary: {
        owns: ["BLE-specific discovery"], excludes: ["wired discovery"],
        nearestEntityIds: ["cap-midi-discovery"], rationale: "independently governed transport behavior",
      },
    });

    expect(AdjudicatedSemanticIdentityResolutionSchema.parse(JSON.parse(JSON.stringify(resolution)))).toEqual(resolution);

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, {
      ...trustedRepository(resolution), loadAuthorityEnvelope: async () => { throw new Error("authoritative acceptance missing"); },
    })).rejects.toThrow(/authority|accept/i);
    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, trustedRepository(resolution))).resolves.toEqual(resolution.boundState);
  });

  it("does not accept fabricated caller objects as trusted creation provenance", async () => {
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const fabricated = {
      status: "approved", decidedBy: "user", subjectId: resolution.id, rationale: "yes",
      evidence: [{ evidenceId: "fake", stance: "supports" }],
    };

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: "fake" }, {
      ...trustedRepository(resolution), loadResolution: async () => fabricated,
    })).rejects.toThrow(/schema|invalid|required|expected/i);
  });

  it("rejects a self-rehashed trusted resolution whose ID or binding digest no longer matches", async () => {
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const stored = publicResolution(resolution);
    const forgedBinding = { ...stored.boundState, dependencyDigest: hash("forged-binding") };
    const { id: _id, contentHash: _contentHash, ...semantic } = { ...stored, boundState: forgedBinding };
    const forged = { ...stored, boundState: forgedBinding, contentHash: hashFramedDomain("semantic-identity-resolution", semantic) };

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, {
      ...trustedRepository(resolution), loadResolution: async () => forged,
    })).rejects.toThrow(/binding|hash|resolution ID/i);
  });

  it("requires trusted directly applicable evidence claims for the create-new adjudication", async () => {
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const repository = trustedRepository(resolution);
    const irrelevant: Evidence = evidenceDocument({
      ...authorityEvidence, id: "request", normativeAuthority: "supporting",
      claims: [{ subjectKey: "some-other-resolution", predicate: "identity-create-new-supported", object: true }],
    });

    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, {
      ...repository,
      loadEvidence: async (evidenceId: string) => evidenceId === "request" ? irrelevant : repository.loadEvidence(evidenceId),
    })).rejects.toThrow(/resolution evidence|claim|applicable/i);
  });

  it("fails closed for wrong-kind, zero-score, evidence-free reuse and unreplaced tombstones", () => {
    const wrongKind = record("concept-timing");
    wrongKind.candidate = { ...wrongKind.candidate, entityKind: "concept", similarity: 0, ownershipFit: 0, boundaryFit: 0, evidence: [], explanation: "" };
    expect(() => resolveSemanticIdentity({ ...base, requestedKind: "requirement", assessment: "same", records: [wrongKind] }))
      .toThrow(/request|kind|query/i);
    expect(resolveSemanticIdentity({ ...base, assessment: "same", records: [wrongKind] }).outcome).toBe("unresolved");
    expect(resolveSemanticIdentity({ ...base, assessment: "same", records: [record("deleted", "tombstone")] }).outcome).toBe("unresolved");
  });

  it("cannot bypass active or historical overlap with a caller distinct label and blank acceptance evidence", async () => {
    const boundary = { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: ["existing"], rationale: "separate obligation" };
    for (const lifecycle of ["active", "deprecated", "superseded", "tombstone"] as const) {
      const resolution = resolveSemanticIdentity({ ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [record("existing", lifecycle)], newBoundary: boundary });
      expect(resolution.outcome).toBe("unresolved");
    }
    expect(resolveSemanticIdentity({ ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], newBoundary: boundary }).outcome).toBe("unresolved");
    const resolution = resolveSemanticIdentity({ ...base, assessment: "distinct", outcomeEvidence: adjudication("distinct"), records: [], boundState: emptyBinding, newBoundary: boundary });
    await expect(assertCanonicalCreationAllowed({ resolutionId: resolution.id, authorityRecordId: authority.id }, trustedRepository(resolution, {
      evidence: { ...authorityEvidence, id: "bad", claims: [], normativeAuthority: "none", reliability: "untrusted" },
    }))).rejects.toThrow(/unresolved|evidence|authority/i);
  });

  it("rejects incomplete identity search negative space and conflicting duplicate observations", () => {
    expect(() => resolveSemanticIdentity({ ...base, assessment: "same", boundState: { ...binding, queryDependencies: binding.queryDependencies.slice(0, 1) } })).toThrow(/identity.*depend|search|lineage|tombstone/i);
    const high = record("same-id");
    const low = { ...record("same-id"), candidate: candidate("same-id", 0.2) };
    expect(() => resolveSemanticIdentity({ ...base, assessment: "same", records: [high, low] })).toThrow(/conflicting duplicate/i);
  });

  it("rejects a self-consistent identity binding for an unrelated request", () => {
    const unrelated = createStateBinding({
      ...binding,
      queryDependencies: binding.queryDependencies.map((dependency) => ({
        ...dependency,
        query: { ...dependency.query, input: { requestedMeaning: "OLD UNRELATED REQUEST", requestedKind: "requirement" } },
      })),
    });

    expect(() => resolveSemanticIdentity({ ...base, assessment: "same", boundState: unrelated }))
      .toThrow(/request|meaning|kind|query/i);
  });

  it("does not let the assessment enum alone command incompatible lifecycle outcomes", () => {
    const outcomes = (["same", "split", "replace", "delete"] as const).map((assessment) => {
      try {
        return resolveSemanticIdentity({ ...base, assessment, proposedTargetIds: assessment === "delete" ? [] : ["replacement"] }).outcome;
      } catch {
        return "threw";
      }
    });

    expect(outcomes).toEqual(["unresolved", "unresolved", "unresolved", "unresolved"]);
  });

  it("constructs a dependency-complete identity binding from an injected read-only search port", async () => {
    const resolution = await resolveSemanticIdentityFromSearch({
      requestedMeaning: base.requestedMeaning, requestedKind: base.requestedKind, durableEntity: true, assessment: "same", outcomeEvidence: adjudication("same"),
      queryRegistry,
      compiledAgainst: state,
      context: { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal },
      search: { inspect: async () => ({ records: base.records, valueDependencies: binding.valueDependencies, queryDependencies: binding.queryDependencies }) },
      evidence: [{ evidenceId: "request", stance: "supports" }], unknowns: [],
      evidenceRepository: {
        loadEvidence: async () => evidenceDocument({
          ...authorityEvidence, id: "request", normativeAuthority: "supporting", claims: outcomeClaims("same", base),
        }),
      },
    });
    expect(resolution.outcome).toBe("reuse-existing");
    expect(resolution.boundState.queryDependencies.map(({ query }) => query.programId)).toEqual([
      "identity.alias-search", "identity.exact-search", "identity.lineage", "identity.relations", "identity.tombstone", "identity.topology",
    ]);
  });

  it("returns validated noncanonical split, merge, replace, and delete continuity proposals", async () => {
    const split = await resolveTrusted({ ...base, assessment: "split", outcomeEvidence: adjudication("split"), proposedTargetIds: ["child-a", "child-b"] });
    const merge = await resolveTrusted({ ...base, assessment: "merge", outcomeEvidence: adjudication("merge"), records: [record("a"), record("b")], proposedTargetIds: ["merged"] });
    const replace = await resolveTrusted({ ...base, assessment: "replace", outcomeEvidence: adjudication("replace"), proposedTargetIds: ["replacement"] });
    const deletion = await resolveTrusted({ ...base, assessment: "delete", outcomeEvidence: adjudication("delete"), proposedTargetIds: [] });
    expect(split.lineageProposals[0]).toMatchObject({ kind: "split", canonical: false, fromIds: ["cap-midi-discovery"], toIds: ["child-a", "child-b"] });
    expect(merge.lineageProposals[0]).toMatchObject({ kind: "merge", canonical: false, fromIds: ["a", "b"], toIds: ["merged"] });
    expect(replace.tombstoneProposals[0]).toMatchObject({ entityId: "cap-midi-discovery", replacementIds: ["replacement"], canonical: false });
    expect(deletion.tombstoneProposals[0]).toMatchObject({ entityId: "cap-midi-discovery", replacementIds: [], canonical: false });
    await expect(resolveTrusted({ ...base, assessment: "replace", outcomeEvidence: adjudication("replace"), proposedTargetIds: ["cap-midi-discovery"] })).rejects.toThrow(/lineage|target|continuity/i);
    await expect(resolveTrusted({ ...base, assessment: "split", outcomeEvidence: adjudication("split"), proposedTargetIds: ["", "child"] })).rejects.toThrow(/lineage|target|blank/i);
    await expect(resolveTrusted({ ...base, assessment: "split", outcomeEvidence: adjudication("split"), proposedTargetIds: ["child-a", "child-a"] })).rejects.toThrow(/lineage|target|unique|duplicate/i);
    await expect(resolveTrusted({ ...base, assessment: "delete", outcomeEvidence: adjudication("delete"), proposedTargetIds: ["replacement"] })).rejects.toThrow(/delete.*destination|replacement|target/i);
  });

  it("binds resolution and adjudication identity to exact proposed targets", async () => {
    const first = await resolveTrusted({ ...base, assessment: "split", proposedTargetIds: ["child-a", "child-b"] });
    const second = await resolveTrusted({ ...base, assessment: "split", proposedTargetIds: ["split-a", "split-b"] });

    expect(first.id).not.toBe(second.id);
    expect(first.contentHash).not.toBe(second.contentHash);
    expect(first.adjudication?.contentHash).not.toBe(second.adjudication?.contentHash);
  });

  it("rejects an approved canonical Authority Record whose normative conclusion remains unknown", async () => {
    const resolution = await resolveTrusted({
      ...base, assessment: "distinct", records: [], boundState: emptyBinding,
      newBoundary: { owns: ["BLE"], excludes: ["wired"], nearestEntityIds: [], rationale: "separate" },
    });
    const unknownAuthority = { ...authority, conclusion: "unknown" as const, rationale: "decision remains unknown" };

    await expect(assertCanonicalCreationAllowed(
      { resolutionId: resolution.id, authorityRecordId: authority.id },
      trustedRepository(resolution, { authority: unknownAuthority }),
    )).rejects.toThrow(/conclusion|create|unknown|normative/i);
  });

  it("takes tombstone continuity only from the explicit semantic candidate dependency", async () => {
    const competing = createStateBinding({
      ...binding,
      valueDependencies: [
        { kind: "canonical-entity", id: "cap-midi-discovery", versionHash: hash("WRONG-DISCOVERY"), role: "aaa discovery document" },
        ...binding.valueDependencies,
      ],
    });
    const replacement = await resolveTrusted({ ...base, assessment: "replace", outcomeEvidence: adjudication("replace"), proposedTargetIds: ["replacement"], boundState: competing });

    expect(replacement.tombstoneProposals[0]!.lastSemanticHash).toBe(hash("candidate-cap-midi-discovery"));
  });

  it("keeps stable resolution identity independent of candidate order and incidental paths", async () => {
    await fc.assert(fc.asyncProperty(fc.shuffledSubarray([record("a"), record("b")], { minLength: 2, maxLength: 2 }), async (records) => {
      const first = await resolveTrusted({ ...base, assessment: "merge", outcomeEvidence: adjudication("merge"), records, proposedTargetIds: ["merged"], incidental: { path: "old/place.ts" } });
      const second = await resolveTrusted({ ...base, assessment: "merge", outcomeEvidence: adjudication("merge"), records: [...records].reverse(), proposedTargetIds: ["merged"], incidental: { path: "new/place.ts" } });
      expect(first).toEqual(second);
    }));
  });

  it("keeps stable resolution identity under order and duplicate variation in semantic sets", async () => {
    await fc.assert(fc.asyncProperty(fc.shuffledSubarray([0, 1, 2], { minLength: 3, maxLength: 3 }), async (order) => {
      const evidence = [
        { evidenceId: "request", stance: "supports" as const },
        { evidenceId: "context", stance: "context" as const },
        { evidenceId: "request", stance: "supports" as const },
      ];
      const candidateEvidence = [
        { evidenceId: "candidate-a", stance: "supports" as const },
        { evidenceId: "candidate-context", stance: "context" as const },
        { evidenceId: "candidate-a", stance: "supports" as const },
      ];
      const candidateRecord = record("a");
      candidateRecord.candidate = { ...candidateRecord.candidate, evidence: order.map((index) => candidateEvidence[index]!) };
      const input = {
        ...base,
        assessment: "same" as const,
        records: [candidateRecord],
        evidence: order.map((index) => evidence[index]!),
        unknowns: order.map((index) => ["unknown-a", "unknown-b", "unknown-a"][index]!),
      };
      const claims = outcomeClaims("same", input);
      const variedEvidence = evidenceDocument({
        ...authorityEvidence,
        id: "request",
        normativeAuthority: "supporting",
        claims,
      });
      const varied = await resolveSemanticIdentityFromEvidence(input, { loadEvidence: async () => variedEvidence });

      const canonicalRecord = record("a");
      canonicalRecord.candidate = {
        ...canonicalRecord.candidate,
        evidence: [
          { evidenceId: "candidate-a", stance: "supports" },
          { evidenceId: "candidate-context", stance: "context" },
        ],
      };
      const canonicalInput = {
        ...input,
        records: [canonicalRecord],
        evidence: [
          { evidenceId: "context", stance: "context" as const },
          { evidenceId: "request", stance: "supports" as const },
        ],
        unknowns: ["unknown-a", "unknown-b"],
      };
      const canonicalEvidence = evidenceDocument({
        ...authorityEvidence,
        id: "request",
        normativeAuthority: "supporting",
        claims: outcomeClaims("same", canonicalInput),
      });
      const canonical = await resolveSemanticIdentityFromEvidence(canonicalInput, { loadEvidence: async () => canonicalEvidence });
      expect(varied).toEqual(canonical);
    }));
  });

  it("canonicalizes StateBinding dependency sets and nested fingerprint sets before emitting identity", async () => {
    await fc.assert(fc.asyncProperty(
      fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6], { minLength: 7, maxLength: 7 }),
      async (order) => {
        const valueDependencies = [
          binding.valueDependencies.find(({ id }) => id === "cap-midi-discovery")!,
          binding.valueDependencies.find(({ id }) => id === "concept-timing")!,
          binding.valueDependencies.find(({ id }) => id === "cap-midi-discovery")!,
        ];
        const queryDependencies = [
          ...binding.queryDependencies,
          binding.queryDependencies[0]!,
        ];
        const rawBinding: StateBinding = {
          compiledAgainst: structuredClone(binding.compiledAgainst),
          valueDependencies: order.map((index) => structuredClone(valueDependencies[index % valueDependencies.length]!)),
          queryDependencies: order.map((index) => {
            const dependency = structuredClone(queryDependencies[index]!);
            dependency.priorResult.assumptions = order.map((nestedIndex) => ["bounded", "verified", "bounded"][nestedIndex % 3]!);
            dependency.priorResult.unavailableLanes = order.map((nestedIndex) => ["history", "topology", "history"][nestedIndex % 3]!);
            dependency.priorResult.dependencyKeys = order.map((nestedIndex) => ["identity:b", "identity:a", "identity:b"][nestedIndex % 3]!);
            return dependency;
          }),
          dependencyDigest: emptyBinding.dependencyDigest,
        };
        rawBinding.dependencyDigest = createStateBinding(rawBinding).dependencyDigest;
        const canonicalBinding = createStateBinding(rawBinding);
        const varied = await resolveTrusted({ ...base, assessment: "same", boundState: rawBinding });
        const canonical = await resolveTrusted({ ...base, assessment: "same", boundState: canonicalBinding });

        expect(varied).toEqual(canonical);
        expect(varied.boundState).toEqual(canonicalBinding);
        expect(AdjudicatedSemanticIdentityResolutionSchema.parse(varied)).toEqual(varied);
      },
    ));
  });
});
