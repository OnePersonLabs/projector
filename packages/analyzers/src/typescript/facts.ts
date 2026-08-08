import { extname, posix } from "node:path";

import { hashFramedDomain, type AnalyzerFailure, type ContentHash, type SourceClass } from "@projector/core";

import type { InventoryEntry } from "../filesystem/inventory.js";
import { compareCodePoint } from "../ordering.js";

export interface ModuleDependencyFact {
  readonly sourceClass: SourceClass;
  readonly importerPath: string;
  readonly specifier: string;
  readonly resolvedPath?: string;
  readonly importedBindings: string[];
  readonly bindings: ImportBindingFact[];
  readonly typeOnly: boolean;
}

export interface SourceLocationFact {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly endOffset: number;
}

export interface ImportBindingFact {
  readonly imported: string;
  readonly local: string;
  readonly typeOnly: boolean;
}

export interface ExportFact {
  readonly exportedName?: string;
  readonly localName?: string;
  readonly from?: string;
  readonly typeOnly: boolean;
  readonly default: boolean;
  readonly wildcard: boolean;
  readonly location: SourceLocationFact;
}

export interface SemanticDeclarationFact {
  readonly id: string;
  readonly scopeKey: string;
  readonly name: string;
  readonly kind: "function" | "class" | "interface" | "type" | "enum" | "variable" | "namespace";
  readonly exported: boolean;
  readonly default: boolean;
  readonly overload: boolean;
  readonly location: SourceLocationFact;
  readonly semanticHash: ContentHash;
}

export interface EventSyntaxFact {
  readonly subjectId: string;
  readonly semanticKey: string;
  readonly receiver: string;
  readonly scopeKey: string;
  readonly participantId: string;
  readonly role: "producer" | "consumer";
  readonly dynamic: boolean;
  readonly location: SourceLocationFact;
  readonly evidenceId: string;
  readonly artifactHash: ContentHash;
}

export interface EventUncertaintyFact {
  readonly receiver: string;
  readonly role: "producer" | "consumer";
  readonly scopeKey: string;
  readonly participantId: string;
  readonly evidenceId: string;
  readonly artifactHash: ContentHash;
}

export interface ContractSyntaxFact {
  readonly subjectId: string;
  readonly semanticKey: string;
  readonly scopeKey: string;
  readonly participantId: string;
  readonly role: "producer" | "consumer";
  readonly location: SourceLocationFact;
  readonly evidenceId: string;
  readonly artifactHash: ContentHash;
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
  readonly scopeKey: string;
  readonly declarations: SemanticDeclarationFact[];
  readonly exportFacts: ExportFact[];
  readonly unknowns: string[];
}

export interface JavaScriptFacts {
  readonly files: JavaScriptFileFacts[];
  readonly dependencies: ModuleDependencyFact[];
  readonly testTargets: TestTargetFact[];
  readonly events: EventSyntaxFact[];
  readonly eventUncertainties: EventUncertaintyFact[];
  readonly contracts: ContractSyntaxFact[];
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
  readonly bindings: ImportBindingFact[];
  readonly typeOnly: boolean;
}

function sourceLocation(content: string, offset: number, endOffset: number): SourceLocationFact {
  const before = content.slice(0, offset);
  const lines = before.split(/\r?\n/u);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1, offset, endOffset };
}

function parseNamedBindings(body: string, statementTypeOnly: boolean): ImportBindingFact[] {
  return body.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const typeOnly = statementTypeOnly || part.startsWith("type ");
    const normalized = part.replace(/^type\s+/u, "");
    const [imported = "", local = imported] = normalized.split(/\s+as\s+/u);
    return { imported: imported.trim(), local: local.trim(), typeOnly };
  }).sort((left, right) => compareCodePoint(left.imported, right.imported) || compareCodePoint(left.local, right.local));
}

function extractImportSyntax(tokens: readonly Token[]): ImportSyntax[] {
  const imports: ImportSyntax[] = [];
  const values = significantTokens(tokens);
  for (let index = 0; index < values.length; index += 1) {
    if (values[index]?.kind !== "identifier" || values[index]?.value !== "import" || values[index + 1]?.value === "(" || values[index - 1]?.value === ".") continue;
    if (values[index + 1]?.kind === "string") { imports.push({ specifier: stringLiteralValue(values[index + 1]!.value), bindings: [], typeOnly: false }); continue; }
    let cursor = index + 1;
    const typeOnly = values[cursor]?.value === "type";
    if (typeOnly) cursor += 1;
    const clauseStart = cursor;
    while (cursor < values.length && values[cursor]?.value !== "from" && values[cursor]?.value !== ";") cursor += 1;
    if (values[cursor]?.value !== "from" || values[cursor + 1]?.kind !== "string") continue;
    const clause = values.slice(clauseStart, cursor);
    const bindings: ImportBindingFact[] = [];
    if (clause[0]?.kind === "identifier" && clause[0]?.value !== "type") bindings.push({ imported: "default", local: clause[0]!.value, typeOnly });
    for (let part = 0; part < clause.length; part += 1) {
      if (clause[part]?.value === "*" && clause[part + 1]?.value === "as" && clause[part + 2]?.kind === "identifier") bindings.push({ imported: "*", local: clause[part + 2]!.value, typeOnly });
      if (clause[part]?.value !== "{") continue;
      part += 1;
      while (part < clause.length && clause[part]?.value !== "}") {
        const bindingTypeOnly = typeOnly || clause[part]?.value === "type";
        if (clause[part]?.value === "type") part += 1;
        const imported = clause[part]?.kind === "identifier" ? clause[part]!.value : undefined;
        if (imported !== undefined) {
          const local = clause[part + 1]?.value === "as" && clause[part + 2]?.kind === "identifier" ? clause[part + 2]!.value : imported;
          bindings.push({ imported, local, typeOnly: bindingTypeOnly });
        }
        while (part < clause.length && ![",", "}"].includes(clause[part]?.value ?? "")) part += 1;
        if (clause[part]?.value === ",") part += 1;
      }
    }
    imports.push({ specifier: stringLiteralValue(values[cursor + 1]!.value), bindings: bindings.sort((a, b) => compareCodePoint(a.imported, b.imported) || compareCodePoint(a.local, b.local)), typeOnly });
    index = cursor + 1;
  }
  return imports;
}

function packageScopes(entries: readonly InventoryEntry[]): Map<string, string> {
  const manifests = entries.filter(({ path }) => posix.basename(path) === "package.json").map((entry) => {
    try {
      const parsed = JSON.parse(entry.content) as { name?: unknown };
      return { directory: posix.dirname(entry.path) === "." ? "" : posix.dirname(entry.path), name: typeof parsed.name === "string" ? parsed.name : undefined };
    } catch { return { directory: posix.dirname(entry.path), name: undefined }; }
  }).filter((item): item is { directory: string; name: string } => item.name !== undefined)
    .sort((left, right) => right.directory.length - left.directory.length || compareCodePoint(left.name, right.name));
  const result = new Map<string, string>();
  for (const entry of entries) {
    const manifest = manifests.find(({ directory }) => directory === "" || entry.path === directory || entry.path.startsWith(`${directory}/`));
    result.set(entry.path, manifest?.name ?? "local-repository");
  }
  return result;
}

function maskCommentsAndLiterals(content: string): string {
  let result = ""; let index = 0;
  while (index < content.length) {
    const character = content[index]!; const next = content[index + 1];
    if (character === "/" && next === "/") { while (index < content.length && !/[\r\n]/u.test(content[index]!)) { result += " "; index += 1; } continue; }
    if (character === "/" && next === "*") { result += "  "; index += 2; while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) { result += /[\r\n]/u.test(content[index]!) ? content[index]! : " "; index += 1; } if (index < content.length) { result += "  "; index += 2; } continue; }
    if (character === "'" || character === "\"" || character === "`") { const end = scanQuoted(content, index, character); result += " ".repeat(end - index); index = end; continue; }
    result += character; index += 1;
  }
  return result;
}

function extractDeclarations(content: string, scopeKey: string): SemanticDeclarationFact[] {
  const declarations: SemanticDeclarationFact[] = [];
  const syntax = maskCommentsAndLiterals(content);
  const pattern = /\b(export\s+)?(default\s+)?(?:declare\s+)?(?:async\s+)?(function|class|interface|type|enum|namespace|const|let|var)\s+([A-Za-z_$][\w$]*)/gu;
  for (const match of syntax.matchAll(pattern)) {
    const rawKind = match[3]!;
    const kind: SemanticDeclarationFact["kind"] = ["const", "let", "var"].includes(rawKind) ? "variable" : rawKind as SemanticDeclarationFact["kind"];
    const name = match[4]!;
    const exported = match[1] !== undefined;
    const isDefault = match[2] !== undefined;
    const tail = content.slice((match.index ?? 0) + match[0].length).split(/\r?\n/u)[0] ?? "";
    const overload = rawKind === "function" && /^[^{]*;/u.test(tail);
    const semantic = { scopeKey, name, kind, exported, default: isDefault, overload };
    const semanticHash = hashFramedDomain("typescript-semantic-declaration", semantic);
    declarations.push({ id: `ts_decl_${hashFramedDomain("typescript-semantic-declaration-identity", { scopeKey, name, kind }).slice(-32)}`, ...semantic, location: sourceLocation(content, match.index ?? 0, (match.index ?? 0) + match[0].length), semanticHash });
  }
  return declarations.sort((left, right) => compareCodePoint(left.id, right.id) || left.location.offset - right.location.offset);
}

function extractExportFacts(content: string, declarations: readonly SemanticDeclarationFact[]): ExportFact[] {
  const facts: ExportFact[] = declarations.filter(({ exported }) => exported).map((declaration) => ({ exportedName: declaration.default ? "default" : declaration.name, localName: declaration.name, typeOnly: declaration.kind === "type" || declaration.kind === "interface", default: declaration.default, wildcard: false, location: declaration.location }));
  const named = /\bexport\s+(type\s+)?\{([^}]*)\}(?:\s+from\s+(["'])([^"']+)\3)?/gu;
  for (const match of content.matchAll(named)) for (const binding of parseNamedBindings(match[2] ?? "", match[1] !== undefined)) facts.push({ exportedName: binding.local, localName: binding.imported, ...(match[4] === undefined ? {} : { from: match[4] }), typeOnly: binding.typeOnly, default: binding.local === "default", wildcard: false, location: sourceLocation(content, match.index ?? 0, (match.index ?? 0) + match[0].length) });
  const wildcard = /\bexport\s+\*\s+from\s+(["'])([^"']+)\1/gu;
  for (const match of content.matchAll(wildcard)) facts.push({ from: match[2]!, typeOnly: false, default: false, wildcard: true, location: sourceLocation(content, match.index ?? 0, (match.index ?? 0) + match[0].length) });
  return facts.sort((left, right) => compareCodePoint(left.exportedName ?? "*", right.exportedName ?? "*") || left.location.offset - right.location.offset);
}

function fileParticipantId(scopeKey: string, declarations: readonly SemanticDeclarationFact[], normalizedSemantics: string): string {
  const anchors = declarations.filter(({ exported }) => exported).map(({ name, kind }) => `${kind}:${name}`).sort(compareCodePoint);
  return `ts_participant_${hashFramedDomain("typescript-participant", { scopeKey, anchor: anchors.length > 0 ? anchors : normalizedSemantics }).slice(-32)}`;
}

function extractEvents(tokens: readonly Token[], content: string, scopeKey: string, participantId: string, artifactHash: ContentHash): { events: EventSyntaxFact[]; uncertainties: EventUncertaintyFact[]; unknowns: string[] } {
  const events: EventSyntaxFact[] = [];
  const uncertainties: EventUncertaintyFact[] = [];
  const unknowns: string[] = [];
  const values = significantTokens(tokens);
  for (let index = 0; index < values.length - 4; index += 1) {
    if (values[index]?.kind !== "identifier" || values[index + 1]?.value !== "." || values[index + 2]?.kind !== "identifier" || values[index + 3]?.value !== "(") continue;
    const receiver = values[index]!.value;
    const operation = values[index + 2]!.value;
    if (!["emit", "publish", "dispatchEvent", "on", "addEventListener", "subscribe"].includes(operation)) continue;
    const argument = values[index + 4];
    const role = ["emit", "publish", "dispatchEvent"].includes(operation) ? "producer" as const : "consumer" as const;
    if (argument?.kind !== "string") {
      const evidenceId = `event_uncertainty_${hashFramedDomain("event-uncertainty", { receiver, role, scopeKey, participantId }).slice(-32)}`;
      uncertainties.push({ receiver, role, scopeKey, participantId, evidenceId, artifactHash });
      unknowns.push(`dynamic event name for ${receiver}.${operation}`);
      continue;
    }
    const semanticKey = stringLiteralValue(argument.value);
    const subjectId = `event_${hashFramedDomain("event-subject", { receiver, semanticKey }).slice(-32)}`;
    const offset = content.indexOf(argument.value);
    const location = sourceLocation(content, Math.max(0, offset), Math.max(0, offset) + argument.value.length);
    events.push({ subjectId, semanticKey, receiver, scopeKey, participantId, role, dynamic: false, location, evidenceId: `event_evidence_${hashFramedDomain("event-evidence", { participantId, role, semanticKey, location }).slice(-32)}`, artifactHash });
  }
  if (values.some((token, index) => token.value === "import" && values[index + 1]?.value === "(")) unknowns.push("dynamic import cannot prove a static dependency");
  return { events: events.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role)), uncertainties: uncertainties.sort((left, right) => compareCodePoint(left.receiver, right.receiver) || compareCodePoint(left.participantId, right.participantId)), unknowns: [...new Set(unknowns)].sort(compareCodePoint) };
}

function resolveLocalImport(importerPath: string, specifier: string, paths: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(importerPath), specifier));
  const candidates = extname(base).length > 0
    ? [base, ...(base.endsWith(".js") ? [`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`] : []), ...(base.endsWith(".mjs") ? [`${base.slice(0, -4)}.mts`] : []), ...(base.endsWith(".cjs") ? [`${base.slice(0, -4)}.cts`] : [])]
    : [...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => `${base}/index${extension}`)];
  return candidates.find((candidate) => paths.has(candidate));
}

export function analyzeJavaScript(entries: readonly InventoryEntry[]): JavaScriptFacts {
  const sourceEntries = entries.filter((entry) => entry.kind === "file" && sourceExtensions.some((extension) => entry.path.endsWith(extension))).sort((left, right) => compareCodePoint(left.path, right.path));
  const paths = new Set(entries.filter((entry) => entry.kind === "file").map((entry) => entry.path));
  const scopes = packageScopes(entries);
  const files: JavaScriptFileFacts[] = [];
  const dependencies: ModuleDependencyFact[] = [];
  const events: EventSyntaxFact[] = [];
  const eventUncertainties: EventUncertaintyFact[] = [];
  const contracts: ContractSyntaxFact[] = [];
  const failures: AnalyzerFailure[] = [];

  for (const entry of sourceEntries) {
    const tokens = lexJavaScript(entry.content);
    const normalizedSemantics = normalizeJavaScriptSemantics(entry.content);
    const scopeKey = scopes.get(entry.path) ?? "local-repository";
    const declarations = extractDeclarations(entry.content, scopeKey);
    const exportFacts = extractExportFacts(entry.content, declarations);
    const exports = [...new Set(extractExports(tokens))].sort(compareCodePoint);
    const participantId = fileParticipantId(scopeKey, declarations, normalizedSemantics);
    const extractedEvents = extractEvents(tokens, entry.content, scopeKey, participantId, entry.contentHash);
    events.push(...extractedEvents.events);
    eventUncertainties.push(...extractedEvents.uncertainties);
    files.push({
      path: entry.path,
      exports,
      lifecycleExports: exports.filter((name) => lifecycleNames.has(name)),
      testNames: extractTestNames(tokens),
      normalizedSemantics,
      scopeKey,
      declarations,
      exportFacts,
      unknowns: extractedEvents.unknowns,
    });
    for (const syntax of extractImportSyntax(tokens)) {
      const resolvedPath = resolveLocalImport(entry.path, syntax.specifier, paths);
      dependencies.push({
        sourceClass: "derived",
        importerPath: entry.path,
        specifier: syntax.specifier,
        ...(resolvedPath === undefined ? {} : { resolvedPath }),
        importedBindings: [...new Set(syntax.bindings.map(({ imported }) => imported))].sort(compareCodePoint),
        bindings: syntax.bindings,
        typeOnly: syntax.typeOnly,
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

  const groupedDependencies = new Map<string, ModuleDependencyFact>();
  for (const dependency of dependencies) {
    const key = `${dependency.importerPath}\u0000${dependency.specifier}`;
    const existing = groupedDependencies.get(key);
    if (existing === undefined) groupedDependencies.set(key, dependency);
    else {
      const bindings = [...new Map([...existing.bindings, ...dependency.bindings].map((binding) => [`${binding.imported}\u0000${binding.local}\u0000${binding.typeOnly}`, binding])).values()]
        .sort((left, right) => compareCodePoint(left.imported, right.imported) || compareCodePoint(left.local, right.local));
      groupedDependencies.set(key, { ...existing, ...(existing.resolvedPath === undefined && dependency.resolvedPath !== undefined ? { resolvedPath: dependency.resolvedPath } : {}), bindings, importedBindings: [...new Set(bindings.map(({ imported }) => imported))].sort(compareCodePoint), typeOnly: existing.typeOnly && dependency.typeOnly });
    }
  }
  const normalizedDependencies = [...groupedDependencies.values()].sort((left, right) => compareCodePoint(left.importerPath, right.importerPath) || compareCodePoint(left.specifier, right.specifier));
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
  interface ContractSymbol { semanticKey: string; declaration: SemanticDeclarationFact; exportPath: string; location: SourceLocationFact }
  const declarationsByScope = new Map<string, Map<string, SemanticDeclarationFact>>();
  for (const file of files) {
    const declarations = declarationsByScope.get(file.scopeKey) ?? new Map<string, SemanticDeclarationFact>();
    for (const declaration of file.declarations.filter(({ kind, name }) => ["interface", "type", "class"].includes(kind) || name.endsWith("Schema"))) declarations.set(declaration.name, declaration);
    declarationsByScope.set(file.scopeKey, declarations);
  }
  const packageExports = new Map<string, Map<string, ContractSymbol>>();
  for (const file of files) {
    const exported = packageExports.get(file.scopeKey) ?? new Map<string, ContractSymbol>();
    for (const declaration of file.declarations.filter(({ exported, kind, name }) => exported && (["interface", "type", "class"].includes(kind) || name.endsWith("Schema")))) exported.set(declaration.name, { semanticKey: declaration.name, declaration, exportPath: file.path, location: declaration.location });
    for (const fact of file.exportFacts) {
      if (fact.exportedName === undefined || fact.localName === undefined || fact.wildcard) continue;
      const declaration = declarationsByScope.get(file.scopeKey)?.get(fact.localName);
      if (declaration !== undefined) exported.set(fact.exportedName, { semanticKey: fact.exportedName, declaration, exportPath: file.path, location: fact.location });
    }
    packageExports.set(file.scopeKey, exported);
  }
  for (const [scopeKey, exported] of [...packageExports.entries()].sort(([left], [right]) => compareCodePoint(left, right))) {
    for (const symbol of [...exported.values()].sort((left, right) => compareCodePoint(left.semanticKey, right.semanticKey))) {
      const exportFile = files.find(({ path }) => path === symbol.exportPath)!;
      const sourceEntry = sourceEntries.find(({ path }) => path === symbol.exportPath)!;
      const participantId = fileParticipantId(scopeKey, exportFile.declarations, exportFile.normalizedSemantics);
      const subjectId = `contract_${hashFramedDomain("public-contract-subject", { scopeKey, semanticKey: symbol.semanticKey }).slice(-32)}`;
      contracts.push({ subjectId, semanticKey: symbol.semanticKey, scopeKey, participantId, role: "producer", location: symbol.location, evidenceId: `contract_evidence_${hashFramedDomain("contract-evidence", { participantId, declarationId: symbol.declaration.id, semanticKey: symbol.semanticKey }).slice(-32)}`, artifactHash: sourceEntry.contentHash });
    }
  }
  for (const file of files) {
    const participantId = fileParticipantId(file.scopeKey, file.declarations, file.normalizedSemantics);
    const sourceEntry = sourceEntries.find(({ path }) => path === file.path)!;
    for (const dependency of normalizedDependencies.filter(({ importerPath }) => importerPath === file.path)) {
      const sourceScope = dependency.resolvedPath === undefined ? dependency.specifier : scopes.get(dependency.resolvedPath) ?? dependency.specifier;
      const exports = packageExports.get(sourceScope);
      if (exports === undefined) continue;
      for (const binding of dependency.bindings) {
        const symbol = exports.get(binding.imported);
        if (symbol === undefined) continue;
        const subjectId = `contract_${hashFramedDomain("public-contract-subject", { scopeKey: sourceScope, semanticKey: symbol.semanticKey }).slice(-32)}`;
        contracts.push({ subjectId, semanticKey: symbol.semanticKey, scopeKey: sourceScope, participantId, role: "consumer", location: sourceLocation(sourceEntry.content, 0, 0), evidenceId: `contract_evidence_${hashFramedDomain("contract-import-evidence", { participantId, sourceScope, imported: binding.imported, local: binding.local }).slice(-32)}`, artifactHash: sourceEntry.contentHash });
      }
    }
  }
  events.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role));
  contracts.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role));
  return { files, dependencies: normalizedDependencies, testTargets, events, eventUncertainties, contracts, failures };
}
