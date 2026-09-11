import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintHumanTechnical } from "@projector/engine";
import { deriveAcceptanceInventory } from "@projector/testkit";
import { readCanonicalReleaseSources } from "./generate-release-artifacts.mjs";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
function proseOnly(source) {
  return source.replace(/```[\s\S]*?```/gu, "").replace(/`[^`\n]*`/gu, "");
}

/** Typed active Requirements and Scenarios own these prose fields. Core validates their complete wire payloads. */
export async function checkAuthoritativeSpecification(repositoryRoot = defaultRoot) {
  const sources = await readCanonicalReleaseSources(repositoryRoot);
  const inventory = deriveAcceptanceInventory({ canonical: sources });
  const advisory = [];
  for (const { id, owner } of inventory) {
    const fields = [["title", owner.title]];
    if ("statement" in owner) fields.push(["statement", owner.statement]);
    if ("steps" in owner) owner.steps.forEach((step, index) => fields.push([`steps.${index}.statement`, step.statement]));
    for (const [field, text] of fields) {
      const report = lintHumanTechnical(proseOnly(text));
      // Authored canonical prose is not a selected human-technical encoding.
      advisory.push(...report.blocking.map((finding) => ({ ownerId: id, field, ...finding })));
      advisory.push(...report.advisory.map((finding) => ({ ownerId: id, field, ...finding })));
    }
  }
  return Object.freeze({ files: Object.freeze(sources.map(({ path }) => path)), ownerIds: Object.freeze(inventory.map(({ id }) => id)), blocking: Object.freeze([]), advisory: Object.freeze(advisory), semanticEquivalenceEstablished: false, truthEstablished: false });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkAuthoritativeSpecification();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.blocking.length > 0) process.exitCode = 1;
}
