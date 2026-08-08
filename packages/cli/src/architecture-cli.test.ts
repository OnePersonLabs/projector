import type { ArchitectureConcern, ArchitectureDecision, ContentHash, DecisionValidityAssessment, SelectorExpr } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { executeProjector } from "./cli.js";

const hash = (_value: string): ContentHash => `sha256:v1:${"c".repeat(64)}`;
const scope: SelectorExpr = { op: "atom", field: "platform", matcher: "equals", value: "shared" };
const selected: ArchitectureDecision = { id: "decision:runtime", key: "runtime", concernId: "concern:runtime", title: "Runtime", decision: "keep simple", selectedOptionKey: "simple", scope, lifecycle: "active", authorityRecordId: "authority:runtime", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hash("decision") };
const concern: ArchitectureConcern = { id: "concern:runtime", key: "runtime", title: "Runtime", question: "Which runtime?", scope, sourceClass: "derived", status: "resolved", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [selected.id], evidence: [], semanticHash: hash("concern") };
const validity: DecisionValidityAssessment = { decisionId: selected.id, scope, state: "valid", firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], blocksCurrentChange: false, explanation: "scope and proof remain current" };

describe("decision CLI composition", () => {
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
