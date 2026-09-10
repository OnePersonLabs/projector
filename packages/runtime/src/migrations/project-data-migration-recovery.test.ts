import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProjectDataMigrationReceipt,
  CanonicalDocumentEnvelopeSchema,
  hashFramedDomain,
  hashProjectDataFormatSnapshot,
  hashRootManifest,
  PreparedProjectorConfigSchema,
  withCanonicalHashes,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type PendingProjectDataMigration,
  type StateDigest,
} from "@projector/core";
import { afterEach, describe, expect, test, vi } from "vitest";

import { FileTransactionJournal } from "../journal/index.js";
import { CanonicalFileRepository, parseTomlDocument, stringifyTomlDocument } from "../persistence/index.js";
import { RepositoryPathService } from "../security/index.js";
import { PendingProjectDataMigrationStore } from "./pending-project-data-migration.js";
import { createProjectBackup } from "./project-backup.js";
import { ProjectDataMigrationReceiptStore } from "./project-data-migration-receipt.js";
import {
  ProjectDataMigrationAccessLostError,
  reconcileCompletedProjectDataMigration,
} from "./project-data-migration-recovery.js";

const roots: string[] = [];
const hash = (digit: string) => `sha256:v1:${digit.repeat(64)}` as ContentHash;
const defaultBackup = {
  id: "backup:legacy-to-toml",
  location: { kind: "codex-data-relative" as const, path: "projector-backup-legacy-to-toml.pba" },
  manifestHash: hash("5"),
};
const beforeState: StateDigest = {
  gitBase: "base-revision",
  worktreeDigest: hash("6"),
  canonicalProjectorDigest: hash("7"),
  toolchainDigest: hash("8"),
};
const zeroHash = hash("0");

function concept(): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "concept",
    id: "concept:migrated",
    key: "concept:migrated",
    lifecycle: "active",
    payload: {
      id: "concept:migrated",
      key: "concept:migrated",
      kind: "behavior",
      name: "Migrated",
      aliases: [],
      statement: "Readable migrated meaning.",
      status: "active",
      sourceClass: "authored",
      confidence: 1,
      tags: [],
      evidence: [],
      discoveryHash: zeroHash,
      semanticHash: zeroHash,
    },
  });
}

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-migration-recovery-"));
  roots.push(root);
  await mkdir(join(root, ".projector"));
  await writeFile(join(root, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
  await mkdir(join(root, "codex-data"));
  const pending = new PendingProjectDataMigrationStore(root);
  const receipts = new ProjectDataMigrationReceiptStore(root);
  const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
  return { root, pending, receipts, journal };
}

function pendingMarker(backup = defaultBackup, targetSnapshotHash = hash("3")): PendingProjectDataMigration {
  return {
    apiVersion: "projector.pending-project-data-migration/v1",
    attemptId: "migration-attempt:legacy-to-toml:001",
    migrationId: "migration:legacy-to-toml",
    sourceSnapshotHash: hash("2"),
    targetSnapshotHash,
    manifestHash: hash("1"),
    backup,
    stagingLocation: ".projector/migration-stage",
    phase: "backed-up",
    createdAt: "2026-09-10T18:00:00.000Z",
  };
}

async function committedEvidence() {
  const fixtureValue = await fixture();
  const backupResult = await createProjectBackup(
    { repositoryRoot: fixtureValue.root, codexDataRoot: join(fixtureValue.root, "codex-data") },
    { createBackupId: () => "legacy-to-toml", createTemporaryId: () => "legacy-to-toml-temp" },
  );
  const backup = {
    id: backupResult.backupId,
    location: backupResult.backupLocation,
    manifestHash: backupResult.manifestHash,
  };
  const canonical = concept();
  const canonicalRepository = new CanonicalFileRepository(fixtureValue.root);
  const preparedCanonical = canonicalRepository.prepareWrite(canonical);
  const canonicalDigest = hashRootManifest([{
    entityId: canonical.id,
    canonicalDocumentHash: canonical.canonicalDocumentHash,
  }]);
  const config = { apiVersion: "projector.config/v1" as const, enabled: true as const, projectorVersion: "2.1.0" };
  const configBytes = stringifyTomlDocument(config, { schemaPath: "schemas/projector-config-v1.schema.json" });
  const targetSnapshotBody = {
    apiVersion: "projector.project-data-format-snapshot/v1" as const,
    packageIdentity: { name: "projector", version: "2.1.0" },
    preparedConfig: {
      apiVersion: config.apiVersion,
      projectorVersion: config.projectorVersion,
      schemaHash: hashFramedDomain("prepared-projector-config-schema", "v1"),
    },
    canonical: {
      envelopeApiVersion: "projector/v2" as const,
      schemaBundleHash: hash("a"),
    },
    runtimeEvidence: { schemaVersion: "1.0.0", schemaHash: hash("b") },
    sqlite: { schemaVersion: 1, migrationSetHash: hash("c") },
  };
  const targetSnapshot = {
    ...targetSnapshotBody,
    snapshotHash: hashProjectDataFormatSnapshot(targetSnapshotBody),
  };
  const marker = pendingMarker(backup, targetSnapshot.snapshotHash);
  await fixtureValue.pending.create(marker);
  await fixtureValue.pending.transition(marker, "staged");
  await fixtureValue.pending.transition(marker, "publishing");
  const transaction = await fixtureValue.journal.begin({
    transactionId: marker.attemptId,
    planId: marker.manifestHash,
    beforeState,
    intendedAfterCanonicalDigest: canonicalDigest,
    allowedWriteRoots: [".projector"],
    pendingMigration: marker,
  });
  await transaction.writeFile(preparedCanonical.path.slice(fixtureValue.root.length + 1).replaceAll("\\", "/"), preparedCanonical.contents);
  await transaction.deleteFile(".projector/config.json");
  await transaction.writeFile(".projector/config.toml", configBytes);
  for (const phase of ["workspace-staged", "validating", "canonical-staging", "committing"] as const) {
    await transaction.transition(phase);
  }
  await transaction.commit();
  const exact = await fixtureValue.journal.readExact(marker.attemptId);
  const receipt = createProjectDataMigrationReceipt({
    apiVersion: "projector.project-data-migration-receipt/v1",
    attemptId: marker.attemptId,
    migrationId: marker.migrationId,
    manifestHash: marker.manifestHash,
    sourceSnapshotHash: marker.sourceSnapshotHash,
    targetSnapshotHash: marker.targetSnapshotHash,
    journalId: exact.record.entry.transactionId,
    journalHash: exact.contentHash,
    backup,
    outcome: "completed",
    completedAt: "2026-09-10T18:01:00.000Z",
  });
  const target = {
    observeCurrentTarget: async () => {
      PreparedProjectorConfigSchema.parse(parseTomlDocument(
        await readFile(join(fixtureValue.root, ".projector", "config.toml"), "utf8"),
        ".projector/config.toml",
      ));
      const currentCanonical = CanonicalDocumentEnvelopeSchema.parse(parseTomlDocument(
        await readFile(preparedCanonical.path, "utf8"),
        preparedCanonical.path,
      )) as CanonicalDocumentEnvelope;
      const currentDigest = hashRootManifest([{
        entityId: currentCanonical.id,
        canonicalDocumentHash: currentCanonical.canonicalDocumentHash,
      }]);
      if (currentDigest !== canonicalDigest) throw new Error("canonical target semantic set is stale");
      await expectMissing(join(fixtureValue.root, ".projector", "config.json"));
      return { format: targetSnapshot, canonicalRootDigest: currentDigest };
    },
  };
  return {
    ...fixtureValue,
    marker,
    receipt,
    target,
    targetSnapshot,
    canonicalDigest,
    canonicalPath: preparedCanonical.path,
    backupResult,
    now: () => new Date("2026-09-10T18:01:00.000Z"),
  };
}

async function expectMissing(path: string): Promise<void> {
  try { await readFile(path); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`retired migration path remains present: ${path}`);
}

describe("completed project-data migration recovery", () => {
  test("does not publish a receipt after exclusive access is lost", async () => {
    const evidence = await committedEvidence();
    let checks = 0;
    await expect(reconcileCompletedProjectDataMigration({
      ...evidence,
      assertExclusiveAccess: async () => {
        checks += 1;
        if (checks === 4) throw new ProjectDataMigrationAccessLostError("lost before receipt");
      },
    })).rejects.toThrow(/lost before receipt/iu);
    expect(await evidence.receipts.read(evidence.marker.attemptId)).toBeUndefined();
    expect((await evidence.pending.read())?.phase).toBe("publishing");
  });

  test("does not clear Pending when cancellation arrives after receipt publication", async () => {
    const evidence = await committedEvidence();
    const cancellation = new AbortController();
    await expect(reconcileCompletedProjectDataMigration({
      ...evidence,
      signal: cancellation.signal,
      receipts: {
        read: (id) => evidence.receipts.read(id),
        publish: async (receipt) => {
          const published = await evidence.receipts.publish(receipt);
          cancellation.abort(new DOMException("cancelled before clear", "AbortError"));
          return published;
        },
      },
    })).rejects.toThrow(/cancelled before clear/iu);
    expect(await evidence.receipts.read(evidence.marker.attemptId)).toBeDefined();
    expect((await evidence.pending.read())?.phase).toBe("publishing");
  });

  test("validates exact committed journal and receipt evidence before clearing Pending", async () => {
    const evidence = await committedEvidence();

    await expect(reconcileCompletedProjectDataMigration(evidence)).resolves.toEqual({
      status: "reconciled",
      attemptId: evidence.marker.attemptId,
      migrationId: evidence.marker.migrationId,
      receiptHash: evidence.receipt.receiptHash,
      journalHash: evidence.receipt.journalHash,
    });
    expect(await evidence.pending.read()).toBeUndefined();
    expect(await evidence.receipts.read(evidence.marker.attemptId)).toEqual(evidence.receipt);
    expect((await readFile(evidence.backupResult.backupPath)).byteLength).toBeGreaterThan(0);
  });

  test("retains Pending when the receipt does not bind the exact committed journal bytes", async () => {
    const evidence = await committedEvidence();
    const { receiptHash: omittedReceiptHash, ...receiptBody } = evidence.receipt;
    void omittedReceiptHash;
    const mismatched = createProjectDataMigrationReceipt({
      ...receiptBody,
      journalHash: hash("9"),
    });
    await evidence.receipts.publish(mismatched);

    await expect(reconcileCompletedProjectDataMigration(evidence)).resolves.toMatchObject({
      status: "recovery-required",
      migrationId: evidence.marker.migrationId,
      reason: expect.stringMatching(/journal.*hash/i),
    });
    expect((await evidence.pending.read())?.phase).toBe("publishing");
  });

  test("resumes after receipt publication is interrupted before Pending clear", async () => {
    const evidence = await committedEvidence();
    const interrupted = {
      ...evidence,
      pending: {
        read: () => evidence.pending.read(),
        clearAfterReceiptPublication: async () => { throw new Error("crash before Pending clear"); },
      },
    };

    await expect(reconcileCompletedProjectDataMigration(interrupted)).resolves.toMatchObject({
      status: "recovery-required",
      reason: expect.stringMatching(/crash before Pending clear/i),
    });
    expect(await evidence.receipts.read(evidence.marker.attemptId)).toEqual(evidence.receipt);
    expect((await evidence.pending.read())?.phase).toBe("publishing");

    await expect(reconcileCompletedProjectDataMigration(evidence)).resolves.toMatchObject({ status: "reconciled" });
    expect(await evidence.pending.read()).toBeUndefined();
  });

  test("does not consult historical receipts after Pending is absent", async () => {
    const receiptRead = vi.fn(() => Promise.reject(new Error("must not read historical receipt")));
    const result = await reconcileCompletedProjectDataMigration({
      pending: { read: async () => undefined, clearAfterReceiptPublication: vi.fn() },
      receipts: { read: receiptRead, publish: vi.fn() },
      journal: { ensureRecordDurable: vi.fn(), inspectRecordedAfterState: vi.fn() },
      target: { observeCurrentTarget: vi.fn() },
    });

    expect(result).toEqual({ status: "no-pending" });
    expect(receiptRead).not.toHaveBeenCalled();
  });

  test("retains Pending when the current format snapshot hash does not authenticate its body", async () => {
    const evidence = await committedEvidence();
    const tampered = {
      ...evidence,
      target: {
        observeCurrentTarget: async () => ({
          format: {
            ...evidence.targetSnapshot,
            runtimeEvidence: { ...evidence.targetSnapshot.runtimeEvidence, schemaHash: hash("d") },
          },
          canonicalRootDigest: evidence.canonicalDigest,
        }),
      },
    };

    await expect(reconcileCompletedProjectDataMigration(tampered)).resolves.toMatchObject({
      status: "recovery-required",
      reason: expect.stringMatching(/snapshot.*hash|invalid/i),
    });
    expect((await evidence.pending.read())?.phase).toBe("publishing");
  });
  test.each([
    ["missing config", ".projector/config.toml", undefined],
    ["stale target", undefined, "stale canonical bytes"],
  ] as const)("retains Pending when the current target has %s", async (_label, removedPath, replacement) => {
    const evidence = await committedEvidence();
    await evidence.receipts.publish(evidence.receipt);
    if (removedPath !== undefined) await rm(join(evidence.root, ...removedPath.split("/")));
    if (replacement !== undefined) await writeFile(evidence.canonicalPath, replacement);

    await expect(reconcileCompletedProjectDataMigration(evidence)).resolves.toMatchObject({
      status: "recovery-required",
      migrationId: evidence.marker.migrationId,
    });
    expect((await evidence.pending.read())?.phase).toBe("publishing");
  });
});
