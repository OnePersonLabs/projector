import type { DatabaseSync } from "node:sqlite";

export const currentSqliteSchemaVersion = 1;

const migrationOne = `
  CREATE TABLE canonical_documents (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    canonical_key TEXT NOT NULL UNIQUE,
    lifecycle TEXT NOT NULL,
    semantic_hash TEXT NOT NULL,
    discovery_hash TEXT,
    canonical_document_hash TEXT NOT NULL,
    document_json TEXT NOT NULL,
    indexed_revision INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE entities (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    entity_kind TEXT NOT NULL,
    source_class TEXT NOT NULL,
    status TEXT NOT NULL
  ) STRICT;

  CREATE TABLE requirements (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    source_class TEXT NOT NULL,
    status TEXT NOT NULL
  ) STRICT;

  CREATE TABLE behavioral_scenarios (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    source_class TEXT NOT NULL,
    status TEXT NOT NULL
  ) STRICT;

  CREATE TABLE relations (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    active INTEGER NOT NULL CHECK (active IN (0, 1))
  ) STRICT;
  CREATE INDEX relations_from_id ON relations(from_id);
  CREATE INDEX relations_to_id ON relations(to_id);

  CREATE TABLE lineage_records (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    lineage_kind TEXT NOT NULL
  ) STRICT;

  CREATE TABLE tombstones (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    deleted_at_revision INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE governance_documents (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    governance_kind TEXT NOT NULL
  ) STRICT;

  CREATE TABLE graph_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    revision INTEGER NOT NULL,
    canonical_root_digest TEXT
  ) STRICT;
  INSERT INTO graph_state(singleton, revision, canonical_root_digest) VALUES (1, 0, NULL);
`;

export function migrateSqlite(database: DatabaseSync): void {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY) STRICT;`);
    const row = database.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as
      | { version: number }
      | undefined;
    const version = row?.version ?? 0;
    if (version > currentSqliteSchemaVersion) {
      throw new Error(`state.db schema version ${version} is newer than supported version ${currentSqliteSchemaVersion}`);
    }
    if (version === 0) {
      database.exec(migrationOne);
      database.prepare("INSERT INTO schema_migrations(version) VALUES (?)").run(1);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
