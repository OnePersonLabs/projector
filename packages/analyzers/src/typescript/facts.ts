import { extname, posix } from "node:path";

import type { AnalyzerFailure, SourceClass } from "@projector/core";

import type { InventoryEntry } from "../filesystem/inventory.js";
import { compareCodePoint } from "../ordering.js";

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

type TokenKind = "identifier" | "number" | "string" | "template" | "regex" | "punctuator" | "line-break";

interface Token {
  readonly kind: TokenKind;
  readonly value: string;
}

const sourceExtensions = [".mjs", ".js", ".cjs", ".mts", ".ts"];
const lifecycleNames = new Set(["onPreTool", "onPostTool", "onSessionStart", "onSessionEnd"]);
const operators = [
  ">>>=", "===", "!==", "**=", ">>>", "<<=", ">>=", "=>", "==", "!=", "<=", ">=", "++", "--", "&&", "||", "??", "?.", "**", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", "...",
].sort((left, right) => right.length - left.length);

function pushLineBreak(tokens: Token[]): void {
  if (tokens.at(-1)?.kind !== "line-break") tokens.push({ kind: "line-break", value: "\n" });
}

function canStartRegex(previous: Token | undefined): boolean {
  if (previous === undefined || previous.kind === "line-break") return true;
  if (previous.kind === "identifier") {
    return ["return", "throw", "case", "delete", "void", "typeof", "instanceof", "in", "of", "yield", "await"].includes(previous.value);
  }
  return previous.kind === "punctuator" && /^[([{=,:;!&|?+\-*%^~<>]$/u.test(previous.value);
}

function scanQuoted(content: string, start: number, quote: "'" | "\"" | "`"): number {
  let index = start + 1;
  let escaped = false;
  while (index < content.length) {
    const character = content[index]!;
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === quote) return index + 1;
    index += 1;
  }
  return content.length;
}

function scanRegex(content: string, start: number): number {
  let index = start + 1;
  let escaped = false;
  let characterClass = false;
  while (index < content.length) {
    const character = content[index]!;
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === "[") characterClass = true;
    else if (character === "]") characterClass = false;
    else if (character === "/" && !characterClass) {
      index += 1;
      while (index < content.length && /[A-Za-z]/u.test(content[index]!)) index += 1;
      return index;
    } else if (character === "\n" || character === "\r") return start + 1;
    index += 1;
  }
  return start + 1;
}

function lexJavaScript(content: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < content.length) {
    const character = content[index]!;
    const next = content[index + 1];
    if (/\s/u.test(character)) {
      let hasLineBreak = false;
      while (index < content.length && /\s/u.test(content[index]!)) {
        if (content[index] === "\n" || content[index] === "\r") hasLineBreak = true;
        index += 1;
      }
      if (hasLineBreak) pushLineBreak(tokens);
      continue;
    }
    if (character === "/" && next === "/") {
      index += 2;
      while (index < content.length && content[index] !== "\n" && content[index] !== "\r") index += 1;
      pushLineBreak(tokens);
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      let hasLineBreak = false;
      while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
        if (content[index] === "\n" || content[index] === "\r") hasLineBreak = true;
        index += 1;
      }
      index = Math.min(index + 2, content.length);
      if (hasLineBreak) pushLineBreak(tokens);
      continue;
    }
    if (character === "'" || character === "\"") {
      const end = scanQuoted(content, index, character);
      tokens.push({ kind: "string", value: content.slice(index, end) });
      index = end;
      continue;
    }
    if (character === "`") {
      const end = scanQuoted(content, index, character);
      tokens.push({ kind: "template", value: content.slice(index, end) });
      index = end;
      continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      const start = index;
      index += 1;
      while (index < content.length && /[\w$]/u.test(content[index]!)) index += 1;
      tokens.push({ kind: "identifier", value: content.slice(start, index) });
      continue;
    }
    if (/\d/u.test(character)) {
      const start = index;
      index += 1;
      while (index < content.length && /[\w.]/u.test(content[index]!)) index += 1;
      tokens.push({ kind: "number", value: content.slice(start, index) });
      continue;
    }
    const previous = [...tokens].reverse().find((token) => token.kind !== "line-break");
    if (character === "/" && canStartRegex(previous)) {
      const end = scanRegex(content, index);
      if (end > index + 1) {
        tokens.push({ kind: "regex", value: content.slice(index, end) });
        index = end;
        continue;
      }
    }
    const operator = operators.find((candidate) => content.startsWith(candidate, index));
    if (operator !== undefined) {
      tokens.push({ kind: "punctuator", value: operator });
      index += operator.length;
      continue;
    }
    tokens.push({ kind: "punctuator", value: character });
    index += 1;
  }
  while (tokens[0]?.kind === "line-break") tokens.shift();
  while (tokens.at(-1)?.kind === "line-break") tokens.pop();
  return tokens;
}

export function normalizeJavaScriptSemantics(content: string): string {
  return lexJavaScript(content)
    .map((token) => `${token.kind.length}:${token.kind}:${token.value.length}:${token.value}`)
    .join("|");
}

function stringLiteralValue(raw: string): string {
  const quote = raw[0];
  const body = raw.slice(1, -1);
  if (quote === "\"") {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return body;
    }
  }
  return body.replace(/\\([\\'])/gu, "$1");
}

function significantTokens(tokens: readonly Token[]): Token[] {
  return tokens.filter((token) => token.kind !== "line-break");
}

function extractExports(tokens: readonly Token[]): string[] {
  const significant = significantTokens(tokens);
  const exports = new Set<string>();
  for (let index = 0; index < significant.length; index += 1) {
    if (significant[index]?.kind !== "identifier" || significant[index]?.value !== "export") continue;
    let cursor = index + 1;
    if (significant[cursor]?.value === "default") cursor += 1;
    if (significant[cursor]?.value === "async") cursor += 1;
    if (!["function", "class", "const", "let", "var"].includes(significant[cursor]?.value ?? "")) continue;
    const name = significant[cursor + 1];
    if (name?.kind === "identifier") exports.add(name.value);
  }
  return [...exports].sort(compareCodePoint);
}

function extractTestNames(tokens: readonly Token[]): string[] {
  const significant = significantTokens(tokens);
  const names = new Set<string>();
  for (let index = 0; index < significant.length - 2; index += 1) {
    const token = significant[index];
    if (token?.kind !== "identifier" || !["test", "it"].includes(token.value)) continue;
    if (significant[index - 1]?.value === "." || significant[index + 1]?.value !== "(") continue;
    const name = significant[index + 2];
    if (name?.kind === "string") names.add(stringLiteralValue(name.value));
  }
  return [...names].sort(compareCodePoint);
}

interface ImportSyntax {
  readonly specifier: string;
  readonly bindings: string[];
}

function extractImports(tokens: readonly Token[]): ImportSyntax[] {
  const significant = significantTokens(tokens);
  const imports: ImportSyntax[] = [];
  for (let index = 0; index < significant.length; index += 1) {
    const token = significant[index];
    if (token?.kind !== "identifier" || token.value !== "import") continue;
    if (significant[index - 1]?.value === "." || ["(", "."].includes(significant[index + 1]?.value ?? "")) continue;
    const direct = significant[index + 1];
    if (direct?.kind === "string") {
      imports.push({ specifier: stringLiteralValue(direct.value), bindings: [] });
      continue;
    }
    const bindings = new Set<string>();
    for (let cursor = index + 1; cursor < significant.length; cursor += 1) {
      const current = significant[cursor];
      if (current?.value === ";") break;
      if (current?.kind === "identifier" && current.value === "from") {
        const specifier = significant[cursor + 1];
        if (specifier?.kind === "string") {
          imports.push({ specifier: stringLiteralValue(specifier.value), bindings: [...bindings].sort(compareCodePoint) });
        }
        index = cursor + 1;
        break;
      }
      if (current?.kind === "identifier" && !["type", "as"].includes(current.value)) bindings.add(current.value);
    }
  }
  return imports;
}

function resolveLocalImport(importerPath: string, specifier: string, paths: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(importerPath), specifier));
  const candidates = extname(base).length > 0
    ? [base]
    : [...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => `${base}/index${extension}`)];
  return candidates.find((candidate) => paths.has(candidate));
}

export function analyzeJavaScript(entries: readonly InventoryEntry[]): JavaScriptFacts {
  const sourceEntries = entries.filter((entry) => entry.kind === "file" && sourceExtensions.some((extension) => entry.path.endsWith(extension)));
  const paths = new Set(entries.filter((entry) => entry.kind === "file").map((entry) => entry.path));
  const files: JavaScriptFileFacts[] = [];
  const dependencies: ModuleDependencyFact[] = [];
  const failures: AnalyzerFailure[] = [];

  for (const entry of sourceEntries) {
    const tokens = lexJavaScript(entry.content);
    const exports = extractExports(tokens);
    files.push({
      path: entry.path,
      exports,
      lifecycleExports: exports.filter((name) => lifecycleNames.has(name)),
      testNames: extractTestNames(tokens),
      normalizedSemantics: normalizeJavaScriptSemantics(entry.content),
    });
    for (const syntax of extractImports(tokens)) {
      const resolvedPath = resolveLocalImport(entry.path, syntax.specifier, paths);
      dependencies.push({
        sourceClass: "derived",
        importerPath: entry.path,
        specifier: syntax.specifier,
        ...(resolvedPath === undefined ? {} : { resolvedPath }),
        importedBindings: syntax.bindings,
      });
      if (syntax.specifier.startsWith(".") && resolvedPath === undefined) {
        failures.push({
          analyzerId: "projector.javascript-local",
          capability: "module-resolution",
          scope: entry.path,
          message: `Cannot resolve local module ${syntax.specifier}`,
          recoverable: true,
          affectedClaimKinds: ["dependency", "test-target", "hook-reachability"],
        });
      }
    }
  }

  dependencies.sort((left, right) => compareCodePoint(left.importerPath, right.importerPath) || compareCodePoint(left.specifier, right.specifier));
  const testTargets = dependencies
    .filter((dependency): dependency is ModuleDependencyFact & { resolvedPath: string } =>
      /\.test\.(?:mjs|js|cjs|mts|ts)$/u.test(dependency.importerPath) && dependency.resolvedPath !== undefined)
    .map((dependency): TestTargetFact => ({
      sourceClass: "derived",
      testPath: dependency.importerPath,
      targetPath: dependency.resolvedPath,
    }))
    .sort((left, right) => compareCodePoint(left.testPath, right.testPath) || compareCodePoint(left.targetPath, right.targetPath));
  files.sort((left, right) => compareCodePoint(left.path, right.path));
  return { files, dependencies, testTargets, failures };
}
