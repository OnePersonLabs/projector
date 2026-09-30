import {
  RepositoryPathService,
  SqliteCodeEvidenceStore,
  SqliteCodeStore,
  SqliteObservationStore,
  resolveDerivedCachePath
} from "./shared-GXAKKSCS.js";
import {
  TreeSitterCodeProvider,
  TypeScriptCodeProvider,
  codeInputHash,
  discoverTypeScriptProjects,
  importScip,
  importSemanticDb,
  isBundledRuntimeDependencyPath,
  verifyCodeInputBinding
} from "./shared-5EIJVVQJ.js";
import {
  CodeContextSummarySchema,
  CodeEvidenceRequestSchema,
  CodeExportRequestSchema,
  CodeImpactRequestSchema,
  CodeIndexRequestSchema,
  CodeQueryEvidenceSchema,
  CodeQueryRequestSchema,
  CodeRuntimeEvidenceSchema,
  CodeTestsRequestSchema,
  DEFAULT_OBSERVATION_LIMITS,
  DerivedObservationBudget,
  ObservationBudget,
  canonicalJson,
  hashFramedDomain
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/code-intelligence/worker-service.js
import { readFile as readFile2, stat } from "node:fs/promises";
import { appendFileSync, closeSync, createReadStream, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { isAbsolute as isAbsolute2, relative as relative2, dirname, toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parentPort } from "node:worker_threads";
import { z as z2 } from "zod";

// node_modules/@projector/control-plane/dist/code-intelligence/v8-coverage.js
import { readFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { TraceMap, eachMapping, sourceContentFor } from "@jridgewell/trace-mapping";
import { z } from "zod";
var rangeSchema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  count: z.number().nonnegative()
});
var documentSchema = z.object({
  result: z.array(z.object({
    url: z.string(),
    functions: z.array(z.object({ ranges: z.array(rangeSchema) }))
  })),
  "source-map-cache": z.record(z.string(), z.object({
    url: z.string().nullable().optional(),
    lineLengths: z.array(z.number().int().nonnegative()),
    data: z.object({
      version: z.literal(3),
      sources: z.array(z.string()),
      names: z.array(z.string()),
      mappings: z.string(),
      sourceRoot: z.string().optional(),
      sourcesContent: z.array(z.string().nullable()).optional()
    }).nullable()
  })).optional()
});
function executedOffsets(ranges) {
  const events = ranges.flatMap((range, id) => {
    if (range.endOffset < range.startOffset)
      throw new Error("V8 coverage has a reversed offset range");
    return range.endOffset === range.startOffset ? [] : [
      { position: range.startOffset, start: true, range, id },
      { position: range.endOffset, start: false, range, id }
    ];
  }).sort((left, right) => left.position - right.position || Number(left.start) - Number(right.start) || right.range.endOffset - left.range.endOffset || right.range.count - left.range.count);
  const stack = [];
  const ended = /* @__PURE__ */ new Set();
  const result = [];
  let previous = events[0]?.position ?? 0;
  for (const event of events) {
    while (stack.length > 0 && ended.has(stack[stack.length - 1].id))
      stack.pop();
    const inner = stack[stack.length - 1];
    if (inner !== void 0 && inner.range.count > 0 && event.position > previous) {
      const last = result[result.length - 1];
      if (last?.end === previous)
        last.end = event.position;
      else
        result.push({ start: previous, end: event.position });
    }
    if (event.start) {
      if (inner !== void 0 && event.range.endOffset > inner.range.endOffset) {
        throw new Error("V8 coverage contains crossing ranges that cannot establish execution attribution");
      }
      stack.push(event);
    } else
      ended.add(event.id);
    previous = event.position;
  }
  return result;
}
function repositorySource(root, url) {
  if (!url.startsWith("file:"))
    return void 0;
  const path = relative(root, fileURLToPath(url)).replaceAll("\\", "/");
  return path === ".." || path.startsWith("../") || isAbsolute(path) || path.includes("\0") ? void 0 : path;
}
async function mapV8Coverage(root, candidate, evidence) {
  const document = documentSchema.parse(candidate);
  const ranges = /* @__PURE__ */ new Map();
  const unknowns = /* @__PURE__ */ new Set();
  const addLine = (path, line) => {
    ranges.set(`${path}:${line}`, { path, startLine: line, endLine: line });
  };
  for (const script of document.result) {
    const executed = executedOffsets(script.functions.flatMap((fn) => fn.ranges));
    if (executed.length === 0)
      continue;
    const cache = document["source-map-cache"]?.[script.url];
    if (cache?.data !== void 0 && cache.data !== null) {
      const mapUrl = cache.url === void 0 || cache.url === null || cache.url.startsWith("data:") ? script.url : new URL(cache.url, script.url).href;
      const map = new TraceMap({
        version: cache.data.version,
        sources: cache.data.sources,
        names: cache.data.names,
        mappings: cache.data.mappings,
        ...cache.data.sourceRoot === void 0 ? {} : { sourceRoot: cache.data.sourceRoot },
        ...cache.data.sourcesContent === void 0 ? {} : { sourcesContent: cache.data.sourcesContent }
      }, mapUrl);
      const offsets = [];
      let offset2 = 0;
      for (const length of cache.lineLengths) {
        offsets.push(offset2);
        offset2 += length + 1;
      }
      const verifiedSources = /* @__PURE__ */ new Map();
      let cursor2 = 0;
      eachMapping(map, (mapping) => {
        if (mapping.source === null || mapping.originalLine === null)
          return;
        const lineOffset = offsets[mapping.generatedLine - 1];
        if (lineOffset === void 0)
          throw new Error("V8 source map refers outside its generated line table");
        const position = lineOffset + mapping.generatedColumn;
        while (cursor2 < executed.length && executed[cursor2].end <= position)
          cursor2++;
        if (executed[cursor2] === void 0 || executed[cursor2].start > position)
          return;
        if (!verifiedSources.has(mapping.source)) {
          const path3 = repositorySource(root, mapping.source);
          const source = sourceContentFor(map, mapping.source);
          const verified = path3 !== void 0 && source !== null && codeInputHash(source) === evidence.sourceHashes[path3];
          verifiedSources.set(mapping.source, verified ? path3 : void 0);
          if (!verified)
            unknowns.add(`Source map lacks matching embedded source bytes: ${mapping.source}`);
        }
        const path2 = verifiedSources.get(mapping.source);
        if (path2 !== void 0)
          addLine(path2, mapping.originalLine);
      });
      continue;
    }
    const path = repositorySource(root, script.url);
    if (path === void 0 || evidence.sourceHashes[path] === void 0) {
      unknowns.add(`Runtime script has no bound source or source map: ${script.url}`);
      continue;
    }
    const text = await readFile(fileURLToPath(script.url), "utf8");
    if (codeInputHash(text) !== evidence.sourceHashes[path])
      throw new Error(`Runtime source changed before offset mapping: ${path}`);
    let offset = 0, cursor = 0;
    for (const [index, line] of text.split(/\n|\u2028|\u2029/u).entries()) {
      const end = offset + line.length;
      while (cursor < executed.length && executed[cursor].end <= offset)
        cursor++;
      if (executed[cursor] !== void 0 && executed[cursor].start < end)
        addLine(path, index + 1);
      offset = end + 1;
    }
  }
  return { ranges: [...ranges.values()], unknowns: [...unknowns].sort() };
}

// node_modules/@projector/control-plane/dist/code-intelligence/worker-service.js
var engineVersion = "projector.code-engine/v2";
var metricScopes = new AsyncLocalStorage();
var budgetScopes = new AsyncLocalStorage();
var endLeaseScopes = new AsyncLocalStorage();
function countMetric(field) {
  const metrics = metricScopes.getStore();
  if (metrics !== void 0)
    metrics[field]++;
}
var compilers = /* @__PURE__ */ new Map();
var syntax = new TreeSitterCodeProvider();
var sourceExtensions = /\.(?:[cm]?[jt]sx?|py|pyi|rs|[ch](?:pp|xx|\+\+)?|cc|hh|java|kt|kts|scala|sc|cs|vb|go|rb|php|swift|sh|bash|vue|svelte)$/iu;
var isFirstPartyCodePath = (path) => !isBundledRuntimeDependencyPath(path);
var unique = (values) => [...new Set(values)].sort();
function compiler(key) {
  let result = compilers.get(key);
  if (result !== void 0) {
    compilers.delete(key);
    compilers.set(key, result);
    return result;
  }
  result = new TypeScriptCodeProvider();
  compilers.set(key, result);
  while (compilers.size > 1)
    compilers.delete(compilers.keys().next().value);
  return result;
}
function requireDescriptor(request) {
  if (request.descriptor === void 0 || request.descriptor.repositoryRoot !== request.repositoryRoot)
    throw new Error("Current code analysis requires its verified checkout observation");
  return request.descriptor;
}
async function observedInputs(descriptor) {
  const store = await SqliteObservationStore.open(descriptor.repositoryRoot);
  try {
    return { entries: store.inventoryEntriesAt(descriptor.generation).filter((entry) => entry.kind === "file"), close: () => store.close() };
  } catch (error) {
    store.close();
    throw error;
  }
}
function mergeSnapshots(snapshots, descriptor, projectKey, mode) {
  const partitions = /* @__PURE__ */ new Map();
  for (const snapshot of snapshots)
    for (const partition of snapshot.partitions) {
      const prior = partitions.get(partition.path);
      if (prior === void 0) {
        partitions.set(partition.path, partition);
        continue;
      }
      if (prior.inputHash !== partition.inputHash)
        throw new Error(`Providers observed different bytes for ${partition.path}`);
      partitions.set(partition.path, {
        ...partition,
        symbols: [
          ...new Map([...prior.symbols, ...partition.symbols].map((symbol) => [
            symbol.id,
            symbol
          ])).values()
        ],
        edges: [
          ...new Map([...prior.edges, ...partition.edges].map((edge) => [edge.id, edge])).values()
        ],
        coverage: {
          path: partition.path,
          status: prior.coverage.status === "complete" && partition.coverage.status === "complete" ? "complete" : "partial",
          reason: unique([prior.coverage.reason, partition.coverage.reason].filter((reason) => reason !== void 0)).join("; ") || "Several compiler projects contribute facts for this source",
          capabilities: [
            ...new Map([
              ...prior.coverage.capabilities,
              ...partition.coverage.capabilities
            ].map((capability) => [
              `${capability.kind}:${capability.fidelity}`,
              capability
            ])).values()
          ]
        }
      });
    }
  const inputs = (key) => {
    const found = /* @__PURE__ */ new Map();
    for (const snapshot of snapshots)
      for (const item of snapshot.binding[key]) {
        const existing = found.get(item.path);
        if (existing !== void 0 && existing.contentHash !== item.contentHash)
          throw new Error(`Provider input changed during indexing: ${item.path}`);
        found.set(item.path, item);
      }
    return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
  };
  const sourceInputs = inputs("sourceInputs"), configInputs = inputs("configInputs"), resolutionInputs = inputs("resolutionInputs");
  const mergeProbes = (values) => {
    const found = /* @__PURE__ */ new Map();
    for (const value of values) {
      const prior = found.get(value.path);
      if (prior !== void 0 && canonicalJson(prior) !== canonicalJson(value))
        throw new Error(`Resolution input changed between compiler projects: ${value.path}`);
      found.set(value.path, value);
    }
    return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
  };
  return {
    schemaVersion: "projector.code-intelligence/v1",
    provider: `projector.composite:${mode}`,
    providerVersion: engineVersion,
    inputFingerprint: hashFramedDomain("code-source-inputs", sourceInputs),
    configFingerprint: hashFramedDomain("code-config-inputs", {
      configInputs,
      providers: snapshots.map((snapshot) => ({
        provider: snapshot.provider,
        version: snapshot.providerVersion,
        config: snapshot.configFingerprint
      }))
    }),
    resolutionFingerprint: hashFramedDomain("code-resolution-inputs", {
      resolutionInputs,
      providers: snapshots.map((snapshot) => snapshot.resolutionFingerprint)
    }),
    binding: {
      status: snapshots.every((snapshot) => snapshot.binding.status === "verified") ? "verified" : "unbound",
      checkoutId: descriptor.checkoutId,
      worktreeDigest: descriptor.metadata.state.worktreeDigest,
      projectKey,
      sourceInputs,
      configInputs,
      resolutionInputs,
      resolutionProbes: mergeProbes(snapshots.flatMap((snapshot) => snapshot.binding.resolutionProbes ?? [])),
      directoryProbes: mergeProbes(snapshots.flatMap((snapshot) => snapshot.binding.directoryProbes ?? [])),
      directoryListings: mergeProbes(snapshots.flatMap((snapshot) => snapshot.binding.directoryListings ?? []))
    },
    partitions: [...partitions.values()].sort((a, b) => a.path.localeCompare(b.path))
  };
}
async function publishIndex(store, request) {
  const input = CodeIndexRequestSchema.parse(request.input);
  const descriptor = requireDescriptor(request);
  const head = store.head();
  const existing = head === null ? void 0 : store.manifest(head);
  if (input.provider === "native" && existing?.provider === "projector.composite:native" && existing?.providerVersion === engineVersion && existing.binding.checkoutId === descriptor.checkoutId && existing.binding.worktreeDigest === descriptor.metadata.state.worktreeDigest && existing.binding.projectKey === `${input.project ?? "workspace"}#${input.buildVariant}` && verifyCodeInputBinding(existing.binding, request.repositoryRoot))
    return head;
  const token = randomUUID(), scope = "semantic-publication";
  if (!await store.acquireLeaseWhenReady(scope, token, 3e5, { budget: budgetScopes.getStore() }))
    throw new Error("Another semantic writer owns this checkout; wait for its index run and retry");
  parentPort?.postMessage({ semanticLease: { scope, token, repositoryRoot: request.repositoryRoot } });
  try {
    return await publishIndexLeased(store, request, { scope, token });
  } finally {
    try {
      await endLeaseScopes.getStore()?.(scope, token);
    } finally {
      store.releaseLease(scope, token);
    }
  }
}
async function publishIndexLeased(store, request, lease) {
  const descriptor = requireDescriptor(request), input = CodeIndexRequestSchema.parse(request.input);
  const projectKey = `${input.project ?? "workspace"}#${input.buildVariant}`;
  const expected = store.head(), prior = expected === null ? void 0 : store.manifest(expected);
  if (input.provider === "native" && prior?.provider === "projector.composite:native" && prior?.providerVersion === engineVersion && prior.binding.checkoutId === descriptor.checkoutId && prior.binding.worktreeDigest === descriptor.metadata.state.worktreeDigest && prior.binding.projectKey === projectKey && verifyCodeInputBinding(prior.binding, request.repositoryRoot))
    return expected;
  const observed = await observedInputs(descriptor);
  try {
    const inventory = observed.entries;
    const firstPartyInputs = inventory.filter((entry) => isFirstPartyCodePath(entry.path));
    const admittedPaths = new Set(inventory.map((entry) => entry.path));
    const canRetainPrior = prior !== void 0 && prior.binding.sourceInputs.every((source) => admittedPaths.has(source.path)) && verifyCodeInputBinding(prior.binding, request.repositoryRoot);
    const binding = {
      checkoutId: descriptor.checkoutId,
      worktreeDigest: descriptor.metadata.state.worktreeDigest,
      projectKey
    };
    const stageId = randomUUID();
    store.beginStage(stageId, hashFramedDomain("code-stage-source/v1", {
      generation: descriptor.generation,
      checkoutId: descriptor.checkoutId,
      worktreeDigest: descriptor.metadata.state.worktreeDigest,
      projectKey,
      provider: input.provider,
      artifact: input.artifact
    }), lease);
    const snapshots = [];
    let ordinal = 0;
    const metadataOnly = (snapshot) => ({ ...snapshot, partitions: [] });
    const bufferedSink = (providerOrdinal) => {
      let buffer = [];
      const flush = () => {
        if (buffer.length === 0)
          return;
        store.stageContributionBatch(stageId, providerOrdinal, buffer, lease);
        buffer = [];
      };
      return {
        put(partition) {
          buffer.push(partition);
          if (buffer.length >= 64)
            flush();
        },
        get(path) {
          flush();
          return store.contribution(stageId, providerOrdinal, path);
        },
        replace(partition) {
          flush();
          store.replaceContribution(stageId, providerOrdinal, partition, lease);
        },
        flush
      };
    };
    try {
      if (input.provider === "native") {
        const configurations = input.project === void 0 ? discoverTypeScriptProjects(firstPartyInputs) : [input.project];
        for (const configPath of configurations.length === 0 ? [void 0] : configurations) {
          const key = `${descriptor.checkoutId}:${configPath ?? "inferred"}:${input.buildVariant}`;
          countMetric("nativeUpdates");
          const sink = bufferedSink(ordinal++);
          snapshots.push(metadataOnly(compiler(key).update(firstPartyInputs, {
            repositoryRoot: request.repositoryRoot,
            binding: {
              ...binding,
              projectKey: `${configPath ?? "inferred"}#${input.buildVariant}`
            },
            ...configPath === void 0 ? {} : { configPath },
            maxProofBytes: budgetScopes.getStore().limits.maxDerivedBytes
          }, sink)));
          sink.flush();
        }
      }
      if (input.provider === "native" || input.provider === "syntax") {
        if (input.provider === "native" && prior !== void 0 && canRetainPrior) {
          const sink = bufferedSink(ordinal++);
          const retainedPaths = /* @__PURE__ */ new Set();
          for (const path of iteratePaths(store, expected)) {
            if (!isFirstPartyCodePath(path))
              continue;
            if (store.contributionHasPath(stageId, path))
              continue;
            const partition = store.partition(expected, path);
            if ([...partition.symbols, ...partition.edges].some((fact) => fact.provenance.provider === "projector.scip" || fact.provenance.provider === "projector.semanticdb")) {
              sink.put(partition);
              retainedPaths.add(path);
            }
          }
          sink.flush();
          if (retainedPaths.size > 0)
            snapshots.push({
              ...prior,
              binding: {
                ...prior.binding,
                sourceInputs: prior.binding.sourceInputs.filter((source) => retainedPaths.has(source.path)),
                configInputs: prior.binding.configInputs.filter((config) => isFirstPartyCodePath(config.path))
              },
              partitions: []
            });
        }
        const fallback = firstPartyInputs.filter((entry) => sourceExtensions.test(entry.path) && !store.contributionHasPath(stageId, entry.path));
        if (fallback.length > 0) {
          countMetric("syntaxUpdates");
          const sink = bufferedSink(ordinal++);
          snapshots.push(metadataOnly(await syntax.update(fallback, {
            binding: { ...binding, status: "verified" }
          }, sink.put)));
          sink.flush();
        }
      } else {
        if (input.provider === "external")
          throw new Error("External producers must complete in the supervised host before artifact ingestion");
        const artifact = await (await RepositoryPathService.create(request.repositoryRoot)).resolveRead(input.artifact);
        const bytes = createReadStream(artifact.realTarget, {
          highWaterMark: 64 * 1024
        });
        const options = {
          inputs: inventory,
          binding,
          artifact: input.artifact,
          maxArtifactBytes: budgetScopes.getStore().limits.maxDerivedBytes,
          maxFrameBytes: budgetScopes.getStore().limits.maxDerivedBytes,
          ...input.sourceHashes === void 0 ? {} : { sourceHashes: input.sourceHashes }
        };
        countMetric("imports");
        const importOrdinal = prior !== void 0 && canRetainPrior ? 1 : 0;
        const sink = bufferedSink(importOrdinal);
        snapshots.push(metadataOnly(input.provider === "scip" ? await importScip(bytes, { ...options, emitPartition: sink.put, getPartition: sink.get }) : await importSemanticDb(bytes, { ...options, emitPartition: sink.put, getPartition: sink.get })));
        sink.flush();
        if (prior !== void 0 && canRetainPrior) {
          const retainedSink = bufferedSink(0);
          for (const path of iteratePaths(store, expected))
            if (!store.contributionHasPath(stageId, path))
              retainedSink.put(store.partition(expected, path));
          retainedSink.flush();
          snapshots.unshift({ ...prior, partitions: [] });
        }
      }
      const snapshot = mergeSnapshots(snapshots, descriptor, projectKey, input.provider);
      if (snapshot.binding.status === "verified" && !verifyCodeInputBinding(snapshot.binding, request.repositoryRoot))
        throw new Error("Source or compiler inputs changed during semantic analysis; the prior generation remains active");
      const observation = await SqliteObservationStore.open(request.repositoryRoot);
      try {
        observation.verifyGeneration(descriptor.generation);
      } finally {
        observation.close();
      }
      store.materializeContributions(stageId, lease);
      await applyStagedBridges(store, stageId, lease, request.repositoryRoot);
      if (snapshot.binding.status === "verified" && !verifyCodeInputBinding(snapshot.binding, request.repositoryRoot))
        throw new Error("Source or compiler inputs changed before semantic publication; the prior generation remains active");
      const finalObservation = await SqliteObservationStore.open(request.repositoryRoot);
      try {
        finalObservation.verifyGeneration(descriptor.generation);
      } finally {
        finalObservation.close();
      }
      countMetric("publications");
      const { partitions: _partitions, ...metadata } = snapshot;
      return store.publishStage(stageId, expected, metadata, lease);
    } catch (error) {
      try {
        store.discardStage(stageId, lease);
      } catch {
      }
      throw error;
    }
  } finally {
    observed.close();
  }
}
function* iteratePaths(store, generation) {
  let after;
  do {
    budgetScopes.getStore()?.check("semantic-paths", generation);
    const page = store.paths(generation, 1e3, after);
    yield* page.paths;
    after = page.nextCursor;
  } while (after !== void 0);
}
function allPaths(store, generation) {
  const scope = budgetScopes.getStore();
  if (scope === void 0)
    throw new Error("Semantic path enumeration requires a worker observation budget");
  const allocation = new DerivedObservationBudget(scope.limits.maxDerivedBytes);
  const paths = [];
  let after;
  do {
    scope.check("semantic-paths", generation);
    const page = store.paths(generation, 1e3, after);
    for (const path of page.paths)
      allocation.reserveString(path.length, "semantic-paths", generation);
    paths.push(...page.paths);
    after = page.nextCursor;
  } while (after !== void 0);
  return paths;
}
async function currentGeneration(store, request, project) {
  const descriptor = requireDescriptor(request), head = store.head();
  const existing = head === null ? void 0 : store.manifest(head);
  if (existing?.providerVersion === engineVersion && existing.binding.checkoutId === descriptor.checkoutId && existing.binding.worktreeDigest === descriptor.metadata.state.worktreeDigest && existing.binding.projectKey === `${project ?? "workspace"}#default` && verifyCodeInputBinding(existing.binding, request.repositoryRoot))
    return head;
  return publishIndex(store, {
    ...request,
    operation: "code.index",
    input: {
      provider: "native",
      ...project === void 0 ? {} : { project }
    }
  });
}
function requiredGeneration(store, supplied) {
  const generation = supplied ?? store.head();
  if (generation === null || !store.hasGeneration(generation))
    throw new Error("No completed semantic generation is available; run code.index first");
  return generation;
}
function queryGeneration(store, generation, candidate) {
  const input = CodeQueryRequestSchema.parse(candidate), metadata = store.manifest(generation);
  let symbolId = input.symbolId;
  if (symbolId === void 0 && input.offset !== void 0)
    symbolId = store.symbolAt(generation, input.path, input.offset)?.id;
  if (symbolId === void 0 && input.offset !== void 0)
    throw new Error("No resolved indexed symbol exists at this source offset; inspect path coverage or select a known symbol ID");
  let result;
  const boundedUnknowns = [];
  if (input.name !== void 0 && symbolId === void 0) {
    const symbols = store.symbolsByName(generation, input.name, Math.min(1e3, input.limit + 1));
    if (symbols.length >= input.limit)
      boundedUnknowns.push("Symbol-name results reached the requested bound; use a source path or symbol ID to narrow the query");
    if (input.kind !== "symbols" && input.kind !== "definition") {
      if (symbols.length !== 1)
        throw new Error(`Name resolves to ${symbols.length} indexed symbols; select an explicit symbol ID`);
      symbolId = symbols[0].id;
    }
    result = {
      schemaVersion: "projector.code-query-result/v1",
      generation,
      symbols: symbols.slice(0, input.limit),
      edges: [],
      coverage: []
    };
  } else
    result = {
      schemaVersion: "projector.code-query-result/v1",
      generation,
      symbols: [],
      edges: [],
      coverage: []
    };
  if (input.kind === "neighborhood") {
    const path = input.path ?? (symbolId === void 0 ? void 0 : store.query({
      schemaVersion: "projector.code-query/v1",
      generation,
      kind: "definition",
      symbolId
    }).symbols[0]?.definition.path);
    if (path === void 0)
      throw new Error("Neighborhood requires a known symbol or source path");
    const neighborhood = store.neighborhood(generation, path, Math.min(input.limit, 5e3));
    if (neighborhood.truncated || neighborhood.symbols.length > input.limit || neighborhood.incoming.length + neighborhood.outgoing.length > input.limit)
      boundedUnknowns.push("Neighborhood exceeded the result bound; query directional relationships with a cursor");
    result = {
      schemaVersion: "projector.code-query-result/v1",
      generation,
      symbols: neighborhood.symbols.slice(0, input.limit),
      edges: [...neighborhood.incoming, ...neighborhood.outgoing].slice(0, input.limit),
      coverage: neighborhood.coverage === void 0 ? [] : [neighborhood.coverage]
    };
  } else if (symbolId !== void 0 || input.name === void 0) {
    const kind = {
      symbols: "symbol",
      definition: "definition",
      references: "reference",
      callers: "call",
      callees: "call",
      implementations: "implementation",
      types: "type",
      imports: "import"
    }[input.kind];
    result = store.query({
      schemaVersion: "projector.code-query/v1",
      generation,
      kind,
      ...symbolId === void 0 ? {} : { symbolId },
      ...input.path === void 0 ? {} : { path: input.path },
      direction: input.kind === "callees" || input.kind === "imports" ? "outgoing" : "incoming",
      limit: input.limit,
      ...input.cursor === void 0 ? {} : { cursor: input.cursor }
    });
  }
  const paths = unique([
    ...result.symbols.map((symbol) => symbol.definition.path),
    ...result.edges.map((edge) => edge.source.path),
    ...input.path === void 0 ? [] : [input.path]
  ]);
  if (result.coverage.length === 0)
    result.coverage.push(...paths.map((path) => store.partition(generation, path)?.coverage).filter((coverage) => coverage !== void 0));
  const unknowns = unique([
    ...boundedUnknowns,
    ...result.coverage.flatMap((coverage) => coverage.status === "complete" ? [] : [
      coverage.reason ?? `Semantic coverage is ${coverage.status}: ${coverage.path}`
    ]),
    ...metadata.binding.status === "unbound" ? ["The imported index lacks a verified source/build binding"] : [],
    ...result.nextCursor === void 0 ? [] : ["Additional results remain; follow the generation-bound cursor"],
    "Static navigation does not establish a closed runtime call or reflection universe"
  ]);
  return CodeQueryEvidenceSchema.parse({
    query: result,
    freshness: metadata.binding.status === "unbound" ? "unbound" : input.freshness === "pinned" ? "historical" : "current",
    dependencyKeys: unique([
      `code:project:${metadata.binding.projectKey}`,
      ...paths.map((path) => `code:neighborhood:${path}`),
      ...symbolId === void 0 ? [] : [`code:symbol:${symbolId}`]
    ]),
    resultHash: hashFramedDomain("code-query-result", {
      symbols: result.symbols,
      edges: result.edges,
      coverage: result.coverage
    }),
    unknowns
  });
}
function impact(store, candidate) {
  const input = CodeImpactRequestSchema.parse(candidate), before = requiredGeneration(store, input.before), after = requiredGeneration(store, input.after);
  const paths = before === after ? [] : input.paths ?? unique([...allPaths(store, before), ...allPaths(store, after)]);
  const changed = /* @__PURE__ */ new Set(), affected = /* @__PURE__ */ new Set(), affectedPaths = /* @__PURE__ */ new Set(), possible = /* @__PURE__ */ new Set(), unknowns = [];
  const priorManifest = store.manifest(before);
  const currentManifest = store.manifest(after);
  const semanticAssumptionsChanged = before !== after && (priorManifest.configFingerprint !== currentManifest.configFingerprint || priorManifest.resolutionFingerprint !== currentManifest.resolutionFingerprint);
  let semanticPossible = false;
  const definitions = /* @__PURE__ */ new Map();
  for (const path of paths) {
    const old = store.partition(before, path), current = store.partition(after, path);
    if (semanticAssumptionsChanged && [old, current].some((partition) => partition?.coverage.capabilities.some((capability) => capability.fidelity === "semantic"))) {
      possible.add(path);
      semanticPossible = true;
    }
    if (canonicalJson(old ?? null) === canonicalJson(current ?? null))
      continue;
    affectedPaths.add(path);
    const left = new Map((old?.symbols ?? []).map((symbol) => [symbol.id, symbol])), right = new Map((current?.symbols ?? []).map((symbol) => [symbol.id, symbol]));
    for (const id of /* @__PURE__ */ new Set([...left.keys(), ...right.keys()])) {
      const a = left.get(id), b = right.get(id);
      if (a?.declarationHash !== b?.declarationHash || a?.bodyHash !== b?.bodyHash || a?.typeDisplay !== b?.typeDisplay || a?.kind !== b?.kind || a?.name !== b?.name || a?.definition.path !== b?.definition.path || a?.provenance.provider !== b?.provenance.provider || a?.provenance.version !== b?.provenance.version || a === void 0 || b === void 0)
        changed.add(id);
      if (b ?? a)
        definitions.set(id, b ?? a);
    }
    const oldEdges = new Map((old?.edges ?? []).map((edge) => [edge.id, edge]));
    const newEdges = new Map((current?.edges ?? []).map((edge) => [edge.id, edge]));
    for (const edgeId of /* @__PURE__ */ new Set([...oldEdges.keys(), ...newEdges.keys()])) {
      const previous = oldEdges.get(edgeId), next = newEdges.get(edgeId);
      if (canonicalJson(previous ?? null) === canonicalJson(next ?? null))
        continue;
      for (const edge of [previous, next]) {
        if (edge === void 0)
          continue;
        if (edge.sourceSymbolId !== void 0)
          changed.add(edge.sourceSymbolId);
        else
          for (const id of /* @__PURE__ */ new Set([...left.keys(), ...right.keys()]))
            changed.add(id);
      }
    }
    if (old === void 0 || current === void 0 || old.coverage.status !== "complete" || current.coverage.status !== "complete") {
      possible.add(path);
      unknowns.push(`Incomplete before/after semantic coverage retains file-level possible impact: ${path}`);
    }
  }
  if (semanticPossible)
    unknowns.push("Semantic configuration or external resolution inputs changed; unchanged local facts do not prove absence of file-level impact");
  const queue = [...changed];
  let truncated = false;
  for (let index = 0; index < queue.length; index++) {
    if (affected.size >= input.maxNodes) {
      truncated = true;
      break;
    }
    const id = queue[index];
    if (affected.has(id))
      continue;
    affected.add(id);
    for (const generation of [before, after]) {
      const definition = store.query({
        schemaVersion: "projector.code-query/v1",
        generation,
        kind: "definition",
        symbolId: id
      }).symbols[0] ?? definitions.get(id);
      if (definition !== void 0)
        affectedPaths.add(definition.definition.path);
      for (const kind of [
        "reference",
        "call",
        "type",
        "implementation"
      ]) {
        const result = store.query({
          schemaVersion: "projector.code-query/v1",
          generation,
          kind,
          symbolId: id,
          limit: 1e3
        });
        if (result.nextCursor !== void 0) {
          truncated = true;
          unknowns.push(`More ${kind} dependents exist for ${id}`);
        }
        for (const edge of result.edges) {
          affectedPaths.add(edge.source.path);
          if (edge.sourceSymbolId !== void 0 && !affected.has(edge.sourceSymbolId))
            queue.push(edge.sourceSymbolId);
          else
            possible.add(edge.source.path);
        }
      }
      if (definition !== void 0) {
        const neighborhood = store.neighborhood(generation, definition.definition.path, 1e3);
        for (const edge of neighborhood.incoming.filter((edge2) => edge2.kind === "bridge" && edge2.targetSymbolId === id)) {
          affectedPaths.add(edge.source.path);
          if (edge.sourceSymbolId !== void 0 && !affected.has(edge.sourceSymbolId))
            queue.push(edge.sourceSymbolId);
        }
        if (neighborhood.truncated) {
          truncated = true;
          unknowns.push(`Protocol bridge traversal is bounded for ${definition.definition.path}`);
        }
      }
    }
  }
  if (truncated)
    unknowns.push("Impact traversal reached its budget; existing repository impact must retain the unresolved frontier");
  return {
    before,
    after,
    changedSymbols: [...changed].sort(),
    affectedSymbols: [...affected].sort(),
    affectedPaths: [...affectedPaths].sort(),
    possiblePaths: [...possible].sort(),
    unknowns: unique(unknowns),
    truncated
  };
}
var providers = [
  {
    id: "native",
    languages: ["typescript", "javascript"],
    status: "available",
    detail: "Resident TypeScript compiler; project configuration and observed dependency inputs are bound"
  },
  {
    id: "syntax",
    languages: [
      "typescript",
      "javascript",
      "python",
      "rust",
      "c",
      "cpp",
      "java",
      "scala",
      "csharp",
      "go"
    ],
    status: "available",
    detail: "Bundled Tree-sitter structure; grammar availability and fidelity are reported per document"
  },
  ...[
    ["scip-python", "python", "scip-python index . --project-name PROJECT"],
    ["rust-analyzer", "rust", "rust-analyzer scip ."],
    [
      "scip-clang",
      "c,cpp",
      "scip-clang --compdb-path build/compile_commands.json; supported host toolchain required"
    ],
    [
      "scip-java",
      "java,kotlin",
      "scip-java index; may build and modify build caches"
    ],
    ["scip-dotnet", "csharp,vb", "scip-dotnet; selected .NET build required"],
    [
      "semanticdb",
      "scala",
      "Scala 2.13 semanticdb-scalac or Scala 3 -Ysemanticdb; import current compiler output"
    ]
  ].map(([id, languages, detail]) => ({
    id,
    languages: languages.split(","),
    status: "requires-toolchain",
    detail
  }))
];
async function executeCodeWorker(request, deadline, maxDerivedBytes, endSemanticLease = async () => {
}) {
  const metrics = {
    nativeUpdates: 0,
    syntaxUpdates: 0,
    imports: 0,
    publications: 0
  };
  const budget = new ObservationBudget({
    timeoutMs: Number.isFinite(deadline) ? Math.max(1, deadline - Date.now()) : null,
    ...maxDerivedBytes === void 0 ? {} : { maxDerivedBytes }
  });
  return metricScopes.run(metrics, () => budgetScopes.run(budget, () => endLeaseScopes.run(endSemanticLease, async () => {
    try {
      return await executeMeasuredCodeWorker(request, budget);
    } finally {
      const sink = process.env.PROJECTOR_OBSERVATION_METRICS_FILE;
      if (sink !== void 0) {
        if (!isAbsolute2(sink))
          throw new Error("Observation metrics sink must be an absolute host-selected path");
        appendFileSync(sink, JSON.stringify({
          kind: "code-operation-metrics",
          operation: request.operation,
          ...metrics
        }) + "\n", "utf8");
      }
    }
  })));
}
async function executeMeasuredCodeWorker(request, budget) {
  budget.check("code-worker", request.repositoryRoot);
  const store = await SqliteCodeStore.open(request.repositoryRoot);
  try {
    if (request.operation === "code.index")
      return { generation: await publishIndex(store, request) };
    if (request.operation === "code.index-status")
      return { head: store.head(), runs: [], providers };
    if (request.operation === "code.query") {
      const input = CodeQueryRequestSchema.parse(request.input);
      const observedGeneration = input.freshness === "pinned" ? void 0 : await currentGeneration(store, request, input.project);
      store.beginReadSnapshot();
      const generation = input.freshness === "pinned" ? requiredGeneration(store, input.generation) : requiredGeneration(store, observedGeneration);
      if (input.generation !== void 0 && input.generation !== generation && input.freshness === "current")
        throw new Error("Requested cursor/generation is no longer current; use a pinned query or restart the query");
      return queryGeneration(store, generation, input);
    }
    if (request.operation === "code.impact") {
      const input = CodeImpactRequestSchema.parse(request.input);
      const after = input.after ?? await currentGeneration(store, request);
      return store.withReadSnapshot(() => impact(store, { ...input, after }));
    }
    if (request.operation === "code.tests") {
      const input = CodeTestsRequestSchema.parse(request.input);
      const generation = input.generation ?? await currentGeneration(store, request);
      return await recommendTests(store, request.repositoryRoot, {
        ...input,
        generation
      });
    }
    if (request.operation === "code.evidence")
      return await importEvidence(store, request.repositoryRoot, request.input);
    if (request.operation === "code.export") {
      const input = CodeExportRequestSchema.parse(request.input);
      const artifactPath = input.artifactName === void 0 ? void 0 : await resolveDerivedCachePath(request.repositoryRoot, `.projector/runtime/code/exports/${input.artifactName}`);
      return store.withReadSnapshot(() => artifactPath === void 0 ? exportGraph(store, input) : exportGraphArtifact(store, input, artifactPath));
    }
    if (request.operation === "code.context") {
      const input = z2.strictObject({
        paths: z2.array(z2.string()),
        generation: z2.string().optional()
      }).parse(request.input);
      const generation = input.generation ?? await currentGeneration(store, request);
      return store.withReadSnapshot(() => contextSummary(store, generation, input.paths));
    }
    throw new Error(`Unsupported semantic worker operation: ${request.operation}`);
  } finally {
    store.close();
  }
}
function contextSummary(store, generation, paths) {
  const neighborhoods = unique(paths).slice(0, 32).map((path) => store.neighborhood(generation, path, 100));
  return CodeContextSummarySchema.parse({
    generation,
    worktreeDigest: store.manifest(generation).binding.worktreeDigest,
    symbols: [
      ...new Map(neighborhoods.flatMap((item) => item.symbols).map((symbol) => [symbol.id, symbol])).values()
    ].slice(0, 100),
    edges: [
      ...new Map(neighborhoods.flatMap((item) => [...item.incoming, ...item.outgoing]).map((edge) => [edge.id, edge])).values()
    ].slice(0, 200),
    relatedPaths: unique(neighborhoods.flatMap((item) => item.relatedPaths)),
    coverage: neighborhoods.flatMap((item) => item.coverage === void 0 ? [] : [item.coverage]),
    unknowns: unique([
      ...neighborhoods.flatMap((item) => item.truncated ? [`Semantic neighborhood truncated at ${item.path}`] : []),
      ...neighborhoods.flatMap((item) => item.coverage?.status === "complete" ? [] : [
        item.coverage?.reason ?? `Semantic coverage is unavailable for ${item.path}`
      ]),
      ...paths.length > 32 ? [
        "Additional requested paths remain outside the semantic display budget"
      ] : []
    ])
  });
}
async function evidenceStore(root) {
  return SqliteCodeEvidenceStore.open(root, budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes);
}
function normalizeCoveragePath(root, path) {
  const result = isAbsolute2(path) ? relative2(root, path).replaceAll("\\", "/") : path.replaceAll("\\", "/");
  if (result.startsWith("../") || result.includes("\0"))
    throw new Error("Coverage source is outside the repository binding");
  return result;
}
async function importEvidence(store, root, candidate) {
  const token = randomUUID(), scope = "semantic-publication";
  if (!await store.acquireLeaseWhenReady(scope, token, 3e5, { budget: budgetScopes.getStore() }))
    throw new Error("Another semantic writer owns this checkout; wait for it and retry evidence ingestion");
  parentPort?.postMessage({ semanticLease: { scope, token, repositoryRoot: root } });
  try {
    return await importEvidenceLeased(store, root, candidate, { scope, token });
  } finally {
    try {
      await endLeaseScopes.getStore()?.(scope, token);
    } finally {
      store.releaseLease(scope, token);
    }
  }
}
async function importEvidenceLeased(store, root, candidate, lease) {
  const input = CodeEvidenceRequestSchema.parse(candidate), retained = await evidenceStore(root), accepted = [], unknowns = [];
  const publishedEvidence = [];
  const publishedBridges = [];
  try {
    if (input.format === "bridges") {
      const generation = requiredGeneration(store, input.generation);
      if (input.bridges === void 0 || input.sourceHashes === void 0)
        throw new Error("Bridge import requires source-bound mappings");
      for (const bridge of input.bridges) {
        for (const path of bridge.sourcePaths)
          if (store.partition(generation, path)?.inputHash !== input.sourceHashes[path])
            throw new Error(`Bridge source binding mismatch: ${path}`);
        for (const symbolId of [bridge.fromSymbolId, bridge.toSymbolId]) {
          const symbol = store.query({
            schemaVersion: "projector.code-query/v1",
            generation,
            kind: "definition",
            symbolId
          }).symbols[0];
          if (symbol === void 0)
            throw new Error(`Bridge symbol is unavailable: ${symbolId}`);
          if (!bridge.sourcePaths.includes(symbol.definition.path))
            throw new Error(`Bridge must bind both endpoint source files: ${symbol.definition.path}`);
        }
        publishedBridges.push({
          generation,
          sourceHashes: input.sourceHashes,
          bridge
        });
        accepted.push(bridge.id);
      }
    } else {
      if (input.evidence === void 0)
        throw new Error("Runtime evidence requires run, build, workload, generation and source identities");
      const base = input.evidence, generation = requiredGeneration(store, base.generation);
      for (const [path, hash] of Object.entries(base.sourceHashes))
        if (store.partition(generation, path)?.inputHash !== hash)
          throw new Error(`Runtime source binding mismatch: ${path}`);
      const observations = [];
      if (input.format === "projector")
        observations.push(base);
      else {
        if (input.artifact === void 0)
          throw new Error("Coverage import requires an artifact");
        const path = await (await RepositoryPathService.create(root)).resolveRead(input.artifact);
        const allowance = budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes;
        if (allowance !== null && (await stat(path.realTarget)).size > allowance)
          throw new Error("Coverage artifact exceeds maxDerivedBytes; increase the explicit allowance and retry");
        const bytes = await readFile2(path.realTarget);
        if (allowance !== null && bytes.length > allowance)
          throw new Error("Coverage artifact changed during read or exceeds maxDerivedBytes; retry with an adequate explicit allowance");
        const data = JSON.parse(bytes.toString("utf8"));
        if (input.format === "coverage-py") {
          const document = z2.object({
            files: z2.record(z2.string(), z2.object({
              executed_lines: z2.array(z2.number().int().positive()).optional(),
              contexts: z2.record(z2.string(), z2.array(z2.string())).optional()
            }))
          }).parse(data);
          const tests = /* @__PURE__ */ new Map();
          for (const [file, coverage] of Object.entries(document.files)) {
            const source = normalizeCoveragePath(root, file);
            for (const [line, contexts] of Object.entries(coverage.contexts ?? {}))
              for (const test of contexts.filter(Boolean)) {
                const ranges = tests.get(test) ?? [];
                ranges.push({
                  path: source,
                  startLine: Number(line),
                  endLine: Number(line)
                });
                tests.set(test, ranges);
              }
            if (coverage.contexts === void 0)
              for (const line of coverage.executed_lines ?? []) {
                const ranges = tests.get("") ?? [];
                ranges.push({ path: source, startLine: line, endLine: line });
                tests.set("", ranges);
              }
          }
          for (const [test, ranges] of tests)
            observations.push({
              ...base,
              id: hashFramedDomain("coverage-python-test", {
                base: base.id,
                test
              }),
              testId: test || base.testId,
              attribution: test ? "per-test" : "aggregate",
              ranges
            });
        } else if (input.format === "istanbul") {
          const document = z2.record(z2.string(), z2.object({
            path: z2.string().optional(),
            statementMap: z2.record(z2.string(), z2.object({
              start: z2.object({ line: z2.number().int().positive() }),
              end: z2.object({ line: z2.number().int().positive() })
            })),
            s: z2.record(z2.string(), z2.number())
          })).parse(data);
          const ranges = Object.entries(document).flatMap(([file, coverage]) => Object.entries(coverage.statementMap).flatMap(([id, location]) => (coverage.s[id] ?? 0) > 0 ? [
            {
              path: normalizeCoveragePath(root, coverage.path ?? file),
              startLine: location.start.line,
              endLine: location.end.line
            }
          ] : []));
          observations.push({ ...base, ranges });
        } else {
          const mapped = await mapV8Coverage(root, data, base);
          unknowns.push(...mapped.unknowns);
          observations.push({ ...base, ranges: mapped.ranges });
        }
      }
      for (const evidence of observations) {
        for (const range of evidence.ranges)
          if (evidence.sourceHashes[range.path] === void 0 || range.endLine < range.startLine)
            throw new Error(`Coverage range lacks a valid source binding: ${range.path}`);
        const valid = CodeRuntimeEvidenceSchema.parse(evidence);
        publishedEvidence.push(valid);
        accepted.push(valid.id);
      }
    }
    for (const evidence of publishedEvidence)
      store.pinRetained(evidence.generation, `runtime-evidence:${evidence.id}`);
    store.heartbeatLease(lease.scope, lease.token, 3e5);
    const previousEvidence = retained.putEvidence(publishedEvidence);
    retained.putBridges(publishedBridges);
    for (const evidence of publishedEvidence) {
      const previous = previousEvidence.get(evidence.id);
      if (previous !== void 0 && previous !== evidence.generation)
        store.releaseRetained(previous, `runtime-evidence:${evidence.id}`);
    }
    if (input.format === "bridges") {
      const current = requiredGeneration(store), metadata = store.manifest(current);
      const snapshot = {
        ...metadata,
        partitions: allPaths(store, current).map((path) => store.partition(current, path))
      };
      await applyBridges(snapshot, root);
      countMetric("publications");
      store.publish(current, snapshot, lease);
    }
    return { accepted, unknowns };
  } finally {
    retained.close();
  }
}
async function applyBridges(snapshot, root) {
  const retained = await evidenceStore(root);
  try {
    const partitions = new Map(snapshot.partitions.map((partition) => [partition.path, partition]));
    const symbols = new Map(snapshot.partitions.flatMap((partition) => partition.symbols).map((symbol) => [symbol.id, symbol]));
    for (const partition of snapshot.partitions)
      partition.edges = partition.edges.filter((edge) => edge.kind !== "bridge");
    for (const item of retained.bridges()) {
      if (!item.bridge.sourcePaths.every((path) => partitions.get(path)?.inputHash === item.sourceHashes[path]))
        continue;
      const from = symbols.get(item.bridge.fromSymbolId), to = symbols.get(item.bridge.toSymbolId);
      if (from === void 0 || to === void 0)
        continue;
      const edge = {
        id: hashFramedDomain("code-protocol-bridge", item),
        kind: "bridge",
        source: from.definition,
        sourceSymbolId: from.id,
        targetSymbolId: to.id,
        targetPath: to.definition.path,
        resolution: "resolved",
        provenance: {
          provider: `projector.bridge:${item.bridge.protocol}`,
          version: "1",
          inputHash: hashFramedDomain("code-bridge-source", item.sourceHashes),
          artifact: `${item.bridge.id}:${item.bridge.identity}`
        }
      };
      partitions.get(from.definition.path).edges.push(edge);
    }
  } finally {
    retained.close();
  }
}
async function applyStagedBridges(store, stageId, lease, root) {
  const retained = await evidenceStore(root);
  try {
    for (const path of store.stagedPaths(stageId)) {
      const partition = store.stagedPartition(stageId, path);
      const edges = partition.edges.filter((edge) => edge.kind !== "bridge");
      if (edges.length !== partition.edges.length)
        store.replaceStagedPartition(stageId, { ...partition, edges }, lease);
    }
    const edgesByPath = /* @__PURE__ */ new Map();
    for (const item of retained.bridges()) {
      if (!item.bridge.sourcePaths.every((path2) => store.stagedPartition(stageId, path2)?.inputHash === item.sourceHashes[path2]))
        continue;
      const from = store.stagedSymbol(stageId, item.bridge.fromSymbolId), to = store.stagedSymbol(stageId, item.bridge.toSymbolId);
      if (from === void 0 || to === void 0)
        continue;
      const edge = {
        id: hashFramedDomain("code-protocol-bridge", item),
        kind: "bridge",
        source: from.definition,
        sourceSymbolId: item.bridge.fromSymbolId,
        targetSymbolId: item.bridge.toSymbolId,
        targetPath: to.definition.path,
        resolution: "resolved",
        provenance: {
          provider: `projector.bridge:${item.bridge.protocol}`,
          version: "1",
          inputHash: hashFramedDomain("code-bridge-source", item.sourceHashes),
          artifact: `${item.bridge.id}:${item.bridge.identity}`
        }
      };
      const path = from.definition.path;
      const edges = edgesByPath.get(path) ?? [];
      edges.push(edge);
      edgesByPath.set(path, edges);
    }
    for (const [path, edges] of edgesByPath) {
      const partition = store.stagedPartition(stageId, path);
      if (partition === void 0)
        throw new Error(`Bridge source partition missing: ${path}`);
      store.replaceStagedPartition(stageId, { ...partition, edges: [...partition.edges, ...edges] }, lease);
    }
  } finally {
    retained.close();
  }
}
async function recommendTests(store, root, candidate) {
  const input = CodeTestsRequestSchema.parse(candidate), retained = await evidenceStore(root);
  try {
    store.beginReadSnapshot();
    const generation = requiredGeneration(store, input.generation);
    const selected = store.manifest(generation);
    const { page, cursorKey, afterId } = retained.withReadSnapshot((revision) => {
      const cursorKey2 = hashFramedDomain("code-tests-page/v1", { generation, paths: [...input.paths].sort(), revision });
      let afterId2;
      if (input.cursor !== void 0) {
        const parsed = z2.strictObject({ key: z2.string(), afterId: z2.string() }).parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")));
        if (parsed.key !== cursorKey2)
          throw new Error("Test recommendation cursor does not match this generation, path filter, or evidence revision");
        afterId2 = parsed.afterId;
      }
      return {
        cursorKey: cursorKey2,
        afterId: afterId2,
        page: retained.evidencePage(input.paths, afterId2, input.limit, budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes)
      };
    });
    const candidates = /* @__PURE__ */ new Map();
    const targetPaths = new Set(input.paths), unknowns = [];
    const partitionHashes = /* @__PURE__ */ new Map();
    const inputHashFor = (path) => {
      if (!partitionHashes.has(path))
        partitionHashes.set(path, store.partition(generation, path)?.inputHash);
      return partitionHashes.get(path);
    };
    for (const path of afterId === void 0 ? input.paths : []) {
      const neighborhood = store.neighborhood(generation, path, 1e3);
      for (const neighbor of neighborhood.relatedPaths)
        if (/(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\.[^.]+$|(?:^|\/)test_[^/]+\.py$/iu.test(neighbor))
          candidates.set(neighbor, {
            testId: neighbor,
            reasons: [`Static semantic relationship with ${path}`],
            evidenceIds: [],
            observed: false
          });
      if (neighborhood.truncated || neighborhood.coverage?.status !== "complete")
        unknowns.push(`Test discovery remains open for ${path}`);
    }
    for (const evidence of page.records) {
      if (!evidence.ranges.some((range) => targetPaths.has(range.path)))
        continue;
      const recorded = store.manifest(evidence.generation);
      if (recorded === void 0 || !sameExecutionInputs(recorded, selected)) {
        unknowns.push(`Run ${evidence.runId} belongs to different or unavailable source, compiler or resolution inputs; rerun ${evidence.testId}`);
        continue;
      }
      if (evidence.attribution === "aggregate") {
        if (evidence.ranges.some((range) => targetPaths.has(range.path)))
          unknowns.push(`Aggregate run ${evidence.runId} cannot identify an individual covering test`);
        continue;
      }
      const matching = evidence.ranges.filter((range) => targetPaths.has(range.path) && inputHashFor(range.path) === evidence.sourceHashes[range.path]);
      if (matching.length === 0)
        continue;
      const current = candidates.get(evidence.testId) ?? {
        testId: evidence.testId,
        reasons: [],
        evidenceIds: [],
        observed: false
      };
      current.reasons.push(`${evidence.attribution} execution observed ${unique(matching.map((range) => range.path)).join(", ")} in ${evidence.runId}; build ${evidence.buildId}; workload ${evidence.workload}; outcome ${evidence.outcome}`);
      current.evidenceIds.push(evidence.id);
      current.observed = true;
      if (evidence.durationMs !== void 0)
        current.durationMs = evidence.durationMs;
      candidates.set(evidence.testId, current);
    }
    const recommendations = [...candidates.values()].sort((a, b) => Number(b.observed) - Number(a.observed) || (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity) || a.testId.localeCompare(b.testId)).slice(0, input.limit);
    const staticCandidatesOmitted = candidates.size > input.limit;
    if (staticCandidatesOmitted)
      unknowns.push("Additional candidate tests exceed the recommendation limit");
    const nextCursor = page.nextId === void 0 ? void 0 : Buffer.from(canonicalJson({ key: cursorKey, afterId: page.nextId })).toString("base64url");
    return {
      generation,
      recommendations,
      unknowns: unique(unknowns),
      complete: nextCursor === void 0 && !staticCandidatesOmitted && unknowns.length === 0,
      ...nextCursor === void 0 ? {} : { nextCursor },
      pageSemantics: "merge-recommendations-by-test-id",
      requiredVerificationUnaffected: true
    };
  } finally {
    retained.close();
  }
}
function sameExecutionInputs(left, right) {
  if (left.binding.status !== "verified" || right.binding.status !== "verified")
    return false;
  const executionInputs = (snapshot) => ({
    provider: snapshot.provider,
    providerVersion: snapshot.providerVersion,
    inputFingerprint: snapshot.inputFingerprint,
    configFingerprint: snapshot.configFingerprint,
    resolutionFingerprint: snapshot.resolutionFingerprint,
    checkoutId: snapshot.binding.checkoutId,
    projectKey: snapshot.binding.projectKey,
    resolutionProbes: snapshot.binding.resolutionProbes ?? [],
    directoryProbes: snapshot.binding.directoryProbes ?? [],
    directoryListings: snapshot.binding.directoryListings ?? []
  });
  return canonicalJson(executionInputs(left)) === canonicalJson(executionInputs(right));
}
function exportGraph(store, candidate) {
  const input = CodeExportRequestSchema.parse(candidate), generation = requiredGeneration(store, input.generation);
  let symbols = 0, edges = 0, bytes = 0;
  const chunks = [];
  const append = (text) => {
    bytes += Buffer.byteLength(text);
    if (bytes > input.maxBytes)
      throw new Error("Graph export exceeds maxBytes; increase the inline budget or request artifactName for a complete streamed export");
    chunks.push(text);
  };
  const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const csv = (text) => `"${text.replaceAll('"', '""')}"`;
  const paths = allPaths(store, generation);
  const nodes = /* @__PURE__ */ new Map();
  const workingSetAllowance = budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes;
  let estimatedNodeBytes = 0;
  const addNode = (id, node) => {
    if (!nodes.has(id))
      estimatedNodeBytes += 512 + 4 * (Buffer.byteLength(id) + Buffer.byteLength(node.name) + Buffer.byteLength(node.path));
    if (workingSetAllowance !== null && estimatedNodeBytes > workingSetAllowance)
      throw new Error("Inline graph export exceeds maxDerivedBytes working-set allowance; request artifactName for a complete streamed export");
    nodes.set(id, node);
  };
  const declaredSymbols = /* @__PURE__ */ new Set();
  const endpoints = (edge) => [
    edge.sourceSymbolId ?? `file:${edge.source.path}`,
    edge.targetSymbolId ?? (edge.targetPath === void 0 ? `unknown:${edge.id}` : `file:${edge.targetPath}`)
  ];
  for (const path of paths) {
    const partition = store.partition(generation, path);
    for (const symbol of partition.symbols) {
      if (!declaredSymbols.has(symbol.id))
        symbols++;
      declaredSymbols.add(symbol.id);
      addNode(symbol.id, {
        name: symbol.name,
        path: symbol.definition.path,
        kind: symbol.kind
      });
    }
    for (const edge of partition.edges) {
      const [source, target] = endpoints(edge);
      if (!nodes.has(source))
        addNode(source, {
          name: source,
          path: edge.source.path,
          kind: edge.sourceSymbolId === void 0 ? "file" : "external-symbol"
        });
      if (!nodes.has(target))
        addNode(target, {
          name: target,
          path: edge.targetPath ?? "",
          kind: edge.targetSymbolId !== void 0 ? "external-symbol" : edge.targetPath !== void 0 ? "file" : "unresolved"
        });
    }
  }
  const graphIds = new Map([...nodes.keys()].sort().map((id, index) => [id, `n${index}`]));
  if (input.format === "graphml")
    append('<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="name" for="node" attr.name="name" attr.type="string"/><key id="identity" for="node" attr.name="identity" attr.type="string"/><key id="kind" for="edge" attr.name="kind" attr.type="string"/><graph edgedefault="directed">\n');
  if (input.format === "nodes-csv")
    append("id:ID,name,path,kind:LABEL\n");
  if (input.format === "edges-csv")
    append(":START_ID,:END_ID,:TYPE,source_path,evidence_id\n");
  if (input.format === "jsonl")
    append(JSON.stringify({
      record: "manifest",
      generation,
      ...store.manifest(generation)
    }) + "\n");
  for (const [id, node] of nodes) {
    if (input.format === "graphml")
      append(`<node id="${graphIds.get(id)}"><data key="name">${xml(node.name)}</data><data key="identity">${xml(id)}</data></node>
`);
    if (input.format === "nodes-csv")
      append([id, node.name, node.path, node.kind].map(csv).join(",") + "\n");
  }
  const emittedSymbols = /* @__PURE__ */ new Set(), emittedEdges = /* @__PURE__ */ new Set();
  for (const path of paths) {
    const partition = store.partition(generation, path);
    if (input.format === "jsonl")
      append(JSON.stringify({
        record: "coverage",
        generation,
        inputHash: partition.inputHash,
        ...partition.coverage
      }) + "\n");
    for (const symbol of partition.symbols) {
      if (emittedSymbols.has(symbol.id))
        continue;
      emittedSymbols.add(symbol.id);
      if (input.format === "jsonl")
        append(JSON.stringify({ record: "symbol", generation, ...symbol }) + "\n");
    }
    for (const edge of partition.edges) {
      if (emittedEdges.has(edge.id))
        continue;
      emittedEdges.add(edge.id);
      edges++;
      if (input.format === "jsonl")
        append(JSON.stringify({ record: "edge", generation, ...edge }) + "\n");
      const [source, target] = endpoints(edge);
      if (input.format === "graphml")
        append(`<edge id="e${edges}" source="${graphIds.get(source)}" target="${graphIds.get(target)}"><data key="kind">${xml(edge.kind)}</data></edge>
`);
      else if (input.format === "edges-csv")
        append([source, target, edge.kind, edge.source.path, edge.id].map(csv).join(",") + "\n");
    }
  }
  if (input.format === "graphml")
    append("</graph></graphml>\n");
  return {
    generation,
    format: input.format,
    content: chunks.join(""),
    mediaType: input.format === "jsonl" ? "application/x-ndjson" : input.format === "graphml" ? "application/graphml+xml" : "text/csv",
    symbols,
    edges
  };
}
function exportGraphArtifact(store, candidate, destination) {
  const input = CodeExportRequestSchema.parse(candidate);
  const generation = requiredGeneration(store, input.generation);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const spoolPath = `${temporary}.sqlite`;
  const spool = new DatabaseSync(toNamespacedPath(spoolPath), { allowExtension: false, timeout: 5e3 });
  let file;
  let published = false;
  try {
    spool.exec(`
      PRAGMA journal_mode=DELETE;
      CREATE TABLE nodes(id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL) STRICT;
      CREATE TABLE symbols(id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE edges(id TEXT PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL, kind TEXT NOT NULL, source_path TEXT NOT NULL, value TEXT NOT NULL) STRICT;
      BEGIN IMMEDIATE;
    `);
    const node = spool.prepare("INSERT OR IGNORE INTO nodes(id,name,path,kind) VALUES(?,?,?,?)");
    const definedNode = spool.prepare("INSERT INTO nodes(id,name,path,kind) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,path=excluded.path,kind=excluded.kind");
    const symbol = spool.prepare("INSERT OR IGNORE INTO symbols(id,value) VALUES(?,?)");
    const edgeRow = spool.prepare("INSERT OR IGNORE INTO edges(id,source,target,kind,source_path,value) VALUES(?,?,?,?,?,?)");
    let after;
    do {
      budgetScopes.getStore()?.check("graph-export", generation);
      const page = store.paths(generation, 1e3, after);
      for (const path of page.paths) {
        const partition = store.partition(generation, path);
        for (const fact of partition.symbols) {
          definedNode.run(fact.id, fact.name, fact.definition.path, fact.kind);
          symbol.run(fact.id, canonicalJson(fact));
        }
        for (const fact of partition.edges) {
          const source = fact.sourceSymbolId ?? `file:${fact.source.path}`;
          const target = fact.targetSymbolId ?? (fact.targetPath === void 0 ? `unknown:${fact.id}` : `file:${fact.targetPath}`);
          node.run(source, source, fact.source.path, fact.sourceSymbolId === void 0 ? "file" : "external-symbol");
          node.run(target, target, fact.targetPath ?? "", fact.targetSymbolId !== void 0 ? "external-symbol" : fact.targetPath !== void 0 ? "file" : "unresolved");
          edgeRow.run(fact.id, source, target, fact.kind, fact.source.path, canonicalJson(fact));
        }
      }
      after = page.nextCursor;
    } while (after !== void 0);
    spool.exec("COMMIT");
    const symbols = spool.prepare("SELECT count(*) AS count FROM symbols").get().count;
    const edges = spool.prepare("SELECT count(*) AS count FROM edges").get().count;
    const digest = createHash("sha256");
    let bytes = 0;
    file = openSync(temporary, "wx", 384);
    const append = (text) => {
      budgetScopes.getStore()?.check("graph-export", generation);
      const buffer = Buffer.from(text);
      for (let offset = 0; offset < buffer.length; )
        offset += writeSync(file, buffer, offset, buffer.length - offset);
      digest.update(buffer);
      bytes += buffer.length;
    };
    const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const csv = (text) => `"${text.replaceAll('"', '""')}"`;
    const graphId = (identity) => `n${createHash("sha256").update(identity).digest("hex")}`;
    if (input.format === "graphml")
      append('<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="name" for="node" attr.name="name" attr.type="string"/><key id="identity" for="node" attr.name="identity" attr.type="string"/><key id="kind" for="edge" attr.name="kind" attr.type="string"/><graph edgedefault="directed">\n');
    if (input.format === "nodes-csv")
      append("id:ID,name,path,kind:LABEL\n");
    if (input.format === "edges-csv")
      append(":START_ID,:END_ID,:TYPE,source_path,evidence_id\n");
    if (input.format === "jsonl")
      append(JSON.stringify({ record: "manifest", generation, ...store.manifest(generation) }) + "\n");
    if (input.format === "graphml" || input.format === "nodes-csv")
      for (const row of spool.prepare("SELECT id,name,path,kind FROM nodes ORDER BY id").iterate()) {
        if (input.format === "graphml")
          append(`<node id="${graphId(row.id)}"><data key="name">${xml(row.name)}</data><data key="identity">${xml(row.id)}</data></node>
`);
        else
          append([row.id, row.name, row.path, row.kind].map(csv).join(",") + "\n");
      }
    if (input.format === "jsonl") {
      let cursor;
      do {
        const page = store.paths(generation, 1e3, cursor);
        for (const path of page.paths) {
          const partition = store.partition(generation, path);
          append(JSON.stringify({ record: "coverage", generation, inputHash: partition.inputHash, ...partition.coverage }) + "\n");
        }
        cursor = page.nextCursor;
      } while (cursor !== void 0);
      for (const row of spool.prepare("SELECT value FROM symbols ORDER BY id").iterate())
        append(JSON.stringify({ record: "symbol", generation, ...JSON.parse(row.value) }) + "\n");
    }
    if (input.format === "graphml" || input.format === "edges-csv" || input.format === "jsonl")
      for (const row of spool.prepare("SELECT id,source,target,kind,source_path,value FROM edges ORDER BY id").iterate()) {
        if (input.format === "graphml")
          append(`<edge id="e${createHash("sha256").update(row.id).digest("hex")}" source="${graphId(row.source)}" target="${graphId(row.target)}"><data key="kind">${xml(row.kind)}</data></edge>
`);
        else if (input.format === "edges-csv")
          append([row.source, row.target, row.kind, row.source_path, row.id].map(csv).join(",") + "\n");
        else
          append(JSON.stringify({ record: "edge", generation, ...JSON.parse(row.value) }) + "\n");
      }
    if (input.format === "graphml")
      append("</graph></graphml>\n");
    fsyncSync(file);
    closeSync(file);
    file = void 0;
    renameSync(temporary, destination);
    published = true;
    return {
      generation,
      format: input.format,
      mediaType: input.format === "jsonl" ? "application/x-ndjson" : input.format === "graphml" ? "application/graphml+xml" : "text/csv",
      symbols,
      edges,
      artifact: { path: destination, bytes, sha256: `sha256:v1:${digest.digest("hex")}` }
    };
  } finally {
    if (file !== void 0)
      closeSync(file);
    spool.close();
    rmSync(spoolPath, { force: true });
    if (!published)
      rmSync(temporary, { force: true });
  }
}
function codeNeighborhoodVersion(store, generation, path) {
  return store.dependencyVersion(generation, path);
}

export {
  executeCodeWorker,
  codeNeighborhoodVersion
};
