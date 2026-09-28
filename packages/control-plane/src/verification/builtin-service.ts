import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, opendir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { canonicalJson, hashFramedDomain, DerivedObservationBudget, ObservationBudget, BuiltinVerificationRequestSchema, BuiltinVerificationEvidenceSchema, RelationSchema, type BuiltinVerificationRequest, type BuiltinVerificationEvidence, type StateBinding, type Relation } from "@projector/core";
import { observationGit } from "@projector/analyzers";
import { createStateBinding, DependencyScopedStateBindingValidator, InMemoryGraphReader, QueryDependencyRegistry } from "@projector/engine";
import { DurableArtifactSetStore, currentObservationScope, parseCanonicalSnapshotSources, withObservationScope, type ObservationScope } from "@projector/runtime";
import { validateCanonicalRelationEndpoints, validateStaticCanonicalGovernance } from "../knowledge/canonical-governance.js";
import { collectClosedCanonicalInputs, type ClosedCanonicalInputs } from "./builtin-inputs.js";
import { captureBuiltinProducer, resolveHostGitExecutable } from "./builtin-producer.js";

export const builtinCanonicalCheck = "projector.canonical-integrity/v1" as const;
const contract = { id: builtinCanonicalCheck, version: "1", input: "Complete immutable canonical source population selected by shipped classifyCanonicalSource, including empty population and config presence", checks: ["canonical schemas and duplicate identity", "static authority, decision, basis and lens compilation", "canonical relation endpoints; external populations remain unknown"], excludes: ["source/runtime behavior", "integration compatibility", "independent whole-result review", "mutation or merge authorization"], acquisition: "Host-trusted Git with isolated environment and no replacement objects", environment: "Node runtime/platform/architecture; NODE_OPTIONS/NODE_PATH and locale; Git transport host trust" };
const contractHash = hashFramedDomain("closed-check-contract/v1", contract);
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const seal = <T extends object>(basis: T) => ({ ...basis, contentHash: hashFramedDomain("builtin-verification-event/v1", basis) });
function validate(bytes: Uint8Array) {
  const record = BuiltinVerificationEvidenceSchema.parse(JSON.parse(Buffer.from(bytes).toString("utf8")));
  const { contentHash, ...basis } = record;
  if (contentHash !== hashFramedDomain("builtin-verification-event/v1", basis)) throw new Error("Built-in verification event integrity failed");
  if (createStateBinding(record.binding).dependencyDigest !== record.binding.dependencyDigest) throw new Error("Built-in verification dependency integrity failed");
  if (record.basisHash !== hashFramedDomain("builtin-verification-basis/v1", { profile: record.profile, dependencies: record.binding.dependencyDigest })) throw new Error("Built-in verification basis integrity failed");
  if (record.artifacts.filter(artifact => artifact.path === "inputs.json").length !== 1 || (record.status !== "running" && record.artifacts.filter(artifact => artifact.path === "result.json").length !== 1)) throw new Error("Required closed-check artifact declaration missing");
  return { manifest: record, blobs: record.artifacts };
}
export interface BuiltinVerificationOptions { readonly evidenceStoreRoot: string; readonly trustedChecks: readonly string[]; readonly trustPolicyVersion?: string; readonly signal?: AbortSignal }

/** A host-selected shipped check. Repository contents are data and cannot choose its trust policy. */
export class BuiltinVerificationService {
  private constructor(private readonly root: string, private readonly storeRoot: string, private readonly options: BuiltinVerificationOptions, private readonly gitExecutable: string) {}
  static async create(root: string, options: BuiltinVerificationOptions) {
    if (!isAbsolute(options.evidenceStoreRoot)) throw new Error("Built-in verification requires an absolute host evidence retention store");
    root = await realpath(root);
    const requestedLocation = relative(root, resolve(options.evidenceStoreRoot));
    if (requestedLocation !== ".." && !requestedLocation.startsWith(`..${sep}`) && !isAbsolute(requestedLocation)) throw new Error("Built-in durable evidence store must be outside the repository checkout");
    await mkdir(options.evidenceStoreRoot, { recursive: true });
    const storeRoot = await realpath(resolve(options.evidenceStoreRoot)), fromRepository = relative(root, storeRoot);
    if (fromRepository !== ".." && !fromRepository.startsWith(`..${sep}`) && !isAbsolute(fromRepository)) throw new Error("Built-in durable evidence store must be outside the repository checkout");
    return new BuiltinVerificationService(root, join(storeRoot, "builtin-verification"), options, await resolveHostGitExecutable(root));
  }
  private store() { return new DurableArtifactSetStore<BuiltinVerificationEvidence>(this.storeRoot, validate); }
  private trustPolicyHash() { return hashFramedDomain("builtin-verification-host-trust/v1", { version: this.options.trustPolicyVersion ?? "1", trustedChecks: [...new Set(this.options.trustedChecks)].sort() }); }
  private async capture(target: string, scope: ObservationScope) {
    const inputs = await collectClosedCanonicalInputs(this.root, target, scope, this.gitExecutable);
    const gitVersion = (await observationGit(this.root, ["--version"], scope.budget, { executable: this.gitExecutable, signal: scope.signal, stage: "closed-git-transport" })).trim();
    const producer = await captureBuiltinProducer(import.meta.url, scope.budget, scope.signal, { path: this.gitExecutable, version: gitVersion });
    const environmentHash = hashFramedDomain("closed-check-environment/v1", { platform: process.platform, architecture: process.arch, nodeVersion: process.version, NODE_OPTIONS: process.env.NODE_OPTIONS ?? null, NODE_PATH: process.env.NODE_PATH ?? null, TZ: process.env.TZ ?? null, LANG: process.env.LANG ?? null, LC_ALL: process.env.LC_ALL ?? null });
    const trustPolicyHash = this.trustPolicyHash();
    const state = { gitBase: inputs.targetObject, worktreeDigest: hashFramedDomain("immutable-verification-tree", inputs.targetTree), canonicalProjectorDigest: hashFramedDomain("closed-canonical-inputs", inputs.files), toolchainDigest: hashFramedDomain("closed-canonical-toolchain", { producer, environmentHash, trustPolicyHash, contractHash }) };
    const values = [
      ...Object.entries(inputs.files).map(([id, versionHash]) => ({ kind: "artifact" as const, id, versionHash, role: "exact immutable canonical source bytes" })),
      { kind: "adapter" as const, id: builtinCanonicalCheck, versionHash: contractHash, role: "complete shipped check contract" },
      { kind: "toolchain" as const, id: "builtin-producer-build", versionHash: producer.buildHash, role: "actual installed producer and dependency bytes" },
      { kind: "toolchain" as const, id: "builtin-environment", versionHash: environmentHash, role: "fixed check runtime environment" },
      { kind: "adapter" as const, id: "builtin-host-trust-policy", versionHash: trustPolicyHash, role: "current host-selected check trust" },
    ];
    const queries = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    queries.register({ id: "projector.canonical-source-population", version: "1", kind: "surface-enumeration", normalizeInput: () => ({ scope: ".projector", selection: builtinCanonicalCheck }), evaluate: () => ({ results: inputs.members, observability: "closed", assumptions: ["Complete successful immutable Git tree enumeration under configured host-trusted Git transport"], unavailableLanes: [], dependencyKeys: ["canonical-source-population", "canonical-config-presence"] }) });
    const query = queries.createSpec({ id: "builtin-canonical-source-population", programId: "projector.canonical-source-population", input: {} });
    const context = { repositoryRoot: this.root, stateDigest: state, config: {}, signal: scope.signal };
    const binding = createStateBinding({ compiledAgainst: state, valueDependencies: values, queryDependencies: [{ query, priorResult: await queries.evaluate(query, context), role: "Complete canonical population including previously empty and absent config" }] });
    return { inputs, producer, environmentHash, trustPolicyHash, binding, queries, context };
  }
  private async save(record: BuiltinVerificationEvidence, artifacts: ReadonlyMap<string, Uint8Array>) {
    // Terminal publication intentionally survives cancellation and never reruns the check.
    const store = new DurableArtifactSetStore<BuiltinVerificationEvidence>(this.storeRoot, validate, {}, { budget: new ObservationBudget({ timeoutMs: 30000 }), signal: new AbortController().signal }), artifactSetId = `${record.id}_${record.status === "running" ? "running" : "completed"}`;
    await store.begin({ artifactSetId });
    for (const [path, bytes] of artifacts) await store.stageBlob({ artifactSetId, path, bytes });
    await store.finalize({ artifactSetId, manifestBytes: Buffer.from(canonicalJson(record)) });
  }
  async execute(supplied: BuiltinVerificationRequest) {
    const request = BuiltinVerificationRequestSchema.parse(supplied);
    if (!this.options.trustedChecks.includes(request.check)) throw new Error("Current host trust policy does not enable this built-in check");
    return withObservationScope({ ...(this.options.signal ? { signal: this.options.signal } : {}), limits: { timeoutMs: request.timeoutMs ?? 60000 } }, async scope => {
      const captured = await this.capture(request.target, scope);
      const inputBytes = Buffer.from(canonicalJson({ sources: captured.inputs.sources, files: captured.inputs.files, members: captured.inputs.members, issues: captured.inputs.issues }));
      const artifacts = new Map<string, Uint8Array>([["inputs.json", inputBytes]]);
      const profile = "projector-closed-static/v1" as const;
      const start = { id: `execution_${randomUUID()}`, profile, request, targetObject: captured.inputs.targetObject, targetTree: captured.inputs.targetTree, binding: captured.binding, basisHash: hashFramedDomain("builtin-verification-basis/v1", { profile, dependencies: captured.binding.dependencyDigest }), producer: captured.producer, contractHash, environmentHash: captured.environmentHash, trustPolicyHash: captured.trustPolicyHash, startedAt: new Date().toISOString() };
      await this.save(seal({ ...start, status: "running" as const, artifacts: [{ path: "inputs.json", sha256: digest(inputBytes) }], findings: [], unknowns: [] }), artifacts);
      let status: BuiltinVerificationEvidence["status"] = "passed", findings: string[] = [], unknowns: string[] = [], error: string | undefined;
      try {
        scope.signal.throwIfAborted(); scope.budget.check("builtin-canonical-check");
        const result = this.check(captured.inputs, new DerivedObservationBudget(scope.limits.maxDerivedBytes));
        findings = result.findings; unknowns = result.unknowns;
        if (findings.length || unknowns.length) status = "failed";
        // Revalidate the trusted producer/environment/policy after execution.
        const after = await this.capture(captured.inputs.targetTree, scope);
        if (after.binding.dependencyDigest !== captured.binding.dependencyDigest) status = "inputs-changed";
      } catch (cause) { status = scope.signal.aborted ? "interrupted" : "failed"; error = cause instanceof Error ? cause.message : String(cause); findings.push(error); }
      const resultBytes = Buffer.from(canonicalJson({ check: builtinCanonicalCheck, contractHash, status, findings, unknowns, ...(error ? { error } : {}) })); artifacts.set("result.json", resultBytes);
      const record = seal({ ...start, status, completedAt: new Date().toISOString(), artifacts: [...artifacts].map(([path, bytes]) => ({ path, sha256: digest(bytes) })), findings, unknowns, ...(error ? { error } : {}) });
      await this.save(record, artifacts); return record;
    });
  }
  private check(inputs: ClosedCanonicalInputs, derived: DerivedObservationBudget) {
    const snapshot = parseCanonicalSnapshotSources(inputs.sources, derived), ids = new Set<string>();
    for (const document of snapshot.documents) { if (ids.has(document.id)) throw new Error(`Duplicate canonical identity: ${document.id}`); ids.add(document.id); }
    const unknowns = validateStaticCanonicalGovernance(snapshot.documents, ids, { populationComplete: false, derivedBudget: derived });
    unknowns.push(...validateCanonicalRelationEndpoints(snapshot.documents.filter(document => document.kind === "relation").map(document => RelationSchema.parse(document.payload) as Relation), ids, { populationComplete: false }));
    return { findings: [...inputs.issues], unknowns };
  }
  private async names(directory: string) {
    let entries; try { entries = await opendir(directory); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error; }
    const names: string[] = []; for await (const entry of entries) { const scope = currentObservationScope(); scope?.signal.throwIfAborted(); scope?.budget.consume("maxFiles", 1, "builtin-verification-history", entry.name); if (names.length >= 10000) throw new Error("Built-in verification history exceeds finite record limit"); names.push(entry.name); } return names.sort();
  }
  async inspect() {
    return withObservationScope({ ...(this.options.signal ? { signal: this.options.signal } : {}) }, () => this.inspectRecords());
  }
  private async inspectRecords() {
    const store = this.store(), records: BuiltinVerificationEvidence[] = [];
    for (const slot of await this.names(join(this.storeRoot, "published"))) {
      const value = await store.read(slot); if (value.status !== "published") throw new Error(`Built-in verification record ${slot}: ${value.status}`);
      if (slot !== `${value.manifest.id}_${value.manifest.status === "running" ? "running" : "completed"}`) throw new Error(`Built-in verification slot identity mismatch: ${slot}`);
      records.push(value.manifest);
    }
    for (const record of records) {
      const start = records.find(other => other.id === record.id && other.status === "running");
      if (start && (start.basisHash !== record.basisHash || start.startedAt !== record.startedAt)) throw new Error(`Conflicting built-in verification event identity: ${record.id}`);
    }
    const pendingPublications = [];
    for (const directory of ["staging", "finalizing"]) for (const artifactSetId of await this.names(join(this.storeRoot, directory))) {
      let recoverable = false;
      if (directory === "finalizing") try { recoverable = (await lstat(join(this.storeRoot, directory, artifactSetId, "manifest.bin"))).isFile(); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
      pendingPublications.push({ artifactSetId, state: directory === "staging" ? "staged" as const : "finalizing" as const, recoverable });
    }
    return { scope: builtinCanonicalCheck, records: records.filter(record => record.status !== "running" || !records.some(other => other.id === record.id && other.status !== "running")), pendingPublications };
  }
  async assess(input: { eventId: string; target: string }) {
    const result = { eventId: input.eventId, scope: builtinCanonicalCheck, reusable: false, authorization: false as const, bindingStatus: "unavailable" as "current" | "rebound" | "stale" | "suspect" | "unavailable", contradictory: false, reasons: [] as string[] };
    if (!/^execution_[0-9a-f-]{36}$/u.test(input.eventId)) throw new Error("Invalid built-in execution event identifier");
    if (!this.options.trustedChecks.includes(builtinCanonicalCheck)) return { ...result, reasons: ["Current host trust policy does not enable the retained check"] };
    let inspection;
    try { inspection = await this.inspect(); } catch (error) { return { ...result, reasons: [error instanceof Error ? error.message : String(error)] }; }
    const record = inspection.records.find(record => record.id === input.eventId);
    if (!record) return { ...result, reasons: ["Required retained event or artifact is unavailable"] };
    result.contradictory = inspection.records.some(other => other.basisHash === record.basisHash && ((record.status === "passed" && other.status !== "passed") || (record.status !== "passed" && other.status === "passed")));
    try { return await withObservationScope({ ...(this.options.signal ? { signal: this.options.signal } : {}) }, async scope => {
      const captured = await this.capture(input.target, scope);
      const currentValues = new Map(captured.binding.valueDependencies.map(value => [`${value.kind}\0${value.id}\0${value.role}`, value.versionHash]));
      const validator = new DependencyScopedStateBindingValidator({ values: { readVersionHash: async value => currentValues.get(`${value.kind}\0${value.id}\0${value.role}`) }, queries: captured.queries });
      const validation = await validator.validate(record.binding as StateBinding, captured.binding.compiledAgainst, captured.context);
      const qualified = record.producer.production && captured.producer.production && record.contractHash === contractHash && record.trustPolicyHash === this.trustPolicyHash();
      const reusable = qualified && record.status === "passed" && !record.unknowns.length && !result.contradictory && ["current", "rebound"].includes(validation.status);
      return { ...result, targetObject: captured.inputs.targetObject, targetTree: captured.inputs.targetTree, bindingStatus: validation.status, reusable, reasons: [...validation.reasons, ...(!qualified ? ["Producer, runtime, complete contract, or current host trust qualification changed or is unavailable"] : []), ...(record.status !== "passed" ? [`Retained execution outcome is ${record.status}`] : []), ...(result.contradictory ? ["Conflicting execution outcomes remain on the same complete dependency basis"] : []), ...(reusable ? ["Actual retained passed execution and required artifacts are current for this named canonical/static check only; no integration or mutation authorization"] : [])] };
    }); } catch (error) { return { ...result, reasons: [`Current immutable target, canonical input population, or trusted producer could not be established: ${error instanceof Error ? error.message : String(error)}`] }; }
  }
  async recover() {
    const inspection = await this.inspect(), recoveredArtifactSetIds: string[] = [];
    for (const pending of inspection.pendingPublications) if (pending.recoverable) { await this.store().resumeFinalize(pending.artifactSetId); recoveredArtifactSetIds.push(pending.artifactSetId); }
    return { recoveredArtifactSetIds, inspection: await this.inspect() };
  }
}
