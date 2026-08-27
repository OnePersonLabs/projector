import { describe, expect, it, vi } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hashFramedDomain, type ExecutionCapsule, type ExecutionPlan, type StateBinding, type StateDigest } from "@projector/core";
import { createExecutionApproval } from "@projector/engine";

import { createHostSessionRecord, executeProjector, hostSessionSelector, serveMcpTransport, type RunHostCliPort } from "./cli.js";
import { createBuiltMcpCliPort } from "./mcp-cli.js";

const exec = promisify(execFile);

describe("projector run host boundary", () => {
  it("preserves literal argv, filters environment, and reports reconciled host status", async () => {
    const run = vi.fn<RunHostCliPort["run"]>(async () => ({ status: "completed", exitCode: 0, changedPaths: ["src/a.ts"], reconciled: true }));
    const signal = new AbortController().signal;
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
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
    expect(result.exitCode).toBe(0); expect(result.report.tools).toEqual([
      "projector.audit",
      "projector.list_divergences",
      "projector.status",
    ]);
    expect(JSON.parse(result.output)).toEqual(result.report);
  });

  it("resolves an authenticated built session and detects a fake host's committed-clean write", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-host-"));
    try {
      await exec("git", ["init", "-q", root]); await mkdir(join(root, ".projector")); await writeFile(join(root, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n'); await writeFile(join(root, "tracked.txt"), "before\n"); await exec("git", ["-C", root, "add", "."]); await exec("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "initial"]);
      const head = (await exec("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim(); const state: StateDigest = { gitBase: head, worktreeDigest: hashFramedDomain("fixture", "w"), canonicalProjectorDigest: hashFramedDomain("fixture", "c"), toolchainDigest: hashFramedDomain("fixture", "t") };
      const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
      const plan = { id: "plan:host", revision: 1, boundState: binding } as unknown as ExecutionPlan;
      const representationText = "fixture"; const representation = { projectionId: "representation:fixture", profileId: "profile:agent-compact", profileVersion: "1", contentHash: hashFramedDomain("representation-artifact", representationText), preservationHash: hashFramedDomain("fixture", "preservation") };
      const capsule = { id: "capsule:host", taskId: "packet:host", operation: "host", unitIds: ["unit:fixture"], risk: { class: "R1" }, boundState: binding, contextHash: hashFramedDomain("fixture", "context"), normativeKernelHash: hashFramedDomain("fixture", "kernel"), representation, allowedWrites: [{ selector: { op: "atom", field: "path", matcher: "glob", value: "**" }, operations: ["host"], reason: "fixture" }], forbiddenWrites: [] } as unknown as ExecutionCapsule;
      const record = createHostSessionRecord({ kind: "task17-host-session", host: "codex", sessionId: "session:fixture", repositoryRootHash: hashFramedDomain("task17-host-repository-root", await realpath(root)), plan, capsule, approval: createExecutionApproval(plan, capsule, "approval:host"), instructions: { text: representationText, sourceHashes: [capsule.normativeKernelHash], representation } });
      const selector = hostSessionSelector(record); const id = selector.slice("session:".length); await mkdir(join(root, ".projector", "task17-sessions"), { recursive: true }); await writeFile(join(root, ".projector", "task17-sessions", `session-${id}.json`), JSON.stringify(record));
      await writeFile(join(root, "unrelated.txt"), "unrelated\n"); await exec("git", ["-C", root, "add", "unrelated.txt"]); await exec("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "unrelated"]);
      const bin = join(root, "bin"); await mkdir(bin); const fake = join(bin, "codex"); await writeFile(fake, "#!/usr/bin/env node\nconst fs=require('node:fs');const cp=require('node:child_process');const corrupt=process.argv.includes('--corrupt');const path=corrupt?'.projector/governance.json':'tracked.txt';fs.mkdirSync('.projector',{recursive:true});fs.writeFileSync(path,corrupt?'{invalid':'after\\n');cp.execFileSync('git',['add',path]);cp.execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','host']);\n"); await chmod(fake, 0o755);
      const dry = await executeProjector(["run", "codex", "--dry-run", "--session", selector, "--"], { cwd: root, environment: { PATH: bin } }); expect(dry.report).toMatchObject({ dryRun: true, sessionAuthenticated: true });
      const unavailable = await executeProjector(["run", "codex", "--session", selector, "--"], { cwd: root, environment: { PATH: join(root, "missing-bin") } }); expect(unavailable.exitCode).toBe(5);
      const mcp = await createBuiltMcpCliPort().start({ repositoryRoot: root, sessionSelector: selector, signal: new AbortController().signal });
      expect(mcp).not.toHaveProperty("capabilityToken");
      expect(mcp.tools).toEqual(["projector.audit", "projector.list_divergences", "projector.preview_representation", "projector.status", "projector.validate_representation"]);
      const lifecycleOutput: string[] = []; async function* requests() { yield JSON.stringify({ jsonrpc: "2.0", id: "list", method: "tools/list" }); yield JSON.stringify({ jsonrpc: "2.0", id: "status", method: "tools/call", params: { name: "projector.status", arguments: {} } }); }
      await serveMcpTransport(mcp.transport, requests(), (line) => lifecycleOutput.push(line)); expect(lifecycleOutput).toHaveLength(2); expect(JSON.parse(lifecycleOutput[1]!)).toMatchObject({ id: "status", result: { content: [{ type: "text", text: expect.any(String) }], structuredContent: { status: "ok" } } });
      const status = await mcp.transport.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "projector.status", arguments: {} } });
      const divergences = await mcp.transport.handle({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "projector.list_divergences", arguments: {} } });
      expect(divergences).toMatchObject({ result: { structuredContent: { status: "ok", divergences: expect.any(Array) } } });
      expect((divergences as { result: { structuredContent: object } }).result.structuredContent).not.toHaveProperty("failures");
      expect(status).toMatchObject({ result: { content: [{ type: "text", text: expect.any(String) }], structuredContent: { status: "ok", toolAvailability: expect.arrayContaining([{ name: "projector.apply_plan", class: "controlled", operational: false, reason: "no production handler is registered" }]) } } });
      expect((status as { result: { structuredContent: { toolAvailability: unknown[] } } }).result.structuredContent.toolAvailability).toHaveLength(21);
      const unadvertised = await mcp.transport.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.apply_transform", arguments: { capabilityToken: "not-issued", path: "mcp-output.txt", content: "forbidden\n" } } });
      expect(unadvertised).toMatchObject({ error: { message: expect.stringMatching(/unknown MCP tool/iu) } });
      await expect(readFile(join(root, "mcp-output.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      const preview = await mcp.transport.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "projector.preview_representation", arguments: {} } });
      expect(preview).toMatchObject({ result: { structuredContent: { status: "valid", content: representationText } } });

      const { representation: omittedRepresentation, ...capsuleWithoutRepresentation } = capsule; void omittedRepresentation;
      const noRepresentationRecord = createHostSessionRecord({ kind: "task17-host-session", host: "codex", sessionId: "session:no-representation", repositoryRootHash: hashFramedDomain("task17-host-repository-root", await realpath(root)), plan, capsule: capsuleWithoutRepresentation as ExecutionCapsule, approval: createExecutionApproval(plan, capsuleWithoutRepresentation as ExecutionCapsule, "approval:no-representation"), instructions: { text: representationText, sourceHashes: [capsule.normativeKernelHash], representation } });
      const noRepresentationSelector = hostSessionSelector(noRepresentationRecord); const noRepresentationId = noRepresentationSelector.slice("session:".length); await writeFile(join(root, ".projector", "task17-sessions", `session-${noRepresentationId}.json`), JSON.stringify(noRepresentationRecord));
      const noRepresentationMcp = await createBuiltMcpCliPort().start({ repositoryRoot: root, sessionSelector: noRepresentationSelector, signal: new AbortController().signal });
      expect(noRepresentationMcp.tools).toEqual(["projector.audit", "projector.list_divergences", "projector.status"]);

      const invalidRepresentationRecord = createHostSessionRecord({ kind: "task17-host-session", host: "codex", sessionId: "session:invalid-representation", repositoryRootHash: hashFramedDomain("task17-host-repository-root", await realpath(root)), plan, capsule, approval: createExecutionApproval(plan, capsule, "approval:invalid-representation"), instructions: { text: `${representationText} tampered`, sourceHashes: [capsule.normativeKernelHash], representation } });
      const invalidRepresentationSelector = hostSessionSelector(invalidRepresentationRecord); const invalidRepresentationId = invalidRepresentationSelector.slice("session:".length); await writeFile(join(root, ".projector", "task17-sessions", `session-${invalidRepresentationId}.json`), JSON.stringify(invalidRepresentationRecord));
      const invalidRepresentationMcp = await createBuiltMcpCliPort().start({ repositoryRoot: root, sessionSelector: invalidRepresentationSelector, signal: new AbortController().signal });
      expect(invalidRepresentationMcp.tools).toEqual(["projector.audit", "projector.list_divergences", "projector.status"]);
      const invalidRepresentationStatus = await invalidRepresentationMcp.transport.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "projector.status", arguments: {} } });
      expect(invalidRepresentationStatus).toMatchObject({ result: { structuredContent: { toolAvailability: expect.arrayContaining([{ name: "projector.preview_representation", class: "read", operational: false, reason: expect.stringMatching(/artifact hash/iu) }]) } } });
      await expect(invalidRepresentationMcp.transport.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "projector.preview_representation", arguments: {} } })).resolves.toMatchObject({ error: { message: expect.stringMatching(/unknown MCP tool/iu) } });
      const wrongOperationCapsule = { ...capsule, id: "capsule:wrong-operation", allowedWrites: [{ ...capsule.allowedWrites[0]!, operations: ["delete"] }] } as ExecutionCapsule;
      const wrongOperationRecord = createHostSessionRecord({ kind: "task17-host-session", host: "codex", sessionId: "session:wrong-operation", repositoryRootHash: hashFramedDomain("task17-host-repository-root", await realpath(root)), plan, capsule: wrongOperationCapsule, approval: createExecutionApproval(plan, wrongOperationCapsule, "approval:wrong-operation"), instructions: { text: representationText, sourceHashes: [capsule.normativeKernelHash], representation } });
      const wrongOperationSelector = hostSessionSelector(wrongOperationRecord); const wrongOperationId = wrongOperationSelector.slice("session:".length); await writeFile(join(root, ".projector", "task17-sessions", `session-${wrongOperationId}.json`), JSON.stringify(wrongOperationRecord));
      const blockedOperation = await executeProjector(["run", "codex", "--session", wrongOperationSelector, "--"], { cwd: root, environment: { PATH: `${bin}:${process.env.PATH ?? ""}` } });
      expect(blockedOperation).toMatchObject({ exitCode: 6, report: { status: "failed", changedPaths: [], reconciled: false } });
      expect(await readFile(join(root, "tracked.txt"), "utf8")).toBe("before\n");
      const result = await executeProjector(["run", "codex", "--session", selector, "--"], { cwd: root, environment: { PATH: `${bin}:${process.env.PATH ?? ""}` } });
      expect(result).toMatchObject({ exitCode: 0, report: { status: "completed", reconciled: true } }); expect(result.report.changedPaths).toContain("tracked.txt"); expect(result.report.journalId).toBeUndefined();
      const invalid = await executeProjector(["run", "codex", "--session", selector, "--", "--corrupt"], { cwd: root, environment: { PATH: `${bin}:${process.env.PATH ?? ""}` } });
      expect(invalid).toMatchObject({ exitCode: 6, report: { status: "failed", reconciled: false } }); expect(invalid.report.changedPaths).toContain(".projector/governance.json");
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 20_000);
});
