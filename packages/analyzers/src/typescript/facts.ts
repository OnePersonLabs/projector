import { extname, posix } from "node:path";

import { canonicalJson, DerivedObservationBudget, hashFramedCanonicalJsonChunks, hashFramedDomain, type AnalyzerFailure, type ContentHash, type SourceClass } from "@projector/core";

import type { InventoryEntry } from "../filesystem/inventory.js";
import { compareCodePoint } from "../ordering.js";
import { analyzeCompilerSyntax, type EventCallSyntax } from "./compiler-syntax.js";

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
  readonly semanticHash: ContentHash;
  readonly fallbackHash: ContentHash;
  readonly variantHash: ContentHash;
  readonly participantId: string;
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

const sourceExtensions = [".mjs", ".js", ".cjs", ".mts", ".cts", ".ts", ".tsx", ".jsx"];
const lifecycleNames = new Set(["onPreTool", "onPostTool", "onSessionStart", "onSessionEnd"]);
const operators = [
  ">>>=", "===", "!==", "**=", ">>>", "<<=", ">>=", "=>", "==", "!=", "<=", ">=", "++", "--", "&&", "||", "??", "?.", "**", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", "...",
].sort((left, right) => right.length - left.length);

function pushLineBreak(tokens: Token[], budget: DerivedObservationBudget, scope: string): number {
  if (tokens.at(-1)?.kind !== "line-break") { budget.reserve(66, "javascript-tokens", scope); tokens.push({ kind: "line-break", value: "\n" }); return 66; }
  return 0;
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

function lexJavaScript(content: string, budget: DerivedObservationBudget, scope: string): { tokens: Token[]; reservedBytes: number } {
  const tokens: Token[] = [];
  let reservedBytes = 0;
  let previous: Token | undefined;
  const pushToken = (kind: TokenKind, start: number, end: number): void => {
    const bytes = 64 + 2 * (end - start);
    budget.reserve(bytes, "javascript-tokens", scope); reservedBytes += bytes;
    const token = { kind, value: content.slice(start, end) };
    tokens.push(token); previous = token;
  };
  let index = 0;
  try {
  while (index < content.length) {
    const character = content[index]!;
    const next = content[index + 1];
    if (/\s/u.test(character)) {
      let hasLineBreak = false;
      while (index < content.length && /\s/u.test(content[index]!)) {
        if (content[index] === "\n" || content[index] === "\r") hasLineBreak = true;
        index += 1;
      }
      if (hasLineBreak) reservedBytes += pushLineBreak(tokens, budget, scope);
      continue;
    }
    if (character === "/" && next === "/") {
      index += 2;
      while (index < content.length && content[index] !== "\n" && content[index] !== "\r") index += 1;
      reservedBytes += pushLineBreak(tokens, budget, scope);
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
      if (hasLineBreak) reservedBytes += pushLineBreak(tokens, budget, scope);
      continue;
    }
    if (character === "'" || character === "\"") {
      const end = scanQuoted(content, index, character);
      pushToken("string", index, end);
      index = end;
      continue;
    }
    if (character === "`") {
      const end = scanQuoted(content, index, character);
      pushToken("template", index, end);
      index = end;
      continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      const start = index;
      index += 1;
      while (index < content.length && /[\w$]/u.test(content[index]!)) index += 1;
      pushToken("identifier", start, index);
      continue;
    }
    if (/\d/u.test(character)) {
      const start = index;
      index += 1;
      while (index < content.length && /[\w.]/u.test(content[index]!)) index += 1;
      pushToken("number", start, index);
      continue;
    }
    if (character === "/" && canStartRegex(previous)) {
      const end = scanRegex(content, index);
      if (end > index + 1) {
        pushToken("regex", index, end);
        index = end;
        continue;
      }
    }
    const operator = operators.find((candidate) => content.startsWith(candidate, index));
    if (operator !== undefined) {
      pushToken("punctuator", index, index + operator.length);
      index += operator.length;
      continue;
    }
    pushToken("punctuator", index, index + 1);
    index += 1;
  }
  while (tokens[0]?.kind === "line-break") tokens.shift();
  while (tokens.at(-1)?.kind === "line-break") tokens.pop();
  return { tokens, reservedBytes };
  } catch (error) { budget.release(reservedBytes); throw error; }
}

function normalizeTokens(tokens: readonly Token[], budget: DerivedObservationBudget, scope: string): string {
  const parts: string[] = []; let length = Math.max(0, tokens.length - 1);
  let reservedBytes = 0;
  try {
  for (const token of tokens) {
    const size = String(token.kind.length).length + token.kind.length + String(token.value.length).length + token.value.length + 3;
    budget.reserve(32 + 2 * size, "javascript-normalization", scope);
    reservedBytes += 32 + 2 * size;
    parts.push(`${token.kind.length}:${token.kind}:${token.value.length}:${token.value}`); length += size;
  }
  budget.reserveString(length, "javascript-normalization", scope);
  return parts.join("|");
  } finally { budget.release(reservedBytes); }
}

// Stream exactly the existing framed canonical JSON representation. Each token
// is escaped separately; no expanded whole-file normalization is retained.
function hashNormalizedTokens(tokens: readonly Token[], domain: string, budget: DerivedObservationBudget, scope: string, envelope?: { readonly fields: Readonly<Record<string, unknown>>; readonly key: string }): ContentHash {
  const keys = envelope === undefined ? [] : [...Object.keys(envelope.fields), envelope.key].sort(compareCodePoint);
  let before = "", after = "";
  if (envelope !== undefined) {
    const index = keys.indexOf(envelope.key);
    const field = (key: string): string => `${JSON.stringify(key)}:${canonicalJson(envelope.fields[key])}`;
    before = `{${keys.slice(0, index).map(field).join(",")}${index > 0 ? "," : ""}${JSON.stringify(envelope.key)}:`;
    after = `${index < keys.length - 1 ? "," : ""}${keys.slice(index + 1).map(field).join(",")}}`;
  }
  function* chunks(): Generator<string> {
    yield before; yield '"';
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      const size = String(token.kind.length).length + token.kind.length + String(token.value.length).length + token.value.length + 3;
      // JSON escaping can expand one UTF-16 code unit to six ASCII units.
      const scratch = 96 + 16 * size;
      budget.reserve(scratch, "javascript-normalization-hash", scope);
      try {
        if (index > 0) yield "|";
        yield JSON.stringify(`${token.kind.length}:${token.kind}:${token.value.length}:${token.value}`).slice(1, -1);
      } finally { budget.release(scratch); }
    }
    yield '"'; yield after;
  }
  return hashFramedCanonicalJsonChunks(domain, chunks);
}

export function hashJavaScriptSemantics(content: string, domain: string, budget = new DerivedObservationBudget(), scope = ".", envelope?: { readonly fields: Readonly<Record<string, unknown>>; readonly key: string }): ContentHash {
  if (/\.(?:tsx|jsx)$/u.test(scope)) {
    const normalized = normalizeJavaScriptSemantics(content, budget, scope);
    try { return hashFramedDomain(domain, envelope === undefined ? normalized : { ...envelope.fields, [envelope.key]: normalized }); }
    finally { budget.release(32 + content.length * 2); }
  }
  const lexed = lexJavaScript(content, budget, scope);
  try { return hashNormalizedTokens(lexed.tokens, domain, budget, scope, envelope); }
  finally { budget.release(lexed.reservedBytes); }
}

export function normalizeJavaScriptSemantics(content: string, budget = new DerivedObservationBudget(), scope = "."): string {
  // JSX text is observable content. A JavaScript comment lexer cannot normalize it safely.
  if (/\.(?:tsx|jsx)$/u.test(scope)) {
    budget.reserve(32 + content.length * 2, "jsx-source-normalization", scope);
    return content;
  }
  const lexed = lexJavaScript(content, budget, scope);
  try { return normalizeTokens(lexed.tokens, budget, scope); }
  finally { budget.release(lexed.reservedBytes); }
}

function sourceLocation(content: string, offset: number, endOffset: number): SourceLocationFact {
  const lines = content.slice(0, offset).split(/\r?\n/u);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1, offset, endOffset };
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

function fileParticipantId(scopeKey: string, declarations: readonly SemanticDeclarationFact[], tokens: readonly Token[], budget: DerivedObservationBudget, scope: string): string {
  const anchors = declarations.filter(({ exported }) => exported).map(({ name, kind }) => `${kind}:${name}`).sort(compareCodePoint);
  const hash = anchors.length > 0 ? hashFramedDomain("typescript-participant", { scopeKey, anchor: anchors })
    : hashNormalizedTokens(tokens, "typescript-participant", budget, scope, { fields: { scopeKey }, key: "anchor" });
  return `ts_participant_${hash.slice(-32)}`;
}

function extractEvents(calls: readonly EventCallSyntax[], scopeKey: string, participantId: string, artifactHash: ContentHash, budget: DerivedObservationBudget, scope: string) {
  const events: EventSyntaxFact[] = [], uncertainties: EventUncertaintyFact[] = [], unknowns: string[] = [];
  for (const call of calls) {
    const { receiver, operation, location } = call;
    const role = ["emit", "publish", "dispatchEvent"].includes(operation) ? "producer" as const : "consumer" as const;
    if (call.name === undefined) {
      budget.reserve(512 + 2 * (receiver.length + operation.length + scopeKey.length + participantId.length), "javascript-event-facts", scope);
      const evidenceId = `event_uncertainty_${hashFramedDomain("event-uncertainty", { receiver, role, scopeKey, participantId }).slice(-32)}`;
      uncertainties.push({ receiver, role, scopeKey, participantId, evidenceId, artifactHash });
      unknowns.push(`dynamic event name for ${receiver}.${operation}`);
      continue;
    }
    const semanticKey = call.name;
    budget.reserve(768 + 2 * (semanticKey.length + receiver.length + scopeKey.length + participantId.length), "javascript-event-facts", scope);
    const subjectId = `event_${hashFramedDomain("event-subject", { receiver, semanticKey }).slice(-32)}`;
    events.push({ subjectId, semanticKey, receiver, scopeKey, participantId, role, dynamic: false, location,
      evidenceId: `event_evidence_${hashFramedDomain("event-evidence", { participantId, role, semanticKey, location }).slice(-32)}`, artifactHash });
  }
  return { events: events.sort((a, b) => compareCodePoint(a.subjectId, b.subjectId) || compareCodePoint(a.participantId, b.participantId) || compareCodePoint(a.role, b.role)),
    uncertainties: uncertainties.sort((a, b) => compareCodePoint(a.receiver, b.receiver) || compareCodePoint(a.participantId, b.participantId)), unknowns: [...new Set(unknowns)].sort(compareCodePoint) };
}

export function localImportCandidates(importerPath:string,specifier:string):readonly string[]{
  if (!specifier.startsWith(".")) return [];
  const base = posix.normalize(posix.join(posix.dirname(importerPath), specifier));
  const candidates = extname(base).length > 0
    ? [base, ...(base.endsWith(".js") ? [`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`] : []), ...(base.endsWith(".mjs") ? [`${base.slice(0, -4)}.mts`] : []), ...(base.endsWith(".cjs") ? [`${base.slice(0, -4)}.cts`] : [])]
    : [...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => `${base}/index${extension}`)];
  return candidates;
}
function resolveLocalImport(importerPath: string, specifier: string, paths: ReadonlySet<string>): string | undefined {
  return localImportCandidates(importerPath,specifier).find(candidate=>paths.has(candidate));
}

export function analyzeJavaScript(entries: readonly InventoryEntry[], budget = new DerivedObservationBudget()): JavaScriptFacts {
  budget.reserveItems(entries.length, 128, "javascript-file-index");
  let scratchBytes = entries.length * 128;
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
    const lexed = lexJavaScript(entry.content, budget, entry.path), tokens = lexed.tokens;
    try {
    const scopeKey = scopes.get(entry.path) ?? "local-repository";
    const syntax = analyzeCompilerSyntax(entry.content, entry.path, scopeKey, budget);
    const { declarations, exportFacts, exports } = syntax;
    for (const diagnostic of syntax.diagnostics) {
      budget.reserve(256 + 2 * (entry.path.length + diagnostic.length), "javascript-failures", entry.path);
      failures.push({ analyzerId: "projector.javascript-local", capability: "syntax", scope: entry.path, message: diagnostic, recoverable: true,
        affectedClaimKinds: ["dependency", "test-target", "hook-reachability", "semantic-declaration", "event-topology"] });
    }
    const participantId = fileParticipantId(scopeKey, declarations, tokens, budget, entry.path);
    const extractedEvents = extractEvents(syntax.eventCalls, scopeKey, participantId, entry.contentHash, budget, entry.path);
    budget.reserveItems(extractedEvents.events.length + extractedEvents.uncertainties.length, 8, "javascript-event-index", entry.path);
    for (const event of extractedEvents.events) events.push(event);
    for (const uncertainty of extractedEvents.uncertainties) eventUncertainties.push(uncertainty);
    budget.reserve(832 + 2 * entry.path.length, "javascript-file-facts", entry.path);
    files.push({
      path: entry.path,
      exports,
      lifecycleExports: exports.filter((name) => lifecycleNames.has(name)),
      testNames: syntax.testNames,
      semanticHash: /\.(?:tsx|jsx)$/u.test(entry.path) ? hashJavaScriptSemantics(entry.content, "projector.local-semantic", budget, entry.path) : hashNormalizedTokens(tokens, "projector.local-semantic", budget, entry.path),
      fallbackHash: /\.(?:tsx|jsx)$/u.test(entry.path) ? hashJavaScriptSemantics(entry.content, "local-unit-fallback", budget, entry.path) : hashNormalizedTokens(tokens, "local-unit-fallback", budget, entry.path),
      variantHash: /\.(?:tsx|jsx)$/u.test(entry.path) ? hashJavaScriptSemantics(entry.content, "local-unit-variant", budget, entry.path) : hashNormalizedTokens(tokens, "local-unit-variant", budget, entry.path),
      participantId,
      scopeKey,
      declarations,
      exportFacts,
      unknowns: [...new Set([...syntax.unknowns, ...extractedEvents.unknowns])].sort(compareCodePoint),
    });
    for (const importedSyntax of syntax.imports) {
      const resolvedPath = resolveLocalImport(entry.path, importedSyntax.specifier, paths);
      budget.reserve(256 + 2 * (entry.path.length + importedSyntax.specifier.length + (resolvedPath?.length ?? 0)) + 32 * importedSyntax.bindings.length, "javascript-dependencies", entry.path);
      dependencies.push({
        sourceClass: "derived",
        importerPath: entry.path,
        specifier: importedSyntax.specifier,
        ...(resolvedPath === undefined ? {} : { resolvedPath }),
        importedBindings: [...new Set(importedSyntax.bindings.map(({ imported }) => imported))].sort(compareCodePoint),
        bindings: importedSyntax.bindings,
        typeOnly: importedSyntax.typeOnly,
      });
      if (importedSyntax.specifier.startsWith(".") && resolvedPath === undefined) {
        budget.reserve(256 + 2 * (entry.path.length + importedSyntax.specifier.length), "javascript-failures", entry.path);
        failures.push({
          analyzerId: "projector.javascript-local",
          capability: "module-resolution",
          scope: entry.path,
          message: `Cannot resolve local module ${importedSyntax.specifier}`,
          recoverable: true,
          affectedClaimKinds: ["dependency", "test-target", "hook-reachability"],
        });
      }
    }
    } finally { budget.release(lexed.reservedBytes); }
  }

  const groupedDependencies = new Map<string, ModuleDependencyFact>();
  for (const dependency of dependencies) {
    const indexBytes = 128 + 2 * (dependency.importerPath.length + dependency.specifier.length);
    budget.reserve(indexBytes, "javascript-dependency-index", dependency.importerPath); scratchBytes += indexBytes;
    const key = `${dependency.importerPath}\u0000${dependency.specifier}`;
    const existing = groupedDependencies.get(key);
    if (existing === undefined) groupedDependencies.set(key, dependency);
    else {
      budget.reserveItems(existing.bindings.length + dependency.bindings.length, 128, "javascript-binding-index", dependency.importerPath);
      const bindings = [...new Map([...existing.bindings, ...dependency.bindings].map((binding) => [`${binding.imported}\u0000${binding.local}\u0000${binding.typeOnly}`, binding])).values()]
        .sort((left, right) => compareCodePoint(left.imported, right.imported) || compareCodePoint(left.local, right.local));
      groupedDependencies.set(key, { ...existing, ...(existing.resolvedPath === undefined && dependency.resolvedPath !== undefined ? { resolvedPath: dependency.resolvedPath } : {}), bindings, importedBindings: [...new Set(bindings.map(({ imported }) => imported))].sort(compareCodePoint), typeOnly: existing.typeOnly && dependency.typeOnly });
    }
  }
  budget.reserveItems(groupedDependencies.size, 8, "javascript-dependency-index");
  const normalizedDependencies = [...groupedDependencies.values()].sort((left, right) => compareCodePoint(left.importerPath, right.importerPath) || compareCodePoint(left.specifier, right.specifier));
  const testTargets = dependencies
    .filter((dependency): dependency is ModuleDependencyFact & { resolvedPath: string } =>
      /\.test\.(?:mjs|js|cjs|mts|ts)$/u.test(dependency.importerPath) && dependency.resolvedPath !== undefined)
    .map((dependency): TestTargetFact => { budget.reserve(128, "javascript-test-targets", dependency.importerPath); return ({
      sourceClass: "derived",
      testPath: dependency.importerPath,
      targetPath: dependency.resolvedPath,
    }); })
    .sort((left, right) => compareCodePoint(left.testPath, right.testPath) || compareCodePoint(left.targetPath, right.targetPath));
  files.sort((left, right) => compareCodePoint(left.path, right.path));
  interface ContractSymbol { semanticKey: string; declaration: SemanticDeclarationFact; exportPath: string; location: SourceLocationFact }
  const declarationsByScope = new Map<string, Map<string, SemanticDeclarationFact>>();
  for (const file of files) {
    budget.reserveItems(file.declarations.length, 128, "javascript-declaration-index", file.path);
    scratchBytes += file.declarations.length * 128;
    const declarations = declarationsByScope.get(file.scopeKey) ?? new Map<string, SemanticDeclarationFact>();
    for (const declaration of file.declarations.filter(({ kind, name }) => ["interface", "type", "class"].includes(kind) || name.endsWith("Schema"))) declarations.set(declaration.name, declaration);
    declarationsByScope.set(file.scopeKey, declarations);
  }
  const packageExports = new Map<string, Map<string, ContractSymbol>>();
  for (const file of files) {
    budget.reserveItems(file.declarations.length + file.exportFacts.length, 192, "javascript-export-index", file.path);
    scratchBytes += (file.declarations.length + file.exportFacts.length) * 192;
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
      budget.reserve(768 + 2 * (symbol.semanticKey.length + scopeKey.length), "javascript-contract-facts", symbol.exportPath);
      const exportFile = files.find(({ path }) => path === symbol.exportPath)!;
      const sourceEntry = sourceEntries.find(({ path }) => path === symbol.exportPath)!;
      const participantId = exportFile.participantId;
      const subjectId = `contract_${hashFramedDomain("public-contract-subject", { scopeKey, semanticKey: symbol.semanticKey }).slice(-32)}`;
      contracts.push({ subjectId, semanticKey: symbol.semanticKey, scopeKey, participantId, role: "producer", location: symbol.location, evidenceId: `contract_evidence_${hashFramedDomain("contract-evidence", { participantId, declarationId: symbol.declaration.id, semanticKey: symbol.semanticKey }).slice(-32)}`, artifactHash: sourceEntry.contentHash });
    }
  }
  for (const file of files) {
    const participantId = file.participantId;
    const sourceEntry = sourceEntries.find(({ path }) => path === file.path)!;
    for (const dependency of normalizedDependencies.filter(({ importerPath }) => importerPath === file.path)) {
      const sourceScope = dependency.resolvedPath === undefined ? dependency.specifier : scopes.get(dependency.resolvedPath) ?? dependency.specifier;
      const exports = packageExports.get(sourceScope);
      if (exports === undefined) continue;
      for (const binding of dependency.bindings) {
        const symbol = exports.get(binding.imported);
        if (symbol === undefined) continue;
        budget.reserve(768 + 2 * (symbol.semanticKey.length + sourceScope.length), "javascript-contract-facts", file.path);
        const subjectId = `contract_${hashFramedDomain("public-contract-subject", { scopeKey: sourceScope, semanticKey: symbol.semanticKey }).slice(-32)}`;
        contracts.push({ subjectId, semanticKey: symbol.semanticKey, scopeKey: sourceScope, participantId, role: "consumer", location: sourceLocation(sourceEntry.content, 0, 0), evidenceId: `contract_evidence_${hashFramedDomain("contract-import-evidence", { participantId, sourceScope, imported: binding.imported, local: binding.local }).slice(-32)}`, artifactHash: sourceEntry.contentHash });
      }
    }
  }
  events.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role));
  contracts.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role));
  budget.release(scratchBytes);
  return { files, dependencies: normalizedDependencies, testTargets, events, eventUncertainties, contracts, failures };
}
