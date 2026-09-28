import { readFile, stat } from "node:fs/promises";
import { appendFileSync, closeSync, createReadStream, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, relative, dirname, toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parentPort } from "node:worker_threads";
import { z } from "zod";
import {
  CodeQueryRequestSchema,
  CodeIndexRequestSchema,
  CodeImpactRequestSchema,
  CodeTestsRequestSchema,
  CodeEvidenceRequestSchema,
  CodeRuntimeEvidenceSchema,
  CodeBridgeSchema,
  CodeExportRequestSchema,
  CodeQueryEvidenceSchema,
  CodeContextSummarySchema,
  hashFramedDomain,
  canonicalJson,
  ObservationBudget,
  DerivedObservationBudget,
  DEFAULT_OBSERVATION_LIMITS,
  type CodeSnapshot,
  type CodePartition,
  type CodeQueryResult,
  type CodeQueryEvidence,
  type CodeSymbol,
  type CodeRuntimeEvidence,
  type CodeImpactResult,
  type CodeContextSummary,
  type ContentHash,
  type CodeEdge,
} from "@projector/core";
import {
  TypeScriptCodeProvider,
  discoverTypeScriptProjects,
  verifyCodeInputBinding,
  TreeSitterCodeProvider,
  importScip,
  importSemanticDb,
  type InventoryEntry,
} from "@projector/analyzers";
import {
  SqliteCodeStore,
  SqliteCodeEvidenceStore,
  SqliteObservationStore,
  RepositoryPathService,
  resolveDerivedCachePath,
} from "@projector/runtime";
import type { IndexedObservationDescriptor } from "../observation/indexed-types.js";
import { mapV8Coverage } from "./v8-coverage.js";

export interface CodeWorkerRequest {
  readonly repositoryRoot: string;
  readonly operation: string;
  readonly input: unknown;
  readonly descriptor?: IndexedObservationDescriptor;
}
const engineVersion = "projector.code-engine/v1";
interface CodeOperationMetrics {
  nativeUpdates: number;
  syntaxUpdates: number;
  imports: number;
  publications: number;
}
const metricScopes = new AsyncLocalStorage<CodeOperationMetrics>();
const budgetScopes = new AsyncLocalStorage<ObservationBudget>();
const endLeaseScopes = new AsyncLocalStorage<(scope: string, token: string) => Promise<void>>();
function countMetric(field: keyof CodeOperationMetrics): void {
  const metrics = metricScopes.getStore();
  if (metrics !== undefined) metrics[field]++;
}
const compilers = new Map<string, TypeScriptCodeProvider>();
const syntax = new TreeSitterCodeProvider();
const sourceExtensions =
  /\.(?:[cm]?[jt]sx?|py|pyi|rs|[ch](?:pp|xx|\+\+)?|cc|hh|java|kt|kts|scala|sc|cs|vb|go|rb|php|swift|sh|bash|vue|svelte)$/iu;
const unique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();
function compiler(key: string): TypeScriptCodeProvider {
  let result = compilers.get(key);
  if (result !== undefined) {
    compilers.delete(key);
    compilers.set(key, result);
    return result;
  }
  result = new TypeScriptCodeProvider();
  compilers.set(key, result);
  // Keep one compiler program resident; published facts remain reusable on disk
  // after another project replaces it.
  while (compilers.size > 1) compilers.delete(compilers.keys().next().value!);
  return result;
}
function requireDescriptor(
  request: CodeWorkerRequest,
): IndexedObservationDescriptor {
  if (
    request.descriptor === undefined ||
    request.descriptor.repositoryRoot !== request.repositoryRoot
  )
    throw new Error(
      "Current code analysis requires its verified checkout observation",
    );
  return request.descriptor;
}
async function observedInputs(
  descriptor: IndexedObservationDescriptor,
): Promise<{ entries: InventoryEntry[]; close: () => void }> {
  const store = await SqliteObservationStore.open(descriptor.repositoryRoot);
  try {
    return { entries: store.inventoryEntriesAt<InventoryEntry>(descriptor.generation)
      .filter((entry) => entry.kind === "file"), close: () => store.close() };
  } catch (error) {
    store.close();
    throw error;
  }
}
function mergeSnapshots(
  snapshots: readonly CodeSnapshot[],
  descriptor: IndexedObservationDescriptor,
  projectKey: string,
  mode: string,
): CodeSnapshot {
  const partitions = new Map<string, CodePartition>();
  for (const snapshot of snapshots)
    for (const partition of snapshot.partitions) {
      const prior = partitions.get(partition.path);
      if (prior === undefined) {
        partitions.set(partition.path, partition);
        continue;
      }
      if (prior.inputHash !== partition.inputHash)
        throw new Error(
          `Providers observed different bytes for ${partition.path}`,
        );
      partitions.set(partition.path, {
        ...partition,
        symbols: [
          ...new Map(
            [...prior.symbols, ...partition.symbols].map((symbol) => [
              symbol.id,
              symbol,
            ]),
          ).values(),
        ],
        edges: [
          ...new Map(
            [...prior.edges, ...partition.edges].map((edge) => [edge.id, edge]),
          ).values(),
        ],
        coverage: {
          path: partition.path,
          status:
            prior.coverage.status === "complete" &&
            partition.coverage.status === "complete"
              ? "complete"
              : "partial",
          reason:
            unique(
              [prior.coverage.reason, partition.coverage.reason].filter(
                (reason): reason is string => reason !== undefined,
              ),
            ).join("; ") ||
            "Several compiler projects contribute facts for this source",
          capabilities: [
            ...new Map(
              [
                ...prior.coverage.capabilities,
                ...partition.coverage.capabilities,
              ].map((capability) => [
                `${capability.kind}:${capability.fidelity}`,
                capability,
              ]),
            ).values(),
          ],
        },
      });
    }
  const inputs = (
    key: "sourceInputs" | "configInputs" | "resolutionInputs",
  ) => {
    const found = new Map<string, { path: string; contentHash: string }>();
    for (const snapshot of snapshots)
      for (const item of snapshot.binding[key]) {
        const existing = found.get(item.path);
        if (existing !== undefined && existing.contentHash !== item.contentHash)
          throw new Error(
            `Provider input changed during indexing: ${item.path}`,
          );
        found.set(item.path, item);
      }
    return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
  };
  const sourceInputs = inputs("sourceInputs"),
    configInputs = inputs("configInputs"),
    resolutionInputs = inputs("resolutionInputs");
  const mergeProbes = <T extends { path: string }>(
    values: readonly T[],
  ): T[] => {
    const found = new Map<string, T>();
    for (const value of values) {
      const prior = found.get(value.path);
      if (prior !== undefined && canonicalJson(prior) !== canonicalJson(value))
        throw new Error(
          `Resolution input changed between compiler projects: ${value.path}`,
        );
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
        config: snapshot.configFingerprint,
      })),
    }),
    resolutionFingerprint: hashFramedDomain("code-resolution-inputs", {
      resolutionInputs,
      providers: snapshots.map((snapshot) => snapshot.resolutionFingerprint),
    }),
    binding: {
      status: snapshots.every(
        (snapshot) => snapshot.binding.status === "verified",
      )
        ? "verified"
        : "unbound",
      checkoutId: descriptor.checkoutId,
      worktreeDigest: descriptor.metadata.state.worktreeDigest,
      projectKey,
      sourceInputs,
      configInputs,
      resolutionInputs,
      resolutionProbes: mergeProbes(
        snapshots.flatMap(
          (snapshot) => snapshot.binding.resolutionProbes ?? [],
        ),
      ),
      directoryProbes: mergeProbes(
        snapshots.flatMap((snapshot) => snapshot.binding.directoryProbes ?? []),
      ),
      directoryListings: mergeProbes(
        snapshots.flatMap(
          (snapshot) => snapshot.binding.directoryListings ?? [],
        ),
      ),
    },
    partitions: [...partitions.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
  };
}

async function publishIndex(
  store: SqliteCodeStore,
  request: CodeWorkerRequest,
): Promise<string> {
  const input = CodeIndexRequestSchema.parse(request.input);
  const descriptor = requireDescriptor(request);
  const head = store.head();
  const existing = head === null ? undefined : store.manifest(head);
  if (
    input.provider === "native" &&
    existing?.provider === "projector.composite:native" &&
    existing?.providerVersion === engineVersion &&
    existing.binding.checkoutId === descriptor.checkoutId &&
    existing.binding.worktreeDigest ===
      descriptor.metadata.state.worktreeDigest &&
    existing.binding.projectKey ===
      `${input.project ?? "workspace"}#${input.buildVariant}` &&
    verifyCodeInputBinding(existing.binding, request.repositoryRoot)
  )
    return head!;
  const token = randomUUID(),
    scope = "semantic-publication";
  if (!await store.acquireLeaseWhenReady(scope, token, 300_000, { budget: budgetScopes.getStore() }))
    throw new Error(
      "Another semantic writer owns this checkout; wait for its index run and retry",
    );
  parentPort?.postMessage({ semanticLease: { scope, token, repositoryRoot: request.repositoryRoot } });
  try {
    return await publishIndexLeased(store, request, { scope, token });
  } finally {
    try { await endLeaseScopes.getStore()?.(scope, token); }
    finally { store.releaseLease(scope, token); }
  }
}
async function publishIndexLeased(
  store: SqliteCodeStore,
  request: CodeWorkerRequest,
  lease: { scope: string; token: string },
): Promise<string> {
  const descriptor = requireDescriptor(request),
    input = CodeIndexRequestSchema.parse(request.input);
  const projectKey = `${input.project ?? "workspace"}#${input.buildVariant}`;
  const expected = store.head(),
    prior = expected === null ? undefined : store.manifest(expected);
  if (
    input.provider === "native" &&
    prior?.provider === "projector.composite:native" &&
    prior?.providerVersion === engineVersion &&
    prior.binding.checkoutId === descriptor.checkoutId &&
    prior.binding.worktreeDigest === descriptor.metadata.state.worktreeDigest &&
    prior.binding.projectKey === projectKey &&
    verifyCodeInputBinding(prior.binding, request.repositoryRoot)
  )
    return expected!;
  const observed = await observedInputs(descriptor);
  try {
  const inventory = observed.entries;
  const admittedPaths = new Set(inventory.map((entry) => entry.path));
  const canRetainPrior =
    prior !== undefined &&
    prior.binding.sourceInputs.every((source) =>
      admittedPaths.has(source.path),
    ) &&
    verifyCodeInputBinding(prior.binding, request.repositoryRoot);
  const binding = {
    checkoutId: descriptor.checkoutId,
    worktreeDigest: descriptor.metadata.state.worktreeDigest,
    projectKey,
  };
  const stageId = randomUUID();
  store.beginStage(stageId, hashFramedDomain("code-stage-source/v1", {
    generation: descriptor.generation, checkoutId: descriptor.checkoutId,
    worktreeDigest: descriptor.metadata.state.worktreeDigest, projectKey,
    provider: input.provider, artifact: input.artifact,
  }), lease);
  const snapshots: CodeSnapshot[] = [];
  let ordinal = 0;
  const metadataOnly = (snapshot: CodeSnapshot): CodeSnapshot => ({ ...snapshot, partitions: [] });
  const bufferedSink = (providerOrdinal: number) => {
    let buffer: CodePartition[] = [];
    const flush = (): void => {
      if (buffer.length === 0) return;
      store.stageContributionBatch(stageId, providerOrdinal, buffer, lease);
      buffer = [];
    };
    return {
      put(partition: CodePartition): void {
        buffer.push(partition);
        if (buffer.length >= 64) flush();
      },
      get(path: string): CodePartition | undefined {
        flush();
        return store.contribution(stageId, providerOrdinal, path);
      },
      replace(partition: CodePartition): void {
        flush();
        store.replaceContribution(stageId, providerOrdinal, partition, lease);
      },
      flush,
    };
  };
  try {
  if (input.provider === "native") {
    const configurations =
      input.project === undefined
        ? discoverTypeScriptProjects(inventory)
        : [input.project];
    for (const configPath of configurations.length === 0
      ? [undefined]
      : configurations) {
      const key = `${descriptor.checkoutId}:${configPath ?? "inferred"}:${input.buildVariant}`;
      countMetric("nativeUpdates");
      const sink = bufferedSink(ordinal++);
      snapshots.push(metadataOnly(
        compiler(key).update(inventory, {
          repositoryRoot: request.repositoryRoot,
          binding: {
            ...binding,
            projectKey: `${configPath ?? "inferred"}#${input.buildVariant}`,
          },
          ...(configPath === undefined ? {} : { configPath }),
          maxProofBytes: budgetScopes.getStore()!.limits.maxDerivedBytes,
        }, sink),
      ));
      sink.flush();
    }
  }
  if (input.provider === "native" || input.provider === "syntax") {
    if (input.provider === "native" && prior !== undefined && canRetainPrior) {
      const sink = bufferedSink(ordinal++);
      let retained = false;
      for (const path of iteratePaths(store, expected!)) {
        if (store.contributionHasPath(stageId, path)) continue;
        const partition = store.partition(expected!, path)!;
        if ([...partition.symbols, ...partition.edges].some((fact) =>
          fact.provenance.provider === "projector.scip" || fact.provenance.provider === "projector.semanticdb")) {
          sink.put(partition);
          retained = true;
        }
      }
      sink.flush();
      if (retained) snapshots.push({ ...prior, partitions: [] });
    }
    const fallback = inventory.filter(
      (entry) => sourceExtensions.test(entry.path) && !store.contributionHasPath(stageId, entry.path),
    );
    if (fallback.length > 0) {
      countMetric("syntaxUpdates");
      const sink = bufferedSink(ordinal++);
      snapshots.push(metadataOnly(
        await syntax.update(fallback, {
          binding: { ...binding, status: "verified" },
        }, sink.put),
      ));
      sink.flush();
    }
  } else {
    if (input.provider === "external")
      throw new Error(
        "External producers must complete in the supervised host before artifact ingestion",
      );
    const artifact = await (
      await RepositoryPathService.create(request.repositoryRoot)
    ).resolveRead(input.artifact!);
    const bytes = createReadStream(artifact.realTarget, {
      highWaterMark: 64 * 1024,
    });
    const options = {
      inputs: inventory,
      binding,
      artifact: input.artifact!,
      maxArtifactBytes: budgetScopes.getStore()!.limits.maxDerivedBytes,
      maxFrameBytes: budgetScopes.getStore()!.limits.maxDerivedBytes,
      ...(input.sourceHashes === undefined
        ? {}
        : { sourceHashes: input.sourceHashes }),
    };
    countMetric("imports");
    const importOrdinal = prior !== undefined && canRetainPrior ? 1 : 0;
    const sink = bufferedSink(importOrdinal);
    snapshots.push(metadataOnly(
      input.provider === "scip"
        ? await importScip(bytes, { ...options, emitPartition: sink.put, getPartition: sink.get })
        : await importSemanticDb(bytes, { ...options, emitPartition: sink.put, getPartition: sink.get }),
    ));
    sink.flush();
    // Import replaces only documents the producer supplies; retain independently
    // verified contributions whose source/configuration closure still matches.
    if (prior !== undefined && canRetainPrior) {
      const retainedSink = bufferedSink(0);
      for (const path of iteratePaths(store, expected!))
        if (!store.contributionHasPath(stageId, path))
          retainedSink.put(store.partition(expected!, path)!);
      retainedSink.flush();
      snapshots.unshift({ ...prior, partitions: [] });
    }
  }
  const snapshot = mergeSnapshots(
    snapshots,
    descriptor,
    projectKey,
    input.provider,
  );
  if (
    snapshot.binding.status === "verified" &&
    !verifyCodeInputBinding(snapshot.binding, request.repositoryRoot)
  )
    throw new Error(
      "Source or compiler inputs changed during semantic analysis; the prior generation remains active",
    );
  const observation = await SqliteObservationStore.open(request.repositoryRoot);
  try {
    observation.verifyGeneration(descriptor.generation);
  } finally {
    observation.close();
  }
  store.materializeContributions(stageId, lease);
  await applyStagedBridges(store, stageId, lease, request.repositoryRoot);
  if (snapshot.binding.status === "verified" &&
    !verifyCodeInputBinding(snapshot.binding, request.repositoryRoot))
    throw new Error("Source or compiler inputs changed before semantic publication; the prior generation remains active");
  const finalObservation = await SqliteObservationStore.open(request.repositoryRoot);
  try { finalObservation.verifyGeneration(descriptor.generation); }
  finally { finalObservation.close(); }
  countMetric("publications");
  const { partitions: _partitions, ...metadata } = snapshot;
  return store.publishStage(stageId, expected, metadata, lease);
  } catch (error) {
    try { store.discardStage(stageId, lease); } catch { /* The original failure remains authoritative; a new lease removes abandoned rows. */ }
    throw error;
  }
  } finally { observed.close(); }
}
function* iteratePaths(store: SqliteCodeStore, generation: string): Iterable<string> {
  let after: string | undefined;
  do {
    budgetScopes.getStore()?.check("semantic-paths", generation);
    const page = store.paths(generation, 1000, after);
    yield* page.paths;
    after = page.nextCursor;
  } while (after !== undefined);
}
function allPaths(store: SqliteCodeStore, generation: string): string[] {
  const scope = budgetScopes.getStore();
  if (scope === undefined)
    throw new Error("Semantic path enumeration requires a worker observation budget");
  const allocation = new DerivedObservationBudget(scope.limits.maxDerivedBytes);
  const paths: string[] = [];
  let after: string | undefined;
  do {
    scope.check("semantic-paths", generation);
    const page = store.paths(generation, 1000, after);
    for (const path of page.paths)
      allocation.reserveString(path.length, "semantic-paths", generation);
    paths.push(...page.paths);
    after = page.nextCursor;
  } while (after !== undefined);
  return paths;
}
async function currentGeneration(
  store: SqliteCodeStore,
  request: CodeWorkerRequest,
  project?: string,
): Promise<string> {
  const descriptor = requireDescriptor(request),
    head = store.head();
  const existing = head === null ? undefined : store.manifest(head);
  if (
    existing?.providerVersion === engineVersion &&
    existing.binding.checkoutId === descriptor.checkoutId &&
    existing.binding.worktreeDigest ===
      descriptor.metadata.state.worktreeDigest &&
    existing.binding.projectKey === `${project ?? "workspace"}#default` &&
    verifyCodeInputBinding(existing.binding, request.repositoryRoot)
  )
    return head!;
  return publishIndex(store, {
    ...request,
    operation: "code.index",
    input: {
      provider: "native",
      ...(project === undefined ? {} : { project }),
    },
  });
}
function requiredGeneration(store: SqliteCodeStore, supplied?: string): string {
  const generation = supplied ?? store.head();
  if (generation === null || !store.hasGeneration(generation))
    throw new Error(
      "No completed semantic generation is available; run code.index first",
    );
  return generation;
}
function queryGeneration(
  store: SqliteCodeStore,
  generation: string,
  candidate: unknown,
): CodeQueryEvidence {
  const input = CodeQueryRequestSchema.parse(candidate),
    metadata = store.manifest(generation)!;
  let symbolId = input.symbolId;
  if (symbolId === undefined && input.offset !== undefined)
    symbolId = store.symbolAt(generation, input.path!, input.offset)?.id;
  if (symbolId === undefined && input.offset !== undefined)
    throw new Error(
      "No resolved indexed symbol exists at this source offset; inspect path coverage or select a known symbol ID",
    );
  let result: CodeQueryResult;
  const boundedUnknowns: string[] = [];
  if (input.name !== undefined && symbolId === undefined) {
    const symbols = store.symbolsByName(
      generation,
      input.name,
      Math.min(1000, input.limit + 1),
    );
    if (symbols.length >= input.limit)
      boundedUnknowns.push(
        "Symbol-name results reached the requested bound; use a source path or symbol ID to narrow the query",
      );
    if (input.kind !== "symbols" && input.kind !== "definition") {
      if (symbols.length !== 1)
        throw new Error(
          `Name resolves to ${symbols.length} indexed symbols; select an explicit symbol ID`,
        );
      symbolId = symbols[0]!.id;
    }
    result = {
      schemaVersion: "projector.code-query-result/v1",
      generation,
      symbols: symbols.slice(0, input.limit),
      edges: [],
      coverage: [],
    };
  } else
    result = {
      schemaVersion: "projector.code-query-result/v1",
      generation,
      symbols: [],
      edges: [],
      coverage: [],
    };
  if (input.kind === "neighborhood") {
    const path =
      input.path ??
      (symbolId === undefined
        ? undefined
        : store.query({
            schemaVersion: "projector.code-query/v1",
            generation,
            kind: "definition",
            symbolId,
          }).symbols[0]?.definition.path);
    if (path === undefined)
      throw new Error("Neighborhood requires a known symbol or source path");
    const neighborhood = store.neighborhood(
      generation,
      path,
      Math.min(input.limit, 5000),
    );
    if (
      neighborhood.truncated ||
      neighborhood.symbols.length > input.limit ||
      neighborhood.incoming.length + neighborhood.outgoing.length > input.limit
    )
      boundedUnknowns.push(
        "Neighborhood exceeded the result bound; query directional relationships with a cursor",
      );
    result = {
      schemaVersion: "projector.code-query-result/v1",
      generation,
      symbols: neighborhood.symbols.slice(0, input.limit),
      edges: [...neighborhood.incoming, ...neighborhood.outgoing].slice(
        0,
        input.limit,
      ),
      coverage:
        neighborhood.coverage === undefined ? [] : [neighborhood.coverage],
    };
  } else if (symbolId !== undefined || input.name === undefined) {
    const kind = (
      {
        symbols: "symbol",
        definition: "definition",
        references: "reference",
        callers: "call",
        callees: "call",
        implementations: "implementation",
        types: "type",
        imports: "import",
      } as const
    )[input.kind];
    result = store.query({
      schemaVersion: "projector.code-query/v1",
      generation,
      kind,
      ...(symbolId === undefined ? {} : { symbolId }),
      ...(input.path === undefined ? {} : { path: input.path }),
      direction:
        input.kind === "callees" || input.kind === "imports"
          ? "outgoing"
          : "incoming",
      limit: input.limit,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    });
  }
  const paths = unique([
    ...result.symbols.map((symbol) => symbol.definition.path),
    ...result.edges.map((edge) => edge.source.path),
    ...(input.path === undefined ? [] : [input.path]),
  ]);
  if (result.coverage.length === 0)
    result.coverage.push(
      ...paths
        .map((path) => store.partition(generation, path)?.coverage)
        .filter(
          (coverage): coverage is NonNullable<typeof coverage> =>
            coverage !== undefined,
        ),
    );
  const unknowns = unique([
    ...boundedUnknowns,
    ...result.coverage.flatMap((coverage) =>
      coverage.status === "complete"
        ? []
        : [
            coverage.reason ??
              `Semantic coverage is ${coverage.status}: ${coverage.path}`,
          ],
    ),
    ...(metadata.binding.status === "unbound"
      ? ["The imported index lacks a verified source/build binding"]
      : []),
    ...(result.nextCursor === undefined
      ? []
      : ["Additional results remain; follow the generation-bound cursor"]),
    "Static navigation does not establish a closed runtime call or reflection universe",
  ]);
  return CodeQueryEvidenceSchema.parse({
    query: result,
    freshness:
      metadata.binding.status === "unbound"
        ? "unbound"
        : input.freshness === "pinned"
          ? "historical"
          : "current",
    dependencyKeys: unique([
      `code:project:${metadata.binding.projectKey}`,
      ...paths.map((path) => `code:neighborhood:${path}`),
      ...(symbolId === undefined ? [] : [`code:symbol:${symbolId}`]),
    ]),
    resultHash: hashFramedDomain("code-query-result", {
      symbols: result.symbols,
      edges: result.edges,
      coverage: result.coverage,
    }),
    unknowns,
  });
}

function impact(store: SqliteCodeStore, candidate: unknown): CodeImpactResult {
  const input = CodeImpactRequestSchema.parse(candidate),
    before = requiredGeneration(store, input.before),
    after = requiredGeneration(store, input.after);
  const paths =
    before === after
      ? []
      : (input.paths ??
        unique([...allPaths(store, before), ...allPaths(store, after)]));
  const changed = new Set<string>(),
    affected = new Set<string>(),
    affectedPaths = new Set<string>(),
    possible = new Set<string>(),
    unknowns: string[] = [];
  const priorManifest = store.manifest(before)!;
  const currentManifest = store.manifest(after)!;
  const semanticAssumptionsChanged =
    before !== after &&
    (priorManifest.configFingerprint !== currentManifest.configFingerprint ||
      priorManifest.resolutionFingerprint !==
        currentManifest.resolutionFingerprint);
  let semanticPossible = false;
  const definitions = new Map<string, CodeSymbol>();
  for (const path of paths) {
    const old = store.partition(before, path),
      current = store.partition(after, path);
    // A stable local symbol display can hide a changed external declaration.
    // Without a per-partition resolution proof, retain file-level uncertainty.
    if (
      semanticAssumptionsChanged &&
      [old, current].some((partition) =>
        partition?.coverage.capabilities.some(
          (capability) => capability.fidelity === "semantic",
        ),
      )
    ) {
      possible.add(path);
      semanticPossible = true;
    }
    if (canonicalJson(old ?? null) === canonicalJson(current ?? null)) continue;
    affectedPaths.add(path);
    const left = new Map(
        (old?.symbols ?? []).map((symbol) => [symbol.id, symbol]),
      ),
      right = new Map(
        (current?.symbols ?? []).map((symbol) => [symbol.id, symbol]),
      );
    for (const id of new Set([...left.keys(), ...right.keys()])) {
      const a = left.get(id),
        b = right.get(id);
      if (
        a?.declarationHash !== b?.declarationHash ||
        a?.bodyHash !== b?.bodyHash ||
        a?.typeDisplay !== b?.typeDisplay ||
        a?.kind !== b?.kind ||
        a?.name !== b?.name ||
        a?.definition.path !== b?.definition.path ||
        a?.provenance.provider !== b?.provenance.provider ||
        a?.provenance.version !== b?.provenance.version ||
        a === undefined ||
        b === undefined
      )
        changed.add(id);
      if (b ?? a) definitions.set(id, (b ?? a)!);
    }
    const oldEdges = new Map((old?.edges ?? []).map((edge) => [edge.id, edge]));
    const newEdges = new Map(
      (current?.edges ?? []).map((edge) => [edge.id, edge]),
    );
    for (const edgeId of new Set([...oldEdges.keys(), ...newEdges.keys()])) {
      const previous = oldEdges.get(edgeId),
        next = newEdges.get(edgeId);
      if (canonicalJson(previous ?? null) === canonicalJson(next ?? null))
        continue;
      for (const edge of [previous, next]) {
        if (edge === undefined) continue;
        if (edge.sourceSymbolId !== undefined) changed.add(edge.sourceSymbolId);
        else
          for (const id of new Set([...left.keys(), ...right.keys()]))
            changed.add(id);
      }
    }
    if (
      old === undefined ||
      current === undefined ||
      old.coverage.status !== "complete" ||
      current.coverage.status !== "complete"
    ) {
      possible.add(path);
      unknowns.push(
        `Incomplete before/after semantic coverage retains file-level possible impact: ${path}`,
      );
    }
  }
  if (semanticPossible)
    unknowns.push(
      "Semantic configuration or external resolution inputs changed; unchanged local facts do not prove absence of file-level impact",
    );
  const queue = [...changed];
  let truncated = false;
  for (let index = 0; index < queue.length; index++) {
    if (affected.size >= input.maxNodes) {
      truncated = true;
      break;
    }
    const id = queue[index]!;
    if (affected.has(id)) continue;
    affected.add(id);
    for (const generation of [before, after]) {
      const definition =
        store.query({
          schemaVersion: "projector.code-query/v1",
          generation,
          kind: "definition",
          symbolId: id,
        }).symbols[0] ?? definitions.get(id);
      if (definition !== undefined)
        affectedPaths.add(definition.definition.path);
      for (const kind of [
        "reference",
        "call",
        "type",
        "implementation",
      ] as const) {
        const result = store.query({
          schemaVersion: "projector.code-query/v1",
          generation,
          kind,
          symbolId: id,
          limit: 1000,
        });
        if (result.nextCursor !== undefined) {
          truncated = true;
          unknowns.push(`More ${kind} dependents exist for ${id}`);
        }
        for (const edge of result.edges) {
          affectedPaths.add(edge.source.path);
          if (
            edge.sourceSymbolId !== undefined &&
            !affected.has(edge.sourceSymbolId)
          )
            queue.push(edge.sourceSymbolId);
          else possible.add(edge.source.path);
        }
      }
      if (definition !== undefined) {
        const neighborhood = store.neighborhood(
          generation,
          definition.definition.path,
          1000,
        );
        for (const edge of neighborhood.incoming.filter(
          (edge) => edge.kind === "bridge" && edge.targetSymbolId === id,
        )) {
          affectedPaths.add(edge.source.path);
          if (
            edge.sourceSymbolId !== undefined &&
            !affected.has(edge.sourceSymbolId)
          )
            queue.push(edge.sourceSymbolId);
        }
        if (neighborhood.truncated) {
          truncated = true;
          unknowns.push(
            `Protocol bridge traversal is bounded for ${definition.definition.path}`,
          );
        }
      }
    }
  }
  if (truncated)
    unknowns.push(
      "Impact traversal reached its budget; existing repository impact must retain the unresolved frontier",
    );
  return {
    before,
    after,
    changedSymbols: [...changed].sort(),
    affectedSymbols: [...affected].sort(),
    affectedPaths: [...affectedPaths].sort(),
    possiblePaths: [...possible].sort(),
    unknowns: unique(unknowns),
    truncated,
  };
}

const providers = [
  {
    id: "native",
    languages: ["typescript", "javascript"],
    status: "available" as const,
    detail:
      "Resident TypeScript compiler; project configuration and observed dependency inputs are bound",
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
      "go",
    ],
    status: "available" as const,
    detail:
      "Bundled Tree-sitter structure; grammar availability and fidelity are reported per document",
  },
  ...[
    ["scip-python", "python", "scip-python index . --project-name PROJECT"],
    ["rust-analyzer", "rust", "rust-analyzer scip ."],
    [
      "scip-clang",
      "c,cpp",
      "scip-clang --compdb-path build/compile_commands.json; supported host toolchain required",
    ],
    [
      "scip-java",
      "java,kotlin",
      "scip-java index; may build and modify build caches",
    ],
    ["scip-dotnet", "csharp,vb", "scip-dotnet; selected .NET build required"],
    [
      "semanticdb",
      "scala",
      "Scala 2.13 semanticdb-scalac or Scala 3 -Ysemanticdb; import current compiler output",
    ],
  ].map(([id, languages, detail]) => ({
    id: id!,
    languages: languages!.split(","),
    status: "requires-toolchain" as const,
    detail: detail!,
  })),
];

export async function executeCodeWorker(
  request: CodeWorkerRequest,
  deadline: number,
  maxDerivedBytes?: number | null,
  endSemanticLease: (scope: string, token: string) => Promise<void> = async () => {},
): Promise<unknown> {
  const metrics: CodeOperationMetrics = {
    nativeUpdates: 0,
    syntaxUpdates: 0,
    imports: 0,
    publications: 0,
  };
  const budget = new ObservationBudget({
    timeoutMs: Number.isFinite(deadline) ? Math.max(1, deadline - Date.now()) : null,
    ...(maxDerivedBytes === undefined ? {} : { maxDerivedBytes }),
  });
  return metricScopes.run(metrics, () => budgetScopes.run(budget, () => endLeaseScopes.run(endSemanticLease, async () => {
    try {
      return await executeMeasuredCodeWorker(request, budget);
    } finally {
      const sink = process.env.PROJECTOR_OBSERVATION_METRICS_FILE;
      if (sink !== undefined) {
        if (!isAbsolute(sink))
          throw new Error(
            "Observation metrics sink must be an absolute host-selected path",
          );
        appendFileSync(
          sink,
          JSON.stringify({
            kind: "code-operation-metrics",
            operation: request.operation,
            ...metrics,
          }) + "\n",
          "utf8",
        );
      }
    }
  })));
}
async function executeMeasuredCodeWorker(
  request: CodeWorkerRequest,
  budget: ObservationBudget,
): Promise<unknown> {
  budget.check("code-worker", request.repositoryRoot);
  const store = await SqliteCodeStore.open(request.repositoryRoot);
  try {
    if (request.operation === "code.index")
      return { generation: await publishIndex(store, request) };
    if (request.operation === "code.index-status")
      return { head: store.head(), runs: [], providers };
    if (request.operation === "code.query") {
      const input = CodeQueryRequestSchema.parse(request.input);
      const observedGeneration =
        input.freshness === "pinned"
          ? undefined
          : await currentGeneration(store, request, input.project);
      store.beginReadSnapshot();
      const generation =
        input.freshness === "pinned"
          ? requiredGeneration(store, input.generation)
          : requiredGeneration(store, observedGeneration);
      if (
        input.generation !== undefined &&
        input.generation !== generation &&
        input.freshness === "current"
      )
        throw new Error(
          "Requested cursor/generation is no longer current; use a pinned query or restart the query",
        );
      return queryGeneration(store, generation, input);
    }
    if (request.operation === "code.impact") {
      const input = CodeImpactRequestSchema.parse(request.input);
      const after = input.after ?? (await currentGeneration(store, request));
      return store.withReadSnapshot(() => impact(store, { ...input, after }));
    }
    if (request.operation === "code.tests") {
      const input = CodeTestsRequestSchema.parse(request.input);
      const generation =
        input.generation ?? (await currentGeneration(store, request));
      return await recommendTests(store, request.repositoryRoot, {
        ...input,
        generation,
      });
    }
    if (request.operation === "code.evidence")
      return await importEvidence(store, request.repositoryRoot, request.input);
    if (request.operation === "code.export") {
      const input = CodeExportRequestSchema.parse(request.input);
      const artifactPath = input.artifactName === undefined ? undefined
        : await resolveDerivedCachePath(request.repositoryRoot, `.projector/runtime/code/exports/${input.artifactName}`);
      return store.withReadSnapshot(() => artifactPath === undefined
        ? exportGraph(store, input)
        : exportGraphArtifact(store, input, artifactPath));
    }
    if (request.operation === "code.context") {
      const input = z
        .strictObject({
          paths: z.array(z.string()),
          generation: z.string().optional(),
        })
        .parse(request.input);
      const generation =
        input.generation ?? (await currentGeneration(store, request));
      return store.withReadSnapshot(() =>
        contextSummary(store, generation, input.paths),
      );
    }
    throw new Error(
      `Unsupported semantic worker operation: ${request.operation}`,
    );
  } finally {
    store.close();
  }
}

function contextSummary(
  store: SqliteCodeStore,
  generation: string,
  paths: readonly string[],
): CodeContextSummary {
  const neighborhoods = unique(paths)
    .slice(0, 32)
    .map((path) => store.neighborhood(generation, path, 100));
  return CodeContextSummarySchema.parse({
    generation,
    worktreeDigest: store.manifest(generation)!.binding.worktreeDigest,
    symbols: [
      ...new Map(
        neighborhoods
          .flatMap((item) => item.symbols)
          .map((symbol) => [symbol.id, symbol]),
      ).values(),
    ].slice(0, 100),
    edges: [
      ...new Map(
        neighborhoods
          .flatMap((item) => [...item.incoming, ...item.outgoing])
          .map((edge) => [edge.id, edge]),
      ).values(),
    ].slice(0, 200),
    relatedPaths: unique(neighborhoods.flatMap((item) => item.relatedPaths)),
    coverage: neighborhoods.flatMap((item) =>
      item.coverage === undefined ? [] : [item.coverage],
    ),
    unknowns: unique([
      ...neighborhoods.flatMap((item) =>
        item.truncated
          ? [`Semantic neighborhood truncated at ${item.path}`]
          : [],
      ),
      ...neighborhoods.flatMap((item) =>
        item.coverage?.status === "complete"
          ? []
          : [
              item.coverage?.reason ??
                `Semantic coverage is unavailable for ${item.path}`,
            ],
      ),
      ...(paths.length > 32
        ? [
            "Additional requested paths remain outside the semantic display budget",
          ]
        : []),
    ]),
  });
}

async function evidenceStore(root: string): Promise<SqliteCodeEvidenceStore> {
  return SqliteCodeEvidenceStore.open(
    root,
    budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes,
  );
}
function normalizeCoveragePath(root: string, path: string): string {
  const result = isAbsolute(path)
    ? relative(root, path).replaceAll("\\", "/")
    : path.replaceAll("\\", "/");
  if (result.startsWith("../") || result.includes("\0"))
    throw new Error("Coverage source is outside the repository binding");
  return result;
}
async function importEvidence(
  store: SqliteCodeStore,
  root: string,
  candidate: unknown,
): Promise<{ accepted: string[]; unknowns: string[] }> {
  const token = randomUUID(),
    scope = "semantic-publication";
  if (!await store.acquireLeaseWhenReady(scope, token, 300_000, { budget: budgetScopes.getStore() }))
    throw new Error(
      "Another semantic writer owns this checkout; wait for it and retry evidence ingestion",
    );
  parentPort?.postMessage({ semanticLease: { scope, token, repositoryRoot: root } });
  try {
    return await importEvidenceLeased(store, root, candidate, { scope, token });
  } finally {
    try { await endLeaseScopes.getStore()?.(scope, token); }
    finally { store.releaseLease(scope, token); }
  }
}
async function importEvidenceLeased(
  store: SqliteCodeStore,
  root: string,
  candidate: unknown,
  lease: { scope: string; token: string },
): Promise<{ accepted: string[]; unknowns: string[] }> {
  const input = CodeEvidenceRequestSchema.parse(candidate),
    retained = await evidenceStore(root),
    accepted: string[] = [],
    unknowns: string[] = [];
  const publishedEvidence: CodeRuntimeEvidence[] = [];
  const publishedBridges: { generation: string; sourceHashes: Record<string, string>; bridge: z.infer<typeof CodeBridgeSchema> }[] = [];
  try {
  if (input.format === "bridges") {
    const generation = requiredGeneration(store, input.generation);
    if (input.bridges === undefined || input.sourceHashes === undefined)
      throw new Error("Bridge import requires source-bound mappings");
    for (const bridge of input.bridges) {
      for (const path of bridge.sourcePaths)
        if (
          store.partition(generation, path)?.inputHash !==
          input.sourceHashes[path]
        )
          throw new Error(`Bridge source binding mismatch: ${path}`);
      for (const symbolId of [bridge.fromSymbolId, bridge.toSymbolId]) {
        const symbol = store.query({
          schemaVersion: "projector.code-query/v1",
          generation,
          kind: "definition",
          symbolId,
        }).symbols[0];
        if (symbol === undefined)
          throw new Error(`Bridge symbol is unavailable: ${symbolId}`);
        if (!bridge.sourcePaths.includes(symbol.definition.path))
          throw new Error(
            `Bridge must bind both endpoint source files: ${symbol.definition.path}`,
          );
      }
      publishedBridges.push({
        generation,
        sourceHashes: input.sourceHashes,
        bridge,
      });
      accepted.push(bridge.id);
    }
  } else {
    if (input.evidence === undefined)
      throw new Error(
        "Runtime evidence requires run, build, workload, generation and source identities",
      );
    const base = input.evidence,
      generation = requiredGeneration(store, base.generation);
    for (const [path, hash] of Object.entries(base.sourceHashes))
      if (store.partition(generation, path)?.inputHash !== hash)
        throw new Error(`Runtime source binding mismatch: ${path}`);
    const observations: CodeRuntimeEvidence[] = [];
    if (input.format === "projector") observations.push(base);
    else {
      if (input.artifact === undefined)
        throw new Error("Coverage import requires an artifact");
      const path = await (
        await RepositoryPathService.create(root)
      ).resolveRead(input.artifact);
      const allowance = budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes;
      if (allowance !== null && (await stat(path.realTarget)).size > allowance)
        throw new Error("Coverage artifact exceeds maxDerivedBytes; increase the explicit allowance and retry");
      const bytes = await readFile(path.realTarget);
      if (allowance !== null && bytes.length > allowance)
        throw new Error("Coverage artifact changed during read or exceeds maxDerivedBytes; retry with an adequate explicit allowance");
      const data: unknown = JSON.parse(bytes.toString("utf8"));
      if (input.format === "coverage-py") {
        const document = z
          .object({
            files: z.record(
              z.string(),
              z.object({
                executed_lines: z.array(z.number().int().positive()).optional(),
                contexts: z.record(z.string(), z.array(z.string())).optional(),
              }),
            ),
          })
          .parse(data);
        const tests = new Map<string, CodeRuntimeEvidence["ranges"]>();
        for (const [file, coverage] of Object.entries(document.files)) {
          const source = normalizeCoveragePath(root, file);
          for (const [line, contexts] of Object.entries(
            coverage.contexts ?? {},
          ))
            for (const test of contexts.filter(Boolean)) {
              const ranges = tests.get(test) ?? [];
              ranges.push({
                path: source,
                startLine: Number(line),
                endLine: Number(line),
              });
              tests.set(test, ranges);
            }
          if (coverage.contexts === undefined)
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
              test,
            }),
            testId: test || base.testId,
            attribution: test ? "per-test" : "aggregate",
            ranges,
          });
      } else if (input.format === "istanbul") {
        const document = z
          .record(
            z.string(),
            z.object({
              path: z.string().optional(),
              statementMap: z.record(
                z.string(),
                z.object({
                  start: z.object({ line: z.number().int().positive() }),
                  end: z.object({ line: z.number().int().positive() }),
                }),
              ),
              s: z.record(z.string(), z.number()),
            }),
          )
          .parse(data);
        const ranges = Object.entries(document).flatMap(([file, coverage]) =>
          Object.entries(coverage.statementMap).flatMap(([id, location]) =>
            (coverage.s[id] ?? 0) > 0
              ? [
                  {
                    path: normalizeCoveragePath(root, coverage.path ?? file),
                    startLine: location.start.line,
                    endLine: location.end.line,
                  },
                ]
              : [],
          ),
        );
        observations.push({ ...base, ranges });
      } else {
        const mapped = await mapV8Coverage(root, data, base);
        unknowns.push(...mapped.unknowns);
        observations.push({ ...base, ranges: mapped.ranges });
      }
    }
    for (const evidence of observations) {
      for (const range of evidence.ranges)
        if (
          evidence.sourceHashes[range.path] === undefined ||
          range.endLine < range.startLine
        )
          throw new Error(
            `Coverage range lacks a valid source binding: ${range.path}`,
          );
      const valid = CodeRuntimeEvidenceSchema.parse(evidence);
      publishedEvidence.push(valid);
      accepted.push(valid.id);
    }
  }
  // Pin before the evidence transaction commits; a failed import retains the
  // prior generation and the next replacement can reconcile the extra pin.
  for (const evidence of publishedEvidence)
    store.pinRetained(evidence.generation, `runtime-evidence:${evidence.id}`);
  store.heartbeatLease(lease.scope, lease.token, 300_000);
  const previousEvidence = retained.putEvidence(publishedEvidence);
  retained.putBridges(publishedBridges);
  for (const evidence of publishedEvidence) {
    const previous = previousEvidence.get(evidence.id);
    if (previous !== undefined && previous !== evidence.generation)
      store.releaseRetained(previous, `runtime-evidence:${evidence.id}`);
  }
  if (input.format === "bridges") {
    const current = requiredGeneration(store),
      metadata = store.manifest(current)!;
    const snapshot = {
      ...metadata,
      partitions: allPaths(store, current).map(
        (path) => store.partition(current, path)!,
      ),
    };
    await applyBridges(snapshot, root);
    countMetric("publications");
    store.publish(current, snapshot, lease);
  }
  return { accepted, unknowns };
  } finally { retained.close(); }
}
async function applyBridges(
  snapshot: CodeSnapshot,
  root: string,
): Promise<void> {
  const retained = await evidenceStore(root);
  try {
  const partitions = new Map(
      snapshot.partitions.map((partition) => [partition.path, partition]),
    );
  const symbols = new Map(
    snapshot.partitions
      .flatMap((partition) => partition.symbols)
      .map((symbol) => [symbol.id, symbol]),
  );
  for (const partition of snapshot.partitions)
    partition.edges = partition.edges.filter((edge) => edge.kind !== "bridge");
  for (const item of retained.bridges()) {
    if (
      !item.bridge.sourcePaths.every(
        (path) => partitions.get(path)?.inputHash === item.sourceHashes[path],
      )
    )
      continue;
    const from = symbols.get(item.bridge.fromSymbolId),
      to = symbols.get(item.bridge.toSymbolId);
    if (from === undefined || to === undefined) continue;
    const edge: CodeEdge = {
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
        artifact: `${item.bridge.id}:${item.bridge.identity}`,
      },
    };
    partitions.get(from.definition.path)!.edges.push(edge);
  }
  } finally { retained.close(); }
}
async function applyStagedBridges(
  store: SqliteCodeStore,
  stageId: string,
  lease: { scope: string; token: string },
  root: string,
): Promise<void> {
  const retained = await evidenceStore(root);
  try {
    for (const path of store.stagedPaths(stageId)) {
      const partition = store.stagedPartition(stageId, path)!;
      const edges = partition.edges.filter((edge) => edge.kind !== "bridge");
      if (edges.length !== partition.edges.length)
        store.replaceStagedPartition(stageId, { ...partition, edges }, lease);
    }
    const edgesByPath = new Map<string, CodeEdge[]>();
    for (const item of retained.bridges()) {
      if (!item.bridge.sourcePaths.every((path) =>
        store.stagedPartition(stageId, path)?.inputHash === item.sourceHashes[path]))
        continue;
      const from = store.stagedSymbol(stageId, item.bridge.fromSymbolId),
        to = store.stagedSymbol(stageId, item.bridge.toSymbolId);
      if (from === undefined || to === undefined) continue;
      const edge: CodeEdge = {
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
          artifact: `${item.bridge.id}:${item.bridge.identity}`,
        },
      };
      const path = from.definition.path;
      const edges = edgesByPath.get(path) ?? [];
      edges.push(edge);
      edgesByPath.set(path, edges);
    }
    for (const [path, edges] of edgesByPath) {
      const partition = store.stagedPartition(stageId, path);
      if (partition === undefined) throw new Error(`Bridge source partition missing: ${path}`);
      store.replaceStagedPartition(stageId, { ...partition, edges: [...partition.edges, ...edges] }, lease);
    }
  } finally { retained.close(); }
}
async function recommendTests(
  store: SqliteCodeStore,
  root: string,
  candidate: unknown,
) {
  const input = CodeTestsRequestSchema.parse(candidate),
    retained = await evidenceStore(root);
  try {
  store.beginReadSnapshot();
  const generation = requiredGeneration(store, input.generation);
  const selected = store.manifest(generation)!;
  const { page, cursorKey, afterId } = retained.withReadSnapshot((revision) => {
    const cursorKey = hashFramedDomain("code-tests-page/v1", { generation, paths: [...input.paths].sort(), revision });
    let afterId: string | undefined;
    if (input.cursor !== undefined) {
      const parsed = z.strictObject({ key: z.string(), afterId: z.string() }).parse(
        JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")),
      );
      if (parsed.key !== cursorKey) throw new Error("Test recommendation cursor does not match this generation, path filter, or evidence revision");
      afterId = parsed.afterId;
    }
    return {
      cursorKey,
      afterId,
      page: retained.evidencePage(
        input.paths, afterId, input.limit,
        budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes,
      ),
    };
  });
  const candidates = new Map<
    string,
    {
      testId: string;
      reasons: string[];
      evidenceIds: string[];
      observed: boolean;
      durationMs?: number;
    }
  >();
  const targetPaths = new Set(input.paths),
    unknowns: string[] = [];
  const partitionHashes = new Map<string, string | undefined>();
  const inputHashFor = (path: string): string | undefined => {
    if (!partitionHashes.has(path))
      partitionHashes.set(path, store.partition(generation, path)?.inputHash);
    return partitionHashes.get(path);
  };
  for (const path of afterId === undefined ? input.paths : []) {
    const neighborhood = store.neighborhood(generation, path, 1000);
    for (const neighbor of neighborhood.relatedPaths)
      if (
        /(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\.[^.]+$|(?:^|\/)test_[^/]+\.py$/iu.test(
          neighbor,
        )
      )
        candidates.set(neighbor, {
          testId: neighbor,
          reasons: [`Static semantic relationship with ${path}`],
          evidenceIds: [],
          observed: false,
        });
    if (neighborhood.truncated || neighborhood.coverage?.status !== "complete")
      unknowns.push(`Test discovery remains open for ${path}`);
  }
  for (const evidence of page.records) {
    if (!evidence.ranges.some((range) => targetPaths.has(range.path))) continue;
    const recorded = store.manifest(evidence.generation);
    if (recorded === undefined || !sameExecutionInputs(recorded, selected)) {
      unknowns.push(
        `Run ${evidence.runId} belongs to different or unavailable source, compiler or resolution inputs; rerun ${evidence.testId}`,
      );
      continue;
    }
    if (evidence.attribution === "aggregate") {
      if (evidence.ranges.some((range) => targetPaths.has(range.path)))
        unknowns.push(
          `Aggregate run ${evidence.runId} cannot identify an individual covering test`,
        );
      continue;
    }
    const matching = evidence.ranges.filter(
      (range) =>
        targetPaths.has(range.path) &&
        inputHashFor(range.path) === evidence.sourceHashes[range.path],
    );
    if (matching.length === 0) continue;
    const current = candidates.get(evidence.testId) ?? {
      testId: evidence.testId,
      reasons: [],
      evidenceIds: [],
      observed: false,
    };
    current.reasons.push(
      `${evidence.attribution} execution observed ${unique(matching.map((range) => range.path)).join(", ")} in ${evidence.runId}; build ${evidence.buildId}; workload ${evidence.workload}; outcome ${evidence.outcome}`,
    );
    current.evidenceIds.push(evidence.id);
    current.observed = true;
    if (evidence.durationMs !== undefined)
      current.durationMs = evidence.durationMs;
    candidates.set(evidence.testId, current);
  }
  const recommendations = [...candidates.values()]
    .sort(
      (a, b) =>
        Number(b.observed) - Number(a.observed) ||
        (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity) ||
        a.testId.localeCompare(b.testId),
    )
    .slice(0, input.limit);
  const staticCandidatesOmitted = candidates.size > input.limit;
  if (staticCandidatesOmitted)
    unknowns.push("Additional candidate tests exceed the recommendation limit");
  const nextCursor = page.nextId === undefined ? undefined : Buffer.from(canonicalJson({ key: cursorKey, afterId: page.nextId })).toString("base64url");
  return {
    generation,
    recommendations,
    unknowns: unique(unknowns),
    complete: nextCursor === undefined && !staticCandidatesOmitted && unknowns.length === 0,
    ...(nextCursor === undefined ? {} : { nextCursor }),
    pageSemantics: "merge-recommendations-by-test-id" as const,
    requiredVerificationUnaffected: true as const,
  };
  } finally { retained.close(); }
}
function sameExecutionInputs(
  left: Omit<CodeSnapshot, "partitions">,
  right: Omit<CodeSnapshot, "partitions">,
): boolean {
  if (left.binding.status !== "verified" || right.binding.status !== "verified")
    return false;
  // Repository prose can change without changing a build. Source, compiler and
  // dependency-resolution changes invalidate the observed test attribution.
  const executionInputs = (snapshot: Omit<CodeSnapshot, "partitions">) => ({
    provider: snapshot.provider,
    providerVersion: snapshot.providerVersion,
    inputFingerprint: snapshot.inputFingerprint,
    configFingerprint: snapshot.configFingerprint,
    resolutionFingerprint: snapshot.resolutionFingerprint,
    checkoutId: snapshot.binding.checkoutId,
    projectKey: snapshot.binding.projectKey,
    resolutionProbes: snapshot.binding.resolutionProbes ?? [],
    directoryProbes: snapshot.binding.directoryProbes ?? [],
    directoryListings: snapshot.binding.directoryListings ?? [],
  });
  return (
    canonicalJson(executionInputs(left)) ===
    canonicalJson(executionInputs(right))
  );
}
function exportGraph(store: SqliteCodeStore, candidate: unknown) {
  const input = CodeExportRequestSchema.parse(candidate),
    generation = requiredGeneration(store, input.generation);
  let symbols = 0,
    edges = 0,
    bytes = 0;
  const chunks: string[] = [];
  const append = (text: string) => {
    bytes += Buffer.byteLength(text);
    if (bytes > input.maxBytes)
      throw new Error(
        "Graph export exceeds maxBytes; increase the inline budget or request artifactName for a complete streamed export",
      );
    chunks.push(text);
  };
  const xml = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const csv = (text: string) => `"${text.replaceAll('"', '""')}"`;
  const paths = allPaths(store, generation);
  const nodes = new Map<string, { name: string; path: string; kind: string }>();
  const workingSetAllowance = budgetScopes.getStore()?.limits.maxDerivedBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes;
  let estimatedNodeBytes = 0;
  const addNode = (id: string, node: { name: string; path: string; kind: string }): void => {
    if (!nodes.has(id))
      estimatedNodeBytes += 512 + 4 * (Buffer.byteLength(id) + Buffer.byteLength(node.name) + Buffer.byteLength(node.path));
    if (workingSetAllowance !== null && estimatedNodeBytes > workingSetAllowance)
      throw new Error("Inline graph export exceeds maxDerivedBytes working-set allowance; request artifactName for a complete streamed export");
    nodes.set(id, node);
  };
  const declaredSymbols = new Set<string>();
  const endpoints = (edge: CodeEdge): [string, string] => [
    edge.sourceSymbolId ?? `file:${edge.source.path}`,
    edge.targetSymbolId ??
      (edge.targetPath === undefined
        ? `unknown:${edge.id}`
        : `file:${edge.targetPath}`),
  ];
  // File, external and unresolved targets remain visible. Dropping these edges
  // would make an incomplete export appear to describe the whole graph.
  for (const path of paths) {
    const partition = store.partition(generation, path)!;
    for (const symbol of partition.symbols) {
      if (!declaredSymbols.has(symbol.id)) symbols++;
      declaredSymbols.add(symbol.id);
      addNode(symbol.id, {
        name: symbol.name,
        path: symbol.definition.path,
        kind: symbol.kind,
      });
    }
    for (const edge of partition.edges) {
      const [source, target] = endpoints(edge);
      if (!nodes.has(source))
        addNode(source, {
          name: source,
          path: edge.source.path,
          kind: edge.sourceSymbolId === undefined ? "file" : "external-symbol",
        });
      if (!nodes.has(target))
        addNode(target, {
          name: target,
          path: edge.targetPath ?? "",
          kind:
            edge.targetSymbolId !== undefined
              ? "external-symbol"
              : edge.targetPath !== undefined
                ? "file"
                : "unresolved",
        });
    }
  }
  // Emit deterministic GraphML identifiers independently of a provider's syntax.
  const graphIds = new Map(
    [...nodes.keys()].sort().map((id, index) => [id, `n${index}`]),
  );
  if (input.format === "graphml")
    append(
      '<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="name" for="node" attr.name="name" attr.type="string"/><key id="identity" for="node" attr.name="identity" attr.type="string"/><key id="kind" for="edge" attr.name="kind" attr.type="string"/><graph edgedefault="directed">\n',
    );
  if (input.format === "nodes-csv") append("id:ID,name,path,kind:LABEL\n");
  if (input.format === "edges-csv")
    append(":START_ID,:END_ID,:TYPE,source_path,evidence_id\n");
  if (input.format === "jsonl")
    append(
      JSON.stringify({
        record: "manifest",
        generation,
        ...store.manifest(generation),
      }) + "\n",
    );
  for (const [id, node] of nodes) {
    if (input.format === "graphml")
      append(
        `<node id="${graphIds.get(id)}"><data key="name">${xml(node.name)}</data><data key="identity">${xml(id)}</data></node>\n`,
      );
    if (input.format === "nodes-csv")
      append([id, node.name, node.path, node.kind].map(csv).join(",") + "\n");
  }
  const emittedSymbols = new Set<string>(),
    emittedEdges = new Set<string>();
  for (const path of paths) {
    const partition = store.partition(generation, path)!;
    if (input.format === "jsonl")
      append(
        JSON.stringify({
          record: "coverage",
          generation,
          inputHash: partition.inputHash,
          ...partition.coverage,
        }) + "\n",
      );
    for (const symbol of partition.symbols) {
      if (emittedSymbols.has(symbol.id)) continue;
      emittedSymbols.add(symbol.id);
      if (input.format === "jsonl")
        append(
          JSON.stringify({ record: "symbol", generation, ...symbol }) + "\n",
        );
    }
    for (const edge of partition.edges) {
      if (emittedEdges.has(edge.id)) continue;
      emittedEdges.add(edge.id);
      edges++;
      if (input.format === "jsonl")
        append(JSON.stringify({ record: "edge", generation, ...edge }) + "\n");
      const [source, target] = endpoints(edge);
      if (input.format === "graphml")
        append(
          `<edge id="e${edges}" source="${graphIds.get(source)}" target="${graphIds.get(target)}"><data key="kind">${xml(edge.kind)}</data></edge>\n`,
        );
      else if (input.format === "edges-csv")
        append(
          [source, target, edge.kind, edge.source.path, edge.id]
            .map(csv)
            .join(",") + "\n",
        );
    }
  }
  if (input.format === "graphml") append("</graph></graphml>\n");
  return {
    generation,
    format: input.format,
    content: chunks.join(""),
    mediaType:
      input.format === "jsonl"
        ? "application/x-ndjson"
        : input.format === "graphml"
          ? "application/graphml+xml"
          : "text/csv",
    symbols,
    edges,
  };
}

/** Stream a complete export through a disk-backed deduplication set. */
function exportGraphArtifact(
  store: SqliteCodeStore,
  candidate: unknown,
  destination: string,
) {
  const input = CodeExportRequestSchema.parse(candidate);
  const generation = requiredGeneration(store, input.generation);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const spoolPath = `${temporary}.sqlite`;
  const spool = new DatabaseSync(toNamespacedPath(spoolPath), { allowExtension: false, timeout: 5_000 });
  let file: number | undefined;
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
    let after: string | undefined;
    do {
      budgetScopes.getStore()?.check("graph-export", generation);
      const page = store.paths(generation, 1000, after);
      for (const path of page.paths) {
        const partition = store.partition(generation, path)!;
        for (const fact of partition.symbols) {
          definedNode.run(fact.id, fact.name, fact.definition.path, fact.kind);
          symbol.run(fact.id, canonicalJson(fact));
        }
        for (const fact of partition.edges) {
          const source = fact.sourceSymbolId ?? `file:${fact.source.path}`;
          const target = fact.targetSymbolId ?? (fact.targetPath === undefined ? `unknown:${fact.id}` : `file:${fact.targetPath}`);
          node.run(source, source, fact.source.path, fact.sourceSymbolId === undefined ? "file" : "external-symbol");
          node.run(target, target, fact.targetPath ?? "", fact.targetSymbolId !== undefined ? "external-symbol" : fact.targetPath !== undefined ? "file" : "unresolved");
          edgeRow.run(fact.id, source, target, fact.kind, fact.source.path, canonicalJson(fact));
        }
      }
      after = page.nextCursor;
    } while (after !== undefined);
    spool.exec("COMMIT");
    const symbols = (spool.prepare("SELECT count(*) AS count FROM symbols").get() as { count: number }).count;
    const edges = (spool.prepare("SELECT count(*) AS count FROM edges").get() as { count: number }).count;
    const digest = createHash("sha256");
    let bytes = 0;
    file = openSync(temporary, "wx", 0o600);
    const append = (text: string): void => {
      budgetScopes.getStore()?.check("graph-export", generation);
      const buffer = Buffer.from(text);
      for (let offset = 0; offset < buffer.length; ) offset += writeSync(file!, buffer, offset, buffer.length - offset);
      digest.update(buffer);
      bytes += buffer.length;
    };
    const xml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const csv = (text: string) => `"${text.replaceAll('"', '""')}"`;
    const graphId = (identity: string) => `n${createHash("sha256").update(identity).digest("hex")}`;
    if (input.format === "graphml") append('<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="name" for="node" attr.name="name" attr.type="string"/><key id="identity" for="node" attr.name="identity" attr.type="string"/><key id="kind" for="edge" attr.name="kind" attr.type="string"/><graph edgedefault="directed">\n');
    if (input.format === "nodes-csv") append("id:ID,name,path,kind:LABEL\n");
    if (input.format === "edges-csv") append(":START_ID,:END_ID,:TYPE,source_path,evidence_id\n");
    if (input.format === "jsonl") append(JSON.stringify({ record: "manifest", generation, ...store.manifest(generation) }) + "\n");
    if (input.format === "graphml" || input.format === "nodes-csv")
      for (const row of spool.prepare("SELECT id,name,path,kind FROM nodes ORDER BY id").iterate() as IterableIterator<{ id: string; name: string; path: string; kind: string }>) {
        if (input.format === "graphml") append(`<node id="${graphId(row.id)}"><data key="name">${xml(row.name)}</data><data key="identity">${xml(row.id)}</data></node>\n`);
        else append([row.id, row.name, row.path, row.kind].map(csv).join(",") + "\n");
      }
    if (input.format === "jsonl") {
      let cursor: string | undefined;
      do {
        const page = store.paths(generation, 1000, cursor);
        for (const path of page.paths) {
          const partition = store.partition(generation, path)!;
          append(JSON.stringify({ record: "coverage", generation, inputHash: partition.inputHash, ...partition.coverage }) + "\n");
        }
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      for (const row of spool.prepare("SELECT value FROM symbols ORDER BY id").iterate() as IterableIterator<{ value: string }>)
        append(JSON.stringify({ record: "symbol", generation, ...JSON.parse(row.value) }) + "\n");
    }
    if (input.format === "graphml" || input.format === "edges-csv" || input.format === "jsonl")
      for (const row of spool.prepare("SELECT id,source,target,kind,source_path,value FROM edges ORDER BY id").iterate() as IterableIterator<{ id: string; source: string; target: string; kind: string; source_path: string; value: string }>) {
        if (input.format === "graphml") append(`<edge id="e${createHash("sha256").update(row.id).digest("hex")}" source="${graphId(row.source)}" target="${graphId(row.target)}"><data key="kind">${xml(row.kind)}</data></edge>\n`);
        else if (input.format === "edges-csv") append([row.source, row.target, row.kind, row.source_path, row.id].map(csv).join(",") + "\n");
        else append(JSON.stringify({ record: "edge", generation, ...JSON.parse(row.value) }) + "\n");
      }
    if (input.format === "graphml") append("</graph></graphml>\n");
    fsyncSync(file);
    closeSync(file);
    file = undefined;
    renameSync(temporary, destination);
    published = true;
    return {
      generation,
      format: input.format,
      mediaType: input.format === "jsonl" ? "application/x-ndjson" : input.format === "graphml" ? "application/graphml+xml" : "text/csv",
      symbols,
      edges,
      artifact: { path: destination, bytes, sha256: `sha256:v1:${digest.digest("hex")}` },
    };
  } finally {
    if (file !== undefined) closeSync(file);
    spool.close();
    rmSync(spoolPath, { force: true });
    if (!published) rmSync(temporary, { force: true });
  }
}

/** Query dependency identity excludes the global generation: unchanged addressed
 * populations retain their version after unrelated source changes. */
export function codeNeighborhoodVersion(
  store: SqliteCodeStore,
  generation: string,
  path: string,
): ContentHash {
  return store.dependencyVersion(generation, path) as ContentHash;
}
