import { z } from "zod";

/** Derived code navigation is evidence about source, never authored project meaning. */
export const CodeLocationSchema = z
  .object({
    path: z.string().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    line: z.number().int().positive(),
    column: z.number().int().positive(),
  })
  .strict()
  .refine((value) => value.end >= value.start);
export type CodeLocation = z.infer<typeof CodeLocationSchema>;

export const CodeProvenanceSchema = z
  .object({
    provider: z.string().min(1),
    version: z.string().min(1),
    inputHash: z.string().min(1),
    artifact: z.string().optional(),
  })
  .strict();
export type CodeProvenance = z.infer<typeof CodeProvenanceSchema>;

export const CodeSymbolSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    kind: z.string().min(1),
    definition: CodeLocationSchema,
    extent: CodeLocationSchema,
    typeDisplay: z.string().optional(),
    declarationHash: z.string().min(1),
    bodyHash: z.string().optional(),
    provenance: CodeProvenanceSchema,
  })
  .strict();
export type CodeSymbol = z.infer<typeof CodeSymbolSchema>;

export const CodeEdgeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
      "reference",
      "import",
      "call",
      "type",
      "implementation",
      "bridge",
    ]),
    source: CodeLocationSchema,
    sourceSymbolId: z.string().optional(),
    targetSymbolId: z.string().optional(),
    targetPath: z.string().optional(),
    resolution: z.enum(["resolved", "unresolved", "unknown"]),
    provenance: CodeProvenanceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.resolution === "resolved" &&
      value.targetSymbolId === undefined &&
      value.targetPath === undefined
    )
      context.addIssue({
        code: "custom",
        message: "resolved edge needs a target",
      });
    if (
      value.resolution !== "resolved" &&
      (value.targetSymbolId !== undefined || value.targetPath !== undefined)
    )
      context.addIssue({
        code: "custom",
        message: "unresolved edge cannot claim a target",
      });
  });
export type CodeEdge = z.infer<typeof CodeEdgeSchema>;

export const CodeCapabilitySchema = z
  .object({
    kind: z.enum([
      "definition",
      "reference",
      "import",
      "call",
      "type",
      "implementation",
    ]),
    fidelity: z.enum(["semantic", "index", "syntax"]),
    status: z.enum(["available", "partial", "unavailable"]),
    reason: z.string().optional(),
  })
  .strict();
export type CodeCapability = z.infer<typeof CodeCapabilitySchema>;
export const CodeCoverageSchema = z
  .object({
    path: z.string().min(1),
    status: z.enum(["complete", "partial", "unavailable"]),
    reason: z.string().optional(),
    capabilities: z.array(CodeCapabilitySchema),
  })
  .strict();
export type CodeCoverage = z.infer<typeof CodeCoverageSchema>;

export const CodePartitionSchema = z
  .object({
    path: z.string().min(1),
    inputHash: z.string().min(1),
    symbols: z.array(CodeSymbolSchema),
    edges: z.array(CodeEdgeSchema),
    coverage: CodeCoverageSchema,
  })
  .strict();
export type CodePartition = z.infer<typeof CodePartitionSchema>;
export const CodeInputBindingSchema = z
  .object({
    status: z.enum(["verified", "unbound"]),
    checkoutId: z.string().min(1),
    worktreeDigest: z.string().min(1),
    projectKey: z.string().min(1),
    sourceInputs: z.array(
      z
        .object({ path: z.string().min(1), contentHash: z.string().min(1) })
        .strict(),
    ),
    configInputs: z.array(
      z
        .object({ path: z.string().min(1), contentHash: z.string().min(1) })
        .strict(),
    ),
    resolutionInputs: z.array(
      z
        .object({ path: z.string().min(1), contentHash: z.string().min(1) })
        .strict(),
    ),
    resolutionProbes: z
      .array(
        z.object({ path: z.string().min(1), exists: z.boolean() }).strict(),
      )
      .optional(),
    directoryProbes: z
      .array(
        z.object({ path: z.string().min(1), exists: z.boolean() }).strict(),
      )
      .optional(),
    directoryListings: z
      .array(
        z
          .object({
            path: z.string().min(1),
            directories: z.array(z.string().min(1)),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export type CodeInputBinding = z.infer<typeof CodeInputBindingSchema>;
export const CodeSnapshotSchema = z
  .object({
    schemaVersion: z.literal("projector.code-intelligence/v1"),
    provider: z.string().min(1),
    providerVersion: z.string().min(1),
    inputFingerprint: z.string().min(1),
    configFingerprint: z.string().min(1),
    resolutionFingerprint: z.string().min(1),
    binding: CodeInputBindingSchema,
    partitions: z.array(CodePartitionSchema),
  })
  .strict();
export type CodeSnapshot = z.infer<typeof CodeSnapshotSchema>;

export const CodeQuerySchema = z
  .object({
    schemaVersion: z.literal("projector.code-query/v1"),
    generation: z.string().min(1),
    kind: z.enum([
      "definition",
      "reference",
      "import",
      "call",
      "type",
      "implementation",
      "symbol",
    ]),
    direction: z.enum(["incoming", "outgoing"]).default("incoming"),
    symbolId: z.string().optional(),
    path: z.string().optional(),
    limit: z.number().int().min(1).max(1000).default(100),
    cursor: z.string().optional(),
  })
  .strict()
  .refine(
    (value) => value.symbolId !== undefined || value.path !== undefined,
    "symbolId or path required",
  );
export type CodeQuery = z.input<typeof CodeQuerySchema>;
export const CodeQueryResultSchema = z
  .object({
    schemaVersion: z.literal("projector.code-query-result/v1"),
    generation: z.string().min(1),
    symbols: z.array(CodeSymbolSchema),
    edges: z.array(CodeEdgeSchema),
    coverage: z.array(CodeCoverageSchema),
    nextCursor: z.string().optional(),
  })
  .strict();
export type CodeQueryResult = z.infer<typeof CodeQueryResultSchema>;
export const CodeNeighborhoodSchema = z
  .object({
    generation: z.string().min(1),
    path: z.string().min(1),
    symbols: z.array(CodeSymbolSchema),
    incoming: z.array(CodeEdgeSchema),
    outgoing: z.array(CodeEdgeSchema),
    coverage: CodeCoverageSchema.optional(),
    relatedPaths: z.array(z.string()),
    truncated: z.boolean(),
  })
  .strict();
export type CodeNeighborhood = z.infer<typeof CodeNeighborhoodSchema>;
