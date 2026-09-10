#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { watch as watchFileSystem } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { PackageIdentitySchema, canonicalJson, hashFramedDomain, type ArchitectureConcern, type ArchitectureDecision, type ContentHash, type CoverageSnapshot, type DecisionValidityAssessment, type ObservabilityClass, type RiskClass } from "@projector/core";
import { analyzeLocalRepository } from "@projector/analyzers";

import { CanonicalFileRepository, SqliteDerivedStore, createOperationalReport, renderOperationalReport, validateOperationalReport, unavailableOperationalEvidence, JsonlTelemetryStore, FileWatchCheckpointStore, RepositoryPathService, WatchCoordinator, runWatchLifecycle, inspectProjectActivation, type OperationalExitProof, type OperationalReport, type ReportFormat } from "@projector/runtime";
import {
  auditArchitectureDecisions,
  explainArchitectureDecision,
  runArchitecturePreflight,
  type ArchitecturePreflightInput,
  type ArchitecturePreflightPorts,
  type DecisionOverlapPort,
  type DecisionPopulationPort,
} from "@projector/engine/architecture";
import { REQUIRED_COVERAGE_LANES } from "@projector/engine/coverage";

import { assertOperationRiskAuthorized, deriveOperationRisk, normalizeExecutionPolicy, type CliPolicyInput, type OperationRiskInput, type SliceCommand } from "./policy.js";
import { createBuiltRunHostPort } from "./host-cli.js";
import { createBuiltMcpCliPort } from "./mcp-cli.js";
import { defaultKnowledgeCliPort, presentKnowledgeContext, presentKnowledgeReconciliation, renderKnowledgeContext, renderKnowledgeReconciliation, type RepositoryKnowledgeCliPort } from "./knowledge-cli.js";
export type { RepositoryKnowledgeCliPort } from "./knowledge-cli.js";
import { RepositoryChangeLifecycleService, initializePreparedProject, inspectRepositoryArchitecture, inspectRepositoryCoverage } from "@projector/control-plane";
export { createHostSessionRecord, hostSessionSelector } from "@projector/integrations";
import { runDefaultUpgradeWorkflow } from "./upgrade.js";
import { inspectCanonicalKnowledge, runReadOnlyOperationalVerification } from "./operational-verification.js";
import { createInstalledProjectorApplicationEvidenceHost } from "./operation-runner.js";
export * from "./upgrade.js";

export const PROJECTOR_VERSION = (await cliPackageIdentity()).version;

async function cliPackageIdentity() {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  return PackageIdentitySchema.parse({ name: manifest.name, version: manifest.version });
}

const HELP = `Projector ${PROJECTOR_VERSION}

Usage: projector <command> [options]

Commands:
  init                  Initialize local Projector derived state
  audit                 Analyze governed state; add --decisions for architecture decisions
  context (<request> | --request <request>) [--entity <id-or-key>] [--compact]  Retrieve relevant meaning before choosing edits
  reconcile <context-id> [--compact]  Check saved knowledge against current state
  change <request> --proposal <path> [--context <id>]  Capture a repository change
  plan <semantic-change-id>           Preview its immutable plan
  approve <semantic-change-id> --plan-hash <hash>  Approve that exact plan
  apply <approval-id>                 Apply an approval once
  recover <approval-id>               Recover an interrupted approval
  resume <approval-id>                Recover then resume an approval
  coverage              Report authenticated multi-dimensional coverage
  complete              Rank completion work; --question-offset <n> opens another page
  cleanup               Inspect an ordered read-only repair plan
  run <codex|claude> -- <args>  Run a bounded host session
  mcp                   Start the built Projector MCP composition
  watch                 Scan repository changes without executing repository code
  ci                    Run authenticated CI proof and reporting
  verify [--clean]      Verify and optionally rebuild derived state
  upgrade               Compile the current authenticated modernization candidate
  explain <target>      Explain findings for a path or finding identity

Options:
  -h, --help     Show this help text
  -v, --version  Show the Projector version
  --format       text, json, md, or sarif
  --mode         observe, guide, govern, autonomous, or salvage
  --dry-run      Refuse mutation
  --audit-only   Refuse mutation`;

export interface ProjectorCommandResult {
  readonly exitCode: number;
  readonly output: string;
  readonly report: any;
}

export interface ProjectorCommandOptions {
  readonly cwd?: string;
  readonly governance?: {
    readonly detectCanonicalConflictPaths: (repositoryRoot: string) => Promise<readonly string[]>;
    readonly assessOperationRisk?: (command: SliceCommand, repositoryRoot: string) => Promise<RiskClass>;
    readonly operation?: OperationRiskInput;
  };
  readonly architecture?: ArchitectureCliPort;
  readonly coverage?: CoverageCliPort;
  readonly lifecycle?: RepositoryLifecycleCliPort;
  readonly knowledge?: RepositoryKnowledgeCliPort;
  readonly runHost?: RunHostCliPort;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly signal?: AbortSignal;
  readonly mcp?: McpCliPort;
  readonly operations?: OperationalCliPort;
  readonly upgrade?: { readonly run: (request: { readonly repositoryRoot: string }) => Promise<Record<string, unknown>> };
}

export interface RunHostCliRequest { readonly host: "codex" | "claude"; readonly sessionSelector: string; readonly repositoryRoot: string; readonly argv: readonly string[]; readonly environment: Readonly<Record<string, string>>; readonly signal: AbortSignal }
export interface RunHostCliResult { readonly status: "completed" | "failed" | "cancelled" | "unavailable"; readonly exitCode: number | null; readonly changedPaths: readonly string[]; readonly reconciled: boolean; readonly signal?: string }
export interface RunHostCliPort { readonly resolve: (request: Omit<RunHostCliRequest, "argv" | "environment" | "signal">) => Promise<{ readonly authenticated: true; readonly host: "codex" | "claude" }>; readonly run: (request: RunHostCliRequest) => Promise<RunHostCliResult> }
export interface McpCliPort { readonly start: (request: { readonly repositoryRoot: string; readonly signal: AbortSignal; readonly sessionSelector?: string }) => Promise<{ readonly status: "ready" | "unavailable"; readonly tools: readonly string[]; readonly capabilityToken?: string; readonly transport: { handle(request: { readonly jsonrpc: "2.0"; readonly id: string | number | null; readonly method: string; readonly params?: unknown }): Promise<unknown> } }> }
export interface OperationalCliPort { readonly run: (request: { readonly command: "watch" | "ci" | "verify"; readonly repositoryRoot: string; readonly clean: boolean; readonly policy: ReturnType<typeof normalizeExecutionPolicy>; readonly signal: AbortSignal; readonly allowPersistence: boolean; readonly maximumEvents?: number; readonly continuationSelector?: string }) => Promise<OperationalReport>; readonly authenticate: (report: OperationalReport) => Promise<boolean> }


export interface RepositoryLifecycleCliPort {
  readonly capture: (request: { readonly repositoryRoot: string; readonly request: string; readonly proposalPath: string; readonly knowledgeContextId?: string }) => Promise<Record<string, unknown>>;
  readonly plan: (request: { readonly repositoryRoot: string; readonly selector: string }) => Promise<Record<string, unknown>>;
  readonly approve: (request: { readonly repositoryRoot: string; readonly selector: string; readonly planHash: string }) => Promise<Record<string, unknown>>;
  readonly apply: (request: { readonly repositoryRoot: string; readonly selector: string; readonly signal: AbortSignal }) => Promise<Record<string, unknown>>;
  readonly recover: (request: { readonly repositoryRoot: string; readonly selector: string }) => Promise<Record<string, unknown>>;
  readonly resume: (request: { readonly repositoryRoot: string; readonly selector: string; readonly signal: AbortSignal }) => Promise<Record<string, unknown>>;
}

export type CoverageStrictness = "proven" | "bounded" | "high-confidence" | "partial";
export interface CoverageCliRequest { readonly scope: string; readonly strictness: CoverageStrictness; readonly budgetTokens?: number; readonly budgetCost?: number; readonly continuationSelector?: string; readonly questionOffset?: number }
export interface CoverageCliReport {
  readonly proofStatement: CoverageSnapshot["proofStatement"];
  readonly approvalRequired: boolean;
  readonly budgetExhausted: boolean;
  readonly continuationPersisted: boolean;
  readonly boundary: readonly string[];
  readonly lanes: readonly { readonly key: string; readonly observability: ObservabilityClass }[];
  readonly unavailableSurfaceIds: readonly string[];
  readonly completion?: unknown;
}
export interface CoverageCliPort {
  readonly coverage: (request: CoverageCliRequest) => Promise<CoverageCliReport>;
  readonly complete: (request: CoverageCliRequest) => Promise<CoverageCliReport>;
  readonly cleanup: (request: CoverageCliRequest) => Promise<CoverageCliReport>;
}

export interface ArchitectureCliPort {
  readonly load: () => Promise<{ decisions: readonly ArchitectureDecision[]; concerns: readonly ArchitectureConcern[] }>;
  readonly validity: (decisionId: string) => Promise<DecisionValidityAssessment | undefined>;
  readonly overlap: DecisionOverlapPort;
  readonly population: DecisionPopulationPort;
  readonly preflight?: () => Promise<Omit<ArchitecturePreflightInput, "mode" | "risk">>;
  readonly preflightPorts?: ArchitecturePreflightPorts;
}

const execFileAsync = promisify(execFile);
const riskRank = (risk: RiskClass): number => ["R0", "R1", "R2", "R3", "R4"].indexOf(risk);
async function defaultCanonicalConflictPaths(repositoryRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["-C", repositoryRoot, "diff", "--name-only", "--diff-filter=U"], { encoding: "utf8" });
  return stdout.split(/\r?\n/u).filter((path) => path.startsWith(".projector/")).sort();
}

interface ParsedCommand {
  readonly command: SliceCommand;
  readonly target?: string;
  readonly format: ReportFormat;
  readonly policy: CliPolicyInput;
  readonly decisions: boolean;
  readonly coverageRequest: CoverageCliRequest;
  readonly selector?: string;
  readonly proposalPath?: string;
  readonly planHash?: string;
  readonly entity?: string;
  readonly knowledgeContextId?: string;
  readonly host?: "codex" | "claude";
  readonly hostArgv: readonly string[];
  readonly sessionSelector?: string;
  readonly clean: boolean;
}

function optionValue(arguments_: readonly string[], name: string, allowLeadingHyphen = false): string | undefined {
  const indexes: number[] = [];
  for (let index = 1; index < arguments_.length; index += 1) {
    const value = arguments_[index]!;
    if (!valueFlags.has(value)) continue;
    if (value === name) indexes.push(index);
    index += 1;
  }
  if (indexes.length > 1) throw new Error(`duplicate ${name.replace(/^--/u, "")} option`);
  const index = indexes[0];
  if (index === undefined) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || (!allowLeadingHyphen && value.startsWith("-"))) throw new Error(`${name} requires a value`);
  return value;
}

function positiveNumber(raw: string | undefined, name: string, integer = false): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isSafeInteger(value))) throw new Error(`${name} must be a positive finite${integer ? " integer" : ""} value`);
  return value;
}

function normalizeScope(raw: string | undefined): string {
  const scope = (raw ?? ".").trim().replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || ".";
  if (scope.startsWith("/") || scope.split("/").includes("..")) throw new Error("--scope must remain within the repository boundary");
  return scope;
}

const valueFlags = new Set(["--format", "--mode", "--strictness", "--scope", "--budget-tokens", "--budget-cost", "--question-offset", "--continuation", "--session", "--proposal", "--plan-hash", "--entity", "--context", "--request"]);
const booleanFlags = new Set(["--decisions", "--dry-run", "--audit-only", "--non-interactive", "--clean", "--compact"]);
function hasBooleanFlag(arguments_: readonly string[], name: string): boolean {
  for (let index = 1; index < arguments_.length; index += 1) {
    const value = arguments_[index]!;
    if (valueFlags.has(value)) { index += 1; continue; }
    if (value === name) return true;
  }
  return false;
}
function argumentSeparatorIndex(arguments_: readonly string[]): number {
  for (let index = 1; index < arguments_.length; index += 1) {
    const value = arguments_[index]!;
    if (valueFlags.has(value)) { index += 1; continue; }
    if (value === "--") return index;
  }
  return -1;
}
function validateArguments(arguments_: readonly string[], command: SliceCommand): void {
  const seen = new Set<string>();
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (valueFlags.has(argument)) {
      if (seen.has(argument)) throw new Error(`duplicate ${argument.slice(2)} option`);
      seen.add(argument); index += 1; continue;
    }
    if (booleanFlags.has(argument)) {
      if (seen.has(argument)) throw new Error(`duplicate ${argument.slice(2)} flag`);
      seen.add(argument); continue;
    }
    if (argument.startsWith("-")) throw new Error(`unknown flag: ${argument}`);
    if ((command !== "context" && command !== "reconcile" && command !== "explain" && command !== "change" && command !== "plan" && command !== "approve" && command !== "apply" && command !== "resume" && command !== "recover" && command !== "run") || index !== 1) throw new Error(`unknown argument: ${argument}`);
  }
}

function parseCommand(arguments_: readonly string[]): ParsedCommand {
  const command = arguments_[0];
  if (command !== "init" && command !== "audit" && command !== "context" && command !== "reconcile" && command !== "change" && command !== "plan" && command !== "apply"
    && command !== "approve" && command !== "resume" && command !== "upgrade" && command !== "explain" && command !== "coverage" && command !== "complete" && command !== "cleanup" && command !== "run" && command !== "mcp" && command !== "watch" && command !== "ci" && command !== "recover" && command !== "verify") {
    throw new Error(`unknown command: ${command ?? ""}`);
  }
  const separator = argumentSeparatorIndex(arguments_);
  if (command === "run" && separator < 0) throw new Error("run requires the -- argv separator");
  if (command !== "run" && separator >= 0) throw new Error("argv separator is only valid with run");
  const commandArguments = command === "run" ? arguments_.slice(0, separator) : arguments_;
  const hostArgv = command === "run" ? arguments_.slice(separator + 1) : [];
  validateArguments(commandArguments, command);
  if (hasBooleanFlag(commandArguments, "--compact") && command !== "context" && command !== "reconcile") throw new Error("--compact is only valid with context or reconcile");
  const formatValue = optionValue(commandArguments, "--format") ?? "text";
  if (formatValue !== "text" && formatValue !== "json" && formatValue !== "md" && formatValue !== "sarif") throw new Error(`unsupported format: ${formatValue}`);
  const modeValue = optionValue(commandArguments, "--mode");
  if (modeValue !== undefined && modeValue !== "observe" && modeValue !== "guide" && modeValue !== "govern"
    && modeValue !== "autonomous" && modeValue !== "salvage") {
    throw new Error(`unsupported mode: ${modeValue}`);
  }
  const target = command === "explain" && arguments_[1] !== undefined && !arguments_[1].startsWith("-")
    ? arguments_[1]
    : undefined;
  if (command === "explain" && target === undefined) throw new Error("explain requires a target");
  const positional = (command === "context" || command === "reconcile" || command === "change" || command === "plan" || command === "approve" || command === "apply" || command === "resume" || command === "recover") && arguments_[1] !== undefined && !arguments_[1].startsWith("-") ? arguments_[1] : undefined;
  const explicitRequest = optionValue(commandArguments, "--request", true);
  if (explicitRequest !== undefined && command !== "context") throw new Error("--request is only valid with context");
  if (command === "context" && positional !== undefined && explicitRequest !== undefined) throw new Error("context request must use either positional syntax or --request, not both");
  const contextRequest = command === "context" ? explicitRequest ?? positional : undefined;
  if (command === "context" && (contextRequest === undefined || contextRequest.trim() === "" || contextRequest.includes("\0"))) throw new Error("context requires a safe nonblank request");
  if (command === "reconcile" && positional === undefined) throw new Error("reconcile requires a context identity");
  const entity = optionValue(commandArguments, "--entity");
  const knowledgeContextId = optionValue(commandArguments, "--context");
  if (knowledgeContextId !== undefined && command !== "change") throw new Error("--context is only valid with change");
  if (knowledgeContextId !== undefined && !/^[a-z0-9][a-z0-9._:-]*$/iu.test(knowledgeContextId)) throw new Error("--context requires a safe saved context identity");
  if (entity !== undefined && command !== "context") throw new Error("--entity is only valid with context");
  if (entity !== undefined && (entity.trim() === "" || entity.includes("\0"))) throw new Error("--entity requires a safe nonblank identity");
  if (command === "change" && positional === undefined) throw new Error("change requires a request");
  const proposalPath = optionValue(commandArguments, "--proposal");
  const planHash = optionValue(commandArguments, "--plan-hash");
  if (proposalPath !== undefined && command !== "change") throw new Error("--proposal is only valid with change");
  if (command === "change" && proposalPath === undefined) throw new Error("change requires --proposal");
  if (command === "change" && proposalPath !== undefined && (positional!.trim() === "" || positional!.includes("\0"))) throw new Error("lifecycle change request must be safe nonblank text");
  if (positional !== undefined && command !== "context" && !(command === "change" && proposalPath !== undefined) && !/^[a-z0-9][a-z0-9._:-]*$/iu.test(positional)) throw new Error("selector must be a safe repository-local identity");
  if (command === "approve" && (planHash === undefined || !planHash.startsWith("sha256:v1:"))) throw new Error("approve requires an authenticated plan hash via --plan-hash");
  if (command !== "approve" && planHash !== undefined) throw new Error("--plan-hash is only valid with approve");
  if ((command === "plan" || command === "approve" || command === "apply" || command === "recover" || command === "resume") && positional === undefined) throw new Error(`${command} requires a lifecycle selector`);
  const hostValue = command === "run" ? commandArguments[1] : undefined;
  if (command === "run" && hostValue !== "codex" && hostValue !== "claude") throw new Error(`unsupported host: ${hostValue ?? ""}`);
  const sessionSelector = optionValue(commandArguments, "--session");
  if (command === "run" && (sessionSelector === undefined || !/^session:[a-z0-9][a-z0-9._:-]*$/iu.test(sessionSelector))) throw new Error("run requires a safe explicit --session selector");
  if (command === "mcp" && sessionSelector !== undefined && !/^session:[a-z0-9][a-z0-9._:-]*$/iu.test(sessionSelector)) throw new Error("mcp requires a safe session selector");
  if (command !== "run" && command !== "mcp" && sessionSelector !== undefined) throw new Error("--session is only valid with run or mcp");
  const decisions = hasBooleanFlag(commandArguments, "--decisions");
  const clean = hasBooleanFlag(commandArguments, "--clean"); if (clean && command !== "verify") throw new Error("--clean is only valid with verify");
  if (decisions && command !== "audit") throw new Error("--decisions is only valid with audit");
  const coverageCommand = command === "coverage" || command === "complete" || command === "cleanup";
  const explicitStrictness = optionValue(commandArguments, "--strictness");
  const rawScope = optionValue(commandArguments, "--scope");
  const rawBudgetTokens = optionValue(commandArguments, "--budget-tokens");
  const rawBudgetCost = optionValue(commandArguments, "--budget-cost");
  const rawQuestionOffset = optionValue(commandArguments, "--question-offset");
  if (rawQuestionOffset !== undefined && command !== "complete" && command !== "cleanup") throw new Error("--question-offset is only valid with complete or cleanup");
  if (rawQuestionOffset !== undefined && (!/^\d+$/u.test(rawQuestionOffset) || !Number.isSafeInteger(Number(rawQuestionOffset)))) throw new Error("--question-offset must be a nonnegative safe integer");
  if (!coverageCommand && [explicitStrictness, rawScope].some((value) => value !== undefined)) throw new Error("coverage scope and strictness are only valid with coverage, complete, or cleanup");
  if (!coverageCommand && command !== "watch" && [rawBudgetTokens, rawBudgetCost].some((value) => value !== undefined)) throw new Error("budgets are only valid with watch, coverage, complete, or cleanup");
  const strictnessValue = explicitStrictness ?? "bounded";
  if (strictnessValue !== "proven" && strictnessValue !== "bounded" && strictnessValue !== "high-confidence" && strictnessValue !== "partial") throw new Error(`unsupported coverage strictness: ${strictnessValue}`);
  const continuationSelector = optionValue(commandArguments, "--continuation");
  if (continuationSelector !== undefined && command !== "cleanup" && command !== "watch") throw new Error("--continuation is only valid with watch or cleanup");
  if (command === "watch" && continuationSelector !== undefined && continuationSelector !== "watch:default") throw new Error("watch continuation selector must be watch:default");
  const budgetTokens = positiveNumber(rawBudgetTokens, "--budget-tokens", true);
  const budgetCost = positiveNumber(rawBudgetCost, "--budget-cost");
  const selector = contextRequest ?? positional;
  return {
    command,
    ...(target === undefined ? {} : { target }),
    format: formatValue,
    decisions,
    clean,
    hostArgv,
    ...(hostValue === "codex" || hostValue === "claude" ? { host: hostValue } : {}),
    ...(sessionSelector === undefined ? {} : { sessionSelector }),
    coverageRequest: {
      scope: normalizeScope(rawScope),
      strictness: strictnessValue,
      ...(budgetTokens === undefined ? {} : { budgetTokens }),
      ...(budgetCost === undefined ? {} : { budgetCost }),
      ...(rawQuestionOffset === undefined ? {} : { questionOffset: Number(rawQuestionOffset) }),
      ...(continuationSelector === undefined ? {} : { continuationSelector: continuationSelector.trim() }),
    },
    ...(selector === undefined ? {} : { selector }),
    ...(proposalPath === undefined ? {} : { proposalPath }),
    ...(planHash === undefined ? {} : { planHash }),
    ...(entity === undefined ? {} : { entity }),
    ...(knowledgeContextId === undefined ? {} : { knowledgeContextId }),
    policy: {
      command,
      ...(modeValue === undefined ? {} : { mode: modeValue }),
      dryRun: hasBooleanFlag(commandArguments, "--dry-run"),
      auditOnly: hasBooleanFlag(commandArguments, "--audit-only"),
      nonInteractive: hasBooleanFlag(commandArguments, "--non-interactive"),
      clean,
    },
  };
}

function outputFor(command: SliceCommand, report: unknown, format: ReportFormat): string {
  if ((command === "watch" || command === "ci" || command === "recover" || command === "verify") && "operationalReport" in (report as object)) return renderOperationalReport((report as { operationalReport: OperationalReport }).operationalReport, format);
  if (format === "json") return JSON.stringify(report, null, 2);
  if (command === "context") return renderKnowledgeContext(report as Parameters<typeof renderKnowledgeContext>[0]);
  if (command === "reconcile") return renderKnowledgeReconciliation(report as Parameters<typeof renderKnowledgeReconciliation>[0]);
  if (command === "audit") {
    if ("decisionAudit" in (report as object)) {
      const count = (report as { decisionAudit: { findings: readonly unknown[] } }).decisionAudit.findings.length;
      return count === 0 ? "No architecture decision audit findings." : `${count} architecture decision audit findings.`;
    }
    const count = (report as { divergences: readonly unknown[] }).divergences.length;
    return count === 0 ? "No governed divergences found." : `${count} governed divergences found.`;
  }
  if (command === "plan") return renderLifecyclePlan(report);
  if (command === "change") return `change: ${(report as { selector: string }).selector}`;
  if (command === "explain") return (report as { explanation: string }).explanation;
  if (command === "coverage" || command === "complete" || command === "cleanup") {
    const coverage = report as CoverageCliReport;
    const completion = coverage.completion as { questionDisclosure: { included: number; total: number; omitted: number; blocking: number }; questionPage?: { offset: number; nextOffset: number | null }; questions: Array<{ id: string; blocking: boolean; affectedCount: number; question: string; reasons: string[] }> } | undefined;
    if (completion === undefined) return `${command}: ${coverage.proofStatement}`;
    const lines = [`${command}: ${coverage.proofStatement}`, `Open completion issues: ${completion.questionDisclosure.total}; blocking: ${completion.questionDisclosure.blocking}.`, "Coverage measures observed membership and executable obligations; behavioral satisfaction is not established."];
    if (command !== "coverage") {
      lines.push(`${completion.questionDisclosure.included} questions shown; ${completion.questionDisclosure.omitted} omitted.`, ...(command === "cleanup" ? ["Read-only repair plan; no changes executed."] : []));
      for (const question of completion.questions) lines.push(`${question.blocking ? "BLOCKING" : "NEXT"} ${question.id} (${question.affectedCount} observed files): ${question.question}`, ...question.reasons.map((reason) => `  ${reason}`));
      if (completion.questionPage?.nextOffset !== undefined && completion.questionPage.nextOffset !== null) lines.push(completion.questionPage.nextOffset === completion.questionPage.offset ? "Increase the token budget to inspect the next question." : `Next page: --question-offset ${completion.questionPage.nextOffset} with the same scope and unchanged evidence.`);
    }
    return lines.join("\n");
  }
  if (command === "run") return (report as { dryRun?: boolean }).dryRun === true ? "run: dry-run" : `run: ${(report as RunHostCliResult).status}`;
  if (command === "mcp") return `mcp: ${(report as { status: string }).status}`;
  if (command === "upgrade") return `upgrade: ${(report as { selector: string }).selector}`;
  return `${command} completed.`;
}

interface IntentReviewValue {
  readonly identityResolution?: { readonly outcome: string; readonly selectedEntityIds: readonly string[]; readonly rationale: string; readonly newBoundary?: unknown; readonly contextId: string; readonly contextHash: string };
  readonly subjects: readonly {
    readonly id: string;
    readonly kind: "requirement" | "scenario";
    readonly operation: "preserve" | "add" | "revise";
    readonly before: unknown;
    readonly after: unknown;
    readonly rationale: string | null;
  }[];
  readonly relatedObligations: readonly { readonly id: string; readonly kind: string; readonly payload: unknown }[];
  readonly canonicalMutations?: readonly { readonly id: string; readonly kind: string; readonly operation: string; readonly before: unknown; readonly after: unknown; readonly rationale: string }[];
  readonly blockingUnknowns?: readonly string[];
}

function renderLifecyclePlan(report: unknown): string {
  const preview = (report as { preview: { expectedDiff: string; intentReview?: IntentReviewValue } }).preview;
  if (preview.intentReview === undefined) return preview.expectedDiff;
  const review = preview.intentReview;
  const lines = [preview.expectedDiff, "", "Intent review:"];
  if (review.identityResolution !== undefined) {
    const choice = review.identityResolution;
    lines.push(`Identity: ${choice.outcome}`, `  selected: ${choice.selectedEntityIds.join(", ") || "none"}`, `  rationale: ${choice.rationale}`,
      `  candidate proof: ${choice.contextId} at ${choice.contextHash}`);
    if (choice.newBoundary !== undefined) lines.push(`  new boundary: ${JSON.stringify(choice.newBoundary)}`);
  }
  for (const subject of review.subjects) {
    lines.push(`${subject.operation.toUpperCase()} ${subject.kind} ${subject.id}`);
    appendMeaning(lines, "before", subject.kind, subject.before);
    appendMeaning(lines, "after", subject.kind, subject.after);
    lines.push(`  rationale: ${subject.rationale ?? "none provided"}`);
  }
  for (const mutation of review.canonicalMutations ?? []) {
    lines.push(`${mutation.operation.toUpperCase()} ${mutation.kind} ${mutation.id}`,
      `  before: ${mutation.before === null ? "absent" : JSON.stringify(mutation.before)}`,
      `  after: ${mutation.after === null ? "retired" : JSON.stringify(mutation.after)}`,
      `  rationale: ${mutation.rationale}`);
  }
  lines.push("", "Related obligations:");
  if (review.relatedObligations.length === 0) lines.push("- none");
  else for (const obligation of review.relatedObligations) {
    lines.push(`- ${obligation.kind} ${obligation.id}`);
    if (obligation.kind === "requirement") appendMeaning(lines, "  current", "requirement", obligation.payload);
    else if (obligation.kind === "behavioral-scenario") appendMeaning(lines, "  current", "scenario", obligation.payload);
  }
  lines.push("", "Blocking unknowns:");
  if ((review.blockingUnknowns?.length ?? 0) === 0) lines.push("- none");
  else for (const unknown of review.blockingUnknowns!) lines.push(`- ${unknown}`);
  return lines.join("\n");
}

function appendMeaning(lines: string[], label: string, kind: "requirement" | "scenario", value: unknown): void {
  if (!isRecord(value)) { lines.push(`  ${label}: absent`); return; }
  lines.push(`  ${label} title: ${stringValue(value.title)}`);
  if (kind === "requirement") {
    lines.push(`  ${label} meaning: ${stringValue(value.statement)}`);
    return;
  }
  const steps = Array.isArray(value.steps) ? value.steps : [];
  lines.push(`  ${label} meaning:`);
  if (steps.length === 0) lines.push("    (no scenario steps)");
  else for (const step of steps) {
    const record = isRecord(step) ? step : {};
    lines.push(`    ${stringValue(record.role)}: ${stringValue(record.statement)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "(unavailable)";
}

function coverageExitCode(request: CoverageCliRequest, report: CoverageCliReport): number {
  const boundaryMatches = report.boundary.length === 1 && report.boundary[0] === request.scope;
  const laneKeys = [...new Set(report.lanes.map(({ key }) => key))].sort();
  const requiredKeys = [...REQUIRED_COVERAGE_LANES].sort();
  const exactLaneInventory = report.lanes.length === REQUIRED_COVERAGE_LANES.length && JSON.stringify(laneKeys) === JSON.stringify(requiredKeys);
  const requiredUnavailable = !boundaryMatches || !exactLaneInventory || report.unavailableSurfaceIds.length > 0 || report.lanes.some(({ observability }) => observability === "unavailable");
  const proofRank: Record<CoverageSnapshot["proofStatement"], number> = { "not-established": -1, partial: 0, "high-confidence": 1, bounded: 2, "proven-within-boundary": 3 };
  const requestedRank: Record<CoverageStrictness, number> = { partial: 0, "high-confidence": 1, bounded: 2, proven: 3 };
  const strictnessMet = boundaryMatches && exactLaneInventory && proofRank[report.proofStatement] >= requestedRank[request.strictness];
  return requiredUnavailable ? 5
    : report.budgetExhausted && report.continuationPersisted ? 7
      : report.budgetExhausted ? 1
        : report.approvalRequired ? 3
          : !strictnessMet ? 4 : 0;
}

export async function executeProjector(
  arguments_: readonly string[],
  options: ProjectorCommandOptions = {},
): Promise<ProjectorCommandResult> {
  const invocationFlag = (name: string): boolean => arguments_[0] === name || hasBooleanFlag(arguments_, name);
  if (arguments_.length === 0 || invocationFlag("--help") || invocationFlag("-h")
    || invocationFlag("--version") || invocationFlag("-v")) {
    const output = renderCli(arguments_);
    return { exitCode: 0, output, report: { output } };
  }
  const parsed = parseCommand(arguments_);
  const policy = normalizeExecutionPolicy(parsed.policy);
  let repositoryRoot = options.cwd ?? process.cwd();
  const defaultOperation: OperationRiskInput = parsed.command === "init" || (parsed.command === "context" && policy.allowAutoMutation)
    ? { command: parsed.command, sideEffect: "derived-write", externalWrite: false, canonicalMutation: false }
    : parsed.command === "approve" ? { command: parsed.command, sideEffect: "derived-write", externalWrite: false, canonicalMutation: false }
    : parsed.command === "apply" || parsed.command === "resume" || parsed.command === "upgrade" || parsed.command === "run" || parsed.command === "recover" || (parsed.command === "verify" && parsed.clean)
      ? { command: parsed.command, sideEffect: "workspace-write", externalWrite: false, canonicalMutation: false }
      : { command: parsed.command, sideEffect: "read-only", externalWrite: false, canonicalMutation: false };
  const suppliedOperation = options.governance?.operation;
  if (suppliedOperation !== undefined && suppliedOperation.command !== parsed.command) {
    return { exitCode: 2, output: "operation risk descriptor does not match command", report: { policy, blocked: true } };
  }
  const candidateRisks = [deriveOperationRisk(defaultOperation)];
  if (suppliedOperation !== undefined) candidateRisks.push(deriveOperationRisk(suppliedOperation));
  const operationRisk = candidateRisks.sort((left, right) => riskRank(right) - riskRank(left))[0]!;
  if (policy.allowAutoMutation) {
    try { assertOperationRiskAuthorized(policy, operationRisk); }
    catch (error) {
      const output = error instanceof Error ? error.message : String(error);
      return { exitCode: 2, output, report: { policy, blocked: true, operationRisk } };
    }
  }
  const activation = await inspectProjectActivation(repositoryRoot);
  repositoryRoot = activation.repositoryRoot;
  if (parsed.command !== "init" && parsed.command !== "mcp" && activation.status !== "enabled") {
    const report = { policy, projectEnabled: false, activation };
    const output = parsed.format === "json" ? canonicalJson(report) : activation.reason;
    return { exitCode: 5, output, report };
  }
  if (parsed.command === "init" && policy.allowAutoMutation && activation.status === "disabled" && activation.failure !== "missing") {
    throw new Error(activation.reason);
  }
  if (policy.allowAutoMutation && parsed.command !== "mcp") {
    const governance = options.governance ?? { detectCanonicalConflictPaths: defaultCanonicalConflictPaths };
    const conflicts = await governance.detectCanonicalConflictPaths(repositoryRoot);
    if ((policy.preset === "govern" || policy.preset === "autonomous") && conflicts.length > 0) {
      const output = `canonical governance conflict blocks ${policy.preset}: ${[...conflicts].sort().join(", ")}`;
      return { exitCode: 2, output, report: { policy, blocked: true, conflicts: [...conflicts].sort() } };
    }
  }
  let report: any;
  let exitCode = 0;
  switch (parsed.command) {
    case "init":
      if (policy.allowAutoMutation) {
        const rebuild = await safeRebuildAcceptedState(repositoryRoot);
        const initialized = await initializePreparedProject(repositoryRoot, { package: await cliPackageIdentity() });
        if (initialized.readiness.status !== "ready") throw new Error(initialized.readiness.reason);
        report = { policy, initialized: true, projectEnabled: true, configCreated: initialized.created, rebuild };
      } else report = { policy, initialized: false, projectEnabled: activation.status === "enabled", dryRun: true };
      break;
    case "audit": {
      if (parsed.decisions) {
        const architecture = options.architecture ?? defaultArchitecturePort(repositoryRoot); const loaded = await architecture.load();
        const activeDecisions = loaded.decisions.filter(({ lifecycle }) => lifecycle === "active");
        const decisionAudit = await auditArchitectureDecisions({ ...loaded, decisions: activeDecisions }, { overlap: architecture.overlap, population: architecture.population });
        const decisionValidity = await Promise.all(activeDecisions.map(({ id }) => architecture.validity(id)));
        report = { policy, decisionIds: activeDecisions.map(({ id }) => id).sort(), decisionAudit, decisionValidity };
        exitCode = decisionAudit.findings.length === 0 && !decisionValidity.some((assessment) => assessment === undefined || assessment.blocksCurrentChange) ? 0 : 2;
        break;
      }
      const analysis = await analyzeLocalRepository({ repositoryRoot });
      report = {
        policy,
        analysis,
        divergences: analysis.divergences,
      };
      exitCode = analysis.divergences.length === 0 ? 0 : 2;
      break;
    }
    case "change": {
      const lifecycle = options.lifecycle ?? defaultRepositoryLifecyclePort();
      report = { policy, ...await lifecycle.capture({ repositoryRoot, request: parsed.selector!, proposalPath: parsed.proposalPath!,
        ...(parsed.knowledgeContextId === undefined ? {} : { knowledgeContextId: parsed.knowledgeContextId }) }) };
      break;
    }
    case "context": {
      const knowledge = options.knowledge ?? defaultKnowledgeCliPort();
      report = { policy, ...await knowledge.context({ repositoryRoot, request: parsed.selector!,
        ...(parsed.entity === undefined ? {} : { entities: [parsed.entity] }),
        persist: policy.allowAutoMutation, signal: options.signal ?? new AbortController().signal }) };
      break;
    }
    case "reconcile": {
      const knowledge = options.knowledge ?? defaultKnowledgeCliPort();
      const result = await knowledge.reconcile({ repositoryRoot, contextId: parsed.selector!, signal: options.signal ?? new AbortController().signal });
      report = { policy, ...result };
      exitCode = result.governance?.status === "violated" ? 2 : result.status === "stale" ? 4
        : result.governance?.status === "unknown" || (result.status !== "current" && result.status !== "rebound") ? 5 : 0;
      break;
    }
    case "plan": {
      if (options.architecture?.preflight !== undefined) {
        if (options.architecture.preflightPorts === undefined) return { exitCode: 5, output: "architecture preflight proof ports are unavailable", report: { policy, blocked: true } };
        const providerInput = await options.architecture.preflight();
        const architecturePreflight = await runArchitecturePreflight({ ...providerInput, mode: policy.preset, risk: operationRisk }, options.architecture.preflightPorts);
        if (!architecturePreflight.planningAllowed) return { exitCode: 2, output: architecturePreflight.reasons.join("\n"), report: { policy, architecturePreflight, blocked: true } };
      }
      report = { policy, ...await (options.lifecycle ?? defaultRepositoryLifecyclePort()).plan({ repositoryRoot, selector: parsed.selector! }) };
      break;
    }
    case "approve": {
      const lifecycle = options.lifecycle ?? defaultRepositoryLifecyclePort();
      report = { policy, ...await lifecycle.approve({ repositoryRoot, selector: parsed.selector!, planHash: parsed.planHash! }) };
      break;
    }
    case "apply": {
      if (!policy.allowAutoMutation) { report = { policy, dryRun: true, selector: parsed.selector }; break; }
      report = { policy, ...await (options.lifecycle ?? defaultRepositoryLifecyclePort()).apply({ repositoryRoot, selector: parsed.selector!, signal: options.signal ?? new AbortController().signal }) };
      exitCode = report.outcome === "success" ? 0 : report.outcome === "partial" || report.outcome === "recovery-required" ? 6 : 2;
      break;
    }
    case "resume": {
      const lifecycle = options.lifecycle ?? defaultRepositoryLifecyclePort();
      if (!policy.allowAutoMutation) { report = { policy, dryRun: true, selector: parsed.selector }; break; }
      try {
        report = { policy, ...await lifecycle.resume({ repositoryRoot, selector: parsed.selector!, signal: options.signal ?? new AbortController().signal }) };
        exitCode = report.outcome === "success" ? 0 : report.outcome === "partial" || report.outcome === "recovery-required" ? 6 : 2;
      } catch (error) {
        const structured = error instanceof Error && "code" in error && error.code === "lifecycle-recovery-required" && "outcomes" in error && Array.isArray(error.outcomes);
        if (!structured) throw error;
        report = { policy, kind: "lifecycle-resume", selector: parsed.selector, outcome: "recovery-required", outcomes: error.outcomes, error: error.message };
        exitCode = 6;
      }
      break;
    }
    case "upgrade": {
      if (!policy.allowAutoMutation) { report = { policy, kind: "upgrade-candidate", selector: "upgrade:pending", applied: false, persisted: false, dryRun: true }; break; }
      const upgrade = options.upgrade?.run ?? (async ({ repositoryRoot }: { repositoryRoot: string }) => runDefaultUpgradeWorkflow(repositoryRoot));
      report = { policy, ...await upgrade({ repositoryRoot }) };
      break;
    }
    case "coverage":
    case "complete":
    case "cleanup": {
      const coveragePort = options.coverage ?? defaultCoveragePort(repositoryRoot);
      const provider = parsed.command === "coverage" ? coveragePort.coverage : parsed.command === "complete" ? coveragePort.complete : coveragePort.cleanup;
      const coverageReport = await provider(parsed.coverageRequest);
      report = { policy, ...coverageReport };
      exitCode = coverageExitCode(parsed.coverageRequest, coverageReport);
      break;
    }
    case "run": {
      const runHost = options.runHost ?? createBuiltRunHostPort();
      const resolvedSession = await runHost.resolve({ host: parsed.host!, sessionSelector: parsed.sessionSelector!, repositoryRoot });
      if (!policy.allowAutoMutation) {
        report = { policy, dryRun: true, host: resolvedSession.host, sessionAuthenticated: true, argv: parsed.hostArgv };
        break;
      }
      const allowedKeys = new Set(["CI", "LANG", "LC_ALL", "PATH", "TERM"]);
      const sourceEnvironment = options.environment ?? process.env;
      const environmentEntries: [string, string][] = [];
      for (const [key, value] of Object.entries(sourceEnvironment)) if (allowedKeys.has(key) && value !== undefined) environmentEntries.push([key, value]);
      const environment = Object.fromEntries(environmentEntries.sort(([left], [right]) => left.localeCompare(right)));
      const runResult = await runHost.run({ host: parsed.host!, sessionSelector: parsed.sessionSelector!, repositoryRoot, argv: parsed.hostArgv, environment, signal: options.signal ?? new AbortController().signal });
      report = { policy, host: parsed.host!, sessionSelector: parsed.sessionSelector!, argv: parsed.hostArgv, ...runResult };
      exitCode = runResult.status === "completed" && runResult.reconciled ? 0 : runResult.status === "unavailable" ? 5 : 6;
      break;
    }
    case "mcp": {
      const mcpResult = await (options.mcp ?? createBuiltMcpCliPort()).start({ repositoryRoot, signal: options.signal ?? new AbortController().signal, ...(parsed.sessionSelector === undefined ? {} : { sessionSelector: parsed.sessionSelector }) });
      report = { policy, status: mcpResult.status, tools: mcpResult.tools, transportActive: true, capabilityAvailable: mcpResult.capabilityToken !== undefined }; exitCode = mcpResult.status === "ready" ? 0 : 5; break;
    }
    case "recover": {
      const lifecycle = options.lifecycle ?? defaultRepositoryLifecyclePort();
      report = { policy, ...await lifecycle.recover({ repositoryRoot, selector: parsed.selector! }) };
      exitCode = Array.isArray(report.outcomes) && report.outcomes.some((outcome: { action?: string }) => outcome.action === "recovery-required") ? 6 : 0;
      break;
    }
    case "watch": case "ci": case "verify": {
      const operations = options.operations ?? defaultOperationalCliPort(); const maximumEvents = parsed.coverageRequest.budgetTokens ?? (parsed.coverageRequest.budgetCost === undefined ? undefined : Math.max(1, Math.floor(parsed.coverageRequest.budgetCost))); const operationalReport = await operations.run({ command: parsed.command, repositoryRoot, clean: parsed.clean, policy, signal: options.signal ?? new AbortController().signal, allowPersistence: parsed.policy.dryRun !== true && policy.preset !== "observe", ...(maximumEvents === undefined ? {} : { maximumEvents }), ...(parsed.coverageRequest.continuationSelector === undefined ? {} : { continuationSelector: parsed.coverageRequest.continuationSelector }) }); if (!await operations.authenticate(operationalReport) || !validateOperationalReport(operationalReport)) return { exitCode: 6, output: "operational proof authentication failed", report: { policy, blocked: true } }; report = { policy, operationalReport }; exitCode = operationalReport.exitCode; break;
    }
    case "explain": {
      if (parsed.target!.startsWith("decision:")) {
        const architecture = options.architecture ?? defaultArchitecturePort(repositoryRoot); const loaded = await architecture.load();
        const decision = loaded.decisions.find(({ id }) => id === parsed.target);
        const validity = decision === undefined ? undefined : await architecture.validity(decision.id);
        if (decision === undefined || validity === undefined) {
          const explanation = `No architecture decision proof currently matches ${parsed.target}.`;
          report = { policy, target: parsed.target, explanation };
          break;
        }
        const decisionExplanation = explainArchitectureDecision(decision, validity);
        report = { policy, target: parsed.target, decisionExplanation, explanation: decisionExplanation.explanation };
        break;
      }
      const analysis = await analyzeLocalRepository({ repositoryRoot });
      const target = parsed.target!;
      const divergences = analysis.divergences.filter((item) => item.id === target || item.path === target || item.subjectIds.includes(target));
      const explanation = divergences.length === 0
        ? `No governed divergence currently matches ${target}.`
        : divergences.map((item) => `${item.code}: ${item.explanation} Caveat: ${item.coverageCaveat}`).join("\n");
      report = { policy, target, divergences, explanation };
      break;
    }
  }
  const compact = hasBooleanFlag(arguments_, "--compact");
  const display = !compact ? report : parsed.command === "context" ? presentKnowledgeContext(report)
    : parsed.command === "reconcile" ? presentKnowledgeReconciliation(report) : report;
  return { exitCode, output: outputFor(parsed.command, display, parsed.format), report };
}

async function safeRebuildAcceptedState(repositoryRoot: string) { const paths = await RepositoryPathService.create(repositoryRoot); const statePath = await paths.resolveWrite(".projector/state.db"); const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot(); const store = new SqliteDerivedStore(statePath.realTarget); try { const revision = store.replaceCanonicalSnapshot(snapshot); return { rootDigest: revision.rootDigest, documentCount: revision.documentCount, canonicalSemantics: { rootDigest: snapshot.rootDigest, documents: snapshot.documents.map(({ id, kind, semanticHash }) => ({ id, kind, semanticHash })) } }; } finally { store.close(); } }

function defaultRepositoryLifecyclePort(): RepositoryLifecycleCliPort {
  const service = (repositoryRoot: string) => RepositoryChangeLifecycleService.create(repositoryRoot);
  return {
    capture: async ({ repositoryRoot, request, proposalPath, knowledgeContextId }) => {
      const paths = await RepositoryPathService.create(repositoryRoot);
      const proposal = JSON.parse(await readFile((await paths.resolveRead(proposalPath)).realTarget, "utf8")) as unknown;
      const captured = await (await service(repositoryRoot)).capture({ request, proposal, ...(knowledgeContextId === undefined ? {} : { knowledgeContextId }) });
      return {
        kind: "lifecycle-change",
        selector: captured.capture.semanticChangeId,
        immutablePlanHash: captured.capture.planHash,
        proposalHash: captured.capture.proposalHash,
        ...(captured.capture.knowledgeContextId === undefined ? {} : { knowledgeContextId: captured.capture.knowledgeContextId }),
      };
    },
    plan: async ({ repositoryRoot, selector }) => {
      const planned = await (await service(repositoryRoot)).plan(selector);
      const expectedDiff = planned.compiled.exactPatchInput.edits.map(({ path, before, after }) => `${before === null ? "create" : after === null ? "delete" : "replace"} ${path}`).join("\n");
      return { kind: "lifecycle-plan", selector, immutablePlanHash: planned.capture.planHash, preview: { expectedDiff, intentReview: planned.compiled.intentReview }, plan: planned.compiled.compiledPlan.plan };
    },
    approve: async ({ repositoryRoot, selector, planHash }) => {
      const approval = await (await service(repositoryRoot)).approve(selector, planHash as ContentHash);
      return { kind: "lifecycle-approval", selector: approval.id, changeSelector: approval.semanticChangeId, immutablePlanHash: approval.planHash };
    },
    apply: async ({ repositoryRoot, selector, signal }) => ({ kind: "lifecycle-apply", selector, ...await (await service(repositoryRoot)).apply(selector, { signal }) }),
    recover: async ({ repositoryRoot, selector }) => ({ kind: "lifecycle-recovery", selector, outcomes: await (await service(repositoryRoot)).recover(selector) }),
    resume: async ({ repositoryRoot, selector, signal }) => ({ kind: "lifecycle-resume", selector, ...await (await service(repositoryRoot)).resume(selector, { signal }) }),
  };
}

function defaultArchitecturePort(repositoryRoot: string): ArchitectureCliPort {
  let observed: ReturnType<typeof inspectRepositoryArchitecture> | undefined;
  const inspect = () => observed ??= inspectRepositoryArchitecture(repositoryRoot);
  return {
    load: async () => { const result = await inspect(); return { decisions: result.decisions, concerns: result.concerns }; },
    overlap: { assess: async (left, right) => (await inspect()).overlap.assess(left, right) },
    population: { inspect: async (decision) => (await inspect()).population.inspect(decision) },
    validity: async (decisionId) => (await inspect()).validity(decisionId),
  };
}

function defaultOperationalCliPort(): OperationalCliPort {
  return { authenticate: async (report) => validateOperationalReport(report), run: async ({ command, repositoryRoot, clean, policy, signal, allowPersistence, maximumEvents }) => {
    if (command === "verify" && !clean) {
      return runReadOnlyOperationalVerification(repositoryRoot, {
        signal,
        toolVersion: PROJECTOR_VERSION,
        policy,
        applicationEvidence: createInstalledProjectorApplicationEvidenceHost({ repositoryRoot, signal, environment: process.env }),
      });
    }
    const started = Date.now(); const paths = await RepositoryPathService.create(repositoryRoot); let findings: Array<{ code: string; title: string; path?: string; severity: "note" | "warning" | "error"; evidenceIds: string[] }> = []; const proof: { -readonly [Key in keyof OperationalExitProof]: OperationalExitProof[Key] } = { commandFailed: false, blockingInvalidity: false, approvalRequired: false, incompleteCoverage: false, requiredUnavailable: false, recoveryFailure: false, budgetExhausted: false, resumable: false }; let analysisRecords: string[] = []; let journalRecords: string[] = []; let canonicalDigest: ContentHash = hashFramedDomain("operational-canonical", []);
    {
      const knowledge = await inspectCanonicalKnowledge(repositoryRoot); findings.push(...knowledge.findings); canonicalDigest = knowledge.canonicalDigest; proof.blockingInvalidity = knowledge.findings.length > 0;
      findings.push({ code: "canonical-authentication-scope", title: "Canonical checking authenticates document schemas and hashes. Architectural conformance and decision validity are not evaluated by this operational command; use context and reconcile for scoped semantic evidence.", severity: "note", evidenceIds: [] });
      if (clean && allowPersistence && policy.allowAutoMutation) { const state = await paths.resolveWrite(".projector/state.db"); await rm(state.realTarget, { force: true }); }
      const analyze = async () => analyzeLocalRepository({ repositoryRoot });
      if (command === "watch") { const coordinator = new WatchCoordinator({ scan: async ({ paths: changedPaths, fullScan }) => { const analysis = await analyze(); const value = { digest: hashFramedDomain("cli-watch-analysis", { paths: changedPaths, fullScan, artifacts: analysis.artifacts.map(({ id, contentHash }) => ({ id, contentHash })) }), affectedDependencyIds: changedPaths, generatedEventIds: [] }; return { ...value, contentHash: hashFramedDomain("authenticated-watch-scan", value) }; }, process: async ({ digest, affectedDependencyIds }) => ({ digest, cacheKeys: affectedDependencyIds }) }); const checkpointStore = allowPersistence && maximumEvents !== undefined ? await FileWatchCheckpointStore.create(paths) : undefined; const lifecycle = await runWatchLifecycle(coordinator, { subscribe: (listener, failure) => { const watcher = watchFileSystem(paths.root, (eventType, filename) => { if (filename !== null) { const path = filename.toString().replaceAll("\\", "/"); listener({ kind: /(?:^|\/)(?:dist|generated)(?:\/|$)/u.test(path) ? "generated" : eventType === "rename" ? "rename" : "change", path }); } }); watcher.on("error", failure); const overflow = setInterval(() => listener({ kind: "overflow", path: "." }), 500); overflow.unref(); return () => { clearInterval(overflow); watcher.close(); }; } }, { signal, ...(maximumEvents === undefined ? {} : { maximumEvents }), ...(checkpointStore === undefined ? {} : { checkpointStore }) }); proof.budgetExhausted = lifecycle.budgetExhausted; proof.resumable = lifecycle.checkpoint !== undefined; if (lifecycle.checkpoint !== undefined) journalRecords.push(lifecycle.checkpoint.contentHash); }
      const first = await analyze(); const second = clean ? await analyze() : first; const firstHash = hashFramedDomain("cli-operational-analysis", { artifacts: first.artifacts.map(({ id, contentHash }) => ({ id, contentHash })), failures: first.failures }); const secondHash = hashFramedDomain("cli-operational-analysis", { artifacts: second.artifacts.map(({ id, contentHash }) => ({ id, contentHash })), failures: second.failures }); analysisRecords = first.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`); findings.push(...first.failures.map(({ capability, message, scope, analyzerId }) => ({ code: capability, title: message, path: scope, severity: "error" as const, evidenceIds: [analyzerId] }))); if (firstHash !== secondHash) { findings.push({ code: "clean-incremental-mismatch", title: "Clean and incremental analysis differ", severity: "error", evidenceIds: [firstHash, secondHash] }); proof.recoveryFailure = true; } else if (first.surface.access === "unavailable") proof.requiredUnavailable = true; else if (first.failures.length > 0) proof.blockingInvalidity = true;
      if (clean && allowPersistence && policy.allowAutoMutation && !proof.recoveryFailure && !proof.blockingInvalidity) await safeRebuildAcceptedState(repositoryRoot);
    }
    const stateDigest = hashFramedDomain("operational-run-state", { repositoryRoot, command, findings, canonicalDigest }); let gitHead: string | undefined; try { gitHead = (await execFileAsync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], { encoding: "utf8" })).stdout.trim(); } catch { gitHead = undefined; } const evidence = { ...unavailableOperationalEvidence("not exercised by local operational composition"), configDigest: canonicalDigest, toolchainDigest: hashFramedDomain("operational-toolchain", PROJECTOR_VERSION), ...(gitHead === undefined ? {} : { gitHead: hashFramedDomain("operational-git-head", gitHead) }), worktreeDigest: stateDigest, canonicalDigest, analyzerRecords: analysisRecords, journalRecords, errorRecords: findings.filter(({ severity }) => severity === "error").map(({ code }) => code), durationMs: Date.now() - started }; let operational = createOperationalReport({ runId: hashFramedDomain("operational-run-id", { command, stateDigest, started }), command, exitProof: proof, evidence, policy, stateDigest, unavailableFields: ["modelRecords", "snapshotRecords", "decisionRecords", "transformRecords", "validationRecords"], findings });
    operational = createOperationalReport({ ...operational, unavailableFields: [...operational.unavailableFields, "architecturalConformance", "decisionValidity"] });
    if (allowPersistence && command !== "watch") { try { const store = await JsonlTelemetryStore.create(paths, ".projector/telemetry/runs.jsonl"); await store.append(operational); } catch (error) { operational = createOperationalReport({ ...operational, exitProof: { ...operational.exitProof, recoveryFailure: true }, evidence: { ...operational.evidence, errorRecords: [...operational.evidence.errorRecords, "telemetry-persistence"] }, findings: [...operational.findings.map(({ id: omitted, ...finding }) => { void omitted; return finding; }), { code: "telemetry-persistence", title: error instanceof Error ? error.message : String(error), severity: "error", evidenceIds: [] }] }); } }
    return operational;
  } };
}

function defaultCoveragePort(repositoryRoot: string): CoverageCliPort {
  return {
    coverage: (request) => inspectRepositoryCoverage(repositoryRoot, request, "coverage"),
    complete: (request) => inspectRepositoryCoverage(repositoryRoot, request, "complete"),
    cleanup: (request) => inspectRepositoryCoverage(repositoryRoot, request, "cleanup"),
  };
}
export function renderCli(arguments_: readonly string[]): string {
  if (arguments_.length === 0 || arguments_.includes("--help") || arguments_.includes("-h")) {
    return HELP;
  }
  if (arguments_.includes("--version") || arguments_.includes("-v")) {
    return PROJECTOR_VERSION;
  }
  throw new Error(`unknown argument: ${arguments_[0] ?? ""}`);
}

export async function main(arguments_ = process.argv.slice(2)): Promise<number> {
  try {
    if (arguments_[0] === "mcp") {
      const parsed = parseCommand(arguments_); const repositoryRoot = process.cwd(); const lifecycle = await createBuiltMcpCliPort().start({ repositoryRoot, signal: new AbortController().signal, ...(parsed.sessionSelector === undefined ? {} : { sessionSelector: parsed.sessionSelector }) });
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "projector/ready", params: { status: lifecycle.status, tools: lifecycle.tools, ...(lifecycle.capabilityToken === undefined ? {} : { capabilityToken: lifecycle.capabilityToken }) } })}\n`);
      await serveMcpTransport(lifecycle.transport, createInterface({ input: process.stdin, crlfDelay: Infinity }), (line) => process.stdout.write(`${line}\n`));
      return 0;
    }
    const controller = new AbortController(); const cancel = () => controller.abort(); if (arguments_[0] === "watch") { process.once("SIGINT", cancel); process.once("SIGTERM", cancel); }
    try { const result = await executeProjector(arguments_, { signal: controller.signal }); process.stdout.write(`${result.output}\n`); return result.exitCode; }
    finally { process.off("SIGINT", cancel); process.off("SIGTERM", cancel); }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

export async function serveMcpTransport(transport: { handle(request: { readonly jsonrpc: "2.0"; readonly id: string | number | null; readonly method: string; readonly params?: unknown }): Promise<unknown> }, lines: AsyncIterable<string>, write: (line: string) => unknown): Promise<void> {
  for await (const line of lines) { if (line.trim() === "") continue; let request: Parameters<typeof transport.handle>[0]; try { request = JSON.parse(line) as typeof request; } catch { write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } })); continue; } write(JSON.stringify(await transport.handle(request))); }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
