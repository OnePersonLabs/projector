import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObservationError } from "@projector/core";
import { withObservationScope } from "@projector/runtime";
import { expect, it } from "vitest";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { buildRepositoryImpactSnapshot, impactReference, persistRepositoryImpactSnapshot, readRepositoryImpactSnapshot, reconcileRetainedImpact } from "../impact/service.js";

it("rejects an oversized retained impact read and preserves the prior snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-bounded-impact-"));
  try {
    await writeFile(join(root, "package.json"), '{"name":"bounded-impact","type":"module"}');
    const snapshot = buildRepositoryImpactSnapshot(await observeChangeRepository(root));
    await persistRepositoryImpactSnapshot(root, snapshot);
    const path = join(root, ".projector/runtime/impact", `${snapshot.contentHash.slice("sha256:v1:".length)}.json`);
    const prior = await readFile(path, "utf8");
    await expect(withObservationScope({ limits: { maxDerivedBytes: 128 } }, () => readRepositoryImpactSnapshot(root, impactReference(snapshot))))
      .rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxDerivedBytes" });
    expect(await readFile(path, "utf8")).toBe(prior);
    const failure = new ObservationError("observation-limit-exceeded", "impact-read", ".", "read allowance exhausted", "maxTotalBytes");
    await expect(reconcileRetainedImpact(root, impactReference(snapshot), snapshot, [], "context", false, async () => { throw failure; })).rejects.toBe(failure);
  } finally { await rm(root, { recursive: true, force: true }); }
});
