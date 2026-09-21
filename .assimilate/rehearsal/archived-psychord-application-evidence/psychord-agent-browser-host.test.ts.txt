import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createPsychordAgentBrowserHost,
  type PsychordAgentBrowserHostConfiguration,
  type PsychordCommandRunner,
} from "./psychord-agent-browser-host.js";
import type { PsychordObservationPlan } from "./psychord.js";

const hash = `sha256:v1:${"0".repeat(64)}` as const;
const paths = {
  node: "C:/tools/node.exe",
  pnpm: "C:/tools/pnpm.cjs",
  agentBrowser: "C:/tools/agent-browser.exe",
  chrome: "C:/tools/chrome.exe",
};
const configuration: PsychordAgentBrowserHostConfiguration = {
  build: { nodeExecutable: paths.node, pnpmCli: paths.pnpm },
  agentBrowser: {
    executable: paths.agentBrowser,
    expectedVersion: "0.31.1",
    chromeExecutable: paths.chrome,
    namespace: "projector-run-1",
    session: "run-1",
    stdioDrainTimeoutMs: 250,
  },
  commandEnvironment: {},
};
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Psychord production host configuration", () => {
  it.each(Object.values(paths))("refuses an execution locator that is not an exact toolchain pin: %s", async (locator) => {
    let commands = 0;
    const runner: PsychordCommandRunner = {
      async run() { commands += 1; throw new Error("configuration validation must precede execution"); },
    };
    const plan = observationPlan();
    const changed = {
      ...plan,
      dependencies: plan.dependencies.map((pin) => pin.locator === locator ? { ...pin, role: "helper" as const } : pin),
    };
    const prepared = await createPsychordAgentBrowserHost({ commands: runner, configuration })
      .prepare(changed, { signal: new AbortController().signal });

    expect(prepared).toMatchObject({ status: "unavailable", cleanup: { complete: true } });
    if (prepared.status !== "unavailable") throw new Error("invalid host configuration unexpectedly prepared an attempt");
    expect(prepared.diagnostics).toContain("Psychord Windows Chrome host configuration is invalid or not pinned by the plan");
    expect(commands).toBe(0);
  });

  it("does not claim or recover a loopback endpoint when listen never acquired it", async () => {
    const root = await mkdtemp(join(tmpdir(), "psychord-host-occupied-"));
    temporaryRoots.push(root);
    await mkdir(join(root, "dist"));
    await writeFile(join(root, "dist/index.html"), "fixture");
    const blocker = createServer();
    await new Promise<void>((resolvePromise, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolvePromise);
    });
    try {
      const address = blocker.address();
      if (address === null || typeof address === "string") throw new Error("test blocker has no TCP port");
      const plan = { ...observationPlan(), repository: { ...observationPlan().repository, root }, server: {
        ...observationPlan().server,
        expectedOrigin: `http://127.0.0.1:${address.port}`,
        expectedBuildArtifacts: [{ role: "application-document", buildLocator: "dist/index.html", requestPath: "/", contentHash: sha256("fixture") }],
      } };
      const runner: PsychordCommandRunner = {
        async run(request) {
          return { exitCode: 0, signal: null, stdout: request.args[0] === "--version" ? "agent-browser 0.31.1\n" : "", stderr: "", durationMs: 1 };
        },
      };

      const prepared = await createPsychordAgentBrowserHost({ commands: runner, configuration })
        .prepare(plan, { signal: new AbortController().signal });

      expect(prepared).toMatchObject({ status: "unavailable", ownedResources: [], cleanup: { complete: true, resources: [] } });
      expect(prepared).not.toHaveProperty("recovery");
    } finally {
      await new Promise<void>((resolvePromise, reject) => blocker.close((error) => error === undefined ? resolvePromise() : reject(error)));
    }
  });
});

function observationPlan(): PsychordObservationPlan {
  return {
    runId: "run-1",
    case: "no-input",
    scenario: { id: "scenario:psychord", semanticHash: hash },
    repository: { root: "C:/work/psychord", gitHead: "0".repeat(40), worktreeDigest: hash },
    dependencies: Object.values(paths).map((locator) => ({ role: "toolchain" as const, locator, contentHash: hash })),
    ownedArtifactRoot: "C:/work/psychord/.projector/runtime/application-evidence",
    representativeInput: { code: "KeyA", holdMs: 1_500 },
    server: {
      expectedOrigin: "http://127.0.0.1:43111",
      readinessNonce: "nonce",
      readinessPath: "/.projector-ready",
      applicationPath: "/",
      expectedBuildArtifacts: [{ role: "application-document", buildLocator: "dist/index.html", requestPath: "/", contentHash: hash }],
    },
    limits: { timeoutMs: 10_000, cleanupTimeoutMs: 1_000, maximumOutputBytes: 8_192, maximumDiagnosticBytes: 4_096 },
  };
}

function sha256(value: string) {
  return `sha256:v1:${createHash("sha256").update(value).digest("hex")}` as const;
}
