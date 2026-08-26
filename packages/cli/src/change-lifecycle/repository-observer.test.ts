import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { observeChangeRepository } from "./repository-observer.js";

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
