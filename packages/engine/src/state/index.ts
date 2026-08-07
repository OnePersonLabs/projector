import {
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type ContentHash,
  type StateBinding,
  type StateBindingValidation,
  type StateBindingValidator,
  type StateDigest,
  type StateQueryDependency,
  type StateQueryReader,
  type StateQueryResultFingerprint,
  type StateQuerySpec,
  type StateValueDependencyRef,
} from "@projector/core";

import { QueryProgramVersionError, UnknownQueryProgramError } from "../query/index.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUniqueStrings = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

const valueKey = (dependency: StateValueDependencyRef): string =>
  canonicalJson({ kind: dependency.kind, id: dependency.id, role: dependency.role });

const queryKey = (dependency: StateQueryDependency): string =>
  canonicalJson({ id: dependency.query.id, role: dependency.role });

function normalizeValueDependencies(dependencies: readonly StateValueDependencyRef[]): StateValueDependencyRef[] {
  const byKey = new Map<string, StateValueDependencyRef>();
  for (const dependency of dependencies) {
    const key = valueKey(dependency);
    const existing = byKey.get(key);
    if (existing !== undefined && existing.versionHash !== dependency.versionHash) {
      throw new Error(`conflicting value dependency ${dependency.id}`);
    }
    byKey.set(key, structuredClone(dependency));
  }
  return [...byKey.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, dependency]) => dependency);
}

function normalizeFingerprint(fingerprint: StateQueryResultFingerprint): StateQueryResultFingerprint {
  return {
    ...structuredClone(fingerprint),
    assumptions: sortedUniqueStrings(fingerprint.assumptions),
    unavailableLanes: sortedUniqueStrings(fingerprint.unavailableLanes),
    dependencyKeys: sortedUniqueStrings(fingerprint.dependencyKeys),
  };
}

function normalizeQueryDependencies(dependencies: readonly StateQueryDependency[]): StateQueryDependency[] {
  const byKey = new Map<string, StateQueryDependency>();
  for (const dependency of dependencies) {
    const normalized = { ...structuredClone(dependency), priorResult: normalizeFingerprint(dependency.priorResult) };
    if (normalized.priorResult.queryHash !== normalized.query.semanticHash) {
      throw new Error(`query dependency ${dependency.query.id} prior result query hash does not match its query`);
    }
    if (normalized.priorResult.dependencyKeys.length === 0) {
      throw new Error(`query dependency ${dependency.query.id} must declare at least one dependency key`);
    }
    const key = queryKey(normalized);
    const existing = byKey.get(key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(normalized)) {
      throw new Error(`conflicting query dependency ${dependency.query.id}`);
    }
    byKey.set(key, normalized);
  }
  return [...byKey.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, dependency]) => dependency);
}

export interface CreateStateBindingInput {
  compiledAgainst: StateDigest;
  valueDependencies: readonly StateValueDependencyRef[];
  queryDependencies: readonly StateQueryDependency[];
}

export function createStateBinding(input: CreateStateBindingInput): StateBinding {
  const valueDependencies = normalizeValueDependencies(input.valueDependencies);
  if (valueDependencies.length === 0) throw new Error("state binding must declare at least one value dependency");
  const queryDependencies = normalizeQueryDependencies(input.queryDependencies);
  if (queryDependencies.length === 0) throw new Error("state binding must declare at least one query dependency");
  return {
    compiledAgainst: structuredClone(input.compiledAgainst),
    valueDependencies,
    queryDependencies,
    dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies, queryDependencies }),
  };
}

export interface StateValueDependencyReader {
  readVersionHash(
    dependency: StateValueDependencyRef,
    currentState: StateDigest,
    context: AdapterContext,
  ): Promise<ContentHash | undefined>;
}

export interface ChangedDependencyKeyReader {
  /** `undefined` means locality cannot be proven and all registered queries must be re-evaluated. */
  changedKeys(
    previousState: StateDigest,
    currentState: StateDigest,
    context: AdapterContext,
  ): Promise<readonly string[] | undefined>;
}

interface InspectableStateQueryReader extends StateQueryReader {
  assertCurrent?(query: StateQuerySpec): void;
}

export interface DependencyScopedStateBindingValidatorOptions {
  values: StateValueDependencyReader;
  queries: InspectableStateQueryReader;
  changedDependencyKeys?: ChangedDependencyKeyReader;
}

const sameState = (left: StateDigest, right: StateDigest): boolean => canonicalJson(left) === canonicalJson(right);

const sameFingerprint = (left: StateQueryResultFingerprint, right: StateQueryResultFingerprint): boolean =>
  canonicalJson(normalizeFingerprint(left)) === canonicalJson(normalizeFingerprint(right));

const cannotProveEmptyAbsence = (fingerprint: StateQueryResultFingerprint): boolean =>
  fingerprint.resultCount === 0 && (
    fingerprint.observability === "open"
    || fingerprint.observability === "sampled"
    || (fingerprint.observability === "bounded" && fingerprint.assumptions.length === 0)
  );

export class DependencyScopedStateBindingValidator implements StateBindingValidator {
  private readonly values: StateValueDependencyReader;
  private readonly queries: InspectableStateQueryReader;
  private readonly changedDependencyKeys: ChangedDependencyKeyReader | undefined;

  constructor(options: DependencyScopedStateBindingValidatorOptions) {
    this.values = options.values;
    this.queries = options.queries;
    this.changedDependencyKeys = options.changedDependencyKeys;
  }

  async validate(binding: StateBinding, currentState: StateDigest, context: AdapterContext): Promise<StateBindingValidation> {
    if (sameState(binding.compiledAgainst, currentState)) {
      return {
        status: "current",
        currentState: structuredClone(currentState),
        changedValueDependencyIds: [],
        changedQueryDependencyIds: [],
        reasons: ["compiled snapshot is unchanged"],
      };
    }

    let normalizedBinding: StateBinding;
    try {
      normalizedBinding = createStateBinding(binding);
      if (normalizedBinding.dependencyDigest !== binding.dependencyDigest) {
        return {
          status: "suspect",
          currentState: structuredClone(currentState),
          changedValueDependencyIds: [],
          changedQueryDependencyIds: [],
          reasons: ["binding dependency digest does not match its value and query dependencies"],
        };
      }
    } catch (error) {
      return {
        status: "suspect",
        currentState: structuredClone(currentState),
        changedValueDependencyIds: [],
        changedQueryDependencyIds: [],
        reasons: [error instanceof Error ? error.message : "invalid state binding"],
      };
    }

    const changedValueDependencyIds: string[] = [];
    const changedQueryDependencyIds: string[] = [];
    const unavailableValueDependencyIds: string[] = [];
    const unavailableQueryDependencyIds: string[] = [];
    const suspectQueryDependencyIds: string[] = [];
    const reasons: string[] = [];

    for (const dependency of normalizedBinding.valueDependencies) {
      try {
        const currentHash = await this.values.readVersionHash(dependency, currentState, context);
        if (currentHash === undefined) {
          unavailableValueDependencyIds.push(dependency.id);
        } else if (currentHash !== dependency.versionHash) {
          changedValueDependencyIds.push(dependency.id);
        }
      } catch {
        unavailableValueDependencyIds.push(dependency.id);
      }
    }

    let changedKeys: readonly string[] | undefined;
    try {
      changedKeys = await this.changedDependencyKeys?.changedKeys(binding.compiledAgainst, currentState, context);
    } catch {
      changedKeys = undefined;
      reasons.push("changed dependency keys could not be proven; queries were re-evaluated conservatively");
    }
    const changedKeySet = changedKeys === undefined ? undefined : new Set(changedKeys);
    const reboundQueryDependencies: StateQueryDependency[] = [];

    for (const dependency of normalizedBinding.queryDependencies) {
      try {
        this.queries.assertCurrent?.(dependency.query);
      } catch (error) {
        if (error instanceof QueryProgramVersionError) {
          changedQueryDependencyIds.push(dependency.query.id);
          reasons.push(error.message);
        } else {
          unavailableQueryDependencyIds.push(dependency.query.id);
          reasons.push(error instanceof Error ? error.message : `query ${dependency.query.id} is unavailable`);
        }
        reboundQueryDependencies.push(dependency);
        continue;
      }

      const isProvablyUnchanged = changedKeySet !== undefined
        && dependency.priorResult.dependencyKeys.every((key) => !changedKeySet.has(key));
      if (isProvablyUnchanged) {
        if (dependency.priorResult.observability === "unavailable") unavailableQueryDependencyIds.push(dependency.query.id);
        else if (cannotProveEmptyAbsence(dependency.priorResult)) suspectQueryDependencyIds.push(dependency.query.id);
        reboundQueryDependencies.push(dependency);
        continue;
      }

      try {
        const current = normalizeFingerprint(await this.queries.evaluate(dependency.query, context));
        reboundQueryDependencies.push({ ...dependency, priorResult: current });
        if (current.observability === "unavailable") {
          unavailableQueryDependencyIds.push(dependency.query.id);
        } else if (!sameFingerprint(current, dependency.priorResult)) {
          changedQueryDependencyIds.push(dependency.query.id);
        } else if (cannotProveEmptyAbsence(current)) {
          suspectQueryDependencyIds.push(dependency.query.id);
        } else if (current.unavailableLanes.length > 0) {
          suspectQueryDependencyIds.push(dependency.query.id);
        }
      } catch (error) {
        if (error instanceof QueryProgramVersionError) {
          changedQueryDependencyIds.push(dependency.query.id);
          reasons.push(error.message);
        } else if (error instanceof UnknownQueryProgramError) {
          unavailableQueryDependencyIds.push(dependency.query.id);
          reasons.push(error.message);
        } else {
          unavailableQueryDependencyIds.push(dependency.query.id);
          reasons.push(`query ${dependency.query.id} could not be re-evaluated`);
        }
        reboundQueryDependencies.push(dependency);
      }
    }

    const changedValues = sortedUniqueStrings(changedValueDependencyIds);
    const changedQueries = sortedUniqueStrings(changedQueryDependencyIds);
    const unavailableValues = sortedUniqueStrings(unavailableValueDependencyIds);
    const unavailableQueries = sortedUniqueStrings(unavailableQueryDependencyIds);
    const suspectQueries = sortedUniqueStrings(suspectQueryDependencyIds);
    if (changedValues.length > 0) reasons.push(`value dependencies changed: ${changedValues.join(", ")}`);
    if (changedQueries.length > 0) reasons.push(`query dependencies changed: ${changedQueries.join(", ")}`);
    if (unavailableValues.length > 0) reasons.push(`value dependencies unavailable: ${unavailableValues.join(", ")}`);
    if (unavailableQueries.length > 0) reasons.push(`query dependencies unavailable: ${unavailableQueries.join(", ")}`);
    if (suspectQueries.length > 0) reasons.push(`query absence is not proof-eligible: ${suspectQueries.join(", ")}`);

    const base = {
      currentState: structuredClone(currentState),
      changedValueDependencyIds: changedValues,
      changedQueryDependencyIds: changedQueries,
      reasons,
    };
    if (unavailableValues.length > 0 || unavailableQueries.length > 0) return { status: "unavailable", ...base };
    if (changedValues.length > 0 || changedQueries.length > 0) return { status: "stale", ...base };
    if (suspectQueries.length > 0) return { status: "suspect", ...base };

    const rebound = createStateBinding({
      compiledAgainst: currentState,
      valueDependencies: normalizedBinding.valueDependencies,
      queryDependencies: reboundQueryDependencies,
    });
    return {
      status: "rebound",
      ...base,
      reasons: reasons.length === 0 ? ["all bound value hashes and query dependencies remain current"] : reasons,
      rebound,
    };
  }
}

interface CacheEntry<V> {
  value: V;
  binding: StateBinding;
}

/** Cache hits remain conditional on the same dependency proof required by plans and semantic conclusions. */
export class DependencyScopedCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();

  constructor(private readonly validator: StateBindingValidator) {}

  set(key: K, value: V, binding: StateBinding): void {
    const normalized = createStateBinding(binding);
    if (normalized.dependencyDigest !== binding.dependencyDigest) {
      throw new Error("cache entry binding dependency digest is invalid");
    }
    this.entries.set(key, { value, binding: normalized });
  }

  async get(key: K, currentState: StateDigest, context: AdapterContext): Promise<V | undefined> {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    const validation = await this.validator.validate(entry.binding, currentState, context);
    if (validation.status === "current") return entry.value;
    if (validation.status === "rebound" && validation.rebound !== undefined) {
      entry.binding = validation.rebound;
      return entry.value;
    }
    this.entries.delete(key);
    return undefined;
  }
}
