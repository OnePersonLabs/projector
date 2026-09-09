import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

import { executeProjector, type RepositoryLifecycleCliPort } from "./cli.js";

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
    expect((await executeProjector(["change", "Make the value useful for real callers", "--proposal", "proposal.json", "--context", "knowledge_context_abc"], { lifecycle })).report.selector).toBe("semantic_change_abc");
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
    expect(lifecycle.capture).toHaveBeenCalledWith(expect.objectContaining({ request: "Make the value useful for real callers", proposalPath: "proposal.json", knowledgeContextId: "knowledge_context_abc" }));
    expect(lifecycle.apply).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
    expect(lifecycle.resume).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
    await expect(executeProjector(["approve", "semantic_change_abc", "--plan-hash", "wrong"], { lifecycle })).rejects.toThrow(/plan hash/iu);
    await expect(executeProjector(["change", "request"], { lifecycle })).rejects.toThrow(/--proposal/iu);
    await expect(executeProjector(["plan"], { lifecycle })).rejects.toThrow(/selector/iu);
    await expect(executeProjector(["apply"], { lifecycle })).rejects.toThrow(/selector/iu);
    await expect(executeProjector(["recover"], { lifecycle })).rejects.toThrow(/selector/iu);
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
      await mkdir(join(repositoryRoot, ".projector"));
      await writeFile(join(repositoryRoot, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
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

});
