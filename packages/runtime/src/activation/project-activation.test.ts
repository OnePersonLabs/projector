import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { initializeProjectActivation, inspectProjectActivation } from "./project-activation.js";

const roots: string[] = [];
const exec = promisify(execFile);
async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "projector-runtime-activation-"));
  roots.push(value);
  await mkdir(join(value, ".git"));
  return value;
}
afterEach(async () => Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true }))));

describe("project activation authority", () => {
  it("creates one strict marker and is idempotent", async () => {
    const repositoryRoot = await root();
    expect(await inspectProjectActivation(repositoryRoot)).toMatchObject({ status: "disabled", failure: "missing" });
    expect(await initializeProjectActivation(repositoryRoot)).toMatchObject({ created: true });
    expect(await initializeProjectActivation(repositoryRoot)).toMatchObject({ created: false });
    expect(await inspectProjectActivation(repositoryRoot)).toMatchObject({ status: "enabled" });
    expect(await readFile(join(repositoryRoot, ".projector", "config.json"), "utf8")).toBe('{"apiVersion":"projector.config/v1","enabled":true}\n');
  });

  it("never replaces invalid or unsupported configuration", async () => {
    const repositoryRoot = await root();
    const path = join(repositoryRoot, ".projector", "config.json");
    await mkdir(join(repositoryRoot, ".projector"));
    const original = '{"apiVersion":"projector.config/v2","enabled":true}\n';
    await writeFile(path, original);

    await expect(initializeProjectActivation(repositoryRoot)).rejects.toThrow(/unsupported/iu);
    expect(await readFile(path, "utf8")).toBe(original);
  });

  it("keeps accepted project files visible while ignoring local state and preserving project rules on repeated init", async () => {
    const repositoryRoot = await root();
    await exec("git", ["init", "-q", repositoryRoot]);
    const directory = join(repositoryRoot, ".projector");
    await mkdir(directory);
    const ignorePath = join(directory, ".gitignore");
    const original = "# Project-specific exception\r\n/state.db\r\n!/watch/\r\n";
    await writeFile(ignorePath, original);
    await initializeProjectActivation(repositoryRoot);
    const once = await readFile(ignorePath, "utf8");
    expect(once.endsWith(original)).toBe(true);
    expect(once.match(/^\/state\.db$/gmu)).toHaveLength(1);
    await initializeProjectActivation(repositoryRoot);
    expect(await readFile(ignorePath, "utf8")).toBe(once);

    const files = ["state.db", "state.db-wal", "state.db-shm", "state.db-journal", "runtime/journal/one.json", "telemetry/runs.jsonl", "watch/local.json", "model/concepts/one.json", "lenses/one.json", "decisions/one.json", "authorities/one.json"];
    for (const file of files) {
      const target = join(directory, file);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, "{}\n");
    }
    const visible = (await exec("git", ["ls-files", "--others", "--exclude-standard", "--", ".projector"], { cwd: repositoryRoot })).stdout.trim().split(/\r?\n/u).sort();
    expect(visible).toEqual([".projector/.gitignore", ".projector/authorities/one.json", ".projector/config.json", ".projector/decisions/one.json", ".projector/lenses/one.json", ".projector/model/concepts/one.json", ".projector/watch/local.json"]);
    expect((await exec("git", ["ls-files", "--cached"], { cwd: repositoryRoot })).stdout).toBe("");
  });

  it("rejects symlink escape at the marker directory", async () => {
    const repositoryRoot = await root();
    const outside = await root();
    await symlink(outside, join(repositoryRoot, ".projector"), "dir");

    expect(await inspectProjectActivation(repositoryRoot)).toMatchObject({ status: "disabled", failure: "unsafe" });
    await expect(initializeProjectActivation(repositoryRoot)).rejects.toThrow(/symbolic|symlink/iu);
    await expect(readFile(join(outside, "config.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
