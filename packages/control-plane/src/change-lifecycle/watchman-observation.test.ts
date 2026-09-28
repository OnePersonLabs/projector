import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ObservationBudget } from "@projector/core";
import type { InventoryResult } from "@projector/analyzers";

const protocol = vi.hoisted(() => ({ replies: [] as unknown[], requests: [] as unknown[][], args: [] as string[][] }));
vi.mock("node:child_process", () => ({
  spawn: (_executable: string, args: string[]) => {
    protocol.args.push(args);
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; stdin: Writable; kill: () => void };
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { queueMicrotask(() => child.emit("close", null)); };
    child.stdin = new Writable({ write(chunk, _encoding, callback) {
      protocol.requests.push(JSON.parse(String(chunk)) as unknown[]); callback();
      const reply = protocol.replies.shift();
      queueMicrotask(() => { child.stdout.write(JSON.stringify(reply)); child.emit("close", 0); });
    } });
    return child;
  },
}));
import { enrollWatchman, watchmanByteReuse, validateWatchmanByteReuse } from "./watchman-observation.js";
const root = resolve("watchman-test-root");
const inventory = {enumeration:{method:"recursive-filesystem-fallback",assumptions:[],blindSpots:[]}} as unknown as InventoryResult;
const signal = new AbortController().signal;
beforeEach(() => {
  protocol.replies.length = 0; protocol.requests.length = 0; protocol.args.length = 0;
  vi.stubEnv("PROJECTOR_WATCHMAN_EXECUTABLE", process.execPath); vi.stubEnv("PROJECTOR_WATCHMAN_SOCKET", "fixture-socket");
});
afterEach(() => vi.unstubAllEnvs());
function enrollment(config: unknown = {}): void { protocol.replies.push({ watch: root }, { config }, { clock: "c:baseline" }); }

it("enrolls before reads and retains the original cursor with deleted and directory events", async () => {
  enrollment(); const budget = new ObservationBudget();
  const baseline = await enrollWatchman(root, budget, signal);
  protocol.replies.push({ config: {} }, { clock: "c:later", is_fresh_instance: false, files: [
    { name: "deleted.ts", exists: false, type: "f" }, { name: "directory", exists: true, type: "d" },
  ] });
  const reuse = await watchmanByteReuse(baseline, inventory, budget, signal);
  expect(reuse).toEqual({ kind: "reuse", reuse: { baseline: inventory, changedPaths: ["deleted.ts", "directory"], uncoveredPrefixes: [".git", ".hg", ".svn", ".jj"] } });
  expect(baseline!.clock).toBe("c:baseline");
  expect(protocol.requests[2]).toEqual(["clock", root, { sync_timeout: 5000 }]);
  expect(protocol.requests[4]).toEqual(["query", root, { since: "c:baseline", fields: ["name", "exists", "type"], sync_timeout: 5000 }]);
  expect(protocol.args.every((args) => args.includes("--no-spawn") && args.includes("--no-local"))).toBe(true);
  protocol.replies.push({ config: {} }, { clock: "c:end", is_fresh_instance: false, files: [{ name: ".git", exists: true, type: "d" }] });
  if (reuse.kind !== "reuse") throw new Error("Expected reuse proof");
  await validateWatchmanByteReuse(reuse.reuse, budget, signal);
  expect(protocol.requests[6]).toEqual(["query", root, { since: "c:later", fields: ["name", "exists", "type"], sync_timeout: 5000 }]);
});

it("rediscovery follows a fresh cursor, warnings, changed configuration or host", async () => {
  enrollment(); const baseline = await enrollWatchman(root, new ObservationBudget(), signal);
  for (const query of [{ clock: "c:new", is_fresh_instance: true, files: [] }, { warning: "recrawl" }]) {
    protocol.replies.push({ config: {} }, query);
    expect(await watchmanByteReuse(baseline, inventory, new ObservationBudget(), signal)).toMatchObject({ kind: "rediscovery" });
  }
  protocol.replies.push({ config: { ignore_dirs: ["hidden"] } });
  expect(await watchmanByteReuse(baseline, inventory, new ObservationBudget(), signal)).toEqual({ kind: "rediscovery", reason: "configuration-changed" });
  vi.stubEnv("PROJECTOR_WATCHMAN_SOCKET", "different");
  expect(await watchmanByteReuse(baseline, inventory, new ObservationBudget(), signal)).toEqual({ kind: "rediscovery", reason: "host-changed" });
});

it("fails actionable on partial configuration, wrong root, malformed coverage or unknown delta", async () => {
  vi.stubEnv("PROJECTOR_WATCHMAN_SOCKET", undefined);
  await expect(enrollWatchman(root, new ObservationBudget(), signal)).rejects.toThrow("Set both");
  vi.stubEnv("PROJECTOR_WATCHMAN_SOCKET", "fixture-socket");
  protocol.replies.push({ watch: resolve("another-root") });
  await expect(enrollWatchman(root, new ObservationBudget(), signal)).rejects.toThrow("exact repository root");
  enrollment({ ignore_dirs: ["../outside"] });
  await expect(enrollWatchman(root, new ObservationBudget(), signal)).rejects.toThrow("coverage is unknown");
  protocol.replies.length = 0;
  enrollment(); const baseline = await enrollWatchman(root, new ObservationBudget(), signal);
  protocol.replies.push({ config: {} }, { clock: "c:new", files: [] });
  await expect(watchmanByteReuse(baseline, inventory, new ObservationBudget(), signal)).rejects.toThrow("complete non-fresh");
});

it("bounds output and cancellation and supports hosts with no optional backend", async () => {
  enrollment();
  await expect(enrollWatchman(root, new ObservationBudget({ maxGitOutputBytes: 1 }), signal)).rejects.toThrow("output limit");
  await expect(enrollWatchman(root, new ObservationBudget(), AbortSignal.abort())).rejects.toBeDefined();
  vi.stubEnv("PROJECTOR_WATCHMAN_EXECUTABLE", undefined); vi.stubEnv("PROJECTOR_WATCHMAN_SOCKET", undefined);
  expect(await enrollWatchman(root, new ObservationBudget(), signal)).toBeUndefined();
});

it("rejects new consumers, canonical edits and repeated edits during the warm proof without moving the baseline", async () => {
  enrollment(); const budget = new ObservationBudget();
  const baseline = await enrollWatchman(root, budget, signal);
  protocol.replies.push({ config: {} }, { clock: "c:start", is_fresh_instance: false, files: [{ name: "already-dirty.ts", exists: true, type: "f" }] });
  const result = await watchmanByteReuse(baseline, inventory, budget, signal);
  if (result.kind !== "reuse") throw new Error("Expected reuse proof");
  for (const path of ["already-dirty.ts", "new-consumer.ts", ".projector/canonical.json"]) {
    protocol.replies.push({ config: {} }, { clock: "c:end", is_fresh_instance: false, files: [{ name: path, exists: true, type: "f" }] });
    await expect(validateWatchmanByteReuse(result.reuse, budget, signal)).rejects.toThrow("Repository changed during byte reuse");
  }
  protocol.replies.push({ config: {} }, { clock: "c:new-server", is_fresh_instance: true, files: [] });
  await expect(validateWatchmanByteReuse(result.reuse, budget, signal)).rejects.toThrow("lost currentness");
  expect(baseline!.clock).toBe("c:baseline");
});
