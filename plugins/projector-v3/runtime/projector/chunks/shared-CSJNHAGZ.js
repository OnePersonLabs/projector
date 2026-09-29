import {
  SqliteCodeStore
} from "./shared-GXAKKSCS.js";
import {
  verifyCodeInputBinding
} from "./shared-XAKKJSHO.js";
import {
  hashFramedDomain
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/knowledge/code-graph.js
var SEMANTIC_TOPOLOGY_PROGRAM = "projector.knowledge.semantic-topology";
var unique = (values) => [...new Set(values)].sort();
function projectSemanticNeighborhood(sourcePath, neighborhood, unitIdsForPath) {
  const related = neighborhood.relatedPaths.flatMap((relatedPath) => unitIdsForPath(relatedPath).map((id) => ({
    id,
    path: relatedPath,
    reasons: unique([
      ...neighborhood.incoming.filter((edge) => edge.source.path === relatedPath).map((edge) => edge.kind),
      ...neighborhood.outgoing.filter((edge) => edge.targetPath === relatedPath).map((edge) => edge.kind)
    ]),
    evidenceIds: [...neighborhood.incoming, ...neighborhood.outgoing].filter((edge) => edge.source.path === relatedPath || edge.targetPath === relatedPath).map((edge) => edge.id)
  })));
  return {
    results: related,
    observability: "bounded",
    assumptions: [
      "Static semantic relationships describe the indexed project and build inputs; reflection and dynamic dispatch remain open",
      ...neighborhood.coverage === void 0 ? [`Semantic source coverage is unavailable for ${sourcePath}; no absence can be inferred.`] : neighborhood.coverage.status === "complete" ? [] : [neighborhood.coverage.reason ?? `Semantic source coverage is partial for ${sourcePath}; no absence can be inferred.`],
      ...neighborhood.truncated ? [`Semantic neighborhood is truncated for ${sourcePath}; additional relationships may exist.`] : []
    ],
    unavailableLanes: [],
    dependencyKeys: [`code:neighborhood:${sourcePath}`]
  };
}
var IndexedSemanticGraph = class _IndexedSemanticGraph {
  store;
  generation;
  descriptor;
  constructor(store, generation, descriptor) {
    this.store = store;
    this.generation = generation;
    this.descriptor = descriptor;
  }
  static async open(descriptor) {
    const store = await SqliteCodeStore.open(descriptor.repositoryRoot);
    try {
      store.beginReadSnapshot();
      const head = store.head();
      const metadata = head === null ? void 0 : store.manifest(head);
      const current = metadata?.binding.checkoutId === descriptor.checkoutId && metadata.binding.worktreeDigest === descriptor.metadata.state.worktreeDigest && metadata.binding.status === "verified" && verifyCodeInputBinding(metadata.binding, descriptor.repositoryRoot);
      return new _IndexedSemanticGraph(store, current ? head : void 0, descriptor);
    } catch (error) {
      store.close();
      throw error;
    }
  }
  close() {
    this.store.close();
  }
  version(key) {
    if (!key.startsWith("code:neighborhood:"))
      return void 0;
    const path = key.slice("code:neighborhood:".length);
    if (this.generation === void 0)
      return hashFramedDomain("semantic-lane-unavailable", path);
    return this.store.dependencyVersion(this.generation, path);
  }
  neighborhood(unitId, observation) {
    const unit = observation.getAt(this.descriptor.generation, "unit", unitId);
    const path = unit?.key ?? unitId;
    if (this.generation === void 0)
      return {
        results: [],
        observability: "unavailable",
        assumptions: [],
        unavailableLanes: ["semantic-code-index:not-current"],
        dependencyKeys: [`code:neighborhood:${path}`]
      };
    const neighborhood = this.store.neighborhood(this.generation, path, 5e3);
    return projectSemanticNeighborhood(path, neighborhood, (relatedPath) => observation.populationAt(this.descriptor.generation, `unit-path:${relatedPath}`));
  }
  summary(unitIds, observation) {
    if (this.generation === void 0)
      return void 0;
    const paths = unique(unitIds.flatMap((id) => {
      const unit = observation.getAt(this.descriptor.generation, "unit", id);
      return unit === void 0 ? [] : [unit.key];
    }));
    const neighborhoods = paths.slice(0, 32).map((path) => this.store.neighborhood(this.generation, path, 100));
    const symbols = [
      ...new Map(neighborhoods.flatMap((item) => item.symbols).map((symbol) => [symbol.id, symbol])).values()
    ];
    const edges = [
      ...new Map(neighborhoods.flatMap((item) => [...item.incoming, ...item.outgoing]).map((edge) => [edge.id, edge])).values()
    ];
    return {
      generation: this.generation,
      worktreeDigest: this.descriptor.metadata.state.worktreeDigest,
      symbols: symbols.slice(0, 100),
      edges: edges.slice(0, 200),
      relatedPaths: unique(neighborhoods.flatMap((item) => item.relatedPaths)),
      coverage: neighborhoods.flatMap((item) => item.coverage === void 0 ? [] : [item.coverage]),
      unknowns: unique([
        ...neighborhoods.flatMap((item) => item.truncated ? [`Semantic neighborhood exceeds its display bound: ${item.path}`] : []),
        ...neighborhoods.flatMap((item) => item.coverage?.status === "complete" ? [] : [
          item.coverage?.reason ?? `Semantic coverage is unavailable: ${item.path}`
        ]),
        ...paths.length > 32 || symbols.length > 100 || edges.length > 200 ? [
          "Additional semantic facts remain available through generation-bound code queries"
        ] : []
      ])
    };
  }
};

export {
  SEMANTIC_TOPOLOGY_PROGRAM,
  projectSemanticNeighborhood,
  IndexedSemanticGraph
};
