import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export async function readAuthoredReleaseIdentity(root = repositoryRoot) {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (manifest.name !== "projector" || typeof manifest.version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(manifest.version)) {
    throw new Error("root package.json does not declare a valid Projector release version");
  }
  return { name: "@onepersonlabs/projector", version: manifest.version };
}

export const authoredReleaseIdentity = await readAuthoredReleaseIdentity();
export const releasePackageName = authoredReleaseIdentity.name;
export const releaseVersion = authoredReleaseIdentity.version;
