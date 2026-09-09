#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { readlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { projectorRuntime } from "./projector-runtime.mjs";
const configuredRoot = process.env.PROJECTOR_ROOT?.trim();
let parentWorkingDirectory;
try {
  parentWorkingDirectory = await readlink(`/proc/${process.ppid}/cwd`);
} catch {
  // Linux and WSL expose the host repository here when the plugin has its own cwd.
}
const hostWorkingDirectory = process.env.CODEX_WORKSPACE_ROOT?.trim() || process.env.CODEX_CWD?.trim() || process.env.INIT_CWD?.trim();
const pluginRoot = resolve(import.meta.dirname, "..");
const candidate = configuredRoot || hostWorkingDirectory || parentWorkingDirectory;
const isPluginLocal = (path) => {
  const fromPlugin = relative(pluginRoot, path);
  return fromPlugin === "" || (!fromPlugin.startsWith("..") && !isAbsolute(fromPlugin));
};
let discoveredRoot;
if (candidate !== undefined && isAbsolute(candidate)) {
  try {
    const candidatePath = await realpath(candidate);
    if (!isPluginLocal(candidatePath)) {
      const gitRoot = await realpath(execFileSync("git", ["-C", candidatePath, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());
      if (!isPluginLocal(gitRoot)) discoveredRoot = gitRoot;
    }
  } catch { /* An invalid host hint does not bind the session to a non-repository. */ }
}
let inactive = discoveredRoot === undefined;
const inactiveRoot = inactive ? mkdtempSync(join(tmpdir(), "projector-inactive-")) : undefined;
if (inactiveRoot !== undefined) mkdirSync(join(inactiveRoot, ".git"));
let repositoryRoot = inactiveRoot ?? discoveredRoot;

const configuredCli = process.env.PROJECTOR_CLI?.trim();
const runtime = await projectorRuntime();

const write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const bindingTool = {
  name: "projector.bind_workspace",
  description: "Bind this Projector read session to the active repository when the host did not supply it. Supply the absolute working repository path. Binding does not initialize or mutate the repository and cannot switch an already bound session.",
  inputSchema: { type: "object", properties: { repositoryRoot: { type: "string", minLength: 1 } }, required: ["repositoryRoot"], additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};
const listRequests = new Set();
let child;
function launchChild() {
  const launched = spawn(runtime.executable, [...runtime.prefix, "mcp"], {
  cwd: repositoryRoot,
  env: {
    HOME: process.env.HOME ?? "",
    PATH: process.env.PATH ?? "",
    ...Object.fromEntries(["PROJECTOR_WSL_DISTRO", "PROJECTOR_WSL_NODE", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR"].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])),
    ...(configuredCli === undefined ? {} : { PROJECTOR_CLI: configuredCli }),
    PROJECTOR_ROOT: repositoryRoot,
  },
  stdio: ["pipe", "pipe", "inherit"],
  });
  const output = createInterface({ input: launched.stdout, crlfDelay: Infinity });
  output.on("line", (line) => {
    try {
      const value = JSON.parse(line);
      if (value?.jsonrpc === "2.0" && value?.method === "projector/ready") return;
      if (listRequests.delete(value.id) && Array.isArray(value.result?.tools)) value.result.tools.push(bindingTool);
      write(value);
    } catch { /* Never mix diagnostics into MCP stdout. */ }
  });
  launched.on("error", (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 5; });
  launched.on("exit", (code, signal) => {
    if (child !== launched) return;
    process.exitCode = code ?? (signal === null ? 1 : 6);
  });
  child = launched;
}
launchChild();
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
const supportedProtocolVersions = ["2025-06-18", "2024-11-05"];
let initializeResponded = false;
let initialized = false;

async function handleLine(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "invalid JSON" } });
    return;
  }

  if (request?.method === "initialize") {
    const requestedVersion = request?.params?.protocolVersion;
    if (typeof requestedVersion !== "string") {
      write({
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: { code: -32602, message: "initialize requires a protocol version" },
      });
      return;
    }
    const protocolVersion = supportedProtocolVersions.includes(requestedVersion)
      ? requestedVersion
      : supportedProtocolVersions[0];
    initializeResponded = true;
    initialized = false;
    write({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "projector", version: "2.1.0" },
        instructions: "Projector tools are state-bound; inspect evidence before mutation.",
      },
    });
    return;
  }

  if (request?.method === "notifications/initialized") {
    if (initializeResponded) initialized = true;
    return;
  }
  if (request?.method === "notifications/cancelled") return;
  if (request?.method === "ping") {
    write({ jsonrpc: "2.0", id: request.id ?? null, result: {} });
    return;
  }
  if (!initialized) {
    if (request?.id !== undefined) {
      write({
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: { code: -32002, message: "MCP initialize is required" },
      });
    }
    return;
  }
  if (request?.id === undefined) return;
  if (request.method === "tools/call" && request.params?.name === bindingTool.name) {
    try {
      const args = request.params.arguments;
      if (args === null || typeof args !== "object" || Object.keys(args).length !== 1 || typeof args.repositoryRoot !== "string" || !isAbsolute(args.repositoryRoot)) throw new Error("repositoryRoot must be an absolute working repository path");
      const requestedRoot = await realpath(args.repositoryRoot);
      const gitRoot = await realpath(execFileSync("git", ["-C", requestedRoot, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());
      const fromInstalledPlugin = relative(await realpath(pluginRoot), gitRoot);
      if (fromInstalledPlugin === "" || (!fromInstalledPlugin.startsWith("..") && !isAbsolute(fromInstalledPlugin))) throw new Error("the plugin installation cannot be the working repository");
      if (!inactive && await realpath(repositoryRoot) !== gitRoot) throw new Error("this session is already bound to another repository; start a new session to change repositories");
      if (inactive) {
        const previous = child;
        child = undefined;
        await new Promise((accept) => { previous.once("close", accept); previous.stdin.end(); });
        repositoryRoot = gitRoot;
        inactive = false;
        launchChild();
      }
      const result = { status: "bound", repositoryRoot };
      write({ jsonrpc: "2.0", id: request.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result } });
    } catch (error) {
      write({ jsonrpc: "2.0", id: request.id, result: { isError: true, content: [{ type: "text", text: error.message }] } });
    }
    return;
  }
  if (inactive && request.method === "tools/call") {
    const result = { status: "workspace-unbound", reason: "The host did not supply a working repository. Call projector.bind_workspace with the absolute active repository path, then retry.", repositoryRoot: null };
    write({ jsonrpc: "2.0", id: request.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result } });
    return;
  }
  if (request.method === "tools/list") listRequests.add(request.id);
  child.stdin.write(`${JSON.stringify(request)}\n`);
}
let inputQueue = Promise.resolve();
input.on("line", (line) => { inputQueue = inputQueue.then(() => handleLine(line)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 5; }); });
input.on("close", () => { void inputQueue.then(() => child?.stdin.end()); });
process.on("exit", () => {
  if (inactiveRoot !== undefined) rmSync(inactiveRoot, { recursive: true, force: true });
});
