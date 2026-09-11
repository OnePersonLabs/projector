import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { runPackedLifecycleAcceptance } from "./packed-lifecycle-acceptance.mjs";
import { canonicalJson, hashBytes, hashCanonical, releasePackageName, validateReleaseCandidate } from "./release-candidate.mjs";
import { resolveNpmCommand } from "./npm-command.mjs";

const execute = promisify(execFile);

export async function installTarball(consumer, tarball, temporaryRoot) {
  await mkdir(consumer, { recursive: true });
  await writeFile(join(consumer, "package.json"), `${canonicalJson({ private: true, type: "module" })}\n`);
  const isolatedNpmConfig = join(temporaryRoot, "empty-npmrc");
  await writeFile(isolatedNpmConfig, "");
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith("npm_config_")));
  environment.NPM_CONFIG_USERCONFIG = isolatedNpmConfig;
  const npmArguments = ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarball];
  const { executable, arguments: arguments_ } = await resolveNpmCommand(npmArguments);
  await execute(executable, arguments_, { cwd: consumer, env: environment, encoding: "utf8", maxBuffer: 20_000_000 });
}

export async function runSourceSeveredReleaseAcceptance(candidateRoot) {
  const candidate = await validateReleaseCandidate(candidateRoot);
  const { manifest, root } = candidate;
  const tarball = join(root, manifest.tarballPath);
  const [{ stdout: packageSource }, pluginSource, operationSource, fixtureSource] = await Promise.all([
    execute("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
    readFile(join(root, manifest.pluginRoot, ".codex-plugin/plugin.json"), "utf8"),
    readFile(join(root, manifest.pluginRoot, "scripts/projector-operation.mjs"), "utf8"),
    readFile(join(root, manifest.fixturePath), "utf8"),
  ]);
  const packageManifest = JSON.parse(packageSource);
  const pluginManifest = JSON.parse(pluginSource);
  const fixture = JSON.parse(fixtureSource);
  if (packageManifest.name !== releasePackageName || packageManifest.version !== manifest.release.version || packageManifest.bin !== undefined || packageManifest.exports?.["."] !== undefined || packageManifest.exports?.["./cli"] !== undefined || packageManifest.exports?.["./operations"] === undefined) throw new Error("downloaded tarball has the wrong operation-only release identity");
  if (pluginManifest.name !== "projector" || pluginManifest.version !== manifest.release.version || pluginManifest.mcpServers !== undefined || !operationSource.includes("createBundledProjectorOperationRunner")) throw new Error("downloaded plugin has the wrong operation-runner identity");
  if (fixture.version !== 1 || typeof fixture.request !== "string" || !Array.isArray(fixture.expectedPaths)) throw new Error("downloaded held-out fixture has an invalid contract");

  const resultsRoot = join(root, "results");
  await rm(resultsRoot, { recursive: true, force: true });
  await mkdir(resultsRoot, { recursive: true });
  const temporary = await mkdtemp(join(tmpdir(), "projector-source-severed-release-"));
  try {
    const packed = await runPackedLifecycleAcceptance({
      temporaryRoot: join(temporary, "acceptance"),
      candidateRoot: root,
    });
    const evidencePath = "results/packed-held-out-lifecycle.json";
    const transcriptPath = "results/packed-held-out-lifecycle-transcript.json";
    await writeFile(join(root, evidencePath), `${canonicalJson(packed.evidence)}\n`);
    await writeFile(join(root, transcriptPath), `${canonicalJson(packed.transcript)}\n`);
    const pluginFiles = manifest.files.filter(({ path }) => path.startsWith(`${manifest.pluginRoot}/`));
    const digests = {
      apiVersion: "projector.release-acceptance-digests/v1",
      release: manifest.release,
      candidateManifestHash: candidate.manifestHash,
      tarballHash: manifest.files.find(({ path }) => path === manifest.tarballPath)?.digest,
      pluginBundleHash: hashCanonical(pluginFiles),
      fixtureHash: manifest.files.find(({ path }) => path === manifest.fixturePath)?.digest,
      evidencePath,
      evidenceHash: packed.evidenceHash,
      evidenceBytesHash: hashBytes(await readFile(join(root, evidencePath))),
      transcriptPath,
      transcriptHash: packed.transcriptHash,
      transcriptBytesHash: hashBytes(await readFile(join(root, transcriptPath))),
    };
    await writeFile(join(resultsRoot, "digests.json"), `${canonicalJson(digests)}\n`);
    const revalidated = await validateReleaseCandidate(root);
    if (revalidated.manifestHash !== candidate.manifestHash) throw new Error("release candidate inputs changed during acceptance");
    return { status: "source-severed-release-accepted", runId: packed.runId, manifestHash: candidate.manifestHash, evidenceHash: packed.evidenceHash, transcriptHash: packed.transcriptHash, resultsRoot };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const candidateRoot = process.argv[2];
  if (candidateRoot === undefined) throw new Error("usage: source-severed-release-acceptance <release-candidate>");
  process.stdout.write(`${JSON.stringify(await runSourceSeveredReleaseAcceptance(candidateRoot))}\n`);
}
