import {
  hashFramedDomain,
  hashSemantic,
  type AdapterContext,
  type ArchitectureConcern,
  type ArchitectureDecision,
  type AuthorityRecord,
  type ContentHash,
  type DecisionDeferral,
  type DecisionOption,
  type DeveloperPreference,
  type RelevanceClosure,
  type SelectorExpr,
  type StateBindingValidation,
  type StateQueryDependency,
} from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { discoverArchitectureConcerns } from "./discovery.js";
import { assessDecisionValidity, captureDecisionStateBinding, evaluateDecisionOptions } from "./evaluation.js";
import { acceptArchitectureDecisions } from "./governance.js";
import { auditArchitectureDecisions, runArchitecturePreflight } from "./preflight.js";

const rawHash = (character: string): ContentHash => `sha256:v1:${character.repeat(64)}`;
const sharedScope: SelectorExpr = { op: "atom", field: "platform", matcher: "equals", value: "shared" };
const currentState = { gitBase: "base", worktreeDigest: rawHash("1"), canonicalProjectorDigest: rawHash("2"), toolchainDigest: rawHash("3") };
const context: AdapterContext = { repositoryRoot: "/repo", stateDigest: currentState, config: {}, signal: new AbortController().signal };
const query = (observability: "closed" | "open" = "closed", count = 1): StateQueryDependency => ({
  role: "decision-applicability",
  query: { id: "decision-applicability", kind: "decision-applicability", programId: "architecture.applicability", programVersion: "1", input: {}, semanticHash: rawHash("4") },
  priorResult: { queryHash: rawHash("4"), resultHash: rawHash("5"), resultCount: count, observability, assumptions: [], unavailableLanes: [], dependencyKeys: ["decision:runtime"] },
});
const closure = (facets: string[] = []): RelevanceClosure => ({
  id: "closure:repair", requestHash: rawHash("6"), seeds: [], entries: [], activatedFacetKeys: facets, unknowns: [], unavailableLanes: [],
  boundState: { compiledAgainst: currentState, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) },
  contentHash: rawHash("7"),
});
const concern = (status: ArchitectureConcern["status"] = "active", deferral?: DecisionDeferral): ArchitectureConcern => ({
  id: "concern:runtime", key: "runtime", title: "Runtime", question: "Which runtime?", scope: sharedScope, sourceClass: "derived", status, materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [], ...(deferral === undefined ? {} : { deferral }), evidence: [], semanticHash: rawHash("8"),
});
const makeDecision = (id: string, target?: string): ArchitectureDecision => {
  const base: Omit<ArchitectureDecision, "semanticHash"> = {
    id, key: id, concernId: "concern:runtime", title: id, decision: id, selectedOptionKey: id, scope: sharedScope, lifecycle: "active", authorityRecordId: `authority:${id}`,
    governanceBasis: [], consequences: target === undefined ? [] : [{ kind: "constrain-decision", targetId: target, scope: sharedScope, explanation: "coupled" }], appliedPreferences: [], supersedesDecisionIds: [],
  };
  return { ...base, semanticHash: hashSemantic("architecture-decision", base) };
};
const makeAuthority = (decision: ArchitectureDecision, conclusion: AuthorityRecord["conclusion"] = "preserve"): AuthorityRecord => {
  const base: Omit<AuthorityRecord, "semanticHash"> = {
    id: decision.authorityRecordId, key: decision.authorityRecordId, subjectId: decision.concernId, status: "approved", conclusion, rationale: "authenticated", alternatives: [], assumptions: [], reconsiderWhen: [],
    vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 1, ecosystemHealth: 1, securitySupport: 1, reversibility: 1, migrationCost: 0, counterEvidence: 0 },
    assessmentConfidence: "high", evidence: [], governanceRiskClass: "R2", decidedBy: "user", createdAt: "2026-08-08",
  };
  return { ...base, semanticHash: hashSemantic("authority-record", base) };
};
const option = (key: string): DecisionOption => ({ key, title: key, description: key, hardConstraintStatus: "passes", tradeoffs: [], evidence: [], preferenceFit: [] });
const preference = (): DeveloperPreference => {
  const base: Omit<DeveloperPreference, "semanticHash"> = { id: "preference:project", key: "local", scope: "project", selector: sharedScope, strength: "prefer", statement: "local", status: "active", sourceClass: "authored" };
  return { ...base, semanticHash: hashFramedDomain("developer-preference", base) };
};

describe("authenticated proof boundaries", () => {
  it("derives applicability and binding validity from current-state ports", async () => {
    const dependency = query("open", 0);
    const binding = captureDecisionStateBinding({ closure: closure(), applicabilityQueries: [dependency], negativeSpaceQueries: [] });
    const validate = vi.fn().mockResolvedValue({ status: "suspect", currentState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: ["open empty"] } satisfies StateBindingValidation);
    const evaluate = vi.fn().mockResolvedValue({ applicable: false, governedPopulationCount: 0, dependency });
    const result = await assessDecisionValidity({ decision: makeDecision("decision:runtime"), currentScope: sharedScope, binding, currentState, context, firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [] }, { bindingValidator: { validate }, applicability: { evaluate } });
    expect(validate).toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalled();
    expect(result).toMatchObject({ state: "suspect", blocksCurrentChange: true });
  });

  it("authenticates preference matches and explicit uncertainty authority", async () => {
    const projectPreference = preference();
    const exceptionDecision = makeDecision("decision:exception");
    const exception = makeAuthority(exceptionDecision, "exception");
    const ports = {
      research: { verifyOptionSet: vi.fn().mockResolvedValue({ options: [option("local")], evidenceIds: [], unavailable: true, uncertainty: ["offline"] }) },
      preferences: { read: vi.fn().mockResolvedValue(projectPreference), match: vi.fn().mockResolvedValue(["local"]) },
      authority: { read: vi.fn().mockResolvedValue(exception) },
    };
    const rejected = await evaluateDecisionOptions({ concern: concern(), options: [option("local")], preferenceIds: [projectPreference.id], research: { required: true, affectedEvidenceIds: [] }, acceptance: { kind: "explicit-user", authorityRecordId: exception.id } }, { ...ports, authority: { read: vi.fn().mockResolvedValue({ ...exception, semanticHash: rawHash("f") }) } });
    expect(rejected.acceptanceBlocked).toBe(true);
    const accepted = await evaluateDecisionOptions({ concern: concern(), options: [option("local")], preferenceIds: [projectPreference.id], research: { required: true, affectedEvidenceIds: [] }, acceptance: { kind: "explicit-user", authorityRecordId: exception.id } }, ports);
    expect(accepted.acceptanceBlocked).toBe(false);
    expect(accepted.appliedPreferences).toEqual([expect.objectContaining({ semanticHash: projectPreference.semanticHash })]);
  });
});

describe("typed discovery and verified deferral", () => {
  it("activates minimal held-out platform concerns without public-contract over-expansion", () => {
    const platform = discoverArchitectureConcerns({ closure: closure(), changes: [{ kind: "surface-added", activationFacets: ["platform-target"], subjectIds: ["windows"], explanation: "new public platform", scope: sharedScope }], inferred: [] });
    expect(platform.concerns.map(({ key }) => key)).toEqual(expect.arrayContaining(["cross-platform-runtime", "build-release"]));
    const contractOnly = discoverArchitectureConcerns({ closure: closure(), changes: [{ kind: "constraint-delta", activationFacets: ["public-contract"], subjectIds: ["contract:checkout"], explanation: "narrow contract", scope: sharedScope }], inferred: [] });
    expect(contractOnly.concerns.map(({ key }) => key)).toEqual(["api-contract"]);
    expect(contractOnly.concerns.some(({ key }) => key === "distribution-signing")).toBe(false);
  });

  it("rejects any verified originating-decision inference and requires semantic deferral assessment", async () => {
    const provenanceHash = hashFramedDomain("architecture-concern-origin", { decisionId: "decision:origin" });
    const discovery = discoverArchitectureConcerns({ closure: closure(), changes: [], inferred: [{ key: "loop", title: "Loop", question: "Loop?", scope: sharedScope, materiality: "blocking-now", subjectIds: ["requirement:other"], originatingDecision: { decisionId: "decision:origin", semanticHash: provenanceHash } }] });
    expect(discovery.concerns).toEqual([]);
    const deferral: DecisionDeferral = { rationale: "later", preserveOptionality: ["portable"], forbiddenCommitments: ["irreversible"], reconsiderWhen: [{ type: "manual-review" }] };
    const deferred = concern("deferred", deferral);
    const result = await runArchitecturePreflight({ closure: closure(), concerns: [deferred], validity: [], overrideAuthorityRecordIds: [], mode: "govern", risk: "R2" }, {
      authority: { read: vi.fn() }, validity: { verify: vi.fn() }, deferral: { assess: vi.fn().mockResolvedValue({ compatibilityPreserving: true, optionalityPreserved: true, secretlySelectsOption: true, irreversibleCommitments: [] }) },
    });
    expect(result).toMatchObject({ planningAllowed: false, governedCompletion: false });
  });
});

describe("acceptance convergence and audit set semantics", () => {
  it("blocks a dependency SCC without a fresh successful proof before mutation", async () => {
    const left = makeDecision("decision:left", "decision:right");
    const right = makeDecision("decision:right", "decision:left");
    const records = new Map([[left.authorityRecordId, makeAuthority(left)], [right.authorityRecordId, makeAuthority(right)]]);
    const transact = vi.fn();
    const result = await acceptArchitectureDecisions({ decisions: [left, right], existingDecisions: [] }, {
      authority: { read: async (id: string) => records.get(id) }, overlap: { assess: vi.fn().mockResolvedValue("compatible") }, convergence: { verify: vi.fn().mockResolvedValue(undefined) }, transaction: { transact },
    });
    expect(result).toMatchObject({ activated: false, code: "decision-convergence-failure" });
    expect(transact).not.toHaveBeenCalled();
  });

  it("canonicalizes set-like decision fields and rejects conflicting duplicate IDs", async () => {
    const first = makeDecision("decision:first");
    first.appliedPreferences = [{ key: "a", scope: "project", semanticHash: rawHash("a"), influence: "a" }, { key: "b", scope: "project", semanticHash: rawHash("b"), influence: "b" }];
    const equivalent = { ...makeDecision("decision:equivalent"), concernId: first.concernId, decision: first.decision, selectedOptionKey: first.selectedOptionKey, appliedPreferences: [...first.appliedPreferences].reverse() };
    const ports = { overlap: { assess: vi.fn().mockResolvedValue("compatible") }, population: { inspect: vi.fn().mockResolvedValue({ count: 1, observability: "closed" as const }) } };
    const report = await auditArchitectureDecisions({ decisions: [first, equivalent], concerns: [] }, ports);
    expect(report.findings.map(({ code }) => code)).toContain("equivalent-decisions");
    await expect(auditArchitectureDecisions({ decisions: [first, { ...first, decision: "conflict" }], concerns: [] }, ports)).rejects.toThrow(/conflicting decision/iu);
  });
});
