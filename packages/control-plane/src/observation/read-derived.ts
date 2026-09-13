import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { ObservationError } from "@projector/core";
import type { ObservationScope } from "@projector/runtime";

/** Read a disposable record; the worker authenticates its exact content afterward. */
export async function readDerivedObservationSource(path: string, label: string, scope: ObservationScope): Promise<string> {
  const check = (): void => { scope.signal.throwIfAborted(); scope.budget.check("derived-read", label); };
  const checkBytes = (size: number): void => {
    if (size > scope.limits.maxDerivedBytes) throw new ObservationError("observation-limit-exceeded", "derived-read", label, "Retained derived record exceeds maxDerivedBytes; explicitly increase the allowance or retrieve a smaller context", "maxDerivedBytes", size);
  };
  check();
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("Retained derived record is not a regular file");
  checkBytes(Number(before.size));
  scope.budget.assertTotalBytes(Number(before.size), label);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) throw new Error("Retained derived record changed while opening");
    const chunks: Buffer[] = [];
    let size = 0;
    while (true) {
      check();
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, scope.limits.maxDerivedBytes - size + 1, scope.budget.remaining("maxTotalBytes") + 1));
      const { bytesRead } = await handle.read(chunk);
      if (bytesRead === 0) break;
      size += bytesRead;
      checkBytes(size);
      scope.budget.consume("maxTotalBytes", bytesRead, "derived-read", label);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    const after = await handle.stat({ bigint: true });
    if (after.size !== before.size || BigInt(size) !== before.size) throw new Error("Retained derived record changed while reading");
    // mtime is LRU metadata and may change during a concurrent authenticated read.
    check();
    return Buffer.concat(chunks, size).toString("utf8");
  } finally { await handle.close(); }
}
