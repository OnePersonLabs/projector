import { hashSemantic, type ArchitectureDecision, type AuthorityRecord, type SelectorExpr } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { acceptArchitectureDecisions, convergeDecisionGroup } from "./governance.js";

const scope: SelectorExpr = { op: "atom", field: "platform", matcher: "equals", value: "shared" };
const authority = (id: string): AuthorityRecord => {
  const base: Omit<AuthorityRecord, "semanticHash"> = {
  id, key: id, subjectId: "concern:runtime", status: "approved", conclusion: "preserve", rationale: "explicitly approved", alternatives: [], assumptions: [], reconsiderWhen: [],
  vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 1, ecosystemHealth: 1, securitySupport: 1, reversibility: 1, migrationCost: 0, counterEvidence: 0 },
  assessmentConfidence: "high", evidence: [], governanceRiskClass: "R2", decidedBy: "user", createdAt: "2026-08-08T00:00:00Z",
  };
  return { ...base, semanticHash: hashSemantic("authority-record", base) };
};
const decision = (id: string, selectedOptionKey: string): ArchitectureDecision => {
  const base: Omit<ArchitectureDecision, "semanticHash"> = {
  id, key: id, concernId: "concern:runtime", title: id, decision: selectedOptionKey, selectedOptionKey, scope, lifecycle: "active", authorityRecordId: `authority:${id}`,
  governanceBasis: [], consequences: [{ kind: "select-technology", targetId: `technology:${selectedOptionKey}`, scope, explanation: selectedOptionKey }], appliedPreferences: [], supersedesDecisionIds: [],
  };
  return { ...base, semanticHash: hashSemantic("architecture-decision", base) };
};
const ports = (records: readonly AuthorityRecord[], transact: ReturnType<typeof vi.fn>, overlap: "compatible" | "incompatible" = "compatible") => ({
  authority: { read: async (id: string) => records.find((record) => record.id === id) }, overlap: { assess: vi.fn().mockResolvedValue(overlap) }, convergence: { verify: vi.fn() }, transaction: { transact },
});

describe("atomic decision consequences and overlap", () => {
  it("blocks incompatible overlap before opening the semantic governance transaction", async () => {
    const transact = vi.fn();
    const left = decision("left", "alpha");
    const right = decision("right", "beta");
    const result = await acceptArchitectureDecisions({ decisions: [left, right], existingDecisions: [] }, ports([authority("authority:left"), authority("authority:right")], transact, "incompatible"));
    expect(result).toMatchObject({ activated: false, code: "incompatible-decision-overlap" });
    expect(transact).not.toHaveBeenCalled();
  });

  it("commits acceptance and all consequences through one injected atomic call", async () => {
    const transact = vi.fn().mockResolvedValue(undefined);
    const selected = decision("simple", "do-not-add-yet");
    selected.consequences = [];
    selected.semanticHash = hashSemantic("architecture-decision", selected);
    const result = await acceptArchitectureDecisions({ decisions: [selected], existingDecisions: [] }, ports([authority("authority:simple")], transact));
    expect(result.activated).toBe(true);
    expect(transact).toHaveBeenCalledTimes(1);
    expect(transact).toHaveBeenCalledWith(expect.objectContaining({ decisions: [selected], consequences: [] }));
  });
});

describe("bounded decision SCC convergence", () => {
  it("detects repeated non-stable digests and returns no partial activation", async () => {
    const result = await convergeDecisionGroup({ members: ["a", "b"], initialState: { a: "one", b: "one" }, fixedInputs: { closure: "hash" }, maxIterations: 8 }, {
      evaluate: async ({ previousState }) => previousState.a === "one" ? { a: "two", b: "two" } : { a: "one", b: "one" },
    });
    expect(result).toMatchObject({ status: "decision-convergence-failure", activatedState: undefined });
  });

  it("uses stable normalized digests and terminates at a fixed point", async () => {
    const result = await convergeDecisionGroup({ members: ["b", "a"], initialState: { b: "one", a: "one" }, fixedInputs: { closure: "hash" }, maxIterations: 4 }, {
      evaluate: async () => ({ b: "stable", a: "stable" }),
    });
    expect(result.status).toBe("converged");
    expect(result.activatedState).toEqual({ a: "stable", b: "stable" });
  });
});
