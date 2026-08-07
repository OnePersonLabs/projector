import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CanonicalDocumentEnvelopeSchema,
  canonicalJson,
  hashRootManifest,
  parseCanonicalJson,
  type CanonicalDocumentEnvelope,
  type ContentHash,
} from "@projector/core";

import { assertSupportedCanonicalVersions, type CanonicalSnapshot } from "../persistence/index.js";
import { migrateSqlite } from "./migrations.js";

export interface DerivedRevision {
  readonly revision: number;
  readonly rootDigest: ContentHash;
  readonly documentCount: number;
}

export interface CanonicalIndexRow {
  readonly id: string;
  readonly kind: string;
  readonly canonicalKey: string;
  readonly lifecycle: string;
  readonly semanticHash: string;
  readonly discoveryHash: string | null;
  readonly canonicalDocumentHash: string;
  readonly documentJson: string;
  readonly indexedRevision: number;
}

export interface LogicalTableCounts {
  readonly entities: number;
  readonly requirements: number;
  readonly behavioralScenarios: number;
  readonly relations: number;
  readonly lineageRecords: number;
  readonly tombstones: number;
  readonly governanceDocuments: number;
}

export interface SqliteSecurityPosture {
  readonly foreignKeysEnabled: boolean;
  readonly trustedSchemaDisabled: boolean;
  readonly defensiveModeEnabled: boolean;
  readonly integrity: string;
}

function payloadOf(document: CanonicalDocumentEnvelope): Record<string, unknown> {
  return document.payload;
}

function requiredString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string") throw new Error(`canonical payload field ${field} must be a string`);
  return value;
}

export class SqliteDerivedStore {
  private readonly database: DatabaseSync;

  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path, {
      allowExtension: false,
      defensive: true,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA trusted_schema = OFF;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
    `);
    migrateSqlite(this.database);
  }

  close(): void {
    this.database.close();
  }

  replaceCanonicalSnapshot(snapshot: CanonicalSnapshot): DerivedRevision {
    const computedDigest = hashRootManifest(snapshot.documents.map((document) => ({
      entityId: document.id,
      canonicalDocumentHash: document.canonicalDocumentHash,
    })));
    if (computedDigest !== snapshot.rootDigest) {
      throw new Error(`canonical snapshot root mismatch: expected ${computedDigest}, received ${snapshot.rootDigest}`);
    }
    const current = this.revisionNumber();
    const nextRevision = current + 1;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec(`
        DELETE FROM entities;
        DELETE FROM requirements;
        DELETE FROM behavioral_scenarios;
        DELETE FROM relations;
        DELETE FROM lineage_records;
        DELETE FROM tombstones;
        DELETE FROM governance_documents;
        DELETE FROM canonical_documents;
      `);
      for (const document of snapshot.documents) this.insertDocument(document, nextRevision);
      this.database.prepare(
        "UPDATE graph_state SET revision = ?, canonical_root_digest = ? WHERE singleton = 1",
      ).run(nextRevision, snapshot.rootDigest);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.revision();
  }

  applyCanonicalUpdate(document: CanonicalDocumentEnvelope, rootDigest: ContentHash): DerivedRevision {
    const nextRevision = this.revisionNumber() + 1;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.prepare("DELETE FROM canonical_documents WHERE id = ?").run(document.id);
      this.insertDocument(document, nextRevision);
      const computedDigest = this.indexedRootDigest();
      if (computedDigest !== rootDigest) {
        throw new Error(`canonical root mismatch: expected ${computedDigest}, received ${rootDigest}`);
      }
      this.database.prepare(
        "UPDATE graph_state SET revision = ?, canonical_root_digest = ? WHERE singleton = 1",
      ).run(nextRevision, rootDigest);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.revision();
  }

  applyCanonicalDelete(id: string, rootDigest: ContentHash): DerivedRevision {
    const nextRevision = this.revisionNumber() + 1;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database.prepare("DELETE FROM canonical_documents WHERE id = ?").run(id);
      if (result.changes !== 1) throw new Error(`canonical document ${id} is not indexed`);
      const computedDigest = this.indexedRootDigest();
      if (computedDigest !== rootDigest) {
        throw new Error(`canonical root mismatch: expected ${computedDigest}, received ${rootDigest}`);
      }
      this.database.prepare(
        "UPDATE graph_state SET revision = ?, canonical_root_digest = ? WHERE singleton = 1",
      ).run(nextRevision, rootDigest);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.revision();
  }

  revision(): DerivedRevision {
    const state = this.database.prepare(
      "SELECT revision, canonical_root_digest AS rootDigest FROM graph_state WHERE singleton = 1",
    ).get() as { revision: number; rootDigest: ContentHash | null } | undefined;
    if (state === undefined || state.rootDigest === null) throw new Error("state.db has not indexed a canonical snapshot");
    const count = this.database.prepare("SELECT COUNT(*) AS count FROM canonical_documents").get() as
      | { count: number }
      | undefined;
    return { revision: state.revision, rootDigest: state.rootDigest, documentCount: count?.count ?? 0 };
  }

  canonicalRows(): CanonicalIndexRow[] {
    return this.database.prepare(`
      SELECT
        id,
        kind,
        canonical_key AS canonicalKey,
        lifecycle,
        semantic_hash AS semanticHash,
        discovery_hash AS discoveryHash,
        canonical_document_hash AS canonicalDocumentHash,
        document_json AS documentJson,
        indexed_revision AS indexedRevision
      FROM canonical_documents
      ORDER BY id, canonical_document_hash
    `).all() as unknown as CanonicalIndexRow[];
  }

  relationCount(): number {
    const row = this.database.prepare("SELECT COUNT(*) AS count FROM relations").get() as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  }

  logicalCounts(): LogicalTableCounts {
    return this.database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM entities) AS entities,
        (SELECT COUNT(*) FROM requirements) AS requirements,
        (SELECT COUNT(*) FROM behavioral_scenarios) AS behavioralScenarios,
        (SELECT COUNT(*) FROM relations) AS relations,
        (SELECT COUNT(*) FROM lineage_records) AS lineageRecords,
        (SELECT COUNT(*) FROM tombstones) AS tombstones,
        (SELECT COUNT(*) FROM governance_documents) AS governanceDocuments
    `).get() as unknown as LogicalTableCounts;
  }

  securityPosture(): SqliteSecurityPosture {
    const foreignKeys = this.database.prepare("PRAGMA foreign_keys").get() as
      | { foreign_keys: number }
      | undefined;
    const trustedSchema = this.database.prepare("PRAGMA trusted_schema").get() as
      | { trusted_schema: number }
      | undefined;
    const integrity = this.database.prepare("PRAGMA integrity_check").get() as
      | { integrity_check: string }
      | undefined;
    this.database.exec("PRAGMA writable_schema = ON");
    const writableSchema = this.database.prepare("PRAGMA writable_schema").get() as
      | { writable_schema: number }
      | undefined;
    this.database.exec("PRAGMA writable_schema = OFF");
    return {
      foreignKeysEnabled: foreignKeys?.foreign_keys === 1,
      trustedSchemaDisabled: trustedSchema?.trusted_schema === 0,
      defensiveModeEnabled: writableSchema?.writable_schema === 0,
      integrity: integrity?.integrity_check ?? "unavailable",
    };
  }

  readCanonicalDocument(id: string): CanonicalDocumentEnvelope | undefined {
    const row = this.database.prepare("SELECT document_json AS documentJson FROM canonical_documents WHERE id = ?")
      .get(id) as { documentJson: string } | undefined;
    if (row === undefined) return undefined;
    const result = CanonicalDocumentEnvelopeSchema.safeParse(parseCanonicalJson(row.documentJson));
    if (!result.success) throw new Error(`corrupt canonical index row ${id}: ${result.error.message}`);
    return result.data as CanonicalDocumentEnvelope;
  }

  private revisionNumber(): number {
    const row = this.database.prepare("SELECT revision FROM graph_state WHERE singleton = 1").get() as
      | { revision: number }
      | undefined;
    if (row === undefined) throw new Error("state.db graph state is missing");
    return row.revision;
  }

  private indexedRootDigest(): ContentHash {
    const rows = this.database.prepare(`
      SELECT id, canonical_document_hash AS canonicalDocumentHash
      FROM canonical_documents
    `).all() as unknown as Array<{ id: string; canonicalDocumentHash: ContentHash }>;
    return hashRootManifest(rows.map((row) => ({
      entityId: row.id,
      canonicalDocumentHash: row.canonicalDocumentHash,
    })));
  }

  private insertDocument(document: CanonicalDocumentEnvelope, revision: number): void {
    const result = CanonicalDocumentEnvelopeSchema.safeParse(document);
    if (!result.success) throw new Error(`invalid canonical document ${document.id}: ${result.error.message}`);
    assertSupportedCanonicalVersions(document);
    this.database.prepare(`
      INSERT INTO canonical_documents(
        id, kind, canonical_key, lifecycle, semantic_hash, discovery_hash,
        canonical_document_hash, document_json, indexed_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      document.id,
      document.kind,
      document.key,
      document.lifecycle,
      document.semanticHash,
      document.discoveryHash ?? null,
      document.canonicalDocumentHash,
      canonicalJson(document),
      revision,
    );
    const payload = payloadOf(document);
    switch (document.kind) {
      case "concept":
        this.database.prepare("INSERT INTO entities(id, entity_kind, source_class, status) VALUES (?, ?, ?, ?)")
          .run(document.id, requiredString(payload, "kind"), requiredString(payload, "sourceClass"), requiredString(payload, "status"));
        break;
      case "requirement":
        this.database.prepare("INSERT INTO requirements(id, source_class, status) VALUES (?, ?, ?)")
          .run(document.id, requiredString(payload, "sourceClass"), requiredString(payload, "status"));
        break;
      case "behavioral-scenario":
        this.database.prepare("INSERT INTO behavioral_scenarios(id, source_class, status) VALUES (?, ?, ?)")
          .run(document.id, requiredString(payload, "sourceClass"), requiredString(payload, "status"));
        break;
      case "relation":
        this.database.prepare("INSERT INTO relations(id, from_id, to_id, relation_type, active) VALUES (?, ?, ?, ?, ?)")
          .run(
            document.id,
            requiredString(payload, "fromId"),
            requiredString(payload, "toId"),
            requiredString(payload, "type"),
            payload.active === true ? 1 : 0,
          );
        break;
      case "lineage":
        this.database.prepare("INSERT INTO lineage_records(id, lineage_kind) VALUES (?, ?)")
          .run(document.id, requiredString(payload, "kind"));
        break;
      case "tombstone":
        this.database.prepare("INSERT INTO tombstones(id, entity_id, deleted_at_revision) VALUES (?, ?, ?)")
          .run(document.id, requiredString(payload, "entityId"), payload.deletedAtRevision as number);
        break;
      default:
        this.database.prepare("INSERT INTO governance_documents(id, governance_kind) VALUES (?, ?)")
          .run(document.id, document.kind);
    }
  }
}
