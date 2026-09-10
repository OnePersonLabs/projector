import { constants } from "node:fs";
import { lstat, mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CanonicalDocumentEnvelopeSchema,
  canonicalJson,
  hashRootManifest,
  parseCanonicalJson,
  type CanonicalDocumentEnvelope,
  type ContentHash,
} from "@projector/core";

import { NativeProcessLauncher, type ProcessLauncher } from "../execution/index.js";
import { assertSupportedCanonicalVersions } from "../persistence/index.js";
import type { CanonicalIndexRow } from "./derived-store.js";
import { currentSqliteSchemaVersion, migrateSqlite, sqliteMigrationSetHash } from "./migrations.js";

const maximumDatabaseBytes = 256 * 1024 * 1024;
const maximumRowsPerTable = 250_000;
const inspectionTimeoutMs = 10_000;
const childSource = String.raw`
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1], { allowExtension:false, defensive:true, enableDoubleQuotedStringLiterals:false, enableForeignKeyConstraints:true, readOnly:true, timeout:5000 });
try {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
  const maxRows = Number(process.argv[2]);
  const maxBytes = Number(process.argv[3]);
  const pageCount = db.prepare('PRAGMA page_count').get().page_count;
  const pageSize = db.prepare('PRAGMA page_size').get().page_size;
  if (!Number.isSafeInteger(pageCount) || pageCount < 0 || !Number.isSafeInteger(pageSize) || pageSize < 512 || pageCount * pageSize > maxBytes) {
    throw new Error('state.db page allocation exceeds bounded inspection limit');
  }
  const count = (table) => { const n=db.prepare('SELECT COUNT(*) AS count FROM '+table).get().count; if(!Number.isSafeInteger(n)||n<0||n>maxRows) throw new Error(table+' exceeds bounded row limit'); };
  const tables=['schema_migrations','graph_state','canonical_documents','entities','requirements','behavioral_scenarios','relations','lineage_records','tombstones','governance_documents'];
  for (const table of tables) count(table);
  const integrity=db.prepare('PRAGMA integrity_check').get().integrity_check;
  if(integrity!=='ok') throw new Error('integrity check returned '+String(integrity));
  process.stdout.write(JSON.stringify({
    pageCount,pageSize,
    migrations:db.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
    schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name,tbl_name").all(),
    graph:db.prepare('SELECT revision,canonical_root_digest AS rootDigest FROM graph_state WHERE singleton=1').get(),
    canonicalRows:db.prepare('SELECT id,kind,canonical_key AS canonicalKey,lifecycle,semantic_hash AS semanticHash,discovery_hash AS discoveryHash,canonical_document_hash AS canonicalDocumentHash,document_json AS documentJson,indexed_revision AS indexedRevision FROM canonical_documents ORDER BY id,canonical_document_hash').all(),
    logical:{
      entities:db.prepare('SELECT id,entity_kind,source_class,status FROM entities ORDER BY id').all(),requirements:db.prepare('SELECT id,source_class,status FROM requirements ORDER BY id').all(),
      behavioral_scenarios:db.prepare('SELECT id,source_class,status FROM behavioral_scenarios ORDER BY id').all(),relations:db.prepare('SELECT id,from_id,to_id,relation_type,active FROM relations ORDER BY id').all(),
      lineage_records:db.prepare('SELECT id,lineage_kind FROM lineage_records ORDER BY id').all(),tombstones:db.prepare('SELECT id,entity_id,deleted_at_revision FROM tombstones ORDER BY id').all(),
      governance_documents:db.prepare('SELECT id,governance_kind FROM governance_documents ORDER BY id').all()
    }
  }));
} finally { db.close(); }
`;

export type ExistingSqliteDerivedState =
  | { readonly status: "absent" }
  | {
      readonly status: "valid";
      readonly schemaVersion: number;
      readonly migrationSetHash: ContentHash;
      readonly canonicalRootDigest: ContentHash;
      readonly documentCount: number;
    };

export interface SqliteInspectionOptions {
  readonly signal?: AbortSignal;
  readonly launcher?: ProcessLauncher;
  /** Test seam for a pathname replacement between the pre-observation and handle open. */
  readonly afterSourcePreflight?: () => void | Promise<void>;
}

export async function inspectExistingSqliteDerivedState(path: string, expectedRoot: ContentHash, options: SqliteInspectionOptions = {}): Promise<ExistingSqliteDerivedState> {
  const initial = await lstat(path, { bigint: true }).catch((error: unknown) =>
    isCode(error, "ENOENT") ? undefined : Promise.reject(error),
  );
  if (initial === undefined) return { status: "absent" };
  assertBoundedRegular(initial, path);
  throwIfAborted(options.signal);
  const scratch = await mkdtemp(join(tmpdir(), "projector-sqlite-inspection-"));
  try {
    await copyBounded(path, join(scratch, basename(path)), options.afterSourcePreflight, options.signal);
    const rollbackJournal = `${path}-journal`;
    const rollbackJournalStatus = await lstat(rollbackJournal, { bigint: true }).catch((error: unknown) =>
      isCode(error, "ENOENT") ? undefined : Promise.reject(error),
    );
    if (rollbackJournalStatus !== undefined) {
      throw new Error(`${rollbackJournal} exists; hot rollback-journal state cannot be inspected safely`);
    }
    const walPath = `${path}-wal`;
    const walStatus = await lstat(walPath, { bigint: true }).catch((error: unknown) =>
      isCode(error, "ENOENT") ? undefined : Promise.reject(error),
    );
    if (walStatus !== undefined) {
      assertBoundedRegular(walStatus, walPath);
      await copyBounded(walPath, join(scratch, `${basename(path)}-wal`), undefined, options.signal);
    }
    await assertSidecarStateUnchanged(rollbackJournal, undefined);
    await assertSidecarStateUnchanged(walPath, walStatus);
    const signal = options.signal ?? new AbortController().signal;
    const result = await (options.launcher ?? new NativeProcessLauncher()).launch({
      executable: process.execPath,
      args: [
        "--input-type=commonjs",
        "--eval",
        childSource,
        join(scratch, basename(path)),
        String(maximumRowsPerTable),
        String(maximumDatabaseBytes),
      ],
      cwd: scratch,
      env: { PATH: process.env.PATH ?? "" },
      timeoutMs: inspectionTimeoutMs,
      maxOutputBytes: maximumDatabaseBytes,
      signal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`state.db bounded inspection failed: ${result.stderr || `exit ${String(result.exitCode)}`}`);
    }
    throwIfAborted(options.signal);
    return validateInspection(JSON.parse(result.stdout) as unknown, expectedRoot);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function copyBounded(
  source: string,
  target: string,
  afterPreflight: (() => void | Promise<void>) | undefined,
  signal: AbortSignal | undefined,
): Promise<void> {
  const before = await lstat(source, { bigint: true });
  assertBoundedRegular(before, source);
  await afterPreflight?.();
  const input = await open(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const output = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try {
      const opened = await input.stat({ bigint: true });
      if (!sameIdentity(before, opened)) throw new Error(`${source} changed identity before its inspection handle opened`);
      const buffer = Buffer.allocUnsafe(1024 * 1024);
      let copied = 0;
      while (true) {
        throwIfAborted(signal);
        const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) break;
        copied += bytesRead;
        if (copied > maximumDatabaseBytes) throw new Error(`${source} grew beyond the bounded inspection limit`);
        await writeAll(output, buffer.subarray(0, bytesRead));
      }
      await output.sync();
      const afterHandle = await input.stat({ bigint: true });
      const afterPath = await lstat(source, { bigint: true });
      if (!sameIdentity(opened, afterHandle) || !sameIdentity(opened, afterPath) || BigInt(copied) !== afterHandle.size) {
        throw new Error(`${source} changed during inspection snapshot creation`);
      }
    } finally {
      await output.close();
    }
  } finally {
    await input.close();
  }
}

async function assertSidecarStateUnchanged(path: string, expected: FileIdentity | undefined): Promise<void> {
  const observed = await lstat(path, { bigint: true }).catch((error: unknown) =>
    isCode(error, "ENOENT") ? undefined : Promise.reject(error),
  );
  if (expected === undefined ? observed !== undefined : observed === undefined || !sameIdentity(expected, observed)) {
    throw new Error(`${path} changed while the inspection snapshot was created`);
  }
}

async function writeAll(output: Awaited<ReturnType<typeof open>>, bytes: Buffer): Promise<void> {
  let offset = 0;
  while (offset < bytes.length) {
    const written = await output.write(bytes, offset, bytes.length - offset, null);
    if (written.bytesWritten <= 0) throw new Error("state.db snapshot write made no progress");
    offset += written.bytesWritten;
  }
}

type FileIdentity = { dev: bigint; ino: bigint; size: bigint; isFile(): boolean; isSymbolicLink(): boolean };
function assertBoundedRegular(status: FileIdentity, label: string): void {
  if (status.isSymbolicLink() || !status.isFile()) throw new Error(`${label} must be a regular non-symlink file`);
  if (status.size > BigInt(maximumDatabaseBytes)) {
    throw new Error(`${label} exceeds the bounded ${maximumDatabaseBytes}-byte inspection limit`);
  }
}
function sameIdentity(a: FileIdentity, b: FileIdentity): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size;
}

type Inspection = {
  pageCount: number;
  pageSize: number;
  migrations: Array<{ version: number }>;
  schema: unknown[];
  graph?: { revision: number; rootDigest: ContentHash | null };
  canonicalRows: CanonicalIndexRow[];
  logical: Record<string, unknown[]>;
};

function validateInspection(value: unknown, expectedRoot: ContentHash): ExistingSqliteDerivedState {
  if (!isRecord(value)) throw new Error("state.db inspection returned malformed output");
  const inspection = value as unknown as Inspection;
  if (
    !Number.isSafeInteger(inspection.pageCount) || inspection.pageCount < 0 ||
    !Number.isSafeInteger(inspection.pageSize) || inspection.pageSize < 512 ||
    inspection.pageCount * inspection.pageSize > maximumDatabaseBytes
  ) throw new Error("state.db page allocation exceeds bounded inspection limit");
  if (canonicalJson(inspection.migrations.map(({ version }) => version)) !== canonicalJson([currentSqliteSchemaVersion])) {
    throw new Error("state.db schema migrations do not match released version");
  }
  if (canonicalJson(inspection.schema) !== canonicalJson(expectedSchema())) {
    throw new Error("state.db schema does not match the released SQLite migration set");
  }
  const graph = inspection.graph;
  if (graph === undefined || !Number.isSafeInteger(graph.revision) || graph.revision < 0) {
    throw new Error("corrupt state.db: graph revision is invalid");
  }
  if (graph.rootDigest === null) throw new Error("state.db has not indexed a canonical snapshot");
  const documents = inspection.canonicalRows.map((row) => validateRow(row, graph.revision));
  const actual = hashRootManifest(inspection.canonicalRows.map((row) => ({
    entityId: row.id,
    canonicalDocumentHash: row.canonicalDocumentHash as ContentHash,
  })));
  if (actual !== graph.rootDigest || graph.rootDigest !== expectedRoot) {
    throw new Error(`state.db canonical root mismatch: expected ${expectedRoot}, received ${graph.rootDigest}`);
  }
  validateLogical(inspection.logical, documents);
  return {
    status: "valid",
    schemaVersion: currentSqliteSchemaVersion,
    migrationSetHash: sqliteMigrationSetHash,
    canonicalRootDigest: graph.rootDigest,
    documentCount: documents.length,
  };
}

let releasedSchema: unknown[] | undefined;
function expectedSchema(): unknown[] {
  if (releasedSchema !== undefined) return releasedSchema;
  const database = new DatabaseSync(":memory:");
  try {
    migrateSqlite(database);
    releasedSchema = database.prepare(
      "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name,tbl_name",
    ).all();
    return releasedSchema;
  } finally {
    database.close();
  }
}

function validateRow(row: CanonicalIndexRow, revision: number): CanonicalDocumentEnvelope {
  const result = CanonicalDocumentEnvelopeSchema.safeParse(parseCanonicalJson(row.documentJson));
  if (!result.success) throw new Error(`corrupt canonical index row ${row.id}: ${result.error.message}`);
  const document = result.data as CanonicalDocumentEnvelope;
  assertSupportedCanonicalVersions(document);
  if (
    document.id !== row.id || document.kind !== row.kind || document.key !== row.canonicalKey ||
    document.lifecycle !== row.lifecycle || document.semanticHash !== row.semanticHash ||
    (document.discoveryHash ?? null) !== row.discoveryHash ||
    document.canonicalDocumentHash !== row.canonicalDocumentHash || canonicalJson(document) !== row.documentJson ||
    !Number.isSafeInteger(row.indexedRevision) || row.indexedRevision < 1 || row.indexedRevision > revision
  ) throw new Error(`corrupt canonical index row ${row.id}: envelope/column mismatch`);
  return document;
}

function validateLogical(actual: Record<string, unknown[]>, documents: readonly CanonicalDocumentEnvelope[]): void {
  const expected: Record<string, unknown[]> = {
    entities: [], requirements: [], behavioral_scenarios: [], relations: [],
    lineage_records: [], tombstones: [], governance_documents: [],
  };
  for (const document of documents) {
    const payload = document.payload;
    switch (document.kind) {
      case "concept": expected.entities!.push({ id: document.id, entity_kind: payload.kind, source_class: payload.sourceClass, status: payload.status }); break;
      case "requirement": expected.requirements!.push({ id: document.id, source_class: payload.sourceClass, status: payload.status }); break;
      case "behavioral-scenario": expected.behavioral_scenarios!.push({ id: document.id, source_class: payload.sourceClass, status: payload.status }); break;
      case "relation": expected.relations!.push({ id: document.id, from_id: payload.fromId, to_id: payload.toId, relation_type: payload.type, active: payload.active === true ? 1 : 0 }); break;
      case "lineage": expected.lineage_records!.push({ id: document.id, lineage_kind: payload.kind }); break;
      case "tombstone": expected.tombstones!.push({ id: document.id, entity_id: payload.entityId, deleted_at_revision: payload.deletedAtRevision }); break;
      default: expected.governance_documents!.push({ id: document.id, governance_kind: document.kind });
    }
  }
  for (const [name, rows] of Object.entries(expected)) {
    if (canonicalJson(actual[name]) !== canonicalJson(rows)) {
      throw new Error(`corrupt state.db: ${name} does not match canonical documents`);
    }
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new Error("SQLite inspection aborted");
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
