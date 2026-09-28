import { readFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TraceMap,
  eachMapping,
  sourceContentFor,
} from "@jridgewell/trace-mapping";
import { z } from "zod";
import { codeInputHash } from "@projector/analyzers";
import type { CodeRuntimeEvidence } from "@projector/core";

const rangeSchema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  count: z.number().nonnegative(),
});
const documentSchema = z.object({
  result: z
    .array(
      z.object({
        url: z.string(),
        functions: z.array(z.object({ ranges: z.array(rangeSchema) })),
      }),
    ),
  "source-map-cache": z
    .record(
      z.string(),
      z.object({
        url: z.string().nullable().optional(),
        lineLengths: z.array(z.number().int().nonnegative()),
        data: z
          .object({
            version: z.literal(3),
            sources: z.array(z.string()),
            names: z.array(z.string()),
            mappings: z.string(),
            sourceRoot: z.string().optional(),
            sourcesContent: z.array(z.string().nullable()).optional(),
          })
          .nullable(),
      }),
    )
    .optional(),
});
type OffsetRange = z.infer<typeof rangeSchema>;

/** V8 ranges nest. The innermost range overrides its parent's execution count. */
function executedOffsets(
  ranges: OffsetRange[],
): Array<{ start: number; end: number }> {
  const events = ranges
    .flatMap((range, id) => {
      if (range.endOffset < range.startOffset)
        throw new Error("V8 coverage has a reversed offset range");
      return range.endOffset === range.startOffset
        ? []
        : [
            { position: range.startOffset, start: true, range, id },
            { position: range.endOffset, start: false, range, id },
          ];
    })
    .sort(
      (left, right) =>
        left.position - right.position ||
        Number(left.start) - Number(right.start) ||
        right.range.endOffset - left.range.endOffset ||
        right.range.count - left.range.count,
    );
  const stack: typeof events = [];
  const ended = new Set<number>();
  const result: Array<{ start: number; end: number }> = [];
  let previous = events[0]?.position ?? 0;
  for (const event of events) {
    while (stack.length > 0 && ended.has(stack[stack.length - 1]!.id))
      stack.pop();
    const inner = stack[stack.length - 1];
    if (
      inner !== undefined &&
      inner.range.count > 0 &&
      event.position > previous
    ) {
      const last = result[result.length - 1];
      if (last?.end === previous) last.end = event.position;
      else result.push({ start: previous, end: event.position });
    }
    if (event.start) {
      if (
        inner !== undefined &&
        event.range.endOffset > inner.range.endOffset
      ) {
        throw new Error(
          "V8 coverage contains crossing ranges that cannot establish execution attribution",
        );
      }
      stack.push(event);
    } else ended.add(event.id);
    previous = event.position;
  }
  return result;
}

function repositorySource(root: string, url: string): string | undefined {
  if (!url.startsWith("file:")) return undefined;
  const path = relative(root, fileURLToPath(url)).replaceAll("\\", "/");
  return path === ".." ||
    path.startsWith("../") ||
    isAbsolute(path) ||
    path.includes("\0")
    ? undefined
    : path;
}

/** Map observed offsets to source lines without inventing coverage between map entries. */
export async function mapV8Coverage(
  root: string,
  candidate: unknown,
  evidence: CodeRuntimeEvidence,
): Promise<{
  ranges: CodeRuntimeEvidence["ranges"];
  unknowns: string[];
}> {
  const document = documentSchema.parse(candidate);
  const ranges = new Map<string, CodeRuntimeEvidence["ranges"][number]>();
  const unknowns = new Set<string>();
  const addLine = (path: string, line: number) => {
    ranges.set(`${path}:${line}`, { path, startLine: line, endLine: line });
  };
  for (const script of document.result) {
    const executed = executedOffsets(
      script.functions.flatMap((fn) => fn.ranges),
    );
    if (executed.length === 0) continue;
    const cache = document["source-map-cache"]?.[script.url];
    if (cache?.data !== undefined && cache.data !== null) {
      const mapUrl =
        cache.url === undefined ||
        cache.url === null ||
        cache.url.startsWith("data:")
          ? script.url
          : new URL(cache.url, script.url).href;
      const map = new TraceMap(
        {
          version: cache.data.version,
          sources: cache.data.sources,
          names: cache.data.names,
          mappings: cache.data.mappings,
          ...(cache.data.sourceRoot === undefined
            ? {}
            : { sourceRoot: cache.data.sourceRoot }),
          ...(cache.data.sourcesContent === undefined
            ? {}
            : { sourcesContent: cache.data.sourcesContent }),
        },
        mapUrl,
      );
      const offsets: number[] = [];
      let offset = 0;
      for (const length of cache.lineLengths) {
        offsets.push(offset);
        offset += length + 1;
      }
      const verifiedSources = new Map<string, string | undefined>();
      let cursor = 0;
      eachMapping(map, (mapping) => {
        if (mapping.source === null || mapping.originalLine === null) return;
        const lineOffset = offsets[mapping.generatedLine - 1];
        if (lineOffset === undefined)
          throw new Error(
            "V8 source map refers outside its generated line table",
          );
        const position = lineOffset + mapping.generatedColumn;
        while (cursor < executed.length && executed[cursor]!.end <= position)
          cursor++;
        if (
          executed[cursor] === undefined ||
          executed[cursor]!.start > position
        )
          return;
        if (!verifiedSources.has(mapping.source)) {
          const path = repositorySource(root, mapping.source);
          const source = sourceContentFor(map, mapping.source);
          const verified =
            path !== undefined &&
            source !== null &&
            codeInputHash(source) === evidence.sourceHashes[path];
          verifiedSources.set(mapping.source, verified ? path : undefined);
          if (!verified)
            unknowns.add(
              `Source map lacks matching embedded source bytes: ${mapping.source}`,
            );
        }
        const path = verifiedSources.get(mapping.source);
        if (path !== undefined) addLine(path, mapping.originalLine);
      });
      continue;
    }
    const path = repositorySource(root, script.url);
    if (path === undefined || evidence.sourceHashes[path] === undefined) {
      unknowns.add(
        `Runtime script has no bound source or source map: ${script.url}`,
      );
      continue;
    }
    const text = await readFile(fileURLToPath(script.url), "utf8");
    if (codeInputHash(text) !== evidence.sourceHashes[path])
      throw new Error(`Runtime source changed before offset mapping: ${path}`);
    let offset = 0,
      cursor = 0;
    for (const [index, line] of text.split(/\n|\u2028|\u2029/u).entries()) {
      const end = offset + line.length;
      while (cursor < executed.length && executed[cursor]!.end <= offset)
        cursor++;
      if (executed[cursor] !== undefined && executed[cursor]!.start < end)
        addLine(path, index + 1);
      offset = end + 1;
    }
  }
  return { ranges: [...ranges.values()], unknowns: [...unknowns].sort() };
}
