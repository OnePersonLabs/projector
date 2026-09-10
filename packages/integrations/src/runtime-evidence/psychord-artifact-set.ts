import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";

import { ContentHashSchema, canonicalJson, type ContentHash } from "@projector/core";
import { z } from "zod";

import {
  psychordObservationAdapterId,
  psychordObservationAdapterVersion,
} from "./psychord.js";
import {
  PsychordApplicationObservationExchangeSchema,
  PsychordApplicationObservationPlanSchema,
  PsychordApplicationObservationResultSchema,
  type PsychordApplicationObservationPlan,
  type PsychordApplicationObservationResult,
  type StrictPsychordApplicationObserver,
} from "./psychord-contract.js";

interface StrictValueSchema<T> { parse(value: unknown): T }

const artifactIdentity = z.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
const rawSha256 = z.string().regex(/^[a-f0-9]{64}$/u);

export const PsychordObservationArtifactManifestSchema = z.strictObject({
  schemaVersion: z.literal("psychord-application-observation-artifact-set@1"),
  artifactSetId: artifactIdentity,
  runId: artifactIdentity,
  scenario: z.strictObject({ id: artifactIdentity, semanticHash: ContentHashSchema }),
  case: artifactIdentity,
  adapter: z.strictObject({
    id: z.literal(psychordObservationAdapterId),
    version: z.literal(psychordObservationAdapterVersion),
    inputHash: ContentHashSchema,
    outputHash: ContentHashSchema,
  }),
  planHash: ContentHashSchema,
  resultHash: ContentHashSchema,
  terminal: z.strictObject({
    operationalStatus: z.enum(["completed", "failed", "cancelled"]),
    outcome: z.enum(["passed", "failed", "unavailable"]),
    currentness: z.enum(["current", "stale", "unknown"]),
    assurance: z.literal("supporting"),
    cleanupComplete: z.boolean(),
  }),
  blobs: z.tuple([
    z.strictObject({ role: z.literal("plan"), path: z.literal("plan.json"), sha256: rawSha256 }),
    z.strictObject({ role: z.literal("result"), path: z.literal("result.json"), sha256: rawSha256 }),
  ]),
});
export type PsychordObservationArtifactManifest = z.infer<typeof PsychordObservationArtifactManifestSchema>;

export type PsychordArtifactStoreReadResult =
  | { readonly status: "published"; readonly artifactSetId: string; readonly manifest: PsychordObservationArtifactManifest; readonly blobs: ReadonlyMap<string, Uint8Array> }
  | { readonly status: "incomplete" | "missing"; readonly artifactSetId: string }
  | { readonly status: "integrity-failed"; readonly artifactSetId: string; readonly reason: string };

export interface PsychordArtifactSetStorePort {
  readonly storageRoot: string;
  begin(input: { readonly artifactSetId: string }): Promise<void>;
  stageBlob(input: { readonly artifactSetId: string; readonly path: string; readonly bytes: Uint8Array }): Promise<void>;
  finalize(input: { readonly artifactSetId: string; readonly manifestBytes: Uint8Array }): Promise<void>;
  resumeFinalize(artifactSetId: string): Promise<"published" | "incomplete">;
  read(artifactSetId: string): Promise<PsychordArtifactStoreReadResult>;
}

const recoveryMessage = z.string().min(1).max(4_096);
const PsychordAttemptRecoverySchema = z.discriminatedUnion("code", [
  z.strictObject({ code: z.literal("attempt-in-flight"), message: recoveryMessage, action: recoveryMessage, ownerId: artifactIdentity, leaseExpiresAt: z.iso.datetime() }),
  z.strictObject({ code: z.literal("attempt-owner-unavailable"), message: recoveryMessage, action: recoveryMessage, ownerId: artifactIdentity.optional(), leaseExpiresAt: z.iso.datetime().optional() }),
]);
export type PsychordAttemptRecovery = z.infer<typeof PsychordAttemptRecoverySchema>;

export const PsychordObserveAndPublishResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("published"),
    artifactSetId: artifactIdentity,
    manifest: PsychordObservationArtifactManifestSchema,
    plan: PsychordApplicationObservationPlanSchema,
    result: PsychordApplicationObservationResultSchema,
    behavioralEvidence: z.boolean(),
  }),
  z.strictObject({ status: z.literal("incomplete"), artifactSetId: artifactIdentity, recovery: PsychordAttemptRecoverySchema.optional() }),
  z.strictObject({ status: z.literal("missing"), artifactSetId: artifactIdentity }),
  z.strictObject({ status: z.literal("integrity-failed"), artifactSetId: artifactIdentity, reason: z.string().min(1).max(4_096) }),
]).superRefine((value, context) => {
  if (value.status !== "published") return;
  try { assertPublishedServiceBinding(value); }
  catch (error) { context.addIssue({ code: "custom", message: errorMessage(error) }); }
});
export type PsychordArtifactSetReadResult = z.infer<typeof PsychordObserveAndPublishResultSchema>;

export interface PsychordObservationArtifactService {
  artifactSetId(plan: PsychordApplicationObservationPlan): string;
  observeAndPublish(plan: PsychordApplicationObservationPlan, environment: { readonly signal: AbortSignal }): Promise<PsychordArtifactSetReadResult>;
  read(artifactSetId: string): Promise<PsychordArtifactSetReadResult>;
}

export function createPsychordObservationArtifactService(input: {
  readonly artifactStore: PsychordArtifactSetStorePort;
  readonly observer: StrictPsychordApplicationObserver;
}): PsychordObservationArtifactService {
  const store = input.artifactStore;
  return {
    artifactSetId,
    async observeAndPublish(unparsedPlan, environment) {
      const plan = PsychordApplicationObservationPlanSchema.parse(unparsedPlan);
      await Promise.all([
        assertNoSymlinkComponents(plan.adapter.input.ownedArtifactRoot, "planned Psychord artifact root"),
        assertNoSymlinkComponents(store.storageRoot, "configured Psychord artifact root"),
      ]);
      const [plannedRoot, configuredRoot] = await Promise.all([
        realpath(plan.adapter.input.ownedArtifactRoot),
        realpath(store.storageRoot),
      ]);
      if (plannedRoot !== configuredRoot) {
        throw new Error("Psychord artifact store root does not match the plan-owned artifact root");
      }
      const id = artifactSetId(plan);
      const planBytes = encodeStrict(plan, PsychordApplicationObservationPlanSchema);
      const existing = await readPublished(store, id);
      if (existing.status === "published") {
        assertRequestedPlanBinding(plan, existing.plan);
        return existing;
      }
      if (existing.status === "integrity-failed") return existing;
      if (existing.status === "incomplete") {
        const existingClaim = await readExistingAttemptClaim(configuredRoot, id);
        if (existingClaim === undefined) {
          try {
            if (await store.resumeFinalize(id) === "incomplete") {
              return integrityFailed(id, "Incomplete Psychord attempt has no durable exact-plan claim");
            }
            const resumed = await readPublished(store, id);
            if (resumed.status === "published") assertRequestedPlanBinding(plan, resumed.plan);
            return resumed;
          } catch (error) {
            return integrityFailed(id, errorMessage(error));
          }
        }
        assertClaimPlanBinding(existingClaim, id, plan, planBytes);
        const active = existingClaim.state === "active" && Date.parse(existingClaim.expiresAt) > Date.now();
        const recovered = active
          ? await awaitActiveClaim(store, configuredRoot, id, existingClaim, plan.adapter.input.limits.cleanupTimeoutMs, environment.signal)
          : await awaitExistingAttempt(store, id, plan.adapter.input.limits.cleanupTimeoutMs, environment.signal, true);
        return recovered.status === "incomplete" && existingClaim !== undefined
          ? incompleteWithClaim(id, existingClaim)
          : recovered;
      }

      const claim = await acquireAttemptClaim(configuredRoot, id, plan, planBytes);
      if (claim.state !== "acquired") {
        const recovered = claim.state === "active"
          ? await awaitActiveClaim(store, configuredRoot, id, claim.record, plan.adapter.input.limits.cleanupTimeoutMs, environment.signal)
          : await awaitExistingAttempt(store, id, plan.adapter.input.limits.cleanupTimeoutMs, environment.signal, true);
        if (recovered.status === "published" || recovered.status === "integrity-failed") return recovered;
        return incompleteWithClaim(id, claim.record);
      }

      const ownedClaim = claim.handle;
      const claimAbort = new AbortController();
      const combinedSignal = AbortSignal.any([environment.signal, claimAbort.signal]);
      const heartbeat = startClaimHeartbeat(claim, claimAbort, plan.adapter.input.limits.cleanupTimeoutMs);
      try {
        await store.begin({ artifactSetId: id });
        await store.stageBlob({ artifactSetId: id, path: "plan.json", bytes: planBytes });
      } catch (error) {
        await heartbeat.stop();
        await ownedClaim.markRecovery("Artifact staging did not establish an owned collection attempt.").catch(() => undefined);
        return await recoverAfterConflict(store, id, plan.adapter.input.limits.cleanupTimeoutMs, environment.signal, error);
      }

      try {
        const result = PsychordApplicationObservationResultSchema.parse(await input.observer.observeApplication(plan, { signal: combinedSignal }));
        assertPlanResultBinding(plan, result);
        await ownedClaim.assertOwned();
        const resultBytes = encodeStrict(result, PsychordApplicationObservationResultSchema);
        const manifest = createManifest(id, plan, result, planBytes, resultBytes);
        await store.stageBlob({ artifactSetId: id, path: "result.json", bytes: resultBytes });
        await store.finalize({ artifactSetId: id, manifestBytes: encodeManifest(manifest) });
        await heartbeat.stop();
        await ownedClaim.releaseAfterPublication();
      } catch (error) {
        await heartbeat.stop();
        await ownedClaim.markRecovery("Observation ended without an authenticated terminal artifact; resource cleanup must be established before a fresh run.").catch(() => undefined);
        const recovered = await recoverAfterConflict(store, id, plan.adapter.input.limits.cleanupTimeoutMs, environment.signal, error).catch(() => undefined);
        if (recovered !== undefined && recovered.status === "published") return recovered;
        throw error;
      }
      return await readPublished(store, id);
    },
    async read(id) { return await readPublished(store, id); },
  };
}

function incompleteWithClaim(artifactSetId: string, record: PsychordAttemptClaimRecord): PsychordArtifactSetReadResult {
  const active = record.state === "active" && Date.parse(record.expiresAt) > Date.now();
  return PsychordObserveAndPublishResultSchema.parse({
    status: "incomplete",
    artifactSetId,
    recovery: active
      ? { code: "attempt-in-flight", message: "The exact observation attempt is owned by another collector.", action: "Await its authenticated terminal artifact without starting another collection.", ownerId: record.ownerId, leaseExpiresAt: record.expiresAt }
      : { code: "attempt-owner-unavailable", message: "The exact observation attempt lost its owner before an authenticated terminal artifact was published; owned resource identities and cleanup status are unknown.", action: "Establish external or manual cleanup without inferring handles from this claim, then use a fresh runId for a new observation.", ownerId: record.ownerId, leaseExpiresAt: record.expiresAt },
  });
}

async function readExistingAttemptClaim(storageRoot: string, artifactSetId: string): Promise<PsychordAttemptClaimRecord | undefined> {
  const claimPath = join(storageRoot, "attempt-claims", `${artifactSetId}.claim`);
  try { return await readClaimRecord(claimPath); }
  catch (error) {
    if (isFilesystemCode(error, "ENOENT")) return undefined;
    try { await lstat(claimPath); }
    catch (claimError) { if (isFilesystemCode(claimError, "ENOENT")) return undefined; }
    throw error;
  }
}

interface PsychordAttemptClaimRecord {
  readonly schemaVersion: "psychord-observation-attempt-claim@1";
  readonly state: "active" | "recovery-required";
  readonly artifactSetId: string;
  readonly runId: string;
  readonly scenario: PsychordApplicationObservationPlan["scenario"];
  readonly case: string;
  readonly inputHash: ContentHash;
  readonly planHash: ContentHash;
  readonly ownerId: string;
  readonly processId: number;
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
  readonly expiresAt: string;
  readonly recoveryReason?: string;
}

type AttemptClaimAcquisition =
  | { readonly state: "acquired"; readonly handle: PsychordAttemptClaimHandle }
  | { readonly state: "active" | "recovery-required"; readonly record: PsychordAttemptClaimRecord };

interface PsychordAttemptClaimHandle {
  readonly record: PsychordAttemptClaimRecord;
  heartbeat(leaseDurationMs: number): Promise<void>;
  assertOwned(): Promise<void>;
  markRecovery(reason: string): Promise<void>;
  releaseAfterPublication(): Promise<void>;
}

async function acquireAttemptClaim(
  storageRoot: string,
  artifactSetId: string,
  plan: PsychordApplicationObservationPlan,
  planBytes: Uint8Array,
): Promise<AttemptClaimAcquisition> {
  const claimsRoot = join(storageRoot, "attempt-claims");
  const claimPath = join(claimsRoot, `${artifactSetId}.claim`);
  await mkdir(claimsRoot, { recursive: true });
  await assertContainedDirectory(storageRoot, claimsRoot, "Psychord attempt-claim root");
  await syncDirectory(storageRoot);
  try {
    await mkdir(claimPath);
    await assertContainedDirectory(storageRoot, claimPath, "Psychord attempt claim");
    await syncDirectory(claimsRoot);
  } catch (error) {
    if (!isFilesystemCode(error, "EEXIST")) throw error;
    await assertContainedDirectory(storageRoot, claimPath, "Psychord attempt claim");
    const existing = await awaitClaimRecord(claimPath);
    assertClaimPlanBinding(existing, artifactSetId, plan, planBytes);
    return existing.state === "recovery-required" || Date.parse(existing.expiresAt) <= Date.now()
      ? { state: "recovery-required", record: existing }
      : { state: "active", record: existing };
  }

  const acquiredAt = new Date();
  const leaseDurationMs = claimLeaseDuration(plan.adapter.input.limits.cleanupTimeoutMs);
  const record: PsychordAttemptClaimRecord = {
    schemaVersion: "psychord-observation-attempt-claim@1",
    state: "active",
    artifactSetId,
    runId: plan.runId,
    scenario: plan.scenario,
    case: plan.case,
    inputHash: plan.adapter.inputHash,
    planHash: contentHash(planBytes),
    ownerId: randomUUID(),
    processId: process.pid,
    acquiredAt: acquiredAt.toISOString(),
    heartbeatAt: acquiredAt.toISOString(),
    expiresAt: new Date(acquiredAt.getTime() + leaseDurationMs).toISOString(),
  };
  try {
    await writeDurableClaimFile(join(claimPath, "owner.json"), record);
    await syncDirectory(claimPath);
  } catch (error) {
    await rm(claimPath, { recursive: true, force: true });
    await syncDirectory(claimsRoot);
    throw error;
  }
  return { state: "acquired", handle: claimHandle(claimPath, record) };
}

function claimHandle(claimPath: string, initial: PsychordAttemptClaimRecord): PsychordAttemptClaimHandle {
  let record = initial;
  const assertOwned = async (): Promise<void> => {
    const current = await readClaimRecord(claimPath);
    if (current.ownerId !== record.ownerId || current.state !== "active") throw new Error("Psychord observation attempt claim ownership was lost");
    if (Date.parse(current.expiresAt) <= Date.now()) throw new Error("Psychord observation attempt claim expired before completion");
    record = current;
  };
  const replaceOwned = async (next: PsychordAttemptClaimRecord): Promise<void> => {
    await assertOwned();
    const temporary = join(claimPath, `owner.${record.ownerId}.tmp`);
    await writeDurableClaimFile(temporary, next);
    try { await rename(temporary, join(claimPath, "owner.json")); }
    catch (error) { await rm(temporary, { force: true }); throw error; }
    await syncDirectory(claimPath);
    record = next;
  };
  return {
    get record() { return record; },
    async heartbeat(leaseDurationMs) {
      const now = new Date();
      await replaceOwned({ ...record, heartbeatAt: now.toISOString(), expiresAt: new Date(now.getTime() + claimLeaseDuration(leaseDurationMs)).toISOString() });
    },
    assertOwned,
    async markRecovery(reason) {
      await replaceOwned({ ...record, state: "recovery-required", recoveryReason: reason });
    },
    async releaseAfterPublication() {
      await assertOwned();
      await rm(claimPath, { recursive: true });
      await syncDirectory(dirname(claimPath));
    },
  };
}

function startClaimHeartbeat(
  acquisition: Extract<AttemptClaimAcquisition, { state: "acquired" }>,
  lost: AbortController,
  requestedLeaseMs: number,
): { stop(): Promise<void> } {
  const leaseDurationMs = claimLeaseDuration(requestedLeaseMs);
  let pending: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (pending !== undefined) return;
    pending = acquisition.handle.heartbeat(leaseDurationMs)
      .catch((error: unknown) => lost.abort(error))
      .finally(() => { pending = undefined; });
  }, Math.max(100, Math.floor(leaseDurationMs / 3)));
  timer.unref();
  return { async stop() { clearInterval(timer); await pending; } };
}

async function awaitClaimRecord(claimPath: string): Promise<PsychordAttemptClaimRecord> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { return await readClaimRecord(claimPath); }
    catch (error) {
      if (!isFilesystemCode(error, "ENOENT")) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    }
  }
  throw new Error("Psychord observation attempt claim has no durable owner record");
}

async function readClaimRecord(claimPath: string): Promise<PsychordAttemptClaimRecord> {
  await assertContainedDirectory(dirname(dirname(claimPath)), claimPath, "Psychord attempt claim");
  const ownerPath = join(claimPath, "owner.json");
  const owner = await lstat(ownerPath);
  if (owner.isSymbolicLink() || !owner.isFile()) throw new Error("Psychord observation attempt owner record must be a regular file");
  assertContainedPath(await realpath(claimPath), await realpath(ownerPath), "Psychord observation attempt owner record");
  const bytes = await readFile(ownerPath, "utf8");
  const value: unknown = JSON.parse(bytes);
  if (!isRecord(value)) throw new Error("Psychord observation attempt claim is invalid");
  const expected = ["schemaVersion", "state", "artifactSetId", "runId", "scenario", "case", "inputHash", "planHash", "ownerId", "processId", "acquiredAt", "heartbeatAt", "expiresAt"];
  if (value.state === "recovery-required") expected.push("recoveryReason");
  exactKeys(value, expected, "attempt claim");
  if (value.schemaVersion !== "psychord-observation-attempt-claim@1"
    || (value.state !== "active" && value.state !== "recovery-required")
    || !nonempty(value.artifactSetId) || !nonempty(value.runId) || !isRecord(value.scenario) || !nonempty(value.case)
    || !contentHashPattern.test(String(value.inputHash)) || !contentHashPattern.test(String(value.planHash))
    || !nonempty(value.ownerId) || !Number.isSafeInteger(value.processId)
    || !validDate(value.acquiredAt) || !validDate(value.heartbeatAt) || !validDate(value.expiresAt)
    || (value.state === "recovery-required" && !nonempty(value.recoveryReason))) {
    throw new Error("Psychord observation attempt claim values are invalid");
  }
  if (bytes !== `${canonicalJson(value)}\n`) throw new Error("Psychord observation attempt claim is not canonical");
  return value as unknown as PsychordAttemptClaimRecord;
}

function assertClaimPlanBinding(
  claim: PsychordAttemptClaimRecord,
  artifactSetId: string,
  plan: PsychordApplicationObservationPlan,
  planBytes: Uint8Array,
): void {
  if (claim.artifactSetId !== artifactSetId || claim.runId !== plan.runId
    || canonicalJson(claim.scenario) !== canonicalJson(plan.scenario) || claim.case !== plan.case
    || claim.inputHash !== plan.adapter.inputHash || claim.planHash !== contentHash(planBytes)) {
    throw new Error("Psychord runId was reused with a different exact observation plan");
  }
}

function assertRequestedPlanBinding(requested: PsychordApplicationObservationPlan, stored: PsychordApplicationObservationPlan): void {
  if (canonicalJson(requested) !== canonicalJson(stored)) throw new Error("Psychord runId was reused with a different exact observation plan");
}

function claimLeaseDuration(requestedMs: number): number { return Math.max(1_000, requestedMs); }
function validDate(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function isFilesystemCode(error: unknown, code: string): boolean { return error instanceof Error && "code" in error && error.code === code; }
async function writeDurableClaimFile(path: string, value: PsychordAttemptClaimRecord): Promise<void> {
  const handle = await open(path, "wx");
  try { await handle.writeFile(`${canonicalJson(value)}\n`, "utf8"); await handle.sync(); }
  finally { await handle.close(); }
}
async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error) {
    if (!isFilesystemCode(error, "EINVAL") && !isFilesystemCode(error, "ENOTSUP") && !isFilesystemCode(error, "EPERM")) throw error;
  } finally { await handle.close(); }
}
async function assertOwnedDirectory(path: string, label: string): Promise<void> {
  const entry = await lstat(path);
  if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error(`${label} must be a real directory inside the authenticated artifact root`);
}
async function assertContainedDirectory(root: string, path: string, label: string): Promise<void> {
  await assertNoSymlinkComponents(path, label);
  await assertOwnedDirectory(path, label);
  assertContainedPath(await realpath(root), await realpath(path), label);
}
async function assertNoSymlinkComponents(path: string, label: string): Promise<void> {
  const absolute = resolve(path);
  const parsed = parse(absolute);
  let current = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(/[\\/]+/u).filter(Boolean)) {
    current = join(current, component);
    const entry = await lstat(current);
    if (entry.isSymbolicLink()) throw new Error(`${label} cannot contain symbolic-link or junction components`);
  }
}
function assertContainedPath(root: string, path: string, label: string): void {
  const fromRoot = relative(root, path);
  if (fromRoot === ".." || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(fromRoot)) {
    throw new Error(`${label} escapes the authenticated artifact root`);
  }
}

function artifactSetId(plan: PsychordApplicationObservationPlan): string {
  const digest = createHash("sha256").update(canonicalJson({
    adapterId: psychordObservationAdapterId,
    adapterVersion: psychordObservationAdapterVersion,
    runId: plan.runId,
  })).digest("hex");
  return `psychord-${digest}`;
}

async function readPublished(
  store: PsychordArtifactSetStorePort,
  artifactSetId: string,
): Promise<PsychordArtifactSetReadResult> {
  const stored = await store.read(artifactSetId);
  if (stored.status !== "published") {
    return stored.status === "integrity-failed"
      ? integrityFailed(artifactSetId, stored.reason)
      : PsychordObserveAndPublishResultSchema.parse(stored);
  }
  try {
    const plan = decodeStrict(requiredBlob(stored.blobs, "plan.json"), PsychordApplicationObservationPlanSchema, "plan");
    const result = decodeStrict(requiredBlob(stored.blobs, "result.json"), PsychordApplicationObservationResultSchema, "result");
    assertPlanResultBinding(plan, result);
    assertManifestBinding(stored.manifest, artifactSetId, plan, result, stored.blobs);
    return PsychordObserveAndPublishResultSchema.parse({
      status: "published",
      artifactSetId,
      manifest: stored.manifest,
      plan,
      result,
      behavioralEvidence: isPassingEvidence(result),
    });
  } catch (error) {
    return integrityFailed(artifactSetId, errorMessage(error));
  }
}

function createManifest(
  id: string,
  plan: PsychordApplicationObservationPlan,
  result: PsychordApplicationObservationResult,
  planBytes: Uint8Array,
  resultBytes: Uint8Array,
): PsychordObservationArtifactManifest {
  return {
    schemaVersion: "psychord-application-observation-artifact-set@1",
    artifactSetId: id,
    runId: plan.runId,
    scenario: plan.scenario,
    case: plan.case,
    adapter: {
      id: psychordObservationAdapterId,
      version: psychordObservationAdapterVersion,
      inputHash: plan.adapter.inputHash,
      outputHash: result.adapter.outputHash,
    },
    planHash: contentHash(planBytes),
    resultHash: contentHash(resultBytes),
    terminal: {
      operationalStatus: result.operationalStatus,
      outcome: result.outcome,
      currentness: result.currentness,
      assurance: result.assurance,
      cleanupComplete: result.cleanup.complete,
    },
    blobs: [
      { role: "plan", path: "plan.json", sha256: sha256(planBytes) },
      { role: "result", path: "result.json", sha256: sha256(resultBytes) },
    ],
  };
}

export function validatePsychordObservationArtifactManifest(bytes: Uint8Array) {
  const value = parseJson(bytes, "manifest");
  if (!isRecord(value)) throw new TypeError("Psychord artifact manifest must be an object");
  exactKeys(value, ["schemaVersion", "artifactSetId", "runId", "scenario", "case", "adapter", "planHash", "resultHash", "terminal", "blobs"], "manifest");
  if (value.schemaVersion !== "psychord-application-observation-artifact-set@1"
    || typeof value.artifactSetId !== "string" || typeof value.runId !== "string"
    || !isRecord(value.scenario) || !isRecord(value.adapter) || !isRecord(value.terminal)
    || !Array.isArray(value.blobs) || value.blobs.length !== 2) {
    throw new TypeError("Psychord artifact manifest shape is invalid");
  }
  exactKeys(value.scenario, ["id", "semanticHash"], "scenario");
  exactKeys(value.adapter, ["id", "version", "inputHash", "outputHash"], "adapter");
  exactKeys(value.terminal, ["operationalStatus", "outcome", "currentness", "assurance", "cleanupComplete"], "terminal");
  const blobs = value.blobs.map((blob, index) => {
    if (!isRecord(blob)) throw new TypeError("Psychord artifact blob declaration must be an object");
    exactKeys(blob, ["role", "path", "sha256"], "blob declaration");
    const expected = index === 0 ? { role: "plan", path: "plan.json" } : { role: "result", path: "result.json" };
    if (blob.role !== expected.role || blob.path !== expected.path || typeof blob.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(blob.sha256)) {
      throw new TypeError("Psychord artifact blob declaration is invalid or out of order");
    }
    return { path: blob.path, sha256: blob.sha256 };
  });
  const manifest = PsychordObservationArtifactManifestSchema.parse(value);
  assertManifestScalars(manifest);
  if (!Buffer.from(canonicalJson(manifest), "utf8").equals(Buffer.from(bytes))) {
    throw new TypeError("Psychord artifact manifest bytes are not canonical JSON");
  }
  return { manifest, blobs };
}

function assertManifestScalars(manifest: PsychordObservationArtifactManifest): void {
  if (manifest.adapter.id !== psychordObservationAdapterId || manifest.adapter.version !== psychordObservationAdapterVersion
    || !contentHashPattern.test(manifest.adapter.inputHash) || !contentHashPattern.test(manifest.adapter.outputHash)
    || !nonempty(manifest.artifactSetId) || !nonempty(manifest.runId) || !nonempty(manifest.case)
    || !nonempty(manifest.scenario.id) || !contentHashPattern.test(manifest.scenario.semanticHash)
    || !contentHashPattern.test(manifest.planHash) || !contentHashPattern.test(manifest.resultHash)
    || !["completed", "failed", "cancelled"].includes(manifest.terminal.operationalStatus)
    || !["passed", "failed", "unavailable"].includes(manifest.terminal.outcome)
    || !["current", "stale", "unknown"].includes(manifest.terminal.currentness)
    || manifest.terminal.assurance !== "supporting" || typeof manifest.terminal.cleanupComplete !== "boolean") {
    throw new TypeError("Psychord artifact manifest values are invalid");
  }
}

function assertManifestBinding(
  manifest: PsychordObservationArtifactManifest,
  artifactSetId: string,
  plan: PsychordApplicationObservationPlan,
  result: PsychordApplicationObservationResult,
  blobs: ReadonlyMap<string, Uint8Array>,
): void {
  const planBytes = requiredBlob(blobs, "plan.json");
  const resultBytes = requiredBlob(blobs, "result.json");
  if (manifest.artifactSetId !== artifactSetId || artifactSetId !== artifactSetIdFor(plan)
    || manifest.runId !== plan.runId || manifest.case !== plan.case
    || canonicalJson(manifest.scenario) !== canonicalJson(plan.scenario)
    || manifest.adapter.inputHash !== plan.adapter.inputHash || manifest.adapter.outputHash !== result.adapter.outputHash
    || manifest.planHash !== contentHash(planBytes) || manifest.resultHash !== contentHash(resultBytes)
    || manifest.blobs[0].sha256 !== sha256(planBytes) || manifest.blobs[1].sha256 !== sha256(resultBytes)
    || manifest.terminal.operationalStatus !== result.operationalStatus || manifest.terminal.outcome !== result.outcome
    || manifest.terminal.currentness !== result.currentness || manifest.terminal.assurance !== result.assurance
    || manifest.terminal.cleanupComplete !== result.cleanup.complete) {
    throw new Error("Psychord artifact manifest bindings do not authenticate the stored plan and result");
  }
}

function assertPlanResultBinding(plan: PsychordApplicationObservationPlan, result: PsychordApplicationObservationResult): void {
  const parsed = PsychordApplicationObservationExchangeSchema.safeParse({ plan, result });
  if (!parsed.success) throw new Error(`Psychord observation result does not match its plan binding: ${parsed.error.issues[0]?.message ?? "invalid exchange"}`);
}

function assertPublishedServiceBinding(value: {
  readonly artifactSetId: string;
  readonly manifest: PsychordObservationArtifactManifest;
  readonly plan: PsychordApplicationObservationPlan;
  readonly result: PsychordApplicationObservationResult;
  readonly behavioralEvidence: boolean;
}): void {
  assertPlanResultBinding(value.plan, value.result);
  const blobs = new Map<string, Uint8Array>([
    ["plan.json", encodeStrict(value.plan, PsychordApplicationObservationPlanSchema)],
    ["result.json", encodeStrict(value.result, PsychordApplicationObservationResultSchema)],
  ]);
  assertManifestBinding(value.manifest, value.artifactSetId, value.plan, value.result, blobs);
  if (value.behavioralEvidence !== isPassingEvidence(value.result)) {
    throw new Error("Psychord behavioralEvidence does not match the authenticated terminal result");
  }
}

function isPassingEvidence(result: PsychordApplicationObservationResult): boolean {
  return result.operationalStatus === "completed" && result.outcome === "passed"
    && result.currentness === "current" && result.assurance === "supporting" && result.cleanup.complete;
}

async function awaitExistingAttempt(
  store: PsychordArtifactSetStorePort,
  artifactSetId: string,
  waitMs: number,
  signal: AbortSignal,
  allowFinalizeResume = true,
): Promise<PsychordArtifactSetReadResult> {
  const deadline = performance.now() + Math.min(waitMs, 1_000);
  do {
    const current = await readPublished(store, artifactSetId);
    if (current.status === "published" || (current.status === "integrity-failed" && allowFinalizeResume)) return current;
    if (current.status === "incomplete" && allowFinalizeResume) {
      try {
        if (await store.resumeFinalize(artifactSetId) === "published") return await readPublished(store, artifactSetId);
      } catch (error) {
        return integrityFailed(artifactSetId, errorMessage(error));
      }
    }
    if (signal.aborted) return current;
    await boundedPause(signal);
  } while (performance.now() < deadline && !signal.aborted);
  return await readPublished(store, artifactSetId);
}

async function awaitActiveClaim(
  store: PsychordArtifactSetStorePort,
  storageRoot: string,
  artifactSetId: string,
  initial: PsychordAttemptClaimRecord,
  waitMs: number,
  signal: AbortSignal,
): Promise<PsychordArtifactSetReadResult> {
  const deadline = performance.now() + Math.min(waitMs, 1_000);
  let claim = initial;
  do {
    if (signal.aborted) return incompleteWithClaim(artifactSetId, claim);
    await boundedPause(signal);
    const current = await readExistingAttemptClaim(storageRoot, artifactSetId);
    if (current === undefined) return await readPublished(store, artifactSetId);
    claim = current;
    if (claim.state !== "active" || Date.parse(claim.expiresAt) <= Date.now()) {
      const recovered = await awaitExistingAttempt(store, artifactSetId, waitMs, signal, true);
      return recovered.status === "incomplete" ? incompleteWithClaim(artifactSetId, claim) : recovered;
    }
  } while (performance.now() < deadline);
  return incompleteWithClaim(artifactSetId, claim);
}

async function recoverAfterConflict(
  store: PsychordArtifactSetStorePort,
  artifactSetId: string,
  waitMs: number,
  signal: AbortSignal,
  conflict: unknown,
): Promise<PsychordArtifactSetReadResult> {
  const deadline = performance.now() + Math.min(waitMs, 1_000);
  let recovered: PsychordArtifactSetReadResult;
  do {
    recovered = await readPublished(store, artifactSetId);
    if (recovered.status === "published") return recovered;
    if (recovered.status === "incomplete") {
      try {
        if (await store.resumeFinalize(artifactSetId) === "published") {
          const resumed = await readPublished(store, artifactSetId);
          if (resumed.status === "published") return resumed;
        }
      } catch { /* Another caller may still be staging or finalizing the same exact set. */ }
    }
    if (signal.aborted) break;
    await boundedPause(signal);
  } while (performance.now() < deadline && !signal.aborted);
  recovered = await readPublished(store, artifactSetId);
  if (recovered.status === "published" || recovered.status === "integrity-failed") return recovered;
  throw conflict;
}

async function boundedPause(signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    const timer = setTimeout(done, 10);
    const abort = (): void => done();
    function done(): void { clearTimeout(timer); signal.removeEventListener("abort", abort); resolvePromise(); }
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) done();
  });
}

function artifactSetIdFor(plan: PsychordApplicationObservationPlan): string { return artifactSetId(plan); }
function encodeManifest(manifest: PsychordObservationArtifactManifest): Uint8Array { return Buffer.from(canonicalJson(manifest), "utf8"); }
function encodeStrict<T>(value: T, schema: StrictValueSchema<T>): Uint8Array { return Buffer.from(canonicalJson(schema.parse(value)), "utf8"); }
function decodeStrict<T>(bytes: Uint8Array, schema: StrictValueSchema<T>, label: string): T {
  const value = schema.parse(parseJson(bytes, label));
  if (!Buffer.from(canonicalJson(value), "utf8").equals(Buffer.from(bytes))) throw new Error(`stored Psychord ${label} bytes are not canonical strict values`);
  return value;
}
function parseJson(bytes: Uint8Array, label: string): unknown {
  try { return JSON.parse(Buffer.from(bytes).toString("utf8")); }
  catch { throw new TypeError(`Psychord artifact ${label} is not valid JSON`); }
}
function requiredBlob(blobs: ReadonlyMap<string, Uint8Array>, path: string): Uint8Array {
  const bytes = blobs.get(path);
  if (bytes === undefined) throw new Error(`Psychord artifact set is missing ${path}`);
  return bytes;
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) throw new TypeError(`Psychord ${label} contains missing or unknown fields`);
}
function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function contentHash(bytes: Uint8Array): ContentHash { return `sha256:v1:${sha256(bytes)}`; }
function nonempty(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function integrityFailed(artifactSetId: string, reason: string): PsychordArtifactSetReadResult {
  return PsychordObserveAndPublishResultSchema.parse({ status: "integrity-failed", artifactSetId, reason: reason.slice(0, 4_096) || "Unknown artifact integrity failure" });
}
const contentHashPattern = /^sha256:v1:[a-f0-9]{64}$/u;
