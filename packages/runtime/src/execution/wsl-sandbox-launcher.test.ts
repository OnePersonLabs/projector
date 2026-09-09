import { describe, expect, it } from "vitest";

import type { ProcessExecutionResult, ProcessLaunchRequest } from "./command-executor.js";
import {
  createWslSandboxLauncher,
  type WslExecutionControl,
  type WslRuntime,
} from "./wsl-sandbox-launcher.js";

class RecordingWslRuntime implements WslRuntime {
  readonly distro = "Ubuntu";
  readonly linuxNode = "/home/test/.nvm/versions/node/v24.18.0/bin/node";
  readonly translations: string[] = [];
  readonly launches: Array<{ args: readonly string[]; control: WslExecutionControl }> = [];

  async translatePath(path: string): Promise<string> {
    this.translations.push(path);
    if (path.startsWith("\\\\wsl.localhost\\Ubuntu\\")) {
      return `/${path.slice("\\\\wsl.localhost\\Ubuntu\\".length).replaceAll("\\", "/")}`;
    }
    return `/mnt/${path[0]?.toLowerCase()}${path.slice(2).replaceAll("\\", "/")}`;
  }

  async runTrustedNode(): Promise<ProcessExecutionResult> {
    throw new Error("unexpected probe invocation");
  }

  async launchBubblewrap(args: readonly string[], control: WslExecutionControl): Promise<ProcessExecutionResult> {
    this.launches.push({ args, control });
    return { exitCode: 0, signal: null, stdout: "validator", stderr: "", durationMs: 1 };
  }
}

describe("WSL bubblewrap launcher", () => {
  it("substitutes only configured Node and translates typed paths plus whole absolute path arguments", async () => {
    const runtime = new RecordingWslRuntime();
    const launcher = createWslSandboxLauncher(runtime, "C:\\runtime\\node.exe");
    const signal = new AbortController().signal;
    const request: ProcessLaunchRequest = {
      executable: "c:\\RUNTIME\\NODE.exe",
      args: [
        "C:\\repo\\scripts\\validator.mjs",
        "relative.mjs",
        "C:\\semantic-id\\must-stay-opaque",
        JSON.stringify({ embeddedPath: "C:\\repo\\not-an-argument.txt" }),
        "--eval",
        "C:\\repo\\opaque-eval-source",
      ],
      cwd: "C:\\repo",
      env: { ZED: "C:\\opaque-value", ALPHA: "literal" },
      readRoots: ["C:\\repo"],
      writeRoots: ["C:\\repo\\output"],
      readOnlyFileOverlays: [{
        source: "C:\\captured\\validator.mjs",
        target: "C:\\repo\\scripts\\validator.mjs",
      }],
      network: "deny",
      timeoutMs: 1_234,
      maxOutputBytes: 4_096,
      signal,
    };

    await expect(launcher.launch(request)).resolves.toMatchObject({ exitCode: 0, stdout: "validator" });
    expect(runtime.translations).toEqual(expect.arrayContaining([
      "C:\\repo",
      "C:\\repo\\output",
      "C:\\captured\\validator.mjs",
      "C:\\repo\\scripts\\validator.mjs",
    ]));
    expect(runtime.translations).not.toContain("relative.mjs");
    expect(runtime.translations).not.toContain("C:\\semantic-id\\must-stay-opaque");
    expect(runtime.translations).not.toContain(JSON.stringify({ embeddedPath: "C:\\repo\\not-an-argument.txt" }));
    expect(runtime.translations).not.toContain("C:\\repo\\opaque-eval-source");
    expect(runtime.launches).toEqual([{
      args: [
        "--die-with-parent",
        "--new-session",
        "--unshare-pid",
        "--unshare-net",
        "--clearenv",
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/lib", "/lib",
        "--ro-bind", "/lib64", "/lib64",
        "--ro-bind", "/home/test/.nvm/versions/node/v24.18.0/bin", "/home/test/.nvm/versions/node/v24.18.0/bin",
        "--ro-bind", "/mnt/c/repo", "/mnt/c/repo",
        "--bind", "/mnt/c/repo/output", "/mnt/c/repo/output",
        "--ro-bind", "/mnt/c/captured/validator.mjs", "/mnt/c/repo/scripts/validator.mjs",
        "--chdir", "/mnt/c/repo",
        "--setenv", "ALPHA", "literal",
        "--setenv", "ZED", "C:\\opaque-value",
        "/home/test/.nvm/versions/node/v24.18.0/bin/node",
        "/mnt/c/repo/scripts/validator.mjs",
        "relative.mjs",
        "C:\\semantic-id\\must-stay-opaque",
        JSON.stringify({ embeddedPath: "C:\\repo\\not-an-argument.txt" }),
        "--eval",
        "C:\\repo\\opaque-eval-source",
      ],
      control: request,
    }]);
  });

  it("rejects generic Windows executables and overlay targets outside read roots before WSL launch", async () => {
    const runtime = new RecordingWslRuntime();
    const launcher = createWslSandboxLauncher(runtime, "C:\\runtime\\node.exe");
    const base: ProcessLaunchRequest = {
      executable: "C:\\tools\\python.exe",
      args: [],
      cwd: "C:\\repo",
      env: {},
      readRoots: ["C:\\repo"],
      writeRoots: [],
      network: "deny",
      timeoutMs: 100,
      maxOutputBytes: 100,
      signal: new AbortController().signal,
    };

    await expect(launcher.launch(base)).rejects.toMatchObject({ code: "invalid-command" });
    expect(runtime.translations).toEqual([]);
    await expect(launcher.launch({
      ...base,
      executable: "C:\\runtime\\node.exe",
      readOnlyFileOverlays: [{ source: "C:\\captured\\validator.mjs", target: "C:\\other\\validator.mjs" }],
    })).rejects.toMatchObject({ code: "invalid-command" });
    expect(runtime.launches).toEqual([]);
  });

  it("rejects writable roots that would cover protected mounts while allowing a nested writable directory", async () => {
    const runtime = new RecordingWslRuntime();
    const launcher = createWslSandboxLauncher(runtime, "C:\\runtime\\node.exe");
    const base: ProcessLaunchRequest = {
      executable: "C:\\runtime\\node.exe",
      args: ["C:\\repo\\validator.mjs"],
      cwd: "C:\\repo",
      env: {},
      readRoots: ["C:\\repo"],
      writeRoots: ["C:\\repo\\output"],
      network: "deny",
      timeoutMs: 100,
      maxOutputBytes: 100,
      signal: new AbortController().signal,
    };

    await expect(launcher.launch(base)).resolves.toMatchObject({ exitCode: 0 });
    await expect(launcher.launch({ ...base, writeRoots: ["C:\\"] })).rejects.toThrow(/contains protected read-only path/u);
    await expect(launcher.launch({
      ...base,
      readRoots: ["\\\\wsl.localhost\\Ubuntu\\work"],
      writeRoots: ["\\\\wsl.localhost\\Ubuntu\\"],
      cwd: "\\\\wsl.localhost\\Ubuntu\\work",
      args: ["\\\\wsl.localhost\\Ubuntu\\work\\validator.mjs"],
    })).rejects.toThrow(/contains protected read-only path/u);
    expect(runtime.launches).toHaveLength(1);
  });
});
