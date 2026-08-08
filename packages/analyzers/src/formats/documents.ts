import { hashFramedDomain, type AnalyzerFailure, type ContentHash } from "@projector/core";

import type { InventoryEntry } from "../filesystem/inventory.js";
import { compareCodePoint } from "../ordering.js";

export interface DocumentUnitFact { readonly stablePath: string; readonly valueKind: string; readonly line: number; readonly column: number; readonly contentHash: ContentHash }
export interface DocumentFact { readonly path: string; readonly format: "json" | "yaml" | "toml"; readonly units: DocumentUnitFact[]; readonly unknowns: string[]; readonly contentHash: ContentHash }
export interface ActionsStepFact { readonly index: number; readonly uses?: string; readonly run?: string; readonly line: number }
export interface ActionsJobFact { readonly id: string; readonly needs: string[]; readonly uses: string[]; readonly steps: ActionsStepFact[]; readonly matrix: Array<{ key: string; values: string[]; line: number }>; readonly inputs: Array<{ key: string; value: string; line: number }>; readonly outputs: Array<{ key: string; value: string; line: number }>; environment?: string; readonly line: number }
export interface ActionsWorkflowFact { readonly path: string; readonly triggers: string[]; readonly triggerLocations: Array<{ key: string; line: number }>; readonly pathFilters: Array<{ trigger: string; include: string[]; exclude: string[]; line: number }>; readonly permissions: Array<{ key: string; value: string; line: number }>; readonly inputs: Array<{ key: string; value: string; line: number }>; readonly outputs: Array<{ key: string; value: string; line: number }>; readonly jobs: ActionsJobFact[]; readonly unknowns: string[]; readonly contentHash: ContentHash }
export interface MarkdownHeadingFact { readonly level: number; readonly text: string; readonly line: number }
export interface MarkdownFact { readonly path: string; readonly headings: MarkdownHeadingFact[]; readonly contractReferences: Array<{ key: string; line: number }>; readonly fences: Array<{ info: string; startLine: number; endLine: number }>; readonly links: Array<{ text: string; target: string; line: number }>; readonly references: Array<{ key: string; target: string; line: number }>; readonly contentHash: ContentHash }
export interface DocumentAnalysis { readonly documents: DocumentFact[]; readonly actions: ActionsWorkflowFact[]; readonly markdown: MarkdownFact[]; readonly failures: AnalyzerFailure[] }

const scalarKind = (value: string): string => /^(?:true|false)$/iu.test(value) ? "boolean" : /^[-+]?\d+(?:\.\d+)?$/u.test(value) ? "number" : /^(?:null|~)$/u.test(value) ? "null" : "string";
const pointer = (parts: readonly (string | number)[]): string => `/${parts.map(String).map((part) => part.replace(/~/gu, "~0").replace(/\//gu, "~1")).join("/")}`;
const unit = (path: readonly (string | number)[], value: string, line: number, column: number): DocumentUnitFact => ({ stablePath: pointer(path), valueKind: scalarKind(value.trim()), line, column, contentHash: hashFramedDomain("structured-document-unit", { path, value: value.trim() }) });
const failure = (path: string, capability: string, message: string): AnalyzerFailure => ({ analyzerId: "projector.structured-documents", capability, scope: path, message, recoverable: true, affectedClaimKinds: ["structured-document", "stable-path"] });

function duplicateJsonKeys(content: string): string[] {
  const duplicates = new Set<string>();
  const stack: Array<{ kind: "object"; keys: Set<string> } | { kind: "array" }> = [];
  let index = 0;
  while (index < content.length) {
    const character = content[index]!;
    if (character === "{") { stack.push({ kind: "object", keys: new Set() }); index += 1; continue; }
    if (character === "[") { stack.push({ kind: "array" }); index += 1; continue; }
    if (character === "}" || character === "]") { stack.pop(); index += 1; continue; }
    if (character !== "\"") { index += 1; continue; }
    const start = index; index = scanJsonString(content, index);
    let cursor = index; while (/\s/u.test(content[cursor] ?? "")) cursor += 1;
    const frame = stack.at(-1);
    if (content[cursor] !== ":" || frame?.kind !== "object") continue;
    let key: string;
    try { key = JSON.parse(content.slice(start, index)) as string; } catch { continue; }
    if (frame.keys.has(key)) duplicates.add(key); else frame.keys.add(key);
  }
  return [...duplicates].sort(compareCodePoint);
}

function scanJsonString(content: string, start: number): number {
  let index = start + 1; let escaped = false;
  while (index < content.length) { const character = content[index]!; if (escaped) escaped = false; else if (character === "\\") escaped = true; else if (character === "\"") return index + 1; index += 1; }
  return content.length;
}

function walkJson(value: unknown, path: readonly (string | number)[], units: DocumentUnitFact[]): void {
  if (Array.isArray(value)) value.forEach((item, index) => walkJson(item, [...path, index], units));
  else if (value !== null && typeof value === "object") for (const [key, item] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) => compareCodePoint(a, b))) walkJson(item, [...path, key], units);
  else units.push(unit(path, value === null ? "null" : String(value), 1, 1));
}

function parseYaml(path: string, content: string): DocumentFact {
  const units: DocumentUnitFact[] = [];
  const unknowns: string[] = [];
  const stack: Array<{ indent: number; key: string | number }> = [];
  const multiDocument = /^\s*---\s*$/mu.test(content);
  let documentIndex = multiDocument ? 0 : -1;
  let documentHasContent = false;
  const seen = new Set<string>();
  content.split(/\r?\n/u).forEach((line, lineIndex) => {
    if (/^\s*---\s*$/u.test(line)) { if (documentHasContent) documentIndex += 1; documentHasContent = false; stack.length = 0; return; }
    if (/![A-Za-z]/u.test(line)) unknowns.push(`custom tag at line ${lineIndex + 1}`);
    if (/[&*][A-Za-z]/u.test(line)) unknowns.push(`anchor or alias at line ${lineIndex + 1}`);
    const match = line.match(/^(\s*)(?:-\s*)?([^:#][^:]*):(?:\s*(.*))?$/u);
    if (match === null || line.trimStart().startsWith("#")) return;
    documentHasContent = true;
    const indent = match[1]!.length;
    const key = match[2]!.trim().replace(/^['"]|['"]$/gu, "");
    while (stack.at(-1) !== undefined && stack.at(-1)!.indent >= indent) stack.pop();
    const base = [...(documentIndex >= 0 ? [documentIndex] : []), ...stack.map(({ key }) => key), key];
    const value = match[3]?.trim() ?? "";
    if (value === "") stack.push({ indent, key }); else { const stablePath = pointer(base); if (seen.has(stablePath)) unknowns.push(`duplicate key ${stablePath} at line ${lineIndex + 1}`); else seen.add(stablePath); units.push(unit(base, value, lineIndex + 1, indent + 1)); }
  });
  units.sort((a, b) => compareCodePoint(a.stablePath, b.stablePath));
  return { path, format: "yaml", units, unknowns: [...new Set(unknowns)].sort(compareCodePoint), contentHash: hashFramedDomain("structured-document", { path, units, unknowns }) };
}

function parseToml(path: string, content: string): DocumentFact {
  const units: DocumentUnitFact[] = [];
  const unknowns: string[] = [];
  let table: Array<string | number> = [];
  const arrays = new Map<string, number>();
  const keys = new Set<string>();
  content.split(/\r?\n/u).forEach((line, lineIndex) => {
    const clean = line.replace(/\s+#.*$/u, "").trim();
    if (clean === "") return;
    const arrayTable = clean.match(/^\[\[([^\]]+)\]\]$/u);
    if (arrayTable !== null) {
      const names = arrayTable[1]!.split(".").map((name) => name.trim());
      const base = pointer(names); const index = arrays.get(base) ?? 0; arrays.set(base, index + 1); table = [...names, index]; return;
    }
    const ordinary = clean.match(/^\[([^\]]+)\]$/u);
    if (ordinary !== null) { table = ordinary[1]!.split(".").map((name) => name.trim()); return; }
    const pair = clean.match(/^([^=]+?)\s*=\s*(.+)$/u);
    if (pair === null) { unknowns.push(`unsupported TOML syntax at line ${lineIndex + 1}`); return; }
    const parts = pair[1]!.split(".").map((name) => name.trim().replace(/^['"]|['"]$/gu, ""));
    const full = [...table, ...parts]; const stablePath = pointer(full);
    if (keys.has(stablePath)) unknowns.push(`duplicate key ${stablePath} at line ${lineIndex + 1}`); else keys.add(stablePath);
    units.push(unit(full, pair[2]!, lineIndex + 1, line.indexOf(pair[1]!) + 1));
  });
  units.sort((a, b) => compareCodePoint(a.stablePath, b.stablePath));
  return { path, format: "toml", units, unknowns: [...new Set(unknowns)].sort(compareCodePoint), contentHash: hashFramedDomain("structured-document", { path, units, unknowns }) };
}

function parseActions(entry: InventoryEntry): ActionsWorkflowFact {
  const lines = entry.content.split(/\r?\n/u);
  const triggers: string[] = []; const triggerLocations: ActionsWorkflowFact["triggerLocations"] = []; const pathFilters: ActionsWorkflowFact["pathFilters"] = []; const permissions: ActionsWorkflowFact["permissions"] = []; const workflowInputs: ActionsWorkflowFact["inputs"] = []; const workflowOutputs: ActionsWorkflowFact["outputs"] = []; const jobs: ActionsJobFact[] = []; const unknowns: string[] = [];
  let section = ""; let trigger = ""; let job: ActionsJobFact | undefined; let inSteps = false; let jobSubsection = ""; let workflowCallSubsection = "";
  lines.forEach((line, index) => {
    if (/\$\{\{/u.test(line)) unknowns.push(`expression at line ${index + 1}`);
    const indent = line.match(/^\s*/u)?.[0].length ?? 0; const trimmed = line.trim();
    if (indent === 0 && /^(on|permissions|jobs):/u.test(trimmed)) { section = trimmed.slice(0, -1); job = undefined; inSteps = false; return; }
    if (section === "on" && indent === 2) { const key = trimmed.match(/^([^:]+):/u)?.[1]; if (key) { trigger = key; triggers.push(key); triggerLocations.push({ key, line: index + 1 }); } workflowCallSubsection = ""; return; }
    if (section === "on" && trigger === "workflow_call" && indent === 4 && /^(inputs|outputs):$/u.test(trimmed)) { workflowCallSubsection = trimmed.slice(0, -1); return; }
    if (section === "on" && trigger === "workflow_call" && indent === 6) { const key = trimmed.match(/^([^:]+):/u)?.[1]; if (key) (workflowCallSubsection === "outputs" ? workflowOutputs : workflowInputs).push({ key, value: trimmed.slice(trimmed.indexOf(":") + 1).trim(), line: index + 1 }); return; }
    if (section === "on" && indent === 4 && /^(paths|paths-ignore):/u.test(trimmed)) { const pair = trimmed.match(/^(paths|paths-ignore):\s*(.*)$/u)!; const values = pair[2]!.replace(/^\[|\]$/gu, "").split(",").map((value) => value.trim().replace(/^['"]|['"]$/gu, "")).filter(Boolean); const existing = pathFilters.find((filter) => filter.trigger === trigger) ?? { trigger, include: [], exclude: [], line: index + 1 }; if (!pathFilters.includes(existing)) pathFilters.push(existing); (pair[1] === "paths" ? existing.include : existing.exclude).push(...values); return; }
    if (section === "permissions" && indent === 2) { const pair = trimmed.match(/^([^:]+):\s*(.+)$/u); if (pair) permissions.push({ key: pair[1]!, value: pair[2]!, line: index + 1 }); return; }
    if (section !== "jobs") return;
    const jobHeader = indent === 2 ? trimmed.match(/^([^:]+):$/u) : null;
    if (jobHeader !== null) { job = { id: jobHeader[1]!, needs: [], uses: [], steps: [], matrix: [], inputs: [], outputs: [], line: index + 1 }; jobs.push(job); inSteps = false; jobSubsection = ""; return; }
    if (job === undefined) return;
    if (indent === 4 && trimmed === "steps:") { inSteps = true; return; }
    if (inSteps && /^-\s+uses:/u.test(trimmed)) { const uses = trimmed.replace(/^-\s+uses:\s*/u, ""); job.steps.push({ index: job.steps.length, uses, line: index + 1 }); if (!uses.startsWith("./")) unknowns.push(`remote action ${uses} at line ${index + 1}`); return; }
    if (inSteps && /^-\s+run:/u.test(trimmed)) { job.steps.push({ index: job.steps.length, run: trimmed.replace(/^-\s+run:\s*/u, ""), line: index + 1 }); return; }
    if (indent === 4 && /^(with|outputs):$/u.test(trimmed)) { jobSubsection = trimmed.slice(0, -1); inSteps = false; return; }
    if (indent === 4 && trimmed === "strategy:") { jobSubsection = "strategy"; inSteps = false; return; }
    if (indent === 6 && jobSubsection === "strategy" && trimmed === "matrix:") { jobSubsection = "matrix"; return; }
    if (indent === 8 && jobSubsection === "matrix") { const pair = trimmed.match(/^([^:]+):\s*(.*)$/u); if (pair) job.matrix.push({ key: pair[1]!, values: pair[2]!.replace(/^\[|\]$/gu, "").split(",").map((value) => value.trim()).filter(Boolean), line: index + 1 }); return; }
    if (indent === 6 && (jobSubsection === "with" || jobSubsection === "outputs")) { const pair = trimmed.match(/^([^:]+):\s*(.*)$/u); if (pair) (jobSubsection === "with" ? job.inputs : job.outputs).push({ key: pair[1]!, value: pair[2]!, line: index + 1 }); return; }
    const environment = indent === 4 ? trimmed.match(/^environment:\s*(.+)$/u) : null; if (environment) { job.environment = environment[1]!; return; }
    const needs = indent === 4 ? trimmed.match(/^needs:\s*(.+)$/u) : null;
    if (needs !== null) { job.needs.push(...needs[1]!.replace(/^\[|\]$/gu, "").split(",").map((v) => v.trim()).filter(Boolean)); return; }
    const jobUses = indent === 4 ? trimmed.match(/^uses:\s*(.+)$/u) : null;
    if (jobUses !== null) { job.uses.push(jobUses[1]!); if (!jobUses[1]!.startsWith("./")) unknowns.push(`remote reusable workflow at line ${index + 1}`); return; }
  });
  triggers.sort(compareCodePoint); permissions.sort((a, b) => compareCodePoint(a.key, b.key)); jobs.forEach((item) => { item.needs.sort(compareCodePoint); item.uses.sort(compareCodePoint); }); jobs.sort((a, b) => compareCodePoint(a.id, b.id));
  pathFilters.sort((a, b) => compareCodePoint(a.trigger, b.trigger)); workflowInputs.sort((a, b) => compareCodePoint(a.key, b.key)); workflowOutputs.sort((a, b) => compareCodePoint(a.key, b.key));
  return { path: entry.path, triggers, triggerLocations, pathFilters, permissions, inputs: workflowInputs, outputs: workflowOutputs, jobs, unknowns: [...new Set(unknowns)].sort(compareCodePoint), contentHash: hashFramedDomain("actions-workflow", { triggers, triggerLocations, pathFilters, permissions, inputs: workflowInputs, outputs: workflowOutputs, jobs, unknowns }) };
}

function parseMarkdown(entry: InventoryEntry): MarkdownFact {
  const headings: MarkdownHeadingFact[] = []; const contractReferences: Array<{ key: string; line: number }> = []; const fences: Array<{ info: string; startLine: number; endLine: number }> = []; const links: Array<{ text: string; target: string; line: number }> = []; const references: Array<{ key: string; target: string; line: number }> = [];
  let fence: { info: string; startLine: number } | undefined;
  entry.content.split(/\r?\n/u).forEach((line, index) => {
    const marker = line.match(/^\s*```\s*(.*)$/u); if (marker !== null) { if (fence === undefined) fence = { info: marker[1]!.trim(), startLine: index + 1 }; else { fences.push({ ...fence, endLine: index + 1 }); fence = undefined; } return; }
    if (fence !== undefined) return;
    const heading = line.match(/^(#{1,6})\s+(.+)$/u); if (heading) headings.push({ level: heading[1]!.length, text: heading[2]!.trim(), line: index + 1 });
    for (const match of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/gu)) links.push({ text: match[1]!, target: match[2]!, line: index + 1 });
    const reference = line.match(/^\s*\[([^\]]+)\]:\s*(\S+)/u); if (reference) references.push({ key: reference[1]!, target: reference[2]!, line: index + 1 });
    for (const match of line.matchAll(/\bcontract:([A-Za-z_$][\w$.-]*@\d+)\b/gu)) contractReferences.push({ key: match[1]!, line: index + 1 });
  });
  headings.sort((a, b) => a.line - b.line); contractReferences.sort((a, b) => compareCodePoint(a.key, b.key));
  return { path: entry.path, headings, contractReferences, fences, links, references, contentHash: hashFramedDomain("markdown-structure", { headings, contractReferences, fences, links, references }) };
}

export function analyzeDocuments(entries: readonly InventoryEntry[]): DocumentAnalysis {
  const documents: DocumentFact[] = []; const actions: ActionsWorkflowFact[] = []; const markdown: MarkdownFact[] = []; const failures: AnalyzerFailure[] = [];
  for (const entry of [...entries].sort((a, b) => compareCodePoint(a.path, b.path))) {
    if (entry.kind !== "file") continue;
    if (entry.path.endsWith(".md")) { markdown.push(parseMarkdown(entry)); continue; }
    if (/\.ya?ml$/u.test(entry.path)) { const document = parseYaml(entry.path, entry.content); documents.push(document); if (document.unknowns.some((item) => item.startsWith("duplicate key"))) failures.push(failure(entry.path, "duplicate-key", document.unknowns.filter((item) => item.startsWith("duplicate key")).join("; "))); if (/^\.github\/workflows\//u.test(entry.path)) actions.push(parseActions(entry)); continue; }
    if (entry.path.endsWith(".toml")) { const document = parseToml(entry.path, entry.content); documents.push(document); if (document.unknowns.some((item) => item.startsWith("duplicate key"))) failures.push(failure(entry.path, "duplicate-key", document.unknowns.filter((item) => item.startsWith("duplicate key")).join("; "))); continue; }
    if (!entry.path.endsWith(".json")) continue;
    const units: DocumentUnitFact[] = []; const duplicates = duplicateJsonKeys(entry.content);
    if (duplicates.length > 0) failures.push(failure(entry.path, "duplicate-key", `duplicate JSON keys: ${duplicates.join(", ")}`));
    try { walkJson(JSON.parse(entry.content), [], units); } catch (error) { failures.push(failure(entry.path, "document-parse", error instanceof Error ? error.message : String(error))); }
    units.sort((a, b) => compareCodePoint(a.stablePath, b.stablePath)); documents.push({ path: entry.path, format: "json", units, unknowns: [], contentHash: hashFramedDomain("structured-document", { path: entry.path, units }) });
  }
  failures.sort((a, b) => compareCodePoint(a.scope, b.scope) || compareCodePoint(a.capability, b.capability));
  return { documents, actions, markdown, failures };
}
