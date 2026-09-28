import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { removeAbandonedObservationTemporaryFiles } from "./observation-temporary-files.js";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

it("reclaims interrupted temporary databases and their sidecars while preserving unrelated files", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-temporary-")); roots.push(root);
  const owner = join(root, ".projector", "runtime", "observations");
  const indexPath = join(owner, "index.sqlite");
  const name = `${"a".repeat(32)}.db`;
  const directories = [owner, join(owner, "captures"), `${indexPath}.temporary`];
  for (const directory of directories) {
    await mkdir(directory, { recursive: true });
    for (const suffix of ["", "-journal", "-wal", "-shm"]) await writeFile(join(directory, name + suffix), "");
    await writeFile(join(directory, "unrelated.db"), "keep");
  }
  await writeFile(indexPath, "published");
  expect(removeAbandonedObservationTemporaryFiles(indexPath)).toBe(12);
  expect(await readdir(owner)).toEqual(expect.arrayContaining(["index.sqlite", "unrelated.db"]));
  for (const directory of directories) expect(await readdir(directory)).not.toContain(name);
  expect(removeAbandonedObservationTemporaryFiles(indexPath)).toBe(0);
});

it("isolates cleanup to one database's temporary directory outside the owned observation namespace", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-observation-temporary-boundary-")); roots.push(root);
  const indexPath = join(root, "index.sqlite");
  const name = `${"b".repeat(32)}.db`;
  await mkdir(`${indexPath}.temporary`);
  await mkdir(join(root, "other.sqlite.temporary"));
  await writeFile(join(root, name), "keep");
  await writeFile(join(root, "other.sqlite.temporary", name), "keep");
  await writeFile(join(`${indexPath}.temporary`, name), "discard");
  expect(removeAbandonedObservationTemporaryFiles(indexPath)).toBe(1);
  expect(await readdir(root)).toContain(name);
  expect(await readdir(join(root, "other.sqlite.temporary"))).toContain(name);
});
