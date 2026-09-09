import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import { canonicalJson, hashFramedDomain, normalizeRepositoryRelativePath, type ValidatorBinding } from "@projector/core";
import type { ExternalGovernanceValidatorFinding } from "@projector/engine";
import { createSandboxLauncher, RepositoryPathService, type ProcessLauncher } from "@projector/runtime";
import { z } from "zod";

import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";

const parameters = z.record(z.string(), z.json());
const inputSchema = z.strictObject({ path: z.string(), parameters: parameters.optional() });
const outputSchema = z.strictObject({ status: z.enum(["satisfied", "violated", "unknown"]), reason: z.string().min(1).max(4096) });

export interface KnowledgeValidatorRequest {
  readonly binding: ValidatorBinding;
  readonly unitId: string;
  readonly unitPath: string;
}

export interface KnowledgeValidatorHost {
  readonly createLauncher?: () => Promise<ProcessLauncher>;
}

/** No results survive this compilation: validators may read any file in the read-only repository. */
export class KnowledgeValidatorRun {
  private launcher: Promise<ProcessLauncher> | undefined;
  private readonly results = new Map<string, Promise<ExternalGovernanceValidatorFinding>>();
  executed = false;

  constructor(private readonly observation: ChangeRepositoryObservation, private readonly signal: AbortSignal, private readonly host: KnowledgeValidatorHost = {}) {}

  evaluate(request: KnowledgeValidatorRequest): Promise<ExternalGovernanceValidatorFinding> {
    const key = canonicalJson(request);
    let result = this.results.get(key);
    if (result === undefined) {
      result = this.run(request).then((finding) => { if (finding.status === "unknown") this.results.delete(key); return finding; });
      this.results.set(key, result);
    }
    return result;
  }

  async evaluateAll(requests: readonly KnowledgeValidatorRequest[]): Promise<ExternalGovernanceValidatorFinding[]> {
    const groups = new Map<string, KnowledgeValidatorRequest[]>();
    for (const request of requests) {
      const key = `${request.unitId}\0${request.binding.id}@${request.binding.version}`;
      groups.set(key, [...(groups.get(key) ?? []), request]);
    }
    return Promise.all([...groups.values()].map(async (group) => {
      const first = group[0]!;
      if (group.some((request) => canonicalJson(request) !== canonicalJson(first))) return { unitId: first.unitId, validatorId: `${first.binding.id}@${first.binding.version}`, status: "unknown" as const, reason: "One validator identity has conflicting binding inputs for this unit.", evidenceIds: [] };
      return this.evaluate(first);
    }));
  }

  private async run({ binding, unitId, unitPath }: KnowledgeValidatorRequest): Promise<ExternalGovernanceValidatorFinding> {
    const validatorId = `${binding.id}@${binding.version}`;
    const unknown = (reason: string, evidenceIds: readonly string[] = []): ExternalGovernanceValidatorFinding => ({ unitId, validatorId, status: "unknown", reason, evidenceIds });
    if (binding.provider !== "repository-node") return unknown(`Validator ${validatorId} uses unsupported provider ${binding.provider}.`);
    if (this.signal.aborted) return unknown(`Validator ${validatorId} was aborted before execution.`);
    let staging: string | undefined;
    try {
      const input = inputSchema.parse(binding.input);
      const normalizedPath = normalizeRepositoryRelativePath(input.path);
      if (normalizedPath !== input.path || !/\.(?:c|m)?js$/u.test(input.path)) throw new Error("repository-node input.path must be a canonical repository-relative .js, .mjs, or .cjs path");
      const captured = await this.observation.independentValidator(input.path);
      if (binding.version !== captured.contentHash && binding.version !== `git:${captured.objectId}`) throw new Error("repository-node binding.version must equal the tracked validator contentHash or git:<tracked-blob-object-id>");
      if (binding.requiredIndependenceGroup !== undefined && binding.requiredIndependenceGroup !== "tracked-git-base") throw new Error(`unsupported independence group ${binding.requiredIndependenceGroup}`);
      const evidenceIds = [`evidence_${hashFramedDomain("knowledge-validator-identity", { validatorId, unitId, path: captured.path, objectId: captured.objectId, introductionCommit: captured.introductionCommit, contentHash: captured.contentHash }).slice(-32)}`];
      this.launcher ??= (this.host.createLauncher ?? createSandboxLauncher)();
      const launcher = await this.launcher;
      if (!launcher.capabilities.filesystemIsolation || !launcher.capabilities.networkIsolation || !launcher.capabilities.readOnlyFileOverlays) throw new Error("validator requires capability-proven filesystem/network isolation and immutable overlays");
      const paths = await RepositoryPathService.create(this.observation.repositoryRoot);
      const target = (await paths.resolveRead(input.path)).realTarget;
      const directory = (await paths.resolveWrite(".projector/runtime/knowledge/validator-runs")).realTarget;
      await mkdir(directory, { recursive: true });
      staging = await mkdtemp(join(directory, "run-"));
      const source = join(staging, "validator-source");
      await writeFile(source, captured.content, { encoding: "utf8", flag: "wx", mode: 0o400 });
      const protocol = { apiVersion: "projector.knowledge-validator/v1", validatorId, unitId, unitPath, parameters: input.parameters ?? {} };
      this.executed = true;
      const result = await launcher.launch({
        executable: process.execPath,
        args: [input.path, canonicalJson(protocol)],
        cwd: this.observation.repositoryRoot,
        env: {}, readRoots: [this.observation.repositoryRoot], writeRoots: [],
        readOnlyFileOverlays: [{ source, target }], network: "deny",
        timeoutMs: 30_000, maxOutputBytes: 256 * 1024, signal: this.signal,
      });
      const afterHash = hashFramedDomain("transform-content", await readFile(target, "utf8"));
      if (this.signal.aborted) return unknown(`Validator ${validatorId} was aborted.`, evidenceIds);
      if (afterHash !== captured.contentHash) return unknown(`Validator ${validatorId} changed during execution.`, evidenceIds);
      if (result.exitCode !== 0 || result.signal !== null) return unknown(`Validator ${validatorId} did not complete successfully (exit ${result.exitCode}, signal ${result.signal}).`, evidenceIds);
      const output = outputSchema.parse(JSON.parse(result.stdout));
      return { unitId, validatorId, ...output, evidenceIds };
    } catch (error) {
      return unknown(`Validator ${validatorId} unavailable: ${error instanceof Error ? error.message : String(error)}`.slice(0, 4096));
    } finally {
      if (staging !== undefined) {
        const ownedRoot = join(this.observation.repositoryRoot, ".projector/runtime/knowledge/validator-runs");
        const child = relative(ownedRoot, staging);
        if (!child || child.startsWith("..") || isAbsolute(child)) throw new Error("validator staging cleanup escaped its owned directory");
        await rm(staging, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
      }
    }
  }
}
