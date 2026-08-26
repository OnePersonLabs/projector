import { execFile } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

import { executeProjector, type ChangeCliPort, type RepositoryLifecycleCliPort } from "./cli.js";

const executeFile = promisify(execFile);

describe("change/plan/apply CLI composition", () => {
  it("routes natural-language capture, exact approval, apply, and resume through one lifecycle port", async () => {
    const lifecycle = {
      capture: vi.fn(async () => ({ kind: "lifecycle-change", selector: "semantic_change_abc", immutablePlanHash: "sha256:v1:plan" })),
      plan: vi.fn(async () => ({ kind: "lifecycle-plan", selector: "semantic_change_abc", immutablePlanHash: "sha256:v1:plan", preview: { expectedDiff: "replace src/value.mjs" } })),
      approve: vi.fn(async () => ({ kind: "lifecycle-approval", selector: "lifecycle_approval_abc", immutablePlanHash: "sha256:v1:plan" })),
      apply: vi.fn(async () => ({ kind: "lifecycle-apply", selector: "lifecycle_approval_abc", immutablePlanHash: "sha256:v1:plan", outcome: "success" })),
      recover: vi.fn(async () => ({ kind: "lifecycle-recovery", selector: "lifecycle_approval_abc", outcomes: [] })),
      resume: vi.fn(async () => ({ kind: "lifecycle-resume", selector: "lifecycle_approval_abc", immutablePlanHash: "sha256:v1:plan", outcome: "success" })),
    } satisfies RepositoryLifecycleCliPort;
    expect((await executeProjector(["change", "Make the value useful for real callers", "--proposal", "proposal.json"], { lifecycle })).report.selector).toBe("semantic_change_abc");
    expect((await executeProjector(["plan", "semantic_change_abc"], { lifecycle })).output).toBe("replace src/value.mjs");
    expect((await executeProjector(["approve", "semantic_change_abc", "--plan-hash", "sha256:v1:plan"], { lifecycle })).report.selector).toBe("lifecycle_approval_abc");
    const controller = new AbortController();
    expect((await executeProjector(["apply", "lifecycle_approval_abc"], { lifecycle, signal: controller.signal })).exitCode).toBe(0);
    expect((await executeProjector(["recover", "lifecycle_approval_abc"], { lifecycle })).exitCode).toBe(0);
    expect((await executeProjector(["resume", "lifecycle_approval_abc"], { lifecycle, signal: controller.signal })).exitCode).toBe(0);
    lifecycle.resume.mockRejectedValueOnce(Object.assign(new Error("manual recovery required"), { code: "lifecycle-recovery-required", outcomes: [{ attemptId: "attempt:1", transactionId: "transaction:1", action: "recovery-required", reason: "third state" }] }));
    const blocked = await executeProjector(["resume", "lifecycle_approval_abc", "--format", "json"], { lifecycle });
    expect(blocked).toMatchObject({ exitCode: 6, report: { kind: "lifecycle-resume", outcome: "recovery-required", outcomes: [expect.objectContaining({ reason: "third state" })] } });
    expect(JSON.parse(blocked.output)).toMatchObject({ outcome: "recovery-required", selector: "lifecycle_approval_abc" });
    expect(lifecycle.capture).toHaveBeenCalledWith(expect.objectContaining({ request: "Make the value useful for real callers", proposalPath: "proposal.json" }));
    expect(lifecycle.apply).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
    expect(lifecycle.resume).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
    await expect(executeProjector(["approve", "semantic_change_abc", "--plan-hash", "wrong"], { lifecycle })).rejects.toThrow(/plan hash/iu);
  });

  it("uses explicit safe selectors and never invokes apply effects for dry-run", async () => {
    const change = vi.fn(async () => ({ kind: "change" as const, selector: "change:abc", risk: "R1" as const }));
    const plan = vi.fn(async () => ({ kind: "plan" as const, selector: "plan:abc", changeSelector: "change:abc", preview: { expectedDiff: "one file" }, risk: "R1" as const }));
    const apply = vi.fn(async () => ({ kind: "apply" as const, selector: "plan:abc", outcome: "success" as const, risk: "R1" as const }));
    const resolved = { risk: "R1" as const, planHash: "plan-hash", approvalHash: "approval-hash", capsuleHash: "capsule-hash" };
    const port = { change, plan, resolvePlan: async () => resolved, apply } satisfies ChangeCliPort;
    expect((await executeProjector(["change", "repair-governed-state"], { change: port })).report).toMatchObject({ selector: "change:abc" });
    expect((await executeProjector(["plan", "change:abc"], { change: port })).report).toMatchObject({ selector: "plan:abc" });
    const dryRun = await executeProjector(["apply", "plan:abc", "--dry-run"], { change: port });
    expect(dryRun.report).toMatchObject({ dryRun: true, selector: "plan:abc" }); expect(apply).not.toHaveBeenCalled();
    await expect(executeProjector(["plan", "../escape"], { change: port })).rejects.toThrow(/selector|safe/iu);
    await expect(executeProjector(["apply", "plan:abc", "plan:def"], { change: port })).rejects.toThrow(/argument/iu);
    const unsafe = { ...port, resolvePlan: async () => ({ ...resolved, risk: "R4" as const, planHash: "unsafe" }) };
    await expect(executeProjector(["apply", "plan:abc", "--mode", "govern"], { change: unsafe })).rejects.toThrow(/risk|R4|policy/iu);
    expect(apply).not.toHaveBeenCalled();
    const mismatched = { ...port, apply: async () => ({ kind: "apply", outcome: "success", risk: "R1", immutablePlanHash: "different", approvalHash: "approval-hash", capsuleHash: "capsule-hash" }) } satisfies ChangeCliPort;
    await expect(executeProjector(["apply", "plan:abc", "--mode", "govern"], { change: mismatched })).rejects.toThrow(/immutable|resolved|match/iu);
  });

  it("runs the built natural-language lifecycle end to end against an ordinary Git repository", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-real-change-cli-"));
    try {
      await mkdir(join(repositoryRoot, "src"), { recursive: true });
      await mkdir(join(repositoryRoot, "test"), { recursive: true });
      await writeFile(join(repositoryRoot, "package.json"), "{\"type\":\"module\"}\n");
      await writeFile(join(repositoryRoot, "src", "value.mjs"), "export const value = () => 'placeholder';\n");
      await writeFile(join(repositoryRoot, "test", "public.test.mjs"), "import assert from 'node:assert/strict'; import { value } from '../src/value.mjs'; assert.equal(value(), 'useful');\n");
      const proposal = {
        apiVersion: "projector.change-proposal/v1",
        requirements: [{ key: "useful-value", title: "Useful public value", statement: "The public value is useful.", aliases: [] }],
        scenarios: [{ key: "read-useful-value", title: "Read the useful value", steps: [
          { role: "trigger", statement: "A caller reads the public value." },
          { role: "expected-outcome", statement: "The result is useful." },
        ] }],
        architecture: null,
        edits: [{ path: "src/value.mjs", before: "export const value = () => 'placeholder';\n", after: "export const value = () => 'useful';\n" }],
        validation: { independentNodeTests: ["test/public.test.mjs"], supplementalNodeTests: [] },
        analysisFacets: ["behavior", "architecture"],
      };
      await writeFile(join(repositoryRoot, "proposal.json"), `${JSON.stringify(proposal, null, 2)}\n`);
      const environment = { ...process.env, GIT_AUTHOR_EMAIL: "lifecycle-test@projector.invalid", GIT_AUTHOR_NAME: "Lifecycle Test", GIT_COMMITTER_EMAIL: "lifecycle-test@projector.invalid", GIT_COMMITTER_NAME: "Lifecycle Test", GIT_CONFIG_GLOBAL: join(repositoryRoot, ".no-gitconfig"), GIT_CONFIG_NOSYSTEM: "1" };
      await executeFile("git", ["init", "--quiet", "--initial-branch=main"], { cwd: repositoryRoot, env: environment });
      await executeFile("git", ["add", "--all"], { cwd: repositoryRoot, env: environment });
      await executeFile("git", ["commit", "--quiet", "--no-gpg-sign", "-m", "initial"], { cwd: repositoryRoot, env: environment });

      const captured = await executeProjector(["change", "Make the public value useful", "--proposal", "proposal.json", "--format", "json"], { cwd: repositoryRoot });
      const planned = await executeProjector(["plan", captured.report.selector, "--format", "json"], { cwd: repositoryRoot });
      const approved = await executeProjector(["approve", captured.report.selector, "--plan-hash", planned.report.immutablePlanHash, "--format", "json"], { cwd: repositoryRoot });
      const applied = await executeProjector(["apply", approved.report.selector, "--format", "json"], { cwd: repositoryRoot });

      expect(applied.report).toMatchObject({ kind: "lifecycle-apply", outcome: "success" });
      expect(await readFile(join(repositoryRoot, "src", "value.mjs"), "utf8")).toContain("'useful'");
      expect(applied.report.receipt.changedRequirementIds).toHaveLength(1);
      expect(applied.report.receipt.changedScenarioIds).toHaveLength(1);
    } finally { await rm(repositoryRoot, { recursive: true, force: true }); }
  });

  it("composes the built deterministic mandatory local change through change and plan", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-change-"));
    try {
      await cp(fileURLToPath(new URL("../../../fixtures/misplaced-repository-script/", import.meta.url)), repositoryRoot, { recursive: true });
      const environment = { ...process.env, GIT_AUTHOR_EMAIL: "change-test@projector.invalid", GIT_AUTHOR_NAME: "Change Test", GIT_COMMITTER_EMAIL: "change-test@projector.invalid", GIT_COMMITTER_NAME: "Change Test", GIT_CONFIG_GLOBAL: join(repositoryRoot, ".no-gitconfig"), GIT_CONFIG_NOSYSTEM: "1" };
      await executeFile("git", ["init", "--quiet", "--initial-branch=main"], { cwd: repositoryRoot, env: environment });
      await executeFile("git", ["add", "--all"], { cwd: repositoryRoot, env: environment });
      await executeFile("git", ["commit", "--quiet", "--no-gpg-sign", "-m", "fixture"], { cwd: repositoryRoot, env: environment });
      const observed = await executeProjector(["change", "repair-governed-state", "--mode", "observe"], { cwd: repositoryRoot });
      expect(observed.report).toMatchObject({ persisted: false });
      await expect(access(join(repositoryRoot, ".projector/task16-selections"))).rejects.toThrow();
      await expect(executeProjector(["apply", "plan:semantic:" + "a".repeat(64), "--dry-run"], { cwd: repositoryRoot })).rejects.toThrow(/unavailable|selector/iu);
      const compiled = await executeProjector(["change", "repair-governed-state", "--format", "json"], { cwd: repositoryRoot });
      expect(compiled.report).toMatchObject({ kind: "change", selector: expect.stringMatching(/^change:semantic:[a-f0-9]{64}$/u), deterministic: true, pipeline: "semantic-compiler" });
      const planned = await executeProjector(["plan", compiled.report.selector, "--format", "json"], { cwd: repositoryRoot });
      expect(planned.report).toMatchObject({ kind: "plan", changeSelector: compiled.report.selector, selector: expect.stringMatching(/^plan:semantic:[a-f0-9]{64}$/u), risk: { class: "R1" }, pipeline: "packet-planner" });
      expect(planned.report.plan.boundState).toEqual(planned.report.capsule.boundState);
      const successRoot = await mkdtemp(join(tmpdir(), "projector-change-success-"));
      try {
        await cp(repositoryRoot, successRoot, { recursive: true });
        const applied = await executeProjector(["apply", planned.report.selector, "--mode", "govern"], { cwd: successRoot });
        expect(applied.report).toMatchObject({ outcome: "success", pipeline: "packet-coordinator", coordinator: { status: "completed", surprises: [] } });
        expect(applied.report.coordinator.observedImpact.changedUnitIds.length).toBeGreaterThan(0);
        expect(new Set(applied.report.coordinator.observedImpact.changedUnitIds)).toEqual(new Set(applied.report.plan.knownAffectedUnitIds));
      } finally { await rm(successRoot, { recursive: true, force: true }); }
      await writeFile(join(repositoryRoot, ".codex/hooks/validate-repo.mjs"), "// relevant drift\n", { flag: "a" });
      await expect(executeProjector(["apply", planned.report.selector, "--mode", "govern"], { cwd: repositoryRoot })).rejects.toThrow(/stale|rebase/iu);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });
});
