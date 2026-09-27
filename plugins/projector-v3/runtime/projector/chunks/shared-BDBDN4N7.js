import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  FileTransactionJournal,
  RepositoryPathService,
  fileTransactionJournalRelativePath,
  parseFileTransactionJournalSource
} from "./shared-3WNQLUKU.js";
import {
  authenticatePreparedStateBoundChangeSuccess,
  createExecutionApproval,
  executionCapsuleHash,
  executionPlanHash
} from "./shared-FZTNE5ZL.js";
import {
  ChangeCertificateSchema,
  ChangeProposalSchema,
  ContentHashSchema,
  ExecutionCapsuleSchema,
  ExecutionPlanSchema,
  StateBindingSchema,
  StateDigestSchema,
  TransactionPhaseSchema,
  TransactionReceiptSchema,
  TransformPreviewSchema,
  TransformResultSchema,
  ValidationResultSchema,
  canonicalJson,
  external_exports,
  hashFramedDomain
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/change-lifecycle/store.js
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
var apiVersion = "projector.change-lifecycle/v1";
var storeRoot = ".projector/runtime/change-lifecycles";
var capsuleBindingSchema = external_exports.object({ packetId: external_exports.string(), capsuleId: external_exports.string(), capsuleHash: ContentHashSchema }).strict();
var executionApprovalSchema = external_exports.object({ id: external_exports.string(), planId: external_exports.string(), planRevision: external_exports.number().int(), planHash: ContentHashSchema, dependencyDigest: ContentHashSchema, capsuleId: external_exports.string(), capsuleHash: ContentHashSchema }).strict();
var captureSchema = external_exports.object({ apiVersion: external_exports.literal(apiVersion), semanticChangeId: external_exports.string(), request: external_exports.string(), proposal: ChangeProposalSchema, proposalHash: ContentHashSchema, planId: external_exports.string(), planRevision: external_exports.number().int(), planHash: ContentHashSchema, stateBinding: StateBindingSchema, plan: ExecutionPlanSchema, capsules: external_exports.array(ExecutionCapsuleSchema), capsuleBindings: external_exports.array(capsuleBindingSchema), exactPatchInputHash: ContentHashSchema, knowledgeContextId: external_exports.string().min(1).optional(), capturedAt: external_exports.string(), contentHash: ContentHashSchema }).strict();
var approvalSchema = external_exports.object({ apiVersion: external_exports.literal(apiVersion), id: external_exports.string(), semanticChangeId: external_exports.string(), planHash: ContentHashSchema, knowledgeContextId: external_exports.string().min(1).optional(), approvals: external_exports.array(executionApprovalSchema), approvedAt: external_exports.string(), contentHash: ContentHashSchema }).strict();
var attemptSchema = external_exports.object({ apiVersion: external_exports.literal(apiVersion), id: external_exports.string(), approvalId: external_exports.string(), semanticChangeId: external_exports.string(), planHash: ContentHashSchema, transactionId: external_exports.string(), startedAt: external_exports.string(), contentHash: ContentHashSchema }).strict();
var completionAssessmentSchema = external_exports.object({ unitStates: external_exports.array(external_exports.object({ unitId: external_exports.string(), state: external_exports.enum(["valid", "removed", "exception"]) }).strict()), newDivergenceIds: external_exports.array(external_exports.string()), unknowns: external_exports.array(external_exports.string()), unavailableActions: external_exports.array(external_exports.string()), availableArtifacts: external_exports.array(external_exports.string()), cleanWorkingTree: external_exports.boolean() }).strict();
var certificateArtifactSchema = external_exports.object({ version: external_exports.literal(1), outcome: external_exports.enum(["success", "failure", "partial"]), lastCheckpointId: external_exports.string().optional(), journalPhase: external_exports.union([TransactionPhaseSchema, external_exports.literal("not-started")]), recoveryState: external_exports.enum(["not-required", "rolled-back", "recovery-required"]), reasons: external_exports.array(external_exports.string()), completionAssessment: completionAssessmentSchema.optional(), certificate: ChangeCertificateSchema }).strict();
var preparedSuccessSchema = external_exports.object({ version: external_exports.literal(1), preparationId: external_exports.string(), checkpointId: external_exports.string(), planId: external_exports.string(), executionApprovalId: external_exports.string(), beforeState: StateDigestSchema, afterState: StateDigestSchema, preview: TransformPreviewSchema.optional(), transformResult: TransformResultSchema, validations: external_exports.array(ValidationResultSchema), completionAssessment: completionAssessmentSchema, certificateArtifact: certificateArtifactSchema, certificateHash: ContentHashSchema, receipt: TransactionReceiptSchema, receiptHash: ContentHashSchema, contentHash: ContentHashSchema }).strict();
var preparedSchema = external_exports.object({ apiVersion: external_exports.literal(apiVersion), attemptId: external_exports.string(), approvalId: external_exports.string(), transactionId: external_exports.string(), prepared: preparedSuccessSchema, preparedSuccessHash: ContentHashSchema, preparedAt: external_exports.string(), contentHash: ContentHashSchema }).strict();
var stateSchema = external_exports.object({ apiVersion: external_exports.literal(apiVersion), attemptId: external_exports.string(), approvalId: external_exports.string(), transactionId: external_exports.string(), status: external_exports.literal("committed-unpublished"), preparedSuccessHash: ContentHashSchema, transactionRecordHash: ContentHashSchema, recordedAt: external_exports.string(), contentHash: ContentHashSchema }).strict();
var stateBoundResultSchema = external_exports.object({ outcome: external_exports.enum(["success", "failure", "partial"]), reasons: external_exports.array(external_exports.string()), preview: TransformPreviewSchema.optional(), transformResult: TransformResultSchema.optional(), validations: external_exports.array(ValidationResultSchema), certificate: ChangeCertificateSchema, certificateHash: ContentHashSchema, certificateRef: external_exports.string(), receipt: TransactionReceiptSchema, receiptHash: ContentHashSchema, receiptRef: external_exports.string() }).strict();
var recoveryResultSchema = external_exports.object({ kind: external_exports.literal("recovery"), attemptId: external_exports.string(), transactionId: external_exports.string(), action: external_exports.enum(["finalized", "rolled-back", "no-transaction", "recovery-required"]), reason: external_exports.string().optional() }).strict();
var resultSchema = external_exports.object({ apiVersion: external_exports.literal(apiVersion), attemptId: external_exports.string(), approvalId: external_exports.string(), outcome: external_exports.enum(["success", "failure", "partial"]), result: external_exports.union([stateBoundResultSchema, recoveryResultSchema]), resultHash: ContentHashSchema, completedAt: external_exports.string(), contentHash: ContentHashSchema, preparedSuccessHash: ContentHashSchema.optional(), transactionRecordHash: ContentHashSchema.optional(), certificateHash: ContentHashSchema.optional(), receiptHash: ContentHashSchema.optional() }).strict();
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function selectorName(selector) {
  if (selector.trim() === "" || selector.includes("\0"))
    throw new Error("lifecycle selector must be nonblank safe text");
  return `${hashFramedDomain("change-lifecycle-selector", selector).slice("sha256:v1:".length)}.json`;
}
function hashRecord(domain, record) {
  const { contentHash: _contentHash, ...basis } = record;
  return hashFramedDomain(domain, basis);
}
function sameStateBinding(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}
function capsuleBindings(capsules) {
  const ids = /* @__PURE__ */ new Set();
  return [...capsules].sort((left, right) => compare(left.id, right.id)).map((capsule) => {
    if (ids.has(capsule.id))
      throw new Error(`duplicate lifecycle capsule: ${capsule.id}`);
    ids.add(capsule.id);
    return { packetId: capsule.taskId, capsuleId: capsule.id, capsuleHash: executionCapsuleHash(capsule) };
  });
}
function withoutCaptureTime(record) {
  const { capturedAt: _capturedAt, contentHash: _contentHash, ...basis } = record;
  return basis;
}
function parseCapture(source) {
  const value = captureSchema.parse(JSON.parse(source));
  if (value.contentHash !== hashRecord("change-lifecycle-capture", value))
    throw new Error("lifecycle capture content hash authentication failed");
  if (executionPlanHash(value.plan) !== value.planHash || !sameStateBinding(value.plan.boundState, value.stateBinding) || canonicalJson(capsuleBindings(value.capsules)) !== canonicalJson(value.capsuleBindings)) {
    throw new Error("lifecycle capture immutable plan or capsules failed authentication");
  }
  return value;
}
function parseApproval(source) {
  const value = approvalSchema.parse(JSON.parse(source));
  if (value.contentHash !== hashRecord("change-lifecycle-approval", value))
    throw new Error("lifecycle approval content hash authentication failed");
  return value;
}
var ChangeLifecycleStore = class _ChangeLifecycleStore {
  paths;
  collected;
  now;
  newId;
  constructor(paths, options, collected) {
    this.paths = paths;
    this.collected = collected;
    this.now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
    this.newId = options.newId ?? randomUUID;
  }
  static async create(repositoryRoot, options = {}) {
    return new _ChangeLifecycleStore(await RepositoryPathService.create(repositoryRoot), options);
  }
  /** The ordinary authenticators read only these already-bounded sources. Writes are unavailable. */
  static fromCollectedSources(repositoryRoot, sources) {
    return new _ChangeLifecycleStore(void 0, {}, { repositoryRoot, sources });
  }
  requirePaths() {
    if (this.paths === void 0)
      throw new Error("Collected lifecycle sources do not provide filesystem or write access");
    return this.paths;
  }
  collectedSource(path) {
    const source = this.collected?.sources[path];
    if (source === void 0)
      throw Object.assign(new Error(`Collected lifecycle source is unavailable: ${path}`), { code: "ENOENT" });
    return source;
  }
  readTransaction(transactionId) {
    return this.collected === void 0 ? new FileTransactionJournal(this.requirePaths()).read(transactionId) : Promise.resolve(parseFileTransactionJournalSource(this.collectedSource(fileTransactionJournalRelativePath(transactionId)), transactionId, this.collected.repositoryRoot));
  }
  async capture(input) {
    if (input.plan.semanticChangeId !== input.semanticChangeId)
      throw new Error("lifecycle plan belongs to another semantic change");
    if (hashFramedDomain("repository-change-proposal", input.proposal) !== input.proposalHash)
      throw new Error("lifecycle proposal hash is invalid");
    const bindings = capsuleBindings(input.capsules);
    if (canonicalJson(input.plan.packetIds) !== canonicalJson(bindings.map(({ packetId }) => packetId).sort(compare))) {
      throw new Error("lifecycle capsules do not cover the immutable plan packets");
    }
    for (const capsule of input.capsules) {
      if (!sameStateBinding(capsule.boundState, input.plan.boundState))
        throw new Error(`lifecycle capsule ${capsule.id} has another state binding`);
    }
    const basis = {
      apiVersion,
      semanticChangeId: input.semanticChangeId,
      request: input.request,
      proposal: structuredClone(input.proposal),
      proposalHash: input.proposalHash,
      planId: input.plan.id,
      planRevision: input.plan.revision,
      planHash: executionPlanHash(input.plan),
      stateBinding: structuredClone(input.plan.boundState),
      plan: structuredClone(input.plan),
      capsules: structuredClone(input.capsules),
      capsuleBindings: bindings,
      exactPatchInputHash: input.exactPatchInputHash,
      ...input.knowledgeContextId === void 0 ? {} : { knowledgeContextId: input.knowledgeContextId }
    };
    const existing = await this.tryReadCapture(input.semanticChangeId);
    if (existing !== void 0) {
      if (canonicalJson(withoutCaptureTime(existing)) !== canonicalJson(basis))
        throw new Error(`conflicting lifecycle capture for ${input.semanticChangeId}`);
      return existing;
    }
    const withTime = { ...basis, capturedAt: this.now() };
    const record = { ...withTime, contentHash: hashFramedDomain("change-lifecycle-capture", withTime) };
    await this.writeNew(`captures/${selectorName(input.semanticChangeId)}`, record);
    return this.readCapture(input.semanticChangeId);
  }
  async readCapture(selector) {
    const source = await this.read(`captures/${selectorName(selector)}`);
    const record = parseCapture(source);
    if (record.semanticChangeId !== selector)
      throw new Error("lifecycle capture selector does not match authenticated identity");
    return record;
  }
  async approve(selector, presentedPlanHash, plan, capsules) {
    const capture = await this.readCapture(selector);
    if (presentedPlanHash !== capture.planHash)
      throw new Error("presented plan hash does not match the captured immutable plan hash");
    if (executionPlanHash(plan) !== capture.planHash || plan.id !== capture.planId || plan.revision !== capture.planRevision || !sameStateBinding(plan.boundState, capture.stateBinding)) {
      throw new Error("approval plan does not match the authenticated lifecycle capture");
    }
    const bindings = capsuleBindings(capsules);
    if (canonicalJson(bindings) !== canonicalJson(capture.capsuleBindings))
      throw new Error("approval capsules do not match the authenticated lifecycle capture");
    const approvals = [...capsules].sort((left, right) => compare(left.id, right.id)).map((capsule) => {
      const approvalId = `approval_${hashFramedDomain("change-lifecycle-execution-approval-id", { semanticChangeId: selector, planHash: capture.planHash, capsuleId: capsule.id }).slice(-32)}`;
      return createExecutionApproval(plan, capsule, approvalId);
    });
    const stable = { apiVersion, semanticChangeId: selector, planHash: capture.planHash, ...capture.knowledgeContextId === void 0 ? {} : { knowledgeContextId: capture.knowledgeContextId }, approvals };
    const stableHash = hashFramedDomain("change-lifecycle-approval-identity", stable);
    const withTime = { ...stable, id: `lifecycle_approval_${stableHash.slice(-32)}`, approvedAt: this.now() };
    const record = { ...withTime, contentHash: hashFramedDomain("change-lifecycle-approval", withTime) };
    const existing = await this.tryReadApproval(record.id);
    if (existing !== void 0) {
      const { approvedAt: _existingTime, contentHash: _existingHash, ...existingStable } = existing;
      const { approvedAt: _newTime, contentHash: _newHash, ...newStable } = record;
      if (canonicalJson(existingStable) !== canonicalJson(newStable))
        throw new Error(`conflicting lifecycle approval ${record.id}`);
      return existing;
    }
    await this.writeNew(`approvals/${selectorName(record.id)}`, record);
    return this.readApproval(record.id);
  }
  async readApproval(selector) {
    const record = parseApproval(await this.read(`approvals/${selectorName(selector)}`));
    if (record.id !== selector)
      throw new Error("lifecycle approval selector does not match authenticated identity");
    return record;
  }
  async beginAttempt(approvalSelector) {
    const approval = await this.readApproval(approvalSelector);
    const nonce = this.newId();
    if (nonce.trim() === "" || nonce.includes("\0"))
      throw new Error("attempt identity source returned unsafe text");
    const stable = {
      apiVersion,
      id: `lifecycle_attempt_${hashFramedDomain("change-lifecycle-attempt-id", { approvalId: approval.id, nonce }).slice(-32)}`,
      approvalId: approval.id,
      semanticChangeId: approval.semanticChangeId,
      planHash: approval.planHash,
      transactionId: `transaction_${hashFramedDomain("change-lifecycle-transaction-id", { approvalId: approval.id, nonce }).slice(-32)}`,
      startedAt: this.now()
    };
    const record = { ...stable, contentHash: hashFramedDomain("change-lifecycle-attempt", stable) };
    await this.writeNew(`attempts/${selectorName(record.id)}`, record);
    return this.readAttempt(record.id);
  }
  async readAttempt(selector) {
    const value = attemptSchema.parse(JSON.parse(await this.read(`attempts/${selectorName(selector)}`)));
    if (value.apiVersion !== apiVersion || value.id !== selector || value.contentHash !== hashRecord("change-lifecycle-attempt", value)) {
      throw new Error("lifecycle attempt content hash authentication failed");
    }
    return value;
  }
  async completeAttempt(attemptSelector, outcome, result) {
    if (outcome === "success")
      throw new Error("successful lifecycle attempts require journal- and artifact-authenticated completion");
    const attempt = await this.readAttempt(attemptSelector);
    const resultHash = hashFramedDomain("change-lifecycle-execution-result", result);
    const stable = { apiVersion, attemptId: attempt.id, approvalId: attempt.approvalId, outcome, result: structuredClone(result), resultHash, completedAt: this.now() };
    const record = { ...stable, contentHash: hashFramedDomain("change-lifecycle-attempt-result", stable) };
    await this.writeNew(`results/${selectorName(attempt.id)}`, record);
    return this.readAttemptResult(attempt.id);
  }
  async prepareAttemptSuccess(attemptSelector, untrusted) {
    const attempt = await this.readAttempt(attemptSelector);
    const approval = await this.readApproval(attempt.approvalId);
    const prepared = authenticatePreparedStateBoundChangeSuccess(untrusted);
    if (prepared.planId !== approval.approvals[0]?.planId || prepared.executionApprovalId !== approval.approvals[0]?.id) {
      throw new Error("prepared success belongs to another authenticated lifecycle approval");
    }
    const basis = {
      apiVersion,
      attemptId: attempt.id,
      approvalId: attempt.approvalId,
      transactionId: attempt.transactionId,
      prepared: structuredClone(prepared),
      preparedSuccessHash: prepared.contentHash,
      preparedAt: this.now()
    };
    const record = { ...basis, contentHash: hashFramedDomain("change-lifecycle-prepared-success", basis) };
    await this.writeNew(`prepared/${selectorName(attempt.id)}`, record);
    return this.readPreparedSuccess(attempt.id);
  }
  async readPreparedSuccess(attemptSelector) {
    const value = preparedSchema.parse(JSON.parse(await this.read(`prepared/${selectorName(attemptSelector)}`)));
    if (value.apiVersion !== apiVersion || value.attemptId !== attemptSelector || value.preparedSuccessHash !== value.prepared?.contentHash || value.contentHash !== hashRecord("change-lifecycle-prepared-success", value)) {
      throw new Error("lifecycle prepared success content hash authentication failed");
    }
    authenticatePreparedStateBoundChangeSuccess(value.prepared);
    const attempt = await this.readAttempt(attemptSelector);
    if (value.approvalId !== attempt.approvalId || value.transactionId !== attempt.transactionId) {
      throw new Error("lifecycle prepared success attempt binding authentication failed");
    }
    return value;
  }
  async completeSuccessfulAttempt(attemptSelector, result, transaction) {
    const attempt = await this.readAttempt(attemptSelector);
    const preparedRecord = await this.readPreparedSuccess(attempt.id);
    const prepared = preparedRecord.prepared;
    if (result.outcome !== "success" || transaction.entry.transactionId !== attempt.transactionId || transaction.entry.planId !== prepared.planId || transaction.entry.phase !== "committed" || !transaction.entry.checkpointIds.includes(prepared.checkpointId) || result.certificateHash !== prepared.certificateHash || result.receiptHash !== prepared.receiptHash) {
      throw new Error("successful lifecycle result does not authenticate its prepared journal commit");
    }
    await this.authenticateArtifact("certificate", result.certificateHash, result.certificateRef);
    await this.authenticateArtifact("receipt", result.receiptHash, result.receiptRef);
    const resultHash = hashFramedDomain("change-lifecycle-execution-result", result);
    const stable = {
      apiVersion,
      attemptId: attempt.id,
      approvalId: attempt.approvalId,
      outcome: "success",
      result: structuredClone(result),
      resultHash,
      completedAt: this.now(),
      preparedSuccessHash: preparedRecord.contentHash,
      transactionRecordHash: hashFramedDomain("durable-transaction-record", transaction),
      certificateHash: result.certificateHash,
      receiptHash: result.receiptHash
    };
    const record = { ...stable, contentHash: hashFramedDomain("change-lifecycle-attempt-result", stable) };
    await this.writeNew(`results/${selectorName(attempt.id)}`, record);
    return this.readAttemptResult(attempt.id);
  }
  async markCommittedUnpublished(attemptSelector, transaction) {
    const attempt = await this.readAttempt(attemptSelector);
    const prepared = await this.readPreparedSuccess(attempt.id);
    if (transaction.entry.transactionId !== attempt.transactionId || transaction.entry.phase !== "committed" || !transaction.entry.checkpointIds.includes(prepared.prepared.checkpointId)) {
      throw new Error("committed-unpublished state lacks an authenticated prepared journal commit");
    }
    const basis = {
      apiVersion,
      attemptId: attempt.id,
      approvalId: attempt.approvalId,
      transactionId: attempt.transactionId,
      status: "committed-unpublished",
      preparedSuccessHash: prepared.contentHash,
      transactionRecordHash: hashFramedDomain("durable-transaction-record", transaction),
      recordedAt: this.now()
    };
    const record = { ...basis, contentHash: hashFramedDomain("change-lifecycle-attempt-state", basis) };
    await this.writeNew(`states/${selectorName(attempt.id)}`, record);
    return this.readAttemptState(attempt.id);
  }
  async readAttemptState(attemptSelector) {
    const value = stateSchema.parse(JSON.parse(await this.read(`states/${selectorName(attemptSelector)}`)));
    if (value.apiVersion !== apiVersion || value.attemptId !== attemptSelector || value.status !== "committed-unpublished" || value.contentHash !== hashRecord("change-lifecycle-attempt-state", value)) {
      throw new Error("lifecycle attempt state content hash authentication failed");
    }
    const attempt = await this.readAttempt(attemptSelector);
    const prepared = await this.readPreparedSuccess(attemptSelector);
    const transaction = await this.readTransaction(attempt.transactionId);
    if (value.approvalId !== attempt.approvalId || value.transactionId !== attempt.transactionId || value.preparedSuccessHash !== prepared.contentHash || value.transactionRecordHash !== hashFramedDomain("durable-transaction-record", transaction) || transaction.entry.phase !== "committed") {
      throw new Error("lifecycle committed-unpublished state binding authentication failed");
    }
    return value;
  }
  async attemptStatesForApproval(approvalSelector) {
    const approval = await this.readApproval(approvalSelector);
    const directory = await this.ensureDirectory("states");
    const states = [];
    for (const name of (await readdir(directory)).filter((entry) => entry.endsWith(".json")).sort(compare)) {
      const untrusted = JSON.parse(await readFile(join(directory, name), "utf8"));
      if (untrusted.approvalId !== approval.id || typeof untrusted.attemptId !== "string")
        continue;
      states.push(await this.readAttemptState(untrusted.attemptId));
    }
    return states.sort((left, right) => compare(left.recordedAt, right.recordedAt) || compare(left.attemptId, right.attemptId));
  }
  async readAttemptResult(attemptSelector) {
    const value = resultSchema.parse(JSON.parse(await this.read(`results/${selectorName(attemptSelector)}`)));
    if (value.apiVersion !== apiVersion || value.attemptId !== attemptSelector || value.resultHash !== hashFramedDomain("change-lifecycle-execution-result", value.result) || value.contentHash !== hashRecord("change-lifecycle-attempt-result", value)) {
      throw new Error("lifecycle attempt result content hash authentication failed");
    }
    if (value.outcome === "success") {
      const prepared = await this.readPreparedSuccess(attemptSelector);
      const transaction = await this.readTransaction(prepared.transactionId);
      const result = value.result;
      if (value.preparedSuccessHash !== prepared.contentHash || value.transactionRecordHash !== hashFramedDomain("durable-transaction-record", transaction) || transaction.entry.phase !== "committed" || !transaction.entry.checkpointIds.includes(prepared.prepared.checkpointId) || value.certificateHash !== result.certificateHash || value.receiptHash !== result.receiptHash) {
        throw new Error("successful lifecycle result integrity chain authentication failed");
      }
      await this.authenticateArtifact("certificate", result.certificateHash, result.certificateRef);
      await this.authenticateArtifact("receipt", result.receiptHash, result.receiptRef);
    }
    return value;
  }
  async successfulResultForApproval(approvalSelector) {
    const approval = await this.readApproval(approvalSelector);
    const directory = await this.ensureDirectory("results");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort(compare);
    const successful = [];
    for (const name of names) {
      const value = JSON.parse(await readFile(join(directory, name), "utf8"));
      if (value.approvalId !== approval.id)
        continue;
      const authenticated = await this.readAttemptResult(value.attemptId);
      if (authenticated.outcome === "success")
        successful.push(authenticated);
    }
    successful.sort((left, right) => compare(left.completedAt, right.completedAt) || compare(left.attemptId, right.attemptId));
    return successful[0];
  }
  async incompleteAttemptsForApproval(approvalSelector) {
    const attempts = [];
    const journal = new FileTransactionJournal(this.requirePaths());
    for (const attempt of await this.attemptsForApproval(approvalSelector)) {
      try {
        const result = await this.readAttemptResult(attempt.id);
        if (result.outcome !== "success") {
          let transaction;
          try {
            transaction = await journal.read(attempt.transactionId);
          } catch (error) {
            if (!isCode(error, "ENOENT"))
              throw error;
          }
          if (transaction !== void 0 && !["committed", "rolled-back"].includes(transaction.entry.phase))
            attempts.push(attempt);
        }
      } catch (error) {
        if (isCode(error, "ENOENT"))
          attempts.push(attempt);
        else
          throw error;
      }
    }
    return attempts;
  }
  /** Authenticated attempts from the existing owner, including failed history. */
  async attemptsForApproval(approvalSelector) {
    const approval = await this.readApproval(approvalSelector);
    const directory = await this.ensureDirectory("attempts");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort(compare);
    const attempts = [];
    for (const name of names) {
      const untrusted = JSON.parse(await readFile(join(directory, name), "utf8"));
      if (untrusted.approvalId !== approval.id || typeof untrusted.id !== "string")
        continue;
      const attempt = await this.readAttempt(untrusted.id);
      attempts.push(attempt);
    }
    return attempts.sort((left, right) => compare(left.startedAt, right.startedAt) || compare(left.id, right.id));
  }
  async writeArtifact(kind, hash, content) {
    const relativePath = `artifacts/${kind}/${hash.slice("sha256:v1:".length)}.json`;
    const parsed = JSON.parse(content);
    const domain = kind === "certificate" ? "change-certificate-artifact" : "transaction-receipt-artifact";
    if (hashFramedDomain(domain, parsed) !== hash)
      throw new Error(`content-addressed ${kind} artifact hash is invalid: ${hash}`);
    await this.writeNew(relativePath, parsed);
    if (canonicalJson(JSON.parse(await this.read(relativePath))) !== canonicalJson(parsed)) {
      throw new Error(`content-addressed ${kind} artifact collision: ${hash}`);
    }
    return `${storeRoot}/${relativePath}`;
  }
  async authenticateArtifact(kind, hash, reference) {
    const expected = `${storeRoot}/artifacts/${kind}/${hash.slice("sha256:v1:".length)}.json`;
    if (reference !== expected)
      throw new Error(`${kind} artifact reference does not match its authenticated content hash`);
    const parsed = JSON.parse(await this.read(`artifacts/${kind}/${hash.slice("sha256:v1:".length)}.json`));
    const domain = kind === "certificate" ? "change-certificate-artifact" : "transaction-receipt-artifact";
    if (hashFramedDomain(domain, parsed) !== hash)
      throw new Error(`${kind} artifact content authentication failed`);
  }
  async tryReadCapture(selector) {
    try {
      return await this.readCapture(selector);
    } catch (error) {
      if (isCode(error, "ENOENT"))
        return void 0;
      throw error;
    }
  }
  async tryReadApproval(selector) {
    try {
      return await this.readApproval(selector);
    } catch (error) {
      if (isCode(error, "ENOENT"))
        return void 0;
      throw error;
    }
  }
  async read(relativePath) {
    if (this.collected !== void 0)
      return this.collectedSource(`${storeRoot}/${relativePath}`);
    return readFile((await this.requirePaths().resolveRead(`${storeRoot}/${relativePath}`)).realTarget, "utf8");
  }
  async ensureDirectory(relativePath) {
    const initial = await this.requirePaths().resolveWrite(`${storeRoot}/${relativePath}`);
    await mkdir(initial.realTarget, { recursive: true });
    return (await this.requirePaths().resolveWrite(`${storeRoot}/${relativePath}`)).realTarget;
  }
  async writeNew(relativePath, value) {
    await this.writeTextNew(relativePath, `${canonicalJson(value)}
`);
  }
  async writeTextNew(relativePath, content) {
    const storedPath = `${storeRoot}/${relativePath}`;
    const initial = await this.requirePaths().resolveWrite(storedPath);
    await mkdir(dirname(initial.realTarget), { recursive: true });
    const destination = (await this.requirePaths().resolveWrite(storedPath)).realTarget;
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      let inserted = false;
      try {
        await link(temporary, destination);
        inserted = true;
      } catch (error) {
        if (!isCode(error, "EEXIST"))
          throw error;
      }
      if (inserted && process.platform !== "win32") {
        const directory = await open(dirname(destination), constants.O_RDONLY);
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }
};
function isCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

export {
  ChangeLifecycleStore
};
