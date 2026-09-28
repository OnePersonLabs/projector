import { observationGit } from "@projector/analyzers";
import { hashFramedDomain, DerivedObservationBudget, type ContentHash } from "@projector/core";
import { type ObservationScope, type CanonicalSnapshotSource } from "@projector/runtime";
import { collectImmutableCanonicalSources } from "../integration/git-integration.js";

export interface ClosedCanonicalInputs { targetObject: string; targetTree: string; sources: CanonicalSnapshotSource[]; files: Record<string, ContentHash>; members: Array<{ id: string }>; issues: string[] }
/** Acquire exact immutable inputs through the existing bounded, host-trusted Git adapter. */
export async function collectClosedCanonicalInputs(root: string, target: string, scope: ObservationScope, executable: string): Promise<ClosedCanonicalInputs> {
  const options = { signal: scope.signal, stage: "closed-canonical-inputs", executable };
  const targetObject = (await observationGit(root, ["--no-replace-objects", "rev-parse", "--verify", "--end-of-options", `${target}^{object}`], scope.budget, options)).trim();
  const targetTree = (await observationGit(root, ["--no-replace-objects", "rev-parse", "--verify", "--end-of-options", `${targetObject}^{tree}`], scope.budget, options)).trim();
  if (![targetObject, targetTree].every(oid => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(oid))) throw new Error("Invalid immutable verification target identity");
  const sources = await collectImmutableCanonicalSources(root, scope, targetTree, new DerivedObservationBudget(scope.limits.maxDerivedBytes), executable);
  return { targetObject, targetTree, sources, files: Object.fromEntries(sources.map(source => [source.path, hashFramedDomain("repository-artifact-content", Buffer.from(source.source).toString("base64"))])), members: sources.map(source => ({ id: source.path })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), issues: [] };
}
