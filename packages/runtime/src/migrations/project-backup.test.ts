import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  ProjectBackupError,
  createProjectBackup,
  hashProjectBackupManifest,
  type ProjectBackupManifest,
} from "./project-backup.js";

const roots: string[] = [];

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<{ repositoryRoot: string; codexDataRoot: string }> {
  const root = await mkdtemp(join(tmpdir(), "projector-backup-test-"));
  roots.push(root);
  const repositoryRoot = join(root, "repository");
  const codexDataRoot = join(root, "codex-data");
  await mkdir(join(repositoryRoot, ".projector", "runtime", "journal"), { recursive: true });
  await mkdir(codexDataRoot);
  return { repositoryRoot, codexDataRoot };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("project migration backup", () => {
  test("publishes a full exact-byte .projector backup with a verified machine manifest", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    const files = new Map<string, Buffer>([
      ["config.toml", Buffer.from("format_version = 2\n")],
      ["runtime/journal/receipt.json", Buffer.from('{"committed":true}\n')],
      ["runtime/state.db", Buffer.from([0, 1, 2, 255, 13, 10])],
      ["runtime/state.db-wal", Buffer.from("wal-bytes")],
      ["runtime/state.db-shm", Buffer.from("shm-bytes")],
    ]);
    for (const [relativePath, bytes] of files) {
      const target = join(repositoryRoot, ".projector", ...relativePath.split("/"));
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, bytes);
    }

    const result = await createProjectBackup(
      { repositoryRoot, codexDataRoot },
      { createBackupId: () => "backup-001", now: () => new Date("2026-09-10T17:00:00.000Z") },
    );

    expect(result.backupPath).toBe(join(codexDataRoot, "projector", "backups", "published", "backup-001"));
    expect(result.backupLocation).toEqual({
      kind: "codex-data-relative",
      path: "projector/backups/published/backup-001",
    });
    expect(result.manifest).toEqual({
      formatVersion: 1,
      backupId: "backup-001",
      createdAt: "2026-09-10T17:00:00.000Z",
      source: { projectorDirectory: ".projector" },
      files: [...files].map(([path, bytes]) => ({
        path: `.projector/${path}`,
        length: bytes.byteLength,
        sha256: sha256(bytes),
      })).sort((left, right) => left.path.localeCompare(right.path)),
    });

    const manifestBytes = await readFile(join(result.backupPath, "manifest.json"));
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as ProjectBackupManifest;
    expect(manifest).toEqual(result.manifest);
    expect(result.manifestHash).toBe(hashProjectBackupManifest(manifestBytes));
    for (const entry of manifest.files) {
      const copied = await readFile(join(result.backupPath, ...entry.path.split("/")));
      expect(copied.byteLength).toBe(entry.length);
      expect(sha256(copied)).toBe(entry.sha256);
    }
    await expect(readFile(join(codexDataRoot, "projector", "backups", "staging", "backup-001", "manifest.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects symbolic links in the source without publishing a backup", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    const external = join(repositoryRoot, "external.txt");
    await writeFile(external, "outside");
    await symlink(external, join(repositoryRoot, ".projector", "linked.txt"), "file");

    await expect(createProjectBackup(
      { repositoryRoot, codexDataRoot },
      { createBackupId: () => "linked-source" },
    )).rejects.toThrow(/symbolic link/i);
    await expect(readdir(join(codexDataRoot, "projector", "backups", "published")))
      .resolves.not.toContain("linked-source");
  });

  test("detects source mutation during the copy and leaves an actionable unpublished stage", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    const source = join(repositoryRoot, ".projector", "config.toml");
    await writeFile(source, "before\n");

    let changed = false;
    const operation = createProjectBackup(
      { repositoryRoot, codexDataRoot },
      {
        createBackupId: () => "changing-source",
        afterFileCopied: async () => {
          if (!changed) {
            changed = true;
            await writeFile(source, "after\n");
          }
        },
      },
    );

    await expect(operation).rejects.toMatchObject({
      name: "ProjectBackupError",
      recoveryPath: join(codexDataRoot, "projector", "backups", "staging", "changing-source"),
    });
    expect(await readFile(source, "utf8")).toBe("after\n");
    await expect(readFile(join(codexDataRoot, "projector", "backups", "published", "changing-source", "manifest.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  test("never overwrites a preexisting backup identifier collision", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    await writeFile(join(repositoryRoot, ".projector", "config.toml"), "source\n");
    const existing = join(codexDataRoot, "projector", "backups", "published", "collision");
    await mkdir(existing, { recursive: true });
    await writeFile(join(existing, "owner.txt"), "keep me");

    await expect(createProjectBackup(
      { repositoryRoot, codexDataRoot },
      { createBackupId: () => "collision" },
    )).rejects.toThrow(ProjectBackupError);
    expect(await readFile(join(existing, "owner.txt"), "utf8")).toBe("keep me");
  });

  test("rejects a symbolic-link destination root before writing through it", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    await writeFile(join(repositoryRoot, ".projector", "config.toml"), "source\n");
    const actual = join(codexDataRoot, "actual");
    const linkedRoot = join(codexDataRoot, "linked-root");
    await mkdir(actual);
    await symlink(actual, linkedRoot, "dir");

    await expect(createProjectBackup(
      { repositoryRoot, codexDataRoot: linkedRoot },
      { createBackupId: () => "linked-destination" },
    )).rejects.toThrow(/symbolic link/i);
    expect(await readdir(actual)).toEqual([]);
  });

  test("rejects cross-platform backup identifier aliases before creating storage", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    await writeFile(join(repositoryRoot, ".projector", "config.toml"), "source\n");

    for (const backupId of ["A", "CON", "lpt1.txt", "backup.", "backup ", "a:stream"]) {
      await expect(createProjectBackup(
        { repositoryRoot, codexDataRoot },
        { createBackupId: () => backupId },
      )).rejects.toThrow(/backup identifier/i);
    }
    await expect(readdir(codexDataRoot)).resolves.toEqual([]);
  });
});
