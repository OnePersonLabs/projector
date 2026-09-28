import { createHash } from "node:crypto";
import {
  DEFAULT_OBSERVATION_LIMITS,
  observationLimitValue,
  hashFramedDomain,
  hashFramedCanonicalJsonChunks,
  type CodeEdge,
  type CodeInputBinding,
  type CodeLocation,
  type CodePartition,
  type CodeSnapshot,
  type CodeSymbol,
} from "@projector/core";
import { scala } from "./semanticdb/generated/semanticdb.js";
import { boundedProtobufFrames } from "./protobuf-framing.js";
import { codeInputHash } from "./input-binding.js";

const db = scala.meta.internal.semanticdb;
const provider = "projector.semanticdb";
export interface SemanticDbSourceInput {
  readonly path: string;
  readonly content: string;
  readonly contentHash?: string;
}
export interface SemanticDbImportOptions {
  readonly inputs: readonly SemanticDbSourceInput[];
  readonly binding: Omit<
    CodeInputBinding,
    "sourceInputs" | "configInputs" | "resolutionInputs" | "status"
  >;
  readonly artifact: string;
  readonly sourceHashes?: Readonly<Record<string, string>>;
  readonly maxArtifactBytes?: number | null;
  readonly maxFrameBytes?: number | null;
  readonly emitPartition?: (partition: CodePartition) => void;
  readonly getPartition?: (path: string) => CodePartition | undefined;
}

function location(
  path: string,
  content: string,
  value: scala.meta.internal.semanticdb.IRange | null | undefined,
): CodeLocation | undefined {
  if (value === null || value === undefined) return undefined;
  const lines = content.split("\n");
  const startLine = value.startLine ?? 0,
    startCharacter = value.startCharacter ?? 0,
    endLine = value.endLine ?? 0,
    endCharacter = value.endCharacter ?? 0;
  const offset = (line: number, column: number): number | undefined =>
    line >= 0 &&
    line < lines.length &&
    column >= 0 &&
    column <= lines[line]!.length
      ? lines.slice(0, line).reduce((sum, text) => sum + text.length + 1, 0) +
        column
      : undefined;
  const start = offset(startLine, startCharacter),
    end = offset(endLine, endCharacter);
  if (start === undefined || end === undefined || end < start) return undefined;
  return { path, start, end, line: startLine + 1, column: startCharacter + 1 };
}
function symbolId(symbol: string, path: string): string {
  return hashFramedDomain("projector-semanticdb-symbol-v1", {
    symbol,
    ...(symbol.startsWith("local") ? { path } : {}),
  });
}

/** Decode Scalameta's pinned SemanticDB v4.17.4 schema, one bounded TextDocument at a time. */
export async function importSemanticDb(
  source: Uint8Array | AsyncIterable<Uint8Array>,
  options: SemanticDbImportOptions,
): Promise<CodeSnapshot> {
  const digest = createHash("sha256"),
    inputs = new Map(options.inputs.map((input) => [input.path, input]));
  const partitions: CodePartition[] = [],
    paths = new Set<string>();
  let allVerified = true;
  for await (const frame of boundedProtobufFrames(
    source,
    digest,
    observationLimitValue(options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes),
    observationLimitValue(options.maxFrameBytes ?? options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes),
  )) {
    if (frame.field !== 1) continue;
    const document = db.TextDocument.decode(frame.value);
    if (document.schema !== db.Schema.SEMANTICDB4)
      throw new Error("SemanticDB document is not schema v4");
    let path: string;
    try {
      path = decodeURIComponent(document.uri).replaceAll("\\", "/");
    } catch {
      throw new Error("SemanticDB document URI is invalid");
    }
    if (
      !path ||
      path.startsWith("/") ||
      /^[A-Za-z]:/u.test(path) ||
      path.includes("\0") ||
      path
        .split("/")
        .some((part) => part === ".." || part === "." || part === "") ||
      paths.has(path)
    )
      throw new Error(`Unsafe or duplicate SemanticDB document URI: ${path}`);
    paths.add(path);
    const input = inputs.get(path),
      text = input?.content ?? document.text,
      hasText = input !== undefined || document.text !== "";
    if (
      input !== undefined &&
      document.text !== "" &&
      document.text !== input.content
    )
      throw new Error(
        `SemanticDB embedded text differs from observed source: ${path}`,
      );
    const inputHash = hasText ? codeInputHash(text) : "missing-source";
    const md5 = document.md5 || "";
    if (
      md5 &&
      hasText &&
      createHash("md5").update(text).digest("hex") !== md5.toLowerCase()
    )
      throw new Error(
        `SemanticDB source MD5 differs from observed input: ${path}`,
      );
    const provenance = {
      provider,
      version: "scalameta-semanticdb/4.17.4",
      inputHash,
      artifact: options.artifact,
    };
    const infos = new Map(document.symbols.map((info) => [info.symbol, info]));
    const symbols: CodeSymbol[] = [],
      edges: CodeEdge[] = [];
    let invalidRanges = 0;
    if (hasText)
      for (const occurrence of document.occurrences) {
        const at = location(path, text, occurrence.range);
        if (at === undefined) {
          invalidRanges++;
          continue;
        }
        if (!occurrence.symbol) continue;
        const id = symbolId(occurrence.symbol, path),
          info = infos.get(occurrence.symbol);
        if (occurrence.role === db.SymbolOccurrence.Role.DEFINITION) {
          symbols.push({
            id,
            name: info?.displayName || occurrence.symbol,
            kind:
              info === undefined
                ? "symbol"
                : (db.SymbolInformation.Kind[info.kind ?? 0] ?? "symbol"),
            definition: at,
            extent: at,
            declarationHash: hashFramedDomain(
              "projector-semanticdb-declaration-v1",
              {
                symbol: occurrence.symbol,
                signature: JSON.stringify(info?.signature ?? null),
                text: text.slice(at.start, at.end),
              },
            ),
            provenance,
          });
          for (const overridden of info?.overriddenSymbols ?? [])
            edges.push({
              id: hashFramedDomain("projector-semanticdb-override-v1", {
                path,
                at: at.start,
                overridden,
              }),
              kind: "implementation",
              source: at,
              sourceSymbolId: id,
              targetSymbolId: symbolId(overridden, path),
              resolution: "resolved",
              provenance,
            });
        } else if (occurrence.role === db.SymbolOccurrence.Role.REFERENCE) {
          edges.push({
            id: hashFramedDomain("projector-semanticdb-reference-v1", {
              path,
              at: at.start,
              symbol: occurrence.symbol,
            }),
            kind: "reference",
            source: at,
            targetSymbolId: id,
            resolution: "resolved",
            provenance,
          });
        }
      }
    const capabilities = (
      [
        "definition",
        "reference",
        "import",
        "call",
        "type",
        "implementation",
      ] as const
    ).map((kind) => ({
      kind,
      fidelity: "index" as const,
      status: !hasText
        ? ("unavailable" as const)
        : kind === "definition" || kind === "reference"
          ? invalidRanges
            ? ("partial" as const)
            : ("available" as const)
          : kind === "implementation"
            ? ("partial" as const)
            : ("unavailable" as const),
      ...(kind === "call"
        ? { reason: "SemanticDB occurrences do not establish runtime calls" }
        : {}),
    }));
    const partition: CodePartition = {
      path,
      inputHash,
      symbols,
      edges,
      coverage: {
        path,
        status: !hasText ? "unavailable" : "partial",
        reason: !hasText
          ? "Source bytes unavailable for SemanticDB ranges"
          : invalidRanges
            ? "Some SemanticDB positions cannot be mapped to source"
            : "SemanticDB exposes references and overrides, but not resolved calls/imports",
        capabilities,
      },
    };
    allVerified &&= input !== undefined && options.sourceHashes?.[path] === inputHash && inputHash !== "missing-source";
    if (options.emitPartition === undefined) partitions.push(partition);
    else options.emitPartition(partition);
  }
  const artifactHash = `sha256:${digest.digest("hex")}`;
  const sourceInputs = [...inputs.values()]
    .map((input) => ({
      path: input.path,
      contentHash: codeInputHash(input.content),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const verified =
    paths.size > 0 &&
    options.sourceHashes !== undefined &&
    allVerified;
  const binding: CodeInputBinding = {
    ...options.binding,
    status: verified ? "verified" : "unbound",
    sourceInputs,
    configInputs: [],
    resolutionInputs: [],
  };
  return {
    schemaVersion: "projector.code-intelligence/v1",
    provider,
    providerVersion: "scalameta-semanticdb/4.17.4",
    inputFingerprint: hashFramedDomain("projector-semanticdb-input-v1", {
      artifactHash,
      sourceInputs,
    }),
    configFingerprint: hashFramedDomain(
      "projector-semanticdb-schema-v1",
      "4.17.4",
    ),
    resolutionFingerprint: options.emitPartition === undefined
      ? hashFramedDomain("projector-semanticdb-relations-v1", partitions.map((partition) => partition.edges.map((edge) => edge.id)))
      : hashFramedCanonicalJsonChunks("projector-semanticdb-relations-v1", function* () {
          yield "[";
          let first = true;
          for (const path of paths) {
            if (!first) yield ",";
            first = false;
            const partition = options.getPartition?.(path);
            if (partition === undefined) throw new Error(`Staged SemanticDB document missing: ${path}`);
            yield JSON.stringify(partition.edges.map((edge) => edge.id));
          }
          yield "]";
        }),
    binding,
    partitions,
  };
}
