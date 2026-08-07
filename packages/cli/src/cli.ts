#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { normalizeExecutionPolicy, type CliPolicyInput, type SliceCommand } from "./policy.js";
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
  audit                 Analyze the mandatory repository-script cluster
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
}

interface ParsedCommand {
  readonly command: SliceCommand;
  readonly target?: string;
  readonly format: "text" | "json";
  readonly policy: CliPolicyInput;
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
  return {
    command,
    ...(target === undefined ? {} : { target }),
    format: formatValue,
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
  let report: any;
  let exitCode = 0;
  switch (parsed.command) {
    case "init":
      report = policy.allowAutoMutation
        ? { policy, initialized: true, rebuild: await rebuildAcceptedState(repositoryRoot) }
        : { policy, initialized: false, dryRun: true };
      break;
    case "audit": {
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
      const result = await applyMandatorySlice(repositoryRoot, prepared);
      report = { policy, plan: prepared.plan, capsule: prepared.capsule, risk: prepared.risk, preview: prepared.preview, ...result };
      exitCode = result.outcome === "success" ? 0 : 2;
      break;
    }
    case "reconcile":
      report = { policy, ...await reconcileMandatorySlice(repositoryRoot, policy) };
      break;
    case "explain": {
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
