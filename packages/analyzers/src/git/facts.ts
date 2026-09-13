import { DerivedObservationBudget, ObservationBudget, ObservationError, type AnalyzerFailure, type SourceClass } from "@projector/core";
import { compareCodePoint } from "../ordering.js";
import { normalizeJavaScriptSemantics } from "../typescript/facts.js";
import { isExcludedInventoryPath, type InventoryEntry } from "../filesystem/inventory.js";
import { observationGit, observationMap } from "../filesystem/observation-io.js";

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
  const deleted: { path: string; content: string }[] = [];
  if (revision !== "unborn") for (const path of status.deleted) {
    // Object size is admitted before `show` allocates its content.
    const size = Number((await git(["cat-file", "-s", `HEAD:${path}`])).trim());
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Invalid Git object size for ${path}`);
    budget.assertFileBytes(size, path); budget.consume("maxTotalBytes", size, "git-move-content", path);
    const content = await git(["show", `HEAD:${path}`]);
    budget.assertFileBytes(Buffer.byteLength(content), path); deleted.push({ path, content });
  }
  const entryByPath = new Map((options.entries ?? []).filter((entry) => entry.kind === "file").map((entry) => [entry.path, entry]));
  const untracked = status.untracked.flatMap((path) => {
    const entry = entryByPath.get(path); return entry === undefined ? [] : [{ path, content: entry.content }];
  });
  return { availability: "available", revision, identities: identities.sort((a, b) => compareCodePoint(a.path, b.path)),
    moves: status.moves, failures: [], pendingMoveCandidates: { deleted, untracked } };
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
  const contents = new Map(candidates.untracked.map(({ path, content }) => [path, normalizeJavaScriptSemantics(content, budget, path)]));
  const moves = [...facts.moves];
  for (const { path: fromPath, content } of candidates.deleted) {
    const previous = normalizeJavaScriptSemantics(content, budget, fromPath);
    const matches = [...contents].filter(([, value]) => value === previous).map(([path]) => path);
    if (matches.length !== 1) continue;
    const toPath = matches[0]!; contents.delete(toPath);
    const moveBytes = 192 + 2 * (fromPath.length + toPath.length);
    budget.reserve(moveBytes, "git-move-facts", fromPath); retainedMoveBytes += moveBytes;
    moves.push({ sourceClass: "derived", fromPath, toPath, status: "working-tree-rename" });
  }
  return { availability: facts.availability, revision: facts.revision, identities: facts.identities, failures: facts.failures,
    moves: moves.filter((move, index) => moves.findIndex((candidate) => candidate.fromPath === move.fromPath && candidate.toPath === move.toPath) === index)
      .sort((a, b) => compareCodePoint(a.fromPath, b.fromPath) || compareCodePoint(a.toPath, b.toPath)) };
  } finally { budget.release(budget.usedBytes - startedBytes - retainedMoveBytes); }
}
