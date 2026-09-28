import { z } from "zod";
import {
  CodeCoverageSchema,
  CodeEdgeSchema,
  CodeQueryResultSchema,
  CodeSymbolSchema,
} from "./code-intelligence.js";

export const CodeRepositoryPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !path.includes("\\") &&
      !path.startsWith("/") &&
      !/^[A-Za-z]:/u.test(path) &&
      !path.includes("\0") &&
      path
        .split("/")
        .every((part) => part !== "" && part !== "." && part !== ".."),
    "Expected a canonical repository-relative path",
  );
const generation = z.string().min(1).max(256);
const inputHashes = z.record(
  CodeRepositoryPathSchema,
  z.string().min(1).max(256),
);
export const CodeProducerSchema = z.strictObject({
  executable: z.string().min(1).max(4096),
  args: z.array(z.string().max(8192)).max(256),
  cwd: CodeRepositoryPathSchema.optional(),
  artifact: CodeRepositoryPathSchema,
  format: z.enum(["scip", "semanticdb"]),
  environment: z
    .record(z.string().min(1).max(256), z.string().max(8192))
    .optional(),
});
export type CodeProducer = z.infer<typeof CodeProducerSchema>;

export const CodeIndexRequestSchema = z
  .strictObject({
    provider: z
      .enum(["native", "syntax", "scip", "semanticdb", "external"])
      .default("native"),
    project: CodeRepositoryPathSchema.optional(),
    buildVariant: z.string().min(1).max(512).default("default"),
    artifact: CodeRepositoryPathSchema.optional(),
    sourceHashes: inputHashes.optional(),
    producer: CodeProducerSchema.optional(),
    timeoutMs: z.number().int().min(1000).safe().nullable().default(null),
  })
  .superRefine((request, ctx) => {
    if (
      ["scip", "semanticdb"].includes(request.provider) &&
      request.artifact === undefined
    )
      ctx.addIssue({
        code: "custom",
        message: "An artifact is required for imported semantic evidence",
      });
    if (request.provider === "external" && request.producer === undefined)
      ctx.addIssue({
        code: "custom",
        message: "An explicit producer command is required",
      });
    if (request.provider !== "external" && request.producer !== undefined)
      ctx.addIssue({
        code: "custom",
        message: "Only external indexing accepts a producer command",
      });
  });
export type CodeIndexRequest = z.input<typeof CodeIndexRequestSchema>;

export const CodeQueryRequestSchema = z
  .strictObject({
    kind: z.enum([
      "symbols",
      "definition",
      "references",
      "callers",
      "callees",
      "implementations",
      "types",
      "imports",
      "neighborhood",
    ]),
    symbolId: z.string().min(1).max(2048).optional(),
    path: CodeRepositoryPathSchema.optional(),
    name: z.string().min(1).max(512).optional(),
    offset: z.number().int().nonnegative().optional(),
    generation: generation.optional(),
    freshness: z.enum(["current", "pinned"]).default("current"),
    project: CodeRepositoryPathSchema.optional(),
    limit: z.number().int().min(1).max(1000).default(100),
    cursor: z.string().max(16384).optional(),
  })
  .superRefine((request, ctx) => {
    if (
      request.symbolId === undefined &&
      request.path === undefined &&
      request.name === undefined
    )
      ctx.addIssue({
        code: "custom",
        message: "Select a symbol, path, or name",
      });
    if (request.freshness === "pinned" && request.generation === undefined)
      ctx.addIssue({
        code: "custom",
        message: "Pinned queries require a generation",
      });
    if (request.offset !== undefined && request.path === undefined)
      ctx.addIssue({
        code: "custom",
        message: "An offset requires a source path",
      });
  });
export type CodeQueryRequest = z.input<typeof CodeQueryRequestSchema>;
export const CodeQueryEvidenceSchema = z.strictObject({
  query: CodeQueryResultSchema,
  freshness: z.enum(["current", "historical", "unbound"]),
  dependencyKeys: z.array(z.string()),
  resultHash: z.string(),
  unknowns: z.array(z.string()),
});
export type CodeQueryEvidence = z.infer<typeof CodeQueryEvidenceSchema>;

export const CodeIndexRunSchema = z.strictObject({
  id: z.string().min(1),
  repositoryRoot: z.string().min(1),
  provider: z.string().min(1),
  state: z.enum(["running", "published", "failed", "cancelled", "interrupted"]),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  generation: generation.optional(),
  ownerPid: z.number().int().positive(),
  error: z.string().optional(),
});
export type CodeIndexRun = z.infer<typeof CodeIndexRunSchema>;
export const CodeIndexStatusRequestSchema = z.strictObject({
  runId: z.string().min(1).max(256).optional(),
});
export const CodeIndexWaitRequestSchema = z.strictObject({
  runId: z.string().min(1).max(256),
  timeoutMs: z.number().int().min(0).max(30_000).default(20_000),
});
export const CodeIndexCancelRequestSchema = z.strictObject({
  runId: z.string().min(1).max(256),
});
export const CodeIndexStatusSchema = z.strictObject({
  head: generation.nullable(),
  runs: z.array(CodeIndexRunSchema),
  runsTruncated: z.boolean(),
  providers: z.array(
    z.strictObject({
      id: z.string(),
      languages: z.array(z.string()),
      status: z.enum(["available", "configured", "requires-toolchain"]),
      detail: z.string(),
    }),
  ),
});

export const CodeImpactRequestSchema = z.strictObject({
  before: generation,
  after: generation.optional(),
  paths: z.array(CodeRepositoryPathSchema).max(1000).optional(),
  maxNodes: z.number().int().min(1).max(10000).default(2000),
});
export const CodeImpactResultSchema = z.strictObject({
  before: generation,
  after: generation,
  changedSymbols: z.array(z.string()),
  affectedSymbols: z.array(z.string()),
  affectedPaths: z.array(z.string()),
  possiblePaths: z.array(z.string()),
  unknowns: z.array(z.string()),
  truncated: z.boolean(),
});
export type CodeImpactResult = z.infer<typeof CodeImpactResultSchema>;

export const CodeRuntimeEvidenceSchema = z.strictObject({
  id: z.string().min(1),
  generation,
  sourceHashes: inputHashes,
  testId: z.string().min(1),
  runId: z.string().min(1),
  runner: z.string().min(1),
  buildId: z.string().min(1),
  workload: z.string().min(1),
  attribution: z.enum(["per-test", "isolated_replay", "aggregate"]),
  outcome: z.enum(["passed", "failed", "unknown"]),
  durationMs: z.number().nonnegative().optional(),
  ranges: z
    .array(
      z.strictObject({
        path: CodeRepositoryPathSchema,
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
      }),
    ),
});
export type CodeRuntimeEvidence = z.infer<typeof CodeRuntimeEvidenceSchema>;
export const CodeBridgeSchema = z.strictObject({
  id: z.string().min(1),
  protocol: z.string().min(1),
  identity: z.string().min(1),
  fromSymbolId: z.string().min(1),
  toSymbolId: z.string().min(1),
  sourcePaths: z.array(CodeRepositoryPathSchema).min(1),
  explanation: z.string().min(1),
});
export const CodeEvidenceRequestSchema = z.strictObject({
  format: z.enum(["projector", "coverage-py", "istanbul", "v8", "bridges"]),
  artifact: CodeRepositoryPathSchema.optional(),
  evidence: CodeRuntimeEvidenceSchema.optional(),
  bridges: z.array(CodeBridgeSchema).optional(),
  generation: generation.optional(),
  sourceHashes: inputHashes.optional(),
});
export const CodeEvidenceResultSchema = z.strictObject({
  accepted: z.array(z.string()),
  unknowns: z.array(z.string()),
});
export const CodeTestsRequestSchema = z.strictObject({
  generation: generation.optional(),
  paths: z.array(CodeRepositoryPathSchema).min(1).max(1000),
  limit: z.number().int().min(1).max(1000).default(100),
  cursor: z.string().min(1).max(4096).optional(),
});
export const CodeTestsResultSchema = z.strictObject({
  generation,
  recommendations: z.array(
    z.strictObject({
      testId: z.string(),
      reasons: z.array(z.string()),
      evidenceIds: z.array(z.string()),
      observed: z.boolean(),
      durationMs: z.number().nonnegative().optional(),
    }),
  ),
  unknowns: z.array(z.string()),
  complete: z.boolean(),
  nextCursor: z.string().optional(),
  pageSemantics: z.literal("merge-recommendations-by-test-id"),
  requiredVerificationUnaffected: z.literal(true),
});
/** An explicitly requested, isolated Vitest replay of one fully named test. */
export const CodeTestRunRequestSchema = z.strictObject({
  testFile: CodeRepositoryPathSchema,
  testName: z.string().min(1).max(2048),
  command: z
    .strictObject({
      executable: z.string().min(1).max(4096),
      args: z.array(z.string().max(8192)).max(256).default([]),
      environment: z
        .record(z.string().min(1).max(256), z.string().max(8192))
        .optional(),
    })
    .optional(),
  timeoutMs: z.number().int().min(1000).safe().nullable().default(null),
});
export const CodeTestRunResultSchema = z.strictObject({
  runId: z.string().min(1),
  generation: generation,
  testId: z.string().min(1),
  outcome: z.enum(["passed", "failed"]),
  durationMs: z.number().nonnegative(),
  evidenceIds: z.array(z.string()),
  sourceHashes: inputHashes,
  buildId: z.string().min(1),
  workload: z.string().min(1),
  command: z.strictObject({
    executable: z.string(),
    args: z.array(z.string()),
  }),
  unknowns: z.array(z.string()),
  requiredVerificationUnaffected: z.literal(true),
});
export const CodeExportRequestSchema = z.strictObject({
  generation: generation.optional(),
  format: z.enum(["jsonl", "graphml", "nodes-csv", "edges-csv"]),
  artifactName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u).optional(),
  maxBytes: z
    .number()
    .int()
    .min(1024)
    .max(16 * 1024 * 1024)
    .default(1024 * 1024),
});
export const CodeExportResultSchema = z.strictObject({
  generation,
  format: z.string(),
  content: z.string().optional(),
  artifact: z.strictObject({ path: z.string().min(1), bytes: z.number().int().nonnegative(), sha256: z.string().min(1) }).optional(),
  mediaType: z.string(),
  symbols: z.number().int().nonnegative(),
  edges: z.number().int().nonnegative(),
});

export const CodeContextSummarySchema = z.strictObject({
  generation,
  worktreeDigest: z.string(),
  symbols: z.array(CodeSymbolSchema),
  edges: z.array(CodeEdgeSchema),
  relatedPaths: z.array(z.string()),
  coverage: z.array(CodeCoverageSchema),
  unknowns: z.array(z.string()),
});
export type CodeContextSummary = z.infer<typeof CodeContextSummarySchema>;
