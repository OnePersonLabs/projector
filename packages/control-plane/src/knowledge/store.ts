import { canonicalJson, hashFramedDomain } from "@projector/core";
import { RepositoryPathService, withDerivedCacheAdmission, touchDerivedCacheEntry, withObservationScope, type DerivedCacheSession, type DerivedCacheWrite } from "@projector/runtime";
import { runObservationTask } from "../observation/task-runner.js";
import { readDerivedObservationSource } from "../observation/read-derived.js";

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

export function authenticateKnowledgeContextSource(source: string): KnowledgeContextResult {
  return authenticate(KnowledgeContextResultSchema.parse(JSON.parse(source)));
}

function filename(contextId: string): string {
  if (!/^knowledge_context_[0-9a-f]{32}$/u.test(contextId)) throw new Error(`invalid knowledge context selector: ${contextId}`);
  return `${contextId.slice("knowledge_context_".length)}.json`;
}

export function knowledgeContextWrite(context: KnowledgeContextResult): DerivedCacheWrite {
  const authenticated = authenticate(context);
  if (!authenticated.persisted) throw new Error("non-persisting knowledge context cannot be written to the derived cache");
  return { relativePath: `${storeRoot}/${filename(authenticated.id)}`, content: `${canonicalJson(authenticated)}\n` };
}

export class KnowledgeContextStore {
  private constructor(private readonly paths: RepositoryPathService) {}

  static async create(repositoryRoot: string): Promise<KnowledgeContextStore> {
    return new KnowledgeContextStore(await RepositoryPathService.create(repositoryRoot));
  }

  async write(context: KnowledgeContextResult, session?: DerivedCacheSession): Promise<KnowledgeContextResult> {
    const write = knowledgeContextWrite(context);
    if (session === undefined) await withDerivedCacheAdmission(this.paths.root, (cache) => cache.publish(write.relativePath, write.content));
    else await session.publish(write.relativePath, write.content);
    return this.read(context.id);
  }

  async read(contextId: string, touch = true, authenticator?: (source: string) => KnowledgeContextResult | Promise<KnowledgeContextResult>): Promise<KnowledgeContextResult> {
    return withObservationScope({}, async (scope) => {
      const path = await this.paths.resolveRead(`${storeRoot}/${filename(contextId)}`);
      let source: string;
      try { source = await readDerivedObservationSource(path.realTarget, contextId, scope); }
      catch (error) {
        if (isCode(error, "ENOENT")) throw new Error(`Saved context ${contextId} is no longer in the disposable cache; request fresh persisted context and refresh or replan any dormant capture before approval`, { cause: error });
        throw error;
      }
      const context = authenticator === undefined
        ? await runObservationTask("authenticate-context", { source }, { ...scope, maxDerivedBytes: scope.limits.maxDerivedBytes, maxWorkerHeapMiB: scope.limits.maxWorkerHeapMiB })
        : await authenticator(source);
      scope.budget.check("context-authentication", contextId);
      scope.signal.throwIfAborted();
      if (context.id !== contextId) throw new Error("knowledge context selector does not match authenticated identity");
      if (touch) await touchDerivedCacheEntry(this.paths.root, `${storeRoot}/${filename(contextId)}`);
      return context;
    });
  }
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
