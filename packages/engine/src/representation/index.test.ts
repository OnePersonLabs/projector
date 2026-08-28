import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { hashFramedDomain, type StateBinding } from "@projector/core";

import {
  BUILT_IN_REPRESENTATION_PROFILE_KEYS,
  BUILT_IN_REPRESENTATION_PROFILES,
  canonicalRepresentationSourceFromSemanticChange,
  RepresentationCompiler,
  type CanonicalRepresentationSource,
  type RepresentationArtifactStore,
  type TokenMeasurementPort,
  lintHumanTechnical,
} from "./index.js";

const humanTechnicalProfileKey = BUILT_IN_REPRESENTATION_PROFILE_KEYS.humanTechnical;
const behaviorGherkinProfileKey = BUILT_IN_REPRESENTATION_PROFILE_KEYS.behaviorGherkin;
const agentCompactProfileKey = BUILT_IN_REPRESENTATION_PROFILE_KEYS.agentCompact;
const machineInvariantProfileKey = BUILT_IN_REPRESENTATION_PROFILE_KEYS.machineInvariant;

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
    const keys = [humanTechnicalProfileKey, behaviorGherkinProfileKey, agentCompactProfileKey, machineInvariantProfileKey] as const;
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
      .compile({ source, binding, profileKey: behaviorGherkinProfileKey });
    const rendered = await artifacts.get(result.projection.contentHash);

    expect(rendered).toContain("# source: scenario:delete");
    expect(rendered).toMatch(/Given production data exists[\s\S]*When the user approves deletion[\s\S]*Then deleteProductionData runs[\s\S]*But deletion runs before approval/u);
  });

  it("fails closed for independently parsed protected drift", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const projection = await compiler.compile({ source, binding, profileKey: agentCompactProfileKey });
    const exact = (await artifacts.get(projection.projection.contentHash))!;
    const cases = [
      [exact.replace("FORBID NOT", "PERMIT NOT"), "normative-force"],
      [exact.replace("IFF", "AND"), "logical-connective"],
      [exact.replace("EXACTLY-ONE", "ONE-OR-MORE"), "quantifier-cardinality"],
      [exact.replace(" | EXCEPT explicit user approval", ""), "exception"],
    ] as const;
    for (const [candidate, dimension] of cases) {
      await expect(compiler.validateCandidate({ source, profileKey: agentCompactProfileKey, candidate })).rejects.toMatchObject({ dimension });
    }
  });

  it("accepts the exact machine kernel and preserves every protected literal", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const result = await compiler.compile({ source, binding, profileKey: machineInvariantProfileKey });
    const rendered = await artifacts.get(result.projection.contentHash);
    for (const literal of source.statements[0]!.protectedLiterals) expect(rendered).toContain(literal);
    await expect(compiler.validateCandidate({ source, profileKey: machineInvariantProfileKey, candidate: rendered! })).resolves.toBeDefined();
  });

  it("derives exact observations by parsing candidate structure rather than comparing bytes", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const result = await compiler.compile({ source, binding, profileKey: machineInvariantProfileKey });
    const exact = (await artifacts.get(result.projection.contentHash))!;
    const cosmetic = JSON.stringify(JSON.parse(exact), null, 2);
    await expect(compiler.validateCandidate({ source, profileKey: machineInvariantProfileKey, candidate: cosmetic }))
      .resolves.toMatchObject({ assurance: "exact", unsupportedDimensions: [] });

    const contradictory = JSON.parse(exact) as { statements: Array<{ force: string }> };
    contradictory.statements[0]!.force = "permit";
    await expect(compiler.validateCandidate({ source, profileKey: machineInvariantProfileKey, candidate: JSON.stringify(contradictory) }))
      .rejects.toMatchObject({ dimension: "normative-force" });
    await expect(compiler.validateCandidate({ source, profileKey: machineInvariantProfileKey, candidate: "not a deterministic kernel" }))
      .rejects.toThrow(/parse|prove|unsupported/u);
  });

  it("rejects dropped scope, guards, order, identities, literals, and swapped Gherkin roles", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compact = await compiler.compile({ source, binding, profileKey: agentCompactProfileKey });
    const compactText = (await artifacts.get(compact.projection.contentHash))!;
    const failures = [
      [compactText.replace("production data", "data"), "scope"],
      [compactText.replace("IF explicit user approval", "explicit user approval"), "condition-guard"],
      [compactText.replace("authenticate > approve > delete", "delete > approve > authenticate"), "dependency-order"],
      [compactText.replace("concept:production-data", "concept:data"), "concept-identity"],
      [compactText.replace("src/data/delete.ts", "src/data/remove.ts"), "identifier-literal"],
    ] as const;
    for (const [candidate, dimension] of failures) {
      await expect(compiler.validateCandidate({ source, profileKey: agentCompactProfileKey, candidate })).rejects.toMatchObject({ dimension });
    }
    const gherkin = await compiler.compile({ source, binding, profileKey: behaviorGherkinProfileKey });
    const swapped = (await artifacts.get(gherkin.projection.contentHash))!.replace("Given production data exists", "When production data exists");
    await expect(compiler.validateCandidate({ source, profileKey: behaviorGherkinProfileKey, candidate: swapped }))
      .rejects.toMatchObject({ dimension: "behavior-step-role" });
  });

  it("rejects invented compact abbreviations unless measured utility and clarity are supplied", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compact = await compiler.compile({ source, binding, profileKey: agentCompactProfileKey });
    const invented = `${(await artifacts.get(compact.projection.contentHash))!.replace("\nSCENARIO", " | PDA\nSCENARIO")}`;
    await expect(compiler.validateCandidate({ source, profileKey: agentCompactProfileKey, candidate: invented }))
      .rejects.toMatchObject({ dimension: "identifier-literal" });
    await expect(compiler.validateCandidate({
      source,
      profileKey: agentCompactProfileKey, candidate: invented,
      measuredAbbreviations: [{ abbreviation: "PDA", tokenSavings: 2, clarityValidated: true }],
    })).rejects.toThrow(/exact|candidate|semantic/u);
  });

  it("falls back for measured net-negative compact output but selects compact for measured positive utility", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const terseBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, text: "MUST_NOT delete." }] };
    const terse = { ...terseBody, sourceSemanticHash: canonicalSourceHash(terseBody) };
    const negative = await compiler.compileBest({ source: terse, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 50 });
    const largeBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, text: Array(30).fill("Please note that the system really must not delete production data unless explicit user approval.").join(" ") }] };
    const large = { ...largeBody, sourceSemanticHash: canonicalSourceHash(largeBody) };
    const positive = await compiler.compileBest({ source: large, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 1 });

    expect(negative.projection.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES[machineInvariantProfileKey].id);
    expect(negative.projection.status).toBe("fallback-used");
    expect(negative.fallback?.tier).toBe("exact-machine-plus-advisory-compact");
    expect(negative.advisoryProjection?.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES[agentCompactProfileKey].id);
    expect(negative.projection.tokenAccounting?.estimatedNetTokens).toBeLessThanOrEqual(0);
    expect(positive.projection.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES[agentCompactProfileKey].id);
    expect(positive.projection.tokenAccounting?.estimatedNetTokens).toBeGreaterThan(0);
  });

  it("selects compact by measured net instruction efficiency and falls back when compact fidelity is unsafe", async () => {
    const artifacts = new MemoryArtifacts();
    const utility = {
      profileId: "instruction-utility@1",
      measure: ({ profileKey }: { readonly profileKey: string }) => ({
        netInstructionEfficiency: profileKey === agentCompactProfileKey ? -3 : 4,
        evidence: "held-out task completion cost",
      }),
    };
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured, utility });
    const inefficient = await compiler.compileBest({ source, binding, requestedProfileKey: agentCompactProfileKey });
    expect(inefficient.fallback?.tier).toBe("exact-machine-plus-advisory-compact");
    expect(inefficient.advisoryProjection?.tokenAccounting).toMatchObject({
      estimatedNetInstructionEfficiency: -3,
      utilityProfileId: "instruction-utility@1",
    });

    const exact = await new RepresentationCompiler({ artifacts, tokenizer: measured })
      .compile({ source, binding, profileKey: agentCompactProfileKey });
    const unsafeCandidate = (await artifacts.get(exact.projection.contentHash))!.replace("FORBID NOT", "PERMIT NOT");
    const unsafe = await compiler.compileBest({ source, binding, requestedProfileKey: agentCompactProfileKey, candidate: unsafeCandidate });
    expect(unsafe.fallback?.tier).toBe("exact-machine-plus-advisory-compact");
    expect(unsafe.advisoryProjection).toBeUndefined();
    expect(unsafe.projection.status).toBe("fallback-used");
  });

  it("derives the projection source from the complete authenticated semantic change instead of caller-authored representation input", () => {
    const semanticChange = {
      id: "change:representation", request: "MUST preserve API_V2", normalizedIntent: "preserve API_V2",
      intentAnalysisId: "intent:1", identityResolutionIds: ["identity:api"], relevanceClosureId: "closure:1",
      analysisFacetKeys: ["contract"], operations: [{ subjectType: "other" as const, subjectKey: "API_V2", kind: "modify" as const, payload: { literal: "API_V2" } }],
      decisionIds: ["decision:api"], assumptions: ["consumer remains compatible"], boundary: ["packages/api/**"], risk: {
        class: "R1" as const, inherentOperationRisk: 1, affectedUnitCount: 1, affectedSurfaceCount: 1,
        publicContractImpact: true, externalImpact: false, dataImpact: false, reversibility: "full" as const,
        validationStrength: "strong" as const, closureConfidence: "bounded" as const, unresolvedIdentityCount: 0,
        relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0,
        suspectDecisionCount: 0, compensationAvailable: true, reasons: [],
      }, status: "analyzed" as const,
    };
    const first = canonicalRepresentationSourceFromSemanticChange(semanticChange);
    const changed = canonicalRepresentationSourceFromSemanticChange({ ...semanticChange, assumptions: ["consumer migration required"] });
    expect(first.sourceEntityIds).toContain("change-directive:change:representation");
    expect(first.statements[0]).toMatchObject({ scope: ["packages/api/**"], dependencies: expect.arrayContaining(["decision:api", "identity:api"]), protectedLiterals: expect.arrayContaining(["API_V2", "packages/api/**"]) });
    expect(changed.sourceSemanticHash).not.toBe(first.sourceSemanticHash);
  });

  it("emits dedicated representation telemetry for accepted projections and fallback decisions", async () => {
    const artifacts = new MemoryArtifacts(); const observations: unknown[] = [];
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured, telemetry: { record: async (observation) => { observations.push(observation); } } });
    await compiler.compileBest({ source, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 100 });
    expect(observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "representation.compiled", profileId: "profile:agent-compact", protectedDimensionCount: 11, fidelityStatus: "valid" }),
      expect.objectContaining({ event: "representation.fallback", requestedProfileId: "profile:agent-compact", tier: "exact-machine-plus-advisory-compact" }),
    ]));
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
    const result = await compiler.compile({ source, binding, profileKey: humanTechnicalProfileKey });
    artifacts.values.set(result.projection.contentHash, "edited derived rendering");
    expect(await compiler.verifyArtifact(result.projection)).toMatchObject({ status: "invalid" });
    expect(source).toEqual(before);
  });

  it("keeps projection identity stable under incidental source ordering and rejects conflicting duplicate source IDs", async () => {
    const compiler = new RepresentationCompiler({ artifacts: new MemoryArtifacts(), tokenizer: measured });
    const first = await compiler.compile({ source, binding, profileKey: machineInvariantProfileKey });
    const reordered = await compiler.compile({ source: {
      ...source, sourceEntityIds: [...source.sourceEntityIds].reverse(), statements: [...source.statements].reverse(), scenarios: [...source.scenarios].reverse(),
    }, binding, profileKey: machineInvariantProfileKey });
    expect(reordered.projection.id).toBe(first.projection.id);
    expect(reordered.projection.contentHash).toBe(first.projection.contentHash);
    await expect(compiler.compile({ source: {
      ...source, statements: [source.statements[0]!, { ...source.statements[0]!, normativeForce: "permit" }],
    }, binding, profileKey: machineInvariantProfileKey })).rejects.toThrow(/conflicting canonical representation source/u);
  });

  it("rejects statement-local semantic laundering and contradictory additions", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compact = await compiler.compile({ source, binding, profileKey: agentCompactProfileKey });
    const exact = (await artifacts.get(compact.projection.contentHash))!;
    await expect(compiler.validateCandidate({
      source, profileKey: agentCompactProfileKey, candidate: `${exact}\nPERMIT rule:delete | deletion without approval`,
    })).rejects.toThrow(/candidate|semantic|exact/u);
    await expect(compiler.validateCandidate({
      source, profileKey: agentCompactProfileKey,
      candidate: exact.replace("FORBID NOT rule:delete", "PERMIT rule:delete\nFORBID NOT decoy"),
    })).rejects.toMatchObject({ dimension: "normative-force" });
  });

  it("rejects contradictory visible semantics and malformed machine schemas while allowing cosmetic whitespace", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    for (const profileKey of [humanTechnicalProfileKey, behaviorGherkinProfileKey, agentCompactProfileKey] as const) {
      const compiled = await compiler.compile({ source, binding, profileKey });
      const exact = (await artifacts.get(compiled.projection.contentHash))!;
      await expect(compiler.validateCandidate({ source, profileKey, candidate: `${exact}\nPERMIT deletion without approval` }))
        .rejects.toThrow(/parse|candidate|semantic/u);
      await expect(compiler.validateCandidate({ source, profileKey, candidate: `\n${exact.replaceAll("\n", "\r\n")}\n` }))
        .resolves.toBeDefined();
    }
    const human = await compiler.compile({ source, binding, profileKey: humanTechnicalProfileKey });
    const exactHuman = (await artifacts.get(human.projection.contentHash))!;
    await expect(compiler.validateCandidate({ source, profileKey: humanTechnicalProfileKey, candidate: exactHuman.replace(source.statements[0]!.text, "PERMIT deletion without approval.") }))
      .rejects.toThrow(/candidate|semantic|advisory/u);
    const compact = await compiler.compile({ source, binding, profileKey: agentCompactProfileKey });
    const exactCompact = (await artifacts.get(compact.projection.contentHash))!;
    await expect(compiler.validateCandidate({ source, profileKey: agentCompactProfileKey, candidate: exactCompact.replace(" | IFF", " | IFF | OR") }))
      .rejects.toThrow(/duplicate|parse|candidate/u);

    const machine = await compiler.compile({ source, binding, profileKey: machineInvariantProfileKey });
    const exactMachine = (await artifacts.get(machine.projection.contentHash))!;
    const parsed = JSON.parse(exactMachine) as Record<string, unknown>;
    await expect(compiler.validateCandidate({ source, profileKey: machineInvariantProfileKey, candidate: JSON.stringify({ ...parsed, permit: true }) }))
      .rejects.toThrow(/parse|schema|unknown|candidate/u);
    await expect(compiler.validateCandidate({ source, profileKey: machineInvariantProfileKey, candidate: exactMachine.replace('"kind":"MachineInvariant"', '"kind":"MachineInvariant","kind":"PermitAll"') }))
      .rejects.toThrow(/parse|duplicate|candidate/u);
  });

  it("rejects duplicate protected keys and semantic advisory punctuation while permitting whitespace-only edits", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const candidates = new Map<string, string>();
    for (const profileKey of [machineInvariantProfileKey, humanTechnicalProfileKey, behaviorGherkinProfileKey] as const) {
      const compiled = await compiler.compile({ source, binding, profileKey });
      candidates.set(profileKey, (await artifacts.get(compiled.projection.contentHash))!);
    }
    const lessAggressive = await new RepresentationCompiler({
      artifacts, tokenizer: measured, fallbackGate: (tier) => tier === "less-aggressive-compact",
    }).compileBest({ source, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 100 });
    candidates.set(agentCompactProfileKey, (await artifacts.get(lessAggressive.projection.contentHash))!);

    for (const [profileKey, exact] of candidates) {
      for (const duplicate of [
        exact.replace('"force":"forbid"', '"force":"permit","force":"forbid"'),
        exact.replace('"negated":true', '"negated":false,"negated":true'),
      ]) {
        await expect(compiler.validateCandidate({
          source, profileKey: profileKey as keyof typeof BUILT_IN_REPRESENTATION_PROFILES, candidate: duplicate,
        })).rejects.toThrow(/duplicate.*JSON.*key|candidate.*parse/u);
      }
    }

    const exactHuman = candidates.get(humanTechnicalProfileKey)!;
    const cosmeticAdvisory = exactHuman.replace(
      JSON.stringify(source.statements[0]!.text),
      JSON.stringify("  MUST_NOT   delete production\n  data unless explicit user approval.  "),
    );
    await expect(compiler.validateCandidate({ source, profileKey: humanTechnicalProfileKey, candidate: cosmeticAdvisory }))
      .resolves.toMatchObject({ assurance: "exact" });
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(
        "MUST_NOT delete production data unless explicit user approval.",
        "  MUST_NOT   delete production data unless explicit user approval.  ",
        "MUST_NOT\n delete production\tdata unless explicit user approval.",
      ),
      async (advisory) => {
        const candidate = exactHuman.replace(JSON.stringify(source.statements[0]!.text), JSON.stringify(advisory));
        await expect(compiler.validateCandidate({ source, profileKey: humanTechnicalProfileKey, candidate })).resolves.toMatchObject({ assurance: "exact" });
      },
    ));
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(
        "MUST_NOT delete production data unless explicit user approval!",
        "MUST_NOT delete production data unless explicit user approval...",
        "MUST_NOT delete production data, unless explicit user approval.",
        "MUST_NOT delete production data unless explicit user approval?",
      ),
      async (advisory) => {
        const candidate = exactHuman.replace(JSON.stringify(source.statements[0]!.text), JSON.stringify(advisory));
        await expect(compiler.validateCandidate({ source, profileKey: humanTechnicalProfileKey, candidate }))
          .rejects.toThrow(/advisory|semantic|candidate/u);
      },
    ));
    await expect(compiler.validateCandidate({
      source, profileKey: humanTechnicalProfileKey,
      candidate: exactHuman.replace(JSON.stringify(source.statements[0]!.text), JSON.stringify("MUST_NOT delete data or backups.")),
    })).rejects.toThrow(/advisory|semantic|candidate/u);
  });

  it("rejects collapsed whitespace inside a declared protected advisory literal", async () => {
    const body = {
      ...sourceBody,
      statements: [{
        ...sourceBody.statements[0]!,
        text: "Keep X  Y unchanged.",
        protectedLiterals: ["X  Y"],
      }],
    };
    const literalSource = { ...body, sourceSemanticHash: canonicalSourceHash(body) };
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compiled = await compiler.compile({ source: literalSource, binding, profileKey: humanTechnicalProfileKey });
    const exact = (await artifacts.get(compiled.projection.contentHash))!;
    const collapsed = exact.replace(JSON.stringify("Keep X  Y unchanged."), JSON.stringify("Keep X Y unchanged."));

    await expect(compiler.validateCandidate({ source: literalSource, profileKey: humanTechnicalProfileKey, candidate: collapsed }))
      .rejects.toMatchObject({ dimension: "identifier-literal" });
  });

  it("rejects internal whitespace drift in smart-quoted literals through the public compile and validate path", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(
        ["Preserve “Exact  error” unchanged.", "Preserve “Exact error” unchanged."],
        ["Preserve ‘Exact  error’ unchanged.", "Preserve ‘Exact error’ unchanged."],
      ),
      async ([canonicalText, collapsedText]) => {
        const body = {
          ...sourceBody,
          statements: [{ ...sourceBody.statements[0]!, text: canonicalText, protectedLiterals: [] }],
        };
        const literalSource = { ...body, sourceSemanticHash: canonicalSourceHash(body) };
        const artifacts = new MemoryArtifacts();
        const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
        const compiled = await compiler.compile({ source: literalSource, binding, profileKey: humanTechnicalProfileKey });
        const exact = (await artifacts.get(compiled.projection.contentHash))!;
        const candidate = exact.replace(JSON.stringify(canonicalText), JSON.stringify(collapsedText));

        await expect(compiler.validateCandidate({ source: literalSource, profileKey: humanTechnicalProfileKey, candidate }))
          .rejects.toMatchObject({ dimension: "identifier-literal" });
      },
    ));
  });

  it("rejects internal whitespace drift in ordinary error-code messages through the public compile and validate path", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(
        ["Preserve ENOENT:  file missing.", "Preserve ENOENT: file missing."],
        ["Preserve EACCES:  permission denied.", "Preserve EACCES: permission denied."],
      ),
      async ([canonicalText, collapsedText]) => {
        const body = {
          ...sourceBody,
          statements: [{ ...sourceBody.statements[0]!, text: canonicalText, protectedLiterals: [] }],
        };
        const literalSource = { ...body, sourceSemanticHash: canonicalSourceHash(body) };
        const artifacts = new MemoryArtifacts();
        const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
        const compiled = await compiler.compile({ source: literalSource, binding, profileKey: humanTechnicalProfileKey });
        const exact = (await artifacts.get(compiled.projection.contentHash))!;
        const candidate = exact.replace(JSON.stringify(canonicalText), JSON.stringify(collapsedText));

        await expect(compiler.validateCandidate({ source: literalSource, profileKey: humanTechnicalProfileKey, candidate }))
          .rejects.toMatchObject({ dimension: "identifier-literal" });
      },
    ));
  });

  it("permits cosmetic whitespace normalization after an ordinary uppercase prose label", async () => {
    const canonicalText = "EXAMPLE: ordinary  prose remains readable.";
    const body = {
      ...sourceBody,
      statements: [{ ...sourceBody.statements[0]!, text: canonicalText, protectedLiterals: [] }],
    };
    const proseSource = { ...body, sourceSemanticHash: canonicalSourceHash(body) };
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compiled = await compiler.compile({ source: proseSource, binding, profileKey: humanTechnicalProfileKey });
    const exact = (await artifacts.get(compiled.projection.contentHash))!;
    const candidate = exact.replace(JSON.stringify(canonicalText), JSON.stringify("EXAMPLE: ordinary prose remains readable."));

    await expect(compiler.validateCandidate({ source: proseSource, profileKey: humanTechnicalProfileKey, candidate }))
      .resolves.toMatchObject({ assurance: "exact" });
  });

  it("permits cosmetic wrapping around exact literals and rejects literal byte, count, and boundary drift", async () => {
    const canonicalText = "Run command `pnpm  test` after approval, preserve \"Exact  error\", call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.";
    const body = {
      ...sourceBody,
      statements: [{
        ...sourceBody.statements[0]!,
        text: canonicalText,
        protectedLiterals: ["café"],
      }],
    };
    const literalSource = { ...body, sourceSemanticHash: canonicalSourceHash(body) };
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compiled = await compiler.compile({ source: literalSource, binding, profileKey: humanTechnicalProfileKey });
    const exact = (await artifacts.get(compiled.projection.contentHash))!;
    const candidateFor = (advisory: string) => exact.replace(JSON.stringify(canonicalText), JSON.stringify(advisory));

    await fc.assert(fc.asyncProperty(
      fc.constantFrom(" ", "\n", "\t", " \r\n  "),
      fc.constantFrom(" ", "\n", "\t", "  \n"),
      async (beforeLiteral, afterLiteral) => {
        const advisory = `Run command${beforeLiteral}\`pnpm  test\`${afterLiteral}after approval, preserve \"Exact  error\", call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.`;
        await expect(compiler.validateCandidate({ source: literalSource, profileKey: humanTechnicalProfileKey, candidate: candidateFor(advisory) }))
          .resolves.toMatchObject({ assurance: "exact" });
      },
    ));

    await fc.assert(fc.asyncProperty(
      fc.constantFrom(
        "Run command `pnpm test` after approval, preserve \"Exact  error\", call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.",
        "Run command `pnpm  test` after approval, preserve \"Exact error\", call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.",
        "Run command `pnpm  test` after approval, preserve 'Exact  error', call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.",
        "Run command `pnpm  test` after approval, preserve \"Exact  error\", call deleteProductionData at src/data/delete.ts with 30GB, then keep café.",
        "Run command `pnpm  test` after approval, preserve \"Exact  error\", call deleteProductionData at src/data/remove.ts with 30 GB, then keep café.",
        "Run command `pnpm  test` after approval, preserve \"Exact  error\", call deleteProductionData at src/data/delete.ts with 30 GB, then keep cafe\u0301.",
        "Run command `pnpm  test` after approval, preserve \"Exact  error\" \"Exact  error\", call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.",
        "Run command `pnpm  test` after approval, preserve, call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.",
        "Run command`pnpm  test` after approval, preserve \"Exact  error\", call deleteProductionData at src/data/delete.ts with 30 GB, then keep café.",
      ),
      async (advisory) => {
        await expect(compiler.validateCandidate({ source: literalSource, profileKey: humanTechnicalProfileKey, candidate: candidateFor(advisory) }))
          .rejects.toThrow(/literal|advisory|semantic|candidate/u);
      },
    ));
  });

  it("does not grant exact assurance when punctuation changes advisory force or scope", async () => {
    const body = {
      ...sourceBody,
      statements: [{ ...sourceBody.statements[0]!, text: "No users allowed." }],
    };
    const punctuationSource = { ...body, sourceSemanticHash: canonicalSourceHash(body) };
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const compiled = await compiler.compile({ source: punctuationSource, binding, profileKey: humanTechnicalProfileKey });
    const exact = (await artifacts.get(compiled.projection.contentHash))!;
    const ambiguous = exact.replace(JSON.stringify("No users allowed."), JSON.stringify("No, users allowed."));

    await expect(compiler.validateCandidate({ source: punctuationSource, profileKey: humanTechnicalProfileKey, candidate: ambiguous }))
      .rejects.toMatchObject({ dimension: "normative-force" });
  });

  it("derives canonical membership and semantic identity from trusted structured input", async () => {
    const compiler = new RepresentationCompiler({ artifacts: new MemoryArtifacts(), tokenizer: measured });
    await expect(compiler.compile({ source: { ...source, sourceEntityIds: [] }, binding, profileKey: machineInvariantProfileKey }))
      .rejects.toThrow(/source membership/u);
    await expect(compiler.compile({ source: { ...source, sourceSemanticHash: hashFramedDomain("test", "lie") }, binding, profileKey: machineInvariantProfileKey }))
      .rejects.toThrow(/semantic hash/u);
    await expect(compiler.compile({ source: { ...source, sourceEntityIds: [...source.sourceEntityIds, "rule:delete"] }, binding, profileKey: machineInvariantProfileKey }))
      .rejects.toThrow(/duplicate source membership/u);
    const changedBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, normativeForce: "permit" as const }] };
    const changed = await compiler.compile({ source: { ...changedBody, sourceSemanticHash: canonicalSourceHash(changedBody) }, binding, profileKey: machineInvariantProfileKey });
    const original = await compiler.compile({ source, binding, profileKey: machineInvariantProfileKey });
    expect(changed.projection.id).not.toBe(original.projection.id);
  });

  it("reports accounting for the accepted fallback artifact rather than rejected compact bytes", async () => {
    const artifacts = new MemoryArtifacts();
    const compiler = new RepresentationCompiler({ artifacts, tokenizer: measured });
    const terseBody = { ...sourceBody, statements: [{ ...sourceBody.statements[0]!, text: "MUST_NOT delete." }] };
    const terse = { ...terseBody, sourceSemanticHash: canonicalSourceHash(terseBody) };
    const result = await compiler.compileBest({ source: terse, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 50 });
    const accepted = (await artifacts.get(result.projection.contentHash))!;
    expect(result.projection.tokenAccounting?.outputTokens).toBe(measured.measure(accepted));
    expect(result.projection.profileId).not.toBe(BUILT_IN_REPRESENTATION_PROFILES[agentCompactProfileKey].id);
  });

  it("binds each typed source member exactly once and rejects cross-kind identity collisions", async () => {
    const result = await new RepresentationCompiler({ artifacts: new MemoryArtifacts(), tokenizer: measured })
      .compile({ source, binding, profileKey: machineInvariantProfileKey });
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
      source: { ...collisionBody, sourceSemanticHash: canonicalSourceHash(collisionBody) }, binding, profileKey: machineInvariantProfileKey,
    })).rejects.toThrow(/cross-kind|collision/u);
  });

  it("attempts every safer fallback tier in order and blocks after exhausting them", async () => {
    const attempted: string[] = [];
    const compiler = new RepresentationCompiler({
      artifacts: new MemoryArtifacts(), tokenizer: measured,
      fallbackGate: (tier) => { attempted.push(tier); return tier === "human-technical"; },
    });
    const result = await compiler.compileBest({ source, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 100 });
    expect(attempted).toEqual(["exact-machine-plus-advisory-compact", "less-aggressive-compact", "human-technical"]);
    expect(result.fallback).toMatchObject({ tier: "human-technical", status: "fallback-used" });
    expect(result.projection.profileId).toBe(BUILT_IN_REPRESENTATION_PROFILES[humanTechnicalProfileKey].id);
    expect(result.projection.tokenAccounting?.outputTokens).toBeGreaterThan(0);

    const lessArtifacts = new MemoryArtifacts();
    const lessAggressive = await new RepresentationCompiler({
      artifacts: lessArtifacts, tokenizer: measured,
      fallbackGate: (tier) => tier === "less-aggressive-compact",
    }).compileBest({ source, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 100 });
    expect(lessAggressive.fallback).toEqual({ tier: "less-aggressive-compact", status: "fallback-used" });
    expect(await lessArtifacts.get(lessAggressive.projection.contentHash)).toMatch(/^STATEMENT /u);
    expect(lessAggressive.projection.tokenAccounting?.outputTokens)
      .toBe(measured.measure((await lessArtifacts.get(lessAggressive.projection.contentHash))!));

    const blockedAttempts: string[] = [];
    const blocked = new RepresentationCompiler({
      artifacts: new MemoryArtifacts(), tokenizer: measured,
      fallbackGate: (tier) => { blockedAttempts.push(tier); return false; },
    });
    await expect(blocked.compileBest({ source, binding, requestedProfileKey: agentCompactProfileKey, profileOverheadTokens: 100 }))
      .rejects.toThrow(/fallback.*block/u);
    expect(blockedAttempts).toEqual(["exact-machine-plus-advisory-compact", "less-aggressive-compact", "human-technical"]);
  });
});
