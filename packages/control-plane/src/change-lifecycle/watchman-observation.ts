import { spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { ObservationBudget, ObservationError, hashFramedDomain, observationLimitValue } from "@projector/core";
import type { InventoryByteReuse, InventoryResult } from "@projector/analyzers";
import { observationGit } from "@projector/analyzers";

interface WatchmanHost { readonly executable: string; readonly socket: string; }
export interface WatchmanBaseline {
  readonly host: WatchmanHost; readonly root: string; readonly clock: string;
  readonly configIdentity: string; readonly uncoveredPrefixes: readonly string[];
}
type Reply = Record<string, unknown>;
export type WatchmanByteReuseResult =
  | { readonly kind: "reuse"; readonly reuse: InventoryByteReuse }
  | { readonly kind: "rediscovery"; readonly reason: "no-baseline" | "host-changed" | "configuration-changed" | "watch-warning" | "fresh-instance" };
const proofs = new WeakMap<InventoryByteReuse, { baseline: WatchmanBaseline; clock: string; gitBoundary: boolean }>();
function failure(message: string): ObservationError {
  return new ObservationError("observation-failed", "watchman-observation", ".", message);
}
function configuredHost(): WatchmanHost | undefined {
  const executable = process.env.PROJECTOR_WATCHMAN_EXECUTABLE, socket = process.env.PROJECTOR_WATCHMAN_SOCKET;
  if (executable === undefined && socket === undefined) return undefined;
  if (!executable || !socket || !isAbsolute(executable)) throw failure("Set both PROJECTOR_WATCHMAN_EXECUTABLE (absolute executable path) and PROJECTOR_WATCHMAN_SOCKET for an existing Watchman daemon, or unset both.");
  // Watchman's macOS FSEvents backend cannot guarantee cookie ordering under
  // load (https://facebook.github.io/watchman/docs/cookies). Use complete byte
  // observation there until a backend with a reliable barrier is identified.
  if (process.platform === "darwin") return undefined;
  return { executable, socket };
}
class WatchmanSynchronizationTimeout extends Error {}
export class WatchmanSynchronizationUnavailableError extends ObservationError {
  constructor(message: string) { super("observation-failed", "watchman-observation", ".", `Watchman synchronization is unavailable; complete source observation is required: ${message}`); }
}

/** A cookie timeout is a retryable attempt failure, not a repository deadline.
 * Keep synchronization enabled: sync_timeout=0 would permit stale deltas. */
async function command(host: WatchmanHost, request: readonly unknown[], budget: ObservationBudget, signal: AbortSignal): Promise<Reply> {
  let attemptRequest = request;
  for (let attempt = 1; ; attempt++) {
    budget.check("watchman-observation"); signal.throwIfAborted();
    try { return await commandAttempt(host, attemptRequest, budget, signal); }
    catch (error) {
      if (!(error instanceof WatchmanSynchronizationTimeout)) throw error;
      budget.check("watchman-observation"); signal.throwIfAborted();
      if (attempt === 3) {
        console.warn(JSON.stringify({ event: "watchman-synchronization-unavailable", root: request[1], command: request[0], attempt, error: error.message }));
        throw new WatchmanSynchronizationUnavailableError(error.message);
      }
      const options = attemptRequest[2];
      if (options === null || typeof options !== "object" || !("sync_timeout" in options) || typeof options.sync_timeout !== "number") throw error;
      // This is an attempt wait, not an operation deadline. If synchronization
      // remains unavailable, the observer must establish freshness by full scan.
      const syncTimeout = Math.max(1, Math.min(options.sync_timeout * 2, 2_147_483_647, Math.ceil(budget.remainingMs())));
      console.warn(JSON.stringify({ event: "watchman-synchronization-retry", root: request[1], command: request[0], attempt, syncTimeoutMs: syncTimeout, error: error.message }));
      attemptRequest = [request[0], request[1], { ...options, sync_timeout: syncTimeout }];
    }
  }
}
/** Only an owned client is started. --no-spawn and --no-local forbid daemon creation and local fallback. */
async function commandAttempt(host: WatchmanHost, request: readonly unknown[], budget: ObservationBudget, signal: AbortSignal): Promise<Reply> {
  budget.check("watchman-observation"); signal.throwIfAborted();
  return new Promise((accept, reject) => {
    const child = spawn(host.executable, ["--no-spawn", "--no-local", "--sockname", host.socket, "-j"], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [], errors: Buffer[] = []; let size = 0, error: Error | undefined;
    const stop = (reason: Error): void => { error ??= reason; child.kill(); };
    const abort = (): void => stop(failure("Watchman observation cancelled."));
    signal.addEventListener("abort", abort, { once: true });
    const remainingMs = budget.remainingMs();
    const timer = Number.isFinite(remainingMs)
      ? setTimeout(() => stop(failure("Watchman client exceeded the declared observation deadline.")), remainingMs)
      : undefined;
    const receive = (chunk: Buffer, target: Buffer[]): void => {
      if (error !== undefined) return;
      try {
        budget.check("watchman-observation"); size += chunk.length;
        if (size > observationLimitValue(budget.limits.maxGitOutputBytes)) throw failure("Watchman response exceeds the declared maxGitOutputBytes limit.");
        budget.consume("maxGitOutputBytes", chunk.length, "watchman-observation");
        target.push(chunk);
      } catch (cause) { stop(cause instanceof Error ? cause : failure(String(cause))); }
    };
    child.stdout.on("data", (chunk: Buffer) => receive(chunk, chunks));
    child.stderr.on("data", (chunk: Buffer) => receive(chunk, errors));
    child.on("error", (cause) => { error ??= failure(`Cannot run configured Watchman client: ${cause.message}`); });
    child.stdin.on("error", (cause) => stop(failure(`Cannot send Watchman request: ${cause.message}`)));
    child.on("close", (code) => {
      if (timer !== undefined) clearTimeout(timer); signal.removeEventListener("abort", abort);
      if (error !== undefined) { reject(error); return; }
      try {
        budget.check("watchman-observation"); signal.throwIfAborted();
        const output = Buffer.concat(chunks).toString("utf8");
        if (code !== 0 && !output.trim()) throw failure(`Configured Watchman client failed (${code}): ${Buffer.concat(errors).toString("utf8").slice(0, 1024)}`);
        const reply: unknown = JSON.parse(output);
        if (reply === null || typeof reply !== "object" || Array.isArray(reply)) throw failure("Watchman returned an invalid object response.");
        if ("error" in reply) {
          const message = String(reply.error);
          if (/syncToNow: timed out waiting for cookie file to be observed by watcher within \d+ milliseconds/u.test(message)) throw new WatchmanSynchronizationTimeout(message);
          throw failure(`Watchman observation failed: ${message}`);
        }
        if (code !== 0) throw failure(`Configured Watchman client failed (${code}): ${Buffer.concat(errors).toString("utf8").slice(0, 1024)}`);
        accept(reply as Reply);
      } catch (cause) { reject(cause instanceof ObservationError || cause instanceof WatchmanSynchronizationTimeout ? cause : failure(`Invalid Watchman response: ${String(cause)}`)); }
    });
    child.stdin.end(`${JSON.stringify(request)}\n`);
    if (signal.aborted) abort();
  });
}
function prefixes(config: Reply): string[] {
  const result: string[] = [];
  for (const key of ["ignore_dirs", "ignore_vcs"] as const) {
    const value = config[key] === undefined ? (key === "ignore_vcs" ? [".git", ".hg", ".svn", ".jj"] : []) : config[key];
    if (!Array.isArray(value)) throw failure(`Watchman ${key} must be a path array before byte reuse is safe.`);
    for (const path of value) {
      if (typeof path !== "string" || !path || isAbsolute(path) || /^[a-z]:/iu.test(path) || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === "..")) throw failure(`Watchman ${key} contains an unsupported path; byte coverage is unknown.`);
      result.push(path);
    }
  }
  return result;
}
async function configuration(host: WatchmanHost, root: string, budget: ObservationBudget, signal: AbortSignal): Promise<{ identity: string; uncovered: string[]; warning: boolean }> {
  const reply = await command(host, ["get-config", root], budget, signal);
  if (reply.config === null || typeof reply.config !== "object" || Array.isArray(reply.config)) throw failure("Watchman get-config did not provide effective watch configuration.");
  const config = reply.config as Reply;
  return { identity: hashFramedDomain("watchman-byte-coverage-v1", config), uncovered: prefixes(config), warning: reply.warning !== undefined };
}
/** The synchronized clock precedes cold reads. It is never advanced beyond unread enrollment events. */
export async function enrollWatchman(repositoryRoot: string, budget: ObservationBudget, signal: AbortSignal): Promise<WatchmanBaseline | undefined> {
  const host = configuredHost(); if (host === undefined) return undefined;
  const root = resolve(repositoryRoot), watch = await command(host, ["watch", root], budget, signal);
  if (typeof watch.watch !== "string" || resolve(watch.watch) !== root || watch.relative_path !== undefined) throw failure("Watchman must bind the exact repository root for byte reuse.");
  const config = await configuration(host, root, budget, signal);
  if (watch.warning !== undefined || config.warning) return undefined;
  let reply: Reply;
  try { reply = await command(host, ["clock", root, { sync_timeout: 5_000 }], budget, signal); }
  catch (error) { if (error instanceof WatchmanSynchronizationUnavailableError) return undefined; throw error; }
  if (typeof reply.clock !== "string" || !reply.clock) throw failure("Watchman did not return an enrollment clock.");
  if (reply.warning !== undefined) return undefined;
  return { host, root, clock: reply.clock, configIdentity: config.identity, uncoveredPrefixes: config.uncovered };
}
export interface WatchmanDeltaEvent { readonly path:string; readonly exists:boolean; readonly type:string }
function delta(reply: Reply, budget: ObservationBudget): { clock: string; paths: string[]; events:WatchmanDeltaEvent[] } {
  if (reply.is_fresh_instance !== false || typeof reply.clock !== "string" || !reply.clock || !Array.isArray(reply.files)) throw failure("Watchman delta lacks a complete non-fresh clock and file population.");
  if (reply.files.length > observationLimitValue(budget.limits.maxFiles) + observationLimitValue(budget.limits.maxDirectories)) throw failure("Watchman delta exceeds the declared file and directory population.");
  const paths: string[] = [], events:WatchmanDeltaEvent[]=[];
  for (const file of reply.files) {
    if (file === null || typeof file !== "object" || typeof file.name !== "string" || typeof file.exists !== "boolean" || typeof file.type !== "string") throw failure("Watchman returned an invalid file delta.");
    const path = file.name as string;
    if (!path || isAbsolute(path) || /^[a-z]:/iu.test(path) || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === "..")) throw failure("Watchman delta contains a path outside the exact watch root.");
    paths.push(path);
    events.push({path,exists:file.exists,type:file.type});
  }
  return { clock: reply.clock, paths,events };
}
export type WatchmanChanges = { readonly kind:"delta"; readonly baseline:WatchmanBaseline; readonly events:readonly WatchmanDeltaEvent[] } | Exclude<WatchmanByteReuseResult,{kind:"reuse"}>;
/** Effective Git rules apply to ambient untracked source events. Tracked paths
 * remain selected by check-ignore's normal index semantics. Explicit canonical
 * authority and ignore/config control inputs remain currentness dependencies. */
export async function filterSourceWatchmanEvents(root:string,events:readonly WatchmanDeltaEvent[],budget:ObservationBudget,signal:AbortSignal):Promise<readonly WatchmanDeltaEvent[]>{
  const candidates=[...new Set(events.map(({path})=>path).filter(path=>!path.startsWith(".projector/")&&!/(?:^|\/)(?:\.gitignore|\.gitattributes|\.watchmanconfig)$/u.test(path)))];
  if(candidates.length===0)return events;
  const output=await observationGit(root,["check-ignore","-z","--stdin"],budget,{signal,input:candidates.map(path=>`${path}\0`).join(""),allowedExitCodes:[1],stage:"watchman-effective-ignore"});
  const ignored=new Set(output.split("\0").filter(Boolean));
  // A directory itself can be ignored while containing force-added tracked
  // files. Its removal/replacement remains a tracked-source boundary event.
  const directories=[...new Set(events.filter(event=>event.type==="d"&&ignored.has(event.path)).map(event=>event.path))];
  if(directories.length>0){
    const tracked=(await observationGit(root,["ls-files","--cached","-z","--",...directories.map(path=>`:(top,literal)${path}/`)],budget,{signal,stage:"watchman-tracked-directory-boundary"})).split("\0").filter(Boolean);
    for(const directory of directories)if(tracked.some(path=>path.startsWith(`${directory}/`)))ignored.delete(directory);
  }
  return events.filter(({path})=>!ignored.has(path));
}
/** A synchronized complete delta advances only a staged cursor, never its input baseline. */
export async function observeWatchmanChanges(baseline:WatchmanBaseline|undefined,budget:ObservationBudget,signal:AbortSignal):Promise<WatchmanChanges>{
  if(baseline===undefined){configuredHost();return{kind:"rediscovery",reason:"no-baseline"};}
  const host=configuredHost();if(host===undefined||host.executable!==baseline.host.executable||host.socket!==baseline.host.socket)return{kind:"rediscovery",reason:"host-changed"};
  const config=await configuration(host,baseline.root,budget,signal);
  if(config.warning)return{kind:"rediscovery",reason:"watch-warning"};
  if(config.identity!==baseline.configIdentity)return{kind:"rediscovery",reason:"configuration-changed"};
  const reply=await command(host,["query",baseline.root,{since:baseline.clock,fields:["name","exists","type"],sync_timeout:5000}],budget,signal);
  if(reply.warning!==undefined)return{kind:"rediscovery",reason:"watch-warning"};
  if(reply.is_fresh_instance===true)return{kind:"rediscovery",reason:"fresh-instance"};
  const result=delta(reply,budget);return{kind:"delta",baseline:{...baseline,clock:result.clock},events:result.events};
}
export async function verifyWatchmanChanges(baseline:WatchmanBaseline,budget:ObservationBudget,signal:AbortSignal,excludedPrefixes:readonly string[]=[],sourceGitBoundary=false):Promise<WatchmanBaseline>{
  const result=await observeWatchmanChanges(baseline,budget,signal);
  if(result.kind!=="delta")throw failure(`Watchman currentness became unknown (${result.reason}); rebuild observation. The prior completed baseline remains unchanged.`);
  const events=result.events.filter(({path})=>!excludedPrefixes.some(prefix=>path===prefix||path.startsWith(`${prefix}/`)));
  const selected=sourceGitBoundary?await filterSourceWatchmanEvents(baseline.root,events,budget,signal):events;
  const changed=selected[0];
  if(changed!==undefined)throw failure(`Repository changed during indexed observation (${changed.path}); retry observation. The prior completed baseline remains unchanged.`);
  return result.baseline;
}
export async function watchmanByteReuse(baseline: WatchmanBaseline | undefined, inventory: InventoryResult, budget: ObservationBudget, signal: AbortSignal): Promise<WatchmanByteReuseResult> {
  if (baseline === undefined) { configuredHost(); return { kind: "rediscovery", reason: "no-baseline" }; }
  const host = configuredHost();
  if (host === undefined || host.executable !== baseline.host.executable || host.socket !== baseline.host.socket) return { kind: "rediscovery", reason: "host-changed" };
  const config = await configuration(host, baseline.root, budget, signal);
  if (config.warning) return { kind: "rediscovery", reason: "watch-warning" };
  if (config.identity !== baseline.configIdentity) return { kind: "rediscovery", reason: "configuration-changed" };
  const reply = await command(host, ["query", baseline.root, { since: baseline.clock, fields: ["name", "exists", "type"], sync_timeout: 5_000 }], budget, signal);
  if (reply.warning !== undefined) return { kind: "rediscovery", reason: "watch-warning" };
  if (reply.is_fresh_instance === true) return { kind: "rediscovery", reason: "fresh-instance" };
  const result = delta(reply, budget);
  const gitBoundary=inventory.enumeration.method==="git-index-and-nonignored-untracked";
  const events=gitBoundary?await filterSourceWatchmanEvents(baseline.root,result.events,budget,signal):result.events;
  const reuse: InventoryByteReuse = { baseline: inventory, changedPaths: events.map(({path})=>path), uncoveredPrefixes: baseline.uncoveredPrefixes };
  proofs.set(reuse, { baseline, clock: result.clock,gitBoundary });
  return { kind: "reuse", reuse };
}

/** Bracket warm collection without advancing the retained original generation. */
export async function validateWatchmanByteReuse(reuse: InventoryByteReuse, budget: ObservationBudget, signal: AbortSignal): Promise<void> {
  const proof = proofs.get(reuse);
  if (proof === undefined) throw failure("Watchman byte reuse lacks a private currentness proof.");
  const host = configuredHost(), { baseline } = proof;
  if (host === undefined || host.executable !== baseline.host.executable || host.socket !== baseline.host.socket) throw failure("Watchman host changed during observation; retry with a fresh observation.");
  const config = await configuration(host, baseline.root, budget, signal);
  if (config.warning || config.identity !== baseline.configIdentity) throw failure("Watchman coverage changed during observation; retry with a fresh observation.");
  const reply = await command(host, ["query", baseline.root, { since: proof.clock, fields: ["name", "exists", "type"], sync_timeout: 5_000 }], budget, signal);
  if (reply.warning !== undefined || reply.is_fresh_instance === true) throw failure("Watchman lost currentness during observation; retry with a fresh observation.");
  const result = delta(reply, budget);
  const events=result.events.filter(({path})=>![".git", ".worktrees", ".projector/runtime"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)));
  const selected=proof.gitBoundary?await filterSourceWatchmanEvents(baseline.root,events,budget,signal):events;
  const changed = selected[0]?.path;
  if (changed !== undefined) throw failure(`Repository changed during byte reuse (${changed}); retry observation. The prior baseline remains unchanged.`);
}
