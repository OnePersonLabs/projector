import { randomUUID } from "node:crypto";
import { readFile, mkdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { z } from "zod";
import {
  CodeTestRunRequestSchema, CodeTestRunResultSchema, CodeRuntimeEvidenceSchema,
  hashFramedDomain,
} from "@projector/core";
import { codeInputHash, type InventoryEntry } from "@projector/analyzers";
import { NativeProcessLauncher, RepositoryPathService, SqliteCodeStore, resolveDerivedCachePath } from "@projector/runtime";
import { observeIndexedRepository } from "../change-lifecycle/indexed-observer.js";
import { executeCodeOperation } from "./service.js";

type ExecutionOptions = { readonly signal: AbortSignal; readonly environment: Readonly<Record<string, string | undefined>> };
const assertionSchema = z.object({ fullName: z.string(), status: z.string(), duration: z.number().nonnegative().optional() });
const resultSchema = z.object({ testResults: z.array(z.object({ assertionResults: z.array(assertionSchema) })) });
const coverageSchema = z.record(z.string(), z.object({
  path: z.string().optional(),
  statementMap: z.record(z.string(), z.object({
    start: z.object({ line: z.number().int().positive() }),
    end: z.object({ line: z.number().int().positive() }),
  })),
  s: z.record(z.string(), z.number()),
}));

async function readReplayJson(path: string, artifact: string): Promise<unknown> {
  await stat(path).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Isolated replay produced no ${artifact}: ${path}`, { cause: error });
    throw error;
  });
  return JSON.parse(await readFile(path, "utf8"));
}

function exactNamePattern(name: string): string {
  return `^${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`;
}

function repositoryPath(root: string, path: string): string {
  const candidate = isAbsolute(path) ? relative(root, path) : path;
  const normalized = candidate.split(sep).join("/");
  if (normalized === "" || normalized === ".." || normalized.startsWith("../") || isAbsolute(normalized)) throw new Error(`Replay coverage escapes the repository: ${path}`);
  return normalized;
}

type ObservedSource = { readonly inventoryHash: string; readonly codeHash: string };
function observedSources(observation: Awaited<ReturnType<typeof observeIndexedRepository>>): Map<string, ObservedSource> {
  return observation.store.readGeneration(observation.descriptor.generation, () => new Map(
    observation.store.population("inventory").map(path => {
      const entry = observation.store.get<InventoryEntry>("inventory", path);
      if (entry === undefined) throw new Error(`Replay source inventory has no bytes: ${path}`);
      return [path, { inventoryHash: entry.contentHash, codeHash: entry.kind === "file" ? codeInputHash(entry.content) : entry.contentHash }] as const;
    }),
  ));
}

function assertSameInputs(before: ReadonlyMap<string, ObservedSource>, after: ReadonlyMap<string, ObservedSource>): void {
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(path)?.inventoryHash !== after.get(path)?.inventoryHash) throw new Error(`Isolated replay changed an observed repository input: ${path}`);
  }
}

async function localVitest(root: string): Promise<readonly [string, string[]]> {
  const executable = join(root, "node_modules", "vitest", "vitest.mjs");
  if (!(await stat(executable).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }))?.isFile()) throw new Error("Local Vitest is unavailable; install it in the selected repository or supply an explicit Vitest command");
  return [process.execPath, [executable, "run"]];
}

/** Opt-in isolated replay. This never substitutes for repository verification gates. */
export async function executeCodeTestReplay(repositoryRoot: string, raw: unknown, options: ExecutionOptions): Promise<z.infer<typeof CodeTestRunResultSchema>> {
  const input = CodeTestRunRequestSchema.parse(raw);
  options.signal.throwIfAborted();
  const paths = await RepositoryPathService.create(repositoryRoot);
  const root = paths.root;
  const testFile = await paths.resolveRead(input.testFile);
  if (!(await stat(testFile.realTarget)).isFile()) throw new Error(`Replay testFile is not a regular file: ${input.testFile}`);
  const store = await SqliteCodeStore.open(root);
  let generation: string;
  let buildId: string;
  try {
    generation = store.head() ?? (() => { throw new Error("Run code.index before an isolated replay"); })();
    const manifest = store.manifest(generation);
    if (manifest?.binding.status !== "verified") throw new Error("Isolated replay requires a source-bound semantic generation");
    buildId = hashFramedDomain("code-test-replay-build-v1", { generation, binding: manifest.binding });
  } finally { store.close(); }

  const before = await observeIndexedRepository(root);
  let beforeHashes: Map<string, ObservedSource>;
  try { beforeHashes = observedSources(before); }
  finally { before.close(); }
  if (!beforeHashes.has(input.testFile)) throw new Error(`Replay testFile is outside the observed checkout: ${input.testFile}`);

  const runId = `code_test_${randomUUID()}`;
  const artifactDirectory = await resolveDerivedCachePath(root, `.projector/runtime/code/test-replay/${runId}`);
  await mkdir(artifactDirectory, { recursive: true });
  const resultPath = join(artifactDirectory, "results.json");
  const coveragePath = join(artifactDirectory, "coverage", "coverage-final.json");
  const [executable, leading] = input.command === undefined
    ? await localVitest(root)
    : [input.command.executable, input.command.args] as const;
  if (leading.some(arg => /^(?:--(?:reporter|outputFile|coverage|testNamePattern|passWithNoTests|update)(?:[.=]|$)|-u$)/u.test(arg))) {
    throw new Error("An explicit replay command cannot override test selection, reporting, coverage, or snapshot update flags");
  }
  const args = [
    ...leading, input.testFile,
    "--testNamePattern", exactNamePattern(input.testName),
    "--reporter=json", `--outputFile=${resultPath}`,
    "--coverage", "--coverage.provider=v8", "--coverage.reporter=json",
    `--coverage.reportsDirectory=${join(artifactDirectory, "coverage")}`,
    "--coverage.reportOnFailure", "--no-file-parallelism", "--maxWorkers=1",
  ];
  const environment = Object.fromEntries(Object.entries({ ...options.environment, ...input.command?.environment })
    .filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const execution = await new NativeProcessLauncher().launch({ executable, args, cwd: root, env: environment,
    timeoutMs: input.timeoutMs, maxOutputBytes: 1024 * 1024, outputOverflow: "truncate", signal: options.signal });
  const after = await observeIndexedRepository(root);
  let afterHashes: Map<string, ObservedSource>;
  try { afterHashes = observedSources(after); }
  finally { after.close(); }
  assertSameInputs(beforeHashes, afterHashes);

  const report = resultSchema.parse(await readReplayJson(resultPath, "test result"));
  const executed = report.testResults.flatMap(file => file.assertionResults)
    .filter(test => test.status === "passed" || test.status === "failed");
  if (executed.length !== 1 || executed[0]?.fullName !== input.testName) {
    throw new Error(`Isolated replay selected ${executed.length} executed cases; expected exactly one named ${JSON.stringify(input.testName)}`);
  }
  const test = executed[0]!;
  const outcome = test.status === "passed" && execution.exitCode === 0 ? "passed" as const : "failed" as const;
  const coverage = coverageSchema.parse(await readReplayJson(coveragePath, "coverage report"));
  const ranges: Array<{ path: string; startLine: number; endLine: number }> = [];
  const sourceHashes: Record<string, string> = {};
  const unknowns: string[] = [];
  const indexed = await SqliteCodeStore.open(root);
  try {
    if (indexed.head() !== generation) throw new Error("Semantic generation changed during isolated replay");
    for (const [file, record] of Object.entries(coverage)) {
      const path = repositoryPath(root, record.path ?? file);
      const observed = beforeHashes.get(path);
      const partitionHash = indexed.partition(generation, path)?.inputHash;
      if (observed === undefined || partitionHash === undefined ||
        (partitionHash !== observed.inventoryHash && partitionHash !== observed.codeHash)) {
        unknowns.push(`Coverage source has no verified indexed binding: ${path}`);
        continue;
      }
      sourceHashes[path] = partitionHash;
      for (const [id, location] of Object.entries(record.statementMap)) {
        if ((record.s[id] ?? 0) > 0) ranges.push({ path, startLine: location.start.line, endLine: location.end.line });
      }
    }
  } finally { indexed.close(); }
  if (Object.keys(sourceHashes).length === 0) throw new Error("Isolated replay produced no coverage for source-bound indexed files");
  const testId = `${input.testFile}::${input.testName}`;
  const workload = hashFramedDomain("code-test-replay-workload-v1", { testFile: input.testFile, testName: input.testName, command: { executable, args } });
  const evidence = CodeRuntimeEvidenceSchema.parse({ id: hashFramedDomain("code-test-replay-evidence-v1", { runId, generation, ranges }),
    generation, sourceHashes, testId, runId, runner: "vitest/v8", buildId, workload,
    attribution: "isolated_replay", outcome, durationMs: test.duration ?? execution.durationMs, ranges });
  const imported = await executeCodeOperation(root, "code.evidence", { format: "projector", evidence }, options) as { accepted: string[]; unknowns: string[] };
  return CodeTestRunResultSchema.parse({ runId, generation, testId, outcome, durationMs: test.duration ?? execution.durationMs,
    evidenceIds: imported.accepted, sourceHashes, buildId, workload, command: { executable, args },
    unknowns: [...new Set([...unknowns, ...imported.unknowns])], requiredVerificationUnaffected: true });
}
