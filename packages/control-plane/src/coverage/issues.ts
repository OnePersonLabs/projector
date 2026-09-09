import { canonicalJson, hashFramedDomain, type ArchitectureConcern, type ContentHash } from "@projector/core";
import { validateDecisionDeferral, type GovernanceBundleEvaluation } from "@projector/engine";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { KnowledgeDecisionValidity } from "../knowledge/types.js";

export interface CompletionQuestion {
  readonly id: string;
  readonly kind: "governance" | "unmapped-group" | "unrealized-requirement" | "unrealized-scenario" | "identity-overlap" | "architecture-concern";
  readonly blocking: boolean;
  readonly ownerIds: readonly string[];
  readonly affectedCount: number;
  readonly subjectCount: number;
  readonly examples: readonly string[];
  readonly question: string;
  readonly reasons: readonly string[];
  readonly reasonCount: number;
  readonly evidenceHash: ContentHash;
  readonly resolution: { readonly context: { readonly command: "context"; readonly request: string; readonly entities: readonly string[]; readonly namedTargets: readonly string[] }; readonly route: "canonical-proposal"; readonly instruction: string };
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
}): CompletionQuestion[] {
  const { graph, unitIds } = input;
  const questions: CompletionQuestion[] = [];
  const paths = new Map(graph.units.map((unit) => [unit.id, unit.key]));
  const members = (id: string): string[] => unique(graph.implementationBindings(id).map((item) => String(item.id)).filter((unitId) => unitIds.has(unitId)));
  const add = (kind: CompletionQuestion["kind"], owners: readonly string[], subjects: readonly string[], blocking: boolean, question: string, reasons: readonly string[], facts: unknown, targets: readonly string[] = []) => {
    const ownerIds = unique(owners); const subjectIds = unique(subjects);
    const subjectHashes = unique([...ownerIds, ...subjectIds]).map((id) => ({ id, semanticHash: graph.semanticHash(id) ?? null, sourceHash: graph.sourceHash(id) ?? null }));
    questions.push({ id: `completion_question_${hashFramedDomain("completion-question-identity", { kind, ownerIds }).slice(-32)}`, kind, blocking, ownerIds,
      affectedCount: subjectIds.filter((id) => unitIds.has(id)).length, subjectCount: subjectIds.length,
      examples: subjectIds.slice(0, 5).map((id) => paths.get(id) ?? id), question, reasons: unique(reasons).slice(0, 5), reasonCount: unique(reasons).length,
      evidenceHash: hashFramedDomain("completion-question-evidence", { kind, ownerIds, subjectHashes, subjectIds, facts }),
      resolution: { context: { command: "context", request: question, entities: ownerIds.filter((id) => graph.entitiesById.has(id)), namedTargets: unique(targets) }, route: "canonical-proposal",
        instruction: "Inspect current context, then capture, review, approve and apply a canonical proposal or implementation repair. Canonical meaning settles this question; rerunning completion observes changed facts. No answer ledger is created." } });
  };
  for (const problem of input.authorityProblems) add("governance", [problem.authorityId, problem.ownerId], members(problem.ownerId), true,
    `What accepted authority and executable obligations govern ${problem.ownerId}?`, problem.reasons, problem);
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
    `How should ${owners[2]} be satisfied or canonically revised?`, findings.map(({ reason }) => reason), { findings, governedMembership: graph.implementationBindings(owners[1]!) });
  for (const decision of input.decisions.filter(({ assessment }) => assessment.blocksCurrentChange)) add("governance", [decision.authorityId, decision.decisionId], members(decision.decisionId), true,
    `Should ${decision.decisionId} be reaffirmed or revised against its current evidence?`, [decision.assessment.explanation, ...decision.checks.filter(({ status }) => status === "fired" || status === "unknown").map(({ reason }) => reason)], decision);
  const meanings = graph.entities.filter(({ kind, accepted, payload }) => accepted && ["concept", "requirement", "scenario"].includes(kind) && "status" in payload && payload.status === "active");
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
