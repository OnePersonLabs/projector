import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PathSecurityError, RepositoryPathService } from "./repository-path.js";

describe("RepositoryPathService", () => {
  it("rejects traversal, absolute, drive, UNC, and non-canonical paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-paths-"));
    const paths = await RepositoryPathService.create(root);

    for (const candidate of [
      "../outside",
      "src/../../outside",
      "/etc/passwd",
      "C:/Windows/System32",
      "C:\\Windows\\System32",
      "//server/share/file",
      "\\\\server\\share\\file",
      "src\\file.ts",
    ]) {
      await expect(paths.resolveRead(candidate)).rejects.toBeInstanceOf(PathSecurityError);
    }
  });

  it("follows an in-root symlink only when explicitly allowed", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-paths-"));
    await mkdir(join(root, "real"));
    await writeFile(join(root, "real", "file.txt"), "safe");
    await symlink("real", join(root, "link"), "dir");
    const paths = await RepositoryPathService.create(root);

    await expect(paths.resolveRead("link/file.txt")).rejects.toMatchObject({ code: "symlink-refused" });

    const resolved = await paths.resolveRead("link/file.txt", "follow-inside");
    expect(resolved.canonicalPath).toBe("link/file.txt");
    expect(resolved.realTarget).toBe(join(root, "real", "file.txt"));
  });

  it("refuses reads and writes through a symlink outside the governed root", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-paths-"));
    const outside = await mkdtemp(join(tmpdir(), "projector-outside-"));
    await writeFile(join(outside, "existing.txt"), "secret");
    await symlink(outside, join(root, "escape"), "dir");
    const paths = await RepositoryPathService.create(root);

    await expect(paths.resolveRead("escape/existing.txt", "follow-inside")).rejects.toMatchObject({
      code: "root-escape",
    });
    await expect(paths.resolveWrite("escape/new.txt", "follow-inside")).rejects.toMatchObject({
      code: "root-escape",
    });
  });

  it("enforces declared scopes before returning a real target", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-paths-"));
    await mkdir(join(root, "src"));
    await mkdir(join(root, "other"));
    const paths = await RepositoryPathService.create(root);

    const allowed = await paths.resolveScopedWrite("src/new.ts", ["src"]);
    expect(allowed.realTarget).toBe(join(root, "src", "new.ts"));
    await expect(paths.resolveScopedWrite("other/new.ts", ["src"])).rejects.toMatchObject({
      code: "scope-refused",
    });
  });
});
