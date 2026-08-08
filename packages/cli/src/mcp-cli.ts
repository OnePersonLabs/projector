import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { analyzeLocalRepository } from "@projector/analyzers";
import { hashFramedDomain, type ContentHash } from "@projector/core";
import { createBuiltProjectorMcpServer, createMutationCapabilityService, createNodeCapabilitySecurityPorts, REQUIRED_PROJECTOR_CONTROLLED_TOOLS, type CapabilityRecord, type CapabilityStore, type JsonRpcRequest } from "@projector/integrations";
import { RepositoryPathService } from "@projector/runtime";

import { loadBuiltHostSession } from "./host-cli.js";

const exec = promisify(execFile);
class FileCapabilityStore implements CapabilityStore {
  constructor(private readonly root: string) {}
  private path(hash: ContentHash) { return join(this.root, `${hash.slice("sha256:v1:".length)}.json`); }
  async issue(record: CapabilityRecord) { await mkdir(this.root, { recursive: true }); try { await writeFile(this.path(record.tokenHash), JSON.stringify(record), { flag: "wx" }); return true; } catch (error) { if (error instanceof Error && "code" in error && error.code === "EEXIST") return false; throw error; } }
  async read(hash: ContentHash) { try { return JSON.parse(await readFile(this.path(hash), "utf8")) as CapabilityRecord; } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined; throw error; } }
  async compareAndSwap(hash: ContentHash, revision: number, next: CapabilityRecord) {
    const lock = `${this.path(hash)}.lock`; try { await mkdir(lock); } catch { return false; }
    try { const current = await this.read(hash); if (current?.revision !== revision) return false; const temporary = `${this.path(hash)}.${process.pid}.tmp`; await writeFile(temporary, JSON.stringify(next), { flag: "wx" }); await rename(temporary, this.path(hash)); return true; } finally { await rm(lock, { recursive: true, force: true }); }
  }
}

export interface BuiltMcpLifecycle { readonly status: "ready"; readonly tools: readonly string[]; readonly capabilityToken?: string; readonly transport: { handle(request: JsonRpcRequest): Promise<unknown> } }

export function createBuiltMcpCliPort() {
  return { async start(request: { readonly repositoryRoot: string; readonly signal: AbortSignal; readonly sessionSelector?: string }): Promise<BuiltMcpLifecycle> {
    const security = createNodeCapabilitySecurityPorts(); const session = request.sessionSelector === undefined ? undefined : await loadBuiltHostSession({ repositoryRoot: request.repositoryRoot, sessionSelector: request.sessionSelector });
    const store = new FileCapabilityStore(join(request.repositoryRoot, ".projector", "task17-capabilities"));
    const capability = createMutationCapabilityService({ ...security, store, authority: { verify: async (grant) => session !== undefined && grant.sessionId === session.sessionId && grant.planHash === session.approval.planHash && grant.capsuleHash === session.approval.capsuleHash && grant.approvalHash === hashFramedDomain("task17-mcp-approval", session.approval) }, currentness: { verify: async ({ record }) => { const head = (await exec("git", ["-C", request.repositoryRoot, "rev-parse", "HEAD"], { encoding: "utf8" })).stdout.trim(); return record.binding.compiledAgainst.gitBase === head || (record.binding.valueDependencies.length === 0 && record.binding.queryDependencies.length === 0); } } });
    let capabilityToken: string | undefined;
    if (session !== undefined) {
      const writeScopes = session.capsule.allowedWrites.flatMap(({ selector }) => selector.op === "atom" && selector.field === "path" && typeof selector.value === "string" ? [selector.value] : []);
      const issued = await capability.issue({ sessionId: session.sessionId, worktreeId: hashFramedDomain("task17-mcp-worktree", request.repositoryRoot), repositoryRoot: request.repositoryRoot, planHash: session.approval.planHash, packetId: session.capsule.taskId, capsuleHash: session.approval.capsuleHash, approvalHash: hashFramedDomain("task17-mcp-approval", session.approval), binding: session.plan.boundState, toolNames: REQUIRED_PROJECTOR_CONTROLLED_TOOLS, operations: REQUIRED_PROJECTOR_CONTROLLED_TOOLS, semanticScopes: session.capsule.unitIds.length === 0 ? ["*"] : session.capsule.unitIds, writeScopes, maximumRisk: session.capsule.risk.class, expiresAt: security.clock.now() + 5 * 60_000 }); capabilityToken = issued.token;
    }
    const read = async (input: Readonly<Record<string, unknown>>) => { const name = String(input.toolName); const analysis = await analyzeLocalRepository({ repositoryRoot: request.repositoryRoot }); if (name === "projector.status") return { status: "ok", artifactCount: analysis.artifacts.length, unitCount: analysis.projectionUnits.length, failureCount: analysis.failures.length }; if (name === "projector.audit" || name === "projector.list_divergences") return { status: "ok", failures: analysis.failures }; return { status: "unavailable", toolName: name, reason: "the built repository adapter has no authenticated proof for this query" }; };
    const server = createBuiltProjectorMcpServer({ capability, read, controlled: (name) => ({ operation: name, risk: "R1", targets: (input) => ({ semanticScopes: typeof input.semanticScope === "string" ? [input.semanticScope] : [], writePaths: typeof input.path === "string" ? [input.path] : [] }), run: async (input) => { if (name !== "projector.apply_transform") throw new Error(`${name} is unavailable in the built local adapter`); if (typeof input.path !== "string" || typeof input.content !== "string") throw new Error("apply_transform requires path and content"); const paths = await RepositoryPathService.create(request.repositoryRoot); const target = await paths.resolveWrite(input.path); await writeFile(target.realTarget, input.content); return { status: "applied", path: target.canonicalPath }; } }) });
    return { status: "ready", tools: server.registry.list().map(({ name }) => name), ...(capabilityToken === undefined ? {} : { capabilityToken }), transport: server.transport };
  } };
}
