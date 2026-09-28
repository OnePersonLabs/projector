import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it, vi } from "vitest";
import { CodeImpactResultSchema, CodeIndexRunSchema, type CodeSnapshot } from "@projector/core";
import { SqliteCodeStore, withObservationScope } from "@projector/runtime";
import { executeCodeOperation, shutdownCodeIndexRuns } from "./service.js";
import { executeCodeWorker } from "./worker-service.js";

const run = promisify(execFile);

it("propagates changed resolution and inferred types when source bytes are identical", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-config-impact-"));
  const oldCache = process.env.PROJECTOR_CACHE_DIRECTORY;
  process.env.PROJECTOR_CACHE_DIRECTORY = join(root, "cache");
  const provenance = {
    provider: "compiler",
    version: "1",
    inputHash: "same-source",
  };
  const snapshot = (target: string, typeDisplay = "number"): CodeSnapshot => ({
    schemaVersion: "projector.code-intelligence/v1",
    provider: "compiler",
    providerVersion: "1",
    inputFingerprint: "same-sources",
    configFingerprint: target,
    resolutionFingerprint: target,
    binding: {
      status: "verified",
      checkoutId: "checkout",
      worktreeDigest: "tree",
      projectKey: "project",
      sourceInputs: [],
      configInputs: [],
      resolutionInputs: [],
    },
    partitions: ["alpha", "beta", "consumer", "outer"].map((name) => {
      const path = `src/${name}.ts`,
        location = { path, start: 0, end: 1, line: 1, column: 1 };
      return {
        path,
        inputHash: "same-source",
        symbols: [
          {
            id: name,
            name,
            kind: "function",
            definition: location,
            extent: location,
            declarationHash: "same-declaration",
            bodyHash: "same-body",
            typeDisplay: name === "alpha" ? typeDisplay : "number",
            provenance,
          },
        ],
        edges:
          name === "consumer" || name === "outer"
            ? [
                {
                  id: `call-${name}`,
                  kind: "call" as const,
                  source: location,
                  sourceSymbolId: name,
                  targetSymbolId: name === "consumer" ? target : "consumer",
                  resolution: "resolved" as const,
                  provenance,
                },
              ]
            : [],
        coverage: {
          path,
          status: "complete" as const,
          capabilities: [
            {
              kind: "call" as const,
              fidelity: "semantic" as const,
              status: "available" as const,
            },
          ],
        },
      };
    }),
  });
  try {
    const store = await SqliteCodeStore.open(root);
    const first = store.publish(null, snapshot("alpha"));
    const second = store.publish(first, snapshot("beta"));
    store.close();
    const resolution = CodeImpactResultSchema.parse(
      await executeCodeWorker(
        {
          repositoryRoot: root,
          operation: "code.impact",
          input: { before: first, after: second },
        },
        Date.now() + 10_000,
      ),
    );
    expect(resolution.changedSymbols).toContain("consumer");
    expect(resolution.affectedPaths).toEqual(
      expect.arrayContaining(["src/consumer.ts", "src/outer.ts"]),
    );
    expect(resolution.possiblePaths).toContain("src/alpha.ts");
    expect(resolution.unknowns).toEqual(expect.arrayContaining([
      expect.stringContaining("external resolution inputs changed"),
    ]));
    const pathsRead = vi.spyOn(SqliteCodeStore.prototype, "paths");
    const partitionsRead = vi.spyOn(SqliteCodeStore.prototype, "partition");
    try {
      const unchanged = CodeImpactResultSchema.parse(
        await executeCodeWorker(
          {
            repositoryRoot: root,
            operation: "code.impact",
            input: { before: second, after: second },
          },
          Date.now() + 10_000,
        ),
      );
      expect(unchanged).toEqual({
        before: second,
        after: second,
        changedSymbols: [],
        affectedSymbols: [],
        affectedPaths: [],
        possiblePaths: [],
        unknowns: [],
        truncated: false,
      });
      expect(pathsRead).not.toHaveBeenCalled();
      expect(partitionsRead).not.toHaveBeenCalled();
    } finally {
      pathsRead.mockRestore();
      partitionsRead.mockRestore();
    }

    const largePaths = vi.spyOn(SqliteCodeStore.prototype, "paths").mockImplementation((_generation, _limit, cursor) => {
      const offset = cursor === undefined ? 0 : Number(cursor);
      const paths = Array.from({ length: 1000 }, (_, index) => `src/generated-${offset + index}.ts`);
      return { paths, ...(offset + 1000 === 21_000 ? {} : { nextCursor: String(offset + 1000) }) };
    });
    const emptyPartitions = vi.spyOn(SqliteCodeStore.prototype, "partition").mockReturnValue(undefined);
    try {
      await expect(executeCodeWorker(
        { repositoryRoot: root, operation: "code.impact", input: { before: first, after: second } },
        Date.now() + 30_000,
        1024,
      )).rejects.toThrow(/maxDerivedBytes/);
      const large = CodeImpactResultSchema.parse(await executeCodeWorker(
        { repositoryRoot: root, operation: "code.impact", input: { before: first, after: second } },
        Date.now() + 30_000,
        5 * 1024 * 1024,
      ));
      expect(large.affectedPaths).toEqual([]);
      expect(largePaths).toHaveBeenCalledTimes(43);
    } finally {
      largePaths.mockRestore();
      emptyPartitions.mockRestore();
    }

    const writer = await SqliteCodeStore.open(root);
    const third = writer.publish(second, snapshot("alpha"));
    const fourth = writer.publish(third, snapshot("alpha", "string"));
    writer.close();
    const type = CodeImpactResultSchema.parse(
      await executeCodeWorker(
        {
          repositoryRoot: root,
          operation: "code.impact",
          input: { before: third, after: fourth },
        },
        Date.now() + 10_000,
      ),
    );
    expect(type.changedSymbols).toContain("alpha");
    expect(type.affectedPaths).toEqual(
      expect.arrayContaining([
        "src/alpha.ts",
        "src/consumer.ts",
        "src/outer.ts",
      ]),
    );
  } finally {
    if (oldCache === undefined) delete process.env.PROJECTOR_CACHE_DIRECTORY;
    else process.env.PROJECTOR_CACHE_DIRECTORY = oldCache;
    await rm(root, { recursive: true, force: true });
  }
});

it("retains possible native impact when an external declaration changes behind a stable alias", async () => {
  const directory = await mkdtemp(join(tmpdir(), "projector-external-impact-"));
  const root = join(directory, "repo");
  const packageRoot = join(root, "node_modules", "external-types");
  const oldCache = process.env.PROJECTOR_CACHE_DIRECTORY;
  process.env.PROJECTOR_CACHE_DIRECTORY = join(directory, "cache");
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(packageRoot, { recursive: true });
    await writeFile(join(root, ".gitignore"), "node_modules/\n");
    await writeFile(join(root, "package.json"), '{"name":"external-impact","type":"module"}\n');
    await writeFile(join(root, "tsconfig.json"), '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","target":"ES2022"},"include":["src"]}\n');
    await writeFile(join(root, "src", "result.ts"), 'import { factory } from "external-types";\nexport const result = factory();\n');
    await writeFile(join(packageRoot, "package.json"), '{"name":"external-types","version":"1.0.0","types":"index.d.ts"}\n');
    const declaration = join(packageRoot, "index.d.ts");
    await writeFile(declaration, "export interface Big { stable: number; late: number }\nexport declare function factory(): Big;\n");
    await run("git", ["init", "--quiet"], { cwd: root });
    await run("git", ["add", "."], { cwd: root });
    await run("git", ["-c", "user.name=Impact Test", "-c", "user.email=impact@example.invalid", "commit", "-qm", "fixture"], { cwd: root });

    const controller = new AbortController();
    const execute = (operation: Parameters<typeof executeCodeOperation>[1], input: unknown) =>
      withObservationScope({ signal: controller.signal, limits: { timeoutMs: 60_000 } }, () =>
        executeCodeOperation(root, operation, input, { signal: controller.signal, environment: process.env }),
      );
    const first = CodeIndexRunSchema.parse(await execute("code.index", { provider: "native", timeoutMs: 30_000 }));
    expect(first.state, first.error).toBe("published");
    await writeFile(declaration, "export interface Big { stable: number; late: string }\nexport declare function factory(): Big;\n");
    const second = CodeIndexRunSchema.parse(await execute("code.index", { provider: "native", timeoutMs: 30_000 }));
    expect(second.state, second.error).toBe("published");
    expect(second.generation).not.toBe(first.generation);

    const store = await SqliteCodeStore.open(root);
    try {
      const before = store.manifest(first.generation!)!;
      const after = store.manifest(second.generation!)!;
      expect(after.resolutionFingerprint).not.toBe(before.resolutionFingerprint);
      expect(store.partition(first.generation!, "src/result.ts")).toEqual(
        store.partition(second.generation!, "src/result.ts"),
      );
    } finally {
      store.close();
    }
    const impact = CodeImpactResultSchema.parse(await execute("code.impact", {
      before: first.generation,
      after: second.generation,
    }));
    expect(impact.changedSymbols).toEqual([]);
    expect(impact.possiblePaths).toContain("src/result.ts");
    expect(impact.unknowns).toEqual(expect.arrayContaining([
      expect.stringContaining("external resolution inputs changed"),
    ]));
  } finally {
    await shutdownCodeIndexRuns();
    if (oldCache === undefined) delete process.env.PROJECTOR_CACHE_DIRECTORY;
    else process.env.PROJECTOR_CACHE_DIRECTORY = oldCache;
    await rm(directory, { recursive: true, force: true });
  }
});
