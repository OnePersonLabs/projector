import {
  hashFramedDomain,
  type AuthorityRecord,
  type Evidence,
  type ProjectionUnit,
  type Rule,
  type SelectorExpr,
} from "@projector/core";

const hash = (label: string) => hashFramedDomain("task-7-test-fixture", label);

export function projectionUnit(
  id: string,
  options: {
    path?: string;
    role?: ProjectionUnit["role"];
    tags?: string[];
    lenses?: string[];
    causalOrigin?: ProjectionUnit["causalOrigin"];
    generatedFromUnitIds?: string[];
  } = {},
): ProjectionUnit {
  return {
    id,
    artifactId: `artifact:${id}`,
    key: id,
    role: options.role ?? "implementation",
    anchor: { kind: "file", value: options.path ?? `src/${id}.ts` },
    control: { ownership: "shared", mutation: "transform", actuation: "approval" },
    conceptIds: [],
    requirementIds: [],
    scenarioIds: [],
    lenses: (options.lenses ?? []).map((lensId) => ({ lensId, version: "1", semanticHash: hash(lensId) })),
    tags: options.tags ?? [],
    structuralSignature: {
      profileId: "test",
      profileVersion: "1",
      scope: id,
      hash: hash(`structural:${id}`),
      assurance: "heuristic",
      evidenceIds: [],
    },
    semanticSignature: {
      profileId: "test",
      profileVersion: "1",
      scope: id,
      hash: hash(`semantic:${id}`),
      assurance: "heuristic",
      evidenceIds: [],
    },
    membershipHash: hash(`membership:${id}`),
    validity: "valid",
    confidence: 1,
    causalOrigin: options.causalOrigin ?? { kind: "human" },
    generatedFromUnitIds: options.generatedFromUnitIds ?? [],
  };
}

export function evidence(
  id: string,
  independenceGroup: string,
  options: Partial<Pick<Evidence, "normativeAuthority" | "causalOrigin" | "metadata">> = {},
): Evidence {
  return {
    id,
    kind: "repository-structure",
    locator: id,
    capturedAt: "2026-08-07T00:00:00.000Z",
    contentHash: hash(id),
    claims: [{ subjectKey: "repository-script", predicate: "located-under", object: "scripts" }],
    reliability: "mechanically-proven",
    normativeAuthority: options.normativeAuthority ?? "descriptive-only",
    independenceGroup,
    applicability: "direct",
    freshness: 1,
    causalOrigin: options.causalOrigin ?? { kind: "human" },
    metadata: options.metadata ?? {},
  };
}

export function authorityRecord(id: string, subjectId = "lens:repository-script"): AuthorityRecord {
  return {
    id,
    key: id,
    subjectId,
    status: "approved",
    conclusion: "normalize",
    rationale: "approved repository automation placement",
    alternatives: [],
    assumptions: [],
    reconsiderWhen: [{ type: "manual-review" }],
    vector: {
      explicitDecisionAlignment: 1,
      productConstraintFit: 1,
      semanticFit: 1,
      independentOccurrence: 1,
      historicalStability: 1,
      independentValidationSupport: 1,
      boundaryCoherence: 1,
      maintenanceOutcome: 1,
      platformCompatibility: 1,
      externalRationale: 0,
      ecosystemHealth: 0,
      securitySupport: 0,
      reversibility: 1,
      migrationCost: 0,
      counterEvidence: 0,
    },
    assessmentConfidence: "high",
    evidence: [],
    governanceRiskClass: "R1",
    decidedBy: "user",
    createdAt: "2026-08-07T00:00:00.000Z",
    semanticHash: hash(id),
  };
}

export const tagSelector = (tag: string): SelectorExpr => ({ op: "atom", field: "tag", matcher: "equals", value: tag });

export function rule(
  id: string,
  options: Partial<Omit<Rule, "id" | "key" | "version" | "semanticHash">> = {},
): Rule {
  return {
    id,
    key: id,
    version: "1",
    effect: options.effect ?? "require",
    authorityClass: options.authorityClass ?? "active-lens",
    governanceBasis: options.governanceBasis ?? [{ kind: "hard-constraint", conceptId: "concept:repository-layout" }],
    selector: options.selector ?? tagSelector("repository-automation"),
    predicates: options.predicates ?? [{ kind: "path-under", root: "scripts" }],
    ...(options.advisoryPayload === undefined ? {} : { advisoryPayload: options.advisoryPayload }),
    rationale: options.rationale ?? id,
    evidence: options.evidence ?? [],
    conflictPolicy: options.conflictPolicy ?? "error",
    validatorIds: options.validatorIds ?? [],
    transformIds: options.transformIds ?? [],
    semanticHash: hash(id),
  };
}
