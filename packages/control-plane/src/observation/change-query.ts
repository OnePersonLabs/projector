import type { AdapterContext, StateQuerySpec } from "@projector/core";
import { withObservationScope } from "@projector/runtime";
import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { runObservationTask } from "./task-runner.js";

export function evaluateObservedChangeQuery(observation: ChangeRepositoryObservation, now: string, query: StateQuerySpec, context: AdapterContext) {
  const { independentValidator: _validator, ...data } = observation;
  const { signal, ...contextData } = context;
  return withObservationScope({ signal }, (scope) => runObservationTask("change-query", { observation: data, now, query, context: contextData }, scope));
}

export function calculateObservedRelevance(observation: ChangeRepositoryObservation, editedPaths: readonly string[], signal?: AbortSignal) {
  const { independentValidator: _validator, ...data } = observation;
  return withObservationScope(signal === undefined ? {} : { signal }, (scope) => runObservationTask("change-relevance", { observation: data, editedPaths }, scope));
}
