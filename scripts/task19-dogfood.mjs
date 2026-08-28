import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DOGFOOD_DOCUMENT_VERSION } from "../packages/cli/dist/cli.js";
import { CONTENT_HASH_PREFIX, ContentHashSchema } from "../packages/core/dist/index.js";
import { BUILT_IN_REPRESENTATION_PROFILE_KEYS } from "../packages/engine/dist/index.js";

const path = new URL("../.projector/dogfood.json", import.meta.url);
const document = JSON.parse(await readFile(path, "utf8"));
if (document.version !== DOGFOOD_DOCUMENT_VERSION) throw new Error(`unsupported dogfood document version ${String(document.version)}`);
const groups = ["acceptedDebt", "architectureDecisions", "authorities", "governanceBases", "lenses", "representations", "rules"];
const ids = groups.flatMap((group) => {
  if (!Array.isArray(document[group]) || document[group].length === 0) throw new Error(`dogfood ${group} must be non-empty`);
  return document[group].map(({ id, status }) => {
    if (typeof id !== "string" || (status !== "active" && status !== "accepted")) throw new Error(`invalid dogfood ${group} entry`);
    return id;
  });
});
if (new Set(ids).size !== ids.length) throw new Error("contradictory duplicate dogfood identities");
for (const authority of document.authorities) if (!ContentHashSchema.safeParse(authority.authorityHash).success) throw new Error(`authority ${authority.id} lacks a bound hash`);
for (const base of document.governanceBases) if (base.source !== "PROJECTOR_SPEC" || !ContentHashSchema.safeParse(base.sourceDigest).success) throw new Error(`governance base ${base.id} lacks authoritative source binding`);
for (const decision of document.architectureDecisions) if (/(?:repository|prose|instruction).*(?:grant|authorize|override).*(?:tool|policy)|(?:grant|authorize).*(?:tool)/iu.test(`${decision.summary ?? ""} ${decision.decision ?? ""}`)) throw new Error(`untrusted architecture decision ${decision.id} attempts to grant tools or override policy`);
const expectedRepresentationKeys = [
  BUILT_IN_REPRESENTATION_PROFILE_KEYS.agentCompact,
  BUILT_IN_REPRESENTATION_PROFILE_KEYS.humanTechnical,
  BUILT_IN_REPRESENTATION_PROFILE_KEYS.machineInvariant,
].sort();
if (JSON.stringify(document.representations.map(({ key }) => key).sort()) !== JSON.stringify(expectedRepresentationKeys)
  || document.representations.some(({ protectedDimensionCount }) => protectedDimensionCount !== 11)) throw new Error("dogfood representation profiles do not cover the protected semantic contract");
const cliSpec = await readFile(new URL("../PROJECTOR_SPEC/10-operation/cli-modes-and-security.md", import.meta.url), "utf8");
const benchmarkSpec = await readFile(new URL("../PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md", import.meta.url), "utf8");
if (!cliSpec.includes("Repository docs/comments") || !cliSpec.includes("cannot grant tools")) throw new Error("independent security specification lint failed");
if (!benchmarkSpec.includes(">=95%") || !benchmarkSpec.includes("held-out repository generalization")) throw new Error("independent benchmark specification lint failed");
const authoritativeDigest = `${CONTENT_HASH_PREFIX}${createHash("sha256").update(cliSpec).update(Buffer.from([0])).update(benchmarkSpec).digest("hex")}`;
if (document.governanceBases.some(({ sourceDigest }) => sourceDigest !== authoritativeDigest)) throw new Error("Governance Base digest does not match authoritative operation/benchmark specifications");
process.stdout.write(`Projector dogfood governance valid: ${ids.length} identities\n`);
