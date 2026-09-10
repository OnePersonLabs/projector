import { lstatSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import {
  CanonicalDocumentEnvelopeSchema,
  canonicalJson,
  hashRootManifest,
  parseCanonicalJson,
  type CanonicalDocumentEnvelope,
  type ContentHash,
} from "@projector/core";

import { assertSupportedCanonicalVersions } from "../persistence/index.js";
import type { CanonicalIndexRow } from "./derived-store.js";
import { currentSqliteSchemaVersion, migrateSqlite } from "./migrations.js";

export type ExistingSqliteDerivedState =
  | { readonly status: "absent" }
  | {
      readonly status: "valid";
      readonly schemaVersion: number;
      readonly canonicalRootDigest: ContentHash;
      readonly documentCount: number;
    };

export function inspectExistingSqliteDerivedState(
  path: string,
  expectedCanonicalRootDigest: ContentHash,
): ExistingSqliteDerivedState {
  let status;
  try { status = lstatSync(path); }
  catch (error) {
    if (isCode(error, "ENOENT")) return { status: "absent" };
    throw error;
  }
  if (status.isSymbolicLink() || !status.isFile()) throw new Error(`state.db must be a regular non-symlink file: ${path}`);
  const database = new DatabaseSync(path, {
    allowExtension: false,
    defensive: true,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    readOnly: true,
    timeout: 5_000,
  });
  try {
    database.exec("PRAGMA foreign_keys = ON; PRAGMA trusted_schema = OFF; PRAGMA query_only = ON;");
    const integrity = database.prepare("PRAGMA integrity_check").get() as { integrity_check: string } | undefined;
    if (integrity?.integrity_check !== "ok") throw new Error(`corrupt state.db: integrity check returned ${integrity?.integrity_check ?? "unavailable"}`);
    const migrations = database.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
    if (canonicalJson(migrations.map(({ version }) => version)) !== canonicalJson([currentSqliteSchemaVersion])) {
      throw new Error(`state.db schema migrations do not match required version ${currentSqliteSchemaVersion}`);
    }
    if (canonicalJson(sqliteSchema(database)) !== canonicalJson(expectedSqliteSchema())) {
      throw new Error("state.db schema does not match the released SQLite migration set");
    }
    const graph = database.prepare("SELECT revision, canonical_root_digest AS rootDigest FROM graph_state WHERE singleton = 1").get() as
      | { revision: number; rootDigest: ContentHash | null }
      | undefined;
    if (graph?.rootDigest === null || graph?.rootDigest === undefined) throw new Error("state.db has not indexed a canonical snapshot");
    const rows = canonicalRows(database);
    const documents = rows.map((row) => validateRow(row, graph.revision));
    const actualDigest = hashRootManifest(rows.map((row) => ({
      entityId: row.id,
      canonicalDocumentHash: row.canonicalDocumentHash as ContentHash,
    })));
    if (actualDigest !== graph.rootDigest) throw new Error(`corrupt state.db canonical root mismatch: expected ${actualDigest}, received ${graph.rootDigest}`);
    if (graph.rootDigest !== expectedCanonicalRootDigest) {
      throw new Error(`state.db canonical root mismatch: expected ${expectedCanonicalRootDigest}, received ${graph.rootDigest}`);
    }
    validateLogicalTables(database, documents);
    return {
      status: "valid",
      schemaVersion: currentSqliteSchemaVersion,
      canonicalRootDigest: graph.rootDigest,
      documentCount: rows.length,
    };
  } finally {
    database.close();
  }
}

type SqliteSchemaRow = { type: string; name: string; tbl_name: string; sql: string | null };

function sqliteSchema(database: DatabaseSync): SqliteSchemaRow[] {
  return database.prepare(`
    SELECT type, name, tbl_name, sql FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name, tbl_name
  `).all() as unknown as SqliteSchemaRow[];
}

let releasedSchema: readonly SqliteSchemaRow[] | undefined;
function expectedSqliteSchema(): readonly SqliteSchemaRow[] {
  if (releasedSchema !== undefined) return releasedSchema;
  const database = new DatabaseSync(":memory:", {
    allowExtension: false,
    defensive: true,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
  });
  try {
    migrateSqlite(database);
    releasedSchema = Object.freeze(sqliteSchema(database).map((row) => Object.freeze({ ...row })));
    return releasedSchema;
  } finally {
    database.close();
  }
}

function canonicalRows(database: DatabaseSync): CanonicalIndexRow[] {
  return database.prepare(`
    SELECT id, kind, canonical_key AS canonicalKey, lifecycle,
      semantic_hash AS semanticHash, discovery_hash AS discoveryHash,
      canonical_document_hash AS canonicalDocumentHash, document_json AS documentJson,
      indexed_revision AS indexedRevision
    FROM canonical_documents ORDER BY id, canonical_document_hash
  `).all() as unknown as CanonicalIndexRow[];
}

function validateRow(row: CanonicalIndexRow, graphRevision: number): CanonicalDocumentEnvelope {
  const result = CanonicalDocumentEnvelopeSchema.safeParse(parseCanonicalJson(row.documentJson));
  if (!result.success) throw new Error(`corrupt canonical index row ${row.id}: ${result.error.message}`);
  const document = result.data as CanonicalDocumentEnvelope;
  assertSupportedCanonicalVersions(document);
  if (
    document.id !== row.id || document.kind !== row.kind || document.key !== row.canonicalKey ||
    document.lifecycle !== row.lifecycle || document.semanticHash !== row.semanticHash ||
    (document.discoveryHash ?? null) !== row.discoveryHash ||
    document.canonicalDocumentHash !== row.canonicalDocumentHash || canonicalJson(document) !== row.documentJson ||
    !Number.isSafeInteger(row.indexedRevision) || row.indexedRevision < 1 || row.indexedRevision > graphRevision
  ) throw new Error(`corrupt canonical index row ${row.id}: envelope/column mismatch`);
  return document;
}

function validateLogicalTables(database: DatabaseSync, documents: readonly CanonicalDocumentEnvelope[]): void {
  const expected = {
    entities: [] as unknown[], requirements: [] as unknown[], behavioral_scenarios: [] as unknown[],
    relations: [] as unknown[], lineage_records: [] as unknown[], tombstones: [] as unknown[], governance_documents: [] as unknown[],
  };
  for (const document of documents) {
    const payload = document.payload;
    switch (document.kind) {
      case "concept": expected.entities.push({ id: document.id, entity_kind: payload.kind, source_class: payload.sourceClass, status: payload.status }); break;
      case "requirement": expected.requirements.push({ id: document.id, source_class: payload.sourceClass, status: payload.status }); break;
      case "behavioral-scenario": expected.behavioral_scenarios.push({ id: document.id, source_class: payload.sourceClass, status: payload.status }); break;
      case "relation": expected.relations.push({ id: document.id, from_id: payload.fromId, to_id: payload.toId, relation_type: payload.type, active: payload.active === true ? 1 : 0 }); break;
      case "lineage": expected.lineage_records.push({ id: document.id, lineage_kind: payload.kind }); break;
      case "tombstone": expected.tombstones.push({ id: document.id, entity_id: payload.entityId, deleted_at_revision: payload.deletedAtRevision }); break;
      default: expected.governance_documents.push({ id: document.id, governance_kind: document.kind });
    }
  }
  const selects = {
    entities: "SELECT id, entity_kind, source_class, status FROM entities ORDER BY id",
    requirements: "SELECT id, source_class, status FROM requirements ORDER BY id",
    behavioral_scenarios: "SELECT id, source_class, status FROM behavioral_scenarios ORDER BY id",
    relations: "SELECT id, from_id, to_id, relation_type, active FROM relations ORDER BY id",
    lineage_records: "SELECT id, lineage_kind FROM lineage_records ORDER BY id",
    tombstones: "SELECT id, entity_id, deleted_at_revision FROM tombstones ORDER BY id",
    governance_documents: "SELECT id, governance_kind FROM governance_documents ORDER BY id",
  } as const;
  for (const name of Object.keys(selects) as Array<keyof typeof selects>) {
    const actual = database.prepare(selects[name]).all();
    if (canonicalJson(actual) !== canonicalJson(expected[name])) throw new Error(`corrupt state.db: ${name} does not match canonical documents`);
  }
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
