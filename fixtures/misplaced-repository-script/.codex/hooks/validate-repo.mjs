import { access, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function findRepositoryRoot(start = new URL("./", import.meta.url)) {
  let current = new URL("./", start);
  while (true) {
    try {
      await access(new URL("package.json", current));
      return current;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = new URL("../", current);
    if (parent.href === current.href) throw new Error("Unable to locate repository package.json");
    current = parent;
  }
}

export async function validateRepository(root) {
  const repositoryRoot = root ?? await findRepositoryRoot();
  const manifest = JSON.parse(await readFile(new URL("package.json", repositoryRoot), "utf8"));
  return Object.keys(manifest.scripts ?? {}).sort();
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repositoryRoot = await findRepositoryRoot();
  if (process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER !== undefined) {
    await writeFile(
      new URL(process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER, repositoryRoot),
      "validate:repo executed\n",
      "utf8",
    );
  }
  await validateRepository(repositoryRoot);
}
