import {
  hashFramedDomain,
  type CausalOrigin,
  type Evidence,
  type EvidenceRef,
  type ObservabilityClass,
  type PatternCandidate,
  type ProjectionUnit,
} from "@projector/core";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

const isGenerated = (origin: CausalOrigin): boolean => (
  origin.kind === "model-inference"
  || origin.kind === "semantic-resolution"
  || origin.kind === "relevance-analysis"
  || origin.kind === "planning-surprise"
  || origin.kind === "lens-transform"
  || origin.kind === "plan"
  || origin.causedByLensId !== undefined
  || origin.causedByRuleId !== undefined
  || origin.causedByTransformId !== undefined
  || origin.causedBySemanticChangeId !== undefined
  || origin.causedByRelevanceClosureId !== undefined
  || origin.causedByPlanningSurpriseId !== undefined
  || origin.causedByPlanId !== undefined
  || origin.causedByPacketId !== undefined
);

const isEndogenous = (
  origin: CausalOrigin,
  target: { targetLensId?: string; targetRuleId?: string },
): boolean => isGenerated(origin) || (
  target.targetLensId !== undefined && origin.causedByLensId === target.targetLensId
) || (
  target.targetRuleId !== undefined && origin.causedByRuleId === target.targetRuleId
);

export interface CausalEvidenceGroup {
  independenceGroup: string;
  evidenceIds: string[];
  eligibleEvidenceIds: string[];
  discountedEvidenceIds: string[];
  causalOriginKinds: CausalOrigin["kind"][];
  authorityEligible: boolean;
}

export interface CausalEvidenceOptions {
  targetLensId?: string;
  targetRuleId?: string;
  claim?: { subjectKey?: string; predicate?: string };
}

/** Groups copies by their declared causal occurrence and discounts same-cause Projector output. */
export function groupCausalEvidence(
  evidence: readonly Evidence[],
  options: CausalEvidenceOptions = {},
): CausalEvidenceGroup[] {
  const grouped = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const matchesClaim = options.claim === undefined || item.claims.some((claim) => (
      (options.claim?.subjectKey === undefined || claim.subjectKey === options.claim.subjectKey)
      && (options.claim?.predicate === undefined || claim.predicate === options.claim.predicate)
    ));
    if (!matchesClaim) continue;
    const key = item.independenceGroup.trim();
    if (key.length === 0) throw new Error(`evidence ${item.id} has an empty independence group`);
    const members = grouped.get(key) ?? [];
    members.push(item);
    grouped.set(key, members);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([independenceGroup, members]) => {
      const ordered = [...members].sort((left, right) => compareStrings(left.id, right.id));
      const eligible = ordered.filter((item) => !isEndogenous(item.causalOrigin, options));
      const discounted = ordered.filter((item) => isEndogenous(item.causalOrigin, options));
      return {
        independenceGroup,
        evidenceIds: ordered.map(({ id }) => id),
        eligibleEvidenceIds: eligible.map(({ id }) => id),
        discountedEvidenceIds: discounted.map(({ id }) => id),
        causalOriginKinds: sortedUnique(ordered.map(({ causalOrigin }) => causalOrigin.kind)) as CausalOrigin["kind"][],
        authorityEligible: eligible.length > 0,
      };
    });
}

export interface EvidenceLane {
  id: string;
  observability: ObservabilityClass;
  assumptions?: readonly string[];
  unavailable?: boolean;
}

export interface EvidenceSupportSummary {
  groups: CausalEvidenceGroup[];
  independentOccurrenceCount: number;
  sourceEvidenceIds: string[];
  generatedEvidenceIds: string[];
  absenceProven: boolean;
  proofCaveats: string[];
}

export function summarizeEvidenceSupport(input: {
  evidence: readonly Evidence[];
  lanes?: readonly EvidenceLane[];
  targetLensId?: string;
  targetRuleId?: string;
}): EvidenceSupportSummary {
  const groups = groupCausalEvidence(input.evidence, {
    ...(input.targetLensId === undefined ? {} : { targetLensId: input.targetLensId }),
    ...(input.targetRuleId === undefined ? {} : { targetRuleId: input.targetRuleId }),
  });
  const lanes = input.lanes ?? [{ id: "provided-evidence", observability: "closed" as const }];
  const proofCaveats: string[] = [];
  for (const lane of lanes) {
    if (lane.unavailable === true || lane.observability === "unavailable") {
      proofCaveats.push(`evidence lane ${lane.id} is unavailable`);
    } else if (lane.observability === "open" || lane.observability === "sampled") {
      proofCaveats.push(`evidence lane ${lane.id} is ${lane.observability} and cannot prove absence`);
    } else if ((lane.assumptions?.length ?? 0) > 0) {
      proofCaveats.push(`evidence lane ${lane.id} depends on boundary assumptions`);
    }
  }
  return {
    groups,
    independentOccurrenceCount: groups.filter(({ authorityEligible }) => authorityEligible).length,
    sourceEvidenceIds: input.evidence.filter(({ causalOrigin }) => !isGenerated(causalOrigin)).map(({ id }) => id).sort(compareStrings),
    generatedEvidenceIds: input.evidence.filter(({ causalOrigin }) => isGenerated(causalOrigin)).map(({ id }) => id).sort(compareStrings),
    absenceProven: input.evidence.length === 0 && proofCaveats.length === 0 && lanes.length > 0,
    proofCaveats: sortedUnique(proofCaveats),
  };
}

export interface PatternFamilyObservation {
  familyKey: string;
  purposeHypothesis: string;
  classification: "member" | "excluded" | "counterexample";
  unit: ProjectionUnit;
  independenceGroup?: string;
  alternatives?: readonly string[];
  evidence: readonly EvidenceRef[];
}

const evidenceRefKey = (reference: EvidenceRef): string =>
  `${reference.evidenceId}\u0000${reference.stance}\u0000${reference.weight ?? ""}`;

function normalizedEvidenceRefs(references: readonly EvidenceRef[]): EvidenceRef[] {
  const byKey = new Map<string, EvidenceRef>();
  for (const reference of references) byKey.set(evidenceRefKey(reference), structuredClone(reference));
  return [...byKey.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, reference]) => reference);
}

/** Produces descriptive candidates only. Normative activation remains an authority workflow. */
export function inferPatternFamilies(observations: readonly PatternFamilyObservation[]): PatternCandidate[] {
  const families = new Map<string, PatternFamilyObservation[]>();
  for (const observation of observations) {
    const familyKey = observation.familyKey.trim();
    if (familyKey.length === 0) throw new Error("pattern family key cannot be empty");
    const existing = families.get(familyKey) ?? [];
    existing.push(observation);
    families.set(familyKey, existing);
  }

  return [...families.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([key, entries]) => {
    const purposeHypotheses = sortedUnique(entries.map(({ purposeHypothesis }) => purposeHypothesis.trim()).filter(Boolean));
    if (purposeHypotheses.length !== 1) throw new Error(`pattern family ${key} has conflicting purpose hypotheses`);
    const members = entries.filter(({ classification }) => classification === "member");
    const independentGroups = sortedUnique(members
      .filter(({ unit }) => !isGenerated(unit.causalOrigin))
      .map(({ independenceGroup, unit }) => independenceGroup?.trim() || unit.id));
    const counterGroups = new Set(entries
      .filter(({ classification, unit }) => classification === "counterexample" && !isGenerated(unit.causalOrigin))
      .map(({ independenceGroup, unit }) => independenceGroup?.trim() || unit.id));
    const confidence = independentGroups.length === 0
      ? 0
      : independentGroups.length / (independentGroups.length + counterGroups.size + 1);
    const candidateWithoutHash = {
      id: `pattern:${key}`,
      key,
      purposeHypothesis: purposeHypotheses[0]!,
      memberUnitIds: sortedUnique(members.map(({ unit }) => unit.id)),
      excludedUnitIds: sortedUnique(entries.filter(({ classification }) => classification === "excluded").map(({ unit }) => unit.id)),
      counterExamples: sortedUnique(entries.filter(({ classification }) => classification === "counterexample").map(({ unit }) => unit.id)),
      independenceGroups: independentGroups,
      alternatives: sortedUnique(entries.flatMap(({ alternatives }) => alternatives ?? [])),
      confidence,
      evidence: normalizedEvidenceRefs(entries.flatMap(({ evidence }) => evidence)),
    };
    return {
      ...candidateWithoutHash,
      semanticHash: hashFramedDomain("pattern-candidate", candidateWithoutHash),
    };
  });
}
