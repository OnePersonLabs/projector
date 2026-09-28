import { expect, it } from "vitest";
import { CodeIndexRequestSchema } from "./code-workflows.js";
import { DerivedObservationBudget, ObservationBudget } from "./observation.js";

it("admits repository work beyond the former implicit defaults", () => {
  const budget = new ObservationBudget({}, Date.now() - 86_400_000);
  budget.consume("maxFiles", 20_001, "inventory");
  budget.consume("maxDirectories", 20_001, "inventory");
  budget.assertFileBytes(8 * 1024 * 1024 + 1, "large.ts");
  budget.consume("maxTotalBytes", 256 * 1024 * 1024 + 1, "inventory");
  budget.consume("maxGitOutputBytes", 32 * 1024 * 1024 + 1, "git");
  budget.check("long-running-index");
  expect(budget.remainingMs()).toBe(Infinity);

  const derived = new DerivedObservationBudget();
  derived.reserve(64 * 1024 * 1024 + 1, "analysis");
  expect(derived.usedBytes).toBe(64 * 1024 * 1024 + 1);
  expect(CodeIndexRequestSchema.parse({ provider: "native" }).timeoutMs).toBeNull();
  expect(CodeIndexRequestSchema.parse({ provider: "native", timeoutMs: 4 * 3_600_000 }).timeoutMs).toBe(4 * 3_600_000);
});

it("enforces every explicitly declared finite observation constraint", () => {
  const budget = new ObservationBudget({
    maxFiles: 2, maxDirectories: 2, maxFileBytes: 3, maxTotalBytes: 4,
    maxGitOutputBytes: 5, timeoutMs: 1, maxDerivedBytes: 6,
  }, Date.now() + 10_000);
  expect(() => budget.consume("maxFiles", 3, "inventory")).toThrow(/maxFiles/);
  expect(() => budget.consume("maxDirectories", 3, "inventory")).toThrow(/maxDirectories/);
  expect(() => budget.assertFileBytes(4, "large.ts")).toThrow(/maxFileBytes/);
  expect(() => budget.consume("maxTotalBytes", 5, "inventory")).toThrow(/maxTotalBytes/);
  expect(() => budget.consume("maxGitOutputBytes", 6, "git")).toThrow(/maxGitOutputBytes/);
  expect(() => new DerivedObservationBudget(6).reserve(7, "analysis")).toThrow(/maxDerivedBytes/);
  expect(() => new ObservationBudget({ timeoutMs: 1 }, Date.now() - 100).check("expired")).toThrow(/deadline/);
});
