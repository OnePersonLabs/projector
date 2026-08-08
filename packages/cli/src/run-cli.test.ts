import { describe, expect, it, vi } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hashFramedDomain, type ExecutionCapsule, type ExecutionPlan, type StateBinding, type StateDigest } from "@projector/core";
import { createExecutionApproval } from "@projector/engine";

import { executeProjector, serveMcpTransport, type RunHostCliPort } from "./cli.js";
import { createHostSessionRecord, hostSessionSelector } from "./host-cli.js";
import { createBuiltMcpCliPort } from "./mcp-cli.js";

const exec = promisify(execFile);

describe("projector run host boundary", () => {
  it("preserves literal argv, filters environment, and reports reconciled host status", async () => {
    const run = vi.fn<RunHostCliPort["run"]>(async () => ({ status: "completed", exitCode: 0, changedPaths: ["src/a.ts"], reconciled: true }));
    const signal = new AbortController().signal;
    const repositoryRoot = process.cwd();
    const result = await executeProjector(["run", "codex", "--mode", "guide", "--session", "session:fixture", "--", "--fake", "value with spaces", "$(never)"], { cwd: repositoryRoot, runHost: { resolve: async () => ({ authenticated: true, host: "codex" }), run }, environment: { PATH: "/bin", LANG: "C", SECRET: "drop" }, signal });
    expect(result.exitCode).toBe(0);
    expect(run).toHaveBeenCalledWith({ host: "codex", sessionSelector: "session:fixture", repositoryRoot, argv: ["--fake", "value with spaces", "$(never)"], environment: { LANG: "C", PATH: "/bin" }, signal });
    expect(result.report).toMatchObject({ status: "completed", reconciled: true, changedPaths: ["src/a.ts"] });
  });

  it("does not launch in dry-run and maps missing executables/cancellation after reconciliation", async () => {
    const run = vi.fn<RunHostCliPort["run"]>(async () => ({ status: "unavailable", exitCode: null, changedPaths: [], reconciled: true }));
    const port = { resolve: async () => ({ authenticated: true as const, host: "claude" as const }), run };
    const dry = await executeProjector(["run", "claude", "--dry-run", "--session", "session:fixture", "--", "--fake"], { runHost: port });
    expect(dry).toMatchObject({ exitCode: 0, report: { dryRun: true, host: "claude", argv: ["--fake"] } }); expect(run).not.toHaveBeenCalled();
    const missing = await executeProjector(["run", "claude", "--session", "session:fixture", "--", "--fake"], { runHost: port }); expect(missing.exitCode).toBe(5);
    run.mockResolvedValueOnce({ status: "cancelled", exitCode: null, changedPaths: ["partial"], reconciled: true });
    const cancelled = await executeProjector(["run", "codex", "--session", "session:fixture", "--"], { runHost: { resolve: async () => ({ authenticated: true, host: "codex" }), run } }); expect(cancelled.exitCode).toBe(6); expect(cancelled.report.reconciled).toBe(true);
  });

  it("rejects unknown hosts and requires the argv separator", async () => {
    await expect(executeProjector(["run", "other", "--"])).rejects.toThrow(/host/u);
    await expect(executeProjector(["run", "codex", "--fake"])).rejects.toThrow(/separator/u);
  });

  it("composes the required built MCP registry through its real transport", async () => {
    const result = await executeProjector(["mcp", "--format", "json"]);
    expect(result.exitCode).toBe(0); expect(result.report.tools).toContain("projector.status"); expect(result.report.tools).toContain("projector.apply_plan"); expect(result.report.tools).toHaveLength(21);
    expect(JSON.parse(result.output)).toEqual(result.report);
  });

  it("resolves an authenticated built session and detects a fake host's committed-clean write", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-host-"));
    try {
      await exec("git", ["init", "-q", root]); await writeFile(join(root, "tracked.txt"), "before\n"); await exec("git", ["-C", root, "add", "."]); await exec("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "initial"]);
      const head = (await exec("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim(); const state: StateDigest = { gitBase: head, worktreeDigest: hashFramedDomain("fixture", "w"), canonicalProjectorDigest: hashFramedDomain("fixture", "c"), toolchainDigest: hashFramedDomain("fixture", "t") };
      const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
      const plan = { id: "plan:host", revision: 1, boundState: binding } as unknown as ExecutionPlan;
      const capsule = { id: "capsule:host", taskId: "packet:host", unitIds: ["unit:fixture"], risk: { class: "R1" }, boundState: binding, contextHash: hashFramedDomain("fixture", "context"), normativeKernelHash: hashFramedDomain("fixture", "kernel"), allowedWrites: [{ selector: { op: "atom", field: "path", matcher: "glob", value: "**" }, operations: ["host"], reason: "fixture" }] } as unknown as ExecutionCapsule;
      const record = createHostSessionRecord({ kind: "task17-host-session", host: "codex", sessionId: "session:fixture", repositoryRootHash: hashFramedDomain("task17-host-repository-root", await realpath(root)), plan, capsule, approval: createExecutionApproval(plan, capsule, "approval:host"), instructions: { text: "fixture", sourceHashes: [capsule.normativeKernelHash], representationId: "fixture" } });
      const selector = hostSessionSelector(record); const id = selector.slice("session:".length); await mkdir(join(root, ".projector", "task17-sessions"), { recursive: true }); await writeFile(join(root, ".projector", "task17-sessions", `session-${id}.json`), JSON.stringify(record));
      await writeFile(join(root, "unrelated.txt"), "unrelated\n"); await exec("git", ["-C", root, "add", "unrelated.txt"]); await exec("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "unrelated"]);
      const bin = join(root, "bin"); await mkdir(bin); const fake = join(bin, "codex"); await writeFile(fake, "#!/usr/bin/env node\nconst fs=require('node:fs');const cp=require('node:child_process');const corrupt=process.argv.includes('--corrupt');const path=corrupt?'.projector/governance.json':'tracked.txt';fs.mkdirSync('.projector',{recursive:true});fs.writeFileSync(path,corrupt?'{invalid':'after\\n');cp.execFileSync('git',['add',path]);cp.execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','host']);\n"); await chmod(fake, 0o755);
      const dry = await executeProjector(["run", "codex", "--dry-run", "--session", selector, "--"], { cwd: root, environment: { PATH: bin } }); expect(dry.report).toMatchObject({ dryRun: true, sessionAuthenticated: true });
      const unavailable = await executeProjector(["run", "codex", "--session", selector, "--"], { cwd: root, environment: { PATH: join(root, "missing-bin") } }); expect(unavailable.exitCode).toBe(5);
      const mcp = await createBuiltMcpCliPort().start({ repositoryRoot: root, sessionSelector: selector, signal: new AbortController().signal }); expect(mcp.capabilityToken).toBeTypeOf("string");
      const lifecycleOutput: string[] = []; async function* requests() { yield JSON.stringify({ jsonrpc: "2.0", id: "list", method: "tools/list" }); yield JSON.stringify({ jsonrpc: "2.0", id: "status", method: "tools/call", params: { name: "projector.status", arguments: {} } }); }
      await serveMcpTransport(mcp.transport, requests(), (line) => lifecycleOutput.push(line)); expect(lifecycleOutput).toHaveLength(2); expect(JSON.parse(lifecycleOutput[1]!)).toMatchObject({ id: "status", result: { content: [{ value: { status: "ok" } }] } });
      const status = await mcp.transport.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "projector.status", arguments: {} } }); expect(status).toMatchObject({ result: { content: [{ value: { status: "ok" } }] } });
      const controlled = await mcp.transport.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.apply_transform", arguments: { capabilityToken: mcp.capabilityToken, semanticScope: "unit:fixture", path: "mcp-output.txt", content: "controlled\n" } } }); expect(controlled).toMatchObject({ result: { content: [{ value: { status: "applied", path: "mcp-output.txt" } }] } }); expect(await readFile(join(root, "mcp-output.txt"), "utf8")).toBe("controlled\n");
      const result = await executeProjector(["run", "codex", "--session", selector, "--"], { cwd: root, environment: { PATH: `${bin}:${process.env.PATH ?? ""}` } });
      expect(result).toMatchObject({ exitCode: 0, report: { status: "completed", reconciled: true } }); expect(result.report.changedPaths).toContain("tracked.txt"); expect(result.report.journalId).toBeUndefined();
      const invalid = await executeProjector(["run", "codex", "--session", selector, "--", "--corrupt"], { cwd: root, environment: { PATH: `${bin}:${process.env.PATH ?? ""}` } });
      expect(invalid).toMatchObject({ exitCode: 6, report: { status: "failed", reconciled: false } }); expect(invalid.report.changedPaths).toContain(".projector/governance.json");
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 20_000);
});
