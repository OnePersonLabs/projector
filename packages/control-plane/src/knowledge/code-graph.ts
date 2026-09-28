import {
  hashFramedDomain,
  type ContentHash,
  type CodeContextSummary,
  type CodeNeighborhood,
  type ProjectionUnit,
} from "@projector/core";
import {
  SqliteCodeStore,
  type SqliteObservationStore,
} from "@projector/runtime";
import { verifyCodeInputBinding } from "@projector/analyzers";
import type { IndexedObservationDescriptor } from "../observation/indexed-types.js";

export const SEMANTIC_TOPOLOGY_PROGRAM =
  "projector.knowledge.semantic-topology";
const unique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

export function projectSemanticNeighborhood(
  sourcePath: string,
  neighborhood: CodeNeighborhood,
  unitIdsForPath: (path: string) => readonly string[],
) {
  const related = neighborhood.relatedPaths.flatMap((relatedPath) =>
    unitIdsForPath(relatedPath).map((id) => ({
      id,
      path: relatedPath,
      reasons: unique([
        ...neighborhood.incoming
          .filter((edge) => edge.source.path === relatedPath)
          .map((edge) => edge.kind),
        ...neighborhood.outgoing
          .filter((edge) => edge.targetPath === relatedPath)
          .map((edge) => edge.kind),
      ]),
      evidenceIds: [...neighborhood.incoming, ...neighborhood.outgoing]
        .filter(
          (edge) =>
            edge.source.path === relatedPath ||
            edge.targetPath === relatedPath,
        )
        .map((edge) => edge.id),
    })),
  );
  return {
    results: related,
    observability: "bounded" as const,
    assumptions: [
      "Static semantic relationships describe the indexed project and build inputs; reflection and dynamic dispatch remain open",
      ...(neighborhood.coverage === undefined
        ? [`Semantic source coverage is unavailable for ${sourcePath}; no absence can be inferred.`]
        : neighborhood.coverage.status === "complete"
          ? []
          : [neighborhood.coverage.reason ?? `Semantic source coverage is partial for ${sourcePath}; no absence can be inferred.`]),
      ...(neighborhood.truncated ? [`Semantic neighborhood is truncated for ${sourcePath}; additional relationships may exist.`] : []),
    ],
    unavailableLanes: [],
    dependencyKeys: [`code:neighborhood:${sourcePath}`],
  };
}

/** Joins derived symbol relationships to the existing ownership and meaning graph.
 * Its lifetime is one verified observation task, with an immutable code manifest.
 */
export class IndexedSemanticGraph {
  private constructor(
    readonly store: SqliteCodeStore,
    readonly generation: string | undefined,
    readonly descriptor: IndexedObservationDescriptor,
  ) {}
  static async open(
    descriptor: IndexedObservationDescriptor,
  ): Promise<IndexedSemanticGraph> {
    const store = await SqliteCodeStore.open(descriptor.repositoryRoot);
    try {
      store.beginReadSnapshot();
      const head = store.head();
      const metadata = head === null ? undefined : store.manifest(head);
      const current =
        metadata?.binding.checkoutId === descriptor.checkoutId &&
        metadata.binding.worktreeDigest ===
          descriptor.metadata.state.worktreeDigest &&
        metadata.binding.status === "verified" &&
        verifyCodeInputBinding(metadata.binding, descriptor.repositoryRoot);
      return new IndexedSemanticGraph(
        store,
        current ? head! : undefined,
        descriptor,
      );
    } catch (error) {
      store.close();
      throw error;
    }
  }
  close(): void {
    this.store.close();
  }
  version(key: string): ContentHash | undefined {
    if (!key.startsWith("code:neighborhood:")) return undefined;
    const path = key.slice("code:neighborhood:".length);
    if (this.generation === undefined)
      return hashFramedDomain("semantic-lane-unavailable", path);
    return this.store.dependencyVersion(this.generation, path) as ContentHash;
  }
  neighborhood(unitId: string, observation: SqliteObservationStore) {
    const unit = observation.getAt<ProjectionUnit>(
      this.descriptor.generation,
      "unit",
      unitId,
    );
    const path = unit?.key ?? unitId;
    if (this.generation === undefined)
      return {
        results: [],
        observability: "unavailable" as const,
        assumptions: [],
        unavailableLanes: ["semantic-code-index:not-current"],
        dependencyKeys: [`code:neighborhood:${path}`],
      };
    const neighborhood = this.store.neighborhood(this.generation, path, 5000);
    return projectSemanticNeighborhood(
      path,
      neighborhood,
      (relatedPath) =>
        observation.populationAt(
          this.descriptor.generation,
          `unit-path:${relatedPath}`,
        ),
    );
  }
  summary(
    unitIds: readonly string[],
    observation: SqliteObservationStore,
  ): CodeContextSummary | undefined {
    if (this.generation === undefined) return undefined;
    const paths = unique(
      unitIds.flatMap((id) => {
        const unit = observation.getAt<ProjectionUnit>(
          this.descriptor.generation,
          "unit",
          id,
        );
        return unit === undefined ? [] : [unit.key];
      }),
    );
    const neighborhoods = paths
      .slice(0, 32)
      .map((path) => this.store.neighborhood(this.generation!, path, 100));
    const symbols = [
      ...new Map(
        neighborhoods
          .flatMap((item) => item.symbols)
          .map((symbol) => [symbol.id, symbol]),
      ).values(),
    ];
    const edges = [
      ...new Map(
        neighborhoods
          .flatMap((item) => [...item.incoming, ...item.outgoing])
          .map((edge) => [edge.id, edge]),
      ).values(),
    ];
    return {
      generation: this.generation,
      worktreeDigest: this.descriptor.metadata.state.worktreeDigest,
      symbols: symbols.slice(0, 100),
      edges: edges.slice(0, 200),
      relatedPaths: unique(neighborhoods.flatMap((item) => item.relatedPaths)),
      coverage: neighborhoods.flatMap((item) =>
        item.coverage === undefined ? [] : [item.coverage],
      ),
      unknowns: unique([
        ...neighborhoods.flatMap((item) =>
          item.truncated
            ? [`Semantic neighborhood exceeds its display bound: ${item.path}`]
            : [],
        ),
        ...neighborhoods.flatMap((item) =>
          item.coverage?.status === "complete"
            ? []
            : [
                item.coverage?.reason ??
                  `Semantic coverage is unavailable: ${item.path}`,
              ],
        ),
        ...(paths.length > 32 || symbols.length > 100 || edges.length > 200
          ? [
              "Additional semantic facts remain available through generation-bound code queries",
            ]
          : []),
      ]),
    };
  }
}
