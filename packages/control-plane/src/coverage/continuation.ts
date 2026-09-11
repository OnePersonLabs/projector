import { ContentHashSchema, ProjectorOperationInputSchemas, ProjectorOperationRequestSchema, StateDependencyObservationSchema, StateDigestSchema, hashFramedDomain, type StateBindingValidation, type StateDependencyObservation, type StateDigest } from "@projector/core";
import { z } from "zod";
import { FileTransactionJournal, RepositoryPathService } from "@projector/runtime";

import { ChangeLifecycleStore } from "../change-lifecycle/store.js";
import type { PsychordApplicationEvidenceHost } from "../knowledge/application-evidence.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { KnowledgeContextStore } from "../knowledge/store.js";
import { RepositoryRepresentationInspectionService } from "../representation/service.js";

const freshnessSchema = z.enum(["current", "stale", "unknown"]);
const evidenceSchema = z.strictObject({
  id: z.string(), owner: z.enum(["knowledge", "lifecycle", "representation"]),
  status: freshnessSchema, availability: z.enum(["present", "missing", "unobservable"]),
  required: z.boolean(), reason: z.string(),
  outcome: z.enum(["success", "failure", "partial"]).optional(),
  dependency: (StateDependencyObservationSchema as z.ZodType<StateDependencyObservation>).optional(),
  binding: z.strictObject({ status: z.enum(["current", "rebound", "stale", "suspect", "unavailable"]), compiledAgainst: StateDigestSchema as z.ZodType<StateDigest>, currentState: StateDigestSchema as z.ZodType<StateDigest> }).optional(),
  inspect: ProjectorOperationRequestSchema.optional(),
});

export const RepositoryContinuationSchema = z.strictObject({
  readOnly: z.literal(true),
  context: z.strictObject({ contextId: z.string(), status: freshnessSchema, governance: z.enum(["conformant", "violated", "unknown", "not-applicable"]) }).optional(),
  lifecycle: z.strictObject({ changeSelector: z.string(), approvalSelector: z.string().optional(), status: z.enum(["unresolved", "recovery-required", "completed", "unknown"]), planFreshness: freshnessSchema }).optional(),
  advisoryNotes: z.strictObject({ status: z.literal("unobservable"), reason: z.string() }),
  evidence: z.array(evidenceSchema).max(50),
  counts: z.strictObject({ current: z.number().int().nonnegative(), stale: z.number().int().nonnegative(), unknown: z.number().int().nonnegative() }),
  page: z.strictObject({ offset: z.number().int().nonnegative(), total: z.number().int().nonnegative(), included: z.number().int().nonnegative(), omitted: z.number().int().nonnegative(), nextOffset: z.number().int().nonnegative().nullable(), evidenceIdentity: ContentHashSchema }),
  nextAction: ProjectorOperationRequestSchema.nullable(),
  reason: z.string(),
  drillDown: ProjectorOperationRequestSchema.nullable(),
  limits: z.array(z.string()),
});

export type RepositoryContinuation = z.infer<typeof RepositoryContinuationSchema>;
export type RepositoryContinuationRequest = z.infer<typeof ProjectorOperationInputSchemas.cleanup>;
type Evidence = z.infer<typeof evidenceSchema>;

function freshness(status: StateBindingValidation["status"]): Evidence["status"] {
  return status === "current" || status === "rebound" ? "current" : status === "stale" ? "stale" : "unknown";
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Re-observes existing owners. This projection has no durable continuation state. */
export async function inspectRepositoryContinuation(repositoryRoot: string, request: RepositoryContinuationRequest, options: { readonly signal?: AbortSignal; readonly applicationEvidence?: PsychordApplicationEvidenceHost } = {}): Promise<RepositoryContinuation> {
  const input = ProjectorOperationInputSchemas.cleanup.parse(request);
  const signal = options.signal ?? new AbortController().signal;
  signal.throwIfAborted();
  const evidence: Evidence[] = [];
  let context: RepositoryContinuation["context"];
  let lifecycle: RepositoryContinuation["lifecycle"];
  let nextAction: RepositoryContinuation["nextAction"] = null;
  let reason = "Inspect the cleanup questions for unresolved accepted work; no lifecycle authority was selected.";
  const operation = (operation: string, input: object) => ProjectorOperationRequestSchema.parse({ apiVersion: "projector.operation/v1", repositoryRoot, operation, input });
  const lifecycleStore = await ChangeLifecycleStore.create(repositoryRoot);
  const approval = input.approvalSelector === undefined ? undefined : await lifecycleStore.readApproval(input.approvalSelector);
  const changeSelector = input.changeSelector ?? approval?.semanticChangeId;
  const capture = changeSelector === undefined ? undefined : await lifecycleStore.readCapture(changeSelector);
  if (approval !== undefined && (approval.semanticChangeId !== capture?.semanticChangeId || approval.planHash !== capture.planHash || approval.knowledgeContextId !== capture.knowledgeContextId)) throw new Error("Continuation approval does not authenticate the selected lifecycle capture.");
  const contextId = input.contextId ?? capture?.knowledgeContextId;

  if (contextId !== undefined) {
    const store = await KnowledgeContextStore.create(repositoryRoot);
    let retained;
    try { retained = await store.read(contextId); }
    catch (error) { if (!isMissing(error)) throw error; }
    if (retained === undefined) {
      context = { contextId, status: "unknown", governance: "unknown" };
      evidence.push({ id: contextId, owner: "knowledge", status: "unknown", availability: "missing", required: true, reason: "The selected saved context is absent from its durable knowledge owner." });
      nextAction = operation("context", { request: capture?.request ?? `Recover current meaning for the unavailable saved context ${contextId}`, persist: true });
      reason = "Retrieve current meaning before reusing unavailable saved reasoning.";
    } else {
      const service = await RepositoryKnowledgeService.create({ repositoryRoot, ...(options.applicationEvidence === undefined ? {} : { applicationEvidence: options.applicationEvidence }) });
      const reconciled = await service.reconcile(retained.id, { signal });
      context = { contextId: retained.id, status: freshness(reconciled.status), governance: reconciled.governance.status };
      for (const item of [{ id: "discovery", validation: reconciled.discoveryValidation }, ...reconciled.branches.map(({ branchId, validation }) => ({ id: branchId, validation }))]) {
        const bound = item.id === "discovery" ? retained.discoveryBinding : retained.branches.find(({ id }) => id === item.id)!.closure.boundState;
        evidence.push({ id: `${retained.id}:${item.id}`, owner: "knowledge", status: freshness(item.validation.status), availability: "present", required: true, reason: item.validation.reasons.join("; ") || "Bound values and query results remain current.", binding: { status: item.validation.status, compiledAgainst: bound.compiledAgainst, currentState: item.validation.currentState }, inspect: operation("reconcile", { contextId: retained.id }) });
        for (const observation of item.validation.observations ?? []) {
          const id = observation.kind === "value" ? observation.dependency.id : observation.dependency.query.id;
          const changed = observation.kind === "value" ? `Bound value or profile changed: ${id}` : `Bound query semantics or result changed: ${id}`;
          evidence.push({ id: `${item.id}:${observation.kind}:${id}:${hashFramedDomain("continuation-dependency-role", observation.dependency.role)}`, owner: "knowledge", status: observation.status, availability: observation.status === "unknown" ? "unobservable" : "present", required: true, reason: observation.status === "stale" ? `${changed}; ${observation.reason}` : observation.reason, dependency: observation });
        }
        if (item.validation.observations === undefined) {
          for (const id of item.validation.changedValueDependencyIds) evidence.push({ id: `${item.id}:value:${id}`, owner: "knowledge", status: freshness(item.validation.status), availability: "present", required: true, reason: `Bound value or profile changed: ${id}` });
          for (const id of item.validation.changedQueryDependencyIds) evidence.push({ id: `${item.id}:query:${id}`, owner: "knowledge", status: freshness(item.validation.status), availability: "present", required: true, reason: `Bound query semantics or result changed: ${id}` });
        }
      }
      for (const message of reconciled.governance.reasons) evidence.push({ id: hashFramedDomain("continuation-governance", message), owner: "knowledge", status: "unknown", availability: "present", required: true, reason: message });
      for (const message of retained.unknowns) evidence.push({ id: hashFramedDomain("continuation-retained-unknown", message), owner: "knowledge", status: "unknown", availability: "unobservable", required: false, reason: `Retained context boundary: ${message}` });
      if (context.status !== "current" || !["conformant", "not-applicable"].includes(context.governance)) {
        nextAction = operation("context", { ...retained.requestOptions, request: retained.request, persist: true });
        reason = "Refresh affected reasoning; binding freshness and current governance are separate observations.";
      }
    }
  }

  if (capture !== undefined) {
    let recoveryRequired = false;
    let completed = false;
    let attempted = false;
    if (approval !== undefined) {
      const journal = new FileTransactionJournal(await RepositoryPathService.create(repositoryRoot));
      for (const attempt of await lifecycleStore.attemptsForApproval(approval.id)) {
        signal.throwIfAborted();
        attempted = true;
        let result;
        try { result = await lifecycleStore.readAttemptResult(attempt.id); }
        catch (error) { if (!isMissing(error)) throw error; }
        let transaction;
        try { transaction = await journal.read(attempt.transactionId); }
        catch (error) { if (!isMissing(error)) throw error; }
        if (result !== undefined) {
          completed ||= result.outcome === "success";
          evidence.push({ id: attempt.id, owner: "lifecycle", status: "current", availability: "present", required: true, outcome: result.outcome, reason: `Authenticated historical ${result.outcome} result. Historical completion does not authorize repeating committed effects.` });
          if (transaction !== undefined && !["committed", "rolled-back"].includes(transaction.entry.phase)) {
            recoveryRequired = true;
            evidence.push({ id: `${attempt.id}:journal`, owner: "lifecycle", status: "current", availability: "present", required: true, reason: `The published ${result.outcome} result does not close journal phase ${transaction.entry.phase}. Recover the remaining effects while preserving this outcome.` });
          }
          continue;
        }
        recoveryRequired = true;
        evidence.push({ id: attempt.id, owner: "lifecycle", status: "current", availability: "present", required: true, reason: `Authenticated unfinished attempt; journal phase: ${transaction?.entry.phase ?? "not-started"}. Use recovery before attempting further effects.` });
        evidence.push({ id: `${attempt.id}:result`, owner: "lifecycle", status: "unknown", availability: "missing", required: true, reason: "The result or an artifact required to authenticate it is missing; no completed-success claim can be reused." });
        if (transaction?.entry.phase === "committed" || transaction?.entry.checkpointIds.some((id) => id.startsWith("prepared-success:"))) {
          let prepared;
          try { prepared = await lifecycleStore.readPreparedSuccess(attempt.id); }
          catch (error) { if (!isMissing(error)) throw error; }
          evidence.push({ id: `${attempt.id}:prepared-success`, owner: "lifecycle", status: prepared === undefined ? "unknown" : "current", availability: prepared === undefined ? "missing" : "present", required: true, reason: prepared === undefined ? "The journal names required prepared-success evidence, but it is unavailable. Recovery cannot invent that evidence." : "Authenticated prepared-success evidence is available for recovery publication." });
        }
      }
    }
    let planFreshness: "current" | "stale" | "unknown" = "current";
    let representationAvailable = true;
    const representation = await RepositoryRepresentationInspectionService.create(repositoryRoot, options);
    for (const capsule of capture.capsules) {
      if (capsule.representation === undefined) continue;
      const inspected = await representation.inspect({ changeSelector: capture.semanticChangeId, capsuleId: capsule.id, view: "summary", ...(approval === undefined ? {} : { approvalSelector: approval.id }), signal });
      if (inspected.dependencyFreshness.status === "unknown") planFreshness = "unknown";
      else if (inspected.dependencyFreshness.status === "stale" && planFreshness !== "unknown") planFreshness = "stale";
      evidence.push({ id: `${capsule.id}:dependencies`, owner: "representation", status: inspected.dependencyFreshness.status, availability: "present", required: true, reason: inspected.dependencyFreshness.reasons.join("; ") });
      const valid = inspected.artifactIntegrity.status === "valid" && inspected.semanticFidelity.status === "valid";
      representationAvailable &&= valid;
      evidence.push({ id: `${capsule.id}:artifact`, owner: "representation", status: valid ? "current" : "unknown", availability: inspected.artifactIntegrity.status === "unavailable" ? "missing" : "present", required: true, reason: `${inspected.artifactIntegrity.reason}; ${inspected.semanticFidelity.reason}`, inspect: operation("representation.inspect", { changeSelector: capture.semanticChangeId, capsuleId: capsule.id, ...(approval === undefined ? {} : { approvalSelector: approval.id }), view: "content" }) });
    }
    if (capture.capsules.length === 0 || capture.capsules.some(({ representation }) => representation === undefined)) {
      planFreshness = "unknown";
      representationAvailable = false;
      evidence.push({ id: `${capture.planId}:representation`, owner: "representation", status: "unknown", availability: "unobservable", required: true, reason: "The selected plan has no inspectable representation for every capsule." });
    }
    lifecycle = { changeSelector: capture.semanticChangeId, ...(approval === undefined ? {} : { approvalSelector: approval.id }), status: recoveryRequired ? "recovery-required" : completed ? "completed" : "unresolved", planFreshness };
    if (recoveryRequired && approval !== undefined) {
      nextAction = operation("change.recover", { approvalSelector: approval.id });
      reason = "Resolve the durable unfinished attempt first. Stale planning or missing advisory preparation does not authorize blocking safe recovery.";
    } else if (completed) {
      if (nextAction === null) nextAction = operation("complete", { scope: input.scope ?? "." });
      reason = "The selected lifecycle has authenticated historical success. Continue remaining obligations without replaying committed effects.";
    } else if (nextAction === null) {
      if (planFreshness !== "current") {
        nextAction = operation("context", { request: capture.request, persist: true });
        reason = "Refresh current meaning and revise the immutable plan before requesting new approval; selected plan dependencies are stale or unknown.";
      } else if (!representationAvailable) {
        nextAction = operation("change.plan", { changeSelector: capture.semanticChangeId });
        reason = "Regenerate and review the required plan-bound representation before execution.";
      } else {
        nextAction = approval === undefined
          ? operation("change.approve", { changeSelector: capture.semanticChangeId, planHash: capture.planHash })
          : operation(attempted ? "change.resume" : "change.apply", { approvalSelector: approval.id });
        reason = approval === undefined ? "Review and approve the exact current plan hash before execution." : "The selected approval and its plan dependencies are current; continue through the lifecycle service.";
      }
    }
  }

  signal.throwIfAborted();
  nextAction ??= operation("complete", { scope: input.scope ?? "." });
  const evidenceIdentity = hashFramedDomain("repository-continuation-evidence", { context, lifecycle, evidence });
  if (input.evidenceIdentity !== undefined && input.evidenceIdentity !== evidenceIdentity) throw new Error("Continuation evidence changed; restart cleanup at evidenceOffset 0 without the previous evidenceIdentity.");
  const offset = input.evidenceOffset ?? 0;
  const limit = input.evidenceLimit ?? 10;
  if (offset > evidence.length) throw new Error("evidenceOffset exceeds the current continuation evidence population");
  const selected = evidence.slice(offset, offset + limit);
  const nextOffset = offset + selected.length < evidence.length ? offset + selected.length : null;
  return RepositoryContinuationSchema.parse({
    readOnly: true, ...(context === undefined ? {} : { context }), ...(lifecycle === undefined ? {} : { lifecycle }),
    advisoryNotes: { status: "unobservable", reason: "The selected existing owners do not name advisory notes. No note discovery or absence claim is inferred." },
    evidence: selected,
    counts: { current: evidence.filter(({ status }) => status === "current").length, stale: evidence.filter(({ status }) => status === "stale").length, unknown: evidence.filter(({ status }) => status === "unknown").length },
    page: { offset, total: evidence.length, included: selected.length, omitted: evidence.length - selected.length, nextOffset, evidenceIdentity },
    nextAction, reason,
    drillDown: nextOffset === null ? null : operation("cleanup", { ...input, evidenceOffset: nextOffset, evidenceLimit: limit, evidenceIdentity }),
    limits: ["Evidence pagination bounds disclosure, not repository observation. Each page re-observes the existing owners and rejects changed evidence.", "Current bindings are not proof of behavioral completion. No note, answer or progress store is created."],
  });
}
