import { AsyncLocalStorage } from "node:async_hooks";
import { ObservationBudget, type ObservationLimits } from "@projector/core";

export interface ObservationScope {
  readonly limits: ObservationLimits;
  readonly budget: ObservationBudget;
  readonly deadline: number;
  readonly signal: AbortSignal;
  readonly isActive: () => boolean;
  readonly registerCleanup: (cleanup: () => Promise<void>) => void;
}

const scopes = new AsyncLocalStorage<ObservationScope>();

export function currentObservationScope(): ObservationScope | undefined {
  return scopes.getStore();
}

/** Nested observers share the original allowance; they cannot silently renew it. */
export function withObservationScope<T>(
  options: { readonly limits?: Partial<ObservationLimits>; readonly signal?: AbortSignal },
  operation: (scope: ObservationScope) => Promise<T>,
): Promise<T> {
  const existing = scopes.getStore();
  if (existing !== undefined) {
    if (options.signal === undefined || options.signal === existing.signal) return operation(existing);
    const nested = { ...existing, signal: AbortSignal.any([existing.signal, options.signal]) };
    nested.signal.throwIfAborted();
    return scopes.run(nested, async () => {
      try { return await operation(nested); }
      catch (error) { nested.signal.throwIfAborted(); throw error; }
    });
  }
  const budget = new ObservationBudget(options.limits);
  let active = true;
  const cleanups = new Set<() => Promise<void>>();
  const scope = {
    budget, limits: budget.limits, deadline: budget.deadline,
    signal: options.signal ?? new AbortController().signal,
    isActive: () => active,
    registerCleanup: (cleanup: () => Promise<void>): void => {
      if (!active) throw new Error("Cannot retain resources in a completed observation scope");
      cleanups.add(cleanup);
    },
  };
  scope.signal.throwIfAborted();
  return scopes.run(scope, async () => {
    let value: T | undefined;
    const failures: unknown[] = [];
    try { value = await operation(scope); }
    catch (error) { failures.push(scope.signal.aborted ? scope.signal.reason : error); }
    active = false;
    const drained = await Promise.allSettled([...cleanups].map((cleanup) => cleanup()));
    failures.push(...drained.flatMap((result) => result.status === "rejected" ? [result.reason] : []));
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "Observation and resource cleanup failed");
    return value as T;
  });
}
