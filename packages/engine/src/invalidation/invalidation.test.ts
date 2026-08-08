import type {
  AdapterContext,
  ContentHash,
  DerivationRecord,
  ImpactRule,
  InvalidationEvent,
  SemanticSignature,
  StateBinding,
  ValidationResult,
} from "@projector/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DerivationIndex,
  type DerivationIndexSnapshot,
  ImpactRuleRegistry,
  InvalidationEngine,
  SemanticSignatureProfileRegistry,
  assessBackdating,
  compareCorrectnessOracles,
  createImpactClosure,
  type ImpactClosureArtifactStore,
  type ImpactRuleEvaluationPort,
} from "./index.js";
import { InMemoryGraphReader, QueryDependencyRegistry } from "../query/index.js";
import { selectorHash as canonicalSelectorHash } from "../governance/selectors.js";
import { DependencyScopedStateBindingValidator, createStateBinding } from "../state/index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0").slice(0, 64)}`;
const signature = (
  value: string,
  assurance: SemanticSignature["assurance"] = "exact",
  profileVersion = "1",
): SemanticSignature => ({
  hash: hash(value),
  profileId: "typescript-public-interface",
  profileVersion,
  scope: "exported-declarations",
  assurance,
  evidenceIds: assurance === "validated" ? ["evidence:contract-test"] : [],
});

const validation = (overrides: Partial<ValidationResult> = {}): ValidationResult => ({
  validatorId: "contract-schema",
  status: "passed",
  summary: "public contract conforms",
  evidenceIds: ["evidence:contract-test"],
  evidenceLane: "schema",
  independenceGroup: "independent-contract",
  assurance: "strong",
  authorSource: "pre-existing",
  sideEffectClass: "none",
  details: {},
  startedAt: "2026-08-07T00:00:00.000Z",
  completedAt: "2026-08-07T00:00:01.000Z",
  ...overrides,
});

const record = (unitId: string, inputs: Array<[string, string]>, output = unitId, proofGroupId?: string): DerivationRecord => ({
  unitId,
  ...(proofGroupId === undefined ? {} : { proofGroupId }),
  engineVersion: "2.0.0",
  adapterVersion: "ts@1",
  inputs: inputs.map(([kind, id]) => ({
    kind: kind as "unit" | "artifact",
    id,
    versionHash: hash(`${id}-v1`),
    role: kind === "unit" ? "semantic-output" : "source",
  })),
  ruleBundleHash: hash("rules"),
  outputSemanticSignature: signature(output),
  outputStructuralSignature: { ...signature(`structure-${output}`), scope: "ast-shape" },
  membershipHash: hash(`membership-${unitId}`),
  establishedAt: "2026-08-07T00:00:00.000Z",
  validators: [],
});

const event = (subjectId: string, eventKind = "artifact-change"): InvalidationEvent => ({
  eventKind,
  subjectId,
  oldHash: hash("old"),
  newHash: hash("new"),
  graphRevision: 2,
  stateDigest: {
    gitBase: "base",
    worktreeDigest: hash("worktree"),
    canonicalProjectorDigest: hash("canonical"),
    toolchainDigest: hash("toolchain"),
  },
});

const currentSccOutputs = (
  aValue: string,
  bValue: string,
  bAssurance: SemanticSignature["assurance"] = "exact",
) => [
  {
    unitId: "contract-a",
    signature: signature(aValue),
    structuralSignature: { ...signature(`structure-${aValue}`), scope: "ast-shape" },
    inputs: [
      { kind: "artifact" as const, id: "internal", versionHash: hash("new"), role: "source" },
      { kind: "unit" as const, id: "contract-b", versionHash: hash(bValue), role: "semantic-output" },
    ],
  },
  {
    unitId: "contract-b",
    signature: signature(bValue, bAssurance),
    structuralSignature: { ...signature(`structure-${bValue}`, bAssurance), scope: "ast-shape" },
    inputs: [{ kind: "unit" as const, id: "contract-a", versionHash: hash(aValue), role: "semantic-output" }],
  },
];

describe("semantic signature profiles and assurance", () => {
  it("creates deterministic signatures independent of object and evidence insertion order", () => {
    const profiles = new SemanticSignatureProfileRegistry();
    profiles.register({
      id: "typescript-public-interface",
      version: "1",
      scope: "exported-declarations",
      normalization: "canonical exported declaration JSON",
      ignoredDifferences: ["formatting", "private implementation"],
      adapterId: "typescript",
      adapterVersion: "1",
      maximumAssurance: "exact",
      assuranceEvidence: ["TypeScript declaration grammar"],
      unsupportedConstructs: ["dynamic runtime export mutation"],
      normalize: (input) => input,
    });

    const first = profiles.sign("typescript-public-interface", "1", { b: 2, a: 1 }, {
      assurance: "exact",
      evidenceIds: ["evidence:b", "evidence:a", "evidence:a"],
    });
    const second = profiles.sign("typescript-public-interface", "1", { a: 1, b: 2 }, {
      assurance: "exact",
      evidenceIds: ["evidence:a", "evidence:b"],
    });

    expect(first).toEqual(second);
    expect(first.evidenceIds).toEqual(["evidence:a", "evidence:b"]);
  });

  it("rejects assurance stronger than the registered profile can justify", () => {
    const profiles = new SemanticSignatureProfileRegistry();
    profiles.register({
      id: "behavior-guess",
      version: "1",
      scope: "business-behavior",
      normalization: "token summary",
      ignoredDifferences: [],
      adapterId: "tokens",
      adapterVersion: "1",
      maximumAssurance: "heuristic",
      assuranceEvidence: [],
      unsupportedConstructs: ["side effects"],
      normalize: (input) => input,
    });
    expect(() => profiles.sign("behavior-guess", "1", "same", { assurance: "exact", evidenceIds: [] }))
      .toThrow(/cannot issue exact assurance/);
  });

  it("invalidates the old profile version without conflating profile identity with a path", () => {
    const profiles = new SemanticSignatureProfileRegistry();
    const descriptor = {
      id: "typescript-public-interface",
      scope: "exported-declarations",
      normalization: "canonical declaration JSON",
      ignoredDifferences: ["formatting"],
      adapterId: "typescript",
      adapterVersion: "1",
      maximumAssurance: "exact" as const,
      assuranceEvidence: ["grammar"],
      unsupportedConstructs: [] as string[],
      normalize: (input: unknown) => input,
    };
    profiles.register({ ...descriptor, version: "1" });
    profiles.register({ ...descriptor, version: "2", adapterVersion: "2" });

    expect(profiles.assess(signature("same", "exact", "1"))).toMatchObject({ current: false, reason: expect.stringContaining("version") });
    expect(profiles.assess(signature("same", "exact", "2"))).toMatchObject({ current: true });
  });

  it("selects numeric profile upgrades deterministically and refuses a nondeterministic normalizer", () => {
    const profiles = new SemanticSignatureProfileRegistry();
    const base = {
      id: "typescript-public-interface",
      scope: "exported-declarations",
      normalization: "declarations",
      ignoredDifferences: [] as string[],
      adapterId: "typescript",
      adapterVersion: "1",
      maximumAssurance: "exact" as const,
      assuranceEvidence: ["grammar"],
      unsupportedConstructs: [] as string[],
      normalize: (input: unknown) => input,
    };
    profiles.register({ ...base, version: "10" });
    profiles.register({ ...base, version: "2" });
    expect(profiles.currentVersion("typescript-public-interface")).toBe("10");

    let invocation = 0;
    profiles.register({ ...base, id: "unstable", version: "1", normalize: () => ({ invocation: invocation += 1 }) });
    expect(() => profiles.sign("unstable", "1", {}, { assurance: "exact", evidenceIds: [] }))
      .toThrow(/nondeterministic normalization/);
  });

  it("orders prerelease versions below their stable release and compares large numeric versions exactly", () => {
    const profiles = new SemanticSignatureProfileRegistry();
    const base = {
      id: "typescript-public-interface",
      scope: "exported-declarations",
      normalization: "declarations",
      ignoredDifferences: [] as string[],
      adapterId: "typescript",
      adapterVersion: "1",
      maximumAssurance: "exact" as const,
      assuranceEvidence: ["grammar"],
      unsupportedConstructs: [] as string[],
      normalize: (input: unknown) => input,
    };
    profiles.register({ ...base, version: "1.0.0-alpha" });
    profiles.register({ ...base, version: "1.0.0" });
    profiles.register({ ...base, version: "999999999999999999999999999999.0" });
    expect(profiles.currentVersion(base.id)).toBe("999999999999999999999999999999.0");

    const rules = new ImpactRuleRegistry([
      {
        ...({
          id: "rule:version-order",
          key: "version-order",
          version: "1.0.0-alpha",
          selector: { op: "atom", field: "tag", matcher: "equals", value: "public" },
          trigger: "manual",
          direction: "both",
          effect: "advisory",
          semanticHash: hash("alpha"),
        } satisfies ImpactRule),
      },
      {
        id: "rule:version-order",
        key: "version-order",
        version: "1.0.0",
        selector: { op: "atom", field: "tag", matcher: "equals", value: "public" },
        trigger: "manual",
        direction: "both",
        effect: "advisory",
        semanticHash: hash("stable"),
      },
    ]);
    expect(rules.current().find(({ id }) => id === "rule:version-order")?.version).toBe("1.0.0");
  });
});

describe("derivation index and exact invalidation", () => {
  it("normalizes records and reverse dependencies independent of insertion order", () => {
    fc.assert(fc.property(fc.shuffledSubarray([
      record("contract", [["artifact", "handler"]]),
      record("client-b", [["unit", "contract"]]),
      record("client-a", [["unit", "contract"]]),
    ], { minLength: 3, maxLength: 3 }), (records) => {
      const index = new DerivationIndex(records);
      expect(index.reverseDependents("contract")).toEqual(["client-a", "client-b"]);
      expect(index.reverseDependents("handler")).toEqual(["contract"]);
      expect(index.records().map(({ unitId }) => unitId)).toEqual(["client-a", "client-b", "contract"]);
    }));
  });

  it("exposes a versioned derived snapshot for injected persistence adapters", () => {
    const index = new DerivationIndex([
      record("contract", [["artifact", "handler"]]),
      record("client", [["unit", "contract"]]),
    ]);
    expect(index.snapshot()).toMatchObject({
      schemaVersion: "invalidation-derived@1",
      reverseDependencies: [
        { subjectId: "contract", dependentIds: ["client"] },
        { subjectId: "handler", dependentIds: ["contract"] },
        { subjectId: "typescript-public-interface", dependentIds: ["client", "contract"] },
      ],
    });
  });

  it("rejects incompatible declared proof groups inside one Tarjan SCC", () => {
    expect(() => new DerivationIndex([
      record("contract-a", [["unit", "contract-b"]], "a-v1", "group-a"),
      record("contract-b", [["unit", "contract-a"]], "b-v1", "group-b"),
    ])).toThrow(/incompatible.*proof group/i);
  });

  it("indexes output signature profiles even when the input list omits the profile dependency", () => {
    const index = new DerivationIndex([record("contract", [["artifact", "handler"]])]);
    expect(index.reverseDependents("typescript-public-interface")).toEqual(["contract"]);
  });

  it("backdates an unchanged exact public contract and keeps clients valid", async () => {
    const index = new DerivationIndex([
      record("contract", [["artifact", "handler"]], "public-v1"),
      record("client", [["unit", "contract"]]),
    ]);
    const engine = new InvalidationEngine({ derivations: index });
    const result = await engine.invalidate(event("handler"), {
      revalidate: async (unitIds) => unitIds.map((id) => ({ unitId: id, signature: signature(id === "contract" ? "public-v1" : id) })),
    });

    expect(result.invalidation.directlyAffected).toEqual(["contract"]);
    expect(result.invalidation.transitivelyAffected).toEqual([]);
    expect(result.backdatedUnitIds).toEqual(["contract"]);
    expect(result.validUnitIds).toContain("client");
  });

  it("persists refreshed derivation inputs when an unchanged unit is backdated", async () => {
    const index = new DerivationIndex([record("contract", [["artifact", "handler"]], "public-v1")]);
    let stored: ReturnType<DerivationIndex["snapshot"]> | undefined;
    const engine = new InvalidationEngine({
      derivations: index,
      derivationStore: {
        load: async () => stored,
        replace: async (snapshot) => { stored = snapshot; },
      },
    });
    const changed = event("handler");
    const result = await engine.invalidate(changed, {
      revalidate: async () => [{ unitId: "contract", signature: signature("public-v1") }],
    });

    expect(result.revalidatedRecords[0]?.inputs.find(({ id }) => id === "handler")?.versionHash).toBe(changed.newHash);
    expect(index.get("contract")?.inputs.find(({ id }) => id === "handler")?.versionHash).toBe(changed.newHash);
    expect(stored?.records[0]?.inputs.find(({ id }) => id === "handler")?.versionHash).toBe(changed.newHash);
  });

  it("refuses heuristic equality and widens to downstream clients", async () => {
    const heuristicContract = record("contract", [["artifact", "handler"]], "public-v1");
    heuristicContract.outputSemanticSignature = signature("public-v1", "heuristic");
    const engine = new InvalidationEngine({ derivations: new DerivationIndex([
      heuristicContract,
      record("client", [["unit", "contract"]]),
    ]) });
    const result = await engine.invalidate(event("handler"), {
      revalidate: async () => [{ unitId: "contract", signature: signature("public-v1", "heuristic") }],
    });

    expect(result.backdatedUnitIds).toEqual([]);
    expect(result.invalidation.possibleFrontier).toContain("client");
    expect(result.invalidation.reasons.client).toContain("heuristic equality cannot backdate downstream validity");
  });

  it("propagates a material contract signature change so clients cannot remain falsely valid", async () => {
    const engine = new InvalidationEngine({ derivations: new DerivationIndex([
      record("contract", [["artifact", "handler"]], "public-v1"),
      record("client", [["unit", "contract"]]),
    ]) });
    const result = await engine.invalidate(event("handler"), {
      revalidate: async () => [{ unitId: "contract", signature: signature("public-v2") }],
    });
    expect(result.invalidation.transitivelyAffected).toEqual(["client"]);
    expect(result.validUnitIds).not.toContain("client");
  });

  it("marks profile-dependent derivations suspect after a signature profile upgrade", async () => {
    const engine = new InvalidationEngine({ derivations: new DerivationIndex([
      record("contract", [["signature-profile", "typescript-public-interface"]], "public-v1"),
      record("client", [["unit", "contract"]]),
    ]) });
    const result = await engine.invalidate(event("typescript-public-interface", "signature-profile-change"), {
      revalidate: async () => [{ unitId: "contract", signature: signature("public-v1", "exact", "2") }],
    });
    expect(result.invalidation.directlyAffected).toEqual(["client", "contract"]);
    expect(result.invalidation.reasons.client).toContain("signature profile typescript-public-interface changed; output derivation requires fresh proof");
  });

  it("accepts validated equality only with sufficient independent evidence", () => {
    const prior = signature("same", "validated");
    const current = signature("same", "validated");
    expect(assessBackdating(prior, current, [], { minimumValidatedAssurance: "strong", requireIndependent: true }).eligible)
      .toBe(false);
    expect(assessBackdating(prior, current, [validation()], { minimumValidatedAssurance: "strong", requireIndependent: true }).eligible)
      .toBe(true);
    expect(assessBackdating(prior, current, [validation({ evidenceLane: "same-packet-agent", independenceGroup: "packet" })], {
      minimumValidatedAssurance: "strong",
      requireIndependent: true,
    }).eligible).toBe(false);
    expect(assessBackdating(prior, current, [validation({ evidenceIds: ["evidence:unrelated"] })], {
      minimumValidatedAssurance: "strong",
      requireIndependent: true,
    }).eligible).toBe(false);
  });

  it("evaluates a recursive contract SCC as one proof group before retaining consumers", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
      record("consumer", [["unit", "contract-a"]]),
    ]);
    expect(index.proofGroupFor("contract-a")?.memberIds).toEqual(["contract-a", "contract-b"]);
    const engine = new InvalidationEngine({ derivations: index });
    const calls: string[][] = [];
    const result = await engine.invalidate(event("internal"), {
      revalidate: async (unitIds) => {
        calls.push([...unitIds]);
        return currentSccOutputs("a-v1", "b-v1");
      },
    });

    expect(calls).toEqual([["contract-a", "contract-b"]]);
    expect(result.backdatedUnitIds).toEqual(["contract-a", "contract-b"]);
    expect(result.validUnitIds).toContain("consumer");
  });

  it("widens when an SCC member cannot regain eligible assurance", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
      record("consumer", [["unit", "contract-a"]]),
    ]);
    const engine = new InvalidationEngine({ derivations: index });
    const result = await engine.invalidate(event("internal"), {
      revalidate: async () => [
        { unitId: "contract-a", signature: signature("a-v1") },
        { unitId: "contract-b", signature: signature("b-v1", "heuristic") },
      ],
    });
    expect(result.invalidation.possibleFrontier).toContain("consumer");
    expect(result.diagnostics).toContain("derivation-cycle-unresolved");
  });

  it("iterates an SCC proof strategy to a fixed point and refuses oscillation at the bound", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
      record("consumer", [["unit", "contract-a"]]),
    ]);
    let round = 0;
    const converged = await new InvalidationEngine({ derivations: index }).invalidate(event("internal"), {
      maximumProofGroupIterations: 3,
      revalidate: async () => {
        round += 1;
        return currentSccOutputs(round === 1 ? "a-intermediate" : "a-v1", "b-v1");
      },
    });
    expect(round).toBe(2);
    expect(converged.backdatedUnitIds).toEqual(["contract-a", "contract-b"]);

    let oscillationRound = 0;
    const unresolved = await new InvalidationEngine({ derivations: index }).invalidate(event("internal"), {
      maximumProofGroupIterations: 2,
      revalidate: async () => {
        oscillationRound += 1;
        return currentSccOutputs(`a-${oscillationRound % 2}`, "b-v1");
      },
    });
    expect(unresolved.diagnostics).toContain("derivation-cycle-unresolved");
    expect(unresolved.invalidation.possibleFrontier).toContain("consumer");
  });

  it("propagates a materially changed SCC after its new signatures reach a fixed point", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
      record("consumer", [["unit", "contract-a"]]),
    ]);
    const result = await new InvalidationEngine({ derivations: index }).invalidate(event("internal"), {
      maximumProofGroupIterations: 3,
      revalidate: async () => currentSccOutputs("a-v2", "b-v2"),
    });
    expect(result.invalidation.transitivelyAffected).toEqual(["consumer"]);
    expect(result.diagnostics).toEqual([]);
  });

  it("does not publish or persist a partial cyclic proof-group refresh", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
    ]);
    const before = index.snapshot();
    const stored: DerivationIndexSnapshot[] = [];
    const result = await new InvalidationEngine({ derivations: index }).invalidate(event("internal"), {
      maximumProofGroupIterations: 2,
      derivationStore: { load: async () => undefined, replace: async (snapshot) => { stored.push(snapshot); } },
      revalidate: async () => [{
        unitId: "contract-a",
        signature: signature("a-v2"),
        structuralSignature: { ...signature("structure-a-v2"), scope: "ast-shape" },
        inputs: [
          { kind: "artifact", id: "internal", versionHash: hash("new"), role: "source" },
          { kind: "unit", id: "contract-b", versionHash: hash("b-v2"), role: "semantic-output" },
        ],
      }],
    });

    expect(result.diagnostics).toContain("derivation-cycle-unresolved");
    expect(result.revalidatedRecords).toEqual([]);
    expect(index.snapshot()).toEqual(before);
    expect(stored).toEqual([]);
  });

  it("does not backdate a cyclic group when current inputs and structural proof are missing", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
      record("consumer", [["unit", "contract-a"]]),
    ]);
    const before = index.snapshot();
    const stored: DerivationIndexSnapshot[] = [];
    const result = await new InvalidationEngine({ derivations: index }).invalidate(event("internal"), {
      maximumProofGroupIterations: 2,
      derivationStore: { load: async () => undefined, replace: async (snapshot) => { stored.push(snapshot); } },
      revalidate: async () => [
        { unitId: "contract-a", signature: signature("a-v1") },
        { unitId: "contract-b", signature: signature("b-v1") },
      ],
    });

    expect(result.backdatedUnitIds).toEqual([]);
    expect(result.diagnostics).toContain("derivation-cycle-unresolved");
    expect(result.invalidation.unavailable).toEqual(expect.arrayContaining(["contract-a", "contract-b"]));
    expect(result.validUnitIds).not.toEqual(expect.arrayContaining(["contract-a", "contract-b"]));
    expect(result.revalidatedRecords).toEqual([]);
    expect(index.snapshot()).toEqual(before);
    expect(stored).toEqual([]);
  });

  it("atomically refreshes every cyclic member with current peer inputs and both output signatures", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
    ]);
    const stored: DerivationIndexSnapshot[] = [];
    const result = await new InvalidationEngine({ derivations: index }).invalidate(event("internal"), {
      maximumProofGroupIterations: 2,
      derivationStore: { load: async () => undefined, replace: async (snapshot) => { stored.push(snapshot); } },
      revalidate: async () => [
        {
          unitId: "contract-a",
          signature: signature("a-v2"),
          structuralSignature: { ...signature("structure-a-v2"), scope: "ast-shape" },
          inputs: [
            { kind: "artifact", id: "internal", versionHash: hash("new"), role: "source" },
            { kind: "unit", id: "contract-b", versionHash: hash("b-v2"), role: "semantic-output" },
          ],
        },
        {
          unitId: "contract-b",
          signature: signature("b-v2"),
          structuralSignature: { ...signature("structure-b-v2"), scope: "ast-shape" },
          inputs: [{ kind: "unit", id: "contract-a", versionHash: hash("a-v2"), role: "semantic-output" }],
        },
      ],
    });

    expect(result.revalidatedRecords).toHaveLength(2);
    expect(result.revalidatedRecords.find(({ unitId }) => unitId === "contract-a")).toMatchObject({
      outputSemanticSignature: { hash: hash("a-v2") },
      outputStructuralSignature: { hash: hash("structure-a-v2") },
      inputs: expect.arrayContaining([
        expect.objectContaining({ id: "contract-b", versionHash: hash("b-v2") }),
        expect.objectContaining({ id: "internal", versionHash: hash("new") }),
      ]),
    });
    expect(result.revalidatedRecords.find(({ unitId }) => unitId === "contract-b")).toMatchObject({
      outputSemanticSignature: { hash: hash("b-v2") },
      outputStructuralSignature: { hash: hash("structure-b-v2") },
      inputs: [expect.objectContaining({ id: "contract-a", versionHash: hash("a-v2") })],
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(index.snapshot());
  });

  it("refuses cyclic persistence when a claimed current peer input disagrees with the peer output", async () => {
    const index = new DerivationIndex([
      record("contract-a", [["artifact", "internal"], ["unit", "contract-b"]], "a-v1"),
      record("contract-b", [["unit", "contract-a"]], "b-v1"),
    ]);
    const before = index.snapshot();
    const stored: DerivationIndexSnapshot[] = [];
    const result = await new InvalidationEngine({ derivations: index }).invalidate(event("internal"), {
      maximumProofGroupIterations: 2,
      derivationStore: { load: async () => undefined, replace: async (snapshot) => { stored.push(snapshot); } },
      revalidate: async () => [
        {
          unitId: "contract-a", signature: signature("a-v2"),
          structuralSignature: { ...signature("structure-a-v2"), scope: "ast-shape" },
          inputs: [
            { kind: "artifact", id: "internal", versionHash: hash("new"), role: "source" },
            { kind: "unit", id: "contract-b", versionHash: hash("stale-b"), role: "semantic-output" },
          ],
        },
        {
          unitId: "contract-b", signature: signature("b-v2"),
          structuralSignature: { ...signature("structure-b-v2"), scope: "ast-shape" },
          inputs: [{ kind: "unit", id: "contract-a", versionHash: hash("a-v2"), role: "semantic-output" }],
        },
      ],
    });

    expect(result.revalidatedRecords).toEqual([]);
    expect(index.snapshot()).toEqual(before);
    expect(stored).toEqual([]);
  });
});

describe("Impact Rules, selector membership, closure provenance, and oracles", () => {
  const publicRule = (version = "1"): ImpactRule => ({
    id: "impact:public-api",
    key: "public-api",
    version,
    selector: { op: "atom", field: "tag", matcher: "equals", value: "public" },
    trigger: "membership-change",
    direction: "both",
    relationTypes: ["consumes"],
    maxDepth: 2,
    effect: "revalidate",
    requiredRelationConfidence: 0.9,
    semanticHash: hash(`public-rule-${version}`),
  });

  it("uses both prior and current selector membership so additions and removals invalidate", async () => {
    const rules = new ImpactRuleRegistry([publicRule()]);
    const port: ImpactRuleEvaluationPort = {
      subjects: async (_rule, phase) => phase === "before"
        ? [{ id: "removed-export", values: { tag: ["public"] }, dependencyKeys: ["unit:removed-export"] }]
        : [{ id: "added-export", values: { tag: ["public"] }, dependencyKeys: ["unit:added-export"] }],
      traverse: async (seedIds) => ({
        knownIds: seedIds.flatMap((id) => [`docs:${id}`, `compat:${id}`]),
        possibleIds: [],
        unavailableIds: [],
        observability: "closed",
        reasons: {},
      }),
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: rules, impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), { revalidate: async () => [] });

    expect(result.invalidation.directlyAffected).toEqual(["added-export", "removed-export"]);
    expect(result.invalidation.transitivelyAffected).toEqual([
      "compat:added-export", "compat:removed-export", "docs:added-export", "docs:removed-export",
    ]);
  });

  it("binds selector membership, rule applicability, reverse traversal, and enumeration queries", async () => {
    const port: ImpactRuleEvaluationPort = {
      subjects: async (_rule, phase) => phase === "before"
        ? [{ id: "before-export", values: { tag: ["public"] }, dependencyKeys: ["membership:before"] }]
        : [{ id: "after-export", values: { tag: ["public"] }, dependencyKeys: ["membership:after"] }],
      traverse: async () => ({
        knownIds: ["docs"], possibleIds: ["unknown-consumer"], unavailableIds: [], observability: "bounded", reasons: {},
      }),
    };
    const binding = { compiledAgainst: event("selector:public").stateDigest, valueDependencies: [], queryDependencies: [], dependencyDigest: hash("binding") } as StateBinding;
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([publicRule()]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: binding,
      revalidate: async () => [],
    });
    const kinds = result.impactClosure?.stateBinding.queryDependencies.map(({ query }) => query.kind) ?? [];
    expect(kinds).toEqual(expect.arrayContaining(["selector-membership", "impact-rule-applicability", "reverse-derivation", "surface-enumeration"]));
    expect(result.impactClosure?.stateBinding.queryDependencies.some(({ priorResult }) => priorResult.dependencyKeys.includes("membership:before"))).toBe(true);
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader());
    result.impactClosure?.stateBinding.queryDependencies.forEach(({ query }) => expect(() => registry.assertCurrent(query)).not.toThrow());
  });

  it("fails closed for injected traversal even when a graph happens to reproduce its known IDs", async () => {
    const rule = publicRule();
    const selectorHash = canonicalSelectorHash(rule.selector);
    const port: ImpactRuleEvaluationPort = {
      subjects: async (_rule, phase) => phase === "before"
        ? [{ id: "before-export", values: { tag: ["public"] }, dependencyKeys: ["membership:before"] }]
        : [{ id: "after-export", values: { tag: ["public"] }, dependencyKeys: ["membership:after"] }],
      traverse: async () => ({
        knownIds: ["docs"], possibleIds: [], unavailableIds: [], observability: "closed", reasons: {},
      }),
    };
    const originalState = event("selector:public").stateDigest;
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([rule]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: createStateBinding({ compiledAgainst: originalState, valueDependencies: [], queryDependencies: [] }),
      revalidate: async () => [],
    });
    const graph = new InMemoryGraphReader({
      selectorMemberships: [{ selectorHash, memberIds: ["after-export"] }],
      reverseDerivations: [
        { subjectId: "before-export", dependentIds: ["docs"] },
        { subjectId: "after-export", dependentIds: ["docs"] },
      ],
    });
    const registry = new QueryDependencyRegistry(graph);
    const validator = new DependencyScopedStateBindingValidator({
      values: { readVersionHash: async () => undefined }, queries: registry,
    });
    const nextState = { ...originalState, worktreeDigest: hash("unrelated") };
    const context: AdapterContext = { repositoryRoot: "/repo", stateDigest: nextState, config: {}, signal: new AbortController().signal };

    await expect(validator.validate(result.impactClosure!.stateBinding, nextState, context)).resolves.toMatchObject({
      status: "unavailable", changedQueryDependencyIds: [],
    });
    expect(result.impactClosure!.stateBinding.queryDependencies
      .filter(({ query }) => query.kind === "selector-membership")
      .every(({ query }) => query.input.selectorHash === selectorHash)).toBe(true);

    expect((await validator.validate(result.impactClosure!.stateBinding, nextState, context)).reasons)
      .toEqual(expect.arrayContaining([expect.stringContaining("non-rebindable")]));
  });

  it("fails closed for known-only bounded port traversal instead of claiming unbounded graph equivalence", async () => {
    const rule = { ...publicRule(), maxDepth: 1 };
    const originalState = event("selector:public").stateDigest;
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["membership:export"] }],
      traverse: async () => ({
        knownIds: ["docs"], possibleIds: [], unavailableIds: [], observability: "bounded" as const,
        assumptions: ["port applies maxDepth=1"], unavailableLanes: [], dependencyKeys: ["adapter:bounded@1"], reasons: {},
      }),
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([rule]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: createStateBinding({ compiledAgainst: originalState, valueDependencies: [], queryDependencies: [] }),
      revalidate: async () => [],
    });
    const graph = new InMemoryGraphReader({
      selectorMemberships: [{ selectorHash: canonicalSelectorHash(rule.selector), memberIds: ["export"] }],
      reverseDerivations: [
        { subjectId: "export", dependentIds: ["docs"] },
        { subjectId: "docs", dependentIds: ["deep-consumer"] },
      ],
    });
    const registry = new QueryDependencyRegistry(graph);
    const validator = new DependencyScopedStateBindingValidator({ values: { readVersionHash: async () => undefined }, queries: registry });
    const context: AdapterContext = { repositoryRoot: "/repo", stateDigest: originalState, config: {}, signal: new AbortController().signal };
    await expect(validator.validate(result.impactClosure!.stateBinding, originalState, context)).resolves.toMatchObject({ status: "current" });

    const changedState = { ...originalState, worktreeDigest: hash("unrelated") };
    const changedContext = { ...context, stateDigest: changedState };
    const changed = await validator.validate(result.impactClosure!.stateBinding, changedState, changedContext);
    expect(changed.status).toBe("unavailable");
    expect(changed.reasons.some((reason) => reason.includes("non-rebindable"))).toBe(true);
    const traversal = result.impactClosure!.stateBinding.queryDependencies
      .find(({ query }) => query.kind === "reverse-derivation" && query.id.includes("reverse-traversal"));
    expect(traversal?.query.input).toMatchObject({ rebindable: false, seedIds: ["export"] });
    expect(traversal?.priorResult).toMatchObject({
      resultCount: 1,
      observability: "bounded",
      assumptions: ["port applies maxDepth=1"],
      dependencyKeys: expect.arrayContaining(["adapter:bounded@1"]),
    });
  });

  it("fails closed with an explicit non-rebindable contract for port-only traversal semantics", async () => {
    const rule = publicRule();
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["membership:export"] }],
      traverse: async () => ({
        knownIds: ["docs"], possibleIds: ["unknown-consumer"], unavailableIds: ["remote-consumer"],
        observability: "bounded", assumptions: ["registry snapshot pinned"], unavailableLanes: ["remote registry"],
        dependencyKeys: ["adapter:registry@1"], reasons: {},
      }),
    };
    const originalState = event("selector:public").stateDigest;
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([rule]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: createStateBinding({ compiledAgainst: originalState, valueDependencies: [], queryDependencies: [] }),
      revalidate: async () => [],
    });
    const nextState = { ...originalState, worktreeDigest: hash("unrelated") };
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader({
      selectorMemberships: [{ selectorHash: canonicalSelectorHash(rule.selector), memberIds: ["export"] }],
    }));
    const validator = new DependencyScopedStateBindingValidator({ values: { readVersionHash: async () => undefined }, queries: registry });
    const context: AdapterContext = { repositoryRoot: "/repo", stateDigest: nextState, config: {}, signal: new AbortController().signal };
    const validation = await validator.validate(result.impactClosure!.stateBinding, nextState, context);

    expect(validation.status).toBe("unavailable");
    expect(validation.reasons.some((reason) => reason.includes("non-rebindable"))).toBe(true);
    const traversal = result.impactClosure!.stateBinding.queryDependencies
      .find(({ query }) => query.kind === "reverse-derivation" && query.id.includes("reverse-traversal"));
    expect(traversal?.priorResult).toMatchObject({
      resultCount: 3,
      observability: "bounded",
      assumptions: ["registry snapshot pinned"],
      unavailableLanes: ["remote registry"],
      dependencyKeys: expect.arrayContaining(["adapter:registry@1"]),
    });
  });

  it("emits query dependencies that the public registry can evaluate immediately", async () => {
    const state = event("artifact").stateDigest;
    const binding = createStateBinding({ compiledAgainst: state, valueDependencies: [], queryDependencies: [] });
    const result = await new InvalidationEngine({ derivations: new DerivationIndex() }).invalidate(event("artifact"), {
      stateBinding: binding,
      revalidate: async () => [],
    });
    const context: AdapterContext = {
      repositoryRoot: "/repo",
      stateDigest: state,
      config: {},
      signal: new AbortController().signal,
    };
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader());
    const validator = new DependencyScopedStateBindingValidator({
      values: { readVersionHash: async () => undefined },
      queries: registry,
    });
    const validation = await validator.validate(result.impactClosure!.stateBinding, state, context);
    expect(validation.status).toBe("current");
    result.impactClosure!.stateBinding.queryDependencies.forEach(({ query }) => expect(() => registry.assertCurrent(query)).not.toThrow());
  });

  it("normalizes selector subject order before content-addressing the binding", async () => {
    const makePort = (reverse: boolean): ImpactRuleEvaluationPort => ({
      subjects: async (_rule, phase) => {
        const subjects = phase === "before"
          ? [
              { id: "export-b", values: { tag: ["public"] }, dependencyKeys: ["membership:b"] },
              { id: "export-a", values: { tag: ["public"] }, dependencyKeys: ["membership:a"] },
            ]
          : [{ id: "export-c", values: { tag: ["public"] }, dependencyKeys: ["membership:c"] }];
        return reverse ? [...subjects].reverse() : subjects;
      },
      traverse: async () => ({ knownIds: [], possibleIds: [], unavailableIds: [], observability: "closed", reasons: {} }),
    });
    const run = async (reverse: boolean) => new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([publicRule()]), impactPort: makePort(reverse),
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: { compiledAgainst: event("selector:public").stateDigest, valueDependencies: [], queryDependencies: [], dependencyDigest: hash("binding") } as StateBinding,
      revalidate: async () => [],
    });
    const [first, second] = await Promise.all([run(false), run(true)]);
    expect(first.impactClosure?.contentHash).toBe(second.impactClosure?.contentHash);
  });

  it("normalizes every traversal disposition before content-addressing the binding", async () => {
    const makePort = (reverse: boolean): ImpactRuleEvaluationPort => ({
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["membership:export"] }],
      traverse: async () => {
        const lanes = {
          knownIds: ["known-b", "known-a"],
          possibleIds: ["possible-b", "possible-a"],
          unavailableIds: ["unavailable-b", "unavailable-a"],
        };
        return {
          knownIds: reverse ? [...lanes.knownIds].reverse() : lanes.knownIds,
          possibleIds: reverse ? [...lanes.possibleIds].reverse() : lanes.possibleIds,
          unavailableIds: reverse ? [...lanes.unavailableIds].reverse() : lanes.unavailableIds,
          observability: "bounded" as const,
          reasons: {},
        };
      },
    });
    const run = async (reverse: boolean) => new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([publicRule()]), impactPort: makePort(reverse),
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: createStateBinding({ compiledAgainst: event("selector:public").stateDigest, valueDependencies: [], queryDependencies: [] }),
      revalidate: async () => [],
    });
    const [first, second] = await Promise.all([run(false), run(true)]);
    expect(first.impactClosure?.contentHash).toBe(second.impactClosure?.contentHash);
  });

  it("keeps widen-analysis Impact Rule results in the possible frontier", async () => {
    const wideningRule = { ...publicRule(), effect: "widen-analysis" as const };
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["unit:export"] }],
      traverse: async () => ({ knownIds: ["possible-client"], possibleIds: [], unavailableIds: [], observability: "open", reasons: {} }),
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([wideningRule]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), { revalidate: async () => [] });
    expect(result.invalidation.transitivelyAffected).toEqual([]);
    expect(result.invalidation.possibleFrontier).toEqual(["possible-client"]);
  });

  it("rejects conflicting content for the same versioned Impact Rule identity", () => {
    const rules = new ImpactRuleRegistry([publicRule()]);
    expect(() => rules.register({ ...publicRule(), semanticHash: hash("different") })).toThrow(/conflicting impact rule/);
    expect(() => rules.register(publicRule("2"))).not.toThrow();
  });

  it("fails conservative when Impact Rule membership cannot be evaluated", async () => {
    const malformed = {
      ...publicRule(),
      selector: { op: "atom", field: "path", matcher: "regex", value: "^(a+)+$" } as const,
    };
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "unit", values: { path: "aaaa" }, dependencyKeys: ["unit:unit"] }],
      traverse: async () => ({ knownIds: [], possibleIds: [], unavailableIds: [], observability: "closed", reasons: {} }),
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(),
      impactRules: new ImpactRuleRegistry([malformed]),
      impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), { revalidate: async () => [] });
    expect(result.invalidation.unavailable).toEqual(["selector:public"]);
    expect(result.invalidation.reasons["selector:public"]).toContain("Impact Rule impact:public-api@1 evaluation is unavailable");
  });

  it("retains unavailable provenance when a unit is also known", () => {
    const binding = { dependencyDigest: hash("binding") } as StateBinding;
    const closure = createImpactClosure({
      event: event("handler"),
      stateBinding: binding,
      entries: [
        { unitId: "contract", disposition: "known", proofClass: "exact-derivation", observability: "closed", frontier: false, reasons: ["direct"] },
        { unitId: "contract", disposition: "unavailable", proofClass: "unavailable", observability: "unavailable", frontier: true, reasons: ["traversal failed"] },
      ],
    });
    expect(closure.ref.unavailableSurfaceIds).toEqual(["contract"]);
    expect(closure.entries.map(({ disposition }) => disposition)).toEqual(["known", "unavailable"]);
  });

  it("merges duplicate provenance by a deterministic conservative profile", () => {
    const binding = { dependencyDigest: hash("binding") } as StateBinding;
    const first = createImpactClosure({
      event: event("handler"),
      stateBinding: binding,
      entries: [
        { unitId: "contract", disposition: "known", proofClass: "exact-derivation", observability: "closed", frontier: false, reasons: ["direct"] },
        { unitId: "contract", disposition: "known", proofClass: "impact-rule", observability: "open", frontier: true, reasons: ["rule"] },
      ],
    });
    const second = createImpactClosure({ event: event("handler"), stateBinding: binding, entries: [...first.entries].reverse() });
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ unitId: "contract", proofClass: "exact-derivation", observability: "open", frontier: true, reasons: ["direct", "rule"] }),
    ]));
  });

  it("keeps unrelated work valid under an unrelated root mutation", async () => {
    const engine = new InvalidationEngine({ derivations: new DerivationIndex([
      record("billing", [["artifact", "billing-source"]]),
      record("search", [["artifact", "search-source"]]),
    ]) });
    const result = await engine.invalidate(event("readme"), { revalidate: async () => [] });
    expect(result.invalidation).toMatchObject({ directlyAffected: [], transitivelyAffected: [], possibleFrontier: [] });
    expect(result.validUnitIds).toEqual(["billing", "search"]);
  });

  it("content-addresses provenance-rich closure entries and normalizes insertion order", () => {
    const binding = { dependencyDigest: hash("binding") } as StateBinding;
    const first = createImpactClosure({
      event: event("handler"),
      stateBinding: binding,
      entries: [
        { unitId: "client", disposition: "possible", proofClass: "inferred", observability: "open", frontier: true, reasons: ["weak relation"] },
        { unitId: "contract", disposition: "known", proofClass: "exact-derivation", observability: "closed", frontier: false, reasons: ["handler input changed"] },
      ],
    });
    const second = createImpactClosure({ event: event("handler"), stateBinding: binding, entries: [...first.entries].reverse() });
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.ref).toEqual({
      contentHash: first.contentHash,
      knownAffectedUnitIds: ["contract"],
      possibleFrontierUnitIds: ["client"],
      unavailableSurfaceIds: [],
    });
  });

  it("writes the content-addressed closure through an injected artifact port", async () => {
    const stored = new Map<ContentHash, ReturnType<typeof createImpactClosure>>();
    const closureStore: ImpactClosureArtifactStore = {
      put: async (closure) => { stored.set(closure.contentHash, closure); },
      get: async (contentHash) => stored.get(contentHash),
    };
    const binding = { dependencyDigest: hash("binding") } as StateBinding;
    const engine = new InvalidationEngine({
      derivations: new DerivationIndex([record("contract", [["artifact", "handler"]], "public-v1")]),
      closureStore,
    });
    const result = await engine.invalidate(event("handler"), {
      stateBinding: binding,
      revalidate: async () => [{ unitId: "contract", signature: signature("public-v1") }],
    });
    expect(result.impactClosure).toBeDefined();
    expect(await closureStore.get(result.impactClosure!.contentHash)).toEqual(result.impactClosure);
  });

  it("refreshes and persists derivation records after material revalidation", async () => {
    const recordStore: DerivationIndexSnapshot[] = [];
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex([
        record("contract", [["artifact", "handler"]], "public-v1"),
        record("client", [["unit", "contract"]]),
      ]),
      derivationStore: {
        load: async () => undefined,
        replace: async (snapshot) => { recordStore.push(snapshot); },
      },
    }).invalidate(event("handler"), {
      revalidate: async () => [{ unitId: "contract", signature: signature("public-v2") }],
    });
    expect(result.revalidatedRecords).toEqual([expect.objectContaining({
      unitId: "contract",
      outputSemanticSignature: signature("public-v2"),
    })]);
    expect(result.invalidation.transitivelyAffected).toEqual(["client"]);
    expect(recordStore).toHaveLength(1);
    expect(recordStore[0]!.records.find(({ unitId }) => unitId === "contract")?.inputs.find(({ id }) => id === "handler")?.versionHash)
      .toBe(hash("new"));
  });

  it("records Impact Rule provenance separately from exact derivation provenance", async () => {
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["unit:export"] }],
      traverse: async () => ({ knownIds: ["docs"], possibleIds: [], unavailableIds: [], observability: "closed", reasons: {} }),
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([publicRule()]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: { dependencyDigest: hash("binding") } as StateBinding,
      revalidate: async () => [],
    });
    expect(result.impactClosure?.entries.find(({ unitId }) => unitId === "docs")?.proofClass).toBe("impact-rule");
  });

  it("returns a structured block effect that prevents valid completion", async () => {
    const blockedRule = { ...publicRule(), effect: "block" as const };
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["unit:export"] }],
      traverse: async () => ({ knownIds: [], possibleIds: [], unavailableIds: [], observability: "closed", reasons: {} }),
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([blockedRule]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), { revalidate: async () => [] });
    expect(result.blockedUnitIds).toEqual(["export"]);
    expect(result.blocked).toEqual([{ ruleId: "impact:public-api", ruleVersion: "1", unitIds: ["export"], reason: expect.stringContaining("blocks") }]);
    expect(result.validUnitIds).not.toContain("export");
  });

  it("retains traversal failure reasons and unavailable observability", async () => {
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["unit:export"] }],
      traverse: async () => { throw new Error("reverse index unavailable"); },
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex(), impactRules: new ImpactRuleRegistry([publicRule()]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), { revalidate: async () => [] });
    expect(result.invalidation.unavailable).toEqual(["export"]);
    expect(result.invalidation.reasons.export?.some((reason) => reason.includes("reverse index unavailable"))).toBe(true);
    expect(result.impactClosure).toBeUndefined();
  });

  it("rejects conflicting duplicate revalidation outputs instead of last-write-wins", async () => {
    const engine = new InvalidationEngine({ derivations: new DerivationIndex([
      record("contract", [["artifact", "handler"]], "public-v1"),
      record("client", [["unit", "contract"]]),
    ]) });
    const result = await engine.invalidate(event("handler"), {
      revalidate: async () => [
        { unitId: "contract", signature: signature("public-v1") },
        { unitId: "contract", signature: signature("public-v2") },
      ],
    });
    expect(result.backdatedUnitIds).toEqual([]);
    expect(result.diagnostics.some((diagnostic) => diagnostic.includes("duplicate revalidation output contract"))).toBe(true);
  });

  it("does not let a shared-bug clean rebuild override contradictory independent conformance", () => {
    const verdict = compareCorrectnessOracles({
      rebuild: { incrementalHash: hash("same-wrong"), cleanHash: hash("same-wrong") },
      conformance: [validation({ status: "failed", summary: "runtime behavior contradicts extracted contract" })],
      historical: [],
    });
    expect(verdict.rebuildConsistent).toBe(true);
    expect(verdict.strongCompletion).toBe(false);
    expect(verdict.contradictions).toEqual(["runtime behavior contradicts extracted contract"]);
  });

  it("does not treat same-packet agreement as independent conformance", () => {
    const verdict = compareCorrectnessOracles({
      rebuild: { incrementalHash: hash("same"), cleanHash: hash("same") },
      conformance: [validation({ evidenceLane: "same-packet-agent", independenceGroup: "packet" })],
      historical: [],
    });
    expect(verdict.conformancePassed).toBe(false);
    expect(verdict.strongCompletion).toBe(false);
  });

  it("does not grant strong completion to weak, ungrouped, correlated conformance evidence", () => {
    const verdict = compareCorrectnessOracles({
      rebuild: { incrementalHash: hash("same"), cleanHash: hash("same") },
      conformance: [validation({ assurance: "weak", independenceGroup: "", authorSource: "same-packet-agent" })],
      historical: [],
    });
    expect(verdict.conformancePassed).toBe(false);
    expect(verdict.strongCompletion).toBe(false);
  });

  it("rejects same-packet authorship even when the evidence lane is otherwise independent", () => {
    const verdict = compareCorrectnessOracles({
      rebuild: { incrementalHash: hash("same"), cleanHash: hash("same") },
      conformance: [validation({ evidenceLane: "test", independenceGroup: "packet", authorSource: "same-packet-agent" })],
      historical: [],
    });
    expect(verdict.conformancePassed).toBe(false);
    expect(verdict.strongCompletion).toBe(false);
  });

  it("retains exact provenance when an independent traversal lane is unavailable", async () => {
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["unit:export"] }],
      traverse: async () => { throw new Error("reverse index unavailable"); },
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex([record("export", [["artifact", "selector:public"]])]),
      impactRules: new ImpactRuleRegistry([publicRule()]),
      impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: createStateBinding({ compiledAgainst: event("selector:public").stateDigest, valueDependencies: [], queryDependencies: [] }),
      revalidate: async () => [],
    });
    expect(result.impactClosure?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ unitId: "export", disposition: "known", proofClass: "exact-derivation", observability: "closed" }),
      expect.objectContaining({ unitId: "export", disposition: "unavailable", proofClass: "unavailable", observability: "unavailable" }),
    ]));
    const known = result.impactClosure?.entries.find(({ unitId, disposition }) => unitId === "export" && disposition === "known");
    expect(known?.reasons.some((reason) => reason.includes("reverse index unavailable"))).toBe(false);
  });

  it("keeps successful traversal unavailable reasons off an independent exact-known entry", async () => {
    const port: ImpactRuleEvaluationPort = {
      subjects: async () => [{ id: "export", values: { tag: ["public"] }, dependencyKeys: ["unit:export"] }],
      traverse: async () => ({
        knownIds: [], possibleIds: [], unavailableIds: ["export"], observability: "bounded",
        reasons: { export: ["external reverse lane unavailable"] },
      }),
    };
    const result = await new InvalidationEngine({
      derivations: new DerivationIndex([record("export", [["artifact", "selector:public"]])]),
      impactRules: new ImpactRuleRegistry([publicRule()]), impactPort: port,
    }).invalidate(event("selector:public", "membership-change"), {
      stateBinding: createStateBinding({ compiledAgainst: event("selector:public").stateDigest, valueDependencies: [], queryDependencies: [] }),
      revalidate: async () => [],
    });

    const known = result.impactClosure?.entries.find(({ unitId, disposition }) => unitId === "export" && disposition === "known");
    const unavailable = result.impactClosure?.entries.find(({ unitId, disposition }) => unitId === "export" && disposition === "unavailable");
    expect(known?.reasons).not.toContain("external reverse lane unavailable");
    expect(unavailable?.reasons).toContain("external reverse lane unavailable");
  });
});
