import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { hashFramedDomain } from "../packages/core/dist/index.js";
import { deriveAcceptanceInventory, PACKED_LIFECYCLE_OBLIGATION_IDS, traceabilityEntryHash, traceabilityInventoryHash, validateTraceabilityTestReferences } from "../packages/testkit/dist/index.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const execute = promisify(execFile);
const portableText = (text) => text.replace(/\r\n?/gu, "\n");
const scenarioPaths = ["PROJECTOR_SPEC/12-delivery/acceptance-core.md", "PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md", "PROJECTOR_SPEC/12-delivery/acceptance-representation.md", "PROJECTOR_SPEC/12-delivery/acceptance-architecture.md"];
const testingPath = "PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md";
const packedArtifactIds = ["packed-held-out-lifecycle", "packed-held-out-lifecycle-transcript"];

export function resolveTraceabilityAuthority(item, authority) {
  return authority?.obligations?.[item.id];
}

export function validateTraceabilityAuthorityShape(inventory, authority) {
  if (authority?.version !== 1 || authority.obligations === null || typeof authority.obligations !== "object" || Array.isArray(authority.obligations)) throw new Error("traceability authority has an unsupported shape");
  const expectedIds = inventory.map(({ id }) => id).sort();
  const actualIds = Object.keys(authority.obligations).sort();
  const missing = expectedIds.filter((id) => !actualIds.includes(id));
  const extra = actualIds.filter((id) => !expectedIds.includes(id));
  if (missing.length > 0 || extra.length > 0) throw new Error(`traceability authority exact obligation IDs are incomplete; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`);
  for (const item of inventory) {
    const entry = resolveTraceabilityAuthority(item, authority);
    const keys = entry !== null && typeof entry === "object" ? Object.keys(entry).sort() : [];
    if (entry?.obligationId !== item.id || typeof entry?.publicFacade !== "string" || entry.publicFacade.length === 0 || typeof entry?.testRef !== "string" || entry.testRef.split("#", 2).length !== 2 || JSON.stringify(keys) !== JSON.stringify(["obligationId", "publicFacade", "testRef"])) throw new Error(`traceability authority mapping is invalid for exact obligation ${item.id}`);
  }
}

export function validateTraceabilityAuthority(inventory, authority, observedTestIdentities) {
  validateTraceabilityAuthorityShape(inventory, authority);
  for (const item of inventory) {
    const entry = resolveTraceabilityAuthority(item, authority);
    if (!observedTestIdentities.has(entry.testRef)) throw new Error(`traceability authority exact assertion identity was not observed: ${entry.testRef}`);
  }
}

export function buildTraceabilityManifest(inventory, authority, sourceTexts) {
  const entries = [];
  for (const item of inventory) {
    const { publicFacade, testRef } = resolveTraceabilityAuthority(item, authority); const [path] = testRef.split("#", 1); const text = sourceTexts.get(path);
    if (typeof text !== "string") throw new Error(`traceability test source is missing: ${path}`);
    const requiredArtifactIds = PACKED_LIFECYCLE_OBLIGATION_IDS.has(item.id) ? packedArtifactIds : undefined;
    const entry = { ...item, publicFacade, testRef, testSourceDigest: hashFramedDomain("traceability-test-source", { path, text: portableText(text) }), ...(requiredArtifactIds === undefined ? {} : { requiredArtifactIds }) };
    entries.push({ ...entry, mappingHash: traceabilityEntryHash(entry) });
  }
  return { version: 2, entries, inventoryHash: traceabilityInventoryHash(inventory) };
}

async function observeTestIdentities(authority) {
  const mappings = Object.values(authority.obligations); const testFiles = [...new Set(mappings.map(({ testRef }) => testRef.split("#", 1)[0]))].sort();
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

export async function generateReleaseArtifacts({ check = false } = {}) {
  const scenarios = await Promise.all(scenarioPaths.map(async (path) => ({ path, text: await readFile(`${root}/${path}`, "utf8") })));
  const inventory = deriveAcceptanceInventory({ scenarios, testing: { path: testingPath, text: await readFile(`${root}/${testingPath}`, "utf8") } });
  const authority = JSON.parse(await readFile(`${root}/release/traceability-authority.json`, "utf8"));
  validateTraceabilityAuthorityShape(inventory, authority);
  await validateTraceabilityTestReferences(root, Object.values(authority.obligations).map(({ testRef }) => testRef));
  validateTraceabilityAuthority(inventory, authority, await observeTestIdentities(authority));
  const sourceCache = new Map();
  for (const { testRef } of Object.values(authority.obligations)) { const [path] = testRef.split("#", 1); if (!sourceCache.has(path)) sourceCache.set(path, await readFile(`${root}/${path}`, "utf8")); }
  const manifest = buildTraceabilityManifest(inventory, authority, sourceCache);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  const counts = Object.fromEntries(["scenario", "property", "adversary"].map((stratum) => [stratum, inventory.filter((item) => item.stratum === stratum).length]));
  const documentation = `# Projector release acceptance\n\nThis file is generated from authoritative acceptance headings and an explicit exact-ID assertion authority.\n\n- Scenarios: ${counts.scenario}\n- Property classes: ${counts.property}\n- Adversary classes: ${counts.adversary}\n- Inventory hash: \`${manifest.inventoryHash}\`\n\nRun \`pnpm release:acceptance\` to execute the mapped tests and validate the packed artifact, installed workflow, benchmarks, rebuild, conformance, and durable release evidence.\n`;
  if (check) {
    if (await readFile(`${root}/release/traceability.json`, "utf8") !== json || await readFile(`${root}/release/README.md`, "utf8") !== documentation) throw new Error("generated release traceability documentation drifted");
  } else {
    await mkdir(`${root}/release`, { recursive: true }); await writeFile(`${root}/release/traceability.json`, json); await writeFile(`${root}/release/README.md`, documentation);
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateReleaseArtifacts({ check: process.argv.includes("--check") });
