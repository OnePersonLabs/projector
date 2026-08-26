import { describe, expect, it } from "vitest";

import {
  createSandboxLauncher,
  selectSandboxLauncher,
  type SandboxBackendCandidate,
  type SandboxProbeEvidence,
} from "./sandbox-launcher.js";
import type {
  ProcessExecutionResult,
  ProcessLaunchRequest,
  ProcessLauncher,
} from "./command-executor.js";

class RecordingLauncher implements ProcessLauncher {
  readonly capabilities = {
    filesystemIsolation: false,
    networkIsolation: false,
    cpuLimits: false,
    memoryLimits: false,
    externalWrites: false,
    readOnlyFileOverlays: false,
  };
  readonly requests: ProcessLaunchRequest[] = [];

  constructor(private readonly results: readonly ProcessExecutionResult[]) {}

  async launch(request: ProcessLaunchRequest): Promise<ProcessExecutionResult> {
    this.requests.push(request);
    const result = this.results[this.requests.length - 1];
    if (result === undefined) throw new Error("unexpected process launch");
    return result;
  }
}

class ProvenFallbackLauncher implements ProcessLauncher {
  readonly capabilities = {
    filesystemIsolation: true,
    networkIsolation: true,
    cpuLimits: false,
    memoryLimits: false,
    externalWrites: false,
    readOnlyFileOverlays: true,
  };

  async launch(): Promise<ProcessExecutionResult> {
    return result(0);
  }
}

describe("createSandboxLauncher", () => {
  it("refuses installed bubblewrap when its required namespace probe exits nonzero", async () => {
    const nativeLauncher = new RecordingLauncher([result(1, "", "namespace creation denied")]);

    await expect(createSandboxLauncher({ platform: "linux", nativeLauncher })).rejects.toMatchObject({
      code: "unsupported-isolation",
      message: expect.stringContaining("bubblewrap: probe exited with code 1: namespace creation denied"),
    });

    expect(nativeLauncher.requests).toHaveLength(1);
    expect(nativeLauncher.requests[0]).toMatchObject({
      executable: "/usr/bin/bwrap",
      network: "deny",
      readRoots: [],
      writeRoots: [],
    });
    expect(nativeLauncher.requests[0]?.args).toEqual(expect.arrayContaining([
      "--new-session",
      "--unshare-net",
      "--ro-bind",
      "/usr",
      process.execPath,
    ]));
  });

  it("refuses bubblewrap when its probe omits any required isolation evidence", async () => {
    const nativeLauncher = new RecordingLauncher([result(0, JSON.stringify({
      readRootReadable: true,
      readRootReadOnly: true,
      writeRootWritable: true,
      undeclaredPathInvisible: true,
      networkDenied: false,
    }))]);

    await expect(createSandboxLauncher({ platform: "linux", nativeLauncher })).rejects.toMatchObject({
      code: "unsupported-isolation",
      message: expect.stringContaining("bubblewrap: probe did not prove networkDenied"),
    });
  });

  it("selects only a separately proven configured fallback", async () => {
    const nativeLauncher = new RecordingLauncher([result(1)]);
    const fallbackLauncher = new ProvenFallbackLauncher();
    const unavailableFallback: SandboxBackendCandidate = {
      id: "unavailable-container",
      async probe() { return false; },
      createLauncher() { throw new Error("unavailable fallback must not be created"); },
    };
    const provenFallback: SandboxBackendCandidate = {
      id: "proven-container",
      async probe() { return provenEvidence(); },
      createLauncher() { return fallbackLauncher; },
    };

    await expect(createSandboxLauncher({
      platform: "linux",
      nativeLauncher,
      fallbackBackends: [unavailableFallback],
    })).rejects.toMatchObject({ code: "unsupported-isolation" });

    await expect(createSandboxLauncher({
      platform: "linux",
      nativeLauncher: new RecordingLauncher([result(1)]),
      fallbackBackends: [unavailableFallback, provenFallback],
    })).resolves.toBe(fallbackLauncher);
  });

  it("returns the selected backend's complete live evidence for release observation", async () => {
    const fallbackLauncher = new ProvenFallbackLauncher();
    const provenFallback: SandboxBackendCandidate = {
      id: "proven-container",
      async probe() { return provenEvidence(); },
      createLauncher() { return fallbackLauncher; },
    };

    await expect(selectSandboxLauncher({
      platform: "darwin",
      fallbackBackends: [provenFallback],
    })).resolves.toEqual({
      backendId: "proven-container",
      evidence: provenEvidence(),
      launcher: fallbackLauncher,
    });
  });

  it("rejects a fallback whose proof omits a required isolation capability", async () => {
    const fallbackLauncher = new ProvenFallbackLauncher();
    const dishonestFallback: SandboxBackendCandidate = {
      id: "dishonest-container",
      async probe() {
        return {
          readRootReadable: true,
          readRootReadOnly: true,
          writeRootWritable: true,
          undeclaredPathInvisible: true,
          networkDenied: false,
        };
      },
      createLauncher() { return fallbackLauncher; },
    };

    await expect(createSandboxLauncher({
      platform: "linux",
      nativeLauncher: new RecordingLauncher([result(1)]),
      fallbackBackends: [dishonestFallback],
    })).rejects.toMatchObject({
      code: "unsupported-isolation",
      message: expect.stringContaining("dishonest-container: probe did not prove networkDenied"),
    });
  });

  it.each([
    ["missing evidence", { readRootReadable: true, readRootReadOnly: true, writeRootWritable: true, undeclaredPathInvisible: true } as unknown as SandboxProbeEvidence, "probe did not prove networkDenied"],
    ["malformed evidence", null as unknown as SandboxProbeEvidence, "probe returned non-object evidence"],
  ])("rejects fallback %s", async (_case, evidence, diagnostic) => {
    const fallback: SandboxBackendCandidate = {
      id: "hostile-container",
      async probe() { return evidence; },
      createLauncher() { throw new Error("unproven fallback must not be created"); },
    };

    await expect(createSandboxLauncher({
      platform: "darwin",
      fallbackBackends: [fallback],
    })).rejects.toMatchObject({
      code: "unsupported-isolation",
      message: expect.stringContaining(diagnostic),
    });
  });

  it("rejects a fallback whose live probe fails", async () => {
    const fallback: SandboxBackendCandidate = {
      id: "broken-container",
      async probe() { throw new Error("probe failed"); },
      createLauncher() { throw new Error("failed fallback must not be created"); },
    };

    await expect(createSandboxLauncher({
      platform: "darwin",
      fallbackBackends: [fallback],
    })).rejects.toMatchObject({
      code: "unsupported-isolation",
      message: expect.stringContaining("broken-container: probe failed"),
    });
  });

  it("uses the capability-probed bubblewrap backend without dropping execution constraints", async () => {
    const nativeLauncher = new RecordingLauncher([provenProbe(), result(0, "validator output")]);
    const launcher = await createSandboxLauncher({ platform: "linux", nativeLauncher });
    const signal = new AbortController().signal;

    const execution = await launcher.launch({
      executable: "/usr/bin/node",
      args: ["scripts/check.mjs", "literal argument"],
      cwd: "/workspace/repository",
      env: { DECLARED: "value" },
      readRoots: ["/workspace/repository"],
      writeRoots: ["/workspace/repository/output"],
      readOnlyFileOverlays: [{ source: "/evidence/captured-check.mjs", target: "/workspace/repository/scripts/check.mjs" }],
      network: "deny",
      timeoutMs: 1_234,
      maxOutputBytes: 4_096,
      signal,
    });

    expect(execution.stdout).toBe("validator output");
    expect(nativeLauncher.requests).toHaveLength(2);
    expect(nativeLauncher.requests[1]).toMatchObject({
      executable: "/usr/bin/bwrap",
      env: {},
      network: "deny",
      timeoutMs: 1_234,
      maxOutputBytes: 4_096,
      signal,
      readRoots: [],
      writeRoots: [],
    });
    expect(nativeLauncher.requests[1]?.args).toEqual([
      "--die-with-parent",
      "--new-session",
      "--unshare-net",
      "--clearenv",
      "--ro-bind",
      "/usr",
      "/usr",
      "--ro-bind",
      "/lib",
      "/lib",
      "--ro-bind",
      "/lib64",
      "/lib64",
      "--ro-bind",
      "/workspace/repository",
      "/workspace/repository",
      "--bind",
      "/workspace/repository/output",
      "/workspace/repository/output",
      "--ro-bind",
      "/evidence/captured-check.mjs",
      "/workspace/repository/scripts/check.mjs",
      "--chdir",
      "/workspace/repository",
      "--setenv",
      "DECLARED",
      "value",
      "/usr/bin/node",
      "scripts/check.mjs",
      "literal argument",
    ]);
  });
});

function provenProbe(): ProcessExecutionResult {
  return result(0, JSON.stringify(provenEvidence()));
}

function provenEvidence() {
  return {
    readRootReadable: true,
    readRootReadOnly: true,
    writeRootWritable: true,
    undeclaredPathInvisible: true,
    networkDenied: true,
  };
}

function result(exitCode: number, stdout = "", stderr = ""): ProcessExecutionResult {
  return { exitCode, signal: null, stdout, stderr, durationMs: 1 };
}
