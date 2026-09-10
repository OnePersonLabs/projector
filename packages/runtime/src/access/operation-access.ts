import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, rmdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type ProjectOperationAccessMode = "shared" | "exclusive";

export interface ProjectOperationAccessOptions {
  operation: string;
  mode: ProjectOperationAccessMode;
  signal?: AbortSignal;
}

export interface ProjectOperationAccess {
  readonly signal: AbortSignal;
}

export type OperationAccessErrorCode = "project-not-ready" | "access-corrupt" | "access-aborted";

export class OperationAccessError extends Error {
  readonly code: OperationAccessErrorCode;

  constructor(code: OperationAccessErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OperationAccessError";
    this.code = code;
  }
}

interface AccessClaim {
  version: 1;
  requestId: string;
  ticket: number;
  operation: string;
  mode: ProjectOperationAccessMode;
  processId: number;
  createdAt: string;
  heartbeatAt: string;
}

interface AccessState {
  requests: AccessClaim[];
  holders: AccessClaim[];
  nextTicket: number;
}

const runtimeRelativePath = join(".projector", "runtime");
const accessDirectoryName = "operation-access";
const requestsDirectoryName = "requests";
const holdersDirectoryName = "holders";
const counterFileName = "next-ticket";
const mutexDirectoryName = "mutex";
const pollIntervalMs = 10;
const abandonedMutexAfterMs = 30_000;
const abandonedClaimAfterMs = 5_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function withProjectOperationAccess<T>(
  root: string,
  options: ProjectOperationAccessOptions,
  operation: (access: ProjectOperationAccess) => Promise<T> | T,
): Promise<T> {
  validateOptions(options);
  throwIfAborted(options.signal);
  const accessPath = await prepareAccessDirectory(root);
  const claim = await enqueue(accessPath, options);
  let acquired = false;
  try {
    await waitToAcquire(accessPath, claim, options.signal);
    acquired = true;
    const integrity = new AbortController();
    const heartbeat = startHeartbeat(accessPath, claim, integrity);
    const signal = options.signal === undefined
      ? integrity.signal
      : AbortSignal.any([options.signal, integrity.signal]);
    try {
      return await operation({ signal });
    } finally {
      await heartbeat.stop();
    }
  } finally {
    await removeOwnClaim(accessPath, acquired ? holdersDirectoryName : requestsDirectoryName, claim);
  }
}

function validateOptions(options: ProjectOperationAccessOptions): void {
  if (options.mode !== "shared" && options.mode !== "exclusive") {
    throw new TypeError("Project operation access mode must be shared or exclusive");
  }
  if (options.operation.length === 0 || options.operation.length > 256 || options.operation.trim() !== options.operation) {
    throw new TypeError("Project operation identity must contain 1 to 256 non-padding characters");
  }
}

async function prepareAccessDirectory(root: string): Promise<string> {
  let governedRoot: string;
  try {
    governedRoot = await realpath(root);
  } catch (cause) {
    throw new OperationAccessError("project-not-ready", `Project root is not readable: ${root}`, { cause });
  }
  const projectorPath = join(governedRoot, ".projector");
  try {
    const projectorStatus = await lstat(projectorPath);
    if (!projectorStatus.isDirectory() || projectorStatus.isSymbolicLink()) throw new Error("not a real directory");
  } catch (cause) {
    throw new OperationAccessError(
      "project-not-ready",
      "Project operation access requires an initialized .projector directory",
      { cause },
    );
  }
  const runtimePath = join(governedRoot, runtimeRelativePath);
  await ensureRealDirectory(runtimePath);
  const accessPath = join(runtimePath, accessDirectoryName);
  await ensureRealDirectory(accessPath);
  await ensureRealDirectory(join(accessPath, requestsDirectoryName));
  await ensureRealDirectory(join(accessPath, holdersDirectoryName));
  return accessPath;
}

async function ensureRealDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  const status = await lstat(path);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new OperationAccessError("access-corrupt", `Operation access path is not a real directory: ${path}`);
  }
}

async function enqueue(accessPath: string, options: ProjectOperationAccessOptions): Promise<AccessClaim> {
  return withMutex(accessPath, options.signal, async () => {
    const state = await readAccessState(accessPath);
    if (state.nextTicket === Number.MAX_SAFE_INTEGER) throw corrupt("Operation access ticket space is exhausted");
    const createdAt = new Date().toISOString();
    const claim: AccessClaim = {
      version: 1,
      requestId: randomUUID(),
      ticket: state.nextTicket + 1,
      operation: options.operation,
      mode: options.mode,
      processId: process.pid,
      createdAt,
      heartbeatAt: createdAt,
    };
    await writeAtomic(accessPath, counterFileName, `${claim.ticket}\n`);
    await writeNewClaim(join(accessPath, requestsDirectoryName, `${claim.requestId}.json`), claim);
    return claim;
  });
}

function startHeartbeat(
  accessPath: string,
  claim: AccessClaim,
  integrity: AbortController,
): { stop: () => Promise<void> } {
  let requestStop: () => void = () => undefined;
  const stopped = new Promise<boolean>((resolve) => {
    requestStop = () => resolve(true);
  });
  const loop = (async () => {
    while (true) {
      const shouldStop = await Promise.race([delay(250).then(() => false), stopped]);
      if (shouldStop) return;
      await refreshHeartbeat(accessPath, claim);
    }
  })();
  const outcome = loop.then(
    () => undefined,
    (error: unknown) => {
      integrity.abort(error);
      return error;
    },
  );
  return {
    stop: async () => {
      requestStop();
      const error = await outcome;
      if (error !== undefined) throw error;
    },
  };
}

async function refreshHeartbeat(accessPath: string, claim: AccessClaim): Promise<void> {
  await withMutex(accessPath, undefined, async () => {
    const state = await readAccessState(accessPath);
    const persisted = state.holders.find((candidate) => candidate.requestId === claim.requestId);
    if (persisted === undefined || !sameClaim(persisted, claim)) {
      throw corrupt(`Operation access claim ${claim.requestId} is missing or changed during heartbeat`);
    }
    const previousTime = new Date(claim.heartbeatAt).getTime();
    const heartbeatAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
    const refreshed: AccessClaim = { ...claim, heartbeatAt };
    await writeAtomic(
      join(accessPath, holdersDirectoryName),
      `${claim.requestId}.json`,
      `${JSON.stringify(refreshed)}\n`,
    );
    claim.heartbeatAt = heartbeatAt;
  });
}

async function waitToAcquire(accessPath: string, claim: AccessClaim, signal: AbortSignal | undefined): Promise<void> {
  while (true) {
    throwIfAborted(signal);
    const acquired = await withMutex(accessPath, signal, async () => {
      const state = await readAccessState(accessPath);
      const ownRequest = state.requests.find((candidate) => candidate.requestId === claim.requestId);
      if (ownRequest === undefined || !sameClaim(ownRequest, claim)) {
        throw corrupt(`Operation access request ${claim.requestId} is missing or changed`);
      }
      const canAcquire = claim.mode === "shared"
        ? state.holders.every((holder) => holder.mode === "shared") &&
          state.requests.every((request) => request.ticket >= claim.ticket || request.mode !== "exclusive")
        : state.holders.length === 0 && state.requests.every((request) => request.ticket >= claim.ticket);
      if (!canAcquire) return false;
      try {
        await rename(
          join(accessPath, requestsDirectoryName, `${claim.requestId}.json`),
          join(accessPath, holdersDirectoryName, `${claim.requestId}.json`),
        );
      } catch (cause) {
        throw corrupt(`Operation access request ${claim.requestId} could not become a holder`, cause);
      }
      // Both directories are synced because the claim's location is the lock state.
      await syncDirectory(join(accessPath, requestsDirectoryName));
      await syncDirectory(join(accessPath, holdersDirectoryName));
      return true;
    });
    if (acquired) return;
    await abortableDelay(signal);
  }
}

async function removeOwnClaim(accessPath: string, location: string, claim: AccessClaim): Promise<void> {
  await withMutex(accessPath, undefined, async () => {
    const state = await readAccessState(accessPath);
    const claims = location === requestsDirectoryName ? state.requests : state.holders;
    const persisted = claims.find((candidate) => candidate.requestId === claim.requestId);
    if (persisted === undefined || !sameClaim(persisted, claim)) {
      throw corrupt(`Operation access claim ${claim.requestId} is missing or changed during release`);
    }
    try {
      await rm(join(accessPath, location, `${claim.requestId}.json`));
    } catch (cause) {
      throw corrupt(`Operation access claim ${claim.requestId} could not be released`, cause);
    }
    await syncDirectory(join(accessPath, location));
  });
}

async function readAccessState(accessPath: string): Promise<AccessState> {
  await validateAccessDirectoryEntries(accessPath);
  const requests = await readClaims(join(accessPath, requestsDirectoryName));
  const holders = await readClaims(join(accessPath, holdersDirectoryName));
  const allClaims = [...requests, ...holders];
  const now = Date.now();
  for (const claim of allClaims) {
    const heartbeat = new Date(claim.heartbeatAt).getTime();
    if (heartbeat > now + abandonedClaimAfterMs || now - heartbeat > abandonedClaimAfterMs) {
      throw corrupt(`Operation access claim ${claim.requestId} has an abandoned or invalid heartbeat and requires recovery`);
    }
  }
  const requestIds = new Set<string>();
  const tickets = new Set<number>();
  for (const claim of allClaims) {
    if (requestIds.has(claim.requestId) || tickets.has(claim.ticket)) {
      throw corrupt("Operation access claims have ambiguous identity or ticket order");
    }
    requestIds.add(claim.requestId);
    tickets.add(claim.ticket);
  }
  const exclusiveHolders = holders.filter((claim) => claim.mode === "exclusive");
  if (exclusiveHolders.length > 0 && holders.length !== 1) {
    throw corrupt("An exclusive operation access claim overlaps another holder");
  }
  if (
    holders.some((holder) =>
      requests.some((request) => request.mode === "exclusive" && request.ticket < holder.ticket),
    )
  ) {
    throw corrupt("An operation holder bypasses an earlier exclusive request");
  }
  const nextTicket = await readCounter(accessPath, allClaims.length);
  if (allClaims.some((claim) => claim.ticket > nextTicket)) {
    throw corrupt("Operation access ticket counter precedes a persisted claim");
  }
  return { requests, holders, nextTicket };
}

async function validateAccessDirectoryEntries(accessPath: string): Promise<void> {
  const allowed = new Set([requestsDirectoryName, holdersDirectoryName, counterFileName, mutexDirectoryName]);
  let entries: Dirent[];
  try {
    entries = await readdir(accessPath, { withFileTypes: true });
  } catch (cause) {
    throw corrupt("Operation access directory is unreadable", cause);
  }
  for (const entry of entries) {
    if (!allowed.has(entry.name)) throw corrupt(`Unexpected operation access entry: ${entry.name}`);
    if (
      ((entry.name === requestsDirectoryName || entry.name === holdersDirectoryName || entry.name === mutexDirectoryName) &&
        !entry.isDirectory()) ||
      (entry.name === counterFileName && !entry.isFile()) || entry.isSymbolicLink()
    ) {
      throw corrupt(`Operation access entry has an invalid type: ${entry.name}`);
    }
  }
}

async function readClaims(directory: string): Promise<AccessClaim[]> {
  const claims: AccessClaim[] = [];
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    throw corrupt(`Operation access claims are unreadable: ${directory}`, cause);
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      throw corrupt(`Invalid operation access claim entry: ${entry.name}`);
    }
    const claim = await readClaim(join(directory, entry.name));
    if (entry.name !== `${claim.requestId}.json`) {
      throw corrupt(`Operation access claim filename does not match its identity: ${entry.name}`);
    }
    claims.push(claim);
  }
  return claims;
}

async function readClaim(path: string): Promise<AccessClaim> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    throw corrupt(`Operation access claim is unreadable: ${path}`, cause);
  }
  if (!isAccessClaim(parsed)) throw corrupt(`Operation access claim is invalid: ${path}`);
  return parsed;
}

function isAccessClaim(value: unknown): value is AccessClaim {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AccessClaim>;
  return (
    Object.keys(value).sort().join(",") === "createdAt,heartbeatAt,mode,operation,processId,requestId,ticket,version" &&
    candidate.version === 1 && typeof candidate.requestId === "string" && uuidPattern.test(candidate.requestId) &&
    typeof candidate.ticket === "number" && Number.isSafeInteger(candidate.ticket) && candidate.ticket > 0 &&
    typeof candidate.operation === "string" && candidate.operation.length > 0 && candidate.operation.length <= 256 &&
    candidate.operation.trim() === candidate.operation && (candidate.mode === "shared" || candidate.mode === "exclusive") &&
    typeof candidate.processId === "number" && Number.isSafeInteger(candidate.processId) && candidate.processId > 0 &&
    isIsoDate(candidate.createdAt) && isIsoDate(candidate.heartbeatAt) &&
    (candidate.heartbeatAt as string) >= (candidate.createdAt as string)
  );
}

async function readCounter(accessPath: string, claimCount: number): Promise<number> {
  try {
    const raw = await readFile(join(accessPath, counterFileName), "utf8");
    if (!/^(0|[1-9][0-9]*)\n$/u.test(raw)) throw new Error("invalid decimal encoding");
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value)) throw new Error("counter exceeds safe integer range");
    return value;
  } catch (cause) {
    if (isCode(cause, "ENOENT") && claimCount === 0) return 0;
    throw corrupt("Operation access ticket counter is missing or unreadable", cause);
  }
}

async function writeNewClaim(path: string, claim: AccessClaim): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(claim)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(join(path, ".."));
}

async function writeAtomic(directory: string, name: string, content: string): Promise<void> {
  const temporaryName = `.${name}.${randomUUID()}.tmp`;
  const temporaryPath = join(directory, temporaryName);
  const handle = await open(temporaryPath, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryPath, join(directory, name));
    await syncDirectory(directory);
  } catch (cause) {
    await rm(temporaryPath, { force: true });
    throw cause;
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } catch (cause) {
    if (!isCode(cause, "EINVAL") && !isCode(cause, "ENOTSUP") && !isCode(cause, "EPERM")) throw cause;
  } finally {
    await handle.close();
  }
}

async function withMutex<T>(accessPath: string, signal: AbortSignal | undefined, body: () => Promise<T>): Promise<T> {
  const mutexPath = join(accessPath, mutexDirectoryName);
  while (true) {
    throwIfAborted(signal);
    try {
      await mkdir(mutexPath);
      break;
    } catch (cause) {
      if (!isCode(cause, "EEXIST")) throw cause;
      let mutexStatus;
      try {
        mutexStatus = await stat(mutexPath);
      } catch (error) {
        if (isCode(error, "ENOENT")) continue;
        throw corrupt("Operation access mutex is unreadable", error);
      }
      if (!mutexStatus.isDirectory()) throw corrupt("Operation access mutex is not a directory");
      if (Date.now() - mutexStatus.mtimeMs > abandonedMutexAfterMs) {
        throw corrupt("Operation access mutex appears abandoned and requires recovery");
      }
      await abortableDelay(signal);
    }
  }
  try {
    return await body();
  } finally {
    try {
      await rmdir(mutexPath);
    } catch (cause) {
      throw corrupt("Operation access mutex could not be released", cause);
    }
  }
}

async function abortableDelay(signal: AbortSignal | undefined): Promise<void> {
  if (signal === undefined) {
    await delay(pollIntervalMs);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(aborted(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, pollIntervalMs);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw aborted(signal);
}

function aborted(signal: AbortSignal): OperationAccessError {
  return new OperationAccessError("access-aborted", "Project operation access was aborted", { cause: signal.reason });
}

function corrupt(message: string, cause?: unknown): OperationAccessError {
  return new OperationAccessError("access-corrupt", message, cause === undefined ? undefined : { cause });
}

function sameClaim(left: AccessClaim, right: AccessClaim): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
