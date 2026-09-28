import { mkdir, mkdtemp, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, type ContentHash } from "@projector/core";
import type { DurableArtifactSetStore } from "@projector/runtime";

/** Copies complete immutable evidence. Temporary delivery bytes carry no recovery or approval authority. */
export async function retainImmutableRecord<T extends { contentHash: ContentHash }>(store: DurableArtifactSetStore<T>, artifactSetId: string, record: T) {
  const existing = await store.read(artifactSetId);
  if (existing.status === "published") {
    if (existing.manifest.contentHash !== record.contentHash) throw new Error(`Conflicting retained event: ${artifactSetId}`);
    return;
  }
  if (existing.status !== "missing") throw new Error(`Retained event ${artifactSetId}: ${existing.status}`);
  const published = join(store.storageRoot, "published");
  await mkdir(published, { recursive: true });
  const delivery = await mkdtemp(join(store.storageRoot, ".delivery-"));
  try {
    await mkdir(join(delivery, "blobs"));
    const handle = await open(join(delivery, "manifest.bin"), "wx");
    try { await handle.writeFile(Buffer.from(canonicalJson(record))); await handle.sync(); }
    finally { await handle.close(); }
    await syncDirectory(join(delivery, "blobs"));
    await syncDirectory(delivery);
    try { await rename(delivery, join(published, artifactSetId)); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && ["EEXIST", "ENOTEMPTY", "EPERM"].includes(String(error.code)))) throw error;
      const raced = await store.read(artifactSetId);
      if (raced.status !== "published" || raced.manifest.contentHash !== record.contentHash) throw error;
    }
    const retained = await store.read(artifactSetId);
    if (retained.status !== "published" || retained.manifest.contentHash !== record.contentHash) throw new Error(`Retained event integrity failed: ${artifactSetId}`);
    await syncDirectory(published);
  } finally { await rm(delivery, { recursive: true, force: true }); }
}

async function syncDirectory(path: string) {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error) {
    if (!(error instanceof Error && "code" in error && ["EINVAL", "ENOTSUP", "EPERM"].includes(String(error.code)))) throw error;
  } finally { await handle.close(); }
}
