import { describe, expect, it } from "vitest";

import {
  ContentHashSchema,
  ConceptSchema,
  EntityIdSchema,
  LineageRecordSchema,
  RequirementDeltaSchema,
  contractRegistry,
  exportContractJsonSchemas,
  validateJsonSchemaReferences,
  validateContractRegistry,
} from "./index.js";

describe("normative contract registry", () => {
  it("represents every exported normative declaration exactly once", () => {
    expect(Object.keys(contractRegistry)).toHaveLength(147);
    expect(validateContractRegistry()).toEqual([]);
  });

  it("exports strict JSON Schemas whose references resolve", () => {
    const schemas = exportContractJsonSchemas();
    expect(Object.keys(schemas)).toHaveLength(138);
    expect(validateJsonSchemaReferences(schemas)).toEqual([]);
    for (const schema of Object.values(schemas)) {
      expect(schema).toMatchObject({ $schema: expect.any(String) });
    }
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
