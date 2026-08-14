import { spawn } from "node:child_process";
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { canonicalJson, hashFramedDomain, type ExecutionCapsule, type ExecutionPlan, type RepresentationProjectionRef, type StateBinding, type StateDigest } from "@projector/core";
import { executionCapsuleHash, executionPlanHash, reconcileToFixedPoint, type ExecutionApproval } from "@projector/engine";
import { createClaudeHostAdapter, createCodexHostAdapter, type HostObservation } from "@projector/integrations";
import { analyzeLocalRepository } from "@projector/analyzers";

import type { RunHostCliPort } from "./cli.js";

const exec = promisify(execFile);
export interface StoredHostSession { readonly kind: "task17-host-session"; readonly host: "codex" | "claude"; readonly sessionId: string; readonly repositoryRootHash: string; readonly plan: ExecutionPlan; readonly capsule: ExecutionCapsule; readonly approval: ExecutionApproval; readonly instructions: { readonly text: string; readonly sourceHashes: readonly `sha256:v1:${string}`[]; readonly representation: RepresentationProjectionRef }; readonly contentHash: `sha256:v1:${string}` }
const sessionBody = (record: Omit<StoredHostSession, "contentHash">) => record;

export function createHostSessionRecord(input: Omit<StoredHostSession, "contentHash">): StoredHostSession {
  return { ...input, contentHash: hashFramedDomain("task17-host-session", sessionBody(input)) };
}
export function hostSessionSelector(record: StoredHostSession): string { return `session:${record.contentHash.slice("sha256:v1:".length)}`; }

export async function loadBuiltHostSession(request: { readonly host?: "codex" | "claude"; readonly sessionSelector: string; readonly repositoryRoot: string }): Promise<StoredHostSession> {
  const match = /^session:([a-f0-9]{64})$/u.exec(request.sessionSelector); if (match?.[1] === undefined) throw new Error("built host run requires an immutable session selector");
  const path = join(request.repositoryRoot, ".projector", "task17-sessions", `session-${match[1]}.json`);
  const stored = JSON.parse(await readFile(path, "utf8")) as StoredHostSession; const { contentHash, ...body } = stored;
  if (stored.kind !== "task17-host-session" || contentHash !== hashFramedDomain("task17-host-session", body) || contentHash.slice("sha256:v1:".length) !== match[1]) throw new Error("host session selector is unauthenticated");
  if ((request.host !== undefined && stored.host !== request.host) || stored.repositoryRootHash !== hashFramedDomain("task17-host-repository-root", await realpath(request.repositoryRoot))) throw new Error("host session route/root mismatch");
  if (stored.approval.planHash !== executionPlanHash(stored.plan) || stored.approval.capsuleHash !== executionCapsuleHash(stored.capsule) || stored.approval.planId !== stored.plan.id || stored.approval.capsuleId !== stored.capsule.id || stored.plan.boundState.dependencyDigest !== stored.capsule.boundState.dependencyDigest) throw new Error("host session approval is unauthenticated");
  return stored;
}

async function git(root: string, args: readonly string[]): Promise<string> { return (await exec("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })).stdout.trim(); }
async function observation(root: string, phase: "before" | "after"): Promise<HostObservation & { readonly head: string }> {
  const [head, status] = await Promise.all([git(root, ["rev-parse", "HEAD"]), git(root, ["status", "--porcelain=v1"])]);
  const paths = status.split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3)).filter((path) => !path.startsWith(".projector/task17-host-journals/")).sort();
  const contentHash = hashFramedDomain("task17-host-observation", { phase, head, status });
  const state: StateDigest = { gitBase: head, worktreeDigest: hashFramedDomain("task17-host-worktree", status), canonicalProjectorDigest: hashFramedDomain("task17-host-canonical", []), toolchainDigest: hashFramedDomain("task17-host-toolchain", "v1") };
  return { state, paths, contentHash, head };
}
function pathAllowed(capsule: ExecutionCapsule, path: string): boolean {
  return capsule.allowedWrites.some(({ selector }) => selector.op === "atom" && selector.field === "path" && typeof selector.value === "string" && (selector.value === "**" || selector.value === path || (selector.value.endsWith("/**") && path.startsWith(selector.value.slice(0, -2)))));
}

export function createBuiltRunHostPort(): RunHostCliPort {
  return { async resolve(request) { const stored = await loadBuiltHostSession(request); return { authenticated: true, host: stored.host }; }, async run(request) {
    const stored = await loadBuiltHostSession(request);
    const currentHead = await git(request.repositoryRoot, ["rev-parse", "HEAD"]);
    const currentState: StateDigest = { ...stored.plan.boundState.compiledAgainst, gitBase: currentHead };
    const executable = async () => { for (const root of (request.environment.PATH ?? "").split(delimiter).filter(Boolean)) { try { await access(join(root, request.host), constants.X_OK); return true; } catch { /* continue */ } } return false; };
    const adapter = request.host === "codex" ? createCodexHostAdapter({ probe: { executable, feature: async () => true } }) : createClaudeHostAdapter({ probe: { executable, feature: async () => true } });
    const journalRoot = join(request.repositoryRoot, ".projector", "task17-host-journals"); let beforeWithHead: Awaited<ReturnType<typeof observation>> | undefined; let afterWithHead: Awaited<ReturnType<typeof observation>> | undefined;
    const result = await adapter.run({ sessionId: stored.sessionId, repositoryRoot: request.repositoryRoot, argv: request.argv, environment: request.environment, allowedEnvironmentKeys: Object.keys(request.environment), capsule: stored.capsule, binding: stored.plan.boundState, currentState, instructions: stored.instructions, signal: request.signal }, {
      bindingValidator: { validate: async (binding: StateBinding, observedState: StateDigest) => {
        if (binding.dependencyDigest !== stored.plan.boundState.dependencyDigest) return { status: "stale", currentState: observedState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: ["binding identity mismatch"] };
        if (binding.compiledAgainst.gitBase === observedState.gitBase) return { status: "current", currentState: observedState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] };
        if (binding.valueDependencies.length === 0 && binding.queryDependencies.length === 0) return { status: "rebound", currentState: observedState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: ["unrelated root revision with empty dependency closure"], rebound: { ...binding, compiledAgainst: observedState } };
        return { status: "stale", currentState: observedState, changedValueDependencyIds: binding.valueDependencies.map(({ id }) => id), changedQueryDependencyIds: binding.queryDependencies.map(({ query }) => query.id), reasons: ["dependency-local currentness cannot be proven after revision change"] };
      } },
      authority: { verify: async ({ capsule, binding }) => executionCapsuleHash(capsule) === stored.approval.capsuleHash && binding.dependencyDigest === stored.approval.dependencyDigest },
      journal: { prepare: async (entry) => { await mkdir(journalRoot, { recursive: true }); const id = hashFramedDomain("task17-host-journal", entry).slice("sha256:v1:".length); const bytes = `${canonicalJson({ status: "prepared", ...entry })}\n`; await writeFile(join(journalRoot, `${id}.json`), bytes, { flag: "wx" }); return { id, contentHash: hashFramedDomain("task17-host-journal-bytes", bytes) }; }, finish: async (entry) => { const bytes = `${canonicalJson(entry)}\n`; await writeFile(join(journalRoot, `${entry.journalId}.final.json`), bytes, { flag: "wx" }); } },
      observe: { capture: async ({ phase }) => { const value = await observation(request.repositoryRoot, phase); if (phase === "before") beforeWithHead = value; else afterWithHead = value; return value; } },
      launcher: { launch: async ({ executable, args, cwd, env, signal }) => new Promise((resolve, reject) => { const child = spawn(executable, [...args], { cwd, env: { ...env }, shell: false, stdio: "ignore", signal }); child.once("error", reject); child.once("close", (exitCode, childSignal) => resolve({ exitCode: exitCode ?? 1, ...(childSignal === null ? {} : { signal: childSignal }) })); }) },
      reconcile: { run: async ({ launch }) => { if (beforeWithHead === undefined || afterWithHead === undefined) throw new Error("host observations are incomplete"); const committed = beforeWithHead.head === afterWithHead.head ? [] : (await git(request.repositoryRoot, ["diff", "--name-only", beforeWithHead.head, afterWithHead.head])).split(/\r?\n/u).filter(Boolean); const changedPaths = [...new Set([...committed, ...afterWithHead.paths])].sort(); const analysis = await analyzeLocalRepository({ repositoryRoot: request.repositoryRoot }); const blockingFailures = analysis.failures.filter(({ scope, capability }) => changedPaths.includes(scope) && (capability === "document-parse" || capability === "duplicate-key")); const validation = { changedPaths, blockingFailureIds: blockingFailures.map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort(), analysisVersion: analysis.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`).sort() }; const validationHash = hashFramedDomain("authenticated-host-task16-validation", validation); const reconciliation = await reconcileToFixedPoint({ iterate: async () => ({ governedStateDigest: hashFramedDomain("host-governed-state", { observation: afterWithHead!.contentHash, validationHash }), materialChanged: false, fixedPointTerminal: blockingFailures.length === 0, details: validation }) }, { maximumIterations: 2 }).catch(() => undefined); const allowed = changedPaths.every((changed) => pathAllowed(stored.capsule, changed)); return { status: launch?.exitCode === 0 && allowed && blockingFailures.length === 0 && reconciliation?.converged === true ? "completed" as const : "failed" as const, changedPaths }; } },
    });
    return { status: result.status === "manual" ? "unavailable" : result.status === "completed" ? "completed" : request.signal.aborted ? "cancelled" : "failed", exitCode: result.status === "completed" ? 0 : null, changedPaths: result.changedPaths, reconciled: result.status === "completed" || result.status === "recovered" };
  } };
}
