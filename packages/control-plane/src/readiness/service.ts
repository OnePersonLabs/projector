import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  LegacyUnversionedProjectorConfigSchema,
  PackageIdentitySchema,
  PreparedProjectorConfigSchema,
  ProjectReadinessSchema,
  ProjectorOperationSchema,
  projectorConfigApiVersion,
  parseCanonicalJson,
  type PackageIdentity,
  type ProjectReadiness,
  type ProjectorOperation,
} from "@projector/core";
import {
  OperationAccessError,
  RepositoryPathService,
  initializeProjectLocalIgnore,
  installProjectorEditorSchemaBundle,
  parseTomlDocument,
  stringifyTomlDocument,
  withProjectOperationAccess as withRuntimeOperationAccess,
} from "@projector/runtime";

import { comparePackageVersions } from "./version-order.js";

const legacyConfigPath = join(".projector", "config.json");
const preparedConfigPath = join(".projector", "config.toml");
const maximumConfigBytes = 16 * 1024;

export interface ReadinessInspectionInput {
  readonly operation: ProjectorOperation;
  readonly package: PackageIdentity;
  readonly signal?: AbortSignal;
}

export type ReadyProjectReadiness = ProjectReadiness & { readonly status: "ready" };
export type ProjectOperationAccessResult<T> =
  | { readonly readiness: ReadyProjectReadiness; readonly value: T }
  | { readonly readiness: ProjectReadiness; readonly value?: never };

export interface PreparedProjectInitializationResult {
  readonly readiness: ProjectReadiness;
  readonly created: boolean;
}

export async function initializePreparedProject(
  repositoryRoot: string,
  input: { readonly package: PackageIdentity; readonly signal?: AbortSignal },
): Promise<PreparedProjectInitializationResult> {
  PackageIdentitySchema.parse(input.package);
  throwIfAborted(input.signal);
  const initial = await inspectProjectReadiness(repositoryRoot, { operation: "init", ...input });
  if (initial.status !== "inactive") return { readiness: initial, created: false };

  const paths = await RepositoryPathService.create(repositoryRoot);
  const projectorDirectory = (await paths.resolveWrite(".projector")).realTarget;
  try {
    await mkdir(projectorDirectory);
  } catch (error) {
    if (!isCode(error, "EEXIST")) throw error;
  }
  const projectorStatus = await lstat(projectorDirectory);
  if (projectorStatus.isSymbolicLink() || !projectorStatus.isDirectory()) throw new Error(".projector must be a real directory");
  await syncDirectory(paths.root);
  return withRuntimeOperationAccess(
    repositoryRoot,
    { operation: "init", mode: "exclusive", ...(input.signal === undefined ? {} : { signal: input.signal }) },
    async () => {
      const current = await inspectProjectReadiness(repositoryRoot, { operation: "init", ...input });
      if (current.status !== "inactive") return { readiness: current, created: false };
      await initializeProjectLocalIgnore(repositoryRoot);
      await installProjectorEditorSchemaBundle(repositoryRoot);
      throwIfAborted(input.signal);
      await publishPreparedConfig(paths, input.package);
      const ready = await inspectProjectReadiness(repositoryRoot, { operation: "init", ...input });
      if (ready.status !== "ready") throw new Error(ready.reason ?? "Prepared Projector configuration did not become ready");
      return { readiness: ready, created: true };
    },
  );
}

export async function inspectProjectReadiness(
  repositoryRoot: string,
  input: ReadinessInspectionInput,
): Promise<ProjectReadiness> {
  validateInput(input);
  throwIfAborted(input.signal);
  let paths: RepositoryPathService;
  try {
    paths = await RepositoryPathService.create(repositoryRoot);
  } catch (error) {
    return readiness(input.package, "unavailable", `Projector repository root is unavailable: ${message(error)}`);
  }
  const [legacy, prepared] = await Promise.all([
    readRepositoryMetadata(paths, legacyConfigPath.replaceAll("\\", "/")),
    readRepositoryMetadata(paths, preparedConfigPath.replaceAll("\\", "/")),
  ]);
  throwIfAborted(input.signal);

  if (legacy.status === "missing" && prepared.status === "missing") {
    return readiness(input.package, "inactive", "Projector is not active in this repository");
  }
  if (legacy.status === "unsafe") return readiness(input.package, "unavailable", legacy.reason);
  if (prepared.status === "unsafe") return readiness(input.package, "unavailable", prepared.reason);
  if (legacy.status !== "missing" && prepared.status !== "missing") {
    return readiness(input.package, "unavailable", "Projector configuration contains mixed legacy JSON and prepared TOML markers");
  }
  if (legacy.status === "present") return inspectLegacyConfig(legacy.source, input.package);
  if (prepared.status === "present") return inspectPreparedConfig(prepared.source, input.package, join(repositoryRoot, preparedConfigPath));
  return readiness(input.package, "unavailable", "Projector configuration metadata could not be classified");
}

export async function withProjectOperationAccess<T>(
  repositoryRoot: string,
  input: Omit<ReadinessInspectionInput, "operation"> & {
    readonly operation: Exclude<ProjectorOperation, "init">;
  },
  callback: (access: { readonly readiness: ReadyProjectReadiness; readonly signal: AbortSignal }) => Promise<T>,
): Promise<ProjectOperationAccessResult<T>> {
  const initial = await inspectProjectReadiness(repositoryRoot, input);
  if (initial.status !== "ready") return { readiness: initial };
  try {
    return await withRuntimeOperationAccess(
      repositoryRoot,
      { operation: input.operation, mode: "shared", ...(input.signal === undefined ? {} : { signal: input.signal }) },
      async ({ signal }) => {
        const current = await inspectProjectReadiness(repositoryRoot, input);
        if (current.status !== "ready") return { readiness: current };
        const ready = current as ReadyProjectReadiness;
        return { readiness: ready, value: await callback({ readiness: ready, signal }) };
      },
    );
  } catch (error) {
    if (!(error instanceof OperationAccessError) || error.code === "access-aborted") throw error;
    return {
      readiness: ProjectReadinessSchema.parse({
        status: error.code === "access-corrupt" ? "recovery-required" : "unavailable",
        package: input.package,
        reason: error.message,
        ...(error.code === "access-corrupt" ? {
          recovery: {
            code: "operation-access-corrupt",
            action: "Recover the recognized operation-access claim through Projector recovery before retrying",
          },
        } : {}),
      }),
    };
  }
}

function inspectLegacyConfig(source: string, packageIdentity: PackageIdentity): ProjectReadiness {
  let value: unknown;
  try {
    value = parseCanonicalJson(source);
  } catch (error) {
    return readiness(packageIdentity, "unavailable", `Legacy Projector configuration is malformed: ${message(error)}`);
  }
  const result = LegacyUnversionedProjectorConfigSchema.safeParse(value);
  if (!result.success) return readiness(packageIdentity, "unavailable", `Legacy Projector configuration is invalid: ${result.error.message}`);
  return ProjectReadinessSchema.parse({
    status: "upgrade-required",
    package: packageIdentity,
    observed: { configApiVersion: result.data.apiVersion },
    reason: "Projector data uses the recognized legacy unversioned layout and requires staged preparation",
  });
}

function inspectPreparedConfig(source: string, packageIdentity: PackageIdentity, path: string): ProjectReadiness {
  let value: unknown;
  try {
    value = parseTomlDocument(source, path);
  } catch (error) {
    return readiness(packageIdentity, "unavailable", `Prepared Projector configuration is malformed: ${message(error)}`);
  }
  const result = PreparedProjectorConfigSchema.safeParse(value);
  if (!result.success) return readiness(packageIdentity, "unavailable", `Prepared Projector configuration is invalid: ${result.error.message}`);
  const order = comparePackageVersions(result.data.projectorVersion, packageIdentity.version);
  const observed = { configApiVersion: result.data.apiVersion, preparedProjectorVersion: result.data.projectorVersion };
  if (order === 0) return ProjectReadinessSchema.parse({ status: "ready", package: packageIdentity, observed });
  if (order < 0) return ProjectReadinessSchema.parse({
    status: "upgrade-required",
    package: packageIdentity,
    observed,
    reason: `Projector data was prepared by ${result.data.projectorVersion} and requires preparation for ${packageIdentity.version}`,
  });
  return ProjectReadinessSchema.parse({
    status: "unavailable",
    package: packageIdentity,
    observed,
    reason: `Projector data was prepared by newer release ${result.data.projectorVersion}; installed release ${packageIdentity.version} cannot load it`,
  });
}

type MetadataRead =
  | { readonly status: "missing" }
  | { readonly status: "present"; readonly source: string }
  | { readonly status: "unsafe"; readonly reason: string };

async function readBoundedMetadata(path: string): Promise<MetadataRead> {
  try {
    const pathStatus = await lstat(path);
    if (!pathStatus.isFile() || pathStatus.isSymbolicLink()) return { status: "unsafe", reason: `${path} must be a regular non-symlink file` };
    if (pathStatus.size > maximumConfigBytes) return { status: "unsafe", reason: `${path} exceeds ${maximumConfigBytes} bytes` };
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const handleStatus = await handle.stat();
      if (!handleStatus.isFile() || handleStatus.size > maximumConfigBytes) return { status: "unsafe", reason: `${path} changed during bounded inspection` };
      return { status: "present", source: await handle.readFile("utf8") };
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (isCode(error, "ENOENT")) return { status: "missing" };
    return { status: "unsafe", reason: `Projector configuration metadata is unavailable at ${path}: ${message(error)}` };
  }
}

async function readRepositoryMetadata(paths: RepositoryPathService, relativePath: string): Promise<MetadataRead> {
  try {
    return await readBoundedMetadata((await paths.resolveRead(relativePath)).realTarget);
  } catch (error) {
    return { status: "unsafe", reason: `Projector configuration path is unsafe at ${relativePath}: ${message(error)}` };
  }
}

async function publishPreparedConfig(paths: RepositoryPathService, packageIdentity: PackageIdentity): Promise<void> {
  const config = PreparedProjectorConfigSchema.parse({
    apiVersion: projectorConfigApiVersion,
    enabled: true,
    projectorVersion: packageIdentity.version,
  });
  const contents = stringifyTomlDocument(config, { schemaPath: "schemas/projector-config-v1.schema.json" });
  const target = (await paths.resolveWrite(preparedConfigPath.replaceAll("\\", "/"))).realTarget;
  const temporary = join(dirname(target), `.config.${randomBytes(12).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(temporary, target);
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
      const existing = await readBoundedMetadata(target);
      if (existing.status !== "present" || existing.source !== contents) {
        throw new Error("Prepared Projector configuration was concurrently published with different bytes");
      }
    }
    await syncDirectory(dirname(target));
  } finally {
    if (handle !== undefined) await handle.close();
    await rm(temporary, { force: true });
  }
}

async function syncDirectory(path: string): Promise<void> {
  const directory = await open(path, constants.O_RDONLY);
  try {
    await directory.sync();
  } catch (error) {
    if (!isCode(error, "EINVAL") && !isCode(error, "ENOTSUP") && !isCode(error, "EPERM")) throw error;
  } finally {
    await directory.close();
  }
}

function validateInput(input: ReadinessInspectionInput): void {
  PackageIdentitySchema.parse(input.package);
  ProjectorOperationSchema.parse(input.operation);
}

function readiness(packageIdentity: PackageIdentity, status: ProjectReadiness["status"], reason: string): ProjectReadiness {
  return ProjectReadinessSchema.parse({ status, package: packageIdentity, reason });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
