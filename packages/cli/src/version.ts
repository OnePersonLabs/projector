import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function readProjectorVersion(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (true) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {
        readonly name?: unknown;
        readonly version?: unknown;
      };
      if (manifest.name === "projector" && typeof manifest.version === "string"
        && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(manifest.version)) {
        return manifest.version;
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Projector package version is unavailable");
    directory = parent;
  }
}

/** Product/release version owned by the nearest root `projector` manifest. */
export const PROJECTOR_VERSION = readProjectorVersion();
