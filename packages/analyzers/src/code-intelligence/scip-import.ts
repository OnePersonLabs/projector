import { fromBinary } from "@bufbuild/protobuf";
import { createHash } from "node:crypto";
import {
  DocumentSchema,
  MetadataSchema,
  PositionEncoding,
  SymbolInformation_Kind,
  SymbolRole,
  type Document,
  type Occurrence,
} from "@scip-code/scip";
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
import { codeInputHash } from "./input-binding.js";
import { boundedProtobufFrames } from "./protobuf-framing.js";

const provider = "projector.scip";
export interface ScipSourceInput {
  readonly path: string;
  readonly content: string;
  readonly contentHash?: string;
}
export interface ScipImportOptions {
  readonly inputs: readonly ScipSourceInput[];
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

function range(
  occurrence: Occurrence,
  enclosing = false,
): [number, number, number, number] | undefined {
  const typed = enclosing
    ? occurrence.typedEnclosingRange
    : occurrence.typedRange;
  if (
    typed.case === "singleLineRange" ||
    typed.case === "singleLineEnclosingRange"
  )
    return [
      typed.value.line,
      typed.value.startCharacter,
      typed.value.line,
      typed.value.endCharacter,
    ];
  if (
    typed.case === "multiLineRange" ||
    typed.case === "multiLineEnclosingRange"
  )
    return [
      typed.value.startLine,
      typed.value.startCharacter,
      typed.value.endLine,
      typed.value.endCharacter,
    ];
  const old = enclosing ? occurrence.enclosingRange : occurrence.range;
  if (old.length === 3) return [old[0]!, old[1]!, old[0]!, old[2]!];
  if (old.length === 4) return [old[0]!, old[1]!, old[2]!, old[3]!];
  return undefined;
}
function sourceLocation(
  path: string,
  content: string,
  encoding: PositionEncoding,
  sourceRange: [number, number, number, number],
): CodeLocation | undefined {
  if (encoding === PositionEncoding.UnspecifiedPositionEncoding)
    return undefined;
  const [startLine, startColumn, endLine, endColumn] = sourceRange;
  const lines = content.split("\n");
  const locate = (line: number, column: number): number | undefined => {
    if (line < 0 || line >= lines.length || column < 0) return undefined;
    const prefix = lines
        .slice(0, line)
        .reduce((size, value) => size + value.length + 1, 0),
      text = lines[line]!;
    if (encoding === PositionEncoding.UTF16CodeUnitOffsetFromLineStart)
      return column <= text.length ? prefix + column : undefined;
    let units = 0,
      index = 0;
    for (const character of text) {
      if (units === column) return prefix + index;
      units +=
        encoding === PositionEncoding.UTF8CodeUnitOffsetFromLineStart
          ? Buffer.byteLength(character)
          : 1;
      index += character.length;
    }
    return units === column ? prefix + index : undefined;
  };
  const start = locate(startLine, startColumn),
    end = locate(endLine, endColumn);
  if (start === undefined || end === undefined || end < start) return undefined;
  return { path, start, end, line: startLine + 1, column: startColumn + 1 };
}
function symbolId(symbol: string, path: string): string {
  return hashFramedDomain("projector-scip-symbol-v1", {
    symbol,
    ...(symbol.startsWith("local ") ? { path } : {}),
  });
}

/** Decode official SCIP messages a bounded top-level protobuf frame at a time. */
export async function importScip(
  source: Uint8Array | AsyncIterable<Uint8Array>,
  options: ScipImportOptions,
): Promise<CodeSnapshot> {
  const artifactDigest = createHash("sha256");
  const inputs = new Map(options.inputs.map((input) => [input.path, input]));
  const partitions: CodePartition[] = [];
  let metadataSeen = false,
    toolVersion = "unknown";
  let allVerified = true;
  const documentPaths = new Set<string>();
  for await (const frame of boundedProtobufFrames(
    source,
    artifactDigest,
    observationLimitValue(options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes),
    observationLimitValue(options.maxFrameBytes ?? options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes),
  )) {
    if (frame.field === 1) {
      if (metadataSeen || documentPaths.size > 0)
        throw new Error(
          "SCIP metadata must occur exactly once before documents",
        );
      metadataSeen = true;
      const metadata = fromBinary(MetadataSchema, frame.value);
      toolVersion = `${metadata.toolInfo?.name ?? "unknown"}/${metadata.toolInfo?.version ?? "unknown"}`;
      continue;
    }
    if (frame.field !== 2) continue;
    if (!metadataSeen)
      throw new Error("SCIP document appeared before metadata");
    const document: Document = fromBinary(DocumentSchema, frame.value),
      path = document.relativePath.replaceAll("\\", "/");
    if (
      !path ||
      path.startsWith("/") ||
      /^[A-Za-z]:/u.test(path) ||
      path.includes("\0") ||
      path
        .split("/")
        .some((part) => part === ".." || part === "." || part === "") ||
      documentPaths.has(path)
    )
      throw new Error(`Unsafe or duplicate SCIP document path: ${path}`);
    documentPaths.add(path);
    const input = inputs.get(path),
      content = input?.content ?? document.text,
      hasContent = input !== undefined || document.text !== "";
    if (
      input !== undefined &&
      document.text !== "" &&
      document.text !== input.content
    )
      throw new Error(
        `SCIP embedded source differs from observed input: ${path}`,
      );
    const sourceHash = hasContent ? codeInputHash(content) : "missing-source";
    const provenance = {
      provider,
      version: toolVersion,
      inputHash: sourceHash,
      artifact: options.artifact,
    };
    const symbols: CodeSymbol[] = [],
      edges: CodeEdge[] = [];
    let invalidRanges = 0;
    const infos = new Map(document.symbols.map((info) => [info.symbol, info]));
    if (hasContent)
      for (const occurrence of document.occurrences) {
        const sourceRange = range(occurrence),
          location =
            sourceRange === undefined
              ? undefined
              : sourceLocation(
                  path,
                  content,
                  document.positionEncoding,
                  sourceRange,
                );
        if (location === undefined) {
          invalidRanges++;
          continue;
        }
        const enclosingRange = range(occurrence, true),
          extent =
            enclosingRange === undefined
              ? location
              : (sourceLocation(
                  path,
                  content,
                  document.positionEncoding,
                  enclosingRange,
                ) ?? location);
        if (!occurrence.symbol) continue;
        const targetSymbolId = symbolId(occurrence.symbol, path);
        const definition =
          (occurrence.symbolRoles & SymbolRole.Definition) !== 0;
        if (definition) {
          const info = infos.get(occurrence.symbol);
          symbols.push({
            id: targetSymbolId,
            name: info?.displayName || occurrence.symbol,
            kind:
              info === undefined
                ? "symbol"
                : (SymbolInformation_Kind[info.kind] ?? "symbol"),
            definition: location,
            extent,
            ...(info?.signatureDocumentation?.text
              ? { typeDisplay: info.signatureDocumentation.text }
              : {}),
            declarationHash: hashFramedDomain("projector-scip-declaration-v1", {
              symbol: occurrence.symbol,
              signature: info?.signatureDocumentation?.text ?? "",
              text: content.slice(extent.start, extent.end),
            }),
            provenance,
          });
          for (const relationship of info?.relationships ?? []) {
            const kind = relationship.isImplementation
              ? "implementation"
              : relationship.isTypeDefinition
                ? "type"
                : relationship.isReference
                  ? "reference"
                  : undefined;
            if (kind !== undefined)
              edges.push({
                id: hashFramedDomain("projector-scip-edge-v1", {
                  kind,
                  path,
                  at: location.start,
                  target: relationship.symbol,
                }),
                kind,
                source: location,
                sourceSymbolId: targetSymbolId,
                targetSymbolId: symbolId(relationship.symbol, path),
                resolution: "resolved",
                provenance,
              });
          }
        } else {
          const kind =
            (occurrence.symbolRoles & SymbolRole.Import) !== 0
              ? "import"
              : "reference";
          edges.push({
            id: hashFramedDomain("projector-scip-edge-v1", {
              kind,
              path,
              at: location.start,
              target: occurrence.symbol,
            }),
            kind,
            source: location,
            targetSymbolId,
            resolution: "resolved",
            provenance,
          });
        }
      }
    const available = hasContent && invalidRanges === 0;
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
      status:
        kind === "call"
          ? ("unavailable" as const)
          : !hasContent
            ? ("unavailable" as const)
            : invalidRanges > 0
              ? ("partial" as const)
              : ("available" as const),
      ...(kind === "call"
        ? {
            reason:
              "SCIP occurrences and relationships do not prove runtime calls",
          }
        : {}),
    }));
    const partition: CodePartition = {
      path,
      inputHash: sourceHash,
      symbols,
      edges,
      coverage: {
        path,
        status: available ? "complete" : hasContent ? "partial" : "unavailable",
        ...(available
          ? {}
          : {
              reason: hasContent
                ? "Some SCIP positions cannot be mapped to source"
                : "Source bytes unavailable for SCIP positions",
            }),
        capabilities,
      },
    };
    allVerified &&= input !== undefined && options.sourceHashes?.[path] === sourceHash && sourceHash !== "missing-source";
    if (options.emitPartition === undefined) partitions.push(partition);
    else options.emitPartition(partition);
  }
  if (!metadataSeen) throw new Error("SCIP metadata missing");
  const artifactHash = `sha256:${artifactDigest.digest("hex")}`;
  const sourceInputs = [...inputs.values()]
    .map((input) => ({
      path: input.path,
      contentHash: codeInputHash(input.content),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const verified =
    documentPaths.size > 0 &&
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
    providerVersion: toolVersion,
    inputFingerprint: hashFramedDomain("projector-scip-input-v1", {
      artifactHash,
      sourceInputs,
    }),
    configFingerprint: hashFramedDomain("projector-scip-tool-v1", toolVersion),
    resolutionFingerprint: options.emitPartition === undefined
      ? hashFramedDomain("projector-scip-relations-v1", partitions.map((partition) => partition.edges.map((edge) => edge.id)))
      : hashFramedCanonicalJsonChunks("projector-scip-relations-v1", function* () {
          yield "[";
          let first = true;
          for (const path of documentPaths) {
            if (!first) yield ",";
            first = false;
            const partition = options.getPartition?.(path);
            if (partition === undefined) throw new Error(`Staged SCIP document missing: ${path}`);
            yield JSON.stringify(partition.edges.map((edge) => edge.id));
          }
          yield "]";
        }),
    binding,
    partitions,
  };
}
