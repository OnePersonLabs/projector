import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  PackageIdentitySchema,
  PreparedProjectorConfigSchema,
  ProjectReadinessSchema,
  ProjectorOperationSchema,
  projectorConfigApiVersion,
  type PackageIdentity,
  type ProjectReadiness,
  type ProjectorOperation,
} from "@projector/core";
import {
  OperationAccessError,
  recoverAbandonedProjectOperationAccess,
  RepositoryPathService,
  initializeProjectLocalIgnore,
  installProjectorEditorSchemaBundle,
  parseTomlDocument,
  stringifyTomlDocument,
  withProjectOperationAccess as withRuntimeOperationAccess,
} from "@projector/runtime";
import { z } from "zod";

import { maintainDerivedCache } from "../knowledge/cache-maintenance.js";

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

export const PreparedProjectInitializationResultSchema = z.strictObject({
  readiness: ProjectReadinessSchema,
  created: z.boolean(),
});

export type PreparedProjectInitializationResult = z.infer<typeof PreparedProjectInitializationResultSchema>;

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
      await publishPreparedIndex(paths);
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
  const prepared = await readRepositoryMetadata(paths, preparedConfigPath.replaceAll("\\", "/"));
  const legacy = await readRepositoryMetadata(paths, ".projector/config.json");
  const pending = await readRepositoryMetadata(paths, ".projector/pending-project-data-migration.json");
  throwIfAborted(input.signal);
  for (const marker of [legacy, pending]) if (marker.status === "unsafe") return readiness(input.package, "unavailable", marker.reason);
  // Detect historical ownership without interpreting or continuing an old format.
  if (pending.status === "present") return ProjectReadinessSchema.parse({
    status: "recovery-required", package: input.package, reason: "A pre-cutover operation has unfinished evidence.",
    recovery: { code: "project-data-cutover-required", location: ".projector/pending-project-data-migration.json", action: "Inspect the retained operation with its matching pre-cutover runtime before a checked cutover. Preserve its evidence." },
  });
  if (legacy.status === "present") return readiness(input.package, "unavailable", "Unsupported legacy or mixed Projector configuration remains untouched; use a checked format cutover.");
  if (prepared.status === "missing") return readiness(input.package, "inactive", "Projector is not active in this repository");
  if (prepared.status === "unsafe") return readiness(input.package, "unavailable", prepared.reason);
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
    if (input.operation === "change.recover" || input.operation === "operation-access.recover") {
      await recoverAbandonedProjectOperationAccess(repositoryRoot, input.signal);
    }
    if (input.operation === "context" || input.operation === "change.capture" || input.operation === "change.plan") {
      // Collection cannot upgrade a held shared claim; a busy collector simply yields to queued work.
      await maintainDerivedCache(repositoryRoot, input.signal === undefined ? {} : { signal: input.signal });
    }
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
            action: "Run operation-access.recover to reclaim a recognized abandoned claim before retrying",
          },
        } : {}),
      }),
    };
  }
}

function inspectPreparedConfig(source: string, packageIdentity: PackageIdentity, path: string): ProjectReadiness {
  let value: unknown;
  try {
    value = parseTomlDocument(source, path);
  } catch (error) {
    return readiness(packageIdentity, "unavailable", `Prepared Projector configuration is malformed: ${message(error)}`);
  }
  const result = PreparedProjectorConfigSchema.safeParse(value);
  if (!result.success) return readiness(packageIdentity, "unavailable", `Projector requires current authored format ${projectorConfigApiVersion}. Preserve unsupported data for the documented cutover. Configuration detail: ${result.error.message}`);
  const observed = { configApiVersion: result.data.apiVersion, preparedProjectorVersion: result.data.projectorVersion };
  return ProjectReadinessSchema.parse({ status: "ready", package: packageIdentity, observed });
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

async function publishPreparedIndex(paths: RepositoryPathService): Promise<void> {
  const contents = "# Project meaning\n\nRead concepts and requirements first. Scenarios describe observable checks; decisions and rationale explain consequential choices. Add records only when they preserve meaning needed by later work.\n\n- [Concepts](model/concepts/)\n- [Requirements](model/requirements/)\n- [Scenarios](model/scenarios/)\n- [Concerns](concerns/)\n- [Decisions](decisions/)\n- [Rationale](authorities/)\n- [Typed relationships](model/relations/)\n\nThese directories appear as records are accepted. Keep useful navigation here. Stable identities live inside records independently of filenames. Runtime receipts and recovery evidence stay under `runtime/`; use `projector inspect` when needed.\n";
  await publishPreparedFile(paths, ".projector/README.md", contents, true);
}

async function publishPreparedConfig(paths: RepositoryPathService, packageIdentity: PackageIdentity): Promise<void> {
  const config = PreparedProjectorConfigSchema.parse({
    apiVersion: projectorConfigApiVersion,
    enabled: true,
    projectorVersion: packageIdentity.version,
  });
  const contents = stringifyTomlDocument(config, { schemaPath: "schemas/projector-config-v3.schema.json" });
  await publishPreparedFile(paths, preparedConfigPath.replaceAll("\\", "/"), contents);
}

async function publishPreparedFile(paths: RepositoryPathService, relativePath: string, contents: string, preserveExisting = false): Promise<void> {
  const target = (await paths.resolveWrite(relativePath)).realTarget;
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
      if (existing.status !== "present" || (!preserveExisting && existing.source !== contents)) {
        throw new Error(`Prepared Projector metadata was concurrently published with different bytes: ${relativePath}`);
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
