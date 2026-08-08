import { appendFile, readFile } from "node:fs/promises";
import { canonicalJson, hashFramedDomain, type ContentHash } from "@projector/core";

export type ReportFormat = "text" | "json" | "md" | "sarif";
export interface OperationalFinding { readonly id: ContentHash; readonly code: string; readonly title: string; readonly path?: string; readonly severity: "note" | "warning" | "error"; readonly evidenceIds: readonly string[] }
export interface OperationalReport { readonly version: 1; readonly runId: string; readonly command: string; readonly exitCode: number; readonly policy: unknown; readonly stateDigest: ContentHash; readonly unavailableFields: readonly string[]; readonly findings: readonly OperationalFinding[]; readonly dtoHash: ContentHash }
type FindingInput = Omit<OperationalFinding, "id">;
export interface OperationalReportInput { readonly runId: string; readonly command: string; readonly exitCode: number; readonly policy: unknown; readonly stateDigest: ContentHash; readonly unavailableFields: readonly string[]; readonly findings: readonly FindingInput[] }

const secretKey = /(?:authorization|credential|password|private[_-]?key|api[_-]?key|access[_-]?token|secret)/iu;
const classify = (value: string, key?: string): "private-key" | "credential" | "token" | undefined => /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value) ? "private-key" : /(?:authorization\s*:|password\s*=|credential)/iu.test(value) || (key !== undefined && secretKey.test(key)) ? "credential" : /(?:gh[pousr]_[A-Za-z0-9]{20,}|bearer\s+[A-Za-z0-9._~+\/-]{8,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{8,})/iu.test(value) ? "token" : undefined;
export function redactBeforeBoundary(value: unknown, key?: string): unknown {
  if (typeof value === "string") { const kind = classify(value, key); return kind === undefined ? value : `<redacted:${kind}>`; }
  if (Array.isArray(value)) return value.map((item) => redactBeforeBoundary(item));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, name.endsWith("_budget") ? item : redactBeforeBoundary(item, name)]));
  return value;
}
function body(report: OperationalReport | Omit<OperationalReport, "dtoHash">): Omit<OperationalReport, "dtoHash"> { const { dtoHash: omitted, ...value } = report as OperationalReport; void omitted; return value; }
export function createOperationalReport(input: OperationalReportInput): OperationalReport {
  const findings = input.findings.map((finding) => ({ ...finding, evidenceIds: [...new Set(finding.evidenceIds)].sort(), id: hashFramedDomain("operational-finding", finding) })).sort((left, right) => left.id.localeCompare(right.id));
  const base = redactBeforeBoundary({ version: 1 as const, runId: input.runId, command: input.command, exitCode: input.exitCode, policy: input.policy, stateDigest: input.stateDigest, unavailableFields: [...new Set(input.unavailableFields)].sort(), findings }) as Omit<OperationalReport, "dtoHash">;
  return { ...base, dtoHash: hashFramedDomain("operational-report-dto", base) };
}
export function renderOperationalReport(report: OperationalReport, format: ReportFormat): string {
  if (report.dtoHash !== hashFramedDomain("operational-report-dto", body(report))) throw new Error("operational report DTO hash mismatch");
  if (format === "json") return JSON.stringify(report, null, 2);
  if (format === "sarif") return JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "Projector" } }, results: report.findings.map((finding) => ({ ruleId: finding.code, level: finding.severity, message: { text: finding.title }, fingerprints: { projectorFindingId: finding.id }, properties: { evidenceIds: finding.evidenceIds }, locations: finding.path === undefined ? [] : [{ physicalLocation: { artifactLocation: { uri: finding.path } } }] })) }] }, null, 2);
  const lines = report.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.code}: ${finding.title}${finding.path === undefined ? "" : ` (${finding.path})`}`);
  return format === "md" ? [`# Projector ${report.command}`, "", ...report.findings.map((finding) => `- **${finding.severity} ${finding.code}**: ${finding.title}${finding.path === undefined ? "" : ` (\`${finding.path}\`)`}`)].join("\n") : [`Projector ${report.command} (exit ${report.exitCode})`, ...lines].join("\n");
}
interface TelemetryLine { readonly version: 1; readonly sequence: number; readonly previousHash: ContentHash | null; readonly report: OperationalReport; readonly entryHash: ContentHash }
export class JsonlTelemetryStore {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly path: string, private readonly maximumRecords = 10_000) { if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 1) throw new Error("telemetry bound must be positive"); }
  append(report: OperationalReport): Promise<TelemetryLine> { const pending = this.tail.then(async () => { const prior = await this.replay(); const sequence = prior.length + 1; const previousHash = prior.at(-1)?.entryHash ?? null; const safe = createOperationalReport({ ...report, findings: report.findings.map(({ id: omitted, ...finding }) => { void omitted; return finding; }) }); const base = { version: 1 as const, sequence, previousHash, report: safe }; const line = { ...base, entryHash: hashFramedDomain("operational-telemetry-line", base) }; await appendFile(this.path, `${canonicalJson(line)}\n`, "utf8"); return line; }); this.tail = pending.catch(() => undefined); return pending; }
  async replay(): Promise<TelemetryLine[]> { let text: string; try { text = await readFile(this.path, "utf8"); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error; } const lines = text.split(/\r?\n/u).filter(Boolean); if (lines.length > this.maximumRecords) throw new Error(`telemetry JSONL exceeds bounded replay limit ${this.maximumRecords}`); const records: TelemetryLine[] = []; for (const [index, line] of lines.entries()) { let record: TelemetryLine; try { record = JSON.parse(line) as TelemetryLine; } catch { throw new Error(`corrupt telemetry JSONL at sequence ${index + 1}`); } const { entryHash, ...base } = record; if (record.version !== 1 || record.sequence !== index + 1 || record.previousHash !== (records.at(-1)?.entryHash ?? null) || entryHash !== hashFramedDomain("operational-telemetry-line", base) || record.report.dtoHash !== hashFramedDomain("operational-report-dto", body(record.report))) throw new Error(`corrupt telemetry JSONL hash/sequence at ${index + 1}`); records.push(record); } return records; }
}
