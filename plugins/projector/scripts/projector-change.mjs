#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFile, mkdir, open, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const repositoryRoot = process.cwd();
const lifecycleRoot = join(repositoryRoot, ".projector", "runtime", "change-lifecycles");
const tracePath = join(lifecycleRoot, "agent-trace.jsonl");

const canonical = (value) => JSON.stringify(sortValue(value));
const hash = (domain, value) => `sha256:v1:${createHash("sha256").update(`${domain}\0${canonical(value)}`, "utf8").digest("hex")}`;

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]));
  return value;
}

function options(args) {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]; const value = args[index + 1];
    if (key === undefined || !key.startsWith("--") || value === undefined || value.startsWith("--") || parsed.has(key)) throw new Error(`invalid or duplicate workflow option: ${key ?? ""}`);
    parsed.set(key, value);
  }
  return parsed;
}

function required(parsed, name) {
  const value = parsed.get(name);
  if (value === undefined || value.trim() === "" || value.includes("\0")) throw new Error(`${name} is required`);
  return value;
}

function safeRepositoryPath(value, name) {
  if (isAbsolute(value) || value.replaceAll("\\", "/").split("/").includes("..")) throw new Error(`${name} must remain inside the repository`);
  return value;
}

async function appendTrace(phase, command, args, exitCode, output, diagnostic) {
  await mkdir(lifecycleRoot, { recursive: true });
  let previousHash = null;
  try {
    const lines = (await readFile(tracePath, "utf8")).trim().split("\n").filter(Boolean);
    if (lines.length > 0) previousHash = JSON.parse(lines.at(-1)).entryHash;
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const body = {
    version: 1,
    phase,
    command,
    args,
    exitCode,
    invocationHash: hash("projector-agent-cli-invocation", { command, args }),
    outputHash: output === null ? null : hash("projector-agent-cli-output", { exitCode, output }),
    diagnosticHash: diagnostic === null ? null : hash("projector-agent-cli-diagnostic", diagnostic),
    previousHash,
    recordedAt: new Date().toISOString(),
  };
  const entry = { ...body, entryHash: hash("projector-agent-trace-entry", body) };
  await appendFile(tracePath, `${canonical(entry)}\n`, { encoding: "utf8", mode: 0o600 });
}

async function runCli(command, args) {
  await appendTrace("invoked", command, args, null, null, null);
  const configured = process.env.PROJECTOR_CLI?.trim();
  const executable = configured === undefined || configured === "" ? "projector" : configured;
  const nodeScript = /\.(?:c|m)?js$/u.test(executable);
  const child = spawn(nodeScript ? process.execPath : executable, [...(nodeScript ? [executable] : []), command, ...args, "--format", "json"], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = ""; let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  let childExitCode;
  try { childExitCode = await new Promise((accept, reject) => { child.once("error", reject); child.once("exit", accept); }); }
  catch (error) {
    await appendTrace("completed", command, args, 1, null, error instanceof Error ? error.message : String(error));
    throw error;
  }
  const exitCode = typeof childExitCode === "number" ? childExitCode : 1;
  let output;
  try { output = JSON.parse(stdout); }
  catch {
    const diagnostic = stderr.trim() || stdout.trim() || "no diagnostic";
    await appendTrace("completed", command, args, exitCode, null, diagnostic);
    throw new Error(`projector ${command} returned non-JSON output (${String(exitCode)}): ${diagnostic}`);
  }
  await appendTrace("completed", command, args, exitCode, output, stderr.trim());
  return { exitCode, output };
}

function requireSuccess(command, execution) {
  if (execution.exitCode !== 0) throw new Error(`projector ${command} failed (${String(execution.exitCode)}): ${canonical(execution.output)}`);
  return execution.output;
}

async function writeContinuation(change, plan, proposalPath) {
  const body = {
    version: 1,
    changeSelector: change.selector,
    planHash: plan.immutablePlanHash,
    proposalPath,
    proposalHash: change.proposalHash ?? null,
    createdAt: new Date().toISOString(),
  };
  const record = { ...body, contentHash: hash("projector-agent-approval-continuation", body) };
  const path = join(lifecycleRoot, "agent-continuations", `${record.contentHash.slice("sha256:v1:".length)}.json`);
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(`${canonical(record)}\n`, "utf8"); await handle.sync(); } finally { await handle.close(); }
  return relative(repositoryRoot, path).replaceAll("\\", "/");
}

async function readContinuation(path) {
  const relativePath = safeRepositoryPath(path, "--continuation");
  const absolute = resolve(repositoryRoot, relativePath);
  const allowed = resolve(lifecycleRoot, "agent-continuations");
  if (absolute !== allowed && !absolute.startsWith(`${allowed}/`)) throw new Error("--continuation is outside the authenticated lifecycle store");
  const record = JSON.parse(await readFile(absolute, "utf8"));
  const { contentHash, ...body } = record;
  if (contentHash !== hash("projector-agent-approval-continuation", body)) throw new Error("approval continuation content authentication failed");
  return record;
}

async function main(args) {
  const command = args[0]; const parsed = options(args.slice(1));
  if (command === "start") {
    const request = required(parsed, "--request");
    const proposal = safeRepositoryPath(required(parsed, "--proposal"), "--proposal");
    const change = requireSuccess("change", await runCli("change", [request, "--proposal", proposal]));
    const plan = requireSuccess("plan", await runCli("plan", [change.selector]));
    if (typeof change.selector !== "string" || typeof plan.immutablePlanHash !== "string" || plan.immutablePlanHash !== change.immutablePlanHash) throw new Error("change and plan do not share one authenticated immutable plan hash");
    const continuation = await writeContinuation(change, plan, proposal);
    return { exitCode: 0, output: { status: "approval-required", changeSelector: change.selector, planHash: plan.immutablePlanHash, continuation, preview: plan.preview } };
  }
  if (command === "approve") {
    const continuation = await readContinuation(required(parsed, "--continuation"));
    const planHash = required(parsed, "--plan-hash");
    if (planHash !== continuation.planHash) throw new Error("human approval must present the exact plan hash from the authenticated continuation");
    const approval = requireSuccess("approve", await runCli("approve", [continuation.changeSelector, "--plan-hash", planHash]));
    return { exitCode: 0, output: { status: "approved", approvalSelector: approval.selector, planHash: approval.immutablePlanHash } };
  }
  if (command === "apply" || command === "recover" || command === "resume") {
    const approval = required(parsed, "--approval");
    const execution = await runCli(command, [approval]);
    const result = execution.output;
    return { exitCode: execution.exitCode, output: { status: result.outcome ?? (command === "recover" ? "recovered" : "unknown"), approvalSelector: approval, projectorExitCode: execution.exitCode, ...result } };
  }
  throw new Error("usage: projector-change <start|approve|apply|recover|resume> [options]");
}

try {
  const completed = await main(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(completed.output)}\n`);
  process.exitCode = completed.exitCode;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
