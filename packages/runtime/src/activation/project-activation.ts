import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, rm } from "node:fs/promises";
import { dirname, join, parse } from "node:path";

import {
  canonicalJson,
  defaultProjectorConfig,
  parseCanonicalJson,
  parseProjectorConfig,
  projectorConfigApiVersion,
  type ProjectorConfig,
} from "@projector/core";

import { RepositoryPathService } from "../security/repository-path.js";

export const PROJECTOR_CONFIG_PATH = ".projector/config.json" as const;
const MAXIMUM_CONFIG_BYTES = 16 * 1024;

export type ProjectActivationFailure = "missing" | "malformed" | "unsupported" | "unsafe";
export type ProjectActivation =
  | { readonly status: "enabled"; readonly repositoryRoot: string; readonly configPath: typeof PROJECTOR_CONFIG_PATH; readonly config: ProjectorConfig }
  | { readonly status: "disabled"; readonly repositoryRoot: string; readonly configPath: typeof PROJECTOR_CONFIG_PATH; readonly failure: ProjectActivationFailure; readonly reason: string };

const disabled = (repositoryRoot: string, failure: ProjectActivationFailure, reason: string): ProjectActivation => ({
  status: "disabled",
  repositoryRoot,
  configPath: PROJECTOR_CONFIG_PATH,
  failure,
  reason,
});

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function resolveRepositoryRoot(candidate: string): Promise<string> {
  let cursor = (await RepositoryPathService.create(candidate)).root;
  while (true) {
    try {
      const gitMarker = await lstat(join(cursor, ".git"));
      if (gitMarker.isDirectory() || gitMarker.isFile()) return cursor;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    const parent = dirname(cursor);
    if (parent === cursor || cursor === parse(cursor).root) throw new Error("no Git repository root contains the requested path");
    cursor = parent;
  }
}

export async function inspectProjectActivation(repositoryRoot: string): Promise<ProjectActivation> {
  let paths: RepositoryPathService;
  try {
    paths = await RepositoryPathService.create(await resolveRepositoryRoot(repositoryRoot));
  } catch (error) {
    return disabled(repositoryRoot, "unsafe", `Projector repository root is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  let configPath: string;
  let source: string;
  try {
    configPath = (await paths.resolveRead(PROJECTOR_CONFIG_PATH)).realTarget;
    const handle = await open(configPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const status = await handle.stat();
      if (!status.isFile()) return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} must be a regular file`);
      if (status.size > MAXIMUM_CONFIG_BYTES) return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} exceeds ${MAXIMUM_CONFIG_BYTES} bytes`);
      source = await handle.readFile("utf8");
    } finally { await handle.close(); }
  } catch (error) {
    if (isMissing(error)) return disabled(paths.root, "missing", `Projector is not enabled; run projector init to create ${PROJECTOR_CONFIG_PATH}`);
    return disabled(paths.root, "unsafe", `Projector activation marker is unsafe: ${error instanceof Error ? error.message : String(error)}`);
  }

  let value: unknown;
  try {
    value = parseCanonicalJson(source);
  } catch (error) {
    return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (value !== null && typeof value === "object" && "apiVersion" in value && (value as { apiVersion?: unknown }).apiVersion !== projectorConfigApiVersion) {
    return disabled(paths.root, "unsupported", `${PROJECTOR_CONFIG_PATH} uses an unsupported apiVersion`);
  }
  try {
    return { status: "enabled", repositoryRoot: paths.root, configPath: PROJECTOR_CONFIG_PATH, config: parseProjectorConfig(value) };
  } catch (error) {
    return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function initializeProjectActivation(repositoryRoot: string): Promise<{ readonly config: ProjectorConfig; readonly created: boolean }> {
  const current = await inspectProjectActivation(repositoryRoot);
  if (current.status === "enabled") return { config: current.config, created: false };
  if (current.failure !== "missing") throw new Error(current.reason);

  const paths = await RepositoryPathService.create(current.repositoryRoot);
  const projectorDirectory = (await paths.resolveWrite(".projector")).realTarget;
  await mkdir(projectorDirectory, { recursive: true });
  const target = (await paths.resolveWrite(PROJECTOR_CONFIG_PATH)).realTarget;
  const temporary = join(dirname(target), `.config.${randomBytes(12).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await handle.writeFile(`${canonicalJson(defaultProjectorConfig)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(temporary, target);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      const raced = await inspectProjectActivation(repositoryRoot);
      if (raced.status !== "enabled") throw new Error(raced.reason);
      return { config: raced.config, created: false };
    }
    const directoryHandle = await open(dirname(target), constants.O_RDONLY);
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    return { config: defaultProjectorConfig, created: true };
  } finally {
    if (handle !== undefined) await handle.close();
    await rm(temporary, { force: true });
  }
}
