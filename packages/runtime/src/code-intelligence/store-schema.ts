import { DatabaseSync } from "node:sqlite";

/** The public hashes stay textual; compact row keys are private to this database. */
const normalizedTables = `
  CREATE TABLE code_paths(path_id INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE) STRICT;
  CREATE TABLE code_identities(identity_id INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE) STRICT;
  CREATE TABLE code_provenances(provenance_id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE, provider TEXT NOT NULL, version TEXT NOT NULL, input_hash TEXT NOT NULL, artifact TEXT) STRICT;
  CREATE TABLE code_partitions(partition_id INTEGER PRIMARY KEY, digest TEXT NOT NULL UNIQUE, path_id INTEGER NOT NULL REFERENCES code_paths(path_id), input_hash TEXT NOT NULL, coverage_json TEXT NOT NULL) STRICT;
  CREATE TABLE code_manifest_partitions(generation TEXT NOT NULL REFERENCES code_manifests(generation), path TEXT NOT NULL, partition_id INTEGER NOT NULL REFERENCES code_partitions(partition_id), PRIMARY KEY(generation,path)) STRICT, WITHOUT ROWID;
  CREATE INDEX code_membership_partition ON code_manifest_partitions(generation,partition_id);
  CREATE TABLE code_symbols(
    partition_id INTEGER NOT NULL REFERENCES code_partitions(partition_id), id TEXT NOT NULL,
    identity_id INTEGER NOT NULL REFERENCES code_identities(identity_id), name TEXT NOT NULL, kind TEXT NOT NULL,
    definition_path_id INTEGER NOT NULL REFERENCES code_paths(path_id), definition_start INTEGER NOT NULL, definition_end INTEGER NOT NULL, definition_line INTEGER NOT NULL, definition_column INTEGER NOT NULL,
    extent_path_id INTEGER NOT NULL REFERENCES code_paths(path_id), extent_start INTEGER NOT NULL, extent_end INTEGER NOT NULL, extent_line INTEGER NOT NULL, extent_column INTEGER NOT NULL,
    type_display TEXT, declaration_hash TEXT NOT NULL, body_hash TEXT, provenance_id INTEGER NOT NULL REFERENCES code_provenances(provenance_id),
    PRIMARY KEY(partition_id,id)) STRICT, WITHOUT ROWID;
  CREATE INDEX code_symbols_identity ON code_symbols(identity_id,partition_id);
  CREATE INDEX code_symbols_path ON code_symbols(definition_path_id,id,partition_id);
  CREATE INDEX code_symbols_name ON code_symbols(name,id,partition_id);
  CREATE INDEX code_symbols_position ON code_symbols(definition_path_id,definition_start,definition_end,partition_id);
  CREATE TABLE code_edges(
    partition_id INTEGER NOT NULL REFERENCES code_partitions(partition_id), id TEXT NOT NULL, kind TEXT NOT NULL,
    source_path_id INTEGER NOT NULL REFERENCES code_paths(path_id), source_start INTEGER NOT NULL, source_end INTEGER NOT NULL, source_line INTEGER NOT NULL, source_column INTEGER NOT NULL,
    source_identity_id INTEGER REFERENCES code_identities(identity_id), target_identity_id INTEGER REFERENCES code_identities(identity_id), target_path_id INTEGER REFERENCES code_paths(path_id),
    resolution TEXT NOT NULL, provenance_id INTEGER NOT NULL REFERENCES code_provenances(provenance_id),
    PRIMARY KEY(partition_id,id)) STRICT, WITHOUT ROWID;
  CREATE INDEX code_edges_source_path ON code_edges(source_path_id,id,partition_id);
  CREATE INDEX code_edges_target_path ON code_edges(target_path_id,id,partition_id);
  CREATE INDEX code_edges_source_identity ON code_edges(source_identity_id,kind,id,partition_id);
  CREATE INDEX code_edges_target_identity ON code_edges(target_identity_id,kind,id,partition_id);
`;

export function initializeNormalized(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE code_head(singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation TEXT NOT NULL);
    CREATE TABLE code_manifests(generation TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL) STRICT;
    CREATE TABLE code_writer_leases(scope TEXT PRIMARY KEY, token TEXT NOT NULL, expires_ms INTEGER NOT NULL) STRICT;
    CREATE TABLE code_generation_pins(generation TEXT NOT NULL REFERENCES code_manifests(generation), token TEXT NOT NULL, expires_ms INTEGER NOT NULL, PRIMARY KEY(generation,token)) STRICT, WITHOUT ROWID;
    CREATE TABLE code_retained_pins(generation TEXT NOT NULL REFERENCES code_manifests(generation), owner TEXT NOT NULL, PRIMARY KEY(generation,owner)) STRICT, WITHOUT ROWID;
    ${normalizedTables}
    CREATE TABLE code_stages(stage_id TEXT PRIMARY KEY, source_identity TEXT NOT NULL, lease_scope TEXT NOT NULL, lease_token TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE code_stage_contributions(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id), ordinal INTEGER NOT NULL, path TEXT NOT NULL, sort_key BLOB NOT NULL, value TEXT NOT NULL, PRIMARY KEY(stage_id,ordinal,path)) STRICT, WITHOUT ROWID;
    CREATE INDEX code_stage_contribution_order ON code_stage_contributions(stage_id,sort_key,ordinal);
    CREATE INDEX code_stage_contribution_path ON code_stage_contributions(stage_id,path);
    CREATE TABLE code_stage_versions(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id), path TEXT NOT NULL, sort_key BLOB NOT NULL, digest TEXT NOT NULL, partition_id INTEGER NOT NULL REFERENCES code_partitions(partition_id), PRIMARY KEY(stage_id,path)) STRICT, WITHOUT ROWID;
    CREATE INDEX code_stage_version_order ON code_stage_versions(stage_id,sort_key);
    PRAGMA user_version=4;
  `);
}

/** Existing v3 databases gain staging without changing their public fact version. */
export function ensureStageSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_stages(stage_id TEXT PRIMARY KEY, source_identity TEXT NOT NULL, lease_scope TEXT NOT NULL, lease_token TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS code_stage_partitions(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id), path TEXT NOT NULL, sort_key BLOB NOT NULL, digest TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(stage_id,path)) STRICT, WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS code_stage_order ON code_stage_partitions(stage_id,sort_key);
    CREATE TABLE IF NOT EXISTS code_stage_contributions(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id), ordinal INTEGER NOT NULL, path TEXT NOT NULL, sort_key BLOB NOT NULL, value TEXT NOT NULL, PRIMARY KEY(stage_id,ordinal,path)) STRICT, WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS code_stage_contribution_order ON code_stage_contributions(stage_id,sort_key,ordinal);
    CREATE INDEX IF NOT EXISTS code_stage_contribution_path ON code_stage_contributions(stage_id,path);
    CREATE TABLE IF NOT EXISTS code_stage_symbols(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id), id TEXT NOT NULL, path TEXT NOT NULL, definition_json TEXT NOT NULL, PRIMARY KEY(stage_id,id,path)) STRICT, WITHOUT ROWID;
  `);
  const stageColumns = db.prepare("PRAGMA table_info(code_stages)").all() as { name: string }[];
  if (!stageColumns.some(({ name }) => name === "dirty")) {
    db.exec("ALTER TABLE code_stages ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0");
  }
}

/** Keep legacy stage rows intact: an already-open v3 worker may still own them. */
export function migrateStageVersions(db: DatabaseSync): void {
  ensureStageSchema(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_stage_versions(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id), path TEXT NOT NULL, sort_key BLOB NOT NULL, digest TEXT NOT NULL, partition_id INTEGER NOT NULL REFERENCES code_partitions(partition_id), PRIMARY KEY(stage_id,path)) STRICT, WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS code_stage_version_order ON code_stage_versions(stage_id,sort_key);
    PRAGMA user_version=4;
  `);
}

/** Upgrade all retained generations in one SQLite transaction; callers own BEGIN/COMMIT. */
export function migrateNormalized(db: DatabaseSync): void {
  const counts = db.prepare("SELECT (SELECT count(*) FROM code_symbols) AS symbols, (SELECT count(*) FROM code_edges) AS edges, (SELECT count(*) FROM code_partitions) AS partitions, (SELECT count(*) FROM code_manifest_partitions) AS memberships").get() as Record<string, number>;
  db.exec(`
    ALTER TABLE code_manifest_partitions RENAME TO code_manifest_partitions_old;
    ALTER TABLE code_symbols RENAME TO code_symbols_old;
    ALTER TABLE code_edges RENAME TO code_edges_old;
    ALTER TABLE code_partitions RENAME TO code_partitions_old;
    DROP INDEX IF EXISTS code_symbols_id;
    DROP INDEX IF EXISTS code_symbols_path;
    DROP INDEX IF EXISTS code_symbols_name;
    DROP INDEX IF EXISTS code_symbols_position;
    DROP INDEX IF EXISTS code_edges_target;
    DROP INDEX IF EXISTS code_edges_source;
    DROP INDEX IF EXISTS code_edges_source_symbol;
    DROP INDEX IF EXISTS code_edges_target_path;
    ${normalizedTables}
    INSERT INTO code_paths(path)
      SELECT path FROM code_partitions_old
      UNION SELECT path FROM code_symbols_old
      UNION SELECT json_extract(value,'$.extent.path') FROM code_symbols_old
      UNION SELECT source_path FROM code_edges_old
      UNION SELECT target_path FROM code_edges_old WHERE target_path IS NOT NULL;
    INSERT INTO code_identities(id)
      SELECT id FROM code_symbols_old
      UNION SELECT source_symbol FROM code_edges_old WHERE source_symbol IS NOT NULL
      UNION SELECT target_symbol FROM code_edges_old WHERE target_symbol IS NOT NULL;
    INSERT INTO code_provenances(value,provider,version,input_hash,artifact)
      SELECT value,json_extract(value,'$.provider'),json_extract(value,'$.version'),json_extract(value,'$.inputHash'),json_extract(value,'$.artifact')
      FROM (SELECT DISTINCT json_extract(value,'$.provenance') AS value FROM code_symbols_old
            UNION SELECT DISTINCT json_extract(value,'$.provenance') FROM code_edges_old);
    INSERT INTO code_partitions(digest,path_id,input_hash,coverage_json)
      SELECT digest,(SELECT path_id FROM code_paths WHERE path=p.path),input_hash,coverage_json FROM code_partitions_old p;
    INSERT INTO code_manifest_partitions(generation,path,partition_id)
      SELECT generation,m.path,(SELECT partition_id FROM code_partitions WHERE digest=m.digest) FROM code_manifest_partitions_old m;
    INSERT INTO code_symbols(partition_id,id,identity_id,name,kind,definition_path_id,definition_start,definition_end,definition_line,definition_column,extent_path_id,extent_start,extent_end,extent_line,extent_column,type_display,declaration_hash,body_hash,provenance_id)
      SELECT (SELECT partition_id FROM code_partitions WHERE digest=s.digest),s.id,(SELECT identity_id FROM code_identities WHERE id=s.id),s.name,json_extract(s.value,'$.kind'),
        (SELECT path_id FROM code_paths WHERE path=s.path),s.start_offset,s.end_offset,json_extract(s.value,'$.definition.line'),json_extract(s.value,'$.definition.column'),
        (SELECT path_id FROM code_paths WHERE path=json_extract(s.value,'$.extent.path')),json_extract(s.value,'$.extent.start'),s.extent_end,json_extract(s.value,'$.extent.line'),json_extract(s.value,'$.extent.column'),
        json_extract(s.value,'$.typeDisplay'),json_extract(s.value,'$.declarationHash'),json_extract(s.value,'$.bodyHash'),
        (SELECT provenance_id FROM code_provenances WHERE value=json_extract(s.value,'$.provenance')) FROM code_symbols_old s;
    INSERT INTO code_edges(partition_id,id,kind,source_path_id,source_start,source_end,source_line,source_column,source_identity_id,target_identity_id,target_path_id,resolution,provenance_id)
      SELECT (SELECT partition_id FROM code_partitions WHERE digest=e.digest),e.id,e.kind,(SELECT path_id FROM code_paths WHERE path=e.source_path),
        json_extract(e.value,'$.source.start'),json_extract(e.value,'$.source.end'),json_extract(e.value,'$.source.line'),json_extract(e.value,'$.source.column'),
        (SELECT identity_id FROM code_identities WHERE id=e.source_symbol),(SELECT identity_id FROM code_identities WHERE id=e.target_symbol),
        (SELECT path_id FROM code_paths WHERE path=e.target_path),json_extract(e.value,'$.resolution'),
        (SELECT provenance_id FROM code_provenances WHERE value=json_extract(e.value,'$.provenance')) FROM code_edges_old e;
  `);
  const next = db.prepare("SELECT (SELECT count(*) FROM code_symbols) AS symbols, (SELECT count(*) FROM code_edges) AS edges, (SELECT count(*) FROM code_partitions) AS partitions, (SELECT count(*) FROM code_manifest_partitions) AS memberships").get() as Record<string, number>;
  if (Object.keys(counts).some((key) => counts[key] !== next[key]))
    throw new Error("Code fact row count changed during schema migration");
  db.exec(`
    DROP TABLE code_manifest_partitions_old;
    DROP TABLE code_symbols_old;
    DROP TABLE code_edges_old;
    DROP TABLE code_partitions_old;
  `);
  if (db.prepare("PRAGMA foreign_key_check").get() !== undefined)
    throw new Error("Code index foreign key check failed during schema migration");
  db.exec("PRAGMA user_version=3");
}
