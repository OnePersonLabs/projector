import {
  hashFramedDomain
} from "./shared-AJ5KBTH5.js";

// node_modules/@projector/control-plane/dist/knowledge/indexed-query.js
var IndexedQueryMemo = class {
  store;
  generation;
  extraVersion;
  pending = /* @__PURE__ */ new Map();
  constructor(store, generation, extraVersion) {
    this.store = store;
    this.generation = generation;
    this.extraVersion = extraVersion;
  }
  read(queryHash) {
    return this.pending.get(queryHash) ?? this.store.getAt(this.generation, "query-result", queryHash);
  }
  version(dependencyKey) {
    const external = this.extraVersion?.(dependencyKey);
    if (external !== void 0)
      return external;
    const version = this.store.getAt(this.generation, "query-dependency-version", dependencyKey);
    if (version !== void 0)
      return version;
    const namespace = dependencyKey.startsWith("relations:") ? "relations" : dependencyKey.startsWith("reverse-derivations:") ? "reverse-derivations" : void 0;
    if (namespace === void 0)
      return void 0;
    const complete = this.store.getAt(this.generation, "population-version", namespace);
    return complete === void 0 ? void 0 : hashFramedDomain("indexed-graph-absent-population", { dependencyKey, complete });
  }
  write(queryHash, entry) {
    this.pending.set(queryHash, structuredClone(entry));
  }
  delta() {
    return {
      upserts: [...this.pending].map(([key, value]) => ({ kind: "query-result", key, value })),
      dependencies: [...this.pending].flatMap(([consumer, entry]) => {
        const old = this.store.getAt(this.generation, "query-result", consumer);
        const current = new Set(entry.result.dependencyKeys);
        return [
          ...(old?.result.dependencyKeys ?? []).filter((input) => !current.has(input)).map((input) => ({ consumer, input, present: false })),
          ...entry.result.dependencyKeys.map((input) => ({ consumer, input, present: true }))
        ];
      })
    };
  }
};

export {
  IndexedQueryMemo
};
