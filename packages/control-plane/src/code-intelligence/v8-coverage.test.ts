import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";
import { codeInputHash } from "@projector/analyzers";
import type { CodeRuntimeEvidence } from "@projector/core";
import { mapV8Coverage } from "./v8-coverage.js";

const run = promisify(execFile);

it("maps a large valid coverage report without dropping ranges or source lines", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-v8-large-"));
  try {
    const lineCount = 100_001;
    const source = "x();\n".repeat(lineCount);
    const path = join(root, "large.js");
    await writeFile(path, source);
    const evidence: CodeRuntimeEvidence = {
      id: "large-coverage", generation: "generation",
      sourceHashes: { "large.js": codeInputHash(source) },
      testId: "large", runId: "large-run", runner: "node", buildId: "plain-js",
      workload: "all lines", attribution: "isolated_replay", outcome: "passed", ranges: [],
    };
    const mapped = await mapV8Coverage(root, {
      result: [{ url: pathToFileURL(path).href, functions: [{
        ranges: Array.from({ length: lineCount }, (_, line) => ({
          startOffset: line * 5, endOffset: line * 5 + 4, count: 1,
        })),
      }] }],
    }, evidence);
    expect(mapped.unknowns).toEqual([]);
    expect(mapped.ranges).toHaveLength(lineCount);
    expect(mapped.ranges.at(-1)).toEqual({ path: "large.js", startLine: lineCount, endLine: lineCount });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("maps real Node coverage through embedded TypeScript sources and excludes unexecuted branches", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-v8-map-"));
  try {
    const source = [
      "export function answer(input: boolean): number {",
      "  if (input) {",
      "    return 42;",
      "  }",
      "  return 0;",
      "}",
      "answer(true);",
      "",
    ].join("\n");
    const compiled = ts.transpileModule(source, {
      fileName: "answer.ts",
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        sourceMap: true,
        inlineSources: true,
      },
    });
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await writeFile(join(root, "src", "answer.ts"), source);
    await writeFile(join(root, "src", "answer.js"), compiled.outputText);
    await writeFile(
      join(root, "src", "answer.js.map"),
      compiled.sourceMapText!,
    );
    const coverage = join(root, "coverage");
    await run(process.execPath, [join(root, "src", "answer.js")], {
      cwd: root,
      env: { ...process.env, NODE_V8_COVERAGE: coverage },
      timeout: 10_000,
    });
    const report = JSON.parse(
      await readFile(join(coverage, (await readdir(coverage))[0]!), "utf8"),
    ) as Record<string, unknown>;
    const evidence: CodeRuntimeEvidence = {
      id: "answer-coverage",
      generation: "generation",
      sourceHashes: { "src/answer.ts": codeInputHash(source) },
      testId: "answer(true)",
      runId: "real-node",
      runner: "node",
      buildId: "typescript",
      workload: "positive answer",
      attribution: "isolated_replay",
      outcome: "passed",
      ranges: [],
    };
    const mapped = await mapV8Coverage(root, report, evidence);
    expect(mapped.ranges).toContainEqual({
      path: "src/answer.ts",
      startLine: 3,
      endLine: 3,
    });
    expect(mapped.ranges.some((range) => range.startLine === 5)).toBe(false);

    const stale = await mapV8Coverage(root, report, {
      ...evidence,
      sourceHashes: { "src/answer.ts": codeInputHash(source + "// changed") },
    });
    expect(stale.ranges).toEqual([]);
    expect(
      stale.unknowns.some((reason) =>
        reason.includes("matching embedded source bytes"),
      ),
    ).toBe(true);

    const plain = "one();\ntwo();\nthree();\n";
    await writeFile(join(root, "plain.js"), plain);
    const direct = await mapV8Coverage(
      root,
      {
        result: [
          {
            url: pathToFileURL(join(root, "plain.js")).href,
            functions: [
              {
                ranges: [
                  { startOffset: 0, endOffset: plain.length, count: 1 },
                  { startOffset: 7, endOffset: 14, count: 0 },
                ],
              },
            ],
          },
        ],
      },
      { ...evidence, sourceHashes: { "plain.js": codeInputHash(plain) } },
    );
    expect(direct.ranges.map((range) => range.startLine)).toEqual([1, 3]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
