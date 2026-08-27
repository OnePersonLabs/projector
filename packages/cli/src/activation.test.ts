import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { executeProjector } from "./cli.js";
import { createBuiltMcpCliPort } from "./mcp-cli.js";

const exec = promisify(execFile);
const roots: string[] = [];

async function gitRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-activation-"));
  roots.push(root);
  await exec("git", ["init", "-q", root]);
  await writeFile(join(root, "tracked.txt"), "fixture\n");
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("explicit Projector project activation", () => {
  it("blocks every non-init CLI path before analysis, lifecycle, or persistence", async () => {
    const root = await gitRepository();
    const lifecycle = {
      capture: vi.fn(), plan: vi.fn(), approve: vi.fn(), apply: vi.fn(), recover: vi.fn(), resume: vi.fn(),
    };

    const audit = await executeProjector(["audit", "--format", "json"], { cwd: root });
    const change = await executeProjector(["change", "request", "--proposal", "proposal.json"], { cwd: root, lifecycle });

    expect(audit).toMatchObject({ exitCode: 5, report: { projectEnabled: false } });
    expect(change).toMatchObject({ exitCode: 5, report: { projectEnabled: false } });
    expect(lifecycle.capture).not.toHaveBeenCalled();
    await expect(access(join(root, ".projector"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps MCP handshake-stable without invoking the analyzer when the project is not enabled", async () => {
    const root = await gitRepository();
    const analyze = vi.fn(() => { throw new Error("analyzer must not run"); });
    const mcp = await createBuiltMcpCliPort({ analyze } as never).start({ repositoryRoot: root, signal: new AbortController().signal });

    const status = await mcp.transport.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "projector.status", arguments: { repo_root: "/tmp/attacker-selected" } } });
    const audit = await mcp.transport.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.audit", arguments: {} } });
    const divergences = await mcp.transport.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "projector.list_divergences", arguments: {} } });

    expect(mcp.status).toBe("ready");
    expect(status).toMatchObject({ result: { structuredContent: { status: "not-enabled" } } });
    expect(audit).toMatchObject({ result: { structuredContent: { status: "unavailable" } } });
    expect(divergences).toMatchObject({ result: { structuredContent: { status: "unavailable" } } });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("allows the top-level MCP process command to start in an inactive repository", async () => {
    const root = await gitRepository();
    const start = vi.fn(async () => ({ status: "ready" as const, tools: ["projector.status"], transport: { handle: async () => ({}) } }));
    const detectCanonicalConflictPaths = vi.fn(async () => []);

    await expect(executeProjector(["mcp"], { cwd: root, mcp: { start }, governance: { detectCanonicalConflictPaths } })).resolves.toMatchObject({ exitCode: 0, report: { status: "ready" } });
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ repositoryRoot: root }));
    expect(detectCanonicalConflictPaths).not.toHaveBeenCalled();
  });

  it("creates the strict marker only on successful non-dry init and then permits commands", async () => {
    const root = await gitRepository();
    const dry = await executeProjector(["init", "--dry-run"], { cwd: root });
    expect(dry.report).toMatchObject({ initialized: false, dryRun: true });
    await expect(access(join(root, ".projector", "config.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const initialized = await executeProjector(["init", "--format", "json"], { cwd: root });
    expect(initialized).toMatchObject({ exitCode: 0, report: { initialized: true, projectEnabled: true } });
    expect(JSON.parse(await readFile(join(root, ".projector", "config.json"), "utf8"))).toEqual({ apiVersion: "projector.config/v1", enabled: true });
    await expect(executeProjector(["audit"], { cwd: root })).resolves.not.toMatchObject({ exitCode: 5 });
  });

  it("does not treat legacy derived .projector state as implicit activation", async () => {
    const root = await gitRepository();
    await mkdir(join(root, ".projector"));

    await expect(executeProjector(["audit"], { cwd: root })).resolves.toMatchObject({ exitCode: 5, report: { projectEnabled: false } });
    await expect(executeProjector(["init"], { cwd: root })).resolves.toMatchObject({ exitCode: 0, report: { projectEnabled: true, configCreated: true } });
  });

  it("does not write the marker when initialization rebuild fails", async () => {
    const root = await gitRepository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "unknown.json"), "{}\n");

    await expect(executeProjector(["init"], { cwd: root })).rejects.toThrow(/unsupported canonical/iu);
    await expect(access(join(root, ".projector", "config.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    ["malformed", "{\n"],
    ["unsupported", '{"apiVersion":"projector.config/v999","enabled":true}\n'],
    ["extra keys", '{"apiVersion":"projector.config/v1","enabled":true,"implicit":true}\n'],
  ])("fails closed for %s config and init does not overwrite it", async (_label, contents) => {
    const root = await gitRepository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.json"), contents);

    await expect(executeProjector(["audit"], { cwd: root })).resolves.toMatchObject({ exitCode: 5, report: { projectEnabled: false } });
    await expect(executeProjector(["init"], { cwd: root })).rejects.toThrow(/config|activation|enabled/iu);
    expect(await readFile(join(root, ".projector", "config.json"), "utf8")).toBe(contents);
  });

  it("rejects a symlinked activation marker without writing outside the repository", async () => {
    const root = await gitRepository();
    const outside = await mkdtemp(join(tmpdir(), "projector-activation-outside-"));
    roots.push(outside);
    await symlink(outside, join(root, ".projector"), "dir");

    await expect(executeProjector(["audit"], { cwd: root })).resolves.toMatchObject({ exitCode: 5, report: { projectEnabled: false } });
    await expect(executeProjector(["init"], { cwd: root })).rejects.toThrow(/symbolic|symlink/iu);
    expect(await readFile(outside, { encoding: "utf8" }).catch(() => "not-a-file")).toBe("not-a-file");
  });
});
