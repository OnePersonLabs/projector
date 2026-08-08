import { describe, expect, it } from "vitest";
import { UpgradeDeclarationSchema, planUpgradeInvalidation } from "./upgrades.js";

describe("representation and semantic upgrade protocol", () => {
  it("invalidates only dependents of a changed representation profile", () => {
    const result = planUpgradeInvalidation({ kind: "representation-profile", id: "profile:agent-compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["representation-profile:profile:agent-compact"], requiredAction: "revalidate" }, [
      { id: "projection:agent", dependencyKeys: ["representation-profile:profile:agent-compact"], kind: "representation" },
      { id: "capsule:agent", dependencyKeys: ["representation:projection:agent"], kind: "capsule" },
      { id: "projection:human", dependencyKeys: ["representation-profile:profile:human-technical"], kind: "representation" },
      { id: "source:rule", dependencyKeys: [], kind: "canonical-source" },
    ]);
    expect(result.invalidatedIds).toEqual(["capsule:agent", "projection:agent"]);
    expect(result.preservedCanonicalSourceIds).toEqual(["source:rule"]);
  });

  it("requires explicit reindex or revalidation for semantic interpretation changes", () => {
    expect(() => planUpgradeInvalidation({ kind: "analyzer", id: "typescript", fromVersion: "1", toVersion: "2", affectedDependencyKeys: [], requiredAction: "none" }, [])).toThrow(/semantic interpretation upgrade/u);
  });

  it("parses implementation upgrade declarations through a strict versioned schema", () => {
    const declaration = { apiVersion: "projector.dev/upgrade-declaration/v1", schemaVersion: "1", kind: "engine", id: "projector", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["engine:projector"], requiredAction: "migrate" };
    expect(UpgradeDeclarationSchema.parse(declaration)).toEqual(declaration);
    expect(() => UpgradeDeclarationSchema.parse({ ...declaration, undeclared: true })).toThrow();
  });
});
