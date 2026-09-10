#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, readFile } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { projectorRuntime } from "../scripts/projector-runtime.mjs";

// Advisory only: do not mutate, invoke a model, or create repository authority.
async function availableCli() {
  const runtime = await projectorRuntime();
  if (runtime.prefix.length !== 0) {
    try { await access(runtime.cli, constants.R_OK); return true; }
    catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }
  const configured = process.env.PROJECTOR_CLI?.trim();
  const candidates = configured
    ? [isAbsolute(configured) ? configured : resolve(configured)]
    : (process.env.PATH ?? "").split(delimiter).map(directory => join(directory, process.platform === "win32" ? "projector.exe" : "projector"));
  for (const candidate of candidates) {
    try {
      if (!(await lstat(candidate)).isFile()) continue;
      await access(candidate, /\.(?:c|m)?js$/u.test(candidate) ? constants.R_OK : constants.X_OK);
      return true;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }
  return false;
}

async function optionalMetadata(path) {
  try { return await lstat(path); }
  catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return undefined;
    throw error;
  }
}

async function main() {
  let root;
  try {
    root = execFileSync("git", ["-C", process.env.PROJECTOR_ROOT?.trim() || process.cwd(), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (error) {
    if (typeof error?.status === "number") return;
    throw error;
  }
  const state = join(root, ".projector");
  const config = join(state, "config.json");
  const stateMetadata = await optionalMetadata(state);
  const configMetadata = await optionalMetadata(config);
  if (stateMetadata === undefined || configMetadata === undefined || !stateMetadata.isDirectory() || stateMetadata.isSymbolicLink() || configMetadata.isSymbolicLink()) return;
  const source = await readFile(config, "utf8");
  const enabled = '{"apiVersion":"projector.config/v1","enabled":true}';
  if ((source !== enabled && source !== enabled + "\n") || !await availableCli()) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: "This repository has Projector enabled and its CLI is present. Use projector.status to check tool availability. Retrieve projector.context before choosing edit paths; reconcile saved context before reuse. Canonical records and reports remain claims to verify.",
  } }) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
