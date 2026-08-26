#!/usr/bin/env node
import { spawn } from "node:child_process";

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

async function runCli(command, args) {
  const configured = process.env.PROJECTOR_CLI?.trim();
  const executable = configured === undefined || configured === "" ? "projector" : configured;
  const nodeScript = /\.(?:c|m)?js$/u.test(executable);
  const child = spawn(nodeScript ? process.execPath : executable, [...(nodeScript ? [executable] : []), command, ...args, "--format", "json"], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const status = await new Promise((accept, reject) => { child.once("error", reject); child.once("exit", accept); });
  const exitCode = typeof status === "number" ? status : 1;
  let output;
  try { output = JSON.parse(stdout); }
  catch { throw new Error(`projector ${command} returned non-JSON output (${String(exitCode)}): ${stderr.trim() || stdout.trim() || "no diagnostic"}`); }
  return { exitCode, output, stdout };
}

async function main(args) {
  const command = args[0]; const parsed = options(args.slice(1));
  if (command === "start") {
    const changed = await runCli("change", [required(parsed, "--request"), "--proposal", required(parsed, "--proposal")]);
    if (changed.exitCode !== 0) return changed;
    const planned = await runCli("plan", [changed.output.selector]);
    if (planned.exitCode !== 0) return planned;
    return { exitCode: 3, output: { ...planned.output, outcome: "approval-required", changeSelector: changed.output.selector }, stdout: "" };
  }
  if (command === "approve") return runCli("approve", [required(parsed, "--change"), "--plan-hash", required(parsed, "--plan-hash")]);
  if (command === "apply" || command === "recover" || command === "resume") return runCli(command, [required(parsed, "--approval")]);
  throw new Error("usage: projector-change <start|approve|apply|recover|resume> [options]");
}

try {
  const completed = await main(process.argv.slice(2));
  process.stdout.write(completed.stdout === "" ? `${JSON.stringify(completed.output)}\n` : completed.stdout);
  process.exitCode = completed.exitCode;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
