import type { LocalRepositoryAnalysis, InventoryResult } from "@projector/analyzers";
import type { CanonicalSnapshot, IndexedObservationDelta, SqliteObservationStore } from "@projector/runtime";
import type { ContentHash, StateDigest } from "@projector/core";
import type { WatchmanBaseline } from "../change-lifecycle/watchman-observation.js";
import type { RepositoryObservationData } from "./tasks.js";

export const INDEXED_OBSERVATION_CONTRACT = "projector-indexed-observation/v1";
export interface IndexedObservationMetadata {
  readonly schemaVersion: typeof INDEXED_OBSERVATION_CONTRACT;
  readonly checkoutId: string;
  readonly repositoryRoot: string;
  readonly state: StateDigest;
  readonly inventoryDescriptor: InventoryResult["observationDescriptor"];
  readonly enumeration: InventoryResult["enumeration"];
  readonly analysisHeader: Pick<LocalRepositoryAnalysis,"surface"|"capabilities"|"observationDescriptor"> & { readonly git: Pick<LocalRepositoryAnalysis["git"],"availability"|"revision"> };
  readonly canonicalRootDigest: CanonicalSnapshot["rootDigest"];
  /** Raw source boundaries used when a complete notification provider is absent. */
  readonly canonicalSourceHash: ContentHash;
  readonly gitSourceHash: ContentHash;
  readonly contractHash: ContentHash;
  readonly watchman?: WatchmanBaseline;
  readonly gitWatchmen: readonly WatchmanBaseline[];
  readonly gitDirectories: readonly string[];
  readonly counts: { readonly files: number; readonly bytes: number; readonly directories: number };
  readonly rebuildReason?: string;
  readonly incrementalSupport: { readonly globalSyntax: boolean; readonly hookReachability: boolean };
  readonly fileManifestRoot: ContentHash;
  readonly moveManifestRoot: ContentHash;
  readonly moveCandidates: { readonly deleted: number; readonly untracked: number };
}
/** Serializable address of one completed derived observation. No mutable authority travels with it. */
export interface IndexedObservationDescriptor {
  readonly schemaVersion: typeof INDEXED_OBSERVATION_CONTRACT;
  readonly repositoryRoot: string;
  readonly checkoutId: string;
  readonly generation: number;
  readonly contractHash: ContentHash;
  readonly metadata: IndexedObservationMetadata;
}
export interface IndexedRepositoryObservation {
  readonly descriptor: IndexedObservationDescriptor;
  readonly store: SqliteObservationStore;
  readonly mode: "rebuild"|"delta"|"unchanged";
  readonly changedPaths: readonly string[];
  /** Legacy consumers explicitly pay full materialization cost. */
  materialize(): RepositoryObservationData;
  close(): void;
}
export interface IndexedObservationEnrollment {
  /** Cold enrollment sees the complete ordinary observation before atomic publication. */
  cold(observation: RepositoryObservationData): Promise<IndexedObservationDelta>;
  /** Delta enrollment reads prior addressed records and returns affected graph/query records. */
  delta?(input: { readonly descriptor: IndexedObservationDescriptor; readonly store: SqliteObservationStore; readonly changedPaths: readonly string[]; readonly changedObservation: RepositoryObservationData }): Promise<IndexedObservationDelta>;
}
// Record kinds: inventory(path), file(path), js(path), artifact(id), unit(id),
// dependency(importerPath), test-target(testPath), canonical(document.id),
// realization(entityId), document(path), markdown(path), actions(path),
// git-identity(path), package-script(path), query-dependency-version(key).
// Complete population markers use kind population-version, key equal to the
// population name. An absent marker is unknown, never a completed empty result.
