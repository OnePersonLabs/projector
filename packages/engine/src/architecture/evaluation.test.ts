import {
  hashFramedDomain,
  type AdapterContext,
  type ArchitectureConcern,
  type ArchitectureDecision,
  type ContentHash,
  type DecisionOption,
  type DeveloperPreference,
  type RelevanceClosure,
  type SelectorExpr,
  type StateBindingValidation,
  type StateQueryDependency,
} from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import {
  assessDecisionValidity,
  assessDecisionDeferral,
  captureDecisionStateBinding,
  evaluateDecisionOptions,
  validateDecisionDeferral,
} from "./evaluation.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;
const scope = (platform: string): SelectorExpr => ({ op: "atom", field: "platform", matcher: "equals", value: platform });
const closure = {
  id: "closure:one", requestHash: hash("request"), seeds: [], entries: [], activatedFacetKeys: [], unknowns: [], unavailableLanes: [],
  boundState: {
    compiledAgainst: { gitBase: "base", worktreeDigest: hash("worktree"), canonicalProjectorDigest: hash("canonical"), toolchainDigest: hash("toolchain") },
    valueDependencies: [], queryDependencies: [], dependencyDigest: hash("binding"),
  }, contentHash: hash("closure"),
} satisfies RelevanceClosure;
const query = (id: string, observability: "closed" | "open" | "unavailable", count: number): StateQueryDependency => ({
  role: "decision-applicability",
  query: { id, kind: "decision-applicability", programId: "architecture.applicability", programVersion: "1", input: {}, semanticHash: hash(`${id}-query`) },
  priorResult: { queryHash: hash(`${id}-query`), resultHash: hash(`${id}-result`), resultCount: count, observability, assumptions: [], unavailableLanes: observability === "unavailable" ? ["semantic-index"] : [], dependencyKeys: [`decision:${id}`] },
});
const decision = {
  id: "decision:web", key: "web-runtime", concernId: "concern:runtime", title: "Web runtime", decision: "retain web runtime", selectedOptionKey: "retain",
  scope: scope("web"), lifecycle: "active", authorityRecordId: "authority:web", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hash("decision"),
} satisfies ArchitectureDecision;
const concern = {
  id: "concern:runtime", key: "runtime", title: "Runtime", question: "Which runtime boundary?", scope: scope("desktop"), sourceClass: "derived",
  status: "active", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [], evidence: [], semanticHash: hash("concern"),
} satisfies ArchitectureConcern;
const option = (key: string, hardConstraintStatus: DecisionOption["hardConstraintStatus"] = "passes"): DecisionOption => ({
  key, title: key, description: key, hardConstraintStatus, tradeoffs: [], evidence: [], preferenceFit: [],
});
const preference = (id: string, key: string, preferenceScope: DeveloperPreference["scope"], strength: DeveloperPreference["strength"]): DeveloperPreference => ({
  id, key, scope: preferenceScope, selector: scope("desktop"), strength, statement: key, status: "active", sourceClass: "authored",
  semanticHash: hashFramedDomain("developer-preference", { id, key, scope: preferenceScope, selector: scope("desktop"), strength, statement: key, status: "active", sourceClass: "authored" }),
});
const adapterContext: AdapterContext = { repositoryRoot: "/repo", stateDigest: closure.boundState.compiledAgainst, config: {}, signal: new AbortController().signal };
const evaluationPorts = (preferences: readonly DeveloperPreference[] = [], matches: Readonly<Record<string, readonly string[]>> = {}, research?: { verifyOptionSet: ReturnType<typeof vi.fn> }) => ({
  ...(research === undefined ? {} : { research }),
  preferences: { read: async (id: string) => preferences.find((item) => item.id === id), match: async ({ preference: item }: { preference: DeveloperPreference }) => matches[item.id] ?? [] },
  authority: { read: async () => undefined },
});

describe("scoped decision proof and StateBinding", () => {
  it("binds applicability and negative-space queries and never treats open empty results as absence", async () => {
    const binding = captureDecisionStateBinding({ closure, applicabilityQueries: [query("applicable", "closed", 1)], negativeSpaceQueries: [query("negative", "open", 0)] });
    expect(binding.queryDependencies.map(({ query: dependency }) => dependency.id)).toEqual(["applicable", "negative"]);

    const validation: StateBindingValidation = { status: "suspect", currentState: closure.boundState.compiledAgainst, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: ["open empty result"] };
    await expect(assessDecisionValidity({ decision, currentScope: scope("web"), binding, currentState: closure.boundState.compiledAgainst, context: adapterContext, firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [] }, { bindingValidator: { validate: async () => validation }, applicability: { evaluate: async () => ({ applicable: false, governedPopulationCount: 0, dependency: query("negative", "open", 0) }) } })).resolves.toMatchObject({ state: "suspect", blocksCurrentChange: true });
  });

  it("keeps disjoint decisions valid and treats lost proof as suspect rather than migration", async () => {
    const current: StateBindingValidation = { status: "current", currentState: closure.boundState.compiledAgainst, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] };
    const dependency = query("disjoint", "closed", 0);
    const binding = captureDecisionStateBinding({ closure, applicabilityQueries: [dependency], negativeSpaceQueries: [] });
    await expect(assessDecisionValidity({ decision, currentScope: scope("desktop"), binding, currentState: closure.boundState.compiledAgainst, context: adapterContext, firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [] }, { bindingValidator: { validate: async () => current }, applicability: { evaluate: async () => ({ applicable: false, governedPopulationCount: 0, dependency }) } })).resolves.toMatchObject({ state: "valid", blocksCurrentChange: false });
    const suspect = await assessDecisionValidity({ decision, currentScope: scope("web"), binding, currentState: closure.boundState.compiledAgainst, context: adapterContext, firedTriggers: [{ type: "evidence-refresh-required", policyKey: "platform" }], invalidatedAssumptions: [], staleEvidenceIds: ["evidence:platform"] }, { bindingValidator: { validate: async () => ({ ...current, status: "stale" }) }, applicability: { evaluate: async () => ({ applicable: false, governedPopulationCount: 0, dependency }) } });
    expect(suspect.state).toBe("suspect");
    expect(suspect.explanation).not.toMatch(/migration required/iu);
  });
});

describe("research, options, preferences, and deferral", () => {
  it("verifies only the affected option set through the port and blocks unavailable automatic acceptance", async () => {
    const verifyOptionSet = vi.fn().mockResolvedValue({ options: [option("retain")], evidenceIds: [], unavailable: true, uncertainty: ["official capability unavailable"] });
    const result = await evaluateDecisionOptions({ concern, options: [option("retain"), option("replace")], preferenceIds: [], research: { required: true, affectedEvidenceIds: ["evidence:platform"] }, acceptance: { kind: "automatic" } }, evaluationPorts([], {}, { verifyOptionSet }));
    expect(verifyOptionSet).toHaveBeenCalledWith(expect.objectContaining({ affectedEvidenceIds: ["evidence:platform"] }));
    expect(result.evaluation.outcome).toBe("insufficient-evidence");
    expect(result.acceptanceBlocked).toBe(true);

    const explicit = await evaluateDecisionOptions({ concern, options: [option("retain")], preferenceIds: [], research: { required: true, affectedEvidenceIds: ["evidence:platform"] }, acceptance: { kind: "explicit-user", authorityRecordId: "authority:missing" } }, evaluationPorts([], {}, { verifyOptionSet }));
    expect(explicit.acceptanceBlocked).toBe(true);
    expect(explicit.evaluation.unknowns).toContain("official capability unavailable");
  });

  it("eliminates hard failures, keeps unknowns explicit, and lets project preferences dominate ranking without creating authority", async () => {
    const user = preference("preference:user", "managed", "user", "strongly-prefer");
    const project = preference("preference:project", "local", "project", "prefer");
    const result = await evaluateDecisionOptions({
      concern,
      options: [option("managed"), option("local"), option("forbidden", "fails"), option("uncertain", "unknown")],
      preferenceIds: [user.id, project.id],
      research: { required: false, affectedEvidenceIds: [] },
      acceptance: { kind: "automatic" },
    }, evaluationPorts([user, project], { [user.id]: ["managed"], [project.id]: ["local"] }));
    expect(result.evaluation.eliminatedOptionKeys).toEqual(["forbidden"]);
    expect(result.evaluation.recommendedOptionKey).toBe("local");
    expect(result.evaluation.unknowns.join(" ")).toMatch(/uncertain/iu);
    expect(result.appliedPreferences).toEqual([expect.objectContaining({ key: "local", scope: "project" })]);
    expect(result.governanceConsequences).toEqual([]);
  });

  it("accepts a negative/simple option and requires neutral, trigger-bound deferral", async () => {
    const result = await evaluateDecisionOptions({ concern, options: [option("do-not-add-orchestrator")], preferenceIds: [], research: { required: false, affectedEvidenceIds: [] }, acceptance: { kind: "automatic" } }, evaluationPorts());
    expect(result.evaluation.recommendedOptionKey).toBe("do-not-add-orchestrator");
    expect(result.governanceConsequences).toEqual([]);
    expect(validateDecisionDeferral({ rationale: "scripts suffice", preserveOptionality: ["portable task entrypoints"], forbiddenCommitments: ["orchestrator-specific task APIs"], reconsiderWhen: [{ type: "scale-signal" } as never] })).toMatchObject({ valid: false });
    expect(validateDecisionDeferral({ rationale: "scripts suffice", preserveOptionality: ["portable task entrypoints"], forbiddenCommitments: ["irreversible coupling"], reconsiderWhen: [{ type: "manual-review" }] })).toMatchObject({ valid: true });
    await expect(assessDecisionDeferral(
      { rationale: "temporary", preserveOptionality: ["portable tasks"], forbiddenCommitments: ["irreversible coupling"], reconsiderWhen: [{ type: "manual-review" }] },
      { assess: async () => ({ compatibilityPreserving: true, optionalityPreserved: true, secretlySelectsOption: true, irreversibleCommitments: [] }) },
    )).resolves.toMatchObject({ valid: false });
  });
});
