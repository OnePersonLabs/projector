import { describe, expect, it } from "vitest";
import { hashFramedDomain } from "@projector/core";
import { UpgradeDeclarationSchema, planUpgradeInvalidation, reconcileRepresentationProfileUpgrade, upgradeDeclarationHash } from "./upgrades.js";

describe("representation and semantic upgrade protocol", () => {
  it("invalidates only dependents of a changed representation profile", () => {
    const result = planUpgradeInvalidation({ kind: "representation-profile", id: "profile:agent-compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["representation-profile:profile:agent-compact"], requiredAction: "revalidate" }, [
      { id: "projection:agent", dependencyKeys: ["representation-profile:profile:agent-compact"], kind: "representation" },
      { id: "capsule:agent", dependencyKeys: ["representation:projection:agent"], kind: "capsule" },
      { id: "projection:human", dependencyKeys: ["representation-profile:profile:human-technical"], kind: "representation" },
      { id: "source:rule", dependencyKeys: [], kind: "canonical-entity" },
    ], {
      knownDependencyKeys: ["representation-profile:profile:agent-compact", "representation-profile:profile:human-technical", "representation:projection:agent"],
      ownedDependencyKeys: { "representation-profile:profile:agent-compact": { kind: "representation-profile", id: "profile:agent-compact" }, "representation-profile:profile:human-technical": { kind: "representation-profile", id: "profile:human-technical" } },
      directDependentIdsByDependencyKey: {
        "representation-profile:profile:agent-compact": ["projection:agent"],
        "representation-profile:profile:human-technical": ["projection:human"],
        "representation:projection:agent": ["capsule:agent"],
      },
    });
    expect(result.invalidatedIds).toEqual(["capsule:agent", "projection:agent"]);
    expect(result.preservedCanonicalEntityIds).toEqual(["source:rule"]);
  });

  it("requires explicit reindex or revalidation for semantic interpretation changes", () => {
    expect(() => planUpgradeInvalidation({ kind: "analyzer", id: "typescript", fromVersion: "1", toVersion: "2", affectedDependencyKeys: [], requiredAction: "none" }, [], { knownDependencyKeys: [], ownedDependencyKeys: {}, directDependentIdsByDependencyKey: {} })).toThrow(/semantic interpretation upgrade/u);
  });

  it("parses implementation upgrade declarations through a strict versioned schema", () => {
    const declaration = { apiVersion: "projector.dev/upgrade-declaration/v1", schemaVersion: "1", kind: "engine", id: "projector", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["engine:projector"], requiredAction: "migrate" };
    expect(UpgradeDeclarationSchema.parse(declaration)).toEqual(declaration);
    expect(() => UpgradeDeclarationSchema.parse({ ...declaration, undeclared: true })).toThrow();
  });

  it("requires profile changes to name dependencies and invalidate old proof", () => {
    expect(() => planUpgradeInvalidation({ kind: "representation-profile", id: "compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: [], requiredAction: "none" }, [], { knownDependencyKeys: [], ownedDependencyKeys: {}, directDependentIdsByDependencyKey: {} }))
      .toThrow(/affected dependency|action/u);
  });

  it("canonicalizes dependency keys before hashing declarations", () => {
    const base = { apiVersion: "projector.dev/upgrade-declaration/v1" as const, schemaVersion: "1" as const, kind: "engine" as const, id: "projector", fromVersion: "1", toVersion: "2", requiredAction: "migrate" as const };
    expect(upgradeDeclarationHash({ ...base, affectedDependencyKeys: ["b", "a", "a"] }))
      .toBe(upgradeDeclarationHash({ ...base, affectedDependencyKeys: ["a", "b"] }));
  });

  it("rejects conflicting duplicate dependent identities", () => {
    expect(() => planUpgradeInvalidation({ kind: "representation-profile", id: "compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["profile:compact"], requiredAction: "revalidate" }, [
      { id: "same", kind: "canonical-entity", dependencyKeys: [] },
      { id: "same", kind: "representation", dependencyKeys: ["profile:compact"] },
    ], { knownDependencyKeys: ["profile:compact"], ownedDependencyKeys: { "profile:compact": { kind: "representation-profile", id: "compact" } }, directDependentIdsByDependencyKey: { "profile:compact": ["same"] } })).toThrow(/conflicting dependent/u);
  });

  it("resolves affected keys against the known graph and rejects misspelled or vacuous invalidation", () => {
    const declaration = { kind: "representation-profile" as const, id: "compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["profile:compact"], requiredAction: "revalidate" as const };
    expect(() => planUpgradeInvalidation({ ...declaration, affectedDependencyKeys: ["profile:comapct"] }, [
      { id: "projection:compact", kind: "representation", dependencyKeys: ["profile:compact"] },
    ], { knownDependencyKeys: ["profile:compact"], ownedDependencyKeys: { "profile:compact": { kind: "representation-profile", id: "compact" } }, directDependentIdsByDependencyKey: { "profile:compact": ["projection:compact"] } })).toThrow(/unknown.*dependency|resolve/u);
    expect(() => planUpgradeInvalidation(declaration, [
      { id: "projection:other", kind: "representation", dependencyKeys: ["profile:other"] },
    ], { knownDependencyKeys: ["profile:compact", "profile:other"], ownedDependencyKeys: { "profile:compact": { kind: "representation-profile", id: "compact" } }, directDependentIdsByDependencyKey: { "profile:compact": [], "profile:other": ["projection:other"] } })).toThrow(/nonempty|invalidation|vacuous/u);
  });

  it("requires trimmed identities and keys owned by the declared upgrade target", () => {
    const registry = {
      knownDependencyKeys: ["representation-profile:profile:compact", "representation-profile:profile:other"],
      ownedDependencyKeys: {
        "representation-profile:profile:compact": { kind: "representation-profile" as const, id: "compact" },
        "representation-profile:profile:other": { kind: "representation-profile" as const, id: "other" },
      },
      directDependentIdsByDependencyKey: {
        "representation-profile:profile:compact": [],
        "representation-profile:profile:other": ["projection:other"],
      },
    };
    const declaration = { kind: "representation-profile" as const, id: "compact", fromVersion: "1", toVersion: "2", affectedDependencyKeys: ["representation-profile:profile:other"], requiredAction: "revalidate" as const };
    expect(() => planUpgradeInvalidation(declaration, [{ id: "projection:other", kind: "representation", dependencyKeys: ["representation-profile:profile:other"] }], registry))
      .toThrow(/ownership|target|namespace/u);
    expect(() => UpgradeDeclarationSchema.parse({ apiVersion: "projector.dev/upgrade-declaration/v1", schemaVersion: "1", ...declaration, id: " compact " }))
      .toThrow();
    expect(() => planUpgradeInvalidation({ ...declaration, id: "compact", affectedDependencyKeys: [" representation-profile:profile:compact"] }, [], registry))
      .toThrow(/blank|trim|dependency/u);
  });

  it("derives the complete target-owned dependency closure and rejects caller-selected decoys", () => {
    const registry = {
      knownDependencyKeys: ["profile:compact:render", "profile:compact:fidelity", "representation:projection:old"],
      ownedDependencyKeys: {
        "profile:compact:render": { kind: "representation-profile" as const, id: "compact" },
        "profile:compact:fidelity": { kind: "representation-profile" as const, id: "compact" },
      },
      directDependentIdsByDependencyKey: {
        "profile:compact:render": ["context:decoy"],
        "profile:compact:fidelity": ["projection:old"],
        "representation:projection:old": ["capsule:old"],
      },
    };
    const dependents = [
      { id: "context:decoy", kind: "context" as const, dependencyKeys: ["profile:compact:render"] },
      { id: "projection:old", kind: "representation" as const, dependencyKeys: ["profile:compact:fidelity"] },
      { id: "capsule:old", kind: "capsule" as const, dependencyKeys: ["representation:projection:old"] },
    ];
    const declaration = { kind: "representation-profile" as const, id: "compact", fromVersion: "1", toVersion: "2", requiredAction: "revalidate" as const };
    expect(() => planUpgradeInvalidation({ ...declaration, affectedDependencyKeys: ["profile:compact:render"] }, dependents, registry))
      .toThrow(/complete|coverage|owned dependency/u);
    expect(planUpgradeInvalidation({ ...declaration, affectedDependencyKeys: ["profile:compact:render", "profile:compact:fidelity"] }, dependents, registry).invalidatedIds)
      .toEqual(["capsule:old", "context:decoy", "projection:old"]);
    expect(() => planUpgradeInvalidation({ ...declaration, affectedDependencyKeys: ["profile:compact:render", "profile:compact:fidelity"] }, dependents.slice(0, 2), registry))
      .toThrow(/registry coverage|direct dependent/u);
    const missingReachableKeyRegistry = {
      ...registry,
      knownDependencyKeys: ["profile:compact:render", "profile:compact:fidelity"],
      directDependentIdsByDependencyKey: {
        "profile:compact:render": ["context:decoy"],
        "profile:compact:fidelity": ["projection:old"],
      },
    };
    expect(() => planUpgradeInvalidation({ ...declaration, affectedDependencyKeys: ["profile:compact:render", "profile:compact:fidelity"] }, dependents, missingReachableKeyRegistry))
      .toThrow(/registry coverage|unknown dependency/u);
  });

  it.each(["engine", "schema", "analyzer", "signature-profile"] as const)(
    "invalidates directly dependent canonical-source proof rows for a %s interpretation change while preserving canonical entities",
    (kind) => {
      const targetId = `${kind}:typescript`;
      const targetKey = `${kind}:typescript:v1`;
      const proofKey = "canonical-source:proof:rule-a";
      const result = planUpgradeInvalidation({
        kind, id: targetId, fromVersion: "1", toVersion: "2",
        affectedDependencyKeys: [targetKey], requiredAction: "revalidate",
      }, [
        { id: "entity:rule-a", kind: "canonical-entity", dependencyKeys: [] },
        { id: "entity:decoy", kind: "canonical-entity", dependencyKeys: [] },
        { id: "proof:rule-a", kind: "canonical-source", dependencyKeys: [targetKey] },
        { id: "proof:rule-a-consumer", kind: "derivation", dependencyKeys: [proofKey] },
        { id: "proof:decoy", kind: "derivation", dependencyKeys: ["unrelated:key"] },
      ], {
        knownDependencyKeys: [targetKey, proofKey, "unrelated:key"],
        ownedDependencyKeys: { [targetKey]: { kind, id: targetId } },
        directDependentIdsByDependencyKey: {
          [targetKey]: ["proof:rule-a"],
          [proofKey]: ["proof:rule-a-consumer"],
          "unrelated:key": ["proof:decoy"],
        },
      });

      expect(result.invalidatedIds).toEqual(["proof:rule-a", "proof:rule-a-consumer"]);
      expect(result.preservedCanonicalEntityIds).toEqual(["entity:decoy", "entity:rule-a"]);
    },
  );

  it("invalidates then refreshes every derived representation consumer and authenticates the reconciliation receipt", async () => {
    const events: string[] = [];
    const result = await reconcileRepresentationProfileUpgrade({
      invalidatedIds: ["capsule:old", "projection:old", "context:old"],
      preservedCanonicalEntityIds: ["requirement:authority"], requiredAction: "revalidate",
    }, {
      invalidate: async (ids) => { events.push(`invalidate:${ids.join(",")}`); },
      refresh: async (id) => { events.push(`refresh:${id}`); return hashFramedDomain("refreshed-representation-dependent", id); },
    });
    expect(events[0]).toMatch(/^invalidate:/u);
    expect(events.slice(1)).toEqual(["refresh:capsule:old", "refresh:context:old", "refresh:projection:old"]);
    expect(result).toMatchObject({ status: "reconciled", refreshedIds: ["capsule:old", "context:old", "projection:old"], preservedCanonicalEntityIds: ["requirement:authority"] });
    expect(result.receiptHash).toBe(hashFramedDomain("representation-upgrade-reconciliation", { invalidatedIds: result.invalidatedIds, refreshed: result.refreshed, preservedCanonicalEntityIds: result.preservedCanonicalEntityIds, requiredAction: "revalidate" }));
  });
});
