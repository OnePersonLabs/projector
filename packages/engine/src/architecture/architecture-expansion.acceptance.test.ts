import {
  RequirementSchema,
  hashFramedDomain,
  hashSemantic,
  type AdapterContext,
  type ArchitectureConcern,
  type ArchitectureDecision,
  type AuthorityRecord,
  type DecisionDeferral,
  type DecisionOption,
  type DeveloperPreference,
  type RelevanceClosure,
  type Requirement,
  type SelectorExpr,
  type StateQueryDependency,
} from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import {
  acceptArchitectureDecisions,
  assessDecisionValidity,
  captureDecisionStateBinding,
  discoverArchitectureConcerns,
  evaluateDecisionOptions,
  runArchitecturePreflight,
  validateDecisionDeferral,
} from "./index.js";

const digest = (label: string) => hashFramedDomain("cross-platform-acceptance-fixture", label);
const scope: SelectorExpr = { op: "atom", field: "platform", matcher: "in", value: ["web", "desktop", "android", "ios"] };
const webScope: SelectorExpr = { op: "atom", field: "platform", matcher: "equals", value: "web" };
const state = { gitBase: "base", worktreeDigest: digest("worktree"), canonicalProjectorDigest: digest("canonical"), toolchainDigest: digest("toolchain") };
const closure: RelevanceClosure = {
  id: "closure:cross-platform-acceptance",
  requestHash: digest("request"),
  seeds: [{ kind: "semantic-entity", subjectId: "requirement:cross-platform-targets", reason: "explicit request", confidence: 1 }],
  entries: [{ entityId: "requirement:cross-platform-targets", band: "direct", score: 1, requiredForPlanning: true, reasons: [] }],
  activatedFacetKeys: ["platform", "public-contract", "distribution"],
  unknowns: [],
  unavailableLanes: [],
  boundState: { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: digest("binding") },
  contentHash: digest("closure"),
};
const context: AdapterContext = { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal };
const option = (key: string, hardConstraintStatus: DecisionOption["hardConstraintStatus"] = "passes"): DecisionOption => ({
  key, title: key, description: key, hardConstraintStatus, tradeoffs: [], evidence: [], preferenceFit: [],
});
const dependency = (count: number): StateQueryDependency => ({
  role: "decision-applicability",
  query: { id: "query:web-decision-applicability", kind: "decision-applicability", programId: "architecture.applicability", programVersion: "1", input: {}, semanticHash: digest("query") },
  priorResult: { queryHash: digest("query"), resultHash: digest(`query-result-${count}`), resultCount: count, observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["decision:web-runtime"] },
});
const authorityFor = (decision: ArchitectureDecision): AuthorityRecord => {
  const base: Omit<AuthorityRecord, "semanticHash"> = {
    id: decision.authorityRecordId,
    key: decision.authorityRecordId,
    subjectId: decision.concernId,
    status: "approved",
    conclusion: "preserve",
    rationale: "explicitly accepted cross-platform architecture decision",
    alternatives: [],
    assumptions: [],
    reconsiderWhen: [{ type: "manual-review" }],
    vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 1, ecosystemHealth: 1, securitySupport: 1, reversibility: 1, migrationCost: 0, counterEvidence: 0 },
    assessmentConfidence: "high",
    evidence: [],
    governanceRiskClass: "R2",
    decidedBy: "user",
    createdAt: "2026-08-27T00:00:00Z",
  };
  return { ...base, semanticHash: hashSemantic("authority-record", base) };
};

describe("cross-platform architecture acceptance", () => {
  it("composes the complete ten-step decision frontier before planning", async () => {
    const requirementBase: Omit<Requirement, "semanticHash"> = {
      id: "requirement:cross-platform-targets",
      key: "cross-platform-targets",
      title: "Desktop and mobile target capabilities",
      aliases: [],
      statement: "The product supports desktop, Android, and iOS capabilities while retaining the web surface.",
      status: "active",
      sourceClass: "authored",
      scope,
      origin: [{ kind: "user-request", locator: "request:cross-platform-targets" }],
      evidence: [],
      discoveryHash: digest("requirement-discovery"),
    };
    const requirement = RequirementSchema.parse({ ...requirementBase, semanticHash: hashSemantic("requirement", requirementBase) }) as Requirement;
    expect(`${requirement.title} ${requirement.statement}`).not.toMatch(/\b(?:nx|turbo|tauri|react native|graphql)\b/iu);

    const discovery = discoverArchitectureConcerns({
      closure,
      changes: [{ kind: "surface-added", activationFacets: ["platform-target", "workspace-expansion", "public-contract", "distribution"], subjectIds: ["desktop", "android", "ios"], explanation: "add target capabilities", scope }],
    });
    const byKey = new Map(discovery.concerns.map((concern) => [concern.key, concern]));
    expect([...byKey.keys()]).toEqual(expect.arrayContaining([
      "workspace-topology", "cross-platform-runtime", "shared-code-boundary", "dependency-version-coherence",
      "api-contract", "build-release", "distribution-signing", "task-orchestration",
    ]));
    expect(discovery.concerns.map(({ materiality }) => materiality)).toEqual(expect.arrayContaining(["blocking-now", "material-soon", "deferable"]));
    expect(discovery.concerns.some(({ title, question }) => /\b(?:nx|turbo|tauri|react native|graphql)\b/iu.test(`${title} ${question}`))).toBe(false);

    const webDecisionBase: Omit<ArchitectureDecision, "semanticHash"> = {
      id: "decision:web-runtime", key: "web-runtime", concernId: "concern:web-runtime", title: "Retain web runtime", decision: "retain web runtime for web", selectedOptionKey: "retain-web-runtime", scope: webScope,
      lifecycle: "active", authorityRecordId: "authority:web-runtime", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [],
    };
    const webDecision = { ...webDecisionBase, semanticHash: hashSemantic("architecture-decision", webDecisionBase) };
    const webDependency = dependency(1);
    const webBinding = captureDecisionStateBinding({ closure, applicabilityQueries: [webDependency], negativeSpaceQueries: [] });
    const webValidity = await assessDecisionValidity({ decision: webDecision, currentScope: webScope, binding: webBinding, currentState: state, context, firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [] }, {
      bindingValidator: { validate: async () => ({ status: "current", currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) },
      applicability: { evaluate: async () => ({ applicable: true, governedPopulationCount: 1, dependency: webDependency }) },
    });
    expect(webValidity).toMatchObject({ state: "valid", blocksCurrentChange: false });

    const runtimeConcern = byKey.get("cross-platform-runtime")!;
    const projectPreferenceBase: Omit<DeveloperPreference, "semanticHash"> = {
      id: "preference:project-runtime", key: "native-shell", scope: "project", selector: scope, strength: "prefer", statement: "Prefer a native shell when otherwise viable.", status: "active", sourceClass: "authored",
    };
    const projectPreference = { ...projectPreferenceBase, semanticHash: hashSemantic("developer-preference", projectPreferenceBase) };
    const verifyRuntimeOptions = vi.fn().mockResolvedValue({ options: [option("native-shell"), option("web-container")], evidenceIds: ["evidence:current-platform-docs"], unavailable: false, uncertainty: [] });
    const runtimeEvaluation = await evaluateDecisionOptions({
      concern: runtimeConcern,
      options: [option("native-shell"), option("web-container")],
      preferenceIds: [projectPreference.id],
      research: { required: true, affectedEvidenceIds: ["evidence:current-platform-docs"] },
      acceptance: { kind: "automatic" },
    }, {
      research: { verifyOptionSet: verifyRuntimeOptions },
      preferences: { read: async () => projectPreference, match: async () => ["native-shell"] },
      authority: { read: async () => undefined },
    });
    expect(verifyRuntimeOptions).toHaveBeenCalledTimes(1);
    expect(runtimeEvaluation.evaluation.recommendedOptionKey).toBe("native-shell");
    expect(runtimeEvaluation.appliedPreferences).toEqual([expect.objectContaining({ key: "native-shell", scope: "project" })]);
    expect(runtimeEvaluation.governanceConsequences).toEqual([]);

    const verifyDependencyOptions = vi.fn().mockResolvedValue({ options: [option("independent-package-versions"), option("pnpm-workspace-catalog")], evidenceIds: ["evidence:pnpm-current-docs"], unavailable: false, uncertainty: [] });
    const dependencyEvaluation = await evaluateDecisionOptions({
      concern: byKey.get("dependency-version-coherence")!,
      options: [option("independent-package-versions"), option("pnpm-workspace-catalog")],
      preferenceIds: [],
      research: { required: true, affectedEvidenceIds: ["evidence:pnpm-current-docs"] },
      acceptance: { kind: "automatic" },
    }, {
      research: { verifyOptionSet: verifyDependencyOptions },
      preferences: { read: async () => undefined, match: async () => [] },
      authority: { read: async () => undefined },
    });
    expect(verifyDependencyOptions).toHaveBeenCalledWith(expect.objectContaining({ concern: expect.objectContaining({ key: "dependency-version-coherence" }) }));
    expect(dependencyEvaluation.evaluation.options.map(({ key }) => key)).toContain("pnpm-workspace-catalog");

    const deferral: DecisionDeferral = { rationale: "plain workspace scripts remain sufficient", preserveOptionality: ["portable task entrypoints"], forbiddenCommitments: ["irreversible orchestrator coupling"], reconsiderWhen: [{ type: "manual-review" }] };
    expect(validateDecisionDeferral(deferral)).toMatchObject({ valid: true });
    const orchestrationEvaluation = await evaluateDecisionOptions({
      concern: byKey.get("task-orchestration")!,
      options: [option("plain-workspace-scripts"), option("nx", "fails"), option("turbo", "fails")],
      preferenceIds: [], research: { required: false, affectedEvidenceIds: [] }, acceptance: { kind: "automatic" },
    }, { preferences: { read: async () => undefined, match: async () => [] }, authority: { read: async () => undefined } });
    expect(orchestrationEvaluation.evaluation.recommendedOptionKey).toBe("plain-workspace-scripts");

    const runtimeDecisionBase: Omit<ArchitectureDecision, "semanticHash"> = {
      id: "decision:cross-platform-runtime", key: "cross-platform-runtime", concernId: runtimeConcern.id, title: "Cross-platform runtime boundary", decision: "use the accepted native-shell boundary", selectedOptionKey: runtimeEvaluation.evaluation.recommendedOptionKey!, scope,
      lifecycle: "active", authorityRecordId: "authority:cross-platform-runtime", governanceBasis: [],
      consequences: [
        { kind: "activate-governance", targetId: "rule:shared-code-boundary", scope, payload: { artifactKind: "rule" }, explanation: "compile the shared-code rule" },
        { kind: "activate-governance", targetId: "lens:platform-contract", scope, payload: { artifactKind: "lens" }, explanation: "compile the platform contract lens" },
        { kind: "require-migration", targetId: "migration:web-to-cross-platform", scope, payload: { artifactKind: "migration" }, explanation: "compile the compatibility migration" },
      ],
      appliedPreferences: runtimeEvaluation.appliedPreferences,
      supersedesDecisionIds: [],
      migrationId: "migration:web-to-cross-platform",
    };
    const runtimeDecision = { ...runtimeDecisionBase, semanticHash: hashSemantic("architecture-decision", runtimeDecisionBase) };
    const transaction = vi.fn().mockResolvedValue(undefined);
    await expect(acceptArchitectureDecisions({ decisions: [runtimeDecision], existingDecisions: [webDecision] }, {
      authority: { read: async () => authorityFor(runtimeDecision) },
      overlap: { assess: async () => "compatible" },
      convergence: { verify: async () => undefined },
      transaction: { transact: transaction },
    })).resolves.toMatchObject({ activated: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(expect.objectContaining({ consequences: expect.arrayContaining([
      expect.objectContaining({ payload: { artifactKind: "rule" } }),
      expect.objectContaining({ payload: { artifactKind: "lens" } }),
      expect.objectContaining({ payload: { artifactKind: "migration" } }),
    ]) }));

    const preflightPorts = {
      authority: { read: async () => undefined },
      validity: { verify: async () => true },
      deferral: { assess: async () => ({ compatibilityPreserving: true, optionalityPreserved: true, secretlySelectsOption: false, irreversibleCommitments: [] }) },
    };
    await expect(runArchitecturePreflight({ closure, concerns: discovery.concerns, validity: [], overrideAuthorityRecordIds: [], mode: "govern", risk: "R2" }, preflightPorts)).resolves.toMatchObject({ planningAllowed: false, governedCompletion: false });
    const resolvedFrontier: ArchitectureConcern[] = discovery.concerns.map((concern) => concern.key === "task-orchestration"
      ? { ...concern, status: "deferred", deferral }
      : concern.materiality === "blocking-now" ? { ...concern, status: "resolved" } : concern);
    await expect(runArchitecturePreflight({ closure, concerns: resolvedFrontier, validity: [], overrideAuthorityRecordIds: [], mode: "govern", risk: "R2" }, preflightPorts)).resolves.toMatchObject({ planningAllowed: true, governedCompletion: true, code: "architecture-frontier-clear" });
  });

  it("measures held-out concern discovery without fixture-name routing", async () => {
    const expectedKeys = [
      "api-contract", "build-release", "cross-platform-runtime", "dependency-version-coherence",
      "distribution-signing", "shared-code-boundary", "task-orchestration", "workspace-topology",
    ];
    const variants = [
      { subjects: ["surface:aurora", "surface:ember", "surface:tide"], facets: ["platform-target", "workspace-expansion", "public-contract", "distribution"] as const, explanation: "extend delivery to three governed environments" },
      { subjects: ["capability:quartz", "capability:reed", "capability:sable"], facets: ["distribution", "public-contract", "workspace-expansion", "platform-target"] as const, explanation: "mutation variant with reordered signals" },
      { subjects: ["target:one", "target:two", "target:three"], facets: ["public-contract", "platform-target", "distribution", "workspace-expansion"] as const, explanation: "structural variant with opaque target names" },
    ];
    const measurements = variants.map((variant) => {
      const discovered = discoverArchitectureConcerns({ closure, changes: [{ kind: "requirement-delta", activationFacets: variant.facets, subjectIds: variant.subjects, explanation: variant.explanation, scope }] });
      const keys = discovered.concerns.map(({ key }) => key).sort();
      return {
        discovered,
        recall: expectedKeys.filter((key) => keys.includes(key)).length / expectedKeys.length,
        irrelevantRate: keys.filter((key) => !expectedKeys.includes(key)).length / keys.length,
        questionCount: new Set(discovered.concerns.map(({ question }) => question)).size,
        deferableKeys: discovered.concerns.filter(({ materiality }) => materiality === "deferable").map(({ key }) => key),
      };
    });
    expect(measurements.map(({ recall }) => recall)).toEqual([1, 1, 1]);
    expect(measurements.map(({ irrelevantRate }) => irrelevantRate)).toEqual([0, 0, 0]);
    expect(measurements.map(({ questionCount }) => questionCount)).toEqual([8, 8, 8]);
    expect(measurements.map(({ deferableKeys }) => deferableKeys)).toEqual([["task-orchestration"], ["task-orchestration"], ["task-orchestration"]]);

    const priorDecisionBase: Omit<ArchitectureDecision, "semanticHash"> = {
      id: "decision:held-out-prior", key: "held-out-prior", concernId: "concern:held-out-prior", title: "Prior target decision", decision: "retain while proof remains current", selectedOptionKey: "retain", scope,
      lifecycle: "active", authorityRecordId: "authority:held-out-prior", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [],
    };
    const priorDecision = { ...priorDecisionBase, semanticHash: hashSemantic("architecture-decision", priorDecisionBase) };
    const applicability = dependency(1);
    const binding = captureDecisionStateBinding({ closure, applicabilityQueries: [applicability], negativeSpaceQueries: [] });
    await expect(assessDecisionValidity({ decision: priorDecision, currentScope: scope, binding, currentState: state, context, firedTriggers: [{ type: "evidence-refresh-required", policyKey: "platform-capability" }], invalidatedAssumptions: [], staleEvidenceIds: ["evidence:old-platform-capability"] }, {
      bindingValidator: { validate: async () => ({ status: "stale", currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [applicability.query.id], reasons: ["held-out membership changed"] }) },
      applicability: { evaluate: async () => ({ applicable: true, governedPopulationCount: 1, dependency: applicability }) },
    })).resolves.toMatchObject({ state: "suspect", blocksCurrentChange: true });

    const verifyOptionSet = vi.fn().mockResolvedValue({ options: [option("current-supported"), option("current-unsupported", "fails")], evidenceIds: ["evidence:current-held-out-capability"], unavailable: false, uncertainty: [] });
    const evaluated = await evaluateDecisionOptions({ concern: measurements[0]!.discovered.concerns.find(({ key }) => key === "cross-platform-runtime")!, options: [option("unverified-placeholder")], preferenceIds: [], research: { required: true, affectedEvidenceIds: ["evidence:old-platform-capability"] }, acceptance: { kind: "automatic" } }, {
      research: { verifyOptionSet }, preferences: { read: async () => undefined, match: async () => [] }, authority: { read: async () => undefined },
    });
    expect(verifyOptionSet).toHaveBeenCalledWith(expect.objectContaining({ affectedEvidenceIds: ["evidence:old-platform-capability"] }));
    expect(evaluated.evaluation).toMatchObject({ outcome: "recommended", recommendedOptionKey: "current-supported", researchEvidenceIds: ["evidence:current-held-out-capability"] });
  });
});
