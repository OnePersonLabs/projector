import {
  DecisionDeferralSchema,
  DecisionEvaluationSchema,
  DecisionOptionSchema,
  DecisionValidityAssessmentSchema,
  canonicalJson,
  hashFramedDomain,
  type AppliedPreferenceRef,
  type ArchitectureConcern,
  type ArchitectureDecision,
  type DecisionDeferral,
  type DecisionEvaluation,
  type DecisionOption,
  type DecisionValidityAssessment,
  type DeveloperPreference,
  type EntityId,
  type RelevanceClosure,
  type SelectorExpr,
  type StateBinding,
  type StateBindingValidation,
  type StateQueryDependency,
} from "@projector/core";

import { normalizeSelector } from "../governance/selectors.js";
import { createStateBinding } from "../state/index.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export interface CaptureDecisionStateBindingInput {
  closure: RelevanceClosure;
  applicabilityQueries: readonly StateQueryDependency[];
  negativeSpaceQueries: readonly StateQueryDependency[];
}

/** Decision reuse is bound to positive applicability and negative-space observations, including empty/open results. */
export function captureDecisionStateBinding(input: CaptureDecisionStateBindingInput): StateBinding {
  return createStateBinding({
    compiledAgainst: input.closure.boundState.compiledAgainst,
    valueDependencies: input.closure.boundState.valueDependencies,
    queryDependencies: [
      ...input.closure.boundState.queryDependencies,
      ...input.applicabilityQueries,
      ...input.negativeSpaceQueries,
    ],
  });
}

export interface AssessDecisionValidityInput {
  decision: ArchitectureDecision;
  currentScope: SelectorExpr;
  applicable: boolean;
  bindingValidation: StateBindingValidation;
  firedTriggers: DecisionValidityAssessment["firedTriggers"];
  invalidatedAssumptions: readonly string[];
  staleEvidenceIds: readonly EntityId[];
  governedPopulationCount: number;
}

export function assessDecisionValidity(input: AssessDecisionValidityInput): DecisionValidityAssessment {
  const scope = normalizeSelector(input.currentScope);
  const firedTriggers = [...new Map(input.firedTriggers.map((trigger) => [canonicalJson(trigger), trigger])).entries()]
    .sort(([left], [right]) => compareStrings(left, right)).map(([, trigger]) => structuredClone(trigger));
  const invalidatedAssumptions = sortedUnique(input.invalidatedAssumptions);
  const staleEvidenceIds = sortedUnique(input.staleEvidenceIds);
  if (!Number.isInteger(input.governedPopulationCount) || input.governedPopulationCount < 0) throw new Error("governed population count must be a non-negative integer");

  let state: DecisionValidityAssessment["state"];
  let blocksCurrentChange: boolean;
  let explanation: string;
  if (input.governedPopulationCount === 0) {
    state = "invalid-for-scope";
    blocksCurrentChange = false;
    explanation = `decision ${input.decision.id} has no governed population in the assessed scope`;
  } else if (!input.applicable) {
    state = "valid";
    blocksCurrentChange = false;
    explanation = `decision ${input.decision.id} remains valid outside the changed scope and was not reconsidered`;
  } else if (invalidatedAssumptions.length > 0) {
    state = "contested";
    blocksCurrentChange = true;
    explanation = `decision ${input.decision.id} has invalidated assumptions and must be resolved for this scope`;
  } else if (input.bindingValidation.status !== "current" || firedTriggers.length > 0 || staleEvidenceIds.length > 0) {
    state = "suspect";
    blocksCurrentChange = true;
    explanation = `decision ${input.decision.id} lost proof for this scope; reassessment may reaffirm the existing decision`;
  } else {
    state = "valid";
    blocksCurrentChange = false;
    explanation = `decision ${input.decision.id} was not reconsidered because its scope and proof dependencies remain current`;
  }
  return DecisionValidityAssessmentSchema.parse({
    decisionId: input.decision.id,
    scope,
    state,
    firedTriggers,
    invalidatedAssumptions,
    staleEvidenceIds,
    blocksCurrentChange,
    explanation,
  }) as DecisionValidityAssessment;
}

export interface ArchitectureResearchRequest {
  concern: ArchitectureConcern;
  candidateOptions: readonly DecisionOption[];
  affectedEvidenceIds: readonly EntityId[];
}

export interface ArchitectureResearchResult {
  options: readonly DecisionOption[];
  evidenceIds: readonly EntityId[];
  unavailable: boolean;
  uncertainty: readonly string[];
}

export interface ArchitectureResearchPort {
  verifyOptionSet(input: ArchitectureResearchRequest): Promise<ArchitectureResearchResult>;
}

export interface EvaluateDecisionOptionsInput {
  concern: ArchitectureConcern;
  options: readonly DecisionOption[];
  preferences: readonly DeveloperPreference[];
  preferenceMatches: Readonly<Record<string, readonly string[]>>;
  research: { required: boolean; affectedEvidenceIds: readonly EntityId[] };
  acceptance: "automatic" | "explicit-user";
  evaluatedAt?: string;
}

export interface DecisionOptionEvaluationResult {
  evaluation: DecisionEvaluation;
  acceptanceBlocked: boolean;
  appliedPreferences: AppliedPreferenceRef[];
  preferenceConflicts: string[];
  governanceConsequences: [];
}

function normalizeOptions(options: readonly DecisionOption[]): DecisionOption[] {
  const byKey = new Map<string, DecisionOption>();
  for (const option of options) {
    const normalized = DecisionOptionSchema.parse(structuredClone(option)) as DecisionOption;
    const existing = byKey.get(normalized.key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(normalized)) throw new Error(`conflicting option ${normalized.key}`);
    byKey.set(normalized.key, normalized);
  }
  return [...byKey.values()].sort((left, right) => compareStrings(left.key, right.key));
}

const preferenceScopeRank: Record<DeveloperPreference["scope"], number> = { user: 0, organization: 1, project: 2 };
const preferenceStrength: Record<DeveloperPreference["strength"], number> = { avoid: -1, prefer: 1, "strongly-prefer": 2 };

export async function evaluateDecisionOptions(
  input: EvaluateDecisionOptionsInput,
  researchPort?: ArchitectureResearchPort,
): Promise<DecisionOptionEvaluationResult> {
  const proposedOptions = normalizeOptions(input.options);
  let options = proposedOptions;
  let researchEvidenceIds: string[] = [];
  let researchUnavailable = false;
  let unknowns: string[] = [];
  if (input.research.required) {
    if (researchPort === undefined) {
      researchUnavailable = true;
      unknowns.push("required current option-set research is unavailable");
    } else {
      const researched = await researchPort.verifyOptionSet({
        concern: structuredClone(input.concern),
        candidateOptions: proposedOptions,
        affectedEvidenceIds: sortedUnique(input.research.affectedEvidenceIds),
      });
      options = normalizeOptions(researched.options);
      researchEvidenceIds = sortedUnique(researched.evidenceIds);
      researchUnavailable = researched.unavailable;
      unknowns.push(...researched.uncertainty);
    }
  }

  const eliminatedOptionKeys = options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "fails").map(({ key }) => key);
  const uncertainOptions = options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "unknown").map(({ key }) => key);
  unknowns.push(...uncertainOptions.map((key) => `option ${key} has unknown hard-constraint status`));
  const viable = options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "passes");
  const activePreferences = input.preferences.filter(({ status }) => status === "active");
  const maximumScopeRank = activePreferences.reduce((maximum, item) => Math.max(maximum, preferenceScopeRank[item.scope]), -1);
  const rankingPreferences = activePreferences.filter((item) => preferenceScopeRank[item.scope] === maximumScopeRank);
  const scores = new Map(viable.map(({ key }) => [key, 0]));
  const preferenceConflicts: string[] = [];
  for (const preference of rankingPreferences) {
    for (const optionKey of sortedUnique(input.preferenceMatches[preference.id] ?? [])) {
      if (!scores.has(optionKey)) continue;
      scores.set(optionKey, scores.get(optionKey)! + preferenceStrength[preference.strength]);
    }
  }
  for (const option of viable) {
    const influences = rankingPreferences.filter((preference) => (input.preferenceMatches[preference.id] ?? []).includes(option.key));
    if (influences.some(({ strength }) => strength === "avoid") && influences.some(({ strength }) => strength !== "avoid")) {
      preferenceConflicts.push(`conflicting ${influences[0]?.scope ?? "soft"} preferences remain visible for option ${option.key}`);
    }
  }
  const favoredOptionKeys = sortedUnique(rankingPreferences
    .filter(({ strength }) => strength !== "avoid")
    .flatMap((preference) => input.preferenceMatches[preference.id] ?? [])
    .filter((key) => scores.has(key)));
  if (favoredOptionKeys.length > 1) preferenceConflicts.push(`conflicting ${rankingPreferences[0]?.scope ?? "soft"} preferences favor distinct viable options: ${favoredOptionKeys.join(", ")}`);
  const ranked = [...viable].sort((left, right) => (scores.get(right.key)! - scores.get(left.key)!) || compareStrings(left.key, right.key));
  const recommendedOptionKey = ranked[0]?.key;
  const acceptanceBlocked = input.research.required && researchUnavailable && input.acceptance === "automatic";
  const topScore = recommendedOptionKey === undefined ? undefined : scores.get(recommendedOptionKey);
  const tied = topScore === undefined ? [] : ranked.filter(({ key }) => scores.get(key) === topScore);
  const outcome: DecisionEvaluation["outcome"] = acceptanceBlocked || recommendedOptionKey === undefined
    ? "insufficient-evidence"
    : tied.length > 1 && preferenceConflicts.length > 0 ? "contested" : "recommended";
  const materiallyInfluential = recommendedOptionKey !== undefined && (scores.get(recommendedOptionKey) ?? 0) !== 0
    ? rankingPreferences.filter((preference) => (input.preferenceMatches[preference.id] ?? []).includes(recommendedOptionKey))
    : [];
  const appliedPreferences = materiallyInfluential.map((preference): AppliedPreferenceRef => ({
    key: preference.key,
    scope: preference.scope,
    semanticHash: preference.semanticHash,
    influence: `${preference.strength} changed the viable-option ranking toward ${recommendedOptionKey}`,
  })).sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  unknowns = sortedUnique(unknowns);
  const preferenceSnapshotHash = hashFramedDomain("architecture-preference-snapshot", rankingPreferences.map(({ id, semanticHash }) => ({ id, semanticHash })).sort((left, right) => compareStrings(left.id, right.id)));
  const stableEvaluation = {
    concernId: input.concern.id,
    scope: normalizeSelector(input.concern.scope),
    options,
    eliminatedOptionKeys,
    ...(recommendedOptionKey === undefined || acceptanceBlocked ? {} : { recommendedOptionKey }),
    outcome,
    hardConstraints: [],
    preferenceSnapshotHash,
    researchEvidenceIds,
    unknowns,
  };
  const semanticHash = hashFramedDomain("decision-evaluation", stableEvaluation);
  const evaluation = DecisionEvaluationSchema.parse({
    id: `decision-evaluation:${semanticHash.slice("sha256:v1:".length, "sha256:v1:".length + 24)}`,
    ...stableEvaluation,
    evaluatedAt: input.evaluatedAt ?? "deterministic",
    semanticHash,
  }) as DecisionEvaluation;
  return { evaluation, acceptanceBlocked, appliedPreferences, preferenceConflicts: sortedUnique(preferenceConflicts), governanceConsequences: [] };
}

export interface DeferralValidation {
  valid: boolean;
  reasons: string[];
}

export function validateDecisionDeferral(deferral: DecisionDeferral): DeferralValidation {
  const parsed = DecisionDeferralSchema.safeParse(deferral);
  const reasons: string[] = [];
  if (!parsed.success) reasons.push("deferral does not satisfy the normative DecisionDeferral contract");
  if (deferral.rationale.trim().length === 0) reasons.push("deferral requires rationale");
  if (deferral.preserveOptionality.length === 0) reasons.push("deferral must state preserved optionality");
  if (deferral.forbiddenCommitments.length === 0) reasons.push("deferral must forbid irreversible commitments");
  if (deferral.reconsiderWhen.length === 0) reasons.push("deferral requires a deterministic reconsideration trigger");
  return { valid: reasons.length === 0, reasons };
}

export interface DecisionDeferralAssessmentPort {
  assess(deferral: DecisionDeferral): Promise<{
    compatibilityPreserving: boolean;
    optionalityPreserved: boolean;
    secretlySelectsOption: boolean;
    irreversibleCommitments: readonly string[];
  }>;
}

/** Semantic neutrality is verified at the host boundary; prose fields alone are not trusted as proof. */
export async function assessDecisionDeferral(deferral: DecisionDeferral, port: DecisionDeferralAssessmentPort): Promise<DeferralValidation> {
  const structural = validateDecisionDeferral(deferral);
  if (!structural.valid) return structural;
  const assessment = await port.assess(structuredClone(deferral));
  const reasons: string[] = [];
  if (!assessment.compatibilityPreserving) reasons.push("deferral has no compatibility-preserving path");
  if (!assessment.optionalityPreserved) reasons.push("deferral does not preserve stated optionality");
  if (assessment.secretlySelectsOption) reasons.push("deferral guardrail secretly selects an option and must be represented as a temporary decision");
  if (assessment.irreversibleCommitments.length > 0) reasons.push(`deferral permits irreversible commitments: ${sortedUnique(assessment.irreversibleCommitments).join(", ")}`);
  return { valid: reasons.length === 0, reasons };
}
