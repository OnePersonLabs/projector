import { hashFramedDomain } from "@projector/core";
import { describe, expect, it } from "vitest";

import { SUBSYSTEM_CLOSURE_STAGES, createSubsystemClosureReceipt, evaluateSubsystemClosure } from "./subsystem-closure.js";

const observations = SUBSYSTEM_CLOSURE_STAGES.map((stage) => ({
  obligationId: `representation.${stage}.v1`, stage, producer: stage === "authority" ? "spec-lint" : "packed-public-conformance",
  entrypoint: stage === "authority" ? "PROJECTOR_SPEC" : "projector",
  observedOutputHash: hashFramedDomain("closure-output", stage), failureHash: hashFramedDomain("closure-failure", stage),
  severedEdgeRejected: true,
}));

describe("generic subsystem closure control", () => {
  it("closes only a revision-bound contract with independently observed positive and negative evidence for every stage", () => {
    const receipt = createSubsystemClosureReceipt({ subsystemId: "representation", revision: "abc123", worktreeDigest: hashFramedDomain("worktree", "clean"), observations });
    expect(evaluateSubsystemClosure({ subsystemId: "representation", requiredObligationIds: observations.map(({ obligationId }) => obligationId) }, receipt)).toEqual({ status: "closed", blockers: [] });
  });

  it("rejects missing, duplicate, self-asserted, stale, and non-severable evidence", () => {
    const broken = createSubsystemClosureReceipt({ subsystemId: "representation", revision: "abc123", worktreeDigest: hashFramedDomain("worktree", "dirty"), observations: [
      ...observations.slice(0, -1),
      { ...observations[1]!, obligationId: observations[0]!.obligationId, producer: "representation", severedEdgeRejected: false },
    ] });
    const result = evaluateSubsystemClosure({ subsystemId: "representation", requiredObligationIds: observations.map(({ obligationId }) => obligationId), expectedRevision: "different" }, broken);
    expect(result.status).toBe("open");
    expect(result.blockers.join("\n")).toMatch(/missing|duplicate|self|severed|revision/iu);
  });
});
