import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { exportContractJsonSchemas, validateJsonSchemaReferences } from "../packages/core/dist/index.js";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "plugins/projector/skills/projector-change");
const schemaPath = resolve(directory, "change-proposal.schema.json");
const guidePath = resolve(directory, "proposal-schema.md");
const schemas = exportContractJsonSchemas();
const schema = schemas.ChangeProposal;
if (schema === undefined) throw new Error("core contract registry does not export ChangeProposal");
const referenceFailures = validateJsonSchemaReferences(schemas).filter((failure) => failure.includes("ChangeProposal"));
if (referenceFailures.length > 0) throw new Error(referenceFailures.join("\n"));

const schemaBytes = `${JSON.stringify(schema, null, 2)}\n`;
const guideBytes = `# Strict change proposal

This guide and [change-proposal.schema.json](change-proposal.schema.json) are generated from the strict \`ChangeProposalSchema\` exported by \`@projector/core\`. Do not edit either generated file by hand.

Write one JSON document that validates against the generated schema. Unknown top-level or nested fields fail closed. Repository paths must be canonical, repository-relative, non-reserved paths. Exact edits cannot overlap independent validators. Requirement, scenario, alias, validator, and architecture-deferral constraints are enforced by the same core parser used by the installed lifecycle.

Validate the proposal by passing it to \`projector change <request> --proposal <path>\`. A proposal is interpretation evidence, not approval or mutation authority.
`;

const outputs = [[schemaPath, schemaBytes], [guidePath, guideBytes]];
if (process.argv.includes("--check")) {
  const stale = [];
  for (const [path, bytes] of outputs) {
    try { if (await readFile(path, "utf8") !== bytes) stale.push(path); }
    catch { stale.push(path); }
  }
  if (stale.length > 0) throw new Error(`generated proposal contract is stale: ${stale.map((path) => path.replace(`${root}/`, "")).join(", ")}`);
} else {
  for (const [path, bytes] of outputs) await writeFile(path, bytes, "utf8");
}
