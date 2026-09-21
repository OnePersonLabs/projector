import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ChangeProposalSchema, type ProjectorOperation } from "@projector/core";
import { RepositoryKnowledgeService, projectKnowledgeContext } from "@projector/control-plane";
import { CanonicalFileRepository } from "@projector/runtime";
import { z } from "zod";

export const publicCommandHelp = `Projector: retrieve meaning, change with Codex, check consequences.

  projector init
  projector context "task" [--entity ID] [--target path] [--budget characters]
  projector check [CONTEXT]
  projector accept proposal.json [--context CONTEXT] [--request "reason"]
  projector accept --apply CHANGE --hash HASH
  projector resume CONTEXT|CHANGE|APPROVAL
  projector inspect ID
  projector recover APPROVAL | --access

Use --root PATH for another repository, --json for exact machine results.
Accept first previews a canonical change. Apply names that exact reviewed plan.
Resume only inspects and restores authenticated context. Recovery never applies.
`;

type ObjectValue = Record<string, unknown>;
type OperationResult = { status: string; exitCode: number; output?: unknown; error?: { message: string }; readiness: { status: string; reason?: string } };
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
    if (["--json", "--access", "--help"].includes(argument)) {
      if (flags.has(argument)) throw new Error(`Duplicate option ${argument}`);
      flags.set(argument, ["true"]); continue;
    }
    if (!["--root", "--entity", "--target", "--budget", "--context", "--request", "--apply", "--hash"].includes(argument)) throw new Error(`Unknown option ${argument}`);
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
  const lines: string[] = [];
  if (command === "context") {
    lines.push(string(result.request));
    lines.push(...describeMeaning(result));
    for (const branchValue of array(result.branches)) {
      const branch = object(branchValue);
      const context = object(branch.context);
      for (const item of array(context.items)) {
        const record = object(item);
        // Full/raw content is rendered only for an explicit full evidence result.
        lines.push(...describeMeaning(record));
        if (result.view === "full") lines.push(string(record.content));
      }
      lines.push(...findings(branch), ...disclose(context.itemsDisclosure, "context items"));
    }
    lines.push(...findings(result), ...disclose(result.branchDisclosure, "branches"), ...disclose(object(result.meaning).disclosure, "meaning sections"));
    const safety = object(result.safety);
    const counters = Object.entries(safety).filter(([,count])=>typeof count === "number" && count > 0).map(([key,count])=>`${key}: ${count}`);
    if (counters.length) lines.push(`Coverage limits: ${counters.join(", ")}`);
    if (result.id) lines.push(`Context: ${result.id}`);
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
  const allowed: Record<string,string[]> = { init: [], context: ["--entity","--target","--budget"], check: [], accept: ["--context","--request","--apply","--hash"], resume: [], inspect: [], recover: ["--access"] };
  if (!(command in allowed)) throw new Error(`Unknown command ${command}. Use --help.`);
  for (const flag of flags.keys()) if (!["--root","--json","--help",...allowed[command]!].includes(flag)) throw new Error(`${flag} does not apply to ${command}`);
  const call = async (operation: ProjectorOperation, requestInput: unknown) => {
    const result = await input.runner.execute({ apiVersion: "projector.operation/v1", operation, repositoryRoot, input: requestInput });
    if (result.status !== "succeeded") throw new Error(`${operation}: ${result.error?.message ?? result.readiness.reason ?? result.status}`);
    return result.output;
  };
  const exactValues = (count: number) => { if (values.length !== count) throw new Error(`${command} requires ${count} argument${count === 1 ? "" : "s"}. Use --help.`); };
  let output: unknown;
  let view = command;
  if (command === "init") { exactValues(0); output = await call("init", {}); }
  else if (command === "context") {
    if (!values.length) throw new Error("context requires a task description");
    const budget = one("--budget") === undefined ? undefined : Number(one("--budget"));
    if (budget !== undefined && (!Number.isSafeInteger(budget) || budget <= 0)) throw new Error("--budget requires a positive character count");
    output = await call("context", { request: values.join(" "), persist: true, ...(flags.has("--entity") ? { entities: flags.get("--entity") } : {}), ...(flags.has("--target") ? { namedTargets: flags.get("--target") } : {}), ...(budget === undefined ? {} : { policy: { maxContextCost: budget } }) });
  } else if (command === "check") {
    if (values.length > 1) throw new Error("check accepts at most one retained context");
    output = { repository: await call("repository.check", { mode: "full" }), ...(values[0] === undefined ? {} : { meaning: await call("reconcile", { contextId: values[0] }) }) };
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
    if (key === "contextId") {
      const meaning = await call("reconcile", { contextId: anchor });
      const retained = await (await RepositoryKnowledgeService.create(repositoryRoot)).read(anchor);
      const status = string(object(meaning).status) || string(object(object(meaning).validation).status);
      output = { continuation, meaning, ...(["current", "rebound"].includes(status) ? { context: projectKnowledgeContext(retained) } : {}) };
    } else output = { continuation };
  } else if (command === "inspect") {
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
  } else {
    if (flags.has("--access")) { exactValues(0); output = await call("operation-access.recover", {}); }
    else { exactValues(1); output = await call("change.recover", { approvalSelector: values[0] }); }
  }
  return { exitCode: 0, output, text: flags.has("--json") || command === "inspect" ? `${JSON.stringify(output, null, 2)}\n` : renderPublicResult(view, output) };
}
