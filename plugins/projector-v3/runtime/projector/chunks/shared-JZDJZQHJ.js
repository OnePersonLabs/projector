import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  runObservationTask
} from "./shared-HODAXZKW.js";
import {
  RepositoryPathService,
  collectCanonicalSnapshotSources,
  currentObservationScope,
  withObservationScope
} from "./shared-3WNQLUKU.js";
import {
  collectLocalRepositoryInputs,
  observationGit,
  readObservationFile
} from "./shared-IFURLTPX.js";
import {
  SelectorEvaluationError,
  evaluateSelectorMembership,
  projectionUnitSelectorSubject
} from "./shared-ZKECJVYF.js";
import {
  BehavioralScenarioSchema,
  ConceptSchema,
  DerivedObservationBudget,
  RequirementSchema,
  hashFramedDomain
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/knowledge/realizations.js
function requiresStructuralQuery(selector) {
  if (selector.op === "atom")
    return selector.matcher === "matches-structural-query";
  if (selector.op === "not")
    return requiresStructuralQuery(selector.item);
  return selector.items.some(requiresStructuralQuery);
}
function compileCanonicalRealizations(analysis, canonical, budget = new DerivedObservationBudget(analysis.observationDescriptor.limits.maxDerivedBytes)) {
  budget.reserveItems(analysis.projectionUnits.length, 384, "realization-unit");
  const units = analysis.projectionUnits.map((unit) => ({ ...unit, conceptIds: [], requirementIds: [], scenarioIds: [] }));
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const files = new Map(analysis.files.map((file) => [file.artifactId, file]));
  let subjectBytes = 0;
  const subjects = units.map((unit) => {
    const path = files.get(unit.artifactId)?.path ?? unit.key;
    const segments = path.split("/");
    const packageRoot = ["packages", "apps"].includes(segments[0]) && segments[1] !== void 0 ? `${segments[0]}/${segments[1]}` : void 0;
    const bytes = 512 + 4 * (path.length + unit.id.length + unit.key.length);
    budget.reserve(bytes, "realization-subject", unit.id);
    subjectBytes += bytes;
    return projectionUnitSelectorSubject(unit, {
      path,
      surface: analysis.surface.kind,
      ...packageRoot === void 0 ? {} : { package: packageRoot, packageKind: segments[0] }
    });
  });
  const observations = [];
  for (const document of [...canonical.documents].sort((a, b) => a.id.localeCompare(b.id))) {
    let entity;
    let field;
    if (document.kind === "concept") {
      entity = ConceptSchema.parse(document.payload);
      field = "conceptIds";
    } else if (document.kind === "requirement") {
      entity = RequirementSchema.parse(document.payload);
      field = "requirementIds";
    } else if (document.kind === "behavioral-scenario") {
      entity = BehavioralScenarioSchema.parse(document.payload);
      field = "scenarioIds";
    } else
      continue;
    if (entity.status !== "active")
      continue;
    for (const [bindingIndex, binding] of (entity.realizations ?? []).entries()) {
      budget.reserve(768 + 2 * (entity.id.length + binding.origin.locator.length), "realization-observation", entity.id);
      const basis = { entityId: entity.id, bindingIndex, bindingHash: hashFramedDomain("canonical-realization-binding", binding), origin: binding.origin };
      if (requiresStructuralQuery(binding.selector)) {
        observations.push({ ...basis, status: "unsupported", memberIds: [], reason: "Structural query realization needs an observer beyond the supported raw repository facts." });
        continue;
      }
      if (analysis.surface.access === "unavailable" || analysis.surface.enumeration.observability === "unavailable") {
        observations.push({ ...basis, status: "unavailable", memberIds: [], reason: "Repository inventory is unavailable; realization membership was not established." });
        continue;
      }
      budget.reserve(subjectBytes, "realization-selector", entity.id);
      try {
        const membership = evaluateSelectorMembership(binding.selector, subjects, {
          observability: analysis.surface.enumeration.observability,
          assumptions: analysis.surface.enumeration.assumptions,
          unavailableLanes: analysis.failures.filter(({ analyzerId }) => analyzerId === "projector.filesystem-local").map(({ capability, scope }) => `${capability}:${scope}`)
        });
        const unavailable = analysis.failures.some(({ analyzerId }) => analyzerId === "projector.filesystem-local");
        if (!unavailable)
          for (const id of membership.memberIds) {
            budget.reserve(160 + 4 * (id.length + entity.id.length), "realization-membership", entity.id);
            unitsById.get(id)[field].push(entity.id);
          }
        observations.push({
          ...basis,
          status: unavailable ? "unavailable" : membership.memberIds.length === 0 ? "unmatched" : "matched",
          memberIds: unavailable ? [] : membership.memberIds,
          reason: unavailable ? "Repository inventory has failed observations; realization membership was not established." : membership.memberIds.length === 0 ? "Declared realization has no members in the observed repository boundary." : "Declared realization matches observed raw facts; membership does not establish behavioral fulfillment."
        });
      } catch (error) {
        if (!(error instanceof SelectorEvaluationError))
          throw error;
        observations.push({ ...basis, status: "unsupported", memberIds: [], reason: error.message });
      } finally {
        budget.release(subjectBytes);
      }
    }
  }
  budget.release(subjectBytes);
  return { units: units.map((unit) => {
    const membership = { conceptIds: [...new Set(unit.conceptIds)].sort(), requirementIds: [...new Set(unit.requirementIds)].sort(), scenarioIds: [...new Set(unit.scenarioIds)].sort() };
    return { ...unit, ...membership, membershipHash: Object.values(membership).every((ids) => ids.length === 0) ? unit.membershipHash : hashFramedDomain("canonical-realization-membership", { rawMembershipHash: unit.membershipHash, ...membership }) };
  }), observations };
}

// node_modules/@projector/control-plane/dist/change-lifecycle/repository-observer.js
var operationalPrefix = ".projector/";
var observationInputs = /* @__PURE__ */ new WeakMap();
function inputIdentity(collected, canonicalSources) {
  return hashFramedDomain("repository-observation-inputs", { collected, canonicalSources });
}
function governedPath(path) {
  return path !== ".projector" && !path.startsWith(operationalPrefix);
}
function filterOperationalAnalysis(analysis) {
  const files = analysis.files.filter(({ path }) => governedPath(path));
  const artifactIds = new Set(files.map(({ artifactId }) => artifactId));
  const projectionUnits = analysis.projectionUnits.filter(({ artifactId }) => artifactIds.has(artifactId));
  return {
    ...analysis,
    files,
    artifacts: analysis.artifacts.filter(({ id }) => artifactIds.has(id)),
    projectionUnits,
    dependencies: analysis.dependencies.filter(({ importerPath, resolvedPath }) => governedPath(importerPath) && (resolvedPath === void 0 || governedPath(resolvedPath))),
    testTargets: analysis.testTargets.filter(({ testPath, targetPath }) => governedPath(testPath) && governedPath(targetPath)),
    javaScript: {
      ...analysis.javaScript,
      files: analysis.javaScript.files.filter(({ path }) => governedPath(path)),
      dependencies: analysis.javaScript.dependencies.filter(({ importerPath, resolvedPath }) => governedPath(importerPath) && (resolvedPath === void 0 || governedPath(resolvedPath))),
      testTargets: analysis.javaScript.testTargets.filter(({ testPath, targetPath }) => governedPath(testPath) && governedPath(targetPath)),
      failures: analysis.javaScript.failures.filter(({ scope }) => governedPath(scope))
    },
    gitIdentities: analysis.gitIdentities.filter(({ path }) => governedPath(path)),
    gitMoves: analysis.gitMoves.filter(({ fromPath, toPath }) => governedPath(fromPath) && governedPath(toPath)),
    failures: analysis.failures.filter(({ scope }) => governedPath(scope))
  };
}
function stateFrom(analysis, canonical) {
  const fileManifest = analysis.files.map(({ path, contentHash, mediaType, generated }) => ({ path, contentHash, mediaType, generated }));
  return {
    gitBase: analysis.git.revision,
    worktreeDigest: hashFramedDomain("repository-change-worktree", {
      files: fileManifest,
      moves: analysis.gitMoves,
      surface: analysis.surface.enumeration
    }),
    canonicalProjectorDigest: canonical.rootDigest,
    toolchainDigest: hashFramedDomain("repository-change-toolchain", analysis.capabilities.map(({ analyzerId, adapterVersion, supportedLanguages, supportedSemantics, executesRepositoryCode }) => ({ analyzerId, adapterVersion, supportedLanguages, supportedSemantics, executesRepositoryCode })))
  };
}
function realizeChangeRepositoryData(repositoryRoot, rawAnalysis, canonical, derivedBudget) {
  const filtered = filterOperationalAnalysis(rawAnalysis);
  const realizations = compileCanonicalRealizations(filtered, canonical, derivedBudget);
  const analysis = { ...filtered, projectionUnits: [...realizations.units] };
  const state = stateFrom(analysis, canonical);
  return { repositoryRoot, analysis, realizations: realizations.observations, canonical, state };
}
async function observeChangeRepository(repositoryRoot) {
  return withObservationScope({}, async () => {
    const scope = currentObservationScope();
    const collected = await collectLocalRepositoryInputs({ repositoryRoot, budget: scope.budget, signal: scope.signal });
    const canonicalSources = await collectCanonicalSnapshotSources(repositoryRoot, scope.budget, scope.signal);
    const data = await runObservationTask("observe", { collected, canonicalSources }, scope);
    const paths = await RepositoryPathService.create(repositoryRoot);
    const observation = {
      ...data,
      async independentValidator(path) {
        scope.signal.throwIfAborted();
        scope.budget.check("independent-validator", path);
        const identity = data.analysis.gitIdentities.find((candidate) => candidate.path === path);
        if (data.analysis.git.availability !== "available" || identity?.tracked !== true || identity.objectId === void 0 || identity.introductionCommit === void 0) {
          throw new Error(`independent validator lacks tracked Git-base identity: ${path}`);
        }
        if (path.includes(":"))
          throw new Error(`independent validator path cannot contain colon: ${path}`);
        const baseContent = await observationGit(repositoryRoot, ["show", `HEAD:${path}`], scope.budget, { signal: scope.signal, stage: "independent-validator" });
        scope.budget.assertFileBytes(Buffer.byteLength(baseContent), path);
        const currentContent = (await readObservationFile((await paths.resolveRead(path)).realTarget, scope.budget, path, scope.signal)).toString("utf8");
        if (baseContent !== currentContent)
          throw new Error(`independent validator must remain unchanged from Git base: ${path}`);
        return {
          path,
          tracked: true,
          objectId: identity.objectId,
          introductionCommit: identity.introductionCommit,
          content: currentContent,
          contentHash: await runObservationTask("hash-content", { content: currentContent }, scope)
        };
      }
    };
    observationInputs.set(observation, { identity: inputIdentity(collected, canonicalSources), state: structuredClone(data.state) });
    scope.budget.check("state-input-capture");
    scope.signal.throwIfAborted();
    return observation;
  });
}
async function observeRepositoryState(previous) {
  return withObservationScope({}, async (scope) => {
    const prior = observationInputs.get(previous);
    if (prior === void 0)
      return (await observeChangeRepository(previous.repositoryRoot)).state;
    const collected = await collectLocalRepositoryInputs({ repositoryRoot: previous.repositoryRoot, budget: scope.budget, signal: scope.signal });
    const canonicalSources = await collectCanonicalSnapshotSources(previous.repositoryRoot, scope.budget, scope.signal);
    const identity = inputIdentity(collected, canonicalSources);
    scope.budget.check("state-input-proof");
    scope.signal.throwIfAborted();
    if (identity === prior.identity)
      return structuredClone(prior.state);
    return (await runObservationTask("observe", { collected, canonicalSources }, scope)).state;
  });
}

export {
  realizeChangeRepositoryData,
  observeChangeRepository,
  observeRepositoryState
};
