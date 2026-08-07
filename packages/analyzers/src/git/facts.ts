import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import type { AnalyzerFailure, SourceClass } from "@projector/core";

import { normalizeJavaScriptSemantics } from "../typescript/facts.js";

const execFileAsync = promisify(execFile);

export interface GitIdentityFact {
  readonly sourceClass: SourceClass;
  readonly path: string;
  readonly tracked: boolean;
  readonly objectId?: string;
  readonly introductionCommit?: string;
}

export interface GitMoveFact {
  readonly sourceClass: SourceClass;
  readonly fromPath: string;
  readonly toPath: string;
  readonly status: "working-tree-rename";
}

export interface GitFacts {
  readonly revision: string;
  readonly identities: GitIdentityFact[];
  readonly moves: GitMoveFact[];
  readonly failures: AnalyzerFailure[];
}

async function git(repositoryRoot: string, arguments_: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

function parseTracked(output: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const record of output.split("\0")) {
    if (record.length === 0) continue;
    const match = /^\d+ ([0-9a-f]+) \d+\t(.+)$/u.exec(record);
    if (match?.[1] !== undefined && match[2] !== undefined) result.set(match[2], match[1]);
  }
  return result;
}

function parseMoves(output: string): GitMoveFact[] {
  const records = output.split("\0");
  const moves: GitMoveFact[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || !/^R[ MADRCU?!]|^[ MADRCU?!]R/u.test(record.slice(0, 2))) continue;
    const toPath = record.slice(3);
    const fromPath = records[index + 1];
    if (fromPath === undefined || fromPath.length === 0) continue;
    moves.push({ sourceClass: "derived", fromPath, toPath, status: "working-tree-rename" });
    index += 1;
  }
  return moves.sort((left, right) => left.fromPath.localeCompare(right.fromPath) || left.toPath.localeCompare(right.toPath));
}

function changedPaths(output: string, status: string): string[] {
  return output.split("\0")
    .filter((record) => record.slice(0, 2) === status)
    .map((record) => record.slice(3))
    .sort();
}

function normalizeMoveCandidate(content: string): string {
  return normalizeJavaScriptSemantics(content);
}

async function inferUnstagedMoves(repositoryRoot: string, statusOutput: string): Promise<GitMoveFact[]> {
  const deletedPaths = [...changedPaths(statusOutput, " D"), ...changedPaths(statusOutput, "D ")];
  const untrackedPaths = changedPaths(statusOutput, "??");
  const available = new Set(untrackedPaths);
  const currentContents = new Map<string, string>();
  await Promise.all(untrackedPaths.map(async (path) => {
    try {
      currentContents.set(path, normalizeMoveCandidate(await readFile(resolve(repositoryRoot, path), "utf8")));
    } catch {
      // Binary/unreadable candidates are not guessed as semantic moves.
    }
  }));
  const result: GitMoveFact[] = [];
  for (const fromPath of deletedPaths) {
    let previous: string;
    try {
      previous = normalizeMoveCandidate(await git(repositoryRoot, ["show", `HEAD:${fromPath}`]));
    } catch {
      continue;
    }
    const matches = [...available].filter((path) => currentContents.get(path) === previous);
    if (matches.length !== 1) continue;
    const toPath = matches[0]!;
    available.delete(toPath);
    result.push({ sourceClass: "derived", fromPath, toPath, status: "working-tree-rename" });
  }
  return result;
}

export async function collectGitFacts(repositoryRoot: string, paths: readonly string[]): Promise<GitFacts> {
  try {
    const [revisionOutput, trackedOutput, statusOutput] = await Promise.all([
      git(repositoryRoot, ["rev-parse", "HEAD"]),
      git(repositoryRoot, ["ls-files", "--stage", "-z"]),
      git(repositoryRoot, ["status", "--porcelain=v1", "-z"]),
    ]);
    const tracked = parseTracked(trackedOutput);
    const identities = await Promise.all(paths.map(async (path): Promise<GitIdentityFact> => {
      const objectId = tracked.get(path);
      if (objectId === undefined) return { sourceClass: "derived", path, tracked: false };
      let introductionCommit: string | undefined;
      try {
        const history = await git(repositoryRoot, ["log", "--follow", "--diff-filter=A", "--format=%H", "--", path]);
        introductionCommit = history.trim().split("\n").filter(Boolean).at(-1);
      } catch {
        // Current tracked identity remains useful if per-file history is unavailable.
      }
      return {
        sourceClass: "derived",
        path,
        tracked: true,
        objectId,
        ...(introductionCommit === undefined ? {} : { introductionCommit }),
      };
    }));
    const explicitMoves = parseMoves(statusOutput);
    const inferredMoves = await inferUnstagedMoves(repositoryRoot, statusOutput);
    return {
      revision: revisionOutput.trim(),
      identities: identities.sort((left, right) => left.path.localeCompare(right.path)),
      moves: [...explicitMoves, ...inferredMoves]
        .filter((move, index, moves) => moves.findIndex((candidate) => candidate.fromPath === move.fromPath && candidate.toPath === move.toPath) === index)
        .sort((left, right) => left.fromPath.localeCompare(right.fromPath) || left.toPath.localeCompare(right.toPath)),
      failures: [],
    };
  } catch (error) {
    return {
      revision: "filesystem",
      identities: paths.map((path) => ({ sourceClass: "derived", path, tracked: false })),
      moves: [],
      failures: [{
        analyzerId: "projector.git-local",
        capability: "git-identity-and-moves",
        scope: ".git",
        message: error instanceof Error ? error.message : String(error),
        recoverable: true,
        affectedClaimKinds: ["git-identity", "move-lineage"],
      }],
    };
  }
}
