import { readFile } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { lintHumanTechnical } from "../packages/engine/dist/index.js";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function proseOnly(source) {
  return source.replace(/```[\s\S]*?```/gu, "").replace(/`[^`\n]*`/gu, "");
}

export async function checkAuthoritativeSpecification(repositoryRoot = defaultRoot) {
  const specificationRoot = resolve(repositoryRoot, "PROJECTOR_SPEC");
  const manifest = JSON.parse(await readFile(resolve(specificationRoot, "spec.manifest.json"), "utf8"));
  const relativePaths = [manifest.entrypoint, manifest.index, ...manifest.modules.map(({ path }) => path)];
  if (relativePaths.some((path) => typeof path !== "string" || path.length === 0 || isAbsolute(path)) || new Set(relativePaths).size !== relativePaths.length) {
    throw new Error("specification manifest paths are invalid or duplicated");
  }
  const files = [];
  const blocking = [];
  const advisory = [];
  for (const relativePath of relativePaths) {
    const path = resolve(specificationRoot, relativePath);
    if (!path.startsWith(`${specificationRoot}${sep}`)) throw new Error(`specification module escapes root: ${relativePath}`);
    const report = lintHumanTechnical(proseOnly(await readFile(path, "utf8")));
    files.push(relativePath);
    blocking.push(...report.blocking.map((finding) => ({ path: relativePath, ...finding })));
    advisory.push(...report.advisory.map((finding) => ({ path: relativePath, ...finding })));
  }
  return Object.freeze({ files: Object.freeze(files), blocking: Object.freeze(blocking), advisory: Object.freeze(advisory) });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkAuthoritativeSpecification();
  if (report.blocking.length > 0) {
    process.stderr.write(`${JSON.stringify(report.blocking, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Checked ${report.files.length} authoritative specification files; no blocking findings.\n`);
  }
}
