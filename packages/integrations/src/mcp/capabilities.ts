import { hashFramedDomain, type ContentHash } from "@projector/core";

export type CapabilityRisk = "R0" | "R1" | "R2" | "R3" | "R4";
export interface CapabilityGrant {
  readonly sessionId: string; readonly worktreeId: string; readonly planHash: ContentHash; readonly packetId: string; readonly capsuleHash: ContentHash; readonly approvalHash: ContentHash; readonly bindingDigest: ContentHash;
  readonly operations: readonly string[]; readonly semanticScopes: readonly string[]; readonly writeScopes: readonly string[]; readonly maximumRisk: CapabilityRisk; readonly expiresAt: number;
}
export interface CapabilityRecord extends CapabilityGrant { readonly tokenHash: ContentHash; readonly grantHash: ContentHash; readonly issuedAt: number; readonly revision: number; readonly status: "active" | "revoked" | "consumed"; readonly changedAt: number }
export interface CapabilityStore { issue(record: CapabilityRecord): Promise<boolean>; read(tokenHash: ContentHash): Promise<CapabilityRecord | undefined>; compareAndSwap(tokenHash: ContentHash, expectedRevision: number, next: CapabilityRecord): Promise<boolean> }
export interface CapabilityUse { readonly token: string; readonly sessionId: string; readonly worktreeId: string; readonly planHash: ContentHash; readonly packetId: string; readonly capsuleHash: ContentHash; readonly approvalHash: ContentHash; readonly bindingDigest: ContentHash; readonly operation: string; readonly semanticScope: string; readonly writePath: string; readonly risk: CapabilityRisk; readonly now: number }
export interface CapabilityDependencies {
  readonly store: CapabilityStore;
  readonly entropy: () => string;
  readonly authority: { verify(grant: CapabilityGrant): Promise<boolean> };
  readonly currentness: { verify(input: { readonly record: CapabilityRecord; readonly use?: CapabilityUse; readonly now: number }): Promise<boolean> };
}
export interface MutationCapabilityService { issue(grant: CapabilityGrant, now: number): Promise<{ readonly token: string; readonly grantHash: ContentHash }>; revoke(token: string, now: number): Promise<void>; consume(use: CapabilityUse): Promise<CapabilityRecord> }

const risk = new Map<CapabilityRisk, number>([["R0", 0], ["R1", 1], ["R2", 2], ["R3", 3], ["R4", 4]]);
function matches(scope: string, value: string): boolean {
  if (scope === value || scope === "*") return true;
  if (scope.endsWith("/**")) return value === scope.slice(0, -3) || value.startsWith(scope.slice(0, -2));
  return false;
}
function tokenHash(token: string): ContentHash { return hashFramedDomain("mcp-mutation-capability-token", token); }

export function createMutationCapabilityService(dependencies: CapabilityDependencies): MutationCapabilityService {
  return {
    async issue(grant, now) {
      if (!Number.isSafeInteger(now) || grant.expiresAt <= now) throw new Error("capability expiry must be future and bounded");
      if (!await dependencies.authority.verify(grant)) throw new Error("capability authority is absent or stale");
      const normalized: CapabilityGrant = { ...grant, operations: [...new Set(grant.operations)].sort(), semanticScopes: [...new Set(grant.semanticScopes)].sort(), writeScopes: [...new Set(grant.writeScopes)].sort() };
      const grantHash = hashFramedDomain("mcp-mutation-capability-grant", normalized);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const token = dependencies.entropy(); if (token.length < 8) throw new Error("capability entropy is insufficient");
        const record: CapabilityRecord = { ...normalized, tokenHash: tokenHash(token), grantHash, issuedAt: now, revision: 1, status: "active", changedAt: now };
        if (await dependencies.store.issue(record)) return { token, grantHash };
      }
      throw new Error("capability issuance collision");
    },
    async revoke(token, now) {
      const key = tokenHash(token); const record = await dependencies.store.read(key);
      if (record === undefined) throw new Error("capability is unknown");
      if (record.status !== "active") throw new Error(`capability is ${record.status}`);
      if (!await dependencies.currentness.verify({ record, now })) throw new Error("capability revocation currentness failed");
      if (!await dependencies.store.compareAndSwap(key, record.revision, { ...record, status: "revoked", revision: record.revision + 1, changedAt: now })) throw new Error("capability revocation conflict");
    },
    async consume(use) {
      const key = tokenHash(use.token); const record = await dependencies.store.read(key);
      if (record === undefined) throw new Error("capability is unknown");
      if (record.status !== "active") throw new Error(`capability is ${record.status}`);
      if (use.now > record.expiresAt) throw new Error("capability is expired");
      if (record.sessionId !== use.sessionId) throw new Error("capability session mismatch");
      if (record.worktreeId !== use.worktreeId) throw new Error("capability worktree mismatch");
      if (record.planHash !== use.planHash || record.packetId !== use.packetId || record.capsuleHash !== use.capsuleHash || record.approvalHash !== use.approvalHash || record.bindingDigest !== use.bindingDigest) throw new Error("capability route identity mismatch");
      if (!record.operations.includes(use.operation)) throw new Error("capability operation is not granted");
      if (!record.semanticScopes.some((scope) => matches(scope, use.semanticScope))) throw new Error("capability semantic scope mismatch");
      if (!record.writeScopes.some((scope) => matches(scope, use.writePath))) throw new Error("capability write scope mismatch");
      if ((risk.get(use.risk) ?? Number.POSITIVE_INFINITY) > (risk.get(record.maximumRisk) ?? -1)) throw new Error("capability risk exceeded");
      if (!await dependencies.currentness.verify({ record, use, now: use.now })) throw new Error("capability currentness failed");
      const consumed = { ...record, status: "consumed" as const, revision: record.revision + 1, changedAt: use.now };
      if (!await dependencies.store.compareAndSwap(key, record.revision, consumed)) throw new Error("capability was concurrently consumed");
      return consumed;
    },
  };
}
