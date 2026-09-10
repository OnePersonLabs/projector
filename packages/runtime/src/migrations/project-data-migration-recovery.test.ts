import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProjectDataMigrationReceipt,
  type ContentHash,
  type PendingProjectDataMigration,
  type StateDigest,
} from "@projector/core";
import { afterEach, describe, expect, test, vi } from "vitest";

import { FileTransactionJournal } from "../journal/index.js";
import { RepositoryPathService } from "../security/index.js";
import { PendingProjectDataMigrationStore } from "./pending-project-data-migration.js";
import { ProjectDataMigrationReceiptStore } from "./project-data-migration-receipt.js";
import { reconcileCompletedProjectDataMigration } from "./project-data-migration-recovery.js";

const roots: string[] = [];
const hash = (digit: string) => `sha256:v1:${digit.repeat(64)}` as ContentHash;
const backup = {
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

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-migration-recovery-"));
  roots.push(root);
  await mkdir(join(root, ".projector"));
  const pending = new PendingProjectDataMigrationStore(root);
  const receipts = new ProjectDataMigrationReceiptStore(root);
  const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
  return { root, pending, receipts, journal };
}

function pendingMarker(): PendingProjectDataMigration {
  return {
    apiVersion: "projector.pending-project-data-migration/v1",
    migrationId: "migration:legacy-to-toml",
    sourceSnapshotHash: hash("2"),
    targetSnapshotHash: hash("3"),
    manifestHash: hash("1"),
    backup,
    stagingLocation: ".projector/migration-stage",
    phase: "backed-up",
    createdAt: "2026-09-10T18:00:00.000Z",
  };
}

async function committedEvidence() {
  const fixtureValue = await fixture();
  const marker = pendingMarker();
  await fixtureValue.pending.create(marker);
  await fixtureValue.pending.transition(marker, "staged");
  await fixtureValue.pending.transition(marker, "publishing");
  const transaction = await fixtureValue.journal.begin({
    transactionId: "journal:legacy-to-toml",
    planId: "plan:migration:legacy-to-toml",
    beforeState,
    intendedAfterCanonicalDigest: marker.targetSnapshotHash,
    allowedWriteRoots: [".projector"],
  });
  for (const phase of ["workspace-mutating", "workspace-staged", "validating", "canonical-staging", "committing"] as const) {
    await transaction.transition(phase);
  }
  await transaction.commit();
  const exact = await fixtureValue.journal.readExact("journal:legacy-to-toml");
  const receipt = createProjectDataMigrationReceipt({
    apiVersion: "projector.project-data-migration-receipt/v1",
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
  return { ...fixtureValue, marker, receipt };
}

describe("completed project-data migration recovery", () => {
  test("validates exact committed journal and receipt evidence before clearing Pending", async () => {
    const evidence = await committedEvidence();
    await evidence.receipts.publish(evidence.receipt);

    await expect(reconcileCompletedProjectDataMigration(evidence)).resolves.toEqual({
      status: "reconciled",
      migrationId: evidence.marker.migrationId,
      receiptHash: evidence.receipt.receiptHash,
      journalHash: evidence.receipt.journalHash,
    });
    expect(await evidence.pending.read()).toBeUndefined();
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

  test("does not consult historical receipts after Pending is absent", async () => {
    const receiptRead = vi.fn(() => Promise.reject(new Error("must not read historical receipt")));
    const result = await reconcileCompletedProjectDataMigration({
      pending: { read: async () => undefined, clearAfterReceiptPublication: vi.fn() },
      receipts: { read: receiptRead },
      journal: { readExact: vi.fn() },
    });

    expect(result).toEqual({ status: "no-pending" });
    expect(receiptRead).not.toHaveBeenCalled();
  });
});
