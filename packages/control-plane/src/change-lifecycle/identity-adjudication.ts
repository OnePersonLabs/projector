import { canonicalJson, type CanonicalDocumentEnvelope, type ChangeProposal } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";

import { RepositoryKnowledgeService } from "../knowledge/service.js";
import type { KnowledgeContextResult } from "../knowledge/types.js";
import type { PsychordApplicationEvidenceHost } from "../knowledge/application-evidence.js";
import type { CompiledRepositoryChange } from "./compiler.js";

const normalize = (value: string): string => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
const durableKinds = new Set(["concept", "requirement", "behavioral-scenario", "architecture-decision", "architecture-concern", "developer-preference", "projection-lens"]);
const coveredIds = (context: KnowledgeContextResult): Set<string> => new Set(context.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)
  .flatMap(({ closure }) => [...closure.entries.map(({ entityId }) => entityId), ...closure.boundState.valueDependencies.map(({ id }) => id)]));

/** Explicit existing proposal identities can supply a direct address; prose similarity cannot. */
function existingAddresses(proposal: ChangeProposal, documents: readonly CanonicalDocumentEnvelope[]): string[] {
  const selected = new Set<string>();
  for (const [kind, subjects] of [["requirement", proposal.requirements], ["behavioral-scenario", proposal.scenarios]] as const) {
    for (const subject of subjects) {
      for (const document of documents.filter((item) => item.kind === kind)) {
        const payload = document.payload;
        if (subject.revision?.id === document.id) { selected.add(document.id); continue; }
        const claims = new Set([subject.key, ...subject.aliases].map(normalize));
        const aliases = Array.isArray(payload.aliases) ? payload.aliases.filter((value): value is string => typeof value === "string") : [];
        const sameIdentity = [document.key, ...aliases].some((claim) => claims.has(normalize(claim)));
        // Equality here preserves an already accepted statement. Changed meaning must
        // use the existing explicit revision contract, never a lexical guess.
        const sameMeaning = payload.title === subject.title && ("statement" in subject
          ? payload.statement === subject.statement : canonicalJson(payload.steps) === canonicalJson(subject.steps));
        if (sameIdentity && sameMeaning) selected.add(document.id);
      }
    }
  }
  for (const mutation of proposal.canonicalMutations ?? []) {
    if (mutation.kind === "lineage") {
      for (const source of mutation.sources) if (documents.some(({ id }) => id === source.id)) selected.add(source.id);
      continue;
    }
    if (mutation.operation !== "revise" || typeof mutation.payload.id !== "string") continue;
    const before = documents.find(({ id }) => id === mutation.payload.id);
    if (before === undefined) continue;
    if (mutation.kind === "relation") {
      for (const id of [before.payload.fromId, before.payload.toId, mutation.payload.fromId, mutation.payload.toId]) {
        if (typeof id === "string" && documents.some((document) => document.id === id && durableKinds.has(document.kind))) selected.add(id);
      }
    } else if (mutation.kind === "authority-record") {
      for (const document of documents) if (document.payload.authorityRecordId === before.id || (document.id === before.payload.subjectId && durableKinds.has(document.kind))) selected.add(document.id);
    } else if (mutation.kind === "architecture-concern") {
      selected.add(before.id);
      for (const id of [...(before.payload.relatedConceptIds as string[]), ...(before.payload.relatedRequirementIds as string[]), ...(mutation.payload.relatedConceptIds as string[]), ...(mutation.payload.relatedRequirementIds as string[])]) selected.add(id);
      for (const document of documents) if (document.kind === "architecture-decision" && document.payload.concernId === before.id) selected.add(document.id);
    } else if (mutation.kind === "developer-preference") {
      selected.add(before.id);
    } else selected.add(mutation.payload.id);
  }
  return [...selected].sort();
}

export async function captureKnowledgeContextId(repositoryRoot: string, request: string, proposal: ChangeProposal, suppliedId?: string, signal?: AbortSignal, applicationEvidence?: PsychordApplicationEvidenceHost): Promise<string | undefined> {
  signal?.throwIfAborted();
  const resolutionId = proposal.identityResolution?.contextId;
  if (suppliedId !== undefined && resolutionId !== undefined && suppliedId !== resolutionId) throw new Error("identity resolution and supplied knowledge context differ");
  if (suppliedId !== undefined || resolutionId !== undefined) return suppliedId ?? resolutionId;
  const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot();
  signal?.throwIfAborted();
  if (!snapshot.documents.some(({ kind }) => durableKinds.has(kind))) return undefined;
  const entities = existingAddresses(proposal, snapshot.documents);
  const context = await (await RepositoryKnowledgeService.create(applicationEvidence === undefined ? repositoryRoot : { repositoryRoot, applicationEvidence })).context({ request, entities, policy: { maxCandidates: Math.max(5, entities.length) }, ...(signal === undefined ? {} : { signal }) });
  signal?.throwIfAborted();
  if (!context.branches.some(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)) {
    throw new Error(`Pre-edit meaning is unresolved. Inspect ${context.id} and supply identityResolution bound to its contentHash; omitting context does not authorize a new identity.`);
  }
  return context.id;
}

/** Materialize selected candidate branches using the same context machinery and store. */
export async function adjudicatedKnowledgeContext(repositoryRoot: string, proposal: ChangeProposal, contextId?: string, signal?: AbortSignal, applicationEvidence?: PsychordApplicationEvidenceHost): Promise<KnowledgeContextResult | undefined> {
  signal?.throwIfAborted();
  if (contextId === undefined) {
    if (proposal.identityResolution !== undefined) throw new Error("identity resolution requires its retained candidate context");
    const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot();
    signal?.throwIfAborted();
    if (snapshot.documents.some(({ kind }) => durableKinds.has(kind))) throw new Error("existing canonical meaning requires retained pre-edit knowledge; recapture this change");
    return undefined;
  }
  const knowledge = await RepositoryKnowledgeService.create(applicationEvidence === undefined ? repositoryRoot : { repositoryRoot, applicationEvidence });
  const retained = await knowledge.read(contextId);
  signal?.throwIfAborted();
  const resolution = proposal.identityResolution;
  if (resolution !== undefined) {
    if (resolution.contextId !== retained.id || resolution.contextHash !== retained.contentHash) throw new Error("identity resolution does not authenticate the retained candidate proof");
    const candidates = new Set(retained.interpretation.candidates.map(({ entityId }) => entityId));
    for (const id of [...resolution.selectedEntityIds, ...(resolution.newBoundary?.nearestEntityIds ?? [])]) {
      if (!candidates.has(id)) throw new Error(`identity resolution references an uninspected candidate: ${id}`);
    }
  } else if (!retained.branches.some(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)) {
    throw new Error("knowledge context has no direct, accepted, usable interpretation branch; supply a reviewed identityResolution");
  }
  const required = existingAddresses(proposal, (await new CanonicalFileRepository(repositoryRoot).snapshot()).documents);
  signal?.throwIfAborted();
  const covered = coveredIds(retained);
  if (resolution === undefined && required.every((id) => covered.has(id))) return retained;
  const selectedIds = resolution?.selectedEntityIds ?? retained.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct && interpretation.entityKind !== "projection-unit").map(({ interpretation }) => interpretation.entityId);
  const entities = [...new Set([...selectedIds, ...required])].sort();
  if (entities.length === 0) return retained;
  // Bring every explicitly preserved/revised existing subject into the actual
  // governing context. An unrelated supplied context cannot omit its obligations.
  const selected = await knowledge.context({ request: retained.request, entities, namedTargets: retained.requestOptions.namedTargets,
    operation: retained.operation, policy: { ...retained.requestOptions.policy, maxCandidates: Math.max(retained.requestOptions.policy.maxCandidates, entities.length + retained.requestOptions.namedTargets.length) }, ...(signal === undefined ? {} : { signal }) });
  signal?.throwIfAborted();
  const directIds = new Set(selected.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).map(({ interpretation }) => interpretation.entityId));
  if (selectedIds.some((id) => !directIds.has(id))) throw new Error("a selected identity no longer resolves directly; refresh candidate knowledge");
  return selected;
}

export function assertIdentityDisposition(compiled: CompiledRepositoryChange, proposal: ChangeProposal): void {
  const resolution = proposal.identityResolution;
  const context = compiled.knowledgeContext;
  if (context === undefined) return; // Empty canonical bootstrap only, checked at capture.
  const direct = context.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct);
  if (resolution === undefined && direct.length === 0) throw new Error("knowledge context has no direct, accepted, usable interpretation branch; supply a reviewed identityResolution");
  const covered = coveredIds(context);
  const requiredExisting = [
    ...compiled.intentReview.subjects.filter(({ before }) => before !== null).map(({ id }) => id),
    ...(compiled.intentReview.canonicalMutations ?? []).flatMap(({ id, before, kind }) => {
      if (before === null) return [];
      if (durableKinds.has(kind) || kind === "authority-record") return [id];
      return kind === "relation" ? [before.fromId, before.toId].filter((value): value is string => typeof value === "string") : [];
    }),
  ];
  if (requiredExisting.some((id) => !covered.has(id))) throw new Error(`retained selected context does not cover the existing meaning being changed: ${requiredExisting.filter((id) => !covered.has(id)).join(", ")}`);
  const addsMeaning = compiled.intentReview.subjects.some(({ operation }) => operation === "add")
    || (compiled.intentReview.canonicalMutations ?? []).some(({ kind, operation }) => durableKinds.has(kind) && operation === "add");
  if (addsMeaning && resolution?.newBoundary === undefined) throw new Error("new durable meaning in an existing model requires an explicit reviewed newBoundary in identityResolution");
  if (resolution?.outcome === "no-durable-entity" && compiled.canonicalWrites.length > 0) throw new Error("no-durable-entity cannot authorize canonical mutations");
  if (resolution?.outcome === "create-new" && !addsMeaning) throw new Error("create-new must introduce durable meaning");
  if (resolution?.outcome === "reuse-existing" && addsMeaning) throw new Error("reuse-existing cannot introduce new durable ownership");
  const lineage = (proposal.canonicalMutations ?? []).filter((mutation) => mutation.kind === "lineage");
  if (lineage.length > 0 && (resolution?.outcome === "reuse-existing" || resolution?.outcome === "create-new")) throw new Error("identity outcome does not authorize retirement of existing meaning");
  const expectedKind = resolution?.outcome === "split-existing" ? "split" : resolution?.outcome === "merge-existing" ? "merge" : resolution?.outcome === "replace-existing" ? "replace" : undefined;
  if (expectedKind !== undefined && !lineage.some(({ lineageKind }) => lineageKind === expectedKind)) throw new Error(`${resolution!.outcome} requires its explicit lineage operation`);
  const kinds = new Set(lineage.map(({ lineageKind }) => lineageKind));
  if (resolution !== undefined && kinds.size === 1 && [...kinds].some((kind) => ["split", "merge", "replace"].includes(kind)) && expectedKind !== lineage[0]?.lineageKind) throw new Error("reviewed identity outcome disagrees with the lineage operation");
  if (lineage.length > 0 && resolution !== undefined) {
    const selected = new Set(resolution.selectedEntityIds);
    if (lineage.flatMap(({ sources }) => sources).some(({ id }) => !selected.has(id))) throw new Error("identity resolution must select every retired source identity");
  }
}
