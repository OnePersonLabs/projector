import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, toNamespacedPath } from "node:path";
import { threadId } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { canonicalJson, hashFramedDomain, ObservationBudget, ObservationError } from "@projector/core";
import { RepositoryPathService } from "../security/repository-path.js";
import { checkoutCacheLocation } from "../cache/location.js";
import { SqliteObservationStage, type ObservationStageDescriptor } from "./observation-stage.js";
import { installObservationSourceSchema } from "./observation-source-content.js";
import { collectUnusedSourceVersions } from "./observation-source-lifetime.js";
import { beginSqliteWrite } from "./write-admission.js";

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
export interface ObservationPublicationOptions {
  readonly stage?:ObservationStageDescriptor;
  readonly signal?:AbortSignal;
  readonly retainGeneration?:boolean;
  readonly preserveMetadata?:boolean;
  readonly assertions?:readonly {readonly kind:string;readonly key:string;readonly expected?:unknown;readonly expectedHash?:string}[];
}
interface HeadRow { generation: number; contract: string; metadata: string; bytes: number; }
const recordDigest = (value:string):string => createHash("sha256").update(value).digest("hex");

/** Disposable exact observations and registered dependency indexes, never canonical meaning.
 * Publication holds one SQLite transaction; a failed collector cannot advance the head.
 * Readers select addressed rows rather than deserialize an entire repository generation.
 */
export class SqliteObservationStore {
  private readonly database: DatabaseSync;
  private readonly maximum: number | undefined;
  private closed=false;
  readonly metrics = { rowsRead: 0, rowsWritten: 0, writesByKind: Object.create(null) as Record<string, number>, bytesRead: 0, bytesWritten: 0 };
  /** Resolve the database and SQLite sidecars through the checkout's existing path boundary. */
  static async open(repositoryRoot: string, options: IndexedObservationOptions = {}): Promise<SqliteObservationStore> {
    options.signal?.throwIfAborted(); options.budget?.check("observation-index-path");
    const location = await checkoutCacheLocation(repositoryRoot);
    const paths = await RepositoryPathService.create(location.cacheRoot);
    const relative = ".projector/runtime/observations/index.sqlite";
    const database = await paths.resolveWrite(relative);
    for (const suffix of ["-wal", "-shm", "-journal"]) await paths.resolveWrite(`${relative}${suffix}`);
    for (const suffix of ["", "-journal", "-wal", "-shm"]) await paths.resolveWrite(`${relative}.source-lifetime.sqlite${suffix}`);
    options.signal?.throwIfAborted(); options.budget?.check("observation-index-path");
    return new SqliteObservationStore(database.realTarget, options);
  }
  constructor(readonly path: string, private readonly options: IndexedObservationOptions = {}) {
    this.maximum = options.maxBytes;
    if (this.maximum !== undefined && (!Number.isSafeInteger(this.maximum) || this.maximum < 1)) throw new RangeError("Invalid explicit observation cache capacity");
    this.check();
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(toNamespacedPath(path), { allowExtension: false, defensive: true, enableDoubleQuotedStringLiterals: false, enableForeignKeyConstraints: true, timeout: Math.min(5000, options.budget?.remainingMs() ?? 5000) });
    try {
      this.database.exec("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
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
        } catch(error) { this.rollbackAndRethrow(error); }
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
        } catch(error) { this.rollbackAndRethrow(error); }
      }
      this.database.exec("CREATE TABLE IF NOT EXISTS observation_inventory_content(path TEXT NOT NULL, sequence INTEGER NOT NULL, content BLOB NOT NULL, PRIMARY KEY(path,sequence)) STRICT, WITHOUT ROWID;");
      installObservationSourceSchema(this.database);
      collectUnusedSourceVersions(path);
      this.check();
    } catch (error) { this.database.close(); throw error; }
  }
  close(): void {
    if(this.closed)return;this.database.close();this.closed=true;
    this.tryCollectSources();
    const sink=process.env.PROJECTOR_OBSERVATION_METRICS_FILE;
    if(sink!==undefined){if(!isAbsolute(sink))throw new Error("Observation metrics evidence sink must be an absolute host-selected path");appendFileSync(sink,JSON.stringify({kind:"observation-addressed-record-metrics",pid:process.pid,threadId,...this.metrics})+"\n","utf8");}
  }
  private check(): void { this.options.signal?.throwIfAborted(); this.options.budget?.check("observation-index"); }
  private tryCollectSources(): void {
    try { collectUnusedSourceVersions(this.path); }
    catch (error) { console.warn(JSON.stringify({event:"source-version-collection-failed",path:this.path,error:String(error)})); }
  }
  private recordWrite(kind: string, count = 1): void {
    this.metrics.rowsWritten += count;
    this.metrics.writesByKind[kind] = (this.metrics.writesByKind[kind] ?? 0) + count;
  }
  private rollbackAndRethrow(error: unknown): never {
    if (this.database.isTransaction) {
      try { this.database.exec("ROLLBACK"); }
      catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `Observation operation failed: ${String(error)}; rollback also failed: ${String(rollbackError)}`,
        );
      }
    }
    throw error;
  }
  private assertRecordBytes(bytes:number,key:string):void { const limit=this.options.budget?.limits.maxDerivedBytes; if(limit != null && bytes>limit)throw new ObservationError("observation-limit-exceeded","observation-index-record",key,"Indexed derived record exceeds the declared derived memory limit","maxDerivedBytes",bytes); }
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
    if (kind === "inventory" && !this.database.isTransaction) {
      this.database.exec("BEGIN");
      try { const value=this.get<T>(kind,key); this.database.exec("COMMIT"); return value; }
      catch(error){this.rollbackAndRethrow(error);}
    }
    const limit = this.options.budget?.limits.maxDerivedBytes ?? null;
    const row = this.database.prepare("SELECT length(CAST(value AS BLOB)) AS bytes, CASE WHEN ? IS NULL OR length(CAST(value AS BLOB))<=? THEN value END AS value FROM observation_records WHERE kind=? AND key=?").get(limit,limit,kind,key) as { bytes:number; value:string | null } | undefined;
    if (row === undefined) return undefined;
    this.assertRecordBytes(row.bytes, key);
    if (row.value === null) throw new Error("Indexed record size changed during bounded read");
    this.metrics.rowsRead++; this.metrics.bytesRead += row.bytes;
    const value = JSON.parse(row.value) as Record<string,unknown>;
    if(kind === "inventory" && (value._inventoryStorage === "chunks/v1" || value._inventoryStorage === "versions/v2")) {
      const {_inventoryStorage:_storage,contentBytes:_bytes,sourceVersionId,sourceCaptureId,...fields}=value;
      const bytes=this.inventoryBytes(key,value);
      return Object.defineProperties(fields,{
        content:{enumerable:true,value:bytes.toString("utf8")},
        contentBytes:{value:bytes.length},
        contentChunks:{value:():Iterable<Uint8Array>=>[bytes]},
        ...(sourceVersionId === undefined ? {} : {sourceVersionId:{value:sourceVersionId}}),
        ...(sourceCaptureId === undefined ? {} : {sourceCaptureId:{value:sourceCaptureId}}),
      }) as T;
    }
    return value as T;
  }
  private inventoryBytes(path: string, metadata: Record<string, unknown>): Buffer {
    const pieces: Buffer[]=[];
    const sourceId = metadata._inventoryStorage === "versions/v2" ? metadata.sourceVersionId : path;
    if (typeof sourceId !== "string") throw new Error(`Captured inventory source version is missing: ${path}`);
    const query = metadata._inventoryStorage === "versions/v2"
      ? "SELECT content FROM observation_source_chunks WHERE version_id=? ORDER BY sequence"
      : "SELECT content FROM observation_inventory_content WHERE path=? ORDER BY sequence";
    for(const row of this.database.prepare(query).iterate(sourceId)) {
      this.check(); const bytes=Buffer.from(row.content as Uint8Array);pieces.push(bytes);
      this.metrics.rowsRead++;this.metrics.bytesRead+=bytes.length;
    }
    const bytes=Buffer.concat(pieces);
    if(!Number.isSafeInteger(metadata.contentBytes)||bytes.length!==metadata.contentBytes)
      throw new Error(`Captured inventory source byte count changed: ${path}`);
    if(typeof metadata.contentHash==="string"){
      const actual=hashFramedDomain("repository-artifact-content",metadata.kind==="symlink"?bytes.toString("utf8"):bytes.toString("base64"));
      if(actual!==metadata.contentHash)throw new Error(`Captured inventory source hash changed: ${path}`);
    }
    return bytes;
  }
  /** Keep one generation snapshot open until the caller finishes copying the source. */
  private *inventoryChunksAt(generation:number,path:string,metadata:Record<string,unknown>):Generator<Uint8Array> {
    this.check();
    const ownsTransaction=!this.database.isTransaction;
    if(ownsTransaction)this.database.exec("BEGIN");
    let finished=false;
    try {
      this.verifyGeneration(generation);
      if(!Number.isSafeInteger(metadata.contentBytes)||Number(metadata.contentBytes)<0)
        throw new Error(`Captured inventory source byte count changed: ${path}`);
      const expectedBytes=Number(metadata.contentBytes);
      const expectedHash=typeof metadata.contentHash==="string"?metadata.contentHash:undefined;
      const isSymlink=metadata.kind==="symlink";
      const digest=expectedHash!==undefined&&!isSymlink?createHash("sha256"):undefined;
      const frame=(value:Uint8Array):void=>{
        const length=Buffer.allocUnsafe(8);length.writeBigUInt64BE(BigInt(value.byteLength));
        digest?.update(length).update(value);
      };
      if(digest!==undefined){
        frame(Buffer.from("projector\0sha256\0v1","utf8"));
        frame(Buffer.from("repository-artifact-content","utf8"));
        const length=Buffer.allocUnsafe(8);
        length.writeBigUInt64BE(4n*((BigInt(expectedBytes)+2n)/3n)+2n);
        digest.update(length).update('"');
      }
      const decoder=isSymlink&&expectedHash!==undefined?new TextDecoder():undefined;
      let target="",carry=Buffer.alloc(0),count=0;
      const sourceId = metadata._inventoryStorage === "versions/v2" ? metadata.sourceVersionId : path;
      if (typeof sourceId !== "string") throw new Error(`Captured inventory source version is missing: ${path}`);
      const query = metadata._inventoryStorage === "versions/v2"
        ? "SELECT content FROM observation_source_chunks WHERE version_id=? ORDER BY sequence"
        : "SELECT content FROM observation_inventory_content WHERE path=? ORDER BY sequence";
      for(const row of this.database.prepare(query).iterate(sourceId)){
        this.check();const bytes=Buffer.from(row.content as Uint8Array);
        count+=bytes.length;
        if(!Number.isSafeInteger(count)||count>expectedBytes)throw new Error(`Captured inventory source byte count changed: ${path}`);
        this.metrics.rowsRead++;this.metrics.bytesRead+=bytes.length;
        if(decoder!==undefined)target+=decoder.decode(bytes,{stream:true});
        if(digest!==undefined){
          let offset=0;
          if(carry.length>0){
            const take=Math.min(3-carry.length,bytes.length);
            if(carry.length+take===3){
              const triplet=Buffer.allocUnsafe(3);carry.copy(triplet);bytes.copy(triplet,carry.length,0,take);
              digest.update(triplet.toString("base64"));carry=Buffer.alloc(0);
            }else{
              const next=Buffer.allocUnsafe(carry.length+take);carry.copy(next);bytes.copy(next,carry.length,0,take);carry=next;
            }
            offset=take;
          }
          const whole=Math.floor((bytes.length-offset)/3)*3;
          if(whole>0)digest.update(bytes.subarray(offset,offset+whole).toString("base64"));
          const rest=bytes.subarray(offset+whole);
          if(rest.length>0)carry=Buffer.from(rest);
        }
        yield bytes;
      }
      if(count!==expectedBytes)throw new Error(`Captured inventory source byte count changed: ${path}`);
      if(digest!==undefined){
        if(carry.length>0)digest.update(carry.toString("base64"));
        digest.update('"');
        if(`sha256:v1:${digest.digest("hex")}`!==expectedHash)throw new Error(`Captured inventory source hash changed: ${path}`);
      }else if(decoder!==undefined){
        target+=decoder.decode();
        if(hashFramedDomain("repository-artifact-content",target)!==expectedHash)throw new Error(`Captured inventory source hash changed: ${path}`);
      }
      this.check();
      if(ownsTransaction)this.database.exec("COMMIT");
      finished=true;
    }catch(error){if(ownsTransaction)this.rollbackAndRethrow(error);throw error;}
    finally{if(ownsTransaction&&!finished&&this.database.isTransaction)this.database.exec("ROLLBACK");}
  }
  /** Retain metadata only. Each source read is bound to the captured generation. */
  private lazyInventoryEntry<T>(generation:number,path:string,value:Record<string,unknown>):T {
    if(value._inventoryStorage !== "chunks/v1" && value._inventoryStorage !== "versions/v2")return value as T;
    const {_inventoryStorage:_storage,contentBytes,sourceVersionId,sourceCaptureId,...fields}=value;
    const readBytes=():Buffer=>this.database.isTransaction ? (this.verifyGeneration(generation),this.inventoryBytes(path,value)) : this.readGeneration(generation,()=>this.inventoryBytes(path,value));
    return Object.defineProperties(fields,{
      content:{enumerable:true,get:()=>readBytes().toString("utf8")},
      contentBytes:{value:contentBytes},
      contentChunks:{value:():Iterable<Uint8Array>=>this.inventoryChunksAt(generation,path,value)},
      ...(sourceVersionId === undefined ? {} : { sourceVersionId: { value: sourceVersionId } }),
      ...(sourceCaptureId === undefined ? {} : { sourceCaptureId: { value: sourceCaptureId } }),
    }) as T;
  }
  inventoryEntryAt<T>(generation:number,path:string):T|undefined {
    return this.readGeneration(generation,()=>{
      const row=this.database.prepare("SELECT value FROM observation_records WHERE kind='inventory' AND key=?").get(path) as {value:string}|undefined;
      if(row===undefined)return undefined;
      this.metrics.rowsRead++;this.metrics.bytesRead+=Buffer.byteLength(row.value);
      return this.lazyInventoryEntry<T>(generation,path,JSON.parse(row.value) as Record<string,unknown>);
    });
  }
  inventoryEntriesAt<T>(generation: number): T[] {
    return this.readGeneration(generation,()=>{
      const result:T[]=[];
      for(const row of this.database.prepare("SELECT key,value FROM observation_records WHERE kind='inventory' ORDER BY key").iterate()) {
        this.check(); const path=String(row.key),value=JSON.parse(String(row.value)) as Record<string,unknown>;
        result.push(this.lazyInventoryEntry<T>(generation,path,value));
        this.metrics.rowsRead++;this.metrics.bytesRead+=Buffer.byteLength(String(row.value));
      }
      return result;
    });
  }
  has(kind: string, key: string): boolean { this.check(); return this.database.prepare("SELECT 1 FROM observation_records WHERE kind=? AND key=?").get(kind,key) !== undefined; }
  verifyGeneration(generation: number): void { if (this.head()?.generation !== generation) throw new Error("Observation generation changed during indexed computation; retry from the completed generation"); }
  getAt<T = unknown>(generation: number, kind: string, key: string): T | undefined { return this.readGeneration(generation, () => this.get<T>(kind,key)); }
  populationAt(generation: number, selector: string): string[] { return this.readGeneration(generation, () => this.population(selector)); }
  /** Read source identity without transferring persisted file contents to Node. */
  inventorySummariesAt(generation: number): readonly {path:string;kind:string;mediaType:string;contentHash:string;generated:boolean}[] {
    return this.readGeneration(generation, () => {
      const result:{path:string;kind:string;mediaType:string;contentHash:string;generated:boolean}[]=[];
      for(const row of this.database.prepare("SELECT key,json_extract(value,'$.kind') AS kind,json_extract(value,'$.mediaType') AS media_type,json_extract(value,'$.contentHash') AS content_hash,json_extract(value,'$.generated') AS generated FROM observation_records WHERE kind='inventory' ORDER BY key").iterate()){
        this.check();
        const fileLimit=this.options.budget?.limits.maxFiles;
        if(fileLimit!=null&&result.length>=fileLimit)throw new ObservationError("observation-limit-exceeded","indexed-inventory-summary",".","Indexed inventory exceeds maxFiles","maxFiles",result.length+1);
        if(typeof row.key!=="string"||typeof row.kind!=="string"||typeof row.media_type!=="string"||typeof row.content_hash!=="string"||(row.generated!==0&&row.generated!==1))throw new Error("Indexed inventory summary is incomplete; rebuild the observation");
        result.push({path:row.key,kind:row.kind,mediaType:row.media_type,contentHash:row.content_hash,generated:row.generated===1});
      }
      return result;
    });
  }
  dependentsAt(generation: number, input: string): string[] { return this.readGeneration(generation, () => this.dependents(input)); }
  get totalBytes(): number { this.check(); return (this.database.prepare("SELECT bytes FROM observation_accounting WHERE singleton=1").get() as { bytes:number }).bytes; }
  cacheEntries(): readonly { key: string; bytes: number; valueHash: string; lastUsedMs: number }[] {
    this.check(); const result: { key:string; bytes:number; valueHash:string; lastUsedMs:number }[] = [];
    const limit = this.options.budget?.limits.maxDerivedBytes ?? null;
    for (const row of this.database.prepare("SELECT key,CASE WHEN cache_content_bytes IS NULL THEN CASE WHEN ? IS NULL OR length(CAST(value AS BLOB))<=? THEN length(CAST(json_extract(value,'$.content') AS BLOB)) END ELSE cache_content_bytes END AS content_bytes,CASE WHEN cache_last_used IS NULL THEN CASE WHEN ? IS NULL OR length(CAST(value AS BLOB))<=? THEN json_extract(value,'$.lastUsedMs') END ELSE cache_last_used END AS last_used,value_hash,CASE WHEN value_hash IS NULL OR cache_content_bytes IS NULL OR cache_last_used IS NULL THEN length(CAST(value AS BLOB)) END AS legacy_bytes,CASE WHEN value_hash IS NULL AND (? IS NULL OR length(CAST(value AS BLOB))<=?) THEN value END AS legacy_value FROM observation_records WHERE kind='cache-source' ORDER BY key").iterate(limit,limit,limit,limit,limit,limit)) {
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
    } catch (error) { this.rollbackAndRethrow(error); }
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
    options: ObservationPublicationOptions = {}): IndexedObservationHead {
    const result=this.publishInternal(expectedGeneration,next,delta,options);
    if(this.changesInventory(delta))this.tryCollectSources();
    return result;
  }
  private changesInventory(delta:IndexedObservationDelta):boolean {
    return delta.rebuild===true || (delta.deletes??[]).some(record=>record.kind==="inventory") ||
      (delta.upserts??[]).some(record=>record.kind==="inventory");
  }
  /** Wait only for the SQLite writer admission; never replay mutation or commit. */
  async publishWhenReady(expectedGeneration:number|null,next:Omit<IndexedObservationHead,"generation">,delta:IndexedObservationDelta,
    options:ObservationPublicationOptions={}):Promise<IndexedObservationHead>{
    this.check();options.signal?.throwIfAborted();
    const stage=options.stage===undefined?undefined:new SqliteObservationStage(options.stage);
    let attached=false,handedOff=false;
    try{
      if(stage!==undefined){
        this.database.prepare("ATTACH DATABASE ? AS observation_stage").run(toNamespacedPath(stage.descriptor.path));
        attached=true;
        const version=this.database.prepare("PRAGMA observation_stage.user_version").get() as {user_version:number};
        if(version.user_version!==2)throw new Error("Unsupported observation stage");
      }
      await beginSqliteWrite(this.database,{signal:options.signal,budget:this.options.budget,scope:"observation-publication"});
      handedOff=true;
      const result=this.publishInternal(expectedGeneration,next,delta,options,{stage,attached});
      if(this.changesInventory(delta)||options.stage!==undefined)this.tryCollectSources();
      return result;
    }catch(error){
      if(!handedOff){
        let failure:unknown=error;
        if(this.database.isTransaction)try{this.database.exec("ROLLBACK");}
        catch(rollbackError){failure=new AggregateError([error,rollbackError],`Publication admission failed: ${String(error)}; rollback failed: ${String(rollbackError)}`);}
        try{if(attached)this.database.exec("DETACH DATABASE observation_stage");}
        catch(detachError){failure=new AggregateError([failure,detachError],`Publication admission failed: ${String(failure)}; stage detach failed: ${String(detachError)}`);}
        try{stage?.close();}
        catch(closeError){failure=new AggregateError([failure,closeError],`Publication admission failed: ${String(failure)}; stage close failed: ${String(closeError)}`);}
        throw failure;
      }
      throw error;
    }
  }
  private publishInternal(expectedGeneration:number|null,next:Omit<IndexedObservationHead,"generation">,delta:IndexedObservationDelta,
    options:ObservationPublicationOptions,admitted?:{stage:SqliteObservationStage|undefined;attached:boolean}):IndexedObservationHead{
    const stage=admitted?.stage??(options.stage===undefined?undefined:new SqliteObservationStage(options.stage));
    function* records<K extends "upserts"|"deletes"|"populations"|"dependencies">(kind:K):Generator<NonNullable<IndexedObservationDelta[K]>[number]>{
      yield* delta[kind]??[];
    }
    let attached = admitted?.attached??false;
    let failed = false,committed=false;
    try {
      // An admitted writer already owns BEGIN IMMEDIATE. Every subsequent
      // check belongs inside rollback and stage-detach cleanup.
      this.check(); options.signal?.throwIfAborted();
      if(stage!==undefined&&!attached){
        this.database.prepare("ATTACH DATABASE ? AS observation_stage").run(toNamespacedPath(stage.descriptor.path));
        attached = true;
        const version = this.database.prepare("PRAGMA observation_stage.user_version").get() as { user_version: number };
        if(version.user_version !== 2)throw new Error("Unsupported observation stage");
      }
      if(admitted===undefined)this.database.exec("BEGIN IMMEDIATE");
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
          const chunkBytes = Math.min(64 * 1024,this.options.budget?.limits.maxDerivedBytes ?? Infinity);
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
      const check = (): void => { this.check(); options.signal?.throwIfAborted(); if (this.maximum !== undefined && bytes > this.maximum) throw new ObservationError("observation-limit-exceeded", "observation-index-capacity", ".", "Completed observation exceeds the explicitly configured cache capacity; prior generation remains unchanged", undefined, bytes); };
      const recount = (): void => {
        const totals = this.database.prepare(`SELECT
          (SELECT COALESCE(SUM(bytes),0) FROM observation_records) AS records,
          (SELECT COALESCE(SUM(bytes),0) FROM observation_populations) AS populations,
          (SELECT COALESCE(SUM(bytes),0) FROM observation_dependencies) AS dependencies`).get() as {records:number;populations:number;dependencies:number};
        bytes = totals.records + totals.populations + totals.dependencies + (previous?.bytes ?? 0);
        check();
      };
      // Direct deltas may retain a lazy source from this same database. Capture
      // their chunks before rebuilds or replacements remove the old rows.
      if((delta.upserts??[]).some(record=>record.kind==="inventory"&&typeof record.value==="object"&&record.value!==null&&"content" in record.value&&!("sourceVersionId" in record.value))){
        this.database.exec("CREATE TEMP TABLE IF NOT EXISTS observation_pending_content(upsert_index INTEGER NOT NULL,sequence INTEGER NOT NULL,content BLOB NOT NULL,PRIMARY KEY(upsert_index,sequence)) STRICT, WITHOUT ROWID");
        this.database.exec("DELETE FROM temp.observation_pending_content");
        const insertPending=this.database.prepare("INSERT INTO temp.observation_pending_content VALUES(?,?,?)");
        for(const [upsertIndex,record] of (delta.upserts??[]).entries()){
          if(record.kind!=="inventory"||typeof record.value!=="object"||record.value===null||!("content" in record.value)||"sourceVersionId" in record.value)continue;
          const source=record.value as {content:string;contentChunks?:()=>Iterable<Uint8Array>};
          const chunks=source.contentChunks?.()??[Buffer.from(source.content)];let sequence=0;
          for(const chunk of chunks)for(let offset=0;offset<chunk.length;offset+=64*1024){
            check();insertPending.run(upsertIndex,sequence++,chunk.subarray(offset,offset+64*1024));
          }
        }
      }
      if(delta.rebuild===true){
        const removed = this.database.prepare("SELECT kind,COUNT(*) AS count FROM observation_records WHERE kind!='cache-source' GROUP BY kind").all() as { kind:string; count:number }[];
        this.database.exec("DELETE FROM observation_records WHERE kind!='cache-source'");
        this.database.exec("DELETE FROM observation_inventory_content");
        for (const row of removed) this.recordWrite(row.kind, row.count);
        for (const table of ["observation_populations", "observation_dependencies"])
          this.recordWrite(table, Number(this.database.prepare(`DELETE FROM ${table}`).run().changes));
        bytes=(this.database.prepare("SELECT COALESCE(SUM(bytes),0) AS bytes FROM observation_records").get() as {bytes:number}).bytes+(previous?.bytes??0);
      }
      if(stage!==undefined){
        check();
        this.database.exec(`DELETE FROM observation_inventory_content WHERE path IN
          (SELECT key FROM observation_stage.deletes WHERE kind='inventory');
          DELETE FROM observation_records WHERE (kind,key) IN
          (SELECT kind,key FROM observation_stage.deletes);`);
        for(const row of this.database.prepare("SELECT kind,COUNT(*) AS count FROM observation_stage.deletes GROUP BY kind").all() as {kind:string;count:number}[])
          this.recordWrite(row.kind,row.count);
        recount();
      }
      for (const record of records("deletes")) {
        check(); const existing = this.database.prepare("SELECT bytes FROM observation_records WHERE kind=? AND key=?").get(record.kind,record.key) as { bytes: number } | undefined;
        this.database.prepare("DELETE FROM observation_records WHERE kind=? AND key=?").run(record.kind,record.key); bytes -= existing?.bytes ?? 0;
        if(record.kind === "inventory")this.database.prepare("DELETE FROM observation_inventory_content WHERE path=?").run(record.key);
        this.recordWrite(record.kind);
      }
      if(stage!==undefined){
        check();
        const perRecordLimit=this.options.budget?.limits.maxDerivedBytes;
        if(perRecordLimit!=null){
          const oversized=this.database.prepare("SELECT key,length(CAST(value AS BLOB)) AS bytes FROM observation_stage.upserts WHERE length(CAST(value AS BLOB))>? LIMIT 1")
            .get(perRecordLimit) as {key:string;bytes:number}|undefined;
          if(oversized!==undefined)
            throw new ObservationError("observation-limit-exceeded","observation-index-record",oversized.key,
              "Indexed derived record exceeds the declared derived memory limit","maxDerivedBytes",oversized.bytes);
        }
        const latest = `SELECT u.* FROM observation_stage.upserts u JOIN
          (SELECT kind,key,MAX(sequence) AS sequence FROM observation_stage.upserts GROUP BY kind,key) last
          ON last.kind=u.kind AND last.key=u.key AND last.sequence=u.sequence`;
        this.database.exec(`DELETE FROM observation_inventory_content WHERE path IN
          (SELECT key FROM (${latest}) WHERE kind='inventory' AND json_extract(value,'$._inventoryStorage')='chunks/v1');`);
        this.database.exec(`INSERT INTO observation_records(kind,key,value,bytes,value_hash,cache_content_bytes,cache_last_used)
          SELECT kind,key,value,bytes,value_hash,cache_content_bytes,cache_last_used FROM (${latest})
          WHERE true ON CONFLICT(kind,key) DO UPDATE SET value=excluded.value,bytes=excluded.bytes,
          value_hash=excluded.value_hash,cache_content_bytes=excluded.cache_content_bytes,cache_last_used=excluded.cache_last_used;`);
        this.database.exec(`INSERT INTO observation_inventory_content(path,sequence,content)
          SELECT u.key,c.sequence,c.content FROM observation_stage.inventory_content c
          JOIN (${latest}) u ON u.sequence=c.upsert_sequence;`);
        for(const row of this.database.prepare("SELECT kind,COUNT(*) AS count,SUM(bytes) AS bytes FROM observation_stage.upserts GROUP BY kind").all() as {kind:string;count:number;bytes:number}[]){
          this.recordWrite(row.kind,row.count);this.metrics.bytesWritten+=row.bytes;
        }
        recount();
      }
      for (const [upsertIndex,record] of (delta.upserts??[]).entries()) {
        check();
        let sourceBytes=0, physicallyCopiedSourceBytes=0, storedValue=record.value;
        if(record.kind === "inventory" && typeof record.value === "object" && record.value !== null && "sourceVersionId" in record.value) {
          const source = record.value as Record<string,unknown> & { sourceVersionId: string; sourceCaptureId: string; contentBytes: number };
          const version = this.database.prepare("SELECT kind,content_hash,byte_count,sealed FROM observation_source_versions WHERE id=?")
            .get(source.sourceVersionId) as { kind:string; content_hash:string; byte_count:number; sealed:number } | undefined;
          if(version?.sealed !== 1 || version.kind !== source.kind || version.content_hash !== source.contentHash || version.byte_count !== source.contentBytes)
            throw new Error(`Inventory source version is missing or incomplete: ${record.key}`);
          const capture = this.database.prepare(`SELECT 1 FROM observation_source_capture_entries entry
            JOIN observation_source_captures capture ON capture.id=entry.capture_id
            WHERE entry.capture_id=? AND entry.path=? AND entry.version_id=? AND capture.complete=1`)
            .get(source.sourceCaptureId,record.key,source.sourceVersionId);
          if(capture===undefined)throw new Error(`Inventory source capture is missing or incomplete: ${record.key}`);
          const metadata = Object.fromEntries(Object.keys(source).filter(key=>key!=="content").map(key=>[key,source[key]]));
          storedValue = {...metadata, _inventoryStorage:"versions/v2", sourceVersionId:source.sourceVersionId,
            sourceCaptureId:source.sourceCaptureId, contentBytes:source.contentBytes};
          // Explicit capacity accounting remains a conservative logical charge
          // per source record even when immutable bytes are shared physically.
          sourceBytes = source.contentBytes;
          this.database.prepare("DELETE FROM observation_inventory_content WHERE path=?").run(record.key);
        } else if(record.kind === "inventory" && typeof record.value === "object" && record.value !== null && "content" in record.value) {
          const source=record.value as Record<string,unknown> & {content:string;contentChunks?:()=>Iterable<Uint8Array>};
          // Read metadata without invoking the content getter. Source bytes use
          // rows much smaller than SQLite's individual TEXT/BLOB value ceiling.
          const metadata=Object.fromEntries(Object.keys(source).filter(key=>key!=="content").map(key=>[key,source[key]]));
          const pending=this.database.prepare("SELECT COALESCE(SUM(length(content)),0) AS bytes FROM temp.observation_pending_content WHERE upsert_index=?").get(upsertIndex) as {bytes:number};
          sourceBytes=pending.bytes;
          physicallyCopiedSourceBytes=sourceBytes;
          this.database.prepare("DELETE FROM observation_inventory_content WHERE path=?").run(record.key);
          this.database.prepare("INSERT INTO observation_inventory_content(path,sequence,content) SELECT ?,sequence,content FROM temp.observation_pending_content WHERE upsert_index=? ORDER BY sequence").run(record.key,upsertIndex);
          storedValue={...metadata,_inventoryStorage:"chunks/v1",contentBytes:sourceBytes};
        }
        const value = this.encoded(storedValue), digest = record.kind === "cache-source" ? recordDigest(value) : null;
        let contentBytes:number|null=null, lastUsed:number|null=null;
        if(record.kind === "cache-source") {
          if(typeof record.value !== "object" || record.value === null || !("content" in record.value) || typeof record.value.content !== "string" || !("lastUsedMs" in record.value) || !Number.isSafeInteger(record.value.lastUsedMs))throw new Error("Disposable cache source metadata is invalid");
          contentBytes=Buffer.byteLength(record.value.content);lastUsed=record.value.lastUsedMs as number;
        }
        const size = Buffer.byteLength(record.kind)+Buffer.byteLength(record.key)+Buffer.byteLength(value)+sourceBytes+64+(digest === null ? 0 : 80);
        const existing = this.database.prepare("SELECT bytes FROM observation_records WHERE kind=? AND key=?").get(record.kind,record.key) as { bytes: number } | undefined;
        bytes += size-(existing?.bytes ?? 0); check();
        this.database.prepare("INSERT INTO observation_records(kind,key,value,bytes,value_hash,cache_content_bytes,cache_last_used) VALUES(?,?,?,?,?,?,?) ON CONFLICT(kind,key) DO UPDATE SET value=excluded.value,bytes=excluded.bytes,value_hash=excluded.value_hash,cache_content_bytes=excluded.cache_content_bytes,cache_last_used=excluded.cache_last_used").run(record.kind,record.key,value,size,digest,contentBytes,lastUsed);
        this.recordWrite(record.kind);
        this.metrics.bytesWritten += size-sourceBytes+physicallyCopiedSourceBytes;
      }
      if((delta.upserts??[]).some(record=>record.kind==="inventory"&&typeof record.value==="object"&&record.value!==null&&"content" in record.value&&!("sourceVersionId" in record.value)))
        this.database.exec("DELETE FROM temp.observation_pending_content");
      const promoteRelation = (table: string, staged: string, left: string, right: string): void => {
        if(stage!==undefined){
          check();
          const latest=`SELECT s.* FROM observation_stage.${staged} s JOIN
            (SELECT ${left},${right},MAX(sequence) AS sequence FROM observation_stage.${staged} GROUP BY ${left},${right}) last
            ON last.${left}=s.${left} AND last.${right}=s.${right} AND last.sequence=s.sequence`;
          this.database.exec(`DELETE FROM ${table} WHERE (${left},${right}) IN
            (SELECT ${left},${right} FROM (${latest}) WHERE present=0);`);
          this.database.exec(`INSERT INTO ${table}(${left},${right},bytes)
            SELECT ${left},${right},bytes FROM (${latest}) WHERE present=1
            AND true ON CONFLICT(${left},${right}) DO UPDATE SET bytes=excluded.bytes;`);
          const count=this.database.prepare(`SELECT COUNT(*) AS count FROM observation_stage.${staged}`).get() as {count:number};
          this.recordWrite(table,count.count);
          recount();
        }
      };
      function* populationChanges(){for(const item of records("populations"))yield{a:item.selector,b:item.member,present:item.present};}
      function* dependencyChanges(){for(const item of records("dependencies"))yield{a:item.consumer,b:item.input,present:item.present};}
      for (const [table, staged, left, right, changes] of [
        ["observation_populations","populations","selector","member", populationChanges()],
        ["observation_dependencies","dependencies","consumer","input", dependencyChanges()],
      ] as const) {
        promoteRelation(table,staged,left,right);
        for (const item of changes) {
        check(); const existing = this.database.prepare(`SELECT bytes FROM ${table} WHERE ${left}=? AND ${right}=?`).get(item.a,item.b) as { bytes: number } | undefined;
        const size = Buffer.byteLength(item.a)+Buffer.byteLength(item.b)+64;
        bytes += (item.present ? size : 0)-(existing?.bytes ?? 0); check();
        if (item.present) this.database.prepare(`INSERT INTO ${table} VALUES(?,?,?) ON CONFLICT(${left},${right}) DO UPDATE SET bytes=excluded.bytes`).run(item.a,item.b,size);
        else this.database.prepare(`DELETE FROM ${table} WHERE ${left}=? AND ${right}=?`).run(item.a,item.b);
        this.recordWrite(table);
        }
      }
      const metadata = this.encoded(next.metadata), headBytes = Buffer.byteLength(metadata)+Buffer.byteLength(next.contract)+64;
      bytes += headBytes-(previous?.bytes ?? 0); check();
      const generation = (previous?.generation ?? 0)+(options.retainGeneration === true ? 0 : 1);
      if (!Number.isSafeInteger(generation)) throw new Error("Observation generation counter exhausted; rebuild the disposable observation cache");
      this.database.prepare("INSERT INTO observation_head VALUES(1,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET generation=excluded.generation,contract=excluded.contract,metadata=excluded.metadata,bytes=excluded.bytes").run(generation,next.contract,metadata,headBytes);
      this.database.prepare("UPDATE observation_accounting SET bytes=? WHERE singleton=1").run(bytes);
      check(); this.database.exec("COMMIT");committed=true;
      return { generation, contract: next.contract, metadata: JSON.parse(metadata) as unknown };
    } catch (error) { failed = true; return this.rollbackAndRethrow(error); } finally {
      for(const cleanup of [
        ...(attached?[()=>this.database.exec("DETACH DATABASE observation_stage")]:[]),
        ...(stage===undefined?[]:[()=>stage.close()]),
      ]) {
        try { cleanup(); }
        catch(cleanupError) {
          if(committed||failed)console.warn(JSON.stringify({event:"observation-publication-cleanup-failed",path:this.path,error:String(cleanupError)}));
          else throw cleanupError;
        }
      }
    }
  }
}
