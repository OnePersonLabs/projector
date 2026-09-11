import { readFile } from "node:fs/promises";

import { hashFramedDomain, type StateBinding } from "@projector/core";
import type { StateBindingValidation } from "@projector/core";
import { currentBuiltInRepresentationProfile, DependencyScopedStateBindingValidator } from "@projector/engine";
import { RepositoryPathService } from "@projector/runtime";

import type { CompiledRepositoryChange } from "./compiler.js";
import { buildRepositoryImpactSnapshot, predictRepositoryImpact, repositoryImpactProofHash } from "../impact/service.js";
import { observeChangeRepository } from "./repository-observer.js";
import { createChangeQueryRegistry } from "./query-programs.js";

export async function validateCompiledRepositoryChangeCurrentness(input: {
  readonly repositoryRoot: string;
  readonly compiled: CompiledRepositoryChange;
  readonly binding?: StateBinding;
  readonly signal?: AbortSignal;
  readonly now?: () => string;
}): Promise<StateBindingValidation> {
  input.signal?.throwIfAborted();
  const paths = await RepositoryPathService.create(input.repositoryRoot);
  const now = input.now ?? (() => new Date().toISOString());
  const liveObservation = async () => {
    input.signal?.throwIfAborted();
    const observation = await observeChangeRepository(input.repositoryRoot);
    input.signal?.throwIfAborted();
    return observation;
  };
  const validator = new DependencyScopedStateBindingValidator({
    values: {
      readVersionHash: async (dependency) => {
        const observation = await liveObservation();
        if (dependency.id.startsWith("path:")) {
          const path = dependency.id.slice("path:".length);
          let content: string | null;
          try { content = await readFile((await paths.resolveRead(path)).realTarget, "utf8"); }
          catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") content = null; else throw error; }
          return hashFramedDomain("transform-content", content);
        }
        if (dependency.id.startsWith("independent-validator:")) return (await observation.independentValidator(dependency.id.slice("independent-validator:".length))).contentHash;
        if (dependency.id === "canonical-root") return observation.canonical.rootDigest;
        if (dependency.id === "projector.local-repository") return observation.state.toolchainDigest;
        if (dependency.kind === "representation-profile") {
          return currentBuiltInRepresentationProfile(dependency.id)?.semanticHash;
        }
        if (dependency.id.startsWith("proposal:")) return input.compiled.proposalHash;
        if (dependency.id === "repository-impact-proof") {
          const snapshot = buildRepositoryImpactSnapshot(observation);
          const prediction = await predictRepositoryImpact(snapshot, input.compiled.exactPatchInput.edits.filter(({ path }) => !path.startsWith(".projector/")).map(({ path }) => path), input.compiled.canonicalWrites);
          return repositoryImpactProofHash(snapshot, prediction);
        }
        if (dependency.id.startsWith("knowledge-context:")) {
          const retained = input.compiled.knowledgeContext;
          return retained !== undefined && dependency.id === `knowledge-context:${retained.id}` ? retained.contentHash : undefined;
        }
        if (dependency.id === "architecture-discovery") return dependency.versionHash;
        return undefined;
      },
    },
    queries: { evaluate: async (query, context) => createChangeQueryRegistry({ observation: await liveObservation(), now: now() }).evaluate(query, context) },
  });
  const observation = await liveObservation();
  const binding = input.binding ?? input.compiled.compiledPlan.plan.boundState;
  const result = await validator.validate(binding, observation.state, {
    repositoryRoot: input.repositoryRoot,
    stateDigest: observation.state,
    config: {},
    signal: input.signal ?? new AbortController().signal,
  });
  return result.status === "rebound"
    ? { ...result, status: "current", reasons: ["all approval-scoped value and query dependencies remain current"] }
    : result;
}
