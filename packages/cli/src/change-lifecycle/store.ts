import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  canonicalJson,
  hashFramedDomain,
  type ContentHash,
  type ExecutionCapsule,
  type ExecutionPlan,
  type StateBinding,
} from "@projector/core";
import {
  authenticatePreparedStateBoundChangeSuccess,
  createExecutionApproval,
  executionCapsuleHash,
  executionPlanHash,
  type ExecutionApproval,
  type PreparedStateBoundChangeSuccess,
  type StateBoundChangeResult,
} from "@projector/engine";
import { FileTransactionJournal, RepositoryPathService, type DurableTransactionRecord } from "@projector/runtime";

const apiVersion = "projector.change-lifecycle/v1" as const;
const storeRoot = ".projector/runtime/change-lifecycles";

export interface LifecycleCaptureInput {
  readonly request: string;
  readonly proposal: unknown;
  readonly proposalHash: ContentHash;
  readonly semanticChangeId: string;
  readonly plan: ExecutionPlan;
  readonly capsules: readonly ExecutionCapsule[];
  readonly exactPatchInputHash: ContentHash;
}

export interface LifecycleCapsuleBinding {
  readonly packetId: string;
  readonly capsuleId: string;
  readonly capsuleHash: ContentHash;
}

export interface LifecycleCaptureRecord {
  readonly apiVersion: typeof apiVersion;
  readonly semanticChangeId: string;
  readonly request: string;
  readonly proposal: unknown;
  readonly proposalHash: ContentHash;
  readonly planId: string;
  readonly planRevision: number;
  readonly planHash: ContentHash;
  readonly stateBinding: StateBinding;
  readonly capsuleBindings: readonly LifecycleCapsuleBinding[];
  readonly exactPatchInputHash: ContentHash;
  readonly capturedAt: string;
  readonly contentHash: ContentHash;
}

export interface LifecycleApprovalRecord {
  readonly apiVersion: typeof apiVersion;
  readonly id: string;
  readonly semanticChangeId: string;
  readonly planHash: ContentHash;
  readonly approvals: readonly ExecutionApproval[];
  readonly approvedAt: string;
  readonly contentHash: ContentHash;
}

export interface ChangeLifecycleStoreOptions {
  readonly now?: () => string;
  readonly newId?: () => string;
}

export interface LifecycleAttemptRecord {
  readonly apiVersion: typeof apiVersion;
  readonly id: string;
  readonly approvalId: string;
  readonly semanticChangeId: string;
  readonly planHash: ContentHash;
  readonly transactionId: string;
  readonly startedAt: string;
  readonly contentHash: ContentHash;
}

export interface LifecycleAttemptResultRecord<T = unknown> {
  readonly apiVersion: typeof apiVersion;
  readonly attemptId: string;
  readonly approvalId: string;
  readonly outcome: "success" | "failure" | "partial";
  readonly result: T;
  readonly resultHash: ContentHash;
  readonly completedAt: string;
  readonly contentHash: ContentHash;
  readonly preparedSuccessHash?: ContentHash;
  readonly transactionRecordHash?: ContentHash;
  readonly certificateHash?: ContentHash;
  readonly receiptHash?: ContentHash;
}

export interface LifecyclePreparedSuccessRecord {
  readonly apiVersion: typeof apiVersion;
  readonly attemptId: string;
  readonly approvalId: string;
  readonly transactionId: string;
  readonly prepared: PreparedStateBoundChangeSuccess;
  readonly preparedSuccessHash: ContentHash;
  readonly preparedAt: string;
  readonly contentHash: ContentHash;
}

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function selectorName(selector: string): string {
  if (selector.trim() === "" || selector.includes("\0")) throw new Error("lifecycle selector must be nonblank safe text");
  return `${hashFramedDomain("change-lifecycle-selector", selector).slice("sha256:v1:".length)}.json`;
}

function hashRecord<T extends { readonly contentHash?: ContentHash }>(domain: string, record: T): ContentHash {
  const { contentHash: _contentHash, ...basis } = record;
  return hashFramedDomain(domain, basis);
}

function sameStateBinding(left: StateBinding, right: StateBinding): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function capsuleBindings(capsules: readonly ExecutionCapsule[]): LifecycleCapsuleBinding[] {
  const ids = new Set<string>();
  return [...capsules].sort((left, right) => compare(left.id, right.id)).map((capsule) => {
    if (ids.has(capsule.id)) throw new Error(`duplicate lifecycle capsule: ${capsule.id}`);
    ids.add(capsule.id);
    return { packetId: capsule.taskId, capsuleId: capsule.id, capsuleHash: executionCapsuleHash(capsule) };
  });
}

function withoutCaptureTime(record: LifecycleCaptureRecord): Omit<LifecycleCaptureRecord, "capturedAt" | "contentHash"> {
  const { capturedAt: _capturedAt, contentHash: _contentHash, ...basis } = record;
  return basis;
}

function parseCapture(source: string): LifecycleCaptureRecord {
  const value = JSON.parse(source) as LifecycleCaptureRecord;
  if (value.apiVersion !== apiVersion || typeof value.semanticChangeId !== "string" || typeof value.contentHash !== "string") {
    throw new Error("lifecycle capture failed schema authentication");
  }
  if (value.contentHash !== hashRecord("change-lifecycle-capture", value)) throw new Error("lifecycle capture content hash authentication failed");
  return value;
}

function parseApproval(source: string): LifecycleApprovalRecord {
  const value = JSON.parse(source) as LifecycleApprovalRecord;
  if (value.apiVersion !== apiVersion || typeof value.id !== "string" || typeof value.contentHash !== "string") {
    throw new Error("lifecycle approval failed schema authentication");
  }
  if (value.contentHash !== hashRecord("change-lifecycle-approval", value)) throw new Error("lifecycle approval content hash authentication failed");
  return value;
}

export class ChangeLifecycleStore {
  private readonly now: () => string;
  private readonly newId: () => string;

  private constructor(private readonly paths: RepositoryPathService, options: ChangeLifecycleStoreOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.newId = options.newId ?? randomUUID;
  }

  static async create(repositoryRoot: string, options: ChangeLifecycleStoreOptions = {}): Promise<ChangeLifecycleStore> {
    return new ChangeLifecycleStore(await RepositoryPathService.create(repositoryRoot), options);
  }

  async capture(input: LifecycleCaptureInput): Promise<LifecycleCaptureRecord> {
    if (input.plan.semanticChangeId !== input.semanticChangeId) throw new Error("lifecycle plan belongs to another semantic change");
    if (hashFramedDomain("repository-change-proposal", input.proposal) !== input.proposalHash) throw new Error("lifecycle proposal hash is invalid");
    const bindings = capsuleBindings(input.capsules);
    if (canonicalJson(input.plan.packetIds) !== canonicalJson(bindings.map(({ packetId }) => packetId).sort(compare))) {
      throw new Error("lifecycle capsules do not cover the immutable plan packets");
    }
    for (const capsule of input.capsules) {
      if (!sameStateBinding(capsule.boundState, input.plan.boundState)) throw new Error(`lifecycle capsule ${capsule.id} has another state binding`);
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
      capsuleBindings: bindings,
      exactPatchInputHash: input.exactPatchInputHash,
    };
    const existing = await this.tryReadCapture(input.semanticChangeId);
    if (existing !== undefined) {
      if (canonicalJson(withoutCaptureTime(existing)) !== canonicalJson(basis)) throw new Error(`conflicting lifecycle capture for ${input.semanticChangeId}`);
      return existing;
    }
    const withTime = { ...basis, capturedAt: this.now() };
    const record: LifecycleCaptureRecord = { ...withTime, contentHash: hashFramedDomain("change-lifecycle-capture", withTime) };
    await this.writeNew(`captures/${selectorName(input.semanticChangeId)}`, record);
    return this.readCapture(input.semanticChangeId);
  }

  async readCapture(selector: string): Promise<LifecycleCaptureRecord> {
    const source = await this.read(`captures/${selectorName(selector)}`);
    const record = parseCapture(source);
    if (record.semanticChangeId !== selector) throw new Error("lifecycle capture selector does not match authenticated identity");
    return record;
  }

  async approve(
    selector: string,
    presentedPlanHash: ContentHash,
    plan: ExecutionPlan,
    capsules: readonly ExecutionCapsule[],
  ): Promise<LifecycleApprovalRecord> {
    const capture = await this.readCapture(selector);
    if (presentedPlanHash !== capture.planHash) throw new Error("presented plan hash does not match the captured immutable plan hash");
    if (executionPlanHash(plan) !== capture.planHash || plan.id !== capture.planId || plan.revision !== capture.planRevision || !sameStateBinding(plan.boundState, capture.stateBinding)) {
      throw new Error("approval plan does not match the authenticated lifecycle capture");
    }
    const bindings = capsuleBindings(capsules);
    if (canonicalJson(bindings) !== canonicalJson(capture.capsuleBindings)) throw new Error("approval capsules do not match the authenticated lifecycle capture");
    const approvals = [...capsules].sort((left, right) => compare(left.id, right.id)).map((capsule) => {
      const approvalId = `approval_${hashFramedDomain("change-lifecycle-execution-approval-id", { semanticChangeId: selector, planHash: capture.planHash, capsuleId: capsule.id }).slice(-32)}`;
      return createExecutionApproval(plan, capsule, approvalId);
    });
    const stable = { apiVersion, semanticChangeId: selector, planHash: capture.planHash, approvals };
    const stableHash = hashFramedDomain("change-lifecycle-approval-identity", stable);
    const withTime = { ...stable, id: `lifecycle_approval_${stableHash.slice(-32)}`, approvedAt: this.now() };
    const record: LifecycleApprovalRecord = { ...withTime, contentHash: hashFramedDomain("change-lifecycle-approval", withTime) };
    const existing = await this.tryReadApproval(record.id);
    if (existing !== undefined) {
      const { approvedAt: _existingTime, contentHash: _existingHash, ...existingStable } = existing;
      const { approvedAt: _newTime, contentHash: _newHash, ...newStable } = record;
      if (canonicalJson(existingStable) !== canonicalJson(newStable)) throw new Error(`conflicting lifecycle approval ${record.id}`);
      return existing;
    }
    await this.writeNew(`approvals/${selectorName(record.id)}`, record);
    return this.readApproval(record.id);
  }

  async readApproval(selector: string): Promise<LifecycleApprovalRecord> {
    const record = parseApproval(await this.read(`approvals/${selectorName(selector)}`));
    if (record.id !== selector) throw new Error("lifecycle approval selector does not match authenticated identity");
    return record;
  }

  async beginAttempt(approvalSelector: string): Promise<LifecycleAttemptRecord> {
    const approval = await this.readApproval(approvalSelector);
    const nonce = this.newId();
    if (nonce.trim() === "" || nonce.includes("\0")) throw new Error("attempt identity source returned unsafe text");
    const stable = {
      apiVersion,
      id: `lifecycle_attempt_${hashFramedDomain("change-lifecycle-attempt-id", { approvalId: approval.id, nonce }).slice(-32)}`,
      approvalId: approval.id,
      semanticChangeId: approval.semanticChangeId,
      planHash: approval.planHash,
      transactionId: `transaction_${hashFramedDomain("change-lifecycle-transaction-id", { approvalId: approval.id, nonce }).slice(-32)}`,
      startedAt: this.now(),
    };
    const record: LifecycleAttemptRecord = { ...stable, contentHash: hashFramedDomain("change-lifecycle-attempt", stable) };
    await this.writeNew(`attempts/${selectorName(record.id)}`, record);
    return this.readAttempt(record.id);
  }

  async readAttempt(selector: string): Promise<LifecycleAttemptRecord> {
    const value = JSON.parse(await this.read(`attempts/${selectorName(selector)}`)) as LifecycleAttemptRecord;
    if (value.apiVersion !== apiVersion || value.id !== selector || value.contentHash !== hashRecord("change-lifecycle-attempt", value)) {
      throw new Error("lifecycle attempt content hash authentication failed");
    }
    return value;
  }

  async completeAttempt<T>(
    attemptSelector: string,
    outcome: LifecycleAttemptResultRecord["outcome"],
    result: T,
  ): Promise<LifecycleAttemptResultRecord<T>> {
    if (outcome === "success") throw new Error("successful lifecycle attempts require journal- and artifact-authenticated completion");
    const attempt = await this.readAttempt(attemptSelector);
    const resultHash = hashFramedDomain("change-lifecycle-execution-result", result);
    const stable = { apiVersion, attemptId: attempt.id, approvalId: attempt.approvalId, outcome, result: structuredClone(result), resultHash, completedAt: this.now() };
    const record: LifecycleAttemptResultRecord<T> = { ...stable, contentHash: hashFramedDomain("change-lifecycle-attempt-result", stable) };
    await this.writeNew(`results/${selectorName(attempt.id)}`, record);
    return this.readAttemptResult<T>(attempt.id);
  }

  async prepareAttemptSuccess(
    attemptSelector: string,
    untrusted: PreparedStateBoundChangeSuccess,
  ): Promise<LifecyclePreparedSuccessRecord> {
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
      preparedAt: this.now(),
    };
    const record: LifecyclePreparedSuccessRecord = { ...basis, contentHash: hashFramedDomain("change-lifecycle-prepared-success", basis) };
    await this.writeNew(`prepared/${selectorName(attempt.id)}`, record);
    return this.readPreparedSuccess(attempt.id);
  }

  async readPreparedSuccess(attemptSelector: string): Promise<LifecyclePreparedSuccessRecord> {
    const value = JSON.parse(await this.read(`prepared/${selectorName(attemptSelector)}`)) as LifecyclePreparedSuccessRecord;
    if (value.apiVersion !== apiVersion || value.attemptId !== attemptSelector
      || value.preparedSuccessHash !== value.prepared?.contentHash
      || value.contentHash !== hashRecord("change-lifecycle-prepared-success", value)) {
      throw new Error("lifecycle prepared success content hash authentication failed");
    }
    authenticatePreparedStateBoundChangeSuccess(value.prepared);
    const attempt = await this.readAttempt(attemptSelector);
    if (value.approvalId !== attempt.approvalId || value.transactionId !== attempt.transactionId) {
      throw new Error("lifecycle prepared success attempt binding authentication failed");
    }
    return value;
  }

  async completeSuccessfulAttempt(
    attemptSelector: string,
    result: StateBoundChangeResult,
    transaction: DurableTransactionRecord,
  ): Promise<LifecycleAttemptResultRecord<StateBoundChangeResult>> {
    const attempt = await this.readAttempt(attemptSelector);
    const preparedRecord = await this.readPreparedSuccess(attempt.id);
    const prepared = preparedRecord.prepared;
    if (result.outcome !== "success"
      || transaction.entry.transactionId !== attempt.transactionId
      || transaction.entry.planId !== prepared.planId
      || transaction.entry.phase !== "committed"
      || !transaction.entry.checkpointIds.includes(prepared.checkpointId)
      || result.certificateHash !== prepared.certificateHash
      || result.receiptHash !== prepared.receiptHash) {
      throw new Error("successful lifecycle result does not authenticate its prepared journal commit");
    }
    await this.authenticateArtifact("certificate", result.certificateHash, result.certificateRef);
    await this.authenticateArtifact("receipt", result.receiptHash, result.receiptRef);
    const resultHash = hashFramedDomain("change-lifecycle-execution-result", result);
    const stable = {
      apiVersion,
      attemptId: attempt.id,
      approvalId: attempt.approvalId,
      outcome: "success" as const,
      result: structuredClone(result),
      resultHash,
      completedAt: this.now(),
      preparedSuccessHash: preparedRecord.contentHash,
      transactionRecordHash: hashFramedDomain("durable-transaction-record", transaction),
      certificateHash: result.certificateHash,
      receiptHash: result.receiptHash,
    };
    const record: LifecycleAttemptResultRecord<StateBoundChangeResult> = { ...stable, contentHash: hashFramedDomain("change-lifecycle-attempt-result", stable) };
    await this.writeNew(`results/${selectorName(attempt.id)}`, record);
    return this.readAttemptResult<StateBoundChangeResult>(attempt.id);
  }

  async readAttemptResult<T = unknown>(attemptSelector: string): Promise<LifecycleAttemptResultRecord<T>> {
    const value = JSON.parse(await this.read(`results/${selectorName(attemptSelector)}`)) as LifecycleAttemptResultRecord<T>;
    if (value.apiVersion !== apiVersion || value.attemptId !== attemptSelector
      || value.resultHash !== hashFramedDomain("change-lifecycle-execution-result", value.result)
      || value.contentHash !== hashRecord("change-lifecycle-attempt-result", value)) {
      throw new Error("lifecycle attempt result content hash authentication failed");
    }
    if (value.outcome === "success") {
      const prepared = await this.readPreparedSuccess(attemptSelector);
      const transaction = await new FileTransactionJournal(this.paths).read(prepared.transactionId);
      const result = value.result as StateBoundChangeResult;
      if (value.preparedSuccessHash !== prepared.contentHash
        || value.transactionRecordHash !== hashFramedDomain("durable-transaction-record", transaction)
        || transaction.entry.phase !== "committed"
        || !transaction.entry.checkpointIds.includes(prepared.prepared.checkpointId)
        || value.certificateHash !== result.certificateHash
        || value.receiptHash !== result.receiptHash) {
        throw new Error("successful lifecycle result integrity chain authentication failed");
      }
      await this.authenticateArtifact("certificate", result.certificateHash, result.certificateRef);
      await this.authenticateArtifact("receipt", result.receiptHash, result.receiptRef);
    }
    return value;
  }

  async successfulResultForApproval<T = unknown>(approvalSelector: string): Promise<LifecycleAttemptResultRecord<T> | undefined> {
    const approval = await this.readApproval(approvalSelector);
    const directory = await this.ensureDirectory("results");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort(compare);
    const successful: LifecycleAttemptResultRecord<T>[] = [];
    for (const name of names) {
      const value = JSON.parse(await readFile(join(directory, name), "utf8")) as LifecycleAttemptResultRecord<T>;
      if (value.approvalId !== approval.id) continue;
      const authenticated = await this.readAttemptResult<T>(value.attemptId);
      if (authenticated.outcome === "success") successful.push(authenticated);
    }
    successful.sort((left, right) => compare(left.completedAt, right.completedAt) || compare(left.attemptId, right.attemptId));
    return successful[0];
  }

  async incompleteAttemptsForApproval(approvalSelector: string): Promise<LifecycleAttemptRecord[]> {
    const approval = await this.readApproval(approvalSelector);
    const directory = await this.ensureDirectory("attempts");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort(compare);
    const attempts: LifecycleAttemptRecord[] = [];
    for (const name of names) {
      const untrusted = JSON.parse(await readFile(join(directory, name), "utf8")) as Partial<LifecycleAttemptRecord>;
      if (untrusted.approvalId !== approval.id || typeof untrusted.id !== "string") continue;
      const attempt = await this.readAttempt(untrusted.id);
      try {
        await this.readAttemptResult(attempt.id);
      } catch (error) {
        if (isCode(error, "ENOENT")) attempts.push(attempt);
        else throw error;
      }
    }
    return attempts.sort((left, right) => compare(left.startedAt, right.startedAt) || compare(left.id, right.id));
  }

  async writeArtifact(kind: "certificate" | "receipt", hash: ContentHash, content: string): Promise<string> {
    const relativePath = `artifacts/${kind}/${hash.slice("sha256:v1:".length)}.json`;
    const parsed = JSON.parse(content) as unknown;
    const domain = kind === "certificate" ? "change-certificate-artifact" : "transaction-receipt-artifact";
    if (hashFramedDomain(domain, parsed) !== hash) throw new Error(`content-addressed ${kind} artifact hash is invalid: ${hash}`);
    await this.writeNew(relativePath, parsed);
    if (canonicalJson(JSON.parse(await this.read(relativePath)) as unknown) !== canonicalJson(parsed)) {
      throw new Error(`content-addressed ${kind} artifact collision: ${hash}`);
    }
    return `${storeRoot}/${relativePath}`;
  }

  async writeValidatorProjection(hash: ContentHash, content: string): Promise<string> {
    if (hashFramedDomain("transform-content", content) !== hash) throw new Error(`validator projection content hash is invalid: ${hash}`);
    const relativePath = `artifacts/validator/${hash.slice("sha256:v1:".length)}.mjs`;
    await this.writeTextNew(relativePath, content);
    if (await this.read(relativePath) !== content) throw new Error(`content-addressed validator projection collision: ${hash}`);
    return `${storeRoot}/${relativePath}`;
  }

  private async authenticateArtifact(kind: "certificate" | "receipt", hash: ContentHash, reference: string): Promise<void> {
    const expected = `${storeRoot}/artifacts/${kind}/${hash.slice("sha256:v1:".length)}.json`;
    if (reference !== expected) throw new Error(`${kind} artifact reference does not match its authenticated content hash`);
    const parsed = JSON.parse(await this.read(`artifacts/${kind}/${hash.slice("sha256:v1:".length)}.json`)) as unknown;
    const domain = kind === "certificate" ? "change-certificate-artifact" : "transaction-receipt-artifact";
    if (hashFramedDomain(domain, parsed) !== hash) throw new Error(`${kind} artifact content authentication failed`);
  }

  private async tryReadCapture(selector: string): Promise<LifecycleCaptureRecord | undefined> {
    try { return await this.readCapture(selector); }
    catch (error) { if (isCode(error, "ENOENT")) return undefined; throw error; }
  }

  private async tryReadApproval(selector: string): Promise<LifecycleApprovalRecord | undefined> {
    try { return await this.readApproval(selector); }
    catch (error) { if (isCode(error, "ENOENT")) return undefined; throw error; }
  }

  private async read(relativePath: string): Promise<string> {
    return readFile((await this.paths.resolveRead(`${storeRoot}/${relativePath}`)).realTarget, "utf8");
  }

  private async ensureDirectory(relativePath: string): Promise<string> {
    const initial = await this.paths.resolveWrite(`${storeRoot}/${relativePath}`);
    await mkdir(initial.realTarget, { recursive: true });
    return (await this.paths.resolveWrite(`${storeRoot}/${relativePath}`)).realTarget;
  }

  private async writeNew(relativePath: string, value: unknown): Promise<void> {
    await this.writeTextNew(relativePath, `${canonicalJson(value)}\n`);
  }

  private async writeTextNew(relativePath: string, content: string): Promise<void> {
    const storedPath = `${storeRoot}/${relativePath}`;
    const initial = await this.paths.resolveWrite(storedPath);
    await mkdir(dirname(initial.realTarget), { recursive: true });
    const destination = (await this.paths.resolveWrite(storedPath)).realTarget;
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await link(temporary, destination);
      const directory = await open(dirname(destination), constants.O_RDONLY);
      try { await directory.sync(); } finally { await directory.close(); }
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
