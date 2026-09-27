import { canonicalJson, hashFramedDomain, type ArchitectureConcern, type ContentHash, type CompletionAssessment, type CompletionRepairAlternative, type CompletionRepairRoute } from "@projector/core";
import { isHardRule, normalizeSelector, validateDecisionDeferral, type GovernanceBundleEvaluation } from "@projector/engine";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { KnowledgeDecisionValidity } from "../knowledge/types.js";
import type { KnowledgeApplicationEvidenceAssessment } from "../knowledge/application-evidence.js";

export interface CompletionQuestion {
  readonly id: string;
  readonly kind: "governance" | "unmapped-group" | "unrealized-requirement" | "unrealized-scenario" | "realization-binding" | "identity-overlap" | "architecture-concern";
  readonly blocking: boolean;
  readonly ownerIds: readonly string[];
  readonly affectedCount: number;
  readonly subjectCount: number;
  readonly examples: readonly string[];
  readonly question: string;
  readonly reasons: readonly string[];
  readonly reasonCount: number;
  readonly evidenceHash: ContentHash;
  readonly assessment: CompletionAssessment;
  readonly resolution: { readonly context: { readonly command: "context"; readonly request: string; readonly entities: readonly string[]; readonly namedTargets: readonly string[] }; readonly route: CompletionRepairRoute; readonly instruction: string; readonly alternatives: readonly CompletionRepairAlternative[] };
}

export function completionRepairAlternatives(route: CompletionRepairRoute, transforms: readonly string[], observedValidators: readonly string[] = [], generatedOutput = false): CompletionRepairAlternative[] {
  const supported = transforms.filter((id) => id === "exact-text-patch@1");
  const unsupported = transforms.filter((id) => id !== "exact-text-patch@1");
  return [
    { strategy: "reuse", status: "skipped", reason: "Current evidence leaves this obligation unresolved; no reusable satisfying result was established.", capabilityIds: [] },
    { strategy: "revalidate", status: observedValidators.length > 0 ? "available" : "unavailable", reason: observedValidators.length > 0 ? "Current governance findings were evaluated by the supported built-in static dependency validator. Rerun bounded completion after repair; availability does not imply satisfaction." : "This finding establishes no executable validator capability. Inspect context to identify a supported validator.", capabilityIds: [...observedValidators] },
    { strategy: "regenerate", status: "unavailable", reason: generatedOutput ? "Generated output is affected. Inspect its upstream source and generator first; regeneration remains unavailable until an executable lifecycle generator is registered." : "No lifecycle generator for this obligation is established.", capabilityIds: [] },
    { strategy: "deterministic-patch", status: !generatedOutput && route === "implementation-repair" && supported.length > 0 ? "available" : "unavailable", reason: generatedOutput ? "Generated output is affected. Do not patch the output directly; inspect its upstream source and generator first. No registered regeneration path is established." : supported.length > 0 && route === "implementation-repair" ? "The lifecycle compiler and executor support exact-text-patch@1. A concrete state-bound patch, review and approval are still required." : unsupported.length > 0 ? `Advertised bindings ${unsupported.join(", ")} are not supported by the lifecycle executor; no transform substitution is inferred.` : "No applicable deterministic transform binding is established.", capabilityIds: [...supported, ...unsupported] },
    { strategy: "agent-repair", status: "unavailable", reason: "This read-only inspection has no authenticated agent repair executor. Ordinary implementation repair can preserve accepted meaning without canonical revision.", capabilityIds: [] },
    { strategy: "widen-analysis", status: "available", reason: "The context command can inspect named owners and targets. Wider observation requires a new bounded request.", capabilityIds: ["context"] },
    { strategy: "human-decision", status: "available", reason: route === "canonical-proposal" ? "An accepted meaning change requires an explicit canonical proposal through capture, review, approve and apply." : "Choose implementation repair or collect missing evidence while preserving accepted meaning. Only an explicit meaning change uses a canonical proposal.", capabilityIds: ["context", "capture", "review", "approve", "apply"] },
  ];
}

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();
const normalize = (value: string): string => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");

export function deriveCompletionQuestions(input: {
  readonly graph: KnowledgeGraph;
  readonly unitIds: ReadonlySet<string>;
  readonly decisions: readonly KnowledgeDecisionValidity[];
  readonly evaluations: readonly { readonly lensId: string; readonly evaluation: GovernanceBundleEvaluation }[];
  readonly authorityProblems: readonly { readonly ownerId: string; readonly authorityId: string; readonly reasons: readonly string[] }[];
  readonly includeUnrealized: boolean;
  readonly now: string;
  readonly applicationEvidence?: readonly KnowledgeApplicationEvidenceAssessment[];
}): CompletionQuestion[] {
  const { graph, unitIds } = input;
  const questions: CompletionQuestion[] = [];
  const paths = new Map(graph.units.map((unit) => [unit.id, unit.key]));
  const lensesById = new Map(graph.lenses.map((lens) => [String(lens.id), lens]));
  const observedPredicates = new Set(input.evaluations.flatMap(({ lensId, evaluation }) => evaluation.findings.filter(({ status }) => status !== "unknown").map(({ ruleId, predicateHash }) => `${lensId}\0${ruleId}\0${predicateHash}`)));
  const members = (id: string): string[] => unique(graph.implementationBindings(id).map((item) => String(item.id)).filter((unitId) => unitIds.has(unitId)));
  const add = (kind: CompletionQuestion["kind"], owners: readonly string[], subjects: readonly string[], blocking: boolean, question: string, reasons: readonly string[], facts: unknown, targets: readonly string[] = [], assessment?: CompletionAssessment) => {
    const ownerIds = unique(owners); const subjectIds = unique(subjects);
    const generatedOutputs = graph.units.filter((unit) => subjectIds.includes(unit.id)
      && (unit.tags.includes("generated") || unit.generatedFromUnitIds.length > 0));
    const generatedOutputEvidence = generatedOutputs.map((unit) => ({ id: unit.id, key: unit.key, origin: unit.causalOrigin, generatedFromUnitIds: unit.generatedFromUnitIds }));
    const generatedOutputReason = "Generated output is affected. Inspect its upstream source and generator first. Regeneration is unavailable until an executable lifecycle generator is registered; do not patch the output directly.";
    const reportedReasons = generatedOutputs.length > 0
      ? [...unique(reasons.filter((reason) => reason !== generatedOutputReason)).slice(0, 4), generatedOutputReason]
      : unique(reasons);
    const disposition: CompletionAssessment = assessment ?? { status: "unknown", category: kind.startsWith("unrealized-") ? "unrealized-behavior" : kind === "realization-binding" ? "missing-evidence" : "meaning-gap" };
    const route: CompletionRepairRoute = disposition.category === "conflicting-rules" ? "canonical-proposal" : disposition.status === "violated" || disposition.category === "unrealized-behavior" ? "implementation-repair" : ["missing-evidence", "missing-validator", "unreachable-selector"].includes(disposition.category) ? "missing-evidence" : "canonical-proposal";
    const ownerLenses = ownerIds.flatMap((id) => lensesById.has(id) ? [lensesById.get(id)!] : []);
    const transforms = unique(ownerLenses.flatMap((lens) => lens.transforms.map(({ id, version }) => `${id}@${version}`)));
    const observedValidators = unique(ownerLenses.flatMap((lens) => lens.rules.filter(({ id, predicates }) => ownerIds.includes(id) && predicates.length > 0
      && predicates.every((predicate) => predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed")
      && predicates.some((predicate) => (predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed")
        && observedPredicates.has(`${lens.id}\0${id}\0${hashFramedDomain("governance-predicate", { ...predicate, from: normalizeSelector(predicate.from), to: normalizeSelector(predicate.to) })}`)))
      .flatMap(({ validatorIds }) => validatorIds.filter((id) => id === "projector.builtin.static-dependency-boundary@1"))));
    const subjectHashes = unique([...ownerIds, ...subjectIds]).map((id) => ({ id, semanticHash: graph.semanticHash(id) ?? null, sourceHash: graph.sourceHash(id) ?? null }));
    questions.push({ id: `completion_question_${hashFramedDomain("completion-question-identity", { kind, ownerIds }).slice(-32)}`, kind, blocking, ownerIds,
      affectedCount: subjectIds.filter((id) => unitIds.has(id)).length, subjectCount: subjectIds.length,
      examples: subjectIds.slice(0, 5).map((id) => paths.get(id) ?? id), question, reasons: reportedReasons.slice(0, 5), reasonCount: unique([...reasons, ...(generatedOutputs.length > 0 ? [generatedOutputReason] : [])]).length,
      assessment: disposition,
      evidenceHash: hashFramedDomain("completion-question-evidence", { kind, ownerIds, subjectHashes, subjectIds, facts, generatedOutputEvidence, disposition, transforms }),
      resolution: { context: { command: "context", request: question, entities: ownerIds.filter((id) => graph.entitiesById.has(id)), namedTargets: unique(targets) }, route,
        alternatives: completionRepairAlternatives(route, transforms, observedValidators, generatedOutputs.length > 0),
        instruction: route === "canonical-proposal" ? "Inspect current context and explicitly propose any accepted meaning change through capture, review, approve and apply. Rerun completion against changed facts." : "Preserve accepted meaning. Repair the implementation or collect the missing evidence, then rerun completion. A meaning change requires a separate explicit canonical proposal. No repair is executed by this report." } });
  };
  for (const problem of input.authorityProblems) add("governance", [problem.authorityId, problem.ownerId], members(problem.ownerId), true,
    `What accepted authority and executable obligations govern ${problem.ownerId}?`, problem.reasons, problem, [], { status: "unknown", category: "authority-problem" });
  const grouped = new Map<string, { owners: string[]; subjects: string[]; findings: GovernanceBundleEvaluation["findings"][number][] }>();
  for (const { lensId, evaluation } of input.evaluations) {
    const lens = graph.lenses.find(({ id }) => id === lensId)!;
    for (const finding of evaluation.findings.filter(({ status }) => status !== "satisfied")) {
      const owners = [lens.authorityRecordId, lensId, finding.ruleId]; const key = canonicalJson(owners);
      const group = grouped.get(key) ?? { owners, subjects: [], findings: [] };
      group.subjects.push(evaluation.unitId); group.findings.push(finding); grouped.set(key, group);
    }
  }
  for (const { owners, subjects, findings } of grouped.values()) add("governance", owners, subjects, true,
    `How should ${owners[2]} be satisfied or canonically revised?`, findings.map(({ reason }) => reason), { findings, governedMembership: graph.implementationBindings(owners[1]!) }, [], { status: findings.some(({ status }) => status === "violated") ? "violated" : "unknown", category: owners[2]!.includes(",") ? "conflicting-rules" : findings.some(({ reason }) => reason.startsWith("Validator ")) ? "missing-validator" : findings.some(({ status }) => status === "violated") ? "rule-violation" : "missing-evidence" });
  for (const decision of input.decisions.filter(({ assessment }) => assessment.blocksCurrentChange)) add("governance", [decision.authorityId, decision.decisionId], members(decision.decisionId), true,
    `Should ${decision.decisionId} be reaffirmed or revised against its current evidence?`, [decision.assessment.explanation, ...decision.checks.filter(({ status }) => status === "fired" || status === "unknown").map(({ reason }) => reason)], decision);
  for (const lens of graph.lenses.filter(({ status }) => status === "active")) {
    const subjects = members(lens.id);
    if (!input.includeUnrealized && subjects.length === 0) continue;
    if (input.includeUnrealized && graph.lensCompilation !== undefined && (graph.lensCompilation.memberships[lens.id] ?? []).length === 0) add("governance", [lens.authorityRecordId, lens.id, `selector:${lens.id}`], [], false,
      `Does the selector for ${lens.key} reach its intended implementation?`, ["The compiled selector selects no units in the finite observed inventory. This does not prove that the selector is logically unreachable or that future units cannot match."], { selector: lens.selector, membershipFingerprint: graph.lensCompilation.membershipFingerprints[lens.id] }, [], { status: "unknown", category: "unreachable-selector" });
    for (const transform of lens.transforms.filter(({ id, version }) => `${id}@${version}` !== "exact-text-patch@1")) add("governance", [lens.authorityRecordId, lens.id, `transform:${transform.id}@${transform.version}`], subjects, false,
      `How can ${transform.id}@${transform.version} repair the governed implementation?`, ["The lens advertises this transform, but the repository lifecycle compiler and executor do not dispatch it. Runtime primitives with different identifiers do not establish this binding's availability."], transform, [], { status: "unavailable", category: "missing-evidence" });
    for (const rule of lens.rules.filter((rule) => isHardRule(rule) && rule.predicates.length === 0 && rule.validatorIds.length === 0)) add("governance", [lens.authorityRecordId, lens.id, rule.id], subjects, true,
      `What executable predicate or validator establishes ${rule.key}?`, ["This non-advisory rule declares neither a predicate nor a validator. Prose alone does not establish executable satisfaction."], rule, [], { status: "unavailable", category: "missing-validator" });
  }
  for (const evidence of input.applicationEvidence ?? []) {
    const status = evidence.status === "unavailable" ? "unavailable" : evidence.assessment.fulfillment.status;
    if (status === "satisfied") continue;
    add("governance", [evidence.owner.id, `application-evidence:${hashFramedDomain("completion-application-binding", evidence.binding)}`], members(evidence.owner.id), true,
      `What current observation demonstrates the accepted behavior of ${evidence.owner.id}?`, [evidence.status === "unavailable" ? evidence.reason : evidence.assessment.fulfillment.reason], evidence, [], { status, category: status === "violated" ? "unrealized-behavior" : "missing-evidence" });
  }
  const meanings = graph.entities.filter(({ kind, accepted, payload }) => accepted && ["concept", "requirement", "scenario"].includes(kind) && "status" in payload && payload.status === "active");
  for (const entity of meanings) {
    const failed = graph.observation.realizations.filter(({ entityId, status }) => entityId === entity.id && status !== "matched");
    if (failed.length > 0 && (input.includeUnrealized || members(entity.id).length > 0)) add("realization-binding", [entity.id], members(entity.id), false,
      `Which observed implementation should the declared realizations of ${entity.key} identify?`, failed.map(({ bindingIndex, reason }) => `Realization ${bindingIndex}: ${reason}`), failed, [], { status: failed.some(({ status }) => status === "unsupported" || status === "unavailable") ? "unavailable" : "unknown", category: "missing-evidence" });
  }
  const mapped = new Set(meanings.flatMap(({ id }) => members(id)));
  const groups = new Map<string, string[]>();
  for (const unit of graph.units.filter(({ id }) => unitIds.has(id) && !mapped.has(id))) {
    const parts = unit.key.split("/"); parts.pop(); const group = parts.join("/") || ".";
    groups.set(group, [...(groups.get(group) ?? []), unit.id]);
  }
  for (const [group, subjects] of groups) add("unmapped-group", [`repository-group:${group}`], subjects, false,
    `Which accepted meaning owns the unmapped files in ${group}?`, ["Observed files have no active canonical concept, requirement, or scenario membership. A scope mapping records ownership, not behavioral satisfaction."], { group }, [group]);
  for (const entity of meanings.filter(({ kind, id }) => kind === "requirement" && graph.implementationBindings(id).length === 0 && input.includeUnrealized)) add("unrealized-requirement", [entity.id], [entity.id], false,
    `What implementation should realize ${entity.key}?`, ["The active requirement has no observed implementation members. Preserve its accepted meaning while choosing implementation or an explicit canonical revision."], entity.payload);
  for (const entity of meanings.filter(({ kind, id }) => kind === "scenario" && graph.implementationBindings(id).length === 0 && input.includeUnrealized)) add("unrealized-scenario", [entity.id], [entity.id], false,
    `What implementation and evidence should demonstrate ${entity.key}?`, ["The active scenario has no observed implementation members. Preserve its accepted trigger and outcomes while choosing implementation and validation or an explicit canonical revision. Membership alone does not prove these outcomes."], entity.payload);
  const claims = new Map<string, string[]>();
  for (const entity of meanings) for (const claim of unique([entity.id, entity.key, ...entity.aliases].map(normalize))) {
    const key = `${entity.kind}:${claim}`; claims.set(key, unique([...(claims.get(key) ?? []), entity.id]));
  }
  const collisions = new Map<string, { owners: string[]; claims: string[] }>();
  for (const [claim, owners] of claims) if (owners.length > 1) { const key = canonicalJson(owners); const group = collisions.get(key) ?? { owners, claims: [] }; group.claims.push(claim); collisions.set(key, group); }
  for (const { owners, claims: addresses } of collisions.values()) if (input.includeUnrealized || owners.some((id) => members(id).length > 0)) add("identity-overlap", owners, unique(owners.flatMap(members)), true,
    `Which accepted identities should own the overlapping addresses ${addresses.join(", ")}?`, ["Exact accepted keys or aliases overlap. This is an address ambiguity, not proof that the meanings are equivalent; preserve distinctions or record explicit canonical lineage."], { addresses });
  for (const entity of graph.entities.filter(({ kind }) => kind === "architecture-concern")) {
    const concern = entity.payload as ArchitectureConcern;
    if (concern.sourceClass !== "authored" || concern.materiality !== "blocking-now" || ["candidate", "dismissed", "superseded"].includes(concern.status)) continue;
    const subjects = members(concern.id); if (!input.includeUnrealized && subjects.length === 0) continue;
    const selected = input.decisions.filter(({ decisionId }) => concern.decisionIds.includes(decisionId));
    if (concern.status === "resolved" && selected.length > 0 && selected.every(({ assessment }) => !assessment.blocksCurrentChange)) continue;
    let reasons = [concern.status === "resolved" ? "The resolved concern has no current accepted decision proof." : "An accepted blocking-now concern requires a decision or explicit valid deferral."];
    if (concern.status === "deferred") {
      const deferral = concern.deferral;
      if (deferral !== undefined) {
        const validation = validateDecisionDeferral(deferral);
        const deadline = deferral.reviewBy === undefined ? undefined : Date.parse(deferral.reviewBy);
        const dates = deferral.reconsiderWhen.filter((trigger) => trigger.type === "date");
        const expired = (deadline !== undefined && (!Number.isFinite(deadline) || Date.parse(input.now) >= deadline)) || dates.some((trigger) => !Number.isFinite(Date.parse(trigger.at)) || Date.parse(input.now) >= Date.parse(trigger.at));
        const unsupported = deferral.reconsiderWhen.filter(({ type }) => type !== "date" && type !== "manual-review");
        if (validation.valid && !expired && unsupported.length === 0) continue;
        reasons = [...validation.reasons, ...(expired ? ["The canonical deferral review date has expired."] : []), ...unsupported.map(({ type }) => `Deferral trigger ${type} has no accepted baseline observer; continued deferral is not established.`)];
      } else reasons = ["The deferred concern lacks its canonical deferral contract."];
    }
    add("architecture-concern", [concern.id], subjects, true, concern.question, reasons, { concern, selected });
  }
  const priority = (question: CompletionQuestion) => question.kind === "unmapped-group" ? 2 : question.kind.startsWith("unrealized-") ? 1 : 0;
  return questions.sort((a, b) => Number(b.blocking) - Number(a.blocking) || priority(a) - priority(b) || b.affectedCount - a.affectedCount || a.id.localeCompare(b.id));
}
