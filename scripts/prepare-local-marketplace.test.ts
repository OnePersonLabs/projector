import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { publishLocalBundle } from "./prepare-local-marketplace.mjs";

vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return { ...fs, rename: vi.fn(fs.rename) };
});

const roots: string[] = [];
afterEach(async () => {
  vi.mocked(rename).mockClear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-publish-"));
  roots.push(root);
  const staged = join(root, "next");
  const destination = join(root, "plugin");
  await mkdir(staged);
  await mkdir(destination);
  await writeFile(join(staged, "content"), "current source");
  await writeFile(join(destination, "content"), "previous bundle");
  return { root, staged, destination };
}

it.runIf(process.platform === "win32")("publishes current bytes after transient Windows rename locks", async () => {
  const f = await fixture();
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(rename)
    .mockImplementationOnce(fs.rename)
    .mockRejectedValueOnce(Object.assign(new Error("scanner holds directory"), { code: "EPERM" }))
    .mockRejectedValueOnce(Object.assign(new Error("scanner holds directory"), { code: "EBUSY" }));
  await publishLocalBundle(f.staged, f.destination);
  expect(await readFile(join(f.destination, "content"), "utf8")).toBe("current source");
  expect(await readdir(f.root)).toEqual(["plugin"]);
});

it("restores the previous bundle when publication fails permanently", async () => {
  const f = await fixture();
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const failure = Object.assign(new Error("publication denied"), { code: "EIO" });
  vi.mocked(rename).mockImplementationOnce(fs.rename).mockRejectedValueOnce(failure);
  await expect(publishLocalBundle(f.staged, f.destination)).rejects.toBe(failure);
  expect(await readFile(join(f.destination, "content"), "utf8")).toBe("previous bundle");
  expect(await readFile(join(f.staged, "content"), "utf8")).toBe("current source");
  expect((await readdir(f.root)).sort()).toEqual(["next", "plugin"]);
});

it.runIf(process.platform === "win32")("bounds retries and restores the previous bundle when a Windows lock persists", async () => {
  const f = await fixture();
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const failure = Object.assign(new Error("persistent lock"), { code: "EPERM" });
  vi.mocked(rename).mockImplementationOnce(fs.rename);
  for (let attempt = 0; attempt < 5; attempt += 1) vi.mocked(rename).mockRejectedValueOnce(failure);
  await expect(publishLocalBundle(f.staged, f.destination)).rejects.toBe(failure);
  expect(await readFile(join(f.destination, "content"), "utf8")).toBe("previous bundle");
  expect((await readdir(f.root)).sort()).toEqual(["next", "plugin"]);
});
