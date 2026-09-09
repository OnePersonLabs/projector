import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { buildReleasePackage } from "./build-release-package.mjs";
import { installTarball } from "./source-severed-release-acceptance.mjs";

const execute = promisify(execFile);
const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))));

describe("scoped Projector release package", () => {
  it("packs exactly @onepersonlabs/projector 2.1.0 with the projector executable and coherent internal versions", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector release & 100%-")); roots.push(root);
    const tarball = await buildReleasePackage(join(root, "projector-release-staging"), join(root, "packs & 100%"));
    const { stdout } = await execute("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" });
    const manifest = JSON.parse(stdout) as { name: string; version: string; bin: Record<string, string>; dependencies: Record<string, string>; exports: Record<string, unknown> };

    expect(manifest).toMatchObject({ name: "@onepersonlabs/projector", version: "2.1.0", bin: { projector: "./bin/projector.js" } });
    expect(Object.fromEntries(Object.entries(manifest.dependencies).filter(([name]) => name.startsWith("@projector/")))).toEqual(Object.fromEntries(
      ["core", "analyzers", "engine", "runtime", "integrations", "control-plane", "testkit"].map((name) => [`@projector/${name}`, "2.1.0"]),
    ));
    expect(Object.keys(manifest.exports)).toEqual([".", "./cli", "./core", "./analyzers", "./engine", "./engine/architecture", "./engine/coverage", "./engine/modernization", "./runtime", "./integrations", "./integrations/surfaces", "./integrations/models", "./integrations/codex", "./testkit"]);
    expect(await readFile(tarball)).not.toHaveLength(0);

    const consumer = join(root, "ordinary consumer");
    await installTarball(consumer, tarball, root);
    const installed = JSON.parse(await readFile(join(consumer, "node_modules/@onepersonlabs/projector/package.json"), "utf8"));
    expect(installed).toMatchObject({ name: "@onepersonlabs/projector", version: "2.1.0" });
  }, 30_000);
});
