import type { ArchitectureConcern, ArchitectureDecision, AuthorityRecord, ContentHash, DecisionValidityAssessment, RelevanceClosure, SelectorExpr } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { auditArchitectureDecisions, explainArchitectureDecision, runArchitecturePreflight } from "./preflight.js";

const hash = (_value: string): ContentHash => `sha256:v1:${"b".repeat(64)}`;
const scope: SelectorExpr = { op: "atom", field: "platform", matcher: "equals", value: "shared" };
const concern = (id: string, materiality: ArchitectureConcern["materiality"] = "blocking-now"): ArchitectureConcern => ({
  id, key: id, title: id, question: `${id}?`, scope, sourceClass: "derived", status: "active", materiality, activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [], evidence: [], semanticHash: hash(id),
});
const decision = (id: string, option = "alpha"): ArchitectureDecision => ({
  id, key: id, concernId: `concern:${id}`, title: id, decision: option, selectedOptionKey: option, scope, lifecycle: "active", authorityRecordId: `authority:${id}`, governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hash(id),
});
const closure = { id: "closure:bounded", requestHash: hash("request"), seeds: [], entries: [], activatedFacetKeys: [], unknowns: [], unavailableLanes: [], boundState: { compiledAgainst: { gitBase: "base", worktreeDigest: hash("worktree"), canonicalProjectorDigest: hash("canonical"), toolchainDigest: hash("toolchain") }, valueDependencies: [], queryDependencies: [], dependencyDigest: hash("binding") }, contentHash: hash("closure") } satisfies RelevanceClosure;

describe("architecture preflight", () => {
  it("allows exploration but blocks governed R2+ completion on unresolved blocking concerns", () => {
    const unresolved = concern("concern:runtime");
    expect(runArchitecturePreflight({ closure, concerns: [unresolved], validity: [], overrides: [], mode: "guide", risk: "R2" })).toMatchObject({ planningAllowed: true, governedCompletion: false });
    expect(runArchitecturePreflight({ closure, concerns: [unresolved], validity: [], overrides: [], mode: "govern", risk: "R2" })).toMatchObject({ planningAllowed: false, governedCompletion: false, code: "unresolved-architecture-frontier" });
  });

  it("accepts only an authorized recorded override and never mutates during preflight", () => {
    const unresolved = concern("concern:runtime");
    const override = { id: "authority:override", key: "override", subjectId: unresolved.id, status: "approved", conclusion: "exception", rationale: "user accepted uncertainty", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 1, ecosystemHealth: 1, securitySupport: 1, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "medium", evidence: [], governanceRiskClass: "R2", decidedBy: "user", createdAt: "2026-08-08", semanticHash: hash("override") } satisfies AuthorityRecord;
    expect(runArchitecturePreflight({ closure, concerns: [unresolved], validity: [], overrides: [{ ...override, status: "provisional" }], mode: "autonomous", risk: "R3" }).planningAllowed).toBe(false);
    expect(runArchitecturePreflight({ closure, concerns: [unresolved], validity: [], overrides: [override], mode: "autonomous", risk: "R3" })).toMatchObject({ planningAllowed: true, governedCompletion: true, closureId: closure.id });
  });
});

describe("decision explanation and audit", () => {
  it("explains both reconsidered and retained decisions", () => {
    const selected = decision("web");
    const validity = { decisionId: selected.id, scope, state: "valid", firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], blocksCurrentChange: false, explanation: "proof dependencies remain current" } satisfies DecisionValidityAssessment;
    expect(explainArchitectureDecision(selected, validity).explanation).toMatch(/not reconsidered|remain current/iu);
    expect(explainArchitectureDecision(selected, { ...validity, state: "suspect", blocksCurrentChange: true, firedTriggers: [{ type: "manual-review" }], explanation: "manual review fired" }).explanation).toMatch(/reconsidered|manual-review/iu);
  });

  it("detects equivalent decisions, incompatible overlap, and stale closed-world populations", async () => {
    const first = decision("first");
    const equivalent = { ...decision("equivalent"), concernId: first.concernId, key: first.key, title: first.title, authorityRecordId: "authority:equivalent" };
    const stale = decision("stale", "beta");
    const report = await auditArchitectureDecisions({ decisions: [first, equivalent, stale], concerns: [] }, {
      overlap: { assess: vi.fn().mockImplementation(async (left: ArchitectureDecision, right: ArchitectureDecision) => left.id === "stale" || right.id === "stale" ? "incompatible" : "compatible") },
      population: { inspect: vi.fn().mockImplementation(async (item: ArchitectureDecision) => ({ count: item.id === "stale" ? 0 : 1, observability: "closed" })) },
    });
    expect(report.findings.map(({ code }) => code)).toEqual(expect.arrayContaining(["equivalent-decisions", "incompatible-decision-overlap", "stale-no-population"]));
  });
});
