import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { analyzeLocalRepository } from "../local-repository.js";
import { inventoryRepository } from "./inventory.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-inventory-"));
  temporaryRoots.push(root);
  await execFileAsync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("repository inventory boundary", () => {
  it("bounds cumulative bytes and filesystem cardinality without widening on failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-inventory-limits-")); temporaryRoots.push(root);
    await writeFile(join(root, "first.ts"), "123456");
    await writeFile(join(root, "second.ts"), "abcdef");
    await expect(inventoryRepository(root, { observationLimits: { maxTotalBytes: 10 } })).rejects.toMatchObject({ limit: "maxTotalBytes" });
    await expect(inventoryRepository(root, { observationLimits: { maxFiles: 1 } })).rejects.toMatchObject({ limit: "maxFiles" });
    await mkdir(join(root, "a", "b"), { recursive: true });
    await expect(inventoryRepository(root, { observationLimits: { maxDirectories: 2 } })).rejects.toMatchObject({ limit: "maxDirectories" });
    const complete = await inventoryRepository(root, { observationLimits: { maxTotalBytes: 12, maxFiles: 2, maxDirectories: 3 } });
    expect(complete.entries.map(({ path }) => path)).toEqual(["first.ts", "second.ts"]);
  });

  it("rejects Git output exhaustion, cancellation and invalid overrides", async () => {
    const root = await repository(); await writeFile(join(root, "source.ts"), "export const value = true;");
    await expect(inventoryRepository(root, { observationLimits: { maxGitOutputBytes: 1 } })).rejects.toMatchObject({ limit: "maxGitOutputBytes" });
    await expect(inventoryRepository(root, { observationLimits: { timeoutMs: 1 } })).rejects.toMatchObject({ limit: "timeoutMs" });
    await expect(inventoryRepository(root, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: "observation-failed" });
    await expect(inventoryRepository(root, { observationLimits: { maxFiles: Infinity } })).rejects.toMatchObject({ stage: "limits" });
  });

  it("rejects missing Git executable even for an otherwise readable non-Git root", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-inventory-no-executable-")); temporaryRoots.push(root);
    await writeFile(join(root, "source.ts"), "export const value = true;");
    const originalPath = process.env.PATH; process.env.PATH = root;
    try { await expect(inventoryRepository(root)).rejects.toMatchObject({ code: "observation-failed", stage: "git-inventory" }); }
    finally { if (originalPath === undefined) delete process.env.PATH; else process.env.PATH = originalPath; }
  });

  it("binds ignored nested ignore files and effective repository exclusion configuration", async () => {
    const root = await repository(); await mkdir(join(root, "nested"));
    await writeFile(join(root, ".gitignore"), ".gitignore\n");
    await writeFile(join(root, "nested", ".gitignore"), "hidden.ts\n");
    await writeFile(join(root, "nested", "hidden.ts"), "export const hidden = true;");
    await writeFile(join(root, "nested", "visible.ts"), "export const visible = true;");
    await writeFile(join(root, "custom-ignore"), "other.ts\n");
    await execFileAsync("git", ["config", "core.excludesFile", "custom-ignore"], { cwd: root });
    const before = await inventoryRepository(root);
    expect(before.entries.map(({ path }) => path)).not.toContain("nested/.gitignore");
    expect(before.entries.map(({ path }) => path)).not.toContain("nested/hidden.ts");
    expect(before.observationDescriptor.ignoreSources.map(({ path }) => path)).toEqual(expect.arrayContaining([
      ".gitignore", "nested/.gitignore", "git:config", "git:info/exclude", "git:effective-config", "git:core.excludesFile:custom-ignore",
    ]));
    await writeFile(join(root, "nested", ".gitignore"), "visible.ts\n");
    const after = await inventoryRepository(root);
    expect(after.observationDescriptor.ignoreSources).not.toEqual(before.observationDescriptor.ignoreSources);
    expect(after.entries.map(({ path }) => path)).toContain("nested/hidden.ts");
    const analysis = await analyzeLocalRepository({ repositoryRoot: root });
    expect(analysis.git.availability).toBe("available"); expect(analysis.git.revision).toBe("unborn");
  });
  it("rejects an oversized file before returning any inventory", async () => {
    const root = await repository();
    await writeFile(join(root, "source.ts"), "export const tooLarge = true;");
    await expect(inventoryRepository(root, { observationLimits: { maxFileBytes: 8 } })).rejects.toMatchObject({
      code: "observation-limit-exceeded", limit: "maxFileBytes", scope: "source.ts",
    });
  });
  it("uses Git's current project boundary while retaining tracked ignored code", async () => {
    const root = await repository();
    await Promise.all([
      mkdir(join(root, ".temp")),
      mkdir(join(root, "dist")),
      mkdir(join(root, "src")),
      mkdir(join(root, ".projector", "runtime"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(root, ".gitignore"), ".temp/\ndist/\n.projector/runtime/\n"),
      writeFile(join(root, ".temp", "scratch.ts"), "await import('./unknown.js');\n"),
      writeFile(join(root, "dist", "tracked.ts"), "await import('./tracked-unknown.js');\n"),
      writeFile(join(root, "src", "new.ts"), "export const current = true;\n"),
      writeFile(join(root, ".projector", "runtime", "tracked.ts"), "export const operational = true;\n"),
      writeFile(join(root, "deleted.ts"), "export const deleted = true;\n"),
      writeFile(join(root, "unicode-.ts"), "export const unicode = true;\n"),
    ]);
    await execFileAsync("git", ["add", ".gitignore", "deleted.ts", "unicode-.ts"], { cwd: root });
    await execFileAsync("git", ["add", "--force", "dist/tracked.ts", ".projector/runtime/tracked.ts"], { cwd: root });
    await unlink(join(root, "deleted.ts"));

    const inventory = await inventoryRepository(root);
    const paths = inventory.entries.map(({ path }) => path);

    expect(inventory.enumeration.method).toBe("git-index-and-nonignored-untracked");
    expect(paths).toContain("dist/tracked.ts");
    expect(paths).toContain("src/new.ts");
    expect(paths).toContain("unicode-.ts");
    expect(paths).not.toContain(".temp/scratch.ts");
    expect(paths).not.toContain(".projector/runtime/tracked.ts");
    expect(paths).not.toContain("deleted.ts");
    expect(inventory.failures).toEqual([]);

    const analysis = await analyzeLocalRepository({ repositoryRoot: root });
    expect(analysis.files.some(({ path }) => path === ".temp/scratch.ts")).toBe(false);
    expect(analysis.javaScript.files.find(({ path }) => path === "dist/tracked.ts")?.unknowns).toContain(
      "dynamic import cannot prove a static dependency",
    );
    expect(analysis.surface.enumeration.blindSpots).toContain("untracked Git-ignored files outside the repository inventory");
  });

  it("does not follow a selected tracked path through a replaced symlink parent", async () => {
    const root = await repository();
    const outside = await mkdtemp(join(tmpdir(), "projector-inventory-outside-"));
    temporaryRoots.push(outside);
    await mkdir(join(root, "linked"));
    await writeFile(join(root, "linked", "source.ts"), "export const original = true;\n");
    await execFileAsync("git", ["add", "linked/source.ts"], { cwd: root });
    await rm(join(root, "linked"), { recursive: true });
    await writeFile(join(outside, "source.ts"), "export const escaped = true;\n");
    await symlink(outside, join(root, "linked"), process.platform === "win32" ? "junction" : "dir");

    await expect(inventoryRepository(root)).rejects.toMatchObject({
      code: "observation-failed", stage: "symlink-parent", scope: "linked/source.ts",
    });
  });

  it("falls back honestly without Git and never inventories operational runtime state", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-inventory-gitless-"));
    temporaryRoots.push(root);
    await mkdir(join(root, ".temp"));
    await mkdir(join(root, ".projector", "runtime"), { recursive: true });
    await writeFile(join(root, ".temp", "source.ts"), "export const fallback = true;\n");
    await writeFile(join(root, ".projector", "runtime", "state.json"), "{}\n");

    const inventory = await inventoryRepository(root);

    expect(inventory.enumeration.method).toBe("recursive-filesystem-fallback");
    expect(inventory.entries.map(({ path }) => path)).toContain(".temp/source.ts");
    expect(inventory.entries.some(({ path }) => path.startsWith(".projector/runtime/"))).toBe(false);
    expect(inventory.failures).not.toContainEqual(expect.objectContaining({ capability: "git-aware-inventory" }));
  });

  it("rejects an unexpected Git inventory failure without scanning fallback files", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-inventory-broken-git-"));
    temporaryRoots.push(root);
    await mkdir(join(root, ".git"));
    await writeFile(join(root, "source.ts"), "export const fallback = true;\n");

    await expect(inventoryRepository(root)).rejects.toMatchObject({ code: "observation-failed", stage: "git-inventory" });
  });
});
