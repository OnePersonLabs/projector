import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { afterEach, expect, it, vi } from "vitest";
import {
  CodeIndexRunSchema,
  CodeIndexStatusSchema,
  CodeQueryEvidenceSchema,
  CodeEvidenceResultSchema,
  CodeTestsResultSchema,
  CodeImpactResultSchema,
  CodeExportResultSchema,
} from "@projector/core";
import { codeInputHash } from "@projector/analyzers";
import { SqliteCodeStore, withObservationScope } from "@projector/runtime";
import { executeCodeOperation, shutdownCodeIndexRuns } from "./service.js";

const run = promisify(execFile);
const temporaryDirectories: string[] = [];
const originalCache = process.env.PROJECTOR_CACHE_DIRECTORY;

afterEach(async () => {
  vi.restoreAllMocks();
  await shutdownCodeIndexRuns();
  for (const directory of temporaryDirectories.splice(0))
    await rm(directory, { recursive: true, force: true });
  if (originalCache === undefined) delete process.env.PROJECTOR_CACHE_DIRECTORY;
  else process.env.PROJECTOR_CACHE_DIRECTORY = originalCache;
});

it("connects navigation, protocol impact, observed tests and complete graph exports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "projector-code-workflow-"));
  temporaryDirectories.push(directory);
  const root = join(directory, "repo");
  process.env.PROJECTOR_CACHE_DIRECTORY = join(directory, "cache");
  await mkdir(join(root, "src"), { recursive: true });
  const sources: Record<string, string> = {
    "src/clock.ts": "export function clock(): number { return 1; }\n",
    "src/caller.ts":
      "import { clock } from './clock.js';\nexport function caller() { return clock(); }\n",
    "src/protocol.ts":
      "export function sendClockRequest() { return 'clock.read'; }\n",
    "src/clock.test.ts":
      "import { caller } from './caller.js';\nexport function clockTest() { return caller(); }\n",
  };
  await writeFile(
    join(root, "package.json"),
    '{"name":"semantic-workflow","type":"module"}\n',
  );
  await writeFile(
    join(root, "tsconfig.json"),
    '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","target":"ES2022"},"include":["src"]}\n',
  );
  for (const [path, content] of Object.entries(sources))
    await writeFile(join(root, path), content);
  await run("git", ["init", "--quiet"], { cwd: root });
  await run("git", ["add", "."], { cwd: root });
  await run(
    "git",
    [
      "-c",
      "user.name=Projector Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "fixture",
    ],
    { cwd: root },
  );

  const controller = new AbortController();
  const options = { signal: controller.signal, environment: process.env };
  const execute = (
    operation: Parameters<typeof executeCodeOperation>[1],
    input: unknown,
  ) =>
    withObservationScope(
      { signal: controller.signal, limits: { timeoutMs: 60_000 } },
      () => executeCodeOperation(root, operation, input, options),
    );

  const codeStore = await SqliteCodeStore.open(root);
  const storePath = codeStore.path;
  codeStore.close();
  const acknowledgedLeases: string[] = [];
  const originalPostMessage = Worker.prototype.postMessage;
  const postMessage = vi.spyOn(Worker.prototype, "postMessage").mockImplementation(function (this: Worker, value: unknown, transferList?: Parameters<Worker["postMessage"]>[1]) {
    const acknowledgment = (value as { semanticLeaseEndAck?: { token: string } }).semanticLeaseEndAck;
    if (acknowledgment !== undefined) {
      const reader = new DatabaseSync(storePath, { readOnly: true });
      try {
        const current = reader.prepare("SELECT token FROM code_writer_leases WHERE scope='semantic-publication'").get() as { token: string } | undefined;
        expect(current?.token).toBe(acknowledgment.token);
        acknowledgedLeases.push(acknowledgment.token);
      } finally { reader.close(); }
    }
    return originalPostMessage.call(this, value, transferList);
  });

  const syntaxOnly = CodeIndexRunSchema.parse(
    await execute("code.index", { provider: "syntax", timeoutMs: 30_000 }),
  );
  expect(syntaxOnly.state, syntaxOnly.error).toBe("published");
  const indexed = CodeIndexRunSchema.parse(
    await execute("code.index", { timeoutMs: 30_000 }),
  );
  expect(indexed.state, indexed.error).toBe("published");
  expect(indexed.generation).not.toBe(syntaxOnly.generation);
  expect(acknowledgedLeases).toHaveLength(2);
  postMessage.mockRestore();
  const before = indexed.generation!;
  const clock = CodeQueryEvidenceSchema.parse(
    await execute("code.query", {
      kind: "definition",
      name: "clock",
      generation: before,
      freshness: "pinned",
    }),
  ).query.symbols[0]!;
  const protocol = CodeQueryEvidenceSchema.parse(
    await execute("code.query", {
      kind: "definition",
      name: "sendClockRequest",
      generation: before,
      freshness: "pinned",
    }),
  ).query.symbols[0]!;
  const callers = CodeQueryEvidenceSchema.parse(
    await execute("code.query", {
      kind: "callers",
      symbolId: clock.id,
      generation: before,
      freshness: "pinned",
    }),
  );
  expect(callers.query.edges.map((edge) => edge.source.path)).toContain(
    "src/caller.ts",
  );
  const definition = CodeQueryEvidenceSchema.parse(
    await execute("code.query", {
      kind: "definition",
      path: "src/caller.ts",
      offset: sources["src/caller.ts"]!.lastIndexOf("clock()") + 1,
      generation: before,
      freshness: "pinned",
    }),
  );
  expect(definition.query.symbols[0]?.id).toBe(clock.id);

  const hashes = Object.fromEntries(
    Object.entries(sources).map(([path, content]) => [
      path,
      codeInputHash(content),
    ]),
  );
  const bridge = CodeEvidenceResultSchema.parse(
    await execute("code.evidence", {
      format: "bridges",
      generation: before,
      sourceHashes: hashes,
      bridges: [
        {
          id: "clock-rpc",
          protocol: "json-rpc",
          identity: "clock.read",
          fromSymbolId: protocol.id,
          toSymbolId: clock.id,
          sourcePaths: ["src/protocol.ts", "src/clock.ts"],
          explanation: "The request method is handled by clock",
        },
      ],
    }),
  );
  expect(bridge.accepted).toEqual(["clock-rpc"]);
  const bridged = CodeIndexStatusSchema.parse(
    await execute("code.index-status", {}),
  ).head!;
  const neighborhood = CodeQueryEvidenceSchema.parse(
    await execute("code.query", {
      kind: "neighborhood",
      path: "src/protocol.ts",
      generation: bridged,
      freshness: "pinned",
    }),
  );
  expect(neighborhood.query.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "bridge", targetSymbolId: clock.id }),
    ]),
  );

  await execute("code.evidence", {
    format: "projector",
    evidence: {
      id: "clock-coverage",
      generation: bridged,
      sourceHashes: hashes,
      testId: "clockTest",
      runId: "run-clock",
      runner: "fixture",
      buildId: "build-one",
      workload: "clock read",
      attribution: "per-test",
      outcome: "passed",
      durationMs: 5,
      ranges: [{ path: "src/clock.ts", startLine: 1, endLine: 1 }],
    },
  });
  await execute("code.evidence", {
    format: "projector",
    evidence: {
      id: "clock-coverage-repeat", generation: bridged, sourceHashes: hashes,
      testId: "clockTest", runId: "run-clock-repeat", runner: "fixture",
      buildId: "build-one", workload: "clock read", attribution: "per-test",
      outcome: "passed", ranges: [{ path: "src/clock.ts", startLine: 1, endLine: 1 }],
    },
  });
  const tests = CodeTestsResultSchema.parse(
    await execute("code.tests", {
      generation: bridged,
      paths: ["src/clock.ts"],
    }),
  );
  expect(tests.recommendations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ testId: "clockTest", observed: true }),
    ]),
  );
  expect(tests.requiredVerificationUnaffected).toBe(true);
  const firstPage = CodeTestsResultSchema.parse(await execute("code.tests", {
    generation: bridged, paths: ["src/clock.ts"], limit: 1,
  }));
  expect(firstPage.complete).toBe(false);
  expect(firstPage.nextCursor).toBeDefined();
  const secondPage = CodeTestsResultSchema.parse(await execute("code.tests", {
    generation: bridged, paths: ["src/clock.ts"], limit: 1, cursor: firstPage.nextCursor,
  }));
  expect(secondPage.pageSemantics).toBe("merge-recommendations-by-test-id");
  expect(secondPage.recommendations.some((item) => item.testId === "clockTest")).toBe(true);

  await writeFile(
    join(root, "tsconfig.json"),
    '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","target":"ES2022","strict":true},"include":["src"]}\n',
  );
  // The default test query must establish a current generation itself, and
  // unchanged source lines do not rescue coverage from another compiler build.
  const differentBuild = CodeTestsResultSchema.parse(
    await execute("code.tests", { paths: ["src/clock.ts"] }),
  );
  expect(differentBuild.generation).not.toBe(bridged);
  expect(
    differentBuild.recommendations.some(
      (test) => test.testId === "clockTest" && test.observed,
    ),
  ).toBe(false);
  expect(
    differentBuild.unknowns.some((reason) =>
      reason.includes("compiler or resolution inputs"),
    ),
  ).toBe(true);

  const graph = CodeExportResultSchema.parse(
    await execute("code.export", { generation: bridged, format: "graphml" }),
  );
  const nodeIds = new Set(
    [...graph.content!.matchAll(/<node id="([^"]+)"/gu)].map(
      (match) => match[1],
    ),
  );
  const graphEdges = [
    ...graph.content!.matchAll(
      /<edge id="[^"]+" source="([^"]+)" target="([^"]+)"/gu,
    ),
  ];
  expect(graphEdges).toHaveLength(graph.edges);
  expect(
    graphEdges.every((match) => nodeIds.has(match[1]) && nodeIds.has(match[2])),
  ).toBe(true);
  const jsonl = CodeExportResultSchema.parse(
    await execute("code.export", { generation: bridged, format: "jsonl" }),
  );
  const records = jsonl.content!
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { record: string });
  expect(records.filter((record) => record.record === "edge")).toHaveLength(
    graph.edges,
  );
  expect(records.some((record) => record.record === "coverage")).toBe(true);
  const artifact = CodeExportResultSchema.parse(await execute("code.export", {
    generation: bridged, format: "graphml", maxBytes: 1024, artifactName: "workflow.graphml",
  }));
  expect(artifact.content).toBeUndefined();
  const streamed = await readFile(artifact.artifact!.path, "utf8");
  expect(streamed.endsWith("</graph></graphml>\n")).toBe(true);
  expect(Buffer.byteLength(streamed)).toBe(artifact.artifact!.bytes);

  await writeFile(
    join(root, "src/clock.ts"),
    "export function clock(): number { return 2; }\n",
  );
  const updated = CodeIndexRunSchema.parse(
    await execute("code.index", { timeoutMs: 30_000 }),
  );
  expect(updated.state, updated.error).toBe("published");
  const impact = CodeImpactResultSchema.parse(
    await execute("code.impact", {
      before: bridged,
      after: updated.generation,
    }),
  );
  expect(impact.affectedPaths).toEqual(
    expect.arrayContaining([
      "src/clock.ts",
      "src/caller.ts",
      "src/protocol.ts",
      "src/clock.test.ts",
    ]),
  );
  const staleCoverage = CodeTestsResultSchema.parse(
    await execute("code.tests", {
      generation: updated.generation,
      paths: ["src/clock.ts"],
    }),
  );
  expect(
    staleCoverage.recommendations.some(
      (test) => test.testId === "clockTest" && test.observed,
    ),
  ).toBe(false);
}, 90_000);
