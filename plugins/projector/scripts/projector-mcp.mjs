#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { readlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
const configuredRoot = process.env.PROJECTOR_ROOT?.trim();
const inheritedWorkingDirectory = process.env.PWD?.trim();
let parentWorkingDirectory;
try {
  parentWorkingDirectory = await readlink(`/proc/${process.ppid}/cwd`);
} catch {
  // Linux and WSL expose the host repository here when the plugin has its own cwd.
}
let repositoryRoot = configuredRoot || inheritedWorkingDirectory || parentWorkingDirectory || process.cwd();

if (!configuredRoot) {
  try {
    repositoryRoot = execFileSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    ).trim();
  } catch { /* Use the final candidate; the CLI reports repository availability. */ }
}

const configuredCli = process.env.PROJECTOR_CLI?.trim();
const cli = configuredCli === undefined || configuredCli === "" ? "projector" : configuredCli;
const nodeScript = /\.(?:c|m)?js$/u.test(cli);

const child = spawn(nodeScript ? process.execPath : cli, [...(nodeScript ? [cli] : []), "mcp"], {
  cwd: repositoryRoot,
  env: {
    HOME: process.env.HOME ?? "",
    PATH: process.env.PATH ?? "",
    ...(configuredCli === undefined ? {} : { PROJECTOR_CLI: configuredCli }),
    PROJECTOR_ROOT: repositoryRoot,
  },
  stdio: ["pipe", "pipe", "inherit"],
});

const write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
const output = createInterface({ input: child.stdout, crlfDelay: Infinity });
const supportedProtocolVersions = ["2025-06-18", "2024-11-05"];
let initializeResponded = false;
let initialized = false;

input.on("line", (line) => {
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
        serverInfo: { name: "projector", version: "2.0.5" },
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
  child.stdin.write(`${JSON.stringify(request)}\n`);
});

output.on("line", (line) => {
  try {
    const value = JSON.parse(line);
    if (value?.jsonrpc === "2.0" && value?.method === "projector/ready") return;
    write(value);
  } catch {
    // Child diagnostics are emitted on stderr; never mix them into MCP stdout.
  }
});

input.on("close", () => child.stdin.end());
child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 5;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === null ? 1 : 6);
});
