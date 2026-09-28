import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { hashFramedDomain, ObservationBudget } from "@projector/core";
import { afterEach, expect, it, vi } from "vitest";
import * as sqlite from "./index.js";
import { SqliteObservationStore } from "./index.js";
import { SqliteObservationStage } from "./observation-stage.js";
import { checkoutCacheLocation } from "../cache/location.js";
const formerDefaultCacheBytes = 256 * 1024 * 1024;

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

it("waits for a competing writer before one atomic publication and respects cancellation", async () => {
  const root=await mkdtemp(join(tmpdir(),"projector-observation-writer-admission-"));roots.push(root);
  const path=join(root,"index.sqlite");
  const store=new SqliteObservationStore(path);
  const head=store.publish(null,{contract:"test",metadata:{}},{upserts:[{kind:"marker",key:"old",value:true}]});
  const rival=new DatabaseSync(path,{timeout:0});
  try{
    rival.exec("BEGIN IMMEDIATE");
    const pending=store.publishWhenReady(head.generation,head,{upserts:[{kind:"marker",key:"new",value:true}]});
    await new Promise(resolve=>setTimeout(resolve,80));
    expect(store.head()?.generation).toBe(head.generation);
    rival.exec("COMMIT");
    const published=await pending;
    expect(published.generation).toBe(head.generation+1);
    expect(store.get("marker","new")).toBe(true);
    rival.exec("BEGIN IMMEDIATE");
    const abort=new AbortController();
    const cancelled=store.publishWhenReady(published.generation,published,{deletes:[{kind:"marker",key:"old"}]},{signal:abort.signal});
    abort.abort();
    await expect(cancelled).rejects.toThrow();
    rival.exec("COMMIT");
    expect(store.head()?.generation).toBe(published.generation);
    expect(store.get("marker","old")).toBe(true);
  } finally {
    if(rival.isTransaction)rival.exec("ROLLBACK");
    rival.close();store.close();
  }
});

it("rolls back and detaches a staged publication canceled just after writer admission",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-observation-admitted-cancel-"));roots.push(root);
  const path=join(root,"index.sqlite"),stagePath=join(root,"stage.sqlite");
  const store=new SqliteObservationStore(path);
  const head=store.publish(null,{contract:"test",metadata:{}},{upserts:[{kind:"marker",key:"old",value:true}]});
  const stage=new SqliteObservationStage({schemaVersion:"projector.observation-stage/v1",path:stagePath},true);
  stage.finish();stage.close();
  const controller=new AbortController();
  const original=DatabaseSync.prototype.exec;
  let admitted=false;
  const begin=vi.spyOn(DatabaseSync.prototype,"exec").mockImplementation(function(this:DatabaseSync,sql:string){
    const result=original.call(this,sql);
    if(sql==="BEGIN IMMEDIATE"&&!admitted){admitted=true;controller.abort();}
    return result;
  });
  try{
    await expect(store.publishWhenReady(head.generation,head,{upserts:[{kind:"marker",key:"new",value:true}]},
      {stage:{schemaVersion:"projector.observation-stage/v1",path:stagePath},signal:controller.signal})).rejects.toThrow();
    expect(admitted).toBe(true);
    expect(store.head()?.generation).toBe(head.generation);
    expect(store.get("marker","new")).toBeUndefined();
  }finally{begin.mockRestore();}
  try{
    const published=await store.publishWhenReady(head.generation,head,{upserts:[{kind:"marker",key:"new",value:true}]},
      {stage:{schemaVersion:"projector.observation-stage/v1",path:stagePath}});
    expect(published.generation).toBe(head.generation+1);
    expect(store.get("marker","new")).toBe(true);
  }finally{store.close();}
});

it("reports staged cleanup failure without changing a committed publication into failure",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-observation-postcommit-"));roots.push(root);
  const path=join(root,"index.sqlite"),stagePath=join(root,"stage.sqlite");
  const store=new SqliteObservationStore(path);
  const descriptor={schemaVersion:"projector.observation-stage/v1" as const,path:stagePath};
  const stage=new SqliteObservationStage(descriptor,true);
  stage.write({upserts:[{kind:"marker",key:"committed",value:true}]});stage.finish();stage.close();
  const close=SqliteObservationStage.prototype.close;
  const cleanup=vi.spyOn(SqliteObservationStage.prototype,"close").mockImplementation(function(this:SqliteObservationStage){
    close.call(this);throw new Error("injected stage cleanup failure");
  });
  const warning=vi.spyOn(console,"warn").mockImplementation(()=>{});
  try {
    const head=store.publish(null,{contract:"test",metadata:{}},{},{stage:descriptor});
    expect(head.generation).toBe(1);
    expect(store.get("marker","committed")).toBe(true);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("observation-publication-cleanup-failed"));
  } finally {cleanup.mockRestore();warning.mockRestore();store.close();}
});

it("rejects oversized addressed JSON before retrieving or parsing the payload", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-index-read-bound-")); roots.push(root);
  const path = join(root, "index.db");
  const writer = new SqliteObservationStore(path);
  writer.publish(null, { contract: "test", metadata: {} }, { upserts: [{ kind: "cache-source", key: "oversized", value: { content: "large", lastUsedMs: 0 } }] });
  writer.close();
  const database = new DatabaseSync(path);
  try { database.prepare("UPDATE observation_records SET value=? WHERE kind=? AND key=?").run("invalid JSON".repeat(100), "cache-source", "oversized"); }
  finally { database.close(); }
  const reader = new SqliteObservationStore(path, { budget: new ObservationBudget({ maxDerivedBytes: 8 }) });
  try {
    expect(() => reader.get("cache-source", "oversized")).toThrow(expect.objectContaining({ code: "observation-limit-exceeded", limit: "maxDerivedBytes" }));
    expect(reader.metrics.bytesRead).toBe(0);
  } finally { reader.close(); }
});

it("enumerates persisted cache metadata without decoding payload wrappers and detects changed bytes before removal", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-index-cache-metadata-")); roots.push(root);
  const path = join(root, "index.db");
  const store = new SqliteObservationStore(path);
  try {
    const head = store.publish(null, { contract: "test", metadata: {} }, { upserts: [{ kind: "cache-source", key: "cache", value: { content: "retained", lastUsedMs: 1 } }] });
    const inspected = store.cacheEntries()[0]!;
    const database = new DatabaseSync(path);
    try { database.prepare("UPDATE observation_records SET value=? WHERE kind=? AND key=?").run("invalid JSON", "cache-source", "cache"); }
    finally { database.close(); }
    expect(store.cacheEntries()).toEqual([inspected]);
    expect(() => store.publish(head.generation, head, { deletes: [{ kind: "cache-source", key: "cache" }] }, { retainGeneration: true, assertions: [{ kind: "cache-source", key: "cache", expectedHash: inspected.valueHash }] })).toThrow("changed after inspection");
    expect(store.has("cache-source", "cache")).toBe(true);
  } finally { store.close(); }
});

it("preserves legacy rows and rejects an oversized compatibility read before transferring their payload", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-index-cache-legacy-")); roots.push(root);
  const path = join(root, "index.db");
  const writer = new SqliteObservationStore(path);
  writer.publish(null, { contract: "test", metadata: {} }, { upserts: [{ kind: "cache-source", key: "cache", value: { content: "legacy".repeat(100), lastUsedMs: 1 } }] });
  writer.close();
  const database = new DatabaseSync(path);
  try { database.prepare("UPDATE observation_records SET value=?,value_hash=NULL,cache_content_bytes=NULL,cache_last_used=NULL").run("invalid JSON".repeat(100)); }
  finally { database.close(); }
  const reader = new SqliteObservationStore(path, { budget: new ObservationBudget({ maxDerivedBytes: 8 }) });
  try {
    expect(() => reader.cacheEntries()).toThrow(expect.objectContaining({ code: "observation-limit-exceeded", limit: "maxDerivedBytes" }));
    expect(reader.has("cache-source", "cache")).toBe(true);
    expect(reader.metrics.bytesRead).toBe(0);
  } finally { reader.close(); }
});

it("publishes indexed completed generations, rejects stale writers, and retains the prior head on interruption", async () => {
  // Missing indexed publication is the intended pre-implementation failure.
  expect("SqliteObservationStore" in sqlite).toBe(true);
  const root = await mkdtemp(join(tmpdir(), "projector-observation-index-")); roots.push(root);
  const store = new SqliteObservationStore(join(root, "index.db"));
  try {
    const first = store.publish(null, { contract: "v1", metadata: { cursor: "c:1" } }, {
      upserts: [{ kind: "file", key: "a.ts", value: { content: "first" } }, { kind: "file", key: "unrelated.ts", value: { content: "other" } }],
      populations: [{ selector: "source", member: "file:a.ts", present: true }],
      dependencies: [{ consumer: "file:a.ts", input: "configuration:tsconfig", present: true }],
    });
    expect(store.head()).toEqual(first);
    expect(store.get("file", "a.ts")).toEqual({ content: "first" });
    expect(store.population("source")).toEqual(["file:a.ts"]);
    expect(store.dependents("configuration:tsconfig")).toEqual(["file:a.ts"]);
    expect(() => store.publish(null, { contract: "v1", metadata: {} }, { upserts: [] })).toThrow("generation changed");
    const second = store.publish(first.generation, { contract: "v1", metadata: { cursor: "c:2" } }, {
      upserts: [{ kind: "file", key: "a.ts", value: { content: "second" } }],
    });
    expect(second.generation).toBe(first.generation + 1);
    expect(() => store.publish(second.generation, { contract: "v1", metadata: { cursor: "c:3" } }, {
      upserts: [{ kind: "file", key: "a.ts", value: { content: "aborted" } }],
    }, { signal: AbortSignal.abort(new Error("interrupted")) })).toThrow("interrupted");
    expect(store.head()).toEqual(second);
    expect(store.get("file", "a.ts")).toEqual({ content: "second" });
  } finally { store.close(); }
  const reopened = new SqliteObservationStore(join(root, "index.db"));
  try { expect(reopened.get("file", "unrelated.ts")).toEqual({ content: "other" }); expect(reopened.head()?.metadata).toEqual({ cursor: "c:2" }); }
  finally { reopened.close(); }
});
it("stores inventory bytes in small chunks and binds lazy reads to the completed generation", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-inventory-chunks-")); roots.push(root);
  const path = join(root, "index.db");
  const store = new SqliteObservationStore(path);
  try {
    const content = "source ".repeat(24_000);
    const sourceHash = (source: string) => hashFramedDomain("repository-artifact-content", Buffer.from(source).toString("base64"));
    const entry = { path: "src/a.ts", kind: "file", mediaType: "text/typescript", contentHash: sourceHash(content), generated: false, content };
    const first = store.publish(null, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "inventory", key: entry.path, value: entry }],
    });
    const db = new DatabaseSync(path);
    try {
      const chunks = db.prepare("SELECT COUNT(*) AS count,MAX(length(content)) AS maximum FROM observation_inventory_content WHERE path=?")
        .get(entry.path) as { count: number; maximum: number };
      expect(chunks.count).toBeGreaterThan(1);
      expect(chunks.maximum).toBeLessThanOrEqual(64 * 1024);
      const metadata = db.prepare("SELECT value FROM observation_records WHERE kind='inventory' AND key=?").get(entry.path) as { value: string };
      expect(Buffer.byteLength(metadata.value)).toBeLessThan(1024);
    } finally { db.close(); }
    const lazy = store.inventoryEntriesAt<typeof entry>(first.generation)[0]!;
    const addressedLazy = store.inventoryEntryAt<typeof entry>(first.generation, entry.path)!;
    expect(Object.getOwnPropertyDescriptor(lazy, "content")?.get).toBeTypeOf("function");
    expect(Object.getOwnPropertyDescriptor(addressedLazy, "content")?.get).toBeTypeOf("function");
    expect(addressedLazy.content).toBe(content);
    expect(lazy.content).toBe(content);
    expect(store.get<typeof entry>("inventory", entry.path)).toEqual(entry);
    const damage = new DatabaseSync(path);
    try {
      const row = damage.prepare("SELECT content FROM observation_inventory_content WHERE path=? AND sequence=1").get(entry.path) as { content: Uint8Array };
      damage.prepare("DELETE FROM observation_inventory_content WHERE path=? AND sequence=1").run(entry.path);
      expect(() => lazy.content).toThrow(/byte count changed/);
      expect(() => [...(lazy as typeof entry & {contentChunks:()=>Iterable<Uint8Array>}).contentChunks()]).toThrow(/byte count changed/);
      damage.prepare("INSERT INTO observation_inventory_content(path,sequence,content) VALUES(?,?,?)").run(entry.path,1,row.content);
      damage.prepare("UPDATE observation_inventory_content SET content=? WHERE path=? AND sequence=1").run(Buffer.alloc(row.content.length, 65),entry.path);
      expect(() => lazy.content).toThrow(/hash changed/);
      expect(() => [...(lazy as typeof entry & {contentChunks:()=>Iterable<Uint8Array>}).contentChunks()]).toThrow(/hash changed/);
      damage.prepare("UPDATE observation_inventory_content SET content=? WHERE path=? AND sequence=1").run(row.content,entry.path);
    } finally { damage.close(); }
    const second = store.publish(first.generation, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "inventory", key: entry.path, value: { ...entry, content: "revised", contentHash: sourceHash("revised") } }],
    });
    expect(second.generation).toBe(first.generation + 1);
    expect(() => lazy.content).toThrow(/generation changed/i);
    expect(() => addressedLazy.content).toThrow(/generation changed/i);
    expect(() => [...(addressedLazy as typeof entry & {contentChunks:()=>Iterable<Uint8Array>}).contentChunks()]).toThrow(/generation changed/i);
    const failed = { ...entry, content: "unpublished" };
    expect(() => store.publish(second.generation, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "inventory", key: entry.path, value: failed }],
    }, { signal: AbortSignal.abort(new Error("cancelled")) })).toThrow("cancelled");
    expect(store.head()).toEqual(second);
    expect(store.get<typeof entry>("inventory", entry.path)?.content).toBe("revised");
  } finally { store.close(); }
});
it("streams addressed raw inventory chunks without assembling a whole-file buffer", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-inventory-stream-")); roots.push(root);
  const path = join(root, "index.db"), source = Buffer.allocUnsafe(256 * 1024 + 5);
  for(let index=0;index<source.length;index++)source[index]=index%251;
  const store = new SqliteObservationStore(path);
  try {
    const entry = Object.defineProperties({path:"src/raw.bin",kind:"file",content:source.toString("utf8"),
      contentHash:hashFramedDomain("repository-artifact-content",source.toString("base64"))},{
      contentChunks:{value:():Iterable<Uint8Array>=>[source]},contentBytes:{value:source.length},
    });
    const first=store.publish(null,{contract:"source",metadata:{}},{upserts:[{kind:"inventory",key:entry.path,value:entry}]});
    const lazy=store.inventoryEntryAt<typeof entry>(first.generation,entry.path)!;
    const chunks=(lazy as typeof entry & {contentChunks:()=>Iterable<Uint8Array>}).contentChunks;
    const rawDigest=createHash("sha256");let count=0,maximum=0;
    const concat=vi.spyOn(Buffer,"concat").mockImplementation(()=>{throw new Error("whole-file allocation");});
    let secondGeneration=0;
    try {
      for(const chunk of chunks()){
        count+=chunk.length;maximum=Math.max(maximum,chunk.length);rawDigest.update(chunk);
      }
      secondGeneration=store.publish(first.generation,{contract:"source",metadata:{}},{upserts:[{kind:"inventory",key:entry.path,value:lazy}]}).generation;
    }finally{concat.mockRestore();}
    expect(count).toBe(source.length);
    expect(maximum).toBeLessThanOrEqual(64*1024);
    expect(rawDigest.digest("hex")).toBe(createHash("sha256").update(source).digest("hex"));
    expect(secondGeneration).toBe(first.generation+1);
    expect(store.get<typeof entry>("inventory",entry.path)?.contentHash).toBe(entry.contentHash);
  }finally{store.close();}
});
it("validates captured symlink targets with symlink rather than file hash framing", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-inventory-symlink-")); roots.push(root);
  const store = new SqliteObservationStore(join(root, "index.db"));
  try {
    const target = "../shared/source.ts";
    const entry = { path: "src/link.ts", kind: "symlink", mediaType: "inode/symlink",
      generated: false, symlinkTarget: target, content: target,
      contentHash: hashFramedDomain("repository-artifact-content", target) };
    const first = store.publish(null, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "inventory", key: entry.path, value: entry }],
    });
    const lazy=store.inventoryEntriesAt<typeof entry>(first.generation)[0]!;
    expect(lazy.content).toBe(target);
    const raw=[...(lazy as typeof entry & {contentChunks:()=>Iterable<Uint8Array>}).contentChunks()];
    expect(Buffer.from(raw[0]!).toString("utf8")).toBe(target);
    expect(store.get<typeof entry>("inventory", entry.path)).toEqual(entry);
  } finally { store.close(); }
});
it("republishes addressed binary inventory from its verified raw chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-inventory-binary-")); roots.push(root);
  const path = join(root, "index.db"), source = Buffer.from([0x66,0x6f,0x80,0xff,0x00,0x6f]);
  const store = new SqliteObservationStore(path);
  try {
    const entry = Object.defineProperties({ path: "src/raw.bin", kind: "file", content: source.toString("utf8"),
      contentHash: hashFramedDomain("repository-artifact-content",source.toString("base64")) },{
      contentChunks:{value:():Iterable<Uint8Array>=>[source]},
      contentBytes:{value:source.length},
    });
    const first = store.publish(null, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "inventory", key: entry.path, value: entry }],
    });
    const addressed = store.get<typeof entry>("inventory", entry.path)!;
    expect(Object.getOwnPropertyDescriptor(addressed,"contentBytes")?.value).toBe(source.length);
    expect(Object.getOwnPropertyDescriptor(addressed,"contentChunks")?.enumerable).toBe(false);
    const second = store.publish(first.generation, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "inventory", key: entry.path, value: addressed }],
    });
    expect(second.generation).toBe(first.generation + 1);
    const db = new DatabaseSync(path);
    try {
      const parts = db.prepare("SELECT content FROM observation_inventory_content WHERE path=? ORDER BY sequence").all(entry.path) as {content:Uint8Array}[];
      expect(Buffer.concat(parts.map((part)=>Buffer.from(part.content)))).toEqual(source);
    } finally { db.close(); }
    expect(store.get<typeof entry>("inventory",entry.path)?.content).toBe(source.toString("utf8"));
  } finally { store.close(); }
});
it("promotes typed staged rows with the same override order and atomic head as direct publication", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-stage-")); roots.push(root);
  const direct = new SqliteObservationStore(join(root, "direct.db"));
  const staged = new SqliteObservationStore(join(root, "staged.db"));
  const descriptor = { schemaVersion: "projector.observation-stage/v1" as const, path: join(root, "facts.db") };
  try {
    const baseline = {
      upserts: [{ kind: "file", key: "removed", value: "prior" }, { kind: "file", key: "changed", value: "prior" }],
      populations: [{ selector: "sources", member: "old", present: true }],
      dependencies: [{ consumer: "unit", input: "old", present: true }],
    };
    const first = direct.publish(null, { contract: "source", metadata: {} }, baseline);
    expect(staged.publish(null, { contract: "source", metadata: {} }, baseline)).toEqual(first);
    const stagedDelta = {
      deletes: [{ kind: "file", key: "removed" }],
      upserts: [{ kind: "file", key: "changed", value: "stage-first" },
        { kind: "file", key: "changed", value: "stage-last" },
        { kind: "inventory", key: "src/a.ts", value: { path: "src/a.ts", kind: "file", content: "x".repeat(90_000) } }],
      populations: [{ selector: "sources", member: "old", present: false },
        { selector: "sources", member: "new", present: true }],
      dependencies: [{ consumer: "unit", input: "old", present: false },
        { consumer: "unit", input: "new", present: true }],
    };
    const delta = {
      upserts: [{ kind: "file", key: "changed", value: "delta-wins" }],
      populations: [{ selector: "sources", member: "new", present: false }],
      dependencies: [{ consumer: "unit", input: "new", present: false }],
    };
    const spool = new SqliteObservationStage(descriptor, true);
    spool.write(stagedDelta); spool.finish(); spool.close();
    const next = { contract: "source", metadata: { revision: 2 } };
    const directHead = direct.publish(first.generation, next, {
      deletes: stagedDelta.deletes,
      upserts: [...stagedDelta.upserts, ...delta.upserts],
      populations: [...stagedDelta.populations, ...delta.populations],
      dependencies: [...stagedDelta.dependencies, ...delta.dependencies],
    });
    expect(staged.publish(first.generation, next, delta, { stage: descriptor })).toEqual(directHead);
    for (const store of [direct, staged]) {
      expect(store.get("file", "removed")).toBeUndefined();
      expect(store.get("file", "changed")).toBe("delta-wins");
      expect(store.get<{content:string}>("inventory", "src/a.ts")?.content).toBe("x".repeat(90_000));
      expect(store.population("sources")).toEqual([]);
      expect(store.dependents("new")).toEqual([]);
    }
    const directDb = new DatabaseSync(direct.path), stagedDb = new DatabaseSync(staged.path);
    try {
      expect(stagedDb.prepare("SELECT bytes FROM observation_accounting").get()).toEqual(directDb.prepare("SELECT bytes FROM observation_accounting").get());
      stagedDb.exec("CREATE TRIGGER interrupt_stage BEFORE UPDATE ON observation_head BEGIN SELECT RAISE(ABORT,'stage rollback'); END");
      expect(() => staged.publish(directHead.generation, next, { upserts: [{ kind: "file", key: "later", value: 1 }] }, { stage: descriptor })).toThrow("stage rollback");
      expect(staged.head()).toEqual(directHead);
      expect(staged.get("file", "later")).toBeUndefined();
    } finally { directDb.close(); stagedDb.close(); }
  } finally { direct.close(); staged.close(); }
});
it("keeps a completed reader snapshot usable while a staged writer publishes", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-wal-")); roots.push(root);
  const path = join(root, "index.db"), descriptor = {
    schemaVersion: "projector.observation-stage/v1" as const, path: join(root, "facts.db"),
  };
  const writer = new SqliteObservationStore(path), reader = new SqliteObservationStore(path);
  try {
    const first = writer.publish(null, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "file", key: "a", value: "before" }],
    });
    const spool = new SqliteObservationStage(descriptor, true);
    spool.write({ upserts: [{ kind: "file", key: "a", value: "after" }] });
    spool.finish(); spool.close();
    reader.readGeneration(first.generation, () => {
      expect(reader.get("file", "a")).toBe("before");
      const next = writer.publish(first.generation, { contract: "source", metadata: {} }, {}, { stage: descriptor });
      expect(next.generation).toBe(first.generation + 1);
      expect(reader.get("file", "a")).toBe("before");
    });
    expect(reader.get("file", "a")).toBe("after");
  } finally { reader.close(); writer.close(); }
});
it("keeps staged rows invisible when capacity or cancellation aborts publication", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-stage-abort-")); roots.push(root);
  const store = new SqliteObservationStore(join(root, "index.db"), { maxBytes: 1024 });
  const descriptor = { schemaVersion: "projector.observation-stage/v1" as const, path: join(root, "facts.db") };
  try {
    const first = store.publish(null, { contract: "source", metadata: {} }, {
      upserts: [{ kind: "file", key: "a", value: "before" }],
    });
    const spool = new SqliteObservationStage(descriptor, true);
    spool.write({ upserts: [{ kind: "file", key: "a", value: "replaced" },
      { kind: "file", key: "oversized", value: "x".repeat(2_000) }] });
    spool.finish(); spool.close();
    expect(() => store.publish(first.generation, { contract: "source", metadata: {} }, {}, { stage: descriptor })).toThrow(/capacity/);
    expect(store.head()).toEqual(first);
    expect(store.get("file", "a")).toBe("before");
    expect(store.has("file", "oversized")).toBe(false);
    expect(() => store.publish(first.generation, { contract: "source", metadata: {} }, {}, {
      stage: descriptor, signal: AbortSignal.abort(new Error("cancelled")),
    })).toThrow("cancelled");
    expect(store.head()).toEqual(first);
  } finally { store.close(); }
});
it.runIf(process.platform === "win32")("opens and attaches staged SQLite files under long Windows cache paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-long-stage-")); roots.push(root);
  const longDirectory = join(root, "cache".repeat(16), "checkout".repeat(12), "observations".repeat(5));
  await mkdir(longDirectory, { recursive: true });
  const descriptor = { schemaVersion: "projector.observation-stage/v1" as const, path: join(longDirectory, "facts.db") };
  expect(descriptor.path.length).toBeGreaterThan(260);
  const spool = new SqliteObservationStage(descriptor, true);
  spool.write({ upserts: [{ kind: "file", key: "a", value: "long-path" }] });
  spool.finish(); spool.close();
  const store = new SqliteObservationStore(join(longDirectory, "index.db"));
  try {
    store.publish(null, { contract: "source", metadata: {} }, {}, { stage: descriptor });
    expect(store.get("file", "a")).toBe("long-path");
  } finally { store.close(); }
});

it("rolls back admitted rows and edges when later admission fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-capacity-")); roots.push(root);
  const store = new SqliteObservationStore(join(root, "index.db"), { maxBytes: 1024 });
  try {
    const prior = store.publish(null, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "a", value: "original" }] });
    expect(() => store.publish(prior.generation, { contract: "v1", metadata: {} }, { upserts: [
      { kind: "file", key: "a", value: "changed" }, { kind: "file", key: "b", value: "large".repeat(1000) },
    ] })).toThrow("capacity");
    expect(store.head()).toEqual(prior);
    expect(store.get("file", "a")).toBe("original");
    expect(store.has("file", "b")).toBe(false);
  } finally { store.close(); }
});

it("leaves total storage uncapped by default and honors an explicitly configured capacity", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-optional-capacity-")); roots.push(root);
  const path = join(root, "index.db");
  const store = new SqliteObservationStore(path, { maxBytes: formerDefaultCacheBytes + 1 });
  try {
    const head = store.publish(null, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "a", value: "content" }] });
    expect(head.generation).toBe(1);
  } finally { store.close(); }
  const uncapped = new SqliteObservationStore(path);
  try {
    const head = uncapped.head()!;
    expect(uncapped.publish(head.generation, head, { upserts: [{ kind: "file", key: "b", value: "larger".repeat(1000) }] }).generation).toBe(2);
    const database = new DatabaseSync(path);
    try {
      const maximum = database.prepare("PRAGMA max_page_count").get() as { max_page_count: number };
      expect(maximum.max_page_count).toBeGreaterThan(formerDefaultCacheBytes / 4096);
    } finally { database.close(); }
  } finally { uncapped.close(); }
});

it("preserves the SQLite full error and prior head after SQLite rolls back a publication", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-sqlite-full-")); roots.push(root);
  const path = join(root, "index.db");
  const store = new SqliteObservationStore(path);
  try {
    const head = store.publish(null, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "a", value: "before" }] });
    const database = (store as unknown as { database: DatabaseSync }).database;
    const pages = database.prepare("PRAGMA page_count").get() as { page_count: number };
    database.exec(`PRAGMA max_page_count=${pages.page_count + 1}`);
    expect(() => store.publish(head.generation, head, { upserts: [{ kind: "file", key: "large", value: "x".repeat(256 * 1024) }] }))
      .toThrow(/database or disk is full/i);
    expect(store.head()).toEqual(head);
    expect(store.get("file", "a")).toBe("before");
    expect(store.has("file", "large")).toBe(false);
  } finally { store.close(); }
});

it("reports addressed writes by record kind, including disposable source-cache writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-write-kinds-")); roots.push(root);
  const store = new SqliteObservationStore(join(root, "index.db"));
  try {
    const head = store.publish(null, { contract: "v1", metadata: {} }, {
      upserts: [
        { kind: "file", key: "a", value: "source" },
        { kind: "cache-source", key: "a", value: { content: "source", lastUsedMs: 1 } },
      ],
      populations: [{ selector: "source", member: "file:a", present: true }],
      dependencies: [{ consumer: "file:a", input: "config", present: true }],
    });
    store.publish(head.generation, head, { deletes: [{ kind: "cache-source", key: "a" }] }, { retainGeneration: true });
    expect(store.metrics.rowsWritten).toBe(5);
    expect(store.metrics.writesByKind).toEqual({
      file: 1,
      "cache-source": 2,
      observation_populations: 1,
      observation_dependencies: 1,
    });
  } finally { store.close(); }
});

it("reads and writes only addressed rows as unrelated content grows", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-locality-")); roots.push(root);
  const store = new SqliteObservationStore(join(root, "index.db"));
  try {
    let head = store.publish(null, { contract: "v1", metadata: {} }, { upserts: Array.from({ length: 1000 }, (_, index) => ({ kind: "file", key: `unrelated-${index}`, value: "unrelated" })) });
    const before = { ...store.metrics };
    head = store.publish(head.generation, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "relevant", value: "changed" }] });
    expect(store.get("file", "relevant")).toBe("changed");
    expect(store.metrics.rowsRead - before.rowsRead).toBe(1);
    expect(store.metrics.rowsWritten - before.rowsWritten).toBe(1);
    expect(head.generation).toBe(2);
  } finally { store.close(); }
});

it("pins addressed reads to one completed generation across competing connections", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-read-")); roots.push(root);
  const first = new SqliteObservationStore(join(root, "index.db"));
  const second = new SqliteObservationStore(join(root, "index.db"));
  try {
    const head = first.publish(null, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "a", value: "before" }] });
    const result = first.readGeneration(head.generation, (reader) => {
      const before = reader.get("file", "a");
      expect(second.publish(head.generation, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "a", value: "after" }] }).generation).toBe(head.generation + 1);
      return [before, reader.get("file", "a")];
    });
    expect(result).toEqual(["before", "before"]);
    expect(first.head()?.generation).toBe(head.generation + 1);
    expect(first.get("file", "a")).toBe("after");
    expect(() => first.readGeneration(head.generation, () => null)).toThrow("generation changed");
  } finally { first.close(); second.close(); }
});

it("rejects retained-generation cache mutation after a competing insert or touch", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-cache-race-")); roots.push(root);
  const first = new SqliteObservationStore(join(root, "index.db"));
  const second = new SqliteObservationStore(join(root, "index.db"));
  try {
    const head = first.publish(null, { contract: "v1", metadata: {} }, {});
    second.publish(head.generation, head, {upserts:[{kind:"cache-source",key:"a",value:{content:"winner",lastUsedMs:1}}]}, {retainGeneration:true});
    expect(() => first.publish(head.generation,head,{upserts:[{kind:"cache-source",key:"a",value:{content:"loser",lastUsedMs:2}}]}, {retainGeneration:true,assertions:[{kind:"cache-source",key:"a",expected:undefined}]})).toThrow("changed after inspection");
    const inspected = first.get("cache-source","a");
    second.publish(head.generation,head,{upserts:[{kind:"cache-source",key:"a",value:{content:"winner",lastUsedMs:3}}]}, {retainGeneration:true});
    expect(() => first.publish(head.generation,head,{deletes:[{kind:"cache-source",key:"a"}]}, {retainGeneration:true,assertions:[{kind:"cache-source",key:"a",expected:inspected}]})).toThrow("changed after inspection");
    expect(first.get("cache-source","a")).toEqual({content:"winner",lastUsedMs:3});
    second.publish(head.generation,{contract:"v1",metadata:{cursor:"new"}},{},{retainGeneration:true});
    first.publish(head.generation,head,{upserts:[{kind:"query-cache",key:"result",value:"memo"}]},{retainGeneration:true,preserveMetadata:true});
    expect(first.head()?.metadata).toEqual({cursor:"new"});
  } finally { first.close(); second.close(); }
});

it("rejects an external observation directory redirected outside its cache owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-path-")); roots.push(root);
  const outside = await mkdtemp(join(tmpdir(), "projector-observation-outside-")); roots.push(outside);
  const original=process.env.PROJECTOR_CACHE_DIRECTORY;
  process.env.PROJECTOR_CACHE_DIRECTORY=join(root,"cache");
  try {
    const location=await checkoutCacheLocation(root);
    await mkdir(join(location.cacheRoot, ".projector", "runtime"), { recursive: true });
    await symlink(outside, join(location.cacheRoot, ".projector", "runtime", "observations"), process.platform === "win32" ? "junction" : "dir");
    await expect(SqliteObservationStore.open(root)).rejects.toThrow();
  } finally { if(original===undefined)delete process.env.PROJECTOR_CACHE_DIRECTORY;else process.env.PROJECTOR_CACHE_DIRECTORY=original; }
});
