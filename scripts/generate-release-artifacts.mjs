import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hashFramedDomain } from "../packages/core/dist/index.js";
import { deriveAcceptanceInventory, traceabilityEntryHash, traceabilityInventoryHash } from "../packages/testkit/dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const scenarioPaths = ["PROJECTOR_SPEC/12-delivery/acceptance-core.md", "PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md", "PROJECTOR_SPEC/12-delivery/acceptance-representation.md", "PROJECTOR_SPEC/12-delivery/acceptance-architecture.md"];
const testingPath = "PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md";
const routes = {
  architecture: ["projector/engine/architecture", "packages/engine/src/architecture/repair.test.ts#authenticated proof boundaries"],
  representation: ["projector/engine", "packages/engine/src/representation/index.test.ts#semantic representation compilation"],
  identity: ["projector/engine", "packages/engine/src/identity/index.test.ts#semantic identity resolution"],
  relevance: ["projector/engine", "packages/engine/src/relevance/index.test.ts#WHAT/WHY and WHERE/WHAT-ELSE separation"],
  recovery: ["projector/runtime", "packages/runtime/src/journal/transaction-journal.test.ts#FileTransactionJournal"],
  canonical: ["projector/runtime", "packages/runtime/src/persistence/canonical-repository.test.ts#CanonicalFileRepository"],
  invalidation: ["projector/engine", "packages/engine/src/invalidation/invalidation.test.ts#semantic signature profiles and assurance"],
  integration: ["projector/integrations", "packages/integrations/src/index.test.ts#integrations public entrypoint"],
  workflow: ["projector/cli", "packages/cli/src/vertical-slice.test.ts#mandatory misplaced repository-script vertical slice"],
};
const route = (title) => /architect|decision|preference|concern/iu.test(title) ? routes.architecture : /represent|projection|compact|token|fidelity/iu.test(title) ? routes.representation : /identity|alias|synonym|lineage|tombstone/iu.test(title) ? routes.identity : /relevance|query|open.world|event|contract|impact|surprise|cache|selector|facet/iu.test(title) ? routes.relevance : /transaction|crash|rollback|recovery/iu.test(title) ? routes.recovery : /canonical|rebuild|sqlite|storage|merge/iu.test(title) ? routes.canonical : /analyzer|signature|derivation|backdat|scc|invalidation/iu.test(title) ? routes.invalidation : /host|model|validator|authority|governance|rule|lens/iu.test(title) ? routes.integration : routes.workflow;

const scenarios = await Promise.all(scenarioPaths.map(async (path) => ({ path, text: await readFile(`${root}/${path}`, "utf8") })));
const inventory = deriveAcceptanceInventory({ scenarios, testing: { path: testingPath, text: await readFile(`${root}/${testingPath}`, "utf8") } });
const sourceCache = new Map();
const entries = [];
for (const item of inventory) {
  const [publicFacade, testRef] = route(item.title); const [path, anchor] = testRef.split("#", 2);
  let text = sourceCache.get(path); if (text === undefined) { text = await readFile(`${root}/${path}`, "utf8"); sourceCache.set(path, text); }
  if (!text.includes(`describe("${anchor}"`)) throw new Error(`traceability route has no real test anchor: ${testRef}`);
  const entry = { ...item, publicFacade, testRef, testSourceDigest: hashFramedDomain("traceability-test-source", { path, text }) };
  entries.push({ ...entry, mappingHash: traceabilityEntryHash(entry) });
}
const manifest = { version: 2, entries, inventoryHash: traceabilityInventoryHash(inventory) };
const json = `${JSON.stringify(manifest, null, 2)}\n`;
const counts = Object.fromEntries(["scenario", "property", "adversary"].map((stratum) => [stratum, inventory.filter((item) => item.stratum === stratum).length]));
const documentation = `# Projector release acceptance\n\nThis file is generated from authoritative acceptance headings and verified public test anchors.\n\n- Scenarios: ${counts.scenario}\n- Property classes: ${counts.property}\n- Adversary classes: ${counts.adversary}\n- Inventory hash: \`${manifest.inventoryHash}\`\n\nRun \`pnpm release:acceptance\` to execute the mapped tests and validate the packed artifact, installed workflow, benchmarks, rebuild, conformance, and durable release evidence.\n`;
if (process.argv.includes("--check")) {
  if (await readFile(`${root}/release/traceability.json`, "utf8") !== json || await readFile(`${root}/release/README.md`, "utf8") !== documentation) throw new Error("generated release traceability documentation drifted");
} else {
  await mkdir(`${root}/release`, { recursive: true }); await writeFile(`${root}/release/traceability.json`, json); await writeFile(`${root}/release/README.md`, documentation);
}
