#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ArchitectureConcern, ArchitectureDecision, DecisionValidityAssessment, RiskClass } from "@projector/core";
import {
  auditArchitectureDecisions,
  explainArchitectureDecision,
  runArchitecturePreflight,
  type ArchitecturePreflightInput,
  type ArchitecturePreflightPorts,
  type DecisionOverlapPort,
  type DecisionPopulationPort,
} from "@projector/engine/architecture";

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
  plan                  Preview a state-bound deterministic repair
  apply                 Apply the approved R1 repair once
  reconcile             Apply and reconcile the repair to a fixed point
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
}

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  if (index < 0) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("-")) throw new Error(`${name} requires a value`);
  return value;
}

function parseCommand(arguments_: readonly string[]): ParsedCommand {
  const command = arguments_[0];
  if (command !== "init" && command !== "audit" && command !== "plan" && command !== "apply"
    && command !== "reconcile" && command !== "explain") {
    throw new Error(`unknown command: ${command ?? ""}`);
  }
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
  const decisions = arguments_.includes("--decisions");
  if (decisions && command !== "audit") throw new Error("--decisions is only valid with audit");
  return {
    command,
    ...(target === undefined ? {} : { target }),
    format: formatValue,
    decisions,
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
  if (command === "explain") return (report as { explanation: string }).explanation;
  return `${command} completed.`;
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
    : parsed.command === "apply" || parsed.command === "reconcile"
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
    case "plan": {
      if (options.architecture?.preflight !== undefined) {
        if (options.architecture.preflightPorts === undefined) return { exitCode: 3, output: "architecture preflight proof ports are unavailable", report: { policy, blocked: true } };
        const providerInput = await options.architecture.preflight();
        const architecturePreflight = await runArchitecturePreflight({ ...providerInput, mode: policy.preset, risk: operationRisk }, options.architecture.preflightPorts);
        if (!architecturePreflight.planningAllowed) return { exitCode: 3, output: architecturePreflight.reasons.join("\n"), report: { policy, architecturePreflight, blocked: true } };
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
