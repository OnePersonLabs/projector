import { describe, expect, it } from "vitest";

import {
  ContentHashSchema,
  ChangeProposalSchema,
  ConceptSchema,
  EntityIdSchema,
  LineageRecordSchema,
  RequirementDeltaSchema,
  contractRegistry,
  exportContractJsonSchemas,
  validateJsonSchemaReferences,
  validateContractRegistry,
  parseChangeProposal,
} from "./index.js";

describe("normative contract registry", () => {
  it("represents every exported normative declaration exactly once", () => {
    expect(Object.keys(contractRegistry)).toHaveLength(150);
    expect(validateContractRegistry()).toEqual([]);
  });

  it("exports strict JSON Schemas whose references resolve", () => {
    const schemas = exportContractJsonSchemas();
    expect(Object.keys(schemas)).toHaveLength(141);
    expect(validateJsonSchemaReferences(schemas)).toEqual([]);
    for (const schema of Object.values(schemas)) {
      expect(schema).toMatchObject({ $schema: expect.any(String) });
    }
  });

  it("owns the strict public change proposal contract", () => {
    const proposal = { apiVersion: "projector.change-proposal/v1", requirements: [{ key: "useful", title: "Useful", statement: "It is useful.", aliases: [] }], scenarios: [{ key: "observe-useful", title: "Observe useful", aliases: [], steps: [{ role: "trigger", statement: "A caller observes it." }, { role: "expected-outcome", statement: "It is useful." }] }], architecture: null, edits: [{ path: "src/value.mjs", before: "old", after: "new" }], validation: { independentNodeTests: ["test/value.test.mjs"], supplementalNodeTests: [] }, analysisFacets: ["architecture", "behavior"] };
    expect(parseChangeProposal(proposal)).toEqual(proposal);
    expect(ChangeProposalSchema.safeParse({ ...proposal, hidden: true }).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...proposal, scenarios: [{ ...proposal.scenarios[0], steps: [{ ...proposal.scenarios[0]!.steps[0], hidden: true }, proposal.scenarios[0]!.steps[1]] }] }).success).toBe(false);
    for (const path of ["../escape", "/absolute", "C:/absolute", "src\\value.mjs", ".projector/runtime/forged.json"]) expect(ChangeProposalSchema.safeParse({ ...proposal, edits: [{ ...proposal.edits[0], path }] }).success).toBe(false);
  });

  it("accepts explicit model-only additions while rejecting empty and unauthenticated revisions", () => {
    const base = { apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["architecture", "behavior"] };
    const addition = { ...base, canonicalMutations: [{ kind: "concept", operation: "add", expectedAbsent: true, rationale: "Establish the future obligation before implementation.", payload: { id: "concept:clock", key: "clock", kind: "invariant", name: "Clock boundary", aliases: [], statement: "All domain time enters through the clock port.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [] } }] };
    expect(parseChangeProposal(addition).canonicalMutations).toHaveLength(1);
    expect(ChangeProposalSchema.safeParse(base).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...addition, canonicalMutations: [{ ...addition.canonicalMutations[0], operation: "revise", expectedAbsent: undefined }] }).success).toBe(false);
    const publicSchema = JSON.stringify(exportContractJsonSchemas().ChangeProposal);
    expect(publicSchema).toContain("realizesConceptKinds");
    expect(publicSchema).toContain("selectedOptionKey");
    expect(publicSchema).toContain("requiredIndependenceGroup");
  });

  it("rejects malformed content hashes", () => {
    expect(ContentHashSchema.safeParse("sha256:v1:abc").success).toBe(false);
    expect(
      ContentHashSchema.safeParse(`sha256:v1:${"A".repeat(64)}`).success,
    ).toBe(false);
    expect(
      ContentHashSchema.safeParse(`sha256:v1:${"a".repeat(64)}`).success,
    ).toBe(true);
  });

  it("rejects path-like, blank, or whitespace-padded entity IDs", () => {
    for (const value of ["", " entity", "entity ", "a/b", "a\\b", ".", ".."]) {
      expect(EntityIdSchema.safeParse(value).success).toBe(false);
    }
    expect(EntityIdSchema.safeParse("req_checkout-v2").success).toBe(true);
  });

  it("rejects unknown object fields instead of silently stripping them", () => {
    expect(ConceptSchema.safeParse({ unexpected: true }).error?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unrecognized_keys" })]),
    );
  });

  it("enforces operation-specific behavior delta presence rules", () => {
    expect(RequirementDeltaSchema.safeParse({
      subjectType: "requirement",
      kind: "remove",
      requirementId: "req_checkout",
      rationale: "retired behavior",
    }).success).toBe(true);
    expect(RequirementDeltaSchema.safeParse({
      subjectType: "requirement",
      kind: "remove",
      rationale: "missing existing identity",
    }).success).toBe(false);
    expect(RequirementDeltaSchema.safeParse({
      subjectType: "requirement",
      kind: "add",
      requirementId: "req_checkout",
      rationale: "invalid existing identity",
    }).success).toBe(false);
  });

  it("enforces lineage cardinality in the public schema", () => {
    const common = {
      id: "lineage_a",
      reason: "refactor",
      stateDigest: `sha256:v1:${"a".repeat(64)}`,
    };
    expect(LineageRecordSchema.safeParse({ ...common, kind: "split", fromIds: ["a"], toIds: ["b"] }).success).toBe(false);
    expect(LineageRecordSchema.safeParse({ ...common, kind: "split", fromIds: ["a"], toIds: ["b", "c"] }).success).toBe(true);
  });
});
