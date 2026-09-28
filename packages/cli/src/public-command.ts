import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { ChangeProposalSchema, ProjectorOperationInputSchemas, type ProjectorOperation, type ProjectorOperationError } from "@projector/core";
import { RepositoryKnowledgeService } from "@projector/control-plane";
import { CanonicalFileRepository } from "@projector/runtime";
import { z } from "zod";

export const publicCommandHelp = `Projector: retrieve meaning, change with Codex, check consequences.

  projector init
  projector context "task" [--entity ID] [--target path] [--budget characters] [--full]
  projector check [CONTEXT]
  projector integration --target REF --incoming REF [--base REF] [--result REF]
  projector audit [--scope PATH] [--context CONTEXT] [--question-offset N] [--json]
  projector accept proposal.json [--context CONTEXT] [--request "reason"]
  projector accept --apply CHANGE --hash HASH
  projector resume CONTEXT|CHANGE|APPROVAL
  projector inspect ID
  projector inspect --representations
  projector recover APPROVAL | --access | --representations
  projector evaluate options.json
  projector verify check.json
  projector verify --inspect [EVENT] | --recover
  projector verify --builtin --target REF
  projector verify --builtin --assess EVENT --target REF
  projector verify --builtin --inspect | --recover
  projector generate generation.json
  projector generate --inspect producers.json | --recover producers.json
  projector code query|index|impact|tests|test-run|evidence|export request.json
  projector code status [RUN] | wait RUN | cancel RUN

Use --root PATH for another repository, --json for exact machine results.
Use --timeout-ms N for a bounded observation timeout per operation (default 60000).
Accept first previews a canonical change. Apply names that exact reviewed plan.
Resume only inspects and restores authenticated context. Recovery never applies.
Audit observes bounded repository evidence and proposes repair routes. It never applies repairs.
Integration compares Git contributions without changing refs, the index, or working files.
Without --result, Git computes a proposed merge and may store immutable Git objects.
`;

type ObjectValue = Record<string, unknown>;
type OperationResult = { status: string; exitCode: number; output?: unknown; error?: Pick<ProjectorOperationError, "message" | "observation">; readiness: { status: string; reason?: string } };
export interface PublicCommandRunner {
  execute(request: unknown): Promise<OperationResult>;
}
export interface PublicCommandResult { readonly exitCode: number; readonly output: unknown; readonly text: string }
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === "string" ? value : "";
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function argumentsFor(args: readonly string[]) {
  const values: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const argument = args[i]!;
    if (!argument.startsWith("--")) { values.push(argument); continue; }
    if (["--json", "--access", "--help", "--full", "--representations", "--inspect", "--recover", "--builtin"].includes(argument)) {
      if (flags.has(argument)) throw new Error(`Duplicate option ${argument}`);
      flags.set(argument, ["true"]); continue;
    }
    if (!["--root", "--entity", "--target", "--incoming", "--base", "--result", "--budget", "--context", "--request", "--apply", "--hash", "--scope", "--question-offset", "--timeout-ms", "--assess"].includes(argument)) throw new Error(`Unknown option ${argument}`);
    const value = args[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    const previous = flags.get(argument) ?? [];
    if (previous.length && !["--entity", "--target"].includes(argument)) throw new Error(`Duplicate option ${argument}`);
    flags.set(argument, [...previous, value]);
  }
  return { values, flags, one: (name: string) => flags.get(name)?.[0] };
}

function describeMeaning(value: unknown): string[] {
  const record = object(value);
  const sections = array(object(record.meaning).sections);
  if (sections.length) return sections.map(section => {
    const item = object(section);
    return [string(item.heading), string(item.text)].filter(Boolean).join("\n");
  });
  return unique([string(record.title), string(record.statement), string(record.decision), string(record.rationale), string(record.question), string(record.description)]);
}

function selectorText(value: unknown, depth = 0): string {
  if (depth > 4) return "nested selector";
  const selector = object(value);
  const op = string(selector.op);
  if (op === "atom") return [string(selector.field), string(selector.matcher), string(selector.value)].filter(Boolean).join(" ") || "specified selector";
  if (op === "not") return `not (${selectorText(selector.item, depth + 1)})`;
  if (op === "all" || op === "any") return `${op}(${array(selector.items).map((item) => selectorText(item, depth + 1)).join(", ")})`;
  return "not specified";
}

function evidenceText(value: unknown): string {
  const items = array(value);
  const rendered = items.slice(0, 12).map((raw) => {
    const evidence = object(raw);
    const predicate = object(evidence.applicationPredicate);
    const adapter = object(predicate.adapter);
    const scenario = object(predicate.scenario);
    const binding = string(predicate.kind) === "application-observation"
      ? `; ${string(adapter.id)}@${string(adapter.version)} ${string(scenario.id)}/${string(predicate.case)} ${string(predicate.predicateId)} [${array(predicate.assertionIds).map(string).filter(Boolean).join(", ")}] ${string(predicate.observationRole)}`
      : "";
    return `${string(evidence.evidenceId) || "unnamed evidence"} (${string(evidence.stance) || "unclassified"})${binding}`;
  });
  return `${rendered.join("; ")}${items.length > rendered.length ? `; ${items.length - rendered.length} more` : ""}` || "none";
}

function relationText(value: unknown): string | undefined {
  const relation = object(value);
  const from = string(relation.fromId);
  const to = string(relation.toId);
  const type = string(relation.type);
  if (!from || !to || !type) return undefined;
  return `${from} --${type}--> ${to}${relation.active === false ? " (inactive)" : ""}`;
}

/** Render the few metadata fields whose changes can weaken a rule without changing its prose. */
function reviewMetadata(beforeValue: unknown, afterValue: unknown): string[] {
  const before = object(beforeValue);
  const after = object(afterValue);
  const lines: string[] = [];
  if (JSON.stringify(before.scope) !== JSON.stringify(after.scope) && (before.scope !== undefined || after.scope !== undefined)) {
    lines.push(`Scope:\n- ${before.scope === undefined ? "none" : selectorText(before.scope)}\n+ ${after.scope === undefined ? "none" : selectorText(after.scope)}`);
  }
  if (JSON.stringify(before.evidence) !== JSON.stringify(after.evidence) && (before.evidence !== undefined || after.evidence !== undefined)) {
    lines.push(`Evidence bindings:\n- ${before.evidence === undefined ? "none" : evidenceText(before.evidence)}\n+ ${after.evidence === undefined ? "none" : evidenceText(after.evidence)}`);
  }
  const previousRelation = relationText(before.relation ?? before);
  const nextRelation = relationText(after.relation ?? after);
  if (previousRelation !== nextRelation && (previousRelation !== undefined || nextRelation !== undefined)) {
    lines.push(`Typed relation:\n- ${previousRelation ?? "none"}\n+ ${nextRelation ?? "none"}`);
  }
  return lines;
}

function disclose(value: unknown, label: string): string[] {
  const omitted = object(value).omitted;
  return typeof omitted === "number" && omitted > 0 ? [`${omitted} ${label} omitted. Use inspect or request narrower context before relying on coverage.`] : [];
}

function findings(value: unknown): string[] {
  const record = object(value);
  const lines: string[] = [];
  for (const key of ["reasons", "unknowns", "blockingUnknowns", "questions", "frontier", "requiredExpansionIds"]) {
    for (const item of array(record[key])) {
      if (typeof item === "string") lines.push(item);
      else {
        const finding = object(item);
        lines.push(...unique([string(finding.explanation), string(finding.reason), string(finding.question), string(finding.message)]));
      }
    }
  }
  for (const key of ["unknownDisclosure", "frontierDisclosure", "reasonDisclosure", "obligationDisclosure", "decisionDisclosure", "governanceDisclosure", "applicationEvidenceDisclosure"]) lines.push(...disclose(record[key], key.replace("Disclosure", " findings")));
  for (const item of [...array(record.lensObligations), ...array(record.decisionValidity), ...array(record.governanceEvaluations), ...array(record.evaluations), ...array(record.applicationEvidence)]) {
    const finding = object(item);
    const status = string(finding.status);
    const identity = string(finding.decisionId) || string(finding.lensId) || string(finding.entityId) || string(finding.id);
    lines.push([identity, status, ...findings(finding)].filter(Boolean).join(": "));
  }
  return unique(lines);
}

/** Human output is a view of service results. It never changes acceptance or currentness. */
export function renderPublicResult(command: string, value: unknown): string {
  const result = object(value);
  if (command === "code") return `${JSON.stringify(value, null, 2)}\n`;
  const lines: string[] = [];
  if (command === "context") {
    const navigation = new Map<string, { kinds: string[]; bands: string[]; reasons: string[]; uncertainty: string[] }>();
    lines.push(string(result.request));
    lines.push("Read-only view of accepted records and observed relationships. Candidate interpretations and unknowns require review.");
    lines.push(...describeMeaning(result));
    for (const branchValue of array(result.branches)) {
      const branch = object(branchValue);
      const context = object(branch.context);
      if (branch.hypothesis === true) lines.push(`Candidate interpretation: ${string(object(branch.interpretation).entityId) || string(branch.id)}. Selection does not establish semantic identity.`);
      for (const item of array(context.items)) {
        const record = object(item);
        // Full/raw content is rendered only for an explicit full evidence result.
        lines.push(...describeMeaning(record));
        if (result.view === "full") lines.push(string(record.content));
        const id = string(record.entityId);
        if (id) {
          const prior = navigation.get(id);
          navigation.set(id, {
            kinds: unique([...(prior?.kinds ?? []), string(record.kind)]),
            bands: unique([...(prior?.bands ?? []), string(record.band)]),
            reasons: unique([...(prior?.reasons ?? []), ...array(record.relevanceReasons).map(string)]),
            uncertainty: unique([...(prior?.uncertainty ?? []), ...array(record.uncertainty).map(string)]),
          });
        }
      }
      lines.push(...findings(branch), ...disclose(context.itemsDisclosure, "context items"));
      for (const frontier of unique(array(branch.frontier).map(string))) lines.push(`Unresolved frontier: ${frontier}`);
      lines.push(...disclose(branch.frontierDisclosure, "frontier entries"));
      for (const id of unique(array(context.requiredExpansionIds).map(string))) {
        lines.push(`Required expansion (new current context): projector context ${JSON.stringify(string(result.request))} --entity ${JSON.stringify(id)}`);
      }
      lines.push(...disclose(context.requiredExpansionDisclosure, "required expansions"));
    }
    for (const [id, record] of navigation) {
      const reasons = result.view === "full" ? record.reasons : record.reasons.slice(0, 2);
      lines.push([
        `${id} (${record.kinds.join(", ") || "record"}; ${record.bands.join(", ") || "relevance unspecified"})`,
        ...reasons.map(reason => `Why included: ${reason}`),
        ...(record.reasons.length > reasons.length ? [`${record.reasons.length - reasons.length} additional selection reasons are in the complete retained evidence.`] : []),
        ...record.uncertainty.map(reason => `Uncertainty: ${reason}`),
        `Exact record: projector inspect ${JSON.stringify(id)}`,
      ].join("\n"));
    }
    lines.push(...findings(result), ...disclose(result.branchDisclosure, "branches"), ...disclose(object(result.meaning).disclosure, "meaning sections"));
    const safety = object(result.safety);
    const counters = Object.entries(safety).filter(([,count])=>typeof count === "number" && count > 0).map(([key,count])=>`${key}: ${count}`);
    if (counters.length) lines.push(`Coverage limits: ${counters.join(", ")}`);
    if (result.id) lines.push(`Context: ${result.id}\nComplete retained evidence: projector inspect ${JSON.stringify(result.id)}`);
  } else if (command === "accept-preview") {
    const preview = object(result.preview);
    const review = object(preview.intentReview);
    const proposal = object(preview.proposal);
    lines.push("Review canonical meaning before applying:");
    for (const subject of [...array(review.subjects), ...array(review.canonicalMutations)]) {
      const change = object(subject);
      lines.push(`${string(change.operation)} ${string(change.id)}`);
      const mutation = array(proposal.canonicalMutations).map(object).find(item => object(item.payload).id === change.id);
      const proposedSubject = [...array(proposal.requirements), ...array(proposal.scenarios)].map(object).find(item => object(item.revision).id === change.id || item.key === change.id);
      const proposed = mutation?.payload ?? proposedSubject;
      lines.push(...describeMeaning(proposed));
      lines.push(...reviewMetadata(change.before, change.after ?? proposed));
      lines.push(string(change.rationale));
    }
    for (const relation of array(review.relations).slice(0, 20)) {
      const text = relationText(relation);
      if (text !== undefined) lines.push(`Related typed relation: ${text}`);
    }
    lines.push(...findings(review));
    const obligations = array(review.relatedObligations).map(item => string(object(item).id));
    if (obligations.length) lines.push(`Related obligations: ${obligations.join(", ")}`);
    lines.push(`Change: ${string(result.selector) || string(result.changeSelector)}`);
    lines.push(`Reviewed hash: ${string(result.immutablePlanHash)}`);
    lines.push("Apply only after reviewing this meaning and the affected obligations. Use accept --apply CHANGE --hash HASH.");
  } else if (command === "check" || command === "resume") {
    for (const [key, part] of Object.entries(result)) {
      const item = object(part);
      if (key === "context") { lines.push(renderPublicResult("context", part)); continue; }
      if (!Object.keys(item).length) continue;
      const binding = object(item.validation);
      lines.push(`${key}: ${string(item.status) || string(binding.status) || string(item.outcome) || "inspected"}`);
      lines.push(...findings(item), ...findings(binding));
      for (const branch of array(item.branches)) lines.push(...findings(branch));
      for (const field of ["continuation", "recovery", "nextAction", "decisionValidity", "governance", "impact"]) {
        const detail = object(item[field]);
        lines.push(...unique([string(detail.status), string(detail.reason), string(detail.action), ...findings(detail)]));
      }
    }
    if (command === "resume") lines.push("Inspection only. No changes applied and no authority renewed.");
  } else if (command === "audit") {
    const completion = object(result.completion);
    const binding = object(result.bindingValidation);
    const disclosure = object(completion.questionDisclosure);
    const page = object(completion.questionPage);
    lines.push("Read-only audit: source and canonical records are unchanged. Operational observation artifacts may be created.");
    lines.push(`Evidence: ${string(result.proofStatement) || "not established"}; binding ${string(binding.status) || "unknown"}.`);
    if (result.continuation !== undefined) {
      const continuation = object(result.continuation);
      const context = object(continuation.context);
      const lifecycle = object(continuation.lifecycle);
      if (string(context.contextId)) lines.push(`Retained context ${context.contextId}: ${string(context.status) || "unknown"}; governance ${string(context.governance) || "unknown"}.`);
      if (string(lifecycle.changeSelector)) lines.push(`Retained change ${lifecycle.changeSelector}: ${string(lifecycle.status) || "unknown"}; plan ${string(lifecycle.planFreshness) || "unknown"}${string(lifecycle.approvalSelector) ? `; approval ${lifecycle.approvalSelector}` : ""}.`);
      if (string(continuation.reason)) lines.push(`Continuation: ${continuation.reason}`);
      for (const raw of array(continuation.evidence)) {
        const evidence = object(raw);
        lines.push(`Retained evidence ${string(evidence.id) || "unspecified"}: ${string(evidence.status) || "unknown"}; ${string(evidence.availability) || "availability unknown"}${string(evidence.reason) ? ` -- ${evidence.reason}` : ""}`);
      }
      const evidencePage = object(continuation.page);
      if (typeof evidencePage.omitted === "number" && evidencePage.omitted > 0) lines.push(`Retained evidence: ${evidencePage.omitted} omitted${typeof evidencePage.nextOffset === "number" ? `; next offset ${evidencePage.nextOffset}` : ""}.`);
      const advisory = object(continuation.advisoryNotes);
      if (string(advisory.reason)) lines.push(`Advisory evidence (${string(advisory.status) || "unknown"}): ${advisory.reason}`);
      for (const limit of array(continuation.limits).map(string).filter(Boolean)) lines.push(`Continuation limit: ${limit}`);
      const next = object(continuation.nextAction);
      if (string(next.operation)) lines.push(`Next supported operation: ${next.operation}; input ${JSON.stringify(next.input ?? {})}`);
    }
    for (const laneValue of array(result.lanes)) {
      const lane = object(laneValue);
      const ratio = typeof lane.numerator === "number" && typeof lane.denominator === "number" ? ` ${lane.numerator}/${lane.denominator}` : "";
      lines.push(`Evidence ${string(lane.key) || "unnamed"}: ${string(lane.observability) || "unknown"}${ratio}`);
      for (const blindSpot of array(lane.blindSpots).map(string).filter(Boolean)) lines.push(`Unresolved coverage: ${blindSpot}`);
    }
    const analysis = object(result.localAnalysis);
    const realizations = object(analysis.realizations);
    lines.push(`Observed files: ${analysis.artifactCount ?? "unknown"}; projection units: ${analysis.projectionUnitCount ?? "unknown"}; matched realizations: ${realizations.matched ?? "unknown"}, unmatched: ${realizations.unmatched ?? "unknown"}, unsupported: ${realizations.unsupported ?? "unknown"}, unavailable: ${realizations.unavailable ?? "unknown"}.`);
    for (const surface of array(result.unavailableSurfaceIds).map(string).filter(Boolean)) lines.push(`Unsupported or unavailable surface: ${surface}`);
    for (const failureValue of array(analysis.analyzerFailures)) {
      const failure = object(failureValue);
      lines.push(`Observation unavailable: ${string(failure.title) || string(failure.code) || "analyzer failure"}${string(failure.message) ? ` -- ${string(failure.message)}` : ""}`);
    }
    for (const limit of array(completion.limits).map(string).filter(Boolean)) lines.push(`Coverage limit: ${limit}`);
    lines.push(`Application evidence: ${string(object(result.applicationEvidence).status) || "unknown"}.`);
    const questions = array(completion.questions);
    lines.push(`Questions: ${questions.length} shown; ${typeof disclosure.total === "number" ? disclosure.total : questions.length} total, ${typeof disclosure.omitted === "number" ? disclosure.omitted : 0} omitted${page.nextOffset === null || page.nextOffset === undefined ? "" : `; next offset ${page.nextOffset}`}.`);
    for (const raw of questions) {
      const question = object(raw);
      const assessment = object(question.assessment);
      lines.push(`${question.blocking === true ? "Blocking" : "Open"} ${string(question.kind) || "question"}${string(assessment.status) ? ` (${assessment.status}${string(assessment.category) ? `: ${assessment.category}` : ""})` : ""}: ${string(question.question)}`);
      if (array(question.ownerIds).length) lines.push(`Owners: ${array(question.ownerIds).map(string).join(", ")}`);
      for (const reason of array(question.reasons).map(string).filter(Boolean)) lines.push(`Evidence: ${reason}`);
      const resolution = object(question.resolution);
      if (string(resolution.route)) lines.push(`Repair route: ${string(resolution.route)}`);
      for (const alternativeValue of array(resolution.alternatives)) {
        const alternative = object(alternativeValue);
        const capabilities = array(alternative.capabilityIds).map(string).filter(Boolean);
        lines.push(`Repair option: ${string(alternative.strategy) || "unspecified"} (${string(alternative.status) || "unknown"})${string(alternative.reason) ? ` -- ${string(alternative.reason)}` : ""}${capabilities.length ? `; capabilities: ${capabilities.join(", ")}` : ""}`);
      }
      if (string(resolution.instruction)) lines.push(`Next: ${string(resolution.instruction)}`);
    }
    for (const item of array(completion.repairPlan)) {
      const repair = object(item);
      const resolution = object(repair.resolution);
      lines.push(`Repair plan ${string(repair.order)}: ${string(repair.questionId)} via ${string(resolution.route) || "route unspecified"}`);
      for (const alternativeValue of array(resolution.alternatives)) {
        const alternative = object(alternativeValue);
        lines.push(`Repair option: ${string(alternative.strategy) || "unspecified"} (${string(alternative.status) || "unknown"})${string(alternative.reason) ? ` -- ${string(alternative.reason)}` : ""}`);
      }
    }
    lines.push("Supported next actions: inspect a named record, retrieve focused context, use an available repair route, or rerun audit after changes.");
  } else if (command === "recover" && Array.isArray(value)) {
    for (const raw of value) {
      const publication = object(raw);
      lines.push(`${string(publication.publicationId)}: ${string(publication.status)}; capture ${string(publication.captureStatus)}${string(publication.reason) ? ` -- ${publication.reason}` : ""}`);
    }
    if (!value.length) lines.push("No representation publication needs recovery.");
  } else if (command === "evaluate") {
    const evaluation = object(result.evaluation);
    lines.push(`Architecture evaluation: ${string(evaluation.outcome) || "observed"}; acceptance ${result.acceptanceBlocked === true ? "blocked" : "requires its normal authority"}.`);
    lines.push(...findings(evaluation));
    for (const key of ["recommendation", "rationale", "summary"]) if (typeof evaluation[key] === "string") lines.push(`${key}: ${evaluation[key]}`);
    lines.push(...array(result.preferenceConflicts).map(string));
    lines.push("This evaluation does not authorize canonical mutation. Use --json for the complete tradeoff matrix and evidence.");
  } else if (command === "integration") {
    lines.push(`Git integration: ${string(result.status) || "unknown"}.`);
    lines.push(`Base: ${string(result.baseCommit)}; target: ${string(result.targetCommit)}; incoming: ${string(result.incomingCommit)}.`);
    if (string(result.resultTree)) lines.push(`Result tree: ${string(result.resultTree)} (${string(result.resultSource)}).`);
    for (const path of array(result.conflictPaths).map(string)) lines.push(`Git conflict: ${path}`);
    const contributions = [...array(result.contributions).map(object), ...array(result.codeContributions).map(object)];
    const retained = contributions.filter(item => item.status === "preserved");
    const unresolved = contributions.filter(item => item.status !== "preserved");
    lines.push(`Contributions: ${retained.length} preserved; ${unresolved.length} require resolution or review.`);
    // Put unresolved work first and disclose any omitted detail in the human view.
    const ordered = [...unresolved, ...retained];
    for (const item of ordered.slice(0, 24)) lines.push(`${string(item.side)} ${string(item.entityId) || string(item.path)}: ${string(item.status)}${string(item.change) ? ` (${string(item.change)})` : ""}.`);
    if (ordered.length > 24) lines.push(`${ordered.length - 24} contribution details omitted. Use --json for the complete assessment.`);
    const validation = object(result.canonicalValidation);
    lines.push(`Canonical checks (${string(validation.scope) || "record integrity only"}): ${string(validation.status) || "not assessed"}.`);
    for (const issue of array(validation.issues).map(string)) lines.push(issue);
    const governance = object(result.staticGovernanceValidation);
    if (string(governance.status)) {
      lines.push(`Static governance: ${string(governance.status)}.`);
      for (const issue of array(governance.issues).map(string)) lines.push(issue);
    }
    const additionalPaths = array(result.resultOnlyPaths).map(string);
    const reconciliation = object(result.resultReconciliation);
    if (string(reconciliation.status)) {
      const queries = array(reconciliation.consumerQueries).map(object);
      const newConsumers = [...new Set(queries.flatMap(query => array(query.newlyRelevantConsumers).map(string)))];
      lines.push(`Result reconciliation: ${string(reconciliation.status)}; ${queries.length} static consumer queries recomputed; ${newConsumers.length} newly relevant consumers.`);
      for (const path of newConsumers.slice(0, 24)) lines.push(`Newly relevant consumer: ${path}`);
      if (newConsumers.length > 24) lines.push(`${newConsumers.length - 24} consumer details omitted. Use --json for complete populations.`);
      for (const issue of array(reconciliation.contradictions).map(string)) lines.push(`Result contradiction: ${issue}`);
      for (const unknown of array(reconciliation.unknowns).map(string)) lines.push(`Result uncertainty: ${unknown}`);
      lines.push("Source and static population findings do not establish behavioral equivalence; behavioral evidence is not reusable from this assessment.");
    }
    if (additionalPaths.length) lines.push(`Additional result changes: ${additionalPaths.slice(0, 24).join(", ")}${additionalPaths.length > 24 ? `; ${additionalPaths.length - 24} omitted, use --json` : ""}.`);
    for (const gap of array(result.verificationGaps).map(string)) lines.push(`Still required: ${gap}`);
    lines.push("This assessment does not authorize a merge or establish completed behavioral verification or independent review. Use --json for exact input identities and all findings.");
  } else if (command === "verify" || command === "generate") {
    const nestedCheck = object(result.check);
    const inspection = result.inspection === undefined ? result : object(result.inspection);
    const generated = command === "generate";
    lines.push(`${generated ? "Generated output" : "Verification"} evidence: ${string(result.status) || string(nestedCheck.status) || "historical observations"}`);
    if (result.id !== undefined) lines.push(`id: ${result.id}`);
    const checks = generated ? (result.check === undefined ? [] : [nestedCheck]) : [...array(inspection.records).map(object), ...(typeof result.status === "string" ? [result] : [])];
    for (const check of checks) {
      lines.push(`${string(check.id)}: ${check.current === true ? "current" : string(check.status) || "not current"}${string(check.reason) ? ` -- ${check.reason}` : ""}`);
      if (string(check.error)) lines.push(string(check.error));
      if (check.exitCode !== undefined && check.exitCode !== null) lines.push(`Exit code: ${check.exitCode}`);
    }
    for (const record of (generated ? array(inspection.records).map(object) : [])) {
      lines.push(`${string(object(record.evidence).id)}: ${record.current === true ? "current" : "not current"} -- ${string(record.reason)}`);
      for (const output of array(record.outputs).map(object)) lines.push(`${string(output.path)} (${string(output.ownership)}): ${string(output.disposition)}; ${string(output.observation)}`);
    }
    const builtin = result.profile === "projector-closed-static/v1" || result.scope === "projector.canonical-integrity/v1" || inspection.scope === "projector.canonical-integrity/v1" || array(inspection.records).some(record => object(record).profile === "projector-closed-static/v1");
    if (builtin) {
      lines.push(`Built-in canonical/static check only: projector.canonical-integrity/v1${result.bindingStatus === undefined ? "" : `; ${string(result.bindingStatus)}`}${result.reusable === undefined ? "" : `; reusable: ${result.reusable === true ? "yes" : "no"}`}.`);
      if (typeof result.targetTree === "string") lines.push(`Assessed target tree: ${result.targetTree}`);
      lines.push(...array(result.reasons).map(string));
      lines.push("This evidence does not authorize integration or mutation and does not establish runtime behavior or independent whole-result review. Use --json for complete retained inputs and artifacts.");
    } else lines.push("Native evidence is a historical observation, not proof of reusable success, complete dependencies, or exclusive causation. Use --json for complete records.");
    const recoveryCommand = generated ? "generate --recover producers.json" : builtin ? "verify --builtin --recover" : "verify --recover";
    for (const pending of array(inspection.pendingPublications).map(object)) lines.push(`Pending publication ${string(pending.artifactSetId)}: ${string(pending.state)}; ${pending.recoverable === true ? `explicit ${recoveryCommand} can complete retained evidence without executing the command again` : "no complete result is available; inspect the retained execution and intent before taking further action"}.`);
    const recovered = array(result.recoveredArtifactSetIds).map(string);
    if (recovered.length) lines.push(`Recovered publication: ${recovered.join(", ")}. Checks were not executed again.`);
    lines.push(...findings(result));
  } else {
    lines.push(`${command}: ${string(result.outcome) || string(result.status) || string(object(result.readiness).status) || "completed"}`);
    lines.push(...describeMeaning(result), ...findings(result));
    for (const key of ["selector", "approvalSelector", "receiptId", "reason"]) if (typeof result[key] === "string") lines.push(`${key}: ${result[key]}`);
  }
  return unique(lines).join("\n\n") + "\n";
}

export async function runPublicCommand(args: readonly string[], input: { runner: PublicCommandRunner; cwd: string }): Promise<PublicCommandResult> {
  const { values, flags, one } = argumentsFor(args);
  const command = values.shift();
  if (command === undefined || command === "help" || flags.has("--help")) return { exitCode: 0, output: { help: publicCommandHelp }, text: publicCommandHelp };
  const repositoryRoot = resolve(input.cwd, one("--root") ?? ".");
  const allowed: Record<string,string[]> = { init: [], context: ["--entity","--target","--budget","--full"], check: [], integration: ["--target","--incoming","--base","--result"], audit: ["--scope","--context","--question-offset"], accept: ["--context","--request","--apply","--hash"], resume: [], inspect: ["--representations"], recover: ["--access","--representations"], verify: ["--inspect","--recover","--builtin","--assess","--target"], generate: ["--inspect","--recover"], evaluate: [], code: [] };
  if (!(command in allowed)) throw new Error(`Unknown command ${command}. Use --help.`);
  for (const flag of flags.keys()) if (!["--root","--json","--help","--timeout-ms",...allowed[command]!].includes(flag)) throw new Error(`${flag} does not apply to ${command}`);
  const timeoutMs = one("--timeout-ms") === undefined ? undefined : Number(one("--timeout-ms"));
  if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)) throw new Error("--timeout-ms requires a positive safe integer in milliseconds");
  const call = async (operation: ProjectorOperation, requestInput: unknown) => {
    const result = await input.runner.execute({ apiVersion: "projector.operation/v1", operation, repositoryRoot, input: requestInput, ...(timeoutMs === undefined ? {} : { observationLimits: { timeoutMs } }) });
    if (result.status !== "succeeded") {
      const observation = result.error?.observation;
      const detail = observation === undefined ? "" : ` (${observation.stage} at ${observation.scope}${observation.limit === undefined ? "" : `; ${observation.limit}${observation.observed === undefined ? "" : ` observed ${observation.observed}`}`})`;
      throw new Error(`${operation}: ${result.error?.message ?? result.readiness.reason ?? result.status}${detail}`);
    }
    return result.output;
  };
  const exactValues = (count: number) => { if (values.length !== count) throw new Error(`${command} requires ${count} argument${count === 1 ? "" : "s"}. Use --help.`); };
  const jsonInput = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(input.cwd, path), "utf8"));
  let output: unknown;
  let view = command;
  if (command === "code") {
    const action = values.shift();
    const operations = {
      query: "code.query", index: "code.index", status: "code.index-status", wait: "code.index-wait", cancel: "code.index-cancel",
      impact: "code.impact", tests: "code.tests", "test-run": "code.test-run", evidence: "code.evidence", export: "code.export",
    } as const;
    if (action === undefined || !(action in operations)) throw new Error("code requires query, index, status, wait, cancel, impact, tests, test-run, evidence or export. Use --help.");
    const operation = operations[action as keyof typeof operations];
    let request: unknown;
    if (action === "status") {
      if (values.length > 1) throw new Error("code status accepts at most one run ID");
      request = values[0] === undefined ? {} : { runId: values[0] };
    } else if (action === "wait" || action === "cancel") {
      exactValues(1);
      request = { runId: values[0] };
    } else {
      exactValues(1);
      request = await jsonInput(values[0]!);
    }
    output = await call(operation as ProjectorOperation, ProjectorOperationInputSchemas[operation].parse(request));
    if (action === "index" && ["failed", "cancelled", "interrupted"].includes(string(object(output).state))) {
      return { exitCode: 6, output, text: flags.has("--json") ? `${JSON.stringify(output, null, 2)}\n` : renderPublicResult("code", output) };
    }
  } else if (command === "init") { exactValues(0); output = await call("init", {}); }
  else if (command === "context") {
    if (!values.length) throw new Error("context requires a task description");
    const budget = one("--budget") === undefined ? undefined : Number(one("--budget"));
    if (budget !== undefined && (!Number.isSafeInteger(budget) || budget <= 0)) throw new Error("--budget requires a positive character count");
    output = await call("context", { request: values.join(" "), persist: true, ...(flags.has("--full") ? { view: "full" } : {}), ...(flags.has("--entity") ? { entities: flags.get("--entity") } : {}), ...(flags.has("--target") ? { namedTargets: flags.get("--target") } : {}), ...(budget === undefined ? {} : { policy: { maxContextCost: budget } }) });
  } else if (command === "check") {
    if (values.length > 1) throw new Error("check accepts at most one retained context");
    output = { repository: await call("repository.check", { mode: "full" }), ...(values[0] === undefined ? {} : { meaning: await call("reconcile", { contextId: values[0] }) }) };
  } else if (command === "integration") {
    exactValues(0);
    if (flags.get("--target")?.length !== 1 || one("--incoming") === undefined) throw new Error("integration requires one --target REF and one --incoming REF");
    output = await call("repository.integration", {
      target: one("--target"), incoming: one("--incoming"),
      ...(one("--base") === undefined ? {} : { base: one("--base") }),
      ...(one("--result") === undefined ? {} : { result: one("--result") }),
    });
    const report = object(output);
    if (report.status === "conflicted" || report.status === "invalid" || ["failed", "incomplete"].includes(string(object(report.staticGovernanceValidation).status))
      || ["failed", "incomplete"].includes(string(object(report.resultReconciliation).status))
      || [...array(report.contributions), ...array(report.codeContributions)].some(item => ["lost", "altered"].includes(string(object(item).status)))) {
      return { exitCode: 6, output, text: flags.has("--json") ? `${JSON.stringify(output, null, 2)}\n` : renderPublicResult(command, output) };
    }
  } else if (command === "audit") {
    exactValues(0);
    const absoluteScope = resolve(repositoryRoot, one("--scope") ?? ".");
    const relativeScope = relative(repositoryRoot, absoluteScope);
    if (relativeScope === ".." || relativeScope.startsWith(`..${sep}`) || isAbsolute(relativeScope)) throw new Error("--scope must stay within the selected repository root");
    const questionOffset = one("--question-offset") === undefined ? 0 : Number(one("--question-offset"));
    if (!Number.isSafeInteger(questionOffset) || questionOffset < 0) throw new Error("--question-offset requires a nonnegative safe integer");
    output = await call("cleanup", { scope: relativeScope ? relativeScope.split(sep).join("/") : ".", questionOffset, ...(one("--context") === undefined ? {} : { contextId: one("--context") }) });
  } else if (command === "accept") {
    if (one("--apply") !== undefined) {
      exactValues(0);
      if (one("--hash") === undefined || one("--context") !== undefined || one("--request") !== undefined) throw new Error("accept --apply requires --hash and no proposal options");
      const approval = object(await call("change.approve", { changeSelector: one("--apply"), planHash: one("--hash") }));
      output = await call("change.apply", { approvalSelector: approval.selector });
      if (object(output).outcome !== "succeeded" && object(output).outcome !== "success") return { exitCode: 6, output, text: renderPublicResult(command, output) };
    } else {
      exactValues(1);
      if (one("--hash") !== undefined) throw new Error("--hash requires --apply");
      const parsedProposal = ChangeProposalSchema.safeParse(JSON.parse(await readFile(resolve(input.cwd, values[0]!), "utf8")));
      if (!parsedProposal.success) {
        const issues = parsedProposal.error.issues;
        const detail = z.prettifyError(new z.ZodError(issues.slice(0, 8)));
        throw new Error(`Invalid change proposal:\n${detail.slice(0, 8000)}${issues.length > 8 || detail.length > 8000 ? "\nMore schema issues omitted. Fix these and retry." : ""}`);
      }
      const proposal = parsedProposal.data;
      const capture = object(await call("change.capture", { request: one("--request") ?? "Accept the proposed canonical meaning", proposal, ...(one("--context") === undefined ? {} : { contextId: one("--context") }) }));
      output = await call("change.plan", { changeSelector: capture.selector });
      view = "accept-preview";
    }
  } else if (command === "resume") {
    exactValues(1);
    const anchor = values[0]!;
    const key = anchor.startsWith("knowledge_context_") ? "contextId" : anchor.startsWith("semantic_change_") ? "changeSelector" : anchor.startsWith("lifecycle_approval_") ? "approvalSelector" : undefined;
    if (key === undefined) throw new Error("resume requires an actual retained context, change or approval ID; it never guesses latest");
    const continuation = await call("cleanup", { [key]: anchor, evidenceLimit: 5 });
    const restoration = object(object(object(continuation).continuation).restoration);
    output = { continuation, ...(restoration.meaning === undefined ? {} : { meaning: restoration.meaning }), ...(restoration.context === undefined ? {} : { context: restoration.context }) };
  } else if (command === "evaluate") {
    exactValues(1);
    output = await call("architecture.evaluate", await jsonInput(values[0]!));
  } else if (command === "verify" || command === "generate") {
    if (flags.has("--inspect") && flags.has("--recover")) throw new Error("Select one evidence action: --inspect or --recover");
    const inspecting = flags.has("--inspect"), recovering = flags.has("--recover");
    if (command === "verify") {
      if (flags.has("--builtin")) {
        exactValues(0);
        if (inspecting || recovering) {
          if (flags.has("--target") || flags.has("--assess")) throw new Error("Built-in inspection/recovery does not accept a target or assessment event");
          output = await call("verification.builtin", { command: { action: inspecting ? "inspect" : "recover" } });
        } else {
          if (flags.get("--target")?.length !== 1) throw new Error("Built-in verification requires one explicit --target REF");
          output = await call("verification.builtin", { command: flags.has("--assess") ? { action: "assess", eventId: one("--assess"), target: one("--target") } : { action: "execute", request: { check: "projector.canonical-integrity/v1", target: one("--target") } } });
        }
      } else if (flags.has("--assess") || flags.has("--target")) throw new Error("--assess and --target require --builtin for verification");
      else if (inspecting) {
        if (values.length > 1) throw new Error("verify --inspect accepts at most one execution event ID");
        output = await call("verification.inspect", values[0] === undefined ? {} : { eventIds: [values[0]] });
      } else if (recovering) {
        exactValues(0); output = await call("verification.recover", {});
      } else {
        exactValues(1); output = await call("verification.execute", await jsonInput(values[0]!));
      }
    } else {
      exactValues(1);
      const request = await jsonInput(values[0]!);
      output = await call(inspecting ? "generated.inspect" : recovering ? "generated.recover" : "generated.execute", inspecting || recovering ? request : { generation: request });
    }
    const result = object(output);
    const failedExecution = !inspecting && !recovering && (flags.has("--assess") ? result.reusable !== true : (command === "verify" ? result.status : object(result.check).status) !== "passed");
    if (failedExecution || (recovering && array(object(result.inspection).pendingPublications).length > 0)) {
      return { exitCode: 6, output, text: flags.has("--json") ? `${JSON.stringify(output, null, 2)}\n` : renderPublicResult(command, output) };
    }
  } else if (command === "inspect") {
    if (flags.has("--representations")) { exactValues(0); output = await call("representation.pending", {}); }
    else {
    exactValues(1);
    const anchor = values[0]!;
    if (anchor.startsWith("knowledge_context_")) output = await (await RepositoryKnowledgeService.create(repositoryRoot)).read(anchor);
    else if (anchor.startsWith("semantic_change_")) output = await call("representation.inspect", { changeSelector: anchor, view: "content" });
    else if (anchor.startsWith("lifecycle_approval_")) output = await call("cleanup", { approvalSelector: anchor, evidenceLimit: 50 });
    else {
      const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot();
      output = snapshot.documents.find(document => document.id === anchor);
      if (output === undefined) throw new Error(`No canonical record has ID ${anchor}`);
    }
    }
  } else {
    if (flags.has("--access") && flags.has("--representations")) throw new Error("Select one recovery route: approval, --access, or --representations");
    if (flags.has("--access")) { exactValues(0); output = await call("operation-access.recover", {}); }
    else if (flags.has("--representations")) {
      exactValues(0); output = await call("representation.recover", {});
      if (array(output).some(item => object(item).status === "recovery-required")) return { exitCode: 6, output, text: flags.has("--json") ? `${JSON.stringify(output, null, 2)}\n` : renderPublicResult(command, output) };
    }
    else { exactValues(1); output = await call("change.recover", { approvalSelector: values[0] }); }
  }
  return { exitCode: 0, output, text: flags.has("--json") || command === "inspect" ? `${JSON.stringify(output, null, 2)}\n` : renderPublicResult(view, output) };
}
