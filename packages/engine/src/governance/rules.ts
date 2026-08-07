import {
  canonicalJson,
  hashFramedDomain,
  type EffectiveRuleBundle,
  type NormalizedPredicate,
  type ProjectionUnit,
  type Rule,
  type RuleConflict,
  type SelectorExpr,
} from "@projector/core";

import { authorityRank } from "../authority/index.js";
import {
  evaluateSelector,
  normalizeSelector,
  projectionUnitSelectorSubject,
  type ProjectionUnitSelectorFacts,
} from "./selectors.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export class RuleCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleCompilationError";
  }
}

export class GovernanceConflictError extends Error {
  readonly bundle: EffectiveRuleBundle;

  constructor(bundle: EffectiveRuleBundle) {
    super(`governance compilation for unit ${bundle.unitId} has ${bundle.conflicts.length} blocking conflict(s)`);
    this.name = "GovernanceConflictError";
    this.bundle = structuredClone(bundle);
  }
}

export function isHardRule(rule: Rule): boolean {
  return rule.effect === "require"
    || rule.effect === "forbid"
    || rule.effect === "restrict"
    || rule.effect === "grant"
    || (rule.effect === "validate" && (rule.predicates.length > 0 || rule.validatorIds.length > 0));
}

function selectorSpecificity(selector: SelectorExpr): [number, number, number] {
  let atoms = 0;
  let exact = 0;
  let negations = 0;
  const visit = (expression: SelectorExpr): void => {
    if (expression.op === "all" || expression.op === "any") expression.items.forEach(visit);
    else if (expression.op === "not") {
      negations += 1;
      visit(expression.item);
    } else {
      atoms += 1;
      if (expression.matcher === "equals" || expression.matcher === "in" || expression.matcher === "exists") exact += 1;
    }
  };
  visit(normalizeSelector(selector));
  return [exact, atoms, negations];
}

function compareSpecificity(left: Rule, right: Rule): number {
  const leftTuple = [...selectorSpecificity(left.selector), left.predicates.length];
  const rightTuple = [...selectorSpecificity(right.selector), right.predicates.length];
  for (let index = 0; index < leftTuple.length; index += 1) {
    const difference = rightTuple[index]! - leftTuple[index]!;
    if (difference !== 0) return difference;
  }
  return compareStrings(left.id, right.id);
}

export function compareRules(left: Rule, right: Rule): number {
  const authorityDifference = authorityRank(left.authorityClass) - authorityRank(right.authorityClass);
  return authorityDifference !== 0 ? authorityDifference : compareSpecificity(left, right);
}

function validateHardRule(rule: Rule): void {
  if (!isHardRule(rule)) return;
  if (rule.predicates.length === 0 && rule.validatorIds.length === 0) {
    throw new RuleCompilationError(`blocking rule ${rule.id} has no normalized predicate or validator`);
  }
  if (rule.effect === "grant" && rule.predicates.some((predicate) => predicate.kind !== "permission")) {
    throw new RuleCompilationError(`grant rule ${rule.id} may only contain permission predicates`);
  }
}

function normalizePredicate(predicate: NormalizedPredicate): NormalizedPredicate {
  const cloned = structuredClone(predicate);
  if (cloned.kind === "relation-required" || cloned.kind === "relation-forbidden") {
    return { ...cloned, targetSelector: normalizeSelector(cloned.targetSelector) };
  }
  if (cloned.kind === "cardinality") return { ...cloned, selector: normalizeSelector(cloned.selector) };
  if (cloned.kind === "dependency-allowed" || cloned.kind === "dependency-forbidden") {
    return { ...cloned, from: normalizeSelector(cloned.from), to: normalizeSelector(cloned.to) };
  }
  return cloned;
}

function normalizeRule(rule: Rule): Rule {
  const cloned = structuredClone(rule);
  return {
    ...cloned,
    selector: normalizeSelector(cloned.selector),
    predicates: cloned.predicates.map(normalizePredicate),
    transformIds: sortedUnique(cloned.transformIds),
  };
}

interface PredicateConflict {
  kind: RuleConflict["kind"];
  explanation: string;
}

function sameSelector(left: SelectorExpr, right: SelectorExpr): boolean {
  return canonicalJson(normalizeSelector(left)) === canonicalJson(normalizeSelector(right));
}

function conflictBetweenPredicates(left: NormalizedPredicate, right: NormalizedPredicate): PredicateConflict | undefined {
  if (left.kind === "permission" && right.kind === "permission"
      && left.operation === right.operation && left.allowed !== right.allowed) {
    return { kind: "incompatible-predicate", explanation: `permission ${left.operation} is both allowed and denied` };
  }
  if (left.kind === "path-under" && right.kind === "path-not-under" && left.root === right.root
      || left.kind === "path-not-under" && right.kind === "path-under" && left.root === right.root) {
    return { kind: "incompatible-predicate", explanation: `path is both required under and forbidden under ${left.root}` };
  }
  if (left.kind === "relation-required" && right.kind === "relation-forbidden"
      && left.relation === right.relation && sameSelector(left.targetSelector, right.targetSelector)
      || left.kind === "relation-forbidden" && right.kind === "relation-required"
      && left.relation === right.relation && sameSelector(left.targetSelector, right.targetSelector)) {
    return { kind: "incompatible-predicate", explanation: `relation ${left.relation} is both required and forbidden` };
  }
  if (left.kind === "dependency-allowed" && right.kind === "dependency-forbidden"
      && sameSelector(left.from, right.from) && sameSelector(left.to, right.to)
      || left.kind === "dependency-forbidden" && right.kind === "dependency-allowed"
      && sameSelector(left.from, right.from) && sameSelector(left.to, right.to)) {
    return { kind: "incompatible-predicate", explanation: "the same dependency is both allowed and forbidden" };
  }
  if (left.kind === "unit-state" && right.kind === "unit-state" && left.state !== right.state) {
    return { kind: "incompatible-predicate", explanation: `unit state cannot be both ${left.state} and ${right.state}` };
  }
  if (left.kind === "cardinality" && right.kind === "cardinality" && sameSelector(left.selector, right.selector)) {
    const leftMin = left.min ?? 0;
    const rightMin = right.min ?? 0;
    const leftMax = left.max ?? Number.POSITIVE_INFINITY;
    const rightMax = right.max ?? Number.POSITIVE_INFINITY;
    if (Math.max(leftMin, rightMin) > Math.min(leftMax, rightMax)) {
      return { kind: "incompatible-predicate", explanation: "cardinality ranges do not overlap" };
    }
  }
  return undefined;
}

function rulePairConflict(left: Rule, right: Rule): PredicateConflict | undefined {
  for (const leftPredicate of left.predicates) {
    for (const rightPredicate of right.predicates) {
      const conflict = conflictBetweenPredicates(leftPredicate, rightPredicate);
      if (conflict !== undefined) return conflict;
      if (canonicalJson(leftPredicate) === canonicalJson(rightPredicate)
          && ((left.effect === "require" && right.effect === "forbid")
            || (left.effect === "forbid" && right.effect === "require"))) {
        return { kind: "require-forbid", explanation: "the same normalized state is both required and forbidden" };
      }
    }
  }
  if (left.effect === "transform" && right.effect === "transform"
      && canonicalJson(left.transformIds) !== canonicalJson(right.transformIds)) {
    return { kind: "exclusive-transform", explanation: "exclusive transforms claim the same unit" };
  }
  return undefined;
}

function evidenceIds(left: Rule, right: Rule): string[] {
  return [...new Set([...left.evidence, ...right.evidence].map(({ evidenceId }) => evidenceId))].sort(compareStrings);
}

export interface CompileEffectiveRuleBundleInput {
  unit: ProjectionUnit;
  operation: string;
  rules: readonly Rule[];
  selectorFacts?: ProjectionUnitSelectorFacts;
}

export function compileEffectiveRuleBundle(input: CompileEffectiveRuleBundleInput): EffectiveRuleBundle {
  const facts: ProjectionUnitSelectorFacts = { ...input.selectorFacts, operation: input.operation };
  const subject = projectionUnitSelectorSubject(input.unit, facts);
  const selected = input.rules
    .map(normalizeRule)
    .filter((rule) => evaluateSelector(rule.selector, subject).matched)
    .sort(compareRules);
  selected.forEach(validateHardRule);

  const suppressed = new Map<string, { ruleId: string; reason: string; supersededBy?: string }>();
  const conflicts: RuleConflict[] = [];
  for (let leftIndex = 0; leftIndex < selected.length; leftIndex += 1) {
    const left = selected[leftIndex]!;
    if (!isHardRule(left) && left.effect !== "transform") continue;
    for (let rightIndex = leftIndex + 1; rightIndex < selected.length; rightIndex += 1) {
      const right = selected[rightIndex]!;
      if (!isHardRule(right) && right.effect !== "transform") continue;
      const predicateConflict = rulePairConflict(left, right);
      if (predicateConflict === undefined) continue;
      const leftRank = authorityRank(left.authorityClass);
      const rightRank = authorityRank(right.authorityClass);
      if (leftRank < rightRank && right.conflictPolicy === "higher-authority") {
        suppressed.set(right.id, { ruleId: right.id, reason: "suppressed by explicitly configured higher authority", supersededBy: left.id });
        continue;
      }
      conflicts.push({
        ruleIds: [left.id, right.id].sort(compareStrings),
        unitId: input.unit.id,
        kind: leftRank === rightRank ? predicateConflict.kind : "authority-override",
        explanation: leftRank === rightRank
          ? predicateConflict.explanation
          : `${right.id} (${right.authorityClass}) attempts to override ${left.id} (${left.authorityClass})`,
        evidenceIds: evidenceIds(left, right),
      });
    }
  }

  const unsuppressedHardRules = selected.filter((rule) => isHardRule(rule) && !suppressed.has(rule.id));
  const predicatesByKey = new Map<string, NormalizedPredicate>();
  for (const rule of unsuppressedHardRules) {
    for (const predicate of rule.predicates) predicatesByKey.set(canonicalJson(predicate), structuredClone(predicate));
  }
  const predicates = [...predicatesByKey.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, predicate]) => predicate);
  const evaluations = selected.map((rule) => ({
    ruleId: rule.id,
    selectorHash: hashFramedDomain("selector", normalizeSelector(rule.selector)),
    inputFingerprint: evaluateSelector(rule.selector, subject).inputFingerprint,
  }));
  const dependencyFingerprint = hashFramedDomain("effective-rule-dependencies", {
    unitId: input.unit.id,
    operation: input.operation,
    unitMembershipHash: input.unit.membershipHash,
    evaluations,
  });
  const normalizedConflicts = [...new Map(conflicts.map((conflict) => [canonicalJson(conflict), conflict])).entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, conflict]) => conflict);
  const suppressedRules = [...suppressed.values()].sort((left, right) => compareStrings(left.ruleId, right.ruleId));
  const bundleWithoutHash = {
    unitId: input.unit.id,
    operation: input.operation,
    rules: selected,
    suppressedRules,
    predicates,
    conflicts: normalizedConflicts,
    dependencyFingerprint,
  };
  return {
    ...bundleWithoutHash,
    bundleHash: hashFramedDomain("effective-rule-bundle", bundleWithoutHash),
  };
}

export function assertGovernable(bundle: EffectiveRuleBundle): EffectiveRuleBundle {
  if (bundle.conflicts.length > 0) throw new GovernanceConflictError(bundle);
  return bundle;
}
