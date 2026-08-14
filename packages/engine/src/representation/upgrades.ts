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
export interface UpgradeDependent {
  readonly id: string;
  readonly dependencyKeys: readonly string[];
  /** Canonical entities are authority; canonical-source rows are derivation proofs about that authority. */
  readonly kind: "representation" | "context" | "capsule" | "derivation" | "canonical-source" | "canonical-entity";
}
export interface UpgradeDependencyRegistry {
  readonly knownDependencyKeys: readonly string[];
  readonly ownedDependencyKeys: Readonly<Record<string, { readonly kind: UpgradeComponentKind; readonly id: string }>>;
  /** Complete reverse dependency enumeration for every registered dependency key. */
  readonly directDependentIdsByDependencyKey: Readonly<Record<string, readonly string[]>>;
}
export interface UpgradeInvalidationPlan {
  readonly invalidatedIds: string[];
  readonly preservedCanonicalEntityIds: string[];
  readonly requiredAction: UpgradeDeclaration["requiredAction"];
}

export function planUpgradeInvalidation(declaration: UpgradeDeclaration, dependents: readonly UpgradeDependent[], registry: UpgradeDependencyRegistry): {
  readonly invalidatedIds: string[]; readonly preservedCanonicalEntityIds: string[]; readonly requiredAction: UpgradeDeclaration["requiredAction"];
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
  const targetKeys = Object.entries(registry.ownedDependencyKeys)
    .filter(([, owner]) => owner.kind === declaration.kind && owner.id === declaration.id)
    .map(([key]) => key).sort();
  if (targetKeys.length === 0 || canonicalJson(keys) !== canonicalJson(targetKeys)) {
    throw new TypeError("affected dependency keys must exactly enumerate the complete target-owned dependency key set");
  }
  const dependentsById = new Map(normalizedDependents.map((dependent) => [dependent.id, dependent]));
  const unregisteredDependentKeys = normalizeKeys(normalizedDependents.flatMap(({ dependencyKeys }) => dependencyKeys)).filter((key) => !known.has(key));
  if (unregisteredDependentKeys.length > 0) {
    throw new TypeError(`dependency registry coverage is missing dependency keys: ${unregisteredDependentKeys.join(", ")}`);
  }
  for (const key of known) {
    const registered = registry.directDependentIdsByDependencyKey[key];
    if (registered === undefined) throw new TypeError(`dependency registry coverage is missing direct dependents for ${key}`);
    const actual = normalizedDependents.filter((dependent) => dependent.dependencyKeys.includes(key)).map(({ id }) => id).sort();
    const declared = normalizeKeys(registered);
    if (declared.length !== registered.length || canonicalJson(declared) !== canonicalJson(actual)) {
      throw new TypeError(`dependency registry coverage disagrees with direct dependents for ${key}`);
    }
    if (declared.some((id) => !dependentsById.has(id))) throw new TypeError(`dependency registry names a missing direct dependent for ${key}`);
  }
  const affected = new Set(targetKeys);
  const invalidated = new Set<string>();
  const pending = [...targetKeys];
  while (pending.length > 0) {
    const dependencyKey = pending.shift()!;
    for (const id of registry.directDependentIdsByDependencyKey[dependencyKey] ?? []) {
      const dependent = dependentsById.get(id)!;
      if (dependent.kind === "canonical-entity" || invalidated.has(id)) continue;
      invalidated.add(id);
      const producedKey = `${dependent.kind}:${dependent.id}`;
      if (known.has(producedKey) && !affected.has(producedKey)) {
        affected.add(producedKey);
        pending.push(producedKey);
      }
    }
  }
  if (invalidated.size === 0) throw new TypeError("semantic upgrade must produce a nonempty actual invalidation; vacuous dependency keys are not permitted");
  return {
    invalidatedIds: [...invalidated].sort(),
    preservedCanonicalEntityIds: normalizedDependents.filter(({ kind }) => kind === "canonical-entity").map(({ id }) => id).sort(),
    requiredAction: declaration.requiredAction,
  };
}

export async function reconcileRepresentationProfileUpgrade(plan: UpgradeInvalidationPlan, ports: {
  readonly invalidate: (ids: readonly string[]) => Promise<void>;
  readonly refresh: (id: string) => Promise<string>;
}): Promise<{
  readonly status: "reconciled";
  readonly invalidatedIds: readonly string[];
  readonly refreshedIds: readonly string[];
  readonly refreshed: Readonly<Record<string, string>>;
  readonly preservedCanonicalEntityIds: readonly string[];
  readonly receiptHash: string;
}> {
  const invalidatedIds = normalizeKeys(plan.invalidatedIds);
  const preservedCanonicalEntityIds = normalizeKeys(plan.preservedCanonicalEntityIds);
  if (invalidatedIds.length === 0) throw new TypeError("representation reconciliation requires nonempty invalidation");
  if (invalidatedIds.some((id) => preservedCanonicalEntityIds.includes(id))) throw new TypeError("canonical authority cannot be invalidated during representation reconciliation");
  await ports.invalidate(invalidatedIds);
  const refreshedEntries: Array<readonly [string, string]> = [];
  for (const id of invalidatedIds) {
    const contentHash = await ports.refresh(id);
    if (!/^sha256:v1:[a-f0-9]{64}$/u.test(contentHash)) throw new TypeError(`refreshed representation dependent ${id} is unauthenticated`);
    refreshedEntries.push([id, contentHash]);
  }
  const refreshed = Object.fromEntries(refreshedEntries);
  const body = { invalidatedIds, refreshed, preservedCanonicalEntityIds, requiredAction: plan.requiredAction };
  return { status: "reconciled", ...body, refreshedIds: Object.keys(refreshed).sort(), receiptHash: hashFramedDomain("representation-upgrade-reconciliation", body) };
}
import { canonicalJson, hashFramedDomain } from "@projector/core";
import { z } from "zod";
