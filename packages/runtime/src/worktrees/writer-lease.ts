import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { ContentHashSchema, StateBindingSchema, StateDigestSchema, type ContentHash, type StateBinding, type StateDigest } from "@projector/core";

import type { RepositoryPathService } from "../security/index.js";

const runtimeDirectory = ".projector/runtime";
const activeLeaseName = "writer-lease.lock";

export type LeaseConflictCode = "lease-corrupt" | "lease-held" | "lease-lost";

export class LeaseConflictError extends Error {
  readonly code: LeaseConflictCode;

  constructor(code: LeaseConflictCode, message: string) {
    super(message);
    this.name = "LeaseConflictError";
    this.code = code;
  }
}

export interface WriterLeaseOwner {
  sessionId: string;
  processId: number | string;
  stateBinding: StateBinding;
}

export interface WriterLeaseRecord extends WriterLeaseOwner {
  version: 1;
  leaseId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
  staleAfterMs: number;
  compiledAgainstSnapshot: StateDigest;
}

export interface MigrationRecoveryWriterLeaseOwner {
  sessionId: string;
  processId: number | string;
  migrationId: string;
  manifestHash: ContentHash;
  targetSnapshotHash: ContentHash;
  backupManifestHash: ContentHash;
}

export interface MigrationRecoveryWriterLeaseRecord extends MigrationRecoveryWriterLeaseOwner {
  version: 2;
  ownerKind: "migration-recovery";
  leaseId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
  staleAfterMs: number;
}

type ActiveWriterLeaseRecord = WriterLeaseRecord | MigrationRecoveryWriterLeaseRecord;
type WriterLeasePersistenceFields = Pick<
  ActiveWriterLeaseRecord,
  "leaseId" | "acquiredAt" | "heartbeatAt" | "expiresAt" | "staleAfterMs"
>;

export interface WriterLeaseOptions {
  staleAfterMs: number;
  now?: () => Date;
}

export class WriterLeaseHandle {
  readonly record: WriterLeaseRecord;
  private released = false;

  constructor(
    private readonly manager: WriterLeaseManager,
    record: WriterLeaseRecord,
  ) {
    this.record = record;
  }

  async heartbeat(): Promise<void> {
    this.assertNotReleased();
    await this.manager.heartbeat(this.record.leaseId);
  }

  async release(): Promise<void> {
    this.assertNotReleased();
    await this.manager.release(this.record.leaseId);
    this.released = true;
  }

  private assertNotReleased(): void {
    if (this.released) {
      throw new LeaseConflictError("lease-lost", `Lease ${this.record.leaseId} is already released`);
    }
  }
}

export class MigrationRecoveryWriterLeaseHandle {
  private released = false;

  constructor(
    private readonly manager: WriterLeaseManager,
    readonly record: MigrationRecoveryWriterLeaseRecord,
  ) {}

  async heartbeat(): Promise<void> {
    this.assertNotReleased();
    await this.manager.heartbeat(this.record.leaseId);
  }

  async release(): Promise<void> {
    this.assertNotReleased();
    await this.manager.release(this.record.leaseId);
    this.released = true;
  }

  private assertNotReleased(): void {
    if (this.released) throw lostLease(this.record.leaseId);
  }
}

export class WriterLeaseManager {
  private readonly staleAfterMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly paths: RepositoryPathService,
    options: WriterLeaseOptions,
  ) {
    if (!Number.isSafeInteger(options.staleAfterMs) || options.staleAfterMs <= 0) {
      throw new TypeError("staleAfterMs must be a positive integer");
    }
    this.staleAfterMs = options.staleAfterMs;
    this.now = options.now ?? (() => new Date());
  }

  async acquire(owner: WriterLeaseOwner): Promise<WriterLeaseHandle> {
    assertOwnerIdentity(owner);
    const record = await this.acquireRecord((base) => ({
      ...base,
      sessionId: owner.sessionId,
      processId: owner.processId,
      version: 1,
      stateBinding: owner.stateBinding,
      compiledAgainstSnapshot: owner.stateBinding.compiledAgainst,
    }));
    if (record.version !== 1) throw new Error("Internal writer lease kind mismatch");
    return new WriterLeaseHandle(this, record);
  }

  async acquireMigrationRecovery(owner: MigrationRecoveryWriterLeaseOwner): Promise<MigrationRecoveryWriterLeaseHandle> {
    assertOwnerIdentity(owner);
    assertExactKeys(owner as unknown as Record<string, unknown>, [
      "backupManifestHash", "manifestHash", "migrationId", "processId", "sessionId", "targetSnapshotHash",
    ]);
    if (!/^[a-z0-9][a-z0-9._:-]{0,511}$/u.test(owner.migrationId)) throw new TypeError("Invalid migration recovery identity");
    for (const value of [owner.manifestHash, owner.targetSnapshotHash, owner.backupManifestHash]) ContentHashSchema.parse(value);
    const record = await this.acquireRecord((base) => ({
      ...base,
      version: 2,
      ownerKind: "migration-recovery",
      sessionId: owner.sessionId,
      processId: owner.processId,
      migrationId: owner.migrationId,
      manifestHash: owner.manifestHash,
      targetSnapshotHash: owner.targetSnapshotHash,
      backupManifestHash: owner.backupManifestHash,
    }));
    if (record.version !== 2) throw new Error("Internal writer lease kind mismatch");
    return new MigrationRecoveryWriterLeaseHandle(this, record);
  }

  private async acquireRecord(
    createRecord: (base: WriterLeasePersistenceFields) => ActiveWriterLeaseRecord,
  ): Promise<ActiveWriterLeaseRecord> {
    const runtime = await this.ensureRuntimeDirectory();
    const activePath = join(runtime, activeLeaseName);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await mkdir(activePath);
        const acquired = this.now();
        const expires = new Date(acquired.getTime() + this.staleAfterMs);
        const record = createRecord({
          leaseId: randomUUID(),
          acquiredAt: acquired.toISOString(),
          heartbeatAt: acquired.toISOString(),
          expiresAt: expires.toISOString(),
          staleAfterMs: this.staleAfterMs,
        });
        if (!isLeaseRecord(record)) throw new TypeError("Writer lease owner produced an invalid persisted record");
        try {
          await writeDurableNewFile(join(activePath, "owner.json"), `${JSON.stringify(record)}\n`);
          await writeDurableNewFile(join(activePath, "heartbeat"), `${record.leaseId}\n`);
          const heartbeat = await open(join(activePath, "heartbeat"), "r+");
          try {
            await heartbeat.utimes(acquired, acquired);
            await heartbeat.sync();
          } finally {
            await heartbeat.close();
          }
          await syncDirectory(activePath);
          await syncDirectory(runtime);
          return record;
        } catch (error) {
          await rm(activePath, { recursive: true, force: true });
          throw error;
        }
      } catch (error) {
        if (!isCode(error, "EEXIST")) throw error;
      }

      const existing = await this.readActiveRecord();
      const heartbeat = await stat(join(activePath, "heartbeat")).catch((error: unknown) => {
        throw corruptLease(error);
      });
      if (this.now().getTime() - heartbeat.mtimeMs < existing.staleAfterMs) {
        throw new LeaseConflictError(
          "lease-held",
          `Worktree writer lease is held by ${existing.sessionId}/${String(existing.processId)}`,
        );
      }

      const staleDirectory = join(runtime, "stale-leases");
      await mkdir(staleDirectory, { recursive: true });
      const displacedPath = join(staleDirectory, existing.leaseId);
      try {
        await rename(activePath, displacedPath);
        await syncDirectory(runtime);
      } catch (error) {
        if (isCode(error, "ENOENT") || isCode(error, "EEXIST")) continue;
        throw error;
      }
    }
    throw new LeaseConflictError("lease-held", "Writer lease changed repeatedly during acquisition");
  }

  async heartbeat(leaseId: string): Promise<void> {
    await this.assertOwned(leaseId);
    const heartbeatPath = await this.activeChild("heartbeat");
    const handle = await open(heartbeatPath, "r+");
    try {
      const current = await this.readActiveRecord();
      if (current.leaseId !== leaseId) throw lostLease(leaseId);
      const now = this.now();
      await handle.utimes(now, now);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async release(leaseId: string): Promise<void> {
    await this.assertOwned(leaseId);
    const activePath = await this.activeDirectory();
    const releasedPath = join(await this.runtimePath(), `released-${leaseId}`);
    try {
      await rename(activePath, releasedPath);
    } catch (error) {
      if (isCode(error, "ENOENT")) throw lostLease(leaseId);
      throw error;
    }
    const moved = await readLeaseRecord(join(releasedPath, "owner.json"));
    if (moved.leaseId !== leaseId) {
      throw lostLease(leaseId);
    }
    await rm(releasedPath, { recursive: true });
    await syncDirectory(await this.runtimePath());
  }

  private async assertOwned(leaseId: string): Promise<void> {
    let record: ActiveWriterLeaseRecord;
    try {
      record = await this.readActiveRecord();
    } catch (error) {
      if (error instanceof LeaseConflictError && error.code === "lease-corrupt") throw error;
      throw lostLease(leaseId);
    }
    if (record.leaseId !== leaseId) throw lostLease(leaseId);
  }

  private async readActiveRecord(): Promise<ActiveWriterLeaseRecord> {
    try {
      return await readLeaseRecord(await this.activeChild("owner.json"));
    } catch (error) {
      if (error instanceof LeaseConflictError) throw error;
      throw corruptLease(error);
    }
  }

  private async ensureRuntimeDirectory(): Promise<string> {
    const initial = await this.paths.resolveWrite(runtimeDirectory);
    await mkdir(initial.realTarget, { recursive: true });
    return (await this.paths.resolveWrite(runtimeDirectory)).realTarget;
  }

  private async runtimePath(): Promise<string> {
    return (await this.paths.resolveWrite(runtimeDirectory)).realTarget;
  }

  private async activeDirectory(): Promise<string> {
    return (await this.paths.resolveWrite(`${runtimeDirectory}/${activeLeaseName}`)).realTarget;
  }

  private async activeChild(name: "heartbeat" | "owner.json"): Promise<string> {
    return (await this.paths.resolveWrite(`${runtimeDirectory}/${activeLeaseName}/${name}`)).realTarget;
  }
}

async function readLeaseRecord(path: string): Promise<ActiveWriterLeaseRecord> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isLeaseRecord(parsed)) throw new Error("Invalid lease record");
    return parsed;
  } catch (error) {
    throw corruptLease(error);
  }
}

function isLeaseRecord(value: unknown): value is ActiveWriterLeaseRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const common =
    typeof candidate.leaseId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(candidate.leaseId) &&
    typeof candidate.sessionId === "string" &&
    candidate.sessionId.length > 0 &&
    ((typeof candidate.processId === "string" && candidate.processId.length > 0) ||
      (typeof candidate.processId === "number" && Number.isSafeInteger(candidate.processId) && candidate.processId > 0)) &&
    typeof candidate.staleAfterMs === "number" &&
    Number.isSafeInteger(candidate.staleAfterMs) &&
    candidate.staleAfterMs > 0 &&
    isIsoDate(candidate.acquiredAt) &&
    isIsoDate(candidate.heartbeatAt) &&
    isIsoDate(candidate.expiresAt);
  if (!common) return false;
  if (candidate.version === 1) return StateBindingSchema.safeParse(candidate.stateBinding).success &&
    StateDigestSchema.safeParse(candidate.compiledAgainstSnapshot).success &&
    JSON.stringify((candidate.stateBinding as { compiledAgainst?: unknown } | undefined)?.compiledAgainst) === JSON.stringify(candidate.compiledAgainstSnapshot);
  return candidate.version === 2 && candidate.ownerKind === "migration-recovery" &&
    typeof candidate.migrationId === "string" && /^[a-z0-9][a-z0-9._:-]{0,511}$/u.test(candidate.migrationId) &&
    ContentHashSchema.safeParse(candidate.manifestHash).success && ContentHashSchema.safeParse(candidate.targetSnapshotHash).success &&
    ContentHashSchema.safeParse(candidate.backupManifestHash).success;
}

function assertOwnerIdentity(owner: { sessionId: string; processId: number | string }): void {
  const validProcess = typeof owner.processId === "number"
    ? Number.isSafeInteger(owner.processId) && owner.processId > 0
    : owner.processId.length > 0 && owner.processId.trim() === owner.processId;
  if (owner.sessionId.length === 0 || owner.sessionId.trim() !== owner.sessionId || !validProcess) {
    throw new TypeError("A writer lease requires process and session identity");
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError("Migration recovery lease owner contains unexpected keys or missing fields");
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

async function writeDurableNewFile(path: string, content: string): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
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

function corruptLease(cause: unknown): LeaseConflictError {
  return new LeaseConflictError(
    "lease-corrupt",
    `Writer lease is unreadable and requires recovery: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
}

function lostLease(leaseId: string): LeaseConflictError {
  return new LeaseConflictError("lease-lost", `Writer lease ${leaseId} is no longer active`);
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
