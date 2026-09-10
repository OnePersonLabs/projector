import type {
  ContentHash,
  PendingProjectDataMigration,
  ProjectDataMigrationReceipt,
} from "@projector/core";

import type { ExactFileTransactionJournalRecord } from "../journal/index.js";
import type { PendingMigrationBinding } from "./pending-project-data-migration.js";

export interface PendingProjectDataMigrationRecoveryPort {
  read(): Promise<PendingProjectDataMigration | undefined>;
  clearAfterReceiptPublication(binding: PendingMigrationBinding): Promise<void>;
}

export interface ProjectDataMigrationReceiptRecoveryPort {
  read(migrationId: string): Promise<ProjectDataMigrationReceipt | undefined>;
}

export interface ProjectDataMigrationJournalRecoveryPort {
  readExact(transactionId: string): Promise<ExactFileTransactionJournalRecord>;
}

export interface CompletedProjectDataMigrationRecoveryPorts {
  pending: PendingProjectDataMigrationRecoveryPort;
  receipts: ProjectDataMigrationReceiptRecoveryPort;
  journal: ProjectDataMigrationJournalRecoveryPort;
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
    const receipt = await ports.receipts.read(pending.migrationId);
    if (receipt === undefined) {
      return required(pending, "The matching terminal migration receipt has not been published");
    }
    const mismatch = receiptMismatch(pending, receipt);
    if (mismatch !== undefined) return required(pending, mismatch);

    const exactJournal = await ports.journal.readExact(receipt.journalId);
    if (exactJournal.record.entry.phase !== "committed") {
      return required(
        pending,
        `Migration journal ${receipt.journalId} is ${exactJournal.record.entry.phase}, not committed`,
      );
    }
    if (exactJournal.contentHash !== receipt.journalHash) {
      return required(pending, "Migration receipt journal hash does not match the exact committed journal bytes");
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

function receiptMismatch(
  pending: PendingProjectDataMigration,
  receipt: ProjectDataMigrationReceipt,
): string | undefined {
  if (
    receipt.migrationId !== pending.migrationId ||
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

function required(
  pending: PendingProjectDataMigration,
  reason: string,
): CompletedProjectDataMigrationRecoveryResult {
  return { status: "recovery-required", migrationId: pending.migrationId, reason };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
