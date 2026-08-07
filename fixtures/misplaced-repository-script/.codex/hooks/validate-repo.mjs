import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function validateRepository(root = new URL("../../", import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  return Object.keys(manifest.scripts ?? {}).sort();
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER !== undefined) {
    await writeFile(
      new URL(process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER, new URL("../../", import.meta.url)),
      "validate:repo executed\n",
      "utf8",
    );
  }
  await validateRepository();
}
