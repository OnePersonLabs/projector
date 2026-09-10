import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, rename, rm } from "node:fs/promises";
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
const PROJECTOR_LOCAL_IGNORE_RULES = ["/state.db", "/state.db-wal", "/state.db-shm", "/state.db-journal", "/runtime/", "/telemetry/", "/watch/"];

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
  if (current.status === "enabled") {
    await initializeProjectIgnore(await RepositoryPathService.create(current.repositoryRoot));
    return { config: current.config, created: false };
  }
  if (current.failure !== "missing") throw new Error(current.reason);

  const paths = await RepositoryPathService.create(current.repositoryRoot);
  const projectorDirectory = (await paths.resolveWrite(".projector")).realTarget;
  try { await mkdir(projectorDirectory); }
  catch (error) { if (!isCode(error, "EEXIST")) throw error; }
  await syncDirectory(paths.root);
  await initializeProjectIgnore(paths);
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
    await syncDirectory(dirname(target));
    return { config: defaultProjectorConfig, created: true };
  } finally {
    if (handle !== undefined) await handle.close();
    await rm(temporary, { force: true });
  }
}

export async function initializeProjectLocalIgnore(repositoryRoot: string): Promise<void> {
  await initializeProjectIgnore(await RepositoryPathService.create(repositoryRoot));
}

async function initializeProjectIgnore(paths: RepositoryPathService): Promise<void> {
  const target = (await paths.resolveWrite(".projector/.gitignore")).realTarget;
  let existing = "";
  try {
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (!(await handle.stat()).isFile()) throw new Error(".projector/.gitignore must be a regular file");
      existing = await handle.readFile("utf8");
    } finally { await handle.close(); }
  } catch (error) { if (!isMissing(error)) throw error; }
  const existingRules = new Set(existing.split(/\r?\n/u).map(line => line.trim()));
  const missing = PROJECTOR_LOCAL_IGNORE_RULES.filter(rule => !existingRules.has(rule));
  if (missing.length === 0) return;

  // Defaults precede existing content so explicit project exceptions keep their
  // precedence. Runtime includes local recovery/receipt history, not just cache.
  const next = `# Projector derived indexes and execution-local state\n${missing.join("\n")}\n${existing}`;
  const temporary = join(dirname(target), `.gitignore.${randomBytes(12).toString("hex")}.tmp`);
  try {
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try { await handle.writeFile(next, "utf8"); await handle.sync(); } finally { await handle.close(); }
    await paths.resolveWrite(".projector/.gitignore");
    await rename(temporary, target);
    await syncDirectory(dirname(target));
  } finally { await rm(temporary, { force: true }); }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY);
  try { await handle.sync(); }
  catch (error) { if (!isCode(error, "EINVAL") && !isCode(error, "ENOTSUP") && !isCode(error, "EPERM")) throw error; }
  finally { await handle.close(); }
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
