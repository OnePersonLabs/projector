import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createReleaseCandidateProjectDataFormat } from "../packages/control-plane/src/index.js";

import { buildSourceSeveredReleaseBundle } from "./build-source-severed-release-bundle.mjs";
import { releaseVersion } from "./build-release-package.mjs";
import * as releasePackageBuilder from "./build-release-package.mjs";
import * as pluginRuntimeBuilder from "./build-plugin-runtime.mjs";
import * as releaseCommands from "./npm-command.mjs";
import { validateReleaseCandidate } from "./release-candidate.mjs";
import { executeReleaseCommand, isReleaseCommandCleanupUnconfirmed } from "./npm-command.mjs";
import { installTarball } from "./source-severed-release-acceptance.mjs";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("source-severed release candidate", () => {
  it.each(["candidate", "staging"])("refuses an existing %s workspace without deleting retry evidence", async (existing) => {
    const root = await mkdtemp(join(tmpdir(), "projector-release-retry-test-")); roots.push(root);
    const candidate = join(root, "release-candidate");
    const staging = join(root, `projector-release-${process.pid}`);
    const retained = existing === "candidate" ? candidate : staging;
    await mkdir(retained);
    await writeFile(join(retained, "recovery-evidence.txt"), "retained process workspace");
    const pack = vi.spyOn(releasePackageBuilder, "buildReleasePackage").mockRejectedValueOnce(new Error("must not reach packaging"));
    try {
      await expect(buildSourceSeveredReleaseBundle(candidate)).rejects.toThrow("already exists");
      expect(pack).not.toHaveBeenCalled();
      expect(await readFile(join(retained, "recovery-evidence.txt"), "utf8")).toBe("retained process workspace");
    } finally {
      pack.mockRestore();
    }
  });

  it("preserves uncertainty when an earlier parallel command has an ordinary failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-release-parallel-failure-test-")); roots.push(root);
    const candidate = join(root, "release-candidate");
    const staging = join(root, `projector-release-${process.pid}`);
    const tarFailure = new Error("tar failed normally");
    const gitFailure = Object.assign(new Error("git descendants may remain"), { code: "RELEASE_COMMAND_CLEANUP_UNCONFIRMED" });
    const pack = vi.spyOn(releasePackageBuilder, "buildReleasePackage").mockImplementationOnce(async () => {
      await mkdir(staging);
      return join(candidate, "artifacts/fixture.tgz");
    });
    const plugin = vi.spyOn(pluginRuntimeBuilder, "buildPluginRuntime").mockResolvedValueOnce({ root: candidate, releaseVersion, nodeRuntime: { executable: "node", resolution: "host-path" } });
    const commands = vi.spyOn(releaseCommands, "executeReleaseCommand").mockImplementation(async (file) => {
      if (file === "tar") throw tarFailure;
      if (file === "git") throw gitFailure;
      throw new Error(`Unexpected command: ${file}`);
    });
    try {
      const failure = await buildSourceSeveredReleaseBundle(candidate).catch((error: unknown) => error);
      expect(failure).toMatchObject({ cause: { errors: [tarFailure, gitFailure] } });
      expect(isReleaseCommandCleanupUnconfirmed(failure)).toBe(true);
      await expect(access(staging)).resolves.toBeUndefined();
      await expect(access(candidate)).resolves.toBeUndefined();
    } finally {
      commands.mockRestore();
      plugin.mockRestore();
      pack.mockRestore();
    }
  });

  it.each([false, true])("retains staging only when process cleanup is unconfirmed (%s)", async (unconfirmed) => {
    const root = await mkdtemp(join(tmpdir(), "projector-release-cleanup-test-")); roots.push(root);
    const candidate = join(root, "release-candidate");
    const staging = join(root, `projector-release-${process.pid}`);
    const failure = unconfirmed
      ? new AggregateError([new Error("wrapped", { cause: Object.assign(new Error("owned process still active"), { code: "RELEASE_COMMAND_CLEANUP_UNCONFIRMED" }) })])
      : new Error("ordinary packaging failure");
    const pack = vi.spyOn(releasePackageBuilder, "buildReleasePackage").mockImplementationOnce(async () => {
      await mkdir(staging);
      throw failure;
    });
    try {
      if (unconfirmed) {
        await expect(buildSourceSeveredReleaseBundle(candidate)).rejects.toThrow(staging);
        await expect(access(staging)).resolves.toBeUndefined();
        await expect(access(candidate)).resolves.toBeUndefined();
      } else {
        await expect(buildSourceSeveredReleaseBundle(candidate)).rejects.toThrow("ordinary packaging failure");
        await expect(access(staging)).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      pack.mockRestore();
    }
  });

  it("authenticates the exact scoped tarball, plugin, runner, and fixture inputs", async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Release integration exceeded its 27s work deadline")), 27_000);
    const execute = (file: string, args: string[], options = {}) => executeReleaseCommand(file, args, { ...options, signal: controller.signal });
    let installation: Promise<PromiseSettledResult<void>[]> | undefined;
    let fixtureRoot: string | undefined;
    let workflowFailure: unknown;
    try {
      const root = await mkdtemp(join(tmpdir(), "projector release & 100%-")); roots.push(root);
      fixtureRoot = root;
      const candidate = join(root, "release-candidate");
      const consumer = join(root, "ordinary consumer");
      const built = await buildSourceSeveredReleaseBundle(candidate, {
        signal: controller.signal,
        onTarballReady: (tarball: string) => {
          installation = Promise.allSettled([installTarball(consumer, tarball, root, { signal: controller.signal })]);
        },
      });
      expect(installation).toBeDefined();
      const validated = built;
      const manifest = JSON.parse(await readFile(join(candidate, "manifest.json"), "utf8"));

      expect(manifest.release).toMatchObject({ name: "@onepersonlabs/projector", version: releaseVersion });
      expect(manifest.files.map(({ path }: { path: string }) => path)).toEqual(expect.arrayContaining([
        manifest.tarballPath,
        "plugin/projector/.codex-plugin/plugin.json",
        "plugin/projector/runtime/projector/exports/operations.js",
        "plugin/projector/scripts/projector-operation.mjs",
        "plugin/projector/runtime/projector/node_modules/@projector/runtime/package.json",
        "packed-lifecycle-acceptance.mjs",
        "source-severed-release-acceptance.mjs",
        "npm-command.mjs",
        "release-candidate.mjs",
        "fixtures/held-out-change.json",
      ]));
      expect(manifest.files.map(({ path }: { path: string }) => path)).not.toContain("plugin/projector/runtime/projector/bin/projector.js");
      expect(manifest.files.map(({ path }: { path: string }) => path)).not.toContain("provision-ubuntu-sandbox.sh");
      expect(validated.files).toHaveLength(manifest.files.length);
      const format = createReleaseCandidateProjectDataFormat({
        candidate: {
          packageIdentity: { name: validated.manifest.release.name, version: validated.manifest.release.version },
          files: validated.files.map(({ path, digest }) => ({ path, digest })),
        },
      });
      expect(format).toMatchObject({
        packageIdentity: { name: manifest.release.name, version: manifest.release.version },
        snapshotHash: expect.stringMatching(/^sha256:v1:/u),
      });

      const tarball = join(candidate, manifest.tarballPath);
      const { stdout: packageSource } = await execute("tar", ["-xOf", tarball, "package/package.json"]);
      const packedManifest = JSON.parse(packageSource);
      expect(packedManifest).toMatchObject({ name: "@onepersonlabs/projector", version: releaseVersion });
      expect(packedManifest.bin).toBeUndefined();
      expect(Object.fromEntries(Object.entries(packedManifest.dependencies).filter(([name]) => name.startsWith("@projector/")))).toEqual(Object.fromEntries(
        ["core", "analyzers", "engine", "runtime", "integrations", "control-plane", "testkit"].map((name) => [`@projector/${name}`, releaseVersion]),
      ));
      expect(Object.keys(packedManifest.exports)).toEqual(["./operations", "./core", "./analyzers", "./engine", "./engine/architecture", "./engine/coverage", "./engine/modernization", "./runtime", "./integrations", "./integrations/surfaces", "./integrations/models", "./integrations/codex", "./control-plane", "./testkit"]);
      expect(await readFile(tarball)).not.toHaveLength(0);
      const { stdout: packedFiles } = await execute("tar", ["-tf", tarball]);
      expect(packedFiles).toContain("package/dist/operation-runner.js");
      expect(packedFiles).not.toMatch(/package\/(?:bin\/projector\.js|dist\/(?:cli|host-cli|knowledge-cli|mcp-cli|policy|upgrade)\.js)/u);

      const repository = join(root, "source checkout absent");
      await mkdir(repository);
      await execute("git", ["init", "--quiet"], { cwd: repository });
      await mkdir(join(repository, "src"));
      await mkdir(join(repository, "test"));
      await writeFile(join(repository, "src", "format-label.mjs"), "export const formatLabel = (value) => String(value);\n");
      await writeFile(join(repository, "test", "format-label.test.mjs"), "import assert from 'node:assert/strict'; import { formatLabel } from '../src/format-label.mjs'; assert.equal(formatLabel('alpha'), 'alpha');\n");
      await writeFile(join(repository, "package.json"), '{"type":"module"}\n');
      await execute("git", ["add", "."], { cwd: repository });
      await execute("git", ["-c", "user.name=Release Test", "-c", "user.email=release@example.invalid", "commit", "--quiet", "-m", "initial"], { cwd: repository });
      const env = { ...process.env, NODE_PATH: "" };
      const operationEntry = join(candidate, "plugin/projector/scripts/projector-operation.mjs");
      const invoke = async (operation: string, input: unknown) => {
        const request = { apiVersion: "projector.operation/v1", operation, repositoryRoot: repository, input };
        const requestPath = join(root, `${operation.replaceAll(".", "-")}-request.json`);
        await writeFile(requestPath, `${JSON.stringify(request)}\n`);
        try {
          const { stdout } = await execute(process.execPath, [operationEntry, requestPath], { cwd: repository, env, encoding: "utf8" });
          return JSON.parse(stdout);
        } catch (error) {
          if (isReleaseCommandCleanupUnconfirmed(error)) throw error;
          controller.signal.throwIfAborted();
          if (error !== null && typeof error === "object" && "stdout" in error && typeof error.stdout === "string") return JSON.parse(error.stdout);
          throw error;
        }
      };
      expect(await invoke("status", {})).toMatchObject({
        status: "succeeded",
        operation: "status",
        output: { operations: expect.arrayContaining([{ operation: "application.observe", registered: true, reachable: true, reason: expect.any(String) }]) },
      });
      expect(await invoke("init", {})).toMatchObject({ status: "succeeded", operation: "init", output: { created: true, readiness: { status: "ready" } } });
      expect(await invoke("context", { request: "Preserve label formatting behavior." })).toMatchObject({ status: "succeeded", operation: "context", output: { persisted: true } });
      const proposal = {
        apiVersion: "projector.change-proposal/v1",
        requirements: [{ key: "formatted-label", title: "Formatted label", statement: "A label is formatted for callers.", aliases: [] }],
        scenarios: [{ key: "format-label", title: "Format label", aliases: [], steps: [
          { role: "trigger", statement: "A caller formats a label." },
          { role: "expected-outcome", statement: "The formatted label is returned." },
        ] }],
        architecture: null,
        edits: [{ path: "src/format-label.mjs", before: "export const formatLabel = (value) => String(value);\n", after: "export const formatLabel = (value) => String(value).trim();\n" }],
        validation: { independentNodeTests: ["test/format-label.test.mjs"], supplementalNodeTests: [] },
        analysisFacets: ["architecture", "behavior"],
      };
      const captured = await invoke("change.capture", { request: "Trim label whitespace.", proposal });
      expect(captured, JSON.stringify(captured)).toMatchObject({ status: "succeeded", operation: "change.capture", output: { selector: expect.any(String) } });
      expect(await invoke("change.plan", { changeSelector: captured.output.selector })).toMatchObject({ status: "succeeded", operation: "change.plan", output: { immutablePlanHash: expect.stringMatching(/^sha256:v1:/u) } });

      const [installed] = await installation!;
      if (installed.status === "rejected") throw installed.reason;
      expect(JSON.parse(await readFile(join(consumer, "node_modules/@onepersonlabs/projector/package.json"), "utf8"))).toMatchObject({ name: "@onepersonlabs/projector", version: releaseVersion });
      expect(JSON.parse(await readFile(join(consumer, "node_modules/@onepersonlabs/projector/project-data/format-baseline.json"), "utf8"))).toMatchObject({ packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" } });

      await writeFile(join(candidate, "fixtures/held-out-change.json"), "{}\n");
      await expect(validateReleaseCandidate(candidate, { signal: controller.signal })).rejects.toThrow(/digest|bytes/iu);
    } catch (error) {
      workflowFailure = error;
      throw error;
    } finally {
      clearTimeout(timer);
      controller.abort();
      const installResults = await installation;
      const installFailure = installResults?.find((result) => result.status === "rejected")?.reason;
      if (isReleaseCommandCleanupUnconfirmed(workflowFailure) || isReleaseCommandCleanupUnconfirmed(installFailure)) {
        if (fixtureRoot !== undefined) roots.splice(roots.indexOf(fixtureRoot), 1);
        throw new Error(`Release cleanup is unconfirmed; retained fixture ${fixtureRoot} for recovery`, {
          cause: new AggregateError([workflowFailure, installFailure].filter((error) => error !== undefined)),
        });
      }
    }
  }, 30_000);
});
