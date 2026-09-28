import { z } from "zod";

export const ObservationLimitsSchema = z.object({
  maxFiles: z.number().int().positive().safe().nullable(),
  maxDirectories: z.number().int().positive().safe().nullable(),
  maxFileBytes: z.number().int().positive().safe().nullable(),
  maxTotalBytes: z.number().int().positive().safe().nullable(),
  maxGitOutputBytes: z.number().int().positive().safe().nullable(),
  timeoutMs: z.number().int().positive().safe().nullable(),
  maxWorkerHeapMiB: z.number().int().positive().safe().nullable(),
  maxDerivedBytes: z.number().int().positive().safe().nullable(),
}).strict();
export const ObservationLimitsOverrideSchema = ObservationLimitsSchema.partial();
export type ObservationLimits = z.infer<typeof ObservationLimitsSchema>;
export const DEFAULT_OBSERVATION_LIMITS: Readonly<ObservationLimits> = Object.freeze({
  maxFiles: null, maxDirectories: null, maxFileBytes: null,
  maxTotalBytes: null, maxGitOutputBytes: null, timeoutMs: null,
  maxWorkerHeapMiB: null, maxDerivedBytes: null,
});
/** Convert a serialized optional constraint for arithmetic only. Never persist Infinity. */
export function observationLimitValue(limit: number | null): number { return limit ?? Infinity; }
export function resolveObservationLimits(overrides: Partial<ObservationLimits> = {}): ObservationLimits {
  const parsed = ObservationLimitsOverrideSchema.safeParse(overrides);
  if (!parsed.success) throw new ObservationError("observation-failed", "limits", ".", `Invalid observation limits: ${parsed.error.message}`);
  return ObservationLimitsSchema.parse({ ...DEFAULT_OBSERVATION_LIMITS, ...parsed.data });
}
export const ObservationDescriptorSchema = z.object({
  schemaVersion: z.literal("projector.observation/v1"),
  observerVersion: z.string(), scope: z.literal("."),
  enumerationMethod: z.enum(["git-index-and-nonignored-untracked", "recursive-filesystem-fallback", "git-immutable-tree"]),
  limits: ObservationLimitsSchema,
  ignoreSources: z.array(z.object({ path: z.string(), contentHash: z.string() }).strict()),
  excludedPaths: z.array(z.string()), globalGitConfig: z.literal("disabled"),
}).strict();
export type ObservationDescriptor = z.infer<typeof ObservationDescriptorSchema>;

export class ObservationError extends Error {
  constructor(
    readonly code: "observation-limit-exceeded" | "observation-failed",
    readonly stage: string,
    readonly scope: string,
    message: string,
    readonly limit?: keyof ObservationLimits,
    readonly observed?: number,
  ) { super(message); this.name = "ObservationError"; }
}

/** One numerical budget spans collection and all secondary observations. */
export class ObservationBudget {
  readonly limits: ObservationLimits;
  readonly deadline: number;
  private readonly counts = { maxFiles: 0, maxDirectories: 0, maxTotalBytes: 0, maxGitOutputBytes: 0 };
  constructor(overrides: Partial<ObservationLimits> = {}, startedAt = Date.now()) {
    this.limits = resolveObservationLimits(overrides);
    this.deadline = this.limits.timeoutMs === null ? Infinity : startedAt + this.limits.timeoutMs;
  }
  remainingMs(): number { return Math.max(0, this.deadline - Date.now()); }
  remaining(limit: keyof ObservationBudget["counts"]): number { return observationLimitValue(this.limits[limit]) - this.counts[limit]; }
  check(stage: string, scope = "."): void {
    if (this.limits.timeoutMs !== null && this.remainingMs() === 0) throw new ObservationError("observation-limit-exceeded", stage, scope,
      "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs", this.limits.timeoutMs);
  }
  consume(limit: keyof ObservationBudget["counts"], amount: number, stage: string, scope = "."): void {
    this.check(stage, scope);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new ObservationError("observation-failed", stage, scope, "Observation accounting requires a nonnegative safe integer.");
    const observed = this.counts[limit] + amount;
    if (observed > observationLimitValue(this.limits[limit])) throw new ObservationError("observation-limit-exceeded", stage, scope,
      `Repository observation exceeds ${limit} (${this.limits[limit]}); explicitly increase this limit to retry.`, limit, observed);
    this.counts[limit] = observed;
  }
  assertFileBytes(bytes: number, scope: string): void {
    this.check("file-read", scope);
    if (bytes > observationLimitValue(this.limits.maxFileBytes)) throw new ObservationError("observation-limit-exceeded", "file-read", scope,
      `File exceeds maxFileBytes (${this.limits.maxFileBytes}); explicitly increase this limit to retry.`, "maxFileBytes", bytes);
  }
  assertTotalBytes(bytes: number, scope: string): void {
    this.check("file-read", scope);
    if (bytes > this.remaining("maxTotalBytes")) throw new ObservationError("observation-limit-exceeded", "file-read", scope,
      `Repository observation exceeds maxTotalBytes (${this.limits.maxTotalBytes}); explicitly increase this limit to retry.`, "maxTotalBytes", this.counts.maxTotalBytes + bytes);
  }
}

/** Conservative allocation accounting for one pure analysis task, separate from heap enforcement. */
export class DerivedObservationBudget {
  private consumed = 0;
  constructor(readonly maxDerivedBytes: number | null = DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes) {
    if (maxDerivedBytes !== null && (!Number.isSafeInteger(maxDerivedBytes) || maxDerivedBytes <= 0)) throw new ObservationError("observation-failed", "derived-limits", ".", "maxDerivedBytes must be a positive safe integer or null.");
  }
  get usedBytes(): number { return this.consumed; }
  release(bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.consumed) throw new ObservationError("observation-failed", "derived-release", ".", "Cannot release unreserved derived allocation bytes.");
    this.consumed -= bytes;
  }
  reserve(bytes: number, stage: string, scope = "."): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new ObservationError("observation-failed", stage, scope, "Derived allocation accounting requires a nonnegative safe integer.");
    const observed = this.consumed + bytes;
    if (observed > observationLimitValue(this.maxDerivedBytes)) throw new ObservationError("observation-limit-exceeded", stage, scope,
      `Derived observation exceeds maxDerivedBytes (${this.maxDerivedBytes}); explicitly increase this limit to retry.`, "maxDerivedBytes", observed);
    this.consumed = observed;
  }
  reserveString(length: number, stage: string, scope = "."): void { this.reserve(24 + 2 * length, stage, scope); }
  reserveItems(count: number, itemBytes: number, stage: string, scope = "."): void { this.reserve(count * itemBytes, stage, scope); }
}
