import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { ContentHashSchema, type ContentHash } from "@projector/core";
import { z } from "zod";

import { capturePsychordWorktreeDigest, type PsychordCommandRunner } from "./psychord-agent-browser-host.js";
import type { PsychordApplicationObservationPlan } from "./psychord-contract.js";

const text = z.string().min(1).max(4_096);
const dependencyRole = z.enum(["source", "lockfile", "build-config", "controller", "helper", "fixture", "toolchain"]);
const observedFile = z.strictObject({
  role: text,
  locator: text,
  expectedHash: ContentHashSchema,
  observedHash: ContentHashSchema.optional(),
  status: z.enum(["current", "stale", "unavailable"]),
}).superRefine((value, context) => {
  const expected = value.observedHash === undefined ? "unavailable" : value.observedHash === value.expectedHash ? "current" : "stale";
  if (value.status !== expected) context.addIssue({ code: "custom", path: ["status"], message: "file status does not match its expected and observed hashes" });
});

const observedRepository = z.strictObject({
  expectedGitHead: z.string().regex(/^[a-f0-9]{40}$/u),
  observedGitHead: z.string().regex(/^[a-f0-9]{40}$/u).optional(),
  expectedWorktreeDigest: ContentHashSchema,
  observedWorktreeDigest: ContentHashSchema.optional(),
  status: z.enum(["current", "stale", "unavailable"]),
}).superRefine((value, context) => {
  const unavailable = value.observedGitHead === undefined || value.observedWorktreeDigest === undefined;
  const expected = unavailable ? "unavailable"
    : value.observedGitHead === value.expectedGitHead && value.observedWorktreeDigest === value.expectedWorktreeDigest ? "current" : "stale";
  if (value.status !== expected) context.addIssue({ code: "custom", path: ["status"], message: "repository status does not match its expected and observed Git/worktree values" });
});

export const PsychordEvidenceCurrentnessSchema = z.strictObject({
  status: z.enum(["current", "stale", "unknown"]),
  repository: observedRepository,
  dependencies: z.array(observedFile.safeExtend({ role: dependencyRole })).max(256),
  buildArtifacts: z.array(observedFile).max(256),
  reasons: z.array(text).max(512),
}).superRefine((value, context) => {
  const observations = [value.repository, ...value.dependencies, ...value.buildArtifacts];
  const hasUnavailable = observations.some(({ status }) => status === "unavailable");
  const hasStale = observations.some(({ status }) => status === "stale");
  const expected = hasUnavailable ? "unknown" : hasStale ? "stale" : "current";
  if (value.status !== expected) context.addIssue({ code: "custom", path: ["status"], message: "currentness status does not match its observations" });
  if (JSON.stringify(value.reasons) !== JSON.stringify(currentnessReasons(observations))) context.addIssue({ code: "custom", path: ["reasons"], message: "currentness reasons must exactly disclose noncurrent observations" });
});
export type PsychordEvidenceCurrentness = z.infer<typeof PsychordEvidenceCurrentnessSchema>;

export async function observePsychordEvidenceCurrentness(input: {
  readonly commands: PsychordCommandRunner;
  readonly plan: PsychordApplicationObservationPlan;
  readonly environment: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
}): Promise<PsychordEvidenceCurrentness> {
  const adapterInput = input.plan.adapter.input;
  const legacyPlan = { runId: input.plan.runId, scenario: input.plan.scenario, case: input.plan.case, ...adapterInput };
  const [gitHead, worktreeDigest, dependencies, buildArtifacts] = await Promise.all([
    observeGitHead(input.commands, adapterInput.repository.root, input.environment, adapterInput.limits, input.signal),
    capturePsychordWorktreeDigest(input.commands, legacyPlan, input.environment, input.signal).catch(() => {
      input.signal.throwIfAborted();
      return undefined;
    }),
    Promise.all(adapterInput.dependencies.map(async (dependency) => await observeFile(
      adapterInput.repository.root,
      dependency.role,
      dependency.locator,
      dependency.contentHash,
    ))),
    Promise.all(adapterInput.server.expectedBuildArtifacts.map(async (artifact) => await observeFile(
      adapterInput.repository.root,
      artifact.role,
      artifact.buildLocator,
      artifact.contentHash,
      false,
    ))),
  ]);
  input.signal.throwIfAborted();
  const repositoryStatus = gitHead === undefined || worktreeDigest === undefined
    ? "unavailable"
    : gitHead !== adapterInput.repository.gitHead || worktreeDigest !== adapterInput.repository.worktreeDigest ? "stale" : "current";
  const repository = {
    expectedGitHead: adapterInput.repository.gitHead,
    ...(gitHead === undefined ? {} : { observedGitHead: gitHead }),
    expectedWorktreeDigest: adapterInput.repository.worktreeDigest,
    ...(worktreeDigest === undefined ? {} : { observedWorktreeDigest: worktreeDigest }),
    status: repositoryStatus,
  } as const;
  const observations = [repository, ...dependencies, ...buildArtifacts];
  const status = observations.some(({ status: itemStatus }) => itemStatus === "unavailable")
    ? "unknown"
    : observations.some(({ status: itemStatus }) => itemStatus === "stale") ? "stale" : "current";
  const reasons = currentnessReasons(observations);
  return PsychordEvidenceCurrentnessSchema.parse({ status, repository, dependencies, buildArtifacts, reasons });
}

function currentnessReasons(observations: ReadonlyArray<{ readonly status: "current" | "stale" | "unavailable"; readonly role?: string; readonly locator?: string }>): string[] {
  return observations.flatMap((observation) => {
    if (observation.status === "current") return [];
    const detail = observation.locator !== undefined
      ? `${observation.status}: ${observation.role} ${observation.locator}`
      : `${observation.status}: repository Git/worktree binding`;
    return [detail.slice(0, 4_096)];
  });
}

async function observeGitHead(
  commands: PsychordCommandRunner,
  repositoryRoot: string,
  environment: Readonly<Record<string, string>>,
  limits: PsychordApplicationObservationPlan["adapter"]["input"]["limits"],
  signal: AbortSignal,
): Promise<string | undefined> {
  try {
    const result = await commands.run({ executable: "git", args: ["rev-parse", "HEAD"], cwd: repositoryRoot, env: environment, timeoutMs: limits.timeoutMs, maxOutputBytes: limits.maximumOutputBytes, signal });
    const head = result.stdout.trim();
    return result.exitCode === 0 && result.signal === null && /^[a-f0-9]{40}$/u.test(head) ? head : undefined;
  } catch {
    signal.throwIfAborted();
    return undefined;
  }
}

async function observeFile(root: string, role: string, locator: string, expectedHash: ContentHash, allowAbsolute = true) {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    if (!allowAbsolute && isAbsolute(locator)) throw new Error("build locator must be repository relative");
    const target = isAbsolute(locator) ? resolve(locator) : resolve(root, locator);
    const [containedRoot, beforePath, before] = await Promise.all([realpath(root), realpath(target), lstat(target, { bigint: true })]);
    if (before.isSymbolicLink() || !before.isFile()) throw new Error("not a regular file");
    if (!isAbsolute(locator)) assertContained(containedRoot, beforePath);
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(before, opened)) throw new Error("file identity changed before currentness read");
    const observedHash = sha256(await handle.readFile());
    const [afterPath, after] = await Promise.all([realpath(target), lstat(target, { bigint: true })]);
    if (!sameFile(opened, after) || afterPath !== beforePath) throw new Error("file identity changed during currentness read");
    if (!isAbsolute(locator)) assertContained(containedRoot, afterPath);
    return { role, locator, expectedHash, observedHash, status: observedHash === expectedHash ? "current" as const : "stale" as const };
  } catch { return { role, locator, expectedHash, status: "unavailable" as const }; }
  finally { await handle?.close(); }
}

function sameFile(left: { readonly dev: bigint; readonly ino: bigint }, right: { readonly dev: bigint; readonly ino: bigint }): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertContained(root: string, target: string): void {
  const fromRoot = relative(root, target);
  if (fromRoot === ".." || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(fromRoot)) {
    throw new Error("Psychord currentness dependency escapes its repository root");
  }
}

function sha256(bytes: Uint8Array): ContentHash {
  return `sha256:v1:${createHash("sha256").update(bytes).digest("hex")}`;
}
