import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintHumanTechnical } from "@projector/engine";
import { collectCanonicalSnapshotSources, parseCanonicalSnapshotSources } from "@projector/runtime";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
function proseOnly(source) {
  return source.replace(/```[\s\S]*?```/gu, "").replace(/`[^`\n]*`/gu, "");
}

/** Typed active Requirements and Scenarios own these prose fields. Core validates their complete wire payloads. */
export async function checkAuthoritativeSpecification(repositoryRoot = defaultRoot) {
  const sources = await collectCanonicalSnapshotSources(repositoryRoot);
  const snapshot = parseCanonicalSnapshotSources(sources);
  const inventory = snapshot.documents.filter(({kind, lifecycle}) => ["requirement", "behavioral-scenario"].includes(kind) && lifecycle === "active").map(({id,payload}) => ({id, owner:payload}));
  if (inventory.length === 0) throw new Error("Active canonical requirement/scenario owners are missing");
  const ownerSources = sources.filter(({relativePath}) => /^model\/(?:requirements|scenarios)\//u.test(relativePath));
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
  return Object.freeze({ files: Object.freeze(ownerSources.map(({ path }) => path)), ownerIds: Object.freeze(inventory.map(({ id }) => id)), blocking: Object.freeze([]), advisory: Object.freeze(advisory), semanticEquivalenceEstablished: false, truthEstablished: false });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkAuthoritativeSpecification();
  process.stdout.write(`${JSON.stringify(process.argv.includes("--json") ? report : {owners:report.ownerIds.length,advisory:report.advisory.length,blocking:report.blocking.length, note:"Style findings are advisory; schema validity is enforced."}, null, 2)}\n`);
  if (report.blocking.length > 0) process.exitCode = 1;
}
