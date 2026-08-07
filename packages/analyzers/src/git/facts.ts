import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import type { AnalyzerFailure, SourceClass } from "@projector/core";

import { compareCodePoint } from "../ordering.js";
import { normalizeJavaScriptSemantics } from "../typescript/facts.js";

const execFileAsync = promisify(execFile);

export interface GitIdentityFact {
  readonly sourceClass: SourceClass;
  readonly path: string;
  readonly tracked: boolean | "unknown";
  readonly availability: "available" | "unavailable";
  readonly introductionHistory: "available" | "unavailable" | "not-applicable";
  readonly objectId?: string;
  readonly introductionCommit?: string;
}

export interface GitMoveFact {
  readonly sourceClass: SourceClass;
  readonly fromPath: string;
  readonly toPath: string;
  readonly status: "staged-rename" | "working-tree-rename";
}

export interface GitFacts {
  readonly availability: "available" | "unavailable";
  readonly revision: string;
  readonly identities: GitIdentityFact[];
  readonly moves: GitMoveFact[];
  readonly failures: AnalyzerFailure[];
}

async function git(repositoryRoot: string, arguments_: readonly string[]): Promise<string> {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  const { stdout } = await execFileAsync("git", [...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...environment,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_OPTIONAL_LOCKS: "0",
    },
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

const safeGitConfig = [
  "-c", "core.fsmonitor=false",
  "-c", "core.untrackedCache=false",
  "-c", `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
] as const;

async function safeGit(repositoryRoot: string, arguments_: readonly string[]): Promise<string> {
  return git(repositoryRoot, [...safeGitConfig, ...arguments_]);
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
    moves.push({
      sourceClass: "derived",
      fromPath,
      toPath,
      status: record[0] === "R" ? "staged-rename" : "working-tree-rename",
    });
    index += 1;
  }
  return moves.sort((left, right) => compareCodePoint(left.fromPath, right.fromPath) || compareCodePoint(left.toPath, right.toPath));
}

function changedPaths(output: string, status: string): string[] {
  return output.split("\0")
    .filter((record) => record.slice(0, 2) === status)
    .map((record) => record.slice(3))
    .sort(compareCodePoint);
}

function normalizeMoveCandidate(content: string): string {
  return normalizeJavaScriptSemantics(content);
}

async function inferUnstagedMoves(repositoryRoot: string, statusOutput: string): Promise<GitMoveFact[]> {
  const deletedPaths = [...changedPaths(statusOutput, " D"), ...changedPaths(statusOutput, "D ")];
  const untrackedPaths = changedPaths(statusOutput, "??");
  const available = new Set(untrackedPaths);
  const currentContents = new Map<string, string>();
  const resolvedRoot = await realpath(repositoryRoot);
  await Promise.all(untrackedPaths.map(async (path) => {
    try {
      const absolutePath = resolve(repositoryRoot, path);
      const lexicalRelative = relative(repositoryRoot, absolutePath);
      if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${sep}`)) return;
      const stat = await lstat(absolutePath);
      if (!stat.isFile() || stat.isSymbolicLink()) return;
      const resolvedParent = await realpath(dirname(absolutePath));
      const parentRelative = relative(resolvedRoot, resolvedParent);
      if (parentRelative === ".." || parentRelative.startsWith(`..${sep}`)) return;
      const handle = await open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        currentContents.set(path, normalizeMoveCandidate(await handle.readFile("utf8")));
      } finally {
        await handle.close();
      }
    } catch {
      // Binary/unreadable candidates are not guessed as semantic moves.
    }
  }));
  const result: GitMoveFact[] = [];
  for (const fromPath of deletedPaths) {
    let previous: string;
    try {
      previous = normalizeMoveCandidate(await safeGit(repositoryRoot, ["show", `HEAD:${fromPath}`]));
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
      safeGit(repositoryRoot, ["rev-parse", "HEAD"]),
      safeGit(repositoryRoot, ["ls-files", "--stage", "-z"]),
      safeGit(repositoryRoot, ["status", "--porcelain=v1", "-z"]),
    ]);
    const tracked = parseTracked(trackedOutput);
    const identityResults = await Promise.all(paths.map(async (path): Promise<{ identity: GitIdentityFact; failure?: AnalyzerFailure }> => {
      const objectId = tracked.get(path);
      if (objectId === undefined) {
        return { identity: { sourceClass: "derived", path, tracked: false, availability: "available", introductionHistory: "not-applicable" } };
      }
      let introductionCommit: string | undefined;
      try {
        const history = await safeGit(repositoryRoot, ["log", "--no-ext-diff", "--follow", "--diff-filter=A", "--format=%H", "--", path]);
        introductionCommit = history.trim().split("\n").filter(Boolean).at(-1);
      } catch (error) {
        return {
          identity: {
            sourceClass: "derived",
            path,
            tracked: true,
            availability: "available",
            introductionHistory: "unavailable",
            objectId,
          },
          failure: {
            analyzerId: "projector.git-local",
            capability: "introduction-history",
            scope: path,
            message: error instanceof Error ? error.message : String(error),
            recoverable: true,
            affectedClaimKinds: ["git-introduction-commit"],
          },
        };
      }
      return {
        identity: {
          sourceClass: "derived",
          path,
          tracked: true,
          availability: "available",
          introductionHistory: "available",
          objectId,
          ...(introductionCommit === undefined ? {} : { introductionCommit }),
        },
      };
    }));
    const identities = identityResults.map((result) => result.identity);
    const historyFailures = identityResults
      .map((result) => result.failure)
      .filter((failure): failure is AnalyzerFailure => failure !== undefined)
      .sort((left, right) => compareCodePoint(left.scope, right.scope));
    const explicitMoves = parseMoves(statusOutput);
    const inferredMoves = await inferUnstagedMoves(repositoryRoot, statusOutput);
    return {
      availability: "available",
      revision: revisionOutput.trim(),
      identities: identities.sort((left, right) => compareCodePoint(left.path, right.path)),
      moves: [...explicitMoves, ...inferredMoves]
        .filter((move, index, moves) => moves.findIndex((candidate) => candidate.fromPath === move.fromPath && candidate.toPath === move.toPath) === index)
        .sort((left, right) => compareCodePoint(left.fromPath, right.fromPath) || compareCodePoint(left.toPath, right.toPath)),
      failures: historyFailures,
    };
  } catch (error) {
    return {
      availability: "unavailable",
      revision: "filesystem",
      identities: paths.map((path) => ({
        sourceClass: "derived",
        path,
        tracked: "unknown",
        availability: "unavailable",
        introductionHistory: "unavailable",
      })),
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
