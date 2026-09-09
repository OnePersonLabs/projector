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

    const inventory = await inventoryRepository(root);

    expect(inventory.entries.some(({ path }) => path === "linked/source.ts")).toBe(false);
    expect(inventory.failures).toContainEqual(expect.objectContaining({
      analyzerId: "projector.filesystem-local",
      capability: "symlink-parent",
      scope: "linked/source.ts",
      affectedClaimKinds: ["artifact-enumeration", "inventory-completeness", "source-relationships"],
    }));
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

  it("reports an unexpected Git inventory failure without discarding readable fallback files", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-inventory-broken-git-"));
    temporaryRoots.push(root);
    await mkdir(join(root, ".git"));
    await writeFile(join(root, "source.ts"), "export const fallback = true;\n");

    const inventory = await inventoryRepository(root);

    expect(inventory.enumeration.method).toBe("recursive-filesystem-fallback");
    expect(inventory.entries.map(({ path }) => path)).toContain("source.ts");
    expect(inventory.failures).toContainEqual(expect.objectContaining({
      analyzerId: "projector.filesystem-local",
      capability: "git-aware-inventory",
      affectedClaimKinds: ["artifact-enumeration", "inventory-completeness"],
    }));
  });
});
