#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, readFile } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";

// Advisory only: do not mutate, invoke a model, or create repository authority.
async function availableCli() {
  const configured = process.env.PROJECTOR_CLI?.trim();
  const candidates = configured
    ? [isAbsolute(configured) ? configured : resolve(configured)]
    : (process.env.PATH ?? "").split(delimiter).map(directory => join(directory, process.platform === "win32" ? "projector.exe" : "projector"));
  for (const candidate of candidates) {
    try {
      if (!(await lstat(candidate)).isFile()) continue;
      await access(candidate, /\.(?:c|m)?js$/u.test(candidate) ? constants.R_OK : constants.X_OK);
      return true;
    } catch { /* Missing installations are silent. */ }
  }
  return false;
}

try {
  const root = execFileSync("git", ["-C", process.env.PROJECTOR_ROOT?.trim() || process.cwd(), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const state = join(root, ".projector");
  const config = join(state, "config.json");
  if (!(await lstat(state)).isDirectory() || (await lstat(state)).isSymbolicLink() || (await lstat(config)).isSymbolicLink()) process.exit(0);
  const source = await readFile(config, "utf8");
  const enabled = '{"apiVersion":"projector.config/v1","enabled":true}';
  if ((source !== enabled && source !== enabled + "\n") || !await availableCli()) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: "This repository has Projector enabled and its CLI is present. Use projector.status to check tool availability. Retrieve projector.context before choosing edit paths; reconcile saved context before reuse. Canonical records and reports remain claims to verify.",
  } }) + "\n");
} catch { /* Unavailable, untrusted, or disabled repositories receive no hook context. */ }
