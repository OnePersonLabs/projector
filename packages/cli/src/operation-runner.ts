import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join } from "node:path";

import {
  PackageIdentitySchema,
  ProjectReadinessSchema,
  ProjectorOperationRequestSchema,
  ProjectorOperationSchema,
  createProjectorOperationResultSchema,
  projectorOperationResultApiVersion,
  type PackageIdentity,
  type ProjectReadiness,
  type ProjectorOperation,
  type ProjectorOperationAction,
  type ProjectorOperationError,
  type ProjectorOperationRequest,
} from "@projector/core";
import { z } from "zod";

const maximumPackageManifestBytes = 16 * 1024;
const ordinaryOperationSchema = ProjectorOperationSchema.exclude(["status", "init"]);

export type OrdinaryProjectorOperation = z.infer<typeof ordinaryOperationSchema>;
export type OrdinaryProjectorOperationRequest = Exclude<ProjectorOperationRequest, { operation: "status" | "init" }>;

export interface OperationHandlerContext {
  readonly package: PackageIdentity;
  readonly readiness: ProjectReadiness & { readonly status: "ready" };
  readonly signal: AbortSignal;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

export interface ProjectorOperationHandler<
  TOperation extends OrdinaryProjectorOperation = OrdinaryProjectorOperation,
  TOutputSchema extends z.ZodType = z.ZodType,
> {
  readonly operation: TOperation;
  readonly outputSchema: TOutputSchema;
  readonly execute: (
    request: Extract<OrdinaryProjectorOperationRequest, { operation: TOperation }>,
    context: OperationHandlerContext,
  ) => Promise<z.output<TOutputSchema>> | z.output<TOutputSchema>;
}

export function defineProjectorOperationHandler<
  const TOperation extends OrdinaryProjectorOperation,
  const TOutputSchema extends z.ZodType,
>(
  handler: ProjectorOperationHandler<TOperation, TOutputSchema>,
): ProjectorOperationHandler<TOperation, TOutputSchema> {
  return handler;
}

type AnyProjectorOperationHandler = {
  [TOperation in OrdinaryProjectorOperation]: ProjectorOperationHandler<TOperation, z.ZodType>;
}[OrdinaryProjectorOperation];

interface ErasedProjectorOperationHandler {
  readonly operation: OrdinaryProjectorOperation;
  readonly outputSchema: z.ZodType;
  readonly execute: (
    request: OrdinaryProjectorOperationRequest,
    context: OperationHandlerContext,
  ) => Promise<unknown> | unknown;
}

export interface HostCapabilityObservation {
  readonly capability: string;
  readonly available: boolean;
  readonly evidence: string;
}

export interface PreparedProjectInitializationResult {
  readonly readiness: ProjectReadiness;
  readonly created: boolean;
}

export interface OperationRunnerPorts<
  TInitializerResultSchema extends z.ZodType<PreparedProjectInitializationResult> = z.ZodType<PreparedProjectInitializationResult>,
> {
  readonly inspectReadiness: (
    repositoryRoot: string,
    input: { readonly operation: ProjectorOperation; readonly package: PackageIdentity; readonly signal?: AbortSignal },
  ) => Promise<ProjectReadiness>;
  readonly initializer: {
    readonly resultSchema: TInitializerResultSchema;
    readonly execute: (
      repositoryRoot: string,
      input: { readonly package: PackageIdentity; readonly signal?: AbortSignal },
    ) => Promise<z.input<TInitializerResultSchema>>;
  };
  readonly withProjectOperationAccess: <T>(
    repositoryRoot: string,
    input: {
      readonly operation: OrdinaryProjectorOperation;
      readonly package: PackageIdentity;
      readonly signal?: AbortSignal;
    },
    callback: (access: {
      readonly readiness: ProjectReadiness & { readonly status: "ready" };
      readonly signal: AbortSignal;
    }) => Promise<T>,
  ) => Promise<
    | { readonly readiness: ProjectReadiness & { readonly status: "ready" }; readonly value: T }
    | { readonly readiness: ProjectReadiness; readonly value?: never }
  >;
  readonly observedHostCapabilities: readonly HostCapabilityObservation[];
}

export interface ExecuteOperationOptions {
  readonly signal?: AbortSignal;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}

export interface DiscoverCapabilitiesOptions {
  readonly repositoryRoot: string;
  readonly signal?: AbortSignal;
}

export interface ProjectorOperationRunner<TOutput> {
  readonly package: PackageIdentity;
  execute(request: unknown, options?: ExecuteOperationOptions): Promise<ProjectorOperationExecutionResult<TOutput>>;
  discoverCapabilities(options: DiscoverCapabilitiesOptions): Promise<OperationCapabilityDiscovery>;
}

interface OperationResultBase {
  readonly apiVersion: typeof projectorOperationResultApiVersion;
  readonly operation: ProjectorOperation;
  readonly package: PackageIdentity;
  readonly requestId?: string | undefined;
  readonly exitCode: number;
  readonly readiness: ProjectReadiness;
}

export type ProjectorOperationExecutionResult<TOutput> =
  | (OperationResultBase & { readonly status: "succeeded"; readonly output: TOutput })
  | (OperationResultBase & {
      readonly status: "failed" | "unavailable" | "cancelled";
      readonly error: ProjectorOperationError;
      readonly action?: ProjectorOperationAction | undefined;
      readonly output?: TOutput | undefined;
    });

export interface OperationCapabilityDiscovery {
  readonly package: PackageIdentity;
  readonly readiness: ProjectReadiness;
  readonly operations: readonly {
    readonly operation: ProjectorOperation;
    readonly registered: boolean;
    readonly reachable: boolean;
    readonly reason: string;
  }[];
  readonly observedHostCapabilities: readonly HostCapabilityObservation[];
}

const hostCapabilityObservationSchema = z.strictObject({
  capability: z.string().min(1).max(256),
  available: z.boolean(),
  evidence: z.string().min(1).max(4_096),
});
const operationCapabilitySchema = z.strictObject({
  operation: ProjectorOperationSchema,
  registered: z.boolean(),
  reachable: z.boolean(),
  reason: z.string().min(1).max(4_096),
});
export const OperationCapabilityDiscoverySchema = z.strictObject({
  package: PackageIdentitySchema,
  readiness: ProjectReadinessSchema,
  operations: z.array(operationCapabilitySchema).length(ProjectorOperationSchema.options.length),
  observedHostCapabilities: z.array(hostCapabilityObservationSchema),
});

type HandlerOutput<THandlers extends readonly AnyProjectorOperationHandler[]> = z.output<THandlers[number]["outputSchema"]>;

export async function createProjectorOperationRunner<
  const THandlers extends readonly AnyProjectorOperationHandler[],
  TInitializerResultSchema extends z.ZodType<PreparedProjectInitializationResult>,
>(input: {
  readonly packagedRoot: string;
  readonly handlers: THandlers;
  readonly ports: OperationRunnerPorts<TInitializerResultSchema>;
}): Promise<ProjectorOperationRunner<
  OperationCapabilityDiscovery | z.output<TInitializerResultSchema> | HandlerOutput<THandlers>
>> {
  type RunnerOutput = OperationCapabilityDiscovery | z.output<TInitializerResultSchema> | HandlerOutput<THandlers>;
  const packageIdentity = await readPackageIdentity(input.packagedRoot);
  const handlers = buildRegistry(input.handlers);
  const observedHostCapabilities = z.array(hostCapabilityObservationSchema).parse(input.ports.observedHostCapabilities);

  return {
    package: packageIdentity,
    execute: async (candidate, options = {}) => {
      const request = ProjectorOperationRequestSchema.parse(candidate);
      return executeOperation<RunnerOutput>(request, options, packageIdentity, handlers, observedHostCapabilities, input.ports);
    },
    discoverCapabilities: async ({ repositoryRoot, signal }) => {
      const readiness = await input.ports.inspectReadiness(repositoryRoot, {
        operation: "status",
        package: packageIdentity,
        ...(signal === undefined ? {} : { signal }),
      });
      const parsedReadiness = ProjectReadinessSchema.parse(readiness);
      return assembleCapabilityDiscovery(packageIdentity, parsedReadiness, handlers, observedHostCapabilities);
    },
  };
}

async function executeOperation<TOutput>(
  request: ProjectorOperationRequest,
  options: ExecuteOperationOptions,
  packageIdentity: PackageIdentity,
  handlers: ReadonlyMap<OrdinaryProjectorOperation, ErasedProjectorOperationHandler>,
  observedHostCapabilities: readonly HostCapabilityObservation[],
  ports: OperationRunnerPorts,
): Promise<ProjectorOperationExecutionResult<TOutput>> {
  let observedReadiness: ProjectReadiness | undefined;
  const base = {
    apiVersion: projectorOperationResultApiVersion,
    operation: request.operation,
    package: packageIdentity,
    ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
  } as const;
  try {
    throwIfAborted(options.signal);
    if (request.operation === "status") {
      const readiness = ProjectReadinessSchema.parse(await ports.inspectReadiness(request.repositoryRoot, {
        operation: "status",
        package: packageIdentity,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }));
      observedReadiness = readiness;
      const output = assembleCapabilityDiscovery(packageIdentity, readiness, handlers, observedHostCapabilities);
      return validatedExecutionResult<TOutput>(createProjectorOperationResultSchema("status", OperationCapabilityDiscoverySchema), {
        ...base,
        status: "succeeded",
        exitCode: 0,
        readiness,
        output,
      });
    }
    if (request.operation === "init") {
      const initialized = ports.initializer.resultSchema.parse(await ports.initializer.execute(request.repositoryRoot, {
        package: packageIdentity,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }));
      const readiness = ProjectReadinessSchema.parse(initialized.readiness);
      observedReadiness = readiness;
      if (readiness.status !== "ready") return readinessResult<TOutput>(request.operation, base, readiness, ports.initializer.resultSchema);
      return validatedExecutionResult<TOutput>(createProjectorOperationResultSchema("init", ports.initializer.resultSchema), {
        ...base,
        status: "succeeded",
        exitCode: 0,
        readiness,
        output: initialized,
      });
    }

    const operation = ordinaryOperationSchema.parse(request.operation);
    const handler = handlers.get(operation);
    if (handler === undefined) {
      const readiness = ProjectReadinessSchema.parse(await ports.inspectReadiness(request.repositoryRoot, {
        operation,
        package: packageIdentity,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }));
      observedReadiness = readiness;
      return validatedExecutionResult<TOutput>(createProjectorOperationResultSchema(operation, z.never()), {
        ...base,
        status: "unavailable",
        exitCode: 5,
        readiness,
        error: {
          code: "operation-unregistered",
          message: `Operation ${operation} is not registered in this package`,
          retriable: false,
        },
      });
    }

    const access = await ports.withProjectOperationAccess(request.repositoryRoot, {
      operation,
      package: packageIdentity,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    }, async ({ readiness, signal }) => {
      observedReadiness = readiness;
      throwIfAborted(signal);
      const output = await handler.execute(request, {
        package: packageIdentity,
        readiness,
        signal,
        environment: options.environment ?? {},
      });
      throwIfAborted(signal);
      return handler.outputSchema.parse(output);
    });
    if (access.readiness.status !== "ready") {
      return readinessResult<TOutput>(operation, base, ProjectReadinessSchema.parse(access.readiness), handler.outputSchema);
    }
    return validatedExecutionResult<TOutput>(createProjectorOperationResultSchema(operation, handler.outputSchema), {
      ...base,
      status: "succeeded",
      exitCode: 0,
      readiness: access.readiness,
      output: access.value,
    });
  } catch (error) {
    const readiness = observedReadiness ?? unobservedReadiness(packageIdentity, isCancellation(error, options.signal));
    const outputSchema = request.operation === "status"
      ? OperationCapabilityDiscoverySchema
      : request.operation === "init"
        ? ports.initializer.resultSchema
        : handlers.get(request.operation)?.outputSchema ?? z.never();
    const cancelled = isCancellation(error, options.signal);
    return validatedExecutionResult<TOutput>(createProjectorOperationResultSchema(request.operation, outputSchema), {
      ...base,
      status: cancelled ? "cancelled" : "failed",
      exitCode: 6,
      readiness,
      error: {
        code: cancelled ? "operation-cancelled" : "operation-failed",
        message: cancelled ? "Projector operation was cancelled" : message(error),
        retriable: false,
      },
    });
  }
}

function buildRegistry(handlers: readonly AnyProjectorOperationHandler[]): ReadonlyMap<OrdinaryProjectorOperation, ErasedProjectorOperationHandler> {
  const registry = new Map<OrdinaryProjectorOperation, ErasedProjectorOperationHandler>();
  for (const handler of handlers) {
    const operation = ordinaryOperationSchema.parse(handler.operation);
    if (registry.has(operation)) throw new Error(`Duplicate Projector operation handler: ${operation}`);
    registry.set(operation, handler as unknown as ErasedProjectorOperationHandler);
  }
  return registry;
}

function readinessResult<TOutput>(
  operation: ProjectorOperation,
  base: object,
  readiness: ProjectReadiness,
  outputSchema: z.ZodType,
): ProjectorOperationExecutionResult<TOutput> {
  const mapped = mapReadiness(operation, readiness);
  return validatedExecutionResult<TOutput>(createProjectorOperationResultSchema(operation, outputSchema), {
    ...base,
    status: "unavailable",
    exitCode: readiness.status === "recovery-required" ? 6 : 5,
    readiness,
    error: mapped.error,
    ...(mapped.action === undefined ? {} : { action: mapped.action }),
  });
}

function validatedExecutionResult<TOutput>(schema: z.ZodType, input: unknown): ProjectorOperationExecutionResult<TOutput> {
  return schema.parse(input) as ProjectorOperationExecutionResult<TOutput>;
}

function mapReadiness(operation: ProjectorOperation, readiness: ProjectReadiness) {
  const reason = readiness.reason ?? `Project readiness is ${readiness.status}`;
  switch (readiness.status) {
    case "inactive":
      return {
        error: { code: "project-inactive", message: reason, retriable: false },
        action: { kind: "activate" as const, operation: "init" as const, reason },
      };
    case "upgrade-required":
      return {
        error: { code: "project-upgrade-required", message: reason, retriable: false },
        action: { kind: "upgrade" as const, operation: "init" as const, reason },
      };
    case "recovery-required":
      return {
        error: { code: readiness.recovery?.code ?? "project-recovery-required", message: reason, retriable: false },
        action: {
          kind: "recovery-required" as const,
          operation,
          reason: readiness.recovery?.action ?? reason,
        },
      };
    case "busy":
      return {
        error: { code: "project-busy", message: reason, retriable: true },
        action: { kind: "retry" as const, operation, reason },
      };
    case "unavailable":
      return { error: { code: "project-unavailable", message: reason, retriable: false } };
    case "ready":
      return { error: { code: "operation-unavailable", message: reason, retriable: false } };
  }
}

async function readPackageIdentity(packagedRoot: string): Promise<PackageIdentity> {
  const rootStatus = await lstat(packagedRoot);
  if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink()) {
    throw new Error(`Packaged root must be a real directory: ${packagedRoot}`);
  }
  const manifestPath = join(packagedRoot, "package.json");
  const pathStatus = await lstat(manifestPath);
  if (!pathStatus.isFile() || pathStatus.isSymbolicLink()) {
    throw new Error(`Package manifest must be a regular non-symlink file: ${manifestPath}`);
  }
  if (pathStatus.size > maximumPackageManifestBytes) {
    throw new Error(`Package manifest exceeds ${maximumPackageManifestBytes} bytes: ${manifestPath}`);
  }
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const handle = await open(manifestPath, constants.O_RDONLY | noFollow);
  try {
    const handleStatus = await handle.stat();
    if (!handleStatus.isFile() || handleStatus.size > maximumPackageManifestBytes || handleStatus.size !== pathStatus.size) {
      throw new Error(`Package manifest changed during bounded inspection: ${manifestPath}`);
    }
    const buffer = Buffer.alloc(maximumPackageManifestBytes + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maximumPackageManifestBytes) {
      throw new Error(`Package manifest exceeds ${maximumPackageManifestBytes} bytes: ${manifestPath}`);
    }
    const finalStatus = await handle.stat();
    if (finalStatus.size !== handleStatus.size) throw new Error(`Package manifest changed during bounded inspection: ${manifestPath}`);
    if (offset !== handleStatus.size) throw new Error(`Package manifest changed during bounded inspection: ${manifestPath}`);
    const parsed: unknown = JSON.parse(buffer.toString("utf8", 0, offset));
    if (typeof parsed !== "object" || parsed === null) throw new Error("Package manifest must contain an object");
    const manifest = parsed as Record<string, unknown>;
    return PackageIdentitySchema.parse({ name: manifest.name, version: manifest.version });
  } finally {
    await handle.close();
  }
}

function isReachable(operation: ProjectorOperation, readiness: ProjectReadiness["status"]): boolean {
  if (operation === "status") return true;
  if (operation === "init") return readiness === "inactive" || readiness === "ready";
  return readiness === "ready";
}

function assembleCapabilityDiscovery(
  packageIdentity: PackageIdentity,
  readiness: ProjectReadiness,
  handlers: ReadonlyMap<OrdinaryProjectorOperation, ErasedProjectorOperationHandler>,
  observedHostCapabilities: readonly HostCapabilityObservation[],
): OperationCapabilityDiscovery {
  return OperationCapabilityDiscoverySchema.parse({
    package: packageIdentity,
    readiness,
    operations: ProjectorOperationSchema.options.map((operation) => {
      const registered = operation === "status" || operation === "init" || handlers.has(operation as OrdinaryProjectorOperation);
      return {
        operation,
        registered,
        reachable: registered && isReachable(operation, readiness.status),
        reason: capabilityReason(operation, registered, readiness),
      };
    }),
    observedHostCapabilities,
  });
}

function capabilityReason(operation: ProjectorOperation, registered: boolean, readiness: ProjectReadiness): string {
  if (!registered) return "No handler is registered in this package";
  if (isReachable(operation, readiness.status)) return "Registered and reachable under the observed project readiness";
  return `Registered but blocked by observed project readiness ${readiness.status}`;
}

function unobservedReadiness(packageIdentity: PackageIdentity, cancelled: boolean): ProjectReadiness {
  return ProjectReadinessSchema.parse({
    status: "unavailable",
    package: packageIdentity,
    reason: cancelled
      ? "Readiness was not observed because the operation was cancelled"
      : "Readiness was not returned because operation execution failed",
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function isCancellation(error: unknown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
