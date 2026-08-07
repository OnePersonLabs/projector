import { dirname, extname, posix } from "node:path";

import type { AnalyzerFailure, SourceClass } from "@projector/core";

import type { InventoryEntry } from "../filesystem/inventory.js";

export interface ModuleDependencyFact {
  readonly sourceClass: SourceClass;
  readonly importerPath: string;
  readonly specifier: string;
  readonly resolvedPath?: string;
  readonly importedBindings: string[];
}

export interface TestTargetFact {
  readonly sourceClass: SourceClass;
  readonly testPath: string;
  readonly targetPath: string;
}

export interface JavaScriptFileFacts {
  readonly path: string;
  readonly exports: string[];
  readonly lifecycleExports: string[];
  readonly testNames: string[];
  readonly normalizedSemantics: string;
}

export interface JavaScriptFacts {
  readonly files: JavaScriptFileFacts[];
  readonly dependencies: ModuleDependencyFact[];
  readonly testTargets: TestTargetFact[];
  readonly failures: AnalyzerFailure[];
}

const sourceExtensions = [".mjs", ".js", ".cjs", ".mts", ".ts"];
const lifecycleNames = new Set(["onPreTool", "onPostTool", "onSessionStart", "onSessionEnd"]);

function stripComments(content: string): string {
  let result = "";
  let index = 0;
  let quote: "'" | "\"" | "`" | undefined;
  let escaped = false;
  while (index < content.length) {
    const character = content[index]!;
    const next = content[index + 1];
    if (quote !== undefined) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      index += 1;
      continue;
    }
    if (character === "'" || character === "\"" || character === "`") {
      quote = character;
      result += character;
      index += 1;
      continue;
    }
    if (character === "/" && next === "/") {
      index += 2;
      while (index < content.length && content[index] !== "\n") index += 1;
      result += "\n";
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) index += 1;
      index = Math.min(index + 2, content.length);
      result += " ";
      continue;
    }
    result += character;
    index += 1;
  }
  return result;
}

export function normalizeJavaScriptSemantics(content: string): string {
  const commentFree = stripComments(content);
  let result = "";
  let quote: "'" | "\"" | "`" | undefined;
  let escaped = false;
  for (const character of commentFree) {
    if (quote !== undefined) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === "\"" || character === "`") {
      quote = character;
      result += character;
      continue;
    }
    if (!/\s/u.test(character)) result += character;
  }
  return result;
}

function extractExports(content: string): string[] {
  const exports = new Set<string>();
  const pattern = /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gu;
  for (const match of content.matchAll(pattern)) {
    if (match[1] !== undefined) exports.add(match[1]);
  }
  return [...exports].sort();
}

function extractTestNames(content: string): string[] {
  return [...content.matchAll(/\b(?:test|it)\s*\(\s*["'`]([^"'`]+)["'`]/gu)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort();
}

function importedBindings(statement: string): string[] {
  const bindings = new Set<string>();
  const braces = /\{([^}]+)\}/u.exec(statement)?.[1];
  if (braces !== undefined) {
    for (const part of braces.split(",")) {
      const name = part.trim().split(/\s+as\s+/u)[0];
      if (name !== undefined && name.length > 0) bindings.add(name);
    }
  }
  const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/u.exec(statement)?.[1];
  if (namespace !== undefined) bindings.add(namespace);
  return [...bindings].sort();
}

function resolveLocalImport(importerPath: string, specifier: string, paths: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = posix.normalize(posix.join(dirname(importerPath).split("\\").join("/"), specifier));
  const candidates = extname(base).length > 0
    ? [base]
    : [...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => `${base}/index${extension}`)];
  return candidates.find((candidate) => paths.has(candidate));
}

export function analyzeJavaScript(entries: readonly InventoryEntry[]): JavaScriptFacts {
  const sourceEntries = entries.filter((entry) => sourceExtensions.some((extension) => entry.path.endsWith(extension)));
  const paths = new Set(entries.map((entry) => entry.path));
  const files: JavaScriptFileFacts[] = [];
  const dependencies: ModuleDependencyFact[] = [];
  const failures: AnalyzerFailure[] = [];

  for (const entry of sourceEntries) {
    const clean = stripComments(entry.content);
    const exports = extractExports(clean);
    files.push({
      path: entry.path,
      exports,
      lifecycleExports: exports.filter((name) => lifecycleNames.has(name)),
      testNames: extractTestNames(clean),
      normalizedSemantics: normalizeJavaScriptSemantics(entry.content),
    });
    const importPattern = /\bimport\s+(?:([\s\S]*?)\s+from\s+)?["']([^"']+)["']/gu;
    for (const match of clean.matchAll(importPattern)) {
      const statement = match[1] ?? "";
      const specifier = match[2];
      if (specifier === undefined) continue;
      const resolvedPath = resolveLocalImport(entry.path, specifier, paths);
      dependencies.push({
        sourceClass: "derived",
        importerPath: entry.path,
        specifier,
        ...(resolvedPath === undefined ? {} : { resolvedPath }),
        importedBindings: importedBindings(statement),
      });
      if (specifier.startsWith(".") && resolvedPath === undefined) {
        failures.push({
          analyzerId: "projector.javascript-local",
          capability: "module-resolution",
          scope: entry.path,
          message: `Cannot resolve local module ${specifier}`,
          recoverable: true,
          affectedClaimKinds: ["dependency", "test-target", "hook-reachability"],
        });
      }
    }
  }

  dependencies.sort((left, right) => left.importerPath.localeCompare(right.importerPath) || left.specifier.localeCompare(right.specifier));
  const testTargets = dependencies
    .filter((dependency): dependency is ModuleDependencyFact & { resolvedPath: string } =>
      /\.test\.(?:mjs|js|cjs|mts|ts)$/u.test(dependency.importerPath) && dependency.resolvedPath !== undefined)
    .map((dependency): TestTargetFact => ({
      sourceClass: "derived",
      testPath: dependency.importerPath,
      targetPath: dependency.resolvedPath,
    }))
    .sort((left, right) => left.testPath.localeCompare(right.testPath) || left.targetPath.localeCompare(right.targetPath));
  return { files, dependencies, testTargets, failures };
}
