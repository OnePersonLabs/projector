import { describe, expect, it } from "vitest";

import { hashFramedDomain, type StateBinding } from "@projector/core";

import {
  BUILT_IN_REPRESENTATION_PROFILES,
  RepresentationCompiler,
  type CanonicalRepresentationSource,
  type RepresentationArtifactStore,
  type TokenMeasurementPort,
  lintHumanTechnical,
} from "./index.js";

const state = {
  gitBase: "base",
  worktreeDigest: hashFramedDomain("test", "worktree"),
  canonicalProjectorDigest: hashFramedDomain("test", "canonical"),
  toolchainDigest: hashFramedDomain("test", "toolchain"),
};
const binding: StateBinding = {
  compiledAgainst: state,
  valueDependencies: [{ kind: "canonical-governance", id: "rule:delete", versionHash: hashFramedDomain("test", "rule"), role: "source" }],
  queryDependencies: [],
  dependencyDigest: hashFramedDomain("state-binding-dependencies", {
    valueDependencies: [{ kind: "canonical-governance", id: "rule:delete", versionHash: hashFramedDomain("test", "rule"), role: "source" }],
    queryDependencies: [],
  }),
};

const sourceBody: Omit<CanonicalRepresentationSource, "sourceSemanticHash"> = {
  sourceEntityIds: ["scenario:delete", "rule:delete"],
  statements: [{
    id: "rule:delete",
    text: "MUST_NOT delete production data unless explicit user approval.",
    normativeForce: "forbid",
    negated: true,
    scope: ["production data"],
    cardinality: "exactly-one",
    connective: "iff",
    guard: "explicit user approval",
    exceptions: ["explicit user approval"],
    dependencies: ["authenticate", "approve", "delete"],
    conceptIds: ["concept:production-data"],
    protectedLiterals: ["MUST_NOT", "deleteProductionData", "src/data/delete.ts", "30 GB"],
  }],
  scenarios: [{
    id: "scenario:delete",
    title: "Approved production deletion",
    steps: [
      { role: "precondition", statement: "production data exists" },
      { role: "trigger", statement: "the user approves deletion" },
      { role: "expected-outcome", statement: "deleteProductionData runs" },
      { role: "forbidden-outcome", statement: "deletion runs before approval" },
    ],
  }],
};
class MemoryArtifacts implements RepresentationArtifactStore {
  readonly values = new Map<string, string>();
  async put(hash: string, content: string): Promise<void> { this.values.set(hash, content); }
  async get(hash: string): Promise<string | undefined> { return this.values.get(hash); }
}

const measured: TokenMeasurementPort = {
  profileId: "test-tokenizer@1",
  measure: (text) => text.trim().split(/\s+/u).length,
};

const canonicalSourceHash = (body: Omit<CanonicalRepresentationSource, "sourceSemanticHash">) => hashFramedDomain("canonical-representation-source", {
  sourceEntityIds: [...body.sourceEntityIds].sort(),
  statements: body.statements.map((statement) => ({ ...statement,
    scope: [...statement.scope].sort(), exceptions: [...statement.exceptions].sort(),
    conceptIds: [...statement.conceptIds].sort(), protectedLiterals: [...statement.protectedLiterals].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id)),
  scenarios: [...body.scenarios].sort((a, b) => a.id.localeCompare(b.id)),
});
const source: CanonicalRepresentationSource = { ...sourceBody, sourceSemanticHash: canonicalSourceHash(sourceBody) };

describe("semantic representation compilation", () => {
  it("compiles all built-ins from one canonical source while keeping rendered content behind the artifact port", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const keys = ["human-technical@1", "behavior-gherkin@1", "agent-compact@1", "machine-invariant@1"] as const;
    const results = await Promise.all(keys.map((profileKey) => compiler.compile({ source, binding, profileKey })));

    expect(new Set(results.map(({ projection }) => projection.sourceSemanticHash))).toEqual(new Set([source.sourceSemanticHash]));
    expect(new Set(results.map(({ projection }) => projection.contentHash)).size).toBe(4);
    expect(results.every(({ projection }) => projection.preservation.unsupportedDimensions.length === 0)).toBe(true);
    expect(results.every(({ projection }) => projection.preservation.assurance === "exact")).toBe(true);
    expect(results.map(({ projection }) => projection.sourceEntityIds)).toEqual(Array(4).fill(["rule:delete", "scenario:delete"]));
    expect(Object.keys(results[0]!.projection)).not.toContain("content");
    expect(artifacts.values.size).toBe(4);
    expect(results[0]!.projection.boundState.valueDependencies.map(({ kind, id }) => `${kind}:${id}`).sort()).toEqual([
      "canonical-entity:statement:rule:delete", "canonical-entity:scenario:scenario:delete", "canonical-governance:rule:delete", "representation-profile:profile:human-technical",
    ].sort());
    expect(() => results[0]!.projection.boundState.valueDependencies.push(binding.valueDependencies[0]!)).toThrow();
  });

  it("preserves Gherkin source identity and step roles in order", async () => {
    const artifacts = new MemoryArtifacts();
    const result = await new RepresentationCompiler({ artifacts, tokenizer: measured })
      .compile({ source, binding, profileKey: "behavior-gherkin@1" });
    const rendered = await artifacts.get(result.projection.contentHash);

    expect(rendered).toContain("# source: scenario:delete");
    expect(rendered).toMatch(/Given production data exists[\s\S]*When the user approves deletion[\s\S]*Then deleteProductionData runs[\s\S]*But deletion runs before approval/u);
  });

  it("fails closed for independently parsed protected drift", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const projection = await compiler.compile({ source, binding, profileKey: "agent-compact@1" });
    const exact = (await artifacts.get(projection.projection.contentHash))!;
    const cases = [
      [exact.replace("FORBID NOT", "PERMIT NOT"), "normative-force"],
      [exact.replace("IFF", "AND"), "logical-connective"],
      [exact.replace("EXACTLY-ONE", "ONE-OR-MORE"), "quantifier-cardinality"],
      [exact.replace(" | EXCEPT explicit user approval", ""), "exception"],
    ] as const;
    for (const [candidate, dimension] of cases) {
      await expect(compiler.validateCandidate({ source, profileKey: "agent-compact@1", candidate })).rejects.toMatchObject({ dimension });
    }
  });

  it("accepts the exact machine kernel and preserves every protected literal", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const result = await compiler.compile({ source, binding, profileKey: "machine-invariant@1" });
    const rendered = await artifacts.get(result.projection.contentHash);
    for (const literal of source.statements[0]!.protectedLiterals) expect(rendered).toContain(literal);
    await expect(compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: rendered! })).resolves.toBeDefined();
  });

  it("derives exact observations by parsing candidate structure rather than comparing bytes", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const result = await compiler.compile({ source, binding, profileKey: "machine-invariant@1" });
    const exact = (await artifacts.get(result.projection.contentHash))!;
    const cosmetic = JSON.stringify(JSON.parse(exact), null, 2);
    await expect(compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: cosmetic }))
      .resolves.toMatchObject({ assurance: "exact", unsupportedDimensions: [] });

    const contradictory = JSON.parse(exact) as { statements: Array<{ force: string }> };
    contradictory.statements[0]!.force = "permit";
    await expect(compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: JSON.stringify(contradictory) }))
      .rejects.toMatchObject({ dimension: "normative-force" });
    await expect(compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: "not a deterministic kernel" }))
      .rejects.toThrow(/parse|prove|unsupported/u);
  });

  it("rejects dropped scope, guards, order, identities, literals, and swapped Gherkin roles", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compact = await compiler.compile({ source, binding, profileKey: "agent-compact@1" });
    const compactText = (await artifacts.get(compact.projection.contentHash))!;
    const failures = [
      [compactText.replace("production data", "data"), "scope"],
      [compactText.replace("IF explicit user approval", "explicit user approval"), "condition-guard"],
      [compactText.replace("authenticate > approve > delete", "delete > approve > authenticate"), "dependency-order"],
      [compactText.replace("concept:production-data", "concept:data"), "concept-identity"],
      [compactText.replace("src/data/delete.ts", "src/data/remove.ts"), "identifier-literal"],
    ] as const;
    for (const [candidate, dimension] of failures) {
      await expect(compiler.validateCandidate({ source, profileKey: "agent-compact@1", candidate })).rejects.toMatchObject({ dimension });
    }
    const gherkin = await compiler.compile({ source, binding, profileKey: "behavior-gherkin@1" });
    const swapped = (await artifacts.get(gherkin.projection.contentHash))!.replace("Given production data exists", "When production data exists");
    await expect(compiler.validateCandidate({ source, profileKey: "behavior-gherkin@1", candidate: swapped }))
      .rejects.toMatchObject({ dimension: "behavior-step-role" });
  });

  it("rejects invented compact abbreviations unless measured utility and clarity are supplied", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compact = await compiler.compile({ source, binding, profileKey: "agent-compact@1" });
    const invented = `${(await artifacts.get(compact.projection.contentHash))!.replace("\nSCENARIO", " | PDA\nSCENARIO")}`;
    await expect(compiler.validateCandidate({ source, profileKey: "agent-compact@1", candidate: invented }))
      .rejects.toMatchObject({ dimension: "identifier-literal" });
    await expect(compiler.validateCandidate({
      source,
      profileKey: "agent-compact@1", candidate: invented,
      measuredAbbreviations: [{ abbreviation: "PDA", tokenSavings: 2, clarityValidated: true }],
    })).rejects.toThrow(/exact|candidate|semantic/u);
  });

  it("falls back for measured net-negative compact output but selects compact for measured positive utility", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const terseBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, text: "MUST_NOT delete." }] };
    const terse = { ...terseBody, sourceSemanticHash: canonicalSourceHash(terseBody) };
    const negative = await compiler.compileBest({ source: terse, binding, requestedProfileKey: "agent-compact@1", profileOverheadTokens: 50 });
    const largeBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, text: Array(30).fill("Please note that the system really must not delete production data unless explicit user approval.").join(" ") }] };
    const large = { ...largeBody, sourceSemanticHash: canonicalSourceHash(largeBody) };
    const positive = await compiler.compileBest({ source: large, binding, requestedProfileKey: "agent-compact@1", profileOverheadTokens: 1 });

    expect(negative.projection.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES["machine-invariant@1"].id);
    expect(negative.projection.status).toBe("fallback-used");
    expect(negative.fallback?.tier).toBe("exact-machine-plus-advisory-compact");
    expect(negative.advisoryProjection?.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES["agent-compact@1"].id);
    expect(negative.projection.tokenAccounting?.estimatedNetTokens).toBeLessThanOrEqual(0);
    expect(positive.projection.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES["agent-compact@1"].id);
    expect(positive.projection.tokenAccounting?.estimatedNetTokens).toBeGreaterThan(0);
  });

  it("keeps style lint separate from semantic truth and reports blocking mechanics deterministically", () => {
    const report = lintHumanTechnical("Obviously, we'll simply utilize this amazing API; it is very clear.");
    expect(report.blocking.map(({ rule }) => rule)).toEqual(["contraction", "marketing-language", "modal-filler", "semicolon", "verbose-wording"]);
    expect(report.semanticEquivalenceEstablished).toBe(false);
    expect(report.truthEstablished).toBe(false);
  });

  it("detects edited or missing derived artifacts without mutating canonical source", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const before = structuredClone(source);
    const result = await compiler.compile({ source, binding, profileKey: "human-technical@1" });
    artifacts.values.set(result.projection.contentHash, "edited derived rendering");
    expect(await compiler.verifyArtifact(result.projection)).toMatchObject({ status: "invalid" });
    expect(source).toEqual(before);
  });

  it("keeps projection identity stable under incidental source ordering and rejects conflicting duplicate source IDs", async () => {
    const compiler = new RepresentationCompiler({ artifacts: new MemoryArtifacts(), tokenizer: measured });
    const first = await compiler.compile({ source, binding, profileKey: "machine-invariant@1" });
    const reordered = await compiler.compile({ source: {
      ...source, sourceEntityIds: [...source.sourceEntityIds].reverse(), statements: [...source.statements].reverse(), scenarios: [...source.scenarios].reverse(),
    }, binding, profileKey: "machine-invariant@1" });
    expect(reordered.projection.id).toBe(first.projection.id);
    expect(reordered.projection.contentHash).toBe(first.projection.contentHash);
    await expect(compiler.compile({ source: {
      ...source, statements: [source.statements[0]!, { ...source.statements[0]!, normativeForce: "permit" }],
    }, binding, profileKey: "machine-invariant@1" })).rejects.toThrow(/conflicting canonical representation source/u);
  });

  it("rejects statement-local semantic laundering and contradictory additions", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compact = await compiler.compile({ source, binding, profileKey: "agent-compact@1" });
    const exact = (await artifacts.get(compact.projection.contentHash))!;
    await expect(compiler.validateCandidate({
      source, profileKey: "agent-compact@1", candidate: `${exact}\nPERMIT rule:delete | deletion without approval`,
    })).rejects.toThrow(/candidate|semantic|exact/u);
    await expect(compiler.validateCandidate({
      source, profileKey: "agent-compact@1",
      candidate: exact.replace("FORBID NOT rule:delete", "PERMIT rule:delete\nFORBID NOT decoy"),
    })).rejects.toMatchObject({ dimension: "normative-force" });
  });

  it("rejects contradictory visible semantics and malformed machine schemas while allowing cosmetic whitespace", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    for (const profileKey of ["human-technical@1", "behavior-gherkin@1", "agent-compact@1"] as const) {
      const compiled = await compiler.compile({ source, binding, profileKey });
      const exact = (await artifacts.get(compiled.projection.contentHash))!;
      await expect(compiler.validateCandidate({ source, profileKey, candidate: `${exact}\nPERMIT deletion without approval` }))
        .rejects.toThrow(/parse|candidate|semantic/u);
      await expect(compiler.validateCandidate({ source, profileKey, candidate: `\n${exact.replaceAll("\n", "\r\n")}\n` }))
        .resolves.toBeDefined();
    }
    const human = await compiler.compile({ source, binding, profileKey: "human-technical@1" });
    const exactHuman = (await artifacts.get(human.projection.contentHash))!;
    await expect(compiler.validateCandidate({ source, profileKey: "human-technical@1", candidate: exactHuman.replace(source.statements[0]!.text, "PERMIT deletion without approval.") }))
      .rejects.toThrow(/candidate|semantic|advisory/u);
    const compact = await compiler.compile({ source, binding, profileKey: "agent-compact@1" });
    const exactCompact = (await artifacts.get(compact.projection.contentHash))!;
    await expect(compiler.validateCandidate({ source, profileKey: "agent-compact@1", candidate: exactCompact.replace(" | IFF", " | IFF | OR") }))
      .rejects.toThrow(/duplicate|parse|candidate/u);

    const machine = await compiler.compile({ source, binding, profileKey: "machine-invariant@1" });
    const exactMachine = (await artifacts.get(machine.projection.contentHash))!;
    const parsed = JSON.parse(exactMachine) as Record<string, unknown>;
    await expect(compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: JSON.stringify({ ...parsed, permit: true }) }))
      .rejects.toThrow(/parse|schema|unknown|candidate/u);
    await expect(compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: exactMachine.replace('"kind":"MachineInvariant"', '"kind":"MachineInvariant","kind":"PermitAll"') }))
      .rejects.toThrow(/parse|duplicate|candidate/u);
  });

  it("derives canonical membership and semantic identity from trusted structured input", async () => {
    const compiler = new RepresentationCompiler({ artifacts: new MemoryArtifacts(), tokenizer: measured });
    await expect(compiler.compile({ source: { ...source, sourceEntityIds: [] }, binding, profileKey: "machine-invariant@1" }))
      .rejects.toThrow(/source membership/u);
    await expect(compiler.compile({ source: { ...source, sourceSemanticHash: hashFramedDomain("test", "lie") }, binding, profileKey: "machine-invariant@1" }))
      .rejects.toThrow(/semantic hash/u);
    await expect(compiler.compile({ source: { ...source, sourceEntityIds: [...source.sourceEntityIds, "rule:delete"] }, binding, profileKey: "machine-invariant@1" }))
      .rejects.toThrow(/duplicate source membership/u);
    const changedBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, normativeForce: "permit" as const }] };
    const changed = await compiler.compile({ source: { ...changedBody, sourceSemanticHash: canonicalSourceHash(changedBody) }, binding, profileKey: "machine-invariant@1" });
    const original = await compiler.compile({ source, binding, profileKey: "machine-invariant@1" });
    expect(changed.projection.id).not.toBe(original.projection.id);
  });

  it("reports accounting for the accepted fallback artifact rather than rejected compact bytes", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const terseBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, text: "MUST_NOT delete." }] };
    const terse = { ...terseBody, sourceSemanticHash: canonicalSourceHash(terseBody) };
    const result = await compiler.compileBest({ source: terse, binding, requestedProfileKey: "agent-compact@1", profileOverheadTokens: 50 });
    const accepted = (await artifacts.get(result.projection.contentHash))!;
    expect(result.projection.tokenAccounting?.outputTokens).toBe(measured.measure(accepted));
    expect(result.projection.profileId).not.toBe(BUILT_IN_REPRESENTATION_PROFILES["agent-compact@1"].id);
  });

  it("binds each typed source member exactly once and rejects cross-kind identity collisions", async () => {
    const result = await new RepresentationCompiler({ artifacts: new MemoryArtifacts(), tokenizer: measured })
      .compile({ source, binding, profileKey: "machine-invariant@1" });
    const sourceDependencies = result.projection.boundState.valueDependencies
      .filter(({ role }) => role.startsWith("representation-source:"));
    expect(sourceDependencies.map(({ id, role }) => `${role}:${id}`).sort()).toEqual([
      "representation-source:statement:statement:rule:delete",
      "representation-source:scenario:scenario:scenario:delete",
    ].sort());
    expect(new Set(sourceDependencies.map(({ id, versionHash }) => `${id}:${versionHash}`)).size).toBe(2);

    const collisionBody = {
      ...sourceBody,
      sourceEntityIds: ["rule:delete"],
      scenarios: [{ ...sourceBody.scenarios[0]!, id: "rule:delete" }],
    };
    await expect(new RepresentationCompiler({ artifacts: new MemoryArtifacts() }).compile({
      source: { ...collisionBody, sourceSemanticHash: canonicalSourceHash(collisionBody) }, binding, profileKey: "machine-invariant@1",
    })).rejects.toThrow(/cross-kind|collision/u);
  });

  it("attempts every safer fallback tier in order and blocks after exhausting them", async () => {
    const attempted: string[] = [];
    const compiler = new RepresentationCompiler({
      artifacts: new MemoryArtifacts(), tokenizer: measured,
      fallbackGate: (tier) => { attempted.push(tier); return tier === "human-technical"; },
    });
    const result = await compiler.compileBest({ source, binding, requestedProfileKey: "agent-compact@1", profileOverheadTokens: 100 });
    expect(attempted).toEqual(["exact-machine-plus-advisory-compact", "less-aggressive-compact", "human-technical"]);
    expect(result.fallback).toMatchObject({ tier: "human-technical", status: "fallback-used" });
    expect(result.projection.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES["human-technical@1"].id);
    expect(result.projection.tokenAccounting?.outputTokens).toBeGreaterThan(0);

    const lessArtifacts = new MemoryArtifacts();
    const lessAggressive = await new RepresentationCompiler({
      artifacts: lessArtifacts, tokenizer: measured,
      fallbackGate: (tier) => tier === "less-aggressive-compact",
    }).compileBest({ source, binding, requestedProfileKey: "agent-compact@1", profileOverheadTokens: 100 });
    expect(lessAggressive.fallback).toEqual({ tier: "less-aggressive-compact", status: "fallback-used" });
    expect(await lessArtifacts.get(lessAggressive.projection.contentHash)).toMatch(/^STATEMENT /u);
    expect(lessAggressive.projection.tokenAccounting?.outputTokens)
      .toBe(measured.measure((await lessArtifacts.get(lessAggressive.projection.contentHash))!));

    const blockedAttempts: string[] = [];
    const blocked = new RepresentationCompiler({
      artifacts: new MemoryArtifacts(), tokenizer: measured,
      fallbackGate: (tier) => { blockedAttempts.push(tier); return false; },
    });
    await expect(blocked.compileBest({ source, binding, requestedProfileKey: "agent-compact@1", profileOverheadTokens: 100 }))
      .rejects.toThrow(/fallback.*block/u);
    expect(blockedAttempts).toEqual(["exact-machine-plus-advisory-compact", "less-aggressive-compact", "human-technical"]);
  });
});
