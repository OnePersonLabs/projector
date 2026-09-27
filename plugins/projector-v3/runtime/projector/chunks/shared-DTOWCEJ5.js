import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  RepositoryKnowledgeService
} from "./shared-7TU7H6FV.js";
import {
  CanonicalFileRepository
} from "./shared-3WNQLUKU.js";
import {
  ChangeProposalSchema,
  external_exports
} from "./shared-6VIFAIKJ.js";

// dist/public-command.js
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
var publicCommandHelp = `Projector: retrieve meaning, change with Codex, check consequences.

  projector init
  projector context "task" [--entity ID] [--target path] [--budget characters]
  projector check [CONTEXT]
  projector audit [--scope PATH] [--context CONTEXT] [--question-offset N] [--json]
  projector accept proposal.json [--context CONTEXT] [--request "reason"]
  projector accept --apply CHANGE --hash HASH
  projector resume CONTEXT|CHANGE|APPROVAL
  projector inspect ID
  projector recover APPROVAL | --access

Use --root PATH for another repository, --json for exact machine results.
Use --timeout-ms N for a bounded observation timeout per operation (default 60000).
Accept first previews a canonical change. Apply names that exact reviewed plan.
Resume only inspects and restores authenticated context. Recovery never applies.
Audit observes bounded repository evidence and proposes repair routes. It never applies repairs.
`;
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
var array = (value) => Array.isArray(value) ? value : [];
var string = (value) => typeof value === "string" ? value : "";
var unique = (values) => [...new Set(values.filter(Boolean))];
function argumentsFor(args) {
  const values = [];
  const flags = /* @__PURE__ */ new Map();
  for (let i = 0; i < args.length; i++) {
    const argument = args[i];
    if (!argument.startsWith("--")) {
      values.push(argument);
      continue;
    }
    if (["--json", "--access", "--help"].includes(argument)) {
      if (flags.has(argument))
        throw new Error(`Duplicate option ${argument}`);
      flags.set(argument, ["true"]);
      continue;
    }
    if (!["--root", "--entity", "--target", "--budget", "--context", "--request", "--apply", "--hash", "--scope", "--question-offset", "--timeout-ms"].includes(argument))
      throw new Error(`Unknown option ${argument}`);
    const value = args[++i];
    if (value === void 0 || value.startsWith("--"))
      throw new Error(`${argument} requires a value`);
    const previous = flags.get(argument) ?? [];
    if (previous.length && !["--entity", "--target"].includes(argument))
      throw new Error(`Duplicate option ${argument}`);
    flags.set(argument, [...previous, value]);
  }
  return { values, flags, one: (name) => flags.get(name)?.[0] };
}
function describeMeaning(value) {
  const record = object(value);
  const sections = array(object(record.meaning).sections);
  if (sections.length)
    return sections.map((section) => {
      const item = object(section);
      return [string(item.heading), string(item.text)].filter(Boolean).join("\n");
    });
  return unique([string(record.title), string(record.statement), string(record.decision), string(record.rationale), string(record.question), string(record.description)]);
}
function selectorText(value, depth = 0) {
  if (depth > 4)
    return "nested selector";
  const selector = object(value);
  const op = string(selector.op);
  if (op === "atom")
    return [string(selector.field), string(selector.matcher), string(selector.value)].filter(Boolean).join(" ") || "specified selector";
  if (op === "not")
    return `not (${selectorText(selector.item, depth + 1)})`;
  if (op === "all" || op === "any")
    return `${op}(${array(selector.items).map((item) => selectorText(item, depth + 1)).join(", ")})`;
  return "not specified";
}
function evidenceText(value) {
  const items = array(value);
  const rendered = items.slice(0, 12).map((raw) => {
    const evidence = object(raw);
    const predicate = object(evidence.applicationPredicate);
    const adapter = object(predicate.adapter);
    const scenario = object(predicate.scenario);
    const binding = string(predicate.kind) === "application-observation" ? `; ${string(adapter.id)}@${string(adapter.version)} ${string(scenario.id)}/${string(predicate.case)} ${string(predicate.predicateId)} [${array(predicate.assertionIds).map(string).filter(Boolean).join(", ")}] ${string(predicate.observationRole)}` : "";
    return `${string(evidence.evidenceId) || "unnamed evidence"} (${string(evidence.stance) || "unclassified"})${binding}`;
  });
  return `${rendered.join("; ")}${items.length > rendered.length ? `; ${items.length - rendered.length} more` : ""}` || "none";
}
function relationText(value) {
  const relation = object(value);
  const from = string(relation.fromId);
  const to = string(relation.toId);
  const type = string(relation.type);
  if (!from || !to || !type)
    return void 0;
  return `${from} --${type}--> ${to}${relation.active === false ? " (inactive)" : ""}`;
}
function reviewMetadata(beforeValue, afterValue) {
  const before = object(beforeValue);
  const after = object(afterValue);
  const lines = [];
  if (JSON.stringify(before.scope) !== JSON.stringify(after.scope) && (before.scope !== void 0 || after.scope !== void 0)) {
    lines.push(`Scope:
- ${before.scope === void 0 ? "none" : selectorText(before.scope)}
+ ${after.scope === void 0 ? "none" : selectorText(after.scope)}`);
  }
  if (JSON.stringify(before.evidence) !== JSON.stringify(after.evidence) && (before.evidence !== void 0 || after.evidence !== void 0)) {
    lines.push(`Evidence bindings:
- ${before.evidence === void 0 ? "none" : evidenceText(before.evidence)}
+ ${after.evidence === void 0 ? "none" : evidenceText(after.evidence)}`);
  }
  const previousRelation = relationText(before.relation ?? before);
  const nextRelation = relationText(after.relation ?? after);
  if (previousRelation !== nextRelation && (previousRelation !== void 0 || nextRelation !== void 0)) {
    lines.push(`Typed relation:
- ${previousRelation ?? "none"}
+ ${nextRelation ?? "none"}`);
  }
  return lines;
}
function disclose(value, label) {
  const omitted = object(value).omitted;
  return typeof omitted === "number" && omitted > 0 ? [`${omitted} ${label} omitted. Use inspect or request narrower context before relying on coverage.`] : [];
}
function findings(value) {
  const record = object(value);
  const lines = [];
  for (const key of ["reasons", "unknowns", "blockingUnknowns", "questions", "frontier", "requiredExpansionIds"]) {
    for (const item of array(record[key])) {
      if (typeof item === "string")
        lines.push(item);
      else {
        const finding = object(item);
        lines.push(...unique([string(finding.explanation), string(finding.reason), string(finding.question), string(finding.message)]));
      }
    }
  }
  for (const key of ["unknownDisclosure", "frontierDisclosure", "reasonDisclosure", "obligationDisclosure", "decisionDisclosure", "governanceDisclosure", "applicationEvidenceDisclosure"])
    lines.push(...disclose(record[key], key.replace("Disclosure", " findings")));
  for (const item of [...array(record.lensObligations), ...array(record.decisionValidity), ...array(record.governanceEvaluations), ...array(record.evaluations), ...array(record.applicationEvidence)]) {
    const finding = object(item);
    const status = string(finding.status);
    const identity = string(finding.decisionId) || string(finding.lensId) || string(finding.entityId) || string(finding.id);
    lines.push([identity, status, ...findings(finding)].filter(Boolean).join(": "));
  }
  return unique(lines);
}
function renderPublicResult(command, value) {
  const result = object(value);
  const lines = [];
  if (command === "context") {
    lines.push(string(result.request));
    lines.push(...describeMeaning(result));
    for (const branchValue of array(result.branches)) {
      const branch = object(branchValue);
      const context = object(branch.context);
      for (const item of array(context.items)) {
        const record = object(item);
        lines.push(...describeMeaning(record));
        if (result.view === "full")
          lines.push(string(record.content));
      }
      lines.push(...findings(branch), ...disclose(context.itemsDisclosure, "context items"));
    }
    lines.push(...findings(result), ...disclose(result.branchDisclosure, "branches"), ...disclose(object(result.meaning).disclosure, "meaning sections"));
    const safety = object(result.safety);
    const counters = Object.entries(safety).filter(([, count]) => typeof count === "number" && count > 0).map(([key, count]) => `${key}: ${count}`);
    if (counters.length)
      lines.push(`Coverage limits: ${counters.join(", ")}`);
    if (result.id)
      lines.push(`Context: ${result.id}`);
  } else if (command === "accept-preview") {
    const preview = object(result.preview);
    const review = object(preview.intentReview);
    const proposal = object(preview.proposal);
    lines.push("Review canonical meaning before applying:");
    for (const subject of [...array(review.subjects), ...array(review.canonicalMutations)]) {
      const change = object(subject);
      lines.push(`${string(change.operation)} ${string(change.id)}`);
      const mutation = array(proposal.canonicalMutations).map(object).find((item) => object(item.payload).id === change.id);
      const proposedSubject = [...array(proposal.requirements), ...array(proposal.scenarios)].map(object).find((item) => object(item.revision).id === change.id || item.key === change.id);
      const proposed = mutation?.payload ?? proposedSubject;
      lines.push(...describeMeaning(proposed));
      lines.push(...reviewMetadata(change.before, change.after ?? proposed));
      lines.push(string(change.rationale));
    }
    for (const relation of array(review.relations).slice(0, 20)) {
      const text = relationText(relation);
      if (text !== void 0)
        lines.push(`Related typed relation: ${text}`);
    }
    lines.push(...findings(review));
    const obligations = array(review.relatedObligations).map((item) => string(object(item).id));
    if (obligations.length)
      lines.push(`Related obligations: ${obligations.join(", ")}`);
    lines.push(`Change: ${string(result.selector) || string(result.changeSelector)}`);
    lines.push(`Reviewed hash: ${string(result.immutablePlanHash)}`);
    lines.push("Apply only after reviewing this meaning and the affected obligations. Use accept --apply CHANGE --hash HASH.");
  } else if (command === "check" || command === "resume") {
    for (const [key, part] of Object.entries(result)) {
      const item = object(part);
      if (key === "context") {
        lines.push(renderPublicResult("context", part));
        continue;
      }
      if (!Object.keys(item).length)
        continue;
      const binding = object(item.validation);
      lines.push(`${key}: ${string(item.status) || string(binding.status) || string(item.outcome) || "inspected"}`);
      lines.push(...findings(item), ...findings(binding));
      for (const branch of array(item.branches))
        lines.push(...findings(branch));
      for (const field of ["continuation", "recovery", "nextAction", "decisionValidity", "governance", "impact"]) {
        const detail = object(item[field]);
        lines.push(...unique([string(detail.status), string(detail.reason), string(detail.action), ...findings(detail)]));
      }
    }
    if (command === "resume")
      lines.push("Inspection only. No changes applied and no authority renewed.");
  } else if (command === "audit") {
    const completion = object(result.completion);
    const binding = object(result.bindingValidation);
    const disclosure = object(completion.questionDisclosure);
    const page = object(completion.questionPage);
    lines.push("Read-only audit: source and canonical records are unchanged. Operational observation artifacts may be created.");
    lines.push(`Evidence: ${string(result.proofStatement) || "not established"}; binding ${string(binding.status) || "unknown"}.`);
    if (result.continuation !== void 0) {
      const continuation = object(result.continuation);
      const context = object(continuation.context);
      const lifecycle = object(continuation.lifecycle);
      if (string(context.contextId))
        lines.push(`Retained context ${context.contextId}: ${string(context.status) || "unknown"}; governance ${string(context.governance) || "unknown"}.`);
      if (string(lifecycle.changeSelector))
        lines.push(`Retained change ${lifecycle.changeSelector}: ${string(lifecycle.status) || "unknown"}; plan ${string(lifecycle.planFreshness) || "unknown"}${string(lifecycle.approvalSelector) ? `; approval ${lifecycle.approvalSelector}` : ""}.`);
      if (string(continuation.reason))
        lines.push(`Continuation: ${continuation.reason}`);
      for (const raw of array(continuation.evidence)) {
        const evidence = object(raw);
        lines.push(`Retained evidence ${string(evidence.id) || "unspecified"}: ${string(evidence.status) || "unknown"}; ${string(evidence.availability) || "availability unknown"}${string(evidence.reason) ? ` -- ${evidence.reason}` : ""}`);
      }
      const evidencePage = object(continuation.page);
      if (typeof evidencePage.omitted === "number" && evidencePage.omitted > 0)
        lines.push(`Retained evidence: ${evidencePage.omitted} omitted${typeof evidencePage.nextOffset === "number" ? `; next offset ${evidencePage.nextOffset}` : ""}.`);
      const advisory = object(continuation.advisoryNotes);
      if (string(advisory.reason))
        lines.push(`Advisory evidence (${string(advisory.status) || "unknown"}): ${advisory.reason}`);
      for (const limit of array(continuation.limits).map(string).filter(Boolean))
        lines.push(`Continuation limit: ${limit}`);
      const next = object(continuation.nextAction);
      if (string(next.operation))
        lines.push(`Next supported operation: ${next.operation}; input ${JSON.stringify(next.input ?? {})}`);
    }
    for (const laneValue of array(result.lanes)) {
      const lane = object(laneValue);
      const ratio = typeof lane.numerator === "number" && typeof lane.denominator === "number" ? ` ${lane.numerator}/${lane.denominator}` : "";
      lines.push(`Evidence ${string(lane.key) || "unnamed"}: ${string(lane.observability) || "unknown"}${ratio}`);
      for (const blindSpot of array(lane.blindSpots).map(string).filter(Boolean))
        lines.push(`Unresolved coverage: ${blindSpot}`);
    }
    const analysis = object(result.localAnalysis);
    const realizations = object(analysis.realizations);
    lines.push(`Observed files: ${analysis.artifactCount ?? "unknown"}; projection units: ${analysis.projectionUnitCount ?? "unknown"}; matched realizations: ${realizations.matched ?? "unknown"}, unmatched: ${realizations.unmatched ?? "unknown"}, unsupported: ${realizations.unsupported ?? "unknown"}, unavailable: ${realizations.unavailable ?? "unknown"}.`);
    for (const surface of array(result.unavailableSurfaceIds).map(string).filter(Boolean))
      lines.push(`Unsupported or unavailable surface: ${surface}`);
    for (const failureValue of array(analysis.analyzerFailures)) {
      const failure = object(failureValue);
      lines.push(`Observation unavailable: ${string(failure.title) || string(failure.code) || "analyzer failure"}${string(failure.message) ? ` -- ${string(failure.message)}` : ""}`);
    }
    for (const limit of array(completion.limits).map(string).filter(Boolean))
      lines.push(`Coverage limit: ${limit}`);
    lines.push(`Application evidence: ${string(object(result.applicationEvidence).status) || "unknown"}.`);
    const questions = array(completion.questions);
    lines.push(`Questions: ${questions.length} shown; ${typeof disclosure.total === "number" ? disclosure.total : questions.length} total, ${typeof disclosure.omitted === "number" ? disclosure.omitted : 0} omitted${page.nextOffset === null || page.nextOffset === void 0 ? "" : `; next offset ${page.nextOffset}`}.`);
    for (const raw of questions) {
      const question = object(raw);
      const assessment = object(question.assessment);
      lines.push(`${question.blocking === true ? "Blocking" : "Open"} ${string(question.kind) || "question"}${string(assessment.status) ? ` (${assessment.status}${string(assessment.category) ? `: ${assessment.category}` : ""})` : ""}: ${string(question.question)}`);
      if (array(question.ownerIds).length)
        lines.push(`Owners: ${array(question.ownerIds).map(string).join(", ")}`);
      for (const reason of array(question.reasons).map(string).filter(Boolean))
        lines.push(`Evidence: ${reason}`);
      const resolution = object(question.resolution);
      if (string(resolution.route))
        lines.push(`Repair route: ${string(resolution.route)}`);
      for (const alternativeValue of array(resolution.alternatives)) {
        const alternative = object(alternativeValue);
        const capabilities = array(alternative.capabilityIds).map(string).filter(Boolean);
        lines.push(`Repair option: ${string(alternative.strategy) || "unspecified"} (${string(alternative.status) || "unknown"})${string(alternative.reason) ? ` -- ${string(alternative.reason)}` : ""}${capabilities.length ? `; capabilities: ${capabilities.join(", ")}` : ""}`);
      }
      if (string(resolution.instruction))
        lines.push(`Next: ${string(resolution.instruction)}`);
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
  } else {
    lines.push(`${command}: ${string(result.outcome) || string(result.status) || string(object(result.readiness).status) || "completed"}`);
    lines.push(...describeMeaning(result), ...findings(result));
    for (const key of ["selector", "approvalSelector", "receiptId", "reason"])
      if (typeof result[key] === "string")
        lines.push(`${key}: ${result[key]}`);
  }
  return unique(lines).join("\n\n") + "\n";
}
async function runPublicCommand(args, input) {
  const { values, flags, one } = argumentsFor(args);
  const command = values.shift();
  if (command === void 0 || command === "help" || flags.has("--help"))
    return { exitCode: 0, output: { help: publicCommandHelp }, text: publicCommandHelp };
  const repositoryRoot = resolve(input.cwd, one("--root") ?? ".");
  const allowed = { init: [], context: ["--entity", "--target", "--budget"], check: [], audit: ["--scope", "--context", "--question-offset"], accept: ["--context", "--request", "--apply", "--hash"], resume: [], inspect: [], recover: ["--access"] };
  if (!(command in allowed))
    throw new Error(`Unknown command ${command}. Use --help.`);
  for (const flag of flags.keys())
    if (!["--root", "--json", "--help", "--timeout-ms", ...allowed[command]].includes(flag))
      throw new Error(`${flag} does not apply to ${command}`);
  const timeoutMs = one("--timeout-ms") === void 0 ? void 0 : Number(one("--timeout-ms"));
  if (timeoutMs !== void 0 && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0))
    throw new Error("--timeout-ms requires a positive safe integer in milliseconds");
  const call = async (operation, requestInput) => {
    const result = await input.runner.execute({ apiVersion: "projector.operation/v1", operation, repositoryRoot, input: requestInput, ...timeoutMs === void 0 ? {} : { observationLimits: { timeoutMs } } });
    if (result.status !== "succeeded") {
      const observation = result.error?.observation;
      const detail = observation === void 0 ? "" : ` (${observation.stage} at ${observation.scope}${observation.limit === void 0 ? "" : `; ${observation.limit}${observation.observed === void 0 ? "" : ` observed ${observation.observed}`}`})`;
      throw new Error(`${operation}: ${result.error?.message ?? result.readiness.reason ?? result.status}${detail}`);
    }
    return result.output;
  };
  const exactValues = (count) => {
    if (values.length !== count)
      throw new Error(`${command} requires ${count} argument${count === 1 ? "" : "s"}. Use --help.`);
  };
  let output;
  let view = command;
  if (command === "init") {
    exactValues(0);
    output = await call("init", {});
  } else if (command === "context") {
    if (!values.length)
      throw new Error("context requires a task description");
    const budget = one("--budget") === void 0 ? void 0 : Number(one("--budget"));
    if (budget !== void 0 && (!Number.isSafeInteger(budget) || budget <= 0))
      throw new Error("--budget requires a positive character count");
    output = await call("context", { request: values.join(" "), persist: true, ...flags.has("--entity") ? { entities: flags.get("--entity") } : {}, ...flags.has("--target") ? { namedTargets: flags.get("--target") } : {}, ...budget === void 0 ? {} : { policy: { maxContextCost: budget } } });
  } else if (command === "check") {
    if (values.length > 1)
      throw new Error("check accepts at most one retained context");
    output = { repository: await call("repository.check", { mode: "full" }), ...values[0] === void 0 ? {} : { meaning: await call("reconcile", { contextId: values[0] }) } };
  } else if (command === "audit") {
    exactValues(0);
    const absoluteScope = resolve(repositoryRoot, one("--scope") ?? ".");
    const relativeScope = relative(repositoryRoot, absoluteScope);
    if (relativeScope === ".." || relativeScope.startsWith(`..${sep}`) || isAbsolute(relativeScope))
      throw new Error("--scope must stay within the selected repository root");
    const questionOffset = one("--question-offset") === void 0 ? 0 : Number(one("--question-offset"));
    if (!Number.isSafeInteger(questionOffset) || questionOffset < 0)
      throw new Error("--question-offset requires a nonnegative safe integer");
    output = await call("cleanup", { scope: relativeScope ? relativeScope.split(sep).join("/") : ".", questionOffset, ...one("--context") === void 0 ? {} : { contextId: one("--context") } });
  } else if (command === "accept") {
    if (one("--apply") !== void 0) {
      exactValues(0);
      if (one("--hash") === void 0 || one("--context") !== void 0 || one("--request") !== void 0)
        throw new Error("accept --apply requires --hash and no proposal options");
      const approval = object(await call("change.approve", { changeSelector: one("--apply"), planHash: one("--hash") }));
      output = await call("change.apply", { approvalSelector: approval.selector });
      if (object(output).outcome !== "succeeded" && object(output).outcome !== "success")
        return { exitCode: 6, output, text: renderPublicResult(command, output) };
    } else {
      exactValues(1);
      if (one("--hash") !== void 0)
        throw new Error("--hash requires --apply");
      const parsedProposal = ChangeProposalSchema.safeParse(JSON.parse(await readFile(resolve(input.cwd, values[0]), "utf8")));
      if (!parsedProposal.success) {
        const issues = parsedProposal.error.issues;
        const detail = external_exports.prettifyError(new external_exports.ZodError(issues.slice(0, 8)));
        throw new Error(`Invalid change proposal:
${detail.slice(0, 8e3)}${issues.length > 8 || detail.length > 8e3 ? "\nMore schema issues omitted. Fix these and retry." : ""}`);
      }
      const proposal = parsedProposal.data;
      const capture = object(await call("change.capture", { request: one("--request") ?? "Accept the proposed canonical meaning", proposal, ...one("--context") === void 0 ? {} : { contextId: one("--context") } }));
      output = await call("change.plan", { changeSelector: capture.selector });
      view = "accept-preview";
    }
  } else if (command === "resume") {
    exactValues(1);
    const anchor = values[0];
    const key = anchor.startsWith("knowledge_context_") ? "contextId" : anchor.startsWith("semantic_change_") ? "changeSelector" : anchor.startsWith("lifecycle_approval_") ? "approvalSelector" : void 0;
    if (key === void 0)
      throw new Error("resume requires an actual retained context, change or approval ID; it never guesses latest");
    const continuation = await call("cleanup", { [key]: anchor, evidenceLimit: 5 });
    const restoration = object(object(object(continuation).continuation).restoration);
    output = { continuation, ...restoration.meaning === void 0 ? {} : { meaning: restoration.meaning }, ...restoration.context === void 0 ? {} : { context: restoration.context } };
  } else if (command === "inspect") {
    exactValues(1);
    const anchor = values[0];
    if (anchor.startsWith("knowledge_context_"))
      output = await (await RepositoryKnowledgeService.create(repositoryRoot)).read(anchor);
    else if (anchor.startsWith("semantic_change_"))
      output = await call("representation.inspect", { changeSelector: anchor, view: "content" });
    else if (anchor.startsWith("lifecycle_approval_"))
      output = await call("cleanup", { approvalSelector: anchor, evidenceLimit: 50 });
    else {
      const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot();
      output = snapshot.documents.find((document) => document.id === anchor);
      if (output === void 0)
        throw new Error(`No canonical record has ID ${anchor}`);
    }
  } else {
    if (flags.has("--access")) {
      exactValues(0);
      output = await call("operation-access.recover", {});
    } else {
      exactValues(1);
      output = await call("change.recover", { approvalSelector: values[0] });
    }
  }
  return { exitCode: 0, output, text: flags.has("--json") || command === "inspect" ? `${JSON.stringify(output, null, 2)}
` : renderPublicResult(view, output) };
}

export {
  publicCommandHelp,
  renderPublicResult,
  runPublicCommand
};
