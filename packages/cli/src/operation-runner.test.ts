import { mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ProjectReadinessSchema,
  ProjectorOperationInputSchemas,
  ProjectorOperationRequestSchema,
  type PackageIdentity,
  type ProjectReadiness,
  type ProjectorOperation,
} from "@projector/core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

import {
  createProjectorOperationRunner,
  createBundledProjectorOperationRunner,
  createInstalledProjectorApplicationEvidenceHost,
  defineProjectorOperationHandler,
  OperationCapabilityDiscoverySchema,
  type OperationRunnerPorts,
  type ProjectorOperationHandler,
} from "./operation-runner.js";

const roots: string[] = [];
const ready = (packageIdentity: PackageIdentity): ProjectReadiness => ({
  status: "ready",
  package: packageIdentity,
  observed: { configApiVersion: "projector.config/v1", preparedProjectorVersion: packageIdentity.version },
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 20,
  })));
});

async function packagedRoot(manifest: object = { name: "@projector/cli", version: "7.4.2", private: true }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-operation-runner-"));
  roots.push(root);
  await writeFile(join(root, "package.json"), `${JSON.stringify(manifest)}\n`);
  return root;
}

function request(operation: ProjectorOperation, input: object = {}) {
  return {
    apiVersion: "projector.operation/v1",
    operation,
    repositoryRoot: "C:/repository",
    requestId: "request-17",
    input,
  };
}

function ports(overrides: Partial<OperationRunnerPorts> = {}): OperationRunnerPorts {
  const packageIdentity = { name: "@projector/cli", version: "7.4.2" };
  return {
    inspectReadiness: async () => ready(packageIdentity),
    initializer: {
      resultSchema: z.strictObject({ readiness: ProjectReadinessSchema, created: z.boolean() }),
      execute: async () => ({ readiness: ready(packageIdentity), created: true }),
    },
    withProjectOperationAccess: async (_root, _input, callback) => ({
      readiness: ready(packageIdentity) as ProjectReadiness & { status: "ready" },
      value: await callback({
        readiness: ready(packageIdentity) as ProjectReadiness & { status: "ready" },
        signal: new AbortController().signal,
      }),
    }),
    observedHostCapabilities: [],
    ...overrides,
  };
}

const handlerOutputSchema = z.strictObject({ valid: z.boolean() });

function handler(
  operation: "verify" = "verify",
  execute: ProjectorOperationHandler<
    "verify",
    typeof ProjectorOperationInputSchemas.verify,
    typeof handlerOutputSchema
  >["execute"] = async () => ({ valid: true }),
): ProjectorOperationHandler<"verify", typeof ProjectorOperationInputSchemas.verify, typeof handlerOutputSchema> {
  return defineProjectorOperationHandler({
    operation,
    inputSchema: ProjectorOperationInputSchemas.verify,
    outputSchema: handlerOutputSchema,
    execute,
  });
}

describe("bounded Projector operation runner", () => {
  test("reads an exact missing application artifact without creating repository state", async () => {
    const root = await packagedRoot();
    const host = createInstalledProjectorApplicationEvidenceHost({
      repositoryRoot: root,
      signal: new AbortController().signal,
      environment: process.env,
    });

    await expect(host.artifacts.read("psychord-missing-artifact-set")).resolves.toEqual({
      status: "missing",
      artifactSetId: "psychord-missing-artifact-set",
    });
    await expect(stat(join(root, ".projector"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("composes installed readiness, initialization, verification, and observed host capabilities", async () => {
    const root = await packagedRoot();
    const applicationEvidence = vi.fn(createInstalledProjectorApplicationEvidenceHost);
    const runner = await createBundledProjectorOperationRunner({ packagedRoot: root, applicationEvidence });

    const inactive = await runner.discoverCapabilities({ repositoryRoot: root });
    expect(applicationEvidence).not.toHaveBeenCalled();
    await expect(stat(join(root, ".projector/runtime/application-evidence"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(inactive.readiness.status).toBe("inactive");
    expect(inactive.operations.find(({ operation }) => operation === "verify")).toMatchObject({
      registered: true,
      reachable: true,
    });
    expect(inactive.operations.find(({ operation }) => operation === "representation.inspect")).toMatchObject({
      registered: true,
      reachable: true,
    });
    expect(inactive.operations.find(({ operation }) => operation === "application.observe")).toMatchObject({
      registered: false,
      reachable: false,
    });
    for (const operation of [
      "change.capture",
      "change.plan",
      "change.approve",
      "change.apply",
      "change.recover",
      "change.resume",
    ] as const) {
      expect(inactive.operations.find((capability) => capability.operation === operation)).toMatchObject({
        registered: true,
        reachable: true,
      });
    }
    expect(inactive.observedHostCapabilities).toEqual([
      expect.objectContaining({ capability: "process.cpu-limit-enforcement", available: false }),
      expect.objectContaining({ capability: "process.memory-limit-enforcement", available: false }),
    ]);

    await expect(runner.execute({ ...request("init"), repositoryRoot: root })).resolves.toMatchObject({
      status: "succeeded",
      output: { created: true, readiness: { status: "ready" } },
    });
    await expect(runner.execute({ ...request("verify"), repositoryRoot: root })).resolves.toMatchObject({
      status: "succeeded",
      readiness: { status: "ready" },
      output: { command: "verify", exitCode: 5, exitProof: { requiredUnavailable: true } },
    });
    expect(applicationEvidence).toHaveBeenCalledOnce();
    await expect(stat(join(root, ".projector/runtime/application-evidence"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("reports inactive status by bounded inspection without invoking mutation ports", async () => {
    const root = await packagedRoot();
    let initialized = false;
    let accessed = false;
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [handler()],
      ports: ports({
        inspectReadiness: async (_repositoryRoot, input) => ({
          status: "inactive",
          package: input.package,
          reason: "Projector is not active",
        }),
        initializer: {
          resultSchema: z.strictObject({ readiness: ProjectReadinessSchema, created: z.boolean() }),
          execute: async () => {
            initialized = true;
            throw new Error("unexpected init");
          },
        },
        withProjectOperationAccess: async () => {
          accessed = true;
          throw new Error("unexpected access");
        },
      }),
    });

    await expect(runner.execute(request("status"))).resolves.toMatchObject({
      status: "succeeded",
      operation: "status",
      requestId: "request-17",
      readiness: { status: "inactive" },
      output: { readiness: { status: "inactive" }, package: { name: "@projector/cli" } },
    });
    expect(initialized).toBe(false);
    expect(accessed).toBe(false);
  });

  test("delivers bounded cleanup continuation through the installed composition schema", async () => {
    const root = await packagedRoot();
    const runner = await createBundledProjectorOperationRunner({ packagedRoot: root, applicationEvidence: createInstalledProjectorApplicationEvidenceHost });
    expect(await runner.execute({ ...request("init"), repositoryRoot: root })).toMatchObject({ status: "succeeded" });
    const contextId = "knowledge_context_00000000000000000000000000000000";
    const continued = await runner.execute({ ...request("cleanup", { contextId, evidenceLimit: 1 }), repositoryRoot: root });
    expect(continued).toMatchObject({ status: "succeeded", output: { continuation: { context: { status: "unknown" }, page: { included: 1 }, nextAction: { operation: "context", repositoryRoot: root } } } });
    expect(await runner.execute({ ...request("cleanup", { contextId, evidenceLimit: 51 }), repositoryRoot: root })).toMatchObject({ status: "failed" });
    expect(await runner.execute({ ...request("complete", { contextId }), repositoryRoot: root })).toMatchObject({ status: "failed" });
  });

  test("blocks a registered handler when operation access reports nonready", async () => {
    const root = await packagedRoot();
    let invoked = false;
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [handler("verify", async () => {
        invoked = true;
        return { valid: true };
      })],
      ports: ports({
        withProjectOperationAccess: async (_repositoryRoot, input) => ({
          readiness: { status: "inactive", package: input.package, reason: "Activation required" },
        }),
      }),
    });

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "unavailable",
      error: { code: "project-inactive" },
      action: { kind: "activate", operation: "init" },
    });
    expect(invoked).toBe(false);
  });

  test("returns the initializer owner's exact strict result without projection", async () => {
    const root = await packagedRoot();
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [],
      ports: ports(),
    });

    const result = await runner.execute(request("init"));
    expect(result).toMatchObject({
      status: "succeeded",
      operation: "init",
      readiness: { status: "ready" },
      output: { readiness: { status: "ready" }, created: true },
    });
    expect(Object.keys((result as { output: object }).output).sort()).toEqual(["created", "readiness"]);
  });

  test("preserves recovery metadata and directs the requested operation to recovery", async () => {
    const root = await packagedRoot();
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [handler("verify")],
      ports: ports({
        withProjectOperationAccess: async (_repositoryRoot, input) => ({
          readiness: {
            status: "recovery-required",
            package: input.package,
            reason: "Interrupted migration",
            recovery: {
              code: "migration-pending",
              location: ".projector/runtime/migrations/pending.json",
              action: "Recover the recognized pending migration",
            },
          },
        }),
      }),
    });

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "unavailable",
      exitCode: 6,
      readiness: { recovery: { code: "migration-pending", location: ".projector/runtime/migrations/pending.json" } },
      error: { code: "migration-pending" },
      action: { kind: "recovery-required", operation: "verify", reason: "Recover the recognized pending migration" },
    });
  });

  test("propagates the access-owned signal for the full handler and reports cancellation", async () => {
    const root = await packagedRoot();
    const accessController = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [handler("verify", async (_request, context) => {
        receivedSignal = context.signal;
        accessController.abort(new DOMException("stopped", "AbortError"));
        throw accessController.signal.reason;
      })],
      ports: ports({
        withProjectOperationAccess: async (_repositoryRoot, input, callback) => ({
          readiness: ready(input.package) as ProjectReadiness & { status: "ready" },
          value: await callback({
            readiness: ready(input.package) as ProjectReadiness & { status: "ready" },
            signal: accessController.signal,
          }),
        }),
      }),
    });

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "cancelled",
      exitCode: 6,
      error: { code: "operation-access-lost" },
    });
    expect(receivedSignal).toBe(accessController.signal);
  });

  test("classifies a non-AbortError access-signal loss as cancelled access", async () => {
    const root = await packagedRoot();
    const accessController = new AbortController();
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [handler("verify", async () => {
        accessController.abort(new Error("operation access heartbeat failed"));
        throw new Error("handler observed lost access");
      })],
      ports: ports({
        withProjectOperationAccess: async (_repositoryRoot, input, callback) => ({
          readiness: ready(input.package) as ProjectReadiness & { status: "ready" },
          value: await callback({
            readiness: ready(input.package) as ProjectReadiness & { status: "ready" },
            signal: accessController.signal,
          }),
        }),
      }),
    });

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "cancelled",
      exitCode: 6,
      error: {
        code: "operation-access-lost",
        message: expect.stringMatching(/access was lost.*heartbeat failed/iu),
      },
    });
  });

  test("rejects undeclared handler output instead of silently stripping it", async () => {
    const root = await packagedRoot();
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [handler("verify", async () => ({ valid: true, invented: "claim" }))],
      ports: ports(),
    });

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "failed",
      error: { code: "operation-failed", message: expect.stringMatching(/unrecognized key/iu) },
    });
  });

  test("rejects stripping by a default object schema", async () => {
    const root = await packagedRoot();
    const outputSchema = z.object({ valid: z.boolean() });
    const strippingHandler = defineProjectorOperationHandler({
      operation: "verify",
      inputSchema: ProjectorOperationInputSchemas.verify,
      outputSchema,
      execute: async () => ({ valid: true, undeclared: "would be stripped" }),
    });
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [strippingHandler],
      ports: ports(),
    });

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "failed",
      error: { message: expect.stringMatching(/transformed.*stripped.*coerced/iu) },
    });
  });

  test("rejects schema coercion even when the coerced value would validate", async () => {
    const root = await packagedRoot();
    const outputSchema = z.strictObject({ count: z.coerce.number() });
    const coercingHandler = defineProjectorOperationHandler({
      operation: "verify",
      inputSchema: ProjectorOperationInputSchemas.verify,
      outputSchema,
      execute: async () => ({ count: "7" }) as never,
    });
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [coercingHandler],
      ports: ports(),
    });

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "failed",
      error: { message: expect.stringMatching(/transformed.*coerced/iu) },
    });
  });

  test("rejects initializer stripping and non-JSON handler values", async () => {
    const root = await packagedRoot();
    const initializerResultSchema = z.object({ readiness: ProjectReadinessSchema, created: z.boolean() });
    const initializerRunner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [],
      ports: ports({
        initializer: {
          resultSchema: initializerResultSchema,
          execute: async () => ({ readiness: ready({ name: "@projector/cli", version: "7.4.2" }), created: true, extra: true }),
        },
      }),
    });
    await expect(initializerRunner.execute(request("init"))).resolves.toMatchObject({
      status: "failed",
      error: { message: expect.stringMatching(/initializer result schema transformed/iu) },
    });

    const nonJsonSchema = z.any();
    const nonJsonRunner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [defineProjectorOperationHandler({
        operation: "verify",
        inputSchema: ProjectorOperationInputSchemas.verify,
        outputSchema: nonJsonSchema,
        execute: async () => new Date("2026-09-10T00:00:00.000Z"),
      })],
      ports: ports(),
    });
    await expect(nonJsonRunner.execute(request("verify"))).resolves.toMatchObject({
      status: "failed",
      error: { message: expect.stringMatching(/not a plain JSON object/iu) },
    });
  });

  test("reports an unregistered application operation without pretending to validate owner input", async () => {
    const root = await packagedRoot();
    let accessed = false;
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [],
      ports: ports({
        withProjectOperationAccess: async () => {
          accessed = true;
          throw new Error("unexpected access");
        },
      }),
    });

    await expect(runner.execute(request("application.observe", { ownerSchemaIsUnavailable: { future: true } }))).resolves.toMatchObject({
      status: "unavailable",
      operation: "application.observe",
      package: { name: "@projector/cli", version: "7.4.2" },
      error: { code: "operation-unregistered", retriable: false },
    });
    expect(accessed).toBe(false);
  });

  test("executes a registered application operation through its exact owner input schema", async () => {
    const root = await packagedRoot();
    const inputSchema = z.strictObject({
      plan: z.strictObject({
        schemaVersion: z.literal("test-application-plan@1"),
        runId: z.string().min(1),
      }),
    });
    const outputSchema = z.strictObject({ observedRunId: z.string().min(1) });
    let invocations = 0;
    const applicationHandler = defineProjectorOperationHandler({
      operation: "application.observe",
      inputSchema,
      outputSchema,
      execute: async (operationRequest) => {
        invocations += 1;
        return { observedRunId: operationRequest.input.plan.runId };
      },
    });
    const applicationRequest = request("application.observe", {
      plan: { schemaVersion: "test-application-plan@1", runId: "run:17" },
    });
    expect(ProjectorOperationRequestSchema.safeParse(applicationRequest).success).toBe(false);

    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [applicationHandler],
      ports: ports(),
    });
    await expect(runner.execute(applicationRequest)).resolves.toMatchObject({
      status: "succeeded",
      operation: "application.observe",
      output: { observedRunId: "run:17" },
    });
    await expect(runner.execute(request("application.observe", {
      plan: { schemaVersion: "test-application-plan@1", runId: "run:18" },
      undeclared: true,
    }))).resolves.toMatchObject({
      status: "failed",
      error: { code: "operation-failed", message: expect.stringMatching(/unrecognized key/iu) },
    });
    expect(invocations).toBe(1);
  });

  test("refuses owner input coercion, defaults, and transforms before handler invocation", async () => {
    const root = await packagedRoot();
    let invocations = 0;

    const coercingRunner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [defineProjectorOperationHandler({
        operation: "application.observe",
        inputSchema: z.strictObject({ count: z.coerce.number() }),
        outputSchema: handlerOutputSchema,
        execute: async () => {
          invocations += 1;
          return { valid: true };
        },
      })],
      ports: ports(),
    });
    await expect(coercingRunner.execute(request("application.observe", { count: "7" }))).resolves.toMatchObject({
      status: "failed",
      error: { message: expect.stringMatching(/application\.observe request schema transformed.*coerced/iu) },
    });

    const defaultingRunner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [defineProjectorOperationHandler({
        operation: "application.observe",
        inputSchema: z.strictObject({ label: z.string().default("default-label") }),
        outputSchema: handlerOutputSchema,
        execute: async () => {
          invocations += 1;
          return { valid: true };
        },
      })],
      ports: ports(),
    });
    await expect(defaultingRunner.execute(request("application.observe", {}))).resolves.toMatchObject({
      status: "failed",
      error: { message: expect.stringMatching(/application\.observe request schema transformed.*defaulted/iu) },
    });

    const transformingRunner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [defineProjectorOperationHandler({
        operation: "application.observe",
        inputSchema: z.strictObject({ label: z.string().transform((value) => value.toUpperCase()) }),
        outputSchema: handlerOutputSchema,
        execute: async () => {
          invocations += 1;
          return { valid: true };
        },
      })],
      ports: ports(),
    });
    await expect(transformingRunner.execute(request("application.observe", { label: "raw-label" }))).resolves.toMatchObject({
      status: "failed",
      error: { message: expect.stringMatching(/application\.observe request schema transformed/iu) },
    });
    expect(invocations).toBe(0);
  });

  test("keeps registry reachability, readiness, and direct host observations distinct", async () => {
    const root = await packagedRoot();
    const runner = await createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [handler("verify")],
      ports: ports({
        inspectReadiness: async (_repositoryRoot, input) => ({
          status: "inactive",
          package: input.package,
          reason: "Activation required",
        }),
        observedHostCapabilities: [{
          capability: "process-group-termination",
          available: true,
          evidence: "Direct host probe returned success",
        }],
      }),
    });

    const discovery = await runner.discoverCapabilities({ repositoryRoot: "C:/repository" });
    expect(discovery.readiness.status).toBe("inactive");
    expect(discovery.operations.find(({ operation }) => operation === "verify")).toMatchObject({
      registered: true,
      reachable: true,
      reason: expect.stringMatching(/readiness is reported separately/iu),
    });
    expect(discovery.operations.find(({ operation }) => operation === "coverage")).toMatchObject({
      registered: false,
      reachable: false,
    });
    expect(discovery.observedHostCapabilities).toEqual([{
      capability: "process-group-termination",
      available: true,
      evidence: "Direct host probe returned success",
    }]);

    const duplicatedOperations = discovery.operations.map((item) => ({ ...item }));
    duplicatedOperations[duplicatedOperations.length - 1] = { ...duplicatedOperations[0]! };
    expect(OperationCapabilityDiscoverySchema.safeParse({ ...discovery, operations: duplicatedOperations })).toMatchObject({
      success: false,
    });
  });

  test("rejects duplicate or conflicting observed host capability keys", async () => {
    const root = await packagedRoot();
    await expect(createProjectorOperationRunner({
      packagedRoot: root,
      handlers: [],
      ports: ports({
        observedHostCapabilities: [
          { capability: "process-tree-observation", available: true, evidence: "probe A" },
          { capability: "process-tree-observation", available: false, evidence: "probe B" },
        ],
      }),
    })).rejects.toThrow(/duplicate or conflicting host capability/iu);
  });

  test("derives exact identity from the supplied package manifest", async () => {
    const root = await packagedRoot({ name: "@vendor/projector", version: "12.3.4-beta.1", private: true });
    const runner = await createProjectorOperationRunner({ packagedRoot: root, handlers: [], ports: ports() });
    expect(runner.package).toEqual({ name: "@vendor/projector", version: "12.3.4-beta.1" });
  });

  test("rejects symlinked and oversized package manifests", async () => {
    const linkedRoot = await mkdtemp(join(tmpdir(), "projector-operation-runner-link-"));
    roots.push(linkedRoot);
    const outside = await packagedRoot();
    await symlink(join(outside, "package.json"), join(linkedRoot, "package.json"), "file");
    await expect(createProjectorOperationRunner({ packagedRoot: linkedRoot, handlers: [], ports: ports() }))
      .rejects.toThrow(/regular non-symlink/iu);

    const oversizedRoot = await packagedRoot({ name: "@projector/cli", version: "7.4.2", padding: "x".repeat(17_000) });
    await expect(createProjectorOperationRunner({ packagedRoot: oversizedRoot, handlers: [], ports: ports() }))
      .rejects.toThrow(/exceeds 16384 bytes/iu);
    await expect(stat(join(oversizedRoot, "package.json"))).resolves.toMatchObject({ isFile: expect.any(Function) });
  });
});
