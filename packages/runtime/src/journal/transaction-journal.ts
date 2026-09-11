import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, join, posix } from "node:path";

import {
  PendingProjectDataMigrationSchema,
  hashFramedDomain,
  type ContentHash,
  type PendingProjectDataMigration,
  type StateDigest,
  type TransactionJournalEntry,
  type TransactionPhase,
} from "@projector/core";

import type { RepositoryPathService } from "../security/index.js";

const journalRoot = ".projector/runtime/journal";
const maximumJournalBytes = 64 * 1024 * 1024;
const transientWindowsRenameCodes = new Set(["EACCES", "EBUSY", "EPERM"]);

async function publishJournalRecord(source: string, destination: string, renameRecord: typeof rename, platform: NodeJS.Platform): Promise<void> {
  for (const delayMs of [0, 10, 25, 50, 100, 200]) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await renameRecord(source, destination);
      return;
    } catch (error) {
      const retryable = platform === "win32" && typeof error === "object" && error !== null && "code" in error && transientWindowsRenameCodes.has(String(error.code));
      if (!retryable) throw error;
      if (delayMs === 200) throw new Error(`Journal record publication remained blocked after bounded Windows retries: ${source} -> ${destination}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
}

export type JournalCrashPoint =
  | "after-operation-intent"
  | "after-operation-apply"
  | "after-new-record-claim"
  | `after-record-publication-before-flush:${TransactionPhase}`
  | `after-phase:${TransactionPhase}`
  | `after-operation-revert:${string}`;

export interface FileTransactionJournalOptions {
  now?: () => Date;
  crash?: (point: JournalCrashPoint) => void;
  renameRecord?: typeof rename;
  platform?: NodeJS.Platform;
}

export interface BeginTransactionInput {
  transactionId: string;
  planId: string;
  beforeState: StateDigest;
  intendedAfterCanonicalDigest?: ContentHash;
  allowedWriteRoots: string[];
  pendingMigration?: PendingProjectDataMigration;
}

interface MissingSnapshot {
  kind: "missing";
}

interface FileSnapshot {
  kind: "file";
  contentBase64: string;
  mode: number;
}

type PathSnapshot = MissingSnapshot | FileSnapshot;

interface JournalPathChange {
  path: string;
  before: PathSnapshot;
  after: PathSnapshot;
}

export interface FileJournalOperation {
  id: string;
  kind: "delete-file" | "move-file" | "write-file";
  status: "intended" | "applied" | "reverted";
  changes: JournalPathChange[];
}

export interface JournalCheckpoint {
  id: string;
  phase: TransactionPhase;
  operationCount: number;
  createdAt: string;
}

export interface CompensationRecord {
  externalOperationId: string;
  kind: "registered" | "manual";
  compensationId?: string;
  instructions?: string;
  status: "pending" | "completed";
  recordedAt: string;
  completedAt?: string;
}

export interface DurableTransactionRecord {
  version: 1;
  entry: TransactionJournalEntry;
  allowedWriteRoots: string[];
  operations: FileJournalOperation[];
  checkpoints: JournalCheckpoint[];
  compensations: CompensationRecord[];
  pendingMigration?: PendingProjectDataMigration;
}

export interface ExactFileTransactionJournalRecord {
  record: DurableTransactionRecord;
  bytes: Buffer;
  contentHash: ContentHash;
}

export interface ExactFileTransactionJournalState extends ExactFileTransactionJournalRecord {
  matchesRecordedAfterState: boolean;
  mismatchedPaths: string[];
}

export function hashFileTransactionJournalBytes(bytes: Uint8Array): ContentHash {
  return hashFramedDomain("file-transaction-journal-bytes:v1", Buffer.from(bytes).toString("base64"));
}

export function fileTransactionJournalRelativePath(transactionId: string): string {
  return `${journalRoot}/${recordFileName(transactionId)}`;
}

export interface RecoveryResult {
  transactionId: string;
  action: "rolled-back" | "recovery-required";
  priorPhase: TransactionPhase;
  lastCheckpointId?: string;
  reason?: string;
}

export interface RecoveryOptions {
  readonly signal?: AbortSignal;
}

export class InvalidJournalTransitionError extends Error {
  constructor(from: TransactionPhase, to: TransactionPhase) {
    super(`Transaction phase cannot transition from ${from} to ${to}`);
    this.name = "InvalidJournalTransitionError";
  }
}

export class JournalRecoveryRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalRecoveryRequiredError";
  }
}

export class FileTransaction {
  constructor(
    private readonly journal: FileTransactionJournal,
    private readonly record: DurableTransactionRecord,
  ) {}

  get entry(): Readonly<TransactionJournalEntry> {
    return this.record.entry;
  }

  transition(phase: TransactionPhase): Promise<void> {
    if (
      phase === "committed" ||
      phase === "rolling-back" ||
      phase === "rolled-back" ||
      phase === "recovery-required"
    ) {
      return Promise.reject(new InvalidJournalTransitionError(this.record.entry.phase, phase));
    }
    return this.journal.transitionRecord(this.record, phase);
  }

  commit(): Promise<void> {
    return this.journal.commitRecord(this.record);
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    await this.ensureMutationPhase();
    const before = await this.journal.snapshot(path, this.record.allowedWriteRoots);
    const after: FileSnapshot = {
      kind: "file",
      contentBase64: Buffer.from(content).toString("base64"),
      mode: before.kind === "file" ? before.mode : 0o666,
    };
    await this.journal.applyOperation(this.record, "write-file", [{ path, before, after }], async () => {
      await this.journal.restore(path, after, this.record.allowedWriteRoots);
    });
  }

  async deleteFile(path: string): Promise<void> {
    await this.ensureMutationPhase();
    const before = await this.journal.snapshot(path, this.record.allowedWriteRoots);
    await this.journal.applyOperation(
      this.record,
      "delete-file",
      [{ path, before, after: { kind: "missing" } }],
      async () => this.journal.restore(path, { kind: "missing" }, this.record.allowedWriteRoots),
    );
  }

  async moveFile(source: string, destination: string): Promise<void> {
    await this.ensureMutationPhase();
    if (source === destination) throw new TypeError("Move source and destination must differ");
    const sourceBefore = await this.journal.snapshot(source, this.record.allowedWriteRoots);
    if (sourceBefore.kind !== "file") throw new Error(`Move source does not exist: ${source}`);
    const destinationBefore = await this.journal.snapshot(destination, this.record.allowedWriteRoots);
    await this.journal.applyOperation(
      this.record,
      "move-file",
      [
        { path: source, before: sourceBefore, after: { kind: "missing" } },
        { path: destination, before: destinationBefore, after: sourceBefore },
      ],
      async () => this.journal.move(source, destination, this.record.allowedWriteRoots),
    );
  }

  async checkpoint(id: string): Promise<void> {
    await this.assertMetadataMutable();
    if (id.length === 0 || this.record.entry.checkpointIds.includes(id)) {
      throw new TypeError(`Invalid or duplicate checkpoint: ${id}`);
    }
    this.record.entry.checkpointIds.push(id);
    this.record.checkpoints.push({
      id,
      phase: this.record.entry.phase,
      operationCount: this.record.operations.length,
      createdAt: this.journal.timestamp(),
    });
    await this.journal.persist(this.record);
  }

  async recordCompensation(input: {
    externalOperationId: string;
    kind: "registered" | "manual";
    compensationId?: string;
    instructions?: string;
  }): Promise<void> {
    await this.assertMetadataMutable();
    if (input.externalOperationId.length === 0 || this.record.entry.externalOperationIds.includes(input.externalOperationId)) {
      throw new TypeError(`Invalid or duplicate external operation: ${input.externalOperationId}`);
    }
    this.record.entry.externalOperationIds.push(input.externalOperationId);
    this.record.compensations.push({
      ...input,
      status: "pending",
      recordedAt: this.journal.timestamp(),
    });
    await this.journal.persist(this.record);
  }

  async markCompensated(externalOperationId: string): Promise<void> {
    await this.assertMetadataMutable();
    const compensation = this.record.compensations.find(
      (candidate) => candidate.externalOperationId === externalOperationId,
    );
    if (compensation === undefined) throw new TypeError(`Unknown external operation: ${externalOperationId}`);
    compensation.status = "completed";
    compensation.completedAt = this.journal.timestamp();
    await this.journal.persist(this.record);
  }

  rollback(): Promise<RecoveryResult> {
    return this.journal.rollbackRecord(this.record);
  }

  private async ensureMutationPhase(): Promise<void> {
    if (this.record.entry.phase === "prepared") {
      await this.journal.transitionRecord(this.record, "workspace-mutating");
    }
    if (this.record.entry.phase !== "workspace-mutating") {
      throw new InvalidJournalTransitionError(this.record.entry.phase, "workspace-mutating");
    }
  }

  private async assertMetadataMutable(): Promise<void> {
    const durablePhase = (await this.journal.read(this.record.entry.transactionId)).entry.phase;
    if (
      durablePhase !== this.record.entry.phase ||
      durablePhase === "committed" ||
      durablePhase === "rolled-back" ||
      durablePhase === "recovery-required"
    ) {
      throw new InvalidJournalTransitionError(this.record.entry.phase, durablePhase);
    }
  }
}

export class FileTransactionJournal {
  private readonly now: () => Date;
  private readonly crash: ((point: JournalCrashPoint) => void) | undefined;
  private readonly renameRecord: typeof rename;
  private readonly platform: NodeJS.Platform;

  constructor(
    private readonly paths: RepositoryPathService,
    options: FileTransactionJournalOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.crash = options.crash;
    this.renameRecord = options.renameRecord ?? rename;
    this.platform = options.platform ?? process.platform;
  }

  async begin(input: BeginTransactionInput): Promise<FileTransaction> {
    if (input.transactionId.length === 0 || input.planId.length === 0 || input.allowedWriteRoots.length === 0) {
      throw new TypeError("A transaction requires IDs and at least one write root");
    }
    if (input.pendingMigration !== undefined) {
      PendingProjectDataMigrationSchema.parse(input.pendingMigration);
      if (input.pendingMigration.phase !== "backed-up") {
        throw new TypeError("A migration journal must bind the backed-up Pending marker before effects");
      }
      if (input.pendingMigration.attemptId !== input.transactionId) {
        throw new TypeError("A migration transaction ID must equal its unique Pending migration attempt ID");
      }
      if (input.pendingMigration.manifestHash !== input.planId) {
        throw new TypeError("A migration transaction plan ID must equal its Pending manifest hash");
      }
    }
    await this.ensureJournalRoot();
    const now = this.timestamp();
    const record: DurableTransactionRecord = {
      version: 1,
      entry: {
        transactionId: input.transactionId,
        planId: input.planId,
        phase: "prepared",
        beforeState: input.beforeState,
        ...(input.intendedAfterCanonicalDigest === undefined
          ? {}
          : { intendedAfterCanonicalDigest: input.intendedAfterCanonicalDigest }),
        worktreePath: this.paths.root,
        checkpointIds: [],
        touchedPaths: [],
        externalOperationIds: [],
        updatedAt: now,
      },
      allowedWriteRoots: [...input.allowedWriteRoots],
      operations: [],
      checkpoints: [],
      compensations: [],
      ...(input.pendingMigration === undefined ? {} : { pendingMigration: input.pendingMigration }),
    };
    await this.persist(record, true);
    this.inject("after-phase:prepared");
    return new FileTransaction(this, record);
  }

  async read(transactionId: string): Promise<DurableTransactionRecord> {
    return (await this.readExact(transactionId)).record;
  }

  async readExact(transactionId: string): Promise<ExactFileTransactionJournalRecord> {
    const path = await this.recordPath(transactionId);
    const bytes = await readBoundedRegularFile(path, maximumJournalBytes);
    const record = parseRecord(bytes.toString("utf8"));
    if (record.entry.transactionId !== transactionId || record.entry.worktreePath !== this.paths.root) {
      throw new JournalRecoveryRequiredError("Journal identity or worktree binding does not match its path");
    }
    return { record, bytes, contentHash: hashFileTransactionJournalBytes(bytes) };
  }

  async ensureRecordDurable(transactionId: string): Promise<ExactFileTransactionJournalRecord> {
    const path = await this.recordPath(transactionId);
    const expected = await readBoundedRegularFile(path, maximumJournalBytes);
    await flushPublishedJournalRecord(path, expected);
    const exact = await this.readExact(transactionId);
    if (!exact.bytes.equals(expected)) {
      throw new JournalRecoveryRequiredError("Journal record changed while its publication was confirmed");
    }
    return exact;
  }

  async inspectRecordedAfterState(transactionId: string): Promise<ExactFileTransactionJournalState> {
    const exact = await this.readExact(transactionId);
    const finalByPath = new Map<string, PathSnapshot>();
    for (const operation of exact.record.operations) {
      for (const change of operation.changes) finalByPath.set(change.path, change.after);
    }
    const mismatchedPaths: string[] = [];
    for (const [path, expected] of finalByPath) {
      const observed = await this.snapshot(path, exact.record.allowedWriteRoots);
      if (!sameSnapshot(observed, expected)) mismatchedPaths.push(path);
    }
    mismatchedPaths.sort();
    return {
      ...exact,
      matchesRecordedAfterState: mismatchedPaths.length === 0,
      mismatchedPaths,
    };
  }

  async recoverIncomplete(options: RecoveryOptions = {}): Promise<RecoveryResult[]> {
    throwIfAborted(options.signal);
    return this.recoverRecords(await this.discover(undefined, options), options);
  }

  async incomplete(transactionIds?: readonly string[]): Promise<DurableTransactionRecord[]> {
    const records = transactionIds === undefined ? await this.discover() : await this.discover(transactionIds);
    return records.filter(({ entry }) => entry.phase !== "committed" && entry.phase !== "rolled-back");
  }

  async recover(transactionIds: readonly string[], options: RecoveryOptions = {}): Promise<RecoveryResult[]> {
    throwIfAborted(options.signal);
    if (transactionIds.length === 0) return [];
    return this.recoverRecords(await this.discover(transactionIds, options), options);
  }

  private async discover(transactionIds?: readonly string[], options: RecoveryOptions = {}): Promise<DurableTransactionRecord[]> {
    throwIfAborted(options.signal);
    if (transactionIds !== undefined) {
      if (new Set(transactionIds).size !== transactionIds.length) throw new Error("targeted recovery transaction identities must be unique");
      const records: DurableTransactionRecord[] = [];
      for (const transactionId of [...transactionIds].sort()) {
        throwIfAborted(options.signal);
        try {
          const record = await this.read(transactionId);
          throwIfAborted(options.signal);
          records.push(record);
        }
        catch (error) { if (!isCode(error, "ENOENT")) throw error; }
      }
      return records;
    }
    const directory = await this.ensureJournalRoot();
    throwIfAborted(options.signal);
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    throwIfAborted(options.signal);
    const discovered: DurableTransactionRecord[] = [];
    const discoveredIds = new Set<string>();
    for (const name of names) {
      throwIfAborted(options.signal);
      const source = await readFile(join(directory, name), "utf8");
      throwIfAborted(options.signal);
      const record = parseRecord(source);
      throwIfAborted(options.signal);
      if (name !== recordFileName(record.entry.transactionId)) {
        throw new JournalRecoveryRequiredError(
          `Journal filename ${name} does not match transaction ${record.entry.transactionId}`,
        );
      }
      if (discoveredIds.has(record.entry.transactionId)) {
        throw new JournalRecoveryRequiredError(`Duplicate journal identity ${record.entry.transactionId}`);
      }
      discoveredIds.add(record.entry.transactionId);
      if (record.entry.worktreePath !== this.paths.root) {
        if (record.entry.phase === "committed" || record.entry.phase === "rolled-back") continue;
        throw new JournalRecoveryRequiredError(`Journal ${name} belongs to a different worktree`);
      }
      discovered.push(record);
    }

    return discovered;
  }

  private async recoverRecords(discovered: readonly DurableTransactionRecord[], options: RecoveryOptions): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];
    for (const record of discovered) {
      throwIfAborted(options.signal);
      if (record.entry.phase === "committed" || record.entry.phase === "rolled-back") continue;
      const priorPhase = record.entry.phase;
      const pending = record.compensations.find((compensation) => compensation.status === "pending");
      if (pending !== undefined || record.entry.phase === "recovery-required") {
        if (record.entry.phase !== "recovery-required") {
          await this.forcePhase(record, "recovery-required");
        }
        results.push({
          transactionId: record.entry.transactionId,
          action: "recovery-required",
          priorPhase,
          ...lastCheckpoint(record),
          reason: pending === undefined ? "Transaction already requires recovery" : `Uncompensated external operation ${pending.externalOperationId}`,
        });
        continue;
      }
      results.push(await this.rollbackRecord(record, options));
    }
    return results;
  }

  async transitionRecord(record: DurableTransactionRecord, phase: TransactionPhase): Promise<void> {
    if (
      phase === "committed" ||
      phase === "rolling-back" ||
      phase === "rolled-back" ||
      phase === "recovery-required"
    ) {
      throw new InvalidJournalTransitionError(record.entry.phase, phase);
    }
    const allowed = allowedTransitions[record.entry.phase];
    if (!allowed.includes(phase)) throw new InvalidJournalTransitionError(record.entry.phase, phase);
    await this.forcePhase(record, phase);
  }

  async commitRecord(record: DurableTransactionRecord): Promise<void> {
    if (record.entry.phase !== "committing") {
      throw new InvalidJournalTransitionError(record.entry.phase, "committed");
    }
    if (record.operations.some((operation) => operation.status !== "applied")) {
      throw new JournalRecoveryRequiredError("A transaction with incomplete or reverted operations cannot commit");
    }
    const pending = record.compensations.find((compensation) => compensation.status === "pending");
    if (pending !== undefined) {
      await this.forcePhase(record, "recovery-required");
      throw new JournalRecoveryRequiredError(
        `Uncompensated external operation ${pending.externalOperationId} requires manual recovery`,
      );
    }
    await this.forcePhase(record, "committed");
  }

  async applyOperation(
    record: DurableTransactionRecord,
    kind: FileJournalOperation["kind"],
    changes: JournalPathChange[],
    apply: () => Promise<void>,
  ): Promise<void> {
    const operation: FileJournalOperation = {
      id: randomUUID(),
      kind,
      status: "intended",
      changes,
    };
    record.operations.push(operation);
    for (const change of changes) {
      if (!record.entry.touchedPaths.includes(change.path)) record.entry.touchedPaths.push(change.path);
    }
    await this.persist(record);
    this.inject("after-operation-intent");
    await apply();
    this.inject("after-operation-apply");
    operation.status = "applied";
    await this.persist(record);
  }

  async rollbackRecord(record: DurableTransactionRecord, options: RecoveryOptions = {}): Promise<RecoveryResult> {
    throwIfAborted(options.signal);
    const priorPhase = record.entry.phase;
    if (record.entry.phase !== "rolling-back") {
      if (record.entry.phase === "committed" || record.entry.phase === "rolled-back") {
        throw new InvalidJournalTransitionError(record.entry.phase, "rolling-back");
      }
      await this.forcePhase(record, "rolling-back");
    }
    try {
      for (const operation of [...record.operations].reverse()) {
        throwIfAborted(options.signal);
        if (operation.status === "reverted") continue;
        for (const change of [...operation.changes].reverse()) {
          throwIfAborted(options.signal);
          const current = await this.snapshot(change.path, record.allowedWriteRoots);
          if (sameSnapshot(current, change.before)) continue;
          if (!sameSnapshot(current, change.after)) {
            throw new JournalRecoveryRequiredError(
              `${change.path} matches neither the recorded before nor after state`,
            );
          }
          await this.restore(change.path, change.before, record.allowedWriteRoots);
          throwIfAborted(options.signal);
        }
        this.inject(`after-operation-revert:${operation.id}`);
        throwIfAborted(options.signal);
        operation.status = "reverted";
        await this.persist(record);
      }
      throwIfAborted(options.signal);
      await this.forcePhase(record, "rolled-back");
      return {
        transactionId: record.entry.transactionId,
        action: "rolled-back",
        priorPhase,
        ...lastCheckpoint(record),
      };
    } catch (error) {
      if (!(error instanceof JournalRecoveryRequiredError)) throw error;
      await this.forcePhase(record, "recovery-required");
      return {
        transactionId: record.entry.transactionId,
        action: "recovery-required",
        priorPhase,
        ...lastCheckpoint(record),
        reason: error.message,
      };
    }
  }

  async snapshot(path: string, scopes: readonly string[]): Promise<PathSnapshot> {
    const target = await this.paths.resolveScopedWrite(path, scopes);
    try {
      const status = await lstat(target.realTarget);
      if (!status.isFile()) throw new JournalRecoveryRequiredError(`${path} is not a regular file`);
      return {
        kind: "file",
        contentBase64: (await readFile(target.realTarget)).toString("base64"),
        mode: status.mode & 0o777,
      };
    } catch (error) {
      if (isCode(error, "ENOENT")) return { kind: "missing" };
      throw error;
    }
  }

  async restore(path: string, snapshot: PathSnapshot, scopes: readonly string[]): Promise<void> {
    const target = await this.paths.resolveScopedWrite(path, scopes);
    if (snapshot.kind === "missing") {
      await rm(target.realTarget, { force: true });
      await syncDirectory(dirname(target.realTarget));
      return;
    }
    await this.ensureParent(path, scopes);
    const resolved = await this.paths.resolveScopedWrite(path, scopes);
    const temporary = join(dirname(resolved.realTarget), `.projector-tx-${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", snapshot.mode);
    try {
      await handle.writeFile(Buffer.from(snapshot.contentBase64, "base64"));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await chmod(temporary, snapshot.mode);
    await rename(temporary, resolved.realTarget);
    await syncDirectory(dirname(resolved.realTarget));
  }

  async move(source: string, destination: string, scopes: readonly string[]): Promise<void> {
    const sourcePath = await this.paths.resolveScopedWrite(source, scopes);
    await this.ensureParent(destination, scopes);
    const destinationPath = await this.paths.resolveScopedWrite(destination, scopes);
    await rename(sourcePath.realTarget, destinationPath.realTarget);
    await syncDirectory(dirname(sourcePath.realTarget));
    if (dirname(sourcePath.realTarget) !== dirname(destinationPath.realTarget)) {
      await syncDirectory(dirname(destinationPath.realTarget));
    }
  }

  async persist(record: DurableTransactionRecord, mustBeNew = false): Promise<void> {
    record.entry.updatedAt = this.timestamp();
    const destination = await this.recordPath(record.entry.transactionId);
    const directory = dirname(destination);
    const temporary = join(directory, `.${recordFileName(record.entry.transactionId)}.${randomUUID()}.tmp`);
    const bytes = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
    const handle = await open(temporary, "wx");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (mustBeNew) {
      try {
        await link(temporary, destination);
        this.inject(`after-record-publication-before-flush:${record.entry.phase}`);
        await flushPublishedJournalRecord(destination, bytes);
        await syncDirectory(directory);
        this.inject("after-new-record-claim");
      } catch (error) {
        await rm(temporary, { force: true });
        if (isCode(error, "EEXIST")) throw new Error(`Transaction already exists: ${record.entry.transactionId}`);
        throw error;
      }
      await rm(temporary, { force: true });
      await syncDirectory(directory);
      return;
    }
    await publishJournalRecord(temporary, destination, this.renameRecord, this.platform);
    this.inject(`after-record-publication-before-flush:${record.entry.phase}`);
    await flushPublishedJournalRecord(destination, bytes);
    await syncDirectory(directory);
  }

  timestamp(): string {
    return this.now().toISOString();
  }

  private async forcePhase(record: DurableTransactionRecord, phase: TransactionPhase): Promise<void> {
    record.entry.phase = phase;
    await this.persist(record);
    this.inject(`after-phase:${phase}`);
  }

  private inject(point: JournalCrashPoint): void {
    this.crash?.(point);
  }

  private async ensureJournalRoot(): Promise<string> {
    const initial = await this.paths.resolveWrite(journalRoot);
    await mkdir(initial.realTarget, { recursive: true });
    return (await this.paths.resolveWrite(journalRoot)).realTarget;
  }

  private async recordPath(transactionId: string): Promise<string> {
    await this.ensureJournalRoot();
    return (await this.paths.resolveWrite(fileTransactionJournalRelativePath(transactionId))).realTarget;
  }

  private async ensureParent(path: string, scopes: readonly string[]): Promise<void> {
    const authorizedTarget = await this.paths.resolveScopedWrite(path, scopes);
    await mkdir(dirname(authorizedTarget.realTarget), { recursive: true });
    await this.paths.resolveScopedWrite(path, scopes);
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

const allowedTransitions: Record<TransactionPhase, readonly TransactionPhase[]> = {
  prepared: ["workspace-mutating", "rolling-back", "recovery-required"],
  "workspace-mutating": ["workspace-staged", "rolling-back", "recovery-required"],
  "workspace-staged": ["validating", "rolling-back", "recovery-required"],
  validating: ["canonical-staging", "rolling-back", "recovery-required"],
  "canonical-staging": ["committing", "rolling-back", "recovery-required"],
  committing: ["committed", "rolling-back", "recovery-required"],
  committed: [],
  "rolling-back": ["rolled-back", "recovery-required"],
  "rolled-back": [],
  "recovery-required": [],
};

function recordFileName(transactionId: string): string {
  return `${createHash("sha256").update(transactionId).digest("hex")}.json`;
}

async function readBoundedRegularFile(path: string, maximumBytes: number): Promise<Buffer> {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new JournalRecoveryRequiredError(`Journal path is not a regular file: ${path}`);
  }
  if (before.size > maximumBytes) {
    throw new JournalRecoveryRequiredError(`Journal record exceeds ${maximumBytes} bytes: ${path}`);
  }
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== before.size) {
      throw new JournalRecoveryRequiredError(`Journal record changed while it was opened: ${path}`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.length !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) {
      throw new JournalRecoveryRequiredError(`Journal record changed while it was read: ${path}`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function flushPublishedJournalRecord(path: string, expected: Uint8Array): Promise<void> {
  const handle = await open(path, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new JournalRecoveryRequiredError(`Published journal is not a regular file: ${path}`);
    await handle.sync();
    const observed = await handle.readFile();
    if (!observed.equals(expected)) {
      throw new JournalRecoveryRequiredError(`Published journal bytes changed during durable flush: ${path}`);
    }
  } finally {
    await handle.close();
  }
}

function sameSnapshot(left: PathSnapshot, right: PathSnapshot): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "missing" ||
      (right.kind === "file" && left.contentBase64 === right.contentBase64 && left.mode === right.mode))
  );
}

function parseRecord(text: string): DurableTransactionRecord {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new JournalRecoveryRequiredError(`Journal JSON is corrupt: ${String(error)}`);
  }
  if (!isRecord(value)) throw new JournalRecoveryRequiredError("Journal record has an invalid structure");
  return value;
}

function isRecord(value: unknown): value is DurableTransactionRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<DurableTransactionRecord>;
  const entry = record.entry as Partial<TransactionJournalEntry> | undefined;
  return (
    record.version === 1 &&
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.transactionId === "string" &&
    typeof entry.planId === "string" &&
    transactionPhases.includes(entry.phase as TransactionPhase) &&
    isStateDigest(entry.beforeState) &&
    typeof entry.worktreePath === "string" &&
    isStringArray(entry.checkpointIds) &&
    isStringArray(entry.touchedPaths) &&
    isStringArray(entry.externalOperationIds) &&
    typeof entry.updatedAt === "string" &&
    isStringArray(record.allowedWriteRoots) &&
    Array.isArray(record.operations) &&
    record.operations.every(isOperation) &&
    Array.isArray(record.checkpoints) &&
    record.checkpoints.every(isCheckpoint) &&
    Array.isArray(record.compensations) &&
    record.compensations.every(isCompensation) &&
    (record.pendingMigration === undefined || isPendingMigrationForJournal(record.pendingMigration, entry.phase)) &&
    hasConsistentRecordIndexes(record as DurableTransactionRecord)
  );
}

function isPendingMigrationForJournal(value: unknown, transactionPhase: unknown): boolean {
  const current = PendingProjectDataMigrationSchema.safeParse(value);
  if (current.success) return current.data.phase === "backed-up";
  return (transactionPhase === "committed" || transactionPhase === "rolled-back") && isLegacyTerminalPendingMigration(value);
}

function isLegacyTerminalPendingMigration(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const pending = value as Record<string, unknown>;
  if (!hasExactKeys(pending, ["apiVersion", "attemptId", "backup", "createdAt", "manifestHash", "migrationId", "phase", "sourceSnapshotHash", "stagingLocation", "targetSnapshotHash"])) return false;
  const backup = pending.backup;
  if (typeof backup !== "object" || backup === null) return false;
  const backupRecord = backup as Record<string, unknown>;
  const location = backupRecord.location;
  if (!hasExactKeys(backupRecord, ["id", "location", "manifestHash"]) || typeof location !== "object" || location === null) return false;
  const locationRecord = location as Record<string, unknown>;
  return pending.apiVersion === "projector.pending-project-data-migration/v1"
    && pending.phase === "backed-up"
    && [pending.attemptId, pending.migrationId, pending.stagingLocation, pending.createdAt].every((item) => typeof item === "string" && item.length > 0)
    && [pending.sourceSnapshotHash, pending.targetSnapshotHash, pending.manifestHash, backupRecord.manifestHash].every(isContentHash)
    && typeof backupRecord.id === "string" && backupRecord.id.length > 0
    && hasExactKeys(locationRecord, ["kind", "path"])
    && locationRecord.kind === "codex-data-relative"
    && typeof locationRecord.path === "string" && locationRecord.path.length > 0;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

const transactionPhases: readonly TransactionPhase[] = [
  "prepared",
  "workspace-mutating",
  "workspace-staged",
  "validating",
  "canonical-staging",
  "committing",
  "committed",
  "rolling-back",
  "rolled-back",
  "recovery-required",
];

function isStateDigest(value: unknown): value is StateDigest {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<StateDigest>;
  return (
    typeof state.gitBase === "string" &&
    isContentHash(state.worktreeDigest) &&
    isContentHash(state.canonicalProjectorDigest) &&
    isContentHash(state.toolchainDigest) &&
    (state.pinnedExternalSnapshotDigest === undefined || isContentHash(state.pinnedExternalSnapshotDigest))
  );
}

function isOperation(value: unknown): value is FileJournalOperation {
  if (typeof value !== "object" || value === null) return false;
  const operation = value as Partial<FileJournalOperation>;
  return (
    typeof operation.id === "string" &&
    (operation.kind === "delete-file" || operation.kind === "move-file" || operation.kind === "write-file") &&
    (operation.status === "intended" || operation.status === "applied" || operation.status === "reverted") &&
    Array.isArray(operation.changes) &&
    operation.changes.every(isPathChange)
  );
}

function isPathChange(value: unknown): value is JournalPathChange {
  if (typeof value !== "object" || value === null) return false;
  const change = value as Partial<JournalPathChange>;
  return typeof change.path === "string" && isSnapshot(change.before) && isSnapshot(change.after);
}

function isSnapshot(value: unknown): value is PathSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<PathSnapshot>;
  return (
    snapshot.kind === "missing" ||
    (snapshot.kind === "file" &&
      typeof snapshot.contentBase64 === "string" &&
      Buffer.from(snapshot.contentBase64, "base64").toString("base64") === snapshot.contentBase64 &&
      typeof snapshot.mode === "number" &&
      Number.isSafeInteger(snapshot.mode) &&
      snapshot.mode >= 0 &&
      snapshot.mode <= 0o777)
  );
}

function isCheckpoint(value: unknown): value is JournalCheckpoint {
  if (typeof value !== "object" || value === null) return false;
  const checkpoint = value as Partial<JournalCheckpoint>;
  return (
    typeof checkpoint.id === "string" &&
    transactionPhases.includes(checkpoint.phase as TransactionPhase) &&
    typeof checkpoint.operationCount === "number" &&
    Number.isSafeInteger(checkpoint.operationCount) &&
    checkpoint.operationCount >= 0 &&
    typeof checkpoint.createdAt === "string"
  );
}

function isCompensation(value: unknown): value is CompensationRecord {
  if (typeof value !== "object" || value === null) return false;
  const compensation = value as Partial<CompensationRecord>;
  return (
    typeof compensation.externalOperationId === "string" &&
    (compensation.kind === "registered" || compensation.kind === "manual") &&
    (compensation.status === "pending" || compensation.status === "completed") &&
    typeof compensation.recordedAt === "string" &&
    (compensation.compensationId === undefined || typeof compensation.compensationId === "string") &&
    (compensation.instructions === undefined || typeof compensation.instructions === "string") &&
    (compensation.completedAt === undefined || typeof compensation.completedAt === "string")
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasConsistentRecordIndexes(record: DurableTransactionRecord): boolean {
  const operationIds = record.operations.map((operation) => operation.id);
  const touchedPaths = record.operations.flatMap((operation) => operation.changes.map((change) => change.path));
  const checkpointIds = record.checkpoints.map((checkpoint) => checkpoint.id);
  const externalOperationIds = record.compensations.map((compensation) => compensation.externalOperationId);
  return (
    allUnique(operationIds) &&
    sameStringSet(record.entry.touchedPaths, touchedPaths) &&
    sameStringSet(record.entry.checkpointIds, checkpointIds) &&
    sameStringSet(record.entry.externalOperationIds, externalOperationIds) &&
    allUnique(record.allowedWriteRoots) &&
    record.allowedWriteRoots.every(isCanonicalRepositoryPath) &&
    touchedPaths.every(
      (path) => isCanonicalRepositoryPath(path) && record.allowedWriteRoots.some((scope) => isWithinScope(path, scope)),
    ) &&
    record.checkpoints.every((checkpoint) => checkpoint.operationCount <= record.operations.length) &&
    (record.entry.phase !== "prepared" || record.operations.length === 0) &&
    (record.entry.phase !== "committed" || record.operations.every((operation) => operation.status === "applied")) &&
    (record.entry.phase !== "rolled-back" || record.operations.every((operation) => operation.status === "reverted"))
  );
}

function isCanonicalRepositoryPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    !path.startsWith("/") &&
    !/^[A-Za-z]:/u.test(path) &&
    posix.normalize(path) === path &&
    path !== ".." &&
    !path.startsWith("../")
  );
}

function isWithinScope(path: string, scope: string): boolean {
  return scope === "." || path === scope || path.startsWith(`${scope}/`);
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return allUnique(left) && allUnique(right) && left.length === right.length && left.every((value) => right.includes(value));
}

function allUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isContentHash(value: unknown): value is ContentHash {
  return typeof value === "string" && /^sha256:v1:[0-9a-f]{64}$/u.test(value);
}

function lastCheckpoint(record: DurableTransactionRecord): { lastCheckpointId?: string } {
  const last = record.entry.checkpointIds.at(-1);
  return last === undefined ? {} : { lastCheckpointId: last };
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!isCode(error, "EINVAL") && !isCode(error, "ENOTSUP") && !isCode(error, "EPERM")) throw error;
  } finally {
    await handle.close();
  }
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
