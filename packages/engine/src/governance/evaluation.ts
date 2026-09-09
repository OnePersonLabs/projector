import {
  canonicalJson, hashFramedDomain, normalizeRepositoryRelativePath,
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
export function evaluateEffectiveRuleBundle(bundle: EffectiveRuleBundle, observation: GovernanceObservation): GovernanceBundleEvaluation {
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
  const normalized = {
    subjects: [...subjects.values()].sort((a, b) => a.id < b.id ? -1 : 1), dependencies,
    unitIds,
    unitEnumeration: observation.unitEnumeration,
    dependencyEnumerations: [...enumerations.values()].sort((a, b) => a.unitId < b.unitId ? -1 : 1),
  };
  const observationHash = hashFramedDomain("governance-observation", normalized);
  const subject = subjects.get(bundle.unitId);
  const enumeration = enumerations.get(bundle.unitId);
  const outgoing = dependencies.filter(edge => edge.fromUnitId === bundle.unitId);
  const suppressed = new Set(bundle.suppressedRules.map(({ ruleId }) => ruleId));
  const rules = bundle.rules.filter(rule => isHardRule(rule) && !suppressed.has(rule.id));
  const allowed = rules.filter(rule => rule.effect !== "forbid").flatMap(rule => rule.predicates)
    .filter((predicate): predicate is Extract<NormalizedPredicate, { kind: "dependency-allowed" }> => predicate.kind === "dependency-allowed");

  const evaluate = (predicate: NormalizedPredicate): Check => {
    if (subject === undefined) return check("unknown", "The governed unit is not present in the observation.");
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
        const target = edge.toSubjectId === undefined ? undefined : subjects.get(edge.toSubjectId);
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
      const selections = unitIds.map(id => matches(predicate.selector, subjects.get(id)!));
      const count = selections.filter(value => value === true).length;
      if (max !== undefined && count > max) return check("violated", `${count} observed members exceed maximum ${max}.`);
      if (!eligible(observation.unitEnumeration) || selections.includes(undefined)) return check("unknown", `Only ${count} members are known in an incomplete universe.`);
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
      if (!builtin) add(rule.id, { validatorId }, check("unknown", `Validator ${validatorId} has no registered evaluator for this rule.`));
    }
  }
  for (const conflict of bundle.conflicts) add(conflict.ruleIds.join(","), conflict, check("violated", conflict.explanation, conflict.evidenceIds));
  const ordered = unique(findings);
  const status = ordered.some(item => item.status === "violated") ? "violated"
    : ordered.length === 0 || ordered.some(item => item.status === "unknown") ? "unknown" : "conformant";
  const boundary = strings([observation.unitEnumeration.method, ...observation.unitEnumeration.assumptions, ...observation.unitEnumeration.blindSpots,
    ...(enumeration === undefined ? [] : [enumeration.contract.method, ...enumeration.contract.assumptions, ...enumeration.contract.blindSpots])]);
  const result = { unitId: bundle.unitId, status, findings: ordered, boundary, observationHash } as const;
  return { ...result, contentHash: hashFramedDomain("governance-bundle-evaluation", result) };
}
