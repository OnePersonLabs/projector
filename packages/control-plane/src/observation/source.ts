import { lstat } from "node:fs/promises";
import { readObservationFile } from "@projector/analyzers";
import { hashFramedDomain, type ContentHash } from "@projector/core";
import { withObservationScope } from "@projector/runtime";
import { runObservationTask } from "./task-runner.js";

/** Missing is distinct from an unreadable or exhausted observation. */
export async function readObservedText(path: string, signal?: AbortSignal): Promise<string | null> {
  return withObservationScope(signal === undefined ? {} : { signal }, async (scope) => {
    scope.signal.throwIfAborted();
    try { await lstat(path); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
    return (await readObservationFile(path, scope.budget, path, scope.signal)).toString("utf8");
  });
}

export async function hashObservedText(content: string | null, signal?: AbortSignal): Promise<ContentHash> {
  if (content === null) return hashFramedDomain("transform-content", null);
  return withObservationScope(signal === undefined ? {} : { signal }, (scope) => runObservationTask("hash-content", { content }, scope));
}
