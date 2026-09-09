import { constants } from "node:fs";
import { link, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";

import { canonicalJson, hashFramedDomain } from "@projector/core";
import { RepositoryPathService } from "@projector/runtime";

import { KnowledgeContextResultSchema, type KnowledgeContextResult } from "./types.js";

const storeRoot = ".projector/runtime/knowledge/contexts";

type KnowledgeContextBasis = Omit<KnowledgeContextResult, "id" | "contentHash">;

export function finalizeKnowledgeContext(basis: KnowledgeContextBasis): KnowledgeContextResult {
  const contentHash = hashFramedDomain("knowledge-context-record", basis);
  return { ...basis, id: `knowledge_context_${contentHash.slice(-32)}`, contentHash };
}

function authenticate(value: KnowledgeContextResult): KnowledgeContextResult {
  const parsed = KnowledgeContextResultSchema.parse(value);
  const { id: _id, contentHash: _contentHash, ...basis } = parsed;
  const expected = finalizeKnowledgeContext(basis);
  if (parsed.id !== expected.id || parsed.contentHash !== expected.contentHash) {
    throw new Error(`knowledge context ${parsed.id} failed content authentication`);
  }
  return parsed;
}

function filename(contextId: string): string {
  if (!/^knowledge_context_[0-9a-f]{32}$/u.test(contextId)) throw new Error(`invalid knowledge context selector: ${contextId}`);
  return `${contextId.slice("knowledge_context_".length)}.json`;
}

export class KnowledgeContextStore {
  private constructor(private readonly paths: RepositoryPathService) {}

  static async create(repositoryRoot: string): Promise<KnowledgeContextStore> {
    return new KnowledgeContextStore(await RepositoryPathService.create(repositoryRoot));
  }

  async write(context: KnowledgeContextResult): Promise<KnowledgeContextResult> {
    const authenticated = authenticate(context);
    if (!authenticated.persisted) throw new Error("non-persisting knowledge context cannot be written to the derived cache");
    const relativePath = `${storeRoot}/${filename(authenticated.id)}`;
    const initial = await this.paths.resolveWrite(relativePath);
    await mkdir(dirname(initial.realTarget), { recursive: true });
    const destination = (await this.paths.resolveWrite(relativePath)).realTarget;
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try {
      await handle.writeFile(`${canonicalJson(authenticated)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await link(temporary, destination);
      if (process.platform !== "win32") {
        const directory = await open(dirname(destination), constants.O_RDONLY);
        try { await directory.sync(); } finally { await directory.close(); }
      }
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
      const existing = await this.read(authenticated.id);
      if (canonicalJson(existing) !== canonicalJson(authenticated)) throw new Error(`knowledge context collision for ${authenticated.id}`);
    } finally {
      await rm(temporary, { force: true });
    }
    return this.read(authenticated.id);
  }

  async read(contextId: string): Promise<KnowledgeContextResult> {
    const path = await this.paths.resolveRead(`${storeRoot}/${filename(contextId)}`);
    const parsed = JSON.parse(await readFile(path.realTarget, "utf8")) as unknown;
    const context = authenticate(KnowledgeContextResultSchema.parse(parsed));
    if (context.id !== contextId) throw new Error("knowledge context selector does not match authenticated identity");
    return context;
  }
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
