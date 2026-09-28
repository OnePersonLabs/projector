import { randomUUID } from "node:crypto";
import { readFile, opendir, stat, lstat } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, DerivedObservationBudget, hashFramedDomain, GeneratedOutputEvidenceSchema, GeneratedOutputRequestSchema, ObservationBudget, type GeneratedOutputEvidence, type GeneratedOutputRequest } from "@projector/core";
import { DurableArtifactSetStore, RepositoryPathService, WriterLeaseManager, type GenerationWriterLeaseHandle, type ArtifactSetReadScope } from "@projector/runtime";
import { VerificationService, validateVerificationEvent, type VerificationOptions } from "../verification/service.js";
import { retainImmutableRecord } from "../verification/retention.js";
import { readObservationFile } from "@projector/analyzers";

/** Executes a repository source entrypoint through a bound runtime. Evidence observes declared scope;
 * it does not prove exclusive causation, sandbox execution, or completeness of declared inputs. */
export class GeneratedOutputService {
  private constructor(private readonly paths: RepositoryPathService, private readonly verification: VerificationService, private readonly storage: string, private readonly signal: AbortSignal, private readonly observationTimeoutMs: number, private readonly retainedStorage: string | undefined, private readonly executionOptions: VerificationOptions) {}
  static async create(root: string, options: VerificationOptions = {}): Promise<GeneratedOutputService> {
    const paths = await RepositoryPathService.create(root);
    const observationTimeoutMs = new ObservationBudget({ timeoutMs: options.observationTimeoutMs ?? 30000 }).limits.timeoutMs;
    return new GeneratedOutputService(paths, await VerificationService.create(root, options), (await paths.resolveWrite(".projector/runtime/change-lifecycles/generated-outputs")).realTarget, options.signal ?? new AbortController().signal, observationTimeoutMs, options.evidenceStoreRoot === undefined ? undefined : join(options.evidenceStoreRoot, "generated-outputs"), options);
  }
  private observation() {
    return new ObservationBudget({ timeoutMs: this.observationTimeoutMs, maxFiles: 10000, maxTotalBytes: 256 * 1024 * 1024, maxFileBytes: 64 * 1024 * 1024 });
  }
  private store(readScope?: ArtifactSetReadScope, root = this.storage) {
    return new DurableArtifactSetStore<GeneratedOutputEvidence>(root, (bytes) => {
      const manifest = GeneratedOutputEvidenceSchema.parse(JSON.parse(Buffer.from(bytes).toString("utf8")));
      const { contentHash, ...basis } = manifest;
      if (hashFramedDomain("generated-output-evidence", basis) !== contentHash) throw new Error("Generated output evidence integrity failed");
      validateVerificationEvent(manifest.check);
      const request = manifest.request;
      const expected = { executable: request.executable, sourcePath: request.sourcePath, args: request.args, inputPaths: [...new Set([request.sourcePath, ...request.inputPaths])], populations: request.populations, environment: request.environment, timeoutMs: request.timeoutMs, ...(request.completeInputs === undefined ? {} : { completeInputs: request.completeInputs }) };
      if (canonicalJson(expected) !== canonicalJson(manifest.check.request)) throw new Error("Generated output execution request association failed");
      return { manifest, blobs: [] };
    }, {}, readScope);
  }
  private readScope(budget: ObservationBudget): ArtifactSetReadScope {
    return { budget, signal: this.signal, derivedBudget: new DerivedObservationBudget(budget.limits.maxDerivedBytes) };
  }
  private async outputs(request: GeneratedOutputRequest, budget: ObservationBudget) {
    const result: Record<string, ReturnType<typeof hashFramedDomain>> = {};
    let remaining = 64 * 1024 * 1024;
    for (const output of request.outputs) {
      this.signal.throwIfAborted(); budget.check("generated-output", output.path);
      try {
        const path = await this.paths.resolveRead(output.path);
        const metadata = await stat(path.realTarget);
        if (!metadata.isFile() || metadata.size > 64 * 1024 * 1024) throw new Error(`Generated output requires a regular file of at most 64MiB: ${output.path}`);
        if (metadata.size > remaining) throw new Error("Generated output set exceeds 64MiB");
        budget.assertFileBytes(metadata.size, output.path);
        budget.assertTotalBytes(metadata.size, output.path);
        const bytes = await readFile(path.realTarget, { signal: this.signal });
        this.signal.throwIfAborted(); budget.check("generated-output", output.path);
        if (bytes.length > 64 * 1024 * 1024) throw new Error(`Generated output exceeds 64MiB: ${output.path}`);
        budget.consume("maxTotalBytes", bytes.length, "generated-output", output.path);
        result[output.path] = hashFramedDomain("generated-output-bytes", { bytes: bytes.toString("base64") });
        remaining -= bytes.length;
        if (remaining < 0) throw new Error("Generated output set exceeds 64MiB");
      } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
      this.signal.throwIfAborted(); budget.check("generated-output", output.path);
    }
    this.signal.throwIfAborted(); budget.check("generated-output", "declared-outputs");
    return result;
  }
  async execute(supplied: GeneratedOutputRequest): Promise<GeneratedOutputEvidence> {
    const request = GeneratedOutputRequestSchema.parse(supplied);
    const inputs = [...new Set([request.sourcePath, ...request.inputPaths])];
    const outputs = request.outputs.map((output) => output.path);
    for (const path of [...inputs, ...outputs]) {
      if (this.paths.canonicalize(path) !== path || path === ".projector/runtime" || path.startsWith(".projector/runtime/")) throw new Error(`Invalid generated scope path: ${path}`);
    }
    if (new Set(outputs).size !== outputs.length || outputs.some((path) => inputs.includes(path))) throw new Error("Generated output scope must be unique and separate from inputs");
    for (const path of outputs) {
      const reserved = path.toLowerCase();
      if (reserved === ".projector" || reserved.startsWith(".projector/") || reserved === ".git" || reserved.startsWith(".git/")) throw new Error(`Generation cannot authorize canonical or Git-owned output writes: ${path}`);
      await this.paths.resolveWrite(path);
    }
    this.signal.throwIfAborted();
    const id = `generated_${randomUUID()}`;
    const lease = await new WriterLeaseManager(this.paths, { staleAfterMs: 30000 }).acquireGeneration({ sessionId: id, generationId: id, processId: process.pid, requestHash: hashFramedDomain("generation-request/v1", request), writePaths: outputs });
    const ownership = new AbortController();
    let heartbeat = Promise.resolve();
    let ownershipError: unknown;
    const keeper = setInterval(() => {
      heartbeat = heartbeat.then(() => lease.heartbeat()).catch(error => { ownershipError = error; ownership.abort(error); });
    }, 5000);
    keeper.unref();
    let failure: unknown;
    let record: GeneratedOutputEvidence;
    try {
      const execution = await VerificationService.create(this.paths.root, { ...this.executionOptions, signal: AbortSignal.any([this.signal, ownership.signal]) });
      record = await this.executeOwned(request, id, lease, execution);
      if (ownershipError !== undefined) throw ownershipError;
    } catch (error) { failure = error; throw error; }
    finally {
      clearInterval(keeper);
      await heartbeat;
      try { await lease.release(); }
      catch (error) {
        if (failure !== undefined) throw new AggregateError([failure, error], "Generation failed and its writer lease could not be released");
        throw error;
      }
    }
    if (this.retainedStorage !== undefined) await retainImmutableRecord(this.store(this.readScope(this.observation()), this.retainedStorage), record.id, record);
    return record;
  }
  private async executeOwned(request: GeneratedOutputRequest, id: string, lease: GenerationWriterLeaseHandle, execution: VerificationService): Promise<GeneratedOutputEvidence> {
    const budget = this.observation();
    await lease.heartbeat();
    const before = await this.outputs(request, budget);
    const inputs = [...new Set([request.sourcePath, ...request.inputPaths])];
    const check = await execution.execute({
      executable: request.executable, sourcePath: request.sourcePath, args: request.args, inputPaths: inputs,
      populations: request.populations, environment: request.environment, timeoutMs: request.timeoutMs, completeInputs: request.completeInputs,
    }, async (check) => {
      await lease.heartbeat();
      if (lease.record.generationId !== id || lease.record.requestHash !== hashFramedDomain("generation-request/v1", request) || canonicalJson(lease.record.writePaths) !== canonicalJson(request.outputs.map(output => output.path))) throw new Error("Generation intent does not match its writer reservation");
      const basis = { id, request, check, before, after: {}, afterObservation: "immediate" as const };
      const intent = { ...basis, contentHash: hashFramedDomain("generated-output-evidence", basis) };
      const journal = this.store(undefined, join(this.storage, "intents"));
      await journal.begin({ artifactSetId: id });
      await journal.finalize({ artifactSetId: id, manifestBytes: Buffer.from(canonicalJson(intent)) });
      await lease.heartbeat();
    });
    const afterBudget = this.observation();
    await lease.heartbeat();
    const basis = { id, request, check, before, after: await this.outputs(request, afterBudget), afterObservation: "immediate" as const };
    const record = { ...basis, contentHash: hashFramedDomain("generated-output-evidence", basis) };
    const store = this.store(this.readScope(afterBudget));
    await store.begin({ artifactSetId: record.id });
    await store.finalize({ artifactSetId: record.id, manifestBytes: Buffer.from(canonicalJson(record)) });
    await lease.heartbeat();
    return record;
  }
  async inspect(activeProducerIds: readonly string[]) {
    return this.inspectWithBudget(activeProducerIds, this.observation());
  }
  private async inspectWithBudget(activeProducerIds: readonly string[], budget: ObservationBudget, readScope = this.readScope(budget)) {
    const recordsById = new Map<string, GeneratedOutputEvidence>();
    for (const root of [...new Set([this.storage, ...(this.retainedStorage === undefined ? [] : [this.retainedStorage])])]) {
      const store = this.store(readScope, root);
      const names = await this.recordNames(join(store.storageRoot, "published"), budget);
      for (const name of names.sort()) {
      this.signal.throwIfAborted(); budget.check("generated-history", name);
      const value = await store.read(name);
      this.signal.throwIfAborted(); budget.check("generated-history", name);
      if (value.status !== "published") throw new Error(`Generated output record ${name} is ${value.status}`);
      const prior = recordsById.get(value.manifest.id);
      if (prior !== undefined && prior.contentHash !== value.manifest.contentHash) throw new Error(`Conflicting generated event: ${value.manifest.id}`);
      recordsById.set(value.manifest.id, value.manifest);
      }
    }
    const records = [...recordsById.values()];
    const retainedChecks = (await this.verification.inspect(records.map((record) => record.check.id))).records;
    for (const record of records) {
      const retained = retainedChecks.find((check) => check.id === record.check.id);
      if (retained !== undefined && retained.contentHash !== record.check.contentHash) throw new Error(`Generated output execution identity conflict: ${record.check.id}`);
    }
    budget.check("generated-history", "records");
    const assessment = await this.verification.assess(records.map((record) => record.check.id));
    const results = [];
    for (const record of records) {
      this.signal.throwIfAborted(); budget.check("generated-history", record.id);
      const active = activeProducerIds.includes(record.request.producerId);
      const checkAssessment = assessment.find((check) => check.id === record.check.id);
      const eligibleForCurrent = record.afterObservation === "immediate" && active && record.check.status === "passed" && checkAssessment?.observedInputsMatch === true && checkAssessment.contradictory === false;
      const currentOutputs = eligibleForCurrent ? await this.outputs(record.request, budget) : undefined;
      const current = currentOutputs !== undefined && record.request.outputs.every(({ path }) => record.after[path] !== undefined && record.after[path] === currentOutputs[path]);
      const reason = !active ? "Producer retired"
        : record.afterObservation === "recovery" ? "Outputs observed during recovery; immediate post-execution association unavailable"
        : current ? "Constructed runtime invocation, declared inputs and observed outputs match; exclusive causation is unproven and portable reuse is unsupported"
        : eligibleForCurrent ? "Observed generated outputs changed or are missing"
        : record.check.status !== "passed" ? `Execution status is ${record.check.status}`
        : checkAssessment?.reason ?? "Execution evidence unavailable";
      const outputs = record.request.outputs.map((output) => ({
        ...output,
        observation: record.after[output.path] === undefined ? "missing" as const : record.before[output.path] === record.after[output.path] ? "unchanged-after-invocation" as const : "changed-after-invocation" as const,
        disposition: current ? "current" as const : output.ownership === "retained" ? "preserve-and-review" as const : active ? "regenerate" as const : "removal-eligible" as const,
      }));
      results.push({ evidence: record, current, reason, outputs });
    }
    return { records: results, pendingPublications: await this.pending( budget, readScope) };
  }
  private async recordNames(directory: string, budget: ObservationBudget): Promise<string[]> {
    this.signal.throwIfAborted(); budget.check("generated-history", directory);
    let entries;
    try { entries = await opendir(directory); }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error; }
    const names: string[] = [];
    for await (const entry of entries) {
      this.signal.throwIfAborted(); budget.consume("maxFiles", 1, "generated-history", directory);
      names.push(entry.name);
    }
    return names.sort();
  }
  private async pending(budget: ObservationBudget, readScope = this.readScope(budget)) {
    const store = this.store( readScope); const pending = [];
    for (const [directory, state] of [["staging", "staged"], ["finalizing", "finalizing"]] as const) {
      const names = await this.recordNames(join(store.storageRoot, directory), budget);
      for (const artifactSetId of names.sort()) {
        this.signal.throwIfAborted(); budget.check("generated-history", artifactSetId);
        const observed = await store.read(artifactSetId);
        this.signal.throwIfAborted(); budget.check("generated-history", artifactSetId);
        if (observed.status === "published" || observed.status === "missing") continue;
        if (observed.status === "integrity-failed") throw new Error(`Generated publication ${artifactSetId}: ${observed.reason}`);
        let recoverable = false;
        if (state === "finalizing") {
          try { recoverable = (await lstat(join(store.storageRoot, directory, artifactSetId, "manifest.bin"))).isFile(); }
          catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
        }
        pending.push({ artifactSetId, state, recoverable });
      }
    }
    const intents = this.store(readScope, join(this.storage, "intents"));
    for (const [directory, state] of [["staging", "staged"], ["finalizing", "finalizing"]] as const) {
      for (const artifactSetId of await this.recordNames(join(intents.storageRoot, directory), budget)) {
        if ((await store.read(artifactSetId)).status === "published" || pending.some(item => item.artifactSetId === artifactSetId)) continue;
        const observed = await intents.read(artifactSetId);
        if (observed.status === "integrity-failed") throw new Error(`Generation intent ${artifactSetId}: ${observed.reason}`);
        let recoverable = false;
        if (state === "finalizing") {
          try {
            const bytes = await readObservationFile(join(intents.storageRoot, directory, artifactSetId, "manifest.bin"), budget, artifactSetId, this.signal);
            const intent = (await intents.validateManifest(bytes)).manifest;
            const execution = (await this.verification.inspect([intent.check.id], budget)).records[0];
            recoverable = execution !== undefined && execution.status !== "running";
          }
          catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
        }
        pending.push({ artifactSetId, state, recoverable });
      }
    }
    for (const artifactSetId of await this.recordNames(join(intents.storageRoot, "published"), budget)) {
      const prepared = pending.find((item) => item.artifactSetId === artifactSetId);
      if (prepared?.recoverable === true) continue;
      if ((await store.read(artifactSetId)).status === "published") continue;
      const intent = await intents.read(artifactSetId);
      if (intent.status !== "published") throw new Error(`Generation intent ${artifactSetId}: ${intent.status}`);
      const execution = (await this.verification.inspect([intent.manifest.check.id], budget)).records[0];
      const recoverable = execution !== undefined && execution.status !== "running";
      if (prepared !== undefined) prepared.recoverable = recoverable;
      else pending.push({ artifactSetId, state: "staged" as const, recoverable });
    }
    return pending;
  }
  async recover(activeProducerIds: readonly string[]) {
    const budget = this.observation();
    budget.check("generated-recovery", "records");
    const readScope = this.readScope(budget);
    const store = this.store( readScope); const recoveredArtifactSetIds = [];
    for (const item of await this.pending( budget, readScope)) {
      this.signal.throwIfAborted(); budget.check("generated-recovery", item.artifactSetId);
      if (!item.recoverable) continue;
      const journal = this.store(readScope, join(this.storage, "intents"));
      let intent = await journal.read(item.artifactSetId);
      let preparedManifest = false;
      try { preparedManifest = (await lstat(join(store.storageRoot, "finalizing", item.artifactSetId, "manifest.bin"))).isFile(); }
      catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
      if (preparedManifest) {
        await store.resumeFinalize(item.artifactSetId);
      } else {
        if (intent.status === "incomplete") {
          await journal.resumeFinalize(item.artifactSetId);
          intent = await journal.read(item.artifactSetId);
        }
        if (intent.status !== "published") throw new Error(`Generation recovery intent ${item.artifactSetId}: ${intent.status}`);
        const execution = (await this.verification.inspect([intent.manifest.check.id])).records[0];
        if (execution === undefined || execution.status === "running") continue;
        const basis = { id: intent.manifest.id, request: intent.manifest.request, check: execution, before: intent.manifest.before, after: await this.outputs(intent.manifest.request, budget), afterObservation: "recovery" as const };
        const record = { ...basis, contentHash: hashFramedDomain("generated-output-evidence", basis) };
        await store.begin({ artifactSetId: record.id });
        await store.finalize({ artifactSetId: record.id, manifestBytes: Buffer.from(canonicalJson(record)) });
      }
      recoveredArtifactSetIds.push(item.artifactSetId);
      this.signal.throwIfAborted(); budget.check("generated-recovery", item.artifactSetId);
    }
    budget.check("generated-recovery", "records");
    const inspection = await this.inspectWithBudget(activeProducerIds, budget, readScope);
    if (this.retainedStorage !== undefined) for (const record of inspection.records) await retainImmutableRecord(this.store(readScope, this.retainedStorage), record.evidence.id, record.evidence);
    return { recoveredArtifactSetIds, inspection };
  }
}
