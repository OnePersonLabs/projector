import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

import { CodeImpactResultSchema, ContentHashSchema, DEFAULT_OBSERVATION_LIMITS, ProjectorOperationInputSchemas, canonicalJson, hashFramedDomain, observationLimitValue } from "@projector/core";
import { RepositoryPathService, SqliteCodeStore, currentObservationScope, withObservationScope } from "@projector/runtime";
import { z } from "zod";
import { observeIndexedRepository } from "../change-lifecycle/indexed-observer.js";
import { runObservationTask } from "../observation/task-runner.js";

const gitExec = promisify(execFile);
const cachePath = ".projector/runtime/repository-check/state.json";
const lockPath = ".projector/runtime/repository-check/check.lock";
const semanticBaselineOwner = "repository-check:baseline";
const pathSchema = z.string().min(1).max(4096);
const headSchema = z.string().regex(/^[a-f0-9]{40,64}$/u).nullable();
const observationSchema = z.strictObject({
  head: headSchema,
  evidenceIdentity: ContentHashSchema,
  stagedIdentity: ContentHashSchema,
  files: z.array(z.strictObject({ path: pathSchema, identity: ContentHashSchema })),
});
const pendingSchema = z.strictObject({
  findingId: z.string().min(1).max(128), evidenceIdentity: ContentHashSchema,
  fromHead: headSchema, toHead: headSchema, baselineEvidenceIdentity: ContentHashSchema.nullable(),
  paths: z.array(pathSchema).max(100), omittedPaths: z.number().int().nonnegative(),
});
export const RepositoryCheckOutputSchema = z.strictObject({
  status: z.enum(["unchanged", "changed", "no previous observation", "incomplete"]),
  observation: z.strictObject({ head: headSchema, evidenceIdentity: ContentHashSchema }).optional(),
  pending: pendingSchema.optional(), offer: z.boolean(), limitations: z.array(z.string()).max(16), nextAction: z.string(),
  semantic: z.strictObject({ generation: z.string().min(1), affectedPaths: z.array(pathSchema), possiblePaths: z.array(pathSchema), unknowns: z.array(z.string()), truncated: z.boolean() }).optional(),
});
const stateSchema = z.strictObject({
  version: z.literal(1), observation: observationSchema, pending: pendingSchema.optional(),
  offeredSessions: z.array(ContentHashSchema).max(128),
  semanticGeneration: z.string().min(1).max(256).optional(),
});
type State = z.infer<typeof stateSchema>;
type Observation = z.infer<typeof observationSchema>;
type Output = z.infer<typeof RepositoryCheckOutputSchema>;
type Input = z.infer<(typeof ProjectorOperationInputSchemas)["repository.check"]>;

/** Service overrides may tighten the caller's declared observation allowance. */
export interface RepositoryCheckOptions {
  signal?: AbortSignal;
  maxMilliseconds?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxGitBytes?: number;
  maxPaths?: number;
}

function included(path: string): boolean {
  return path !== ".projector/runtime" && !path.startsWith(".projector/runtime/");
}
function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

/** A bounded change detector. It never evaluates or accepts intended design. */
export async function checkRepository(repositoryRoot: string, rawInput: Input = {}, options: RepositoryCheckOptions = {}): Promise<Output> {
  const input = ProjectorOperationInputSchemas["repository.check"].parse(rawInput);
  const scope = currentObservationScope();
  const limits = scope?.limits ?? DEFAULT_OBSERVATION_LIMITS;
  const deadline = performance.now() + Math.min(scope?.budget.remainingMs() ?? observationLimitValue(limits.timeoutMs), options.maxMilliseconds ?? observationLimitValue(limits.timeoutMs));
  const maxFileBytes = Math.min(options.maxFileBytes ?? Infinity, observationLimitValue(limits.maxFileBytes));
  const maxTotalBytes = Math.min(options.maxTotalBytes ?? Infinity, observationLimitValue(limits.maxTotalBytes));
  const maxPaths = Math.min(options.maxPaths ?? Infinity, observationLimitValue(limits.maxFiles));
  const maxGitBytes = Math.min(options.maxGitBytes ?? Infinity, observationLimitValue(limits.maxGitOutputBytes));
  const gitAbort = new AbortController();
  const signal = AbortSignal.any([gitAbort.signal, ...(options.signal === undefined ? [] : [options.signal]), ...(scope === undefined ? [] : [scope.signal])]);
  let gitBytes = 0;
  const checkpoint = () => {
    signal.throwIfAborted();
    if (performance.now() >= deadline) throw new Error("Repository check elapsed-time bound exceeded");
  };
  let paths: RepositoryPathService | undefined;
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  let lockTarget: string | undefined;
  let state: State | undefined;
  let storedState: State | undefined;
  let codeStore: SqliteCodeStore | undefined;
  let baselineMissing = false;
  let statePublished = false;
  let semantic: Output["semantic"];
  const limitations = ["Change evidence is not a design-conformance assessment; previous uncommitted bytes are not retained.", "Offer deduplication remembers the last 128 offered sessions.", "omittedPaths is a lower bound across coalesced updates; omitted path identities are not retained."];
  const result = (status: Output["status"], offer: boolean, nextAction: string): Output => ({
    status, offer, limitations, nextAction,
    ...(state === undefined ? {} : { observation: { head: state.observation.head, evidenceIdentity: state.observation.evidenceIdentity } }),
    ...(state?.pending === undefined ? {} : { pending: state.pending }),
    ...(semantic === undefined ? {} : { semantic }),
  });
  try {
    checkpoint();
    paths = await RepositoryPathService.create(repositoryRoot);
    const safePaths = paths;
    lockTarget = (await paths.resolveWrite(lockPath)).realTarget;
    await mkdir(dirname(lockTarget), { recursive: true });
    lockTarget = (await paths.resolveWrite(lockPath)).realTarget;
    checkpoint();
    lock = await open(lockTarget, "wx", 0o600);
    await lock.writeFile(JSON.stringify({ processId: process.pid }));
    const readBounded = async (path: string, limit: number, reserve?: (bytes: number) => void): Promise<Buffer> => {
      checkpoint();
      const target = (await safePaths.resolveRead(path)).realTarget;
      const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const before = await handle.stat();
        if (!before.isFile()) throw new Error(`Repository check refuses nonregular file: ${path}`);
        if (before.size > limit) throw new Error(`Repository check byte bound exceeded: ${path}`);
        reserve?.(before.size);
        const bytes = Buffer.alloc(Math.min(before.size + 1, limit + 1));
        let offset = 0;
        while (offset < bytes.length) {
          checkpoint();
          const { bytesRead } = await handle.read(bytes, offset, Math.min(65536, bytes.length - offset), offset);
          if (bytesRead === 0) break;
          offset += bytesRead;
        }
        const after = await handle.stat();
        if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
          throw new Error(`Repository file changed during observation: ${path}`);
        }
        return bytes.subarray(0, offset);
      } finally { await handle.close(); }
    };
    try {
      state = stateSchema.parse(JSON.parse((await readBounded(cachePath, observationLimitValue(limits.maxDerivedBytes))).toString("utf8")));
      const { evidenceIdentity, ...basis } = state.observation;
      if (hashFramedDomain("repository-check-observation", basis) !== evidenceIdentity) throw new Error("Repository observation cache identity is invalid");
      if (state.pending !== undefined && (state.pending.evidenceIdentity !== evidenceIdentity || state.pending.toHead !== state.observation.head)) throw new Error("Pending finding is not bound to its cached observation");
      storedState = structuredClone(state);
    } catch (error) { if (!isCode(error, "ENOENT")) throw error; }
    codeStore = await SqliteCodeStore.open(safePaths.root);
    baselineMissing = state !== undefined && (state.semanticGeneration === undefined || !codeStore.hasGeneration(state.semanticGeneration));
    if (state?.semanticGeneration !== undefined && !baselineMissing)
      codeStore.pinRetained(state.semanticGeneration, semanticBaselineOwner);
    const git = async (args: string[]): Promise<string> => {
      checkpoint();
      const environment: NodeJS.ProcessEnv = {};
      for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "LANG", "LC_ALL"]) {
        if (process.env[key] !== undefined) environment[key] = process.env[key];
      }
      const running = gitExec("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
        cwd: safePaths.root, encoding: "utf8", timeout: Number.isFinite(deadline) ? Math.max(1, Math.floor(deadline - performance.now())) : 0,
        maxBuffer: maxGitBytes,
        env: { ...environment, GIT_OPTIONAL_LOCKS: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" },
        signal,
      });
      const accountOutput = (chunk: Buffer | string): void => {
        try {
          const bytes = Buffer.byteLength(chunk);
          gitBytes += bytes;
          if (gitBytes > maxGitBytes) throw new Error("Repository check exceeds the declared maxGitOutputBytes allowance");
          scope?.budget.consume("maxGitOutputBytes", bytes, "repository-check-git");
        } catch (error) { gitAbort.abort(error); }
      };
      running.child.stdout?.on("data", accountOutput);
      running.child.stderr?.on("data", accountOutput);
      let stdout: string;
      try { ({ stdout } = await running); }
      catch (error) { signal.throwIfAborted(); throw error; }
      checkpoint();
      return stdout;
    };
    const head = async (): Promise<string | null> => {
      // --verify alone cannot distinguish an unborn branch from a broken repository.
      const [topLevel, refs] = await Promise.all([
        git(["rev-parse", "--show-toplevel"]),
        git(["rev-parse", "--revs-only", "HEAD"]),
      ]);
      if (await realpath(topLevel.trim()) !== safePaths.root) throw new Error("Repository check root must be the Git checkout root");
      return headSchema.parse(refs.trim() || null);
    };
    const currentHead = await head();
    const previous = state?.observation;
    let status: Output["status"] = "unchanged";
    if (input.mode !== "commit-only" || input.handled !== undefined || previous === undefined || previous.head !== currentHead || baselineMissing) {
      const remainingMs = Number.isFinite(deadline) ? Math.max(1, Math.floor(deadline - performance.now())) : null;
      const phaseSignal = remainingMs === null ? signal : AbortSignal.any([signal, AbortSignal.timeout(remainingMs)]);
      const indexed = await withObservationScope({ signal: phaseSignal, limits: { timeoutMs: remainingMs } }, async scope => {
        const observation = await observeIndexedRepository(safePaths.root);
        try {
          const taskOptions = { ...scope, deadline: Math.min(scope.deadline, Number.isFinite(deadline) ? Date.now() + Math.max(0, Math.floor(deadline - performance.now())) : Infinity) };
          const indexedResult = await runObservationTask("code-operation", { repositoryRoot: safePaths.root, operation: "code.index", input: { provider: "native" }, descriptor: observation.descriptor }, taskOptions) as { generation: string };
          const generation = z.string().min(1).parse(indexedResult.generation);
          codeStore!.pinRetained(generation, semanticBaselineOwner);
          const prior = baselineMissing ? undefined : state?.semanticGeneration;
          const impact = prior === undefined ? undefined : CodeImpactResultSchema.parse(await runObservationTask("code-operation", { repositoryRoot: safePaths.root, operation: "code.impact", input: { before: prior, after: generation }, descriptor: observation.descriptor }, taskOptions));
          return { generation, impact };
        } finally { observation.close(); }
      });
      semantic = { generation: indexed.generation, affectedPaths: indexed.impact?.affectedPaths ?? [], possiblePaths: indexed.impact?.possiblePaths ?? [], unknowns: [...(baselineMissing ? ["Prior semantic baseline is unavailable; file-level semantic impact before this check is unknown"] : []), ...(indexed.impact?.unknowns ?? [])], truncated: indexed.impact?.truncated ?? false };
      const pathspec = ["--", ".", ":(exclude).projector/runtime", ":(exclude).projector/runtime/**"];
      const stagedDiff = () => git(["diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
      const enumerate = async () => {
        const [dirty, indexed, untracked] = await Promise.all([
          git(["diff", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]),
          git(["diff", "--cached", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]),
          git(["ls-files", "--others", "--exclude-standard", "-z", ...pathspec]),
        ]);
        return [...new Set(`${dirty}${indexed}${untracked}`.split("\0").filter((path) => path && included(path)))].sort();
      };
      const [staged, names] = await Promise.all([stagedDiff(), enumerate()]);
      if (names.length > maxPaths) throw new Error("Repository check exceeds the declared maxFiles allowance");
      const files: Observation["files"] = new Array(names.length);
      const stamps = new Map<string, string | null>();
      const stamp = async (path: string) => {
        try {
          const stat = await lstat((await safePaths.resolveRead(path)).realTarget);
          return canonicalJson({ size: stat.size, mode: stat.mode, mtime: stat.mtimeMs, ctime: stat.ctimeMs, inode: stat.ino });
        } catch (error) { if (isCode(error, "ENOENT")) return null; throw error; }
      };
      let total = 0;
      let reserved = 0;
      const reserveFileBytes = (bytes: number): void => {
        if (reserved + bytes > maxTotalBytes) throw new Error("Repository check exceeds the declared maxTotalBytes allowance");
        reserved += bytes;
      };
      let nextPath = 0;
      let failed = false;
      const inspectFiles = async (): Promise<void> => {
        while (!failed && nextPath < names.length) {
          const index = nextPath++;
          try {
            const path = pathSchema.parse(names[index]);
            let identity: z.infer<typeof ContentHashSchema>;
            const beforeStamp = await stamp(path);
            try {
              const content = await readBounded(path, Math.min(maxFileBytes, maxTotalBytes), reserveFileBytes);
              total += content.length;
              if (total > maxTotalBytes) throw new Error("Repository check exceeds the declared maxTotalBytes allowance");
              const mode = (await lstat((await safePaths.resolveRead(path)).realTarget)).mode;
              identity = hashFramedDomain("repository-check-file", content.toString("base64"), mode);
            } catch (error) {
              if (!isCode(error, "ENOENT")) throw error;
              identity = hashFramedDomain("repository-check-deleted", path);
            }
            files[index] = { path, identity };
            if (beforeStamp !== await stamp(path)) throw new Error(`Repository file changed during observation: ${path}`);
            stamps.set(path, beforeStamp);
          } catch (error) {
            failed = true;
            throw error;
          }
        }
      };
      const inspected = await Promise.allSettled(Array.from({ length: Math.min(4, names.length) }, inspectFiles));
      const inspectionFailure = inspected.find((item): item is PromiseRejectedResult => item.status === "rejected");
      if (inspectionFailure !== undefined) throw inspectionFailure.reason;
      const [finalHead, finalNames, finalStaged] = await Promise.all([head(), enumerate(), stagedDiff()]);
      if (currentHead !== finalHead || canonicalJson(names) !== canonicalJson(finalNames) || staged !== finalStaged) {
        throw new Error("Repository changed during observation; retry a full check");
      }
      for (const [path, observedStamp] of stamps) {
        checkpoint();
        if (await stamp(path) !== observedStamp) throw new Error(`Repository file changed during observation: ${path}`);
      }
      const basis = { head: currentHead, stagedIdentity: hashFramedDomain("repository-check-index", staged), files };
      const observation: Observation = { ...basis, evidenceIdentity: hashFramedDomain("repository-check-observation", basis) };
      status = previous === undefined ? "no previous observation" : previous.evidenceIdentity === observation.evidenceIdentity ? "unchanged" : "changed";
      if (status !== "unchanged") {
        const changedPaths = new Set(state?.pending?.paths ?? []);
        const beforeFiles = new Map(previous?.files.map((entry) => [entry.path, entry.identity]));
        const afterFiles = new Map(files.map((entry) => [entry.path, entry.identity]));
        for (const path of new Set([...beforeFiles.keys(), ...afterFiles.keys()])) {
          if (beforeFiles.get(path) !== afterFiles.get(path) || previous?.stagedIdentity !== observation.stagedIdentity) changedPaths.add(path);
        }
        if (previous?.head !== null && previous?.head !== undefined && currentHead !== null && previous.head !== currentHead) {
          for (const path of (await git(["diff", "--name-only", "--no-renames", "--no-ext-diff", "-z", previous.head, currentHead, ...pathspec])).split("\0").filter(Boolean)) changedPaths.add(pathSchema.parse(path));
        }
        const sorted = [...changedPaths].sort();
        state = {
          version: 1, observation, semanticGeneration: indexed.generation, offeredSessions: state?.pending === undefined ? [] : state.offeredSessions,
          pending: {
            findingId: state?.pending?.findingId ?? `repository_finding_${observation.evidenceIdentity.slice(-32)}`,
            evidenceIdentity: observation.evidenceIdentity,
            fromHead: state?.pending === undefined ? previous?.head ?? null : state.pending.fromHead,
            toHead: currentHead,
            baselineEvidenceIdentity: state?.pending === undefined ? previous?.evidenceIdentity ?? null : state.pending.baselineEvidenceIdentity,
            paths: sorted.slice(0, 100), omittedPaths: Math.max(state?.pending?.omittedPaths ?? 0, sorted.length - 100, 0),
          },
        };
      }
      if (status === "unchanged" && state !== undefined && state.semanticGeneration !== indexed.generation) state.semanticGeneration = indexed.generation;
      if (baselineMissing && status === "unchanged") status = "incomplete";
    } else limitations.push("Commit-only check skipped staged and working-tree observation because HEAD is unchanged.");
    if (state === undefined) throw new Error("Repository check did not establish an observation");
    if (input.handled !== undefined) {
      if (state.pending?.findingId !== input.handled.findingId || state.pending.evidenceIdentity !== input.handled.evidenceIdentity) {
        limitations.push("Handled evidence does not match the current pending finding; the finding remains open.");
        status = "incomplete";
      } else {
        const { pending: _pending, ...retained } = state;
        state = retained;
      }
    }
    const session = input.sessionId === undefined ? undefined : hashFramedDomain("repository-check-session", input.sessionId);
    const offer = state.pending !== undefined && (session === undefined || !state.offeredSessions.includes(session));
    if (offer && session !== undefined) state.offeredSessions = [...state.offeredSessions, session].slice(-128);
    checkpoint();
    const nextAction = state.pending === undefined ? "No pending investigation. Handling does not approve design." : "Investigate the pending finding against its HEAD anchors and current diff; mark handled only with its exact findingId and evidenceIdentity after investigation.";
    if (storedState !== undefined && canonicalJson(storedState) === canonicalJson(state)) {
      codeStore.reconcileRetainedOwner(state.semanticGeneration!, semanticBaselineOwner);
      return result(status, offer, nextAction);
    }
    const destination = (await safePaths.resolveWrite(cachePath)).realTarget;
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    const temporary = (await safePaths.resolveWrite(temporaryPath)).realTarget;
    const serialized = canonicalJson(stateSchema.parse(state));
    if (Buffer.byteLength(serialized) > observationLimitValue(limits.maxDerivedBytes)) throw new Error("Repository check state exceeds the declared maxDerivedBytes allowance");
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
    try { checkpoint(); await rename(temporary, destination); statePublished = true; } finally { await rm(temporary, { force: true }); }
    codeStore.reconcileRetainedOwner(state.semanticGeneration!, semanticBaselineOwner);
    return result(status, offer, nextAction);
  } catch (error) {
    if (!statePublished) state = storedState;
    limitations.push(error instanceof Error ? error.message.slice(0, 2048) : String(error).slice(0, 2048));
    return result("incomplete", false, isCode(error, "EEXIST") ? "A repository check lock or temporary file exists. Retry; for an interrupted owner, verify that its process has stopped before removing only its runtime lock or temporary file." : statePublished ? "The new observation is durable, but semantic pin cleanup failed. Retry a full repository.check; do not infer conformance." : "Preserved prior observation and pending finding. Address the reported limitation and retry a full repository.check; do not infer conformance.");
  } finally {
    codeStore?.close();
    if (lock !== undefined) {
      await lock.close();
      if (lockTarget !== undefined) await rm(lockTarget, { force: true });
    }
  }
}
