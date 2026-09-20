import { access, cp as copyFiles, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeReleaseCommand, isReleaseCommandCleanupUnconfirmed } from "./npm-command.mjs";

import { buildReleasePackage, releasePackageName, releaseVersion } from "./build-release-package.mjs";
import { buildPluginRuntime, checkedBuildDirectory, pluginBuildOptions } from "./build-plugin-runtime.mjs";
import { canonicalJson, inventoryCandidateFiles, releaseCandidateApiVersion, validateReleaseCandidate } from "./release-candidate.mjs";
import { assertProjectDataMigrationReleaseReady } from "./project-data-migration-release-check.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export async function buildSourceSeveredReleaseBundle(candidateRoot, options = {}) {
  options.signal?.throwIfAborted();
  const cp = async (source, target, copyOptions = {}) => {
    await copyFiles(source, target, { ...copyOptions, filter: () => { options.signal?.throwIfAborted(); return true; } });
    options.signal?.throwIfAborted();
  };
  const execute = (file, args, processOptions) => executeReleaseCommand(file, args, { ...processOptions, signal: options.signal });
  candidateRoot = await checkedBuildDirectory(resolve(candidateRoot));
  if (basename(candidateRoot) !== "release-candidate") throw new Error("release candidate output must end in release-candidate");
  const stagingRoot = await checkedBuildDirectory(join(dirname(candidateRoot), `projector-release-${process.pid}`));
  for (const workspace of [candidateRoot, stagingRoot]) {
    const exists = await lstat(workspace).then(() => true, (error) => error?.code === "ENOENT" ? false : Promise.reject(error));
    if (exists) throw new Error(`Release workspace already exists; preserve it for inspection or recovery and choose a fresh output: ${workspace}`);
  }
  await mkdir(dirname(candidateRoot), { recursive: true });
  await mkdir(candidateRoot);
  await mkdir(join(candidateRoot, "artifacts"), { recursive: true });
  let retainStaging = false;
  try {
    const tarball = await buildReleasePackage(stagingRoot, join(candidateRoot, "artifacts"), { signal: options.signal });
    // Synchronous notification; the caller owns and drains any work it starts.
    options.onTarballReady?.(tarball);
    await buildPluginRuntime(join(candidateRoot, "plugin/projector"), { releaseRoot: stagingRoot, signal: options.signal });
    await mkdir(join(candidateRoot, "fixtures"), { recursive: true });
    for (const [source, target] of [
      ["scripts/packed-lifecycle-acceptance.mjs", "packed-lifecycle-acceptance.mjs"],
      ["scripts/source-severed-release-acceptance.mjs", "source-severed-release-acceptance.mjs"],
      ["scripts/npm-command.mjs", "npm-command.mjs"],
      ["scripts/windows-job-supervisor.ps1", "windows-job-supervisor.ps1"],
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
    const formatTarget = join(repositoryRoot, "release/project-data-format-target.json");
    if (await access(formatTarget).then(() => true, (error) => error?.code === "ENOENT" ? false : Promise.reject(error))) {
      await mkdir(join(candidateRoot, "project-data"), { recursive: true });
      await cp(formatTarget, join(candidateRoot, "project-data/format-target.json"));
    }
    const legacyIngress = join(repositoryRoot, "release/project-data-legacy-ingress.json");
    if (await access(legacyIngress).then(() => true, (error) => error?.code === "ENOENT" ? false : Promise.reject(error))) {
      await mkdir(join(candidateRoot, "project-data"), { recursive: true });
      await cp(legacyIngress, join(candidateRoot, "project-data/legacy-ingress.json"));
    }

    const commandResults = await Promise.allSettled([
      execute("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
      execute("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }),
    ]);
    const commandFailures = commandResults.filter((result) => result.status === "rejected").map((result) => result.reason);
    if (commandFailures.length > 0) throw new AggregateError(commandFailures, "Release candidate input commands failed");
    const [{ stdout: packedManifestSource }, { stdout: sourceRevision }] = commandResults.map((result) => result.value);
    const packedManifest = JSON.parse(packedManifestSource);
    const pluginManifest = JSON.parse(await readFile(join(candidateRoot, "plugin/projector/.codex-plugin/plugin.json"), "utf8"));
    if (packedManifest.name !== releasePackageName || packedManifest.version !== releaseVersion || packedManifest.bin !== undefined || packedManifest.exports?.["."] !== undefined || packedManifest.exports?.["./cli"] !== undefined || packedManifest.exports?.["./operations"] === undefined) throw new Error("packed operation-only release identity does not match the candidate");
    if (pluginManifest.name !== "projector" || pluginManifest.version !== releaseVersion) throw new Error("plugin release identity does not match the candidate");

    const files = await inventoryCandidateFiles(candidateRoot, { signal: options.signal });
    if (options.allowPendingProjectDataMigration !== true) {
      await assertProjectDataMigrationReleaseReady({ repositoryRoot, packageIdentity: { name: releasePackageName, version: releaseVersion }, files, allowActiveSeal: options.allowActiveProjectDataMigrationSeal === true });
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
    options.signal?.throwIfAborted();
    return await validateReleaseCandidate(candidateRoot, { signal: options.signal });
  } catch (error) {
    if (isReleaseCommandCleanupUnconfirmed(error)) {
      retainStaging = true;
      throw new Error(`Release cleanup is unconfirmed; retained candidate ${candidateRoot} and staging ${stagingRoot} for recovery`, { cause: error });
    }
    throw error;
  } finally {
    if (!retainStaging) await rm(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const candidateRoot = process.argv[2];
  if (candidateRoot === undefined) throw new Error("usage: build-source-severed-release-bundle <release-candidate>");
  pluginBuildOptions(process.argv.slice(3));
  const result = await buildSourceSeveredReleaseBundle(candidateRoot);
  process.stdout.write(`${JSON.stringify({ status: "release-candidate-built", root: result.root, manifestHash: result.manifestHash, files: result.files.length })}\n`);
}
