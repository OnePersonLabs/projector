import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { hashFramedDomain } from "@projector/core";
import { deriveAcceptanceInventory, validateAcceptanceTestBindings, requiresPackedLifecycleArtifacts, traceabilityEntryHash, traceabilityInventoryHash, validateTraceabilityTestReferences } from "@projector/testkit";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const execute = promisify(execFile);
const portableText = (text) => text.replace(/\r\n?/gu, "\n");
const packedArtifactIds = ["packed-held-out-lifecycle", "packed-held-out-lifecycle-transcript"];

export function resolveTraceabilityAuthority(item, authority) {
  return authority?.obligations?.[item.id];
}

export function validateTraceabilityAuthorityShape(inventory, authority) {
  validateAcceptanceTestBindings(inventory, authority);
}

export function validateTraceabilityAuthority(inventory, authority, observedTestIdentities) {
  validateTraceabilityAuthorityShape(inventory, authority);
  for (const item of inventory) {
    const entry = resolveTraceabilityAuthority(item, authority);
    for (const { testRef } of entry.tests) if (!observedTestIdentities.has(testRef)) throw new Error(`traceability authority exact assertion identity was not observed: ${testRef}`);
  }
}

export function buildTraceabilityManifest(inventory, authority, sourceTexts) {
  validateTraceabilityAuthorityShape(inventory, authority);
  const entries = [];
  for (const item of [...inventory].sort((a, b) => a.id.localeCompare(b.id))) for (const { publicFacade, testRef } of [...resolveTraceabilityAuthority(item, authority).tests].sort((a, b) => a.testRef.localeCompare(b.testRef))) { const [path] = testRef.split("#", 1); const text = sourceTexts.get(path);
    if (typeof text !== "string") throw new Error(`traceability test source is missing: ${path}`);
    const requiredArtifactIds = requiresPackedLifecycleArtifacts(item) ? packedArtifactIds : undefined;
    const entry = { ...item, publicFacade, testRef, testSourceDigest: hashFramedDomain("traceability-test-source", { path, text: portableText(text) }), ...(requiredArtifactIds === undefined ? {} : { requiredArtifactIds }) };
    entries.push({ ...entry, mappingHash: traceabilityEntryHash(entry) });
  }
  return { version: 3, entries, inventoryHash: traceabilityInventoryHash(inventory) };
}

async function observeTestIdentities(authority) {
  const mappings = Object.values(authority.obligations).flatMap(({ tests }) => tests); const testFiles = [...new Set(mappings.map(({ testRef }) => testRef.split("#", 1)[0]))].sort();
  const exactNames = [...new Set(mappings.map(({ testRef }) => testRef.split("#", 2)[1]))].sort();
  const testNamePattern = `^(?:${exactNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})$`;
  let stdout;
  try {
    ({ stdout } = await execute(process.execPath, [resolve(root, "node_modules/vitest/vitest.mjs"), "list", ...testFiles, "--testNamePattern", testNamePattern, "--json"], { cwd: root, encoding: "utf8", maxBuffer: 20_000_000 }));
  } catch (error) {
    throw new Error("traceability authority test collection failed", { cause: error });
  }
  let tests;
  try { tests = JSON.parse(stdout.slice(stdout.indexOf("["))); } catch { throw new Error("traceability authority Vitest collection is invalid"); }
  if (!Array.isArray(tests)) throw new Error("traceability authority Vitest collection is incomplete");
  return new Set(tests.map(({ file, name }) => `${relative(root, resolve(root, String(file))).replaceAll("\\", "/")}#${String(name).replaceAll(" > ", " ")}`));
}

/** Read only accepted canonical owner files. Migration/proposal drafts and Markdown are never fallback authority. */
export async function readCanonicalReleaseSources(repositoryRoot) {
  const sources = [];
  async function visit(directory) {
    for (const entry of await readdir(resolve(repositoryRoot, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`release canonical owner cannot be a symlink: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".toml")) sources.push({ path, text: await readFile(resolve(repositoryRoot, path), "utf8") });
      else throw new Error(`release canonical owner migration is required: ${path}`);
    }
  }
  await visit(".projector/model/requirements");
  await visit(".projector/model/scenarios");
  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

export async function generateReleaseArtifacts({ check = false } = {}) {
  const authority = JSON.parse(await readFile(`${root}/release/traceability-authority.json`, "utf8"));
  if (authority?.version !== 2 || authority.obligations === null || typeof authority.obligations !== "object" || Array.isArray(authority.obligations)) throw new Error("canonical release test-binding migration is required");
  const legacyMappings = Object.entries(authority.obligations).flatMap(([id, entry]) => {
    if (!Array.isArray(entry?.legacyIds)) throw new Error(`explicit legacy test mapping is missing: ${id}`);
    return entry.legacyIds.map((legacyId) => ({ legacyId, ownerIds: [id] }));
  });
  const inventory = deriveAcceptanceInventory({ canonical: await readCanonicalReleaseSources(root), legacyMappings });
  validateTraceabilityAuthorityShape(inventory, authority);
  await validateTraceabilityTestReferences(root, Object.values(authority.obligations).flatMap(({ tests }) => tests.map(({ testRef }) => testRef)));
  validateTraceabilityAuthority(inventory, authority, await observeTestIdentities(authority));
  const sourceCache = new Map();
  for (const { testRef } of Object.values(authority.obligations).flatMap(({ tests }) => tests)) { const [path] = testRef.split("#", 1); if (!sourceCache.has(path)) sourceCache.set(path, await readFile(`${root}/${path}`, "utf8")); }
  const manifest = buildTraceabilityManifest(inventory, authority, sourceCache);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  const counts = Object.fromEntries(["scenario", "property", "adversary"].map((stratum) => [stratum, new Set(inventory.flatMap((item) => item.legacyIds.filter((id) => id.startsWith(`${stratum}:`)))).size]));
  const documentation = `# Projector release acceptance\n\nThis file is generated from accepted canonical semantic owners and exact test bindings. Legacy counts document migration identities, not proof of coverage.\n\n- Canonical owners: ${inventory.length}\n- Legacy scenarios: ${counts.scenario}\n- Property classes: ${counts.property}\n- Adversary classes: ${counts.adversary}\n- Inventory hash: \`${manifest.inventoryHash}\`\n\nRun \`pnpm release:acceptance\` to execute the mapped tests and validate the packed artifact, installed workflow, benchmarks, rebuild, conformance, and durable release evidence.\n`;
  if (check) {
    if (await readFile(`${root}/release/traceability.json`, "utf8") !== json || await readFile(`${root}/release/README.md`, "utf8") !== documentation) throw new Error("generated release traceability documentation drifted");
  } else {
    await mkdir(`${root}/release`, { recursive: true }); await writeFile(`${root}/release/traceability.json`, json); await writeFile(`${root}/release/README.md`, documentation);
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateReleaseArtifacts({ check: process.argv.includes("--check") });
