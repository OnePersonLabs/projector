import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertDirectoryTreeParity, compareDirectoryTrees } from "./directory-tree-parity.mjs";

const temporaryRoots: string[] = [];

async function trees() {
  const root = await mkdtemp(join(tmpdir(), "projector-tree-parity-"));
  temporaryRoots.push(root);
  const reference = join(root, "reference");
  const candidate = join(root, "candidate");
  await mkdir(join(reference, "nested"), { recursive: true });
  await mkdir(join(candidate, "nested"), { recursive: true });
  await writeFile(join(reference, "same.txt"), "same");
  await writeFile(join(candidate, "same.txt"), "same");
  return { root, reference, candidate };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("directory tree parity", () => {
  it("accepts identical regular-file trees", async () => {
    const { reference, candidate } = await trees();
    await writeFile(join(reference, "nested", "value.bin"), Buffer.from([0, 1, 2]));
    await writeFile(join(candidate, "nested", "value.bin"), Buffer.from([0, 1, 2]));
    await expect(assertDirectoryTreeParity(reference, candidate, "runtime drift")).resolves.toBeUndefined();
  });

  it("reports missing, unexpected, and byte-changed paths", async () => {
    const { reference, candidate } = await trees();
    await writeFile(join(reference, "missing.txt"), "reference");
    await writeFile(join(candidate, "unexpected.txt"), "candidate");
    await writeFile(join(reference, "nested", "changed.txt"), "before");
    await writeFile(join(candidate, "nested", "changed.txt"), "after");
    await expect(compareDirectoryTrees(reference, candidate)).resolves.toEqual({
      equal: false,
      missing: ["missing.txt"],
      unexpected: ["unexpected.txt"],
      changed: ["nested/changed.txt"],
    });
  });

  it("rejects linked entries instead of following outside the tree", async () => {
    const { reference, candidate } = await trees();
    await symlink(reference, join(candidate, "linked"), "junction");
    await expect(compareDirectoryTrees(reference, candidate)).rejects.toThrow("regular files and directories");
  });
});
