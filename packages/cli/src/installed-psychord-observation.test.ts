import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPsychordApplicationObservationPlan, type PsychordObservationPlan } from "@projector/integrations/runtime-evidence";
import { afterEach, describe, expect, test } from "vitest";

import { createInstalledPsychordObservationFactory } from "./installed-psychord-observation.js";

const roots: string[] = [];
const hash = `sha256:v1:${"1".repeat(64)}` as const;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("installed Psychord observation composition", () => {
  test("resolves selected PATH package tools and one stable repository artifact root", async () => {
    if (process.platform !== "win32") return;
    const root = await mkdtemp(join(tmpdir(), "projector-installed-psychord-"));
    roots.push(root);
    const tools = await fakeTools(root);
    const plan = observationPlan(root, tools);
    const service = await createInstalledPsychordObservationFactory()({
      repositoryRoot: root,
      plan,
      signal: new AbortController().signal,
      environment: {
        ...process.env,
        PATH: tools.pathDirectory,
        PROJECTOR_CHROME_EXECUTABLE: tools.chrome,
      },
    });

    await expect(stat(join(root, ".projector/runtime/application-evidence"))).resolves.toMatchObject({});
    await expect(service.read("psychord-unpublished-run")).resolves.toEqual({
      status: "missing",
      artifactSetId: "psychord-unpublished-run",
    });
  });

  test("rejects a plan for another worktree before creating artifact state", async () => {
    if (process.platform !== "win32") return;
    const root = await mkdtemp(join(tmpdir(), "projector-installed-psychord-root-"));
    const other = await mkdtemp(join(tmpdir(), "projector-installed-psychord-other-"));
    roots.push(root, other);
    const tools = await fakeTools(root);

    await expect(createInstalledPsychordObservationFactory()({
      repositoryRoot: other,
      plan: observationPlan(root, tools),
      signal: new AbortController().signal,
      environment: process.env,
    })).rejects.toThrow(/repository does not match/iu);
    await expect(stat(join(other, ".projector"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function fakeTools(root: string) {
  const directory = join(root, "tools");
  await mkdir(join(directory, "node_modules/pnpm/bin"), { recursive: true });
  await mkdir(join(directory, "node_modules/agent-browser/bin"), { recursive: true });
  const tools = {
    node: process.execPath,
    pnpm: join(directory, "node_modules/pnpm/bin/pnpm.cjs"),
    agentBrowser: join(directory, "node_modules/agent-browser/bin/agent-browser-win32-x64.exe"),
    chrome: join(directory, "chrome.exe"),
    pathDirectory: directory,
  };
  await Promise.all([
    writeFile(join(directory, "pnpm.cmd"), "fixture\n"),
    writeFile(join(directory, "agent-browser.cmd"), "fixture\n"),
    writeFile(join(directory, "node_modules/pnpm/package.json"), JSON.stringify({ name: "pnpm", version: "10.30.0", bin: { pnpm: "bin/pnpm.cjs" } })),
    writeFile(join(directory, "node_modules/agent-browser/package.json"), JSON.stringify({ name: "agent-browser", version: "0.31.1", bin: { "agent-browser": "bin/agent-browser.js" } })),
    writeFile(tools.pnpm, "fixture\n"),
    writeFile(tools.agentBrowser, "fixture\n"),
    writeFile(tools.chrome, "fixture\n"),
  ]);
  return tools;
}

function observationPlan(root: string, tools: Awaited<ReturnType<typeof fakeTools>>) {
  const input: PsychordObservationPlan = {
    runId: "installed-psychord-run",
    case: "no-input",
    scenario: { id: "scenario:installed-psychord", semanticHash: hash },
    repository: { root, gitHead: "a".repeat(40), worktreeDigest: hash },
    dependencies: [tools.node, tools.pnpm, tools.agentBrowser, tools.chrome].map((locator) => ({ role: "toolchain" as const, locator, contentHash: hash })),
    ownedArtifactRoot: join(root, ".projector/runtime/application-evidence"),
    representativeInput: { code: "KeyA", holdMs: 1 },
    server: {
      expectedOrigin: "http://127.0.0.1:4173",
      readinessNonce: "installed-ready",
      readinessPath: "/.projector-ready",
      applicationPath: "/",
      expectedBuildArtifacts: [{ role: "document", buildLocator: "dist/index.html", requestPath: "/", contentHash: hash }],
    },
    limits: { timeoutMs: 1_000, cleanupTimeoutMs: 100, maximumOutputBytes: 4_096, maximumDiagnosticBytes: 1_024 },
  };
  return createPsychordApplicationObservationPlan(input);
}
