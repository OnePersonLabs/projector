import { describe, expect, test } from "vitest";
import { ChangeProposalSchema } from "./schemas/change-proposal.js";

describe("canonical proposal diagnostics", () => {
  test("reports the actual mutation field without traversing unrelated kinds", () => {
    const mutation = { kind: "concept", operation: "add", expectedAbsent: true, rationale: "Record the clock boundary.", payload: { id: "concept:clock", key: "clock", kind: "invariant", name: "Clock boundary", aliases: [], statement: "Domain time enters through the clock port.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], semanticHash: "derived values do not belong in proposals" } };
    const result = ChangeProposalSchema.safeParse({ apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, canonicalMutations: [mutation], edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["architecture", "behavior"] });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected malformed proposal rejection");
    expect(result.error.issues).toEqual([expect.objectContaining({ code: "unrecognized_keys", path: ["canonicalMutations", 0, "payload"], keys: ["semanticHash"] })]);
  });
});
