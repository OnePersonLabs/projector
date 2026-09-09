import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const releaseCandidateApiVersion = "projector.release-candidate/v1";
export const releasePackageName = "@onepersonlabs/projector";
export const releaseVersion = "2.1.0";

function serialize(value, seen, inArray) {
  if (value === undefined) {
    if (inArray) throw new TypeError("undefined array elements are not JSON values");
    return undefined;
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON numbers must be finite");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") throw new TypeError(`${typeof value} is not a JSON value`);
  if (seen.has(value)) throw new TypeError("cyclic values are not JSON values");
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index)) throw new TypeError(`sparse array hole at index ${index} is not a JSON value`);
      return `[${value.map((item) => serialize(item, seen, true)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("only plain objects are JSON values");
    const entries = [];
    for (const key of Object.keys(value).sort()) {
      const item = serialize(value[key], seen, false);
      if (item !== undefined) entries.push(`${JSON.stringify(key)}:${item}`);
    }
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value) {
  const result = serialize(value, new Set(), false);
  if (result === undefined) throw new TypeError("top-level undefined is not a JSON value");
  return result;
}

export function hashBytes(bytes) {
  return `sha256:v1:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function hashCanonical(value) {
  return hashBytes(Buffer.from(canonicalJson(value), "utf8"));
}

function candidatePath(root, path) {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path) || path.includes("\\")) throw new Error(`release candidate has an unsafe path: ${String(path)}`);
  const target = resolve(root, path);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error(`release candidate path escapes its root: ${path}`);
  return target;
}

export async function inventoryCandidateFiles(root) {
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) throw new Error(`release candidate contains a symlink: ${relative(root, path)}`);
      if (metadata.isDirectory()) {
        if (relative(root, path) !== "results") await visit(path);
      } else if (metadata.isFile() && relative(root, path) !== "manifest.json") {
        const bytes = await readFile(path);
        files.push({ path: relative(root, path).split(sep).join("/"), bytes: bytes.byteLength, digest: hashBytes(bytes) });
      } else if (!metadata.isFile()) {
        throw new Error(`release candidate contains a non-file entry: ${relative(root, path)}`);
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function validateReleaseCandidate(candidateRoot) {
  const root = await realpath(candidateRoot);
  const manifestPath = candidatePath(root, "manifest.json");
  const manifestMetadata = await lstat(manifestPath);
  if (!manifestMetadata.isFile() || manifestMetadata.isSymbolicLink()) throw new Error("release candidate manifest is not a regular file");
  const manifestBytes = await readFile(manifestPath);
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch { throw new Error("release candidate manifest is malformed JSON"); }
  if (`${canonicalJson(manifest)}\n` !== manifestBytes.toString("utf8")) throw new Error("release candidate manifest is not canonical JSON");
  if (manifest.apiVersion !== releaseCandidateApiVersion) throw new Error("release candidate manifest has an unsupported API version");
  if (manifest.release?.name !== releasePackageName || manifest.release?.version !== releaseVersion || !/^[0-9a-f]{40}$/u.test(manifest.release?.sourceRevision ?? "")) throw new Error("release candidate manifest has an invalid release identity");
  if (manifest.tarballPath !== "artifacts/onepersonlabs-projector-2.1.0.tgz" || manifest.pluginRoot !== "plugin/projector" || manifest.runnerPath !== "source-severed-release-acceptance.mjs" || manifest.fixturePath !== "fixtures/held-out-change.json") throw new Error("release candidate manifest has invalid entrypoint paths");
  if (!Array.isArray(manifest.files)) throw new Error("release candidate manifest has no file inventory");
  const actual = await inventoryCandidateFiles(root);
  if (canonicalJson(manifest.files) !== canonicalJson(actual)) throw new Error("release candidate file inventory, bytes, or digest does not match manifest");
  const required = [manifest.tarballPath, `${manifest.pluginRoot}/.codex-plugin/plugin.json`, "packed-lifecycle-acceptance.mjs", manifest.runnerPath, "release-candidate.mjs", manifest.fixturePath, "provision-ubuntu-sandbox.sh"];
  const paths = new Set(actual.map(({ path }) => path));
  for (const path of required) {
    candidatePath(root, path);
    if (!paths.has(path)) throw new Error(`release candidate is missing required input ${path}`);
  }
  return { root, manifest, manifestHash: hashBytes(manifestBytes), files: actual };
}
