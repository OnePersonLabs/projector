import {
  ArchitectureConcernSchema, ArchitectureDecisionSchema, ConceptSchema, DeveloperPreferenceSchema,
  canonicalJson,
  type ArchitectureConcern, type ArchitectureDecision, type CanonicalDocumentEnvelope, type Concept,
  type DecisionConsequence, type DeveloperPreference,
} from "@projector/core";
import { normalizeSelector } from "@projector/engine";

/** Check the final model, so a decision and its products share one journal/approval. */
export function validateArchitectureProducts(documents: readonly CanonicalDocumentEnvelope[], now: string, changedIds: ReadonlySet<string>): void {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const decisions = documents.filter(({ kind }) => kind === "architecture-decision")
    .map(({ payload }) => ArchitectureDecisionSchema.parse(payload) as ArchitectureDecision);
  const active = decisions.filter(({ lifecycle }) => lifecycle === "active");
  const concerns = documents.filter(({ kind }) => kind === "architecture-concern")
    .map(({ payload }) => ArchitectureConcernSchema.parse(payload) as ArchitectureConcern);
  const preferences = documents.filter(({ kind }) => kind === "developer-preference")
    .map(({ payload }) => DeveloperPreferenceSchema.parse(payload) as DeveloperPreference);
  const changedDecisionIds = new Set(decisions.filter(({ id }) => changedIds.has(id)).map(({ id }) => id));
  const touchedConcernIds = new Set([
    ...decisions.filter(({ id }) => changedDecisionIds.has(id)).map(({ concernId }) => concernId),
    ...concerns.filter(({ id, decisionIds }) => changedIds.has(id) || decisionIds.some((decisionId) => changedDecisionIds.has(decisionId))).map(({ id }) => id),
  ]);

  for (const concern of concerns.filter(({ id }) => touchedConcernIds.has(id))) {
    for (const [ids, kind] of [[concern.relatedConceptIds, "concept"], [concern.relatedRequirementIds, "requirement"], [concern.decisionIds, "architecture-decision"]] as const) {
      for (const id of ids) if (byId.get(id)?.kind !== kind) throw new Error(`concern ${concern.id} references missing or wrong-kind ${id}`);
    }
    for (const id of concern.decisionIds) if (decisions.find((decision) => decision.id === id)?.concernId !== concern.id) throw new Error(`concern ${concern.id} lists decision ${id} owned by another concern`);
    for (const decision of active.filter(({ concernId }) => concernId === concern.id)) if (!concern.decisionIds.includes(decision.id)) throw new Error(`concern ${concern.id} must index active decision ${decision.id} in decisionIds; revise the concern in the same canonical proposal`);
    if (concern.status === "resolved" && !active.some((decision) => decision.concernId === concern.id)) throw new Error(`resolved concern ${concern.id} has no active decision; use dismissed with rationale when no decision is needed`);
    if (concern.status === "deferred") {
      const deferral = concern.deferral;
      if (deferral === undefined || !deferral.rationale.trim() || deferral.preserveOptionality.length === 0 || deferral.forbiddenCommitments.length === 0 || deferral.reconsiderWhen.length === 0) throw new Error(`deferred concern ${concern.id} needs rationale, preserved options, forbidden commitments and reconsideration conditions`);
      if (deferral.reviewBy !== undefined && (!Number.isFinite(Date.parse(deferral.reviewBy)) || Date.parse(deferral.reviewBy) <= Date.parse(now))) throw new Error(`deferred concern ${concern.id} has an invalid or expired review date`);
    }
  }
  for (const decision of active) {
    const decisionChanged = changedIds.has(decision.id);
    const concernChanged = changedIds.has(decision.concernId);
    if (!decisionChanged && !concernChanged && !decision.consequences.some(({ targetId }) => targetId !== undefined && changedIds.has(targetId))) continue;
    const concern = byId.get(decision.concernId);
    if (decisionChanged && concern?.kind !== "architecture-concern") throw new Error(`changed active decision ${decision.id} requires a real architecture-concern ${decision.concernId}; include or repair the concern in the same canonical proposal`);
    if ((decisionChanged || concernChanged) && concern?.kind === "architecture-concern") {
      const owner = ArchitectureConcernSchema.parse(concern.payload) as ArchitectureConcern;
      if (canonicalJson(normalizeSelector(decision.scope)) !== canonicalJson(normalizeSelector(owner.scope))) throw new Error(`decision ${decision.id} scope must match the normalized scope of concern ${owner.id}; author an explicitly scoped concern and update its decisionIds when the decision needs a different boundary`);
    }
    for (const preference of decision.appliedPreferences.filter(() => decisionChanged)) {
      if (preference.scope !== "project") throw new Error(`decision ${decision.id} cannot claim ${preference.scope} preference ${preference.key} without an authenticated provider; explicitly adopt the preference as a project record and cite that accepted project hash`);
      const adopted = preferences.find(({ key }) => key === preference.key);
      // New decisions bind the current adopted preference; changing a soft
      // preference alone does not reopen the historical influence snapshot.
      if (adopted === undefined || adopted.scope !== "project" || adopted.status !== "active" || adopted.semanticHash !== preference.semanticHash) throw new Error(`decision ${decision.id} cites a missing, inactive or stale project preference ${preference.key}`);
    }
    for (const consequence of decision.consequences) validateConsequence(decision, consequence, byId);
  }
  validateTouchedDecisionCycles(active, changedIds);
}

/** A touched cyclic constraint component requires convergence proof, which this public authoring path cannot supply. */
function validateTouchedDecisionCycles(decisions: readonly ArchitectureDecision[], changedIds: ReadonlySet<string>): void {
  const byId = new Map(decisions.map((decision) => [decision.id, decision]));
  const complete = new Set<string>();
  const visit = (id: string, path: readonly string[]): void => {
    const cycleAt = path.indexOf(id);
    if (cycleAt >= 0) throw new Error(`decision constraint cycle ${[...path.slice(cycleAt), id].join(" -> ")} lacks a supported convergence proof; revise the touched constrain-decision consequences to be acyclic`);
    if (complete.has(id)) return;
    const decision = byId.get(id);
    for (const consequence of decision?.consequences ?? []) if (consequence.kind === "constrain-decision" && consequence.targetId !== undefined && byId.has(consequence.targetId)) visit(consequence.targetId, [...path, id]);
    complete.add(id);
  };
  for (const decision of decisions.filter(({ id }) => changedIds.has(id))) visit(decision.id, []);
}

function validateConsequence(decision: ArchitectureDecision, consequence: DecisionConsequence, documents: ReadonlyMap<string, CanonicalDocumentEnvelope>): void {
  if (consequence.kind === "advisory") return;
  if (consequence.kind === "select-technology" || consequence.kind === "deprecate-technology") throw new Error(`decision ${decision.id} consequence ${consequence.kind} is unsupported because no authenticated technology product is available; record the choice and options in the architecture decision and express concrete obligations through an explicit constraint concept`);
  const target = consequence.targetId === undefined ? undefined : documents.get(consequence.targetId);
  const fail = (reason: string): never => { throw new Error(`decision ${decision.id} consequence ${consequence.kind}: ${reason}; include the corresponding canonical product in the same proposal`); };
  if (target === undefined) fail(`target ${consequence.targetId ?? "(missing)"} is unavailable`);
  const record = target!;
  if (consequence.scope !== undefined) {
    const targetScope = record.payload.scope ?? record.payload.selector;
    if (targetScope === undefined || typeof targetScope !== "object" || targetScope === null) fail("declared scope has no supported target scope or selector to verify");
    let scopesMatch = false;
    try {
      scopesMatch = canonicalJson(normalizeSelector(consequence.scope)) === canonicalJson(normalizeSelector(targetScope as NonNullable<DecisionConsequence["scope"]>));
    } catch {
      fail("declared scope or target scope cannot be normalized by the supported selector evaluator");
    }
    if (!scopesMatch) fail("declared scope does not match the canonical target scope or selector");
  }
  for (const [field, expected] of Object.entries(consequence.payload ?? {})) {
    if (!Object.hasOwn(record.payload, field)) fail(`declared payload field ${field} is unsupported by the canonical target`);
    if (canonicalJson(record.payload[field]) !== canonicalJson(expected)) fail(`declared payload field ${field} does not match the canonical target`);
  }
  const active = record.payload.status === "active" || record.payload.lifecycle === "active";
  const retired = record.payload.status === "retired" || record.payload.lifecycle === "retired" || record.payload.lifecycle === "superseded";
  const isGovernance = record.kind === "projection-lens" || record.kind === "rule";
  switch (consequence.kind) {
    case "activate-governance": {
      if (!isGovernance || (record.kind === "projection-lens" && !active)) fail("target is not active executable governance");
      const basis = record.payload.governanceBasis as Array<{ kind: string; decisionId?: string }>;
      if (!basis?.some((item) => item.kind === "architecture-decision" && item.decisionId === decision.id)) fail("governance target does not retain this decision as its basis");
      break;
    }
    case "deactivate-governance":
      // Standalone rules have no inactive lifecycle; retire the owning lens.
      if (record.kind !== "projection-lens" || active) fail("target lens remains active or has no supported deactivation state");
      break;
    case "introduce-constraint":
    case "retire-constraint": {
      if (record.kind !== "concept") fail("target is not an accepted concept");
      const concept = ConceptSchema.parse(record.payload) as Concept;
      if (consequence.kind === "introduce-constraint" && concept.kind !== "constraint" && concept.kind !== "invariant") fail("target is not a constraint or invariant");
      if (consequence.kind === "introduce-constraint" ? !active : !retired) fail("target lifecycle does not implement the consequence");
      break;
    }
    case "activate-concern":
      if (record.kind !== "architecture-concern" || record.payload.status !== "active") fail("target is not an active concern");
      break;
    case "constrain-decision": {
      if (record.kind !== "architecture-decision" || !active) fail("target is not an active decision");
      const targetDecision = ArchitectureDecisionSchema.parse(record.payload) as ArchitectureDecision;
      if (!targetDecision.governanceBasis.some((basis) => basis.kind === "architecture-decision" && basis.decisionId === decision.id)) fail("target decision does not retain the constraining decision as a basis");
      break;
    }
    case "require-migration":
      if (record.kind !== "migration" || record.payload.phase === "rolled-back") fail("target is not an accepted migration");
      break;
  }
}
