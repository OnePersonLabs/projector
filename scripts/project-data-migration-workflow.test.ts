import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  selectProjectDataMigrationReleaseVersion,
  synchronizeWorkspaceReleaseVersion,
} from "./project-data-migration-workflow.mjs";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("project-data migration release workflow", () => {
  test("preserves a numerically newer authored release and bumps from equal or newer baselines", () => {
    expect(selectProjectDataMigrationReleaseVersion("2.2.0-beta.2", "2.1.9+old-build")).toEqual({ version: "2.2.0-beta.2", changed: false });
    expect(selectProjectDataMigrationReleaseVersion("2.1.0+new-build", "2.1.0+old-build")).toEqual({ version: "2.1.1", changed: true });
    expect(selectProjectDataMigrationReleaseVersion("2.0.0", "2.1.9-beta.4+build.7")).toEqual({ version: "2.1.10", changed: true });
  });

  test("updates every release identity through one bounded package-manager transaction", async () => {
    const root = await workspaceFixture();
    let packageManagerCalls = 0;
    const result = await synchronizeWorkspaceReleaseVersion(root, "2.2.0", { runPackageManager: async () => { packageManagerCalls += 1; } });
    expect(packageManagerCalls).toBe(1);
    expect(result.changedPaths).toHaveLength(4);
    for (const path of ["package.json", "packages/core/package.json", "packages/runtime/package.json", "plugins/projector/.codex-plugin/plugin.json"]) {
      expect(JSON.parse(await readFile(join(root, path), "utf8")).version).toBe("2.2.0");
    }
  });

  test("restores exact manifests and lock bytes when package synchronization fails", async () => {
    const root = await workspaceFixture();
    const paths = ["package.json", "packages/core/package.json", "packages/runtime/package.json", "plugins/projector/.codex-plugin/plugin.json", "pnpm-lock.yaml"];
    const before = await Promise.all(paths.map((path) => readFile(join(root, path), "utf8")));
    await expect(synchronizeWorkspaceReleaseVersion(root, "2.2.0", { runPackageManager: async () => {
      await writeFile(join(root, "pnpm-lock.yaml"), "changed during failed install\n");
      throw new Error("package manager failed");
    } })).rejects.toThrow("package manager failed");
    await expect(Promise.all(paths.map((path) => readFile(join(root, path), "utf8")))).resolves.toEqual(before);
  });
});

async function workspaceFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-version-workflow-"));
  roots.push(root);
  for (const path of ["packages/core", "packages/runtime", "plugins/projector/.codex-plugin"]) await mkdir(join(root, path), { recursive: true });
  for (const [path, name] of [["package.json", "projector"], ["packages/core/package.json", "@projector/core"], ["packages/runtime/package.json", "@projector/runtime"], ["plugins/projector/.codex-plugin/plugin.json", "projector"]]) {
    await writeFile(join(root, path), `${JSON.stringify({ name, version: "2.1.0" }, null, 2)}\n`);
  }
  await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  return root;
}
