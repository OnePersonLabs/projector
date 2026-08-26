import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJson, hashFramedDomain, type ExecutionCapsule, type ExecutionPlan, type RepresentationProjectionRef } from "@projector/core";
import { createStateBinding, executionCapsuleHash, executionPlanHash, type ExecutionApproval } from "@projector/engine";

export interface StoredHostSession {
  readonly kind: "task17-host-session";
  readonly host: "codex" | "claude";
  readonly sessionId: string;
  readonly repositoryRootHash: string;
  readonly plan: ExecutionPlan;
  readonly capsule: ExecutionCapsule;
  readonly approval: ExecutionApproval;
  readonly instructions: { readonly text: string; readonly sourceHashes: readonly `sha256:v1:${string}`[]; readonly representation: RepresentationProjectionRef };
  readonly contentHash: `sha256:v1:${string}`;
}

export type SessionRepresentationAuthentication =
  | { readonly status: "valid"; readonly projection: RepresentationProjectionRef; readonly text: string }
  | { readonly status: "absent"; readonly reason: string }
  | { readonly status: "invalid"; readonly reason: string };

export interface AuthenticatedRepositorySession {
  readonly record: StoredHostSession;
  readonly representation: SessionRepresentationAuthentication;
}

const sessionBody = (record: Omit<StoredHostSession, "contentHash">) => record;

export function createHostSessionRecord(input: Omit<StoredHostSession, "contentHash">): StoredHostSession {
  return { ...input, contentHash: hashFramedDomain("task17-host-session", sessionBody(input)) };
}

export function hostSessionSelector(record: StoredHostSession): string {
  return `session:${record.contentHash.slice("sha256:v1:".length)}`;
}

export function authenticateRepresentationBinding(input: Pick<StoredHostSession, "capsule" | "instructions">): SessionRepresentationAuthentication {
  const projection = input.capsule.representation;
  if (projection === undefined) return { status: "absent", reason: "authenticated execution capsule omits its representation projection" };
  if (canonicalJson(input.instructions.representation) !== canonicalJson(projection)) return { status: "invalid", reason: "authenticated session representation projection does not match its capsule binding" };
  if (!input.instructions.sourceHashes.includes(input.capsule.normativeKernelHash)) return { status: "invalid", reason: "authenticated session instructions omit the normative kernel source" };
  if (hashFramedDomain("representation-artifact", input.instructions.text) !== projection.contentHash) return { status: "invalid", reason: "authenticated session representation artifact hash is invalid" };
  return { status: "valid", projection, text: input.instructions.text };
}

export async function loadAuthenticatedRepositorySession(request: { readonly host?: "codex" | "claude"; readonly sessionSelector: string; readonly repositoryRoot: string }): Promise<AuthenticatedRepositorySession> {
  const match = /^session:([a-f0-9]{64})$/u.exec(request.sessionSelector);
  if (match?.[1] === undefined) throw new Error("repository session requires an immutable session selector");
  const path = join(request.repositoryRoot, ".projector", "task17-sessions", `session-${match[1]}.json`);
  const stored = JSON.parse(await readFile(path, "utf8")) as StoredHostSession;
  const { contentHash, ...body } = stored;
  if (stored.kind !== "task17-host-session" || contentHash !== hashFramedDomain("task17-host-session", body) || contentHash.slice("sha256:v1:".length) !== match[1]) throw new Error("repository session selector is unauthenticated");
  if ((request.host !== undefined && stored.host !== request.host) || stored.repositoryRootHash !== hashFramedDomain("task17-host-repository-root", await realpath(request.repositoryRoot))) throw new Error("repository session route/root mismatch");
  const bindingAuthentic = canonicalJson(createStateBinding(stored.plan.boundState)) === canonicalJson(stored.plan.boundState);
  const approvalAuthentic = bindingAuthentic
    && stored.approval.planId === stored.plan.id
    && stored.approval.planRevision === stored.plan.revision
    && stored.approval.planHash === executionPlanHash(stored.plan)
    && stored.approval.dependencyDigest === stored.plan.boundState.dependencyDigest
    && stored.approval.capsuleId === stored.capsule.id
    && stored.approval.capsuleHash === executionCapsuleHash(stored.capsule)
    && canonicalJson(stored.plan.boundState) === canonicalJson(stored.capsule.boundState);
  if (!approvalAuthentic) throw new Error("repository session approval or state binding is unauthenticated");
  return { record: stored, representation: authenticateRepresentationBinding(stored) };
}
