import { readObservationFile } from "@projector/analyzers";
import { canonicalJson, hashFramedDomain, normalizeRepositoryRelativePath, ObservationError, type ValidatorBinding } from "@projector/core";
import type { ExternalGovernanceValidatorFinding } from "@projector/engine";
import { NativeProcessLauncher, RepositoryPathService, withObservationScope, type ProcessLauncher } from "@projector/runtime";
import { z } from "zod";

import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { runObservationTask } from "../observation/task-runner.js";

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
    const findings: ExternalGovernanceValidatorFinding[] = [];
    for (const group of groups.values()) {
      const first = group[0]!;
      if (group.some((request) => canonicalJson(request) !== canonicalJson(first))) {
        findings.push({ unitId: first.unitId, validatorId: `${first.binding.id}@${first.binding.version}`, status: "unknown", reason: "One validator identity has conflicting binding inputs for this unit.", evidenceIds: [] });
      } else findings.push(await this.evaluate(first));
    }
    return findings;
  }

  private async run({ binding, unitId, unitPath }: KnowledgeValidatorRequest): Promise<ExternalGovernanceValidatorFinding> {
    const validatorId = `${binding.id}@${binding.version}`;
    const unknown = (reason: string, evidenceIds: readonly string[] = []): ExternalGovernanceValidatorFinding => ({ unitId, validatorId, status: "unknown", reason, evidenceIds });
    if (binding.provider !== "repository-node") return unknown(`Validator ${validatorId} uses unsupported provider ${binding.provider}.`);
    this.signal.throwIfAborted();
    try {
      return await withObservationScope({ signal: this.signal }, async (scope) => {
      const input = inputSchema.parse(binding.input);
      const normalizedPath = normalizeRepositoryRelativePath(input.path);
      if (normalizedPath !== input.path || !/\.(?:c|m)?js$/u.test(input.path)) throw new Error("repository-node input.path must be a canonical repository-relative .js, .mjs, or .cjs path");
      const captured = await this.observation.independentValidator(input.path);
      if (binding.version !== captured.contentHash && binding.version !== `git:${captured.objectId}`) throw new Error("repository-node binding.version must equal the tracked validator contentHash or git:<tracked-blob-object-id>");
      if (binding.requiredIndependenceGroup !== undefined && binding.requiredIndependenceGroup !== "tracked-git-base") throw new Error(`unsupported independence group ${binding.requiredIndependenceGroup}`);
      const evidenceIds = [`evidence_${hashFramedDomain("knowledge-validator-identity", { validatorId, unitId, path: captured.path, objectId: captured.objectId, introductionCommit: captured.introductionCommit, contentHash: captured.contentHash }).slice(-32)}`];
      this.launcher ??= (this.host.createLauncher ?? (async () => new NativeProcessLauncher()))();
      const launcher = await this.launcher;
      const paths = await RepositoryPathService.create(this.observation.repositoryRoot);
      const target = (await paths.resolveRead(input.path)).realTarget;
      const readHash = async () => runObservationTask("hash-content", {
        content: (await readObservationFile(target, scope.budget, input.path, this.signal)).toString("utf8"),
      }, { ...scope, signal: this.signal });
      const beforeHash = await readHash();
      if (beforeHash !== captured.contentHash) throw new Error(`Validator ${validatorId} source changed before execution.`);
      const protocol = { apiVersion: "projector.knowledge-validator/v1", validatorId, unitId, unitPath, parameters: input.parameters ?? {} };
      this.executed = true;
      const result = await launcher.launch({
        executable: process.execPath,
        args: [target, canonicalJson(protocol)],
        cwd: this.observation.repositoryRoot,
        env: {},
        timeoutMs: Math.min(30_000, Math.max(1, scope.budget.remainingMs())), maxOutputBytes: 256 * 1024, signal: this.signal,
      });
      scope.budget.check("validator-execution", input.path);
      this.signal.throwIfAborted();
      const afterHash = await readHash();
      if (afterHash !== captured.contentHash) return unknown(`Validator ${validatorId} changed during execution.`, evidenceIds);
      if (result.exitCode !== 0 || result.signal !== null) return unknown(`Validator ${validatorId} did not complete successfully (exit ${result.exitCode}, signal ${result.signal}).`, evidenceIds);
      const output = outputSchema.parse(JSON.parse(result.stdout));
      return {
        unitId,
        validatorId,
        ...output,
        reason: `${output.reason} Executed under the configured host permissions; this result does not establish filesystem confinement, network denial, or hostile same-user protection.`,
        evidenceIds,
      };
      });
    } catch (error) {
      this.signal.throwIfAborted();
      if (error instanceof ObservationError) throw error;
      return unknown(`Validator ${validatorId} unavailable: ${error instanceof Error ? error.message : String(error)}`.slice(0, 4096));
    }
  }
}
