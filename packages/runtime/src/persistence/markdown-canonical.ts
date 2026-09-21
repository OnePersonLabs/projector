import {
  CanonicalDocumentWireSchemasByKind,
  hydrateCanonicalDocumentWire,
  toCanonicalDocumentWire,
  type CanonicalDocumentEnvelope,
  type CanonicalDocumentWire,
} from "@projector/core";
import { fromMarkdown } from "mdast-util-from-markdown";

import { parseTomlDocument, stringifyTomlDocument } from "./toml-codec.js";

export const markdownCanonicalKinds = Object.freeze([
  "concept",
  "requirement",
  "behavioral-scenario",
  "architecture-concern",
  "architecture-decision",
  "authority-record",
] as const);

export type MarkdownCanonicalKind = (typeof markdownCanonicalKinds)[number];

const markdownKindSet = new Set<string>(markdownCanonicalKinds);
const markdownFormatVersion = 3;
const envelopeFields = new Set(["format", "apiVersion", "schemaVersion", "kind", "id", "key", "lifecycle", "metadata"]);
// Keep the header to stable identity and small inspection metadata. Selectors and
// realization bindings matter, but make the authored prose hard to find when they
// occupy the front of a record.
const appendixFields = new Set([
  "origin", "provenance", "history", "alternatives", "vector", "activationReasons", "consequences", "appliedPreferences", "deferral",
  "scope", "realizations", "assumptions", "reconsiderWhen", "evidence", "evidenceRefreshPolicy",
]);
const detailsStart = "\n\n<details>\n<summary>Structured record details</summary>\n\n```toml\n";
const detailsEnd = "\n```\n</details>\n";

type JsonObject = Record<string, unknown>;

interface MarkdownFrontMatter {
  readonly header: JsonObject;
  readonly body: string;
}

interface MarkdownHeading {
  readonly level: number;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export function isMarkdownCanonicalKind(kind: string): kind is MarkdownCanonicalKind {
  return markdownKindSet.has(kind);
}

/** Parses the sole authored source for prose-led records. */
export function parseCanonicalMarkdownDocument(source: string, path = "canonical Markdown document"): CanonicalDocumentWire {
  const { header, body } = splitFrontMatter(source, path);
  if (header.format !== markdownFormatVersion) throw new Error(`unsupported canonical Markdown format at ${path}: expected ${markdownFormatVersion}`);
  const kind = requiredString(header.kind, "kind", path);
  if (!isMarkdownCanonicalKind(kind)) throw new Error(`canonical Markdown kind is not prose-led at ${path}: ${kind}`);

  for (const field of Object.keys(header)) {
    if (!envelopeFields.has(field)) throw new Error(`canonical Markdown front matter has unowned field at ${path}: ${field}`);
  }
  const metadata = header.metadata === undefined ? {} : objectField(header.metadata, "metadata", path);

  const { prose, details } = splitDetailsAppendix(body, path);
  const detailsMetadata = details === undefined ? {} : objectField(parseTomlDocument(details, path), "details", path);
  for (const field of Object.keys(detailsMetadata)) {
    if (!appendixFields.has(field)) throw new Error(`canonical Markdown details field is not permitted at ${path}: ${field}`);
    if (Object.hasOwn(metadata, field)) throw new Error(`canonical Markdown field has both header and details owners at ${path}: ${field}`);
  }
  const parsedBody = parseMarkdownBody(prose, kind, path);
  if (kind === "authority-record") {
    const titleSubject = parsedBody.__authorityTitleSubject;
    delete parsedBody.__authorityTitleSubject;
    if (titleSubject !== metadata.subjectId) throw new Error(`authority Markdown title does not match subjectId at ${path}`);
  }
  for (const field of Object.keys(parsedBody)) {
    if (Object.hasOwn(metadata, field) || Object.hasOwn(detailsMetadata, field)) throw new Error(`canonical Markdown field has both body and metadata owners at ${path}: ${field}`);
  }
  const wire = {
    apiVersion: requiredString(header.apiVersion, "apiVersion", path),
    schemaVersion: requiredString(header.schemaVersion, "schemaVersion", path),
    kind,
    id: requiredString(header.id, "id", path),
    key: requiredString(header.key, "key", path),
    lifecycle: requiredString(header.lifecycle, "lifecycle", path),
    payload: { ...metadata, ...detailsMetadata, ...parsedBody },
  };
  const validated = CanonicalDocumentWireSchemasByKind[kind].parse(wire) as CanonicalDocumentWire;
  hydrateCanonicalDocumentWire(validated);
  return validated;
}

/** Serializes a normalized record without persisting derived envelope hashes. */
export function stringifyCanonicalMarkdownDocument(document: CanonicalDocumentEnvelope): string {
  const wire = toCanonicalDocumentWire(document);
  if (!isMarkdownCanonicalKind(wire.kind)) throw new Error(`canonical kind is not prose-led Markdown: ${wire.kind}`);
  const { bodyFields, body } = renderMarkdownBody(wire, wire.kind);
  const metadata = { ...wire.payload };
  for (const field of bodyFields) delete metadata[field];
  const details = Object.fromEntries(Object.entries(metadata).filter(([field]) => appendixFields.has(field)));
  for (const field of Object.keys(details)) delete metadata[field];
  return `+++\n${stringifyTomlDocument({
    format: markdownFormatVersion,
    apiVersion: wire.apiVersion,
    schemaVersion: wire.schemaVersion,
    kind: wire.kind,
    id: wire.id,
    key: wire.key,
    lifecycle: wire.lifecycle,
    metadata,
  })}+++\n\n${body}${Object.keys(details).length === 0 ? "\n" : `${detailsStart}${stringifyTomlDocument(details)}${detailsEnd}`}`;
}

function splitDetailsAppendix(body: string, path: string): { readonly prose: string; readonly details: string | undefined } {
  const start = body.indexOf(detailsStart);
  if (start < 0) return { prose: body, details: undefined };
  if (body.indexOf(detailsStart, start + detailsStart.length) >= 0) throw new Error(`canonical Markdown contains more than one details appendix at ${path}`);
  const end = body.indexOf(detailsEnd, start + detailsStart.length);
  if (end < 0 || body.slice(end + detailsEnd.length).trim() !== "") throw new Error(`canonical Markdown details appendix is malformed at ${path}`);
  return { prose: body.slice(0, start), details: body.slice(start + detailsStart.length, end) };
}

function splitFrontMatter(source: string, path: string): MarkdownFrontMatter {
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("+++\n")) throw new Error(`canonical Markdown must start with +++ TOML front matter at ${path}`);
  const close = normalized.indexOf("\n+++\n", 4);
  if (close < 0) throw new Error(`canonical Markdown front matter is not closed at ${path}`);
  const parsed = parseTomlDocument(normalized.slice(4, close), path);
  if (!isObject(parsed)) throw new Error(`canonical Markdown front matter must be an object at ${path}`);
  return { header: parsed, body: normalized.slice(close + "\n+++\n".length).replace(/^\n/u, "") };
}

function parseMarkdownBody(body: string, kind: MarkdownCanonicalKind, path: string): JsonObject {
  const headings = headingsFromMarkdown(fromMarkdown(body) as unknown, body, path);
  if (headings.length === 0 || headings[0]!.level !== 1 || headings[0]!.start !== 0) throw new Error(`canonical Markdown requires one leading H1 title at ${path}`);
  if (headings.filter(({ level }) => level === 1).length !== 1) throw new Error(`canonical Markdown permits exactly one H1 title at ${path}`);
  if (headings.some(({ level }) => level > 2)) throw new Error(`canonical Markdown does not permit headings below H2 at ${path}`);
  const title = headings[0]!.text;
  if (title.length === 0) throw new Error(`canonical Markdown title cannot be blank at ${path}`);
  const sections = sectionsAfterTitle(body, headings, path);
  if (kind === "concept") return { name: title, statement: singleBody(sections, path, kind) };
  if (kind === "requirement") return { title, statement: singleBody(sections, path, kind) };
  if (kind === "architecture-concern") return { title, question: singleBody(sections, path, kind) };
  if (kind === "architecture-decision") return { title, decision: singleNamedSection(sections, "Decision", path) };
  if (kind === "authority-record") {
    const subject = title.match(/^Authority for (.+)$/u)?.[1];
    if (subject === undefined || subject.trim() === "") throw new Error(`authority Markdown title must be 'Authority for <subject ID>' at ${path}`);
    return { rationale: singleNamedSection(sections, "Rationale", path), __authorityTitleSubject: subject };
  }
  return { title, steps: scenarioSteps(sections, path) };
}

function renderMarkdownBody(wire: CanonicalDocumentWire, kind: MarkdownCanonicalKind): { bodyFields: readonly string[]; body: string } {
  const payload = wire.payload;
  if (kind === "concept") return { bodyFields: ["name", "statement"], body: `# ${titleLine(payload.name, "concept name")}\n\n${requiredBody(payload.statement, "concept statement")}` };
  if (kind === "requirement") return { bodyFields: ["title", "statement"], body: `# ${titleLine(payload.title, "requirement title")}\n\n${requiredBody(payload.statement, "requirement statement")}` };
  if (kind === "architecture-concern") return { bodyFields: ["title", "question"], body: `# ${titleLine(payload.title, "concern title")}\n\n${requiredBody(payload.question, "concern question")}` };
  if (kind === "architecture-decision") return { bodyFields: ["title", "decision"], body: `# ${titleLine(payload.title, "decision title")}\n\n## Decision\n\n${requiredBody(payload.decision, "decision")}` };
  if (kind === "authority-record") return { bodyFields: ["rationale"], body: `# Authority for ${titleLine(payload.subjectId, "authority subject ID")}\n\n## Rationale\n\n${requiredBody(payload.rationale, "authority rationale")}` };
  return { bodyFields: ["title", "steps"], body: `# ${titleLine(payload.title, "scenario title")}${scenarioBody(payload.steps)}` };
}

function headingsFromMarkdown(tree: unknown, body: string, path: string): MarkdownHeading[] {
  if (!isObject(tree) || tree.type !== "root" || !Array.isArray(tree.children)) throw new Error(`Markdown parser did not produce a document root at ${path}`);
  const headings: MarkdownHeading[] = [];
  for (const child of tree.children) {
    if (!isObject(child) || child.type !== "heading") continue;
    const position = child.position;
    if (typeof child.depth !== "number" || !isObject(position) || !isObject(position.start) || !isObject(position.end) || typeof position.start.offset !== "number" || typeof position.end.offset !== "number") throw new Error(`Markdown heading lacks source positions at ${path}`);
    const lineEnd = body.indexOf("\n", position.start.offset);
    const line = body.slice(position.start.offset, lineEnd < 0 ? body.length : lineEnd);
    const match = /^(#{1,2})[ \t]+(.+?)\s*$/u.exec(line);
    if (match === null || match[1]!.length !== child.depth) throw new Error(`canonical Markdown headings must use ATX H1 or H2 syntax at ${path}`);
    headings.push({ level: child.depth, text: match[2]!, start: position.start.offset, end: lineEnd < 0 ? body.length : lineEnd });
  }
  return headings.sort((left, right) => left.start - right.start);
}

function sectionsAfterTitle(body: string, headings: readonly MarkdownHeading[], path: string): readonly { readonly heading: string | undefined; readonly text: string }[] {
  const title = headings[0]!;
  const remaining = headings.slice(1);
  const firstStart = title.end + (body[title.end] === "\n" ? 1 : 0);
  if (remaining.length === 0) return [{ heading: undefined, text: normalizeBody(body.slice(firstStart), path) }];
  const beforeFirst = body.slice(firstStart, remaining[0]!.start).trim();
  if (beforeFirst !== "") throw new Error(`canonical Markdown prose before the first H2 is ambiguous at ${path}`);
  return remaining.map((heading, index) => {
    if (heading.level !== 2) throw new Error(`canonical Markdown section must be H2 at ${path}`);
    const start = heading.end + (body[heading.end] === "\n" ? 1 : 0);
    return { heading: heading.text, text: normalizeBody(body.slice(start, remaining[index + 1]?.start ?? body.length), path) };
  });
}

function singleBody(sections: readonly { readonly heading: string | undefined; readonly text: string }[], path: string, kind: string): string {
  if (sections.length !== 1 || sections[0]!.heading !== undefined) throw new Error(`${kind} Markdown cannot contain H2 sections at ${path}`);
  return sections[0]!.text;
}

function singleNamedSection(sections: readonly { readonly heading: string | undefined; readonly text: string }[], expected: string, path: string): string {
  if (sections.length !== 1 || sections[0]!.heading !== expected) throw new Error(`canonical Markdown requires exactly one '${expected}' H2 section at ${path}`);
  return sections[0]!.text;
}

function scenarioSteps(sections: readonly { readonly heading: string | undefined; readonly text: string }[], path: string): readonly JsonObject[] {
  const roles: Readonly<Record<string, string>> = { Given: "precondition", When: "trigger", Then: "expected-outcome", "Must not": "forbidden-outcome" };
  if (sections.length === 0 || sections.some(({ heading, text }) => heading === undefined || roles[heading] === undefined || text === "")) throw new Error(`scenario Markdown requires nonempty Given, When, Then, or Must not sections at ${path}`);
  return sections.map(({ heading, text }) => ({ role: roles[heading!]!, statement: text }));
}

function scenarioBody(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) throw new Error("scenario steps must be a nonempty array");
  const headings: Readonly<Record<string, string>> = { precondition: "Given", trigger: "When", "expected-outcome": "Then", "forbidden-outcome": "Must not" };
  return value.map((step) => {
    if (!isObject(step) || typeof step.role !== "string" || headings[step.role] === undefined) throw new Error("scenario step has an unsupported role");
    return `\n\n## ${headings[step.role]}\n\n${requiredBody(step.statement, "scenario step")}`;
  }).join("");
}

function normalizeBody(value: string, path: string): string {
  const result = value.trim();
  if (result === "") throw new Error(`canonical Markdown section cannot be blank at ${path}`);
  return result;
}

function requiredBody(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be nonblank prose`);
  return value.trim();
}

function titleLine(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "" || /[\r\n]/u.test(value)) throw new Error(`${label} must be one nonblank line`);
  return value;
}

function requiredString(value: unknown, field: string, path: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`canonical Markdown ${field} must be a nonblank string at ${path}`);
  return value;
}

function objectField(value: unknown, field: string, path: string): JsonObject {
  if (!isObject(value)) throw new Error(`canonical Markdown ${field} must be a TOML table at ${path}`);
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
