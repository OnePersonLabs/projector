import { lstat, opendir } from "node:fs/promises";
import { relative } from "node:path";

import { AuthorityRecordSchema, ContentHashSchema, ObservationError, canonicalJson, normalizeRepositoryRelativePath, type ArchitectureDecision, type AuthorityRecord, type AuthorityReconsiderTrigger, type CanonicalDocumentEnvelope } from "@projector/core";
import { checkObservation, observationGit, readObservationFile, GitCommandError } from "@projector/analyzers";
import { evaluateSelector } from "@projector/engine";
import { CanonicalFileRepository, RepositoryPathService, currentObservationScope, withObservationScope } from "@projector/runtime";
import { z } from "zod";

import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { runObservationTask } from "../observation/task-runner.js";
import type { DecisionBaselineReceipt } from "./decision-baseline-data.js";

const strings = (values: readonly string[]) => [...new Set(values)].sort();
const observationSchema = z.strictObject({ key: z.string(), value: z.json() });
export const KnowledgeDecisionBaselineSchema = z.strictObject({
  decisionId: z.string(), decisionSemanticHash: ContentHashSchema,
  authorityId: z.string(), authoritySemanticHash: ContentHashSchema,
  decisionDocumentHash: ContentHashSchema.optional(), authorityDocumentHash: ContentHashSchema.optional(),
  observations: z.array(observationSchema),
});
export type KnowledgeDecisionBaseline = z.infer<typeof KnowledgeDecisionBaselineSchema>;
export interface DecisionBaselineEvidence {
  readonly kind: "authenticated-transaction" | "tracked-git-history" | "unavailable";
  readonly reference?: string;
  readonly baseline?: KnowledgeDecisionBaseline;
  readonly reason?: string;
}

export function triggerSubjectId(trigger: AuthorityReconsiderTrigger): string | undefined {
  switch (trigger.type) {
    case "concept-changed": return trigger.conceptId;
    case "requirement-changed": return trigger.subjectId;
    case "scenario-changed": return trigger.scenarioId;
    case "relation-changed": return trigger.relationId;
    case "constraint-changed": return trigger.constraintId;
    case "lens-changed": return trigger.lensId;
    default: return undefined;
  }
}

function scopedPaths(decision: ArchitectureDecision, scopeKey: string, paths: readonly string[], surface: string): string[] | undefined {
  try {
    const prefix = normalizeRepositoryRelativePath(scopeKey);
    if (prefix !== scopeKey || /[*?\[\]]/u.test(scopeKey)) return undefined;
    const fields = (selector: ArchitectureDecision["scope"]): string[] => selector.op === "atom" ? [selector.field] : selector.op === "not" ? fields(selector.item) : selector.items.flatMap(fields);
    if (fields(decision.scope).some((field) => !["path", "surface", "package", "package-kind"].includes(field))) return undefined;
    return strings(paths.filter((path) => {
      if (!(path === prefix || path.startsWith(`${prefix}/`))) return false;
      const segments = path.split("/");
      const values = { path, surface, package: (segments[0] === "packages" || segments[0] === "apps") ? segments.slice(0, 2).join("/") : [], "package-kind": segments[0] === "packages" || segments[0] === "apps" ? segments[0] : [] };
      return evaluateSelector(decision.scope, { id: path, values, dependencyKeys: [] }).matched;
    }));
  } catch { return undefined; }
}

/** Only observations represented by this repository adapter are captured. */
export function captureDecisionTriggerObservations(
  decision: ArchitectureDecision,
  authority: AuthorityRecord,
  documents: readonly CanonicalDocumentEnvelope[],
  paths: readonly string[],
  surface: string,
): KnowledgeDecisionBaseline["observations"] {
  const result: KnowledgeDecisionBaseline["observations"] = [];
  for (const trigger of authority.reconsiderWhen) {
    const subjectId = triggerSubjectId(trigger);
    if (subjectId !== undefined) {
      result.push({ key: canonicalJson(trigger), value: { semanticHash: documents.find(({ id }) => id === subjectId)?.semanticHash ?? null } });
    } else if (trigger.type === "scope-expanded") {
      const members = scopedPaths(decision, trigger.scopeKey, paths, surface);
      if (members !== undefined) result.push({ key: canonicalJson(trigger), value: { paths: members } });
    } else if (trigger.type === "surface-added" && trigger.surfaceKind === "repository") {
      result.push({ key: canonicalJson(trigger), value: { surfaces: surface === "repository" ? ["repository"] : [] } });
    }
  }
  if (authority.evidenceRefreshPolicy?.mode === "max-age") result.push({ key: "evidence-refresh-created-at", value: authority.createdAt });
  return result.sort((left, right) => left.key.localeCompare(right.key));
}

/** Use only for authorities explicitly accepted by the current canonical transaction. */
export function captureDecisionBaselines(observation: ChangeRepositoryObservation, authorityIds: readonly string[], decisionIds: readonly string[] = []): KnowledgeDecisionBaseline[] {
  const authorities = observation.canonical.documents.filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload) as AuthorityRecord);
  return observation.canonical.documents.filter(({ kind }) => kind === "architecture-decision").flatMap(({ payload }) => {
    const decision = payload as unknown as ArchitectureDecision;
    const authority = authorities.find(({ id }) => id === decision.authorityRecordId);
    if (authority === undefined || decision.lifecycle !== "active" || (!authorityIds.includes(authority.id) && !decisionIds.includes(decision.id))) return [];
    return [{ decisionId: decision.id, decisionSemanticHash: decision.semanticHash, authorityId: authority.id, authoritySemanticHash: authority.semanticHash,
      decisionDocumentHash: observation.canonical.documents.find(({ id }) => id === decision.id)!.canonicalDocumentHash,
      authorityDocumentHash: observation.canonical.documents.find(({ id }) => id === authority.id)!.canonicalDocumentHash,
      observations: captureDecisionTriggerObservations(decision, authority, observation.canonical.documents, observation.analysis.files.map(({ path }) => path), observation.analysis.surface.kind) }];
  });
}

function matches(baseline: KnowledgeDecisionBaseline, decision: ArchitectureDecision, authority: AuthorityRecord): boolean {
  return baseline.decisionId === decision.id && baseline.decisionSemanticHash === decision.semanticHash && baseline.authorityId === authority.id && baseline.authoritySemanticHash === authority.semanticHash;
}

/** Reads existing authenticated lifecycle artifacts; no new baseline store or implicit authority write. */
export class DecisionBaselineReader {
  private receipts: Promise<readonly DecisionBaselineReceipt[]> | undefined;
  constructor(private readonly observation: Pick<ChangeRepositoryObservation, "repositoryRoot" | "canonical">) {}

  async read(decision: ArchitectureDecision, authority: AuthorityRecord): Promise<DecisionBaselineEvidence> {
    return withObservationScope({}, async (scope) => {
    checkObservation(scope.budget, scope.signal, "decision-baseline");
    this.receipts ??= this.readReceipts();
    const matching = (await this.receipts).filter(({ baseline }) => matches(baseline, decision, authority));
    const authorityDocument = this.observation.canonical.documents.find(({ id }) => id === authority.id)?.canonicalDocumentHash;
    const decisionDocument = this.observation.canonical.documents.find(({ id }) => id === decision.id)?.canonicalDocumentHash;
    // An exact approved document revision disambiguates reaffirmation even under an injected/fixed clock.
    const exact = matching.filter(({ baseline }) => baseline.authorityDocumentHash === authorityDocument && baseline.decisionDocumentHash === decisionDocument);
    const candidates = exact.length > 0 ? exact : matching;
    const receipt = candidates[0];
    if (receipt !== undefined && candidates.some((candidate) => candidate.completedAt === receipt.completedAt && candidate.observationsIdentity !== receipt.observationsIdentity)) return { kind: "unavailable", reason: "Authenticated reaffirmation baselines have ambiguous ordering; no unique latest observation can be established." };
    if (receipt !== undefined) return { kind: "authenticated-transaction", reference: receipt.reference, baseline: receipt.baseline };
    return this.readGit(decision, authority);
    });
  }

  private async readReceipts() {
    const scope = currentObservationScope()!;
    const repository = this.observation.repositoryRoot;
    const paths = await RepositoryPathService.create(repository);
    const sources: Record<string, string> = {};
    const resultsRoot = ".projector/runtime/change-lifecycles/results";
    const collect = async (directory: string): Promise<void> => {
      checkObservation(scope.budget, scope.signal, "decision-baseline-enumeration", directory);
      const resolved = await paths.resolveRead(directory);
      let status;
      try { status = await lstat(resolved.realTarget); }
      catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return; throw error; }
      if (!status.isDirectory() || status.isSymbolicLink()) throw new ObservationError("observation-failed", "decision-baseline-enumeration", directory, "Baseline metadata directory must be a real directory");
      scope.budget.consume("maxDirectories", 1, "decision-baseline-enumeration", directory);
      const handle = await opendir(resolved.realTarget);
      for await (const entry of handle) {
        checkObservation(scope.budget, scope.signal, "decision-baseline-enumeration", directory);
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) { if (path !== resultsRoot) await collect(path); continue; }
        scope.budget.consume("maxFiles", 1, "decision-baseline-enumeration", path);
        if (!entry.isFile()) throw new ObservationError("observation-failed", "decision-baseline-enumeration", path, "Baseline metadata must be a regular file");
        if (!/^[a-f0-9]{64}\.json$/u.test(entry.name)) continue;
        sources[path] = (await readObservationFile((await paths.resolveRead(path)).realTarget, scope.budget, path, scope.signal)).toString("utf8");
      }
    };
    // All transitive authentication sources are collected before entering the worker.
    await collect(resultsRoot);
    if (Object.keys(sources).length === 0) return [];
    await collect(".projector/runtime/change-lifecycles");
    await collect(".projector/runtime/journal");
    const result = await runObservationTask("decision-baseline-data", { kind: "receipts", repositoryRoot: paths.root, sources }, scope);
    if (result.kind !== "receipts") throw new Error("Decision baseline worker returned another result kind");
    return result.receipts;
  }

  private async git(args: readonly string[]): Promise<string> {
    const scope = currentObservationScope()!;
    return observationGit(this.observation.repositoryRoot, args, scope.budget, { signal: scope.signal, stage: "decision-baseline-git" });
  }

  private async parse(sources: readonly { text: string; path: string }[]): Promise<CanonicalDocumentEnvelope[]> {
    const scope = currentObservationScope()!;
    const result = await runObservationTask("decision-baseline-data", { kind: "canonical", sources }, scope);
    if (result.kind !== "canonical") throw new Error("Decision baseline worker returned another result kind");
    if (result.error !== undefined) throw new Error(result.error);
    return result.documents;
  }

  private async readGit(decision: ArchitectureDecision, authority: AuthorityRecord): Promise<DecisionBaselineEvidence> {
    try {
      const files = new CanonicalFileRepository(this.observation.repositoryRoot);
      if ((await this.git(["rev-parse", "--is-shallow-repository"])).trim() === "true") throw new Error("shallow Git history cannot establish the first authority baseline");
      const authorityLocator = await files.locate("authority-record", authority.id);
      if (authorityLocator === undefined) throw new Error("current authority locator is unavailable");
      const path = relative(this.observation.repositoryRoot, authorityLocator.path).replaceAll("\\", "/");
      const headSource = { text: await this.git(["show", `HEAD:${path}`]), path: `HEAD:${path}` };
      const history = (await this.git(["log", "--format=%H", "--max-count=257", "HEAD", "--", path])).trim().split(/\s+/u).filter(Boolean);
      if (history.length > 256) throw new Error("authority history exceeds the bounded Git baseline search");
      let anchor: string | undefined;
      let anchorAuthority: AuthorityRecord | undefined;
      const historySources = [];
      for (const revision of history) historySources.push({ text: await this.git(["show", `${revision}:${path}`]), path: `${revision}:${path}` });
      const [head, ...historyRecords] = await this.parse([headSource, ...historySources]);
      if (head!.semanticHash !== authority.semanticHash) throw new Error("current authority is not recorded at Git HEAD");
      for (const [index, record] of historyRecords.entries()) {
        if (record.semanticHash !== authority.semanticHash) continue;
        anchor = history[index];
        anchorAuthority = record.payload as unknown as AuthorityRecord;
      }
      if (anchor === undefined) throw new Error("authority has no tracked semantic baseline");
      const trackedPaths = new Set((await this.git(["ls-tree", "-r", "--name-only", "-z", anchor])).split("\0").filter(Boolean));
      const sources: { text: string; path: string; subjectId: string }[] = [];
      for (const subjectId of strings(authority.reconsiderWhen.map(triggerSubjectId).filter((id): id is string => id !== undefined))) {
        const current = this.observation.canonical.documents.find(({ id }) => id === subjectId);
        const kinds = current === undefined ? ["concept", "requirement", "behavioral-scenario", "relation", "rule", "projection-lens"] as const : [current.kind];
        for (const kind of kinds) {
            const subjectLocator = await files.locate(kind as Parameters<CanonicalFileRepository["locate"]>[0], subjectId);
            if (subjectLocator === undefined) continue;
            const subjectPath = relative(this.observation.repositoryRoot, subjectLocator.path).replaceAll("\\", "/");
            if (!trackedPaths.has(subjectPath)) continue;
            sources.push({ text: await this.git(["show", `${anchor}:${subjectPath}`]), path: `${anchor}:${subjectPath}`, subjectId }); break;
        }
      }
      const paths = [...trackedPaths].filter((path) => path !== ".projector" && !path.startsWith(".projector/"));
      const decisionLocator = await files.locate("architecture-decision", decision.id);
      if (decisionLocator === undefined) throw new Error("current decision locator is unavailable");
      const decisionPath = relative(this.observation.repositoryRoot, decisionLocator.path).replaceAll("\\", "/");
      sources.push({ text: await this.git(["show", `${anchor}:${decisionPath}`]), path: `${anchor}:${decisionPath}`, subjectId: decision.id });
      const observations = await runObservationTask("decision-baseline-data", { kind: "git-observations", decision, authority: anchorAuthority!, sources, paths }, currentObservationScope()!);
      if (observations.kind !== "git-observations") throw new Error("Decision baseline worker returned another result kind");
      if (observations.error !== undefined) throw new Error(observations.error);
      return { kind: "tracked-git-history", reference: anchor, baseline: { decisionId: decision.id, decisionSemanticHash: decision.semanticHash, authorityId: authority.id, authoritySemanticHash: authority.semanticHash,
        observations: observations.observations } };
    } catch (error) {
      const scope = currentObservationScope()!;
      checkObservation(scope.budget, scope.signal, "decision-baseline-git");
      if (error instanceof ObservationError && !(error instanceof GitCommandError)) throw error;
      return { kind: "unavailable", reason: error instanceof Error ? error.message : String(error) };
    }
  }
}
