#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const configuredRoot = process.env.PROJECTOR_ROOT?.trim();
let repositoryRoot = configuredRoot || process.cwd();

if (!configuredRoot) {
  try {
    repositoryRoot = execFileSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    const sourceRepository = resolve(pluginRoot, "..", "..");
    try {
      await access(join(sourceRepository, "packages", "cli", "dist", "cli.js"), constants.R_OK);
      repositoryRoot = sourceRepository;
    } catch {
      // The diagnostic below reports the final candidate and remediation.
    }
  }
}

const cli = join(repositoryRoot, "packages", "cli", "dist", "cli.js");
try {
  await access(cli, constants.R_OK);
} catch {
  process.stderr.write(
    `Projector CLI is unavailable at ${cli}. Build the repository or set PROJECTOR_ROOT before enabling the MCP server.\n`,
  );
  process.exit(5);
}

const child = spawn(process.execPath, [cli, "mcp"], {
  cwd: repositoryRoot,
  env: {
    HOME: process.env.HOME ?? "",
    PATH: process.env.PATH ?? "",
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
        serverInfo: { name: "projector", version: "2.0.0" },
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
