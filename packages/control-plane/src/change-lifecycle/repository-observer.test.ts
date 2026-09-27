import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it, vi } from "vitest";
import { hashFramedDomain, withCanonicalHashes } from "@projector/core";
import { CanonicalFileRepository, withObservationScope } from "@projector/runtime";
import * as observationTasks from "../observation/task-runner.js";

import { observeChangeRepository, observeRepositoryState } from "./repository-observer.js";

const exec = promisify(execFile);

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-change-observer-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  await writeFile(join(root, "src", "greeting.mjs"), "export const greet = () => 'hello';\n");
  await writeFile(join(root, "test", "public-contract.test.mjs"), "import assert from 'node:assert'; assert.equal(1, 1);\n");
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

describe("change repository observer", () => {
  it("reuses state only after complete independent input parity and otherwise matches full analysis", async () => {
    const root = await repository();
    const calls = vi.spyOn(observationTasks, "runObservationTask");
    try {
      let before = await observeChangeRepository(root);
      calls.mockClear();
      expect(await observeRepositoryState(before)).toEqual(before.state);
      expect(calls).not.toHaveBeenCalled();
      const changes = [
        () => writeFile(join(root, "src/greeting.mjs"), "// @generated\nexport const greet = () => 'hi';\n"),
        () => writeFile(join(root, "src/new.mjs"), "export const added = true;\n"),
        () => rm(join(root, "src/new.mjs")),
        async () => {
          const hash = hashFramedDomain("state-parity-test", "requirement");
          await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "requirement", id: "requirement:greeting", key: "greeting", lifecycle: "active", payload: { id: "requirement:greeting", key: "greeting", title: "Greeting", statement: "The greeting preserves its name.", aliases: [], status: "active", sourceClass: "authored", scope: { op: "all", items: [] }, evidence: [], origin: [], discoveryHash: hash, semanticHash: hash } }));
        },
        async () => { await writeFile(join(root, ".gitignore"), "ignored.mjs\n"); await writeFile(join(root, "ignored.mjs"), "export const ignored = true;\n"); },
        () => writeFile(join(root, ".gitignore"), "# Include the new file\n"),
        async () => { await exec("git", ["add", "."], { cwd: root }); await exec("git", ["commit", "-qm", "changed inputs"], { cwd: root }); },
      ];
      for (const change of changes) {
        await change();
        calls.mockClear();
        const state = await observeRepositoryState(before);
        expect(calls.mock.calls.filter(([type]) => type === "observe")).toHaveLength(1);
        const full = await observeChangeRepository(root);
        expect(state).toEqual(full.state);
        expect(state).not.toEqual(before.state);
        before = full;
      }
      await writeFile(join(root, "excluded-noise.mjs"), "export const ignored = false;\n");
      await writeFile(join(root, ".gitignore"), "excluded-noise.mjs\n");
      const excluded = await observeChangeRepository(root);
      await writeFile(join(root, "excluded-noise.mjs"), "export const ignored = 'unobserved';\n");
      calls.mockClear();
      expect(await observeRepositoryState(excluded)).toEqual(excluded.state);
      expect(calls).not.toHaveBeenCalled();
      const uncaptured = { ...excluded };
      calls.mockClear();
      expect(await observeRepositoryState(uncaptured)).toEqual(excluded.state);
      expect(calls.mock.calls.filter(([type]) => type === "observe")).toHaveLength(1);
    } finally { calls.mockRestore(); await rm(root, { recursive: true, force: true }); }
  });

  it("retains collection limits and cancellation during state reuse proof", async () => {
    const root = await repository();
    try {
      const before = await observeChangeRepository(root);
      await expect(withObservationScope({ limits: { maxFiles: 1 } }, () => observeRepositoryState(before))).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxFiles" });
      const controller = new AbortController();
      controller.abort(new Error("state proof cancelled"));
      await expect(async () => withObservationScope({ signal: controller.signal }, () => observeRepositoryState(before))).rejects.toThrow("state proof cancelled");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("derives real state and excludes operational Projector records", async () => {
    const root = await repository();
    try {
      const before = await observeChangeRepository(root);
      await mkdir(join(root, ".projector", "runtime", "change-lifecycles"), { recursive: true });
      await writeFile(join(root, ".projector", "runtime", "change-lifecycles", "noise.json"), "{\"attempt\":1}\n");
      const operationalNoise = await observeChangeRepository(root);
      expect(operationalNoise.state).toEqual(before.state);
      expect(operationalNoise.analysis.files.some(({ path }) => path.startsWith(".projector/runtime/"))).toBe(false);

      await writeFile(join(root, "src", "greeting.mjs"), "export const greet = () => 'hi';\n");
      const changed = await observeChangeRepository(root);
      expect(changed.state.worktreeDigest).not.toBe(before.state.worktreeDigest);
      expect(changed.state.gitBase).toBe(before.state.gitBase);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("proves an independent validator exists unchanged in Git base", async () => {
    const root = await repository();
    try {
      const observation = await observeChangeRepository(root);
      const validator = await observation.independentValidator("test/public-contract.test.mjs");
      expect(validator).toMatchObject({ path: "test/public-contract.test.mjs", tracked: true });
      expect(validator.introductionCommit).toMatch(/^[0-9a-f]{40}$/u);

      await writeFile(join(root, "test", "public-contract.test.mjs"), "throw new Error('tampered');\n");
      await expect((await observeChangeRepository(root)).independentValidator("test/public-contract.test.mjs")).rejects.toThrow(/Git base|unchanged/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
