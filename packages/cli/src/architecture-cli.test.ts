import type { ArchitectureConcern, ArchitectureDecision, ContentHash, DecisionValidityAssessment, SelectorExpr } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { executeProjector } from "./cli.js";

const hash = (_value: string): ContentHash => `sha256:v1:${"c".repeat(64)}`;
const scope: SelectorExpr = { op: "atom", field: "platform", matcher: "equals", value: "shared" };
const selected: ArchitectureDecision = { id: "decision:runtime", key: "runtime", concernId: "concern:runtime", title: "Runtime", decision: "keep simple", selectedOptionKey: "simple", scope, lifecycle: "active", authorityRecordId: "authority:runtime", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hash("decision") };
const concern: ArchitectureConcern = { id: "concern:runtime", key: "runtime", title: "Runtime", question: "Which runtime?", scope, sourceClass: "derived", status: "resolved", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [selected.id], evidence: [], semanticHash: hash("concern") };
const validity: DecisionValidityAssessment = { decisionId: selected.id, scope, state: "valid", firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], blocksCurrentChange: false, explanation: "scope and proof remain current" };

describe("decision CLI composition", () => {
  it("binds provider preflight mode and risk to normalized CLI policy and operation risk", async () => {
    const preflight = vi.fn().mockResolvedValue({
      closure: { id: "closure:cli", requestHash: hash("request"), seeds: [], entries: [], activatedFacetKeys: [], unknowns: [], unavailableLanes: [], boundState: { compiledAgainst: { gitBase: "base", worktreeDigest: hash("worktree"), canonicalProjectorDigest: hash("canonical"), toolchainDigest: hash("toolchain") }, valueDependencies: [], queryDependencies: [], dependencyDigest: hash("binding") }, contentHash: hash("closure") },
      concerns: [{ ...concern, status: "active", decisionIds: [] }], validity: [], overrideAuthorityRecordIds: [], mode: "guide", risk: "R0",
    });
    const result = await executeProjector(["plan", "--mode", "govern"], {
      governance: { detectCanonicalConflictPaths: vi.fn().mockResolvedValue([]), operation: { command: "plan", sideEffect: "canonical-write", externalWrite: false, canonicalMutation: true } },
      architecture: { load: vi.fn(), validity: vi.fn(), overlap: { assess: vi.fn() }, population: { inspect: vi.fn() }, preflight,
        preflightPorts: { authority: { read: vi.fn() }, validity: { verify: vi.fn() }, deferral: { assess: vi.fn() } } },
    });
    expect(result).toMatchObject({ exitCode: 3, report: { architecturePreflight: { code: "unresolved-architecture-frontier" } } });
    expect(result.report.architecturePreflight).toMatchObject({ mode: "govern", risk: "R2" });
  });

  it("supports audit --decisions through the architecture audit API", async () => {
    const result = await executeProjector(["audit", "--decisions", "--format", "json"], { architecture: {
      load: vi.fn().mockResolvedValue({ decisions: [selected], concerns: [concern] }),
      validity: vi.fn().mockResolvedValue(validity),
      overlap: { assess: vi.fn().mockResolvedValue("compatible") },
      population: { inspect: vi.fn().mockResolvedValue({ count: 1, observability: "closed" }) },
    } });
    expect(result.exitCode).toBe(0);
    expect(result.report.decisionAudit.findings).toEqual([]);
  });

  it("explains why decision:<id> was or was not reconsidered", async () => {
    const result = await executeProjector(["explain", selected.id], { architecture: {
      load: vi.fn().mockResolvedValue({ decisions: [selected], concerns: [concern] }),
      validity: vi.fn().mockResolvedValue(validity),
      overlap: { assess: vi.fn() },
      population: { inspect: vi.fn() },
    } });
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/not reconsidered/iu);
    expect(result.report.decisionExplanation).toMatchObject({ decisionId: selected.id, reconsidered: false });
  });
});
