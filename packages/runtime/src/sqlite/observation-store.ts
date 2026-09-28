import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { threadId } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { canonicalJson, ObservationBudget, ObservationError } from "@projector/core";
import { DERIVED_CACHE_MAX_BYTES } from "../cache/derived-cache.js";
import { RepositoryPathService } from "../security/repository-path.js";
import { checkoutCacheLocation } from "../cache/location.js";

export interface IndexedObservationHead {
  readonly generation: number;
  readonly contract: string;
  readonly metadata: unknown;
}
export interface IndexedObservationDelta {
  readonly rebuild?: boolean;
  readonly upserts?: readonly { readonly kind: string; readonly key: string; readonly value: unknown }[];
  readonly deletes?: readonly { readonly kind: string; readonly key: string }[];
  readonly populations?: readonly { readonly selector: string; readonly member: string; readonly present: boolean }[];
  readonly dependencies?: readonly { readonly consumer: string; readonly input: string; readonly present: boolean }[];
}
export interface IndexedObservationOptions { readonly budget?: ObservationBudget; readonly signal?: AbortSignal; readonly maxBytes?: number; }
interface HeadRow { generation: number; contract: string; metadata: string; bytes: number; }
const recordDigest = (value:string):string => createHash("sha256").update(value).digest("hex");

/** Disposable exact observations and registered dependency indexes, never canonical meaning.
 * Publication holds one SQLite transaction; a failed collector cannot advance the head.
 * Readers select addressed rows rather than deserialize an entire repository generation.
 */
export class SqliteObservationStore {
  private readonly database: DatabaseSync;
  private readonly maximum: number;
  private closed=false;
  readonly metrics = { rowsRead: 0, rowsWritten: 0, bytesRead: 0, bytesWritten: 0 };
  /** Resolve the database and SQLite sidecars through the checkout's existing path boundary. */
  static async open(repositoryRoot: string, options: IndexedObservationOptions = {}): Promise<SqliteObservationStore> {
    options.signal?.throwIfAborted(); options.budget?.check("observation-index-path");
    const location = await checkoutCacheLocation(repositoryRoot);
    const paths = await RepositoryPathService.create(location.cacheRoot);
    const relative = ".projector/runtime/observations/index.sqlite";
    const database = await paths.resolveWrite(relative);
    for (const suffix of ["-wal", "-shm", "-journal"]) await paths.resolveWrite(`${relative}${suffix}`);
    options.signal?.throwIfAborted(); options.budget?.check("observation-index-path");
    return new SqliteObservationStore(database.realTarget, options);
  }
  constructor(readonly path: string, private readonly options: IndexedObservationOptions = {}) {
    this.maximum = options.maxBytes ?? DERIVED_CACHE_MAX_BYTES;
    if (!Number.isSafeInteger(this.maximum) || this.maximum < 1 || this.maximum > DERIVED_CACHE_MAX_BYTES) throw new RangeError("Invalid observation cache capacity");
    this.check();
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path, { allowExtension: false, defensive: true, enableDoubleQuotedStringLiterals: false, enableForeignKeyConstraints: true, timeout: Math.min(5000, options.budget?.remainingMs() ?? 5000) });
    try {
      this.database.exec("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
      // Rollback journals cannot accumulate behind historical readers. Reserve
      // one full database copy for a transaction's journal under the shared cap.
      const pageSize = this.database.prepare("PRAGMA page_size").get() as { page_size: number };
      this.database.exec(`PRAGMA max_page_count=${Math.floor(DERIVED_CACHE_MAX_BYTES / (2 * pageSize.page_size))};`);
      const version = this.database.prepare("PRAGMA user_version").get() as { user_version: number };
      if (version.user_version !== 0 && version.user_version !== 1) throw new Error("Observation index version is unsupported; rebuild the disposable observation cache");
      if (version.user_version === 0) {
        this.database.exec("BEGIN IMMEDIATE");
        try {
          const currentVersion = this.database.prepare("PRAGMA user_version").get() as { user_version:number };
          if (currentVersion.user_version === 0) this.database.exec(`
        CREATE TABLE observation_head(singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation INTEGER NOT NULL, contract TEXT NOT NULL, metadata TEXT NOT NULL, bytes INTEGER NOT NULL) STRICT;
        CREATE TABLE observation_records(kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY(kind,key)) STRICT, WITHOUT ROWID;
        CREATE TABLE observation_populations(selector TEXT NOT NULL, member TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY(selector,member)) STRICT, WITHOUT ROWID;
        CREATE TABLE observation_dependencies(consumer TEXT NOT NULL, input TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY(consumer,input)) STRICT, WITHOUT ROWID;
        CREATE INDEX observation_dependency_input ON observation_dependencies(input,consumer);
        CREATE TABLE observation_accounting(singleton INTEGER PRIMARY KEY CHECK(singleton=1), bytes INTEGER NOT NULL CHECK(bytes>=0)) STRICT;
        INSERT INTO observation_accounting VALUES(1,0);
        PRAGMA user_version=1;
      `);
          else if (currentVersion.user_version !== 1) throw new Error("Observation index version is unsupported; rebuild the disposable observation cache");
          this.database.exec("COMMIT");
        } catch(error) { this.database.exec("ROLLBACK");throw error; }
      }
      const installedColumns = this.database.prepare("PRAGMA table_info(observation_records)").all();
      if (!["value_hash", "cache_content_bytes", "cache_last_used"].every((name) => installedColumns.some((column) => column.name === name))) {
        this.database.exec("BEGIN IMMEDIATE");
        try {
        const columns = this.database.prepare("PRAGMA table_info(observation_records)").all();
        if (!columns.some((column) => column.name === "value_hash")) this.database.exec("ALTER TABLE observation_records ADD COLUMN value_hash TEXT;");
        if (!columns.some((column) => column.name === "cache_content_bytes")) this.database.exec("ALTER TABLE observation_records ADD COLUMN cache_content_bytes INTEGER;");
        if (!columns.some((column) => column.name === "cache_last_used")) this.database.exec("ALTER TABLE observation_records ADD COLUMN cache_last_used INTEGER;");
        this.database.exec("COMMIT");
        } catch(error) { this.database.exec("ROLLBACK");throw error; }
      }
      this.check();
    } catch (error) { this.database.close(); throw error; }
  }
  close(): void {
    if(this.closed)return;this.database.close();this.closed=true;
    const sink=process.env.PROJECTOR_OBSERVATION_METRICS_FILE;
    if(sink!==undefined){if(!isAbsolute(sink))throw new Error("Observation metrics evidence sink must be an absolute host-selected path");appendFileSync(sink,JSON.stringify({kind:"observation-addressed-record-metrics",pid:process.pid,threadId,...this.metrics})+"\n","utf8");}
  }
  private check(): void { this.options.signal?.throwIfAborted(); this.options.budget?.check("observation-index"); }
  private assertRecordBytes(bytes:number,key:string):void { const limit=this.options.budget?.limits.maxDerivedBytes??DERIVED_CACHE_MAX_BYTES; if(bytes>limit)throw new ObservationError("observation-limit-exceeded","observation-index-record",key,"Indexed derived record exceeds the declared derived memory limit","maxDerivedBytes",bytes); }
  private encoded(value: unknown): string { const encoded = canonicalJson(value); this.assertRecordBytes(Buffer.byteLength(encoded), "observation-index-record"); return encoded; }
  head(): IndexedObservationHead | undefined {
    this.check();
    const row = this.database.prepare("SELECT generation,contract,metadata,bytes FROM observation_head WHERE singleton=1").get() as HeadRow | undefined;
    if (row === undefined) return undefined;
    this.metrics.rowsRead++; this.metrics.bytesRead += Buffer.byteLength(row.metadata);
    return { generation: row.generation, contract: row.contract, metadata: JSON.parse(row.metadata) as unknown };
  }
  get<T = unknown>(kind: string, key: string): T | undefined {
    this.check();
    const limit = this.options.budget?.limits.maxDerivedBytes ?? DERIVED_CACHE_MAX_BYTES;
    const row = this.database.prepare("SELECT length(CAST(value AS BLOB)) AS bytes, CASE WHEN length(CAST(value AS BLOB))<=? THEN value END AS value FROM observation_records WHERE kind=? AND key=?").get(limit,kind,key) as { bytes:number; value:string | null } | undefined;
    if (row === undefined) return undefined;
    this.assertRecordBytes(row.bytes, key);
    if (row.value === null) throw new Error("Indexed record size changed during bounded read");
    this.metrics.rowsRead++; this.metrics.bytesRead += row.bytes;
    return JSON.parse(row.value) as T;
  }
  has(kind: string, key: string): boolean { this.check(); return this.database.prepare("SELECT 1 FROM observation_records WHERE kind=? AND key=?").get(kind,key) !== undefined; }
  verifyGeneration(generation: number): void { if (this.head()?.generation !== generation) throw new Error("Observation generation changed during indexed computation; retry from the completed generation"); }
  getAt<T = unknown>(generation: number, kind: string, key: string): T | undefined { return this.readGeneration(generation, () => this.get<T>(kind,key)); }
  populationAt(generation: number, selector: string): string[] { return this.readGeneration(generation, () => this.population(selector)); }
  dependentsAt(generation: number, input: string): string[] { return this.readGeneration(generation, () => this.dependents(input)); }
  get totalBytes(): number { this.check(); return (this.database.prepare("SELECT bytes FROM observation_accounting WHERE singleton=1").get() as { bytes:number }).bytes; }
  cacheEntries(): readonly { key: string; bytes: number; valueHash: string; lastUsedMs: number }[] {
    this.check(); const result: { key:string; bytes:number; valueHash:string; lastUsedMs:number }[] = [];
    const limit = this.options.budget?.limits.maxDerivedBytes ?? DERIVED_CACHE_MAX_BYTES;
    for (const row of this.database.prepare("SELECT key,CASE WHEN cache_content_bytes IS NULL THEN CASE WHEN length(CAST(value AS BLOB))<=? THEN length(CAST(json_extract(value,'$.content') AS BLOB)) END ELSE cache_content_bytes END AS content_bytes,CASE WHEN cache_last_used IS NULL THEN CASE WHEN length(CAST(value AS BLOB))<=? THEN json_extract(value,'$.lastUsedMs') END ELSE cache_last_used END AS last_used,value_hash,CASE WHEN value_hash IS NULL OR cache_content_bytes IS NULL OR cache_last_used IS NULL THEN length(CAST(value AS BLOB)) END AS legacy_bytes,CASE WHEN value_hash IS NULL AND length(CAST(value AS BLOB))<=? THEN value END AS legacy_value FROM observation_records WHERE kind='cache-source' ORDER BY key").iterate(limit,limit,limit)) {
      this.check(); this.options.budget?.consume("maxFiles",1,"cache-maintenance");
      if(row.legacy_bytes!==null)this.assertRecordBytes(Number(row.legacy_bytes),String(row.key));
      if(typeof row.content_bytes!=="number"||typeof row.last_used!=="number")throw new Error("Disposable cache metadata is invalid; no unproven entries may be removed");
      // Legacy rows retain their evidence. Their compatibility digest read is bounded;
      // ordinary metadata enumeration never transfers cached content to Node.
      result.push({ key:String(row.key), bytes:row.content_bytes,lastUsedMs:row.last_used,valueHash:row.value_hash===null?recordDigest(String(row.legacy_value)):String(row.value_hash) });
    }
    return result;
  }
  /** All addressed reads in body see one completed generation, even if another process publishes. */
  readGeneration<T>(generation: number, body: (store: SqliteObservationStore) => T): T {
    this.check(); this.database.exec("BEGIN");
    try {
      if (this.head()?.generation !== generation) throw new Error("Observation generation changed before indexed reads; retry from the completed generation");
      const result = body(this);
      if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) throw new TypeError("Indexed generation reads must finish synchronously before releasing their snapshot");
      this.check(); this.database.exec("COMMIT"); return result;
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  population(selector: string): string[] { return this.select("SELECT member AS value FROM observation_populations WHERE selector=? ORDER BY member", selector); }
  dependents(input: string): string[] { return this.select("SELECT consumer AS value FROM observation_dependencies WHERE input=? ORDER BY consumer", input); }
  private select(sql: string, key: string): string[] {
    this.check(); const result: string[] = [];
    for (const row of this.database.prepare(sql).iterate(key)) {
      this.check(); const value = String(row.value); this.options.budget?.consume("maxFiles", 1, "observation-index-query", key);
      this.metrics.rowsRead++; this.metrics.bytesRead += Buffer.byteLength(value); result.push(value);
    }
    return result;
  }
  /** expectedGeneration is a compare-and-swap lease, not authority to mutate authored files. */
  publish(expectedGeneration: number | null, next: Omit<IndexedObservationHead,"generation">, delta: IndexedObservationDelta,
    options: { readonly signal?: AbortSignal; readonly retainGeneration?: boolean; readonly preserveMetadata?: boolean; readonly assertions?: readonly { readonly kind: string; readonly key: string; readonly expected?: unknown; readonly expectedHash?: string }[] } = {}): IndexedObservationHead {
    this.check(); options.signal?.throwIfAborted();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.database.prepare("SELECT generation,bytes FROM observation_head WHERE singleton=1").get() as { generation: number; bytes: number } | undefined;
      if ((previous?.generation ?? null) !== expectedGeneration) throw new Error("Observation generation changed during collection; retry from the completed generation");
      if(options.preserveMetadata===true){if(options.retainGeneration!==true)throw new Error("Metadata preservation requires a cache-only retained generation");const current=this.head();if(current!==undefined)next=current;}
      // Cache mutations retain the source generation. Their addressed read leases
      // must therefore be checked under the same writer transaction as mutation.
      for (const assertion of options.assertions ?? []) {
        const size = this.database.prepare("SELECT length(CAST(value AS BLOB)) AS bytes FROM observation_records WHERE kind=? AND key=?").get(assertion.kind,assertion.key) as {bytes:number}|undefined;
        let matches:boolean;
        if(assertion.expectedHash !== undefined) {
          const hash = createHash("sha256");
          const chunkBytes = Math.min(64 * 1024,this.options.budget?.limits.maxDerivedBytes ?? DERIVED_CACHE_MAX_BYTES);
          if(chunkBytes < 1)throw new Error("Indexed digest read requires a positive derived-data allowance");
          if(size !== undefined)for(let offset=1;offset<=size.bytes;offset+=chunkBytes) {
            this.check();options.signal?.throwIfAborted();
            const chunk = this.database.prepare("SELECT substr(CAST(value AS BLOB),?,?) AS value FROM observation_records WHERE kind=? AND key=?").get(offset,chunkBytes,assertion.kind,assertion.key) as {value:Uint8Array};
            hash.update(chunk.value);this.metrics.rowsRead++;this.metrics.bytesRead+=chunk.value.byteLength;
          }
          matches=size !== undefined && hash.digest("hex") === assertion.expectedHash;
        } else {
          if(size !== undefined)this.assertRecordBytes(size.bytes,assertion.key);
          const row = this.database.prepare("SELECT value FROM observation_records WHERE kind=? AND key=?").get(assertion.kind, assertion.key) as { value: string } | undefined;
          matches=row?.value === (assertion.expected === undefined ? undefined : this.encoded(assertion.expected));
        }
        if (!matches) throw Object.assign(new Error("Observation record changed after inspection; retry the addressed cache operation"), { code: "observation-record-changed" });
      }
      const accounting = this.database.prepare("SELECT bytes FROM observation_accounting WHERE singleton=1").get() as { bytes: number };
      let bytes = accounting.bytes;
      const check = (): void => { this.check(); options.signal?.throwIfAborted(); if (bytes > this.maximum) throw new ObservationError("observation-limit-exceeded", "observation-index-capacity", ".", "Completed observation exceeds the disposable cache capacity; prior generation remains unchanged", "maxDerivedBytes", bytes); };
      if(delta.rebuild===true){
        this.database.exec("DELETE FROM observation_records WHERE kind!='cache-source'; DELETE FROM observation_populations; DELETE FROM observation_dependencies;");
        bytes=(this.database.prepare("SELECT COALESCE(SUM(bytes),0) AS bytes FROM observation_records").get() as {bytes:number}).bytes+(previous?.bytes??0);
      }
      for (const record of delta.deletes ?? []) {
        check(); const existing = this.database.prepare("SELECT bytes FROM observation_records WHERE kind=? AND key=?").get(record.kind,record.key) as { bytes: number } | undefined;
        this.database.prepare("DELETE FROM observation_records WHERE kind=? AND key=?").run(record.kind,record.key); bytes -= existing?.bytes ?? 0; this.metrics.rowsWritten++;
      }
      for (const record of delta.upserts ?? []) {
        check(); const value = this.encoded(record.value), digest = record.kind === "cache-source" ? recordDigest(value) : null;
        let contentBytes:number|null=null, lastUsed:number|null=null;
        if(record.kind === "cache-source") {
          if(typeof record.value !== "object" || record.value === null || !("content" in record.value) || typeof record.value.content !== "string" || !("lastUsedMs" in record.value) || !Number.isSafeInteger(record.value.lastUsedMs))throw new Error("Disposable cache source metadata is invalid");
          contentBytes=Buffer.byteLength(record.value.content);lastUsed=record.value.lastUsedMs as number;
        }
        const size = Buffer.byteLength(record.kind)+Buffer.byteLength(record.key)+Buffer.byteLength(value)+64+(digest === null ? 0 : 80);
        const existing = this.database.prepare("SELECT bytes FROM observation_records WHERE kind=? AND key=?").get(record.kind,record.key) as { bytes: number } | undefined;
        bytes += size-(existing?.bytes ?? 0); check();
        this.database.prepare("INSERT INTO observation_records(kind,key,value,bytes,value_hash,cache_content_bytes,cache_last_used) VALUES(?,?,?,?,?,?,?) ON CONFLICT(kind,key) DO UPDATE SET value=excluded.value,bytes=excluded.bytes,value_hash=excluded.value_hash,cache_content_bytes=excluded.cache_content_bytes,cache_last_used=excluded.cache_last_used").run(record.kind,record.key,value,size,digest,contentBytes,lastUsed);
        this.metrics.rowsWritten++; this.metrics.bytesWritten += size;
      }
      for (const [table, left, right, changes] of [
        ["observation_populations","selector","member", (delta.populations ?? []).map((item) => ({ a:item.selector,b:item.member,present:item.present }))],
        ["observation_dependencies","consumer","input", (delta.dependencies ?? []).map((item) => ({ a:item.consumer,b:item.input,present:item.present }))],
      ] as const) for (const item of changes) {
        check(); const existing = this.database.prepare(`SELECT bytes FROM ${table} WHERE ${left}=? AND ${right}=?`).get(item.a,item.b) as { bytes: number } | undefined;
        const size = Buffer.byteLength(item.a)+Buffer.byteLength(item.b)+64;
        bytes += (item.present ? size : 0)-(existing?.bytes ?? 0); check();
        if (item.present) this.database.prepare(`INSERT INTO ${table} VALUES(?,?,?) ON CONFLICT(${left},${right}) DO UPDATE SET bytes=excluded.bytes`).run(item.a,item.b,size);
        else this.database.prepare(`DELETE FROM ${table} WHERE ${left}=? AND ${right}=?`).run(item.a,item.b);
        this.metrics.rowsWritten++;
      }
      const metadata = this.encoded(next.metadata), headBytes = Buffer.byteLength(metadata)+Buffer.byteLength(next.contract)+64;
      bytes += headBytes-(previous?.bytes ?? 0); check();
      const generation = (previous?.generation ?? 0)+(options.retainGeneration === true ? 0 : 1);
      if (!Number.isSafeInteger(generation)) throw new Error("Observation generation counter exhausted; rebuild the disposable observation cache");
      this.database.prepare("INSERT INTO observation_head VALUES(1,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET generation=excluded.generation,contract=excluded.contract,metadata=excluded.metadata,bytes=excluded.bytes").run(generation,next.contract,metadata,headBytes);
      this.database.prepare("UPDATE observation_accounting SET bytes=? WHERE singleton=1").run(bytes);
      check(); this.database.exec("COMMIT");
      return { generation, contract: next.contract, metadata: JSON.parse(metadata) as unknown };
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
}
