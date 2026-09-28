import { describe, expect, it } from "vitest";
import { runPublicCommand, type PublicCommandRunner } from "./public-command.js";

function runner(report: unknown) {
  const calls: unknown[] = [];
  const host: PublicCommandRunner = { execute: async (request) => {
    calls.push(request);
    return { status: "succeeded", exitCode: 0, readiness: { status: "ready" }, output: report };
  } };
  return { host, calls };
}

const assessment = {
  status: "review-required", baseCommit: "base", targetCommit: "target", incomingCommit: "incoming",
  resultTree: "result", resultSource: "supplied", conflictPaths: [],
  contributions: [{ side: "incoming", entityId: "requirement:preserve-origin", change: "added", status: "preserved" }],
  codeContributions: [{ side: "target", path: "src/origin.ts", change: "modified", status: "preserved" }],
  canonicalValidation: { status: "passed", scope: "canonical-record-integrity", issues: [] },
  verificationGaps: ["Behavioral checks and independent review have not been assessed."], requiresReview: true,
};

describe("ordinary Git integration command", () => {
  it("assesses named revisions without a candidate or checkout lifecycle and exposes its limits", async () => {
    const fixture = runner(assessment);
    const result = await runPublicCommand(["integration", "--target", "main", "--incoming", "topic", "--base", "base", "--result", "merge", "--timeout-ms", "120000"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls).toEqual([expect.objectContaining({
      operation: "repository.integration", input: { target: "main", incoming: "topic", base: "base", result: "merge" },
      observationLimits: { timeoutMs: 120000 },
    })]);
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("result");
    expect(result.text).toContain("requirement:preserve-origin");
    expect(result.text).toContain("preserved");
    expect(result.text).toContain("Behavioral checks and independent review have not been assessed.");
    expect(result.text).toContain("does not authorize");
  });

  it("defaults only the merge calculation, never guesses either contribution", async () => {
    const fixture = runner(assessment);
    await runPublicCommand(["integration", "--target", "main", "--incoming", "topic"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls).toEqual([expect.objectContaining({ input: { target: "main", incoming: "topic" } })]);
    for (const args of [[], ["--target", "main"], ["--incoming", "topic"], ["--target", "main", "--target", "other", "--incoming", "topic"], ["unexpected", "--target", "main", "--incoming", "topic"]]) {
      await expect(runPublicCommand(["integration", ...args], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow();
    }
    expect(fixture.calls).toHaveLength(1);
  });

  it.each([
    { ...assessment, status: "conflicted", conflictPaths: ["src/origin.ts"] },
    { ...assessment, status: "invalid", canonicalValidation: { status: "failed", issues: ["Duplicate semantic identity"] } },
    { ...assessment, contributions: [{ side: "incoming", entityId: "requirement:preserve-origin", status: "lost" }] },
    { ...assessment, codeContributions: [{ side: "target", path: "src/origin.ts", status: "altered" }] },
    { ...assessment, staticGovernanceValidation: { status: "incomplete", issues: ["Implementation subject has not been observed."] } },
  ])("returns unresolved integration findings as nonzero with exact JSON available", async (report) => {
    const fixture = runner(report);
    const result = await runPublicCommand(["integration", "--target", "main", "--incoming", "topic", "--json"], { runner: fixture.host, cwd: process.cwd() });
    expect(result.exitCode).toBe(6);
    expect(JSON.parse(result.text)).toEqual(report);
  });

  it("shows unresolved static governance and result-only changes in the human report", async () => {
    const fixture = runner({ ...assessment, staticGovernanceValidation: { status: "incomplete", issues: ["Implementation subject has not been observed."] }, resultOnlyPaths: ["src/merge-fix.ts"] });
    const result = await runPublicCommand(["integration", "--target", "main", "--incoming", "topic"], { runner: fixture.host, cwd: process.cwd() });
    expect(result.exitCode).toBe(6);
    expect(result.text).toContain("Static governance: incomplete.");
    expect(result.text).toContain("Implementation subject has not been observed.");
    expect(result.text).toContain("src/merge-fix.ts");
  });
  it("discloses result consumer population growth and keeps behavioral verification separate", async () => {
    const fixture = runner({ ...assessment, resultReconciliation: { status: "incomplete", consumerQueries: [{ dependencyPath: "src/origin.ts", newlyRelevantConsumers: ["distant/client.ts"] }], contradictions: [], unknowns: ["dynamic import unresolved"], behavior: { status: "not-assessed", reusable: false } } });
    const result = await runPublicCommand(["integration", "--target", "main", "--incoming", "topic"], { runner: fixture.host, cwd: process.cwd() });
    expect(result.exitCode).toBe(6);
    expect(result.text).toContain("1 static consumer queries recomputed; 1 newly relevant consumers");
    expect(result.text).toContain("Newly relevant consumer: distant/client.ts");
    expect(result.text).toContain("Result uncertainty: dynamic import unresolved");
    expect(result.text).toContain("behavioral evidence is not reusable");
  });
});
