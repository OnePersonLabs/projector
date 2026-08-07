import type { StateDigest } from "@projector/core";

import type {
  BeginTransactionInput,
  FileTransaction,
  FileTransactionJournal,
  RecoveryResult,
} from "../journal/index.js";
import type { WriterLeaseHandle, WriterLeaseManager, WriterLeaseOwner } from "./writer-lease.js";

export class StateBoundMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateBoundMutationError";
  }
}

export class GovernedWorktreeRuntime {
  constructor(
    private readonly leases: WriterLeaseManager,
    private readonly journal: FileTransactionJournal,
  ) {}

  async open(owner: WriterLeaseOwner): Promise<GovernedWorktreeSession> {
    const lease = await this.leases.acquire(owner);
    return new GovernedWorktreeSession(lease, this.journal);
  }
}

export class GovernedWorktreeSession {
  private closed = false;

  constructor(
    private readonly lease: WriterLeaseHandle,
    private readonly journal: FileTransactionJournal,
  ) {}

  async begin(input: BeginTransactionInput): Promise<FileTransaction> {
    this.assertOpen();
    await this.lease.heartbeat();
    if (!sameState(input.beforeState, this.lease.record.compiledAgainstSnapshot)) {
      throw new StateBoundMutationError(
        `Transaction ${input.transactionId} does not match the snapshot held by the writer lease`,
      );
    }
    return this.journal.begin(input);
  }

  async recover(): Promise<RecoveryResult[]> {
    this.assertOpen();
    await this.lease.heartbeat();
    return this.journal.recoverIncomplete();
  }

  async close(): Promise<void> {
    this.assertOpen();
    await this.lease.release();
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) throw new StateBoundMutationError("Governed worktree session is closed");
  }
}

function sameState(left: StateDigest, right: StateDigest): boolean {
  return (
    left.gitBase === right.gitBase &&
    left.worktreeDigest === right.worktreeDigest &&
    left.canonicalProjectorDigest === right.canonicalProjectorDigest &&
    left.toolchainDigest === right.toolchainDigest &&
    left.pinnedExternalSnapshotDigest === right.pinnedExternalSnapshotDigest
  );
}
