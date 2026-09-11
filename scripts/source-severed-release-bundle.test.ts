import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";
import { createReleaseCandidateProjectDataFormat } from "../packages/control-plane/src/index.js";

import { buildSourceSeveredReleaseBundle } from "./build-source-severed-release-bundle.mjs";
import { releaseVersion } from "./build-release-package.mjs";
import { validateReleaseCandidate } from "./release-candidate.mjs";

const roots: string[] = [];
const execute = promisify(execFile);
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("source-severed release candidate", () => {
  it("authenticates the exact scoped tarball, plugin, runner, and fixture inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-release-candidate-test-")); roots.push(root);
    const candidate = join(root, "release-candidate");
    const built = await buildSourceSeveredReleaseBundle(candidate);
    const validated = await validateReleaseCandidate(candidate);
    const manifest = JSON.parse(await readFile(join(candidate, "manifest.json"), "utf8"));

    expect(built.manifestHash).toBe(validated.manifestHash);
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

    await writeFile(join(candidate, "fixtures/held-out-change.json"), "{}\n");
    await expect(validateReleaseCandidate(candidate)).rejects.toThrow(/digest|bytes/iu);
  }, 60_000);
});
