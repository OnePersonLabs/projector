import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeProjector, type CoverageCliPort } from "./cli.js";

const laneKeys = ["inventory", "projection-unit-classification", "concept-mapping", "relationship", "lens", "rule-enforceability", "derivation", "validation-evidence", "surface", "authority", "historical-metamorphic", "architecture-decision", "semantic-identity", "pre-change-relevance", "representation-projection-fidelity", "change-closure", "planning-surprise"];
const report = { proofStatement: "bounded" as const, approvalRequired: false, budgetExhausted: false, continuationPersisted: false, boundary: ["packages/api"], lanes: laneKeys.map((key) => ({ key, observability: "bounded" as const })), unavailableSurfaceIds: [] };

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

  it("fails closed on flags/boundaries and suppresses dry-run effects", async () => {
    const cleanup = vi.fn(async () => ({ ...report, boundary: ["."] }));
    const port = { coverage: cleanup, complete: cleanup, cleanup } satisfies CoverageCliPort;
    await expect(executeProjector(["coverage", "--mystery"], { coverage: port })).rejects.toThrow(/unknown.*flag|argument/iu);
    await expect(executeProjector(["cleanup", "--dry-run", "--dry-run"], { coverage: port })).rejects.toThrow(/duplicate.*dry-run/iu);
    const dryRun = await executeProjector(["cleanup", "--dry-run", "--mode", "observe"], { coverage: port });
    expect(dryRun.report).toMatchObject({ dryRun: true }); expect(dryRun.exitCode).toBe(4); expect(cleanup).not.toHaveBeenCalled();
    expect((await executeProjector(["coverage", "--scope", "packages/api"], { coverage: { ...port, coverage: async () => ({ ...report, proofStatement: "proven-within-boundary", strictnessMet: true, boundary: ["other"] }) } })).exitCode).not.toBe(0);
    expect((await executeProjector(["coverage", "--strictness", "partial"], { coverage: { ...port, coverage: async () => ({ ...report, boundary: ["."], lanes: [] }) } })).exitCode).not.toBe(0);
  });

  it("composes deterministic built coverage from real Task14 repository analysis", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-coverage-"));
    try {
      await writeFile(join(repositoryRoot, "package.json"), JSON.stringify({ name: "fixture", scripts: { check: "node src/check.js" } }));
      await writeFile(join(repositoryRoot, "bad.json"), "{\"broken\":");
      const first = await executeProjector(["coverage", "--format", "json"], { cwd: repositoryRoot });
      const second = await executeProjector(["coverage"], { cwd: repositoryRoot });
      expect(first.report.lanes).toHaveLength(17);
      expect(new Set(first.report.lanes.map((lane: { key: string }) => lane.key))).toEqual(new Set(laneKeys));
      expect(first.report.localAnalysis).toMatchObject({ artifactCount: 2, projectionUnitCount: 2 });
      expect(first.report.localAnalysis.analyzerFailures).toContainEqual(expect.objectContaining({ capability: "document-parse", scope: "bad.json" }));
      expect(first.report.lanes.find((lane: { key: string }) => lane.key === "representation-projection-fidelity")).toMatchObject({ observability: "unavailable", numerator: 0, blindSpots: [expect.stringMatching(/projection evidence/iu)] });
      expect(first.report.boundState).toMatchObject({ dependencyDigest: expect.stringMatching(/^sha256:v1:/u) });
      expect(first.report.bindingValidation).toMatchObject({ status: "current", currentState: first.report.boundState.compiledAgainst });
      expect(first.report.bindingIdentity).toBe(first.report.boundState.dependencyDigest);
      expect(first.report).not.toHaveProperty("adapter");
      expect(second.report).toEqual(first.report);
      expect(second.output).toBe(`coverage: ${first.report.proofStatement}`);
      expect(JSON.parse(first.output)).toEqual(first.report);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("excludes sibling structured-document failures from fidelity coverage", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-coverage-formats-"));
    try {
      await writeFile(join(repositoryRoot, "valid.toml"), "name = \"fixture\"\n");
      await writeFile(join(repositoryRoot, "duplicate.yaml"), "name: first\nname: second\n");
      const result = await executeProjector(["coverage"], { cwd: repositoryRoot });
      expect(result.report.localAnalysis.analyzerFailures).toContainEqual(expect.objectContaining({ capability: "duplicate-key", scope: "duplicate.yaml" }));
      expect(result.report.lanes.find((lane: { key: string }) => lane.key === "representation-projection-fidelity")).toMatchObject({ observability: "unavailable", numerator: 0, blindSpots: [expect.stringMatching(/projection evidence/iu)] });
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });
});
