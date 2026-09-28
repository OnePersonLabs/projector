import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute, toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ObservationBudget, ObservationError, hashFramedDomain, type ContentHash, type SourceContentCaptureDescriptor, type SourceContentEntry } from "@projector/core";
import { beginSqliteWrite } from "./write-admission.js";
import { collectUnusedSourceVersions, SourceLifetimeReader } from "./observation-source-lifetime.js";

type EntryMetadata = Omit<SourceContentEntry, "content"> & { readonly contentBytes: number };
type VersionRow = { id: string; kind: string; content_hash: string; byte_count: number; sealed: number };

export function installObservationSourceSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS observation_source_versions(
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, content_hash TEXT NOT NULL,
      byte_count INTEGER NOT NULL CHECK(byte_count>=0), sealed INTEGER NOT NULL CHECK(sealed IN (0,1)),
      owner_capture TEXT NOT NULL
    ) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS observation_source_sealed_identity
      ON observation_source_versions(kind,content_hash,byte_count) WHERE sealed=1;
    CREATE TABLE IF NOT EXISTS observation_source_chunks(
      version_id TEXT NOT NULL REFERENCES observation_source_versions(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL, content BLOB NOT NULL,
      PRIMARY KEY(version_id,sequence)
    ) STRICT, WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS observation_source_captures(
      id TEXT PRIMARY KEY, complete INTEGER NOT NULL CHECK(complete IN (0,1))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS observation_source_capture_entries(
      capture_id TEXT NOT NULL REFERENCES observation_source_captures(id), path TEXT NOT NULL,
      version_id TEXT NOT NULL REFERENCES observation_source_versions(id), metadata TEXT NOT NULL,
      PRIMARY KEY(capture_id,path)
    ) STRICT, WITHOUT ROWID;
  `);
}

class FramedContentHasher {
  private readonly hash = createHash("sha256");
  private carry = Buffer.alloc(0);
  constructor(size: number) {
    const frame = (value: Uint8Array): void => {
    const length = Buffer.allocUnsafe(8);
    length.writeBigUInt64BE(BigInt(value.byteLength));
      this.hash.update(length).update(value);
    };
    frame(Buffer.from("projector\0sha256\0v1"));
    frame(Buffer.from("repository-artifact-content"));
    const length = Buffer.allocUnsafe(8);
    length.writeBigUInt64BE(4n * ((BigInt(size) + 2n) / 3n) + 2n);
    this.hash.update(length).update('"');
  }
  update(input: Uint8Array): void {
    const chunk = Buffer.from(input);
    const combined = this.carry.length === 0 ? chunk : Buffer.concat([this.carry, chunk]);
    const complete = combined.length - combined.length % 3;
    if (complete > 0) this.hash.update(combined.subarray(0, complete).toString("base64"));
    this.carry = Buffer.from(combined.subarray(complete));
  }
  digest(): ContentHash {
    if (this.carry.length > 0) this.hash.update(this.carry.toString("base64"));
    this.hash.update('"');
    return `sha256:v1:${this.hash.digest("hex")}` as ContentHash;
  }
}

/** A capture stores sealed, immutable versions in the observation WAL database. */
export class SqliteObservationSourceCapture {
  readonly descriptor: SourceContentCaptureDescriptor;
  private readonly db: DatabaseSync;
  private readonly lifetime: SourceLifetimeReader;
  private readonly pendingEntries = new Map<string, {metadata:EntryMetadata;versionId:string}>();
  private closed = false;
  private writable: boolean;

  private constructor(descriptor: SourceContentCaptureDescriptor, writable: boolean,lifetime:SourceLifetimeReader,
    private readonly budget?:ObservationBudget,private readonly signal?:AbortSignal) {
    if (!isAbsolute(descriptor.path)) { lifetime.close(); throw new TypeError("Source capture requires an absolute observation database path"); }
    this.descriptor = descriptor;
    this.writable = writable;
    this.lifetime = lifetime;
    try {
      this.db = new DatabaseSync(toNamespacedPath(descriptor.path), { readOnly: !writable, timeout: 5_000 });
    } catch (error) {
      this.lifetime.close();
      throw new Error(`Cannot open captured source database at ${descriptor.path}: ${error instanceof Error ? error.message : String(error)}`, {cause:error});
    }
    try {
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;");
      if (!writable) this.assertComplete();
    } catch (error) {
      this.db.close(); this.lifetime.close(); throw error;
    }
  }

  static async create(indexPath: string, budget?: ObservationBudget, signal?: AbortSignal): Promise<SqliteObservationSourceCapture> {
    if (!isAbsolute(indexPath)) throw new TypeError("Source capture requires an absolute observation database path");
    collectUnusedSourceVersions(indexPath);
    const lifetime=await SourceLifetimeReader.acquire(indexPath,budget,signal);
    const capture=new SqliteObservationSourceCapture({ schemaVersion: "projector.source-content/v2", path: indexPath, captureId: randomUUID() }, true,lifetime,budget,signal);
    try{
      await beginSqliteWrite(capture.db,{budget,signal,scope:"source-capture-create"});
      installObservationSourceSchema(capture.db);
      capture.db.prepare("INSERT INTO observation_source_captures(id,complete) VALUES(?,0)").run(capture.descriptor.captureId);
      capture.db.exec("COMMIT");
      return capture;
    }catch(error){if(capture.db.isTransaction)capture.db.exec("ROLLBACK");capture.close();throw error;}
  }
  static open(descriptor: SourceContentCaptureDescriptor): SqliteObservationSourceCapture {
    if (descriptor.schemaVersion !== "projector.source-content/v2") throw new Error("Unsupported source capture descriptor");
    if (!isAbsolute(descriptor.path)) throw new TypeError("Source capture requires an absolute observation database path");
    return new SqliteObservationSourceCapture(descriptor, false,new SourceLifetimeReader(descriptor.path));
  }
  async finish(): Promise<void> {
    this.assertOpen();
    if (this.writable) {
      await this.flushEntries();
      await beginSqliteWrite(this.db,{budget:this.budget,signal:this.signal,scope:"source-capture-finish"});
      try{
        this.db.prepare("UPDATE observation_source_captures SET complete=1 WHERE id=?").run(this.descriptor.captureId);
        this.db.exec("COMMIT");
      }catch(error){if(this.db.isTransaction)this.db.exec("ROLLBACK");throw error;}
      this.writable = false;
    }
  }
  async beginAppend(): Promise<void> {
    this.assertOpen();
    await beginSqliteWrite(this.db,{budget:this.budget,signal:this.signal,scope:"source-capture-append"});
    try{this.db.prepare("UPDATE observation_source_captures SET complete=0 WHERE id=?").run(this.descriptor.captureId);this.db.exec("COMMIT");}
    catch(error){if(this.db.isTransaction)this.db.exec("ROLLBACK");throw error;}
    this.writable = true;
  }
  close(): void {
    if (this.closed) return;
    try { this.db.close(); }
    finally {
      this.pendingEntries.clear();
      this.closed = true;
      this.lifetime.close();
      try { collectUnusedSourceVersions(this.descriptor.path); }
      catch (error) { console.warn(JSON.stringify({event:"source-version-collection-failed",path:this.descriptor.path,error:String(error)})); }
    }
  }
  /** The last lifetime owner collects mappings and unrooted versions. */
  async dispose(): Promise<void> {
    if (this.closed) return;
    if (this.db.isTransaction) throw new Error("Cannot dispose source capture during an active transaction");
    this.close();
  }
  private assertOpen(): void { if (this.closed) throw new Error("Source capture is closed"); }
  private assertWritable(): void {
    this.assertOpen();
    if (!this.writable) throw new Error("Source capture is sealed");
  }
  private assertComplete(): void {
    const row = this.db.prepare("SELECT complete FROM observation_source_captures WHERE id=?").get(this.descriptor.captureId) as { complete: number } | undefined;
    if (row?.complete !== 1) throw new Error("Source capture is missing or incomplete");
  }
  private link(metadata: EntryMetadata, versionId: string): SourceContentEntry {
    this.assertWritable();
    this.pendingEntries.set(metadata.path,{metadata,versionId});
    return this.entry(metadata, versionId);
  }
  private async flushEntries(): Promise<void> {
    const insert=this.db.prepare(`INSERT INTO observation_source_capture_entries(capture_id,path,version_id,metadata) VALUES(?,?,?,?)
      ON CONFLICT(capture_id,path) DO UPDATE SET version_id=excluded.version_id,metadata=excluded.metadata`);
    const entries=[...this.pendingEntries];
    for(let index=0;index<entries.length;index+=256){
      await beginSqliteWrite(this.db,{budget:this.budget,signal:this.signal,scope:"source-capture-map"});
      try{
        for(const [path,value] of entries.slice(index,index+256))
          insert.run(this.descriptor.captureId,path,value.versionId,JSON.stringify(value.metadata));
        this.db.exec("COMMIT");
      }catch(error){if(this.db.isTransaction)this.db.exec("ROLLBACK");throw error;}
    }
    this.pendingEntries.clear();
  }
  private async flushChunks(versionId:string, rows:readonly {sequence:number;bytes:Buffer}[],budget?:ObservationBudget,signal?:AbortSignal):Promise<void>{
    if(rows.length===0)return;
    const insert=this.db.prepare("INSERT INTO observation_source_chunks(version_id,sequence,content) VALUES(?,?,?)");
    await beginSqliteWrite(this.db,{budget:budget??this.budget,signal:signal??this.signal,scope:"source-capture-chunks"});
    try{
      for(const row of rows)insert.run(versionId,row.sequence,row.bytes);
      this.db.exec("COMMIT");
    }catch(error){if(this.db.isTransaction)this.db.exec("ROLLBACK");throw error;}
  }
  linkExisting(metadata: EntryMetadata, versionId: string): SourceContentEntry {
    const version = this.version(versionId);
    if (version.kind !== metadata.kind || version.content_hash !== metadata.contentHash || version.byte_count !== metadata.contentBytes)
      throw new Error(`Existing source version does not match ${metadata.path}`);
    return this.link(metadata, versionId);
  }
  private version(id: string): VersionRow {
    const row = this.db.prepare("SELECT id,kind,content_hash,byte_count,sealed FROM observation_source_versions WHERE id=?").get(id) as VersionRow | undefined;
    if (row?.sealed !== 1) throw new Error(`Source version is missing or incomplete: ${id}`);
    return row;
  }
  private async seal(metadata: EntryMetadata, versionId: string, budget?:ObservationBudget,signal?:AbortSignal): Promise<string> {
    await beginSqliteWrite(this.db,{budget:budget??this.budget,signal:signal??this.signal,scope:"source-capture-seal"});
    try {
      const bytes = this.db.prepare("SELECT COALESCE(SUM(length(content)),0) AS bytes FROM observation_source_chunks WHERE version_id=?").get(versionId) as { bytes: number };
      if (bytes.bytes !== metadata.contentBytes) throw new Error(`Captured source byte count changed: ${metadata.path}`);
      const existing = this.db.prepare("SELECT id FROM observation_source_versions WHERE kind=? AND content_hash=? AND byte_count=? AND sealed=1")
        .get(metadata.kind, metadata.contentHash, metadata.contentBytes) as { id: string } | undefined;
      if (existing !== undefined) {
        this.db.prepare("DELETE FROM observation_source_versions WHERE id=?").run(versionId);
        this.db.exec("COMMIT");
        return existing.id;
      }
      this.db.prepare("UPDATE observation_source_versions SET content_hash=?,byte_count=?,sealed=1 WHERE id=?")
        .run(metadata.contentHash, metadata.contentBytes, versionId);
      this.db.exec("COMMIT");
      return versionId;
    } catch (error) { if (this.db.isTransaction) this.db.exec("ROLLBACK"); throw error; }
  }
  private async createVersion(kind: SourceContentEntry["kind"],budget?:ObservationBudget,signal?:AbortSignal): Promise<string> {
    const id = randomUUID();
    await beginSqliteWrite(this.db,{budget:budget??this.budget,signal:signal??this.signal,scope:"source-capture-version"});
    try{
      this.db.prepare("INSERT INTO observation_source_versions(id,kind,content_hash,byte_count,sealed,owner_capture) VALUES(?,?,'',0,0,?)")
        .run(id, kind, this.descriptor.captureId);
      this.db.exec("COMMIT");
    }catch(error){if(this.db.isTransaction)this.db.exec("ROLLBACK");throw error;}
    return id;
  }
  put(metadata: EntryMetadata, content: string): Promise<SourceContentEntry> { return this.putChunks(metadata, [Buffer.from(content)]); }
  async putChunks(metadata: EntryMetadata, chunks: Iterable<Uint8Array>): Promise<SourceContentEntry> {
    this.assertWritable();
    const prior=this.prior(metadata.path);
    if(prior!==undefined&&prior.metadata.kind===metadata.kind&&prior.metadata.contentHash===metadata.contentHash&&
      prior.metadata.contentBytes===metadata.contentBytes&&prior.metadata.mediaType===metadata.mediaType&&
      prior.metadata.generated===metadata.generated)
      return this.linkExisting(metadata,prior.versionId);
    const versionId = await this.createVersion(metadata.kind);
    let sequence = 0, total = 0;
    const digest = metadata.kind === "file" ? new FramedContentHasher(metadata.contentBytes) : undefined;
    let symlink = "";
    const decoder = metadata.kind === "symlink" ? new TextDecoder() : undefined;
    let pendingBytes=0;
    let pendingRows:{sequence:number;bytes:Buffer}[]=[];
    for (const input of chunks) for (let offset = 0; offset < input.byteLength; offset += 64 * 1024) {
      const bytes = Buffer.from(input.subarray(offset, offset + 64 * 1024));
      pendingRows.push({sequence:sequence++,bytes});pendingBytes+=bytes.length;
      if(pendingBytes>=4*1024*1024){await this.flushChunks(versionId,pendingRows);pendingRows=[];pendingBytes=0;}
      digest?.update(bytes);
      if (decoder !== undefined) symlink += decoder.decode(bytes, {stream:true});
      total += bytes.byteLength;
    }
    await this.flushChunks(versionId,pendingRows);
    if (decoder !== undefined) symlink += decoder.decode();
    const hash = metadata.kind === "symlink"
      ? hashFramedDomain("repository-artifact-content", symlink)
      : digest!.digest();
    if (total !== metadata.contentBytes || hash !== metadata.contentHash)
      throw new Error(`Copied source version does not match ${metadata.path}`);
    return this.link(metadata, await this.seal(metadata, versionId));
  }
  private prior(path: string): { versionId: string; metadata: EntryMetadata } | undefined {
    const row = this.db.prepare("SELECT value FROM observation_records WHERE kind='inventory' AND key=?").get(path) as { value: string } | undefined;
    if (row === undefined) return undefined;
    const value = JSON.parse(row.value) as EntryMetadata & { _inventoryStorage?: string; sourceVersionId?: string; sourceCaptureId?: string };
    if (value._inventoryStorage !== "versions/v2" || value.sourceVersionId === undefined) return undefined;
    const { _inventoryStorage: _storage, sourceVersionId, sourceCaptureId: _captureId, ...metadata } = value;
    this.version(sourceVersionId);
    return { versionId: sourceVersionId, metadata };
  }
  async capture(path: string, absolute: string, mediaType: string, budget: ObservationBudget, signal?: AbortSignal): Promise<SourceContentEntry> {
    this.assertWritable();
    const prior = this.prior(path);
    if (prior !== undefined) {
      const observed = await this.readFile(path, absolute, mediaType, budget, signal);
      if (observed.metadata.contentHash === prior.metadata.contentHash && observed.metadata.generated === prior.metadata.generated &&
        observed.metadata.contentBytes === prior.metadata.contentBytes && observed.metadata.mediaType === prior.metadata.mediaType)
        return this.linkExisting(observed.metadata, prior.versionId);
      return this.writeFile(path, absolute, mediaType, budget, signal, observed.metadata.contentHash);
    }
    return this.writeFile(path, absolute, mediaType, budget, signal);
  }
  private async readFile(path: string, absolute: string, mediaType: string, budget: ObservationBudget, signal?: AbortSignal): Promise<{ metadata: EntryMetadata }> {
    const captured = await this.streamFile(path, absolute, mediaType, budget, signal);
    return { metadata: captured.metadata };
  }
  private async writeFile(path: string, absolute: string, mediaType: string, budget: ObservationBudget, signal?: AbortSignal, expectedHash?: ContentHash): Promise<SourceContentEntry> {
    const versionId = await this.createVersion("file",budget,signal);
    const captured = await this.streamFile(path, absolute, mediaType, budget, signal, versionId);
    if (expectedHash !== undefined && captured.metadata.contentHash !== expectedHash)
      throw new ObservationError("observation-failed", "inventory-capture", path, "Source changed between identity scan and capture");
    return this.link(captured.metadata, await this.seal(captured.metadata, versionId,budget,signal));
  }
  private async streamFile(path: string, absolute: string, mediaType: string, budget: ObservationBudget, signal?: AbortSignal, versionId?: string): Promise<{ metadata: EntryMetadata }> {
    const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const before = await handle.stat();
      if (!before.isFile()) throw new Error(`Inventory source is not a regular file: ${path}`);
      budget.assertFileBytes(before.size, path);
      budget.assertTotalBytes(before.size, path);
      let sequence = 0, total = 0, prefix = Buffer.alloc(0);
      const digest = new FramedContentHasher(before.size);
      let pendingBytes=0;
      let pendingRows:{sequence:number;bytes:Buffer}[]=[];
      const buffer = Buffer.allocUnsafe(64 * 1024);
      while (true) {
        signal?.throwIfAborted(); budget.check("inventory-capture", path);
        const { bytesRead } = await handle.read(buffer);
        if (bytesRead === 0) break;
        const bytes = Buffer.from(buffer.subarray(0, bytesRead));
        total += bytesRead;
        budget.assertFileBytes(total, path);
        budget.consume("maxTotalBytes", bytesRead, "inventory-capture", path);
        if (prefix.length < 4096) prefix = Buffer.concat([prefix, bytes.subarray(0, 4096 - prefix.length)]);
        if(versionId!==undefined){
          pendingRows.push({sequence:sequence++,bytes});pendingBytes+=bytes.length;
          if(pendingBytes>=4*1024*1024){await this.flushChunks(versionId,pendingRows,budget,signal);pendingRows=[];pendingBytes=0;}
        }
        digest.update(bytes);
      }
      if(versionId!==undefined)await this.flushChunks(versionId,pendingRows,budget,signal);
      const after = await handle.stat();
      if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.ino !== before.ino)
        throw new ObservationError("observation-failed", "inventory-capture", path, "Source changed while its observation was captured");
      const generated = /(?:@generated|generated file|do not edit)/iu.test(prefix.toString("utf8").slice(0, 1024));
      const metadata: EntryMetadata = { path, kind: "file", mediaType, contentHash: digest.digest(), generated,
        contentBytes: total, ...(generated ? { generatedReason: "source-marker" } : {}) };
      return { metadata };
    } finally { await handle.close(); }
  }
  private entry(metadata: EntryMetadata, versionId: string): SourceContentEntry {
    const { contentBytes, ...fields } = metadata;
    return Object.defineProperties(fields, {
      content: { enumerable: true, get: () => this.read(metadata.path) },
      contentBytes: { value: contentBytes },
      contentChunks: { value: () => this.chunks(metadata.path) },
      sourceVersionId: { value: versionId },
      sourceCaptureId: { value: this.descriptor.captureId },
    }) as SourceContentEntry;
  }
  entries(paths?: readonly string[]): SourceContentEntry[] {
    this.assertComplete();
    const selected = paths ?? [...this.db.prepare("SELECT path FROM observation_source_capture_entries WHERE capture_id=? ORDER BY path").iterate(this.descriptor.captureId)].map(row => String(row.path));
    return selected.map(path => {
      const row = this.db.prepare("SELECT version_id,metadata FROM observation_source_capture_entries WHERE capture_id=? AND path=?")
        .get(this.descriptor.captureId, path) as { version_id: string; metadata: string } | undefined;
      if (row === undefined) throw new Error(`Captured source entry is missing: ${path}`);
      this.version(row.version_id);
      return this.entry(JSON.parse(row.metadata) as EntryMetadata, row.version_id);
    });
  }
  read(path: string): string { return Buffer.concat([...this.chunks(path)].map(bytes => Buffer.from(bytes))).toString("utf8"); }
  *chunks(path: string): Generator<Uint8Array> {
    this.assertOpen();
    const ownsTransaction = !this.db.isTransaction;
    if (ownsTransaction) this.db.exec("BEGIN");
    let finished = false;
    try {
      this.assertComplete();
      const row = this.db.prepare("SELECT e.version_id,e.metadata FROM observation_source_capture_entries e WHERE e.capture_id=? AND e.path=?")
        .get(this.descriptor.captureId, path) as { version_id: string; metadata: string } | undefined;
      if (row === undefined) throw new Error(`Captured source entry is missing: ${path}`);
      const metadata = JSON.parse(row.metadata) as EntryMetadata;
      this.version(row.version_id);
      let total = 0;
      const digest = metadata.kind === "file" ? new FramedContentHasher(metadata.contentBytes) : undefined;
      let symlink = "";
      const decoder = metadata.kind === "symlink" ? new TextDecoder() : undefined;
      for (const item of this.db.prepare("SELECT content FROM observation_source_chunks WHERE version_id=? ORDER BY sequence").iterate(row.version_id)) {
        const bytes = Buffer.from(item.content as Uint8Array);
        total += bytes.byteLength;
        digest?.update(bytes);
        if (decoder !== undefined) symlink += decoder.decode(bytes, {stream:true});
        yield bytes;
      }
      if (decoder !== undefined) symlink += decoder.decode();
      const hash = metadata.kind === "symlink"
        ? hashFramedDomain("repository-artifact-content", symlink)
        : digest!.digest();
      if (total !== metadata.contentBytes || hash !== metadata.contentHash) throw new Error(`Captured source content is incomplete: ${path}`);
      if (ownsTransaction) this.db.exec("COMMIT");
      finished = true;
    } catch (error) { throw error; }
    finally { if (ownsTransaction && !finished && this.db.isTransaction) this.db.exec("ROLLBACK"); }
  }
}
