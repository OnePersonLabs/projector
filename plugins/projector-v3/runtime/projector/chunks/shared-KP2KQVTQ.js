import {
  readProtectedKnowledgeContextIds
} from "./shared-QC25VWUM.js";
import {
  RepositoryChangeLifecycleService,
  RepositoryKnowledgeService,
  RepositoryRepresentationArtifactStore,
  RepositoryRepresentationInspectionService,
  observeIndexedRepository,
  validateArchitectureProducts,
  validateCanonicalRelationEndpoints,
  validateStaticCanonicalGovernance
} from "./shared-CPHR3K42.js";
import {
  ChangeLifecycleStore
} from "./shared-4VMBTM7P.js";
import {
  KnowledgeContextStore
} from "./shared-ZG4NJD52.js";
import {
  buildRepositoryImpactSnapshot,
  readRepositoryImpactSnapshot
} from "./shared-EMQJ4CG6.js";
import {
  observeChangeRepository,
  realizeChangeRepositoryData
} from "./shared-WPJ24CHV.js";
import {
  KnowledgeGraph
} from "./shared-BEDSHOK5.js";
import {
  residentObservationWorkerPool,
  runObservationTask
} from "./shared-AIE6IGAJ.js";
import {
  DurableArtifactSetStore,
  NativeProcessLauncher,
  OperationAccessError,
  RepositoryPathService,
  SqliteCodeStore,
  WriterLeaseManager,
  checkDerivedCacheBudget,
  classifyCanonicalSource,
  currentObservationScope,
  initializeProjectLocalIgnore,
  installProjectorEditorSchemaBundle,
  parseCanonicalSnapshotSources,
  parseTomlDocument,
  recoverAbandonedProjectOperationAccess,
  resolveDerivedCachePath,
  stringifyTomlDocument,
  tryWithProjectExclusiveAccess,
  withDerivedCacheAdmission,
  withObservationScope,
  withProjectOperationAccess,
  withRetainedObservationScope
} from "./shared-QSFRBEBN.js";
import {
  analyzeGitTree,
  checkObservation,
  codeInputHash,
  observationGit,
  observationGitBytes,
  readObservationFile
} from "./shared-BGCYVYNK.js";
import {
  BUILT_IN_REPRESENTATION_PROFILES,
  currentBuiltInRepresentationProfile,
  executionCapsuleHash,
  planUpgradeInvalidation,
  reconcileRepresentationProfileUpgrade
} from "./shared-XN3IZTFL.js";
import {
  DependencyScopedStateBindingValidator,
  InMemoryGraphReader,
  QueryDependencyRegistry,
  createStateBinding,
  evaluateDecisionOptions,
  evaluateSelector
} from "./shared-RMBXVF7C.js";
import {
  ArchitectureConcernSchema,
  ArchitectureEvaluationRequestSchema,
  AuthorityRecordSchema,
  BuiltinVerificationEvidenceSchema,
  BuiltinVerificationRequestSchema,
  ChangeCertificateSchema,
  ChangeProposalSchema,
  CodeImpactResultSchema,
  CodeIndexCancelRequestSchema,
  CodeIndexRequestSchema,
  CodeIndexRunSchema,
  CodeIndexStatusRequestSchema,
  CodeIndexStatusSchema,
  CodeIndexWaitRequestSchema,
  CodeRuntimeEvidenceSchema,
  CodeTestRunRequestSchema,
  CodeTestRunResultSchema,
  ContentHashSchema,
  DEFAULT_OBSERVATION_LIMITS,
  DerivedObservationBudget,
  DeveloperPreferenceSchema,
  ExecutionPlanSchema,
  GeneratedOutputEvidenceSchema,
  GeneratedOutputRequestSchema,
  GitIntegrationAssessmentSchema,
  GitIntegrationRequestSchema,
  ObservationBudget,
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
  VerificationEvidenceSchema,
  VerificationRequestSchema,
  canonicalJson,
  hashFramedDomain,
  hashSemantic,
  observationLimitValue,
  projectorConfigApiVersion,
  toCanonicalDocumentWire
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/change-lifecycle/transport.js
import { z } from "zod";
var reviewRelationSchema = z.object({ fromId: z.string(), toId: z.string(), type: z.string(), active: z.boolean().optional() }).strict();
var reviewMetadataSchema = z.object({ scope: z.unknown().optional(), evidence: z.array(z.unknown()).optional(), relation: reviewRelationSchema.optional() }).strict();
var intentSubjectSchema = z.object({ id: z.string(), kind: z.enum(["requirement", "scenario"]), operation: z.enum(["preserve", "add", "revise"]), before: reviewMetadataSchema.optional(), after: reviewMetadataSchema.optional(), rationale: z.string().nullable() }).strict();
var intentMutationSchema = z.object({ id: z.string(), kind: z.enum(["requirement", "behavioral-scenario", "concept", "relation", "lineage", "tombstone", "architecture-decision", "architecture-concern", "developer-preference", "projection-lens", "authority-record"]), operation: z.enum(["add", "revise", "retire"]), before: reviewMetadataSchema.optional(), after: reviewMetadataSchema.optional(), rationale: z.string() }).strict();
var identityResolutionSummarySchema = z.object({ contextId: z.string(), contextHash: ContentHashSchema, outcome: z.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity"]), selectedEntityIds: z.array(z.string()), rationale: z.string(), newBoundary: z.object({ owns: z.array(z.string()), excludes: z.array(z.string()), nearestEntityIds: z.array(z.string()), rationale: z.string() }).strict().optional() }).strict();
var RepositoryIntentReviewSummarySchema = z.object({
  subjects: z.array(intentSubjectSchema),
  identityResolution: identityResolutionSummarySchema.optional(),
  relations: z.array(RelationSchema),
  canonicalMutations: z.array(intentMutationSchema),
  relatedObligations: z.array(z.object({ id: z.string(), kind: z.string() }).strict()),
  unknowns: z.array(z.string()),
  blockingUnknowns: z.array(z.string()),
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
var LifecycleCaptureOutputSchema = z.object({ kind: z.literal("lifecycle-change"), selector: z.string(), immutablePlanHash: ContentHashSchema, proposalHash: ContentHashSchema, knowledgeContextId: z.string().min(1).optional() }).strict();
var LifecyclePlanOutputSchema = z.object({ kind: z.literal("lifecycle-plan"), selector: z.string(), immutablePlanHash: ContentHashSchema, preview: z.object({ proposal: ChangeProposalSchema, proposalHash: ContentHashSchema, expectedDiff: z.string(), intentReview: RepositoryIntentReviewSummarySchema }).strict(), plan: ExecutionPlanSchema }).strict().superRefine((value, context) => {
  if (value.preview.proposalHash !== hashFramedDomain("repository-change-proposal", value.preview.proposal))
    context.addIssue({ code: "custom", message: "proposal hash does not authenticate the public review payload", path: ["preview", "proposalHash"] });
});
var LifecycleApprovalOutputSchema = z.object({ kind: z.literal("lifecycle-approval"), selector: z.string(), changeSelector: z.string(), immutablePlanHash: ContentHashSchema }).strict();
var LifecycleRecoveryOutcomeSchema = z.object({ attemptId: z.string(), transactionId: z.string(), action: z.enum(["finalized", "rolled-back", "no-transaction", "recovery-required"]), reason: z.string().optional() }).strict();
var LifecycleRecoveryOutputSchema = z.object({ kind: z.literal("lifecycle-recovery"), selector: z.string(), outcomes: z.array(LifecycleRecoveryOutcomeSchema) }).strict();
var StateBoundChangeResultSchema = z.object({
  outcome: z.enum(["success", "failure", "partial"]),
  reasons: z.array(z.string()),
  preview: TransformPreviewSchema.optional(),
  transformResult: TransformResultSchema.optional(),
  validations: z.array(ValidationResultSchema),
  certificate: ChangeCertificateSchema,
  certificateHash: ContentHashSchema,
  certificateRef: z.string(),
  receipt: TransactionReceiptSchema,
  receiptHash: ContentHashSchema,
  receiptRef: z.string()
}).strict();
var LifecycleApplyOutputSchema = StateBoundChangeResultSchema.extend({ kind: z.literal("lifecycle-apply"), selector: z.string() });
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
import { z as z2 } from "zod";
var gitExec = promisify(execFile);
var cachePath = ".projector/runtime/repository-check/state.json";
var lockPath = ".projector/runtime/repository-check/check.lock";
var semanticBaselineOwner = "repository-check:baseline";
var pathSchema = z2.string().min(1).max(4096);
var headSchema = z2.string().regex(/^[a-f0-9]{40,64}$/u).nullable();
var observationSchema = z2.strictObject({
  head: headSchema,
  evidenceIdentity: ContentHashSchema,
  stagedIdentity: ContentHashSchema,
  files: z2.array(z2.strictObject({ path: pathSchema, identity: ContentHashSchema }))
});
var pendingSchema = z2.strictObject({
  findingId: z2.string().min(1).max(128),
  evidenceIdentity: ContentHashSchema,
  fromHead: headSchema,
  toHead: headSchema,
  baselineEvidenceIdentity: ContentHashSchema.nullable(),
  paths: z2.array(pathSchema).max(100),
  omittedPaths: z2.number().int().nonnegative()
});
var RepositoryCheckOutputSchema = z2.strictObject({
  status: z2.enum(["unchanged", "changed", "no previous observation", "incomplete"]),
  observation: z2.strictObject({ head: headSchema, evidenceIdentity: ContentHashSchema }).optional(),
  pending: pendingSchema.optional(),
  offer: z2.boolean(),
  limitations: z2.array(z2.string()).max(16),
  nextAction: z2.string(),
  semantic: z2.strictObject({ generation: z2.string().min(1), affectedPaths: z2.array(pathSchema), possiblePaths: z2.array(pathSchema), unknowns: z2.array(z2.string()), truncated: z2.boolean() }).optional()
});
var stateSchema = z2.strictObject({
  version: z2.literal(1),
  observation: observationSchema,
  pending: pendingSchema.optional(),
  offeredSessions: z2.array(ContentHashSchema).max(128),
  semanticGeneration: z2.string().min(1).max(256).optional()
});
function included(path) {
  return path !== ".projector/runtime" && !path.startsWith(".projector/runtime/");
}
function isCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
async function checkRepository(repositoryRoot, rawInput = {}, options = {}) {
  const input = ProjectorOperationInputSchemas["repository.check"].parse(rawInput);
  const scope = currentObservationScope();
  const limits = scope?.limits ?? DEFAULT_OBSERVATION_LIMITS;
  const deadline = performance.now() + Math.min(scope?.budget.remainingMs() ?? observationLimitValue(limits.timeoutMs), options.maxMilliseconds ?? observationLimitValue(limits.timeoutMs));
  const maxFileBytes = Math.min(options.maxFileBytes ?? Infinity, observationLimitValue(limits.maxFileBytes));
  const maxTotalBytes = Math.min(options.maxTotalBytes ?? Infinity, observationLimitValue(limits.maxTotalBytes));
  const maxPaths = Math.min(options.maxPaths ?? Infinity, observationLimitValue(limits.maxFiles));
  const maxGitBytes = Math.min(options.maxGitBytes ?? Infinity, observationLimitValue(limits.maxGitOutputBytes));
  const gitAbort = new AbortController();
  const signal = AbortSignal.any([gitAbort.signal, ...options.signal === void 0 ? [] : [options.signal], ...scope === void 0 ? [] : [scope.signal]]);
  let gitBytes = 0;
  const checkpoint = () => {
    signal.throwIfAborted();
    if (performance.now() >= deadline)
      throw new Error("Repository check elapsed-time bound exceeded");
  };
  let paths;
  let lock;
  let lockTarget;
  let state;
  let storedState;
  let codeStore;
  let baselineMissing = false;
  let statePublished = false;
  let semantic;
  const limitations = ["Change evidence is not a design-conformance assessment; previous uncommitted bytes are not retained.", "Offer deduplication remembers the last 128 offered sessions.", "omittedPaths is a lower bound across coalesced updates; omitted path identities are not retained."];
  const result = (status2, offer, nextAction) => ({
    status: status2,
    offer,
    limitations,
    nextAction,
    ...state === void 0 ? {} : { observation: { head: state.observation.head, evidenceIdentity: state.observation.evidenceIdentity } },
    ...state?.pending === void 0 ? {} : { pending: state.pending },
    ...semantic === void 0 ? {} : { semantic }
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
    const readBounded = async (path, limit, reserve) => {
      checkpoint();
      const target = (await safePaths.resolveRead(path)).realTarget;
      const handle2 = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const before = await handle2.stat();
        if (!before.isFile())
          throw new Error(`Repository check refuses nonregular file: ${path}`);
        if (before.size > limit)
          throw new Error(`Repository check byte bound exceeded: ${path}`);
        reserve?.(before.size);
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
      state = stateSchema.parse(JSON.parse((await readBounded(cachePath, observationLimitValue(limits.maxDerivedBytes))).toString("utf8")));
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
    codeStore = await SqliteCodeStore.open(safePaths.root);
    baselineMissing = state !== void 0 && (state.semanticGeneration === void 0 || !codeStore.hasGeneration(state.semanticGeneration));
    if (state?.semanticGeneration !== void 0 && !baselineMissing)
      codeStore.pinRetained(state.semanticGeneration, semanticBaselineOwner);
    const git2 = async (args) => {
      checkpoint();
      const environment = {};
      for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "LANG", "LC_ALL"]) {
        if (process.env[key] !== void 0)
          environment[key] = process.env[key];
      }
      const running = gitExec("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
        cwd: safePaths.root,
        encoding: "utf8",
        timeout: Number.isFinite(deadline) ? Math.max(1, Math.floor(deadline - performance.now())) : 0,
        maxBuffer: maxGitBytes,
        env: { ...environment, GIT_OPTIONAL_LOCKS: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" },
        signal
      });
      const accountOutput = (chunk) => {
        try {
          const bytes = Buffer.byteLength(chunk);
          gitBytes += bytes;
          if (gitBytes > maxGitBytes)
            throw new Error("Repository check exceeds the declared maxGitOutputBytes allowance");
          scope?.budget.consume("maxGitOutputBytes", bytes, "repository-check-git");
        } catch (error) {
          gitAbort.abort(error);
        }
      };
      running.child.stdout?.on("data", accountOutput);
      running.child.stderr?.on("data", accountOutput);
      let stdout;
      try {
        ({ stdout } = await running);
      } catch (error) {
        signal.throwIfAborted();
        throw error;
      }
      checkpoint();
      return stdout;
    };
    const head = async () => {
      const [topLevel, refs] = await Promise.all([
        git2(["rev-parse", "--show-toplevel"]),
        git2(["rev-parse", "--revs-only", "HEAD"])
      ]);
      if (await realpath(topLevel.trim()) !== safePaths.root)
        throw new Error("Repository check root must be the Git checkout root");
      return headSchema.parse(refs.trim() || null);
    };
    const currentHead = await head();
    const previous = state?.observation;
    let status2 = "unchanged";
    if (input.mode !== "commit-only" || input.handled !== void 0 || previous === void 0 || previous.head !== currentHead || baselineMissing) {
      const remainingMs = Number.isFinite(deadline) ? Math.max(1, Math.floor(deadline - performance.now())) : null;
      const phaseSignal = remainingMs === null ? signal : AbortSignal.any([signal, AbortSignal.timeout(remainingMs)]);
      const indexed = await withObservationScope({ signal: phaseSignal, limits: { timeoutMs: remainingMs } }, async (scope2) => {
        const observation2 = await observeIndexedRepository(safePaths.root);
        try {
          const taskOptions = { ...scope2, deadline: Math.min(scope2.deadline, Number.isFinite(deadline) ? Date.now() + Math.max(0, Math.floor(deadline - performance.now())) : Infinity) };
          const indexedResult = await runObservationTask("code-operation", { repositoryRoot: safePaths.root, operation: "code.index", input: { provider: "native" }, descriptor: observation2.descriptor }, taskOptions);
          const generation = z2.string().min(1).parse(indexedResult.generation);
          codeStore.pinRetained(generation, semanticBaselineOwner);
          const prior = baselineMissing ? void 0 : state?.semanticGeneration;
          const impact = prior === void 0 ? void 0 : CodeImpactResultSchema.parse(await runObservationTask("code-operation", { repositoryRoot: safePaths.root, operation: "code.impact", input: { before: prior, after: generation }, descriptor: observation2.descriptor }, taskOptions));
          return { generation, impact };
        } finally {
          observation2.close();
        }
      });
      semantic = { generation: indexed.generation, affectedPaths: indexed.impact?.affectedPaths ?? [], possiblePaths: indexed.impact?.possiblePaths ?? [], unknowns: [...baselineMissing ? ["Prior semantic baseline is unavailable; file-level semantic impact before this check is unknown"] : [], ...indexed.impact?.unknowns ?? []], truncated: indexed.impact?.truncated ?? false };
      const pathspec = ["--", ".", ":(exclude).projector/runtime", ":(exclude).projector/runtime/**"];
      const stagedDiff = () => git2(["diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
      const enumerate = async () => {
        const [dirty, indexed2, untracked] = await Promise.all([
          git2(["diff", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]),
          git2(["diff", "--cached", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]),
          git2(["ls-files", "--others", "--exclude-standard", "-z", ...pathspec])
        ]);
        return [...new Set(`${dirty}${indexed2}${untracked}`.split("\0").filter((path) => path && included(path)))].sort();
      };
      const [staged, names] = await Promise.all([stagedDiff(), enumerate()]);
      if (names.length > maxPaths)
        throw new Error("Repository check exceeds the declared maxFiles allowance");
      const files = new Array(names.length);
      const stamps = /* @__PURE__ */ new Map();
      const stamp = async (path) => {
        try {
          const stat5 = await lstat((await safePaths.resolveRead(path)).realTarget);
          return canonicalJson({ size: stat5.size, mode: stat5.mode, mtime: stat5.mtimeMs, ctime: stat5.ctimeMs, inode: stat5.ino });
        } catch (error) {
          if (isCode(error, "ENOENT"))
            return null;
          throw error;
        }
      };
      let total = 0;
      let reserved = 0;
      const reserveFileBytes = (bytes) => {
        if (reserved + bytes > maxTotalBytes)
          throw new Error("Repository check exceeds the declared maxTotalBytes allowance");
        reserved += bytes;
      };
      let nextPath = 0;
      let failed = false;
      const inspectFiles = async () => {
        while (!failed && nextPath < names.length) {
          const index = nextPath++;
          try {
            const path = pathSchema.parse(names[index]);
            let identity;
            const beforeStamp = await stamp(path);
            try {
              const content = await readBounded(path, Math.min(maxFileBytes, maxTotalBytes), reserveFileBytes);
              total += content.length;
              if (total > maxTotalBytes)
                throw new Error("Repository check exceeds the declared maxTotalBytes allowance");
              const mode = (await lstat((await safePaths.resolveRead(path)).realTarget)).mode;
              identity = hashFramedDomain("repository-check-file", content.toString("base64"), mode);
            } catch (error) {
              if (!isCode(error, "ENOENT"))
                throw error;
              identity = hashFramedDomain("repository-check-deleted", path);
            }
            files[index] = { path, identity };
            if (beforeStamp !== await stamp(path))
              throw new Error(`Repository file changed during observation: ${path}`);
            stamps.set(path, beforeStamp);
          } catch (error) {
            failed = true;
            throw error;
          }
        }
      };
      const inspected = await Promise.allSettled(Array.from({ length: Math.min(4, names.length) }, inspectFiles));
      const inspectionFailure = inspected.find((item) => item.status === "rejected");
      if (inspectionFailure !== void 0)
        throw inspectionFailure.reason;
      const [finalHead, finalNames, finalStaged] = await Promise.all([head(), enumerate(), stagedDiff()]);
      if (currentHead !== finalHead || canonicalJson(names) !== canonicalJson(finalNames) || staged !== finalStaged) {
        throw new Error("Repository changed during observation; retry a full check");
      }
      for (const [path, observedStamp] of stamps) {
        checkpoint();
        if (await stamp(path) !== observedStamp)
          throw new Error(`Repository file changed during observation: ${path}`);
      }
      const basis = { head: currentHead, stagedIdentity: hashFramedDomain("repository-check-index", staged), files };
      const observation = { ...basis, evidenceIdentity: hashFramedDomain("repository-check-observation", basis) };
      status2 = previous === void 0 ? "no previous observation" : previous.evidenceIdentity === observation.evidenceIdentity ? "unchanged" : "changed";
      if (status2 !== "unchanged") {
        const changedPaths = new Set(state?.pending?.paths ?? []);
        const beforeFiles = new Map(previous?.files.map((entry) => [entry.path, entry.identity]));
        const afterFiles = new Map(files.map((entry) => [entry.path, entry.identity]));
        for (const path of /* @__PURE__ */ new Set([...beforeFiles.keys(), ...afterFiles.keys()])) {
          if (beforeFiles.get(path) !== afterFiles.get(path) || previous?.stagedIdentity !== observation.stagedIdentity)
            changedPaths.add(path);
        }
        if (previous?.head !== null && previous?.head !== void 0 && currentHead !== null && previous.head !== currentHead) {
          for (const path of (await git2(["diff", "--name-only", "--no-renames", "--no-ext-diff", "-z", previous.head, currentHead, ...pathspec])).split("\0").filter(Boolean))
            changedPaths.add(pathSchema.parse(path));
        }
        const sorted = [...changedPaths].sort();
        state = {
          version: 1,
          observation,
          semanticGeneration: indexed.generation,
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
      if (status2 === "unchanged" && state !== void 0 && state.semanticGeneration !== indexed.generation)
        state.semanticGeneration = indexed.generation;
      if (baselineMissing && status2 === "unchanged")
        status2 = "incomplete";
    } else
      limitations.push("Commit-only check skipped staged and working-tree observation because HEAD is unchanged.");
    if (state === void 0)
      throw new Error("Repository check did not establish an observation");
    if (input.handled !== void 0) {
      if (state.pending?.findingId !== input.handled.findingId || state.pending.evidenceIdentity !== input.handled.evidenceIdentity) {
        limitations.push("Handled evidence does not match the current pending finding; the finding remains open.");
        status2 = "incomplete";
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
    if (storedState !== void 0 && canonicalJson(storedState) === canonicalJson(state)) {
      codeStore.reconcileRetainedOwner(state.semanticGeneration, semanticBaselineOwner);
      return result(status2, offer, nextAction);
    }
    const destination = (await safePaths.resolveWrite(cachePath)).realTarget;
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    const temporary = (await safePaths.resolveWrite(temporaryPath)).realTarget;
    const serialized = canonicalJson(stateSchema.parse(state));
    if (Buffer.byteLength(serialized) > observationLimitValue(limits.maxDerivedBytes))
      throw new Error("Repository check state exceeds the declared maxDerivedBytes allowance");
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
      statePublished = true;
    } finally {
      await rm(temporary, { force: true });
    }
    codeStore.reconcileRetainedOwner(state.semanticGeneration, semanticBaselineOwner);
    return result(status2, offer, nextAction);
  } catch (error) {
    if (!statePublished)
      state = storedState;
    limitations.push(error instanceof Error ? error.message.slice(0, 2048) : String(error).slice(0, 2048));
    return result("incomplete", false, isCode(error, "EEXIST") ? "A repository check lock or temporary file exists. Retry; for an interrupted owner, verify that its process has stopped before removing only its runtime lock or temporary file." : statePublished ? "The new observation is durable, but semantic pin cleanup failed. Retry a full repository.check; do not infer conformance." : "Preserved prior observation and pending finding. Address the reported limitation and retry a full repository.check; do not infer conformance.");
  } finally {
    codeStore?.close();
    if (lock !== void 0) {
      await lock.close();
      if (lockTarget !== void 0)
        await rm(lockTarget, { force: true });
    }
  }
}

// node_modules/@projector/control-plane/dist/integration/git-integration.js
import { lstat as lstat2 } from "node:fs/promises";

// node_modules/@projector/control-plane/dist/integration/result-reconciliation.js
var unique = (values) => [...new Set(values)].sort();
async function reconcileIntegrationResult(root, scope, derived, trees, canonical, changedPaths) {
  const observations = [];
  for (let index = 0; index < trees.length; index++) {
    scope.signal.throwIfAborted();
    const raw = await analyzeGitTree(root, trees[index], scope.budget, derived, scope.signal);
    observations.push(realizeChangeRepositoryData(root, raw, canonical[index], derived));
  }
  const graphs = observations.map((observation) => new KnowledgeGraph(observation, {}, derived));
  const snapshots = observations.map((observation, index) => buildRepositoryImpactSnapshot(observation, graphs[index]));
  const unknowns = unique(snapshots.flatMap((snapshot2) => [...snapshot2.unknowns]));
  const consumers = observations.map((observation) => {
    const reverse = /* @__PURE__ */ new Map();
    for (const dependency of observation.analysis.dependencies)
      if (dependency.resolvedPath !== void 0)
        reverse.set(dependency.resolvedPath, [...reverse.get(dependency.resolvedPath) ?? [], dependency.importerPath]);
    return (path) => {
      const seen = /* @__PURE__ */ new Set(), pending = [...reverse.get(path) ?? []];
      while (pending.length) {
        const current = pending.pop();
        scope.budget.check("git-result-consumer-population", current);
        scope.signal.throwIfAborted();
        if (current === path || seen.has(current))
          continue;
        derived.reserve(128 + current.length * 2, "git-result-consumer-population", current);
        seen.add(current);
        pending.push(...reverse.get(current) ?? []);
      }
      return [...seen].sort();
    };
  });
  const consumerQueries = unique(changedPaths.filter((path) => !path.startsWith(".projector/"))).map((dependencyPath) => {
    const targetConsumers = consumers[0](dependencyPath), incomingConsumers = consumers[1](dependencyPath), resultConsumers = consumers[2](dependencyPath);
    const newlyRelevantConsumers = resultConsumers.filter((path) => !targetConsumers.includes(path) || !incomingConsumers.includes(path));
    const removedConsumers = unique([...targetConsumers, ...incomingConsumers]).filter((path) => !resultConsumers.includes(path));
    const basis = { dependencyPath, targetConsumers, incomingConsumers, resultConsumers, newlyRelevantConsumers, removedConsumers };
    return { ...basis, fingerprint: hashFramedDomain("git-result-consumer-population-v1", { trees, ...basis }) };
  });
  const lensIds = unique(graphs.flatMap((graph) => graph.lenses.filter((lens) => lens.status === "active").map((lens) => lens.id)));
  const topologyMaps = observations.map((observation) => new Map(observation.analysis.topology.routes.map((route) => [route.subjectId, route])));
  const topologyQueries = unique(topologyMaps.flatMap((routes) => [...routes.keys()])).map((subjectId) => {
    const routes = topologyMaps.map((map) => map.get(subjectId));
    const [targetConsumers, incomingConsumers, resultConsumers] = routes.map((route) => unique(route?.consumerIds ?? []));
    const final = routes[2];
    const observability = final?.observability ?? "unavailable";
    if (observability === "open" || observability === "unavailable")
      unknowns.push(`${subjectId}: result topology consumer population is ${observability}`);
    const basis = { subjectId, subjectKind: (final ?? routes[0] ?? routes[1]).subjectKind, targetConsumers, incomingConsumers, resultConsumers, newlyRelevantConsumers: resultConsumers.filter((id) => !targetConsumers.includes(id) || !incomingConsumers.includes(id)), observability };
    return { ...basis, fingerprint: hashFramedDomain("git-result-topology-population-v1", { trees, ...basis }) };
  });
  const finalGraph = graphs[2];
  const allIds = /* @__PURE__ */ new Set([...finalGraph.units.map((unit) => unit.id), ...lensIds]);
  const compiledObligations = finalGraph.lensObligations(allIds, "integration");
  const lensPopulations = lensIds.map((lensId) => {
    const [targetMembers, incomingMembers, resultMembers] = graphs.map((graph) => unique(graph.lensCompilation?.memberships[lensId] ?? []));
    return { lensId, targetMembers, incomingMembers, resultMembers, newlyApplicableUnitIds: resultMembers.filter((id) => !targetMembers.includes(id) || !incomingMembers.includes(id)), resultObligations: compiledObligations.filter((obligation) => obligation.lensId === lensId).map(({ unitId, applicabilityFingerprint, validatorIds, ruleIds }) => ({ unitId, applicabilityFingerprint, validatorIds: [...validatorIds], ruleIds: [...ruleIds] })) };
  });
  const contradictions = [];
  for (const divergence of observations[2].analysis.divergences) {
    const message2 = `${divergence.code}: ${divergence.path}: ${divergence.explanation}`;
    if (divergence.code === "broken-static-import" || divergence.code === "actions-needs-gap")
      contradictions.push(message2);
    else
      unknowns.push(`Requires semantic review: ${message2}`);
  }
  const evaluations = finalGraph.governanceEvaluationsWithProvenance(allIds, "integration");
  for (const { lensId, evaluation } of evaluations) {
    if (evaluation.status === "violated")
      contradictions.push(`${lensId}: ${evaluation.unitId}: static governance violated`);
    if (evaluation.status === "unknown")
      unknowns.push(`${lensId}: ${evaluation.unitId}: static governance unknown`);
  }
  const semanticMaps = observations.map((observation) => new Map(observation.analysis.javaScript.files.map((file) => [file.path, file.semanticHash])));
  const semanticChanges = unique([...semanticMaps[0].keys(), ...semanticMaps[1].keys(), ...semanticMaps[2].keys()]).filter((path) => semanticMaps[0].get(path) !== semanticMaps[2].get(path) || semanticMaps[1].get(path) !== semanticMaps[2].get(path)).map((path) => ({ path, ...semanticMaps[0].has(path) ? { targetHash: semanticMaps[0].get(path) } : {}, ...semanticMaps[1].has(path) ? { incomingHash: semanticMaps[1].get(path) } : {}, ...semanticMaps[2].has(path) ? { resultHash: semanticMaps[2].get(path) } : {} }));
  return { status: contradictions.length ? "failed" : unknowns.length ? "incomplete" : "assessed", scope: "immutable-result-static-consumers-and-obligations", consumerQueries, topologyQueries, lensPopulations, semanticChanges, contradictions: unique(contradictions), unknowns: unique(unknowns), behavior: { status: "not-assessed", reusable: false } };
}

// node_modules/@projector/control-plane/dist/integration/git-integration.js
var gaps = ["Behavioral and dynamic governance verification has not run.", "Independent review, CI completion and merge authorization are not established.", "Arbitrary prose and code compatibility require review.", "Calculated merge trees use built-in Git merge semantics; supplied ordinary-merge results are authoritative."];
function equal(a, b) {
  return a?.oid === b?.oid && a?.mode === b?.mode && a?.type === b?.type;
}
function change(a, b) {
  return a === void 0 ? "added" : b === void 0 ? "removed" : "modified";
}
function status(base, branch, result, same) {
  if (same(branch, result))
    return "preserved";
  if (same(base, result) || branch !== void 0 && result === void 0)
    return "lost";
  return "altered";
}
function git(root, scope, args, allowedExitCodes) {
  return observationGit(root, args, scope.budget, { signal: scope.signal, stage: "git-integration", ...allowedExitCodes ? { allowedExitCodes } : {} });
}
async function resolve(root, scope, ref, kind) {
  return (await git(root, scope, ["rev-parse", "--verify", "--end-of-options", `${ref}^{${kind}}`])).trim();
}
async function entries(root, scope, tree, derived, executable) {
  const raw = await observationGitBytes(root, ["--no-replace-objects", "ls-tree", "-r", "-z", tree, "--", ".projector"], scope.budget, { signal: scope.signal, stage: "git-integration-tree", ...executable ? { executable } : {} });
  const result = /* @__PURE__ */ new Map();
  for (const record of new TextDecoder("utf-8", { fatal: true }).decode(raw).split("\0")) {
    if (!record)
      continue;
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(record);
    if (!match)
      throw new Error("Malformed Git tree entry");
    scope.budget.consume("maxFiles", 1, "git-integration-tree", match[4]);
    derived.reserve(256 + record.length * 2, "git-integration-tree", match[4]);
    result.set(match[4], { mode: match[1], type: match[2], oid: match[3], path: match[4] });
  }
  return result;
}
async function delta(root, scope, base, tip, derived) {
  const raw = await observationGitBytes(root, ["diff-tree", "--no-commit-id", "--raw", "-z", "-r", "--no-renames", "--no-ext-diff", "--no-textconv", base, tip, "--"], scope.budget, { signal: scope.signal, stage: "git-integration-delta" });
  const records = new TextDecoder("utf-8", { fatal: true }).decode(raw).split("\0"), result = /* @__PURE__ */ new Map();
  for (let index = 0; index < records.length - 1; index += 2) {
    const match = /^:(\d+) (\d+) ([a-f0-9]+) ([a-f0-9]+) [AMD T]+$/.exec(records[index]);
    const path = records[index + 1];
    if (!match || !path)
      throw new Error("Malformed Git raw delta");
    scope.budget.consume("maxFiles", 1, "git-integration-delta", path);
    derived.reserve(512 + path.length * 4, "git-integration-delta", path);
    const entry = (mode, oid) => mode === "000000" ? void 0 : { mode, oid, path, type: mode === "160000" ? "commit" : "blob" };
    result.set(path, { before: entry(match[1], match[3]), after: entry(match[2], match[4]) });
  }
  return result;
}
async function canonicalSources(root, scope, tree, executable) {
  const selected = [];
  for (const entry of tree.values()) {
    if (entry.path === ".projector")
      throw new Error("Canonical root is not a real directory");
    if (!entry.path.startsWith(".projector/"))
      continue;
    const relativePath = entry.path.slice(11);
    const selection = classifyCanonicalSource(relativePath, entry.mode === "120000" ? "symlink" : entry.type === "commit" ? "directory" : "file");
    if (selection === "ignore")
      continue;
    if (entry.type !== "blob" || entry.mode === "120000")
      throw new Error(`Unsupported canonical Git entry: ${entry.path}`);
    if (selection === "source")
      selected.push(entry);
  }
  const sources = [];
  if (selected.length) {
    const input = selected.map((e) => e.oid).join("\n") + "\n";
    const sizes = (await observationGit(root, ["--no-replace-objects", "cat-file", "--batch-check"], scope.budget, { signal: scope.signal, stage: "git-integration-object-sizes", input, ...executable ? { executable } : {} })).trimEnd().split("\n");
    if (sizes.length !== selected.length)
      throw new Error("Invalid Git batch object count");
    let total = 0;
    for (let index = 0; index < sizes.length; index++) {
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(sizes[index]);
      if (!match || match[1] !== selected[index].oid)
        throw new Error(`Missing canonical Git blob: ${selected[index].path}`);
      const size = Number(match[2]);
      if (!Number.isSafeInteger(size))
        throw new Error("Invalid Git blob size");
      scope.budget.assertFileBytes(size, selected[index].path);
      total += size;
    }
    scope.budget.assertTotalBytes(total, "git-integration-canonical");
    const raw = await observationGitBytes(root, ["--no-replace-objects", "cat-file", "--batch"], scope.budget, { signal: scope.signal, stage: "git-integration-canonical", input, ...executable ? { executable } : {} });
    let offset = 0;
    for (const entry of selected) {
      scope.signal.throwIfAborted();
      scope.budget.check("git-integration-canonical", entry.path);
      const end = raw.indexOf(10, offset), header = raw.subarray(offset, end).toString("ascii");
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
      if (end < 0 || !match || match[1] !== entry.oid)
        throw new Error(`Invalid Git object framing: ${entry.path}`);
      const size = Number(match[2]);
      scope.budget.assertFileBytes(size, entry.path);
      scope.budget.consume("maxTotalBytes", size, "git-integration-canonical", entry.path);
      offset = end + 1;
      if (!Number.isSafeInteger(size) || offset + size >= raw.length || raw[offset + size] !== 10)
        throw new Error(`Truncated Git blob: ${entry.path}`);
      const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw.subarray(offset, offset + size));
      offset += size + 1;
      sources.push({ path: entry.path, relativePath: entry.path.slice(11), source });
    }
    if (offset !== raw.length)
      throw new Error("Unexpected Git batch trailing bytes");
  }
  return sources;
}
async function collectImmutableCanonicalSources(root, scope, tree, derived, executable) {
  return canonicalSources(root, scope, await entries(root, scope, tree, derived, executable), executable);
}
async function snapshot(root, scope, tree, derived) {
  const result = parseCanonicalSnapshotSources(await canonicalSources(root, scope, tree), derived);
  const ids = /* @__PURE__ */ new Set();
  for (const doc of result.documents) {
    if (ids.has(doc.id))
      throw new Error(`Duplicate canonical identity: ${doc.id}`);
    ids.add(doc.id);
  }
  return result;
}
async function assessGitIntegration(root, input, options = {}) {
  const request = GitIntegrationRequestSchema.parse(input);
  return withObservationScope(options, async (scope) => {
    const derived = new DerivedObservationBudget(scope.limits.maxDerivedBytes);
    const targetCommit = await resolve(root, scope, request.target, "commit"), incomingCommit = await resolve(root, scope, request.incoming, "commit");
    let baseCommit;
    if (request.base !== void 0) {
      baseCommit = await resolve(root, scope, request.base, "commit");
      for (const tip of [targetCommit, incomingCommit]) {
        if ((await git(root, scope, ["rev-list", "--count", `${tip}..${baseCommit}`])).trim() !== "0")
          throw new Error("Explicit integration base must be an ancestor of both commits");
      }
    } else {
      const bases = (await git(root, scope, ["merge-base", "--all", targetCommit, incomingCommit], [1])).trim().split(/\s+/).filter(Boolean);
      if (bases.length !== 1)
        throw new Error(bases.length ? "Ambiguous integration merge bases; supply an explicit common ancestor" : "Unrelated integration histories have no merge base");
      baseCommit = bases[0];
    }
    let resultTree, resultCommit;
    const conflictPaths = [];
    if (request.result !== void 0) {
      const object = (await git(root, scope, ["rev-parse", "--verify", "--end-of-options", `${request.result}^{object}`])).trim();
      resultTree = await resolve(root, scope, object, "tree");
      const type = (await git(root, scope, ["cat-file", "-t", object])).trim();
      if (type === "commit" || type === "tag")
        resultCommit = await resolve(root, scope, object, "commit");
    } else {
      const config = await git(root, scope, ["config", "--includes", "--get-regexp", "^(merge[.].*[.]driver|merge[.]renormalize|filter[.].*|core[.]attributesfile)$"], [1]);
      if (config.trim())
        throw new Error("Automatic integration calculation does not support custom merge drivers, filters or renormalization; supply an ordinary merge result with result");
      const attributes = (await git(root, scope, ["rev-parse", "--path-format=absolute", "--git-path", "info/attributes"])).trim();
      try {
        await lstat2(attributes);
        if ((await readObservationFile(attributes, scope.budget, "git-integration-attributes", scope.signal)).toString("utf8").trim())
          throw new Error("Automatic integration calculation does not support repository info/attributes; supply an ordinary merge result with result");
      } catch (error) {
        if (error.code !== "ENOENT")
          throw error;
      }
      const raw = await git(root, scope, ["-c", `core.attributesFile=${process.platform === "win32" ? "NUL" : "/dev/null"}`, `--attr-source=${targetCommit}`, "merge-tree", "--write-tree", "--no-messages", "-z", `--merge-base=${baseCommit}`, targetCommit, incomingCommit], [1]);
      const fields = raw.split("\0");
      resultTree = fields.shift().trim();
      for (const field of fields) {
        const match = /^\d+ [a-f0-9]+ [123]\t([\s\S]+)$/.exec(field);
        if (match && !conflictPaths.includes(match[1]))
          conflictPaths.push(match[1]);
      }
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(resultTree))
        throw new Error("Git did not return a valid proposed merge tree");
    }
    const base = await entries(root, scope, baseCommit, derived), target = await entries(root, scope, targetCommit, derived), incoming = await entries(root, scope, incomingCommit, derived), result = await entries(root, scope, resultTree, derived);
    const targetDelta = await delta(root, scope, baseCommit, targetCommit, derived), incomingDelta = await delta(root, scope, baseCommit, incomingCommit, derived), resultDelta = await delta(root, scope, baseCommit, resultTree, derived);
    const codeContributions = [], changedCodePaths = { target: [], incoming: [] };
    for (const [side, branch] of [["target", targetDelta], ["incoming", incomingDelta]]) {
      for (const [path, contribution] of branch) {
        const actual = resultDelta.has(path) ? resultDelta.get(path).after : contribution.before;
        changedCodePaths[side].push(path);
        codeContributions.push({ side, path, change: change(contribution.before, contribution.after), status: status(contribution.before, contribution.after, actual, equal) });
      }
    }
    const contributions = [], semanticOverlapIds = [];
    const canonicalValidation = { scope: "canonical-record-integrity", status: conflictPaths.length ? "not-assessed" : "passed", issues: [] };
    const assessedAt = (/* @__PURE__ */ new Date()).toISOString();
    const staticGovernanceValidation = { status: "not-assessed", checks: [], issues: [] };
    let resultReconciliation = { status: "not-assessed", scope: "immutable-result-static-consumers-and-obligations", consumerQueries: [], topologyQueries: [], lensPopulations: [], semanticChanges: [], contradictions: [], unknowns: ["Result source reconciliation requires an unconflicted, valid canonical result."], behavior: { status: "not-assessed", reusable: false } };
    if (!conflictPaths.length) {
      const snapshots = [await snapshot(root, scope, base, derived), await snapshot(root, scope, target, derived), await snapshot(root, scope, incoming, derived)];
      let final;
      try {
        final = await snapshot(root, scope, result, derived);
      } catch (error) {
        if (error instanceof Error && "code" in error)
          throw error;
        canonicalValidation.status = "failed";
        canonicalValidation.issues.push(error instanceof Error ? error.message : String(error));
      }
      if (final) {
        resultReconciliation = await reconcileIntegrationResult(root, scope, derived, [targetCommit, incomingCommit, resultTree], [snapshots[1], snapshots[2], final], [...targetDelta.keys(), ...incomingDelta.keys(), ...resultDelta.keys()]);
        const [b, t, i, r] = [...snapshots, final].map((s) => new Map(s.documents.map((d) => [d.id, d])));
        const authored = (d) => d === void 0 ? void 0 : hashFramedDomain("git-integration-authored-record-v1", toCanonicalDocumentWire(d));
        for (const [side, branch] of [["target", t], ["incoming", i]]) {
          for (const id of /* @__PURE__ */ new Set([...b.keys(), ...branch.keys()])) {
            const before = b.get(id), after = branch.get(id), actual = r.get(id);
            if (authored(before) === authored(after))
              continue;
            contributions.push({ side, entityId: id, kind: (after ?? before).kind, change: change(before, after), status: status(before, after, actual, (a, b2) => authored(a) === authored(b2)), ...before ? { baseSemanticHash: before.semanticHash, baseAuthoredHash: authored(before) } : {}, ...after ? { branchSemanticHash: after.semanticHash, branchAuthoredHash: authored(after) } : {}, ...actual ? { resultSemanticHash: actual.semanticHash, resultAuthoredHash: authored(actual) } : {}, documentDrift: after?.canonicalDocumentHash !== actual?.canonicalDocumentHash });
          }
        }
        for (const c of contributions.filter((c2) => c2.side === "target"))
          if (contributions.some((other) => other.side === "incoming" && other.entityId === c.entityId && other.branchAuthoredHash !== c.branchAuthoredHash))
            semanticOverlapIds.push(c.entityId);
        try {
          const changedIds = new Set(contributions.map((c) => c.entityId));
          for (const id of /* @__PURE__ */ new Set([...b.keys(), ...r.keys()]))
            if (authored(b.get(id)) !== authored(r.get(id)))
              changedIds.add(id);
          validateArchitectureProducts(final.documents, assessedAt, changedIds);
          const removedIds = new Set([...b.keys()].filter((id) => !r.has(id)));
          staticGovernanceValidation.issues = validateStaticCanonicalGovernance(final.documents, new Set(r.keys()), { populationComplete: false, removedIds, derivedBudget: derived });
          staticGovernanceValidation.issues.push(...validateCanonicalRelationEndpoints(final.documents.filter((d) => d.kind === "relation").map((d) => RelationSchema.parse(d.payload)), new Set(r.keys()), { populationComplete: false, removedIds }));
          staticGovernanceValidation.status = staticGovernanceValidation.issues.length ? "incomplete" : "passed";
          staticGovernanceValidation.checks = ["Authored authority, decision, basis and static lens contracts", "Touched architecture product references and constraints", "Canonical schema lineage shape"];
        } catch (error) {
          if (error instanceof Error && "code" in error)
            throw error;
          staticGovernanceValidation.status = "failed";
          staticGovernanceValidation.issues.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
    const resultOnlyPaths = [...resultDelta].filter(([path, value]) => !equal(value.after, targetDelta.has(path) ? targetDelta.get(path).after : value.before) && !equal(value.after, incomingDelta.has(path) ? incomingDelta.get(path).after : value.before)).map(([path]) => path);
    checkObservation(scope.budget, scope.signal, "git-integration-complete");
    return GitIntegrationAssessmentSchema.parse({ baseCommit, targetCommit, incomingCommit, resultTree, ...resultCommit ? { resultCommit } : {}, baseSelection: request.base ? "explicit" : "inferred", resultSource: request.result ? "supplied" : "calculated-merge", status: conflictPaths.length ? "conflicted" : canonicalValidation.status === "failed" || staticGovernanceValidation.status === "failed" || resultReconciliation.status === "failed" ? "invalid" : "review-required", conflictPaths, changedCodePaths, codeContributions, contributions, semanticOverlapIds, resultOnlyPaths, canonicalValidation, staticGovernanceValidation, resultReconciliation, assessedAt, requiresReview: true, verificationGaps: [...gaps, ...staticGovernanceValidation.issues, ...resultReconciliation.unknowns, ...resultReconciliation.contradictions] });
  });
}

// node_modules/@projector/control-plane/dist/readiness/service.js
import { randomBytes } from "node:crypto";
import { constants as constants2 } from "node:fs";
import { link, lstat as lstat3, mkdir as mkdir2, open as open2, rm as rm2 } from "node:fs/promises";
import { dirname as dirname2, join } from "node:path";
import { z as z3 } from "zod";

// node_modules/@projector/control-plane/dist/knowledge/cache-maintenance.js
import { basename } from "node:path";
async function maintainDerivedCache(root, options = {}) {
  const target = options.targetBytes ?? Number.POSITIVE_INFINITY;
  if (options.targetBytes !== void 0 && (!Number.isSafeInteger(target) || target < 0))
    throw new RangeError("Invalid cache maintenance target");
  const preservedIds = (options.preserveContextIds ?? []).map((id) => {
    const match = /^(?:knowledge_context_)?([0-9a-f]{32})$/u.exec(id);
    if (match === null)
      throw new Error(`Invalid preserved context identity: ${id}`);
    return `knowledge_context_${match[1]}`;
  });
  const result = await tryWithProjectExclusiveAccess(root, "derived-cache-maintenance", async (access2) => {
    const budget = options.budget ?? { deadline: null, remainingEntries: null, remainingBytes: null };
    return withObservationScope({ signal: access2.signal, limits: { timeoutMs: budget.deadline === null ? null : Math.max(1, budget.deadline - Date.now()) } }, async () => withDerivedCacheAdmission(root, async (cache) => {
      const disposableBytes = () => cache.entries.reduce((bytes, entry) => bytes + entry.bytes, 0);
      if (disposableBytes() <= target && cache.entries.every(({ kind }) => kind !== "staging"))
        return { status: "unchanged", removedEntries: 0, retainedBytes: disposableBytes() };
      const protectedIds = /* @__PURE__ */ new Set([...await readProtectedKnowledgeContextIds(root, budget, access2.signal), ...preservedIds]);
      const store = await KnowledgeContextStore.create(root);
      const contextDependencies = /* @__PURE__ */ new Map();
      const protectedPaths = /* @__PURE__ */ new Set();
      const referencedBy = /* @__PURE__ */ new Map();
      const entries2 = new Map(cache.entries.map((entry) => [entry.relativePath, entry]));
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
        const entry = entries2.get(path);
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
      for (const entry of [...retained.values()]) {
        if (budget.remainingBytes !== null)
          budget.remainingBytes -= entry.bytes;
        checkDerivedCacheBudget(budget);
        const id = `knowledge_context_${basename(entry.relativePath, ".json")}`;
        const context = await store.read(id, false);
        if (context.impactBaseline !== void 0) {
          const dependency = `.projector/runtime/impact/${context.impactBaseline.contentHash.slice("sha256:v1:".length)}.json`;
          const snapshot2 = entries2.get(dependency);
          if (snapshot2 === void 0)
            throw new Error(`Retained context ${id} is missing its impact dependency; refresh it before cache maintenance`);
          const prior = references.get(dependency);
          if (prior !== void 0 && JSON.stringify(prior) !== JSON.stringify(context.impactBaseline))
            throw new Error(`Retained contexts disagree about their shared impact reference: ${dependency}`);
          references.set(dependency, context.impactBaseline);
          contextDependencies.set(entry.relativePath, dependency);
          const users = referencedBy.get(dependency) ?? /* @__PURE__ */ new Set();
          users.add(entry.relativePath);
          referencedBy.set(dependency, users);
          retain(snapshot2);
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
        if (budget.remainingBytes !== null)
          budget.remainingBytes -= entry.bytes;
        checkDerivedCacheBudget(budget);
        await readRepositoryImpactSnapshot(root, references.get(entry.relativePath), false);
      }
      const selected = cache.entries.filter((entry) => !retained.has(entry.relativePath)).sort((a, b) => Number(a.kind === "impact") - Number(b.kind === "impact") || a.relativePath.localeCompare(b.relativePath));
      checkDerivedCacheBudget(budget);
      await access2.assertOwned();
      const codeStore = selected.some(({ kind }) => kind === "impact" || kind === "context") ? await SqliteCodeStore.open(root) : void 0;
      try {
        for (const entry of selected) {
          access2.signal.throwIfAborted();
          checkDerivedCacheBudget(budget);
          await cache.remove(entry);
          if (entry.kind === "impact")
            codeStore?.releaseRetainedOwner(`sha256:v1:${basename(entry.relativePath, ".json")}`);
          if (entry.kind === "context")
            codeStore?.releaseRetainedOwner(`knowledge_context_${basename(entry.relativePath, ".json")}`);
        }
      } finally {
        codeStore?.close();
      }
      return { status: selected.length === 0 ? "unchanged" : "collected", removedEntries: selected.length, retainedBytes: disposableBytes() };
    }, { signal: access2.signal, budget }));
  }, options.signal);
  return result.acquired ? result.value : { status: "busy", removedEntries: 0 };
}

// node_modules/@projector/control-plane/dist/readiness/service.js
var preparedConfigPath = join(".projector", "config.toml");
var PreparedProjectInitializationResultSchema = z3.strictObject({
  readiness: ProjectReadinessSchema,
  created: z3.boolean()
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
  const projectorStatus = await lstat3(projectorDirectory);
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
async function readMetadata(path) {
  try {
    const pathStatus = await lstat3(path);
    if (!pathStatus.isFile() || pathStatus.isSymbolicLink())
      return { status: "unsafe", reason: `${path} must be a regular non-symlink file` };
    const handle = await open2(path, constants2.O_RDONLY | constants2.O_NOFOLLOW);
    try {
      const handleStatus = await handle.stat();
      if (!handleStatus.isFile() || handleStatus.size !== pathStatus.size)
        return { status: "unsafe", reason: `${path} changed during inspection` };
      const source = await handle.readFile("utf8");
      const after = await handle.stat();
      if (Buffer.byteLength(source) !== handleStatus.size || after.size !== handleStatus.size || after.mtimeMs !== handleStatus.mtimeMs) {
        return { status: "unsafe", reason: `${path} changed during inspection` };
      }
      return { status: "present", source };
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
    return await readMetadata((await paths.resolveRead(relativePath)).realTarget);
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
      const existing = await readMetadata(target);
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
function readiness(packageIdentity, status2, reason) {
  return ProjectReadinessSchema.parse({ status: status2, package: packageIdentity, reason });
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
import { z as z4 } from "zod";
var reconciliationFields = {
  kind: z4.literal("representation-profile-reconciliation"),
  profile: z4.strictObject({
    id: z4.string().min(1),
    fromVersion: z4.string().min(1),
    toVersion: z4.string().min(1),
    fromSemanticHash: ContentHashSchema,
    toSemanticHash: ContentHashSchema
  }),
  historical: z4.strictObject({
    changeSelector: z4.string().min(1),
    planHash: ContentHashSchema,
    projectionId: z4.string().min(1),
    capsuleIds: z4.array(z4.string().min(1)).min(1),
    approvalStatus: z4.enum(["not-supplied", "authenticated-stale"])
  }),
  context: z4.discriminatedUnion("status", [
    z4.strictObject({ status: z4.literal("not-bound") }),
    z4.strictObject({
      status: z4.enum(["current", "rebound"]),
      contextId: z4.string().min(1),
      observedContextId: z4.string().min(1),
      contentHash: ContentHashSchema
    })
  ]),
  invalidation: z4.strictObject({
    invalidatedIds: z4.array(z4.string().min(1)).min(1),
    preservedCanonicalEntityIds: z4.array(z4.string().min(1))
  }),
  reconciliation: z4.strictObject({
    status: z4.literal("reconciled"),
    refreshedIds: z4.array(z4.string().min(1)).min(1),
    receiptHash: ContentHashSchema
  }),
  replacement: z4.strictObject({
    changeSelector: z4.string().min(1),
    planHash: ContentHashSchema,
    projectionId: z4.string().min(1),
    capsuleIds: z4.array(z4.string().min(1)).min(1),
    artifactStatus: z4.literal("valid"),
    dependencyStatus: z4.literal("current"),
    approvalStatus: z4.literal("not-supplied")
  }),
  automaticApprovalCreated: z4.literal(false)
};
var RepresentationProfileReconciliationOutputSchema = z4.strictObject({
  ...reconciliationFields,
  delivery: z4.strictObject({
    stage: z4.literal("reconciliation-service"),
    deliveredToRunnerBoundary: z4.literal(false)
  })
});
var RepresentationProfileReconciliationOperationOutputSchema = z4.strictObject({
  ...reconciliationFields,
  delivery: z4.strictObject({
    stage: z4.literal("operation-runner"),
    deliveredToRunnerBoundary: z4.literal(true)
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
  const unique2 = new Map(references.map((reference) => [canonicalJson(reference), reference]));
  if (unique2.size !== 1)
    throw new Error("representation reconciliation requires one profile projection shared by the selected plan capsules");
  return [...unique2.values()][0];
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

// node_modules/@projector/control-plane/dist/code-intelligence/service.js
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { open as open3, readFile, readdir, rename as rename2, unlink, writeFile, mkdir as mkdir3, stat } from "node:fs/promises";
import { join as join2 } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
var activeRuns = /* @__PURE__ */ new Map();
async function runDirectory(root) {
  const path = await resolveDerivedCachePath(root, ".projector/runtime/code/runs");
  await mkdir3(path, { recursive: true });
  return path;
}
async function writeRun(directory, candidate) {
  const run = CodeIndexRunSchema.parse(candidate);
  const destination = join2(directory, `${run.id}.json`);
  const temporary = join2(directory, `.${run.id}.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(run)}
`, { flag: "wx" });
  await rename2(temporary, destination);
  return run;
}
async function readRun(directory, id) {
  if (!/^code_index_[0-9a-f-]{36}$/u.test(id))
    throw new Error("Invalid code index run ID");
  return CodeIndexRunSchema.parse(JSON.parse(await readFile(join2(directory, `${id}.json`), "utf8")));
}
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH")
      return false;
    throw error;
  }
}
async function currentRun(directory, run) {
  if (run.state !== "running" || (run.ownerPid === process.pid ? activeRuns.has(run.id) : pidAlive(run.ownerPid)))
    return run;
  return writeRun(directory, { ...run, state: "interrupted", finishedAt: (/* @__PURE__ */ new Date()).toISOString(), error: "The owning process exited before the index run reached a terminal state" });
}
async function listRuns(directory) {
  const files = (await readdir(directory)).filter((file) => /^code_index_[0-9a-f-]{36}\.json$/u.test(file)).sort();
  const runs = await Promise.all(files.map(async (file) => currentRun(directory, await readRun(directory, file.slice(0, -5)))));
  runs.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  return { runs: runs.slice(0, 1e3), truncated: runs.length > 1e3 };
}
async function pruneTerminalRuns(directory) {
  const files = (await readdir(directory)).filter((file) => /^code_index_[0-9a-f-]{36}\.json$/u.test(file));
  const records = await Promise.all(files.map((file) => readRun(directory, file.slice(0, -5))));
  const terminal = records.filter((run) => run.state === "published" || run.state === "failed" || run.state === "cancelled").sort((left, right) => (right.finishedAt ?? right.startedAt).localeCompare(left.finishedAt ?? left.startedAt));
  for (const run of terminal.slice(1e3)) {
    const current = await readRun(directory, run.id);
    if (current.state !== run.state || current.finishedAt !== run.finishedAt)
      throw new Error(`Code index run changed during history pruning: ${run.id}`);
    await unlink(join2(directory, `${run.id}.json`));
  }
}
async function acquireIndexLock(directory, run) {
  const lock = join2(directory, "index.lock");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open3(lock, "wx");
      try {
        await handle.writeFile(JSON.stringify({ id: run.id, ownerPid: process.pid }));
      } finally {
        await handle.close();
      }
      return;
    } catch (error) {
      if (error.code !== "EEXIST")
        throw error;
      let occupant;
      for (let read = 0; read < 5 && occupant === void 0; read += 1) {
        try {
          occupant = JSON.parse(await readFile(lock, "utf8"));
        } catch (readError) {
          if (!(readError instanceof SyntaxError) && readError.code !== "ENOENT")
            throw readError;
          await delay(20);
        }
      }
      if (occupant === void 0)
        throw new Error("Code index ownership record remained incomplete");
      if (!Number.isSafeInteger(occupant.ownerPid) || occupant.ownerPid <= 0 || pidAlive(occupant.ownerPid))
        throw new Error(`Code indexing is already owned by ${occupant.id}`);
      try {
        await currentRun(directory, await readRun(directory, occupant.id));
      } catch (readError) {
        if (readError.code !== "ENOENT")
          throw readError;
      }
      const stale = join2(directory, `stale-${randomUUID()}.lock`);
      await rename2(lock, stale);
      await unlink(stale);
    }
  }
  throw new Error("Could not acquire code index ownership after stale-run recovery");
}
async function releaseIndexLock(directory, id) {
  const lock = join2(directory, "index.lock");
  try {
    const owner = JSON.parse(await readFile(lock, "utf8"));
    if (owner.id !== id)
      throw new Error(`Code index ownership changed before releasing ${id}`);
    await unlink(lock);
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
  }
}
async function sourceHashes(paths, hashes) {
  const entries2 = [];
  for (const path of Object.keys(hashes).sort()) {
    const resolved = await paths.resolveRead(path);
    entries2.push([path, await streamingCodeInputHash(resolved.realTarget)]);
  }
  return Object.fromEntries(entries2);
}
async function streamingCodeInputHash(path) {
  const size = (await stat(path)).size;
  if (!Number.isSafeInteger(size) || size < 0)
    throw new Error(`Code source size is not safely bounded: ${path}`);
  const budget = currentObservationScope()?.budget;
  if (budget === void 0)
    throw new Error("Code source hashing requires an observation scope");
  budget.assertFileBytes(size, path);
  budget.consume("maxTotalBytes", size, "code-producer-input", path);
  const hash = createHash("sha256");
  const frame = (value) => {
    const bytes = Buffer.from(value, "utf8");
    const length = Buffer.allocUnsafe(8);
    length.writeBigUInt64BE(BigInt(bytes.length));
    hash.update(length);
    hash.update(bytes);
  };
  frame("projector\0sha256\0v1");
  frame("projector-code-input-v1");
  const contentLength = Buffer.allocUnsafe(8);
  contentLength.writeBigUInt64BE(BigInt(Math.ceil(size / 3) * 4 + 2));
  hash.update(contentLength);
  hash.update('"');
  let tail = Buffer.alloc(0);
  let observed = 0;
  for await (const bytes of createReadStream(path, { highWaterMark: 64 * 1024 })) {
    const chunk = Buffer.concat([tail, bytes]);
    observed += bytes.length;
    const aligned = Math.floor(chunk.length / 3) * 3;
    if (aligned > 0)
      hash.update(chunk.subarray(0, aligned).toString("base64"));
    tail = chunk.subarray(aligned);
  }
  if (observed !== size)
    throw new Error(`Code source changed while hashing: ${path}`);
  if (tail.length > 0)
    hash.update(tail.toString("base64"));
  hash.update('"');
  return `sha256:v1:${hash.digest("hex")}`;
}
function assertSourceHashes(expected, actual) {
  for (const [path, hash] of Object.entries(expected)) {
    if (actual[path] !== hash)
      throw new Error(`External code producer input changed or has an incorrect source hash: ${path}`);
  }
}
async function runExternalProducer(root, input, options) {
  const producer = input.producer;
  if (producer === void 0)
    return;
  const paths = await RepositoryPathService.create(root);
  const expected = input.sourceHashes ?? {};
  if (Object.keys(expected).length === 0)
    throw new Error("External code producers require explicit sourceHashes for currentness validation");
  assertSourceHashes(expected, await sourceHashes(paths, expected));
  const cwd = (await paths.resolveRead(producer.cwd ?? ".")).realTarget;
  const environment = Object.fromEntries(Object.entries({ ...options.environment, ...producer.environment }).filter((entry) => typeof entry[1] === "string"));
  const result = await new NativeProcessLauncher().launch({ executable: producer.executable, args: [...producer.args], cwd, env: environment, timeoutMs: input.timeoutMs, maxOutputBytes: 1024 * 1024, outputOverflow: "truncate", signal: options.signal });
  if (result.exitCode !== 0)
    throw new Error(`External code producer failed with exit code ${result.exitCode}: ${result.stderr.slice(0, 4096)}${result.outputTruncated ? " [diagnostic output truncated]" : ""}`);
  assertSourceHashes(expected, await sourceHashes(paths, expected));
  const artifact = await paths.resolveRead(producer.artifact);
  const artifactStatus = await stat(artifact.realTarget);
  const limit = currentObservationScope()?.limits.maxDerivedBytes;
  if (!artifactStatus.isFile() || limit === void 0 || limit !== null && artifactStatus.size > limit)
    throw new Error(`External code artifact is unavailable or exceeds maxDerivedBytes: ${producer.artifact}`);
}
function observedHashMap(observation) {
  return observation.store.readGeneration(observation.descriptor.generation, () => new Map(observation.store.population("inventory").map((path) => {
    const entry = observation.store.get("inventory", path);
    if (entry === void 0)
      throw new Error(`Observed source membership has no bytes: ${path}`);
    return [path, entry.contentHash];
  })));
}
async function executeWorker(root, operation, input, options, observe, existing) {
  const scope = currentObservationScope();
  if (scope === void 0)
    throw new Error("Code operations require an observation scope");
  const observation = existing ?? (observe ? await observeIndexedRepository(root) : void 0);
  try {
    return await runObservationTask("code-operation", {
      repositoryRoot: root,
      operation,
      input,
      ...observation === void 0 ? {} : { descriptor: observation.descriptor }
    }, { ...scope, signal: options.signal });
  } finally {
    if (existing === void 0)
      observation?.close();
  }
}
async function executeExternalIndex(root, input, options) {
  const producer = input.producer;
  if (producer === void 0)
    throw new Error("External index request has no producer");
  const before = await observeIndexedRepository(root);
  let beforeHashes;
  try {
    beforeHashes = observedHashMap(before);
  } finally {
    before.close();
  }
  await runExternalProducer(root, input, options);
  const after = await observeIndexedRepository(root);
  try {
    const afterHashes = observedHashMap(after);
    const paths = /* @__PURE__ */ new Set([...beforeHashes.keys(), ...afterHashes.keys()]);
    for (const path of paths) {
      if (path === producer.artifact)
        continue;
      if (beforeHashes.get(path) !== afterHashes.get(path))
        throw new Error(`External code producer changed observed repository input: ${path}`);
    }
    const { producer: _producer, ...request } = input;
    return await executeWorker(root, "code.index", { ...request, provider: producer.format, artifact: producer.artifact }, options, false, after);
  } finally {
    after.close();
  }
}
async function startIndex(root, raw, options) {
  const input = CodeIndexRequestSchema.parse(raw);
  const callerScope = currentObservationScope();
  if (callerScope === void 0)
    throw new Error("Code index start requires an authorized observation scope");
  const directory = await runDirectory(root);
  const run = { id: `code_index_${randomUUID()}`, repositoryRoot: root, provider: input.provider, state: "running", startedAt: (/* @__PURE__ */ new Date()).toISOString(), ownerPid: process.pid };
  await acquireIndexLock(directory, run);
  try {
    await writeRun(directory, run);
  } catch (error) {
    await releaseIndexLock(directory, run.id);
    throw error;
  }
  const controller = new AbortController();
  const promise = withRetainedObservationScope({ limits: { ...callerScope.limits, timeoutMs: input.timeoutMs }, signal: controller.signal }, async () => {
    try {
      const runOptions = { ...options, signal: controller.signal };
      const output = input.provider === "external" ? await executeExternalIndex(root, input, runOptions) : await executeWorker(root, "code.index", input, runOptions, true);
      if (typeof output.generation !== "string")
        throw new Error("Code index worker did not publish a generation");
      return await writeRun(directory, { ...run, state: "published", generation: output.generation, finishedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      return await writeRun(directory, { ...run, state: controller.signal.aborted ? "cancelled" : "failed", finishedAt: (/* @__PURE__ */ new Date()).toISOString(), error: failure });
    } finally {
      activeRuns.delete(run.id);
      try {
        await pruneTerminalRuns(directory);
      } finally {
        await releaseIndexLock(directory, run.id);
      }
    }
  });
  void promise.catch((error) => process.stderr.write(`${JSON.stringify({ event: "code-index-run-error", runId: run.id, message: error instanceof Error ? error.message : String(error) })}
`));
  activeRuns.set(run.id, { controller, promise });
  if (residentObservationWorkerPool() === void 0)
    return promise;
  return run;
}
async function waitIndex(root, raw, signal) {
  const input = CodeIndexWaitRequestSchema.parse(raw);
  const directory = await runDirectory(root);
  const deadline = Date.now() + input.timeoutMs;
  while (true) {
    signal.throwIfAborted();
    const run = await currentRun(directory, await readRun(directory, input.runId));
    if (run.repositoryRoot !== root)
      throw new Error("Code index run belongs to another repository");
    if (run.state !== "running" || Date.now() >= deadline)
      return run;
    await delay(Math.min(100, deadline - Date.now()), void 0, { signal });
  }
}
async function cancelIndex(root, raw) {
  const input = CodeIndexCancelRequestSchema.parse(raw);
  const directory = await runDirectory(root);
  const run = await currentRun(directory, await readRun(directory, input.runId));
  if (run.repositoryRoot !== root)
    throw new Error("Code index run belongs to another repository");
  const active = activeRuns.get(run.id);
  if (active === void 0) {
    if (run.state === "running")
      throw new Error(`Code index run ${run.id} is owned by another process and cannot be cancelled from this connection`);
    return run;
  }
  active.controller.abort(new Error("Code index run cancelled"));
  return active.promise;
}
async function shutdownCodeIndexRuns() {
  const runs = [...activeRuns.values()];
  for (const run of runs)
    run.controller.abort(new Error("Resident code index host shut down"));
  await Promise.all(runs.map((run) => run.promise));
}
async function executeCodeOperation(repositoryRoot, operation, input, options) {
  options.signal.throwIfAborted();
  const root = (await RepositoryPathService.create(repositoryRoot)).root;
  if (operation === "code.index")
    return startIndex(root, input, options);
  if (operation === "code.index-wait")
    return waitIndex(root, input, options.signal);
  if (operation === "code.index-cancel")
    return cancelIndex(root, input);
  if (operation === "code.index-status") {
    const statusInput = CodeIndexStatusRequestSchema.parse(input);
    const directory = await runDirectory(root);
    const base = await executeWorker(root, operation, input, options, false);
    if (statusInput.runId !== void 0) {
      let run;
      if (/^code_index_[0-9a-f-]{36}$/u.test(statusInput.runId)) {
        try {
          run = await currentRun(directory, await readRun(directory, statusInput.runId));
        } catch (error) {
          if (error.code !== "ENOENT")
            throw error;
        }
      }
      return CodeIndexStatusSchema.parse({ ...base, runs: run === void 0 ? [] : [run], runsTruncated: false });
    }
    const history = await listRuns(directory);
    return CodeIndexStatusSchema.parse({ ...base, runs: history.runs, runsTruncated: history.truncated });
  }
  const request = input;
  const observe = operation === "code.query" ? request.freshness !== "pinned" : operation === "code.tests" || operation === "code.evidence" ? request.generation === void 0 : operation === "code.impact" ? request.after === void 0 : false;
  return executeWorker(root, operation, input, options, observe);
}

// node_modules/@projector/control-plane/dist/code-intelligence/test-replay.js
import { randomUUID as randomUUID2 } from "node:crypto";
import { readFile as readFile2, mkdir as mkdir4, stat as stat2 } from "node:fs/promises";
import { isAbsolute, join as join3, relative, sep } from "node:path";
import { z as z5 } from "zod";
var assertionSchema = z5.object({ fullName: z5.string(), status: z5.string(), duration: z5.number().nonnegative().optional() });
var resultSchema = z5.object({ testResults: z5.array(z5.object({ assertionResults: z5.array(assertionSchema) })) });
var coverageSchema = z5.record(z5.string(), z5.object({
  path: z5.string().optional(),
  statementMap: z5.record(z5.string(), z5.object({
    start: z5.object({ line: z5.number().int().positive() }),
    end: z5.object({ line: z5.number().int().positive() })
  })),
  s: z5.record(z5.string(), z5.number())
}));
async function readReplayJson(path, artifact) {
  await stat2(path).catch((error) => {
    if (error.code === "ENOENT")
      throw new Error(`Isolated replay produced no ${artifact}: ${path}`, { cause: error });
    throw error;
  });
  return JSON.parse(await readFile2(path, "utf8"));
}
function exactNamePattern(name) {
  return `^${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`;
}
function repositoryPath(root, path) {
  const candidate = isAbsolute(path) ? relative(root, path) : path;
  const normalized = candidate.split(sep).join("/");
  if (normalized === "" || normalized === ".." || normalized.startsWith("../") || isAbsolute(normalized))
    throw new Error(`Replay coverage escapes the repository: ${path}`);
  return normalized;
}
function observedSources(observation) {
  return observation.store.readGeneration(observation.descriptor.generation, () => new Map(observation.store.population("inventory").map((path) => {
    const entry = observation.store.get("inventory", path);
    if (entry === void 0)
      throw new Error(`Replay source inventory has no bytes: ${path}`);
    return [path, { inventoryHash: entry.contentHash, codeHash: entry.kind === "file" ? codeInputHash(entry.content) : entry.contentHash }];
  })));
}
function assertSameInputs(before, after) {
  for (const path of /* @__PURE__ */ new Set([...before.keys(), ...after.keys()])) {
    if (before.get(path)?.inventoryHash !== after.get(path)?.inventoryHash)
      throw new Error(`Isolated replay changed an observed repository input: ${path}`);
  }
}
async function localVitest(root) {
  const executable = join3(root, "node_modules", "vitest", "vitest.mjs");
  if (!(await stat2(executable).catch((error) => {
    if (error.code === "ENOENT")
      return void 0;
    throw error;
  }))?.isFile())
    throw new Error("Local Vitest is unavailable; install it in the selected repository or supply an explicit Vitest command");
  return [process.execPath, [executable, "run"]];
}
async function executeCodeTestReplay(repositoryRoot, raw, options) {
  const input = CodeTestRunRequestSchema.parse(raw);
  options.signal.throwIfAborted();
  const paths = await RepositoryPathService.create(repositoryRoot);
  const root = paths.root;
  const testFile = await paths.resolveRead(input.testFile);
  if (!(await stat2(testFile.realTarget)).isFile())
    throw new Error(`Replay testFile is not a regular file: ${input.testFile}`);
  const store = await SqliteCodeStore.open(root);
  let generation;
  let buildId;
  try {
    generation = store.head() ?? (() => {
      throw new Error("Run code.index before an isolated replay");
    })();
    const manifest = store.manifest(generation);
    if (manifest?.binding.status !== "verified")
      throw new Error("Isolated replay requires a source-bound semantic generation");
    buildId = hashFramedDomain("code-test-replay-build-v1", { generation, binding: manifest.binding });
  } finally {
    store.close();
  }
  const before = await observeIndexedRepository(root);
  let beforeHashes;
  try {
    beforeHashes = observedSources(before);
  } finally {
    before.close();
  }
  if (!beforeHashes.has(input.testFile))
    throw new Error(`Replay testFile is outside the observed checkout: ${input.testFile}`);
  const runId = `code_test_${randomUUID2()}`;
  const artifactDirectory = await resolveDerivedCachePath(root, `.projector/runtime/code/test-replay/${runId}`);
  await mkdir4(artifactDirectory, { recursive: true });
  const resultPath = join3(artifactDirectory, "results.json");
  const coveragePath = join3(artifactDirectory, "coverage", "coverage-final.json");
  const [executable, leading] = input.command === void 0 ? await localVitest(root) : [input.command.executable, input.command.args];
  if (leading.some((arg) => /^(?:--(?:reporter|outputFile|coverage|testNamePattern|passWithNoTests|update)(?:[.=]|$)|-u$)/u.test(arg))) {
    throw new Error("An explicit replay command cannot override test selection, reporting, coverage, or snapshot update flags");
  }
  const args = [
    ...leading,
    input.testFile,
    "--testNamePattern",
    exactNamePattern(input.testName),
    "--reporter=json",
    `--outputFile=${resultPath}`,
    "--coverage",
    "--coverage.provider=v8",
    "--coverage.reporter=json",
    `--coverage.reportsDirectory=${join3(artifactDirectory, "coverage")}`,
    "--coverage.reportOnFailure",
    "--no-file-parallelism",
    "--maxWorkers=1"
  ];
  const environment = Object.fromEntries(Object.entries({ ...options.environment, ...input.command?.environment }).filter((entry) => typeof entry[1] === "string"));
  const execution = await new NativeProcessLauncher().launch({
    executable,
    args,
    cwd: root,
    env: environment,
    timeoutMs: input.timeoutMs,
    maxOutputBytes: 1024 * 1024,
    outputOverflow: "truncate",
    signal: options.signal
  });
  const after = await observeIndexedRepository(root);
  let afterHashes;
  try {
    afterHashes = observedSources(after);
  } finally {
    after.close();
  }
  assertSameInputs(beforeHashes, afterHashes);
  const report = resultSchema.parse(await readReplayJson(resultPath, "test result"));
  const executed = report.testResults.flatMap((file) => file.assertionResults).filter((test2) => test2.status === "passed" || test2.status === "failed");
  if (executed.length !== 1 || executed[0]?.fullName !== input.testName) {
    throw new Error(`Isolated replay selected ${executed.length} executed cases; expected exactly one named ${JSON.stringify(input.testName)}`);
  }
  const test = executed[0];
  const outcome = test.status === "passed" && execution.exitCode === 0 ? "passed" : "failed";
  const coverage = coverageSchema.parse(await readReplayJson(coveragePath, "coverage report"));
  const ranges = [];
  const sourceHashes2 = {};
  const unknowns = [];
  const indexed = await SqliteCodeStore.open(root);
  try {
    if (indexed.head() !== generation)
      throw new Error("Semantic generation changed during isolated replay");
    for (const [file, record] of Object.entries(coverage)) {
      const path = repositoryPath(root, record.path ?? file);
      const observed = beforeHashes.get(path);
      const partitionHash = indexed.partition(generation, path)?.inputHash;
      if (observed === void 0 || partitionHash === void 0 || partitionHash !== observed.inventoryHash && partitionHash !== observed.codeHash) {
        unknowns.push(`Coverage source has no verified indexed binding: ${path}`);
        continue;
      }
      sourceHashes2[path] = partitionHash;
      for (const [id, location] of Object.entries(record.statementMap)) {
        if ((record.s[id] ?? 0) > 0)
          ranges.push({ path, startLine: location.start.line, endLine: location.end.line });
      }
    }
  } finally {
    indexed.close();
  }
  if (Object.keys(sourceHashes2).length === 0)
    throw new Error("Isolated replay produced no coverage for source-bound indexed files");
  const testId = `${input.testFile}::${input.testName}`;
  const workload = hashFramedDomain("code-test-replay-workload-v1", { testFile: input.testFile, testName: input.testName, command: { executable, args } });
  const evidence = CodeRuntimeEvidenceSchema.parse({
    id: hashFramedDomain("code-test-replay-evidence-v1", { runId, generation, ranges }),
    generation,
    sourceHashes: sourceHashes2,
    testId,
    runId,
    runner: "vitest/v8",
    buildId,
    workload,
    attribution: "isolated_replay",
    outcome,
    durationMs: test.duration ?? execution.durationMs,
    ranges
  });
  const imported = await executeCodeOperation(root, "code.evidence", { format: "projector", evidence }, options);
  return CodeTestRunResultSchema.parse({
    runId,
    generation,
    testId,
    outcome,
    durationMs: test.duration ?? execution.durationMs,
    evidenceIds: imported.accepted,
    sourceHashes: sourceHashes2,
    buildId,
    workload,
    command: { executable, args },
    unknowns: [.../* @__PURE__ */ new Set([...unknowns, ...imported.unknowns])],
    requiredVerificationUnaffected: true
  });
}

// node_modules/@projector/control-plane/dist/verification/service.js
import { createHash as createHash2, randomUUID as randomUUID3 } from "node:crypto";
import { createReadStream as createReadStream2 } from "node:fs";
import { opendir, realpath as realpath2, stat as stat3, lstat as lstat4 } from "node:fs/promises";
import { isAbsolute as isAbsolute2, join as join5 } from "node:path";

// node_modules/@projector/control-plane/dist/verification/retention.js
import { mkdir as mkdir5, mkdtemp, open as open4, rename as rename3, rm as rm3 } from "node:fs/promises";
import { join as join4 } from "node:path";
async function retainImmutableRecord(store, artifactSetId, record) {
  const existing = await store.read(artifactSetId);
  if (existing.status === "published") {
    if (existing.manifest.contentHash !== record.contentHash)
      throw new Error(`Conflicting retained event: ${artifactSetId}`);
    return;
  }
  if (existing.status !== "missing")
    throw new Error(`Retained event ${artifactSetId}: ${existing.status}`);
  const published = join4(store.storageRoot, "published");
  await mkdir5(published, { recursive: true });
  const delivery = await mkdtemp(join4(store.storageRoot, ".delivery-"));
  try {
    await mkdir5(join4(delivery, "blobs"));
    const handle = await open4(join4(delivery, "manifest.bin"), "wx");
    try {
      await handle.writeFile(Buffer.from(canonicalJson(record)));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await syncDirectory2(join4(delivery, "blobs"));
    await syncDirectory2(delivery);
    try {
      await rename3(delivery, join4(published, artifactSetId));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && ["EEXIST", "ENOTEMPTY", "EPERM"].includes(String(error.code))))
        throw error;
      const raced = await store.read(artifactSetId);
      if (raced.status !== "published" || raced.manifest.contentHash !== record.contentHash)
        throw error;
    }
    const retained = await store.read(artifactSetId);
    if (retained.status !== "published" || retained.manifest.contentHash !== record.contentHash)
      throw new Error(`Retained event integrity failed: ${artifactSetId}`);
    await syncDirectory2(published);
  } finally {
    await rm3(delivery, { recursive: true, force: true });
  }
}
async function syncDirectory2(path) {
  const handle = await open4(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && ["EINVAL", "ENOTSUP", "EPERM"].includes(String(error.code))))
      throw error;
  } finally {
    await handle.close();
  }
}

// node_modules/@projector/control-plane/dist/verification/service.js
function seal(basis) {
  return { ...basis, contentHash: hashFramedDomain("verification-event/v1", basis) };
}
function validateVerificationEvent(value) {
  const manifest = VerificationEvidenceSchema.parse(value);
  const { contentHash, ...basis } = manifest;
  if (contentHash !== hashFramedDomain("verification-event/v1", basis))
    throw new Error("Verification event integrity failed");
  if (manifest.basisHash !== hashFramedDomain("verification-basis/v1", { request: manifest.request, inputs: manifest.inputs, profile: manifest.profile }))
    throw new Error("Verification basis integrity failed");
  return manifest;
}
function validate(bytes) {
  return { manifest: validateVerificationEvent(JSON.parse(Buffer.from(bytes).toString("utf8"))), blobs: [] };
}
var VerificationService = class _VerificationService {
  paths;
  localRoot;
  evidenceRoot;
  launcher;
  signal;
  observationTimeoutMs;
  constructor(paths, localRoot, evidenceRoot, launcher, signal, observationTimeoutMs) {
    this.paths = paths;
    this.localRoot = localRoot;
    this.evidenceRoot = evidenceRoot;
    this.launcher = launcher;
    this.signal = signal;
    this.observationTimeoutMs = observationTimeoutMs;
  }
  static async create(root, options = {}) {
    const paths = await RepositoryPathService.create(root);
    if (options.evidenceStoreRoot !== void 0 && !isAbsolute2(options.evidenceStoreRoot))
      throw new Error("Host verification evidence store must be absolute");
    return new _VerificationService(paths, (await paths.resolveWrite(".projector/runtime/verification")).realTarget, options.evidenceStoreRoot, options.launcher ?? new NativeProcessLauncher(), options.signal ?? new AbortController().signal, new ObservationBudget({ timeoutMs: options.observationTimeoutMs ?? null }).limits.timeoutMs);
  }
  budget() {
    return new ObservationBudget({ timeoutMs: this.observationTimeoutMs });
  }
  store(root, budget = this.budget()) {
    return new DurableArtifactSetStore(root, validate, {}, { budget, signal: this.signal, derivedBudget: new DerivedObservationBudget(budget.limits.maxDerivedBytes) });
  }
  async save(record) {
    const store = new DurableArtifactSetStore(this.localRoot, validate);
    const slot = `${record.id}_${record.status === "running" ? "running" : "completed"}`;
    await store.begin({ artifactSetId: slot });
    await store.finalize({ artifactSetId: slot, manifestBytes: Buffer.from(canonicalJson(record)) });
    if (record.status !== "running" && this.evidenceRoot !== void 0) {
      await this.retain(record);
    }
  }
  async retain(record) {
    if (this.evidenceRoot !== void 0 && record.status !== "running") {
      await retainImmutableRecord(new DurableArtifactSetStore(this.evidenceRoot, validate), `${record.id}_completed`, record);
    }
  }
  async names(root, budget) {
    this.signal.throwIfAborted();
    budget.check("verification-history", root);
    let entries2;
    try {
      entries2 = await opendir(root);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
    const names = [];
    for await (const entry of entries2) {
      this.signal.throwIfAborted();
      budget.consume("maxFiles", 1, "verification-history", root);
      names.push(entry.name);
    }
    return names.sort();
  }
  async pending(budget) {
    const pending = [];
    const store = this.store(this.localRoot, budget);
    for (const [directory, state] of [["staging", "staged"], ["finalizing", "finalizing"]])
      for (const artifactSetId of await this.names(join5(this.localRoot, directory), budget)) {
        const value = await store.read(artifactSetId);
        if (value.status === "published" || value.status === "missing")
          continue;
        if (value.status === "integrity-failed")
          throw new Error(value.reason);
        let recoverable = false;
        if (state === "finalizing")
          try {
            recoverable = (await lstat4(join5(this.localRoot, directory, artifactSetId, "manifest.bin"))).isFile();
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
              throw error;
          }
        pending.push({ artifactSetId, state, recoverable });
      }
    return pending;
  }
  async inspect(eventIds, budget = this.budget()) {
    for (const id of eventIds ?? []) {
      if (!/^execution_[0-9a-f-]{36}$/u.test(id))
        throw new Error(`Invalid verification event identifier: ${id}`);
    }
    const records = /* @__PURE__ */ new Map();
    for (const root of [.../* @__PURE__ */ new Set([this.localRoot, ...this.evidenceRoot === void 0 ? [] : [this.evidenceRoot]])]) {
      const store = this.store(root, budget);
      const slots = eventIds === void 0 ? await this.names(join5(root, "published"), budget) : [...new Set(eventIds)].flatMap((id) => [`${id}_running`, `${id}_completed`]);
      for (const slot of slots) {
        const value = await store.read(slot);
        if (eventIds !== void 0 && value.status === "missing")
          continue;
        if (value.status !== "published")
          throw new Error(`Verification record ${slot}: ${value.status}`);
        const record = value.manifest;
        if (!slot.startsWith(`${record.id}_`))
          throw new Error(`Verification event slot identity mismatch: ${slot}`);
        if (eventIds !== void 0 && slot.endsWith("_running") !== (record.status === "running"))
          throw new Error(`Verification event slot outcome mismatch: ${slot}`);
        const key = `${record.id}:${record.status === "running" ? "running" : "completed"}`;
        const prior = records.get(key);
        if (prior !== void 0 && prior.contentHash !== record.contentHash)
          throw new Error(`Conflicting verification event identity: ${record.id}`);
        records.set(key, record);
      }
    }
    const all = [...records.values()];
    for (const record of all) {
      const start = records.get(`${record.id}:running`);
      if (start !== void 0 && (start.basisHash !== record.basisHash || start.startedAt !== record.startedAt))
        throw new Error(`Conflicting execution start: ${record.id}`);
    }
    const selected = all.filter((record) => (eventIds === void 0 || eventIds.includes(record.id)) && (record.status !== "running" || !all.some((other) => other.id === record.id && other.status !== "running")));
    return { records: selected, pendingPublications: await this.pending(budget) };
  }
  async execute(supplied, retainStart) {
    const request = VerificationRequestSchema.parse(supplied);
    this.canonicalPaths(request.inputPaths);
    if (request.sourcePath !== void 0) {
      this.canonicalPaths([request.sourcePath]);
      if (!request.inputPaths.includes(request.sourcePath))
        throw new Error("Verification source entrypoint must be a declared input");
    }
    const inputs = await this.snapshot(request);
    const start = { id: `execution_${randomUUID3()}`, request, inputs, profile: "native-observed/v1", basisHash: hashFramedDomain("verification-basis/v1", { request, inputs, profile: "native-observed/v1" }), startedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await this.save(seal({ ...start, status: "running" }));
    let record;
    try {
      if (retainStart !== void 0)
        await retainStart(seal({ ...start, status: "running" }));
      const args = request.sourcePath === void 0 ? request.args : [(await this.paths.resolveRead(request.sourcePath)).realTarget, ...request.args];
      const result = await this.launcher.launch({ executable: inputs.producerPath, args, cwd: this.paths.root, env: selectedEnvironment(request.environment), timeoutMs: request.timeoutMs, maxOutputBytes: null, signal: this.signal });
      const after = await this.snapshot(request);
      record = seal({ ...start, completedAt: (/* @__PURE__ */ new Date()).toISOString(), status: canonicalJson(inputs) !== canonicalJson(after) ? "inputs-changed" : result.exitCode === 0 && result.signal === null ? "passed" : "failed", exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr });
    } catch (error) {
      record = seal({ ...start, completedAt: (/* @__PURE__ */ new Date()).toISOString(), status: "interrupted", error: error instanceof Error ? error.message : String(error) });
      await this.save(record);
      throw error;
    }
    await this.save(record);
    return record;
  }
  async assess(eventIds) {
    const budget = this.budget();
    const inspection = await this.inspect(void 0, budget);
    const results = [];
    for (const id of eventIds) {
      const record = inspection.records.find((record2) => record2.id === id);
      if (record === void 0) {
        results.push({ id, observedInputsMatch: false, reusable: false, contradictory: false, reason: "Execution evidence unavailable; execute the required check" });
        continue;
      }
      const contradictory = inspection.records.some((other) => other.basisHash === record.basisHash && (record.status === "passed" && other.status !== "passed" || record.status !== "passed" && other.status === "passed"));
      let observedInputsMatch;
      try {
        observedInputsMatch = canonicalJson(await this.snapshot(record.request, budget)) === canonicalJson(record.inputs);
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
          throw error;
        results.push({ id, observedInputsMatch: false, reusable: false, contradictory, reason: "Current declared input or producer is unavailable; retained execution remains historical evidence" });
        continue;
      }
      results.push({ id, observedInputsMatch, reusable: false, contradictory, reason: contradictory ? "Conflicting outcomes on the same declared basis" : observedInputsMatch ? "Declared inputs match; native observation does not establish complete dependencies or portable reuse" : "Declared inputs or producer changed" });
    }
    return results;
  }
  async recover() {
    const budget = this.budget();
    const store = this.store(this.localRoot, budget);
    const recoveredArtifactSetIds = [];
    for (const item of await this.pending(budget)) {
      this.signal.throwIfAborted();
      if (item.recoverable) {
        await store.resumeFinalize(item.artifactSetId);
        recoveredArtifactSetIds.push(item.artifactSetId);
      }
    }
    const inspection = await this.inspect();
    for (const record of inspection.records)
      await this.retain(record);
    return { recoveredArtifactSetIds, inspection };
  }
  canonicalPaths(paths) {
    return [...new Set(paths.map((path) => {
      const canonical = this.paths.canonicalize(path);
      if (canonical !== path)
        throw new Error(`Verification input path must be canonical: ${path}`);
      const folded = path.toLowerCase();
      if (folded === ".projector/runtime" || folded.startsWith(".projector/runtime/"))
        throw new Error("Verification inputs cannot include runtime evidence");
      return canonical;
    }))].sort();
  }
  async files(paths, allowMissing = false, budget) {
    const files = {};
    for (const path of this.canonicalPaths(paths)) {
      this.signal.throwIfAborted();
      budget?.check("verification-inputs", path);
      try {
        const target = (await this.paths.resolveRead(path)).realTarget;
        const metadata = await stat3(target);
        if (!metadata.isFile())
          throw new Error(`Verification scope requires a regular file: ${path}`);
        budget?.assertFileBytes(metadata.size, path);
        files[path] = await this.hashFile(target, budget);
      } catch (error) {
        if (allowMissing && error instanceof Error && "code" in error && error.code === "ENOENT")
          continue;
        throw error;
      }
    }
    return files;
  }
  async hashFile(path, budget) {
    const digest2 = createHash2("sha256");
    let bytes = 0;
    const stream = createReadStream2(path, { signal: this.signal });
    for await (const chunk of stream) {
      this.signal.throwIfAborted();
      budget?.check("verification-inputs", path);
      bytes += chunk.length;
      budget?.assertFileBytes(bytes, path);
      budget?.consume("maxTotalBytes", chunk.length, "verification-inputs", path);
      digest2.update(chunk);
    }
    return hashFramedDomain("verification-file-bytes", { sha256: digest2.digest("hex"), bytes });
  }
  async snapshot(request, budget = this.budget()) {
    this.signal.throwIfAborted();
    if (!isAbsolute2(request.executable))
      throw new Error("Verification check executable must be an absolute producer path");
    const producerPath = await realpath2(request.executable);
    const populations = [];
    for (const population of request.populations) {
      this.canonicalPaths([population.directory]);
      if (population.recursive && [".", ".projector"].includes(population.directory.toLowerCase()))
        throw new Error("Recursive root or .projector populations include runtime evidence; select root files nonrecursively and declare narrower source directories");
      const members = [];
      const visit = async (directory) => {
        this.signal.throwIfAborted();
        budget.check("verification-population", directory);
        const entries2 = await opendir((await this.paths.resolveRead(directory)).realTarget);
        for await (const entry of entries2) {
          this.signal.throwIfAborted();
          budget.check("verification-population", directory);
          const path = directory === "." ? entry.name : `${directory}/${entry.name}`;
          if (entry.isSymbolicLink())
            throw new Error(`Verification population has unsupported symbolic link: ${path}`);
          if (entry.isDirectory()) {
            budget.consume("maxDirectories", 1, "verification-population", path);
            if (population.recursive)
              await visit(path);
          } else if (entry.isFile()) {
            budget.consume("maxFiles", 1, "verification-population", path);
            members.push(path);
          } else if (!entry.isDirectory())
            throw new Error(`Verification population has unsupported input: ${path}`);
        }
      };
      await visit(population.directory);
      populations.push({ ...population, members: members.sort() });
    }
    return {
      files: await this.files([...request.inputPaths, ...populations.flatMap((population) => population.members)], false, budget),
      populations,
      producerPath,
      producerHash: await this.hashFile(producerPath, budget),
      environmentHash: hashFramedDomain("verification-environment", selectedEnvironment(request.environment)),
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version
    };
  }
};
function selectedEnvironment(names) {
  const selected = {};
  for (const name of [.../* @__PURE__ */ new Set([...names, ...process.platform === "win32" ? ["SystemRoot", "WINDIR", "PATH", "PATHEXT", "TEMP", "TMP"] : []])]) {
    if (process.env[name] !== void 0)
      selected[name] = process.env[name];
  }
  return selected;
}

// node_modules/@projector/control-plane/dist/verification/builtin-service.js
import { createHash as createHash4, randomUUID as randomUUID4 } from "node:crypto";
import { lstat as lstat6, mkdir as mkdir6, opendir as opendir3, realpath as realpath4 } from "node:fs/promises";
import { isAbsolute as isAbsolute4, join as join7, relative as relative3, resolve as resolve2, sep as sep3 } from "node:path";

// node_modules/@projector/control-plane/dist/verification/builtin-inputs.js
async function collectClosedCanonicalInputs(root, target, scope, executable) {
  const options = { signal: scope.signal, stage: "closed-canonical-inputs", executable };
  const targetObject = (await observationGit(root, ["--no-replace-objects", "rev-parse", "--verify", "--end-of-options", `${target}^{object}`], scope.budget, options)).trim();
  const targetTree = (await observationGit(root, ["--no-replace-objects", "rev-parse", "--verify", "--end-of-options", `${targetObject}^{tree}`], scope.budget, options)).trim();
  if (![targetObject, targetTree].every((oid) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(oid)))
    throw new Error("Invalid immutable verification target identity");
  const sources = await collectImmutableCanonicalSources(root, scope, targetTree, new DerivedObservationBudget(scope.limits.maxDerivedBytes), executable);
  return { targetObject, targetTree, sources, files: Object.fromEntries(sources.map((source) => [source.path, hashFramedDomain("repository-artifact-content", Buffer.from(source.source).toString("base64"))])), members: sources.map((source) => ({ id: source.path })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), issues: [] };
}

// node_modules/@projector/control-plane/dist/verification/builtin-producer.js
import { createHash as createHash3 } from "node:crypto";
import { constants as constants3, createReadStream as createReadStream3 } from "node:fs";
import { access, lstat as lstat5, opendir as opendir2, readFile as readFile3, realpath as realpath3 } from "node:fs/promises";
import { delimiter, dirname as dirname3, isAbsolute as isAbsolute3, join as join6, relative as relative2, sep as sep2 } from "node:path";
import { findPackageJSON } from "node:module";
import { fileURLToPath } from "node:url";
async function resolveHostGitExecutable(repositoryRoot) {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    const canonical = directory.replace(/^"|"$/gu, "");
    if (!isAbsolute3(canonical))
      continue;
    const candidate = join6(canonical, process.platform === "win32" ? "git.exe" : "git");
    try {
      const path = await realpath3(candidate), fromRepository = relative2(repositoryRoot, path);
      if (fromRepository !== ".." && !fromRepository.startsWith(`..${sep2}`) && !isAbsolute3(fromRepository))
        continue;
      if (!(await lstat5(path)).isFile())
        continue;
      await access(path, constants3.X_OK);
      return path;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && ["ENOENT", "ENOTDIR", "EACCES"].includes(String(error.code))))
        throw error;
    }
  }
  throw new Error("A host Git executable outside the repository must be available on the absolute host PATH");
}
async function captureBuiltinProducer(entryUrl, budget, signal, transport) {
  const files = {}, visited = /* @__PURE__ */ new Set();
  async function hash(path, identity) {
    signal.throwIfAborted();
    budget.consume("maxFiles", 1, "closed-producer", identity);
    const metadata = await lstat5(path);
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new Error(`Unsupported installed producer file: ${identity}`);
    budget.consume("maxTotalBytes", metadata.size, "closed-producer", identity);
    const digest2 = createHash3("sha256"), stream = createReadStream3(path);
    for await (const chunk of stream) {
      signal.throwIfAborted();
      budget.check("closed-producer", identity);
      digest2.update(chunk);
    }
    const result = `sha256:v1:${digest2.digest("hex")}`;
    if (files[identity] !== void 0 && files[identity] !== result)
      throw new Error(`Installed dependency identity has different bytes: ${identity}`);
    files[identity] = result;
  }
  async function packageRoot(entry2) {
    for (let path = dirname3(await realpath3(entry2)); ; path = dirname3(path)) {
      try {
        const manifest2 = JSON.parse(await readFile3(join6(path, "package.json"), "utf8"));
        if (typeof manifest2.name === "string")
          return path;
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
          throw error;
      }
      if (dirname3(path) === path)
        throw new Error(`Installed producer package cannot be resolved: ${entry2}`);
    }
  }
  async function visitPackage(root2) {
    root2 = await realpath3(root2);
    if (visited.has(root2))
      return;
    visited.add(root2);
    const manifest2 = JSON.parse(await readFile3(join6(root2, "package.json"), "utf8"));
    const identity = `${manifest2.name}@${manifest2.version}`;
    await hash(join6(root2, "package.json"), `${identity}/package.json`);
    async function walk(directory, relative4) {
      signal.throwIfAborted();
      budget.consume("maxDirectories", 1, "closed-producer", `${identity}/${relative4}`);
      for await (const entry2 of await opendir2(directory)) {
        if (entry2.name === "node_modules" || entry2.name === ".git")
          continue;
        const path = join6(directory, entry2.name), key = relative4 ? `${relative4}/${entry2.name}` : entry2.name;
        if (entry2.isSymbolicLink())
          throw new Error(`Installed producer package contains a symlink: ${identity}/${key}`);
        if (entry2.isDirectory())
          await walk(path, key);
        else if (entry2.isFile() && key !== "package.json")
          await hash(path, `${identity}/${key}`);
        else if (!entry2.isFile())
          throw new Error(`Unsupported installed producer entry: ${identity}/${key}`);
      }
    }
    if (manifest2.name.startsWith("@projector/"))
      await walk(join6(root2, "dist"), "dist");
    else
      await walk(root2, "");
    for (const name of Object.keys({ ...manifest2.dependencies, ...manifest2.optionalDependencies }).sort()) {
      const manifestPath = findPackageJSON(name, join6(root2, "package.json"));
      if (manifestPath === void 0)
        throw new Error(`Installed producer dependency is unavailable: ${identity}: ${name}`);
      const dependency = JSON.parse(await readFile3(manifestPath, "utf8"));
      if (dependency.name !== name)
        throw new Error(`Installed producer dependency resolved to a different package: ${identity}: ${name}`);
      await visitPackage(dirname3(manifestPath));
    }
  }
  const entry = fileURLToPath(entryUrl), root = await packageRoot(entry);
  await visitPackage(root);
  const manifest = JSON.parse(await readFile3(join6(root, "package.json"), "utf8"));
  const relativeEntry = relative2(root, await realpath3(entry)).replaceAll("\\", "/");
  const emittedModule = relativeEntry.startsWith("dist/") || manifest.name === "@onepersonlabs/projector" && /^chunks\/shared-[^/]+\.js$/u.test(relativeEntry);
  const production = emittedModule && !process.env.NODE_OPTIONS && !process.execArgv.some((arg) => /^(?:--import|--loader|--experimental-loader|--require|-r)(?:=|$)/u.test(arg));
  await hash(await realpath3(process.execPath), `node@${process.version}/${process.platform}/${process.arch}`);
  await hash(transport.path, `${transport.version.replace(/^git version /u, "git@")}/transport`);
  return { identity: "projector.canonical-integrity/v1", buildHash: hashFramedDomain("closed-producer-build/v1", files), files, production };
}

// node_modules/@projector/control-plane/dist/verification/builtin-service.js
var builtinCanonicalCheck = "projector.canonical-integrity/v1";
var contract = { id: builtinCanonicalCheck, version: "1", input: "Complete immutable canonical source population selected by shipped classifyCanonicalSource, including empty population and config presence", checks: ["canonical schemas and duplicate identity", "static authority, decision, basis and lens compilation", "canonical relation endpoints; external populations remain unknown"], excludes: ["source/runtime behavior", "integration compatibility", "independent whole-result review", "mutation or merge authorization"], acquisition: "Host-trusted Git with isolated environment and no replacement objects", environment: "Node runtime/platform/architecture; NODE_OPTIONS/NODE_PATH and locale; Git transport host trust" };
var contractHash = hashFramedDomain("closed-check-contract/v1", contract);
var digest = (bytes) => createHash4("sha256").update(bytes).digest("hex");
var seal2 = (basis) => ({ ...basis, contentHash: hashFramedDomain("builtin-verification-event/v1", basis) });
function validate2(bytes) {
  const record = BuiltinVerificationEvidenceSchema.parse(JSON.parse(Buffer.from(bytes).toString("utf8")));
  const { contentHash, ...basis } = record;
  if (contentHash !== hashFramedDomain("builtin-verification-event/v1", basis))
    throw new Error("Built-in verification event integrity failed");
  if (createStateBinding(record.binding).dependencyDigest !== record.binding.dependencyDigest)
    throw new Error("Built-in verification dependency integrity failed");
  if (record.basisHash !== hashFramedDomain("builtin-verification-basis/v1", { profile: record.profile, dependencies: record.binding.dependencyDigest }))
    throw new Error("Built-in verification basis integrity failed");
  if (record.artifacts.filter((artifact) => artifact.path === "inputs.json").length !== 1 || record.status !== "running" && record.artifacts.filter((artifact) => artifact.path === "result.json").length !== 1)
    throw new Error("Required closed-check artifact declaration missing");
  return { manifest: record, blobs: record.artifacts };
}
var BuiltinVerificationService = class _BuiltinVerificationService {
  root;
  storeRoot;
  options;
  gitExecutable;
  constructor(root, storeRoot, options, gitExecutable) {
    this.root = root;
    this.storeRoot = storeRoot;
    this.options = options;
    this.gitExecutable = gitExecutable;
  }
  static async create(root, options) {
    if (!isAbsolute4(options.evidenceStoreRoot))
      throw new Error("Built-in verification requires an absolute host evidence retention store");
    root = await realpath4(root);
    const requestedLocation = relative3(root, resolve2(options.evidenceStoreRoot));
    if (requestedLocation !== ".." && !requestedLocation.startsWith(`..${sep3}`) && !isAbsolute4(requestedLocation))
      throw new Error("Built-in durable evidence store must be outside the repository checkout");
    await mkdir6(options.evidenceStoreRoot, { recursive: true });
    const storeRoot = await realpath4(resolve2(options.evidenceStoreRoot)), fromRepository = relative3(root, storeRoot);
    if (fromRepository !== ".." && !fromRepository.startsWith(`..${sep3}`) && !isAbsolute4(fromRepository))
      throw new Error("Built-in durable evidence store must be outside the repository checkout");
    return new _BuiltinVerificationService(root, join7(storeRoot, "builtin-verification"), options, await resolveHostGitExecutable(root));
  }
  store() {
    return new DurableArtifactSetStore(this.storeRoot, validate2);
  }
  trustPolicyHash() {
    return hashFramedDomain("builtin-verification-host-trust/v1", { version: this.options.trustPolicyVersion ?? "1", trustedChecks: [...new Set(this.options.trustedChecks)].sort() });
  }
  async capture(target, scope) {
    const inputs = await collectClosedCanonicalInputs(this.root, target, scope, this.gitExecutable);
    const gitVersion = (await observationGit(this.root, ["--version"], scope.budget, { executable: this.gitExecutable, signal: scope.signal, stage: "closed-git-transport" })).trim();
    const producer = await captureBuiltinProducer(import.meta.url, scope.budget, scope.signal, { path: this.gitExecutable, version: gitVersion });
    const environmentHash = hashFramedDomain("closed-check-environment/v1", { platform: process.platform, architecture: process.arch, nodeVersion: process.version, NODE_OPTIONS: process.env.NODE_OPTIONS ?? null, NODE_PATH: process.env.NODE_PATH ?? null, TZ: process.env.TZ ?? null, LANG: process.env.LANG ?? null, LC_ALL: process.env.LC_ALL ?? null });
    const trustPolicyHash = this.trustPolicyHash();
    const state = { gitBase: inputs.targetObject, worktreeDigest: hashFramedDomain("immutable-verification-tree", inputs.targetTree), canonicalProjectorDigest: hashFramedDomain("closed-canonical-inputs", inputs.files), toolchainDigest: hashFramedDomain("closed-canonical-toolchain", { producer, environmentHash, trustPolicyHash, contractHash }) };
    const values = [
      ...Object.entries(inputs.files).map(([id, versionHash]) => ({ kind: "artifact", id, versionHash, role: "exact immutable canonical source bytes" })),
      { kind: "adapter", id: builtinCanonicalCheck, versionHash: contractHash, role: "complete shipped check contract" },
      { kind: "toolchain", id: "builtin-producer-build", versionHash: producer.buildHash, role: "actual installed producer and dependency bytes" },
      { kind: "toolchain", id: "builtin-environment", versionHash: environmentHash, role: "fixed check runtime environment" },
      { kind: "adapter", id: "builtin-host-trust-policy", versionHash: trustPolicyHash, role: "current host-selected check trust" }
    ];
    const queries = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    queries.register({ id: "projector.canonical-source-population", version: "1", kind: "surface-enumeration", normalizeInput: () => ({ scope: ".projector", selection: builtinCanonicalCheck }), evaluate: () => ({ results: inputs.members, observability: "closed", assumptions: ["Complete successful immutable Git tree enumeration under configured host-trusted Git transport"], unavailableLanes: [], dependencyKeys: ["canonical-source-population", "canonical-config-presence"] }) });
    const query = queries.createSpec({ id: "builtin-canonical-source-population", programId: "projector.canonical-source-population", input: {} });
    const context = { repositoryRoot: this.root, stateDigest: state, config: {}, signal: scope.signal };
    const binding = createStateBinding({ compiledAgainst: state, valueDependencies: values, queryDependencies: [{ query, priorResult: await queries.evaluate(query, context), role: "Complete canonical population including previously empty and absent config" }] });
    return { inputs, producer, environmentHash, trustPolicyHash, binding, queries, context };
  }
  async save(record, artifacts) {
    const store = new DurableArtifactSetStore(this.storeRoot, validate2, {}, { budget: new ObservationBudget(), signal: new AbortController().signal }), artifactSetId = `${record.id}_${record.status === "running" ? "running" : "completed"}`;
    await store.begin({ artifactSetId });
    for (const [path, bytes] of artifacts)
      await store.stageBlob({ artifactSetId, path, bytes });
    await store.finalize({ artifactSetId, manifestBytes: Buffer.from(canonicalJson(record)) });
  }
  async execute(supplied) {
    const request = BuiltinVerificationRequestSchema.parse(supplied);
    if (!this.options.trustedChecks.includes(request.check))
      throw new Error("Current host trust policy does not enable this built-in check");
    return withObservationScope({ ...this.options.signal ? { signal: this.options.signal } : {}, limits: { timeoutMs: request.timeoutMs ?? null } }, async (scope) => {
      const captured = await this.capture(request.target, scope);
      const inputBytes = Buffer.from(canonicalJson({ sources: captured.inputs.sources, files: captured.inputs.files, members: captured.inputs.members, issues: captured.inputs.issues }));
      const artifacts = /* @__PURE__ */ new Map([["inputs.json", inputBytes]]);
      const profile = "projector-closed-static/v1";
      const start = { id: `execution_${randomUUID4()}`, profile, request, targetObject: captured.inputs.targetObject, targetTree: captured.inputs.targetTree, binding: captured.binding, basisHash: hashFramedDomain("builtin-verification-basis/v1", { profile, dependencies: captured.binding.dependencyDigest }), producer: captured.producer, contractHash, environmentHash: captured.environmentHash, trustPolicyHash: captured.trustPolicyHash, startedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await this.save(seal2({ ...start, status: "running", artifacts: [{ path: "inputs.json", sha256: digest(inputBytes) }], findings: [], unknowns: [] }), artifacts);
      let status2 = "passed", findings = [], unknowns = [], error;
      try {
        scope.signal.throwIfAborted();
        scope.budget.check("builtin-canonical-check");
        const result = this.check(captured.inputs, new DerivedObservationBudget(scope.limits.maxDerivedBytes));
        findings = result.findings;
        unknowns = result.unknowns;
        if (findings.length || unknowns.length)
          status2 = "failed";
        const after = await this.capture(captured.inputs.targetTree, scope);
        if (after.binding.dependencyDigest !== captured.binding.dependencyDigest)
          status2 = "inputs-changed";
      } catch (cause) {
        status2 = scope.signal.aborted ? "interrupted" : "failed";
        error = cause instanceof Error ? cause.message : String(cause);
        findings.push(error);
      }
      const resultBytes = Buffer.from(canonicalJson({ check: builtinCanonicalCheck, contractHash, status: status2, findings, unknowns, ...error ? { error } : {} }));
      artifacts.set("result.json", resultBytes);
      const record = seal2({ ...start, status: status2, completedAt: (/* @__PURE__ */ new Date()).toISOString(), artifacts: [...artifacts].map(([path, bytes]) => ({ path, sha256: digest(bytes) })), findings, unknowns, ...error ? { error } : {} });
      await this.save(record, artifacts);
      return record;
    });
  }
  check(inputs, derived) {
    const snapshot2 = parseCanonicalSnapshotSources(inputs.sources, derived), ids = /* @__PURE__ */ new Set();
    for (const document of snapshot2.documents) {
      if (ids.has(document.id))
        throw new Error(`Duplicate canonical identity: ${document.id}`);
      ids.add(document.id);
    }
    const unknowns = validateStaticCanonicalGovernance(snapshot2.documents, ids, { populationComplete: false, derivedBudget: derived });
    unknowns.push(...validateCanonicalRelationEndpoints(snapshot2.documents.filter((document) => document.kind === "relation").map((document) => RelationSchema.parse(document.payload)), ids, { populationComplete: false }));
    return { findings: [...inputs.issues], unknowns };
  }
  async names(directory) {
    let entries2;
    try {
      entries2 = await opendir3(directory);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
    const names = [];
    for await (const entry of entries2) {
      const scope = currentObservationScope();
      scope?.signal.throwIfAborted();
      scope?.budget.consume("maxFiles", 1, "builtin-verification-history", entry.name);
      names.push(entry.name);
    }
    return names.sort();
  }
  async inspect() {
    return withObservationScope({ ...this.options.signal ? { signal: this.options.signal } : {} }, () => this.inspectRecords());
  }
  async inspectRecords() {
    const store = this.store(), records = [];
    for (const slot of await this.names(join7(this.storeRoot, "published"))) {
      const value = await store.read(slot);
      if (value.status !== "published")
        throw new Error(`Built-in verification record ${slot}: ${value.status}`);
      if (slot !== `${value.manifest.id}_${value.manifest.status === "running" ? "running" : "completed"}`)
        throw new Error(`Built-in verification slot identity mismatch: ${slot}`);
      records.push(value.manifest);
    }
    for (const record of records) {
      const start = records.find((other) => other.id === record.id && other.status === "running");
      if (start && (start.basisHash !== record.basisHash || start.startedAt !== record.startedAt))
        throw new Error(`Conflicting built-in verification event identity: ${record.id}`);
    }
    const pendingPublications = [];
    for (const directory of ["staging", "finalizing"])
      for (const artifactSetId of await this.names(join7(this.storeRoot, directory))) {
        let recoverable = false;
        if (directory === "finalizing")
          try {
            recoverable = (await lstat6(join7(this.storeRoot, directory, artifactSetId, "manifest.bin"))).isFile();
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
              throw error;
          }
        pendingPublications.push({ artifactSetId, state: directory === "staging" ? "staged" : "finalizing", recoverable });
      }
    return { scope: builtinCanonicalCheck, records: records.filter((record) => record.status !== "running" || !records.some((other) => other.id === record.id && other.status !== "running")), pendingPublications };
  }
  async assess(input) {
    const result = { eventId: input.eventId, scope: builtinCanonicalCheck, reusable: false, authorization: false, bindingStatus: "unavailable", contradictory: false, reasons: [] };
    if (!/^execution_[0-9a-f-]{36}$/u.test(input.eventId))
      throw new Error("Invalid built-in execution event identifier");
    if (!this.options.trustedChecks.includes(builtinCanonicalCheck))
      return { ...result, reasons: ["Current host trust policy does not enable the retained check"] };
    let inspection;
    try {
      inspection = await this.inspect();
    } catch (error) {
      return { ...result, reasons: [error instanceof Error ? error.message : String(error)] };
    }
    const record = inspection.records.find((record2) => record2.id === input.eventId);
    if (!record)
      return { ...result, reasons: ["Required retained event or artifact is unavailable"] };
    result.contradictory = inspection.records.some((other) => other.basisHash === record.basisHash && (record.status === "passed" && other.status !== "passed" || record.status !== "passed" && other.status === "passed"));
    try {
      return await withObservationScope({ ...this.options.signal ? { signal: this.options.signal } : {} }, async (scope) => {
        const captured = await this.capture(input.target, scope);
        const currentValues = new Map(captured.binding.valueDependencies.map((value) => [`${value.kind}\0${value.id}\0${value.role}`, value.versionHash]));
        const validator = new DependencyScopedStateBindingValidator({ values: { readVersionHash: async (value) => currentValues.get(`${value.kind}\0${value.id}\0${value.role}`) }, queries: captured.queries });
        const validation = await validator.validate(record.binding, captured.binding.compiledAgainst, captured.context);
        const qualified = record.producer.production && captured.producer.production && record.contractHash === contractHash && record.trustPolicyHash === this.trustPolicyHash();
        const reusable = qualified && record.status === "passed" && !record.unknowns.length && !result.contradictory && ["current", "rebound"].includes(validation.status);
        return { ...result, targetObject: captured.inputs.targetObject, targetTree: captured.inputs.targetTree, bindingStatus: validation.status, reusable, reasons: [...validation.reasons, ...!qualified ? ["Producer, runtime, complete contract, or current host trust qualification changed or is unavailable"] : [], ...record.status !== "passed" ? [`Retained execution outcome is ${record.status}`] : [], ...result.contradictory ? ["Conflicting execution outcomes remain on the same complete dependency basis"] : [], ...reusable ? ["Actual retained passed execution and required artifacts are current for this named canonical/static check only; no integration or mutation authorization"] : []] };
      });
    } catch (error) {
      return { ...result, reasons: [`Current immutable target, canonical input population, or trusted producer could not be established: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }
  async recover() {
    const inspection = await this.inspect(), recoveredArtifactSetIds = [];
    for (const pending of inspection.pendingPublications)
      if (pending.recoverable) {
        await this.store().resumeFinalize(pending.artifactSetId);
        recoveredArtifactSetIds.push(pending.artifactSetId);
      }
    return { recoveredArtifactSetIds, inspection: await this.inspect() };
  }
};

// node_modules/@projector/control-plane/dist/change-lifecycle/generated-output.js
import { createHash as createHash5, randomUUID as randomUUID5 } from "node:crypto";
import { createReadStream as createReadStream4 } from "node:fs";
import { opendir as opendir4, stat as stat4, lstat as lstat7 } from "node:fs/promises";
import { join as join8 } from "node:path";
var GeneratedOutputService = class _GeneratedOutputService {
  paths;
  verification;
  storage;
  signal;
  observationTimeoutMs;
  retainedStorage;
  executionOptions;
  constructor(paths, verification, storage, signal, observationTimeoutMs, retainedStorage, executionOptions) {
    this.paths = paths;
    this.verification = verification;
    this.storage = storage;
    this.signal = signal;
    this.observationTimeoutMs = observationTimeoutMs;
    this.retainedStorage = retainedStorage;
    this.executionOptions = executionOptions;
  }
  static async create(root, options = {}) {
    const paths = await RepositoryPathService.create(root);
    const observationTimeoutMs = new ObservationBudget({ timeoutMs: options.observationTimeoutMs ?? null }).limits.timeoutMs;
    return new _GeneratedOutputService(paths, await VerificationService.create(root, options), (await paths.resolveWrite(".projector/runtime/change-lifecycles/generated-outputs")).realTarget, options.signal ?? new AbortController().signal, observationTimeoutMs, options.evidenceStoreRoot === void 0 ? void 0 : join8(options.evidenceStoreRoot, "generated-outputs"), options);
  }
  observation() {
    return new ObservationBudget({ timeoutMs: this.observationTimeoutMs });
  }
  store(readScope, root = this.storage) {
    return new DurableArtifactSetStore(root, (bytes) => {
      const manifest = GeneratedOutputEvidenceSchema.parse(JSON.parse(Buffer.from(bytes).toString("utf8")));
      const { contentHash, ...basis } = manifest;
      if (hashFramedDomain("generated-output-evidence", basis) !== contentHash)
        throw new Error("Generated output evidence integrity failed");
      validateVerificationEvent(manifest.check);
      const request = manifest.request;
      const expected = { executable: request.executable, sourcePath: request.sourcePath, args: request.args, inputPaths: [.../* @__PURE__ */ new Set([request.sourcePath, ...request.inputPaths])], populations: request.populations, environment: request.environment, timeoutMs: request.timeoutMs, ...request.completeInputs === void 0 ? {} : { completeInputs: request.completeInputs } };
      if (canonicalJson(expected) !== canonicalJson(manifest.check.request))
        throw new Error("Generated output execution request association failed");
      return { manifest, blobs: [] };
    }, {}, readScope);
  }
  readScope(budget) {
    return { budget, signal: this.signal, derivedBudget: new DerivedObservationBudget(budget.limits.maxDerivedBytes) };
  }
  async hashOutput(path, size, budget) {
    const digest2 = createHash5("sha256");
    const frame = (length) => {
      const header = Buffer.allocUnsafe(8);
      header.writeBigUInt64BE(length);
      digest2.update(header);
    };
    const prefix = Buffer.from('{"bytes":"');
    const suffix = Buffer.from('"}');
    frame(BigInt(Buffer.byteLength("projector\0sha256\0v1")));
    digest2.update("projector\0sha256\0v1");
    frame(BigInt(Buffer.byteLength("generated-output-bytes")));
    digest2.update("generated-output-bytes");
    frame(4n * ((BigInt(size) + 2n) / 3n) + BigInt(prefix.length + suffix.length));
    digest2.update(prefix);
    let remainder = Buffer.alloc(0);
    let bytes = 0;
    for await (const chunk of createReadStream4(path, { signal: this.signal })) {
      this.signal.throwIfAborted();
      budget.check("generated-output", path);
      bytes += chunk.length;
      budget.assertFileBytes(bytes, path);
      budget.consume("maxTotalBytes", chunk.length, "generated-output", path);
      const joined = remainder.length === 0 ? chunk : Buffer.concat([remainder, chunk]);
      const complete = joined.length - joined.length % 3;
      if (complete > 0)
        digest2.update(joined.subarray(0, complete).toString("base64"));
      remainder = Buffer.from(joined.subarray(complete));
    }
    if (bytes !== size)
      throw new Error(`Generated output changed during observation: ${path}`);
    if (remainder.length > 0)
      digest2.update(remainder.toString("base64"));
    digest2.update(suffix);
    return `sha256:v1:${digest2.digest("hex")}`;
  }
  async outputs(request, budget) {
    const result = {};
    for (const output of request.outputs) {
      this.signal.throwIfAborted();
      budget.check("generated-output", output.path);
      try {
        const path = await this.paths.resolveRead(output.path);
        const metadata = await stat4(path.realTarget);
        if (!metadata.isFile())
          throw new Error(`Generated output requires a regular file: ${output.path}`);
        budget.assertFileBytes(metadata.size, output.path);
        budget.assertTotalBytes(metadata.size, output.path);
        result[output.path] = await this.hashOutput(path.realTarget, metadata.size, budget);
        this.signal.throwIfAborted();
        budget.check("generated-output", output.path);
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
          throw error;
      }
      this.signal.throwIfAborted();
      budget.check("generated-output", output.path);
    }
    this.signal.throwIfAborted();
    budget.check("generated-output", "declared-outputs");
    return result;
  }
  async execute(supplied) {
    const request = GeneratedOutputRequestSchema.parse(supplied);
    const inputs = [.../* @__PURE__ */ new Set([request.sourcePath, ...request.inputPaths])];
    const outputs = request.outputs.map((output) => output.path);
    for (const path of [...inputs, ...outputs]) {
      if (this.paths.canonicalize(path) !== path || path === ".projector/runtime" || path.startsWith(".projector/runtime/"))
        throw new Error(`Invalid generated scope path: ${path}`);
    }
    if (new Set(outputs).size !== outputs.length || outputs.some((path) => inputs.includes(path)))
      throw new Error("Generated output scope must be unique and separate from inputs");
    for (const path of outputs) {
      const reserved = path.toLowerCase();
      if (reserved === ".projector" || reserved.startsWith(".projector/") || reserved === ".git" || reserved.startsWith(".git/"))
        throw new Error(`Generation cannot authorize canonical or Git-owned output writes: ${path}`);
      await this.paths.resolveWrite(path);
    }
    this.signal.throwIfAborted();
    const id = `generated_${randomUUID5()}`;
    const lease = await new WriterLeaseManager(this.paths, { staleAfterMs: 3e4 }).acquireGeneration({ sessionId: id, generationId: id, processId: process.pid, requestHash: hashFramedDomain("generation-request/v1", request), writePaths: outputs });
    const ownership = new AbortController();
    let heartbeat = Promise.resolve();
    let ownershipError;
    const keeper = setInterval(() => {
      heartbeat = heartbeat.then(() => lease.heartbeat()).catch((error) => {
        ownershipError = error;
        ownership.abort(error);
      });
    }, 5e3);
    keeper.unref();
    let failure;
    let record;
    try {
      const execution = await VerificationService.create(this.paths.root, { ...this.executionOptions, signal: AbortSignal.any([this.signal, ownership.signal]) });
      record = await this.executeOwned(request, id, lease, execution);
      if (ownershipError !== void 0)
        throw ownershipError;
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      clearInterval(keeper);
      await heartbeat;
      try {
        await lease.release();
      } catch (error) {
        if (failure !== void 0)
          throw new AggregateError([failure, error], "Generation failed and its writer lease could not be released");
        throw error;
      }
    }
    if (this.retainedStorage !== void 0)
      await retainImmutableRecord(this.store(this.readScope(this.observation()), this.retainedStorage), record.id, record);
    return record;
  }
  async executeOwned(request, id, lease, execution) {
    const budget = this.observation();
    await lease.heartbeat();
    const before = await this.outputs(request, budget);
    const inputs = [.../* @__PURE__ */ new Set([request.sourcePath, ...request.inputPaths])];
    const check = await execution.execute({
      executable: request.executable,
      sourcePath: request.sourcePath,
      args: request.args,
      inputPaths: inputs,
      populations: request.populations,
      environment: request.environment,
      timeoutMs: request.timeoutMs,
      completeInputs: request.completeInputs
    }, async (check2) => {
      await lease.heartbeat();
      if (lease.record.generationId !== id || lease.record.requestHash !== hashFramedDomain("generation-request/v1", request) || canonicalJson(lease.record.writePaths) !== canonicalJson(request.outputs.map((output) => output.path)))
        throw new Error("Generation intent does not match its writer reservation");
      const basis2 = { id, request, check: check2, before, after: {}, afterObservation: "immediate" };
      const intent = { ...basis2, contentHash: hashFramedDomain("generated-output-evidence", basis2) };
      const journal = this.store(void 0, join8(this.storage, "intents"));
      await journal.begin({ artifactSetId: id });
      await journal.finalize({ artifactSetId: id, manifestBytes: Buffer.from(canonicalJson(intent)) });
      await lease.heartbeat();
    });
    const afterBudget = this.observation();
    await lease.heartbeat();
    const basis = { id, request, check, before, after: await this.outputs(request, afterBudget), afterObservation: "immediate" };
    const record = { ...basis, contentHash: hashFramedDomain("generated-output-evidence", basis) };
    const store = this.store(this.readScope(afterBudget));
    await store.begin({ artifactSetId: record.id });
    await store.finalize({ artifactSetId: record.id, manifestBytes: Buffer.from(canonicalJson(record)) });
    await lease.heartbeat();
    return record;
  }
  async inspect(activeProducerIds) {
    return this.inspectWithBudget(activeProducerIds, this.observation());
  }
  async inspectWithBudget(activeProducerIds, budget, readScope = this.readScope(budget)) {
    const recordsById = /* @__PURE__ */ new Map();
    for (const root of [.../* @__PURE__ */ new Set([this.storage, ...this.retainedStorage === void 0 ? [] : [this.retainedStorage]])]) {
      const store = this.store(readScope, root);
      const names = await this.recordNames(join8(store.storageRoot, "published"), budget);
      for (const name of names.sort()) {
        this.signal.throwIfAborted();
        budget.check("generated-history", name);
        const value = await store.read(name);
        this.signal.throwIfAborted();
        budget.check("generated-history", name);
        if (value.status !== "published")
          throw new Error(`Generated output record ${name} is ${value.status}`);
        const prior = recordsById.get(value.manifest.id);
        if (prior !== void 0 && prior.contentHash !== value.manifest.contentHash)
          throw new Error(`Conflicting generated event: ${value.manifest.id}`);
        recordsById.set(value.manifest.id, value.manifest);
      }
    }
    const records = [...recordsById.values()];
    const retainedChecks = (await this.verification.inspect(records.map((record) => record.check.id))).records;
    for (const record of records) {
      const retained = retainedChecks.find((check) => check.id === record.check.id);
      if (retained !== void 0 && retained.contentHash !== record.check.contentHash)
        throw new Error(`Generated output execution identity conflict: ${record.check.id}`);
    }
    budget.check("generated-history", "records");
    const assessment = await this.verification.assess(records.map((record) => record.check.id));
    const results = [];
    for (const record of records) {
      this.signal.throwIfAborted();
      budget.check("generated-history", record.id);
      const active = activeProducerIds.includes(record.request.producerId);
      const checkAssessment = assessment.find((check) => check.id === record.check.id);
      const eligibleForCurrent = record.afterObservation === "immediate" && active && record.check.status === "passed" && checkAssessment?.observedInputsMatch === true && checkAssessment.contradictory === false;
      const currentOutputs = eligibleForCurrent ? await this.outputs(record.request, budget) : void 0;
      const current = currentOutputs !== void 0 && record.request.outputs.every(({ path }) => record.after[path] !== void 0 && record.after[path] === currentOutputs[path]);
      const reason = !active ? "Producer retired" : record.afterObservation === "recovery" ? "Outputs observed during recovery; immediate post-execution association unavailable" : current ? "Constructed runtime invocation, declared inputs and observed outputs match; exclusive causation is unproven and portable reuse is unsupported" : eligibleForCurrent ? "Observed generated outputs changed or are missing" : record.check.status !== "passed" ? `Execution status is ${record.check.status}` : checkAssessment?.reason ?? "Execution evidence unavailable";
      const outputs = record.request.outputs.map((output) => ({
        ...output,
        observation: record.after[output.path] === void 0 ? "missing" : record.before[output.path] === record.after[output.path] ? "unchanged-after-invocation" : "changed-after-invocation",
        disposition: current ? "current" : output.ownership === "retained" ? "preserve-and-review" : active ? "regenerate" : "removal-eligible"
      }));
      results.push({ evidence: record, current, reason, outputs });
    }
    return { records: results, pendingPublications: await this.pending(budget, readScope) };
  }
  async recordNames(directory, budget) {
    this.signal.throwIfAborted();
    budget.check("generated-history", directory);
    let entries2;
    try {
      entries2 = await opendir4(directory);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
    const names = [];
    for await (const entry of entries2) {
      this.signal.throwIfAborted();
      budget.consume("maxFiles", 1, "generated-history", directory);
      names.push(entry.name);
    }
    return names.sort();
  }
  async pending(budget, readScope = this.readScope(budget)) {
    const store = this.store(readScope);
    const pending = [];
    for (const [directory, state] of [["staging", "staged"], ["finalizing", "finalizing"]]) {
      const names = await this.recordNames(join8(store.storageRoot, directory), budget);
      for (const artifactSetId of names.sort()) {
        this.signal.throwIfAborted();
        budget.check("generated-history", artifactSetId);
        const observed = await store.read(artifactSetId);
        this.signal.throwIfAborted();
        budget.check("generated-history", artifactSetId);
        if (observed.status === "published" || observed.status === "missing")
          continue;
        if (observed.status === "integrity-failed")
          throw new Error(`Generated publication ${artifactSetId}: ${observed.reason}`);
        let recoverable = false;
        if (state === "finalizing") {
          try {
            recoverable = (await lstat7(join8(store.storageRoot, directory, artifactSetId, "manifest.bin"))).isFile();
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
              throw error;
          }
        }
        pending.push({ artifactSetId, state, recoverable });
      }
    }
    const intents = this.store(readScope, join8(this.storage, "intents"));
    for (const [directory, state] of [["staging", "staged"], ["finalizing", "finalizing"]]) {
      for (const artifactSetId of await this.recordNames(join8(intents.storageRoot, directory), budget)) {
        if ((await store.read(artifactSetId)).status === "published" || pending.some((item) => item.artifactSetId === artifactSetId))
          continue;
        const observed = await intents.read(artifactSetId);
        if (observed.status === "integrity-failed")
          throw new Error(`Generation intent ${artifactSetId}: ${observed.reason}`);
        let recoverable = false;
        if (state === "finalizing") {
          try {
            const bytes = await readObservationFile(join8(intents.storageRoot, directory, artifactSetId, "manifest.bin"), budget, artifactSetId, this.signal);
            const intent = (await intents.validateManifest(bytes)).manifest;
            const execution = (await this.verification.inspect([intent.check.id], budget)).records[0];
            recoverable = execution !== void 0 && execution.status !== "running";
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
              throw error;
          }
        }
        pending.push({ artifactSetId, state, recoverable });
      }
    }
    for (const artifactSetId of await this.recordNames(join8(intents.storageRoot, "published"), budget)) {
      const prepared = pending.find((item) => item.artifactSetId === artifactSetId);
      if (prepared?.recoverable === true)
        continue;
      if ((await store.read(artifactSetId)).status === "published")
        continue;
      const intent = await intents.read(artifactSetId);
      if (intent.status !== "published")
        throw new Error(`Generation intent ${artifactSetId}: ${intent.status}`);
      const execution = (await this.verification.inspect([intent.manifest.check.id], budget)).records[0];
      const recoverable = execution !== void 0 && execution.status !== "running";
      if (prepared !== void 0)
        prepared.recoverable = recoverable;
      else
        pending.push({ artifactSetId, state: "staged", recoverable });
    }
    return pending;
  }
  async recover(activeProducerIds) {
    const budget = this.observation();
    budget.check("generated-recovery", "records");
    const readScope = this.readScope(budget);
    const store = this.store(readScope);
    const recoveredArtifactSetIds = [];
    for (const item of await this.pending(budget, readScope)) {
      this.signal.throwIfAborted();
      budget.check("generated-recovery", item.artifactSetId);
      if (!item.recoverable)
        continue;
      const journal = this.store(readScope, join8(this.storage, "intents"));
      let intent = await journal.read(item.artifactSetId);
      let preparedManifest = false;
      try {
        preparedManifest = (await lstat7(join8(store.storageRoot, "finalizing", item.artifactSetId, "manifest.bin"))).isFile();
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
          throw error;
      }
      if (preparedManifest) {
        await store.resumeFinalize(item.artifactSetId);
      } else {
        if (intent.status === "incomplete") {
          await journal.resumeFinalize(item.artifactSetId);
          intent = await journal.read(item.artifactSetId);
        }
        if (intent.status !== "published")
          throw new Error(`Generation recovery intent ${item.artifactSetId}: ${intent.status}`);
        const execution = (await this.verification.inspect([intent.manifest.check.id])).records[0];
        if (execution === void 0 || execution.status === "running")
          continue;
        const basis = { id: intent.manifest.id, request: intent.manifest.request, check: execution, before: intent.manifest.before, after: await this.outputs(intent.manifest.request, budget), afterObservation: "recovery" };
        const record = { ...basis, contentHash: hashFramedDomain("generated-output-evidence", basis) };
        await store.begin({ artifactSetId: record.id });
        await store.finalize({ artifactSetId: record.id, manifestBytes: Buffer.from(canonicalJson(record)) });
      }
      recoveredArtifactSetIds.push(item.artifactSetId);
      this.signal.throwIfAborted();
      budget.check("generated-recovery", item.artifactSetId);
    }
    budget.check("generated-recovery", "records");
    const inspection = await this.inspectWithBudget(activeProducerIds, budget, readScope);
    if (this.retainedStorage !== void 0)
      for (const record of inspection.records)
        await retainImmutableRecord(this.store(readScope, this.retainedStorage), record.evidence.id, record.evidence);
    return { recoveredArtifactSetIds, inspection };
  }
};

// node_modules/@projector/control-plane/dist/architecture-evaluation/service.js
async function evaluateArchitectureOptions(observation, request, host = {}) {
  const input = ArchitectureEvaluationRequestSchema.parse(request);
  const documents = observation.canonical.documents;
  const read = (id, kind) => documents.find((item) => item.id === id && item.kind === kind)?.payload;
  const concern = ArchitectureConcernSchema.parse(read(input.concernId, "architecture-concern"));
  if (concern.semanticHash !== hashSemantic("architecture-concern", concern))
    throw new Error(`concern ${concern.id} failed semantic authentication`);
  if (concern.status !== "active" && concern.status !== "candidate")
    throw new Error(`concern ${concern.id} is not open for evaluation`);
  const authorities = documents.filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload)).filter((record) => record.subjectId === concern.id && (record.status === "approved" || record.status === "auto-approved"));
  for (const record of authorities)
    if (record.semanticHash !== hashSemantic("authority-record", record))
      throw new Error(`authority ${record.id} failed semantic authentication`);
  const policies = authorities.flatMap((record) => record.evidenceRefreshPolicy === void 0 ? [] : [record.evidenceRefreshPolicy]);
  const required = (input.research?.required ?? true) || concern.materiality === "blocking-now" || policies.length > 0;
  const maxAgeDays = Math.min(input.research?.maxAgeDays ?? 30, ...policies.flatMap((policy) => policy.mode === "max-age" && policy.maxAgeDays !== void 0 ? [policy.maxAgeDays] : []));
  const evaluatedAt = (host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
  const clock = Date.parse(evaluatedAt);
  if (!Number.isFinite(clock))
    throw new Error("architecture evaluation clock is invalid");
  const records = input.research?.records ?? [];
  const recordIdentities = /* @__PURE__ */ new Map();
  for (const record of records) {
    const identity = canonicalJson(record);
    if (recordIdentities.has(record.id) && recordIdentities.get(record.id) !== identity)
      throw new Error(`conflicting research evidence ${record.id}`);
    recordIdentities.set(record.id, identity);
  }
  const usable = records.filter((record) => {
    const captured = Date.parse(record.capturedAt);
    return record.locator.trim().length > 0 && Number.isFinite(captured) && captured <= clock && clock - captured <= maxAgeDays * 864e5 && record.freshness > 0 && record.applicability === "direct" && record.reliability !== "untrusted" && record.claims.some(({ subjectKey }) => subjectKey === concern.id) && (!policies.some(({ requireOfficialSourceWhenAvailable }) => requireOfficialSourceWhenAvailable) || record.normativeAuthority === "authoritative-guidance") && !policies.some(({ mode }) => mode === "version-sensitive");
  });
  const options = input.options;
  const matchesPreference = (preference, option) => canonicalJson(preference.selector) === canonicalJson(concern.scope) || evaluateSelector(preference.selector, { id: option.key, values: { tag: option.key }, dependencyKeys: [] }).matched;
  const covered = options.every((option) => usable.some((record) => option.evidence.some(({ evidenceId }) => evidenceId === record.id) && record.claims.some(({ subjectKey }) => subjectKey === option.key)));
  const preferenceIds = [];
  for (const id of /* @__PURE__ */ new Set([...input.preferenceIds ?? [], ...documents.filter(({ kind }) => kind === "developer-preference").map(({ id: id2 }) => id2)])) {
    const payload = read(id, "developer-preference");
    if (payload === void 0)
      throw new Error(`authenticated preference ${id} is unavailable`);
    const preference = DeveloperPreferenceSchema.parse(payload);
    if (preference.id !== id || preference.semanticHash !== hashSemantic("developer-preference", preference))
      throw new Error(`preference ${id} failed semantic authentication`);
    if (preference.status === "active" && options.some((option) => matchesPreference(preference, option)))
      preferenceIds.push(id);
  }
  const result = await evaluateDecisionOptions({ concern, options, preferenceIds, research: { required, affectedEvidenceIds: concern.evidence.map(({ evidenceId }) => evidenceId) }, acceptance: input.acceptance ?? { kind: "automatic" }, evaluatedAt }, {
    research: { verifyOptionSet: async () => ({ options, evidenceIds: usable.map(({ id }) => id), unavailable: !covered, uncertainty: ["Research provenance is submitted evidence; source hashes do not attest external truth.", ...!covered ? ["Fresh concern-scoped research does not cover every proposed option."] : []] }) },
    preferences: {
      read: async (id) => {
        const record = read(id, "developer-preference");
        return record === void 0 ? void 0 : DeveloperPreferenceSchema.parse(record);
      },
      match: async ({ preference, options: candidates }) => candidates.filter((option) => matchesPreference(preference, option)).map(({ key }) => key)
    },
    authority: { read: async (id) => {
      const record = read(id, "authority-record");
      return record === void 0 ? void 0 : AuthorityRecordSchema.parse(record);
    } }
  });
  return { ...result, canonicalMutationAuthorized: false };
}
async function evaluateRepositoryArchitectureOptions(repositoryRoot, request) {
  return evaluateArchitectureOptions(await observeChangeRepository(repositoryRoot), request);
}

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
  assessGitIntegration,
  PreparedProjectInitializationResultSchema,
  initializePreparedProject,
  inspectProjectReadiness,
  withProjectOperationAccess2 as withProjectOperationAccess,
  RepresentationProfileReconciliationOutputSchema,
  RepresentationProfileReconciliationOperationOutputSchema,
  projectRepresentationProfileReconciliationOperation,
  RepositoryRepresentationProfileReconciliationService,
  shutdownCodeIndexRuns,
  executeCodeOperation,
  executeCodeTestReplay,
  VerificationService,
  builtinCanonicalCheck,
  BuiltinVerificationService,
  GeneratedOutputService,
  evaluateRepositoryArchitectureOptions
};
