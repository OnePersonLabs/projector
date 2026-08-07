import type { CanonicalFileRepository } from "../persistence/index.js";
import { SqliteDerivedStore, type DerivedRevision } from "./derived-store.js";

export async function rebuildDerivedStore(
  canonical: CanonicalFileRepository,
  store: SqliteDerivedStore,
): Promise<DerivedRevision> {
  return store.replaceCanonicalSnapshot(await canonical.snapshot());
}
