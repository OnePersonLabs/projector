import { canonicalJson, hashFramedDomain, type IgnorePolicy, type ProjectionUnit, type SelectorExpr } from "@projector/core";
import { evaluateSelector, matchesCanonicalGlob, normalizeSelector, projectionUnitSelectorSubject } from "./selectors.js";

export type IgnoreConcern = keyof IgnorePolicy;
const CONCERNS: IgnoreConcern[] = ["inventory", "inferenceAuthority", "mutation", "reporting", "modelContext", "coverageDenominator"];
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export class IgnorePolicyConflictError extends Error {
  constructor(id: string) { super(`conflicting ignore rule identity: ${id}`); this.name = "IgnorePolicyConflictError"; }
}

export type IgnoreLayer = "repository" | "config" | "lens" | "rule";
export interface LayeredIgnoreRule {
  readonly id: string;
  readonly layer: IgnoreLayer;
  readonly concern: IgnoreConcern;
  readonly effect: "ignore" | "include";
  readonly selector: SelectorExpr;
  /** Explicit authority to remove a unit from every semantic role. */
  readonly authorizeAllRoles?: boolean;
}

const LAYER_RANK: Record<IgnoreLayer, number> = { repository: 0, config: 1, lens: 2, rule: 3 };
type Containment = "yes" | "no" | "unknown";
const same = (left: SelectorExpr, right: SelectorExpr): boolean => canonicalJson(left) === canonicalJson(right);
const includesValue = (values: readonly unknown[], value: unknown): boolean => values.some((item) => canonicalJson(item) === canonicalJson(value));

/** Proves set containment for the supported selector algebra. Unknown is deliberately never used as precedence. */
function selectorContainedBy(left: SelectorExpr, right: SelectorExpr): Containment {
  if (same(left, right)) return "yes";
  if (right.op === "all" && right.items.length === 0) return "yes";
  if (left.op === "any" && left.items.length === 0) return "yes";
  if (left.op === "not" || right.op === "not") return "unknown";
  if (right.op === "all") return right.items.every((item) => selectorContainedBy(left, item) === "yes") ? "yes" : "unknown";
  if (left.op === "any") return left.items.every((item) => selectorContainedBy(item, right) === "yes") ? "yes" : "unknown";
  if (right.op === "any") return right.items.some((item) => selectorContainedBy(left, item) === "yes") ? "yes" : "unknown";
  if (left.op === "all") return left.items.some((item) => selectorContainedBy(item, right) === "yes") ? "yes" : "unknown";
  if (left.op !== "atom" || right.op !== "atom" || left.field !== right.field) return "unknown";
  if (left.matcher === "equals" && right.matcher === "in" && Array.isArray(right.value)) return includesValue(right.value, left.value) ? "yes" : "no";
  if (left.matcher === "in" && right.matcher === "in" && Array.isArray(left.value) && Array.isArray(right.value)) {
    return left.value.every((value) => includesValue(right.value as readonly unknown[], value)) ? "yes" : "no";
  }
  if (left.matcher === "equals" && right.matcher === "glob" && typeof left.value === "string" && typeof right.value === "string") {
    return matchesCanonicalGlob(right.value, left.value) ? "yes" : "no";
  }
  return "unknown";
}

export function compileLayeredIgnorePolicy(input: { readonly units: readonly ProjectionUnit[]; readonly rules: readonly LayeredIgnoreRule[] }): {
  readonly byUnit: Record<string, Record<IgnoreConcern, boolean>>; readonly policyHash: string;
} {
  const definitions = new Map<string, string>();
  const rules = input.rules.map((rule) => ({ ...structuredClone(rule), selector: normalizeSelector(rule.selector) }));
  for (const rule of rules) {
    const serialized = canonicalJson(rule);
    const prior = definitions.get(rule.id);
    if (prior !== undefined && prior !== serialized) throw new IgnorePolicyConflictError(rule.id);
    definitions.set(rule.id, serialized);
  }
  const normalizedRules = [...new Map(rules.map((rule) => [canonicalJson(rule), rule])).values()]
    .sort((a, b) => compare(canonicalJson(a), canonicalJson(b)));
  const byUnit = Object.fromEntries([...input.units].sort((a, b) => compare(a.id, b.id)).map((unit) => {
    const subject = projectionUnitSelectorSubject(unit);
    const winners = new Map<IgnoreConcern, LayeredIgnoreRule[]>();
    for (const concern of CONCERNS) {
      const matching = normalizedRules.filter((rule) => rule.concern === concern && evaluateSelector(rule.selector, subject).matched);
      const highest = matching.reduce((rank, rule) => Math.max(rank, LAYER_RANK[rule.layer]), -1);
      const layerWinners = matching.filter((rule) => LAYER_RANK[rule.layer] === highest);
      const atHighest = layerWinners.filter((candidate) => !layerWinners.some((other) => other !== candidate
        && selectorContainedBy(other.selector, candidate.selector) === "yes"
        && selectorContainedBy(candidate.selector, other.selector) !== "yes"));
      if (new Set(atHighest.map(({ effect }) => effect)).size > 1) {
        throw new IgnorePolicyConflictError(`conflicting layered ignore for ${unit.id}:${concern}`);
      }
      winners.set(concern, atHighest);
    }
    const decision = Object.fromEntries(CONCERNS.map((concern) => [concern, winners.get(concern)?.[0]?.effect === "ignore"])) as Record<IgnoreConcern, boolean>;
    if (CONCERNS.every((concern) => decision[concern])
      && !CONCERNS.every((concern) => winners.get(concern)?.some(({ authorizeAllRoles }) => authorizeAllRoles === true))) {
      throw new IgnorePolicyConflictError(`ignore rules erase all semantic roles for ${unit.id} without explicit authorization`);
    }
    return [unit.id, decision];
  })) as Record<string, Record<IgnoreConcern, boolean>>;
  return { byUnit, policyHash: hashFramedDomain("layered-ignore-policy:v2", normalizedRules) };
}

export function compileIgnorePolicy(input: { policy: IgnorePolicy; units: readonly ProjectionUnit[]; ruleIds?: Partial<Record<IgnoreConcern, readonly string[]>> }): {
  readonly byUnit: Record<string, Record<IgnoreConcern, boolean>>; readonly policyHash: string;
} {
  const normalized = Object.fromEntries(CONCERNS.map((concern) => {
    const selectors = input.policy[concern].map(normalizeSelector);
    const ids = input.ruleIds?.[concern];
    if (ids !== undefined) {
      const definitions = new Map<string, string>();
      selectors.forEach((selector, index) => {
        const id = ids[index];
        if (id === undefined) throw new TypeError(`missing ignore rule identity for ${concern}`);
        const prior = definitions.get(id);
        const serialized = canonicalJson(selector);
        if (prior !== undefined && prior !== serialized) throw new IgnorePolicyConflictError(id);
        definitions.set(id, serialized);
      });
    }
    return [concern, [...new Map(selectors.map((selector) => [canonicalJson(selector), selector])).values()]
      .sort((a, b) => compare(canonicalJson(a), canonicalJson(b)))];
  })) as unknown as IgnorePolicy;
  const byUnit = Object.fromEntries([...input.units].sort((a, b) => compare(a.id, b.id)).map((unit) => {
    const subject = projectionUnitSelectorSubject(unit);
    return [unit.id, Object.fromEntries(CONCERNS.map((concern) => [concern,
      normalized[concern].some((selector: SelectorExpr) => evaluateSelector(selector, subject).matched)]))];
  })) as Record<string, Record<IgnoreConcern, boolean>>;
  return { byUnit, policyHash: hashFramedDomain("layered-ignore-policy", normalized) };
}
