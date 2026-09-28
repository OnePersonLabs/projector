import { DatabaseSync } from "node:sqlite";
import { isAbsolute, toNamespacedPath } from "node:path";
import { createHash } from "node:crypto";
import { canonicalJson } from "@projector/core";
import type { IndexedObservationDelta } from "./observation-store.js";

export interface ObservationStageDescriptor {
  readonly schemaVersion: "projector.observation-stage/v1";
  readonly path: string;
}

/** Immutable enrollment spool. Typed rows can be copied into the published store by SQLite. */
export class SqliteObservationStage {
  private readonly db: DatabaseSync;
  private sequence = 0;
  private finished = false;

  constructor(readonly descriptor: ObservationStageDescriptor, writable = false) {
    if (!isAbsolute(descriptor.path) || descriptor.schemaVersion !== "projector.observation-stage/v1")
      throw new Error("Invalid observation stage descriptor");
    try {
      this.db = new DatabaseSync(toNamespacedPath(descriptor.path), { readOnly: !writable });
    } catch(error) {
      throw new Error(`Cannot open observation stage at ${descriptor.path}: ${error instanceof Error ? error.message : String(error)}`, {cause:error});
    }
    if (writable) {
      this.db.exec(`
        CREATE TABLE upserts(sequence INTEGER PRIMARY KEY, kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, bytes INTEGER NOT NULL, value_hash TEXT, cache_content_bytes INTEGER, cache_last_used INTEGER) STRICT;
        CREATE INDEX upserts_identity ON upserts(kind,key,sequence);
        CREATE TABLE deletes(sequence INTEGER PRIMARY KEY, kind TEXT NOT NULL, key TEXT NOT NULL) STRICT;
        CREATE TABLE populations(sequence INTEGER PRIMARY KEY, selector TEXT NOT NULL, member TEXT NOT NULL, present INTEGER NOT NULL, bytes INTEGER NOT NULL) STRICT;
        CREATE TABLE dependencies(sequence INTEGER PRIMARY KEY, consumer TEXT NOT NULL, input TEXT NOT NULL, present INTEGER NOT NULL, bytes INTEGER NOT NULL) STRICT;
        CREATE TABLE inventory_content(upsert_sequence INTEGER NOT NULL, sequence INTEGER NOT NULL, content BLOB NOT NULL, PRIMARY KEY(upsert_sequence,sequence)) STRICT, WITHOUT ROWID;
        PRAGMA user_version=2;
        BEGIN IMMEDIATE;
      `);
    } else if ((this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version !== 2) {
      this.db.close();
      throw new Error("Unsupported observation stage");
    }
  }

  write(delta: IndexedObservationDelta): void {
    if (!this.db.isTransaction || this.finished) throw new Error("Observation stage is immutable");
    const upsert = this.db.prepare("INSERT INTO upserts VALUES(?,?,?,?,?,?,?,?)");
    const contentRow = this.db.prepare("INSERT INTO inventory_content VALUES(?,?,?)");
    for (const record of delta.upserts ?? []) {
      const sequence = this.sequence++;
      let sourceBytes = 0;
      let storedValue = record.value;
      if (record.kind === "inventory" && typeof record.value === "object" && record.value !== null && "content" in record.value) {
        const source = record.value as Record<string, unknown> & { content: string; contentChunks?: () => Iterable<Uint8Array> };
        const metadata = Object.fromEntries(Object.keys(source).filter((key) => key !== "content").map((key) => [key, source[key]]));
        let partNumber = 0;
        for (const chunk of source.contentChunks?.() ?? [Buffer.from(source.content)])
          for (let offset = 0; offset < chunk.length; offset += 64 * 1024) {
            const part = chunk.subarray(offset, offset + 64 * 1024);
            contentRow.run(sequence, partNumber++, part);
            sourceBytes += part.length;
          }
        storedValue = { ...metadata, _inventoryStorage: "chunks/v1", contentBytes: sourceBytes };
      }
      const value = canonicalJson(storedValue);
      const digest = record.kind === "cache-source" ? createHash("sha256").update(value).digest("hex") : null;
      let cacheContentBytes: number | null = null;
      let cacheLastUsed: number | null = null;
      if (record.kind === "cache-source") {
        if (typeof record.value !== "object" || record.value === null || !("content" in record.value) ||
          typeof record.value.content !== "string" || !("lastUsedMs" in record.value) ||
          !Number.isSafeInteger(record.value.lastUsedMs))
          throw new Error("Disposable cache source metadata is invalid");
        cacheContentBytes = Buffer.byteLength(record.value.content);
        cacheLastUsed = record.value.lastUsedMs as number;
      }
      const bytes = Buffer.byteLength(record.kind) + Buffer.byteLength(record.key) + Buffer.byteLength(value) + sourceBytes + 64 + (digest === null ? 0 : 80);
      upsert.run(sequence, record.kind, record.key, value, bytes, digest, cacheContentBytes, cacheLastUsed);
    }
    const remove = this.db.prepare("INSERT INTO deletes VALUES(?,?,?)");
    for (const record of delta.deletes ?? []) remove.run(this.sequence++, record.kind, record.key);
    const population = this.db.prepare("INSERT INTO populations VALUES(?,?,?,?,?)");
    for (const record of delta.populations ?? [])
      population.run(this.sequence++, record.selector, record.member, Number(record.present), Buffer.byteLength(record.selector) + Buffer.byteLength(record.member) + 64);
    const dependency = this.db.prepare("INSERT INTO dependencies VALUES(?,?,?,?,?)");
    for (const record of delta.dependencies ?? [])
      dependency.run(this.sequence++, record.consumer, record.input, Number(record.present), Buffer.byteLength(record.consumer) + Buffer.byteLength(record.input) + 64);
  }

  finish(): void {
    if (!this.db.isTransaction) throw new Error("Observation stage is not writable");
    this.db.exec("COMMIT");
    this.finished = true;
  }

  close(): void {
    if (this.db.isTransaction) this.db.exec("ROLLBACK");
    this.db.close();
  }
}
