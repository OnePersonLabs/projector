export type UpgradeComponentKind = "engine" | "schema" | "analyzer" | "signature-profile" | "representation-profile";
export interface UpgradeDeclaration {
  readonly kind: UpgradeComponentKind;
  readonly id: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly affectedDependencyKeys: readonly string[];
  readonly requiredAction: "none" | "reindex" | "revalidate" | "migrate";
}
const normalizeKeys = (keys: readonly string[]): string[] => [...new Set(keys)].sort();
const strictNonblank = z.string().min(1).refine((value) => value === value.trim(), "value must be trimmed");
export const UpgradeDeclarationSchema = z.strictObject({
  apiVersion: z.literal("projector.dev/upgrade-declaration/v1"),
  schemaVersion: z.literal("1"),
  kind: z.enum(["engine", "schema", "analyzer", "signature-profile", "representation-profile"]),
  id: strictNonblank, fromVersion: strictNonblank, toVersion: strictNonblank,
  affectedDependencyKeys: z.array(strictNonblank).transform(normalizeKeys),
  requiredAction: z.enum(["none", "reindex", "revalidate", "migrate"]),
});
export type SerializedUpgradeDeclaration = z.infer<typeof UpgradeDeclarationSchema>;
export const upgradeDeclarationHash = (declaration: SerializedUpgradeDeclaration): string => {
  const parsed = UpgradeDeclarationSchema.parse(declaration);
  return hashFramedDomain("upgrade-declaration:v1", { ...parsed, affectedDependencyKeys: normalizeKeys(parsed.affectedDependencyKeys) });
};
export interface UpgradeDependent { readonly id: string; readonly dependencyKeys: readonly string[]; readonly kind: "representation" | "context" | "capsule" | "derivation" | "canonical-source" }
export interface UpgradeDependencyRegistry {
  readonly knownDependencyKeys: readonly string[];
  readonly ownedDependencyKeys: Readonly<Record<string, { readonly kind: UpgradeComponentKind; readonly id: string }>>;
}

export function planUpgradeInvalidation(declaration: UpgradeDeclaration, dependents: readonly UpgradeDependent[], registry: UpgradeDependencyRegistry): {
  readonly invalidatedIds: string[]; readonly preservedCanonicalSourceIds: string[]; readonly requiredAction: UpgradeDeclaration["requiredAction"];
} {
  for (const value of [declaration.id, declaration.fromVersion, declaration.toVersion, ...declaration.affectedDependencyKeys]) {
    if (value.trim() === "" || value !== value.trim()) throw new TypeError("upgrade identities, versions, and dependency keys must be nonblank and trimmed");
  }
  if (declaration.fromVersion === declaration.toVersion) throw new TypeError("upgrade versions must differ");
  if (declaration.requiredAction === "none") throw new TypeError("semantic interpretation upgrade and profile upgrade require a non-none action");
  const keys = normalizeKeys(declaration.affectedDependencyKeys);
  if (keys.length === 0) throw new TypeError("upgrade must declare affected dependency keys");
  const known = new Set(normalizeKeys(registry.knownDependencyKeys));
  const unresolved = keys.filter((key) => !known.has(key));
  if (unresolved.length > 0) throw new TypeError(`affected dependency keys do not resolve in the known dependency registry: ${unresolved.join(", ")}`);
  const definitions = new Map<string, string>();
  for (const dependent of dependents) {
    if (dependent.id.trim() === "" || dependent.id !== dependent.id.trim()
      || dependent.dependencyKeys.some((key) => key.trim() === "" || key !== key.trim())) {
      throw new TypeError("dependent identities and dependency keys must be nonblank and trimmed");
    }
    const normalized = canonicalJson({ ...dependent, dependencyKeys: normalizeKeys(dependent.dependencyKeys) });
    const prior = definitions.get(dependent.id);
    if (prior !== undefined && prior !== normalized) throw new TypeError(`conflicting dependent identity: ${dependent.id}`);
    definitions.set(dependent.id, normalized);
  }
  const normalizedDependents = [...new Map(dependents.map((dependent) => [dependent.id, { ...dependent, dependencyKeys: normalizeKeys(dependent.dependencyKeys) }])).values()];
  for (const key of keys) {
    const owner = registry.ownedDependencyKeys?.[key];
    if (owner === undefined || owner.kind !== declaration.kind || owner.id !== declaration.id) {
      throw new TypeError(`affected dependency key does not belong to the declared upgrade target namespace or registry ownership: ${key}`);
    }
  }
  const affected = new Set(keys);
  const invalidated = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const dependent of normalizedDependents) {
      if (dependent.kind === "canonical-source" || invalidated.has(dependent.id)) continue;
      if (dependent.dependencyKeys.some((key) => affected.has(key))) {
        invalidated.add(dependent.id); affected.add(`${dependent.kind}:${dependent.id}`); changed = true;
      }
    }
  }
  if (invalidated.size === 0) throw new TypeError("semantic upgrade must produce a nonempty actual invalidation; vacuous dependency keys are not permitted");
  return {
    invalidatedIds: [...invalidated].sort(),
    preservedCanonicalSourceIds: normalizedDependents.filter(({ kind }) => kind === "canonical-source").map(({ id }) => id).sort(),
    requiredAction: declaration.requiredAction,
  };
}
import { canonicalJson, hashFramedDomain } from "@projector/core";
import { z } from "zod";
