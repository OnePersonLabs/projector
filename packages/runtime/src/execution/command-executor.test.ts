import { mkdtemp } from "node:fs/promises";
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

class EchoSandboxLauncher implements ProcessLauncher {
  readonly capabilities = {
    filesystemIsolation: true,
    networkIsolation: true,
    cpuLimits: true,
    memoryLimits: true,
  };

  async launch(request: ProcessLaunchRequest) {
    return {
      exitCode: 0,
      signal: null,
      stdout: JSON.stringify({
        cwd: request.cwd,
        readRoots: request.readRoots,
        writeRoots: request.writeRoots,
      }),
      stderr: "",
      durationMs: 1,
    };
  }
}

describe("StateBoundCommandExecutor", () => {
  it("refuses a command whose binding is stale before starting a process", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("stale"), new EchoSandboxLauncher());

    await expect(executor.execute(command(), request())).rejects.toMatchObject({
      code: "stale-binding",
    });
  });

  it("refuses command scopes outside the plan-authorized roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new EchoSandboxLauncher());
    const spec = command({ writeScope: ["secrets"] });

    await expect(executor.execute(spec, request(spec))).rejects.toBeInstanceOf(ExecutionRefusedError);
  });

  it("passes only validated real roots to the sandbox launcher", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new EchoSandboxLauncher());

    const result = await executor.execute(command(), request());
    expect(JSON.parse(result.stdout)).toEqual({
      cwd: root,
      readRoots: [root],
      writeRoots: [join(root, "src")],
    });
  });

  it("refuses undeclared network access", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new EchoSandboxLauncher());

    const spec = command({ network: "allow" });
    await expect(executor.execute(spec, request(spec))).rejects.toMatchObject({
      code: "network-refused",
    });
  });

  it("refuses altered argv even when it reuses an authorized command ID", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-exec-"));
    const paths = await RepositoryPathService.create(root);
    const executor = new StateBoundCommandExecutor(paths, new FixedBindingValidator("current"), new EchoSandboxLauncher());

    await expect(
      executor.execute(command({ argv: ["different-tool", "unexpected"] }), request()),
    ).rejects.toMatchObject({ code: "command-refused" });
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
      readRoots: [],
      writeRoots: [],
      network: "deny",
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
        readRoots: [],
        writeRoots: [],
        network: "deny",
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
        readRoots: [],
        writeRoots: [],
        network: "deny",
        timeoutMs: 1_000,
        maxOutputBytes: 64,
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(ExecutionLimitError);
  });
});

function command(overrides: Partial<CommandSpec> = {}): CommandSpec {
  return {
    id: "test-command",
    argv: ["tool", "literal argument"],
    cwd: ".",
    readScope: ["."],
    writeScope: ["src"],
    network: "deny",
    environmentKeys: ["KEPT"],
    sideEffectClass: "workspace-write",
    timeoutMs: 1_000,
    ...overrides,
  };
}

function request(declaredCommand: CommandSpec = command()) {
  return {
    boundState: binding,
    currentState: state,
    allowedCommandIds: ["test-command"],
    declaredCommands: [declaredCommand],
    allowedReadRoots: ["."],
    allowedWriteRoots: ["src"],
    allowNetwork: false,
    environment: { KEPT: "yes", HIDDEN: "no" },
    maxOutputBytes: 1_024,
    signal: new AbortController().signal,
  };
}
