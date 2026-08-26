import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { analyzeLocalRepository, type LocalRepositoryAnalysis } from "@projector/analyzers";
import { hashFramedDomain, type ContentHash, type StateDigest } from "@projector/core";
import { CanonicalFileRepository, RepositoryPathService, type CanonicalSnapshot } from "@projector/runtime";

const execFileAsync = promisify(execFile);
const operationalPrefix = ".projector/";

function governedPath(path: string): boolean {
  return path !== ".projector" && !path.startsWith(operationalPrefix);
}

function filterOperationalAnalysis(analysis: LocalRepositoryAnalysis): LocalRepositoryAnalysis {
  const files = analysis.files.filter(({ path }) => governedPath(path));
  const artifactIds = new Set(files.map(({ artifactId }) => artifactId));
  const projectionUnits = analysis.projectionUnits.filter(({ artifactId }) => artifactIds.has(artifactId));
  return {
    ...analysis,
    files,
    artifacts: analysis.artifacts.filter(({ id }) => artifactIds.has(id)),
    projectionUnits,
    dependencies: analysis.dependencies.filter(({ importerPath, resolvedPath }) => governedPath(importerPath) && (resolvedPath === undefined || governedPath(resolvedPath))),
    testTargets: analysis.testTargets.filter(({ testPath, targetPath }) => governedPath(testPath) && governedPath(targetPath)),
    javaScript: {
      ...analysis.javaScript,
      files: analysis.javaScript.files.filter(({ path }) => governedPath(path)),
      dependencies: analysis.javaScript.dependencies.filter(({ importerPath, resolvedPath }) => governedPath(importerPath) && (resolvedPath === undefined || governedPath(resolvedPath))),
      testTargets: analysis.javaScript.testTargets.filter(({ testPath, targetPath }) => governedPath(testPath) && governedPath(targetPath)),
      failures: analysis.javaScript.failures.filter(({ scope }) => governedPath(scope)),
    },
    gitIdentities: analysis.gitIdentities.filter(({ path }) => governedPath(path)),
    gitMoves: analysis.gitMoves.filter(({ fromPath, toPath }) => governedPath(fromPath) && governedPath(toPath)),
    failures: analysis.failures.filter(({ scope }) => governedPath(scope)),
  };
}

function stateFrom(analysis: LocalRepositoryAnalysis, canonical: CanonicalSnapshot): StateDigest {
  const fileManifest = analysis.files.map(({ path, contentHash, mediaType, generated }) => ({ path, contentHash, mediaType, generated }));
  return {
    gitBase: analysis.git.revision,
    worktreeDigest: hashFramedDomain("repository-change-worktree", {
      files: fileManifest,
      moves: analysis.gitMoves,
      surface: analysis.surface.enumeration,
    }),
    canonicalProjectorDigest: canonical.rootDigest,
    toolchainDigest: hashFramedDomain("repository-change-toolchain", analysis.capabilities.map(({ analyzerId, adapterVersion, supportedLanguages, supportedSemantics, executesRepositoryCode }) => ({ analyzerId, adapterVersion, supportedLanguages, supportedSemantics, executesRepositoryCode }))),
  };
}

async function gitBaseFile(repositoryRoot: string, path: string): Promise<string> {
  if (path.includes(":")) throw new Error(`independent validator path cannot contain colon: ${path}`);
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  try {
    const { stdout } = await execFileAsync("git", [
      "-c", "core.fsmonitor=false",
      "-c", "core.untrackedCache=false",
      "-c", `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
      "show", `HEAD:${path}`,
    ], { cwd: repositoryRoot, encoding: "utf8", env: { ...environment, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 4 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    throw new Error(`independent validator is unavailable from Git base: ${path}`, { cause: error });
  }
}

export interface IndependentValidatorObservation {
  readonly path: string;
  readonly tracked: true;
  readonly objectId: string;
  readonly introductionCommit: string;
  readonly content: string;
  readonly contentHash: ContentHash;
}

export interface ChangeRepositoryObservation {
  readonly repositoryRoot: string;
  readonly analysis: LocalRepositoryAnalysis;
  readonly canonical: CanonicalSnapshot;
  readonly state: StateDigest;
  independentValidator(path: string): Promise<IndependentValidatorObservation>;
}

export async function observeChangeRepository(repositoryRoot: string): Promise<ChangeRepositoryObservation> {
  const [rawAnalysis, canonical, paths] = await Promise.all([
    analyzeLocalRepository({ repositoryRoot }),
    new CanonicalFileRepository(repositoryRoot).snapshot(),
    RepositoryPathService.create(repositoryRoot),
  ]);
  const analysis = filterOperationalAnalysis(rawAnalysis);
  const state = stateFrom(analysis, canonical);
  return {
    repositoryRoot,
    analysis,
    canonical,
    state,
    async independentValidator(path) {
      const identity = analysis.gitIdentities.find((candidate) => candidate.path === path);
      if (analysis.git.availability !== "available" || identity?.tracked !== true || identity.objectId === undefined || identity.introductionCommit === undefined) {
        throw new Error(`independent validator lacks tracked Git-base identity: ${path}`);
      }
      const [baseContent, currentContent] = await Promise.all([
        gitBaseFile(repositoryRoot, path),
        readFile((await paths.resolveRead(path)).realTarget, "utf8"),
      ]);
      if (baseContent !== currentContent) throw new Error(`independent validator must remain unchanged from Git base: ${path}`);
      return {
        path,
        tracked: true,
        objectId: identity.objectId,
        introductionCommit: identity.introductionCommit,
        content: currentContent,
        contentHash: hashFramedDomain("transform-content", currentContent),
      };
    },
  };
}
