import {
  canonicalJson,
  type AdapterContext,
  type AnalyzerFailure,
  type Confidence,
  type CoverageLane,
  type CoverageSnapshot,
  type ObservabilityClass,
  type StateBinding,
  type StateBindingValidation,
  type StateBindingValidator,
  type StateDigest,
} from "@projector/core";

import { createStateBinding } from "../state/index.js";

export const REQUIRED_COVERAGE_LANES = [
  "inventory",
  "projection-unit-classification",
  "concept-mapping",
  "relationship",
  "lens",
  "rule-enforceability",
  "derivation",
  "validation-evidence",
  "surface",
  "authority",
  "historical-metamorphic",
  "architecture-decision",
  "semantic-identity",
  "pre-change-relevance",
  "representation-projection-fidelity",
  "change-closure",
  "planning-surprise",
] as const;

export type RequiredCoverageLaneKey = (typeof REQUIRED_COVERAGE_LANES)[number];

const CLAIM_KINDS: Readonly<Record<RequiredCoverageLaneKey, readonly string[]>> = {
  inventory: ["artifact-enumeration", "inventory-completeness", "inventory"],
  "projection-unit-classification": ["projection-unit", "classification", "structured-document", "stable-path", "artifact-content", "artifact-metadata", "symlink-target"],
  "concept-mapping": ["concept", "semantic-mapping"],
  relationship: ["relation", "dependency", "relationship", "module-resolution", "package-script-invocations", "source-relationships"],
  lens: ["lens", "recognition"],
  "rule-enforceability": ["rule", "validator"],
  derivation: ["derivation", "source-relationships"],
  "validation-evidence": ["validation", "evidence-lane"],
  surface: ["surface", "external-ownership"],
  authority: ["authority", "governance"],
  "historical-metamorphic": ["historical", "metamorphic", "introduction-history", "git-identity-and-moves"],
  "architecture-decision": ["architecture", "architecture-decision"],
  "semantic-identity": ["identity", "semantic-identity", "overlap", "git-identity-and-moves", "stable-path"],
  "pre-change-relevance": ["relevance", "event-topology", "public-contract-topology"],
  "representation-projection-fidelity": ["representation", "representation-projection", "markdown-structure", "protected-dimension", "structured-document", "stable-path", "document-parse", "duplicate-key"],
  "change-closure": ["change-closure", "impact"],
  "planning-surprise": ["planning-surprise", "predicted-impact", "observed-impact"],
};

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const normalizedPath = (value: string): string => value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/+$/u, "") || ".";
const insideBoundary = (scope: string, boundary: readonly string[]): boolean => {
  const normalizedScope = normalizedPath(scope);
  return boundary.some((item) => {
    const normalized = normalizedPath(item);
    return normalized === "." || normalizedScope === normalized || normalizedScope.startsWith(`${normalized}/`);
  });
};

export interface CoverageLaneEvidence {
  readonly key: RequiredCoverageLaneKey;
  readonly applicability: "required" | "not-applicable";
  readonly boundaryExclusion?: string;
  readonly observability: ObservabilityClass;
  readonly numerator: number;
  readonly denominator?: number | undefined;
  readonly confidence: Confidence;
  readonly assumptions: readonly string[];
  readonly provenAssumptions: readonly string[];
  readonly blindSpots: readonly string[];
  readonly staleObservationIds: readonly string[];
}

export interface SemanticCompletionEvidence {
  artifactsClassified: boolean;
  semanticMappingsResolved: boolean;
  identityDispositionsResolved: boolean;
  expectedProjectionsAccounted: boolean;
  relevanceNegativeSpaceProven: boolean;
  lensesAndRulesOperational: boolean;
  externalOwnershipAssigned: boolean;
  blockerIds: readonly string[];
  unknownUnitIds: readonly string[];
  validationIndependenceSatisfied: boolean;
  architectureFrontierIds: readonly string[];
}

export interface CoverageEvidenceSnapshot {
  readonly boundState: StateBinding;
  readonly lanes: readonly CoverageLaneEvidence[];
  readonly analyzerFailures: readonly AnalyzerFailure[];
  readonly unknownFrontierIds: readonly string[];
  readonly unavailableSurfaceIds: readonly string[];
  completion: SemanticCompletionEvidence;
}

export interface CoverageEvidencePort {
  observe(input: { readonly boundary: readonly string[]; readonly currentState: StateDigest; readonly context: AdapterContext }): Promise<CoverageEvidenceSnapshot>;
}

export interface CoverageLaneReport extends CoverageLane {
  readonly percentage?: number;
  readonly applicability: CoverageLaneEvidence["applicability"];
  readonly boundaryExclusion?: string;
}

export interface AuthenticatedCoverageReport {
  readonly snapshot: CoverageSnapshot;
  readonly boundState: StateBinding;
  readonly bindingValidation: StateBindingValidation;
  readonly laneReports: CoverageLaneReport[];
}

export interface CompileCoverageInput {
  readonly graphRevision: number;
  readonly boundary: readonly string[];
  readonly binding: StateBinding;
  readonly currentState: StateDigest;
  readonly context: AdapterContext;
}

function normalizedBinding(binding: StateBinding): StateBinding {
  const normalized = createStateBinding(binding);
  if (normalized.dependencyDigest !== binding.dependencyDigest) throw new Error("coverage StateBinding dependency digest is invalid");
  return normalized;
}

function requireCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a finite non-negative integer`);
}

function normalizeLane(raw: CoverageLaneEvidence, failures: readonly AnalyzerFailure[]): CoverageLaneReport {
  requireCount(raw.numerator, `${raw.key} numerator`);
  if (raw.denominator !== undefined) {
    requireCount(raw.denominator, `${raw.key} denominator`);
    if (raw.denominator > 0 && raw.numerator > raw.denominator) throw new Error(`${raw.key} numerator cannot exceed denominator`);
    if (raw.denominator === 0 && raw.numerator !== 0) throw new Error(`${raw.key} numerator must be zero when denominator is zero`);
  }
  if (!Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) throw new Error(`${raw.key} confidence must be within 0..1`);
  if (raw.applicability === "not-applicable" && (raw.boundaryExclusion === undefined || raw.boundaryExclusion.trim() === "")) {
    throw new Error(`${raw.key} not-applicable evidence requires an explicit boundary exclusion`);
  }
  const assumptions = unique(raw.assumptions);
  const proven = new Set(raw.provenAssumptions);
  const blindSpots = unique(raw.blindSpots);
  const staleObservationIds = unique(raw.staleObservationIds);
  const claimKinds = new Set(CLAIM_KINDS[raw.key]);
  const analyzerFailures = [...failures].filter(({ capability, affectedClaimKinds }) => claimKinds.has(capability) || affectedClaimKinds.some((kind) => claimKinds.has(kind)))
    .sort((left, right) => compare(canonicalJson(left), canonicalJson(right)));
  const requiredAssumptionsProven = assumptions.every((assumption) => proven.has(assumption));
  const exactClosureProvable = raw.applicability === "not-applicable"
    || (raw.denominator !== undefined && raw.numerator === raw.denominator && (raw.observability === "closed" || raw.observability === "bounded") && (raw.observability !== "bounded" || requiredAssumptionsProven)
      && blindSpots.length === 0 && analyzerFailures.length === 0 && staleObservationIds.length === 0);
  const lane: CoverageLaneReport = {
    key: raw.key,
    observability: raw.applicability === "not-applicable" ? "closed" : raw.observability,
    numerator: raw.applicability === "not-applicable" ? 0 : raw.numerator,
    ...(raw.applicability === "not-applicable" ? { denominator: 0 } : raw.denominator === undefined ? {} : { denominator: raw.denominator }),
    confidence: raw.confidence,
    assumptions: raw.applicability === "not-applicable" ? unique([...assumptions, `boundary-exclusion:${raw.boundaryExclusion}`]) : assumptions,
    blindSpots,
    analyzerFailures,
    staleObservationIds,
    exactClosureProvable,
    applicability: raw.applicability,
    ...(raw.boundaryExclusion === undefined ? {} : { boundaryExclusion: raw.boundaryExclusion }),
    ...(raw.applicability === "required" && raw.denominator !== undefined && raw.denominator > 0 ? { percentage: (raw.numerator / raw.denominator) * 100 } : {}),
  };
  return lane;
}

function semanticCompletion(evidence: CoverageEvidenceSnapshot): boolean {
  const item = evidence.completion;
  return item.artifactsClassified && item.semanticMappingsResolved && item.identityDispositionsResolved
    && item.expectedProjectionsAccounted && item.relevanceNegativeSpaceProven && item.lensesAndRulesOperational
    && item.externalOwnershipAssigned && item.blockerIds.length === 0 && item.unknownUnitIds.length === 0
    && item.validationIndependenceSatisfied && item.architectureFrontierIds.length === 0;
}

export async function compileAuthenticatedCoverageSnapshot(
  input: CompileCoverageInput,
  ports: { readonly bindingValidator: StateBindingValidator; readonly evidence: CoverageEvidencePort },
): Promise<AuthenticatedCoverageReport> {
  if (!Number.isSafeInteger(input.graphRevision) || input.graphRevision < 0) throw new Error("coverage graph revision must be a non-negative integer");
  const boundary = unique(input.boundary.map((item) => item.trim()).filter(Boolean));
  if (boundary.length === 0) throw new Error("coverage boundary must not be empty");
  const requestedBinding = normalizedBinding(input.binding);
  const bindingValidation = await ports.bindingValidator.validate(requestedBinding, input.currentState, input.context);
  if (bindingValidation.status !== "current" && bindingValidation.status !== "rebound") throw new Error(`coverage binding is ${bindingValidation.status}`);
  const boundState = normalizedBinding(bindingValidation.status === "rebound" ? bindingValidation.rebound! : requestedBinding);
  if (canonicalJson(boundState.compiledAgainst) !== canonicalJson(input.currentState)) throw new Error("coverage binding is not compiled against current state");
  const evidence = await ports.evidence.observe({ boundary, currentState: input.currentState, context: input.context });
  if (canonicalJson(normalizedBinding(evidence.boundState)) !== canonicalJson(boundState)) throw new Error("coverage evidence is not authenticated to the validated StateBinding");
  const byKey = new Map<RequiredCoverageLaneKey, CoverageLaneEvidence>();
  for (const raw of evidence.lanes) {
    if (!(REQUIRED_COVERAGE_LANES as readonly string[]).includes(raw.key)) throw new Error(`unknown coverage lane ${raw.key}`);
    const normalizedRaw: CoverageLaneEvidence = { ...raw, assumptions: unique(raw.assumptions), provenAssumptions: unique(raw.provenAssumptions), blindSpots: unique(raw.blindSpots), staleObservationIds: unique(raw.staleObservationIds), ...(raw.boundaryExclusion === undefined ? {} : { boundaryExclusion: raw.boundaryExclusion.trim() }) };
    const existing = byKey.get(raw.key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(normalizedRaw)) throw new Error(`conflicting coverage lane ${raw.key}`);
    byKey.set(raw.key, normalizedRaw);
  }
  const missing = REQUIRED_COVERAGE_LANES.filter((key) => !byKey.has(key));
  if (missing.length > 0 || byKey.size !== REQUIRED_COVERAGE_LANES.length) throw new Error(`coverage evidence must contain exactly 17 required lanes; missing: ${missing.join(", ")}`);
  const relevantFailures = evidence.analyzerFailures.filter((failure) => insideBoundary(failure.scope, boundary));
  for (const failure of relevantFailures) {
    const mapped = REQUIRED_COVERAGE_LANES.some((key) => {
      const claims = new Set(CLAIM_KINDS[key]);
      return claims.has(failure.capability) || failure.affectedClaimKinds.some((kind) => claims.has(kind));
    });
    if (!mapped) throw new Error(`analyzer failure ${failure.capability} omits all recognized dependent coverage claims`);
  }
  const laneReports = REQUIRED_COVERAGE_LANES.map((key) => normalizeLane(byKey.get(key)!, relevantFailures));
  const allExact = laneReports.every(({ exactClosureProvable }) => exactClosureProvable);
  const completeWithinBoundary = allExact && semanticCompletion(evidence) && evidence.unknownFrontierIds.length === 0 && evidence.unavailableSurfaceIds.length === 0;
  const anyUnavailable = laneReports.some(({ observability }) => observability === "unavailable") || evidence.unavailableSurfaceIds.length > 0;
  const anyIncompleteBoundary = laneReports.some(({ observability, exactClosureProvable }) => !exactClosureProvable || observability === "open" || observability === "sampled");
  const averageConfidence = laneReports.reduce((sum, { confidence }) => sum + confidence, 0) / laneReports.length;
  const proofStatement: CoverageSnapshot["proofStatement"] = completeWithinBoundary ? "proven-within-boundary"
    : anyUnavailable ? "not-established"
      : !anyIncompleteBoundary ? "bounded"
        : averageConfidence >= 0.8 ? "high-confidence" : "partial";
  const snapshot: CoverageSnapshot = {
    graphRevision: input.graphRevision,
    boundary,
    lanes: laneReports.map(({ percentage: _percentage, applicability: _applicability, boundaryExclusion: _boundaryExclusion, ...lane }) => lane),
    completeWithinBoundary,
    allowsBoundedAgentRepair: !anyUnavailable && evidence.completion.blockerIds.length === 0,
    unknownFrontierIds: unique([...evidence.unknownFrontierIds, ...evidence.completion.unknownUnitIds]),
    unavailableSurfaceIds: unique(evidence.unavailableSurfaceIds),
    proofStatement,
  };
  return { snapshot, boundState, bindingValidation, laneReports };
}
