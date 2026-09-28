import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { opendir, realpath, stat, lstat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalJson, hashFramedDomain, ObservationBudget, DerivedObservationBudget, VerificationEvidenceSchema, VerificationRequestSchema, type VerificationEvidence, type VerificationRequest } from "@projector/core";
import { DurableArtifactSetStore, NativeProcessLauncher, RepositoryPathService, type ProcessLauncher } from "@projector/runtime";
import { retainImmutableRecord } from "./retention.js";

export interface VerificationOptions {
    readonly launcher?: ProcessLauncher;
    readonly signal?: AbortSignal;
    readonly observationTimeoutMs?: number;
    readonly evidenceStoreRoot?: string;
}
export interface VerificationPendingPublication {
    artifactSetId: string;
    state: "staged" | "finalizing";
    recoverable: boolean;
}
function seal<T extends object>(basis: T) { return { ...basis, contentHash: hashFramedDomain("verification-event/v1", basis) }; }
export function validateVerificationEvent(value: unknown): VerificationEvidence {
    const manifest = VerificationEvidenceSchema.parse(value);
    const { contentHash, ...basis } = manifest;
    if (contentHash !== hashFramedDomain("verification-event/v1", basis))
        throw new Error("Verification event integrity failed");
    if (manifest.basisHash !== hashFramedDomain("verification-basis/v1", { request: manifest.request, inputs: manifest.inputs, profile: manifest.profile }))
        throw new Error("Verification basis integrity failed");
    return manifest;
}
function validate(bytes: Uint8Array) { return { manifest: validateVerificationEvent(JSON.parse(Buffer.from(bytes).toString("utf8"))), blobs: [] }; }
/** Native execution records declared observations; it cannot certify complete dependencies or portable reuse. */
export class VerificationService {
    private constructor(private readonly paths: RepositoryPathService, private readonly localRoot: string, private readonly evidenceRoot: string | undefined, private readonly launcher: ProcessLauncher, private readonly signal: AbortSignal, private readonly observationTimeoutMs: number) { }
    static async create(root: string, options: VerificationOptions = {}) {
        const paths = await RepositoryPathService.create(root);
        if (options.evidenceStoreRoot !== undefined && !isAbsolute(options.evidenceStoreRoot))
            throw new Error("Host verification evidence store must be absolute");
        return new VerificationService(paths, (await paths.resolveWrite(".projector/runtime/verification")).realTarget, options.evidenceStoreRoot, options.launcher ?? new NativeProcessLauncher(), options.signal ?? new AbortController().signal, new ObservationBudget({ timeoutMs: options.observationTimeoutMs ?? 30000 }).limits.timeoutMs);
    }
    private budget() { return new ObservationBudget({ timeoutMs: this.observationTimeoutMs, maxFiles: 10000, maxDirectories: 10000 }); }
    private store(root: string, budget = this.budget()) { return new DurableArtifactSetStore<VerificationEvidence>(root, validate, {}, { budget, signal: this.signal, derivedBudget: new DerivedObservationBudget(budget.limits.maxDerivedBytes) }); }
    private async save(record: VerificationEvidence) {
        // Publication must retain the terminal observation even when execution was cancelled.
        const store = new DurableArtifactSetStore<VerificationEvidence>(this.localRoot, validate);
        const slot = `${record.id}_${record.status === "running" ? "running" : "completed"}`;
        await store.begin({ artifactSetId: slot });
        await store.finalize({ artifactSetId: slot, manifestBytes: Buffer.from(canonicalJson(record)) });
        if (record.status !== "running" && this.evidenceRoot !== undefined) {
            await this.retain(record);
        }
    }
    private async retain(record: VerificationEvidence) {
        if (this.evidenceRoot !== undefined && record.status !== "running") {
            await retainImmutableRecord(new DurableArtifactSetStore<VerificationEvidence>(this.evidenceRoot, validate), `${record.id}_completed`, record);
        }
    }
    private async names(root: string, budget: ObservationBudget) {
        this.signal.throwIfAborted();
        budget.check("verification-history", root);
        let entries;
        try {
            entries = await opendir(root);
        }
        catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT")
                return [];
            throw error;
        }
        const names: string[] = [];
        for await (const entry of entries) {
            this.signal.throwIfAborted();
            budget.consume("maxFiles", 1, "verification-history", root);
            names.push(entry.name);
        }
        return names.sort();
    }
    private async pending(budget: ObservationBudget) {
        const pending: VerificationPendingPublication[] = [];
        const store = this.store(this.localRoot, budget);
        for (const [directory, state] of [["staging", "staged"], ["finalizing", "finalizing"]] as const)
            for (const artifactSetId of await this.names(join(this.localRoot, directory), budget)) {
                const value = await store.read(artifactSetId);
                if (value.status === "published" || value.status === "missing")
                    continue;
                if (value.status === "integrity-failed")
                    throw new Error(value.reason);
                let recoverable = false;
                if (state === "finalizing")
                    try {
                        recoverable = (await lstat(join(this.localRoot, directory, artifactSetId, "manifest.bin"))).isFile();
                    }
                    catch (error) {
                        if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
                            throw error;
                    }
                pending.push({ artifactSetId, state, recoverable });
            }
        return pending;
    }
    async inspect(eventIds?: readonly string[], budget = this.budget()) {
        for (const id of eventIds ?? []) {
            if (!/^execution_[0-9a-f-]{36}$/u.test(id)) throw new Error(`Invalid verification event identifier: ${id}`);
        }
        const records = new Map<string, VerificationEvidence>();
        for (const root of [...new Set([this.localRoot, ...(this.evidenceRoot === undefined ? [] : [this.evidenceRoot])])]) {
            const store = this.store(root, budget);
            const slots = eventIds === undefined ? await this.names(join(root, "published"), budget) : [...new Set(eventIds)].flatMap(id => [`${id}_running`, `${id}_completed`]);
            for (const slot of slots) {
                const value = await store.read(slot);
                if (eventIds !== undefined && value.status === "missing") continue;
                if (value.status !== "published")
                    throw new Error(`Verification record ${slot}: ${value.status}`);
                const record = value.manifest;
                if (!slot.startsWith(`${record.id}_`)) throw new Error(`Verification event slot identity mismatch: ${slot}`);
                if (eventIds !== undefined && (slot.endsWith("_running") !== (record.status === "running"))) throw new Error(`Verification event slot outcome mismatch: ${slot}`);
                const key = `${record.id}:${record.status === "running" ? "running" : "completed"}`;
                const prior = records.get(key);
                if (prior !== undefined && prior.contentHash !== record.contentHash)
                    throw new Error(`Conflicting verification event identity: ${record.id}`);
                records.set(key, record);
            }
        }
        const all = [...records.values()];
        for (const record of all) {
            const start = records.get(`${record.id}:running`);
            if (start !== undefined && (start.basisHash !== record.basisHash || start.startedAt !== record.startedAt)) throw new Error(`Conflicting execution start: ${record.id}`);
        }
        const selected = all.filter(record => (eventIds === undefined || eventIds.includes(record.id)) && (record.status !== "running" || !all.some(other => other.id === record.id && other.status !== "running")));
        return { records: selected, pendingPublications: await this.pending(budget) };
    }
    async execute(supplied: VerificationRequest, retainStart?: (event: VerificationEvidence) => Promise<void>): Promise<VerificationEvidence> {
        const request = VerificationRequestSchema.parse(supplied);
        this.canonicalPaths(request.inputPaths);
        if (request.sourcePath !== undefined) {
            this.canonicalPaths([request.sourcePath]);
            if (!request.inputPaths.includes(request.sourcePath))
                throw new Error("Verification source entrypoint must be a declared input");
        }
        const inputs = await this.snapshot(request);
        const start = { id: `execution_${randomUUID()}`, request, inputs, profile: "native-observed/v1" as const, basisHash: hashFramedDomain("verification-basis/v1", { request, inputs, profile: "native-observed/v1" }), startedAt: new Date().toISOString() };
        await this.save(seal({ ...start, status: "running" as const }));
        let record: VerificationEvidence;
        try {
            if (retainStart !== undefined) await retainStart(seal({ ...start, status: "running" as const }));
            const args = request.sourcePath === undefined ? request.args : [(await this.paths.resolveRead(request.sourcePath)).realTarget, ...request.args];
            const result = await this.launcher.launch({ executable: inputs.producerPath, args, cwd: this.paths.root, env: selectedEnvironment(request.environment), timeoutMs: request.timeoutMs, maxOutputBytes: 1024 * 1024, signal: this.signal });
            const after = await this.snapshot(request);
            record = seal({ ...start, completedAt: new Date().toISOString(), status: canonicalJson(inputs) !== canonicalJson(after) ? "inputs-changed" : result.exitCode === 0 && result.signal === null ? "passed" : "failed", exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr });
        }
        catch (error) {
            record = seal({ ...start, completedAt: new Date().toISOString(), status: "interrupted" as const, error: error instanceof Error ? error.message : String(error) });
            await this.save(record);
            throw error;
        }
        await this.save(record);
        return record;
    }
    async assess(eventIds: readonly string[]) {
        const budget = this.budget();
        const inspection = await this.inspect(undefined, budget);
        const results = [];
        for (const id of eventIds) {
            const record = inspection.records.find(record => record.id === id);
            if (record === undefined) {
                results.push({ id, observedInputsMatch: false, reusable: false as const, contradictory: false, reason: "Execution evidence unavailable; execute the required check" });
                continue;
            }
            const contradictory = inspection.records.some(other => other.basisHash === record.basisHash && ((record.status === "passed" && other.status !== "passed") || (record.status !== "passed" && other.status === "passed")));
            let observedInputsMatch: boolean;
            try { observedInputsMatch = canonicalJson(await this.snapshot(record.request, budget)) === canonicalJson(record.inputs); }
            catch (error) {
                if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
                results.push({ id, observedInputsMatch: false, reusable: false as const, contradictory, reason: "Current declared input or producer is unavailable; retained execution remains historical evidence" });
                continue;
            }
            results.push({ id, observedInputsMatch, reusable: false as const, contradictory, reason: contradictory ? "Conflicting outcomes on the same declared basis" : observedInputsMatch ? "Declared inputs match; native observation does not establish complete dependencies or portable reuse" : "Declared inputs or producer changed" });
        }
        return results;
    }
    async recover() {
        const budget = this.budget();
        const store = this.store(this.localRoot, budget);
        const recoveredArtifactSetIds: string[] = [];
        for (const item of await this.pending(budget)) {
            this.signal.throwIfAborted();
            if (item.recoverable) {
                await store.resumeFinalize(item.artifactSetId);
                recoveredArtifactSetIds.push(item.artifactSetId);
            }
        }
        const inspection = await this.inspect();
        for (const record of inspection.records) await this.retain(record);
        return { recoveredArtifactSetIds, inspection };
    }
    private canonicalPaths(paths: readonly string[]): string[] {
        return [...new Set(paths.map((path) => {
                const canonical = this.paths.canonicalize(path);
                if (canonical !== path)
                    throw new Error(`Verification input path must be canonical: ${path}`);
                const folded = path.toLowerCase();
                if (folded === ".projector/runtime" || folded.startsWith(".projector/runtime/"))
                    throw new Error("Verification inputs cannot include runtime evidence");
                return canonical;
            }))].sort();
    }
    private async files(paths: readonly string[], allowMissing = false, budget?: ObservationBudget): Promise<Record<string, ReturnType<typeof hashFramedDomain>>> {
        const files: Record<string, ReturnType<typeof hashFramedDomain>> = {};
        let remainingBytes = 64 * 1024 * 1024;
        if (paths.length > 10000)
            throw new Error("Verification file inputs exceed 10000 paths");
        for (const path of this.canonicalPaths(paths)) {
            this.signal.throwIfAborted();
            budget?.check("verification-inputs", path);
            try {
                const target = (await this.paths.resolveRead(path)).realTarget;
                const metadata = await stat(target);
                if (!metadata.isFile())
                    throw new Error(`Verification scope requires a regular file: ${path}`);
                files[path] = await this.hashFile(target, Math.min(remainingBytes, 8 * 1024 * 1024), budget);
                remainingBytes -= metadata.size;
                if (remainingBytes < 0)
                    throw new Error("Verification input set exceeds 64MiB");
            }
            catch (error) {
                if (allowMissing && error instanceof Error && "code" in error && error.code === "ENOENT")
                    continue;
                throw error;
            }
        }
        return files;
    }
    private async hashFile(path: string, maximumBytes: number, budget?: ObservationBudget): Promise<ReturnType<typeof hashFramedDomain>> {
        const digest = createHash("sha256");
        let bytes = 0;
        const stream = createReadStream(path, { signal: this.signal });
        for await (const chunk of stream) {
            this.signal.throwIfAborted();
            budget?.check("verification-inputs", path);
            bytes += chunk.length;
            if (bytes > maximumBytes) {
                stream.destroy();
                throw new Error(`Verification input exceeds ${maximumBytes} bytes: ${path}`);
            }
            digest.update(chunk);
        }
        return hashFramedDomain("verification-file-bytes", { sha256: digest.digest("hex"), bytes });
    }
    private async snapshot(request: VerificationRequest, budget = this.budget()): Promise<VerificationEvidence["inputs"]> {
        this.signal.throwIfAborted();
        if (!isAbsolute(request.executable))
            throw new Error("Verification check executable must be an absolute producer path");
        const producerPath = await realpath(request.executable);
        const populations: VerificationEvidence["inputs"]["populations"] = [];
        for (const population of request.populations) {
            this.canonicalPaths([population.directory]);
            if (population.recursive && [".", ".projector"].includes(population.directory.toLowerCase()))
                throw new Error("Recursive root or .projector populations include runtime evidence; select root files nonrecursively and declare narrower source directories");
            const members: string[] = [];
            const visit = async (directory: string) => {
                this.signal.throwIfAborted();
                budget.check("verification-population", directory);
                const entries = await opendir((await this.paths.resolveRead(directory)).realTarget);
                for await (const entry of entries) {
                    this.signal.throwIfAborted();
                    budget.check("verification-population", directory);
                    const path = directory === "." ? entry.name : `${directory}/${entry.name}`;
                    if (entry.isSymbolicLink())
                        throw new Error(`Verification population has unsupported symbolic link: ${path}`);
                    if (entry.isDirectory()) {
                        budget.consume("maxDirectories", 1, "verification-population", path);
                        if (population.recursive)
                            await visit(path);
                    }
                    else if (entry.isFile()) {
                        budget.consume("maxFiles", 1, "verification-population", path);
                        members.push(path);
                        if (members.length > 10000)
                            throw new Error("Verification population exceeds 10000 files; narrow the declared population");
                    }
                    else if (!entry.isDirectory())
                        throw new Error(`Verification population has unsupported input: ${path}`);
                }
            };
            await visit(population.directory);
            populations.push({ ...population, members: members.sort() });
        }
        return { files: await this.files([...request.inputPaths, ...populations.flatMap((population) => population.members)], false, budget), populations,
            producerPath, producerHash: await this.hashFile(producerPath, 256 * 1024 * 1024, budget),
            environmentHash: hashFramedDomain("verification-environment", selectedEnvironment(request.environment)), platform: process.platform, architecture: process.arch, nodeVersion: process.version };
    }
}
function selectedEnvironment(names: readonly string[]): Record<string, string> {
    const selected: Record<string, string> = {};
    // Native Windows execution needs these host bootstrap values as actual inputs.
    for (const name of [...new Set([...names, ...(process.platform === "win32" ? ["SystemRoot", "WINDIR", "PATH", "PATHEXT", "TEMP", "TMP"] : [])])]) {
        if (process.env[name] !== undefined)
            selected[name] = process.env[name]!;
    }
    return selected;
}


