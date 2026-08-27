import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { posix } from "node:path";

const path = new URL("../.projector/dogfood.json", import.meta.url);
const document = JSON.parse(await readFile(path, "utf8"));
const groups = ["acceptedDebt", "architectureDecisions", "authorities", "governanceBases", "lenses", "representations", "rules"];
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
const expectedRepresentationKeys = ["agent-compact@1", "human-technical@1", "machine-invariant@1"];
if (JSON.stringify(document.representations.map(({ key }) => key).sort()) !== JSON.stringify(expectedRepresentationKeys)
  || document.representations.some(({ protectedDimensionCount }) => protectedDimensionCount !== 11)) throw new Error("dogfood representation profiles do not cover the protected semantic contract");
const specificationRoot = new URL("../PROJECTOR_SPEC/", import.meta.url);
const manifestBytes = await readFile(new URL("spec.manifest.json", specificationRoot));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const manifestPaths = [manifest.entrypoint, manifest.index, ...manifest.modules.map(({ path }) => path)];
export const isSafeSpecificationManifestPath = (entry) => typeof entry === "string" && entry.length > 0 && !posix.isAbsolute(entry) && posix.normalize(entry) === entry && !entry.startsWith("../") && !entry.includes("\\") && !entry.includes("%") && !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(entry);
if (!manifestPaths.every(isSafeSpecificationManifestPath) || new Set(manifestPaths).size !== manifestPaths.length) throw new Error("specification manifest paths are incomplete, duplicated, or escape PROJECTOR_SPEC");
const specificationFiles = await Promise.all(manifestPaths.map(async (relativePath) => ({ relativePath, bytes: await readFile(new URL(relativePath, specificationRoot)) })));
const cliSpec = specificationFiles.find(({ relativePath }) => relativePath === "10-operation/cli-modes-and-security.md")?.bytes.toString("utf8") ?? "";
const benchmarkSpec = specificationFiles.find(({ relativePath }) => relativePath === "11-validation/benchmarks-and-redesign-criteria.md")?.bytes.toString("utf8") ?? "";
if (!cliSpec.includes("Repository docs/comments") || !cliSpec.includes("cannot grant tools")) throw new Error("independent security specification lint failed");
if (!benchmarkSpec.includes(">=95%") || !benchmarkSpec.includes("held-out repository generalization")) throw new Error("independent benchmark specification lint failed");
const manifestDigest = `sha256:v1:${createHash("sha256").update(manifestBytes).digest("hex")}`;
const rootHash = createHash("sha256").update("projector-spec-manifest-root\0").update(manifestBytes);
for (const { relativePath, bytes } of specificationFiles) rootHash.update(Buffer.from([0])).update(relativePath).update(Buffer.from([0])).update(bytes);
const authoritativeDigest = `sha256:v1:${rootHash.digest("hex")}`;
if (document.governanceBases.some((base) => base.manifestPath !== "PROJECTOR_SPEC/spec.manifest.json" || base.manifestDigest !== manifestDigest || base.sourceDigest !== authoritativeDigest)) throw new Error("Governance Base digest does not match the full manifest-addressed Projector specification root");
process.stdout.write(`Projector dogfood governance valid: ${ids.length} identities\n`);
