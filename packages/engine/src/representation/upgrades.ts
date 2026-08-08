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
export const UpgradeDeclarationSchema = z.strictObject({
  apiVersion: z.literal("projector.dev/upgrade-declaration/v1"),
  schemaVersion: z.literal("1"),
  kind: z.enum(["engine", "schema", "analyzer", "signature-profile", "representation-profile"]),
  id: z.string().min(1), fromVersion: z.string().min(1), toVersion: z.string().min(1),
  affectedDependencyKeys: z.array(z.string().min(1)).transform(normalizeKeys),
  requiredAction: z.enum(["none", "reindex", "revalidate", "migrate"]),
});
export type SerializedUpgradeDeclaration = z.infer<typeof UpgradeDeclarationSchema>;
export const upgradeDeclarationHash = (declaration: SerializedUpgradeDeclaration): string => {
  const parsed = UpgradeDeclarationSchema.parse(declaration);
  return hashFramedDomain("upgrade-declaration:v1", { ...parsed, affectedDependencyKeys: normalizeKeys(parsed.affectedDependencyKeys) });
};
export interface UpgradeDependent { readonly id: string; readonly dependencyKeys: readonly string[]; readonly kind: "representation" | "context" | "capsule" | "derivation" | "canonical-source" }

export function planUpgradeInvalidation(declaration: UpgradeDeclaration, dependents: readonly UpgradeDependent[]): {
  readonly invalidatedIds: string[]; readonly preservedCanonicalSourceIds: string[]; readonly requiredAction: UpgradeDeclaration["requiredAction"];
} {
  if (declaration.fromVersion === declaration.toVersion) throw new TypeError("upgrade versions must differ");
  if (declaration.requiredAction === "none") throw new TypeError("semantic interpretation upgrade and profile upgrade require a non-none action");
  const keys = normalizeKeys(declaration.affectedDependencyKeys);
  if (keys.length === 0) throw new TypeError("upgrade must declare affected dependency keys");
  const definitions = new Map<string, string>();
  for (const dependent of dependents) {
    const normalized = canonicalJson({ ...dependent, dependencyKeys: normalizeKeys(dependent.dependencyKeys) });
    const prior = definitions.get(dependent.id);
    if (prior !== undefined && prior !== normalized) throw new TypeError(`conflicting dependent identity: ${dependent.id}`);
    definitions.set(dependent.id, normalized);
  }
  const normalizedDependents = [...new Map(dependents.map((dependent) => [dependent.id, { ...dependent, dependencyKeys: normalizeKeys(dependent.dependencyKeys) }])).values()];
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
  return {
    invalidatedIds: [...invalidated].sort(),
    preservedCanonicalSourceIds: normalizedDependents.filter(({ kind }) => kind === "canonical-source").map(({ id }) => id).sort(),
    requiredAction: declaration.requiredAction,
  };
}
import { canonicalJson, hashFramedDomain } from "@projector/core";
import { z } from "zod";
