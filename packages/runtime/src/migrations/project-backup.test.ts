import { createHash } from "node:crypto";
import { mkdtemp, mkdir, open, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ProjectBackupError,
  createProjectBackup,
  hashProjectBackupArchive,
  hashProjectBackupManifest,
  verifyRetainedProjectDataTarget,
  verifyProjectBackup,
  type ProjectBackupManifest,
} from "./project-backup.js";
import { FileTransactionJournal } from "../journal/transaction-journal.js";
import { withProjectOperationAccess } from "../access/operation-access.js";
import { RepositoryPathService } from "../security/repository-path.js";
import { WriterLeaseManager } from "../worktrees/writer-lease.js";

const roots: string[] = [];
const magic = Buffer.from("PROJECTOR-BACKUP-ARCHIVE-V1\n");
let transactionSequence = 0;

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

async function commitProjectChange(repositoryRoot: string, path: string, bytes: string) {
  const journal = new FileTransactionJournal(await RepositoryPathService.create(repositoryRoot));
  const transactionId = `retained-${transactionSequence += 1}`;
  const transaction = await journal.begin({
    transactionId,
    planId: "plan:retained-verification",
    beforeState: {
      gitBase: "HEAD",
      worktreeDigest: `sha256:v1:${"1".repeat(64)}`,
      canonicalProjectorDigest: `sha256:v1:${"2".repeat(64)}`,
      toolchainDigest: `sha256:v1:${"3".repeat(64)}`,
    },
    allowedWriteRoots: [".projector"],
  });
  await transaction.writeFile(path, bytes);
  for (const phase of ["workspace-staged", "validating", "canonical-staging", "committing"] as const) {
    await transaction.transition(phase);
  }
  await transaction.commit();
  return {
    exact: await journal.readExact(transactionId),
    journalPath: `.projector/runtime/journal/${createHash("sha256").update(transactionId).digest("hex")}.json`,
  };
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

  test("backs up durable history while its authenticated access and writer heartbeats change", async () => {
    const input = await fixture();
    await writeFile(join(input.repositoryRoot, ".projector", "config.toml"), "source\n");
    const journalPath = join(input.repositoryRoot, ".projector", "runtime", "journal", "receipt.json");
    await writeFile(journalPath, "durable receipt\n");
    const paths = await RepositoryPathService.create(input.repositoryRoot);
    const leases = new WriterLeaseManager(paths, { staleAfterMs: 10_000 });
    const digest = `sha256:v1:${"1".repeat(64)}` as const;

    const result = await withProjectOperationAccess(
      input.repositoryRoot,
      { operation: "test.backup", mode: "exclusive" },
      async (operationAccess) => {
        const writerLease = await leases.acquireMigrationRecovery({
          sessionId: "backup-test",
          processId: 42,
          attemptId: "migration-attempt:backup-test:001",
          migrationId: "migration:backup-test",
          manifestHash: digest,
          targetSnapshotHash: digest,
          backupManifestHash: digest,
        });
        try {
          return await createProjectBackup(
            { ...input, coordination: { operationAccess, writerLease } },
            {
              createBackupId: () => "coordinated",
              createTemporaryId: () => "coordinated-temp",
              afterFileCopied: async () => {
                await operationAccess.assertOwned();
                await writerLease.heartbeat();
              },
            },
          );
        } finally {
          await writerLease.release();
        }
      },
    );

    expect(result.manifest.files.map((file) => file.path)).toEqual([
      ".projector/config.toml",
      ".projector/runtime/journal/receipt.json",
    ]);
    expect(decodeArchive(await readFile(result.backupPath)).files.get(
      ".projector/runtime/journal/receipt.json",
    )?.toString()).toBe("durable receipt\n");
  });

  test("rejects unrecognized claimed exclusions and still detects unrelated runtime mutation", async () => {
    const first = await fixture();
    await writeFile(join(first.repositoryRoot, ".projector", "config.toml"), "source\n");
    await expect(createProjectBackup({
      ...first,
      coordination: {
        operationAccess: {
          ownedRelativePaths: [
            ".projector/runtime/operation-access/next-ticket",
            ".projector/runtime/journal/receipt.json",
          ],
          assertOwned: async () => undefined,
        },
        writerLease: { heartbeat: async () => undefined },
      },
    })).rejects.toThrow(/exactly.*counter and holder/i);
    expect(await readdir(first.codexDataRoot)).toEqual([]);

    const second = await fixture();
    await writeFile(join(second.repositoryRoot, ".projector", "config.toml"), "source\n");
    const evidence = join(second.repositoryRoot, ".projector", "runtime", "journal", "receipt.json");
    await writeFile(evidence, "before\n");
    await expect(createProjectBackup(
      second,
      {
        createBackupId: () => "runtime-changing",
        createTemporaryId: () => "runtime-changing-temp",
        afterFileCopied: async (path) => {
          if (path === ".projector/config.toml") await writeFile(evidence, "after\n");
        },
      },
    )).rejects.toThrow(/source changed/i);
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

describe("retained project target verification", () => {
  test("accepts only the exact backup tree transformed by an exact committed journal", async () => {
    const input = await fixture();
    await writeFile(join(input.repositoryRoot, ".projector", "config.toml"), "before\n");
    await writeFile(join(input.repositoryRoot, ".projector", "meaning.toml"), "untouched\n");
    await writeFile(join(input.repositoryRoot, ".projector", "runtime", "state.db"), Buffer.from([1, 2, 3]));
    const created = await createProjectBackup(input, {
      createBackupId: () => "retained-pass",
      createTemporaryId: () => "temp-pass",
    });
    const committed = await commitProjectChange(input.repositoryRoot, ".projector/config.toml", "after\n");

    const result = await verifyRetainedProjectDataTarget({
      repositoryRoot: input.repositoryRoot,
      codexDataRoot: input.codexDataRoot,
      backup: {
        id: created.backupId,
        location: created.backupLocation,
        manifestHash: created.manifestHash,
      },
      journal: committed.exact,
      operationalPaths: [committed.journalPath],
    });

    expect(result).toEqual({
      backup: created,
      journalHash: committed.exact.contentHash,
      retainedFileCount: 3,
      currentFiles: [
        { path: ".projector/config.toml", length: 6, sha256: createHash("sha256").update("after\n").digest("hex") },
        { path: ".projector/meaning.toml", length: 10, sha256: createHash("sha256").update("untouched\n").digest("hex") },
        { path: ".projector/runtime/state.db", length: 3, sha256: createHash("sha256").update(Buffer.from([1, 2, 3])).digest("hex") },
      ],
    });
  });

  test("rejects untouched edits, extra runtime or residue files, SQLite changes, and prefix ignores", async () => {
    const input = await fixture();
    const projector = join(input.repositoryRoot, ".projector");
    await writeFile(join(projector, "config.toml"), "before\n");
    await writeFile(join(projector, "meaning.toml"), "untouched\n");
    await writeFile(join(projector, "runtime", "state.db"), Buffer.from([1, 2, 3]));
    const created = await createProjectBackup(input, {
      createBackupId: () => "retained-negative",
      createTemporaryId: () => "temp-negative",
    });
    const committed = await commitProjectChange(input.repositoryRoot, ".projector/config.toml", "after\n");
    const base = {
      repositoryRoot: input.repositoryRoot,
      codexDataRoot: input.codexDataRoot,
      backup: { id: created.backupId, location: created.backupLocation, manifestHash: created.manifestHash },
      journal: committed.exact,
      operationalPaths: [committed.journalPath],
    } as const;

    await writeFile(join(projector, "meaning.toml"), "changed\n");
    await expect(verifyRetainedProjectDataTarget(base)).rejects.toThrow(/changed.*meaning\.toml/i);
    await writeFile(join(projector, "meaning.toml"), "untouched\n");

    await rm(join(projector, "meaning.toml"));
    await expect(verifyRetainedProjectDataTarget(base)).rejects.toThrow(/missing.*meaning\.toml/i);
    await writeFile(join(projector, "meaning.toml"), "untouched\n");

    const runtimeExtra = join(projector, "runtime", "unexpected.json");
    await writeFile(runtimeExtra, "{}\n");
    await expect(verifyRetainedProjectDataTarget(base)).rejects.toThrow(/extra.*unexpected\.json/i);
    await rm(runtimeExtra);

    await writeFile(join(projector, "runtime", "state.db"), Buffer.from([9, 9, 9]));
    await expect(verifyRetainedProjectDataTarget(base)).rejects.toThrow(/changed.*state\.db/i);
    await writeFile(join(projector, "runtime", "state.db"), Buffer.from([1, 2, 3]));

    const residue = join(projector, "migration-residue.tmp");
    await writeFile(residue, "residue");
    await expect(verifyRetainedProjectDataTarget(base)).rejects.toThrow(/extra.*migration-residue/i);
    await rm(residue);

    const accessDirectory = join(projector, "runtime", "access");
    await mkdir(accessDirectory);
    await writeFile(join(accessDirectory, "claim.json"), "{}\n");
    await expect(verifyRetainedProjectDataTarget({
      ...base,
      operationalPaths: [committed.journalPath, ".projector/runtime/access"],
    })).rejects.toThrow(/extra.*claim\.json/i);
    await expect(verifyRetainedProjectDataTarget({
      ...base,
      operationalPaths: [committed.journalPath, ".projector/runtime/access/claim.json"],
    })).resolves.toMatchObject({ retainedFileCount: 3 });
  });

  test("rejects a committed journal whose recorded before-state is not the verified backup", async () => {
    const input = await fixture();
    const config = join(input.repositoryRoot, ".projector", "config.toml");
    await writeFile(config, "backed-up\n");
    const created = await createProjectBackup(input, {
      createBackupId: () => "retained-before-mismatch",
      createTemporaryId: () => "temp-before-mismatch",
    });
    await writeFile(config, "intervening\n");
    const committed = await commitProjectChange(input.repositoryRoot, ".projector/config.toml", "published\n");

    await expect(verifyRetainedProjectDataTarget({
      repositoryRoot: input.repositoryRoot,
      codexDataRoot: input.codexDataRoot,
      backup: { id: created.backupId, location: created.backupLocation, manifestHash: created.manifestHash },
      journal: committed.exact,
      operationalPaths: [committed.journalPath],
    })).rejects.toThrow(/before-state.*config\.toml/i);
  });
});
