import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CodeInputBindingSchema } from "@projector/core";
import {
  discoverTypeScriptProjects,
  TypeScriptCodeProvider,
} from "./typescript-provider.js";
import { verifyCodeInputBinding } from "./input-binding.js";

describe("resident TypeScript code provider", () => {
  it("changes the canonical interface surface for required and merged fields", () => {
    const root = mkdtempSync(join(tmpdir(), "projector-ts-interface-"));
    try {
      const base = "export {}; declare global { interface Contract { base: string } }\n";
      const merged = "export {}; declare global { interface Contract { other: number } }\n";
      const options = { repositoryRoot: root, binding: { checkoutId: "test", worktreeDigest: "tree", projectKey: "interfaces" } };
      const provider = new TypeScriptCodeProvider();
      const update = (a: string, b: string) => {
        writeFileSync(join(root, "a.ts"), a);
        writeFileSync(join(root, "b.ts"), b);
        return provider.update([
          { path: "a.ts", content: a, contentHash: "a" },
          { path: "b.ts", content: b, contentHash: "b" },
        ], options);
      };
      const canonical = (snapshot: ReturnType<typeof update>) =>
        snapshot.partitions[0]!.symbols.find((symbol) => symbol.name === "Contract")!;
      const initial = canonical(update(base, merged));
      expect(initial).toBeDefined();
      const mergedChange = canonical(update(base, "export {}; declare global { interface Contract { other: number; added: boolean } }\n"));
      expect(mergedChange.id).toBe(initial.id);
      expect(mergedChange.declarationHash).not.toBe(initial.declarationHash);
      const requiredChange = canonical(update("export {}; declare global { interface Contract { base: string; required: number } }\n", merged));
      expect(requiredChange.id).toBe(initial.id);
      expect(requiredChange.declarationHash).not.toBe(initial.declarationHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("indexes object property declarations and downgrades unsupported local targets", () => {
    const root = mkdtempSync(join(tmpdir(), "projector-ts-properties-"));
    try {
      const content = [
        "const short = () => 1;",
        "const object = { ping: () => 1, 'pong': () => 2, 3: () => 3, short, ['computed']: () => 4 };",
        "object.ping(); object.pong(); object[3](); object.short(); object.computed();",
      ].join("\n");
      writeFileSync(join(root, "main.ts"), content);
      const result = new TypeScriptCodeProvider().update(
        [{ path: "main.ts", content, contentHash: "properties" }],
        { repositoryRoot: root, binding: { checkoutId: "test", worktreeDigest: "tree", projectKey: "properties" } },
      );
      const staged = new Map<string, (typeof result.partitions)[number]>();
      const streamed = new TypeScriptCodeProvider().update(
        [{ path: "main.ts", content, contentHash: "properties" }],
        { repositoryRoot: root, binding: { checkoutId: "test", worktreeDigest: "tree", projectKey: "properties" }, maxProofBytes: null },
        { put: partition => { staged.set(partition.path, partition); }, get: path => staged.get(path), replace: partition => { staged.set(partition.path, partition); } },
      );
      expect({ ...streamed, partitions: [...staged.values()] }).toEqual(result);
      const partition = result.partitions[0]!;
      for (const name of ["ping", "pong", "short"]) {
        const expectedKind = name === "short" ? "ShorthandPropertyAssignment" : "PropertyAssignment";
        const definitions = partition.symbols.filter((symbol) => symbol.name === name && symbol.kind === expectedKind);
        expect(definitions, name).toHaveLength(1);
        expect(partition.edges.some((edge) => edge.targetSymbolId === definitions[0]!.id), name).toBe(true);
      }
      expect(partition.symbols.some((symbol) => symbol.name === "3" && symbol.kind === "PropertyAssignment")).toBe(true);
      expect(partition.symbols.some((symbol) => symbol.name === "computed")).toBe(false);
      expect(partition.edges.some((edge) => edge.resolution === "unknown" && content.slice(edge.source.start, edge.source.end).includes("computed"))).toBe(true);
      expect(partition.coverage.status).toBe("partial");
      const emitted = new Set(partition.symbols.map((symbol) => symbol.id));
      expect(partition.edges.filter((edge) => edge.resolution === "resolved" && edge.targetSymbolId !== undefined).every((edge) => emitted.has(edge.targetSymbolId!))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("tracks an overload implementation body under one canonical symbol", () => {
    const root = mkdtempSync(join(tmpdir(), "projector-ts-overload-"));
    try {
      mkdirSync(join(root, "src"));
      const declaration = (value: number) =>
        `export function choose(input: number): number;\nexport function choose(input: number): number { return input + ${value}; }\n`;
      const caller = "import { choose } from './a.js';\nexport const selected = choose(1);\n";
      writeFileSync(join(root, "src", "a.ts"), declaration(1));
      writeFileSync(join(root, "src", "b.ts"), caller);
      const options = { repositoryRoot: root, binding: { checkoutId: "test", worktreeDigest: "tree", projectKey: "overload" } };
      const provider = new TypeScriptCodeProvider();
      const initial = provider.update([
        { path: "src/a.ts", content: declaration(1), contentHash: "one" },
        { path: "src/b.ts", content: caller, contentHash: "caller" },
      ], options);
      const first = initial.partitions[0]!.symbols.filter((symbol) => symbol.name === "choose");
      expect(first).toHaveLength(1);
      expect(first[0]!.bodyHash).toBeDefined();
      expect(initial.partitions[0]!.edges.some((edge) => edge.kind === "reference" && edge.sourceSymbolId === first[0]!.id && edge.targetSymbolId !== undefined)).toBe(true);
      expect(initial.partitions[1]!.edges.some((edge) => edge.kind === "call" && edge.targetSymbolId === first[0]!.id)).toBe(true);
      writeFileSync(join(root, "src", "a.ts"), declaration(2));
      const changed = provider.update([
        { path: "src/a.ts", content: declaration(2), contentHash: "two" },
        { path: "src/b.ts", content: caller, contentHash: "caller" },
      ], options);
      const second = changed.partitions[0]!.symbols.filter((symbol) => symbol.name === "choose");
      expect(second).toHaveLength(1);
      expect(second[0]!.id).toBe(first[0]!.id);
      expect(second[0]!.declarationHash).toBe(first[0]!.declarationHash);
      expect(second[0]!.bodyHash).not.toBe(first[0]!.bodyHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("treats inherited options as configuration rather than another workspace project", () => {
    const configurations = [
      {
        path: "tsconfig.base.json",
        content: '{"compilerOptions":{"strict":true}}',
      },
      { path: "tsconfig.shared.json", content: '{"compilerOptions":{}}' },
      {
        path: "tsconfig.json",
        content:
          '{"files":[],"references":[{"path":"packages/a"},{"path":"tsconfig.shared.json"}]}',
      },
      {
        path: "packages/a/tsconfig.json",
        content:
          '{"extends":["../../tsconfig.base.json","../../tsconfig.shared.json"],"include":["src"]}',
      },
      {
        path: "tsconfig.tests.json",
        content: '{"extends":"./tsconfig.base.json","include":["tests"]}',
      },
    ];
    expect(discoverTypeScriptProjects(configurations)).toEqual([
      "packages/a/tsconfig.json",
      "tsconfig.json",
      "tsconfig.shared.json",
      "tsconfig.tests.json",
    ]);
  });
  it("resolves definitions, references and calls through project config", () => {
    const root = mkdtempSync(join(tmpdir(), "projector-ts-code-"));
    try {
      mkdirSync(join(root, "src"));
      writeFileSync(
        join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            module: "NodeNext",
            moduleResolution: "NodeNext",
            target: "ES2024",
            strict: true,
          },
          include: ["src/**/*.ts"],
        }),
      );
      const files = [
        {
          path: "src/a.ts",
          content:
            "export function greet(name: string): string { return name; }\n",
          contentHash: "a",
        },
        {
          path: "src/b.ts",
          content:
            "import { greet } from './a.js';\nexport const value = greet('hi');\n",
          contentHash: "b",
        },
      ];
      for (const file of files)
        writeFileSync(join(root, file.path), file.content);
      const provider = new TypeScriptCodeProvider();
      const options = {
        repositoryRoot: root,
        configPath: "tsconfig.json",
        binding: {
          checkoutId: "test",
          worktreeDigest: "tree",
          projectKey: "tsconfig.json",
        },
      };
      const result = provider.update(files, options);
      const greet = result.partitions[0]!.symbols.find(
        (symbol) => symbol.name === "greet",
      );
      expect(greet).toBeDefined();
      expect(
        result.partitions[1]!.symbols.some((symbol) => symbol.id === greet!.id),
      ).toBe(false);
      expect(
        result.partitions[1]!.symbols.some((symbol) => symbol.name === "greet"),
      ).toBe(false);
      expect(result.partitions[1]!.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "call",
            targetSymbolId: greet!.id,
            resolution: "resolved",
          }),
        ]),
      );
      expect(
        result.binding.configInputs.some(
          (input) => input.path === "tsconfig.json",
        ),
      ).toBe(true);
      expect(verifyCodeInputBinding(result.binding, root)).toBe(true);
      expect(() => provider.update(files, { ...options, maxProofBytes: 1 })).toThrow(/maxProofBytes/);
      expect(provider.update(files, options)).toBe(result);
      const changed = files.map((file) =>
        file.path === "src/a.ts"
          ? {
              ...file,
              content:
                "export function greet(name: string): string { return name.trim(); }\n",
              contentHash: "a2",
            }
          : file,
      );
      writeFileSync(join(root, "src/a.ts"), changed[0]!.content);
      const revised = provider.update(changed, options);
      const revisedGreet = revised.partitions[0]!.symbols.find(
        (symbol) => symbol.name === "greet",
      )!;
      expect(revisedGreet.declarationHash).toBe(greet!.declarationHash);
      expect(revisedGreet.bodyHash).not.toBe(greet!.bodyHash);
      expect(verifyCodeInputBinding(result.binding, root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("invalidates resolution after an ignored package is installed", () => {
    const root = mkdtempSync(join(tmpdir(), "projector-ts-package-"));
    try {
      mkdirSync(join(root, "src"));
      const file = {
        path: "src/main.ts",
        content:
          "import { value } from 'new-package';\nexport const result = value;\n",
        contentHash: "main",
      };
      writeFileSync(join(root, file.path), file.content);
      const provider = new TypeScriptCodeProvider();
      const options = {
        repositoryRoot: root,
        binding: {
          checkoutId: "test",
          worktreeDigest: "tree",
          projectKey: "package",
        },
      };
      const before = provider.update([file], options);
      expect(before.binding.status).toBe("verified");
      expect(
        CodeInputBindingSchema.parse(before.binding).directoryProbes?.every(
          (probe) => probe.path.length > 0,
        ),
      ).toBe(true);
      expect(verifyCodeInputBinding(before.binding, root)).toBe(true);
      mkdirSync(join(root, "node_modules", "new-package"), { recursive: true });
      writeFileSync(
        join(root, "node_modules", "new-package", "package.json"),
        JSON.stringify({ name: "new-package", types: "index.d.ts" }),
      );
      writeFileSync(
        join(root, "node_modules", "new-package", "index.d.ts"),
        "export declare const value: number;\n",
      );
      expect(verifyCodeInputBinding(before.binding, root)).toBe(false);
      const after = provider.update([file], options);
      expect(after).not.toBe(before);
      expect(after.binding.status).toBe("verified");
      expect(
        after.binding.resolutionInputs.some((input) =>
          input.path.endsWith("node_modules/new-package/index.d.ts"),
        ),
      ).toBe(true);
      expect(
        after.partitions[0]!.edges.some(
          (edge) => edge.kind === "reference" && edge.resolution === "unknown",
        ),
      ).toBe(true);
      expect(after.partitions[0]!.coverage.status).toBe("partial");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("reports external global references as partial coverage", () => {
    const root = mkdtempSync(join(tmpdir(), "projector-ts-global-"));
    try {
      const file = {
        path: "main.ts",
        content: "export const result = Promise.resolve(1);\n",
        contentHash: "main",
      };
      writeFileSync(join(root, file.path), file.content);
      const result = new TypeScriptCodeProvider().update([file], {
        repositoryRoot: root,
        binding: {
          checkoutId: "test",
          worktreeDigest: "tree",
          projectKey: "global",
        },
      });
      expect(
        result.partitions[0]!.edges.some(
          (edge) => edge.kind === "reference" && edge.resolution === "unknown",
        ),
      ).toBe(true);
      expect(result.partitions[0]!.coverage.status).toBe("partial");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
