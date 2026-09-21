import { createHash } from "node:crypto";
import { DerivedObservationBudget, ObservationBudget, ObservationError, type AnalyzerFailure, type SourceClass } from "@projector/core";
import { compareCodePoint } from "../ordering.js";
import { normalizeJavaScriptSemantics } from "../typescript/facts.js";
import { isExcludedInventoryPath, type InventoryEntry } from "../filesystem/inventory.js";
import { observationGit, observationGitBytes, observationMap } from "../filesystem/observation-io.js";

export interface GitIdentityFact {
  readonly sourceClass: SourceClass; readonly path: string; readonly tracked: boolean | "unknown";
  readonly availability: "available" | "unavailable";
  readonly introductionHistory: "available" | "unavailable" | "not-applicable";
  readonly objectId?: string; readonly introductionCommit?: string;
}
export interface GitMoveFact {
  readonly sourceClass: SourceClass; readonly fromPath: string; readonly toPath: string;
  readonly status: "staged-rename" | "working-tree-rename";
}
export interface GitFacts {
  readonly availability: "available" | "unavailable"; readonly revision: string;
  readonly identities: GitIdentityFact[]; readonly moves: GitMoveFact[]; readonly failures: AnalyzerFailure[];
  readonly pendingMoveCandidates?: { readonly deleted: readonly { path: string; content: string }[]; readonly untracked: readonly { path: string; content: string }[] };
}
function parseTracked(output: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const record of output.split("\0")) {
    const match = /^\d+ ([0-9a-f]+) \d+\t([\s\S]+)$/u.exec(record);
    if (match?.[1] !== undefined && match[2] !== undefined) result.set(match[2], match[1]);
  }
  return result;
}
function parseIntroductionHistory(output: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const segment of output.split("\x1e").slice(1)) {
    const separator = segment.indexOf("\0"); if (separator < 1) continue;
    const commit = segment.slice(0, separator); if (!/^[0-9a-f]+$/u.test(commit)) continue;
    let names = segment.slice(separator + 1);
    if (names.startsWith("\0\n")) names = names.slice(2); else if (names.startsWith("\n")) names = names.slice(1);
    for (const path of names.split("\0").filter(Boolean)) result.set(path, commit);
  }
  return result;
}
function parseStatus(output: string): { moves: GitMoveFact[]; deleted: string[]; untracked: string[] } {
  const records = output.split("\0"), moves: GitMoveFact[] = [], deleted: string[] = [], untracked: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]; if (!record) continue;
    const status = record.slice(0, 2), path = record.slice(3);
    if (/R/u.test(status)) {
      const fromPath = records[++index]; if (fromPath && !isExcludedInventoryPath(fromPath) && !isExcludedInventoryPath(path)) moves.push({ sourceClass: "derived", fromPath, toPath: path,
        status: status[0] === "R" ? "staged-rename" : "working-tree-rename" });
    } else if (!isExcludedInventoryPath(path) && (status === " D" || status === "D ")) deleted.push(path);
    else if (!isExcludedInventoryPath(path) && status === "??") untracked.push(path);
  }
  return { moves, deleted: deleted.sort(compareCodePoint), untracked: untracked.sort(compareCodePoint) };
}
function parseHeadTree(output: string): Map<string, string> {
  const objects = new Map<string, string>();
  for (const record of output.split("\0")) {
    const match = /^(?:\d+) (?:blob|commit|tree) ([0-9a-f]{40,64})\t([\s\S]+)$/u.exec(record);
    if (match?.[1] !== undefined && match[2] !== undefined) objects.set(match[2], match[1]);
  }
  return objects;
}
function parseBatchSizes(output: string, objectIds: readonly string[]): number[] {
  const lines = output.split("\n").filter(Boolean);
  if (lines.length !== objectIds.length) throw new Error("Git object-size batch returned an unexpected record count");
  return lines.map((line, index) => {
    const match = /^([0-9a-f]{40,64}) ([a-z]+) (\d+)$/u.exec(line);
    const objectId = objectIds[index]!;
    if (match?.[1] !== objectId || match[3] === undefined) throw new Error(`Invalid Git object-size header for ${objectId}`);
    const size = Number(match[3]);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Invalid Git object size for ${objectId}`);
    return size;
  });
}
function parseBatchContents(bytes: Buffer, objectIds: readonly string[], sizes: readonly number[], paths: readonly string[]): { path: string; content: string }[] {
  const deleted: { path: string; content: string }[] = [];
  let offset = 0;
  for (let index = 0; index < objectIds.length; index += 1) {
    const headerEnd = bytes.indexOf(0x0a, offset);
    const objectId = objectIds[index]!, size = sizes[index]!, path = paths[index]!;
    if (headerEnd < offset) throw new Error(`Missing Git content header for ${path}`);
    const header = bytes.subarray(offset, headerEnd).toString("ascii");
    if (!new RegExp(`^${objectId} [a-z]+ ${size}$`, "u").test(header)) throw new Error(`Invalid Git content header for ${path}`);
    const contentStart = headerEnd + 1, contentEnd = contentStart + size;
    if (contentEnd >= bytes.length || bytes[contentEnd] !== 0x0a) throw new Error(`Invalid Git content length for ${path}`);
    const content = bytes.subarray(contentStart, contentEnd).toString("utf8");
    deleted.push({ path, content }); offset = contentEnd + 1;
  }
  if (offset !== bytes.length) throw new Error("Git content batch has trailing bytes");
  return deleted;
}

/** Parent-side bounded I/O only; semantic move matching is deferred to the analysis worker. */
export async function collectGitFacts(repositoryRoot: string, paths: readonly string[], options: {
  budget?: ObservationBudget; signal?: AbortSignal; confirmedNonGit?: boolean; entries?: readonly InventoryEntry[];
} = {}): Promise<GitFacts> {
  if (options.confirmedNonGit) return {
    availability: "unavailable", revision: "filesystem", moves: [],
    identities: paths.map((path) => ({ sourceClass: "derived", path, tracked: "unknown", availability: "unavailable", introductionHistory: "unavailable" })),
    failures: [{ analyzerId: "projector.git-local", capability: "git-identity-and-moves", scope: ".git",
      message: "Confirmed non-Git repository has no Git identity or history.", recoverable: true, affectedClaimKinds: ["git-identity", "move-lineage"] }],
  };
  const budget = options.budget ?? new ObservationBudget();
  const git = (args: readonly string[], allowedExitCodes?: readonly number[]): Promise<string> => observationGit(repositoryRoot, args, budget,
    { ...(options.signal === undefined ? {} : { signal: options.signal }), ...(allowedExitCodes === undefined ? {} : { allowedExitCodes }) });
  const gitText = (args: readonly string[], input: string): Promise<string> => observationGit(repositoryRoot, args, budget,
    { ...(options.signal === undefined ? {} : { signal: options.signal }), input });
  const gitBytes = (args: readonly string[], input: string): Promise<Buffer> => observationGitBytes(repositoryRoot, args, budget,
    { ...(options.signal === undefined ? {} : { signal: options.signal }), input });
  // --verify --quiet returns 1 for an unborn branch; startup, permissions and malformed Git still fail.
  const commandResults = await observationMap([
    { args: ["rev-parse", "--verify", "--quiet", "HEAD"], allowedExitCodes: [1] },
    { args: ["ls-files", "--stage", "-z"], allowedExitCodes: [] },
    { args: ["status", "--porcelain=v1", "--untracked-files=all", "-z"], allowedExitCodes: [] },
  ], (command, signal) => observationGit(repositoryRoot, command.args, budget, { signal, allowedExitCodes: command.allowedExitCodes }), options.signal);
  const revisionOutput = commandResults[0]!;
  if (revisionOutput.trim() === "") {
    const headReference = (await git(["symbolic-ref", "--quiet", "HEAD"])).trim();
    const references = await git(["show-ref"], [1]);
    if (!headReference.startsWith("refs/heads/") || references.split("\n").some((record) => record.endsWith(` ${headReference}`))) {
      throw new ObservationError("observation-failed", "git-facts", "HEAD", "Git HEAD could not be resolved and is not a confirmed unborn branch.");
    }
  }
  const revision = revisionOutput.trim() || "unborn";
  const tracked = parseTracked(commandResults[1]!);
  const status = parseStatus(commandResults[2]!);
  const introductions = revision === "unborn" ? new Map<string, string>() : parseIntroductionHistory(await git([
    "log", "--no-ext-diff", "--diff-filter=A", "--format=%x1e%H%x00", "--name-only", "-z", "--",
  ]));
  const identities: GitIdentityFact[] = [];
  for (const path of paths) {
    budget.check("git-facts", path);
    const objectId = tracked.get(path);
    if (objectId === undefined) { identities.push({ sourceClass: "derived", path, tracked: false, availability: "available", introductionHistory: "not-applicable" }); continue; }
    let introductionCommit = introductions.get(path);
    if (introductionCommit === undefined && revision !== "unborn") {
      introductionCommit = (await git(["log", "--no-ext-diff", "--follow", "--diff-filter=A", "--format=%H", "--", path])).trim().split("\n").filter(Boolean).at(-1);
    }
    identities.push({ sourceClass: "derived", path, tracked: true, availability: "available", introductionHistory: revision === "unborn" ? "not-applicable" : "available", objectId,
      ...(introductionCommit === undefined ? {} : { introductionCommit }) });
  }
  let deleted: { path: string; content: string }[] = [];
  if (revision !== "unborn" && status.deleted.length > 0) {
    // The complete tree avoids shell/pathspec interpretation and remains bounded
    // by maxGitOutputBytes before a path-to-object map is retained.
    const tree = parseHeadTree(await git(["ls-tree", "-r", "-z", "HEAD"]));
    const objectIds = status.deleted.map((path) => {
      const objectId = tree.get(path);
      if (objectId === undefined) throw new Error(`Missing Git object for ${path}`);
      return objectId;
    });
    // Admit every object before the content batch can allocate it.
    const sizes = parseBatchSizes(await gitText(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], `${objectIds.join("\n")}\n`), objectIds);
    for (let index = 0; index < status.deleted.length; index += 1) {
      const path = status.deleted[index]!, size = sizes[index]!;
      budget.check("git-facts", path); budget.assertFileBytes(size, path); budget.consume("maxTotalBytes", size, "git-move-content", path);
    }
    deleted = parseBatchContents(await gitBytes(["cat-file", "--batch"], `${objectIds.join("\n")}\n`), objectIds, sizes, status.deleted);
    for (const candidate of deleted) budget.assertFileBytes(Buffer.byteLength(candidate.content), candidate.path);
  }
  const entryByPath = new Map((options.entries ?? []).filter((entry) => entry.kind === "file").map((entry) => [entry.path, entry]));
  const untracked = status.untracked.flatMap((path) => {
    const entry = entryByPath.get(path); return entry === undefined ? [] : [{ path, content: entry.content }];
  });
  return { availability: "available", revision, identities: identities.sort((a, b) => compareCodePoint(a.path, b.path)),
    moves: status.moves, failures: [], pendingMoveCandidates: { deleted, untracked } };
}

function moveFingerprint(path: string, content: string, budget: DerivedObservationBudget): string | undefined {
  // Collection exposes decoded text. Binary or undecodable inputs cannot prove
  // equal source bytes; retain Git-reported moves without inferring one here.
  if (content.includes("\0") || content.includes("\ufffd")) return undefined;
  const temporaryStart = budget.usedBytes;
  let fingerprint: string;
  try {
    const javaScript = /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path);
    const comparable = javaScript ? normalizeJavaScriptSemantics(content, budget, path) : content;
    fingerprint = createHash("sha256").update(javaScript ? "javascript\0" : "bytes\0").update(comparable).digest("hex");
  } finally { budget.release(budget.usedBytes - temporaryStart); }
  budget.reserveString(fingerprint.length, "git-move-fingerprint", path);
  return fingerprint;
}

/** Pure semantic analysis; safe to execute in a terminable worker. */
export function finalizeGitFacts(facts: GitFacts, budget = new DerivedObservationBudget()): GitFacts {
  const candidates = facts.pendingMoveCandidates;
  if (candidates === undefined) return facts;
  if (candidates.deleted.length === 0 || candidates.untracked.length === 0) return {
    availability: facts.availability, revision: facts.revision, identities: facts.identities, failures: facts.failures,
    moves: [...facts.moves].sort((a, b) => compareCodePoint(a.fromPath, b.fromPath) || compareCodePoint(a.toPath, b.toPath)),
  };
  const startedBytes = budget.usedBytes;
  let retainedMoveBytes = 0;
  try {
  budget.reserveItems(candidates.untracked.length, 128, "git-move-candidates");
  const contents = new Map(candidates.untracked.flatMap(({ path, content }) => {
    const fingerprint = moveFingerprint(path, content, budget);
    return fingerprint === undefined ? [] : [[path, fingerprint] as const];
  }));
  const moves = [...facts.moves];
  for (const { path: fromPath, content } of candidates.deleted) {
    const temporaryStart = budget.usedBytes;
    const retainedStart = retainedMoveBytes;
    try {
    const previous = moveFingerprint(fromPath, content, budget);
    if (previous === undefined) continue;
    const matches = [...contents].filter(([, value]) => value === previous).map(([path]) => path);
    if (matches.length !== 1) continue;
    const toPath = matches[0]!; contents.delete(toPath);
    const moveBytes = 192 + 2 * (fromPath.length + toPath.length);
    budget.reserve(moveBytes, "git-move-facts", fromPath); retainedMoveBytes += moveBytes;
    moves.push({ sourceClass: "derived", fromPath, toPath, status: "working-tree-rename" });
    } finally {
      // Only the matched move survives this iteration. Charging every discarded
      // normalized source until the end makes a large deletion look resident.
      budget.release(budget.usedBytes - temporaryStart - (retainedMoveBytes - retainedStart));
    }
  }
  return { availability: facts.availability, revision: facts.revision, identities: facts.identities, failures: facts.failures,
    moves: moves.filter((move, index) => moves.findIndex((candidate) => candidate.fromPath === move.fromPath && candidate.toPath === move.toPath) === index)
      .sort((a, b) => compareCodePoint(a.fromPath, b.fromPath) || compareCodePoint(a.toPath, b.toPath)) };
  } finally { budget.release(budget.usedBytes - startedBytes - retainedMoveBytes); }
}
