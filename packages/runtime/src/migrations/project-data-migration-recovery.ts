import type {
  ContentHash,
  PendingProjectDataMigration,
  ProjectDataFormatSnapshot,
  ProjectDataMigrationReceipt,
} from "@projector/core";
import {
  ProjectDataFormatSnapshotSchema,
  createProjectDataMigrationReceipt,
  projectDataMigrationReceiptApiVersion,
} from "@projector/core";

import type { ExactFileTransactionJournalRecord, ExactFileTransactionJournalState } from "../journal/index.js";
import type { PendingMigrationBinding } from "./pending-project-data-migration.js";

export interface PendingProjectDataMigrationRecoveryPort {
  read(): Promise<PendingProjectDataMigration | undefined>;
  clearAfterReceiptPublication(binding: PendingMigrationBinding): Promise<void>;
}

export interface ProjectDataMigrationReceiptRecoveryPort {
  read(migrationId: string): Promise<ProjectDataMigrationReceipt | undefined>;
  publish(receipt: ProjectDataMigrationReceipt): Promise<ProjectDataMigrationReceipt>;
}

export interface ProjectDataMigrationJournalRecoveryPort {
  ensureRecordDurable(transactionId: string): Promise<ExactFileTransactionJournalRecord>;
  inspectRecordedAfterState(transactionId: string): Promise<ExactFileTransactionJournalState>;
}

export interface ProjectDataMigrationTargetRecoveryPort {
  observeCurrentTarget(pending: PendingProjectDataMigration): Promise<{
    readonly format: ProjectDataFormatSnapshot;
    readonly canonicalRootDigest: ContentHash;
  }>;
}

export interface CompletedProjectDataMigrationRecoveryPorts {
  pending: PendingProjectDataMigrationRecoveryPort;
  receipts: ProjectDataMigrationReceiptRecoveryPort;
  journal: ProjectDataMigrationJournalRecoveryPort;
  target: ProjectDataMigrationTargetRecoveryPort;
  now?: () => Date;
}

export type CompletedProjectDataMigrationRecoveryResult =
  | { status: "no-pending" }
  | {
      status: "reconciled";
      migrationId: string;
      receiptHash: ContentHash;
      journalHash: ContentHash;
    }
  | { status: "recovery-required"; migrationId?: string; reason: string };

export async function reconcileCompletedProjectDataMigration(
  ports: CompletedProjectDataMigrationRecoveryPorts,
): Promise<CompletedProjectDataMigrationRecoveryResult> {
  let pending: PendingProjectDataMigration | undefined;
  try {
    pending = await ports.pending.read();
  } catch (error) {
    return { status: "recovery-required", reason: `Pending migration evidence is unavailable: ${message(error)}` };
  }
  if (pending === undefined) return { status: "no-pending" };
  if (pending.phase !== "publishing") {
    return {
      status: "recovery-required",
      migrationId: pending.migrationId,
      reason: `Pending migration remains in ${pending.phase}; completed publication cannot be inferred`,
    };
  }

  try {
    let receipt = await ports.receipts.read(pending.migrationId);
    if (receipt !== undefined) {
      const mismatch = receiptMismatch(pending, receipt);
      if (mismatch !== undefined) return required(pending, mismatch);
    }
    const durableJournal = await ports.journal.ensureRecordDurable(pending.migrationId);
    const exactJournal = await ports.journal.inspectRecordedAfterState(pending.migrationId);
    if (durableJournal.contentHash !== exactJournal.contentHash) {
      return required(pending, "Migration journal changed after its durable publication was confirmed");
    }
    if (exactJournal.record.entry.phase !== "committed") {
      return required(
        pending,
        `Migration journal ${pending.migrationId} is ${exactJournal.record.entry.phase}, not committed`,
      );
    }
    if (receipt !== undefined && exactJournal.contentHash !== receipt.journalHash) {
      return required(pending, "Migration receipt journal hash does not match the exact committed journal bytes");
    }
    if (
      (receipt !== undefined && receipt.journalId !== pending.migrationId) ||
      exactJournal.record.entry.transactionId !== pending.migrationId ||
      exactJournal.record.entry.planId !== pending.manifestHash ||
      exactJournal.record.pendingMigration === undefined ||
      !samePendingBinding(exactJournal.record.pendingMigration, pending)
    ) {
      return required(pending, "Committed journal does not bind the exact Pending migration attempt");
    }
    if (!exactJournal.matchesRecordedAfterState) {
      return required(
        pending,
        `Current migration target differs from the committed journal at: ${exactJournal.mismatchedPaths.join(", ")}`,
      );
    }
    if (!hasConfigLastPublication(exactJournal.record)) {
      return required(pending, "Committed migration journal does not publish prepared config as its final operation");
    }
    const target = await ports.target.observeCurrentTarget(pending);
    const format = ProjectDataFormatSnapshotSchema.parse(target.format);
    if (format.snapshotHash !== pending.targetSnapshotHash) {
      return required(pending, "Current validated format snapshot does not match the Pending target snapshot");
    }
    if (exactJournal.record.entry.intendedAfterCanonicalDigest !== target.canonicalRootDigest) {
      return required(pending, "Committed journal does not bind the current validated canonical target");
    }

    if (receipt === undefined) {
      receipt = await ports.receipts.publish(createProjectDataMigrationReceipt({
        apiVersion: projectDataMigrationReceiptApiVersion,
        migrationId: pending.migrationId,
        manifestHash: pending.manifestHash,
        sourceSnapshotHash: pending.sourceSnapshotHash,
        targetSnapshotHash: pending.targetSnapshotHash,
        journalId: pending.migrationId,
        journalHash: exactJournal.contentHash,
        backup: pending.backup,
        outcome: "completed",
        completedAt: (ports.now ?? (() => new Date()))().toISOString(),
      }));
    }

    await ports.pending.clearAfterReceiptPublication(pending);
    return {
      status: "reconciled",
      migrationId: pending.migrationId,
      receiptHash: receipt.receiptHash,
      journalHash: receipt.journalHash,
    };
  } catch (error) {
    return required(pending, `Completed migration evidence could not be reconciled: ${message(error)}`);
  }
}

function hasConfigLastPublication(record: ExactFileTransactionJournalState["record"]): boolean {
  const operation = record.operations.at(-1);
  if (operation?.kind !== "write-file" || operation.status !== "applied" || operation.changes.length !== 1) return false;
  const [change] = operation.changes;
  return change?.path === ".projector/config.toml" && change.after.kind === "file";
}

function receiptMismatch(
  pending: PendingProjectDataMigration,
  receipt: ProjectDataMigrationReceipt,
): string | undefined {
  if (
    receipt.migrationId !== pending.migrationId ||
    receipt.journalId !== pending.migrationId ||
    receipt.manifestHash !== pending.manifestHash ||
    receipt.sourceSnapshotHash !== pending.sourceSnapshotHash ||
    receipt.targetSnapshotHash !== pending.targetSnapshotHash
  ) {
    return "Terminal migration receipt does not bind the Pending migration identities and snapshots";
  }
  if (
    receipt.backup.id !== pending.backup.id ||
    receipt.backup.manifestHash !== pending.backup.manifestHash ||
    receipt.backup.location.kind !== pending.backup.location.kind ||
    receipt.backup.location.path !== pending.backup.location.path
  ) {
    return "Terminal migration receipt does not bind the Pending migration backup evidence";
  }
  return undefined;
}

function samePendingBinding(left: PendingProjectDataMigration, right: PendingProjectDataMigration): boolean {
  return (
    left.migrationId === right.migrationId &&
    left.manifestHash === right.manifestHash &&
    left.sourceSnapshotHash === right.sourceSnapshotHash &&
    left.targetSnapshotHash === right.targetSnapshotHash &&
    left.stagingLocation === right.stagingLocation &&
    left.createdAt === right.createdAt &&
    left.backup.id === right.backup.id &&
    left.backup.manifestHash === right.backup.manifestHash &&
    left.backup.location.kind === right.backup.location.kind &&
    left.backup.location.path === right.backup.location.path
  );
}

function required(
  pending: PendingProjectDataMigration,
  reason: string,
): CompletedProjectDataMigrationRecoveryResult {
  return { status: "recovery-required", migrationId: pending.migrationId, reason };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
