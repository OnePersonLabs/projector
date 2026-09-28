import {
  canonicalJson, hashFramedDomain, normalizeRepositoryRelativePath,
  buildManifest, manifestKey, type ManifestUpdate,
  type ContentHash, type EffectiveRuleBundle, type EnumerationContract, type NormalizedPredicate, type SelectorExpr,
} from "@projector/core";
import { evaluateSelector, type SelectorSubject } from "./selectors.js";
import { isHardRule } from "./rules.js";

export interface GovernanceDependency {
  readonly fromUnitId: string;
  /** An observed local unit or an explicit external-package subject. Omitted means unresolved. */
  readonly toSubjectId?: string;
  readonly specifier: string;
  readonly evidenceIds: readonly string[];
}

export interface GovernanceObservation {
  readonly subjects: readonly SelectorSubject[];
  /** Members of unitEnumeration; dependency-only external targets are excluded. */
  readonly unitIds: readonly string[];
  readonly dependencies: readonly GovernanceDependency[];
  readonly unitEnumeration: EnumerationContract;
  readonly dependencyEnumerations: readonly {
    readonly unitId: string;
    readonly contract: EnumerationContract;
    readonly unknowns: readonly string[];
  }[];
}

/** A completed, version-bound population summary. Missing summaries are unknown. */
export interface GovernancePopulationSummary {
  readonly knownCount: number;
  readonly unknownCount: number;
  readonly fingerprint: ContentHash;
}

/** Reads must share one observation generation; the owner rejects concurrent replacement. */
export interface GovernanceObservationReader {
  readonly unitEnumeration: EnumerationContract;
  subject(id: string): SelectorSubject | undefined;
  outgoing(unitId: string): readonly GovernanceDependency[];
  enumeration(unitId: string): GovernanceObservation["dependencyEnumerations"][number] | undefined;
  cardinality(selector: SelectorExpr): GovernancePopulationSummary | undefined;
}

export function governancePopulationEntry(selector: SelectorExpr, subject: SelectorSubject): { key: string; value: { id: string; matched: true | null } } | undefined {
  const matched = matches(selector, subject);
  return matched === false ? undefined : { key: manifestKey(subject.id), value: { id: subject.id, matched: matched ?? null } };
}

export function summarizeGovernanceManifest(root: ContentHash, knownCount: number, unknownCount: number): GovernancePopulationSummary {
  return {
    knownCount, unknownCount,
    fingerprint: hashFramedDomain("governance-selector-population/v2", { root, knownCount, unknownCount }),
  };
}

export function buildGovernancePopulation(selector: SelectorExpr, subjects: readonly SelectorSubject[]): { readonly summary: GovernancePopulationSummary; readonly manifest: ManifestUpdate } {
  const entries = subjects.flatMap(subject => { const entry = governancePopulationEntry(selector, subject); return entry === undefined ? [] : [entry]; });
  const manifest = buildManifest(entries);
  const known = entries.filter(({value}) => value.matched === true).length;
  return { summary: summarizeGovernanceManifest(manifest.root, known, entries.length - known), manifest };
}

export function summarizeGovernancePopulation(selector: SelectorExpr, subjects: readonly SelectorSubject[]): GovernancePopulationSummary {
  return buildGovernancePopulation(selector, subjects).summary;
}

export interface GovernanceFinding {
  readonly id: string;
  readonly unitId: string;
  readonly ruleId: string;
  readonly predicateHash: ContentHash;
  readonly status: "satisfied" | "violated" | "unknown";
  readonly reason: string;
  readonly evidenceIds: readonly string[];
}

export interface GovernanceBundleEvaluation {
  readonly unitId: string;
  readonly status: "conformant" | "violated" | "unknown";
  readonly findings: readonly GovernanceFinding[];
  readonly boundary: readonly string[];
  readonly observationHash: ContentHash;
  readonly contentHash: ContentHash;
}

/** Authenticated host observations; the engine never executes validator programs. */
export interface ExternalGovernanceValidatorFinding {
  readonly unitId: string;
  readonly validatorId: string;
  readonly status: "satisfied" | "violated" | "unknown";
  readonly reason: string;
  readonly evidenceIds: readonly string[];
}

export interface GovernanceEvaluationOptions {
  readonly validatorFindings?: readonly ExternalGovernanceValidatorFinding[];
  readonly requiredValidatorIds?: readonly string[];
}

const strings = (values: readonly string[]) => [...new Set(values)].sort();
const unique = <T>(values: readonly T[]): T[] => [...new Map(values.map(value => [canonicalJson(value), value])).entries()]
  .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
type Check = Pick<GovernanceFinding, "status" | "reason" | "evidenceIds">;
const check = (status: Check["status"], reason: string, evidenceIds: readonly string[] = []): Check => ({ status, reason, evidenceIds: strings(evidenceIds) });
const eligible = (contract: EnumerationContract | undefined): boolean => contract !== undefined
  && (contract.observability === "closed" || contract.observability === "bounded") && contract.dynamicMechanisms.length === 0;

/** Missing facts are unknown, including under negation. Known partial matches can still decide a selector. */
function matches(selector: SelectorExpr, subject: SelectorSubject): boolean | undefined {
  if (selector.op === "all" || selector.op === "any") {
    const children = selector.items.map(item => matches(item, subject));
    if (selector.op === "all") return children.includes(false) ? false : children.includes(undefined) ? undefined : true;
    return children.includes(true) ? true : children.includes(undefined) ? undefined : false;
  }
  if (selector.op === "not") {
    const matched = matches(selector.item, subject);
    return matched === undefined ? undefined : !matched;
  }
  if (subject.values[selector.field] === undefined) return undefined;
  try { return evaluateSelector(selector, subject).matched; }
  catch { return undefined; }
}

function canonicalPath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.includes("\\")) return undefined;
  const normalized = normalizeRepositoryRelativePath(value);
  return normalized === value ? normalized : undefined;
}

/** Evaluates data from an observer. Canonical strings never become executable commands. */
export function evaluateEffectiveRuleBundle(bundle: EffectiveRuleBundle, observation: GovernanceObservation, options: GovernanceEvaluationOptions = {}): GovernanceBundleEvaluation {
  return prepareGovernanceEvaluator(observation, options.validatorFindings)(bundle, options);
}

/** A private observation snapshot and indexes, reused only within the caller's request. */
export function prepareGovernanceEvaluator(input: GovernanceObservation, findings: readonly ExternalGovernanceValidatorFinding[] = []): (bundle: EffectiveRuleBundle, options?: Omit<GovernanceEvaluationOptions, "validatorFindings">) => GovernanceBundleEvaluation {
  const observation = structuredClone(input);
  const subjects = new Map<string, SelectorSubject>();
  for (const subject of observation.subjects) {
    if (subjects.has(subject.id)) throw new Error(`duplicate governance subject ${subject.id}`);
    subjects.set(subject.id, { ...subject, dependencyKeys: strings(subject.dependencyKeys) });
  }
  const unitIds = strings(observation.unitIds);
  if (unitIds.length !== observation.unitIds.length || unitIds.some(id => !subjects.has(id))) throw new Error("invalid or duplicate enumerated governance unit");
  const enumerations = new Map<string, GovernanceObservation["dependencyEnumerations"][number]>();
  for (const enumeration of observation.dependencyEnumerations) {
    if (enumerations.has(enumeration.unitId)) throw new Error(`duplicate dependency enumeration ${enumeration.unitId}`);
    enumerations.set(enumeration.unitId, { ...enumeration, unknowns: strings(enumeration.unknowns) });
  }
  const dependencies = unique(observation.dependencies.map(edge => ({ ...edge, evidenceIds: strings(edge.evidenceIds) })));
  const outgoingByUnit = new Map<string, GovernanceDependency[]>();
  for (const edge of dependencies) {
    const outgoing = outgoingByUnit.get(edge.fromUnitId) ?? [];
    outgoing.push(edge); outgoingByUnit.set(edge.fromUnitId, outgoing);
  }
  const populations = new Map<ContentHash, GovernancePopulationSummary>();
  return prepareIndexedGovernanceEvaluator({
    unitEnumeration: observation.unitEnumeration,
    subject: id => subjects.get(id),
    outgoing: id => outgoingByUnit.get(id) ?? [],
    enumeration: id => enumerations.get(id),
    cardinality: selector => {
      const key = hashFramedDomain("governance-selector", selector);
      let population = populations.get(key);
      if (population === undefined) {
        population = summarizeGovernancePopulation(selector, unitIds.map(id => subjects.get(id)!));
        populations.set(key, population);
      }
      return population;
    },
  }, findings);
}

/** Shares predicate semantics with the eager adapter; reads only the evaluated bundle's inputs. */
export function prepareIndexedGovernanceEvaluator(observation: GovernanceObservationReader, findings: readonly ExternalGovernanceValidatorFinding[] = []): (bundle: EffectiveRuleBundle, options?: Omit<GovernanceEvaluationOptions, "validatorFindings">) => GovernanceBundleEvaluation {
  const findingsByUnit = new Map<string, ExternalGovernanceValidatorFinding[]>();
  for (const finding of structuredClone(findings)) {
    const unitFindings = findingsByUnit.get(finding.unitId) ?? [];
    unitFindings.push(finding); findingsByUnit.set(finding.unitId, unitFindings);
  }
  const validatorObservations = new Map<string, ReadonlyMap<string, ExternalGovernanceValidatorFinding>>();
  return (bundle, options = {}) => {
    let validatorObservation = validatorObservations.get(bundle.unitId);
    if (validatorObservation === undefined) {
      const unitFindings = new Map<string, ExternalGovernanceValidatorFinding>();
      for (const finding of findingsByUnit.get(bundle.unitId) ?? []) {
        if (unitFindings.has(finding.validatorId)) throw new Error(`duplicate validator observation ${finding.validatorId} for ${bundle.unitId}`);
        unitFindings.set(finding.validatorId, finding);
      }
      validatorObservation = unitFindings;
      validatorObservations.set(bundle.unitId, validatorObservation);
    }
    const validatorCheck = (validatorId: string): Check => {
      const finding = validatorObservation.get(validatorId);
      return finding === undefined ? check("unknown", `Validator ${validatorId} has no registered evaluator for this rule.`)
        : check(finding.status, finding.reason, finding.evidenceIds);
    };
    const subject = observation.subject(bundle.unitId);
    const enumeration = observation.enumeration(bundle.unitId);
    const outgoing = unique(observation.outgoing(bundle.unitId).map(edge => ({ ...edge, evidenceIds: strings(edge.evidenceIds) })));
    const targets = new Map(outgoing.flatMap(({toSubjectId}) => toSubjectId === undefined ? [] : [[toSubjectId, observation.subject(toSubjectId)] as const]));
    const populations = new Map<ContentHash, GovernancePopulationSummary | undefined>();
    const suppressed = new Set(bundle.suppressedRules.map(({ ruleId }) => ruleId));
    const rules = bundle.rules.filter(rule => isHardRule(rule) && !suppressed.has(rule.id));
    const allowed = rules.filter(rule => rule.effect !== "forbid").flatMap(rule => rule.predicates)
      .filter((predicate): predicate is Extract<NormalizedPredicate, { kind: "dependency-allowed" }> => predicate.kind === "dependency-allowed");

    const evaluate = (predicate: NormalizedPredicate): Check => {
      if (subject === undefined) return check("unknown", "The governed unit is not present in the observation.");
      if (predicate.kind === "validator") return validatorCheck(predicate.validatorId);
      if (predicate.kind === "path-under" || predicate.kind === "path-not-under") {
        const path = canonicalPath(subject.values.path);
        const root = canonicalPath(predicate.root);
        if (path === undefined || root === undefined) return check("unknown", "A canonical repository path or predicate root is unavailable.");
        const under = path === root || path.startsWith(`${root}/`);
        const satisfied = predicate.kind === "path-under" ? under : !under;
        return check(satisfied ? "satisfied" : "violated", `${path} ${under ? "is" : "is not"} under ${root}.`, subject.dependencyKeys);
      }
      if (predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed") {
        const from = matches(predicate.from, subject);
        if (from === undefined) return check("unknown", "Dependency source selector facts are incomplete.");
        if (!from) return check("satisfied", "The dependency predicate does not apply to this source.");
        let incomplete = !eligible(enumeration?.contract) || (enumeration?.unknowns.length ?? 0) > 0;
        const allowedTargets = allowed.filter(item => matches(item.from, subject) === true).map(item => item.to);
        const unknownAllowedSource = allowed.some(item => matches(item.from, subject) === undefined);
        const violationEvidence: string[] = [];
        const violatedSpecifiers: string[] = [];
        for (const edge of outgoing) {
          const target = edge.toSubjectId === undefined ? undefined : targets.get(edge.toSubjectId);
          if (target === undefined) { incomplete = true; continue; }
          const targetMatches = predicate.kind === "dependency-forbidden"
            ? matches(predicate.to, target) : matches({ op: "any", items: allowedTargets }, target);
          if (targetMatches === undefined) { incomplete = true; continue; }
          const violation = predicate.kind === "dependency-forbidden" ? targetMatches : !targetMatches;
          if (violation && predicate.kind === "dependency-allowed" && unknownAllowedSource) { incomplete = true; continue; }
          if (violation) { violatedSpecifiers.push(edge.specifier); violationEvidence.push(...edge.evidenceIds); }
        }
        if (violatedSpecifiers.length > 0) return check("violated", `Observed dependencies violate the boundary: ${strings(violatedSpecifiers).join(", ")}.`, violationEvidence);
        if (incomplete) return check("unknown", `Dependency conformance is not established: ${enumeration?.unknowns.join("; ") || "incomplete dependency observations"}.`);
        return check("satisfied", "Observed dependencies satisfy the predicate within the declared enumeration boundary.", outgoing.flatMap(edge => edge.evidenceIds));
      }
      if (predicate.kind === "cardinality") {
        const { min, max } = predicate;
        if ((min === undefined && max === undefined) || [min, max].some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 0))
          || (min !== undefined && max !== undefined && min > max)) return check("unknown", "Invalid cardinality bounds.");
        const selectorHash = hashFramedDomain("governance-selector", predicate.selector);
        if (!populations.has(selectorHash)) populations.set(selectorHash, observation.cardinality(predicate.selector));
        const population = populations.get(selectorHash);
        if (population === undefined) return check("unknown", "The complete cardinality population is unavailable.");
        const count = population.knownCount;
        if (max !== undefined && count > max) return check("violated", `${count} observed members exceed maximum ${max}.`);
        if (!eligible(observation.unitEnumeration) || population.unknownCount > 0) return check("unknown", `Only ${count} members are known in an incomplete universe.`);
        if (min !== undefined && count < min) return check("violated", `${count} members are below minimum ${min}.`);
        return check("satisfied", `${count} observed members satisfy cardinality.`);
      }
      return check("unknown", `Predicate ${predicate.kind} has no registered evaluator.`);
    };

    const findings: GovernanceFinding[] = [];
    const add = (ruleId: string, predicate: unknown, result: Check) => {
      const predicateHash = hashFramedDomain("governance-predicate", predicate);
      const id = hashFramedDomain("governance-finding", { unitId: bundle.unitId, ruleId, predicateHash, ...result });
      findings.push({ id, unitId: bundle.unitId, ruleId, predicateHash, ...result });
    };
    for (const rule of rules) {
      for (const predicate of unique(rule.predicates)) {
        add(rule.id, predicate, ["require", "validate", "restrict"].includes(rule.effect)
          ? evaluate(predicate) : check("unknown", `Rule effect ${rule.effect} has no registered execution semantics.`));
      }
      for (const validatorId of strings(rule.validatorIds)) {
        const builtin = validatorId === "projector.builtin.static-dependency-boundary@1" && rule.predicates.length > 0
          && rule.predicates.every(predicate => predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed");
        if (!builtin) add(rule.id, { validatorId }, validatorCheck(validatorId));
      }
    }
    const referencedValidators = new Set(rules.flatMap((rule) => [...rule.validatorIds, ...rule.predicates.flatMap((predicate) => predicate.kind === "validator" ? [predicate.validatorId] : [])]));
    for (const validatorId of strings(options.requiredValidatorIds ?? [])) {
      if (!referencedValidators.has(validatorId)) add(`validator:${validatorId}`, { validatorId }, validatorCheck(validatorId));
    }
    for (const conflict of bundle.conflicts) add(conflict.ruleIds.join(","), conflict, check("violated", conflict.explanation, conflict.evidenceIds));
    const ordered = unique(findings);
    const status = ordered.some(item => item.status === "violated") ? "violated"
      : ordered.length === 0 || ordered.some(item => item.status === "unknown") ? "unknown" : "conformant";
    const boundary = strings([observation.unitEnumeration.method, ...observation.unitEnumeration.assumptions, ...observation.unitEnumeration.blindSpots,
      ...(enumeration === undefined ? [] : [enumeration.contract.method, ...enumeration.contract.assumptions, ...enumeration.contract.blindSpots])]);
    const observationHash = hashFramedDomain("governance-observation/v2", {
      subject: subject ?? null, enumeration: enumeration ?? null, outgoing,
      targets: [...targets].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([id,value]) => ({id,value:value ?? null})),
      unitEnumeration: observation.unitEnumeration,
      populations: [...populations].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([selector,value]) => ({selector,value:value ?? null})),
      validatorFindings: unique([...validatorObservation.values()]),
    });
    const result = { unitId: bundle.unitId, status, findings: ordered, boundary, observationHash } as const;
    return { ...result, contentHash: hashFramedDomain("governance-bundle-evaluation", result) };
  };
}
