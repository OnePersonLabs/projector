import { execFile } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

import { executeProjector, type ChangeCliPort } from "./cli.js";

const executeFile = promisify(execFile);

describe("change/plan/apply CLI composition", () => {
  it("uses explicit safe selectors and never invokes apply effects for dry-run", async () => {
    const change = vi.fn(async () => ({ kind: "change" as const, selector: "change:abc", risk: "R1" as const }));
    const plan = vi.fn(async () => ({ kind: "plan" as const, selector: "plan:abc", changeSelector: "change:abc", preview: { expectedDiff: "one file" }, risk: "R1" as const }));
    const apply = vi.fn(async () => ({ kind: "apply" as const, selector: "plan:abc", outcome: "success" as const, risk: "R1" as const }));
    const port = { change, plan, resolvePlan: async () => ({ risk: "R1" as const, planHash: "plan-hash" }), apply } satisfies ChangeCliPort;
    expect((await executeProjector(["change", "repair-governed-state"], { change: port })).report).toMatchObject({ selector: "change:abc" });
    expect((await executeProjector(["plan", "change:abc"], { change: port })).report).toMatchObject({ selector: "plan:abc" });
    const dryRun = await executeProjector(["apply", "plan:abc", "--dry-run"], { change: port });
    expect(dryRun.report).toMatchObject({ dryRun: true, selector: "plan:abc" }); expect(apply).not.toHaveBeenCalled();
    await expect(executeProjector(["plan", "../escape"], { change: port })).rejects.toThrow(/selector|safe/iu);
    await expect(executeProjector(["apply", "plan:abc", "plan:def"], { change: port })).rejects.toThrow(/argument/iu);
    const unsafe = { ...port, resolvePlan: async () => ({ risk: "R4" as const, planHash: "unsafe" }) };
    await expect(executeProjector(["apply", "plan:abc", "--mode", "govern"], { change: unsafe })).rejects.toThrow(/risk|R4|policy/iu);
    expect(apply).not.toHaveBeenCalled();
  });

  it("composes the built deterministic mandatory local change through change and plan", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-change-"));
    try {
      await cp(fileURLToPath(new URL("../../../fixtures/misplaced-repository-script/", import.meta.url)), repositoryRoot, { recursive: true });
      const environment = { ...process.env, GIT_AUTHOR_EMAIL: "change-test@projector.invalid", GIT_AUTHOR_NAME: "Change Test", GIT_COMMITTER_EMAIL: "change-test@projector.invalid", GIT_COMMITTER_NAME: "Change Test", GIT_CONFIG_GLOBAL: join(repositoryRoot, ".no-gitconfig"), GIT_CONFIG_NOSYSTEM: "1" };
      await executeFile("git", ["init", "--quiet", "--initial-branch=main"], { cwd: repositoryRoot, env: environment });
      await executeFile("git", ["add", "--all"], { cwd: repositoryRoot, env: environment });
      await executeFile("git", ["commit", "--quiet", "--no-gpg-sign", "-m", "fixture"], { cwd: repositoryRoot, env: environment });
      const compiled = await executeProjector(["change", "repair-governed-state", "--format", "json"], { cwd: repositoryRoot });
      expect(compiled.report).toMatchObject({ kind: "change", selector: expect.stringMatching(/^change:compat:[a-f0-9]{64}$/u), deterministic: true, compatibility: true });
      const planned = await executeProjector(["plan", compiled.report.selector, "--format", "json"], { cwd: repositoryRoot });
      expect(planned.report).toMatchObject({ kind: "plan", changeSelector: compiled.report.selector, selector: expect.stringMatching(/^plan:compat:[a-f0-9]{64}$/u), risk: { class: "R1" }, compatibility: true });
      expect(planned.report.plan.boundState).toEqual(planned.report.capsule.boundState);
      await writeFile(join(repositoryRoot, ".codex/hooks/validate-repo.mjs"), "// relevant drift\n", { flag: "a" });
      await expect(executeProjector(["apply", planned.report.selector, "--mode", "govern"], { cwd: repositoryRoot })).rejects.toThrow(/stale|rebase/iu);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });
});
