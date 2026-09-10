#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const maximumHookInputBytes = 64 * 1024;

async function readHookEvent() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > maximumHookInputBytes) throw new Error(`Projector hook input exceeds ${maximumHookInputBytes} bytes`);
    chunks.push(chunk);
  }
  if (length === 0) return { hook_event_name: "SessionStart" };
  const value = JSON.parse(Buffer.concat(chunks, length).toString("utf8"));
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Projector hook input must be a JSON object");
  if (value.hook_event_name !== "SessionStart" && value.hook_event_name !== "PreToolUse") throw new Error("Projector hook received an unsupported event");
  return value;
}

// Advisory only: do not mutate, invoke a model, or create repository authority.
async function loadRunner() {
  if (!/^24\./u.test(process.versions.node)) throw new Error(`Projector requires Node 24 on PATH; resolved ${process.version}.`);
  const packagedRoot = resolve(import.meta.dirname, "../runtime/projector");
  const modulePath = resolve(packagedRoot, "exports/operations.js");
  try {
    const { createBundledProjectorOperationRunner, createInstalledProjectorApplicationEvidenceHost } = await import(pathToFileURL(modulePath).href);
    if (typeof createBundledProjectorOperationRunner !== "function" || typeof createInstalledProjectorApplicationEvidenceHost !== "function") throw new Error("The installed Projector package does not export its operation runner and application evidence host");
    return createBundledProjectorOperationRunner({ packagedRoot, applicationEvidence: createInstalledProjectorApplicationEvidenceHost });
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND" && error?.url === pathToFileURL(modulePath).href) return undefined;
    throw error;
  }
}

async function main() {
  const event = await readHookEvent();
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
  const hookEventName = event.hook_event_name;
  if (result.readiness.status === "inactive") return;
  const readinessDetail = [...new Set([result.readiness.reason, result.readiness.recovery?.action, result.action?.reason]
    .filter((value) => typeof value === "string"))].join("; ").replace(/\s+/gu, " ").slice(0, 96);
  const additionalContext = result.readiness.status !== "ready"
    ? `Projector is ${result.readiness.status}${readinessDetail.length === 0 ? "." : `: ${readinessDetail}`}. Run status through scripts/projector-operation.mjs and follow its action. This advisory hook does not authorize the tool call.`
    : hookEventName === "PreToolUse"
      ? "Projector is ready. Before mutation, retrieve or reconcile context through scripts/projector-operation.mjs. This advisory hook does not authorize the tool call; the operation entry owns readiness and access."
      : "Projector is active and its bundled operation runner is present. Use scripts/projector-operation.mjs with versioned JSON requests. Run status, then context before edits; reconcile retained context before reuse. Results do not authorize mutation.";
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName,
    additionalContext,
  } }) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
