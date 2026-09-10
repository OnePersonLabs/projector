import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  AdapterContext,
  CommandSpec,
  ContentHash,
  StateBinding,
  StateBindingValidation,
  StateBindingValidator,
  StateDigest,
} from "@projector/core";
import { describe, expect, it } from "vitest";

import { RepositoryPathService } from "../security/index.js";
import {
  ExecutionLimitError,
  ExecutionRefusedError,
  NativeProcessLauncher,
  StateBoundCommandExecutor,
  type ProcessLaunchRequest,
  type ProcessLauncher,
} from "./command-executor.js";

const hash = `sha256:v1:${"0".repeat(64)}` as ContentHash;
const state: StateDigest = {
  gitBase: "abc123",
  worktreeDigest: hash,
  canonicalProjectorDigest: hash,
  toolchainDigest: hash,
};
const binding: StateBinding = {
  compiledAgainst: state,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hash,
};

class FixedBindingValidator implements StateBindingValidator {
  constructor(private readonly status: StateBindingValidation["status"]) {}

  async validate(
    _binding: StateBinding,
    currentState: StateDigest,
    _context: AdapterContext,
  ): Promise<StateBindingValidation> {
    return {
      status: this.status,
      currentState,
      changedValueDependencyIds: [],
      changedQueryDependencyIds: [],
      reasons: this.status === "current" ? [] : ["dependency changed"],
    };
  }
}

class RecordingHostLauncher implements ProcessLauncher {
  readonly capabilities = {
    cpuLimits: true,
    memoryLimits: true,
  };

  async launch(request: ProcessLaunchRequest) {
    return {
      exitCode: 0,
      signal: null,
      stdout: JSON.stringify({
        cwd: request.cwd,
      }),
      stderr: "",
      durationMs: 1,
    };
  }
}

describe("StateBoundCommandExecutor", () => {
  it("executes an exact authorized command through the native host without claiming isolation", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-host-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new NativeProcessLauncher());
    const spec = command({ argv: [process.execPath, "--input-type=module", "--eval", "process.stdout.write('host-ok')"], writeScope: [], sideEffectClass: "none" });
    const result = await executor.execute(spec, request(spec));
    expect(result).toMatchObject({ exitCode: 0, signal: null, stdout: "host-ok", stderr: "" });
    expect(result.authorization).toEqual({
      commandId: spec.id,
      readScope: ["."],
      writeScope: [],
      requiresNetwork: false,
      sideEffectClass: "none",
    });
    expect(result.hostAssumptions).toEqual({
      permissions: "configured-host",
      filesystemConfinement: false,
      networkDenial: false,
      hostileSameUserProtection: false,
    });
    expect(new NativeProcessLauncher().capabilities).toEqual({ cpuLimits: false, memoryLimits: false });
  });

  it("refuses a command whose binding is stale before starting a process", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("stale"), new RecordingHostLauncher());

    await expect(executor.execute(command(), request())).rejects.toMatchObject({
      code: "stale-binding",
    });
  });

  it("refuses command scopes outside the plan-authorized roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new RecordingHostLauncher());
    const spec = command({ writeScope: ["secrets"] });

    await expect(executor.execute(spec, request(spec))).rejects.toBeInstanceOf(ExecutionRefusedError);
  });

  it("validates declared access before passing only host launch inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new RecordingHostLauncher());

    const result = await executor.execute(command(), request());
    expect(JSON.parse(result.stdout)).toEqual({
      cwd: root,
    });
  });

  it("refuses undeclared network access", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new RecordingHostLauncher());

    const spec = command({ requiresNetwork: true });
    await expect(executor.execute(spec, request(spec))).rejects.toMatchObject({
      code: "network-refused",
    });
  });

  it("refuses altered argv even when it reuses an authorized command ID", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new RecordingHostLauncher());

    await expect(
      executor.execute(command({ argv: ["different-tool", "unexpected"] }), request()),
    ).rejects.toMatchObject({ code: "command-refused" });
  });

  it("fails closed for an external-write command without explicit policy authorization", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new RecordingHostLauncher());
    const spec = command({ sideEffectClass: "external-write" });

    await expect(executor.execute(spec, request(spec))).rejects.toMatchObject({
      code: "external-write-refused",
    });
  });

  it("executes an explicitly authorized external write through host permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(
      paths,
      new FixedBindingValidator("current"),
      new RecordingHostLauncher(),
    );
    const spec = command({ sideEffectClass: "external-write" });

    await expect(
      executor.execute(spec, request(spec, { allowExternalWrites: true })),
    ).resolves.toMatchObject({ exitCode: 0 });
  });

  it("rejects non-finite, fractional, or non-positive resource budgets", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new RecordingHostLauncher());
    const cases: Array<{ spec: CommandSpec; maxOutputBytes: number }> = [
      { spec: command(), maxOutputBytes: Number.NaN },
      { spec: command(), maxOutputBytes: Number.POSITIVE_INFINITY },
      { spec: command(), maxOutputBytes: 1.5 },
      { spec: command({ cpuBudgetMs: Number.NaN }), maxOutputBytes: 1_024 },
      { spec: command({ cpuBudgetMs: 0 }), maxOutputBytes: 1_024 },
      { spec: command({ memoryBudgetMb: Number.POSITIVE_INFINITY }), maxOutputBytes: 1_024 },
      { spec: command({ memoryBudgetMb: 1.5 }), maxOutputBytes: 1_024 },
      { spec: command({ timeoutMs: Number.NaN }), maxOutputBytes: 1_024 },
    ];

    for (const candidate of cases) {
      await expect(
        executor.execute(candidate.spec, request(candidate.spec, { maxOutputBytes: candidate.maxOutputBytes })),
      ).rejects.toMatchObject({ code: "invalid-command" });
    }
  });

  it("does not treat a rebound status without a replacement binding as authorized", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("rebound"), new RecordingHostLauncher());

    await expect(executor.execute(command(), request())).rejects.toMatchObject({ code: "stale-binding" });
  });
});

describe("NativeProcessLauncher", () => {
  it("uses argv without shell interpolation and exposes only declared environment values", async () => {
    const launcher = new NativeProcessLauncher();
    const script = "process.stdout.write(JSON.stringify({arg:process.argv[1], kept:process.env.KEPT, hidden:process.env.HIDDEN}))";
    const result = await launcher.launch({
      executable: process.execPath,
      args: ["-e", script, "$(printf exploited)"],
      cwd: process.cwd(),
      env: { KEPT: "yes" },
      timeoutMs: 1_000,
      maxOutputBytes: 1_024,
      signal: new AbortController().signal,
    });

    expect(JSON.parse(result.stdout)).toEqual({ arg: "$(printf exploited)", kept: "yes" });
  });

  it("terminates a process that exceeds its time budget", async () => {
    const launcher = new NativeProcessLauncher();
    await expect(
      launcher.launch({
        executable: process.execPath,
        args: ["-e", "setInterval(() => {}, 1000)"],
        cwd: process.cwd(),
        env: {},
        timeoutMs: 20,
        maxOutputBytes: 1_024,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ limit: "timeout" });
  });

  it("terminates a process that exceeds its combined output budget", async () => {
    const launcher = new NativeProcessLauncher();
    await expect(
      launcher.launch({
        executable: process.execPath,
        args: ["-e", "process.stdout.write('x'.repeat(4096))"],
        cwd: process.cwd(),
        env: {},
        timeoutMs: 1_000,
        maxOutputBytes: 64,
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(ExecutionLimitError);
  });

  it("refuses unsupported CPU and memory limits before spawning the host command", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-limits-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new NativeProcessLauncher());
    for (const spec of [command({ cpuBudgetMs: 100 }), command({ memoryBudgetMb: 64 })]) {
      await expect(executor.execute(spec, request(spec))).rejects.toMatchObject({
        code: "unsupported-resource-limit",
      });
    }
  });

  it("terminates the owned descendant tree when caller cancellation interrupts execution", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-process-tree-"));
    const pidFile = join(root, "descendant.pid");
    const controller = new AbortController();
    const launcher = new NativeProcessLauncher();
    const source = [
      "const {spawn}=require('node:child_process')",
      "const {writeFileSync}=require('node:fs')",
      "const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'})",
      "writeFileSync(process.argv[1],String(child.pid))",
      "setInterval(()=>{},1000)",
    ].join(";");
    const execution = launcher.launch({
      executable: process.execPath,
      args: ["-e", source, pidFile],
      cwd: root,
      env: {},
      timeoutMs: 5_000,
      maxOutputBytes: 1_024,
      signal: controller.signal,
    });
    let descendantPid: number | undefined;
    await expect.poll(async () => {
      try {
        descendantPid = Number(await readFile(pidFile, "utf8"));
        return Number.isSafeInteger(descendantPid) && descendantPid > 0;
      } catch {
        return false;
      }
    }).toBe(true);
    controller.abort();
    await expect(execution).rejects.toMatchObject({ limit: "aborted" });
    await expect.poll(() => processExists(descendantPid!)).toBe(false);
  });

  it.skipIf(process.platform === "win32")("blocks interrupted execution when a descendant escapes the owned POSIX process group", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-escaped-process-"));
    const pidFile = join(root, "escaped.pid");
    const controller = new AbortController();
    const source = [
      "const {spawn}=require('node:child_process')",
      "const {writeFileSync}=require('node:fs')",
      "const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'})",
      "child.unref()",
      "writeFileSync(process.argv[1],String(child.pid))",
      "setInterval(()=>{},1000)",
    ].join(";");
    const execution = new NativeProcessLauncher().launch({
      executable: process.execPath,
      args: ["-e", source, pidFile],
      cwd: root,
      env: {},
      timeoutMs: 5_000,
      maxOutputBytes: 1_024,
      signal: controller.signal,
    });
    let escapedPid: number | undefined;
    try {
      await expect.poll(async () => {
        try {
          escapedPid = Number(await readFile(pidFile, "utf8"));
          return Number.isSafeInteger(escapedPid) && escapedPid > 0;
        } catch {
          return false;
        }
      }).toBe(true);
      controller.abort();
      await expect(execution).rejects.toMatchObject({
        limit: "aborted",
        cleanup: {
          rootExitObserved: true,
          processGroupId: expect.any(Number),
          requested: "posix-process-group-sigkill",
          status: "unconfirmed",
        },
      });
      expect(processExists(escapedPid!)).toBe(true);
    } finally {
      if (escapedPid !== undefined && processExists(escapedPid)) process.kill(escapedPid, "SIGKILL");
    }
  });
});

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function command(overrides: Partial<CommandSpec> = {}): CommandSpec {
  return {
    id: "test-command",
    argv: ["tool", "literal argument"],
    cwd: ".",
    readScope: ["."],
    writeScope: ["src"],
    requiresNetwork: false,
    environmentKeys: ["KEPT"],
    sideEffectClass: "workspace-write",
    timeoutMs: 1_000,
    ...overrides,
  };
}

function request(
  declaredCommand: CommandSpec = command(),
  overrides: Partial<{ maxOutputBytes: number; allowExternalWrites: boolean }> = {},
) {
  return {
    boundState: binding,
    currentState: state,
    allowedCommandIds: ["test-command"],
    declaredCommands: [declaredCommand],
    allowedReadRoots: ["."],
    allowedWriteRoots: ["src"],
    allowNetwork: false,
    allowExternalWrites: false,
    environment: { KEPT: "yes", HIDDEN: "no" },
    maxOutputBytes: 1_024,
    signal: new AbortController().signal,
    ...overrides,
  };
}
