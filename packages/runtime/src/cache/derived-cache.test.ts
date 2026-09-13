import { link, mkdir, mkdtemp, readFile, readdir, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { withDerivedCacheAdmission } from "./derived-cache.js";

const context = `.projector/runtime/knowledge/contexts/${"a".repeat(32)}.json`;
const impact = `.projector/runtime/impact/${"b".repeat(64)}.json`;
async function project() { const root = await mkdtemp(join(tmpdir(), "projector-cache-")); await mkdir(join(root, ".projector/runtime"), { recursive: true }); return root; }

it("reserves the complete batch and staging before publishing any context or dependency", async () => {
  const root = await project();
  await expect(withDerivedCacheAdmission(root, (cache) => cache.publishAll([
    { relativePath: impact, content: "1234567890" }, { relativePath: context, content: "123456" },
  ]), { maxBytes: 20 })).rejects.toMatchObject({ code: "cache-capacity" });
  expect(await readdir(join(root, ".projector/runtime"))).toEqual([]);
});

it("serializes concurrent admissions and rejects the writer that cannot fit", async () => {
  const root = await project();
  const results = await Promise.allSettled([
    withDerivedCacheAdmission(root, (cache) => cache.publish(context, "1234567890"), { maxBytes: 20 }),
    withDerivedCacheAdmission(root, (cache) => cache.publish(impact, "1234567890"), { maxBytes: 20 }),
  ]);
  expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
  await withDerivedCacheAdmission(root, async (cache) => { expect(cache.totalBytes).toBe(10); });
});

it("reuses identical content without staging and refuses a corrupted address", async () => {
  const root = await project();
  await withDerivedCacheAdmission(root, (cache) => cache.publish(context, "1234567890"), { maxBytes: 20 });
  await withDerivedCacheAdmission(root, (cache) => cache.publish(context, "1234567890"), { maxBytes: 10 });
  await expect(withDerivedCacheAdmission(root, (cache) => cache.publish(context, "different"))).rejects.toMatchObject({ code: "cache-corrupt" });
  expect(await readFile(join(root, context), "utf8")).toBe("1234567890");
});

it("counts interrupted staging and permits cleanup of a cache already over capacity", async () => {
  const root = await project();
  await mkdir(join(root, ".projector/runtime/knowledge/contexts"), { recursive: true });
  await writeFile(join(root, `${context}.123.456.tmp`), "123456789012345678901");
  await withDerivedCacheAdmission(root, async (cache) => {
    expect(cache.totalBytes).toBe(21);
    await expect(cache.publish(context, "x")).rejects.toMatchObject({ code: "cache-capacity" });
    await cache.remove(cache.entries[0]!);
    await cache.publish(context, "x");
  }, { maxBytes: 20 });
});

it("recovers an exited cache writer and accounts for both interrupted publication links", async () => {
  const root = await project();
  await mkdir(join(root, ".projector/runtime/cache-admission/owner-2147483647-11111111-1111-4111-8111-111111111111"), { recursive: true });
  await mkdir(join(root, ".projector/runtime/knowledge/contexts"), { recursive: true });
  await writeFile(join(root, context), "1234567890");
  await link(join(root, context), join(root, `${context}.2147483647.11111111-1111-4111-8111-111111111111.tmp`));
  await withDerivedCacheAdmission(root, async (cache) => {
    expect(cache.totalBytes).toBe(20);
    await cache.remove(cache.entries.find(({ kind }) => kind === "staging")!);
    expect(cache.totalBytes).toBe(10);
  });
  expect(await readFile(join(root, context), "utf8")).toBe("1234567890");
});

it("reuses an unchanged cache address after a reader updates its LRU timestamp", async () => {
  const root = await project();
  await withDerivedCacheAdmission(root, (cache) => cache.publish(context, "same bytes"));
  await withDerivedCacheAdmission(root, async (cache) => {
    await utimes(join(root, context), new Date(1), new Date(1));
    await cache.publish(context, "same bytes");
  });
  expect(await readFile(join(root, context), "utf8")).toBe("same bytes");
});

it("does not publish after the caller's observation deadline", async () => {
  const root = await project();
  await expect(withDerivedCacheAdmission(root, (cache) => cache.publish(context, "too late"), { deadline: Date.now() - 1 })).rejects.toMatchObject({ code: "cache-budget" });
  expect(await readdir(join(root, ".projector/runtime"))).toEqual([]);
});
