import { collectLocalRepositoryInputs, observationGit, readObservationFile, type LocalRepositoryAnalysis } from "@projector/analyzers";
import { buildManifest, manifestKey, hashFramedDomain, type ContentHash, type StateDigest, type DerivedObservationBudget } from "@projector/core";
import { collectCanonicalSnapshotSources, currentObservationScope, withObservationScope, RepositoryPathService, type CanonicalSnapshot } from "@projector/runtime";
import { compileCanonicalRealizations, type CanonicalRealizationObservation } from "../knowledge/realizations.js";
import { runObservationTask } from "../observation/task-runner.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import { enrollWatchman, watchmanByteReuse, validateWatchmanByteReuse, type WatchmanBaseline } from "./watchman-observation.js";

const operationalPrefix = ".projector/";
const observationInputs = new WeakMap<ChangeRepositoryObservation, {
  identity: ContentHash; state: StateDigest;
  inventory: Awaited<ReturnType<typeof collectLocalRepositoryInputs>>["inventoryResult"];
  watchman: WatchmanBaseline | undefined;
}>();

function inputIdentity(collected: Awaited<ReturnType<typeof collectLocalRepositoryInputs>>, canonicalSources: Awaited<ReturnType<typeof collectCanonicalSnapshotSources>>): ContentHash {
  // The collector already hashes exact file bytes. Bind those hashes and every
  // other analysis input without serializing and hashing the source strings a
  // second time. This versioned identity is internal to this process; public
  // semantic hashes and observation scope remain unchanged.
  const { entries, ...inventory } = collected.inventoryResult;
  return hashFramedDomain("repository-observation-inputs-v2", {
    options: collected.options,
    inventory: { ...inventory, entries: entries.map(({ content: _content, ...entry }) => entry) },
    gitFacts: collected.gitFacts,
    canonicalSources,
  });
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
    worktreeDigest: hashFramedDomain("repository-change-worktree/v2", {
      files: buildManifest(fileManifest.map(file=>({key:manifestKey(file.path),value:file}))).root,
      moves: buildManifest(analysis.gitMoves.map(move=>({key:manifestKey(move.fromPath),value:move}))).root,
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

/** Both eager and indexed hosts use the same exact Git-base validator proof. */
export async function captureIndependentValidator(repositoryRoot: string, gitAvailability: LocalRepositoryAnalysis["git"]["availability"], readIdentity: (path: string) => LocalRepositoryAnalysis["gitIdentities"][number] | undefined, path: string): Promise<IndependentValidatorObservation> {
  return withObservationScope({}, async scope => {
    scope.signal.throwIfAborted(); scope.budget.check("independent-validator", path);
    const identity = readIdentity(path);
    if (gitAvailability !== "available" || identity?.tracked !== true || identity.objectId === undefined || identity.introductionCommit === undefined) throw new Error(`independent validator lacks tracked Git-base identity: ${path}`);
    if (path.includes(":")) throw new Error(`independent validator path cannot contain colon: ${path}`);
    const baseContent = await observationGit(repositoryRoot, ["show", `HEAD:${path}`], scope.budget, {signal:scope.signal,stage:"independent-validator"});
    scope.budget.assertFileBytes(Buffer.byteLength(baseContent),path);
    const paths = await RepositoryPathService.create(repositoryRoot);
    const currentContent = (await readObservationFile((await paths.resolveRead(path)).realTarget,scope.budget,path,scope.signal)).toString("utf8");
    if (baseContent !== currentContent) throw new Error(`independent validator must remain unchanged from Git base: ${path}`);
    return {path,tracked:true,objectId:identity.objectId,introductionCommit:identity.introductionCommit,content:currentContent,contentHash:await runObservationTask("hash-content",{content:currentContent},scope)};
  });
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
    const watchman = await enrollWatchman(repositoryRoot, scope.budget, scope.signal);
    // Sequential collection ensures rejection cannot leave a sibling Git child running.
    const collected = await collectLocalRepositoryInputs({ repositoryRoot, budget: scope.budget, signal: scope.signal });
    const canonicalSources = await collectCanonicalSnapshotSources(repositoryRoot, scope.budget, scope.signal);
    const data = await runObservationTask("observe", { collected, canonicalSources }, scope);
    const observation: ChangeRepositoryObservation = {
    ...data,
    async independentValidator(path) {
      return captureIndependentValidator(repositoryRoot,data.analysis.git.availability,path=>data.analysis.gitIdentities.find(candidate=>candidate.path===path),path);
    },
    };
    observationInputs.set(observation, { identity: inputIdentity(collected, canonicalSources), state: structuredClone(data.state), inventory: collected.inventoryResult, watchman });
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
    const reuseResult = await watchmanByteReuse(prior.watchman, prior.inventory, scope.budget, scope.signal);
    const byteReuse = reuseResult.kind === "reuse" ? reuseResult.reuse : undefined;
    const collected = await collectLocalRepositoryInputs({ repositoryRoot: previous.repositoryRoot, budget: scope.budget, signal: scope.signal,
      ...(byteReuse === undefined ? {} : { byteReuse }) });
    const canonicalSources = await collectCanonicalSnapshotSources(previous.repositoryRoot, scope.budget, scope.signal);
    if (byteReuse !== undefined) await validateWatchmanByteReuse(byteReuse, scope.budget, scope.signal);
    const identity = inputIdentity(collected, canonicalSources);
    scope.budget.check("state-input-proof");
    scope.signal.throwIfAborted();
    if (identity === prior.identity) return structuredClone(prior.state);
    return (await runObservationTask("observe", { collected, canonicalSources }, scope)).state;
  });
}
