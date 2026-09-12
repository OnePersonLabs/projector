import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

import { ContentHashSchema, ProjectorOperationInputSchemas, canonicalJson, hashFramedDomain } from "@projector/core";
import { RepositoryPathService } from "@projector/runtime";
import { z } from "zod";

const gitExec = promisify(execFile);
const cachePath = ".projector/runtime/repository-check/state.json";
const lockPath = ".projector/runtime/repository-check/check.lock";
const pathSchema = z.string().min(1).max(4096);
const headSchema = z.string().regex(/^[a-f0-9]{40,64}$/u).nullable();
const observationSchema = z.strictObject({
  head: headSchema,
  evidenceIdentity: ContentHashSchema,
  stagedIdentity: ContentHashSchema,
  files: z.array(z.strictObject({ path: pathSchema, identity: ContentHashSchema })).max(10_000),
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
});
const stateSchema = z.strictObject({
  version: z.literal(1), observation: observationSchema, pending: pendingSchema.optional(),
  offeredSessions: z.array(ContentHashSchema).max(128),
});
type State = z.infer<typeof stateSchema>;
type Observation = z.infer<typeof observationSchema>;
type Output = z.infer<typeof RepositoryCheckOutputSchema>;
type Input = z.infer<(typeof ProjectorOperationInputSchemas)["repository.check"]>;

/** Operational bounds are service options, not caller-controlled operation inputs. */
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
  const deadline = performance.now() + (options.maxMilliseconds ?? 5000);
  const checkpoint = () => {
    options.signal?.throwIfAborted();
    if (performance.now() >= deadline) throw new Error("Repository check elapsed-time bound exceeded");
  };
  let paths: RepositoryPathService | undefined;
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  let lockTarget: string | undefined;
  let state: State | undefined;
  let storedState: State | undefined;
  const limitations = ["Change evidence is not a design-conformance assessment; previous uncommitted bytes are not retained.", "Offer deduplication remembers the last 128 offered sessions.", "omittedPaths is a lower bound across coalesced updates; omitted path identities are not retained."];
  const result = (status: Output["status"], offer: boolean, nextAction: string): Output => ({
    status, offer, limitations, nextAction,
    ...(state === undefined ? {} : { observation: { head: state.observation.head, evidenceIdentity: state.observation.evidenceIdentity } }),
    ...(state?.pending === undefined ? {} : { pending: state.pending }),
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
    const readBounded = async (path: string, limit: number): Promise<Buffer> => {
      checkpoint();
      const target = (await safePaths.resolveRead(path)).realTarget;
      const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const before = await handle.stat();
        if (!before.isFile()) throw new Error(`Repository check refuses nonregular file: ${path}`);
        if (before.size > limit) throw new Error(`Repository check byte bound exceeded: ${path}`);
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
      state = stateSchema.parse(JSON.parse((await readBounded(cachePath, 4 * 1024 * 1024)).toString("utf8")));
      const { evidenceIdentity, ...basis } = state.observation;
      if (hashFramedDomain("repository-check-observation", basis) !== evidenceIdentity) throw new Error("Repository observation cache identity is invalid");
      if (state.pending !== undefined && (state.pending.evidenceIdentity !== evidenceIdentity || state.pending.toHead !== state.observation.head)) throw new Error("Pending finding is not bound to its cached observation");
      storedState = structuredClone(state);
    } catch (error) { if (!isCode(error, "ENOENT")) throw error; }
    const git = async (args: string[]): Promise<string> => {
      checkpoint();
      const environment: NodeJS.ProcessEnv = {};
      for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "LANG", "LC_ALL"]) {
        if (process.env[key] !== undefined) environment[key] = process.env[key];
      }
      const { stdout } = await gitExec("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
        cwd: safePaths.root, encoding: "utf8", timeout: Math.max(1, Math.floor(deadline - performance.now())),
        maxBuffer: options.maxGitBytes ?? 1024 * 1024,
        env: { ...environment, GIT_OPTIONAL_LOCKS: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" },
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
      checkpoint();
      return stdout;
    };
    const head = async (): Promise<string | null> => {
      // --verify alone cannot distinguish an unborn branch from a broken repository.
      if (await realpath((await git(["rev-parse", "--show-toplevel"])).trim()) !== safePaths.root) throw new Error("Repository check root must be the Git checkout root");
      const refs = await git(["rev-parse", "--revs-only", "HEAD"]);
      return headSchema.parse(refs.trim() || null);
    };
    const currentHead = await head();
    const previous = state?.observation;
    let status: Output["status"] = "unchanged";
    if (input.mode !== "commit-only" || input.handled !== undefined || previous === undefined || previous.head !== currentHead) {
      const pathspec = ["--", ".", ":(exclude).projector/runtime", ":(exclude).projector/runtime/**"];
      const staged = await git(["diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
      const enumerate = async () => {
        const dirty = await git(["diff", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
        const indexed = await git(["diff", "--cached", "--name-only", "--no-renames", "--no-ext-diff", "-z", ...pathspec]);
        const untracked = await git(["ls-files", "--others", "--exclude-standard", "-z", ...pathspec]);
        return [...new Set(`${dirty}${indexed}${untracked}`.split("\0").filter((path) => path && included(path)))].sort();
      };
      const names = await enumerate();
      if (names.length > Math.min(options.maxPaths ?? 10_000, 10_000)) throw new Error("Repository check path bound exceeded");
      const files: Observation["files"] = [];
      const stamps = new Map<string, string | null>();
      const stamp = async (path: string) => {
        try {
          const stat = await lstat((await safePaths.resolveRead(path)).realTarget);
          return canonicalJson({ size: stat.size, mode: stat.mode, mtime: stat.mtimeMs, ctime: stat.ctimeMs, inode: stat.ino });
        } catch (error) { if (isCode(error, "ENOENT")) return null; throw error; }
      };
      let total = 0;
      for (const path of names) {
        pathSchema.parse(path);
        let identity: z.infer<typeof ContentHashSchema>;
        const beforeStamp = await stamp(path);
        try {
          const content = await readBounded(path, Math.min(options.maxFileBytes ?? 8 * 1024 * 1024, (options.maxTotalBytes ?? 32 * 1024 * 1024) - total));
          total += content.length;
          const mode = (await lstat((await safePaths.resolveRead(path)).realTarget)).mode;
          identity = hashFramedDomain("repository-check-file", content.toString("base64"), mode);
        } catch (error) {
          if (!isCode(error, "ENOENT")) throw error;
          identity = hashFramedDomain("repository-check-deleted", path);
        }
        files.push({ path, identity });
        if (beforeStamp !== await stamp(path)) throw new Error(`Repository file changed during observation: ${path}`);
        stamps.set(path, beforeStamp);
      }
      if (currentHead !== await head() || canonicalJson(names) !== canonicalJson(await enumerate()) || staged !== await git(["diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "--no-ext-diff", "-z", ...pathspec])) {
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
          version: 1, observation, offeredSessions: state?.pending === undefined ? [] : state.offeredSessions,
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
    if (storedState !== undefined && canonicalJson(storedState) === canonicalJson(state)) return result(status, offer, nextAction);
    const destination = (await safePaths.resolveWrite(cachePath)).realTarget;
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    const temporary = (await safePaths.resolveWrite(temporaryPath)).realTarget;
    const serialized = canonicalJson(stateSchema.parse(state));
    if (Buffer.byteLength(serialized) > 4 * 1024 * 1024) throw new Error("Repository observation cache byte bound exceeded");
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
    try { checkpoint(); await rename(temporary, destination); } finally { await rm(temporary, { force: true }); }
    return result(status, offer, nextAction);
  } catch (error) {
    state = storedState;
    limitations.push(error instanceof Error ? error.message.slice(0, 2048) : String(error).slice(0, 2048));
    return result("incomplete", false, isCode(error, "EEXIST") ? "A repository check lock or temporary file exists. Retry; for an interrupted owner, verify that its process has stopped before removing only its runtime lock or temporary file." : "Preserved prior observation and pending finding. Address the reported limitation and retry a full repository.check; do not infer conformance.");
  } finally {
    if (lock !== undefined) {
      await lock.close();
      if (lockTarget !== undefined) await rm(lockTarget, { force: true });
    }
  }
}
