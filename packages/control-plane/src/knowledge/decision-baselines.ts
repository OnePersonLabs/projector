import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

import { AuthorityRecordSchema, ContentHashSchema, canonicalJson, normalizeRepositoryRelativePath, verifyCanonicalEnvelope, withCanonicalHashes, type ArchitectureDecision, type AuthorityRecord, type AuthorityReconsiderTrigger, type CanonicalDocumentEnvelope } from "@projector/core";
import { evaluateSelector, type StateBoundChangeResult } from "@projector/engine";
import { CanonicalFileRepository, RepositoryPathService } from "@projector/runtime";
import { z } from "zod";

import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { ChangeLifecycleStore } from "../change-lifecycle/store.js";

const execute = promisify(execFile);
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
  private receipts: Promise<readonly { baseline: KnowledgeDecisionBaseline; reference: string; completedAt: string }[]> | undefined;
  constructor(private readonly observation: ChangeRepositoryObservation) {}

  async read(decision: ArchitectureDecision, authority: AuthorityRecord): Promise<DecisionBaselineEvidence> {
    this.receipts ??= this.readReceipts();
    const matching = (await this.receipts).filter(({ baseline }) => matches(baseline, decision, authority));
    const authorityDocument = this.observation.canonical.documents.find(({ id }) => id === authority.id)?.canonicalDocumentHash;
    const decisionDocument = this.observation.canonical.documents.find(({ id }) => id === decision.id)?.canonicalDocumentHash;
    // An exact approved document revision disambiguates reaffirmation even under an injected/fixed clock.
    const exact = matching.filter(({ baseline }) => baseline.authorityDocumentHash === authorityDocument && baseline.decisionDocumentHash === decisionDocument);
    const candidates = exact.length > 0 ? exact : matching;
    const receipt = candidates[0];
    if (receipt !== undefined && candidates.some((candidate) => candidate.completedAt === receipt.completedAt && canonicalJson(candidate.baseline.observations) !== canonicalJson(receipt.baseline.observations))) return { kind: "unavailable", reason: "Authenticated reaffirmation baselines have ambiguous ordering; no unique latest observation can be established." };
    if (receipt !== undefined) return { kind: "authenticated-transaction", reference: receipt.reference, baseline: receipt.baseline };
    return this.readGit(decision, authority);
  }

  private async readReceipts() {
    const results: { baseline: KnowledgeDecisionBaseline; reference: string; completedAt: string }[] = [];
    const repository = this.observation.repositoryRoot;
    const paths = await RepositoryPathService.create(repository);
    let directory: string;
    let names: string[];
    try { directory = (await paths.resolveRead(".projector/runtime/change-lifecycles/results")).realTarget; names = (await readdir(directory)).filter((name) => /^[a-f0-9]{64}\.json$/u.test(name)).sort(); }
    catch { return results; }
    const store = await ChangeLifecycleStore.create(repository);
    for (const name of names) {
      try {
        const untrusted = JSON.parse(await readFile(join(directory, name), "utf8")) as { attemptId?: unknown };
        if (typeof untrusted.attemptId !== "string") continue;
        const record = await store.readAttemptResult<StateBoundChangeResult>(untrusted.attemptId);
        if (record.outcome !== "success") continue;
        const approval = await store.readApproval(record.approvalId);
        const capture = await store.readCapture(approval.semanticChangeId);
        for (const validation of record.result.validations) {
          if (validation.validatorId !== "projector.post-change-knowledge" && validation.validatorId !== "projector.canonical-decision-baselines") continue;
          if (validation.status !== "passed" || !Array.isArray(validation.details.decisionBaselines)) continue;
          for (const item of validation.details.decisionBaselines) {
            const parsed = KnowledgeDecisionBaselineSchema.safeParse(item);
            if (!parsed.success) continue;
            const baseline = parsed.data;
            const mutations = capture.proposal.canonicalMutations?.filter((candidate) => (candidate.kind === "authority-record" && candidate.payload.id === baseline.authorityId) || (candidate.kind === "architecture-decision" && candidate.payload.id === baseline.decisionId)) ?? [];
            const approved = mutations.some((mutation) => {
              if (!("payload" in mutation)) return false;
              const payload = mutation.payload as Record<string, unknown>;
              const envelope = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: mutation.kind, id: String(payload.id), key: String(payload.key), lifecycle: String(payload.status ?? payload.lifecycle), payload });
              return envelope.semanticHash === (mutation.kind === "authority-record" ? baseline.authoritySemanticHash : baseline.decisionSemanticHash);
            });
            if (!approved || capture.planHash !== approval.planHash) continue;
            results.push({ baseline, reference: record.receiptHash ?? record.contentHash, completedAt: record.completedAt });
          }
        }
      } catch { /* An unauthenticated result cannot establish a baseline. */ }
    }
    return results.sort((left, right) => right.completedAt.localeCompare(left.completedAt) || left.reference.localeCompare(right.reference));
  }

  private async git(args: readonly string[]): Promise<string> {
    const environment: NodeJS.ProcessEnv = {};
    for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "TMPDIR", "LANG", "LC_ALL"]) if (process.env[key] !== undefined) environment[key] = process.env[key];
    const nul = process.platform === "win32" ? "NUL" : "/dev/null";
    const { stdout } = await execute("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", "-c", `core.hooksPath=${nul}`, ...args], { cwd: this.observation.repositoryRoot, env: { ...environment, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: nul, GIT_OPTIONAL_LOCKS: "0" }, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 10_000 });
    return stdout;
  }

  private async readGit(decision: ArchitectureDecision, authority: AuthorityRecord): Promise<DecisionBaselineEvidence> {
    try {
      const parse = (text: string): CanonicalDocumentEnvelope => {
        const record = JSON.parse(text) as CanonicalDocumentEnvelope;
        if (verifyCanonicalEnvelope(record).length > 0) throw new Error("tracked canonical baseline failed content authentication");
        return record;
      };
      const files = new CanonicalFileRepository(this.observation.repositoryRoot);
      if ((await this.git(["rev-parse", "--is-shallow-repository"])).trim() === "true") throw new Error("shallow Git history cannot establish the first authority baseline");
      const path = relative(this.observation.repositoryRoot, files.pathFor("authority-record", authority.id)).replaceAll("\\", "/");
      const head = parse(await this.git(["show", `HEAD:${path}`]));
      if (head.semanticHash !== authority.semanticHash) throw new Error("current authority is not recorded at Git HEAD");
      const history = (await this.git(["log", "--format=%H", "--max-count=257", "HEAD", "--", path])).trim().split(/\s+/u).filter(Boolean);
      if (history.length > 256) throw new Error("authority history exceeds the bounded Git baseline search");
      let anchor: string | undefined;
      let anchorAuthority: AuthorityRecord | undefined;
      for (const revision of history) {
        const record = parse(await this.git(["show", `${revision}:${path}`]));
        if (record.semanticHash !== authority.semanticHash) continue;
        anchor = revision;
        anchorAuthority = AuthorityRecordSchema.parse(record.payload) as AuthorityRecord;
      }
      if (anchor === undefined) throw new Error("authority has no tracked semantic baseline");
      const trackedPaths = new Set((await this.git(["ls-tree", "-r", "--name-only", "-z", anchor])).split("\0").filter(Boolean));
      const documents: CanonicalDocumentEnvelope[] = [];
      for (const subjectId of strings(authority.reconsiderWhen.map(triggerSubjectId).filter((id): id is string => id !== undefined))) {
        const current = this.observation.canonical.documents.find(({ id }) => id === subjectId);
        const kinds = current === undefined ? ["concept", "requirement", "behavioral-scenario", "relation", "rule", "projection-lens"] as const : [current.kind];
        for (const kind of kinds) {
            const subjectPath = relative(this.observation.repositoryRoot, files.pathFor(kind as Parameters<CanonicalFileRepository["pathFor"]>[0], subjectId)).replaceAll("\\", "/");
            if (!trackedPaths.has(subjectPath)) continue;
            const record = parse(await this.git(["show", `${anchor}:${subjectPath}`]));
            if (record.id !== subjectId || typeof record.semanticHash !== "string") throw new Error(`tracked trigger subject ${subjectId} cannot be authenticated`);
            documents.push(record); break;
        }
      }
      const paths = [...trackedPaths].filter((path) => path !== ".projector" && !path.startsWith(".projector/"));
      const decisionPath = relative(this.observation.repositoryRoot, files.pathFor("architecture-decision", decision.id)).replaceAll("\\", "/");
      const recordedDecision = parse(await this.git(["show", `${anchor}:${decisionPath}`]));
      if (recordedDecision.semanticHash !== decision.semanticHash) throw new Error("decision changed without an applicable authority baseline");
      return { kind: "tracked-git-history", reference: anchor, baseline: { decisionId: decision.id, decisionSemanticHash: decision.semanticHash, authorityId: authority.id, authoritySemanticHash: authority.semanticHash,
        observations: captureDecisionTriggerObservations(decision, anchorAuthority!, documents, paths, "repository") } };
    } catch (error) {
      return { kind: "unavailable", reason: error instanceof Error ? error.message : String(error) };
    }
  }
}
