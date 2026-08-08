import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const path = new URL("../.projector/dogfood.json", import.meta.url);
const document = JSON.parse(await readFile(path, "utf8"));
const groups = ["acceptedDebt", "architectureDecisions", "authorities", "governanceBases", "lenses", "rules"];
const ids = groups.flatMap((group) => {
  if (!Array.isArray(document[group]) || document[group].length === 0) throw new Error(`dogfood ${group} must be non-empty`);
  return document[group].map(({ id, status }) => {
    if (typeof id !== "string" || (status !== "active" && status !== "accepted")) throw new Error(`invalid dogfood ${group} entry`);
    return id;
  });
});
if (new Set(ids).size !== ids.length) throw new Error("contradictory duplicate dogfood identities");
for (const authority of document.authorities) if (!/^sha256:v1:[a-f0-9]{64}$/u.test(authority.authorityHash ?? "")) throw new Error(`authority ${authority.id} lacks a bound hash`);
for (const base of document.governanceBases) if (base.source !== "PROJECTOR_SPEC" || !/^sha256:v1:[a-f0-9]{64}$/u.test(base.sourceDigest ?? "")) throw new Error(`governance base ${base.id} lacks authoritative source binding`);
for (const decision of document.architectureDecisions) if (/(?:repository|prose|instruction).*(?:grant|authorize|override).*(?:tool|policy)|(?:grant|authorize).*(?:tool)/iu.test(`${decision.summary ?? ""} ${decision.decision ?? ""}`)) throw new Error(`untrusted architecture decision ${decision.id} attempts to grant tools or override policy`);
const cliSpec = await readFile(new URL("../PROJECTOR_SPEC/10-operation/cli-modes-and-security.md", import.meta.url), "utf8");
const benchmarkSpec = await readFile(new URL("../PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md", import.meta.url), "utf8");
if (!cliSpec.includes("Repository docs/comments") || !cliSpec.includes("cannot grant tools")) throw new Error("independent security specification lint failed");
if (!benchmarkSpec.includes(">=95%") || !benchmarkSpec.includes("held-out repository generalization")) throw new Error("independent benchmark specification lint failed");
const authoritativeDigest = `sha256:v1:${createHash("sha256").update(cliSpec).update(Buffer.from([0])).update(benchmarkSpec).digest("hex")}`;
if (document.governanceBases.some(({ sourceDigest }) => sourceDigest !== authoritativeDigest)) throw new Error("Governance Base digest does not match authoritative operation/benchmark specifications");
process.stdout.write(`Projector dogfood governance valid: ${ids.length} identities\n`);
