import {
  runObservationTask
} from "./shared-XUP2BAXD.js";
import {
  CanonicalFileRepository,
  RepositoryPathService,
  currentObservationScope,
  withObservationScope
} from "./shared-GXAKKSCS.js";
import {
  GitCommandError,
  checkObservation,
  observationGit,
  readObservationFile
} from "./shared-5EIJVVQJ.js";
import {
  evaluateSelector
} from "./shared-RMBXVF7C.js";
import {
  AuthorityRecordSchema,
  ContentHashSchema,
  ObservationError,
  canonicalJson,
  normalizeRepositoryRelativePath
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/knowledge/decision-baselines.js
import { lstat, opendir } from "node:fs/promises";
import { relative } from "node:path";
import { z } from "zod";
var strings = (values) => [...new Set(values)].sort();
var observationSchema = z.strictObject({ key: z.string(), value: z.json() });
var KnowledgeDecisionBaselineSchema = z.strictObject({
  decisionId: z.string(),
  decisionSemanticHash: ContentHashSchema,
  authorityId: z.string(),
  authoritySemanticHash: ContentHashSchema,
  decisionDocumentHash: ContentHashSchema.optional(),
  authorityDocumentHash: ContentHashSchema.optional(),
  observations: z.array(observationSchema)
});
function triggerSubjectId(trigger) {
  switch (trigger.type) {
    case "concept-changed":
      return trigger.conceptId;
    case "requirement-changed":
      return trigger.subjectId;
    case "scenario-changed":
      return trigger.scenarioId;
    case "relation-changed":
      return trigger.relationId;
    case "constraint-changed":
      return trigger.constraintId;
    case "lens-changed":
      return trigger.lensId;
    case "evidence-invalidated":
      return trigger.evidenceId;
    default:
      return void 0;
  }
}
function scopedPaths(decision, scopeKey, paths, surface) {
  try {
    const prefix = normalizeRepositoryRelativePath(scopeKey);
    if (prefix !== scopeKey || /[*?\[\]]/u.test(scopeKey))
      return void 0;
    const fields = (selector) => selector.op === "atom" ? [selector.field] : selector.op === "not" ? fields(selector.item) : selector.items.flatMap(fields);
    if (fields(decision.scope).some((field) => !["path", "surface", "package", "package-kind"].includes(field)))
      return void 0;
    return strings(paths.filter((path) => {
      if (!(path === prefix || path.startsWith(`${prefix}/`)))
        return false;
      const segments = path.split("/");
      const values = { path, surface, package: segments[0] === "packages" || segments[0] === "apps" ? segments.slice(0, 2).join("/") : [], "package-kind": segments[0] === "packages" || segments[0] === "apps" ? segments[0] : [] };
      return evaluateSelector(decision.scope, { id: path, values, dependencyKeys: [] }).matched;
    }));
  } catch {
    return void 0;
  }
}
function captureDecisionTriggerObservations(decision, authority, documents, paths, surface) {
  const result = [];
  for (const { evidenceId } of authority.evidence) {
    result.push({ key: `evidence:${evidenceId}`, value: { semanticHash: documents.find(({ id }) => id === evidenceId)?.semanticHash ?? null } });
  }
  for (const trigger of authority.reconsiderWhen) {
    const subjectId = triggerSubjectId(trigger);
    if (subjectId !== void 0) {
      result.push({ key: canonicalJson(trigger), value: { semanticHash: documents.find(({ id }) => id === subjectId)?.semanticHash ?? null } });
    } else if (trigger.type === "scope-expanded") {
      const members = scopedPaths(decision, trigger.scopeKey, paths, surface);
      if (members !== void 0)
        result.push({ key: canonicalJson(trigger), value: { paths: members } });
    } else if (trigger.type === "surface-added" && trigger.surfaceKind === "repository") {
      result.push({ key: canonicalJson(trigger), value: { surfaces: surface === "repository" ? ["repository"] : [] } });
    }
  }
  if (authority.evidenceRefreshPolicy?.mode === "max-age")
    result.push({ key: "evidence-refresh-created-at", value: authority.createdAt });
  return result.sort((left, right) => left.key.localeCompare(right.key));
}
function captureDecisionBaselines(observation, authorityIds, decisionIds = []) {
  const authorities = observation.canonical.documents.filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload));
  return observation.canonical.documents.filter(({ kind }) => kind === "architecture-decision").flatMap(({ payload }) => {
    const decision = payload;
    const authority = authorities.find(({ id }) => id === decision.authorityRecordId);
    if (authority === void 0 || decision.lifecycle !== "active" || !authorityIds.includes(authority.id) && !decisionIds.includes(decision.id))
      return [];
    return [{
      decisionId: decision.id,
      decisionSemanticHash: decision.semanticHash,
      authorityId: authority.id,
      authoritySemanticHash: authority.semanticHash,
      decisionDocumentHash: observation.canonical.documents.find(({ id }) => id === decision.id).canonicalDocumentHash,
      authorityDocumentHash: observation.canonical.documents.find(({ id }) => id === authority.id).canonicalDocumentHash,
      observations: captureDecisionTriggerObservations(decision, authority, observation.canonical.documents, observation.analysis.files.map(({ path }) => path), observation.analysis.surface.kind)
    }];
  });
}
function matches(baseline, decision, authority) {
  return baseline.decisionId === decision.id && baseline.decisionSemanticHash === decision.semanticHash && baseline.authorityId === authority.id && baseline.authoritySemanticHash === authority.semanticHash;
}
var DecisionBaselineReader = class {
  observation;
  receipts;
  constructor(observation) {
    this.observation = observation;
  }
  document(id) {
    return "readDocument" in this.observation ? this.observation.readDocument(id) : this.observation.canonical.documents.find((document) => document.id === id);
  }
  async read(decision, authority) {
    return withObservationScope({}, async (scope) => {
      checkObservation(scope.budget, scope.signal, "decision-baseline");
      this.receipts ??= this.readReceipts();
      const matching = (await this.receipts).filter(({ baseline }) => matches(baseline, decision, authority));
      const authorityDocument = this.document(authority.id)?.canonicalDocumentHash;
      const decisionDocument = this.document(decision.id)?.canonicalDocumentHash;
      const exact = matching.filter(({ baseline }) => baseline.authorityDocumentHash === authorityDocument && baseline.decisionDocumentHash === decisionDocument);
      const candidates = exact.length > 0 ? exact : matching;
      const receipt = candidates[0];
      if (receipt !== void 0 && candidates.some((candidate) => candidate.completedAt === receipt.completedAt && candidate.observationsIdentity !== receipt.observationsIdentity))
        return { kind: "unavailable", reason: "Authenticated reaffirmation baselines have ambiguous ordering; no unique latest observation can be established." };
      if (receipt !== void 0)
        return { kind: "authenticated-transaction", reference: receipt.reference, baseline: receipt.baseline };
      return this.readGit(decision, authority);
    });
  }
  async readReceipts() {
    const scope = currentObservationScope();
    const repository = this.observation.repositoryRoot;
    const paths = await RepositoryPathService.create(repository);
    const sources = {};
    const resultsRoot = ".projector/runtime/change-lifecycles/results";
    const collect = async (directory) => {
      checkObservation(scope.budget, scope.signal, "decision-baseline-enumeration", directory);
      const resolved = await paths.resolveRead(directory);
      let status;
      try {
        status = await lstat(resolved.realTarget);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT")
          return;
        throw error;
      }
      if (!status.isDirectory() || status.isSymbolicLink())
        throw new ObservationError("observation-failed", "decision-baseline-enumeration", directory, "Baseline metadata directory must be a real directory");
      scope.budget.consume("maxDirectories", 1, "decision-baseline-enumeration", directory);
      const handle = await opendir(resolved.realTarget);
      for await (const entry of handle) {
        checkObservation(scope.budget, scope.signal, "decision-baseline-enumeration", directory);
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
          if (path !== resultsRoot)
            await collect(path);
          continue;
        }
        scope.budget.consume("maxFiles", 1, "decision-baseline-enumeration", path);
        if (!entry.isFile())
          throw new ObservationError("observation-failed", "decision-baseline-enumeration", path, "Baseline metadata must be a regular file");
        if (!/^[a-f0-9]{64}\.json$/u.test(entry.name))
          continue;
        sources[path] = (await readObservationFile((await paths.resolveRead(path)).realTarget, scope.budget, path, scope.signal)).toString("utf8");
      }
    };
    await collect(resultsRoot);
    if (Object.keys(sources).length === 0)
      return [];
    await collect(".projector/runtime/change-lifecycles");
    await collect(".projector/runtime/journal");
    const result = await runObservationTask("decision-baseline-data", { kind: "receipts", repositoryRoot: paths.root, sources }, scope);
    if (result.kind !== "receipts")
      throw new Error("Decision baseline worker returned another result kind");
    return result.receipts;
  }
  async git(args) {
    const scope = currentObservationScope();
    return observationGit(this.observation.repositoryRoot, args, scope.budget, { signal: scope.signal, stage: "decision-baseline-git" });
  }
  async parse(sources) {
    const scope = currentObservationScope();
    const result = await runObservationTask("decision-baseline-data", { kind: "canonical", sources }, scope);
    if (result.kind !== "canonical")
      throw new Error("Decision baseline worker returned another result kind");
    if (result.error !== void 0)
      throw new Error(result.error);
    return result.documents;
  }
  async readGit(decision, authority) {
    try {
      const files = new CanonicalFileRepository(this.observation.repositoryRoot);
      if ((await this.git(["rev-parse", "--is-shallow-repository"])).trim() === "true")
        throw new Error("shallow Git history cannot establish the first authority baseline");
      const authorityLocator = await files.locate("authority-record", authority.id);
      if (authorityLocator === void 0)
        throw new Error("current authority locator is unavailable");
      const path = relative(this.observation.repositoryRoot, authorityLocator.path).replaceAll("\\", "/");
      const headSource = { text: await this.git(["show", `HEAD:${path}`]), path: `HEAD:${path}` };
      const history = (await this.git(["log", "--format=%H", "--max-count=257", "HEAD", "--", path])).trim().split(/\s+/u).filter(Boolean);
      if (history.length > 256)
        throw new Error("authority history exceeds the bounded Git baseline search");
      let anchor;
      let anchorAuthority;
      const historySources = [];
      for (const revision of history)
        historySources.push({ text: await this.git(["show", `${revision}:${path}`]), path: `${revision}:${path}` });
      const [head, ...historyRecords] = await this.parse([headSource, ...historySources]);
      if (head.semanticHash !== authority.semanticHash)
        throw new Error("current authority is not recorded at Git HEAD");
      for (const [index, record] of historyRecords.entries()) {
        if (record.semanticHash !== authority.semanticHash)
          continue;
        anchor = history[index];
        anchorAuthority = record.payload;
      }
      if (anchor === void 0)
        throw new Error("authority has no tracked semantic baseline");
      const trackedPaths = new Set((await this.git(["ls-tree", "-r", "--name-only", "-z", anchor])).split("\0").filter(Boolean));
      const sources = [];
      for (const subjectId of strings([...authority.reconsiderWhen.map(triggerSubjectId).filter((id) => id !== void 0), ...authority.evidence.map(({ evidenceId }) => evidenceId)])) {
        const current = this.document(subjectId);
        const kinds = current === void 0 ? ["concept", "requirement", "behavioral-scenario", "relation", "rule", "projection-lens"] : [current.kind];
        for (const kind of kinds) {
          const subjectLocator = await files.locate(kind, subjectId);
          if (subjectLocator === void 0)
            continue;
          const subjectPath = relative(this.observation.repositoryRoot, subjectLocator.path).replaceAll("\\", "/");
          if (!trackedPaths.has(subjectPath))
            continue;
          sources.push({ text: await this.git(["show", `${anchor}:${subjectPath}`]), path: `${anchor}:${subjectPath}`, subjectId });
          break;
        }
      }
      const paths = [...trackedPaths].filter((path2) => path2 !== ".projector" && !path2.startsWith(".projector/"));
      const decisionLocator = await files.locate("architecture-decision", decision.id);
      if (decisionLocator === void 0)
        throw new Error("current decision locator is unavailable");
      const decisionPath = relative(this.observation.repositoryRoot, decisionLocator.path).replaceAll("\\", "/");
      sources.push({ text: await this.git(["show", `${anchor}:${decisionPath}`]), path: `${anchor}:${decisionPath}`, subjectId: decision.id });
      const observations = await runObservationTask("decision-baseline-data", { kind: "git-observations", decision, authority: anchorAuthority, sources, paths }, currentObservationScope());
      if (observations.kind !== "git-observations")
        throw new Error("Decision baseline worker returned another result kind");
      if (observations.error !== void 0)
        throw new Error(observations.error);
      return { kind: "tracked-git-history", reference: anchor, baseline: {
        decisionId: decision.id,
        decisionSemanticHash: decision.semanticHash,
        authorityId: authority.id,
        authoritySemanticHash: authority.semanticHash,
        observations: observations.observations
      } };
    } catch (error) {
      const scope = currentObservationScope();
      checkObservation(scope.budget, scope.signal, "decision-baseline-git");
      if (error instanceof ObservationError && !(error instanceof GitCommandError))
        throw error;
      return { kind: "unavailable", reason: error instanceof Error ? error.message : String(error) };
    }
  }
};

export {
  KnowledgeDecisionBaselineSchema,
  triggerSubjectId,
  captureDecisionTriggerObservations,
  captureDecisionBaselines,
  DecisionBaselineReader
};
