import { observationGit, observationGitBytes, readObservationFile, checkObservation } from "@projector/analyzers";
import { lstat } from "node:fs/promises";
import { DerivedObservationBudget, GitIntegrationRequestSchema, GitIntegrationAssessmentSchema, RelationSchema, hashFramedDomain, toCanonicalDocumentWire, type Relation, type CanonicalDocumentEnvelope, type GitIntegrationRequest, type GitIntegrationAssessment, type ObservationLimits } from "@projector/core";
import { classifyCanonicalSource, parseCanonicalSnapshotSources, withObservationScope, type ObservationScope, type CanonicalSnapshot, type CanonicalSnapshotSource } from "@projector/runtime";
import { validateStaticCanonicalGovernance, validateCanonicalRelationEndpoints } from "../knowledge/canonical-governance.js";
import { validateArchitectureProducts } from "../change-lifecycle/architecture-products.js";
import { reconcileIntegrationResult } from "./result-reconciliation.js";

interface Entry { mode: string; type: string; oid: string; path: string }
const gaps = ["Behavioral and dynamic governance verification has not run.", "Independent review, CI completion and merge authorization are not established.", "Arbitrary prose and code compatibility require review.", "Calculated merge trees use built-in Git merge semantics; supplied ordinary-merge results are authoritative."];
function equal(a: Entry | undefined, b: Entry | undefined): boolean { return a?.oid === b?.oid && a?.mode === b?.mode && a?.type === b?.type; }
function change(a: unknown, b: unknown): "added" | "modified" | "removed" { return a === undefined ? "added" : b === undefined ? "removed" : "modified"; }
function status<T>(base: T | undefined, branch: T | undefined, result: T | undefined, same: (a: T | undefined, b: T | undefined) => boolean): "preserved" | "altered" | "lost" {
  if (same(branch, result)) return "preserved";
  if (same(base, result) || (branch !== undefined && result === undefined)) return "lost";
  return "altered";
}
function git(root: string, scope: ObservationScope, args: string[], allowedExitCodes?: number[]) {
  return observationGit(root, args, scope.budget, { signal: scope.signal, stage: "git-integration", ...(allowedExitCodes ? { allowedExitCodes } : {}) });
}
async function resolve(root: string, scope: ObservationScope, ref: string, kind: "commit" | "tree"): Promise<string> {
  return (await git(root, scope, ["rev-parse", "--verify", "--end-of-options", `${ref}^{${kind}}`])).trim();
}
async function entries(root: string, scope: ObservationScope, tree: string, derived: DerivedObservationBudget, executable?: string): Promise<Map<string, Entry>> {
  const raw = await observationGitBytes(root, ["--no-replace-objects", "ls-tree", "-r", "-z", tree, "--", ".projector"], scope.budget, { signal: scope.signal, stage: "git-integration-tree", ...(executable ? { executable } : {}) });
  const result = new Map<string, Entry>();
  for (const record of new TextDecoder("utf-8", { fatal: true }).decode(raw).split("\0")) {
    if (!record) continue;
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error("Malformed Git tree entry");
    scope.budget.consume("maxFiles", 1, "git-integration-tree", match[4]!);
    derived.reserve(256 + record.length * 2, "git-integration-tree", match[4]!);
    result.set(match[4]!, { mode: match[1]!, type: match[2]!, oid: match[3]!, path: match[4]! });
  }
  return result;
}
interface Delta { before: Entry | undefined; after: Entry | undefined }
async function delta(root: string, scope: ObservationScope, base: string, tip: string, derived: DerivedObservationBudget): Promise<Map<string, Delta>> {
  const raw = await observationGitBytes(root, ["diff-tree", "--no-commit-id", "--raw", "-z", "-r", "--no-renames", "--no-ext-diff", "--no-textconv", base, tip, "--"], scope.budget, { signal: scope.signal, stage: "git-integration-delta" });
  const records = new TextDecoder("utf-8", { fatal: true }).decode(raw).split("\0"), result = new Map<string, Delta>();
  for (let index = 0; index < records.length - 1; index += 2) {
    const match = /^:(\d+) (\d+) ([a-f0-9]+) ([a-f0-9]+) [AMD T]+$/.exec(records[index]!);
    const path = records[index + 1]; if (!match || !path) throw new Error("Malformed Git raw delta");
    scope.budget.consume("maxFiles", 1, "git-integration-delta", path);
    derived.reserve(512 + path.length * 4, "git-integration-delta", path);
    const entry = (mode: string, oid: string): Entry | undefined => mode === "000000" ? undefined : { mode, oid, path, type: mode === "160000" ? "commit" : "blob" };
    result.set(path, { before: entry(match[1]!, match[3]!), after: entry(match[2]!, match[4]!) });
  }
  return result;
}
async function canonicalSources(root: string, scope: ObservationScope, tree: Map<string, Entry>, executable?: string): Promise<CanonicalSnapshotSource[]> {
  const selected: Entry[] = [];
  for (const entry of tree.values()) {
    if (entry.path === ".projector") throw new Error("Canonical root is not a real directory");
    if (!entry.path.startsWith(".projector/")) continue;
    const relativePath = entry.path.slice(11);
    const selection = classifyCanonicalSource(relativePath, entry.mode === "120000" ? "symlink" : entry.type === "commit" ? "directory" : "file");
    if (selection === "ignore") continue;
    if (entry.type !== "blob" || entry.mode === "120000") throw new Error(`Unsupported canonical Git entry: ${entry.path}`);
    if (selection === "source") selected.push(entry);
  }
  const sources: CanonicalSnapshotSource[] = [];
  if (selected.length) {
    const input = selected.map(e => e.oid).join("\n") + "\n";
    const sizes = (await observationGit(root, ["--no-replace-objects", "cat-file", "--batch-check"], scope.budget, { signal: scope.signal, stage: "git-integration-object-sizes", input, ...(executable ? { executable } : {}) })).trimEnd().split("\n");
    if (sizes.length !== selected.length) throw new Error("Invalid Git batch object count");
    let total = 0;
    for (let index = 0; index < sizes.length; index++) {
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(sizes[index]!);
      if (!match || match[1] !== selected[index]!.oid) throw new Error(`Missing canonical Git blob: ${selected[index]!.path}`);
      const size = Number(match[2]);
      if (!Number.isSafeInteger(size)) throw new Error("Invalid Git blob size");
      scope.budget.assertFileBytes(size, selected[index]!.path); total += size;
    }
    scope.budget.assertTotalBytes(total, "git-integration-canonical");
    const raw = await observationGitBytes(root, ["--no-replace-objects", "cat-file", "--batch"], scope.budget, { signal: scope.signal, stage: "git-integration-canonical", input, ...(executable ? { executable } : {}) });
    let offset = 0;
    for (const entry of selected) {
      scope.signal.throwIfAborted(); scope.budget.check("git-integration-canonical", entry.path);
      const end = raw.indexOf(10, offset), header = raw.subarray(offset, end).toString("ascii");
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
      if (end < 0 || !match || match[1] !== entry.oid) throw new Error(`Invalid Git object framing: ${entry.path}`);
      const size = Number(match[2]); scope.budget.assertFileBytes(size, entry.path); scope.budget.consume("maxTotalBytes", size, "git-integration-canonical", entry.path);
      offset = end + 1;
      if (!Number.isSafeInteger(size) || offset + size >= raw.length || raw[offset + size] !== 10) throw new Error(`Truncated Git blob: ${entry.path}`);
      const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw.subarray(offset, offset + size)); offset += size + 1;
      sources.push({ path: entry.path, relativePath: entry.path.slice(11), source });
    }
    if (offset !== raw.length) throw new Error("Unexpected Git batch trailing bytes");
  }
  return sources;
}
export async function collectImmutableCanonicalSources(root: string, scope: ObservationScope, tree: string, derived: DerivedObservationBudget, executable?: string): Promise<CanonicalSnapshotSource[]> {
  return canonicalSources(root, scope, await entries(root, scope, tree, derived, executable), executable);
}
async function snapshot(root: string, scope: ObservationScope, tree: Map<string, Entry>, derived: DerivedObservationBudget): Promise<CanonicalSnapshot> {
  const result = parseCanonicalSnapshotSources(await canonicalSources(root, scope, tree), derived);
  const ids = new Set<string>(); for (const doc of result.documents) { if (ids.has(doc.id)) throw new Error(`Duplicate canonical identity: ${doc.id}`); ids.add(doc.id); }
  return result;
}
/** Inspect immutable Git objects. Git may write proposed tree objects, but refs, index and worktree are untouched. */
export async function assessGitIntegration(root: string, input: GitIntegrationRequest, options: { limits?: Partial<ObservationLimits>; signal?: AbortSignal } = {}): Promise<GitIntegrationAssessment> {
  const request = GitIntegrationRequestSchema.parse(input);
  return withObservationScope(options, async scope => {
    const derived = new DerivedObservationBudget(scope.limits.maxDerivedBytes);
    const targetCommit = await resolve(root, scope, request.target, "commit"), incomingCommit = await resolve(root, scope, request.incoming, "commit");
    let baseCommit: string;
    if (request.base !== undefined) {
      baseCommit = await resolve(root, scope, request.base, "commit");
      for (const tip of [targetCommit, incomingCommit]) {
        // --is-ancestor communicates false only by exit status; rev-list supplies a bounded explicit count instead.
        if ((await git(root, scope, ["rev-list", "--count", `${tip}..${baseCommit}`])).trim() !== "0") throw new Error("Explicit integration base must be an ancestor of both commits");
      }
    } else {
      const bases = (await git(root, scope, ["merge-base", "--all", targetCommit, incomingCommit], [1])).trim().split(/\s+/).filter(Boolean);
      if (bases.length !== 1) throw new Error(bases.length ? "Ambiguous integration merge bases; supply an explicit common ancestor" : "Unrelated integration histories have no merge base");
      baseCommit = bases[0]!;
    }
    let resultTree: string, resultCommit: string | undefined; const conflictPaths: string[] = [];
    if (request.result !== undefined) {
      const object = (await git(root, scope, ["rev-parse", "--verify", "--end-of-options", `${request.result}^{object}`])).trim();
      resultTree = await resolve(root, scope, object, "tree");
      const type = (await git(root, scope, ["cat-file", "-t", object])).trim();
      if (type === "commit" || type === "tag") resultCommit = await resolve(root, scope, object, "commit");
    } else {
      const config = await git(root, scope, ["config", "--includes", "--get-regexp", "^(merge[.].*[.]driver|merge[.]renormalize|filter[.].*|core[.]attributesfile)$"], [1]);
      if (config.trim()) throw new Error("Automatic integration calculation does not support custom merge drivers, filters or renormalization; supply an ordinary merge result with result");
      const attributes = (await git(root, scope, ["rev-parse", "--path-format=absolute", "--git-path", "info/attributes"])).trim();
      try {
        await lstat(attributes);
        if ((await readObservationFile(attributes, scope.budget, "git-integration-attributes", scope.signal)).toString("utf8").trim()) throw new Error("Automatic integration calculation does not support repository info/attributes; supply an ordinary merge result with result");
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      const raw = await git(root, scope, ["-c", `core.attributesFile=${process.platform === "win32" ? "NUL" : "/dev/null"}`, `--attr-source=${targetCommit}`, "merge-tree", "--write-tree", "--no-messages", "-z", `--merge-base=${baseCommit}`, targetCommit, incomingCommit], [1]);
      const fields = raw.split("\0"); resultTree = fields.shift()!.trim();
      for (const field of fields) { const match = /^\d+ [a-f0-9]+ [123]\t([\s\S]+)$/.exec(field); if (match && !conflictPaths.includes(match[1]!)) conflictPaths.push(match[1]!); }
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(resultTree)) throw new Error("Git did not return a valid proposed merge tree");
    }
    const base = await entries(root, scope, baseCommit, derived), target = await entries(root, scope, targetCommit, derived), incoming = await entries(root, scope, incomingCommit, derived), result = await entries(root, scope, resultTree, derived);
    const targetDelta = await delta(root, scope, baseCommit, targetCommit, derived), incomingDelta = await delta(root, scope, baseCommit, incomingCommit, derived), resultDelta = await delta(root, scope, baseCommit, resultTree, derived);
    const codeContributions: GitIntegrationAssessment["codeContributions"] = [], changedCodePaths = { target: [] as string[], incoming: [] as string[] };
    for (const [side, branch] of [["target", targetDelta], ["incoming", incomingDelta]] as const) {
      for (const [path, contribution] of branch) {
        const actual = resultDelta.has(path) ? resultDelta.get(path)!.after : contribution.before;
        changedCodePaths[side].push(path); codeContributions.push({ side, path, change: change(contribution.before, contribution.after), status: status(contribution.before, contribution.after, actual, equal) });
      }
    }
    const contributions: GitIntegrationAssessment["contributions"] = [], semanticOverlapIds: string[] = [];
    const canonicalValidation: GitIntegrationAssessment["canonicalValidation"] = { scope: "canonical-record-integrity", status: conflictPaths.length ? "not-assessed" : "passed", issues: [] };
    const assessedAt = new Date().toISOString();
    const staticGovernanceValidation: GitIntegrationAssessment["staticGovernanceValidation"] = { status: "not-assessed", checks: [], issues: [] };
    let resultReconciliation: GitIntegrationAssessment["resultReconciliation"] = { status: "not-assessed", scope: "immutable-result-static-consumers-and-obligations", consumerQueries: [], topologyQueries: [], lensPopulations: [], semanticChanges: [], contradictions: [], unknowns: ["Result source reconciliation requires an unconflicted, valid canonical result."], behavior: { status: "not-assessed", reusable: false } };
    if (!conflictPaths.length) {
      const snapshots = [await snapshot(root, scope, base, derived), await snapshot(root, scope, target, derived), await snapshot(root, scope, incoming, derived)];
      let final: CanonicalSnapshot | undefined;
      try { final = await snapshot(root, scope, result, derived); } catch (error) { if (error instanceof Error && "code" in error) throw error; canonicalValidation.status = "failed"; canonicalValidation.issues.push(error instanceof Error ? error.message : String(error)); }
      if (final) {
        resultReconciliation = await reconcileIntegrationResult(root, scope, derived, [targetCommit, incomingCommit, resultTree], [snapshots[1]!, snapshots[2]!, final], [...targetDelta.keys(), ...incomingDelta.keys(), ...resultDelta.keys()]);
        const [b, t, i, r] = [...snapshots, final].map(s => new Map(s.documents.map(d => [d.id, d])));
        const authored = (d: CanonicalDocumentEnvelope | undefined) => d === undefined ? undefined : hashFramedDomain("git-integration-authored-record-v1", toCanonicalDocumentWire(d));
        for (const [side, branch] of [["target", t!], ["incoming", i!]] as const) {
          for (const id of new Set([...b!.keys(), ...branch.keys()])) {
            const before = b!.get(id), after = branch.get(id), actual = r!.get(id);
            if (authored(before) === authored(after)) continue;
            contributions.push({ side, entityId: id, kind: (after ?? before)!.kind, change: change(before, after), status: status(before, after, actual, (a,b) => authored(a) === authored(b)), ...(before ? { baseSemanticHash: before.semanticHash, baseAuthoredHash: authored(before) } : {}), ...(after ? { branchSemanticHash: after.semanticHash, branchAuthoredHash: authored(after) } : {}), ...(actual ? { resultSemanticHash: actual.semanticHash, resultAuthoredHash: authored(actual) } : {}), documentDrift: after?.canonicalDocumentHash !== actual?.canonicalDocumentHash });
          }
        }
        for (const c of contributions.filter(c => c.side === "target")) if (contributions.some(other => other.side === "incoming" && other.entityId === c.entityId && other.branchAuthoredHash !== c.branchAuthoredHash)) semanticOverlapIds.push(c.entityId);
        try {
          const changedIds = new Set(contributions.map(c => c.entityId));
          for (const id of new Set([...b!.keys(), ...r!.keys()])) if (authored(b!.get(id)) !== authored(r!.get(id))) changedIds.add(id);
          validateArchitectureProducts(final.documents, assessedAt, changedIds);
          const removedIds = new Set([...b!.keys()].filter(id => !r!.has(id)));
          staticGovernanceValidation.issues = validateStaticCanonicalGovernance(final.documents, new Set(r!.keys()), { populationComplete: false, removedIds, derivedBudget: derived });
          staticGovernanceValidation.issues.push(...validateCanonicalRelationEndpoints(final.documents.filter(d => d.kind === "relation").map(d => RelationSchema.parse(d.payload) as Relation), new Set(r!.keys()), { populationComplete: false, removedIds }));
          staticGovernanceValidation.status = staticGovernanceValidation.issues.length ? "incomplete" : "passed";
          staticGovernanceValidation.checks = ["Authored authority, decision, basis and static lens contracts", "Touched architecture product references and constraints", "Canonical schema lineage shape"];
        } catch (error) { if (error instanceof Error && "code" in error) throw error; staticGovernanceValidation.status = "failed"; staticGovernanceValidation.issues.push(error instanceof Error ? error.message : String(error)); }
      }
    }
    const resultOnlyPaths = [...resultDelta].filter(([path, value]) => !equal(value.after, targetDelta.has(path) ? targetDelta.get(path)!.after : value.before) && !equal(value.after, incomingDelta.has(path) ? incomingDelta.get(path)!.after : value.before)).map(([path]) => path);
    checkObservation(scope.budget, scope.signal, "git-integration-complete");
    return GitIntegrationAssessmentSchema.parse({ baseCommit, targetCommit, incomingCommit, resultTree, ...(resultCommit ? { resultCommit } : {}), baseSelection: request.base ? "explicit" : "inferred", resultSource: request.result ? "supplied" : "calculated-merge", status: conflictPaths.length ? "conflicted" : canonicalValidation.status === "failed" || staticGovernanceValidation.status === "failed" || resultReconciliation.status === "failed" ? "invalid" : "review-required", conflictPaths, changedCodePaths, codeContributions, contributions, semanticOverlapIds, resultOnlyPaths, canonicalValidation, staticGovernanceValidation, resultReconciliation, assessedAt, requiresReview: true, verificationGaps: [...gaps, ...staticGovernanceValidation.issues, ...resultReconciliation.unknowns, ...resultReconciliation.contradictions] });
  });
}
