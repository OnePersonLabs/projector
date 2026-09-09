import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildSourceSeveredReleaseBundle } from "./build-source-severed-release-bundle.mjs";
import { validateReleaseCandidate } from "./release-candidate.mjs";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("source-severed release candidate", () => {
  it("authenticates the exact scoped tarball, plugin, runner, fixture, and provisioning inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-release-candidate-test-")); roots.push(root);
    const candidate = join(root, "release-candidate");
    const built = await buildSourceSeveredReleaseBundle(candidate);
    const validated = await validateReleaseCandidate(candidate);
    const manifest = JSON.parse(await readFile(join(candidate, "manifest.json"), "utf8"));

    expect(built.manifestHash).toBe(validated.manifestHash);
    expect(manifest.release).toMatchObject({ name: "@onepersonlabs/projector", version: "2.1.0" });
    expect(manifest.files.map(({ path }: { path: string }) => path)).toEqual(expect.arrayContaining([
      manifest.tarballPath,
      "plugin/projector/.codex-plugin/plugin.json",
      "packed-lifecycle-acceptance.mjs",
      "source-severed-release-acceptance.mjs",
      "release-candidate.mjs",
      "fixtures/held-out-change.json",
      "provision-ubuntu-sandbox.sh",
    ]));
    expect(validated.files).toHaveLength(manifest.files.length);

    await writeFile(join(candidate, "fixtures/held-out-change.json"), "{}\n");
    await expect(validateReleaseCandidate(candidate)).rejects.toThrow(/digest|bytes/iu);
  });
});
