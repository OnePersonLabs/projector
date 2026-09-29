import {
  executionCapsuleHash,
  executionPlanHash
} from "./shared-XN3IZTFL.js";
import {
  ArtifactFingerprintSchema,
  ArtifactSchema,
  SurfaceApplyResultSchema,
  SurfacePlanSchema,
  SurfaceSchema,
  canonicalJson,
  hashFramedDomain
} from "./shared-Q56AARV7.js";

// node_modules/@projector/integrations/dist/surfaces/index.js
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function snapshotSemanticDigest(snapshot) {
  const enumeration = snapshot.enumeration ?? snapshot.surfaces[0]?.enumeration ?? { observability: "unavailable", method: "none", assumptions: [], blindSpots: [], dynamicMechanisms: [] };
  const semantic = {
    adapterId: snapshot.adapterId,
    adapterVersion: snapshot.adapterVersion,
    enumeration,
    surfaces: [...snapshot.surfaces].sort((left, right) => compare(left.id, right.id)).map(({ id, key, kind, adapter, access, enumeration: contract, capabilities, boundary }) => ({ id, key, kind, adapter, access, enumeration: contract, capabilities, boundary })),
    artifacts: [...snapshot.artifacts].sort((left, right) => compare(left.id, right.id)).map(({ observedAt: _observedAt, ...item }) => item),
    fingerprints: [...snapshot.fingerprints]
  };
  return hashFramedDomain("external-surface-snapshot-semantic", semantic);
}
function validateAdapterSurface(adapter, raw) {
  const surface = SurfaceSchema.parse(structuredClone(raw));
  if (surface.adapter !== adapter.id || surface.kind !== adapter.kind)
    throw new Error(`surface ${surface.id} is bound to another adapter or kind`);
  for (const key of Object.keys(surface.capabilities))
    if (surface.capabilities[key] && !adapter.capabilities[key])
      throw new Error(`surface ${surface.id} capability claims exceed adapter capability`);
  const observabilityRank = { unavailable: 0, sampled: 1, open: 1, bounded: 2, closed: 3 };
  if (observabilityRank[surface.enumeration.observability] > observabilityRank[adapter.enumeration.observability])
    throw new Error(`surface ${surface.id} enumeration claims exceed adapter observability`);
  if (surface.access === "read-write" && (!adapter.capabilities.read || !adapter.capabilities.write))
    throw new Error(`surface ${surface.id} access inflates adapter capability`);
  if (surface.access === "read-only" && !adapter.capabilities.read)
    throw new Error(`surface ${surface.id} access inflates adapter read capability`);
  if ((surface.access === "declared-only" || surface.access === "unavailable") && surface.capabilities.write)
    throw new Error(`unavailable surface ${surface.id} cannot claim writes`);
  return surface;
}
async function collectArtifacts(adapter, surface, context) {
  if (!adapter.capabilities.read || surface.access === "declared-only" || surface.access === "unavailable")
    return [];
  if (adapter.inventoryPage === void 0) {
    const artifacts2 = await adapter.inventory(structuredClone(surface), context);
    if (adapter.enumeration.observability === "closed" && adapter.enumeration.method.includes("pag"))
      throw new Error(`closed surface ${surface.id} requires authenticated pagination completion`);
    return artifacts2;
  }
  const artifacts = [];
  const cursors = /* @__PURE__ */ new Set();
  let cursor;
  while (true) {
    const page = await adapter.inventoryPage(structuredClone(surface), cursor, context);
    artifacts.push(...page.artifacts.map((item) => structuredClone(item)));
    if (page.complete) {
      if (page.nextCursor !== void 0)
        throw new Error(`complete pagination for ${surface.id} returned a continuation cursor`);
      break;
    }
    if (page.nextCursor === void 0 || cursors.has(page.nextCursor))
      throw new Error(`incomplete pagination for closed surface ${surface.id}`);
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  return artifacts;
}
async function captureSurfaceSnapshot(adapter, context, observedAt) {
  if (!Number.isFinite(Date.parse(observedAt)))
    throw new Error("surface snapshot requires a valid observed-at timestamp");
  if (adapter.id.trim() === "" || adapter.version.trim() === "")
    throw new Error("surface adapter requires stable id and version");
  if (adapter.capabilities.write && (adapter.plan === void 0 || adapter.apply === void 0 || adapter.validate === void 0))
    throw new Error(`writable adapter ${adapter.id} is missing mutation methods`);
  if (!adapter.capabilities.write && (adapter.plan !== void 0 || adapter.apply !== void 0))
    throw new Error(`read-only adapter ${adapter.id} must not expose mutation methods`);
  const rawSurfaces = await adapter.discover(context);
  const bySurfaceId = /* @__PURE__ */ new Map();
  for (const raw of rawSurfaces) {
    const surface = validateAdapterSurface(adapter, raw);
    if (bySurfaceId.has(surface.id))
      throw new Error(`duplicate surface identity ${surface.id}`);
    bySurfaceId.set(surface.id, surface);
  }
  const surfaces = [...bySurfaceId.values()].sort((left, right) => compare(left.id, right.id));
  const artifactsById = /* @__PURE__ */ new Map();
  const fingerprintsById = /* @__PURE__ */ new Map();
  for (const surface of surfaces) {
    for (const raw of await collectArtifacts(adapter, surface, context)) {
      const artifact = ArtifactSchema.parse(raw);
      if (!Number.isFinite(Date.parse(artifact.observedAt)) || artifact.observationRevision.trim() === "")
        throw new Error(`artifact ${artifact.id} lacks a valid observation timestamp or revision`);
      if (artifact.surfaceId !== surface.id)
        throw new Error(`artifact ${artifact.id} escaped surface ${surface.id}`);
      if (artifactsById.has(artifact.id))
        throw new Error(`duplicate artifact identity ${artifact.id}`);
      if (artifact.metadata.observedContent !== void 0) {
        const recomputed = hashFramedDomain("fake-surface-artifact-content", artifact.metadata.observedContent);
        if (recomputed !== artifact.contentHash)
          throw new Error(`artifact ${artifact.id} content hash failed recomputation`);
      }
      const fingerprint = ArtifactFingerprintSchema.parse(await adapter.fingerprint(structuredClone(artifact), context));
      if (fingerprint.adapterVersion !== adapter.version || fingerprint.contentHash !== artifact.contentHash)
        throw new Error(`artifact ${artifact.id} fingerprint failed adapter/revision authentication`);
      artifactsById.set(artifact.id, structuredClone(artifact));
      fingerprintsById.set(artifact.id, structuredClone(fingerprint));
    }
  }
  const artifacts = [...artifactsById.values()].sort((left, right) => compare(left.id, right.id));
  const fingerprints = artifacts.map(({ id }) => fingerprintsById.get(id));
  const semanticDigest = snapshotSemanticDigest({ adapterId: adapter.id, adapterVersion: adapter.version, surfaces, artifacts, fingerprints, enumeration: adapter.enumeration });
  const revision = { adapterId: adapter.id, adapterVersion: adapter.version, observedAt, semanticDigest };
  const snapshotDigest = hashFramedDomain("external-surface-snapshot-revision", revision);
  const unavailableSurfaceIds = surfaces.filter(({ access }) => access === "unavailable" || access === "declared-only").map(({ id }) => id);
  const observability = unavailableSurfaceIds.length > 0 ? "unavailable" : adapter.enumeration.observability;
  const blindSpots = [.../* @__PURE__ */ new Set([...adapter.enumeration.blindSpots, ...adapter.enumeration.dynamicMechanisms, ...unavailableSurfaceIds.map((id) => `surface unavailable: ${id}`)])].sort(compare);
  return deepFreeze({ revisionId: `snapshot:${snapshotDigest.slice(-32)}`, ...revision, enumeration: structuredClone(adapter.enumeration), snapshotDigest, surfaces, artifacts, fingerprints, unavailableSurfaceIds, observability, provesCompleteAbsence: observability === "closed" && blindSpots.length === 0, blindSpots });
}
function authenticateSnapshot(snapshot) {
  const semanticDigest = snapshotSemanticDigest(snapshot);
  const snapshotDigest = hashFramedDomain("external-surface-snapshot-revision", { adapterId: snapshot.adapterId, adapterVersion: snapshot.adapterVersion, observedAt: snapshot.observedAt, semanticDigest });
  if (!Number.isFinite(Date.parse(snapshot.observedAt)) || semanticDigest !== snapshot.semanticDigest || snapshotDigest !== snapshot.snapshotDigest || snapshot.revisionId !== `snapshot:${snapshotDigest.slice(-32)}`)
    throw new Error("external snapshot revision failed content authentication");
}
var FileSurfaceSnapshotStore = class {
  #root;
  constructor(root) {
    this.#root = root;
  }
  #path(digest) {
    if (!/^sha256:v1:[0-9a-f]{64}$/u.test(digest))
      throw new Error("snapshot digest is invalid");
    return join(this.#root, `${digest.slice("sha256:v1:".length)}.json`);
  }
  async put(snapshot) {
    authenticateSnapshot(snapshot);
    await mkdir(this.#root, { recursive: true });
    const bytes = `${canonicalSnapshotJson(snapshot)}
`;
    const path = this.#path(snapshot.snapshotDigest);
    try {
      await writeFile(path, bytes, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST") || await readFile(path, "utf8") !== bytes)
        throw error;
    }
  }
  async read(snapshotDigest) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(this.#path(snapshotDigest), "utf8"));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return void 0;
      throw error;
    }
    authenticateSnapshot(parsed);
    if (parsed.snapshotDigest !== snapshotDigest)
      throw new Error("snapshot store returned a different revision");
    return deepFreeze(parsed);
  }
};
function canonicalSnapshotJson(snapshot) {
  return canonicalJson(snapshot);
}
async function captureAndPersistSurfaceSnapshot(adapter, context, observedAt, store) {
  const snapshot = await captureSurfaceSnapshot(adapter, context, observedAt);
  await store.put(snapshot);
  return snapshot;
}
async function rebuildPinnedSurfaceSnapshot(state, store) {
  if (state.pinnedExternalSnapshotDigest === void 0)
    throw new Error("state has no pinned external snapshot revision");
  const snapshot = await store.read(state.pinnedExternalSnapshotDigest);
  if (snapshot === void 0)
    throw new Error("pinned external snapshot revision is unavailable");
  authenticateSnapshot(snapshot);
  return snapshot;
}
var InMemoryExternalOperationJournal = class {
  #records = /* @__PURE__ */ new Map();
  async reserve(input) {
    const now = Date.parse(input.now);
    if (!Number.isFinite(now) || !Number.isSafeInteger(input.leaseDurationMs) || input.leaseDurationMs < 1 || input.ownerId.trim() === "")
      throw new Error("external reservation requires valid owner, time, and lease duration");
    const existing = this.#records.get(input.operationId);
    if (existing !== void 0) {
      if (existing.planHash !== input.planHash || existing.snapshotDigest !== input.snapshotDigest)
        throw new Error("external operation id was reused for different authority or snapshot");
      if (existing.state === "completed") {
        if (existing.result === void 0)
          throw new Error("completed external operation is missing its durable result");
        return { state: "completed", result: structuredClone(existing.result) };
      }
      if ((existing.state === "reserved" || existing.state === "ambiguous") && Date.parse(existing.leaseExpiresAt) > now)
        return { state: "in-flight", ownerId: existing.ownerId, leaseExpiresAt: existing.leaseExpiresAt };
      if (existing.state === "compensated")
        return { state: "compensated" };
      const leaseExpiresAt2 = new Date(now + input.leaseDurationMs).toISOString();
      const leaseToken2 = hashFramedDomain("external-operation-recovery-lease", { ...input, leaseExpiresAt: leaseExpiresAt2, priorLeaseToken: existing.leaseToken });
      this.#records.set(input.operationId, { ...existing, state: "ambiguous", ownerId: input.ownerId, leaseExpiresAt: leaseExpiresAt2, leaseToken: leaseToken2 });
      return { state: "ambiguous", leaseToken: leaseToken2 };
    }
    const leaseExpiresAt = new Date(now + input.leaseDurationMs).toISOString();
    const leaseToken = hashFramedDomain("external-operation-lease", { ...input, leaseExpiresAt });
    this.#records.set(input.operationId, { state: "reserved", planHash: input.planHash, snapshotDigest: input.snapshotDigest, ownerId: input.ownerId, leaseExpiresAt, leaseToken });
    return { state: "acquired", leaseToken };
  }
  async complete(operationId, ownerId, leaseToken, result) {
    const record = this.owned(operationId, ownerId, leaseToken);
    this.#records.set(operationId, { ...record, state: "completed", result: structuredClone(result) });
  }
  async renew(operationId, ownerId, leaseToken, now, leaseDurationMs) {
    const record = this.required(operationId);
    const timestamp = Date.parse(now);
    if (record.state !== "reserved" && record.state !== "ambiguous" || record.ownerId !== ownerId || record.leaseToken !== leaseToken || !Number.isFinite(timestamp) || timestamp >= Date.parse(record.leaseExpiresAt))
      return false;
    this.#records.set(operationId, { ...record, leaseExpiresAt: new Date(timestamp + leaseDurationMs).toISOString() });
    return true;
  }
  async markAmbiguous(operationId, ownerId, leaseToken) {
    const record = this.owned(operationId, ownerId, leaseToken);
    this.#records.set(operationId, { ...record, state: "ambiguous" });
  }
  async markCompensated(operationId, ownerId, leaseToken) {
    const record = this.owned(operationId, ownerId, leaseToken);
    this.#records.set(operationId, { ...record, state: "compensated" });
  }
  required(operationId) {
    const record = this.#records.get(operationId);
    if (record === void 0)
      throw new Error(`unknown external operation ${operationId}`);
    return record;
  }
  owned(operationId, ownerId, leaseToken) {
    const record = this.required(operationId);
    if (record.ownerId !== ownerId || record.leaseToken !== leaseToken)
      throw new Error("external operation lease is owned by another executor");
    return record;
  }
};
var FileExternalOperationJournal = class {
  #root;
  constructor(root) {
    this.#root = root;
  }
  #key(operationId) {
    return hashFramedDomain("external-operation-journal-key", operationId).slice("sha256:v1:".length);
  }
  #path(operationId) {
    return join(this.#root, `${this.#key(operationId)}.json`);
  }
  #lockPath(operationId) {
    return join(this.#root, `${this.#key(operationId)}.lock`);
  }
  async #read(operationId) {
    try {
      return JSON.parse(await readFile(this.#path(operationId), "utf8"));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return void 0;
      throw error;
    }
  }
  async #write(operationId, record) {
    const temporary = `${this.#path(operationId)}.${record.leaseToken.slice(-12)}.tmp`;
    await writeFile(temporary, `${canonicalJson(record)}
`, "utf8");
    await rename(temporary, this.#path(operationId));
  }
  async #locked(operationId, action, contention) {
    await mkdir(this.#root, { recursive: true });
    const lock = this.#lockPath(operationId);
    try {
      await writeFile(lock, "locked\n", { flag: "wx" });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST")
        return contention();
      throw error;
    }
    try {
      return await action();
    } finally {
      await unlink(lock).catch(() => void 0);
    }
  }
  async reserve(input) {
    const now = Date.parse(input.now);
    if (!Number.isFinite(now) || input.ownerId.trim() === "" || !Number.isSafeInteger(input.leaseDurationMs) || input.leaseDurationMs < 1)
      throw new Error("external reservation requires valid owner, time, and lease duration");
    return this.#locked(input.operationId, async () => {
      const existing = await this.#read(input.operationId);
      if (existing !== void 0) {
        if (existing.planHash !== input.planHash || existing.snapshotDigest !== input.snapshotDigest)
          throw new Error("external operation id was reused for different authority or snapshot");
        if (existing.state === "completed") {
          if (existing.result === void 0)
            throw new Error("completed external operation is missing its durable result");
          return { state: "completed", result: existing.result };
        }
        if ((existing.state === "reserved" || existing.state === "ambiguous") && Date.parse(existing.leaseExpiresAt) > now)
          return { state: "in-flight", ownerId: existing.ownerId, leaseExpiresAt: existing.leaseExpiresAt };
        if (existing.state === "compensated")
          return { state: "compensated" };
        const leaseExpiresAt2 = new Date(now + input.leaseDurationMs).toISOString();
        const leaseToken2 = hashFramedDomain("external-operation-recovery-lease", { ...input, leaseExpiresAt: leaseExpiresAt2, priorLeaseToken: existing.leaseToken });
        const recovered = { ...existing, state: "ambiguous", ownerId: input.ownerId, leaseExpiresAt: leaseExpiresAt2, leaseToken: leaseToken2 };
        await this.#write(input.operationId, recovered);
        return { state: "ambiguous", leaseToken: leaseToken2 };
      }
      const leaseExpiresAt = new Date(now + input.leaseDurationMs).toISOString();
      const leaseToken = hashFramedDomain("external-operation-lease", { ...input, leaseExpiresAt });
      await this.#write(input.operationId, { state: "reserved", planHash: input.planHash, snapshotDigest: input.snapshotDigest, ownerId: input.ownerId, leaseExpiresAt, leaseToken });
      return { state: "acquired", leaseToken };
    }, async () => {
      const existing = await this.#read(input.operationId);
      if (existing !== void 0 && (existing.planHash !== input.planHash || existing.snapshotDigest !== input.snapshotDigest))
        throw new Error("external operation id was reused for different authority or snapshot");
      const ownerId = existing?.ownerId ?? "unknown-lock-owner";
      const leaseExpiresAt = existing?.leaseExpiresAt ?? input.now;
      if (existing !== void 0 && (existing.state === "reserved" || existing.state === "ambiguous") && Date.parse(leaseExpiresAt) > now)
        return { state: "in-flight", ownerId, leaseExpiresAt };
      return { state: "recovery-required", ownerId, leaseExpiresAt, reason: "external operation journal lock outlived its durable owner lease; operator recovery is required" };
    });
  }
  async complete(operationId, ownerId, leaseToken, result) {
    await this.#update(operationId, ownerId, leaseToken, (record) => ({ ...record, state: "completed", result }));
  }
  async renew(operationId, ownerId, leaseToken, now, leaseDurationMs) {
    let renewed = false;
    await this.#update(operationId, ownerId, leaseToken, (record) => {
      const timestamp = Date.parse(now);
      if (record.state !== "reserved" && record.state !== "ambiguous" || !Number.isFinite(timestamp) || timestamp >= Date.parse(record.leaseExpiresAt))
        return record;
      renewed = true;
      return { ...record, leaseExpiresAt: new Date(timestamp + leaseDurationMs).toISOString() };
    }).catch(() => void 0);
    return renewed;
  }
  async markAmbiguous(operationId, ownerId, leaseToken) {
    await this.#update(operationId, ownerId, leaseToken, (record) => ({ ...record, state: "ambiguous" }));
  }
  async markCompensated(operationId, ownerId, leaseToken) {
    await this.#update(operationId, ownerId, leaseToken, (record) => ({ ...record, state: "compensated" }));
  }
  async #update(operationId, ownerId, leaseToken, update) {
    await this.#locked(operationId, async () => {
      const record = await this.#read(operationId);
      if (record === void 0)
        throw new Error(`unknown external operation ${operationId}`);
      if (record.ownerId !== ownerId || record.leaseToken !== leaseToken)
        throw new Error("external operation lease is owned by another executor");
      await this.#write(operationId, update(record));
    }, async () => {
      throw new Error("external operation journal is locked by another executor");
    });
  }
};
async function executeSurfacePlan(input, adapter, context, ports) {
  const refuse = (reason) => deepFreeze({ outcome: "refused", reasons: [reason], validations: [], compensated: false });
  if (!SurfacePlanSchema.safeParse(input.surfacePlan).success)
    return refuse("surface plan failed the normative contract");
  const recomputedSemanticDigest = snapshotSemanticDigest(input.snapshot);
  const recomputedSnapshotDigest = hashFramedDomain("external-surface-snapshot-revision", { adapterId: input.snapshot.adapterId, adapterVersion: input.snapshot.adapterVersion, observedAt: input.snapshot.observedAt, semanticDigest: recomputedSemanticDigest });
  if (recomputedSemanticDigest !== input.snapshot.semanticDigest || recomputedSnapshotDigest !== input.snapshot.snapshotDigest || input.snapshot.revisionId !== `snapshot:${recomputedSnapshotDigest.slice(-32)}`)
    return refuse("external snapshot revision failed content authentication");
  if (input.approval.planId !== input.plan.id || input.approval.planRevision !== input.plan.revision || input.approval.planHash !== executionPlanHash(input.plan) || input.approval.dependencyDigest !== input.plan.boundState.dependencyDigest || input.approval.capsuleId !== input.capsule.id || input.approval.capsuleHash !== executionCapsuleHash(input.capsule))
    return refuse("stale approval requires Task16 refresh or rebase");
  if (input.surfacePlan.adapterId !== adapter.id || input.snapshot.adapterId !== adapter.id || input.snapshot.adapterVersion !== adapter.version)
    return refuse("surface plan or snapshot belongs to another adapter revision");
  const target = input.snapshot.surfaces.find(({ id }) => id === input.surfacePlan.surfaceId);
  if (target === void 0 || target.access !== "read-write" || !target.capabilities.write)
    return refuse("surface plan target is absent from the pinned writable snapshot");
  if (!adapter.capabilities.write || adapter.apply === void 0 || adapter.validate === void 0)
    return refuse("surface adapter is not writable");
  if (input.surfacePlan.riskClass !== input.capsule.risk.class)
    return refuse("surface risk is not bound to the approved capsule risk");
  const operationNames = input.surfacePlan.operations.map((operation) => operation.operation).filter((operation) => typeof operation === "string" && operation.length > 0);
  if (!input.capsule.unitIds.includes(input.surfacePlan.surfaceId) || operationNames.length !== input.surfacePlan.operations.length || operationNames.some((operation) => operation !== input.capsule.operation && !input.capsule.availablePrimitives.includes(`surface-operation:${input.surfacePlan.surfaceId}:${operation}`)))
    return refuse("surface target or operations are outside the approved capsule");
  if ((input.surfacePlan.riskClass === "R3" || input.surfacePlan.riskClass === "R4") && !input.manualContinuation)
    return refuse("high-risk external operation requires explicit manual continuation");
  if (adapter.capabilities.humanApprovalRequired && !input.surfacePlan.requiredApprovals.includes(input.approval.id))
    return refuse("surface adapter requires the authenticated Task16 approval identity");
  if (input.surfacePlan.boundState.dependencyDigest !== input.plan.boundState.dependencyDigest || input.capsule.boundState.dependencyDigest !== input.plan.boundState.dependencyDigest)
    return refuse("surface plan is outside the immutable Task16 state binding");
  const current = await ports.state.current();
  if (current.pinnedExternalSnapshotDigest !== input.snapshot.snapshotDigest || input.surfacePlan.boundState.compiledAgainst.pinnedExternalSnapshotDigest !== input.snapshot.snapshotDigest)
    return refuse("external snapshot is stale or not pinned by the approved plan");
  const binding = await ports.bindingValidator.validate(input.surfacePlan.boundState, current, context);
  if (binding.status !== "current" && binding.status !== "rebound")
    return refuse(`surface state binding is ${binding.status}`);
  const planHash = executionPlanHash(input.plan);
  const capsuleHash = executionCapsuleHash(input.capsule);
  const operationId = `external-operation:${hashFramedDomain("external-operation-reservation", { planId: input.plan.id, planRevision: input.plan.revision, planHash, capsuleHash, approvalId: input.approval.id, surfacePlan: input.surfacePlan, snapshotDigest: input.snapshot.snapshotDigest }).slice(-32)}`;
  const leaseDurationMs = input.leaseDurationMs ?? 3e4;
  const reservation = await ports.journal.reserve({ operationId, planHash, snapshotDigest: input.snapshot.snapshotDigest, ownerId: input.reservationOwnerId, now: ports.clock.now(), leaseDurationMs });
  if (reservation.state === "completed")
    return deepFreeze({ outcome: "success", operationId, reasons: ["idempotent replay returned the durable result"], validations: [], result: reservation.result, compensated: false });
  if (reservation.state === "in-flight")
    return deepFreeze({ outcome: "partial", operationId, reasons: [`external operation is in flight under owner ${reservation.ownerId} until ${reservation.leaseExpiresAt}`], validations: [], compensated: false });
  if (reservation.state === "recovery-required")
    return deepFreeze({ outcome: "partial", operationId, reasons: [reservation.reason], validations: [], compensated: false });
  if (reservation.state === "compensated")
    return deepFreeze({ outcome: "partial", operationId, reasons: ["ambiguous external operation was already compensated and was not replayed"], validations: [], compensated: true });
  const leaseToken = reservation.leaseToken;
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    void ports.journal.renew(operationId, input.reservationOwnerId, leaseToken, ports.clock.now(), leaseDurationMs).then((renewed) => {
      if (!renewed)
        leaseLost = true;
    }).catch(() => {
      leaseLost = true;
    });
  }, Math.max(10, Math.floor(leaseDurationMs / 3)));
  const compensate = async () => {
    if (adapter.compensate === void 0)
      return false;
    if (leaseLost || !await ports.journal.renew(operationId, input.reservationOwnerId, leaseToken, ports.clock.now(), leaseDurationMs))
      return false;
    await adapter.compensate(operationId, input.surfacePlan, context);
    if (leaseLost || !await ports.journal.renew(operationId, input.reservationOwnerId, leaseToken, ports.clock.now(), leaseDurationMs))
      return false;
    await ports.journal.markCompensated(operationId, input.reservationOwnerId, leaseToken);
    return true;
  };
  try {
    if (reservation.state === "ambiguous") {
      const validations2 = await adapter.validate(input.surfacePlan, context);
      if (validations2.length > 0 && validations2.every(({ status }) => status === "passed"))
        return deepFreeze({ outcome: "partial", operationId, reasons: ["ambiguous operation validated but lacks an authenticated apply result; manual reconciliation required"], validations: validations2, compensated: false });
      const compensated = await compensate();
      return deepFreeze({ outcome: "partial", operationId, reasons: ["ambiguous external operation was not replayed"], validations: validations2, compensated });
    }
    const result = SurfaceApplyResultSchema.parse(await adapter.apply(input.surfacePlan, context));
    if (leaseLost || !await ports.journal.renew(operationId, input.reservationOwnerId, leaseToken, ports.clock.now(), leaseDurationMs))
      throw new Error("external operation lease was lost during apply; outcome is ambiguous");
    const validations = await adapter.validate(input.surfacePlan, context);
    if (validations.length === 0 || validations.some(({ status }) => status !== "passed")) {
      await ports.journal.markAmbiguous(operationId, input.reservationOwnerId, leaseToken);
      const compensated = await compensate();
      return deepFreeze({ outcome: "partial", operationId, reasons: ["external apply validation did not establish success"], validations, result, compensated });
    }
    await ports.journal.complete(operationId, input.reservationOwnerId, leaseToken, result);
    return deepFreeze({ outcome: "success", operationId, reasons: [], validations, result, compensated: false });
  } catch (error) {
    if (leaseLost)
      return deepFreeze({ outcome: "partial", operationId, reasons: [error instanceof Error ? error.message : "external operation lease was lost; outcome is ambiguous"], validations: [], compensated: false });
    try {
      await ports.journal.markAmbiguous(operationId, input.reservationOwnerId, leaseToken);
    } catch {
      return deepFreeze({ outcome: "partial", operationId, reasons: ["external operation lease ownership changed; manual recovery is required"], validations: [], compensated: false });
    }
    const compensated = await compensate().catch(() => false);
    return deepFreeze({ outcome: "partial", operationId, reasons: [error instanceof Error ? error.message : "external operation outcome is ambiguous"], validations: [], compensated });
  } finally {
    clearInterval(heartbeat);
  }
}
var FakeSurfaceAdapter = class {
  id;
  version;
  kind;
  capabilities;
  enumeration;
  #surfaces;
  #pages;
  #complete;
  #applyMode;
  applyCalls = 0;
  compensationCalls = 0;
  plan;
  apply;
  validate;
  compensate;
  constructor(options) {
    this.id = options.id;
    this.version = options.version;
    this.kind = options.kind;
    this.capabilities = structuredClone(options.capabilities);
    this.enumeration = structuredClone(options.enumeration);
    this.#surfaces = structuredClone(options.surfaces);
    this.#pages = structuredClone(options.pages);
    this.#complete = options.complete ?? true;
    this.#applyMode = options.applyMode ?? "success";
    if (this.capabilities.write) {
      this.plan = async (change) => SurfacePlanSchema.parse({ adapterId: this.id, surfaceId: change.surfaceId, riskClass: "R3", operations: [{ operation: change.operation, payload: change.payload }], requiredApprovals: ["manual:operator"], validatorIds: [`validate:${this.id}`], boundState: contextlessBinding(change) });
      this.apply = async () => {
        this.applyCalls += 1;
        if (this.#applyMode === "ambiguous-failure")
          throw new Error("fake external operation outcome is ambiguous");
        return { changed: true, operationEvidence: [], externalReferences: [`fake:${this.applyCalls}`] };
      };
      this.validate = async () => [{ validatorId: `validate:${this.id}`, status: this.#applyMode === "success" ? "passed" : "failed", summary: "fake validation", evidenceIds: [], evidenceLane: "runtime", independenceGroup: `fake:${this.id}`, assurance: "strong", authorSource: "fake-surface-adapter", sideEffectClass: "read-only", details: {}, startedAt: "deterministic", completedAt: "deterministic" }];
      this.compensate = async () => {
        this.compensationCalls += 1;
      };
    }
  }
  async discover(_context) {
    return this.#surfaces.map((surface) => structuredClone(surface));
  }
  async inventory(_surface, _context) {
    return structuredClone(this.#pages.flat());
  }
  async inventoryPage(_surface, cursor, _context) {
    const index = cursor === void 0 ? 0 : Number(cursor);
    const last = index >= this.#pages.length - 1;
    return { artifacts: structuredClone(this.#pages[index] ?? []), ...last ? {} : { nextCursor: String(index + 1) }, complete: last && this.#complete };
  }
  async fingerprint(artifact, _context) {
    return { contentHash: artifact.contentHash, adapterVersion: this.version, ...artifact.structuralSignature === void 0 ? {} : { structuralSignature: artifact.structuralSignature }, ...artifact.semanticSignature === void 0 ? {} : { semanticSignature: artifact.semanticSignature } };
  }
};
function contextlessBinding(change) {
  const compiledAgainst = { gitBase: change.semanticChangeId, worktreeDigest: hashFramedDomain("fake-binding", "worktree"), canonicalProjectorDigest: hashFramedDomain("fake-binding", "canonical"), toolchainDigest: hashFramedDomain("fake-binding", "toolchain") };
  return { compiledAgainst, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
}

export {
  captureSurfaceSnapshot,
  FileSurfaceSnapshotStore,
  captureAndPersistSurfaceSnapshot,
  rebuildPinnedSurfaceSnapshot,
  InMemoryExternalOperationJournal,
  FileExternalOperationJournal,
  executeSurfacePlan,
  FakeSurfaceAdapter
};
