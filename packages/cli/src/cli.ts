#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hashFramedDomain, type ArchitectureConcern, type ArchitectureDecision, type CoverageSnapshot, type DecisionValidityAssessment, type ObservabilityClass, type RiskClass, type StateDigest } from "@projector/core";
import { analyzeLocalRepository, type LocalRepositoryAnalysis } from "@projector/analyzers";
import { createStateBinding } from "@projector/engine";
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
import {
  analyzeMandatorySlice,
  applyMandatorySlice,
  canonicalSemantics,
  prepareMandatorySlice,
  rebuildAcceptedState,
  reconcileMandatorySlice,
} from "./vertical-slice.js";

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
  explain <target>      Explain findings for a path or finding identity

Options:
  -h, --help     Show this help text
  -v, --version  Show the Projector version
  --format       text or json
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
}

export interface ChangeCliRequest { readonly repositoryRoot: string; readonly selector: string }
export interface ChangeCliPort {
  readonly change: (request: { readonly repositoryRoot: string; readonly intent: string }) => Promise<Record<string, unknown>>;
  readonly plan: (request: ChangeCliRequest) => Promise<Record<string, unknown>>;
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
  readonly format: "text" | "json";
  readonly policy: CliPolicyInput;
  readonly decisions: boolean;
  readonly coverageRequest: CoverageCliRequest;
  readonly selector?: string;
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

const valueFlags = new Set(["--format", "--mode", "--strictness", "--scope", "--budget-tokens", "--budget-cost", "--continuation"]);
const booleanFlags = new Set(["--decisions", "--dry-run", "--audit-only", "--non-interactive"]);
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
    if ((command !== "explain" && command !== "change" && command !== "plan" && command !== "apply") || index !== 1) throw new Error(`unknown argument: ${argument}`);
  }
}

function parseCommand(arguments_: readonly string[]): ParsedCommand {
  const command = arguments_[0];
  if (command !== "init" && command !== "audit" && command !== "change" && command !== "plan" && command !== "apply"
    && command !== "reconcile" && command !== "explain" && command !== "coverage" && command !== "complete" && command !== "cleanup") {
    throw new Error(`unknown command: ${command ?? ""}`);
  }
  validateArguments(arguments_, command);
  const formatValue = optionValue(arguments_, "--format") ?? "text";
  if (formatValue !== "text" && formatValue !== "json") throw new Error(`unsupported format: ${formatValue}`);
  const modeValue = optionValue(arguments_, "--mode");
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
  const decisions = arguments_.includes("--decisions");
  if (decisions && command !== "audit") throw new Error("--decisions is only valid with audit");
  const coverageCommand = command === "coverage" || command === "complete" || command === "cleanup";
  const explicitStrictness = optionValue(arguments_, "--strictness");
  const rawScope = optionValue(arguments_, "--scope");
  const rawBudgetTokens = optionValue(arguments_, "--budget-tokens");
  const rawBudgetCost = optionValue(arguments_, "--budget-cost");
  if (!coverageCommand && [explicitStrictness, rawScope, rawBudgetTokens, rawBudgetCost].some((value) => value !== undefined)) throw new Error("coverage scope, strictness, and budgets are only valid with coverage, complete, or cleanup");
  const strictnessValue = explicitStrictness ?? "bounded";
  if (strictnessValue !== "proven" && strictnessValue !== "bounded" && strictnessValue !== "high-confidence" && strictnessValue !== "partial") throw new Error(`unsupported coverage strictness: ${strictnessValue}`);
  const continuationSelector = optionValue(arguments_, "--continuation");
  if (continuationSelector !== undefined && command !== "cleanup") throw new Error("--continuation is only valid with cleanup");
  const budgetTokens = positiveNumber(rawBudgetTokens, "--budget-tokens", true);
  const budgetCost = positiveNumber(rawBudgetCost, "--budget-cost");
  return {
    command,
    ...(target === undefined ? {} : { target }),
    format: formatValue,
    decisions,
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
      dryRun: arguments_.includes("--dry-run"),
      auditOnly: arguments_.includes("--audit-only"),
      nonInteractive: arguments_.includes("--non-interactive"),
    },
  };
}

function outputFor(command: SliceCommand, report: unknown, format: "text" | "json"): string {
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
    : parsed.command === "apply" || parsed.command === "reconcile" || parsed.command === "cleanup"
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
      report = { policy, ...await port.change({ repositoryRoot, intent: parsed.selector! }) };
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
        report = { policy, ...await port.plan({ repositoryRoot, selector: parsed.selector }) };
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
      if (parsed.selector !== undefined && !policy.allowAutoMutation) {
        report = { policy, dryRun: true, selector: parsed.selector };
        break;
      }
      if (!policy.allowAutoMutation || policy.maximumAutomaticRisk === "R0") {
        return { exitCode: 3, output: "R1 approval required.", report: { policy, approvalRequired: true } };
      }
      if (parsed.selector !== undefined) {
        const port = options.change ?? defaultChangePort(repositoryRoot);
        report = { policy, ...await port.apply({ repositoryRoot, selector: parsed.selector }) };
        exitCode = report.outcome === "success" ? 0 : report.outcome === "partial" ? 6 : 3;
        break;
      }
      const prepared = await prepareMandatorySlice(repositoryRoot);
      assertOperationRiskAuthorized(policy, prepared.risk.class);
      const result = await applyMandatorySlice(repositoryRoot, prepared);
      report = { policy, plan: prepared.plan, capsule: prepared.capsule, risk: prepared.risk, preview: prepared.preview, ...result };
      exitCode = result.outcome === "success" ? 0 : result.outcome === "partial" ? 6 : 3;
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

function defaultChangePort(repositoryRoot: string): ChangeCliPort {
  const requireChangeSelector = (selector: string): void => {
    if (selector !== "change:mandatory-slice") throw new Error(`unsupported or unauthenticated change selector: ${selector}`);
  };
  const requirePlanSelector = (selector: string): void => {
    if (selector !== "plan:mandatory-slice") throw new Error(`unsupported or unauthenticated plan selector: ${selector}`);
  };
  return {
    change: async ({ intent }) => {
      if (intent !== "repair-governed-state") throw new Error(`unsupported deterministic local change intent: ${intent}`);
      const analysis = await analyzeMandatorySlice(repositoryRoot);
      return { kind: "change", selector: "change:mandatory-slice", intent, deterministic: true, analysis, risk: "R1" };
    },
    plan: async ({ selector }) => {
      requireChangeSelector(selector);
      const prepared = await prepareMandatorySlice(repositoryRoot);
      return { kind: "plan", selector: "plan:mandatory-slice", changeSelector: selector, ...prepared };
    },
    apply: async ({ selector }) => {
      requirePlanSelector(selector);
      const prepared = await prepareMandatorySlice(repositoryRoot);
      const result = await applyMandatorySlice(repositoryRoot, prepared);
      return { kind: "apply", selector, risk: prepared.risk, plan: prepared.plan, capsule: prepared.capsule, preview: prepared.preview, ...result };
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
    const result = await executeProjector(arguments_);
    process.stdout.write(`${result.output}\n`);
    return result.exitCode;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
