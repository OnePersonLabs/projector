import { DerivedObservationBudget, ObservationBudget, hashFramedDomain } from "@projector/core";
import { analyzeCollectedLocalRepository, type LocalRepositoryAnalysis } from "../local-repository.js";
import { type InventoryEntry, type InventoryResult } from "../filesystem/inventory.js";
import { checkObservation, observationGitBytes, observationGit } from "../filesystem/observation-io.js";

/** Analyze only immutable objects; never read checkout bytes, index, or ignore configuration. */
export async function analyzeGitTree(root: string, tree: string, budget: ObservationBudget, derived: DerivedObservationBudget, signal: AbortSignal): Promise<LocalRepositoryAnalysis> {
  const options = { signal, stage: "git-tree-analysis" };
  const listing = await observationGitBytes(root, ["ls-tree", "-r", "-z", tree], budget, options);
  const objects: Array<{ path: string; oid: string; mode: string; type: string }> = [];
  for (const record of new TextDecoder("utf-8", { fatal: true }).decode(listing).split("\0")) {
    if (!record) continue;
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error("Malformed immutable Git tree entry");
    const path = match[4]!;
    if (path === ".projector" || path.startsWith(".projector/") || path.startsWith(".git/") || path.startsWith(".worktrees/")) continue;
    budget.consume("maxFiles", 1, "git-tree-analysis", path);
    derived.reserve(256 + record.length * 2, "git-tree-analysis", path);
    objects.push({ path, oid: match[3]!, mode: match[1]!, type: match[2]! });
  }
  const failures: InventoryResult["failures"] = [];
  const selected = objects.filter(object => object.type === "blob");
  for (const object of objects.filter(object => object.type !== "blob")) failures.push({ analyzerId: "projector.git-tree", capability: "inventory", scope: object.path, recoverable: false, affectedClaimKinds: ["dependency-population"], message: "Submodule contents are outside this immutable tree." });
  const entries: InventoryEntry[] = [];
  if (selected.length) {
    const input = selected.map(object => object.oid).join("\n") + "\n";
    const sizes = (await observationGit(root, ["cat-file", "--batch-check"], budget, { ...options, input })).trimEnd().split("\n");
    if (sizes.length !== selected.length) throw new Error("Invalid immutable blob count");
    let total = 0;
    sizes.forEach((header, index) => {
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
      if (!match || match[1] !== selected[index]!.oid) throw new Error("Invalid immutable blob header");
      const size = Number(match[2]);
      if (!Number.isSafeInteger(size)) throw new Error("Invalid immutable blob size");
      budget.assertFileBytes(size, selected[index]!.path); total += size;
    });
    budget.assertTotalBytes(total, "git-tree-analysis");
    const bytes = await observationGitBytes(root, ["cat-file", "--batch"], budget, { ...options, input });
    let offset = 0;
    for (const object of selected) {
      checkObservation(budget, signal, "git-tree-analysis", object.path);
      const end = bytes.indexOf(10, offset), match = /^([a-f0-9]+) blob (\d+)$/.exec(bytes.subarray(offset, end).toString("ascii"));
      if (end < 0 || !match || match[1] !== object.oid) throw new Error("Invalid immutable blob framing");
      const size = Number(match[2]); offset = end + 1;
      if (!Number.isSafeInteger(size) || offset + size >= bytes.length || bytes[offset + size] !== 10) throw new Error("Truncated immutable blob");
      budget.consume("maxTotalBytes", size, "git-tree-analysis", object.path);
      const raw = bytes.subarray(offset, offset + size); offset += size + 1;
      const content = raw.toString("utf8"), generated = /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
      const mediaType = object.path.endsWith(".json") ? "application/json" : /\.ya?ml$/u.test(object.path) ? "application/yaml" : object.path.endsWith(".toml") ? "application/toml" : /\.(?:js|jsx|mjs|cjs)$/u.test(object.path) ? "text/javascript" : /\.(?:ts|tsx|mts|cts)$/u.test(object.path) ? "text/typescript" : object.path.endsWith(".md") ? "text/markdown" : "application/octet-stream";
      entries.push({ path: object.path, kind: object.mode === "120000" ? "symlink" : "file", mediaType, content, contentHash: hashFramedDomain("repository-artifact-content", raw.toString("base64")), generated, ...(generated ? { generatedReason: "source-marker" as const } : {}), ...(object.mode === "120000" ? { symlinkTarget: content } : {}) });
    }
    if (offset !== bytes.length) throw new Error("Unexpected immutable blob trailing bytes");
  }
  const inventoryResult: InventoryResult = { entries, failures, rootAvailability: "available", observationDescriptor: { schemaVersion: "projector.observation/v1", observerVersion: "3.0.0", scope: ".", enumerationMethod: "git-immutable-tree", limits: budget.limits, ignoreSources: [], excludedPaths: [".projector", ".git", ".worktrees"], globalGitConfig: "disabled" }, enumeration: { method: "git-immutable-tree", assumptions: ["All ordinary tracked blobs in the immutable tree are enumerated; checkout ignore rules are irrelevant"], blindSpots: ["Submodule contents", "runtime dependency resolution"] } };
  return analyzeCollectedLocalRepository({ options: { repositoryRoot: root, observationRevision: tree }, inventoryResult, gitFacts: { availability: "available", revision: tree, identities: objects.map(object => ({ sourceClass: "observed", path: object.path, tracked: true, availability: "available", introductionHistory: "unavailable", objectId: object.oid })), moves: [], failures: [] } }, derived);
}
