import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..");
const pluginRoot = resolve(repositoryRoot, "plugins", "projector");

type JsonRpcMessage = {
  id?: number;
  result?: {
    serverInfo?: { name?: string; version?: string };
    tools?: Array<{ name?: string }>;
  };
};

const launchConfiguredServer = async (): Promise<JsonRpcMessage[]> => {
  const installationRoot = await mkdtemp(join(tmpdir(), "projector-plugin-test-"));
  const installedPluginRoot = resolve(installationRoot, "projector");
  await cp(pluginRoot, installedPluginRoot, { recursive: true });
  const configuration = JSON.parse(await readFile(resolve(pluginRoot, ".mcp.json"), "utf8")) as {
    mcpServers: { projector: { command: string; args?: string[]; cwd?: string } };
  };
  const server = configuration.mcpServers.projector;
  const cwd = server.cwd === undefined ? repositoryRoot : resolve(installedPluginRoot, server.cwd);
  const environment = { ...process.env };
  delete environment.PWD;
  delete environment.CODEX_CWD;
  delete environment.CODEX_WORKSPACE_ROOT;
  delete environment.INIT_CWD;
  delete environment.PROJECTOR_ROOT;
  const child = spawn(server.command, server.args ?? [], {
    cwd,
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "projector-plugin-test", version: "1" },
    },
  })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);

  await new Promise<void>((accept, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP launch timed out\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 8_000);
    child.stdout.on("data", () => {
      if (stdout.includes('"id":2')) {
        clearTimeout(timeout);
        child.kill();
        accept();
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (!stdout.includes('"id":2')) {
        reject(new Error(`MCP server exited ${code}\nstdout: ${stdout}\nstderr: ${stderr}`));
      }
    });
  });

  const messages = stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as JsonRpcMessage);
  await rm(installationRoot, { recursive: true, force: true });
  return messages;
};

describe("Projector Codex plugin MCP launch", () => {
  test("handshakes and lists tools from an installed plugin working directory", async () => {
    const messages = await launchConfiguredServer();
    const manifest = JSON.parse(await readFile(resolve(pluginRoot, ".codex-plugin", "plugin.json"), "utf8")) as {
      version: string;
    };

    expect(messages.find((message) => message.id === 1)?.result?.serverInfo?.name).toBe("projector");
    expect(messages.find((message) => message.id === 1)?.result?.serverInfo?.version).toBe(manifest.version);
    expect(messages.find((message) => message.id === 2)?.result?.tools)
      .toEqual(expect.arrayContaining([expect.objectContaining({ name: "projector.status" })]));
  });
});
