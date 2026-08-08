import { describe, expect, it } from "vitest";
import { UpgradeDeclarationSchema, planUpgradeInvalidation, upgradeDeclarationHash } from "./upgrades.js";

describe("representation and semantic upgrade protocol", () => {
  it("invalidates only dependents of a changed representation profile", () => {
    const result = planUpgradeInvalidation({ kind: "representation-profile", id: "profile:agent-compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["representation-profile:profile:agent-compact"], requiredAction: "revalidate" }, [
      { id: "projection:agent", dependencyKeys: ["representation-profile:profile:agent-compact"], kind: "representation" },
      { id: "capsule:agent", dependencyKeys: ["representation:projection:agent"], kind: "capsule" },
      { id: "projection:human", dependencyKeys: ["representation-profile:profile:human-technical"], kind: "representation" },
      { id: "source:rule", dependencyKeys: [], kind: "canonical-source" },
    ], { knownDependencyKeys: ["representation-profile:profile:agent-compact", "representation-profile:profile:human-technical"] });
    expect(result.invalidatedIds).toEqual(["capsule:agent", "projection:agent"]);
    expect(result.preservedCanonicalSourceIds).toEqual(["source:rule"]);
  });

  it("requires explicit reindex or revalidation for semantic interpretation changes", () => {
    expect(() => planUpgradeInvalidation({ kind: "analyzer", id: "typescript", fromVersion: "1", toVersion: "2", affectedDependencyKeys: [], requiredAction: "none" }, [], { knownDependencyKeys: [] })).toThrow(/semantic interpretation upgrade/u);
  });

  it("parses implementation upgrade declarations through a strict versioned schema", () => {
    const declaration = { apiVersion: "projector.dev/upgrade-declaration/v1", schemaVersion: "1", kind: "engine", id: "projector", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["engine:projector"], requiredAction: "migrate" };
    expect(UpgradeDeclarationSchema.parse(declaration)).toEqual(declaration);
    expect(() => UpgradeDeclarationSchema.parse({ ...declaration, undeclared: true })).toThrow();
  });

  it("requires profile changes to name dependencies and invalidate old proof", () => {
    expect(() => planUpgradeInvalidation({ kind: "representation-profile", id: "compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: [], requiredAction: "none" }, [], { knownDependencyKeys: [] }))
      .toThrow(/affected dependency|action/u);
  });

  it("canonicalizes dependency keys before hashing declarations", () => {
    const base = { apiVersion: "projector.dev/upgrade-declaration/v1" as const, schemaVersion: "1" as const, kind: "engine" as const, id: "projector", fromVersion: "1", toVersion: "2", requiredAction: "migrate" as const };
    expect(upgradeDeclarationHash({ ...base, affectedDependencyKeys: ["b", "a", "a"] }))
      .toBe(upgradeDeclarationHash({ ...base, affectedDependencyKeys: ["a", "b"] }));
  });

  it("rejects conflicting duplicate dependent identities", () => {
    expect(() => planUpgradeInvalidation({ kind: "representation-profile", id: "compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["profile:compact"], requiredAction: "revalidate" }, [
      { id: "same", kind: "canonical-source", dependencyKeys: [] },
      { id: "same", kind: "representation", dependencyKeys: ["profile:compact"] },
    ], { knownDependencyKeys: ["profile:compact"] })).toThrow(/conflicting dependent/u);
  });

  it("resolves affected keys against the known graph and rejects misspelled or vacuous invalidation", () => {
    const declaration = { kind: "representation-profile" as const, id: "compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["profile:compact"], requiredAction: "revalidate" as const };
    expect(() => planUpgradeInvalidation({ ...declaration, affectedDependencyKeys: ["profile:comapct"] }, [
      { id: "projection:compact", kind: "representation", dependencyKeys: ["profile:compact"] },
    ], { knownDependencyKeys: ["profile:compact"] })).toThrow(/unknown.*dependency|resolve/u);
    expect(() => planUpgradeInvalidation(declaration, [
      { id: "projection:other", kind: "representation", dependencyKeys: ["profile:other"] },
    ], { knownDependencyKeys: ["profile:compact", "profile:other"] })).toThrow(/nonempty|invalidation|vacuous/u);
  });
});
