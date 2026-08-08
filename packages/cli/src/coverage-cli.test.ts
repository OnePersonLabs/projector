import { describe, expect, it, vi } from "vitest";

import { executeProjector, type CoverageCliPort } from "./cli.js";

const report = { proofStatement: "bounded" as const, approvalRequired: false, budgetExhausted: false, continuationPersisted: false, boundary: ["packages/api"], lanes: [], unavailableSurfaceIds: [] };

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
    const portFor = (patch: Record<string, unknown>): CoverageCliPort => ({ coverage: async () => ({ ...report, boundary: ["."], ...patch }), complete: async () => ({ ...report, boundary: ["."], ...patch }), cleanup: async () => ({ ...report, boundary: ["."], ...patch }) });
    expect((await executeProjector(["coverage"], { coverage: portFor({ unavailableSurfaceIds: ["surface:a"], budgetExhausted: true, continuationPersisted: true, approvalRequired: true }) })).exitCode).toBe(5);
    expect((await executeProjector(["complete"], { coverage: portFor({ budgetExhausted: true, continuationPersisted: true, approvalRequired: true }) })).exitCode).toBe(7);
    expect((await executeProjector(["complete"], { coverage: portFor({ approvalRequired: true }) })).exitCode).toBe(3);
    expect((await executeProjector(["coverage", "--strictness", "proven"], { coverage: portFor({ strictnessMet: true }) })).exitCode).toBe(4);
    expect((await executeProjector(["complete"], { coverage: portFor({ budgetExhausted: true, continuationPersisted: false }) })).exitCode).toBe(1);
    expect((await executeProjector(["cleanup", "--continuation", "missing"])).exitCode).toBe(5);
  });

  it("fails closed on flags/boundaries, suppresses dry-run effects, and has a built default coverage path", async () => {
    const cleanup = vi.fn(async () => ({ ...report, boundary: ["."] }));
    const port = { coverage: cleanup, complete: cleanup, cleanup } satisfies CoverageCliPort;
    await expect(executeProjector(["coverage", "--mystery"], { coverage: port })).rejects.toThrow(/unknown.*flag|argument/iu);
    await expect(executeProjector(["cleanup", "--dry-run", "--dry-run"], { coverage: port })).rejects.toThrow(/duplicate.*dry-run/iu);
    const dryRun = await executeProjector(["cleanup", "--dry-run", "--mode", "observe"], { coverage: port });
    expect(dryRun.report).toMatchObject({ dryRun: true }); expect(cleanup).not.toHaveBeenCalled();
    expect((await executeProjector(["coverage", "--scope", "packages/api"], { coverage: { ...port, coverage: async () => ({ ...report, proofStatement: "proven-within-boundary", strictnessMet: true, boundary: ["other"] }) } })).exitCode).not.toBe(0);
    expect((await executeProjector(["coverage", "--strictness", "partial"], { cwd: process.cwd() })).exitCode).toBe(0);
  });
});
