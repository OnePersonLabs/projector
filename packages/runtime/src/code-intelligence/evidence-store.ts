import { mkdirSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { CodeBridgeSchema, CodeRuntimeEvidenceSchema, DEFAULT_OBSERVATION_LIMITS, canonicalJson, type CodeRuntimeEvidence } from "@projector/core";
import { resolveDerivedCachePath } from "../cache/location.js";

export interface StoredCodeBridge {
  generation: string;
  sourceHashes: Record<string, string>;
  bridge: z.infer<typeof CodeBridgeSchema>;
}

const legacySchema = z.strictObject({
  evidence: z.array(CodeRuntimeEvidenceSchema),
  bridges: z.array(z.strictObject({
    generation: z.string(),
    sourceHashes: z.record(z.string(), z.string()),
    bridge: CodeBridgeSchema,
  })),
});

/** Addressable runtime observations. SQLite publication replaces only named IDs. */
export class SqliteCodeEvidenceStore {
  private readonly db: DatabaseSync;

  static async open(repositoryRoot: string, migrationAllowanceBytes: number | null): Promise<SqliteCodeEvidenceStore> {
    const path = await resolveDerivedCachePath(repositoryRoot, ".projector/runtime/code/evidence.sqlite");
    const legacyPath = await resolveDerivedCachePath(repositoryRoot, ".projector/runtime/code/evidence.json");
    const store = new SqliteCodeEvidenceStore(path);
    try {
      await store.migrateLegacy(legacyPath, migrationAllowanceBytes);
      return store;
    } catch (error) {
      store.close();
      throw error;
    }
  }

  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(toNamespacedPath(path), {
      allowExtension: false,
      defensive: true,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    try {
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
      const version = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
      if (version === 0) this.initializeSchema();
      else if (version !== 1) throw new Error("Unsupported code runtime evidence store version");
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private initializeSchema(): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const version = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
      if (version === 0) {
        this.db.exec(`
          CREATE TABLE evidence_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
          INSERT INTO evidence_meta(key,value) VALUES('revision','0');
          CREATE TABLE runtime_evidence(id TEXT PRIMARY KEY, generation TEXT NOT NULL, test_id TEXT NOT NULL, metadata_json TEXT NOT NULL) STRICT;
          CREATE TABLE runtime_source_hashes(evidence_id TEXT NOT NULL REFERENCES runtime_evidence(id) ON DELETE CASCADE, path TEXT NOT NULL, content_hash TEXT NOT NULL, PRIMARY KEY(evidence_id,path)) STRICT, WITHOUT ROWID;
          CREATE TABLE runtime_ranges(evidence_id TEXT NOT NULL REFERENCES runtime_evidence(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL, path TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL, PRIMARY KEY(evidence_id,ordinal)) STRICT, WITHOUT ROWID;
          CREATE INDEX runtime_ranges_path ON runtime_ranges(path,evidence_id);
          CREATE TABLE runtime_bridges(id TEXT PRIMARY KEY, generation TEXT NOT NULL, source_hashes_json TEXT NOT NULL, bridge_json TEXT NOT NULL) STRICT;
          PRAGMA user_version=1;
        `);
      } else if (version !== 1) throw new Error("Unsupported code runtime evidence store version");
      this.db.exec("COMMIT");
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }

  private rollbackAndRethrow(error: unknown): never {
    if (this.db.isTransaction) {
      try { this.db.exec("ROLLBACK"); }
      catch (rollbackError) { throw new AggregateError([error, rollbackError], "Evidence operation and rollback failed"); }
    }
    throw error;
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }

  private writeEvidence(evidence: CodeRuntimeEvidence): void {
    const { sourceHashes, ranges, ...metadata } = evidence;
    this.db.prepare("INSERT INTO runtime_evidence(id,generation,test_id,metadata_json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,test_id=excluded.test_id,metadata_json=excluded.metadata_json")
      .run(evidence.id, evidence.generation, evidence.testId, canonicalJson(metadata));
    this.db.prepare("DELETE FROM runtime_source_hashes WHERE evidence_id=?").run(evidence.id);
    this.db.prepare("DELETE FROM runtime_ranges WHERE evidence_id=?").run(evidence.id);
    const source = this.db.prepare("INSERT INTO runtime_source_hashes(evidence_id,path,content_hash) VALUES(?,?,?)");
    for (const [path, hash] of Object.entries(sourceHashes)) source.run(evidence.id, path, hash);
    const range = this.db.prepare("INSERT INTO runtime_ranges(evidence_id,ordinal,path,start_line,end_line) VALUES(?,?,?,?,?)");
    for (const [ordinal, item] of ranges.entries()) range.run(evidence.id, ordinal, item.path, item.startLine, item.endLine);
  }

  private writeBridge(item: StoredCodeBridge): void {
    this.db.prepare("INSERT INTO runtime_bridges(id,generation,source_hashes_json,bridge_json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,source_hashes_json=excluded.source_hashes_json,bridge_json=excluded.bridge_json")
      .run(item.bridge.id, item.generation, canonicalJson(item.sourceHashes), canonicalJson(item.bridge));
  }

  private async migrateLegacy(path: string, allowanceBytes: number | null): Promise<void> {
    if (this.db.prepare("SELECT 1 FROM evidence_meta WHERE key='legacy-migrated'").get() !== undefined) return;
    let bytes: Buffer | undefined;
    try {
      const size = (await stat(path)).size;
      if (allowanceBytes !== null && size > allowanceBytes) throw new Error(`Legacy code evidence needs ${size} bytes to migrate; increase the explicit maxDerivedBytes allowance and retry`);
      bytes = await readFile(path);
      if (allowanceBytes !== null && bytes.byteLength > allowanceBytes) throw new Error("Legacy code evidence changed during migration; increase maxDerivedBytes and retry");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const legacy = bytes === undefined ? undefined : legacySchema.parse(JSON.parse(bytes.toString("utf8")));
    this.transaction(() => {
      if (this.db.prepare("SELECT 1 FROM evidence_meta WHERE key='legacy-migrated'").get() !== undefined) return;
      for (const evidence of legacy?.evidence ?? []) this.writeEvidence(evidence);
      for (const bridge of legacy?.bridges ?? []) this.writeBridge(bridge);
      this.db.prepare("INSERT INTO evidence_meta(key,value) VALUES('legacy-migrated','1')").run();
      this.db.prepare("UPDATE evidence_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'").run();
    });
  }

  revision(): number {
    return Number((this.db.prepare("SELECT value FROM evidence_meta WHERE key='revision'").get() as { value: string }).value);
  }

  /** Bind revision checks and addressed evidence reads to one SQLite snapshot. */
  withReadSnapshot<T>(read: (revision: number) => T): T {
    this.db.exec("BEGIN DEFERRED");
    try {
      const result = read(this.revision());
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }

  generationFor(id: string): string | undefined {
    return (this.db.prepare("SELECT generation FROM runtime_evidence WHERE id=?").get(id) as { generation: string } | undefined)?.generation;
  }

  putEvidence(records: readonly CodeRuntimeEvidence[]): Map<string, string | undefined> {
    return this.transaction(() => {
      const previous = new Map<string, string | undefined>();
      for (const record of records) {
        previous.set(record.id, this.generationFor(record.id));
        this.writeEvidence(CodeRuntimeEvidenceSchema.parse(record));
      }
      if (records.length > 0) this.db.prepare("UPDATE evidence_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'").run();
      return previous;
    });
  }

  putBridges(records: readonly StoredCodeBridge[]): void {
    this.transaction(() => {
      for (const record of records) this.writeBridge(record);
      if (records.length > 0) this.db.prepare("UPDATE evidence_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'").run();
    });
  }

  *bridges(): IterableIterator<StoredCodeBridge> {
    for (const row of this.db.prepare("SELECT generation,source_hashes_json,bridge_json FROM runtime_bridges ORDER BY id").iterate() as IterableIterator<{ generation: string; source_hashes_json: string; bridge_json: string }>)
      yield {
        generation: row.generation,
        sourceHashes: JSON.parse(row.source_hashes_json) as Record<string, string>,
        bridge: CodeBridgeSchema.parse(JSON.parse(row.bridge_json)),
      };
  }

  evidencePage(paths: readonly string[], afterId: string | undefined, limit: number, maxReadBytes = DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes): { records: CodeRuntimeEvidence[]; nextId?: string } {
    if (paths.length === 0) return { records: [] };
    const placeholders = paths.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT DISTINCT evidence_id AS id FROM runtime_ranges WHERE path IN (${placeholders}) AND evidence_id>? ORDER BY id LIMIT ?`)
      .all(...paths, afterId ?? "", limit + 1) as { id: string }[];
    const records: CodeRuntimeEvidence[] = [];
    let consumed = 0;
    for (const { id } of rows.slice(0, limit)) {
      const row = this.db.prepare("SELECT metadata_json FROM runtime_evidence WHERE id=?").get(id) as { metadata_json: string };
      const sourceRows = this.db.prepare("SELECT path,content_hash FROM runtime_source_hashes WHERE evidence_id=? ORDER BY path").all(id) as { path: string; content_hash: string }[];
      const rangeRows = this.db.prepare("SELECT path,start_line,end_line FROM runtime_ranges WHERE evidence_id=? ORDER BY ordinal").all(id) as { path: string; start_line: number; end_line: number }[];
      const nextBytes = Buffer.byteLength(row.metadata_json) + sourceRows.reduce((total, item) => total + Buffer.byteLength(item.path) + Buffer.byteLength(item.content_hash) + 64, 0) + rangeRows.reduce((total, item) => total + Buffer.byteLength(item.path) + 64, 0);
      if (maxReadBytes !== null && consumed + nextBytes > maxReadBytes) {
        if (records.length === 0) throw new Error(`One code evidence record requires ${nextBytes} derived bytes; increase maxDerivedBytes and retry`);
        break;
      }
      consumed += nextBytes;
      records.push(CodeRuntimeEvidenceSchema.parse({
        ...JSON.parse(row.metadata_json),
        sourceHashes: Object.fromEntries(sourceRows.map((item) => [item.path, item.content_hash])),
        ranges: rangeRows.map((item) => ({ path: item.path, startLine: item.start_line, endLine: item.end_line })),
      }));
    }
    return { records, ...(rows.length > records.length ? { nextId: records.at(-1)!.id } : {}) };
  }

  close(): void { this.db.close(); }
}
