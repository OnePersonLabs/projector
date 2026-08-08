import type {
  ArchitectureConcern,
  ArchitectureDecision,
  ContentHash,
  DecisionOption,
  DeveloperPreference,
  RelevanceClosure,
  SelectorExpr,
  StateBindingValidation,
  StateQueryDependency,
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
  id, key, scope: preferenceScope, selector: scope("desktop"), strength, statement: key, status: "active", sourceClass: "authored", semanticHash: hash(id),
});

describe("scoped decision proof and StateBinding", () => {
  it("binds applicability and negative-space queries and never treats open empty results as absence", () => {
    const binding = captureDecisionStateBinding({ closure, applicabilityQueries: [query("applicable", "closed", 1)], negativeSpaceQueries: [query("negative", "open", 0)] });
    expect(binding.queryDependencies.map(({ query: dependency }) => dependency.id)).toEqual(["applicable", "negative"]);

    const validation: StateBindingValidation = { status: "suspect", currentState: closure.boundState.compiledAgainst, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: ["open empty result"] };
    expect(assessDecisionValidity({ decision, currentScope: scope("web"), applicable: true, bindingValidation: validation, firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], governedPopulationCount: 1 })).toMatchObject({ state: "suspect", blocksCurrentChange: true });
  });

  it("keeps disjoint decisions valid and treats lost proof as suspect rather than migration", () => {
    const current: StateBindingValidation = { status: "current", currentState: closure.boundState.compiledAgainst, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] };
    expect(assessDecisionValidity({ decision, currentScope: scope("desktop"), applicable: false, bindingValidation: current, firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], governedPopulationCount: 1 })).toMatchObject({ state: "valid", blocksCurrentChange: false });
    const suspect = assessDecisionValidity({ decision, currentScope: scope("web"), applicable: true, bindingValidation: { ...current, status: "stale" }, firedTriggers: [{ type: "evidence-refresh-required", policyKey: "platform" }], invalidatedAssumptions: [], staleEvidenceIds: ["evidence:platform"], governedPopulationCount: 1 });
    expect(suspect.state).toBe("suspect");
    expect(suspect.explanation).not.toMatch(/migration required/iu);
  });
});

describe("research, options, preferences, and deferral", () => {
  it("verifies only the affected option set through the port and blocks unavailable automatic acceptance", async () => {
    const verifyOptionSet = vi.fn().mockResolvedValue({ options: [option("retain")], evidenceIds: [], unavailable: true, uncertainty: ["official capability unavailable"] });
    const result = await evaluateDecisionOptions({ concern, options: [option("retain"), option("replace")], preferences: [], preferenceMatches: {}, research: { required: true, affectedEvidenceIds: ["evidence:platform"] }, acceptance: "automatic" }, { verifyOptionSet });
    expect(verifyOptionSet).toHaveBeenCalledWith(expect.objectContaining({ affectedEvidenceIds: ["evidence:platform"] }));
    expect(result.evaluation.outcome).toBe("insufficient-evidence");
    expect(result.acceptanceBlocked).toBe(true);

    const explicit = await evaluateDecisionOptions({ concern, options: [option("retain")], preferences: [], preferenceMatches: {}, research: { required: true, affectedEvidenceIds: ["evidence:platform"] }, acceptance: "explicit-user" }, { verifyOptionSet });
    expect(explicit.acceptanceBlocked).toBe(false);
    expect(explicit.evaluation.unknowns).toContain("official capability unavailable");
  });

  it("eliminates hard failures, keeps unknowns explicit, and lets project preferences dominate ranking without creating authority", async () => {
    const user = preference("preference:user", "managed", "user", "strongly-prefer");
    const project = preference("preference:project", "local", "project", "prefer");
    const result = await evaluateDecisionOptions({
      concern,
      options: [option("managed"), option("local"), option("forbidden", "fails"), option("uncertain", "unknown")],
      preferences: [user, project],
      preferenceMatches: { [user.id]: ["managed"], [project.id]: ["local"] },
      research: { required: false, affectedEvidenceIds: [] },
      acceptance: "automatic",
    });
    expect(result.evaluation.eliminatedOptionKeys).toEqual(["forbidden"]);
    expect(result.evaluation.recommendedOptionKey).toBe("local");
    expect(result.evaluation.unknowns.join(" ")).toMatch(/uncertain/iu);
    expect(result.appliedPreferences).toEqual([expect.objectContaining({ key: "local", scope: "project" })]);
    expect(result.governanceConsequences).toEqual([]);
  });

  it("accepts a negative/simple option and requires neutral, trigger-bound deferral", async () => {
    const result = await evaluateDecisionOptions({ concern, options: [option("do-not-add-orchestrator")], preferences: [], preferenceMatches: {}, research: { required: false, affectedEvidenceIds: [] }, acceptance: "automatic" });
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
