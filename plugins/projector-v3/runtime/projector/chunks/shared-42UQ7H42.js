import {
  runObservationTask
} from "./shared-NQTYENBP.js";
import {
  RepositoryPathService,
  collectCanonicalSnapshotSources,
  currentObservationScope,
  withObservationScope
} from "./shared-GXAKKSCS.js";
import {
  collectLocalRepositoryInputs,
  observationGit,
  readObservationFile
} from "./shared-D2LP2F6Z.js";
import {
  SelectorEvaluationError,
  evaluateSelectorMembership,
  projectionUnitSelectorSubject
} from "./shared-RMBXVF7C.js";
import {
  BehavioralScenarioSchema,
  ConceptSchema,
  DerivedObservationBudget,
  ObservationError,
  RequirementSchema,
  buildManifest,
  hashFramedDomain,
  manifestKey,
  observationLimitValue
} from "./shared-Q56AARV7.js";

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

// node_modules/@projector/control-plane/dist/change-lifecycle/watchman-observation.js
import { spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
var proofs = /* @__PURE__ */ new WeakMap();
function failure(message) {
  return new ObservationError("observation-failed", "watchman-observation", ".", message);
}
function configuredHost() {
  const executable = process.env.PROJECTOR_WATCHMAN_EXECUTABLE, socket = process.env.PROJECTOR_WATCHMAN_SOCKET;
  if (executable === void 0 && socket === void 0)
    return void 0;
  if (!executable || !socket || !isAbsolute(executable))
    throw failure("Set both PROJECTOR_WATCHMAN_EXECUTABLE (absolute executable path) and PROJECTOR_WATCHMAN_SOCKET for an existing Watchman daemon, or unset both.");
  if (process.platform === "darwin")
    return void 0;
  return { executable, socket };
}
var WatchmanSynchronizationTimeout = class extends Error {
};
var WatchmanSynchronizationUnavailableError = class extends ObservationError {
  constructor(message) {
    super("observation-failed", "watchman-observation", ".", `Watchman synchronization is unavailable; complete source observation is required: ${message}`);
  }
};
async function command(host, request, budget, signal) {
  let attemptRequest = request;
  for (let attempt = 1; ; attempt++) {
    budget.check("watchman-observation");
    signal.throwIfAborted();
    try {
      return await commandAttempt(host, attemptRequest, budget, signal);
    } catch (error) {
      if (!(error instanceof WatchmanSynchronizationTimeout))
        throw error;
      budget.check("watchman-observation");
      signal.throwIfAborted();
      if (attempt === 3) {
        console.warn(JSON.stringify({ event: "watchman-synchronization-unavailable", root: request[1], command: request[0], attempt, error: error.message }));
        throw new WatchmanSynchronizationUnavailableError(error.message);
      }
      const options = attemptRequest[2];
      if (options === null || typeof options !== "object" || !("sync_timeout" in options) || typeof options.sync_timeout !== "number")
        throw error;
      const syncTimeout = Math.max(1, Math.min(options.sync_timeout * 2, 2147483647, Math.ceil(budget.remainingMs())));
      console.warn(JSON.stringify({ event: "watchman-synchronization-retry", root: request[1], command: request[0], attempt, syncTimeoutMs: syncTimeout, error: error.message }));
      attemptRequest = [request[0], request[1], { ...options, sync_timeout: syncTimeout }];
    }
  }
}
async function commandAttempt(host, request, budget, signal) {
  budget.check("watchman-observation");
  signal.throwIfAborted();
  return new Promise((accept, reject) => {
    const child = spawn(host.executable, ["--no-spawn", "--no-local", "--sockname", host.socket, "-j"], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [], errors = [];
    let size = 0, error;
    const stop = (reason) => {
      error ??= reason;
      child.kill();
    };
    const abort = () => stop(failure("Watchman observation cancelled."));
    signal.addEventListener("abort", abort, { once: true });
    const remainingMs = budget.remainingMs();
    const timer = Number.isFinite(remainingMs) ? setTimeout(() => stop(failure("Watchman client exceeded the declared observation deadline.")), remainingMs) : void 0;
    const receive = (chunk, target) => {
      if (error !== void 0)
        return;
      try {
        budget.check("watchman-observation");
        size += chunk.length;
        if (size > observationLimitValue(budget.limits.maxGitOutputBytes))
          throw failure("Watchman response exceeds the declared maxGitOutputBytes limit.");
        budget.consume("maxGitOutputBytes", chunk.length, "watchman-observation");
        target.push(chunk);
      } catch (cause) {
        stop(cause instanceof Error ? cause : failure(String(cause)));
      }
    };
    child.stdout.on("data", (chunk) => receive(chunk, chunks));
    child.stderr.on("data", (chunk) => receive(chunk, errors));
    child.on("error", (cause) => {
      error ??= failure(`Cannot run configured Watchman client: ${cause.message}`);
    });
    child.stdin.on("error", (cause) => stop(failure(`Cannot send Watchman request: ${cause.message}`)));
    child.on("close", (code) => {
      if (timer !== void 0)
        clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error !== void 0) {
        reject(error);
        return;
      }
      try {
        budget.check("watchman-observation");
        signal.throwIfAborted();
        const output = Buffer.concat(chunks).toString("utf8");
        if (code !== 0 && !output.trim())
          throw failure(`Configured Watchman client failed (${code}): ${Buffer.concat(errors).toString("utf8").slice(0, 1024)}`);
        const reply = JSON.parse(output);
        if (reply === null || typeof reply !== "object" || Array.isArray(reply))
          throw failure("Watchman returned an invalid object response.");
        if ("error" in reply) {
          const message = String(reply.error);
          if (/syncToNow: timed out waiting for cookie file to be observed by watcher within \d+ milliseconds/u.test(message))
            throw new WatchmanSynchronizationTimeout(message);
          throw failure(`Watchman observation failed: ${message}`);
        }
        if (code !== 0)
          throw failure(`Configured Watchman client failed (${code}): ${Buffer.concat(errors).toString("utf8").slice(0, 1024)}`);
        accept(reply);
      } catch (cause) {
        reject(cause instanceof ObservationError || cause instanceof WatchmanSynchronizationTimeout ? cause : failure(`Invalid Watchman response: ${String(cause)}`));
      }
    });
    child.stdin.end(`${JSON.stringify(request)}
`);
    if (signal.aborted)
      abort();
  });
}
function prefixes(config) {
  const result = [];
  for (const key of ["ignore_dirs", "ignore_vcs"]) {
    const value = config[key] === void 0 ? key === "ignore_vcs" ? [".git", ".hg", ".svn", ".jj"] : [] : config[key];
    if (!Array.isArray(value))
      throw failure(`Watchman ${key} must be a path array before byte reuse is safe.`);
    for (const path of value) {
      if (typeof path !== "string" || !path || isAbsolute(path) || /^[a-z]:/iu.test(path) || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === ".."))
        throw failure(`Watchman ${key} contains an unsupported path; byte coverage is unknown.`);
      result.push(path);
    }
  }
  return result;
}
async function configuration(host, root, budget, signal) {
  const reply = await command(host, ["get-config", root], budget, signal);
  if (reply.config === null || typeof reply.config !== "object" || Array.isArray(reply.config))
    throw failure("Watchman get-config did not provide effective watch configuration.");
  const config = reply.config;
  return { identity: hashFramedDomain("watchman-byte-coverage-v1", config), uncovered: prefixes(config), warning: reply.warning !== void 0 };
}
async function enrollWatchman(repositoryRoot, budget, signal) {
  const host = configuredHost();
  if (host === void 0)
    return void 0;
  const root = resolve(repositoryRoot), watch = await command(host, ["watch", root], budget, signal);
  if (typeof watch.watch !== "string" || resolve(watch.watch) !== root || watch.relative_path !== void 0)
    throw failure("Watchman must bind the exact repository root for byte reuse.");
  const config = await configuration(host, root, budget, signal);
  if (watch.warning !== void 0 || config.warning)
    return void 0;
  let reply;
  try {
    reply = await command(host, ["clock", root, { sync_timeout: 5e3 }], budget, signal);
  } catch (error) {
    if (error instanceof WatchmanSynchronizationUnavailableError)
      return void 0;
    throw error;
  }
  if (typeof reply.clock !== "string" || !reply.clock)
    throw failure("Watchman did not return an enrollment clock.");
  if (reply.warning !== void 0)
    return void 0;
  return { host, root, clock: reply.clock, configIdentity: config.identity, uncoveredPrefixes: config.uncovered };
}
function delta(reply, budget) {
  if (reply.is_fresh_instance !== false || typeof reply.clock !== "string" || !reply.clock || !Array.isArray(reply.files))
    throw failure("Watchman delta lacks a complete non-fresh clock and file population.");
  if (reply.files.length > observationLimitValue(budget.limits.maxFiles) + observationLimitValue(budget.limits.maxDirectories))
    throw failure("Watchman delta exceeds the declared file and directory population.");
  const paths = [], events = [];
  for (const file of reply.files) {
    if (file === null || typeof file !== "object" || typeof file.name !== "string" || typeof file.exists !== "boolean" || typeof file.type !== "string")
      throw failure("Watchman returned an invalid file delta.");
    const path = file.name;
    if (!path || isAbsolute(path) || /^[a-z]:/iu.test(path) || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === ".."))
      throw failure("Watchman delta contains a path outside the exact watch root.");
    paths.push(path);
    events.push({ path, exists: file.exists, type: file.type });
  }
  return { clock: reply.clock, paths, events };
}
async function filterSourceWatchmanEvents(root, events, budget, signal) {
  const candidates = [...new Set(events.map(({ path }) => path).filter((path) => !path.startsWith(".projector/") && !/(?:^|\/)(?:\.gitignore|\.gitattributes|\.watchmanconfig)$/u.test(path)))];
  if (candidates.length === 0)
    return events;
  const output = await observationGit(root, ["check-ignore", "-z", "--stdin"], budget, { signal, input: candidates.map((path) => `${path}\0`).join(""), allowedExitCodes: [1], stage: "watchman-effective-ignore" });
  const ignored = new Set(output.split("\0").filter(Boolean));
  const directories = [...new Set(events.filter((event) => event.type === "d" && ignored.has(event.path)).map((event) => event.path))];
  if (directories.length > 0) {
    const tracked = (await observationGit(root, ["ls-files", "--cached", "-z", "--", ...directories.map((path) => `:(top,literal)${path}/`)], budget, { signal, stage: "watchman-tracked-directory-boundary" })).split("\0").filter(Boolean);
    for (const directory of directories)
      if (tracked.some((path) => path.startsWith(`${directory}/`)))
        ignored.delete(directory);
  }
  return events.filter(({ path }) => !ignored.has(path));
}
async function observeWatchmanChanges(baseline, budget, signal) {
  if (baseline === void 0) {
    configuredHost();
    return { kind: "rediscovery", reason: "no-baseline" };
  }
  const host = configuredHost();
  if (host === void 0 || host.executable !== baseline.host.executable || host.socket !== baseline.host.socket)
    return { kind: "rediscovery", reason: "host-changed" };
  const config = await configuration(host, baseline.root, budget, signal);
  if (config.warning)
    return { kind: "rediscovery", reason: "watch-warning" };
  if (config.identity !== baseline.configIdentity)
    return { kind: "rediscovery", reason: "configuration-changed" };
  const reply = await command(host, ["query", baseline.root, { since: baseline.clock, fields: ["name", "exists", "type"], sync_timeout: 5e3 }], budget, signal);
  if (reply.warning !== void 0)
    return { kind: "rediscovery", reason: "watch-warning" };
  if (reply.is_fresh_instance === true)
    return { kind: "rediscovery", reason: "fresh-instance" };
  const result = delta(reply, budget);
  return { kind: "delta", baseline: { ...baseline, clock: result.clock }, events: result.events };
}
async function verifyWatchmanChanges(baseline, budget, signal, excludedPrefixes = [], sourceGitBoundary = false) {
  const result = await observeWatchmanChanges(baseline, budget, signal);
  if (result.kind !== "delta")
    throw failure(`Watchman currentness became unknown (${result.reason}); rebuild observation. The prior completed baseline remains unchanged.`);
  const events = result.events.filter(({ path }) => !excludedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)));
  const selected = sourceGitBoundary ? await filterSourceWatchmanEvents(baseline.root, events, budget, signal) : events;
  const changed = selected[0];
  if (changed !== void 0)
    throw failure(`Repository changed during indexed observation (${changed.path}); retry observation. The prior completed baseline remains unchanged.`);
  return result.baseline;
}
async function watchmanByteReuse(baseline, inventory, budget, signal) {
  if (baseline === void 0) {
    configuredHost();
    return { kind: "rediscovery", reason: "no-baseline" };
  }
  const host = configuredHost();
  if (host === void 0 || host.executable !== baseline.host.executable || host.socket !== baseline.host.socket)
    return { kind: "rediscovery", reason: "host-changed" };
  const config = await configuration(host, baseline.root, budget, signal);
  if (config.warning)
    return { kind: "rediscovery", reason: "watch-warning" };
  if (config.identity !== baseline.configIdentity)
    return { kind: "rediscovery", reason: "configuration-changed" };
  const reply = await command(host, ["query", baseline.root, { since: baseline.clock, fields: ["name", "exists", "type"], sync_timeout: 5e3 }], budget, signal);
  if (reply.warning !== void 0)
    return { kind: "rediscovery", reason: "watch-warning" };
  if (reply.is_fresh_instance === true)
    return { kind: "rediscovery", reason: "fresh-instance" };
  const result = delta(reply, budget);
  const gitBoundary = inventory.enumeration.method === "git-index-and-nonignored-untracked";
  const events = gitBoundary ? await filterSourceWatchmanEvents(baseline.root, result.events, budget, signal) : result.events;
  const reuse = { baseline: inventory, changedPaths: events.map(({ path }) => path), uncoveredPrefixes: baseline.uncoveredPrefixes };
  proofs.set(reuse, { baseline, clock: result.clock, gitBoundary });
  return { kind: "reuse", reuse };
}
async function validateWatchmanByteReuse(reuse, budget, signal) {
  const proof = proofs.get(reuse);
  if (proof === void 0)
    throw failure("Watchman byte reuse lacks a private currentness proof.");
  const host = configuredHost(), { baseline } = proof;
  if (host === void 0 || host.executable !== baseline.host.executable || host.socket !== baseline.host.socket)
    throw failure("Watchman host changed during observation; retry with a fresh observation.");
  const config = await configuration(host, baseline.root, budget, signal);
  if (config.warning || config.identity !== baseline.configIdentity)
    throw failure("Watchman coverage changed during observation; retry with a fresh observation.");
  const reply = await command(host, ["query", baseline.root, { since: proof.clock, fields: ["name", "exists", "type"], sync_timeout: 5e3 }], budget, signal);
  if (reply.warning !== void 0 || reply.is_fresh_instance === true)
    throw failure("Watchman lost currentness during observation; retry with a fresh observation.");
  const result = delta(reply, budget);
  const events = result.events.filter(({ path }) => ![".git", ".worktrees", ".projector/runtime"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)));
  const selected = proof.gitBoundary ? await filterSourceWatchmanEvents(baseline.root, events, budget, signal) : events;
  const changed = selected[0]?.path;
  if (changed !== void 0)
    throw failure(`Repository changed during byte reuse (${changed}); retry observation. The prior baseline remains unchanged.`);
}

// node_modules/@projector/control-plane/dist/change-lifecycle/repository-observer.js
var operationalPrefix = ".projector/";
var observationInputs = /* @__PURE__ */ new WeakMap();
function inputIdentity(collected, canonicalSources) {
  const { entries, ...inventory } = collected.inventoryResult;
  return hashFramedDomain("repository-observation-inputs-v2", {
    options: collected.options,
    inventory: { ...inventory, entries: entries.map(({ content: _content, ...entry }) => entry) },
    gitFacts: collected.gitFacts,
    canonicalSources
  });
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
    worktreeDigest: hashFramedDomain("repository-change-worktree/v2", {
      files: buildManifest(fileManifest.map((file) => ({ key: manifestKey(file.path), value: file }))).root,
      moves: buildManifest(analysis.gitMoves.map((move) => ({ key: manifestKey(move.fromPath), value: move }))).root,
      surface: analysis.surface.enumeration
    }),
    canonicalProjectorDigest: canonical.rootDigest,
    toolchainDigest: hashFramedDomain("repository-change-toolchain", analysis.capabilities.map(({ analyzerId, adapterVersion, supportedLanguages, supportedSemantics, executesRepositoryCode }) => ({ analyzerId, adapterVersion, supportedLanguages, supportedSemantics, executesRepositoryCode })))
  };
}
async function captureIndependentValidator(repositoryRoot, gitAvailability, readIdentity, path) {
  return withObservationScope({}, async (scope) => {
    scope.signal.throwIfAborted();
    scope.budget.check("independent-validator", path);
    const identity = readIdentity(path);
    if (gitAvailability !== "available" || identity?.tracked !== true || identity.objectId === void 0 || identity.introductionCommit === void 0)
      throw new Error(`independent validator lacks tracked Git-base identity: ${path}`);
    if (path.includes(":"))
      throw new Error(`independent validator path cannot contain colon: ${path}`);
    const baseContent = await observationGit(repositoryRoot, ["show", `HEAD:${path}`], scope.budget, { signal: scope.signal, stage: "independent-validator" });
    scope.budget.assertFileBytes(Buffer.byteLength(baseContent), path);
    const paths = await RepositoryPathService.create(repositoryRoot);
    const currentContent = (await readObservationFile((await paths.resolveRead(path)).realTarget, scope.budget, path, scope.signal)).toString("utf8");
    if (baseContent !== currentContent)
      throw new Error(`independent validator must remain unchanged from Git base: ${path}`);
    return { path, tracked: true, objectId: identity.objectId, introductionCommit: identity.introductionCommit, content: currentContent, contentHash: await runObservationTask("hash-content", { content: currentContent }, scope) };
  });
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
    const watchman = await enrollWatchman(repositoryRoot, scope.budget, scope.signal);
    const collected = await collectLocalRepositoryInputs({ repositoryRoot, budget: scope.budget, signal: scope.signal });
    const canonicalSources = await collectCanonicalSnapshotSources(repositoryRoot, scope.budget, scope.signal);
    const data = await runObservationTask("observe", { collected, canonicalSources }, scope);
    const observation = {
      ...data,
      async independentValidator(path) {
        return captureIndependentValidator(repositoryRoot, data.analysis.git.availability, (path2) => data.analysis.gitIdentities.find((candidate) => candidate.path === path2), path);
      }
    };
    observationInputs.set(observation, { identity: inputIdentity(collected, canonicalSources), state: structuredClone(data.state), inventory: collected.inventoryResult, watchman });
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
    const reuseResult = await watchmanByteReuse(prior.watchman, prior.inventory, scope.budget, scope.signal);
    const byteReuse = reuseResult.kind === "reuse" ? reuseResult.reuse : void 0;
    const collected = await collectLocalRepositoryInputs({
      repositoryRoot: previous.repositoryRoot,
      budget: scope.budget,
      signal: scope.signal,
      ...byteReuse === void 0 ? {} : { byteReuse }
    });
    const canonicalSources = await collectCanonicalSnapshotSources(previous.repositoryRoot, scope.budget, scope.signal);
    if (byteReuse !== void 0)
      await validateWatchmanByteReuse(byteReuse, scope.budget, scope.signal);
    const identity = inputIdentity(collected, canonicalSources);
    scope.budget.check("state-input-proof");
    scope.signal.throwIfAborted();
    if (identity === prior.identity)
      return structuredClone(prior.state);
    return (await runObservationTask("observe", { collected, canonicalSources }, scope)).state;
  });
}

export {
  WatchmanSynchronizationUnavailableError,
  enrollWatchman,
  filterSourceWatchmanEvents,
  observeWatchmanChanges,
  verifyWatchmanChanges,
  captureIndependentValidator,
  realizeChangeRepositoryData,
  observeChangeRepository,
  observeRepositoryState
};
