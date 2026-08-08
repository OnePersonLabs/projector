import { describe, expect, it, vi } from "vitest";

import { executeProjector, type RunHostCliPort } from "./cli.js";

describe("projector run host boundary", () => {
  it("preserves literal argv, filters environment, and reports reconciled host status", async () => {
    const run = vi.fn<RunHostCliPort["run"]>(async () => ({ status: "completed", exitCode: 0, changedPaths: ["src/a.ts"], reconciled: true }));
    const signal = new AbortController().signal;
    const repositoryRoot = process.cwd();
    const result = await executeProjector(["run", "codex", "--mode", "guide", "--session", "session:fixture", "--", "--fake", "value with spaces", "$(never)"], { cwd: repositoryRoot, runHost: { run }, environment: { PATH: "/bin", LANG: "C", SECRET: "drop" }, signal });
    expect(result.exitCode).toBe(0);
    expect(run).toHaveBeenCalledWith({ host: "codex", sessionSelector: "session:fixture", repositoryRoot, argv: ["--fake", "value with spaces", "$(never)"], environment: { LANG: "C", PATH: "/bin" }, signal });
    expect(result.report).toMatchObject({ status: "completed", reconciled: true, changedPaths: ["src/a.ts"] });
  });

  it("does not launch in dry-run and maps missing executables/cancellation after reconciliation", async () => {
    const run = vi.fn<RunHostCliPort["run"]>(async () => ({ status: "unavailable", exitCode: null, changedPaths: [], reconciled: true }));
    const dry = await executeProjector(["run", "claude", "--dry-run", "--session", "session:fixture", "--", "--fake"], { runHost: { run } });
    expect(dry).toMatchObject({ exitCode: 0, report: { dryRun: true, host: "claude", argv: ["--fake"] } }); expect(run).not.toHaveBeenCalled();
    const missing = await executeProjector(["run", "claude", "--session", "session:fixture", "--", "--fake"], { runHost: { run } }); expect(missing.exitCode).toBe(5);
    run.mockResolvedValueOnce({ status: "cancelled", exitCode: null, changedPaths: ["partial"], reconciled: true });
    const cancelled = await executeProjector(["run", "codex", "--session", "session:fixture", "--"], { runHost: { run } }); expect(cancelled.exitCode).toBe(6); expect(cancelled.report.reconciled).toBe(true);
  });

  it("rejects unknown hosts and requires the argv separator", async () => {
    await expect(executeProjector(["run", "other", "--"])).rejects.toThrow(/host/u);
    await expect(executeProjector(["run", "codex", "--fake"])).rejects.toThrow(/separator/u);
  });
});
