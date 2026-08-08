import { hashFramedDomain, type ContentHash, type StateBinding } from "@projector/core";
import { randomBytes } from "node:crypto";
import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export type CapabilityRisk = "R0" | "R1" | "R2" | "R3" | "R4";
export interface CapabilityGrant {
  readonly sessionId: string; readonly worktreeId: string; readonly repositoryRoot: string; readonly planHash: ContentHash; readonly packetId: string; readonly capsuleHash: ContentHash; readonly approvalHash: ContentHash; readonly binding: StateBinding;
  readonly toolNames: readonly string[]; readonly operations: readonly string[]; readonly semanticScopes: readonly string[]; readonly writeScopes: readonly string[]; readonly maximumRisk: CapabilityRisk; readonly expiresAt: number;
}
export interface CapabilityRecord extends CapabilityGrant { readonly canonicalRoot: string; readonly tokenHash: ContentHash; readonly grantHash: ContentHash; readonly issuedAt: number; readonly revision: number; readonly status: "active" | "revoked" | "consumed"; readonly changedAt: number }
export interface CapabilityStore { issue(record: CapabilityRecord): Promise<boolean>; read(tokenHash: ContentHash): Promise<CapabilityRecord | undefined>; compareAndSwap(tokenHash: ContentHash, expectedRevision: number, next: CapabilityRecord): Promise<boolean> }
export interface CapabilityUse { readonly token: string; readonly toolName: string; readonly operation: string; readonly semanticScopes: readonly string[]; readonly writePaths: readonly string[]; readonly risk: CapabilityRisk }
export interface CapabilityDependencies {
  readonly store: CapabilityStore;
  readonly entropy: () => Uint8Array;
  readonly clock: { now(): number };
  readonly roots: { resolveRoot(root: string): Promise<string>; resolveTarget(canonicalRoot: string, path: string): Promise<string | undefined> };
  readonly authority: { verify(grant: CapabilityGrant): Promise<boolean> };
  readonly currentness: { verify(input: { readonly record: CapabilityRecord; readonly use?: Omit<CapabilityUse, "token">; readonly now: number }): Promise<boolean> };
}
export interface MutationCapabilityService { issue(grant: CapabilityGrant): Promise<{ readonly token: string; readonly grantHash: ContentHash }>; revoke(token: string): Promise<void>; consume(use: CapabilityUse): Promise<CapabilityRecord> }

export function createNodeCapabilitySecurityPorts() {
  return {
    entropy: () => new Uint8Array(randomBytes(32)),
    clock: { now: () => Date.now() },
    roots: {
      resolveRoot: async (root: string) => realpath(root),
      resolveTarget: async (canonicalRoot: string, path: string) => {
        if (isAbsolute(path) || path.replace(/\\/gu, "/").split("/").includes("..")) return undefined;
        const target = resolve(canonicalRoot, path); const rel = relative(canonicalRoot, target).replace(/\\/gu, "/");
        if (rel === "" || rel.startsWith("../") || isAbsolute(rel)) return undefined;
        try { const canonicalParent = await realpath(dirname(target)); if (canonicalParent !== canonicalRoot && !canonicalParent.startsWith(`${canonicalRoot}/`)) return undefined; } catch { return undefined; }
        return rel;
      },
    },
  };
}

const risk = new Map<CapabilityRisk, number>([["R0", 0], ["R1", 1], ["R2", 2], ["R3", 3], ["R4", 4]]);
function matches(scope: string, value: string): boolean { if (scope === value || scope === "*" || scope === "**") return true; return scope.endsWith("/**") && (value === scope.slice(0, -3) || value.startsWith(scope.slice(0, -2))); }
function tokenHash(token: string): ContentHash { return hashFramedDomain("mcp-mutation-capability-token", token); }
function tokenFrom(bytes: Uint8Array): string { return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(""); }
function bindingAuthentic(binding: StateBinding): boolean { return binding.dependencyDigest === hashFramedDomain("state-binding-dependencies", { valueDependencies: binding.valueDependencies, queryDependencies: binding.queryDependencies }); }
function now(dependencies: CapabilityDependencies): number { const value = dependencies.clock.now(); if (!Number.isSafeInteger(value) || value < 0) throw new Error("trusted capability clock is invalid"); return value; }

export function createMutationCapabilityService(dependencies: CapabilityDependencies): MutationCapabilityService {
  return {
    async issue(grant) {
      const issuedAt = now(dependencies);
      if (grant.expiresAt <= issuedAt || !bindingAuthentic(grant.binding)) throw new Error("capability expiry or StateBinding is invalid");
      const canonicalRoot = await dependencies.roots.resolveRoot(grant.repositoryRoot);
      if (!await dependencies.authority.verify(grant)) throw new Error("capability authority is absent or stale");
      const normalized: CapabilityGrant = { ...grant, repositoryRoot: canonicalRoot, toolNames: [...new Set(grant.toolNames)].sort(), operations: [...new Set(grant.operations)].sort(), semanticScopes: [...new Set(grant.semanticScopes)].sort(), writeScopes: [...new Set(grant.writeScopes)].sort() };
      const grantHash = hashFramedDomain("mcp-mutation-capability-grant", normalized);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const bytes = dependencies.entropy(); if (bytes.byteLength < 32) throw new Error("capability requires at least 256 bits of cryptographic entropy");
        const token = tokenFrom(bytes); const record: CapabilityRecord = { ...normalized, canonicalRoot, tokenHash: tokenHash(token), grantHash, issuedAt, revision: 1, status: "active", changedAt: issuedAt };
        if (await dependencies.store.issue(record)) return { token, grantHash };
      }
      throw new Error("capability issuance collision");
    },
    async revoke(token) {
      const changedAt = now(dependencies); const key = tokenHash(token); const record = await dependencies.store.read(key);
      if (record === undefined) throw new Error("capability is unknown"); if (record.status !== "active") throw new Error(`capability is ${record.status}`);
      if (!await dependencies.currentness.verify({ record, now: changedAt })) throw new Error("capability revocation currentness failed");
      if (!await dependencies.store.compareAndSwap(key, record.revision, { ...record, status: "revoked", revision: record.revision + 1, changedAt })) throw new Error("capability revocation conflict");
    },
    async consume(use) {
      const consumedAt = now(dependencies); const key = tokenHash(use.token); const record = await dependencies.store.read(key);
      if (record === undefined) throw new Error("capability is unknown"); if (record.status !== "active") throw new Error(`capability is ${record.status}`);
      if (consumedAt > record.expiresAt) throw new Error("capability is expired");
      if (!record.toolNames.includes(use.toolName)) throw new Error("capability registry tool mismatch");
      if (!record.operations.includes(use.operation)) throw new Error("capability operation is not granted");
      if ((risk.get(use.risk) ?? Number.POSITIVE_INFINITY) > (risk.get(record.maximumRisk) ?? -1)) throw new Error("capability risk exceeded");
      if (!use.semanticScopes.every((target) => record.semanticScopes.some((scope) => matches(scope, target)))) throw new Error("capability semantic scope mismatch");
      const resolved = await Promise.all(use.writePaths.map((path) => dependencies.roots.resolveTarget(record.canonicalRoot, path)));
      if (resolved.some((path) => path === undefined) || !resolved.every((path) => record.writeScopes.some((scope) => matches(scope, path!)))) throw new Error("capability target escapes its write scope");
      const trustedUse = { toolName: use.toolName, operation: use.operation, semanticScopes: [...use.semanticScopes], writePaths: resolved as string[], risk: use.risk };
      if (!await dependencies.currentness.verify({ record, use: trustedUse, now: consumedAt })) throw new Error("capability currentness failed");
      const consumed = { ...record, status: "consumed" as const, revision: record.revision + 1, changedAt: consumedAt };
      if (!await dependencies.store.compareAndSwap(key, record.revision, consumed)) throw new Error("capability was concurrently consumed");
      return consumed;
    },
  };
}
