import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  readProtectedKnowledgeContextIds
} from "./shared-NAF7P2ZX.js";
import {
  RepositoryChangeLifecycleService,
  RepositoryKnowledgeService,
  RepositoryRepresentationArtifactStore,
  RepositoryRepresentationInspectionService
} from "./shared-7TU7H6FV.js";
import {
  ChangeLifecycleStore
} from "./shared-BDBDN4N7.js";
import {
  KnowledgeContextStore
} from "./shared-UF33E7SL.js";
import {
  readRepositoryImpactSnapshot
} from "./shared-XUCQQRWD.js";
import {
  DERIVED_CACHE_MAX_BYTES,
  OperationAccessError,
  RepositoryPathService,
  checkDerivedCacheBudget,
  currentObservationScope,
  initializeProjectLocalIgnore,
  installProjectorEditorSchemaBundle,
  parseTomlDocument,
  recoverAbandonedProjectOperationAccess,
  stringifyTomlDocument,
  tryWithProjectExclusiveAccess,
  withDerivedCacheAdmission,
  withObservationScope,
  withProjectOperationAccess
} from "./shared-3WNQLUKU.js";
import {
  BUILT_IN_REPRESENTATION_PROFILES,
  currentBuiltInRepresentationProfile,
  executionCapsuleHash,
  planUpgradeInvalidation,
  reconcileRepresentationProfileUpgrade
} from "./shared-FZTNE5ZL.js";
import {
  ChangeCertificateSchema,
  ChangeProposalSchema,
  ContentHashSchema,
  DEFAULT_OBSERVATION_LIMITS,
  ExecutionPlanSchema,
  PackageIdentitySchema,
  PreparedProjectorConfigSchema,
  ProjectReadinessSchema,
  ProjectorOperationInputSchemas,
  ProjectorOperationSchema,
  RelationSchema,
  TransactionReceiptSchema,
  TransformPreviewSchema,
  TransformResultSchema,
  ValidationResultSchema,
  canonicalJson,
  external_exports,
  hashFramedDomain,
  projectorConfigApiVersion
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/change-lifecycle/transport.js
var reviewRelationSchema = external_exports.object({ fromId: external_exports.string(), toId: external_exports.string(), type: external_exports.string(), active: external_exports.boolean().optional() }).strict();
var reviewMetadataSchema = external_exports.object({ scope: external_exports.unknown().optional(), evidence: external_exports.array(external_exports.unknown()).optional(), relation: reviewRelationSchema.optional() }).strict();
var intentSubjectSchema = external_exports.object({ id: external_exports.string(), kind: external_exports.enum(["requirement", "scenario"]), operation: external_exports.enum(["preserve", "add", "revise"]), before: reviewMetadataSchema.optional(), after: reviewMetadataSchema.optional(), rationale: external_exports.string().nullable() }).strict();
var intentMutationSchema = external_exports.object({ id: external_exports.string(), kind: external_exports.enum(["requirement", "behavioral-scenario", "concept", "relation", "lineage", "tombstone", "architecture-decision", "architecture-concern", "developer-preference", "projection-lens", "authority-record"]), operation: external_exports.enum(["add", "revise", "retire"]), before: reviewMetadataSchema.optional(), after: reviewMetadataSchema.optional(), rationale: external_exports.string() }).strict();
var identityResolutionSummarySchema = external_exports.object({ contextId: external_exports.string(), contextHash: ContentHashSchema, outcome: external_exports.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity"]), selectedEntityIds: external_exports.array(external_exports.string()), rationale: external_exports.string(), newBoundary: external_exports.object({ owns: external_exports.array(external_exports.string()), excludes: external_exports.array(external_exports.string()), nearestEntityIds: external_exports.array(external_exports.string()), rationale: external_exports.string() }).strict().optional() }).strict();
var RepositoryIntentReviewSummarySchema = external_exports.object({
  subjects: external_exports.array(intentSubjectSchema),
  identityResolution: identityResolutionSummarySchema.optional(),
  relations: external_exports.array(RelationSchema),
  canonicalMutations: external_exports.array(intentMutationSchema),
  relatedObligations: external_exports.array(external_exports.object({ id: external_exports.string(), kind: external_exports.string() }).strict()),
  unknowns: external_exports.array(external_exports.string()),
  blockingUnknowns: external_exports.array(external_exports.string()),
  contentHash: ContentHashSchema
}).strict();
function reviewMetadata(value) {
  if (value === null)
    return void 0;
  const source = value;
  const result = {};
  if (source.scope !== void 0)
    result.scope = source.scope;
  if (Array.isArray(source.evidence))
    result.evidence = source.evidence;
  if (typeof source.fromId === "string" && typeof source.toId === "string" && typeof source.type === "string") {
    result.relation = { fromId: source.fromId, toId: source.toId, type: source.type, ...typeof source.active === "boolean" ? { active: source.active } : {} };
  }
  return Object.keys(result).length === 0 ? void 0 : reviewMetadataSchema.parse(result);
}
var LifecycleCaptureOutputSchema = external_exports.object({ kind: external_exports.literal("lifecycle-change"), selector: external_exports.string(), immutablePlanHash: ContentHashSchema, proposalHash: ContentHashSchema, knowledgeContextId: external_exports.string().min(1).optional() }).strict();
var LifecyclePlanOutputSchema = external_exports.object({ kind: external_exports.literal("lifecycle-plan"), selector: external_exports.string(), immutablePlanHash: ContentHashSchema, preview: external_exports.object({ proposal: ChangeProposalSchema, proposalHash: ContentHashSchema, expectedDiff: external_exports.string(), intentReview: RepositoryIntentReviewSummarySchema }).strict(), plan: ExecutionPlanSchema }).strict().superRefine((value, context) => {
  if (value.preview.proposalHash !== hashFramedDomain("repository-change-proposal", value.preview.proposal))
    context.addIssue({ code: "custom", message: "proposal hash does not authenticate the public review payload", path: ["preview", "proposalHash"] });
});
var LifecycleApprovalOutputSchema = external_exports.object({ kind: external_exports.literal("lifecycle-approval"), selector: external_exports.string(), changeSelector: external_exports.string(), immutablePlanHash: ContentHashSchema }).strict();
var LifecycleRecoveryOutcomeSchema = external_exports.object({ attemptId: external_exports.string(), transactionId: external_exports.string(), action: external_exports.enum(["finalized", "rolled-back", "no-transaction", "recovery-required"]), reason: external_exports.string().optional() }).strict();
var LifecycleRecoveryOutputSchema = external_exports.object({ kind: external_exports.literal("lifecycle-recovery"), selector: external_exports.string(), outcomes: external_exports.array(LifecycleRecoveryOutcomeSchema) }).strict();
var StateBoundChangeResultSchema = external_exports.object({
  outcome: external_exports.enum(["success", "failure", "partial"]),
  reasons: external_exports.array(external_exports.string()),
  preview: TransformPreviewSchema.optional(),
  transformResult: TransformResultSchema.optional(),
  validations: external_exports.array(ValidationResultSchema),
  certificate: ChangeCertificateSchema,
  certificateHash: ContentHashSchema,
  certificateRef: external_exports.string(),
  receipt: TransactionReceiptSchema,
  receiptHash: ContentHashSchema,
  receiptRef: external_exports.string()
}).strict();
var LifecycleApplyOutputSchema = StateBoundChangeResultSchema.extend({ kind: external_exports.literal("lifecycle-apply"), selector: external_exports.string() });
function summarizeRepositoryIntentReview(review) {
  return RepositoryIntentReviewSummarySchema.parse({
    subjects: review.subjects.map(({ id, kind, operation, before, after, rationale }) => ({ id, kind, operation, ...reviewMetadata(before) === void 0 ? {} : { before: reviewMetadata(before) }, ...reviewMetadata(after) === void 0 ? {} : { after: reviewMetadata(after) }, rationale })),
    ...review.identityResolution === void 0 ? {} : { identityResolution: review.identityResolution },
    relations: review.relations,
    canonicalMutations: (review.canonicalMutations ?? []).map(({ id, kind, operation, before, after, rationale }) => ({ id, kind, operation, ...reviewMetadata(before) === void 0 ? {} : { before: reviewMetadata(before) }, ...reviewMetadata(after) === void 0 ? {} : { after: reviewMetadata(after) }, rationale })),
    relatedObligations: review.relatedObligations.map(({ id, kind }) => ({ id, kind })),
    unknowns: review.unknowns,
    blockingUnknowns: review.blockingUnknowns,
    contentHash: review.contentHash
  });
}
function projectLifecycleCapture(value) {
  return LifecycleCaptureOutputSchema.parse({ kind: "lifecycle-change", selector: value.capture.semanticChangeId, immutablePlanHash: value.capture.planHash, proposalHash: value.capture.proposalHash, ...value.capture.knowledgeContextId === void 0 ? {} : { knowledgeContextId: value.capture.knowledgeContextId } });
}
function projectLifecyclePlan(selector, value) {
  return LifecyclePlanOutputSchema.parse({ kind: "lifecycle-plan", selector, immutablePlanHash: value.capture.planHash, preview: { proposal: value.capture.proposal, proposalHash: value.capture.proposalHash, expectedDiff: expectedDiff(value.compiled), intentReview: summarizeRepositoryIntentReview(value.compiled.intentReview) }, plan: value.compiled.compiledPlan.plan });
}
function projectLifecycleApproval(value) {
  return LifecycleApprovalOutputSchema.parse({ kind: "lifecycle-approval", selector: value.id, changeSelector: value.semanticChangeId, immutablePlanHash: value.planHash });
}
function projectLifecycleApply(selector, value) {
  return LifecycleApplyOutputSchema.parse({ kind: "lifecycle-apply", selector, ...value });
}
function projectLifecycleRecovery(selector, outcomes) {
  return LifecycleRecoveryOutputSchema.parse({ kind: "lifecycle-recovery", selector, outcomes });
}
function expectedDiff(compiled) {
  return compiled.exactPatchInput.edits.map(({ path, before, after }) => `${before === null ? "create" : after === null ? "delete" : "replace"} ${path}`).join("\n");
}

// node_modules/@projector/control-plane/dist/repository-check/service.js
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
var gitExec = promisify(execFile);
var cachePath = ".projector/runtime/repository-check/state.json";
var lockPath = ".projector/runtime/repository-check/check.lock";
var pathSchema = external_exports.string().min(1).max(4096);
var headSchema = external_exports.string().regex(/^[a-f0-9]{40,64}$/u).nullable();
var observationSchema = external_exports.strictObject({
  head: headSchema,
  evidenceIdentity: ContentHashSchema,
  stagedIdentity: ContentHashSchema,
  files: external_exports.array(external_exports.strictObject({ path: pathSchema, identity: ContentHashSchema })).max(1e4)
});
var pendingSchema = external_exports.strictObject({
  findingId: external_exports.string().min(1).max(128),
  evidenceIdentity: ContentHashSchema,
  fromHead: headSchema,
  toHead: headSchema,
  baselineEvidenceIdentity: ContentHashSchema.nullable(),
  paths: external_exports.array(pathSchema).max(100),
  omittedPaths: external_exports.number().int().nonnegative()
});
var RepositoryCheckOutputSchema = external_exports.strictObject({
  status: external_exports.enum(["unchanged", "changed", "no previous observation", "incomplete"]),
  observation: external_exports.strictObject({ head: headSchema, evidenceIdentity: ContentHashSchema }).optional(),
  pending: pendingSchema.optional(),
  offer: external_exports.boolean(),
  limitations: external_exports.array(external_exports.string()).max(16),
  nextAction: external_exports.string()
});
var stateSchema = external_exports.strictObject({
  version: external_exports.literal(1),
  observation: observationSchema,
  pending: pendingSchema.optional(),
  offeredSessions: external_exports.array(ContentHashSchema).max(128)
});
function included(path) {
  return path !== ".projector/runtime" && !path.startsWith(".projector/runtime/");
}
function isCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
async function checkRepository(repositoryRoot, rawInput = {}, options = {}) {
  const input = ProjectorOperationInputSchemas["repository.check"].parse(rawInput);
  const deadline = performance.now() + (options.maxMilliseconds ?? 5e3);
  const checkpoint = () => {
    options.signal?.throwIfAborted();
    if (performance.now() >= deadline)
      throw new Error("Repository check elapsed-time bound exceeded");
  };
  let paths;
  let lock;
  let lockTarget;
  let state;
  let storedState;
  const limitations = ["Change evidence is not a design-conformance assessment; previous uncommitted bytes are not retained.", "Offer deduplication remembers the last 128 offered sessions.", "omittedPaths is a lower bound across coalesced updates; omitted path identities are not retained."];
  const result = (status, offer, nextAction) => ({
    status,
    offer,
    limitations,
    nextAction,
    ...state === void 0 ? {} : { observation: { head: state.observation.head, evidenceIdentity: state.observation.evidenceIdentity } },
    ...state?.pending === void 0 ? {} : { pending: state.pending }
  });
  try {
    checkpoint();
    paths = await RepositoryPathService.create(repositoryRoot);
    const safePaths = paths;
    lockTarget = (await paths.resolveWrite(lockPath)).realTarget;
    await mkdir(dirname(lockTarget), { recursive: true });
    lockTarget = (await paths.resolveWrite(lockPath)).realTarget;
    checkpoint();
    lock = await open(lockTarget, "wx", 384);
    await lock.writeFile(JSON.stringify({ processId: process.pid }));
    const readBounded = async (path, limit) => {
      checkpoint();
      const target = (await safePaths.resolveRead(path)).realTarget;
      const handle2 = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const before = await handle2.stat();
        if (!before.isFile())
          throw new Error(`Repository check refuses nonregular file: ${path}`);
        if (before.size > limit)
          throw new Error(`Repository check byte bound exceeded: ${path}`);
        const bytes = Buffer.alloc(Math.min(before.size + 1, limit + 1));
        let offset = 0;
        while (offset < bytes.length) {
          checkpoint();
          const { bytesRead } = await handle2.read(bytes, offset, Math.min(65536, bytes.length - offset), offset);
          if (bytesRead === 0)
            break;
          offset += bytesRead;
        }
        const after = await handle2.stat();
        if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
          throw new Error(`Repository file changed during observation: ${path}`);
        }
        return bytes.subarray(0, offset);
      } finally {
        await handle2.close();
      }
    };
    try {
      state = stateSchema.parse(JSON.parse((await readBounded(cachePath, 4 * 1024 * 1024)).toString("utf8")));
      const { evidenceIdentity, ...basis } = state.observation;
      if (hashFramedDomain("repository-check-observation", basis) !== evidenceIdentity)
        throw new Error("Repository observation cache identity is invalid");
      if (state.pending !== void 0 && (state.pending.evidenceIdentity !== evidenceIdentity || state.pending.toHead !== state.observation.head))
        throw new Error("Pending finding is not bound to its cached observation");
      storedState = structuredClone(state);
    } catch (error) {
      if (!isCode(error, "ENOENT"))
        throw error;
    }
    const git = async (args) => {
      checkpoint();
      const environment = {};
      for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "LANG", "LC_ALL"]) {
        if (process.env[key] !== void 0)
          environment[key] = process.env[key];
      }
      const { stdout } = await gitExec("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
        cwd: safePaths.root,
        encoding: "utf8",
        timeout: Math.max(1, Math.floor(deadline - performance.now())),
        maxBuffer: options.maxGitBytes ?? 1024 * 1024,
        env: { ...environment, GIT_OPTIONAL_LOCKS: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" },
        ...options.signal === void 0 ? {} : { signal: options.signal }
      });
      checkpoint();
      return stdout;
    };
    const head = async () => {
      if (await realpath((await git(["rev-parse", "--show-toplevel"])).trim()) !== safePaths.root)
        throw new Error("Repository check root must be the Git checkout root");
      const refs = await git(["rev-parse", "--revs-only", "HEAD"]);
      return headSchema.parse(refs.trim() || null);
    };
    const currentHead = await head();
    const previous = state?.observation;
    let status = "unchanged";
    if (input.mode !== "commit-only" || input.handled !== void 0 || previous === void 0 || previous.head !== currentHead) {
      const pathspec = ["--", ".", ":(exclude).projector/runtime", ":(exclude).projector/runtime/**"];
      const staged = await git(["diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
      const enumerate = async () => {
        const dirty = await git(["diff", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
        const indexed = await git(["diff", "--cached", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
        const untracked = await git(["ls-files", "--others", "--exclude-standard", "-z", ...pathspec]);
        return [...new Set(`${dirty}${indexed}${untracked}`.split("\0").filter((path) => path && included(path)))].sort();
      };
      const names = await enumerate();
      if (names.length > Math.min(options.maxPaths ?? 1e4, 1e4))
        throw new Error("Repository check path bound exceeded");
      const files = [];
      const stamps = /* @__PURE__ */ new Map();
      const stamp = async (path) => {
        try {
          const stat = await lstat((await safePaths.resolveRead(path)).realTarget);
          return canonicalJson({ size: stat.size, mode: stat.mode, mtime: stat.mtimeMs, ctime: stat.ctimeMs, inode: stat.ino });
        } catch (error) {
          if (isCode(error, "ENOENT"))
            return null;
          throw error;
        }
      };
      let total = 0;
      for (const path of names) {
        pathSchema.parse(path);
        let identity;
        const beforeStamp = await stamp(path);
        try {
          const content = await readBounded(path, Math.min(options.maxFileBytes ?? 8 * 1024 * 1024, (options.maxTotalBytes ?? 32 * 1024 * 1024) - total));
          total += content.length;
          const mode = (await lstat((await safePaths.resolveRead(path)).realTarget)).mode;
          identity = hashFramedDomain("repository-check-file", content.toString("base64"), mode);
        } catch (error) {
          if (!isCode(error, "ENOENT"))
            throw error;
          identity = hashFramedDomain("repository-check-deleted", path);
        }
        files.push({ path, identity });
        if (beforeStamp !== await stamp(path))
          throw new Error(`Repository file changed during observation: ${path}`);
        stamps.set(path, beforeStamp);
      }
      if (currentHead !== await head() || canonicalJson(names) !== canonicalJson(await enumerate()) || staged !== await git(["diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "-z", ...pathspec])) {
        throw new Error("Repository changed during observation; retry a full check");
      }
      for (const [path, observedStamp] of stamps) {
        checkpoint();
        if (await stamp(path) !== observedStamp)
          throw new Error(`Repository file changed during observation: ${path}`);
      }
      const basis = { head: currentHead, stagedIdentity: hashFramedDomain("repository-check-index", staged), files };
      const observation = { ...basis, evidenceIdentity: hashFramedDomain("repository-check-observation", basis) };
      status = previous === void 0 ? "no previous observation" : previous.evidenceIdentity === observation.evidenceIdentity ? "unchanged" : "changed";
      if (status !== "unchanged") {
        const changedPaths = new Set(state?.pending?.paths ?? []);
        const beforeFiles = new Map(previous?.files.map((entry) => [entry.path, entry.identity]));
        const afterFiles = new Map(files.map((entry) => [entry.path, entry.identity]));
        for (const path of /* @__PURE__ */ new Set([...beforeFiles.keys(), ...afterFiles.keys()])) {
          if (beforeFiles.get(path) !== afterFiles.get(path) || previous?.stagedIdentity !== observation.stagedIdentity)
            changedPaths.add(path);
        }
        if (previous?.head !== null && previous?.head !== void 0 && currentHead !== null && previous.head !== currentHead) {
          for (const path of (await git(["diff", "--name-only", "--no-renames", "--no-ext-diff", "-z", previous.head, currentHead, ...pathspec])).split("\0").filter(Boolean))
            changedPaths.add(pathSchema.parse(path));
        }
        const sorted = [...changedPaths].sort();
        state = {
          version: 1,
          observation,
          offeredSessions: state?.pending === void 0 ? [] : state.offeredSessions,
          pending: {
            findingId: state?.pending?.findingId ?? `repository_finding_${observation.evidenceIdentity.slice(-32)}`,
            evidenceIdentity: observation.evidenceIdentity,
            fromHead: state?.pending === void 0 ? previous?.head ?? null : state.pending.fromHead,
            toHead: currentHead,
            baselineEvidenceIdentity: state?.pending === void 0 ? previous?.evidenceIdentity ?? null : state.pending.baselineEvidenceIdentity,
            paths: sorted.slice(0, 100),
            omittedPaths: Math.max(state?.pending?.omittedPaths ?? 0, sorted.length - 100, 0)
          }
        };
      }
    } else
      limitations.push("Commit-only check skipped staged and working-tree observation because HEAD is unchanged.");
    if (state === void 0)
      throw new Error("Repository check did not establish an observation");
    if (input.handled !== void 0) {
      if (state.pending?.findingId !== input.handled.findingId || state.pending.evidenceIdentity !== input.handled.evidenceIdentity) {
        limitations.push("Handled evidence does not match the current pending finding; the finding remains open.");
        status = "incomplete";
      } else {
        const { pending: _pending, ...retained } = state;
        state = retained;
      }
    }
    const session = input.sessionId === void 0 ? void 0 : hashFramedDomain("repository-check-session", input.sessionId);
    const offer = state.pending !== void 0 && (session === void 0 || !state.offeredSessions.includes(session));
    if (offer && session !== void 0)
      state.offeredSessions = [...state.offeredSessions, session].slice(-128);
    checkpoint();
    const nextAction = state.pending === void 0 ? "No pending investigation. Handling does not approve design." : "Investigate the pending finding against its HEAD anchors and current diff; mark handled only with its exact findingId and evidenceIdentity after investigation.";
    if (storedState !== void 0 && canonicalJson(storedState) === canonicalJson(state))
      return result(status, offer, nextAction);
    const destination = (await safePaths.resolveWrite(cachePath)).realTarget;
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    const temporary = (await safePaths.resolveWrite(temporaryPath)).realTarget;
    const serialized = canonicalJson(stateSchema.parse(state));
    if (Buffer.byteLength(serialized) > 4 * 1024 * 1024)
      throw new Error("Repository observation cache byte bound exceeded");
    const handle = await open(temporary, "wx", 384);
    try {
      await handle.writeFile(serialized);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      checkpoint();
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
    return result(status, offer, nextAction);
  } catch (error) {
    state = storedState;
    limitations.push(error instanceof Error ? error.message.slice(0, 2048) : String(error).slice(0, 2048));
    return result("incomplete", false, isCode(error, "EEXIST") ? "A repository check lock or temporary file exists. Retry; for an interrupted owner, verify that its process has stopped before removing only its runtime lock or temporary file." : "Preserved prior observation and pending finding. Address the reported limitation and retry a full repository.check; do not infer conformance.");
  } finally {
    if (lock !== void 0) {
      await lock.close();
      if (lockTarget !== void 0)
        await rm(lockTarget, { force: true });
    }
  }
}

// node_modules/@projector/control-plane/dist/readiness/service.js
import { randomBytes } from "node:crypto";
import { constants as constants2 } from "node:fs";
import { link, lstat as lstat2, mkdir as mkdir2, open as open2, rm as rm2 } from "node:fs/promises";
import { dirname as dirname2, join } from "node:path";

// node_modules/@projector/control-plane/dist/knowledge/cache-maintenance.js
import { basename } from "node:path";
async function maintainDerivedCache(root, options = {}) {
  const target = options.targetBytes ?? Math.floor(DERIVED_CACHE_MAX_BYTES * 0.75);
  if (!Number.isSafeInteger(target) || target < 0 || target > DERIVED_CACHE_MAX_BYTES)
    throw new RangeError("Invalid cache maintenance target");
  const preservedIds = (options.preserveContextIds ?? []).map((id) => {
    const match = /^(?:knowledge_context_)?([0-9a-f]{32})$/u.exec(id);
    if (match === null)
      throw new Error(`Invalid preserved context identity: ${id}`);
    return `knowledge_context_${match[1]}`;
  });
  const result = await tryWithProjectExclusiveAccess(root, "derived-cache-maintenance", async (access) => {
    const budget = options.budget ?? { deadline: Date.now() + 5e3, remainingEntries: 1e4, remainingBytes: (currentObservationScope()?.limits ?? DEFAULT_OBSERVATION_LIMITS).maxDerivedBytes };
    return withObservationScope({ signal: access.signal, limits: { timeoutMs: Math.max(1, budget.deadline - Date.now()) } }, async () => withDerivedCacheAdmission(root, async (cache) => {
      if (cache.totalBytes <= target && cache.entries.every(({ kind }) => kind !== "staging"))
        return { status: "unchanged", removedEntries: 0, retainedBytes: cache.totalBytes };
      const protectedIds = /* @__PURE__ */ new Set([...await readProtectedKnowledgeContextIds(root, budget, access.signal), ...preservedIds]);
      const store = await KnowledgeContextStore.create(root);
      const contextDependencies = /* @__PURE__ */ new Map();
      const protectedPaths = /* @__PURE__ */ new Set();
      const referencedBy = /* @__PURE__ */ new Map();
      const entries = new Map(cache.entries.map((entry) => [entry.relativePath, entry]));
      const retained = /* @__PURE__ */ new Map();
      const references = /* @__PURE__ */ new Map();
      let retainedBytes = 0;
      const retain = (entry) => {
        if (!retained.has(entry.relativePath)) {
          retained.set(entry.relativePath, entry);
          retainedBytes += entry.bytes;
        }
      };
      const forget = (path) => {
        const entry = retained.get(path);
        if (entry !== void 0) {
          retained.delete(path);
          retainedBytes -= entry.bytes;
        }
      };
      for (const id of protectedIds) {
        const path = `.projector/runtime/knowledge/contexts/${id.slice("knowledge_context_".length)}.json`;
        const entry = entries.get(path);
        if (entry === void 0)
          throw new Error(`Protected context ${id} is missing; recover or refresh its lifecycle before cache maintenance`);
        protectedPaths.add(path);
        retain(entry);
      }
      const newestContexts = cache.entries.filter(({ kind }) => kind === "context").sort((a, b) => b.lastUsedMs - a.lastUsedMs || a.relativePath.localeCompare(b.relativePath));
      for (const entry of newestContexts) {
        if (!protectedPaths.has(entry.relativePath) && retainedBytes + entry.bytes <= target)
          retain(entry);
      }
      let remainingPayloadBytes = DERIVED_CACHE_MAX_BYTES;
      for (const entry of [...retained.values()]) {
        remainingPayloadBytes -= entry.bytes;
        if (remainingPayloadBytes < 0)
          throw new Error("Protected or selected cache payloads exceed the 256 MiB inspection bound; narrow the retention target or finish protected operations before retrying");
        checkDerivedCacheBudget(budget);
        const id = `knowledge_context_${basename(entry.relativePath, ".json")}`;
        const context = await store.read(id, false);
        if (context.impactBaseline !== void 0) {
          const dependency = `.projector/runtime/impact/${context.impactBaseline.contentHash.slice("sha256:v1:".length)}.json`;
          const snapshot = entries.get(dependency);
          if (snapshot === void 0)
            throw new Error(`Retained context ${id} is missing its impact dependency; refresh it before cache maintenance`);
          const prior = references.get(dependency);
          if (prior !== void 0 && JSON.stringify(prior) !== JSON.stringify(context.impactBaseline))
            throw new Error(`Retained contexts disagree about their shared impact reference: ${dependency}`);
          references.set(dependency, context.impactBaseline);
          contextDependencies.set(entry.relativePath, dependency);
          const users = referencedBy.get(dependency) ?? /* @__PURE__ */ new Set();
          users.add(entry.relativePath);
          referencedBy.set(dependency, users);
          retain(snapshot);
        }
        checkDerivedCacheBudget(budget);
      }
      for (const entry of [...newestContexts].reverse()) {
        if (retainedBytes <= target)
          break;
        if (!retained.has(entry.relativePath) || protectedPaths.has(entry.relativePath))
          continue;
        forget(entry.relativePath);
        const dependency = contextDependencies.get(entry.relativePath);
        if (dependency !== void 0) {
          const users = referencedBy.get(dependency);
          users.delete(entry.relativePath);
          if (users.size === 0)
            forget(dependency);
        }
      }
      for (const entry of retained.values()) {
        if (entry.kind !== "impact")
          continue;
        remainingPayloadBytes -= entry.bytes;
        if (remainingPayloadBytes < 0)
          throw new Error("Retained cache proof exceeds the 256 MiB inspection bound; narrow the retention target before retrying");
        checkDerivedCacheBudget(budget);
        await readRepositoryImpactSnapshot(root, references.get(entry.relativePath), false);
      }
      const selected = cache.entries.filter((entry) => !retained.has(entry.relativePath)).sort((a, b) => Number(a.kind === "impact") - Number(b.kind === "impact") || a.relativePath.localeCompare(b.relativePath));
      checkDerivedCacheBudget(budget);
      await access.assertOwned();
      for (const entry of selected) {
        access.signal.throwIfAborted();
        checkDerivedCacheBudget(budget);
        await cache.remove(entry);
      }
      return { status: selected.length === 0 ? "unchanged" : "collected", removedEntries: selected.length, retainedBytes: cache.totalBytes };
    }, { signal: access.signal, budget }));
  }, options.signal);
  return result.acquired ? result.value : { status: "busy", removedEntries: 0 };
}

// node_modules/@projector/control-plane/dist/readiness/service.js
var preparedConfigPath = join(".projector", "config.toml");
var maximumConfigBytes = 16 * 1024;
var PreparedProjectInitializationResultSchema = external_exports.strictObject({
  readiness: ProjectReadinessSchema,
  created: external_exports.boolean()
});
async function initializePreparedProject(repositoryRoot, input) {
  PackageIdentitySchema.parse(input.package);
  throwIfAborted(input.signal);
  const initial = await inspectProjectReadiness(repositoryRoot, { operation: "init", ...input });
  if (initial.status !== "inactive")
    return { readiness: initial, created: false };
  const paths = await RepositoryPathService.create(repositoryRoot);
  const projectorDirectory = (await paths.resolveWrite(".projector")).realTarget;
  try {
    await mkdir2(projectorDirectory);
  } catch (error) {
    if (!isCode2(error, "EEXIST"))
      throw error;
  }
  const projectorStatus = await lstat2(projectorDirectory);
  if (projectorStatus.isSymbolicLink() || !projectorStatus.isDirectory())
    throw new Error(".projector must be a real directory");
  await syncDirectory(paths.root);
  return withProjectOperationAccess(repositoryRoot, { operation: "init", mode: "exclusive", ...input.signal === void 0 ? {} : { signal: input.signal } }, async () => {
    const current = await inspectProjectReadiness(repositoryRoot, { operation: "init", ...input });
    if (current.status !== "inactive")
      return { readiness: current, created: false };
    await initializeProjectLocalIgnore(repositoryRoot);
    await installProjectorEditorSchemaBundle(repositoryRoot);
    await publishPreparedIndex(paths);
    throwIfAborted(input.signal);
    await publishPreparedConfig(paths, input.package);
    const ready = await inspectProjectReadiness(repositoryRoot, { operation: "init", ...input });
    if (ready.status !== "ready")
      throw new Error(ready.reason ?? "Prepared Projector configuration did not become ready");
    return { readiness: ready, created: true };
  });
}
async function inspectProjectReadiness(repositoryRoot, input) {
  validateInput(input);
  throwIfAborted(input.signal);
  let paths;
  try {
    paths = await RepositoryPathService.create(repositoryRoot);
  } catch (error) {
    return readiness(input.package, "unavailable", `Projector repository root is unavailable: ${message(error)}`);
  }
  const prepared = await readRepositoryMetadata(paths, preparedConfigPath.replaceAll("\\", "/"));
  const legacy = await readRepositoryMetadata(paths, ".projector/config.json");
  const pending = await readRepositoryMetadata(paths, ".projector/pending-project-data-migration.json");
  throwIfAborted(input.signal);
  for (const marker of [legacy, pending])
    if (marker.status === "unsafe")
      return readiness(input.package, "unavailable", marker.reason);
  if (pending.status === "present")
    return ProjectReadinessSchema.parse({
      status: "recovery-required",
      package: input.package,
      reason: "A pre-cutover operation has unfinished evidence.",
      recovery: { code: "project-data-cutover-required", location: ".projector/pending-project-data-migration.json", action: "Inspect the retained operation with its matching pre-cutover runtime before a checked cutover. Preserve its evidence." }
    });
  if (legacy.status === "present")
    return readiness(input.package, "unavailable", "Unsupported legacy or mixed Projector configuration remains untouched; use a checked format cutover.");
  if (prepared.status === "missing")
    return readiness(input.package, "inactive", "Projector is not active in this repository");
  if (prepared.status === "unsafe")
    return readiness(input.package, "unavailable", prepared.reason);
  if (prepared.status === "present")
    return inspectPreparedConfig(prepared.source, input.package, join(repositoryRoot, preparedConfigPath));
  return readiness(input.package, "unavailable", "Projector configuration metadata could not be classified");
}
async function withProjectOperationAccess2(repositoryRoot, input, callback) {
  const initial = await inspectProjectReadiness(repositoryRoot, input);
  if (initial.status !== "ready")
    return { readiness: initial };
  try {
    if (input.operation === "change.recover" || input.operation === "operation-access.recover") {
      await recoverAbandonedProjectOperationAccess(repositoryRoot, input.signal);
    }
    if (input.operation === "context" || input.operation === "change.capture" || input.operation === "change.plan") {
      await maintainDerivedCache(repositoryRoot, input.signal === void 0 ? {} : { signal: input.signal });
    }
    return await withProjectOperationAccess(repositoryRoot, { operation: input.operation, mode: "shared", ...input.signal === void 0 ? {} : { signal: input.signal } }, async ({ signal }) => {
      const current = await inspectProjectReadiness(repositoryRoot, input);
      if (current.status !== "ready")
        return { readiness: current };
      const ready = current;
      return { readiness: ready, value: await callback({ readiness: ready, signal }) };
    });
  } catch (error) {
    if (!(error instanceof OperationAccessError) || error.code === "access-aborted")
      throw error;
    return {
      readiness: ProjectReadinessSchema.parse({
        status: error.code === "access-corrupt" ? "recovery-required" : "unavailable",
        package: input.package,
        reason: error.message,
        ...error.code === "access-corrupt" ? {
          recovery: {
            code: "operation-access-corrupt",
            action: "Run operation-access.recover to reclaim a recognized abandoned claim before retrying"
          }
        } : {}
      })
    };
  }
}
function inspectPreparedConfig(source, packageIdentity, path) {
  let value;
  try {
    value = parseTomlDocument(source, path);
  } catch (error) {
    return readiness(packageIdentity, "unavailable", `Prepared Projector configuration is malformed: ${message(error)}`);
  }
  const result = PreparedProjectorConfigSchema.safeParse(value);
  if (!result.success)
    return readiness(packageIdentity, "unavailable", `Projector requires current authored format ${projectorConfigApiVersion}. Preserve unsupported data for the documented cutover. Configuration detail: ${result.error.message}`);
  const observed = { configApiVersion: result.data.apiVersion, preparedProjectorVersion: result.data.projectorVersion };
  return ProjectReadinessSchema.parse({ status: "ready", package: packageIdentity, observed });
}
async function readBoundedMetadata(path) {
  try {
    const pathStatus = await lstat2(path);
    if (!pathStatus.isFile() || pathStatus.isSymbolicLink())
      return { status: "unsafe", reason: `${path} must be a regular non-symlink file` };
    if (pathStatus.size > maximumConfigBytes)
      return { status: "unsafe", reason: `${path} exceeds ${maximumConfigBytes} bytes` };
    const handle = await open2(path, constants2.O_RDONLY | constants2.O_NOFOLLOW);
    try {
      const handleStatus = await handle.stat();
      if (!handleStatus.isFile() || handleStatus.size > maximumConfigBytes)
        return { status: "unsafe", reason: `${path} changed during bounded inspection` };
      return { status: "present", source: await handle.readFile("utf8") };
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (isCode2(error, "ENOENT"))
      return { status: "missing" };
    return { status: "unsafe", reason: `Projector configuration metadata is unavailable at ${path}: ${message(error)}` };
  }
}
async function readRepositoryMetadata(paths, relativePath) {
  try {
    return await readBoundedMetadata((await paths.resolveRead(relativePath)).realTarget);
  } catch (error) {
    return { status: "unsafe", reason: `Projector configuration path is unsafe at ${relativePath}: ${message(error)}` };
  }
}
async function publishPreparedIndex(paths) {
  const contents = "# Project meaning\n\nRead concepts and requirements first. Scenarios describe observable checks; decisions and rationale explain consequential choices. Add records only when they preserve meaning needed by later work.\n\n- [Concepts](model/concepts/)\n- [Requirements](model/requirements/)\n- [Scenarios](model/scenarios/)\n- [Concerns](concerns/)\n- [Decisions](decisions/)\n- [Rationale](authorities/)\n- [Typed relationships](model/relations/)\n\nThese directories appear as records are accepted. Keep useful navigation here. Stable identities live inside records independently of filenames. Runtime receipts and recovery evidence stay under `runtime/`; use `projector inspect` when needed.\n";
  await publishPreparedFile(paths, ".projector/README.md", contents, true);
}
async function publishPreparedConfig(paths, packageIdentity) {
  const config = PreparedProjectorConfigSchema.parse({
    apiVersion: projectorConfigApiVersion,
    enabled: true,
    projectorVersion: packageIdentity.version
  });
  const contents = stringifyTomlDocument(config, { schemaPath: "schemas/projector-config-v3.schema.json" });
  await publishPreparedFile(paths, preparedConfigPath.replaceAll("\\", "/"), contents);
}
async function publishPreparedFile(paths, relativePath, contents, preserveExisting = false) {
  const target = (await paths.resolveWrite(relativePath)).realTarget;
  const temporary = join(dirname2(target), `.config.${randomBytes(12).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open2(temporary, constants2.O_CREAT | constants2.O_EXCL | constants2.O_WRONLY, 384);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    try {
      await link(temporary, target);
    } catch (error) {
      if (!isCode2(error, "EEXIST"))
        throw error;
      const existing = await readBoundedMetadata(target);
      if (existing.status !== "present" || !preserveExisting && existing.source !== contents) {
        throw new Error(`Prepared Projector metadata was concurrently published with different bytes: ${relativePath}`);
      }
    }
    await syncDirectory(dirname2(target));
  } finally {
    if (handle !== void 0)
      await handle.close();
    await rm2(temporary, { force: true });
  }
}
async function syncDirectory(path) {
  const directory = await open2(path, constants2.O_RDONLY);
  try {
    await directory.sync();
  } catch (error) {
    if (!isCode2(error, "EINVAL") && !isCode2(error, "ENOTSUP") && !isCode2(error, "EPERM"))
      throw error;
  } finally {
    await directory.close();
  }
}
function validateInput(input) {
  PackageIdentitySchema.parse(input.package);
  ProjectorOperationSchema.parse(input.operation);
}
function readiness(packageIdentity, status, reason) {
  return ProjectReadinessSchema.parse({ status, package: packageIdentity, reason });
}
function throwIfAborted(signal) {
  if (signal?.aborted === true)
    throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
function isCode2(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

// node_modules/@projector/control-plane/dist/representation/profile-reconciliation.js
var reconciliationFields = {
  kind: external_exports.literal("representation-profile-reconciliation"),
  profile: external_exports.strictObject({
    id: external_exports.string().min(1),
    fromVersion: external_exports.string().min(1),
    toVersion: external_exports.string().min(1),
    fromSemanticHash: ContentHashSchema,
    toSemanticHash: ContentHashSchema
  }),
  historical: external_exports.strictObject({
    changeSelector: external_exports.string().min(1),
    planHash: ContentHashSchema,
    projectionId: external_exports.string().min(1),
    capsuleIds: external_exports.array(external_exports.string().min(1)).min(1),
    approvalStatus: external_exports.enum(["not-supplied", "authenticated-stale"])
  }),
  context: external_exports.discriminatedUnion("status", [
    external_exports.strictObject({ status: external_exports.literal("not-bound") }),
    external_exports.strictObject({
      status: external_exports.enum(["current", "rebound"]),
      contextId: external_exports.string().min(1),
      observedContextId: external_exports.string().min(1),
      contentHash: ContentHashSchema
    })
  ]),
  invalidation: external_exports.strictObject({
    invalidatedIds: external_exports.array(external_exports.string().min(1)).min(1),
    preservedCanonicalEntityIds: external_exports.array(external_exports.string().min(1))
  }),
  reconciliation: external_exports.strictObject({
    status: external_exports.literal("reconciled"),
    refreshedIds: external_exports.array(external_exports.string().min(1)).min(1),
    receiptHash: ContentHashSchema
  }),
  replacement: external_exports.strictObject({
    changeSelector: external_exports.string().min(1),
    planHash: ContentHashSchema,
    projectionId: external_exports.string().min(1),
    capsuleIds: external_exports.array(external_exports.string().min(1)).min(1),
    artifactStatus: external_exports.literal("valid"),
    dependencyStatus: external_exports.literal("current"),
    approvalStatus: external_exports.literal("not-supplied")
  }),
  automaticApprovalCreated: external_exports.literal(false)
};
var RepresentationProfileReconciliationOutputSchema = external_exports.strictObject({
  ...reconciliationFields,
  delivery: external_exports.strictObject({
    stage: external_exports.literal("reconciliation-service"),
    deliveredToRunnerBoundary: external_exports.literal(false)
  })
});
var RepresentationProfileReconciliationOperationOutputSchema = external_exports.strictObject({
  ...reconciliationFields,
  delivery: external_exports.strictObject({
    stage: external_exports.literal("operation-runner"),
    deliveredToRunnerBoundary: external_exports.literal(true)
  })
});
function projectRepresentationProfileReconciliationOperation(value) {
  return RepresentationProfileReconciliationOperationOutputSchema.parse({
    ...RepresentationProfileReconciliationOutputSchema.parse(value),
    delivery: { stage: "operation-runner", deliveredToRunnerBoundary: true }
  });
}
function selectedRepresentation(capture) {
  const references = capture.capsules.map(({ representation }) => representation);
  if (references.some((reference) => reference === void 0))
    throw new Error("every captured capsule must bind a representation projection");
  const unique = new Map(references.map((reference) => [canonicalJson(reference), reference]));
  if (unique.size !== 1)
    throw new Error("representation reconciliation requires one profile projection shared by the selected plan capsules");
  return [...unique.values()][0];
}
function currentProfile(profileId) {
  const profile = currentBuiltInRepresentationProfile(profileId);
  if (profile === void 0)
    throw new Error("selected representation profile does not have a current packaged version");
  return profile;
}
function replacementCapsule(oldCapsule, oldCapture, replacement) {
  const index = oldCapture.capsules.findIndex(({ id }) => id === oldCapsule.id);
  const value = replacement.capsules[index];
  if (index < 0 || value === void 0 || replacement.capsules.length !== oldCapture.capsules.length) {
    throw new Error("replacement lifecycle capture does not preserve capsule cardinality and ordering");
  }
  return value;
}
var RepositoryRepresentationProfileReconciliationService = class _RepositoryRepresentationProfileReconciliationService {
  lifecycle;
  store;
  artifacts;
  inspection;
  knowledge;
  constructor(lifecycle, store, artifacts, inspection, knowledge) {
    this.lifecycle = lifecycle;
    this.store = store;
    this.artifacts = artifacts;
    this.inspection = inspection;
    this.knowledge = knowledge;
  }
  static async create(repositoryRoot, options = {}) {
    const [lifecycle, store, artifacts, inspection, knowledge] = await Promise.all([
      RepositoryChangeLifecycleService.create(repositoryRoot, options),
      ChangeLifecycleStore.create(repositoryRoot),
      RepositoryRepresentationArtifactStore.create(repositoryRoot),
      RepositoryRepresentationInspectionService.create(repositoryRoot, options),
      RepositoryKnowledgeService.create(options.applicationEvidence === void 0 ? repositoryRoot : { repositoryRoot, applicationEvidence: options.applicationEvidence })
    ]);
    return new _RepositoryRepresentationProfileReconciliationService(lifecycle, store, artifacts, inspection, knowledge);
  }
  async reconcile(input) {
    input.signal?.throwIfAborted();
    const historical = await this.store.readCapture(input.changeSelector);
    const oldReference = selectedRepresentation(historical);
    const oldArtifact = await this.artifacts.read(oldReference);
    if (oldArtifact === void 0)
      throw new Error("historical representation artifact is unavailable");
    const oldProfile = Object.values(BUILT_IN_REPRESENTATION_PROFILES).find(({ id, version }) => id === oldReference.profileId && version === oldReference.profileVersion);
    if (oldProfile === void 0)
      throw new Error("historical representation profile is not authenticated by the packaged profile catalog");
    const boundProfile = oldArtifact.projection.boundState.valueDependencies.find(({ kind, id }) => kind === "representation-profile" && id === oldProfile.id);
    if (boundProfile?.versionHash !== oldProfile.semanticHash)
      throw new Error("historical representation profile binding is invalid");
    const nextProfile = currentProfile(oldProfile.id);
    if (nextProfile.version === oldProfile.version)
      throw new Error("selected representation profile is already current");
    const oldInspection = await this.inspection.inspect({
      changeSelector: historical.semanticChangeId,
      view: "summary",
      ...input.approvalSelector === void 0 ? {} : { approvalSelector: input.approvalSelector },
      ...input.signal === void 0 ? {} : { signal: input.signal }
    });
    if (oldInspection.artifactIntegrity.status !== "valid" || oldInspection.semanticFidelity.status !== "valid" || oldInspection.dependencyFreshness.status !== "stale") {
      throw new Error("historical representation must be authentic and stale before reconciliation");
    }
    if (input.approvalSelector !== void 0 && oldInspection.executionAuthorization.status !== "authenticated-stale") {
      throw new Error("historical approval is not authenticated as stale");
    }
    let preservedCanonicalEntityIds = [];
    const context = historical.knowledgeContextId === void 0 ? { status: "not-bound" } : await (async () => {
      const retained = await this.knowledge.read(historical.knowledgeContextId);
      preservedCanonicalEntityIds = [...new Set(retained.branches.flatMap(({ context: branchContext }) => branchContext.items.filter(({ kind }) => kind === "concept" || kind === "requirement" || kind === "scenario" || kind === "decision").map(({ entityId }) => entityId)))].sort();
      const result = await this.knowledge.reconcile(historical.knowledgeContextId, input.signal === void 0 ? {} : { signal: input.signal });
      if (result.status !== "current" && result.status !== "rebound")
        throw new Error(`bound knowledge context is ${result.status}: ${result.reasons.join("; ")}`);
      return { status: result.status, contextId: historical.knowledgeContextId, observedContextId: result.governance.regeneratedContextId, contentHash: result.contentHash };
    })();
    const profileKey = `representation-profile:${oldProfile.id}`;
    const projectionKey = `representation:${oldReference.projectionId}`;
    const dependents = [
      { id: oldReference.projectionId, kind: "representation", dependencyKeys: [profileKey] },
      ...historical.capsules.map(({ id }) => ({ id, kind: "capsule", dependencyKeys: [projectionKey] })),
      ...preservedCanonicalEntityIds.map((id) => ({ id, kind: "canonical-entity", dependencyKeys: [] }))
    ];
    const plan = planUpgradeInvalidation({
      kind: "representation-profile",
      id: oldProfile.id,
      fromVersion: oldProfile.version,
      toVersion: nextProfile.version,
      affectedDependencyKeys: [profileKey],
      requiredAction: "revalidate"
    }, dependents, {
      knownDependencyKeys: [profileKey, projectionKey],
      ownedDependencyKeys: { [profileKey]: { kind: "representation-profile", id: oldProfile.id } },
      directDependentIdsByDependencyKey: {
        [profileKey]: [oldReference.projectionId],
        [projectionKey]: historical.capsules.map(({ id }) => id)
      }
    });
    let replacement;
    const reconciled = await reconcileRepresentationProfileUpgrade(plan, {
      invalidate: async (ids) => {
        if (canonicalJson(ids) !== canonicalJson(plan.invalidatedIds))
          throw new Error("representation invalidation set changed before refresh");
        const captured = await this.lifecycle.capture({
          request: historical.request,
          proposal: historical.proposal,
          ...historical.knowledgeContextId === void 0 ? {} : { knowledgeContextId: historical.knowledgeContextId }
        }, input.signal === void 0 ? {} : { signal: input.signal });
        replacement = captured.capture;
        if (replacement.semanticChangeId === historical.semanticChangeId)
          throw new Error("profile upgrade did not produce a distinct lifecycle identity");
      },
      refresh: async (id) => {
        if (replacement === void 0)
          throw new Error("replacement capture was not created after invalidation");
        if (id === oldReference.projectionId) {
          return selectedRepresentation(replacement).contentHash;
        }
        const oldCapsule = historical.capsules.find((capsule) => capsule.id === id);
        if (oldCapsule === void 0)
          throw new Error(`unknown invalidated representation dependent: ${id}`);
        return executionCapsuleHash(replacementCapsule(oldCapsule, historical, replacement));
      }
    });
    if (replacement === void 0)
      throw new Error("representation reconciliation did not produce a replacement lifecycle capture");
    const replacementReference = selectedRepresentation(replacement);
    if (replacementReference.profileId !== nextProfile.id || replacementReference.profileVersion !== nextProfile.version) {
      throw new Error("replacement lifecycle capture does not use the active profile version");
    }
    const replacementInspection = await this.inspection.inspect({ changeSelector: replacement.semanticChangeId, view: "summary", ...input.signal === void 0 ? {} : { signal: input.signal } });
    if (replacementInspection.artifactIntegrity.status !== "valid" || replacementInspection.semanticFidelity.status !== "valid" || replacementInspection.dependencyFreshness.status !== "current" || replacementInspection.executionAuthorization.status !== "not-supplied") {
      throw new Error("replacement representation is not valid, current, and unapproved");
    }
    return RepresentationProfileReconciliationOutputSchema.parse({
      kind: "representation-profile-reconciliation",
      profile: { id: oldProfile.id, fromVersion: oldProfile.version, toVersion: nextProfile.version, fromSemanticHash: oldProfile.semanticHash, toSemanticHash: nextProfile.semanticHash },
      historical: {
        changeSelector: historical.semanticChangeId,
        planHash: historical.planHash,
        projectionId: oldReference.projectionId,
        capsuleIds: historical.capsules.map(({ id }) => id),
        approvalStatus: input.approvalSelector === void 0 ? "not-supplied" : "authenticated-stale"
      },
      context,
      invalidation: { invalidatedIds: plan.invalidatedIds, preservedCanonicalEntityIds: plan.preservedCanonicalEntityIds },
      reconciliation: { status: reconciled.status, refreshedIds: reconciled.refreshedIds, receiptHash: reconciled.receiptHash },
      replacement: {
        changeSelector: replacement.semanticChangeId,
        planHash: replacement.planHash,
        projectionId: replacementReference.projectionId,
        capsuleIds: replacement.capsules.map(({ id }) => id),
        artifactStatus: "valid",
        dependencyStatus: "current",
        approvalStatus: "not-supplied"
      },
      automaticApprovalCreated: false,
      delivery: { stage: "reconciliation-service", deliveredToRunnerBoundary: false }
    });
  }
};

export {
  RepositoryIntentReviewSummarySchema,
  LifecycleCaptureOutputSchema,
  LifecyclePlanOutputSchema,
  LifecycleApprovalOutputSchema,
  LifecycleRecoveryOutcomeSchema,
  LifecycleRecoveryOutputSchema,
  StateBoundChangeResultSchema,
  LifecycleApplyOutputSchema,
  summarizeRepositoryIntentReview,
  projectLifecycleCapture,
  projectLifecyclePlan,
  projectLifecycleApproval,
  projectLifecycleApply,
  projectLifecycleRecovery,
  RepositoryCheckOutputSchema,
  checkRepository,
  PreparedProjectInitializationResultSchema,
  initializePreparedProject,
  inspectProjectReadiness,
  withProjectOperationAccess2 as withProjectOperationAccess,
  RepresentationProfileReconciliationOutputSchema,
  RepresentationProfileReconciliationOperationOutputSchema,
  projectRepresentationProfileReconciliationOperation,
  RepositoryRepresentationProfileReconciliationService
};
