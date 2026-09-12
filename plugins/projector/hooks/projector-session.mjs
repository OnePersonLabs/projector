#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const maximumHookInputBytes = 8 * 1024 * 1024;
const intentContext = "If the actual target uses Projector, use $projector before implementing new behavior or skills, including ideas or targets discovered later. Planning and speculation are not acceptance. Reuse existing authorization.";

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
  if (!["SessionStart", "UserPromptSubmit", "PreToolUse"].includes(value.hook_event_name)) throw new Error("Projector hook received an unsupported event");
  return value;
}

// Advisory only: repository.check owns a disposable observation cache, never design authority.
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
  const hookEventName = event.hook_event_name;
  const emit = (additionalContext) => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext } }) + "\n");
  let root;
  try {
    root = execFileSync("git", ["-C", process.env.PROJECTOR_ROOT?.trim() || event.cwd || process.cwd(), "rev-parse", "--show-toplevel"], { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (error) {
    if (typeof error?.status === "number") {
      if (hookEventName === "UserPromptSubmit") emit(intentContext);
      return;
    }
    throw error;
  }
  const runner = await loadRunner();
  if (runner === undefined) {
    if (hookEventName === "UserPromptSubmit") emit(intentContext);
    return;
  }
  const boundary = hookEventName !== "PreToolUse";
  const result = await runner.execute({
    apiVersion: "projector.operation/v1",
    operation: boundary ? "repository.check" : "status",
    repositoryRoot: root,
    input: boundary ? {
      mode: hookEventName === "SessionStart" ? "full" : "commit-only",
      ...(typeof event.session_id === "string" && event.session_id.length > 0 ? { sessionId: event.session_id } : {}),
    } : {},
  }, { signal: AbortSignal.timeout(8000) });
  if (result.readiness.status === "inactive") {
    if (hookEventName === "UserPromptSubmit") emit(intentContext);
    return;
  }
  const readinessDetail = [...new Set([result.readiness.reason, result.readiness.recovery?.action, result.action?.reason]
    .filter((value) => typeof value === "string"))].join("; ").replace(/\s+/gu, " ").slice(0, 96);
  let additionalContext = result.readiness.status !== "ready"
    ? `Projector is ${result.readiness.status}${readinessDetail.length === 0 ? "." : `: ${readinessDetail}`}. Run status through scripts/projector-operation.mjs and follow its action. This advisory hook does not authorize the tool call.`
    : hookEventName === "PreToolUse"
      ? "Use $projector before dependent edits when new intent or a target emerges mid-turn. Planning is not acceptance. Retrieve or reconcile context through scripts/projector-operation.mjs; the operation entry owns readiness and access."
      : intentContext;
  if (boundary && result.readiness.status === "ready") {
    if (result.status !== "succeeded") {
      additionalContext += " Repository check unavailable. Surface a new limitation once, preserve pending findings, and do not repeat an existing offer or start deeper investigation without acceptance.";
    } else if (result.output?.offer === true) {
      additionalContext += ` Repository check: ${result.output.status}. Offer $projector-reconcile and wait for acceptance; then delegate investigation, relay questions through root, and continue independent work. Read repository.check for details; observation is not design approval.`;
    } else if (result.output?.status === "incomplete") {
      additionalContext += " Repository check incomplete; previous findings remain pending. Surface a new limitation once, without repeating an existing offer or starting deeper investigation. Use $projector-reconcile when requested.";
    } else if (result.output?.status === "changed") {
      additionalContext += " The pending repository finding has new evidence. Relay repository.check details to its existing investigator if authorized and running; otherwise retain the pending finding without a duplicate offer.";
    }
  }
  emit(additionalContext);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
