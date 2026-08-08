import { canonicalJson, hashFramedDomain, type IgnorePolicy, type ProjectionUnit, type SelectorExpr } from "@projector/core";
import { evaluateSelector, normalizeSelector, projectionUnitSelectorSubject } from "./selectors.js";

export type IgnoreConcern = keyof IgnorePolicy;
const CONCERNS: IgnoreConcern[] = ["inventory", "inferenceAuthority", "mutation", "reporting", "modelContext", "coverageDenominator"];
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export class IgnorePolicyConflictError extends Error {
  constructor(id: string) { super(`conflicting ignore rule identity: ${id}`); this.name = "IgnorePolicyConflictError"; }
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
