import { mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ProjectReadinessSchema, type PackageIdentity, type ProjectReadiness, type ProjectorOperation } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";

import {
  createProjectorOperationRunner,
  defineProjectorOperationHandler,
  type OperationRunnerPorts,
  type OrdinaryProjectorOperation,
  type ProjectorOperationHandler,
} from "./operation-runner.js";

const roots: string[] = [];
const ready = (packageIdentity: PackageIdentity): ProjectReadiness => ({
  status: "ready",
  package: packageIdentity,
  observed: { configApiVersion: "projector.config/v1", preparedProjectorVersion: packageIdentity.version },
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
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

function handler<const TOperation extends OrdinaryProjectorOperation>(
  operation: TOperation = "verify" as TOperation,
  execute: ProjectorOperationHandler<TOperation, typeof handlerOutputSchema>["execute"] = async () => ({ valid: true }),
): ProjectorOperationHandler<TOperation, typeof handlerOutputSchema> {
  return defineProjectorOperationHandler({ operation, outputSchema: handlerOutputSchema, execute });
}

describe("bounded Projector operation runner", () => {
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
      error: { code: "operation-cancelled" },
    });
    expect(receivedSignal).toBe(accessController.signal);
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

  test("reports a canonical but unregistered operation as unavailable", async () => {
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

    await expect(runner.execute(request("verify"))).resolves.toMatchObject({
      status: "unavailable",
      package: { name: "@projector/cli", version: "7.4.2" },
      error: { code: "operation-unregistered", retriable: false },
    });
    expect(accessed).toBe(false);
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
      reachable: false,
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
