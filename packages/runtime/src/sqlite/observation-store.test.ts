import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ObservationBudget } from "@projector/core";
import { afterEach, expect, it } from "vitest";
import * as sqlite from "./index.js";
import { SqliteObservationStore } from "./index.js";
import { checkoutCacheLocation } from "../cache/location.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

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
      expect(() => second.publish(head.generation, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "a", value: "after" }] })).toThrow();
      return [before, reader.get("file", "a")];
    });
    expect(result).toEqual(["before", "before"]);
    expect(first.head()).toEqual(head);
    second.publish(head.generation, { contract: "v1", metadata: {} }, { upserts: [{ kind: "file", key: "a", value: "after" }] });
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
