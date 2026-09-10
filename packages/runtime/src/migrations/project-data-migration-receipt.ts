import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  ProjectDataMigrationReceiptSchema,
  canonicalJson,
  parseCanonicalJson,
  type ProjectDataMigrationReceipt,
} from "@projector/core";

const maximumReceiptBytes = 64 * 1024;

export interface ProjectDataMigrationReceiptStoreOptions {
  crash?: (point: "after-publication-before-flush") => void;
}

export class ProjectDataMigrationReceiptStore {
  readonly repositoryRoot: string;
  private readonly projectorRoot: string;

  constructor(repositoryRoot: string, readonly options: ProjectDataMigrationReceiptStoreOptions = {}) {
    if (repositoryRoot.length === 0) throw new TypeError("A repository root is required");
    this.repositoryRoot = resolve(repositoryRoot);
    this.projectorRoot = join(this.repositoryRoot, ".projector");
  }

  pathFor(migrationId: string): string {
    const identityHash = createHash("sha256").update(migrationId, "utf8").digest("hex");
    return join(this.projectorRoot, `project-data-migration-receipt--${identityHash}.json`);
  }

  async read(migrationId: string): Promise<ProjectDataMigrationReceipt | undefined> {
    const bytes = await readBoundedRegularFile(this.pathFor(migrationId));
    return bytes === undefined ? undefined : parseReceipt(bytes);
  }

  async publish(receipt: ProjectDataMigrationReceipt): Promise<ProjectDataMigrationReceipt> {
    const valid = ProjectDataMigrationReceiptSchema.parse(receipt);
    await assertRegularDirectory(this.repositoryRoot, "Repository root");
    await assertRegularDirectory(this.projectorRoot, "Projector directory");
    const bytes = receiptBytes(valid);
    const target = this.pathFor(valid.migrationId);
    const temporary = join(this.projectorRoot, `.migration-receipt.${randomUUID()}.tmp`);
    await writeDurableNewFile(temporary, bytes);
    try {
      try {
        await link(temporary, target);
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
        const existing = await readBoundedRegularFile(target);
        if (existing === undefined || !existing.equals(bytes)) {
          throw new ProjectDataMigrationReceiptPersistenceError(
            "Migration receipt identity already contains different bytes; refusing to overwrite it",
          );
        }
        await flushPublishedFile(target, bytes);
        await syncDirectoryIfSupported(this.projectorRoot);
        return parseReceipt(existing);
      }
      this.options.crash?.("after-publication-before-flush");
      await flushPublishedFile(target, bytes);
      await syncDirectoryIfSupported(this.projectorRoot);
      return valid;
    } finally {
      await rm(temporary, { force: true });
      await syncDirectoryIfSupported(this.projectorRoot);
    }
  }
}

export class ProjectDataMigrationReceiptPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectDataMigrationReceiptPersistenceError";
  }
}

function receiptBytes(receipt: ProjectDataMigrationReceipt): Buffer {
  return Buffer.from(`${canonicalJson(receipt)}\n`);
}

function parseReceipt(bytes: Buffer): ProjectDataMigrationReceipt {
  let value: unknown;
  try { value = parseCanonicalJson(bytes.toString("utf8")); }
  catch (error) {
    throw new ProjectDataMigrationReceiptPersistenceError(`Migration receipt is malformed: ${message(error)}`);
  }
  const result = ProjectDataMigrationReceiptSchema.safeParse(value);
  if (!result.success) {
    throw new ProjectDataMigrationReceiptPersistenceError(`Migration receipt is invalid: ${result.error.message}`);
  }
  if (!bytes.equals(receiptBytes(result.data))) {
    throw new ProjectDataMigrationReceiptPersistenceError("Migration receipt is not canonical machine JSON");
  }
  return result.data;
}

async function readBoundedRegularFile(path: string): Promise<Buffer | undefined> {
  let status;
  try { status = await lstat(path); }
  catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
  if (status.isSymbolicLink()) throw new ProjectDataMigrationReceiptPersistenceError("Migration receipt is a symbolic link");
  if (!status.isFile()) throw new ProjectDataMigrationReceiptPersistenceError("Migration receipt is not a regular file");
  if (status.size > maximumReceiptBytes) throw new ProjectDataMigrationReceiptPersistenceError("Migration receipt exceeds its byte limit");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new ProjectDataMigrationReceiptPersistenceError("Migration receipt is not a regular file");
    if (opened.size > maximumReceiptBytes) throw new ProjectDataMigrationReceiptPersistenceError("Migration receipt exceeds its byte limit");
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumReceiptBytes) throw new ProjectDataMigrationReceiptPersistenceError("Migration receipt exceeds its byte limit");
    return bytes;
  } finally { await handle.close(); }
}

async function assertRegularDirectory(path: string, label: string): Promise<void> {
  const status = await lstat(path);
  if (status.isSymbolicLink()) throw new ProjectDataMigrationReceiptPersistenceError(`${label} is a symbolic link`);
  if (!status.isDirectory()) throw new ProjectDataMigrationReceiptPersistenceError(`${label} is not a regular directory`);
}

async function writeDurableNewFile(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
}

async function flushPublishedFile(path: string, expected: Uint8Array): Promise<void> {
  const handle = await open(path, "r+");
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new ProjectDataMigrationReceiptPersistenceError("Published migration receipt is not a regular file");
    await handle.sync();
    if (!(await handle.readFile()).equals(expected)) {
      throw new ProjectDataMigrationReceiptPersistenceError("Published migration receipt bytes changed during durable flush");
    }
  } finally { await handle.close(); }
}

async function syncDirectoryIfSupported(path: string): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error) {
    if (!hasCode(error, "EINVAL") && !hasCode(error, "ENOTSUP") && !hasCode(error, "EPERM")) throw error;
  } finally { await handle.close(); }
}

function hasCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
