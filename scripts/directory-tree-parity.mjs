import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

async function fileDigest(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

async function directoryManifest(root, relative = "", manifest = new Map()) {
  const directory = join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const entry of entries) {
    const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) await directoryManifest(root, path, manifest);
    else if (entry.isFile()) manifest.set(path, await fileDigest(join(root, path)));
    else throw new Error(`Directory parity requires regular files and directories: ${join(root, path)}`);
  }
  return manifest;
}

export async function compareDirectoryTrees(referenceRoot, candidateRoot) {
  const [reference, candidate] = await Promise.all([
    directoryManifest(referenceRoot),
    directoryManifest(candidateRoot),
  ]);
  const missing = [...reference.keys()].filter((path) => !candidate.has(path));
  const unexpected = [...candidate.keys()].filter((path) => !reference.has(path));
  const changed = [...reference.keys()].filter((path) => candidate.has(path) && candidate.get(path) !== reference.get(path));
  return { equal: missing.length === 0 && unexpected.length === 0 && changed.length === 0, missing, unexpected, changed };
}

export async function assertDirectoryTreeParity(referenceRoot, candidateRoot, message) {
  const comparison = await compareDirectoryTrees(referenceRoot, candidateRoot);
  if (comparison.equal) return;
  const details = [
    ...comparison.missing.map((path) => `missing ${path}`),
    ...comparison.unexpected.map((path) => `unexpected ${path}`),
    ...comparison.changed.map((path) => `changed ${path}`),
  ];
  throw new Error(`${message}\n${details.join("\n")}`);
}
