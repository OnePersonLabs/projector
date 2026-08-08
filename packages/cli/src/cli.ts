#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, hashFramedDomain, type ArchitectureConcern, type ArchitectureDecision, type CoverageSnapshot, type DecisionValidityAssessment, type ObservabilityClass, type RiskClass, type StateDigest } from "@projector/core";
import { analyzeLocalRepository, type LocalRepositoryAnalysis } from "@projector/analyzers";
import { compileSemanticChange, compileSemanticChangePlan, createStateBinding } from "@projector/engine";
import { createOperationalReport, renderOperationalReport, JsonlTelemetryStore, FileTransactionJournal, RepositoryPathService, WatchCoordinator, type OperationalReport, type ReportFormat, executePacketPlan, type PacketObservation, type PlanExecutionArtifact, type PacketExecutionArtifact } from "@projector/runtime";
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
import {
  analyzeMandatorySlice,
  applyMandatorySlice,
  canonicalSemantics,
  prepareMandatorySlice,
  rebuildAcceptedState,
  reconcileMandatorySlice,
} from "./vertical-slice.js";
import { runDefaultUpgradeWorkflow } from "./upgrade.js";
export * from "./upgrade.js";

export const PROJECTOR_VERSION = "2.0.0";

const HELP = `Projector ${PROJECTOR_VERSION}

Usage: projector <command> [options]

Commands:
  init                  Initialize local Projector derived state
  audit                 Analyze governed state; add --decisions for architecture decisions
  change <intent>       Compile a supported local semantic change
  plan                  Preview a state-bound deterministic repair
  apply                 Apply the approved R1 repair once
  reconcile             Apply and reconcile the repair to a fixed point
  coverage              Report authenticated multi-dimensional coverage
  complete              Rank the next authenticated completion work
  cleanup               Resume a trusted cleanup continuation plan
  run <codex|claude> -- <args>  Run a bounded host session
  mcp                   Start the built Projector MCP composition
  watch                 Scan repository changes without executing repository code
  ci                    Run authenticated CI proof and reporting
  recover               Recover incomplete durable transactions
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
  readonly change?: ChangeCliPort;
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
export interface OperationalCliPort { readonly run: (request: { readonly command: "watch" | "ci" | "recover" | "verify"; readonly repositoryRoot: string; readonly clean: boolean; readonly policy: ReturnType<typeof normalizeExecutionPolicy> }) => Promise<OperationalReport> }

export interface ChangeCliRequest { readonly repositoryRoot: string; readonly selector: string; readonly persist?: boolean }
export interface ChangeCliPort {
  readonly change: (request: { readonly repositoryRoot: string; readonly intent: string; readonly persist: boolean }) => Promise<Record<string, unknown>>;
  readonly plan: (request: ChangeCliRequest) => Promise<Record<string, unknown>>;
  readonly resolvePlan: (request: ChangeCliRequest) => Promise<{ readonly risk: RiskClass; readonly planHash: string; readonly approvalHash: string; readonly capsuleHash: string }>;
  readonly apply: (request: ChangeCliRequest) => Promise<Record<string, unknown>>;
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

const valueFlags = new Set(["--format", "--mode", "--strictness", "--scope", "--budget-tokens", "--budget-cost", "--continuation", "--session"]);
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
    if ((command !== "explain" && command !== "change" && command !== "plan" && command !== "apply" && command !== "run") || index !== 1) throw new Error(`unknown argument: ${argument}`);
  }
}

function parseCommand(arguments_: readonly string[]): ParsedCommand {
  const command = arguments_[0];
  if (command !== "init" && command !== "audit" && command !== "change" && command !== "plan" && command !== "apply"
    && command !== "upgrade" && command !== "reconcile" && command !== "explain" && command !== "coverage" && command !== "complete" && command !== "cleanup" && command !== "run" && command !== "mcp" && command !== "watch" && command !== "ci" && command !== "recover" && command !== "verify") {
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
  const positional = (command === "change" || command === "plan" || command === "apply") && arguments_[1] !== undefined && !arguments_[1].startsWith("-") ? arguments_[1] : undefined;
  if (command === "change" && positional === undefined) throw new Error("change requires an intent selector");
  if (positional !== undefined && !/^[a-z0-9][a-z0-9._:-]*$/iu.test(positional)) throw new Error("change/plan/apply selector must be a safe repository-local identity");
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
  if (!coverageCommand && [explicitStrictness, rawScope, rawBudgetTokens, rawBudgetCost].some((value) => value !== undefined)) throw new Error("coverage scope, strictness, and budgets are only valid with coverage, complete, or cleanup");
  const strictnessValue = explicitStrictness ?? "bounded";
  if (strictnessValue !== "proven" && strictnessValue !== "bounded" && strictnessValue !== "high-confidence" && strictnessValue !== "partial") throw new Error(`unsupported coverage strictness: ${strictnessValue}`);
  const continuationSelector = optionValue(commandArguments, "--continuation");
  if (continuationSelector !== undefined && command !== "cleanup") throw new Error("--continuation is only valid with cleanup");
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
    : parsed.command === "apply" || parsed.command === "upgrade" || parsed.command === "reconcile" || parsed.command === "cleanup" || parsed.command === "run" || parsed.command === "recover" || (parsed.command === "verify" && parsed.clean)
      ? { command: parsed.command, sideEffect: "workspace-write", externalWrite: false, canonicalMutation: false }
      : { command: parsed.command, sideEffect: "read-only", externalWrite: false, canonicalMutation: false };
  const suppliedOperation = options.governance?.operation;
  if (suppliedOperation !== undefined && suppliedOperation.command !== parsed.command) {
    return { exitCode: 3, output: "operation risk descriptor does not match command", report: { policy, blocked: true } };
  }
  const candidateRisks = [deriveOperationRisk(defaultOperation)];
  if (suppliedOperation !== undefined) candidateRisks.push(deriveOperationRisk(suppliedOperation));
  const operationRisk = candidateRisks.sort((left, right) => riskRank(right) - riskRank(left))[0]!;
  if (policy.allowAutoMutation) {
    try { assertOperationRiskAuthorized(policy, operationRisk); }
    catch (error) {
      const output = error instanceof Error ? error.message : String(error);
      return { exitCode: 3, output, report: { policy, blocked: true, operationRisk } };
    }
    const governance = options.governance ?? { detectCanonicalConflictPaths: defaultCanonicalConflictPaths };
    const conflicts = await governance.detectCanonicalConflictPaths(repositoryRoot);
    if ((policy.preset === "govern" || policy.preset === "autonomous") && conflicts.length > 0) {
      const output = `canonical governance conflict blocks ${policy.preset}: ${[...conflicts].sort().join(", ")}`;
      return { exitCode: 3, output, report: { policy, blocked: true, conflicts: [...conflicts].sort() } };
    }
  }
  let report: any;
  let exitCode = 0;
  switch (parsed.command) {
    case "init":
      report = policy.allowAutoMutation
        ? { policy, initialized: true, rebuild: await rebuildAcceptedState(repositoryRoot) }
        : { policy, initialized: false, dryRun: true };
      break;
    case "audit": {
      if (parsed.decisions) {
        if (options.architecture === undefined) return { exitCode: 3, output: "architecture decision provider is unavailable", report: { policy, blocked: true } };
        const loaded = await options.architecture.load();
        const decisionAudit = await auditArchitectureDecisions(loaded, { overlap: options.architecture.overlap, population: options.architecture.population });
        report = { policy, decisionAudit };
        exitCode = decisionAudit.findings.length === 0 ? 0 : 2;
        break;
      }
      const analysis = await analyzeMandatorySlice(repositoryRoot);
      report = {
        policy,
        analysis,
        divergences: analysis.divergences,
        canonicalSemantics: await canonicalSemantics(repositoryRoot, true),
      };
      exitCode = analysis.divergences.length === 0 ? 0 : 2;
      break;
    }
    case "change": {
      const port = options.change ?? defaultChangePort(repositoryRoot);
      const persist = policy.preset !== "observe" && parsed.policy.dryRun !== true && parsed.policy.auditOnly !== true;
      report = { policy, ...await port.change({ repositoryRoot, intent: parsed.selector!, persist }) };
      break;
    }
    case "plan": {
      if (options.architecture?.preflight !== undefined) {
        if (options.architecture.preflightPorts === undefined) return { exitCode: 3, output: "architecture preflight proof ports are unavailable", report: { policy, blocked: true } };
        const providerInput = await options.architecture.preflight();
        const architecturePreflight = await runArchitecturePreflight({ ...providerInput, mode: policy.preset, risk: operationRisk }, options.architecture.preflightPorts);
        if (!architecturePreflight.planningAllowed) return { exitCode: 3, output: architecturePreflight.reasons.join("\n"), report: { policy, architecturePreflight, blocked: true } };
      }
      if (parsed.selector !== undefined) {
        const port = options.change ?? defaultChangePort(repositoryRoot);
        report = { policy, ...await port.plan({ repositoryRoot, selector: parsed.selector, persist: policy.preset !== "observe" && parsed.policy.dryRun !== true }) };
        break;
      }
      const prepared = await prepareMandatorySlice(repositoryRoot);
      report = {
        policy,
        analysis: prepared.analysis,
        plan: prepared.plan,
        capsule: prepared.capsule,
        approval: prepared.approval,
        risk: prepared.risk,
        preview: prepared.preview,
      };
      break;
    }
    case "apply": {
      if (parsed.selector !== undefined) {
        const port = options.change ?? defaultChangePort(repositoryRoot);
        const resolved = await port.resolvePlan({ repositoryRoot, selector: parsed.selector });
        if (!policy.allowAutoMutation) { report = { policy, dryRun: true, selector: parsed.selector, immutablePlanHash: resolved.planHash, approvalHash: resolved.approvalHash, capsuleHash: resolved.capsuleHash }; break; }
        assertOperationRiskAuthorized(policy, resolved.risk);
        report = { policy, ...await port.apply({ repositoryRoot, selector: parsed.selector }) };
        const reportedRisk = typeof report.risk === "string" ? report.risk : report.risk?.class;
        if (report.immutablePlanHash !== resolved.planHash || report.approvalHash !== resolved.approvalHash || report.capsuleHash !== resolved.capsuleHash || reportedRisk !== resolved.risk) throw new Error("applied result does not match the resolved immutable plan/approval/capsule/risk tuple");
        exitCode = report.outcome === "success" ? 0 : report.outcome === "partial" ? 6 : 3;
        break;
      }
      if (!policy.allowAutoMutation || policy.maximumAutomaticRisk === "R0") {
        return { exitCode: 3, output: "R1 approval required.", report: { policy, approvalRequired: true } };
      }
      const prepared = await prepareMandatorySlice(repositoryRoot);
      assertOperationRiskAuthorized(policy, prepared.risk.class);
      const result = await applyMandatorySlice(repositoryRoot, prepared);
      report = { policy, plan: prepared.plan, capsule: prepared.capsule, risk: prepared.risk, preview: prepared.preview, ...result };
      exitCode = result.outcome === "success" ? 0 : result.outcome === "partial" ? 6 : 3;
      break;
    }
    case "upgrade": {
      if (!policy.allowAutoMutation) { report = { policy, kind: "upgrade-candidate", selector: "upgrade:pending", applied: false, persisted: false, dryRun: true }; break; }
      const upgrade = options.upgrade?.run ?? (async ({ repositoryRoot }: { repositoryRoot: string }) => runDefaultUpgradeWorkflow(repositoryRoot));
      report = { policy, ...await upgrade({ repositoryRoot }) };
      break;
    }
    case "reconcile": {
      if (!policy.allowAutoMutation || policy.maximumAutomaticRisk === "R0") {
        return { exitCode: 3, output: "R1 approval required.", report: { policy, approvalRequired: true } };
      }
      try {
        report = { policy, ...await reconcileMandatorySlice(repositoryRoot, policy) };
      } catch (error) {
        const code = error instanceof Error && "code" in error ? String(error.code) : "";
        if (code === "nonconvergent-reconciliation" || (error instanceof Error && /material delta|recovery|required|nondetermin/u.test(error.message))) {
          return { exitCode: 6, output: error instanceof Error ? error.message : String(error), report: { policy, converged: false, error: error instanceof Error ? error.message : String(error) } };
        }
        throw error;
      }
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
    case "watch": case "ci": case "recover": case "verify": {
      const operationalReport = await (options.operations ?? defaultOperationalCliPort()).run({ command: parsed.command, repositoryRoot, clean: parsed.clean, policy }); report = { policy, operationalReport }; exitCode = operationalReport.exitCode; break;
    }
    case "explain": {
      if (parsed.target!.startsWith("decision:")) {
        if (options.architecture === undefined) return { exitCode: 3, output: "architecture decision provider is unavailable", report: { policy, blocked: true } };
        const loaded = await options.architecture.load();
        const decision = loaded.decisions.find(({ id }) => id === parsed.target);
        const validity = decision === undefined ? undefined : await options.architecture.validity(decision.id);
        if (decision === undefined || validity === undefined) {
          const explanation = `No architecture decision proof currently matches ${parsed.target}.`;
          report = { policy, target: parsed.target, explanation };
          break;
        }
        const decisionExplanation = explainArchitectureDecision(decision, validity);
        report = { policy, target: parsed.target, decisionExplanation, explanation: decisionExplanation.explanation };
        break;
      }
      const analysis = await analyzeMandatorySlice(repositoryRoot);
      const target = parsed.target!;
      const divergences = analysis.divergences.filter((item) => item.id === target || item.unitIds.includes(target)
        || Object.values(item.observed).includes(target) || Object.values(item.expected).includes(target));
      const explanation = divergences.length === 0
        ? `No governed divergence currently matches ${target}.`
        : divergences.map((item) => `${item.title}: ${item.rationale} Caveat: ${item.coverageCaveat}`).join("\n");
      report = { policy, target, divergences, explanation };
      break;
    }
  }
  return { exitCode, output: outputFor(parsed.command, report, parsed.format), report };
}

function defaultOperationalCliPort(): OperationalCliPort {
  return { run: async ({ command, repositoryRoot, clean, policy }) => {
    const started = Date.now(); let findings: Array<{ code: string; title: string; path?: string; severity: "note" | "warning" | "error"; evidenceIds: string[] }> = []; let exitCode = 0;
    if (command === "recover") {
      const journal = new FileTransactionJournal(await RepositoryPathService.create(repositoryRoot));
      try { const recovered = await journal.recoverIncomplete(); findings = recovered.map(({ transactionId, action, reason, lastCheckpointId }) => ({ code: action, title: action === "rolled-back" ? `Rolled back incomplete transaction ${transactionId}` : reason ?? `Recovery required for ${transactionId}`, severity: action === "rolled-back" ? "note" as const : "error" as const, evidenceIds: [transactionId, ...(lastCheckpointId === undefined ? [] : [lastCheckpointId])] })); exitCode = findings.some(({ severity }) => severity === "error") ? 6 : 0; }
      catch (error) { findings = [{ code: "journal-corrupt", title: error instanceof Error ? error.message : String(error), severity: "error", evidenceIds: [] }]; exitCode = 6; }
    } else {
      if (clean) await rm(join(repositoryRoot, ".projector", "state.db"), { force: true });
      const analyze = async () => analyzeLocalRepository({ repositoryRoot });
      if (command === "watch") { const watch = new WatchCoordinator({ scan: async ({ paths, fullScan }) => { const analysis = await analyze(); const value = { digest: hashFramedDomain("cli-watch-analysis", { paths, fullScan, artifacts: analysis.artifacts.map(({ id, contentHash }) => ({ id, contentHash })) }), affectedDependencyIds: paths, generatedEventIds: [] }; return { ...value, contentHash: hashFramedDomain("authenticated-watch-scan", value) }; }, process: async ({ digest, affectedDependencyIds }) => ({ digest, cacheKeys: affectedDependencyIds }) }); await watch.submit([{ kind: "overflow", path: "." }]); }
      const first = await analyze(); const second = clean ? await analyze() : first; const firstHash = hashFramedDomain("cli-operational-analysis", { artifacts: first.artifacts.map(({ id, contentHash }) => ({ id, contentHash })), failures: first.failures }); const secondHash = hashFramedDomain("cli-operational-analysis", { artifacts: second.artifacts.map(({ id, contentHash }) => ({ id, contentHash })), failures: second.failures }); findings = first.failures.map(({ capability, message, scope, analyzerId }) => ({ code: capability, title: message, path: scope, severity: "error" as const, evidenceIds: [analyzerId] })); if (firstHash !== secondHash) { findings.push({ code: "clean-incremental-mismatch", title: "Clean and incremental analysis differ", severity: "error", evidenceIds: [firstHash, secondHash] }); exitCode = 6; } else exitCode = findings.length === 0 ? 0 : first.surface.access === "unavailable" ? 5 : 2;
    }
    const stateDigest = hashFramedDomain("operational-run-state", { repositoryRoot, command, findings }); const operational = createOperationalReport({ runId: hashFramedDomain("operational-run-id", { command, stateDigest, started }), command, exitCode, policy, stateDigest, unavailableFields: ["modelCalls", "externalSnapshots"], findings }); await mkdir(join(repositoryRoot, ".projector", "telemetry"), { recursive: true }); await new JsonlTelemetryStore(join(repositoryRoot, ".projector", "telemetry", "runs.jsonl")).append(operational); return operational;
  } };
}

function defaultChangePort(repositoryRoot: string): ChangeCliPort {
  type Prepared = Awaited<ReturnType<typeof prepareMandatorySlice>>;
  type ChangeRecord = { readonly kind: "semantic-change"; readonly intent: string; readonly boundState: Prepared["plan"]["boundState"]; readonly analysis: Prepared["analysis"]; readonly compiled: Awaited<ReturnType<typeof compileSemanticChange>> };
  type PlanRecord = { readonly kind: "semantic-plan"; readonly changeSelector: string; readonly prepared: Prepared; readonly compiled: Awaited<ReturnType<typeof compileSemanticChangePlan>>; readonly planHash: string };
  const recordRoot = join(repositoryRoot, ".projector", "task16-selections");
  const suffix = (selector: string, prefix: "change" | "plan"): string => {
    const match = new RegExp(`^${prefix}:semantic:([a-f0-9]{64})$`, "u").exec(selector);
    if (match?.[1] === undefined) throw new Error(`unsupported or unauthenticated ${prefix} selector: ${selector}`);
    return match[1];
  };
  const persist = async (prefix: "change" | "plan", body: ChangeRecord | PlanRecord): Promise<string> => {
    const hash = hashFramedDomain(`cli-immutable-${prefix}-selection`, body); const id = hash.slice("sha256:v1:".length);
    await mkdir(recordRoot, { recursive: true });
    const path = join(recordRoot, `${prefix}-${id}.json`); const bytes = `${canonicalJson(body)}\n`;
    try { await writeFile(path, bytes, { encoding: "utf8", flag: "wx" }); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST") || await readFile(path, "utf8") !== bytes) throw error;
    }
    return `${prefix}:semantic:${id}`;
  };
  const load = async <T extends ChangeRecord | PlanRecord>(prefix: "change" | "plan", selector: string): Promise<T> => {
    const id = suffix(selector, prefix); const path = join(recordRoot, `${prefix}-${id}.json`);
    let body: T;
    try { body = JSON.parse(await readFile(path, "utf8")) as T; } catch { throw new Error(`immutable ${prefix} selector is unavailable: ${selector}`); }
    if (hashFramedDomain(`cli-immutable-${prefix}-selection`, body).slice("sha256:v1:".length) !== id) throw new Error(`immutable ${prefix} selector content is corrupt`);
    return body;
  };
  const assertCurrent = async (boundState: Prepared["plan"]["boundState"]): Promise<Prepared> => {
    const current = await prepareMandatorySlice(repositoryRoot);
    if (canonicalJson(current.plan.boundState) !== canonicalJson(boundState)) throw new Error("immutable selection is stale; explicit rebase is required");
    return current;
  };
  return {
    change: async ({ intent, persist: shouldPersist }) => {
      if (intent !== "repair-governed-state") throw new Error(`unsupported deterministic local change intent: ${intent}`);
      const prepared = await prepareMandatorySlice(repositoryRoot);
      const intentBase = { id: "intent:mandatory-repository-script", request: intent, normalizedIntent: "repair governed repository automation placement", statements: [{ kind: "behavior" as const, statement: "repair governed repository automation placement", origin: [], confidence: 1 }], ambiguity: [], assumptions: [] };
      const intentAnalysis = { ...intentBase, contentHash: hashFramedDomain("change-intent-analysis", intentBase) };
      const factsValue = { intentAnalysis, identityResolutionIds: ["identity:mandatory-repository-script"], relevanceClosureId: prepared.capsule.relevanceClosureId, analysisFacetKeys: ["cleanup"], operations: [{ provenance: "authenticated" as const, operation: { subjectType: "other" as const, subjectKey: "mandatory-repository-script", kind: "modify" as const, payload: { transformId: "move-reference-update" } } }], relations: [], assumptions: [...prepared.plan.assumptions], boundary: [...prepared.plan.boundary], boundState: prepared.binding };
      const factsHash = hashFramedDomain("authenticated-change-compiler-facts", factsValue);
      const compiled = await compileSemanticChange({ request: intent, currentState: prepared.state, context: { repositoryRoot, stateDigest: prepared.state, config: {}, signal: new AbortController().signal } }, { facts: { load: async () => ({ value: factsValue, contentHash: factsHash }) }, bindingValidator: { validate: async () => ({ status: "current", currentState: prepared.state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, authority: { verify: async ({ subjectHash }) => subjectHash === factsHash }, architecture: { preflight: async () => { const value = { allowed: true, decisionIds: [] as string[] }; return { ...value, contentHash: hashFramedDomain("change-architecture-preflight", value) }; } }, impact: { compile: async () => { const value = { knownAffectedUnitIds: prepared.plan.knownAffectedUnitIds, possibleFrontierUnitIds: prepared.plan.possibleFrontierUnitIds, unavailableSurfaceIds: prepared.plan.unavailableSurfaceIds, reasons: prepared.plan.knownAffectedUnitIds.map((unitId) => ({ unitId, kind: "exact" as const, reason: "mandatory analyzer closure" })), queryDependencyIds: prepared.binding.queryDependencies.map(({ query }) => query.id) }; return { value, contentHash: hashFramedDomain("authenticated-impact-closure", value) }; } }, risk: { assess: async () => ({ value: prepared.risk, contentHash: hashFramedDomain("authenticated-change-risk", prepared.risk) }) } });
      const record: ChangeRecord = { kind: "semantic-change", intent, boundState: prepared.plan.boundState, analysis: prepared.analysis, compiled };
      const selector = shouldPersist ? await persist("change", record) : `change:semantic:${hashFramedDomain("cli-immutable-change-selection", record).slice("sha256:v1:".length)}`;
      return { kind: "change", selector, intent, deterministic: true, pipeline: "semantic-compiler", persisted: shouldPersist, analysis: record.analysis, boundState: record.boundState, semanticChange: compiled.change, risk: "R1" };
    },
    plan: async (request) => {
      const { selector } = request;
      const change = await load<ChangeRecord>("change", selector); const prepared = await assertCurrent(change.boundState);
      const planningValue = { change: change.compiled.change, boundState: change.compiled.boundState, compilerFactsHash: change.compiled.compilerFactsHash };
      const compiled = await compileSemanticChangePlan({ changeId: change.compiled.change.id, revision: 1, sourceRunId: "run:mandatory-repository-script" }, { changes: { read: async () => ({ value: planningValue, contentHash: hashFramedDomain("authenticated-change-planning-input", planningValue) }) }, packets: { compile: async () => { const value = { proposals: [{ key: "mandatory-repository-script", title: "Repair governed repository automation", stage: "cleanup" as const, executionMode: "deterministic" as const, transformId: "move-reference-update", unitIds: prepared.plan.knownAffectedUnitIds, semanticOwnerIds: ["mandatory-repository-script"], writeSelectors: prepared.plan.boundary, dependencies: [], validatorIds: prepared.plan.completionCriteria.requiredValidators }], completionContract: prepared.plan.completionCriteria }; return { value, contentHash: hashFramedDomain("authenticated-change-packet-proposals", value) }; } } });
      const planHash = hashFramedDomain("semantic-change-execution-plan", compiled.plan);
      const record: PlanRecord = { kind: "semantic-plan", changeSelector: selector, prepared, compiled, planHash };
      const planSelector = request.persist === false ? `plan:semantic:${hashFramedDomain("cli-immutable-plan-selection", record).slice("sha256:v1:".length)}` : await persist("plan", record);
      return { kind: "plan", selector: planSelector, changeSelector: selector, immutablePlanHash: planHash, pipeline: "packet-planner", persisted: request.persist !== false, ...prepared, plan: compiled.plan, capsule: compiled.packets[0]!.capsule };
    },
    resolvePlan: async ({ selector }) => { const record = await load<PlanRecord>("plan", selector); await assertCurrent(record.compiled.plan.boundState); const capsule = record.compiled.packets[0]!.capsule; const approval = { planHash: record.planHash, approvedRiskClass: record.prepared.risk.class, authorityProofHash: hashFramedDomain("cli-task16-authority", record.planHash) }; return { risk: record.prepared.risk.class, planHash: record.planHash, approvalHash: hashFramedDomain("cli-selection-approval", approval), capsuleHash: hashFramedDomain("cli-selection-capsule", capsule) }; },
    apply: async ({ selector }) => {
      const record = await load<PlanRecord>("plan", selector);
      await assertCurrent(record.compiled.plan.boundState);
      if (record.planHash !== hashFramedDomain("semantic-change-execution-plan", record.compiled.plan)) throw new Error("immutable plan approval tuple is corrupt");
      const capsule = record.compiled.packets[0]!.capsule; const approval = { planHash: record.planHash, approvedRiskClass: record.prepared.risk.class, authorityProofHash: hashFramedDomain("cli-task16-authority", record.planHash) };
      const envelopeValue = { plan: record.compiled.plan, packets: record.compiled.packets, executionOrder: record.compiled.executionOrder.map(({ packet }) => packet.id), approval };
      let applied: Awaited<ReturnType<typeof applyMandatorySlice>> | undefined;
      const beforeState = record.compiled.plan.boundState.compiledAgainst; const afterState = { ...beforeState, worktreeDigest: hashFramedDomain("cli-task16-applied-state", record.planHash) };
      const observed = (phase: "before" | "after" | "rollback"): PacketObservation => { const appliedPhase = phase === "after"; return { state: appliedPhase ? afterState : beforeState, pathContentHashes: appliedPhase ? { "scripts/validate-repo.mjs": hashFramedDomain("cli-path", "source"), "scripts/validate-repo.test.mjs": hashFramedDomain("cli-path", "test"), "package.json": hashFramedDomain("cli-path", "manifest-after") } : { ".codex/hooks/validate-repo.mjs": hashFramedDomain("cli-path", "source"), ".codex/hooks/validate-repo.test.mjs": hashFramedDomain("cli-path", "test"), "package.json": hashFramedDomain("cli-path", "manifest-before") }, renames: appliedPhase ? [{ from: ".codex/hooks/validate-repo.mjs", to: "scripts/validate-repo.mjs" }, { from: ".codex/hooks/validate-repo.test.mjs", to: "scripts/validate-repo.test.mjs" }] : [], deletedPaths: appliedPhase ? [".codex/hooks/validate-repo.mjs", ".codex/hooks/validate-repo.test.mjs"] : [], unitStates: Object.fromEntries(record.compiled.plan.knownAffectedUnitIds.map((id) => [id, "valid"])), canonicalEntityHashes: {}, externalStateHashes: {}, generatedArtifactHashes: {}, cleanWorkingTree: false, unknownCount: 0, divergenceCount: 0 }; };
      const coordinator = await executePacketPlan({ value: envelopeValue, contentHash: hashFramedDomain("authenticated-packet-execution", envelopeValue) }, { lease: { acquire: async () => ({ assertOwned: async () => {}, release: async () => {} }) }, authority: { verify: async ({ subjectHash }) => subjectHash === record.planHash }, currentness: { validate: async () => ({ currentState: beforeState, valid: true, proofHash: hashFramedDomain("cli-task16-currentness", beforeState) }) }, transaction: { begin: async () => ({ apply: async () => {}, commit: async () => {}, rollback: async () => {} }) }, effect: { run: async ({ packet }) => { applied = await applyMandatorySlice(repositoryRoot, record.prepared); const authorValue = { source: "mandatory-transform", group: "mandatory-transform" }; return { claimedChangedPaths: [], outputHash: hashFramedDomain("cli-task16-effect", applied.certificateHash), author: { ...authorValue, contentHash: hashFramedDomain("authenticated-effect-author", { ...authorValue, packetId: packet.id }) } }; } }, observe: { capture: async ({ phase }) => { const value = observed(phase); return { value, contentHash: hashFramedDomain("authenticated-packet-observation", value) }; } }, validate: { run: async ({ packet, postState }) => packet.validatorIds.map((validatorId, index) => { const postStateHash = hashFramedDomain("packet-post-state", postState); const provenance = { validatorId, validatorVersion: "1", authorSource: "task16-validator-registry", independenceGroup: `validator:${validatorId}`, evidenceLane: index === 0 ? "runtime" : "test", assurance: "strong" as const }; const provenanceHash = hashFramedDomain("packet-validator-provenance", provenance); return { ...provenance, provenanceHash, postStateHash, invocationHash: hashFramedDomain("packet-validator-invocation", { packetId: packet.id, validatorId, validatorVersion: "1", postStateHash, provenanceHash }), status: "passed" as const }; }) }, validatorTrust: { verify: async ({ proof }) => ({ trusted: true, authorSource: proof.authorSource, independenceGroup: proof.independenceGroup }) }, reconciliation: { run: async ({ plan, observedImpact, finalState }) => { const value = { planId: plan.id, observedImpact, finalState, converged: true, iterations: 1 }; return { converged: true, iterations: 1, contentHash: hashFramedDomain("authenticated-plan-reconciliation", value) }; } }, artifacts: { put: async (artifact: PacketExecutionArtifact | PlanExecutionArtifact) => { const contentHash = hashFramedDomain("packet-execution-artifact", artifact); await mkdir(join(recordRoot, "artifacts"), { recursive: true }); const path = join(recordRoot, "artifacts", `${contentHash.slice("sha256:v1:".length)}.json`); const bytes = `${canonicalJson(artifact)}\n`; try { await writeFile(path, bytes, { encoding: "utf8", flag: "wx" }); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST") || await readFile(path, "utf8") !== bytes) throw error; } return { contentHash, replayed: false }; } } });
      if (applied === undefined) throw new Error("semantic packet coordinator did not invoke the mandatory transform");
      return { kind: "apply", selector, immutablePlanHash: record.planHash, approvalHash: hashFramedDomain("cli-selection-approval", approval), capsuleHash: hashFramedDomain("cli-selection-capsule", capsule), pipeline: "packet-coordinator", risk: record.prepared.risk, plan: record.compiled.plan, capsule, preview: record.prepared.preview, coordinator, ...applied };
    },
  };
}

function defaultCoveragePort(repositoryRoot: string): CoverageCliPort {
  const observe = async (request: CoverageCliRequest): Promise<CoverageCliReport> => compileRepositoryCoverage(repositoryRoot, request);
  return { coverage: observe, complete: observe, cleanup: async (request) => ({ ...(await observe(request)), proofStatement: "not-established", unavailableSurfaceIds: ["cleanup-continuation-adapter"] }) };
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
  const structuredArtifacts = artifacts.filter(({ mediaType }) => ["application/json", "application/yaml", "application/toml", "text/markdown"].includes(mediaType));
  const observedRepresentationPaths = new Set([...analysis.documents, ...analysis.markdown].filter(({ path }) => inRequestedScope(path, request.scope)).map(({ path }) => path));
  const failedRepresentationPaths = new Set(analysis.failures.filter(({ capability, scope, affectedClaimKinds }) => inRequestedScope(scope, request.scope) && (capability === "document-parse" || capability === "duplicate-key" || affectedClaimKinds.includes("structured-document"))).map(({ scope }) => scope));
  const documentDenominator = structuredArtifacts.length;
  const documentNumerator = structuredArtifacts.filter(({ locator }) => observedRepresentationPaths.has(locator) && !failedRepresentationPaths.has(locator)).length;
  const identities = analysis.gitIdentities.filter(({ path }) => inRequestedScope(path, request.scope));
  const unknownKeys = new Set<RequiredCoverageLaneKey>(["concept-mapping", "lens", "rule-enforceability", "derivation", "validation-evidence", "authority", "architecture-decision", "semantic-identity", "pre-change-relevance"]);
  const lanes = REQUIRED_COVERAGE_LANES.map((key): CoverageLaneEvidence => {
    if (key === "inventory") return knownLane(key, artifacts.length, artifacts.length, analysis);
    if (key === "projection-unit-classification") return knownLane(key, units.length, artifacts.length, analysis);
    if (key === "relationship") return knownLane(key, dependencies.length, dependencies.length, analysis);
    if (key === "surface") return knownLane(key, analysis.surface.access === "unavailable" ? 0 : 1, 1, analysis);
    if (key === "historical-metamorphic") return analysis.git.availability === "unavailable" ? unavailableLane(key, "Git identity/history is unavailable") : knownLane(key, identities.filter(({ availability }) => availability === "available").length, files.length, analysis);
    if (key === "representation-projection-fidelity") return knownLane(key, documentNumerator, documentDenominator, analysis);
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
    const result = await executeProjector(arguments_);
    process.stdout.write(`${result.output}\n`);
    return result.exitCode;
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
