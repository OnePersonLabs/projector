import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, rename, rm, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  PendingProjectDataMigrationSchema,
  canonicalJson,
  parseCanonicalJson,
  type ContentHash,
  type PendingProjectDataMigration,
} from "@projector/core";

const pendingMarkerRelativePath = join(".projector", "runtime", "migrations", "pending.json");
const maximumMarkerBytes = 64 * 1024;

export interface PendingMigrationBinding {
  migrationId: string;
  manifestHash: ContentHash;
}

export type PendingMigrationCrashPoint = "after-replacement-write";

export interface PendingProjectDataMigrationStoreOptions {
  crash?: (point: PendingMigrationCrashPoint) => void;
}

export class PendingProjectDataMigrationStore {
  private readonly markerPath: string;

  constructor(
    readonly repositoryRoot: string,
    readonly options: PendingProjectDataMigrationStoreOptions = {},
  ) {
    if (repositoryRoot.length === 0) throw new TypeError("A repository root is required");
    this.repositoryRoot = resolve(repositoryRoot);
    this.markerPath = join(this.repositoryRoot, pendingMarkerRelativePath);
  }

  async read(): Promise<PendingProjectDataMigration | undefined> {
    const bytes = await this.readRaw();
    return bytes === undefined ? undefined : parseMarker(bytes);
  }

  async create(marker: PendingProjectDataMigration): Promise<PendingProjectDataMigration> {
    const valid = PendingProjectDataMigrationSchema.parse(marker);
    if (valid.phase !== "backed-up") {
      throw new PendingMigrationPersistenceError("A new pending migration marker must begin in backed-up phase");
    }
    const bytes = markerBytes(valid);
    const directory = await this.ensureParent();
    const temporary = join(directory, `.pending.${randomUUID()}.tmp`);
    await writeDurableNewFile(temporary, bytes);
    try {
      try {
        await link(temporary, this.markerPath);
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
        const existing = await this.readRaw();
        if (existing === undefined || !existing.equals(bytes)) {
          throw new PendingMigrationPersistenceError(
            "Pending migration marker already contains unknown bytes; refusing to overwrite it",
          );
        }
        return parseMarker(existing);
      }
      await syncDirectory(directory);
      return valid;
    } finally {
      await rm(temporary, { force: true });
      await syncDirectory(directory);
    }
  }

  async transition(
    binding: PendingMigrationBinding,
    phase: PendingProjectDataMigration["phase"],
  ): Promise<PendingProjectDataMigration> {
    const { bytes: priorBytes, marker } = await this.readRequired();
    assertBinding(marker, binding);
    if (marker.phase === phase) return marker;
    if (nextPhase(marker.phase) !== phase) {
      throw new PendingMigrationPersistenceError(`Invalid pending migration transition from ${marker.phase} to ${phase}`);
    }
    const next = PendingProjectDataMigrationSchema.parse({ ...marker, phase });
    const directory = dirname(this.markerPath);
    const temporary = join(directory, `.pending.${randomUUID()}.tmp`);
    await writeDurableNewFile(temporary, markerBytes(next));
    try {
      this.options.crash?.("after-replacement-write");
      const currentBytes = await this.readRaw();
      if (currentBytes === undefined || !currentBytes.equals(priorBytes)) {
        throw new PendingMigrationPersistenceError("Pending migration marker changed before phase publication");
      }
      await rename(temporary, this.markerPath);
      await syncDirectory(directory);
      return next;
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async clearAfterConfigPublication(binding: PendingMigrationBinding): Promise<void> {
    const { bytes, marker } = await this.readRequired();
    assertBinding(marker, binding);
    if (marker.phase !== "publishing") {
      throw new PendingMigrationPersistenceError(
        `Pending migration marker can be cleared only from publishing, not ${marker.phase}`,
      );
    }
    const current = await this.readRaw();
    if (current === undefined || !current.equals(bytes)) {
      throw new PendingMigrationPersistenceError("Pending migration marker changed before exact-bound clear");
    }
    await unlink(this.markerPath);
    await syncDirectory(dirname(this.markerPath));
  }

  private async readRequired(): Promise<{ bytes: Buffer; marker: PendingProjectDataMigration }> {
    const bytes = await this.readRaw();
    if (bytes === undefined) throw new PendingMigrationPersistenceError("Pending migration marker is missing");
    return { bytes, marker: parseMarker(bytes) };
  }

  private async readRaw(): Promise<Buffer | undefined> {
    await assertExistingDirectoryChain(this.repositoryRoot, [".projector", "runtime", "migrations"]);
    let status;
    try { status = await lstat(this.markerPath); }
    catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
    if (status.isSymbolicLink()) throw new PendingMigrationPersistenceError("Pending migration marker is a symbolic link");
    if (!status.isFile()) throw new PendingMigrationPersistenceError("Pending migration marker is not a regular file");
    if (status.size > maximumMarkerBytes) throw new PendingMigrationPersistenceError("Pending migration marker exceeds its byte limit");
    const handle = await open(this.markerPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile()) throw new PendingMigrationPersistenceError("Pending migration marker is not a regular file");
      if (opened.size > maximumMarkerBytes) throw new PendingMigrationPersistenceError("Pending migration marker exceeds its byte limit");
      const bytes = await handle.readFile();
      if (bytes.byteLength > maximumMarkerBytes) throw new PendingMigrationPersistenceError("Pending migration marker exceeds its byte limit");
      return bytes;
    } finally { await handle.close(); }
  }

  private async ensureParent(): Promise<string> {
    await assertRegularDirectory(this.repositoryRoot, "Repository root");
    let current = this.repositoryRoot;
    for (const segment of [".projector", "runtime", "migrations"]) {
      const parent = current;
      current = join(current, segment);
      try { await mkdir(current); }
      catch (error) { if (!hasCode(error, "EEXIST")) throw error; }
      await assertRegularDirectory(current, `Pending migration directory ${segment}`);
      await syncDirectory(parent);
    }
    return current;
  }
}

export class PendingMigrationPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PendingMigrationPersistenceError";
  }
}

function markerBytes(marker: PendingProjectDataMigration): Buffer {
  return Buffer.from(`${canonicalJson(marker)}\n`);
}

function parseMarker(bytes: Buffer): PendingProjectDataMigration {
  let value: unknown;
  try { value = parseCanonicalJson(bytes.toString("utf8")); }
  catch (error) {
    throw new PendingMigrationPersistenceError(`Pending migration marker is malformed: ${errorMessage(error)}`);
  }
  const result = PendingProjectDataMigrationSchema.safeParse(value);
  if (!result.success) {
    throw new PendingMigrationPersistenceError(`Pending migration marker is invalid: ${result.error.message}`);
  }
  if (!bytes.equals(markerBytes(result.data))) {
    throw new PendingMigrationPersistenceError("Pending migration marker is not canonical machine JSON");
  }
  return result.data;
}

function assertBinding(marker: PendingProjectDataMigration, binding: PendingMigrationBinding): void {
  if (marker.migrationId !== binding.migrationId || marker.manifestHash !== binding.manifestHash) {
    throw new PendingMigrationPersistenceError("Pending migration identity does not match the requested migration and manifest");
  }
}

function nextPhase(phase: PendingProjectDataMigration["phase"]): PendingProjectDataMigration["phase"] | undefined {
  if (phase === "backed-up") return "staged";
  if (phase === "staged") return "publishing";
  return undefined;
}

async function assertExistingDirectoryChain(root: string, segments: readonly string[]): Promise<void> {
  await assertRegularDirectory(root, "Repository root");
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    try { await assertRegularDirectory(current, `Pending migration directory ${segment}`); }
    catch (error) { if (hasCode(error, "ENOENT")) return; throw error; }
  }
}

async function assertRegularDirectory(path: string, label: string): Promise<void> {
  const status = await lstat(path);
  if (status.isSymbolicLink()) throw new PendingMigrationPersistenceError(`${label} is a symbolic link`);
  if (!status.isDirectory()) throw new PendingMigrationPersistenceError(`${label} is not a regular directory`);
}

async function writeDurableNewFile(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error) {
    if (!hasCode(error, "EINVAL") && !hasCode(error, "ENOTSUP") && !hasCode(error, "EPERM")) throw error;
  } finally { await handle.close(); }
}

function hasCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
