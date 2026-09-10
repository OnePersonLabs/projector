import { describe, expect, it } from "vitest";

import { KnowledgeContextResultSchema, KnowledgeReconciliationResultSchema } from "./index.js";

describe("public control-plane transport exports", () => {
  it("exports strict knowledge result schemas through the supported package root", () => {
    expect(KnowledgeContextResultSchema.safeParse({}).success).toBe(false);
    expect(KnowledgeReconciliationResultSchema.safeParse({ status: "current" }).success).toBe(false);
  });
});
