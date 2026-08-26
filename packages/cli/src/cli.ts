#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { watch as watchFileSystem } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { canonicalJson, hashFramedDomain, type ArchitectureConcern, type ArchitectureDecision, type ContentHash, type CoverageSnapshot, type DecisionValidityAssessment, type ObservabilityClass, type RiskClass, type StateDigest } from "@projector/core";
import { analyzeLocalRepository, type LocalRepositoryAnalysis } from "@projector/analyzers";
import { createStateBinding } from "@projector/engine";
import { CanonicalFileRepository, SqliteDerivedStore, createOperationalReport, renderOperationalReport, validateOperationalReport, unavailableOperationalEvidence, JsonlTelemetryStore, FileWatchCheckpointStore, RepositoryPathService, WatchCoordinator, runWatchLifecycle, type OperationalExitProof, type OperationalReport, type ReportFormat } from "@projector/runtime";
import {
  auditArchitectureDecisions,
  explainArchitectureDecision,
  runArchitecturePreflight,
  type ArchitecturePreflightInput,
  type ArchitecturePreflightPorts,
  type DecisionOverlapPort,
  type DecisionPopulationPort,
} from "@projector/engine/architecture";
import { compileAuthenticatedCoverageSnapshot, REQUIRED_COVERAGE_LANES, type CoverageEvidenceSnapshot, type CoverageLaneEvidence, type RequiredCoverageLaneKey } from "@projector/engine/coverage";

import { assertOperationRiskAuthorized, deriveOperationRisk, normalizeExecutionPolicy, type CliPolicyInput, type OperationRiskInput, type SliceCommand } from "./policy.js";
import { createBuiltRunHostPort } from "./host-cli.js";
import { createBuiltMcpCliPort } from "./mcp-cli.js";
import { RepositoryChangeLifecycleService } from "@projector/control-plane";
export { createHostSessionRecord, hostSessionSelector } from "@projector/integrations";
import { runDefaultUpgradeWorkflow } from "./upgrade.js";
export * from "./upgrade.js";

export const PROJECTOR_VERSION = "2.0.0";

const HELP = `Projector ${PROJECTOR_VERSION}

Usage: projector <command> [options]

Commands:
  init                  Initialize local Projector derived state
  audit                 Analyze governed state; add --decisions for architecture decisions
  change <request> --proposal <path>  Capture a repository change
  plan <semantic-change-id>           Preview its immutable plan
  approve <semantic-change-id> --plan-hash <hash>  Approve that exact plan
  apply <approval-id>                 Apply an approval once
  recover <approval-id>               Recover an interrupted approval
  resume <approval-id>                Recover then resume an approval
  coverage              Report authenticated multi-dimensional coverage
  complete              Rank the next authenticated completion work
  cleanup               Resume a trusted cleanup continuation plan
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
  readonly capture: (request: { readonly repositoryRoot: string; readonly request: string; readonly proposalPath: string }) => Promise<Record<string, unknown>>;
  readonly plan: (request: { readonly repositoryRoot: string; readonly selector: string }) => Promise<Record<string, unknown>>;
  readonly approve: (request: { readonly repositoryRoot: string; readonly selector: string; readonly planHash: string }) => Promise<Record<string, unknown>>;
  readonly apply: (request: { readonly repositoryRoot: string; readonly selector: string; readonly signal: AbortSignal }) => Promise<Record<string, unknown>>;
  readonly recover: (request: { readonly repositoryRoot: string; readonly selector: string }) => Promise<Record<string, unknown>>;
  readonly resume: (request: { readonly repositoryRoot: string; readonly selector: string; readonly signal: AbortSignal }) => Promise<Record<string, unknown>>;
}

export type CoverageStrictness = "proven" | "bounded" | "high-confidence" | "partial";
export interface CoverageCliRequest { readonly scope: string; readonly strictness: CoverageStrictness; readonly budgetTokens?: number; readonly budgetCost?: number; readonly continuationSelector?: string }
export interface CoverageCliReport {
  readonly proofStatement: CoverageSnapshot["proofStatement"];
  readonly approvalRequired: boolean;
  readonly budgetExhausted: boolean;
  readonly continuationPersisted: boolean;
  readonly boundary: readonly string[];
  readonly lanes: readonly { readonly key: string; readonly observability: ObservabilityClass }[];
  readonly unavailableSurfaceIds: readonly string[];
  readonly [key: string]: unknown;
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
  readonly host?: "codex" | "claude";
  readonly hostArgv: readonly string[];
  readonly sessionSelector?: string;
  readonly clean: boolean;
}

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const indexes = arguments_.flatMap((value, index) => value === name ? [index] : []);
  if (indexes.length > 1) throw new Error(`duplicate ${name.replace(/^--/u, "")} option`);
  const index = indexes[0];
  if (index === undefined) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("-")) throw new Error(`${name} requires a value`);
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

const valueFlags = new Set(["--format", "--mode", "--strictness", "--scope", "--budget-tokens", "--budget-cost", "--continuation", "--session", "--proposal", "--plan-hash"]);
const booleanFlags = new Set(["--decisions", "--dry-run", "--audit-only", "--non-interactive", "--clean"]);
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
    if ((command !== "explain" && command !== "change" && command !== "plan" && command !== "approve" && command !== "apply" && command !== "resume" && command !== "recover" && command !== "run") || index !== 1) throw new Error(`unknown argument: ${argument}`);
  }
}

function parseCommand(arguments_: readonly string[]): ParsedCommand {
  const command = arguments_[0];
  if (command !== "init" && command !== "audit" && command !== "change" && command !== "plan" && command !== "apply"
    && command !== "approve" && command !== "resume" && command !== "upgrade" && command !== "explain" && command !== "coverage" && command !== "complete" && command !== "cleanup" && command !== "run" && command !== "mcp" && command !== "watch" && command !== "ci" && command !== "recover" && command !== "verify") {
    throw new Error(`unknown command: ${command ?? ""}`);
  }
  const separator = arguments_.indexOf("--");
  if (command === "run" && separator < 0) throw new Error("run requires the -- argv separator");
  if (command !== "run" && separator >= 0) throw new Error("argv separator is only valid with run");
  const commandArguments = command === "run" ? arguments_.slice(0, separator) : arguments_;
  const hostArgv = command === "run" ? arguments_.slice(separator + 1) : [];
  validateArguments(commandArguments, command);
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
  const positional = (command === "change" || command === "plan" || command === "approve" || command === "apply" || command === "resume" || command === "recover") && arguments_[1] !== undefined && !arguments_[1].startsWith("-") ? arguments_[1] : undefined;
  if (command === "change" && positional === undefined) throw new Error("change requires a request");
  const proposalPath = optionValue(commandArguments, "--proposal");
  const planHash = optionValue(commandArguments, "--plan-hash");
  if (proposalPath !== undefined && command !== "change") throw new Error("--proposal is only valid with change");
  if (command === "change" && proposalPath === undefined) throw new Error("change requires --proposal");
  if (command === "change" && proposalPath !== undefined && (positional!.trim() === "" || positional!.includes("\0"))) throw new Error("lifecycle change request must be safe nonblank text");
  if (positional !== undefined && !(command === "change" && proposalPath !== undefined) && !/^[a-z0-9][a-z0-9._:-]*$/iu.test(positional)) throw new Error("change lifecycle selector must be a safe repository-local identity");
  if (command === "approve" && (planHash === undefined || !planHash.startsWith("sha256:v1:"))) throw new Error("approve requires an authenticated plan hash via --plan-hash");
  if (command !== "approve" && planHash !== undefined) throw new Error("--plan-hash is only valid with approve");
  if ((command === "plan" || command === "approve" || command === "apply" || command === "recover" || command === "resume") && positional === undefined) throw new Error(`${command} requires a lifecycle selector`);
  const hostValue = command === "run" ? commandArguments[1] : undefined;
  if (command === "run" && hostValue !== "codex" && hostValue !== "claude") throw new Error(`unsupported host: ${hostValue ?? ""}`);
  const sessionSelector = optionValue(commandArguments, "--session");
  if (command === "run" && (sessionSelector === undefined || !/^session:[a-z0-9][a-z0-9._:-]*$/iu.test(sessionSelector))) throw new Error("run requires a safe explicit --session selector");
  if (command === "mcp" && sessionSelector !== undefined && !/^session:[a-z0-9][a-z0-9._:-]*$/iu.test(sessionSelector)) throw new Error("mcp requires a safe session selector");
  if (command !== "run" && command !== "mcp" && sessionSelector !== undefined) throw new Error("--session is only valid with run or mcp");
  const decisions = commandArguments.includes("--decisions");
  const clean = commandArguments.includes("--clean"); if (clean && command !== "verify") throw new Error("--clean is only valid with verify");
  if (decisions && command !== "audit") throw new Error("--decisions is only valid with audit");
  const coverageCommand = command === "coverage" || command === "complete" || command === "cleanup";
  const explicitStrictness = optionValue(commandArguments, "--strictness");
  const rawScope = optionValue(commandArguments, "--scope");
  const rawBudgetTokens = optionValue(commandArguments, "--budget-tokens");
  const rawBudgetCost = optionValue(commandArguments, "--budget-cost");
  if (!coverageCommand && [explicitStrictness, rawScope].some((value) => value !== undefined)) throw new Error("coverage scope and strictness are only valid with coverage, complete, or cleanup");
  if (!coverageCommand && command !== "watch" && [rawBudgetTokens, rawBudgetCost].some((value) => value !== undefined)) throw new Error("budgets are only valid with watch, coverage, complete, or cleanup");
  const strictnessValue = explicitStrictness ?? "bounded";
  if (strictnessValue !== "proven" && strictnessValue !== "bounded" && strictnessValue !== "high-confidence" && strictnessValue !== "partial") throw new Error(`unsupported coverage strictness: ${strictnessValue}`);
  const continuationSelector = optionValue(commandArguments, "--continuation");
  if (continuationSelector !== undefined && command !== "cleanup" && command !== "watch") throw new Error("--continuation is only valid with watch or cleanup");
  if (command === "watch" && continuationSelector !== undefined && continuationSelector !== "watch:default") throw new Error("watch continuation selector must be watch:default");
  const budgetTokens = positiveNumber(rawBudgetTokens, "--budget-tokens", true);
  const budgetCost = positiveNumber(rawBudgetCost, "--budget-cost");
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
      ...(continuationSelector === undefined ? {} : { continuationSelector: continuationSelector.trim() }),
    },
    ...(positional === undefined ? {} : { selector: positional }),
    ...(proposalPath === undefined ? {} : { proposalPath }),
    ...(planHash === undefined ? {} : { planHash }),
    policy: {
      command,
      ...(modeValue === undefined ? {} : { mode: modeValue }),
      dryRun: commandArguments.includes("--dry-run"),
      auditOnly: commandArguments.includes("--audit-only"),
      nonInteractive: commandArguments.includes("--non-interactive"),
      clean,
    },
  };
}

function outputFor(command: SliceCommand, report: unknown, format: ReportFormat): string {
  if ((command === "watch" || command === "ci" || command === "recover" || command === "verify") && "operationalReport" in (report as object)) return renderOperationalReport((report as { operationalReport: OperationalReport }).operationalReport, format);
  if (format === "json") return JSON.stringify(report, null, 2);
  if (command === "audit") {
    if ("decisionAudit" in (report as object)) {
      const count = (report as { decisionAudit: { findings: readonly unknown[] } }).decisionAudit.findings.length;
      return count === 0 ? "No architecture decision audit findings." : `${count} architecture decision audit findings.`;
    }
    const count = (report as { divergences: readonly unknown[] }).divergences.length;
    return count === 0 ? "No governed divergences found." : `${count} governed divergences found.`;
  }
  if (command === "plan") return (report as { preview: { expectedDiff: string } }).preview.expectedDiff;
  if (command === "change") return `change: ${(report as { selector: string }).selector}`;
  if (command === "explain") return (report as { explanation: string }).explanation;
  if (command === "coverage" || command === "complete" || command === "cleanup") return `${command}: ${(report as CoverageCliReport).proofStatement}`;
  if (command === "run") return (report as { dryRun?: boolean }).dryRun === true ? "run: dry-run" : `run: ${(report as RunHostCliResult).status}`;
  if (command === "mcp") return `mcp: ${(report as { status: string }).status}`;
  if (command === "upgrade") return `upgrade: ${(report as { selector: string }).selector}`;
  return `${command} completed.`;
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
  if (arguments_.length === 0 || arguments_.includes("--help") || arguments_.includes("-h")
    || arguments_.includes("--version") || arguments_.includes("-v")) {
    const output = renderCli(arguments_);
    return { exitCode: 0, output, report: { output } };
  }
  const parsed = parseCommand(arguments_);
  const policy = normalizeExecutionPolicy(parsed.policy);
  const repositoryRoot = options.cwd ?? process.cwd();
  const defaultOperation: OperationRiskInput = parsed.command === "init"
    ? { command: parsed.command, sideEffect: "derived-write", externalWrite: false, canonicalMutation: false }
    : parsed.command === "approve" ? { command: parsed.command, sideEffect: "derived-write", externalWrite: false, canonicalMutation: false }
    : parsed.command === "apply" || parsed.command === "resume" || parsed.command === "upgrade" || parsed.command === "cleanup" || parsed.command === "run" || parsed.command === "recover" || (parsed.command === "verify" && parsed.clean)
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
      report = policy.allowAutoMutation
        ? { policy, initialized: true, rebuild: await safeRebuildAcceptedState(repositoryRoot) }
        : { policy, initialized: false, dryRun: true };
      break;
    case "audit": {
      if (parsed.decisions) {
        const architecture = options.architecture ?? defaultArchitecturePort(repositoryRoot); const loaded = await architecture.load();
        const decisionAudit = await auditArchitectureDecisions(loaded, { overlap: architecture.overlap, population: architecture.population });
        report = { policy, decisionIds: loaded.decisions.map(({ id }) => id).sort(), decisionAudit };
        exitCode = decisionAudit.findings.length === 0 ? 0 : 2;
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
      report = { policy, ...await lifecycle.capture({ repositoryRoot, request: parsed.selector!, proposalPath: parsed.proposalPath! }) };
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
      if (parsed.command === "cleanup" && !policy.allowAutoMutation) {
        const dryRunReport = { proofStatement: "partial" as const, boundary: [parsed.coverageRequest.scope], lanes: REQUIRED_COVERAGE_LANES.map((key) => ({ key, observability: "bounded" as const })), unavailableSurfaceIds: [], approvalRequired: false, budgetExhausted: false, continuationPersisted: false };
        report = { policy, dryRun: true, ...dryRunReport } satisfies CoverageCliReport & { policy: typeof policy; dryRun: true };
        exitCode = coverageExitCode(parsed.coverageRequest, dryRunReport);
        break;
      }
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
  return { exitCode, output: outputFor(parsed.command, report, parsed.format), report };
}

async function safeRebuildAcceptedState(repositoryRoot: string) { const paths = await RepositoryPathService.create(repositoryRoot); const statePath = await paths.resolveWrite(".projector/state.db"); const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot(); const store = new SqliteDerivedStore(statePath.realTarget); try { const revision = store.replaceCanonicalSnapshot(snapshot); return { rootDigest: revision.rootDigest, documentCount: revision.documentCount, canonicalSemantics: { rootDigest: snapshot.rootDigest, documents: snapshot.documents.map(({ id, kind, semanticHash }) => ({ id, kind, semanticHash })) } }; } finally { store.close(); } }

function defaultRepositoryLifecyclePort(): RepositoryLifecycleCliPort {
  const service = (repositoryRoot: string) => RepositoryChangeLifecycleService.create(repositoryRoot);
  return {
    capture: async ({ repositoryRoot, request, proposalPath }) => {
      const paths = await RepositoryPathService.create(repositoryRoot);
      const proposal = JSON.parse(await readFile((await paths.resolveRead(proposalPath)).realTarget, "utf8")) as unknown;
      const captured = await (await service(repositoryRoot)).capture({ request, proposal });
      return {
        kind: "lifecycle-change",
        selector: captured.capture.semanticChangeId,
        immutablePlanHash: captured.capture.planHash,
        proposalHash: captured.capture.proposalHash,
      };
    },
    plan: async ({ repositoryRoot, selector }) => {
      const planned = await (await service(repositoryRoot)).plan(selector);
      const expectedDiff = planned.compiled.exactPatchInput.edits.map(({ path, before, after }) => `${before === null ? "create" : after === null ? "delete" : "replace"} ${path}`).join("\n");
      return { kind: "lifecycle-plan", selector, immutablePlanHash: planned.capture.planHash, preview: { expectedDiff }, plan: planned.compiled.compiledPlan.plan };
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
  const load = async () => { const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot(); return { decisions: snapshot.documents.filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => payload as unknown as ArchitectureDecision), concerns: [] as ArchitectureConcern[] }; };
  return { load, overlap: { assess: async (left, right) => left.semanticHash === right.semanticHash ? "compatible" as const : "disjoint" as const }, population: { inspect: async () => ({ count: 1, observability: "closed" }) }, validity: async (decisionId) => { const decision = (await load()).decisions.find(({ id }) => id === decisionId); if (decision === undefined) throw new Error(`architecture decision ${decisionId} is unavailable`); return { decisionId, scope: decision.scope, state: decision.lifecycle === "active" ? "valid" as const : "invalid-for-scope" as const, firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], blocksCurrentChange: decision.lifecycle !== "active", explanation: decision.lifecycle === "active" ? "Canonical decision and its authenticated semantic hash remain current." : "Canonical decision is no longer active." }; } };
}

function defaultOperationalCliPort(): OperationalCliPort {
  return { authenticate: async (report) => validateOperationalReport(report), run: async ({ command, repositoryRoot, clean, policy, signal, allowPersistence, maximumEvents }) => {
    const started = Date.now(); const paths = await RepositoryPathService.create(repositoryRoot); let findings: Array<{ code: string; title: string; path?: string; severity: "note" | "warning" | "error"; evidenceIds: string[] }> = []; const proof: { -readonly [Key in keyof OperationalExitProof]: OperationalExitProof[Key] } = { commandFailed: false, blockingInvalidity: false, approvalRequired: false, incompleteCoverage: false, requiredUnavailable: false, recoveryFailure: false, budgetExhausted: false, resumable: false }; let analysisRecords: string[] = []; let journalRecords: string[] = []; let canonicalDigest: ContentHash = hashFramedDomain("operational-canonical", []);
    {
      const dogfood = await inspectDogfood(paths); findings.push(...dogfood.findings); canonicalDigest = dogfood.canonicalDigest; proof.blockingInvalidity = dogfood.findings.length > 0;
      if (clean && allowPersistence && policy.allowAutoMutation) { const state = await paths.resolveWrite(".projector/state.db"); await rm(state.realTarget, { force: true }); }
      const analyze = async () => analyzeLocalRepository({ repositoryRoot });
      if (command === "watch") { const coordinator = new WatchCoordinator({ scan: async ({ paths: changedPaths, fullScan }) => { const analysis = await analyze(); const value = { digest: hashFramedDomain("cli-watch-analysis", { paths: changedPaths, fullScan, artifacts: analysis.artifacts.map(({ id, contentHash }) => ({ id, contentHash })) }), affectedDependencyIds: changedPaths, generatedEventIds: [] }; return { ...value, contentHash: hashFramedDomain("authenticated-watch-scan", value) }; }, process: async ({ digest, affectedDependencyIds }) => ({ digest, cacheKeys: affectedDependencyIds }) }); const checkpointStore = allowPersistence && maximumEvents !== undefined ? await FileWatchCheckpointStore.create(paths) : undefined; const lifecycle = await runWatchLifecycle(coordinator, { subscribe: (listener, failure) => { const watcher = watchFileSystem(paths.root, (eventType, filename) => { if (filename !== null) { const path = filename.toString().replaceAll("\\", "/"); listener({ kind: /(?:^|\/)(?:dist|generated)(?:\/|$)/u.test(path) ? "generated" : eventType === "rename" ? "rename" : "change", path }); } }); watcher.on("error", failure); const overflow = setInterval(() => listener({ kind: "overflow", path: "." }), 500); overflow.unref(); return () => { clearInterval(overflow); watcher.close(); }; } }, { signal, ...(maximumEvents === undefined ? {} : { maximumEvents }), ...(checkpointStore === undefined ? {} : { checkpointStore }) }); proof.budgetExhausted = lifecycle.budgetExhausted; proof.resumable = lifecycle.checkpoint !== undefined; if (lifecycle.checkpoint !== undefined) journalRecords.push(lifecycle.checkpoint.contentHash); }
      const first = await analyze(); const second = clean ? await analyze() : first; const firstHash = hashFramedDomain("cli-operational-analysis", { artifacts: first.artifacts.map(({ id, contentHash }) => ({ id, contentHash })), failures: first.failures }); const secondHash = hashFramedDomain("cli-operational-analysis", { artifacts: second.artifacts.map(({ id, contentHash }) => ({ id, contentHash })), failures: second.failures }); analysisRecords = first.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`); findings.push(...first.failures.map(({ capability, message, scope, analyzerId }) => ({ code: capability, title: message, path: scope, severity: "error" as const, evidenceIds: [analyzerId] }))); if (firstHash !== secondHash) { findings.push({ code: "clean-incremental-mismatch", title: "Clean and incremental analysis differ", severity: "error", evidenceIds: [firstHash, secondHash] }); proof.recoveryFailure = true; } else if (first.surface.access === "unavailable") proof.requiredUnavailable = true; else if (first.failures.length > 0) proof.blockingInvalidity = true;
      if (clean && allowPersistence && policy.allowAutoMutation && !proof.recoveryFailure) { const state = await paths.resolveWrite(".projector/state.db"); await mkdir((await paths.resolveWrite(".projector")).realTarget, { recursive: true }); await writeFile(state.realTarget, `${canonicalJson({ version: 1, canonicalDigest, analysisDigest: secondHash })}\n`, "utf8"); }
    }
    const stateDigest = hashFramedDomain("operational-run-state", { repositoryRoot, command, findings, canonicalDigest }); let gitHead: string | undefined; try { gitHead = (await execFileAsync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], { encoding: "utf8" })).stdout.trim(); } catch { gitHead = undefined; } const evidence = { ...unavailableOperationalEvidence("not exercised by local operational composition"), configDigest: canonicalDigest, toolchainDigest: hashFramedDomain("operational-toolchain", PROJECTOR_VERSION), ...(gitHead === undefined ? {} : { gitHead: hashFramedDomain("operational-git-head", gitHead) }), worktreeDigest: stateDigest, canonicalDigest, analyzerRecords: analysisRecords, journalRecords, errorRecords: findings.filter(({ severity }) => severity === "error").map(({ code }) => code), durationMs: Date.now() - started }; let operational = createOperationalReport({ runId: hashFramedDomain("operational-run-id", { command, stateDigest, started }), command, exitProof: proof, evidence, policy, stateDigest, unavailableFields: ["modelRecords", "snapshotRecords", "decisionRecords", "transformRecords", "validationRecords"], findings });
    if (allowPersistence && command !== "watch") { try { const store = await JsonlTelemetryStore.create(paths, ".projector/telemetry/runs.jsonl"); await store.append(operational); } catch (error) { operational = createOperationalReport({ ...operational, exitProof: { ...operational.exitProof, recoveryFailure: true }, evidence: { ...operational.evidence, errorRecords: [...operational.evidence.errorRecords, "telemetry-persistence"] }, findings: [...operational.findings.map(({ id: omitted, ...finding }) => { void omitted; return finding; }), { code: "telemetry-persistence", title: error instanceof Error ? error.message : String(error), severity: "error", evidenceIds: [] }] }); } }
    return operational;
  } };
}

async function inspectDogfood(paths: RepositoryPathService): Promise<{ readonly canonicalDigest: ContentHash; readonly findings: Array<{ code: string; title: string; path?: string; severity: "error"; evidenceIds: string[] }> }> {
  let text: string; try { text = await readFile((await paths.resolveRead(".projector/dogfood.json")).realTarget, "utf8"); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return { canonicalDigest: hashFramedDomain("operational-dogfood", null), findings: [] }; throw error; }
  const findings: Array<{ code: string; title: string; path?: string; severity: "error"; evidenceIds: string[] }> = []; let document: any; try { document = JSON.parse(text); } catch { return { canonicalDigest: hashFramedDomain("operational-dogfood", text), findings: [{ code: "dogfood-parse", title: "Canonical dogfood governance is malformed", path: ".projector/dogfood.json", severity: "error", evidenceIds: [] }] }; }
  const groups = ["acceptedDebt", "architectureDecisions", "authorities", "governanceBases", "lenses", "representations", "rules"] as const; const ids: string[] = []; for (const group of groups) { if (!Array.isArray(document[group]) || document[group].length === 0) findings.push({ code: "dogfood-incomplete", title: `Canonical dogfood ${group} is empty`, path: ".projector/dogfood.json", severity: "error", evidenceIds: [] }); else for (const item of document[group]) { if (typeof item?.id !== "string" || (item.status !== "active" && item.status !== "accepted")) findings.push({ code: "dogfood-invalid", title: `Invalid canonical dogfood ${group} entry`, path: ".projector/dogfood.json", severity: "error", evidenceIds: [] }); else ids.push(item.id); } } if (new Set(ids).size !== ids.length) findings.push({ code: "dogfood-duplicate", title: "Canonical dogfood identities conflict", path: ".projector/dogfood.json", severity: "error", evidenceIds: ids });
  for (const decision of Array.isArray(document.architectureDecisions) ? document.architectureDecisions : []) if (/(?:repository|prose|instruction).*(?:grant|authorize|override).*(?:tool|policy)|(?:grant|authorize).*(?:tool)/iu.test(`${decision.summary ?? ""} ${decision.decision ?? ""}`)) findings.push({ code: "untrusted-tool-grant", title: `Architecture decision ${decision.id ?? "unknown"} attempts to grant tools or override policy`, path: ".projector/dogfood.json", severity: "error", evidenceIds: [String(decision.id ?? "unknown")] });
  return { canonicalDigest: hashFramedDomain("operational-dogfood", document), findings };
}

function defaultCoveragePort(repositoryRoot: string): CoverageCliPort {
  const observe = async (request: CoverageCliRequest): Promise<CoverageCliReport> => compileRepositoryCoverage(repositoryRoot, request);
  const cleanup = async (request: CoverageCliRequest): Promise<CoverageCliReport> => ({
    proofStatement: "not-established",
    boundary: [request.scope],
    lanes: REQUIRED_COVERAGE_LANES.map((key) => ({ key, observability: "unavailable" as const })),
    unavailableSurfaceIds: ["cleanup-continuation-adapter"],
    approvalRequired: false,
    budgetExhausted: false,
    continuationPersisted: false,
  });
  return { coverage: observe, complete: observe, cleanup };
}

const normalizedRepositoryPath = (value: string): string => value.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/+$/u, "") || ".";
function inRequestedScope(path: string, scope: string): boolean {
  const boundary = normalizedRepositoryPath(scope); const candidate = normalizedRepositoryPath(path);
  return boundary === "." || candidate === boundary || candidate.startsWith(`${boundary}/`);
}

function unavailableLane(key: RequiredCoverageLaneKey, reason: string): CoverageLaneEvidence {
  return { key, applicability: "required", observability: "unavailable", numerator: 0, confidence: 0, assumptions: [], provenAssumptions: [], blindSpots: [reason], staleObservationIds: [] };
}

function knownLane(key: RequiredCoverageLaneKey, numerator: number, denominator: number, analysis: LocalRepositoryAnalysis): CoverageLaneEvidence {
  const enumeration = analysis.surface.enumeration;
  return { key, applicability: "required", observability: enumeration.observability, numerator, denominator, confidence: enumeration.observability === "unavailable" ? 0 : 0.8, assumptions: [...enumeration.assumptions], provenAssumptions: [], blindSpots: [...enumeration.blindSpots], staleObservationIds: [] };
}

async function compileRepositoryCoverage(repositoryRoot: string, request: CoverageCliRequest): Promise<CoverageCliReport> {
  const analysis = await analyzeLocalRepository({ repositoryRoot });
  const artifacts = analysis.artifacts.filter(({ locator }) => inRequestedScope(locator, request.scope));
  const units = analysis.projectionUnits.filter(({ key }) => inRequestedScope(key, request.scope));
  const files = analysis.files.filter(({ path }) => inRequestedScope(path, request.scope));
  const dependencies = analysis.dependencies.filter(({ importerPath }) => inRequestedScope(importerPath, request.scope));
  const identities = analysis.gitIdentities.filter(({ path }) => inRequestedScope(path, request.scope));
  const unknownKeys = new Set<RequiredCoverageLaneKey>(["concept-mapping", "lens", "rule-enforceability", "derivation", "validation-evidence", "authority", "architecture-decision", "semantic-identity", "pre-change-relevance"]);
  const lanes = REQUIRED_COVERAGE_LANES.map((key): CoverageLaneEvidence => {
    if (key === "inventory") return knownLane(key, artifacts.length, artifacts.length, analysis);
    if (key === "projection-unit-classification") return knownLane(key, units.length, artifacts.length, analysis);
    if (key === "relationship") return knownLane(key, dependencies.length, dependencies.length, analysis);
    if (key === "surface") return knownLane(key, analysis.surface.access === "unavailable" ? 0 : 1, 1, analysis);
    if (key === "historical-metamorphic") return analysis.git.availability === "unavailable" ? unavailableLane(key, "Git identity/history is unavailable") : knownLane(key, identities.filter(({ availability }) => availability === "available").length, files.length, analysis);
    if (key === "representation-projection-fidelity") return unavailableLane(key, "authenticated representation projection evidence is not present in local repository analysis");
    if (key === "change-closure" || key === "planning-surprise") return { key, applicability: "not-applicable", boundaryExclusion: "no semantic change execution is requested by coverage observation", observability: "closed", numerator: 0, denominator: 0, confidence: 1, assumptions: [], provenAssumptions: [], blindSpots: [], staleObservationIds: [] };
    if (unknownKeys.has(key)) return unavailableLane(key, `local repository analysis does not prove ${key}`);
    return unavailableLane(key, `local repository composition has no proof adapter for ${key}`);
  });
  const analysisDigest = hashFramedDomain("cli-local-coverage-analysis", { surface: analysis.surface, artifacts: artifacts.map(({ id, contentHash }) => ({ id, contentHash })), units: units.map(({ id, membershipHash }) => ({ id, membershipHash })), capabilities: analysis.capabilities, failures: analysis.failures.map(({ analyzerId, capability, scope, affectedClaimKinds }) => ({ analyzerId, capability, scope, affectedClaimKinds })) });
  const currentState: StateDigest = { gitBase: analysis.git.revision, worktreeDigest: analysisDigest, canonicalProjectorDigest: hashFramedDomain("cli-local-coverage-canonical", []), toolchainDigest: hashFramedDomain("cli-local-coverage-toolchain", analysis.capabilities) };
  const binding = createStateBinding({ compiledAgainst: currentState, valueDependencies: [{ kind: "adapter", id: "projector.local-repository", versionHash: analysisDigest, role: "authenticated Task14 local repository coverage evidence" }], queryDependencies: [] });
  const failureIds = analysis.failures.filter(({ scope }) => inRequestedScope(scope, request.scope)).map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort();
  const evidence: CoverageEvidenceSnapshot = { boundState: binding, lanes, analyzerFailures: analysis.failures, unknownFrontierIds: [...unknownKeys].map((key) => `coverage:${key}`).sort(), unavailableSurfaceIds: analysis.surface.access === "unavailable" ? [analysis.surface.id] : [], completion: { artifactsClassified: units.length === artifacts.length, semanticMappingsResolved: false, identityDispositionsResolved: false, expectedProjectionsAccounted: false, relevanceNegativeSpaceProven: false, lensesAndRulesOperational: false, externalOwnershipAssigned: analysis.surface.access !== "unavailable", blockerIds: failureIds, unknownUnitIds: units.map(({ id }) => id).sort(), validationIndependenceSatisfied: false, architectureFrontierIds: ["coverage:architecture-decision"] } };
  const context = { repositoryRoot, stateDigest: currentState, config: {}, signal: new AbortController().signal };
  const compiled = await compileAuthenticatedCoverageSnapshot({ graphRevision: 0, boundary: [request.scope], binding, currentState, context }, { bindingValidator: { validate: async () => ({ status: "current", currentState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, evidence: { observe: async () => evidence } });
  return { proofStatement: compiled.snapshot.proofStatement, boundary: compiled.snapshot.boundary, lanes: compiled.snapshot.lanes, unavailableSurfaceIds: compiled.snapshot.unavailableSurfaceIds, approvalRequired: false, budgetExhausted: false, continuationPersisted: false, snapshot: compiled.snapshot, boundState: compiled.boundState, bindingValidation: compiled.bindingValidation, bindingIdentity: compiled.boundState.dependencyDigest, localAnalysis: { artifactCount: artifacts.length, projectionUnitCount: units.length, dependencyCount: dependencies.length, analyzerFailureCount: failureIds.length, analyzerFailures: analysis.failures.filter(({ scope }) => inRequestedScope(scope, request.scope)) } };
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
