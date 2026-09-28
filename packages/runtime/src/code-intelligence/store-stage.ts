import { type CodePartition } from "@projector/core";

/** Preserve composite provider precedence while touching only one source path. */
export function mergeCodePartition(prior: CodePartition, next: CodePartition): CodePartition {
  if (prior.path !== next.path || prior.inputHash !== next.inputHash)
    throw new Error(`Providers observed different bytes for ${next.path}`);
  const reasons = [...new Set([prior.coverage.reason, next.coverage.reason].filter((reason): reason is string => reason !== undefined))].sort();
  return {
    ...next,
    symbols: [...new Map([...prior.symbols, ...next.symbols].map((symbol) => [symbol.id, symbol])).values()],
    edges: [...new Map([...prior.edges, ...next.edges].map((edge) => [edge.id, edge])).values()],
    coverage: {
      path: next.path,
      status: prior.coverage.status === "complete" && next.coverage.status === "complete" ? "complete" : "partial",
      reason: reasons.join("; ") || "Several compiler projects contribute facts for this source",
      capabilities: [...new Map([...prior.coverage.capabilities, ...next.coverage.capabilities].map((capability) => [`${capability.kind}:${capability.fidelity}`, capability])).values()],
    },
  };
}
