import { mkdtemp, mkdir, open, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ProjectBackupError,
  createProjectBackup,
  hashProjectBackupArchive,
  hashProjectBackupManifest,
  verifyProjectBackup,
  type ProjectBackupManifest,
} from "./project-backup.js";

const roots: string[] = [];
const magic = Buffer.from("PROJECTOR-BACKUP-ARCHIVE-V1\n");

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

function decodeArchive(bytes: Buffer): { manifestBytes: Buffer; manifest: ProjectBackupManifest; files: Map<string, Buffer> } {
  expect(bytes.subarray(0, magic.length)).toEqual(magic);
  const manifestLength = Number(bytes.readBigUInt64BE(magic.length));
  const manifestStart = magic.length + 8;
  const manifestBytes = bytes.subarray(manifestStart, manifestStart + manifestLength);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as ProjectBackupManifest;
  const files = new Map<string, Buffer>();
  let offset = manifestStart + manifestLength;
  for (const entry of manifest.files) {
    files.set(entry.path, bytes.subarray(offset, offset + entry.length));
    offset += entry.length;
  }
  expect(offset).toBe(bytes.length);
  return { manifestBytes, manifest, files };
}

describe("project migration backup archive", () => {
  test("publishes one self-contained exact-byte archive directly under the supplied Codex root", async () => {
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
    const syncDirectory = vi.fn(async () => undefined);

    const result = await createProjectBackup(
      { repositoryRoot, codexDataRoot },
      {
        createBackupId: () => "backup-001",
        createTemporaryId: () => "temp-001",
        now: () => new Date("2026-09-10T17:00:00.000Z"),
        syncDirectory,
      },
    );

    expect(result.backupPath).toBe(join(codexDataRoot, "projector-backup-backup-001.pba"));
    expect(result.backupLocation).toEqual({ kind: "codex-data-relative", path: "projector-backup-backup-001.pba" });
    expect(await readdir(codexDataRoot)).toEqual(["projector-backup-backup-001.pba"]);
    const archiveBytes = await readFile(result.backupPath);
    const decoded = decodeArchive(archiveBytes);
    expect(decoded.manifest).toEqual(result.manifest);
    expect(result.manifestHash).toBe(hashProjectBackupManifest(decoded.manifestBytes));
    expect(result.archiveHash).toBe(hashProjectBackupArchive(archiveBytes));
    expect(syncDirectory).toHaveBeenNthCalledWith(1, codexDataRoot);
    expect(syncDirectory).toHaveBeenNthCalledWith(2, codexDataRoot);
    for (const [path, bytes] of files) expect(decoded.files.get(`.projector/${path}`)).toEqual(bytes);
  });

  test("preserves a complete recoverable temp archive when interrupted before namespace publication", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    await writeFile(join(repositoryRoot, ".projector", "config.toml"), "source\n");
    const tempPath = join(codexDataRoot, ".projector-backup-before.temp-001.tmp");
    await expect(createProjectBackup(
      { repositoryRoot, codexDataRoot },
      {
        createBackupId: () => "before",
        createTemporaryId: () => "temp-001",
        crash: (point) => { if (point === "before-namespace-publish") throw new Error("crash before publish"); },
      },
    )).rejects.toMatchObject({ name: "ProjectBackupError", recoveryPath: tempPath });
    const stagedBytes = await readFile(tempPath);
    expect(decodeArchive(stagedBytes).files.get(".projector/config.toml")?.toString()).toBe("source\n");
    await expect(createProjectBackup(
      { repositoryRoot, codexDataRoot },
      { createBackupId: () => "before", createTemporaryId: () => "temp-001" },
    )).rejects.toMatchObject({ recoveryPath: tempPath });
    expect(await readFile(tempPath)).toEqual(stagedBytes);
    await expect(readFile(join(codexDataRoot, "projector-backup-before.pba"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("recovers an exact published archive interrupted before the required second flush", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    await writeFile(join(repositoryRoot, ".projector", "config.toml"), "source\n");
    const published = join(codexDataRoot, "projector-backup-after.pba");
    await expect(createProjectBackup(
      { repositoryRoot, codexDataRoot },
      {
        createBackupId: () => "after",
        createTemporaryId: () => "temp-001",
        crash: (point) => { if (point === "after-namespace-publish") throw new Error("crash after publish"); },
      },
    )).rejects.toMatchObject({ name: "ProjectBackupError", recoveryPath: published });
    const flush = vi.fn(async (handle: Awaited<ReturnType<typeof open>>) => handle.sync());
    const recovered = await createProjectBackup(
      { repositoryRoot, codexDataRoot },
      { createBackupId: () => "after", createTemporaryId: () => "temp-002", syncPublished: flush },
    );
    expect(recovered.backupPath).toBe(published);
    expect(flush).toHaveBeenCalledOnce();
    expect(decodeArchive(await readFile(published)).files.get(".projector/config.toml")?.toString()).toBe("source\n");
  });

  test("propagates a published-file flush failure and retains the exact recovery archive", async () => {
    const { repositoryRoot, codexDataRoot } = await fixture();
    await writeFile(join(repositoryRoot, ".projector", "config.toml"), "source\n");
    const failure = Object.assign(new Error("device flush failed"), { code: "EIO" });
    const published = join(codexDataRoot, "projector-backup-flush.pba");
    await expect(createProjectBackup(
      { repositoryRoot, codexDataRoot },
      {
        createBackupId: () => "flush",
        createTemporaryId: () => "temp-001",
        syncPublished: async () => { throw failure; },
      },
    )).rejects.toMatchObject({ name: "ProjectBackupError", recoveryPath: published, cause: failure });
    expect(decodeArchive(await readFile(published)).files.get(".projector/config.toml")?.toString()).toBe("source\n");
  });

  test("rejects source changes and published tampering without reporting success", async () => {
    const first = await fixture();
    const source = join(first.repositoryRoot, ".projector", "config.toml");
    await writeFile(source, "before\n");
    await expect(createProjectBackup(
      first,
      {
        createBackupId: () => "changing",
        createTemporaryId: () => "temp-001",
        afterFileCopied: async () => writeFile(source, "after\n"),
      },
    )).rejects.toThrow(/source changed/i);
    await expect(readFile(join(first.codexDataRoot, "projector-backup-changing.pba"))).rejects.toMatchObject({ code: "ENOENT" });

    const second = await fixture();
    await writeFile(join(second.repositoryRoot, ".projector", "config.toml"), "trusted\n");
    await expect(createProjectBackup(
      second,
      {
        createBackupId: () => "tampered",
        createTemporaryId: () => "temp-001",
        afterNamespacePublished: async (path) => writeFile(path, "tampered"),
      },
    )).rejects.toThrow(/archive|verification|magic/i);
  });

  test("rejects unsafe links and unknown existing backup IDs without writing through or over them", async () => {
    const linked = await fixture();
    const outside = join(linked.repositoryRoot, "outside.txt");
    await writeFile(outside, "outside");
    await symlink(outside, join(linked.repositoryRoot, ".projector", "linked.txt"), "file");
    await expect(createProjectBackup(linked, { createBackupId: () => "linked" })).rejects.toThrow(/symbolic link/i);
    expect(await readdir(linked.codexDataRoot)).toEqual([]);
    const linkedDataRoot = join(linked.codexDataRoot, "..", "linked-codex-data");
    await symlink(linked.codexDataRoot, linkedDataRoot, "dir");
    await expect(createProjectBackup(
      { repositoryRoot: linked.repositoryRoot, codexDataRoot: linkedDataRoot },
      { createBackupId: () => "linked-root" },
    )).rejects.toThrow(/symbolic link/i);
    expect(await readdir(linked.codexDataRoot)).toEqual([]);

    const collision = await fixture();
    await writeFile(join(collision.repositoryRoot, ".projector", "config.toml"), "source\n");
    const destination = join(collision.codexDataRoot, "projector-backup-collision.pba");
    await writeFile(destination, "foreign bytes");
    await expect(createProjectBackup(collision, { createBackupId: () => "collision" }))
      .rejects.toThrow(ProjectBackupError);
    expect(await readFile(destination, "utf8")).toBe("foreign bytes");
  });

  test("authenticates a recorded backup reference without mutating the archive", async () => {
    const input = await fixture();
    await writeFile(join(input.repositoryRoot, ".projector", "config.toml"), "source\n");
    const created = await createProjectBackup(input, {
      createBackupId: () => "verify-001",
      createTemporaryId: () => "temp-001",
    });
    const before = await readFile(created.backupPath);

    const verified = await verifyProjectBackup({
      codexDataRoot: input.codexDataRoot,
      backup: {
        id: created.backupId,
        location: created.backupLocation,
        manifestHash: created.manifestHash,
      },
    });

    expect(verified).toEqual(created);
    expect(await readFile(created.backupPath)).toEqual(before);
  });

  test("rejects missing, tampered, and mismatched recorded backup evidence", async () => {
    const input = await fixture();
    await writeFile(join(input.repositoryRoot, ".projector", "config.toml"), "source\n");
    const created = await createProjectBackup(input, {
      createBackupId: () => "verify-002",
      createTemporaryId: () => "temp-001",
    });
    const backup = {
      id: created.backupId,
      location: created.backupLocation,
      manifestHash: created.manifestHash,
    } as const;

    await expect(verifyProjectBackup({
      codexDataRoot: input.codexDataRoot,
      backup: { ...backup, manifestHash: `sha256:v1:${"0".repeat(64)}` },
    })).rejects.toThrow(/manifest hash/i);
    await expect(verifyProjectBackup({
      codexDataRoot: input.codexDataRoot,
      backup: { ...backup, location: { kind: "codex-data-relative", path: "other.pba" } },
    })).rejects.toThrow(/location/i);

    await writeFile(created.backupPath, Buffer.concat([await readFile(created.backupPath), Buffer.from("tampered")]));
    await expect(verifyProjectBackup({ codexDataRoot: input.codexDataRoot, backup }))
      .rejects.toThrow(/trailing|missing|archive/i);
    await rm(created.backupPath);
    await expect(verifyProjectBackup({ codexDataRoot: input.codexDataRoot, backup }))
      .rejects.toThrow(/backup/i);
    const outside = join(input.codexDataRoot, "outside.pba");
    await writeFile(outside, "foreign bytes");
    await symlink(outside, created.backupPath, "file");
    await expect(verifyProjectBackup({ codexDataRoot: input.codexDataRoot, backup }))
      .rejects.toThrow(/symbolic link/i);
  });
});
