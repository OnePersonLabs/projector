import { createHash, randomUUID } from "node:crypto";
import { constants, mkdirSync, rmSync } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute, join, toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { StringDecoder } from "node:string_decoder";
import { ObservationBudget, ObservationError, hashFramedCanonicalJsonChunks, hashFramedDomain, type ContentHash, type SourceContentCaptureDescriptor } from "@projector/core";
import type { InventoryEntry, InventoryResult } from "./inventory.js";

export interface LegacyInventoryContentDescriptor {
  readonly schemaVersion: "projector.inventory-content/v1";
  readonly path: string;
  readonly paths?: readonly string[];
  readonly disposeAfterUse?: boolean;
}
export type InventoryContentDescriptor = LegacyInventoryContentDescriptor | SourceContentCaptureDescriptor;
export type InventoryEntryMetadata = Omit<InventoryEntry, "content"> & { readonly contentBytes: number };

function frame(hash: ReturnType<typeof createHash>, value: Buffer): void {
  const size = Buffer.allocUnsafe(8);
  size.writeBigUInt64BE(BigInt(value.length));
  hash.update(size); hash.update(value);
}

/** An immutable capture owns its bytes independently of later working-tree edits.
 * Readers materialize only the file they are analyzing. The owner removes the
 * capture after all worker readers have completed.
 */
export class InventoryContentStore {
  readonly descriptor: InventoryContentDescriptor;
  private readonly db: DatabaseSync;
  private writable: boolean;
  private closed = false;
  private lastRead:{path:string;content:string}|undefined;

  private constructor(path: string, writable: boolean, append=false) {
    if (!isAbsolute(path)) throw new TypeError("Inventory capture requires an absolute path");
    this.descriptor = { schemaVersion: "projector.inventory-content/v1", path };
    this.writable = writable;
    this.db = new DatabaseSync(toNamespacedPath(path), { readOnly: !writable });
    if (writable && !append) this.db.exec(`
      PRAGMA journal_mode=DELETE;
      CREATE TABLE inventory_entries(path TEXT PRIMARY KEY, metadata TEXT NOT NULL) STRICT;
      CREATE TABLE inventory_content(path TEXT NOT NULL, sequence INTEGER NOT NULL, bytes BLOB NOT NULL,
        PRIMARY KEY(path,sequence)) STRICT, WITHOUT ROWID;
      PRAGMA user_version=1;
      BEGIN IMMEDIATE;
    `);
    else if (this.db.prepare("PRAGMA user_version").get()?.user_version !== 1) {
      this.db.close(); this.closed = true;
      throw new Error("Unsupported inventory capture version");
    }
    if(append)this.db.exec("BEGIN IMMEDIATE");
  }

  static create(directory: string): InventoryContentStore {
    mkdirSync(directory, { recursive: true });
    return new InventoryContentStore(join(directory, `${randomUUID().replaceAll("-", "")}.db`), true);
  }
  static open(descriptor: LegacyInventoryContentDescriptor): InventoryContentStore {
    if (descriptor.schemaVersion !== "projector.inventory-content/v1") throw new Error("Unsupported inventory capture descriptor");
    return new InventoryContentStore(descriptor.path, false);
  }
  static append(descriptor:LegacyInventoryContentDescriptor):InventoryContentStore {
    if(descriptor.schemaVersion!=="projector.inventory-content/v1")throw new Error("Unsupported inventory capture descriptor");
    return new InventoryContentStore(descriptor.path,true,true);
  }
  finish(): void {
    if (this.writable) { this.db.exec("COMMIT"); this.writable = false; }
  }
  beginAppend():void {if(!this.writable){this.db.exec("BEGIN IMMEDIATE");this.writable=true;}}
  close(): void {
    if (this.closed) return;
    if (this.db.isTransaction) this.db.exec("ROLLBACK");
    this.db.close(); this.closed = true;this.lastRead=undefined;
  }
  dispose(): void {
    this.close();
    rmSync(this.descriptor.path, { force: true });
  }
  put(metadata: InventoryEntryMetadata, content: string): InventoryEntry {
    return this.putChunks(metadata,[Buffer.from(content)]);
  }
  putChunks(metadata: InventoryEntryMetadata,chunks:Iterable<Uint8Array>):InventoryEntry {
    // Callers can pass an InventoryEntry; never persist its enumerable getter.
    const { content: _content, ...fields } = metadata as InventoryEntryMetadata & {content?:string};
    const insert=this.db.prepare("INSERT INTO inventory_content(path,sequence,bytes) VALUES(?,?,?)");let sequence=0;
    for(const bytes of chunks)for(let offset=0;offset<bytes.length;offset+=64*1024)insert.run(metadata.path,sequence++,bytes.subarray(offset,offset+64*1024));
    this.db.prepare("INSERT INTO inventory_entries(path,metadata) VALUES(?,?)").run(metadata.path, JSON.stringify(fields));
    return this.entry(fields);
  }
  async capture(path: string, absolute: string, mediaType: string, budget: ObservationBudget, signal?: AbortSignal): Promise<InventoryEntry> {
    const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const before = await handle.stat();
      if (!before.isFile()) throw new Error(`Inventory source is not a regular file: ${path}`);
      budget.assertFileBytes(before.size, path); budget.assertTotalBytes(before.size, path);
      // Existing artifact identities frame a JSON base64 string. Stream exactly
      // that encoding so switching capture storage does not change identities.
      const hash = createHash("sha256");
      frame(hash, Buffer.from("projector\0sha256\0v1"));
      frame(hash, Buffer.from("repository-artifact-content"));
      const encodedLength = 4 * Math.ceil(before.size / 3) + 2;
      const length = Buffer.allocUnsafe(8); length.writeBigUInt64BE(BigInt(encodedLength));
      hash.update(length); hash.update('"');
      const insert = this.db.prepare("INSERT INTO inventory_content(path,sequence,bytes) VALUES(?,?,?)");
      let sequence = 0, size = 0, remainder = Buffer.alloc(0), prefix = Buffer.alloc(0);
      const chunk = Buffer.allocUnsafe(64 * 1024);
      while (true) {
        signal?.throwIfAborted(); budget.check("inventory-capture", path);
        const { bytesRead } = await handle.read(chunk);
        if (bytesRead === 0) break;
        size += bytesRead; budget.assertFileBytes(size, path);
        budget.consume("maxTotalBytes", bytesRead, "inventory-capture", path);
        const bytes = chunk.subarray(0, bytesRead);
        insert.run(path, sequence++, bytes);
        if (prefix.length < 4096) prefix = Buffer.concat([prefix, bytes.subarray(0, 4096 - prefix.length)]);
        const encoded = remainder.length === 0 ? bytes : Buffer.concat([remainder, bytes]);
        const complete = encoded.length - encoded.length % 3;
        hash.update(encoded.subarray(0, complete).toString("base64"));
        remainder = Buffer.from(encoded.subarray(complete));
      }
      hash.update(remainder.toString("base64")); hash.update('"');
      const after = await handle.stat();
      if (size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.ino !== before.ino)
        throw new ObservationError("observation-failed", "inventory-capture", path, "Source changed while its observation was captured");
      const generated = /(?:@generated|generated file|do not edit)/iu.test(prefix.toString("utf8").slice(0, 1024));
      const metadata: InventoryEntryMetadata = { path, kind: "file", mediaType, contentHash: `sha256:v1:${hash.digest("hex")}` as ContentHash,
        generated, contentBytes: size, ...(generated ? { generatedReason: "source-marker" } : {}) };
      this.db.prepare("INSERT INTO inventory_entries(path,metadata) VALUES(?,?)").run(path, JSON.stringify(metadata));
      return this.entry(metadata);
    } finally { await handle.close(); }
  }
  read(path: string): string {
    if(this.closed)throw new Error("Inventory capture is closed");
    if(this.lastRead?.path===path)return this.lastRead.content;
    const parts: Buffer[] = [];
    for (const chunk of this.chunks(path))parts.push(Buffer.from(chunk));
    const content=Buffer.concat(parts).toString("utf8");
    this.lastRead={path,content};return content;
  }
  *chunks(path: string): Generator<Uint8Array> {
    const record=this.db.prepare("SELECT metadata FROM inventory_entries WHERE path=?").get(path);
    if(record===undefined)throw new Error(`Inventory capture entry is missing: ${path}`);
    const expected=(JSON.parse(String(record.metadata)) as InventoryEntryMetadata).contentBytes;let bytes=0;
    for (const row of this.db.prepare("SELECT bytes FROM inventory_content WHERE path=? ORDER BY sequence").iterate(path)){
      const chunk=row.bytes as Uint8Array;bytes+=chunk.byteLength;yield chunk;
    }
    if(bytes!==expected)throw new Error(`Inventory capture content is incomplete: ${path}`);
  }
  entry(metadata: InventoryEntryMetadata): InventoryEntry {
    const { contentBytes: _size, ...fields } = metadata;
    return Object.defineProperties(fields, {
      content: { enumerable: true, get: () => this.read(metadata.path) },
      contentBytes: { enumerable: false, value: metadata.contentBytes },
      contentChunks: { enumerable: false, value: () => this.chunks(metadata.path) },
    }) as InventoryEntry;
  }
  entries(paths?: readonly string[]): InventoryEntry[] {
    if(paths !== undefined) return paths.map(path => {
      const row=this.db.prepare("SELECT metadata FROM inventory_entries WHERE path=?").get(path);
      if(row === undefined) throw new Error(`Captured inventory entry is missing: ${path}`);
      return this.entry(JSON.parse(String(row.metadata)) as InventoryEntryMetadata);
    });
    return [...this.db.prepare("SELECT metadata FROM inventory_entries ORDER BY path").iterate()]
      .map(row => this.entry(JSON.parse(String(row.metadata)) as InventoryEntryMetadata));
  }
}

export function inventoryEntryBytes(entry: InventoryEntry): number {
  return "contentBytes" in entry && typeof entry.contentBytes === "number" ? entry.contentBytes : Buffer.byteLength(entry.content);
}
export function inventoryEntryWithBytes(entry:InventoryEntry,bytes:Uint8Array):InventoryEntry {
  return Object.defineProperties(entry,{contentBytes:{value:bytes.byteLength},contentChunks:{value:()=>[bytes]}});
}
export function inventoryEntryChunks(entry:InventoryEntry):Iterable<Uint8Array>{
  const source=entry as InventoryEntry&{contentChunks?:()=>Iterable<Uint8Array>};
  return source.contentChunks?.()??[Buffer.from(entry.content)];
}
const textHashes=new WeakMap<InventoryEntry,Map<string,ContentHash>>();
/** Hash decoded text with the existing identity framing without constructing a
 * whole-file string for opaque assets. Compiler parsers still request text. */
export function inventoryTextHash(entry:InventoryEntry,domain:string):ContentHash {
  if(!("contentChunks" in entry))return hashFramedDomain(domain,entry.content);
  const cached=textHashes.get(entry)??new Map<string,ContentHash>();
  const previous=cached.get(domain);if(previous!==undefined)return previous;
  function* jsonText():Generator<string>{
    const decoder=new StringDecoder("utf8");yield '"';
    for(const bytes of inventoryEntryChunks(entry))yield JSON.stringify(decoder.write(bytes)).slice(1,-1);
    yield JSON.stringify(decoder.end()).slice(1,-1);yield '"';
  }
  const hash=hashFramedCanonicalJsonChunks(domain,jsonText);cached.set(domain,hash);textHashes.set(entry,cached);return hash;
}

/** Keep source contents out of worker messages; a capture is immutable until its owner closes. */
export function inventoryForTransport(inventory: InventoryResult): InventoryResult {
  if (inventory.contentStore === undefined) return inventory;
  return { ...inventory, contentStore:{...inventory.contentStore,paths:inventory.entries.map(entry=>entry.path)}, entries: [] };
}
export function hydrateInventory(inventory: InventoryResult): { inventory: InventoryResult; close: () => void } {
  if (inventory.contentStore === undefined) return { inventory, close() {} };
  if (inventory.contentStore.schemaVersion !== "projector.inventory-content/v1") throw new Error("Source-content v2 captures require runtime hydration");
  const store = InventoryContentStore.open(inventory.contentStore);
  return { inventory: { ...inventory, entries: store.entries(inventory.contentStore.paths) }, close: () => store.close() };
}
