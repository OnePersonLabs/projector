import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { deriveEntityId, inferEntityId, validateLineage } from "./index.js";

describe("stable identity", () => {
  it("does not depend on paths, aliases, or package containment", () => {
    fc.assert(fc.property(fc.string({ minLength: 1 }).filter((value) => value.trim().length > 0), fc.string(), fc.string(), (key, path, alias) => {
      const before = deriveEntityId("typescript", key);
      const after = deriveEntityId("typescript", key, { path, aliases: [alias], packageName: "moved" });
      expect(after).toBe(before);
    }));
  });

  it("inferred identity normalizes evidence-set order", () => {
    expect(inferEntityId("concept", "checkout", ["ev-b", "ev-a"]))
      .toBe(inferEntityId("concept", "checkout", ["ev-a", "ev-b"]));
  });

  it("requires lineage endpoints appropriate to the operation", () => {
    expect(validateLineage({ kind: "move", fromIds: ["a"], toIds: ["a"] })).toEqual([]);
    expect(validateLineage({ kind: "split", fromIds: ["a"], toIds: ["b"] })).toContain(
      "split lineage requires at least two destinations",
    );
    expect(validateLineage({ kind: "delete", fromIds: ["a"], toIds: ["b"] })).toContain(
      "delete lineage cannot have destinations",
    );
  });
});
