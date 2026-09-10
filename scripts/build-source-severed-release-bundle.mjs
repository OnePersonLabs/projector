import { execFile } from "node:child_process";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { buildReleasePackage, releasePackageName, releaseVersion } from "./build-release-package.mjs";
import { buildPluginRuntime, checkedBuildDirectory, pluginBuildOptions } from "./build-plugin-runtime.mjs";
import { canonicalJson, inventoryCandidateFiles, releaseCandidateApiVersion, validateReleaseCandidate } from "./release-candidate.mjs";
import { assertProjectDataMigrationReleaseReady } from "./project-data-migration-release-check.mjs";

const execute = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export async function buildSourceSeveredReleaseBundle(candidateRoot, options = {}) {
  candidateRoot = await checkedBuildDirectory(resolve(candidateRoot));
  if (basename(candidateRoot) !== "release-candidate") throw new Error("release candidate output must end in release-candidate");
  const stagingRoot = await checkedBuildDirectory(join(dirname(candidateRoot), `projector-release-${process.pid}`));
  await rm(candidateRoot, { recursive: true, force: true });
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(join(candidateRoot, "artifacts"), { recursive: true });
  try {
    const tarball = await buildReleasePackage(stagingRoot, join(candidateRoot, "artifacts"));
    await buildPluginRuntime(join(candidateRoot, "plugin/projector"), { releaseRoot: stagingRoot });
    await mkdir(join(candidateRoot, "fixtures"), { recursive: true });
    for (const [source, target] of [
      ["scripts/packed-lifecycle-acceptance.mjs", "packed-lifecycle-acceptance.mjs"],
      ["scripts/source-severed-release-acceptance.mjs", "source-severed-release-acceptance.mjs"],
      ["scripts/npm-command.mjs", "npm-command.mjs"],
      ["scripts/release-candidate.mjs", "release-candidate.mjs"],
      ["release/fixtures/held-out-change.json", "fixtures/held-out-change.json"],
    ]) await cp(join(repositoryRoot, source), join(candidateRoot, target));

    const migrationRoot = join(repositoryRoot, "release/project-data-migrations");
    if (await access(migrationRoot).then(() => true, (error) => error?.code === "ENOENT" ? false : Promise.reject(error))) {
      await cp(migrationRoot, join(candidateRoot, "project-data/migrations"), { recursive: true });
    }
    const formatBaseline = join(repositoryRoot, "release/project-data-format-baseline.json");
    if (await access(formatBaseline).then(() => true, (error) => error?.code === "ENOENT" ? false : Promise.reject(error))) {
      await mkdir(join(candidateRoot, "project-data"), { recursive: true });
      await cp(formatBaseline, join(candidateRoot, "project-data/format-baseline.json"));
    }

    const [{ stdout: packedManifestSource }, { stdout: sourceRevision }] = await Promise.all([
      execute("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
      execute("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }),
    ]);
    const packedManifest = JSON.parse(packedManifestSource);
    const pluginManifest = JSON.parse(await readFile(join(candidateRoot, "plugin/projector/.codex-plugin/plugin.json"), "utf8"));
    if (packedManifest.name !== releasePackageName || packedManifest.version !== releaseVersion || packedManifest.bin?.projector !== "./bin/projector.js") throw new Error("packed release identity does not match the candidate");
    if (pluginManifest.name !== "projector" || pluginManifest.version !== releaseVersion) throw new Error("plugin release identity does not match the candidate");

    const files = await inventoryCandidateFiles(candidateRoot);
    if (options.allowPendingProjectDataMigration !== true) {
      await assertProjectDataMigrationReleaseReady({ repositoryRoot, packageIdentity: { name: releasePackageName, version: releaseVersion }, files });
    }
    const manifest = {
      apiVersion: releaseCandidateApiVersion,
      release: { name: releasePackageName, version: releaseVersion, sourceRevision: sourceRevision.trim() },
      tarballPath: `artifacts/${basename(tarball)}`,
      pluginRoot: "plugin/projector",
      runnerPath: "source-severed-release-acceptance.mjs",
      fixturePath: "fixtures/held-out-change.json",
      files,
    };
    await writeFile(join(candidateRoot, "manifest.json"), `${canonicalJson(manifest)}\n`, { flag: "wx" });
    return validateReleaseCandidate(candidateRoot);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const candidateRoot = process.argv[2];
  if (candidateRoot === undefined) throw new Error("usage: build-source-severed-release-bundle <release-candidate>");
  pluginBuildOptions(process.argv.slice(3));
  const result = await buildSourceSeveredReleaseBundle(candidateRoot);
  process.stdout.write(`${JSON.stringify({ status: "release-candidate-built", root: result.root, manifestHash: result.manifestHash, files: result.files.length })}\n`);
}
