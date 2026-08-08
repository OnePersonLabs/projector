import { describe, expect, it, vi } from "vitest";

import { executeProjector, type CoverageCliPort } from "./cli.js";

const report = { proofStatement: "bounded", strictnessMet: true, requiredUnavailable: false, approvalRequired: false, budgetExhausted: false, continuationPersisted: false, boundary: ["packages/api"] };

describe("coverage/complete/cleanup CLI composition", () => {
  it("normalizes scope, strictness, budgets and uses one provider report for text/JSON", async () => {
    const coverage = vi.fn(async () => report); const port = { coverage, complete: async () => report, cleanup: async () => report } satisfies CoverageCliPort;
    const json = await executeProjector(["coverage", "--scope", "./packages\\api", "--strictness", "bounded", "--budget-tokens", "12", "--budget-cost", "2.5", "--format", "json"], { coverage: port });
    expect(coverage).toHaveBeenCalledWith(expect.objectContaining({ scope: "packages/api", strictness: "bounded", budgetTokens: 12, budgetCost: 2.5 }));
    expect(JSON.parse(json.output)).toEqual(json.report);
    await expect(executeProjector(["coverage", "--scope", "a", "--scope", "a"], { coverage: port })).rejects.toThrow(/duplicate.*scope/iu);
    await expect(executeProjector(["complete", "--budget-tokens", "0"], { coverage: port })).rejects.toThrow(/positive.*budget|budget.*positive/iu);
    await expect(executeProjector(["complete", "--budget-tokens", "1.5"], { coverage: port })).rejects.toThrow(/integer/iu);
    await expect(executeProjector(["coverage", "--budget-cost", "1", "--budget-cost", "2"], { coverage: port })).rejects.toThrow(/duplicate.*budget-cost/iu);
  });

  it("applies unavailable, durable-budget, approval, and strictness exit precedence", async () => {
    const portFor = (patch: Record<string, unknown>): CoverageCliPort => ({ coverage: async () => ({ ...report, ...patch }), complete: async () => ({ ...report, ...patch }), cleanup: async () => ({ ...report, ...patch }) });
    expect((await executeProjector(["coverage"], { coverage: portFor({ requiredUnavailable: true, budgetExhausted: true, continuationPersisted: true, approvalRequired: true, strictnessMet: false }) })).exitCode).toBe(5);
    expect((await executeProjector(["complete"], { coverage: portFor({ budgetExhausted: true, continuationPersisted: true, approvalRequired: true, strictnessMet: false }) })).exitCode).toBe(7);
    expect((await executeProjector(["complete"], { coverage: portFor({ approvalRequired: true, strictnessMet: false }) })).exitCode).toBe(3);
    expect((await executeProjector(["coverage"], { coverage: portFor({ strictnessMet: false }) })).exitCode).toBe(4);
    expect((await executeProjector(["complete"], { coverage: portFor({ budgetExhausted: true, continuationPersisted: false }) })).exitCode).toBe(1);
    expect((await executeProjector(["cleanup", "--continuation", "missing"])).exitCode).toBe(5);
  });
});
