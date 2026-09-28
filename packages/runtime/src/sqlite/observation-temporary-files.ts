import { lstatSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";

const temporaryDatabaseName = /^[0-9a-f]{32}\.db(?:-(?:journal|wal|shm))?$/u;

/** The caller must hold the source activity barrier exclusively. */
export function removeAbandonedObservationTemporaryFiles(indexPath: string): number {
  if (!isAbsolute(indexPath)) throw new TypeError("Observation cleanup requires an absolute database path");
  const databasePath = resolve(indexPath);
  const directories = [`${databasePath}.temporary`];
  // Older producers wrote these same disposable names in the observation owner.
  // Do not apply that recovery rule to arbitrary directories used by library callers.
  if (normalize(databasePath).replaceAll("\\", "/").endsWith("/.projector/runtime/observations/index.sqlite")) {
    directories.push(dirname(databasePath), join(dirname(databasePath), "captures"));
  }
  let removed = 0;
  for (const directory of directories) {
    const info = lstatSync(directory, { throwIfNoEntry: false });
    if (info === undefined) continue;
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error(`Observation temporary directory is redirected or invalid: ${directory}`);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!temporaryDatabaseName.test(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (dirname(path) !== directory || !entry.isFile() || entry.isSymbolicLink())
        throw new Error(`Observation temporary file is redirected or invalid: ${path}`);
      rmSync(path, { force: true });
      removed++;
    }
  }
  return removed;
}
