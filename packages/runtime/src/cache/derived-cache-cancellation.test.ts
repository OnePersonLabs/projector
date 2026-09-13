import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { withDerivedCacheAdmission } from "./derived-cache.js";

const boundary = vi.hoisted(() => ({ afterLink: undefined as undefined | ((destination: string) => void) }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, link: async (source: string, destination: string) => {
    await actual.link(source, destination);
    boundary.afterLink?.(destination);
  } };
});
afterEach(() => { boundary.afterLink = undefined; });

it("rejects cancellation at final publication and removes only its new context inode", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-cache-cancellation-"));
  const contexts = ".projector/runtime/knowledge/contexts";
  await mkdir(join(root, contexts), { recursive: true });
  const existing = `${contexts}/${"a".repeat(32)}.json`;
  const finalContext = `${contexts}/${"c".repeat(32)}.json`;
  const impact = `.projector/runtime/impact/${"b".repeat(64)}.json`;
  await withDerivedCacheAdmission(root, (cache) => cache.publish(existing, "existing authenticated bytes"));
  const controller = new AbortController();
  const cancellation = new Error("cancelled while final context link completed");
  boundary.afterLink = (destination) => { if (destination === join(root, finalContext)) controller.abort(cancellation); };
  await expect(withDerivedCacheAdmission(root, (cache) => cache.publishAll([
    { relativePath: existing, content: "existing authenticated bytes" },
    { relativePath: impact, content: "new dependency" },
    { relativePath: finalContext, content: "new context" },
  ]), { signal: controller.signal })).rejects.toBe(cancellation);
  expect(await readFile(join(root, existing), "utf8")).toBe("existing authenticated bytes");
  await expect(readFile(join(root, finalContext))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(root, impact), "utf8")).toBe("new dependency");
  expect(await readdir(join(root, contexts))).toEqual([`${"a".repeat(32)}.json`]);
});
