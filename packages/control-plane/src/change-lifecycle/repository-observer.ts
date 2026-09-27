import { collectLocalRepositoryInputs, observationGit, readObservationFile, type LocalRepositoryAnalysis } from "@projector/analyzers";
import { hashFramedDomain, type ContentHash, type StateDigest, type DerivedObservationBudget } from "@projector/core";
import { collectCanonicalSnapshotSources, currentObservationScope, withObservationScope, RepositoryPathService, type CanonicalSnapshot } from "@projector/runtime";
import { compileCanonicalRealizations, type CanonicalRealizationObservation } from "../knowledge/realizations.js";
import { runObservationTask } from "../observation/task-runner.js";
import type { RepositoryObservationData } from "../observation/tasks.js";

const operationalPrefix = ".projector/";
const observationInputs = new WeakMap<ChangeRepositoryObservation, { identity: ContentHash; state: StateDigest }>();

function inputIdentity(collected: Awaited<ReturnType<typeof collectLocalRepositoryInputs>>, canonicalSources: Awaited<ReturnType<typeof collectCanonicalSnapshotSources>>): ContentHash {
  // Complete bytes, Git inputs, enumeration and exclusion descriptors. The same
  // loaded analyzer/profile implementation produces both observations.
  return hashFramedDomain("repository-observation-inputs", { collected, canonicalSources });
}

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
  readonly realizations: readonly CanonicalRealizationObservation[];
  readonly canonical: CanonicalSnapshot;
  readonly state: StateDigest;
  independentValidator(path: string): Promise<IndependentValidatorObservation>;
}

export function realizeChangeRepositoryData(repositoryRoot: string, rawAnalysis: LocalRepositoryAnalysis, canonical: CanonicalSnapshot, derivedBudget?: DerivedObservationBudget): RepositoryObservationData {
  const filtered = filterOperationalAnalysis(rawAnalysis);
  const realizations = compileCanonicalRealizations(filtered, canonical, derivedBudget);
  const analysis = { ...filtered, projectionUnits: [...realizations.units] };
  const state = stateFrom(analysis, canonical);
  return { repositoryRoot, analysis, realizations: realizations.observations, canonical, state };
}

export async function observeChangeRepository(repositoryRoot: string): Promise<ChangeRepositoryObservation> {
  return withObservationScope({}, async () => {
    const scope = currentObservationScope()!;
    // Sequential collection ensures rejection cannot leave a sibling Git child running.
    const collected = await collectLocalRepositoryInputs({ repositoryRoot, budget: scope.budget, signal: scope.signal });
    const canonicalSources = await collectCanonicalSnapshotSources(repositoryRoot, scope.budget, scope.signal);
    const data = await runObservationTask("observe", { collected, canonicalSources }, scope);
    const paths = await RepositoryPathService.create(repositoryRoot);
    const observation: ChangeRepositoryObservation = {
    ...data,
    async independentValidator(path) {
      scope.signal.throwIfAborted();
      scope.budget.check("independent-validator", path);
      const identity = data.analysis.gitIdentities.find((candidate) => candidate.path === path);
      if (data.analysis.git.availability !== "available" || identity?.tracked !== true || identity.objectId === undefined || identity.introductionCommit === undefined) {
        throw new Error(`independent validator lacks tracked Git-base identity: ${path}`);
      }
      if (path.includes(":")) throw new Error(`independent validator path cannot contain colon: ${path}`);
      const baseContent = await observationGit(repositoryRoot, ["show", `HEAD:${path}`], scope.budget, { signal: scope.signal, stage: "independent-validator" });
      scope.budget.assertFileBytes(Buffer.byteLength(baseContent), path);
      const currentContent = (await readObservationFile((await paths.resolveRead(path)).realTarget, scope.budget, path, scope.signal)).toString("utf8");
      if (baseContent !== currentContent) throw new Error(`independent validator must remain unchanged from Git base: ${path}`);
      return {
        path,
        tracked: true,
        objectId: identity.objectId,
        introductionCommit: identity.introductionCommit,
        content: currentContent,
        contentHash: await runObservationTask("hash-content", { content: currentContent }, scope),
      };
    },
    };
    observationInputs.set(observation, { identity: inputIdentity(collected, canonicalSources), state: structuredClone(data.state) });
    scope.budget.check("state-input-capture");
    scope.signal.throwIfAborted();
    return observation;
  });
}

/** Independently collect all inputs; reuse analysis only after exact input proof. */
export async function observeRepositoryState(previous: ChangeRepositoryObservation): Promise<StateDigest> {
  return withObservationScope({}, async (scope) => {
    const prior = observationInputs.get(previous);
    if (prior === undefined) return (await observeChangeRepository(previous.repositoryRoot)).state;
    const collected = await collectLocalRepositoryInputs({ repositoryRoot: previous.repositoryRoot, budget: scope.budget, signal: scope.signal });
    const canonicalSources = await collectCanonicalSnapshotSources(previous.repositoryRoot, scope.budget, scope.signal);
    const identity = inputIdentity(collected, canonicalSources);
    scope.budget.check("state-input-proof");
    scope.signal.throwIfAborted();
    if (identity === prior.identity) return structuredClone(prior.state);
    return (await runObservationTask("observe", { collected, canonicalSources }, scope)).state;
  });
}
