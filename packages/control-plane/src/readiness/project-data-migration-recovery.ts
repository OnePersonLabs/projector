import { relative } from "node:path";

import {
  FileTransactionJournal,
  PendingProjectDataMigrationStore,
  ProjectDataMigrationReceiptStore,
  RepositoryPathService,
  WriterLeaseManager,
  fileTransactionJournalRelativePath,
  pendingProjectDataMigrationRelativePath,
  reconcileCompletedProjectDataMigration,
  ProjectDataMigrationAccessLostError,
  verifyProjectBackup,
  verifyRetainedProjectDataTarget,
  withProjectOperationAccess as withRuntimeOperationAccess,
  type CompletedProjectDataMigrationRecoveryResult,
} from "@projector/runtime";

import { observePreparedMigrationTarget } from "./project-data-migration-target.js";
import {
  createReleaseCandidateProjectDataFormat,
  type ValidatedReleaseCandidateInventory,
} from "./project-data-format-owner.js";

const writerLeaseStaleAfterMs = 30_000;

export interface PreparedProjectDataMigrationRecoveryService {
  recover(
    repositoryRoot: string,
    request: { readonly requestId: string; readonly processId: number; readonly signal?: AbortSignal },
  ): Promise<CompletedProjectDataMigrationRecoveryResult>;
}

/**
 * Captures the candidate-selected format descriptor before request handling so
 * an operation request cannot select its own target authority.
 */
export function createPreparedProjectDataMigrationRecoveryService(input: {
  readonly candidate: ValidatedReleaseCandidateInventory;
  readonly codexDataRoot: string;
}): PreparedProjectDataMigrationRecoveryService {
  const targetFormat = createReleaseCandidateProjectDataFormat(input);
  if (input.codexDataRoot.length === 0) throw new TypeError("A Codex data root is required");
  return {
    async recover(repositoryRoot, request) {
      assertRequest(request);
      return await withRuntimeOperationAccess(
        repositoryRoot,
        {
          operation: "project-data-migration-recovery",
          mode: "exclusive",
          ...(request.signal === undefined ? {} : { signal: request.signal }),
        },
        async (access) => {
          const pendingStore = new PendingProjectDataMigrationStore(repositoryRoot);
          const pending = await pendingStore.read();
          if (pending === undefined) return { status: "no-pending" };
          if (pending.targetSnapshotHash !== targetFormat.snapshotHash) {
            return required(pending.migrationId, "Pending migration target does not match this release candidate");
          }

          const paths = await RepositoryPathService.create(repositoryRoot);
          const lease = await new WriterLeaseManager(paths, { staleAfterMs: writerLeaseStaleAfterMs })
            .acquireMigrationRecovery({
              sessionId: request.requestId,
              processId: request.processId,
              attemptId: pending.attemptId,
              migrationId: pending.migrationId,
              manifestHash: pending.manifestHash,
              targetSnapshotHash: pending.targetSnapshotHash,
              backupManifestHash: pending.backup.manifestHash,
            });
          try {
            const assertOwnership = async (): Promise<void> => {
              throwIfAborted(access.signal);
              try {
                await access.assertOwned();
                await lease.heartbeat();
              } catch (error) {
                throw new ProjectDataMigrationAccessLostError(
                  "Migration recovery lost exclusive operation or writer ownership",
                  { cause: error },
                );
              }
              throwIfAborted(access.signal);
            };
            await assertOwnership();
            const backup = await verifyProjectBackup({ codexDataRoot: input.codexDataRoot, backup: pending.backup });
            await assertOwnership();
            const journal = new FileTransactionJournal(paths);
            const exactJournal = await journal.ensureRecordDurable(pending.attemptId);
            const receipts = new ProjectDataMigrationReceiptStore(repositoryRoot);
            const operationalPaths = [
              ...access.ownedRelativePaths,
              ".projector/runtime/writer-lease.lock/owner.json",
              ".projector/runtime/writer-lease.lock/heartbeat",
              pendingProjectDataMigrationRelativePath,
              fileTransactionJournalRelativePath(pending.attemptId),
              relative(repositoryRoot, receipts.pathFor(pending.attemptId)).replaceAll("\\", "/"),
            ];
            const retained = await verifyRetainedProjectDataTarget({
              repositoryRoot,
              codexDataRoot: input.codexDataRoot,
              backup: pending.backup,
              journal: exactJournal,
              operationalPaths,
            });
            await assertOwnership();
            if (
              retained.backup.manifestHash !== backup.manifestHash ||
              retained.backup.archiveHash !== backup.archiveHash
            ) {
              return required(pending.migrationId, "Backup evidence changed during recovery observation");
            }
            const observedTarget = await observePreparedMigrationTarget({
              repositoryRoot,
              targetFormat,
              authenticatedFiles: retained.currentFiles,
              signal: access.signal,
            });
            await assertOwnership();
            const result = await reconcileCompletedProjectDataMigration({
              pending: pendingStore,
              receipts,
              journal,
              target: { async observeCurrentTarget() { return observedTarget; } },
              signal: access.signal,
              assertExclusiveAccess: assertOwnership,
            });
            await assertOwnership();
            return result;
          } catch (error) {
            if (
              (error instanceof Error && error.name === "ProjectDataMigrationAccessLostError") ||
              (error instanceof DOMException && error.name === "AbortError") ||
              (error instanceof Error && error.name === "AbortError")
            ) throw error;
            return required(pending.migrationId, error instanceof Error ? error.message : String(error));
          } finally {
            await lease.release();
          }
        },
      );
    },
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function assertRequest(request: { readonly requestId: string; readonly processId: number }): void {
  if (request.requestId.length === 0 || request.requestId.trim() !== request.requestId) {
    throw new TypeError("A recovery request ID is required");
  }
  if (!Number.isSafeInteger(request.processId) || request.processId <= 0) {
    throw new TypeError("A positive recovery process ID is required");
  }
}

function required(migrationId: string, reason: string): CompletedProjectDataMigrationRecoveryResult {
  return { status: "recovery-required", migrationId, reason };
}
