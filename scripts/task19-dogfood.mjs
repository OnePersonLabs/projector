import { readFile } from "node:fs/promises";

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
process.stdout.write(`Projector dogfood governance valid: ${ids.length} identities\n`);
