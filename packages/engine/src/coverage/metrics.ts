export interface RatioMetric { readonly availability: "available" | "unavailable"; readonly numerator?: number; readonly denominator?: number; readonly value?: number; readonly caveat: string }

function ratio(numerator: number | undefined, denominator: number | undefined, caveat: string): RatioMetric {
  if (numerator !== undefined && (!Number.isSafeInteger(numerator) || numerator < 0)) throw new Error("coverage quality metric numerator must be a non-negative integer");
  if (denominator !== undefined && (!Number.isSafeInteger(denominator) || denominator < 0)) throw new Error("coverage quality metric denominator must be a non-negative integer");
  if (numerator === undefined || denominator === undefined || denominator === 0) return { availability: "unavailable", caveat };
  if (numerator > denominator) throw new Error("coverage quality metric numerator cannot exceed denominator");
  return { availability: "available", numerator, denominator, value: numerator / denominator, caveat };
}

export function computeCoverageQualityMetrics(input: {
  readonly relevance: { readonly retrievedIds: readonly string[]; readonly relevantIds?: readonly string[] };
  readonly planning: { readonly predictedIds: readonly string[]; readonly observedIds?: readonly string[]; readonly surpriseDispositions: readonly string[] };
  readonly analyzers: { readonly failureCount: number; readonly observationCount?: number };
}): { relevanceRecall: RatioMetric; irrelevantExpansion: RatioMetric; planningSurpriseRate: RatioMetric; analyzerFailureRate: RatioMetric; caveats: string[] } {
  const retrieved = new Set(input.relevance.retrievedIds); const relevant = input.relevance.relevantIds === undefined ? undefined : new Set(input.relevance.relevantIds);
  const relevanceRecall = relevant === undefined ? ratio(undefined, undefined, "relevance ground truth unavailable") : ratio([...relevant].filter((id) => retrieved.has(id)).length, relevant.size, "supported recall within declared relevance ground truth");
  const irrelevantExpansion = relevant === undefined ? ratio(undefined, undefined, "relevance ground truth unavailable") : ratio([...retrieved].filter((id) => !relevant.has(id)).length, retrieved.size, "retrieved entities outside declared relevant set");
  const observed = input.planning.observedIds === undefined ? undefined : new Set(input.planning.observedIds); const predicted = new Set(input.planning.predictedIds);
  const planningSurpriseRate = observed === undefined ? ratio(undefined, undefined, "observed implementation impact unavailable") : ratio([...observed].filter((id) => !predicted.has(id)).length, observed.size, `surprise dispositions: ${[...new Set(input.planning.surpriseDispositions)].sort().join(", ") || "none"}`);
  const analyzerFailureRate = ratio(input.analyzers.failureCount, input.analyzers.observationCount, "analyzer failures per authenticated observation attempt");
  return { relevanceRecall, irrelevantExpansion, planningSurpriseRate, analyzerFailureRate, caveats: [relevanceRecall, irrelevantExpansion, planningSurpriseRate, analyzerFailureRate].filter(({ availability }) => availability === "unavailable").map(({ caveat }) => caveat) };
}
