#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Advisory only: do not mutate, invoke a model, or create repository authority.
async function loadRunner() {
  if (!/^24\./u.test(process.versions.node)) throw new Error(`Projector requires Node 24 on PATH; resolved ${process.version}.`);
  const packagedRoot = resolve(import.meta.dirname, "../runtime/projector");
  const modulePath = resolve(packagedRoot, "exports/operations.js");
  try {
    const { createBundledProjectorOperationRunner } = await import(pathToFileURL(modulePath).href);
    if (typeof createBundledProjectorOperationRunner !== "function") throw new Error("The installed Projector package does not export its operation runner");
    return createBundledProjectorOperationRunner({ packagedRoot });
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND" && error?.url === pathToFileURL(modulePath).href) return undefined;
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
  const runner = await loadRunner();
  if (runner === undefined) return;
  const result = await runner.execute({
    apiVersion: "projector.operation/v1",
    operation: "status",
    repositoryRoot: root,
    input: {},
  });
  if (result.readiness.status !== "ready") return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: "Projector is active and its bundled operation runner is present. Use scripts/projector-operation.mjs with versioned JSON requests. Run status, then context before edits; reconcile retained context before reuse. Results do not authorize mutation.",
  } }) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
