import type {
  AdapterContext,
  ContentHash,
  StateDigest,
  StateQueryReader,
  StateValueDependencyRef,
} from "@projector/core";
import { describe, expect, it } from "vitest";

import { InMemoryGraphReader, QueryDependencyRegistry } from "../query/index.js";
import {
  DependencyScopedCache,
  DependencyScopedStateBindingValidator,
  createStateBinding,
  type StateValueDependencyReader,
} from "./index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;

const oldState: StateDigest = {
  gitBase: "base",
  worktreeDigest: hash("worktree-old"),
  canonicalProjectorDigest: hash("canonical-old"),
  toolchainDigest: hash("toolchain"),
};

const newState: StateDigest = {
  ...oldState,
  worktreeDigest: hash("worktree-new"),
};

const context = (stateDigest: StateDigest): AdapterContext => ({
  repositoryRoot: "/repo",
  stateDigest,
  config: {},
  signal: new AbortController().signal,
});

const valueDependency: StateValueDependencyRef = {
  kind: "canonical-entity",
  id: "concept:checkout",
  versionHash: hash("checkout-v1"),
  role: "semantic-meaning",
};

const setup = async (options: {
  results?: Array<Record<string, unknown>>;
  observability?: "closed" | "bounded" | "open" | "sampled" | "unavailable";
  assumptions?: string[];
  unavailableLanes?: string[];
  currentValueHash?: ContentHash;
  changedKeys?: string[];
}) => {
  const graph = new InMemoryGraphReader();
  const queries = new QueryDependencyRegistry(graph);
  let results = options.results ?? [{ id: "consumer-a" }];
  queries.register({
    id: "test.consumers",
    version: "1",
    kind: "contract-topology",
    evaluate: () => ({
      results,
      observability: options.observability ?? "closed",
      assumptions: options.assumptions ?? [],
      unavailableLanes: options.unavailableLanes ?? (options.observability === "unavailable" ? ["contract-index"] : []),
      dependencyKeys: ["contracts:checkout"],
    }),
  });
  const query = queries.createSpec({ id: "checkout-consumers", programId: "test.consumers", input: {} });
  const priorResult = await queries.evaluate(query, context(oldState));
  const binding = createStateBinding({
    compiledAgainst: oldState,
    valueDependencies: [valueDependency],
    queryDependencies: [{ query, priorResult, role: "consumer-boundary" }],
  });
  const values: StateValueDependencyReader = {
    readVersionHash: async () => options.currentValueHash ?? valueDependency.versionHash,
  };
  let changedKeys = options.changedKeys;
  const validator = new DependencyScopedStateBindingValidator({
    values,
    queries,
    changedDependencyKeys: {
      changedKeys: async () => changedKeys,
    },
  });
  return {
    binding,
    queries,
    values,
    validator,
    setResults: (next: Array<Record<string, unknown>>) => { results = next; },
    setChangedKeys: (next: string[]) => { changedKeys = next; },
  };
};

describe("state binding construction", () => {
  it("sorts and deduplicates value and query dependencies into one deterministic digest", async () => {
    const { binding } = await setup({});
    const duplicate = createStateBinding({
      compiledAgainst: oldState,
      valueDependencies: [valueDependency, valueDependency],
      queryDependencies: [binding.queryDependencies[0]!, binding.queryDependencies[0]!],
    });

    expect(duplicate.valueDependencies).toEqual([valueDependency]);
    expect(duplicate.queryDependencies).toEqual(binding.queryDependencies);
    expect(duplicate.dependencyDigest).toBe(binding.dependencyDigest);
  });

  it("accepts contract-valid empty, value-only, and query-only dependency sets", async () => {
    const { binding } = await setup({});
    expect(createStateBinding({ ...binding, valueDependencies: [], queryDependencies: [] })).toMatchObject({
      valueDependencies: [],
      queryDependencies: [],
    });
    expect(createStateBinding({ ...binding, queryDependencies: [] }).valueDependencies).toEqual([valueDependency]);
    expect(createStateBinding({ ...binding, valueDependencies: [] }).queryDependencies).toEqual(binding.queryDependencies);
  });

  it("requires dependency keys when a query dependency is present", async () => {
    const { binding } = await setup({});
    expect(() => createStateBinding({
      ...binding,
      queryDependencies: [{
        ...binding.queryDependencies[0]!,
        priorResult: { ...binding.queryDependencies[0]!.priorResult, dependencyKeys: [] },
      }],
    })).toThrow(/dependency key/i);
  });

  it("refuses a query fingerprint captured for a different query", async () => {
    const { binding } = await setup({});

    expect(() => createStateBinding({
      ...binding,
      queryDependencies: [{
        ...binding.queryDependencies[0]!,
        priorResult: { ...binding.queryDependencies[0]!.priorResult, queryHash: hash("different-query") },
      }],
    })).toThrow(/query hash/i);
  });
});

describe("dependency-scoped validation", () => {
  it("detects a query program version replacement against the same StateDigest", async () => {
    const fixture = await setup({});
    fixture.queries.register({
      id: "test.consumers",
      version: "2",
      kind: "contract-topology",
      evaluate: () => ({
        results: [{ id: "consumer-a" }],
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: ["contracts:checkout"],
      }),
    });

    const validation = await fixture.validator.validate(fixture.binding, oldState, context(oldState));

    expect(validation.status).toBe("stale");
    expect(validation.changedQueryDependencyIds).toEqual(["checkout-consumers"]);
  });

  it("fails closed for an unknown query program against the same StateDigest", async () => {
    const fixture = await setup({});
    const validator = new DependencyScopedStateBindingValidator({
      values: fixture.values,
      queries: new QueryDependencyRegistry(new InMemoryGraphReader(), false),
    });

    const validation = await validator.validate(fixture.binding, oldState, context(oldState));

    expect(validation.status).toBe("unavailable");
    expect(validation.changedQueryDependencyIds).toEqual([]);
  });

  it("rejects a forged dependency digest against the same StateDigest", async () => {
    const fixture = await setup({});

    const validation = await fixture.validator.validate(
      { ...fixture.binding, dependencyDigest: hash("forged") },
      oldState,
      context(oldState),
    );

    expect(validation.status).toBe("suspect");
    expect(validation.reasons.join(" ")).toMatch(/digest/i);
  });

  it("conservatively re-evaluates a reader without optional program inspection", async () => {
    const fixture = await setup({});
    fixture.setResults([{ id: "consumer-a" }, { id: "consumer-b" }]);
    const readerWithoutAssert = {
      evaluate: (query, adapterContext) => fixture.queries.evaluate(query, adapterContext),
    } satisfies StateQueryReader;
    const validator = new DependencyScopedStateBindingValidator({ values: fixture.values, queries: readerWithoutAssert });

    const validation = await validator.validate(fixture.binding, oldState, context(oldState));

    expect(validation.status).toBe("stale");
    expect(validation.changedQueryDependencyIds).toEqual(["checkout-consumers"]);
  });

  it("rebinds an unrelated root change without recomputing semantic work", async () => {
    const { binding, validator } = await setup({ changedKeys: ["units:unrelated"] });

    const validation = await validator.validate(binding, newState, context(newState));

    expect(validation.status).toBe("rebound");
    expect(validation.changedValueDependencyIds).toEqual([]);
    expect(validation.changedQueryDependencyIds).toEqual([]);
    expect(validation.rebound?.compiledAgainst).toEqual(newState);
    expect(validation.rebound?.dependencyDigest).toBe(binding.dependencyDigest);
  });

  it("marks a changed value dependency stale", async () => {
    const { binding, validator } = await setup({ currentValueHash: hash("checkout-v2"), changedKeys: [] });

    const validation = await validator.validate(binding, newState, context(newState));

    expect(validation.status).toBe("stale");
    expect(validation.changedValueDependencyIds).toEqual(["concept:checkout"]);
  });

  it("invalidates when the result set changes even though selected value hashes are unchanged", async () => {
    const fixture = await setup({ changedKeys: ["contracts:checkout"] });
    fixture.setResults([{ id: "consumer-a" }, { id: "consumer-b" }]);

    const validation = await fixture.validator.validate(fixture.binding, newState, context(newState));

    expect(validation.status).toBe("stale");
    expect(validation.changedValueDependencyIds).toEqual([]);
    expect(validation.changedQueryDependencyIds).toEqual(["checkout-consumers"]);
  });

  it("marks a query program version replacement stale", async () => {
    const fixture = await setup({ changedKeys: ["contracts:checkout"] });
    fixture.queries.register({
      id: "test.consumers",
      version: "2",
      kind: "contract-topology",
      evaluate: () => ({
        results: [{ id: "consumer-a" }],
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: ["contracts:checkout"],
      }),
    });

    const validation = await fixture.validator.validate(fixture.binding, newState, context(newState));

    expect(validation.status).toBe("stale");
    expect(validation.changedQueryDependencyIds).toEqual(["checkout-consumers"]);
    expect(validation.reasons.join(" ")).toMatch(/program.*version/i);
  });

  it.each(["open", "sampled"] as const)("does not accept an empty %s result as absence proof", async (observability) => {
    const { binding, validator } = await setup({ results: [], observability, changedKeys: ["contracts:checkout"] });

    const validation = await validator.validate(binding, newState, context(newState));

    expect(validation.status).toBe("suspect");
  });

  it("accepts an empty bounded result when the registered boundary has no assumptions", async () => {
    const { binding, validator } = await setup({ results: [], observability: "bounded", changedKeys: ["contracts:checkout"] });

    const validation = await validator.validate(binding, newState, context(newState));

    expect(validation.status).toBe("rebound");
  });

  it("does not rebind a prior result with an unavailable observation lane", async () => {
    const { binding, validator } = await setup({
      unavailableLanes: ["external-consumers"],
      changedKeys: ["units:unrelated"],
    });

    const validation = await validator.validate(binding, newState, context(newState));

    expect(validation.status).toBe("suspect");
  });

  it("reports unavailable when a required query lane cannot be observed", async () => {
    const { binding, validator } = await setup({ results: [], observability: "unavailable", changedKeys: ["contracts:checkout"] });

    const validation = await validator.validate(binding, newState, context(newState));

    expect(validation.status).toBe("unavailable");
  });
});

describe("dependency-scoped cache", () => {
  it("refuses an entry that omits consumed value hashes", async () => {
    const fixture = await setup({});
    const cache = new DependencyScopedCache<string, { result: string }>(fixture.validator);
    const queryOnly = createStateBinding({ ...fixture.binding, valueDependencies: [] });

    expect(() => cache.set("unsafe", { result: "compiled" }, queryOnly)).toThrow(/value dependenc/i);
  });

  it("refuses an entry that omits its query boundary", async () => {
    const fixture = await setup({});
    const cache = new DependencyScopedCache<string, { result: string }>(fixture.validator);

    expect(() => cache.set("unsafe", { result: "compiled" }, { ...fixture.binding, queryDependencies: [] }))
      .toThrow(/query dependenc/i);
  });

  it("keeps entries through a safe rebind and evicts them after a query membership change", async () => {
    const fixture = await setup({ changedKeys: ["units:unrelated"] });
    const cache = new DependencyScopedCache<string, { result: string }>(fixture.validator);
    cache.set("checkout", { result: "compiled" }, fixture.binding);

    await expect(cache.get("checkout", newState, context(newState))).resolves.toEqual({ result: "compiled" });

    fixture.setResults([{ id: "consumer-a" }, { id: "consumer-b" }]);
    fixture.setChangedKeys(["contracts:checkout"]);
    const laterState = { ...newState, canonicalProjectorDigest: hash("canonical-new") };
    await expect(cache.get("checkout", laterState, context(laterState))).resolves.toBeUndefined();
  });
});
