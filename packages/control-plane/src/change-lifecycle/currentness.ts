import type { StateBinding } from "@projector/core";
import type { StateBindingValidation } from "@projector/core";
import { currentBuiltInRepresentationProfile, DependencyScopedStateBindingValidator } from "@projector/engine";
import { RepositoryPathService, withObservationScope } from "@projector/runtime";

import type { CompiledRepositoryChange } from "./compiler.js";
import { repositoryImpactProofHash } from "../impact/service.js";
import { runObservationTask } from "../observation/task-runner.js";
import { readObservedText, hashObservedText } from "../observation/source.js";
import { observeChangeRepository } from "./repository-observer.js";
import { evaluateObservedChangeQuery } from "../observation/change-query.js";

export async function validateCompiledRepositoryChangeCurrentness(input: {
  readonly repositoryRoot: string;
  readonly compiled: CompiledRepositoryChange;
  readonly binding?: StateBinding;
  readonly signal?: AbortSignal;
  readonly now?: () => string;
}): Promise<StateBindingValidation> {
  return withObservationScope(input.signal === undefined ? {} : { signal: input.signal }, async () => {
  input.signal?.throwIfAborted();
  const paths = await RepositoryPathService.create(input.repositoryRoot);
  const now = input.now ?? (() => new Date().toISOString());
  let capturedObservation: ReturnType<typeof observeChangeRepository> | undefined;
  const liveObservation = async () => {
    input.signal?.throwIfAborted();
    // All dependencies in this validation bind one current observation. A later
    // capture, approval or execution validation creates a new observation.
    capturedObservation ??= observeChangeRepository(input.repositoryRoot);
    const observation = await capturedObservation;
    input.signal?.throwIfAborted();
    return observation;
  };
  const validator = new DependencyScopedStateBindingValidator({
    values: {
      readVersionHash: async (dependency) => {
        const observation = await liveObservation();
        if (dependency.id.startsWith("path:")) {
          const path = dependency.id.slice("path:".length);
          return hashObservedText(await readObservedText((await paths.resolveRead(path)).realTarget, input.signal), input.signal);
        }
        if (dependency.id.startsWith("independent-validator:")) return (await observation.independentValidator(dependency.id.slice("independent-validator:".length))).contentHash;
        if (dependency.id === "canonical-root") return observation.canonical.rootDigest;
        if (dependency.id === "projector.local-repository") return observation.state.toolchainDigest;
        if (dependency.kind === "representation-profile") {
          return currentBuiltInRepresentationProfile(dependency.id)?.semanticHash;
        }
        if (dependency.id.startsWith("proposal:")) return input.compiled.proposalHash;
        if (dependency.id === "repository-impact-proof") {
          return withObservationScope(input.signal === undefined ? {} : { signal: input.signal }, async (scope) => {
            const { independentValidator: _validator, ...data } = observation;
            const snapshot = await runObservationTask("build-impact", { observation: data }, scope);
            const prediction = await runObservationTask("predict-impact", { snapshot, editedPaths: input.compiled.exactPatchInput.edits.filter(({ path }) => !path.startsWith(".projector/")).map(({ path }) => path), canonicalChanges: input.compiled.canonicalWrites }, scope);
            return repositoryImpactProofHash(snapshot, prediction);
          });
        }
        if (dependency.id.startsWith("knowledge-context:")) {
          const retained = input.compiled.knowledgeContext;
          return retained !== undefined && dependency.id === `knowledge-context:${retained.id}` ? retained.contentHash : undefined;
        }
        if (dependency.id === "architecture-discovery") return dependency.versionHash;
        return undefined;
      },
    },
    queries: { evaluate: async (query, context) => evaluateObservedChangeQuery(await liveObservation(), now(), query, context) },
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
  });
}
