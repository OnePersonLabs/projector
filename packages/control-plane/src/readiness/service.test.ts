import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { PreparedProjectInitializationResultSchema } from "../index.js";
import {
  initializePreparedProject,
  inspectProjectReadiness,
  withProjectOperationAccess,
} from "./service.js";

const roots: string[] = [];
const packageIdentity = { name: "projector", version: "2.1.0" } as const;

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-readiness-"));
  roots.push(root);
  await mkdir(join(root, ".git"));
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project readiness metadata inspection", () => {
  test("serializes only a strict initialized-project readiness result", async () => {
    const root = await repository();
    const value = {
      readiness: await inspectProjectReadiness(root, { operation: "init", package: packageIdentity }),
      created: false,
    };
    expect(PreparedProjectInitializationResultSchema.parse(value)).toEqual(value);
    expect(() => PreparedProjectInitializationResultSchema.parse({ ...value, extra: true })).toThrow();
  });

  test("reports an inactive repository without creating Projector state", async () => {
    const root = await repository();
    const readiness = await inspectProjectReadiness(root, { operation: "status", package: packageIdentity });
    expect(readiness).toMatchObject({ status: "inactive", package: packageIdentity });
    await expect(stat(join(root, ".projector"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("leaves unsupported legacy JSON configuration untouched", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
    const readiness = await inspectProjectReadiness(root, { operation: "context", package: packageIdentity });
    expect(readiness).toMatchObject({ status: "unavailable", reason: expect.stringContaining("Unsupported legacy") });
    expect(await readFile(join(root, ".projector", "config.json"), "utf8")).toBe('{"apiVersion":"projector.config/v1","enabled":true}\n');
  });

  test("reports a current prepared TOML marker as ready", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.toml"), [
      '#:schema schemas/projector-config-v3.schema.json',
      'apiVersion = "projector.config/v3"',
      "enabled = true",
      'projectorVersion = "2.1.0"',
      "",
    ].join("\n"));
    await expect(inspectProjectReadiness(root, { operation: "coverage", package: packageIdentity })).resolves.toMatchObject({
      status: "ready",
      package: packageIdentity,
      observed: { configApiVersion: "projector.config/v3", preparedProjectorVersion: "2.1.0" },
    });
  });

  test("keeps current-format data ready across package patch versions", async () => {
    const root = await repository();
    await initializePreparedProject(root, { package: { name: "projector", version: "3.0.0" } });
    const before = await readFile(join(root, ".projector/config.toml"), "utf8");
    await expect(inspectProjectReadiness(root, { operation: "context", package: { name: "projector", version: "3.0.9" } })).resolves.toMatchObject({ status: "ready", observed: { preparedProjectorVersion: "3.0.0" } });
    expect(await readFile(join(root, ".projector/config.toml"), "utf8")).toBe(before);
  });

  test("requires recovery without claiming an absent marker-declared backup is verified", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "2.1.0"\n');
    await writeFile(join(root, ".projector", "pending-project-data-migration.json"), JSON.stringify({
      apiVersion: "projector.pending-project-data-migration/v2",
      attemptId: "migration-attempt:prepared-data:001",
      migrationId: "migration:prepared-data",
      sourceAuthority: { kind: "release-format", snapshotHash: `sha256:v1:${"1".repeat(64)}` },
      targetSnapshotHash: `sha256:v1:${"2".repeat(64)}`,
      manifestHash: `sha256:v1:${"3".repeat(64)}`,
      backup: {
        id: "backup:prepared-data",
        location: { kind: "codex-data-relative", path: "projector/backups/published/backup-prepared-data" },
        manifestHash: `sha256:v1:${"4".repeat(64)}`,
      },
      stagingLocation: "runtime/migrations/staging/migration-prepared-data",
      phase: "publishing",
      createdAt: "2026-09-10T12:00:00.000Z",
    }));

    await expect(inspectProjectReadiness(root, { operation: "context", package: packageIdentity })).resolves.toMatchObject({
      status: "recovery-required",
      recovery: {
        code: "project-data-cutover-required",
        location: ".projector/pending-project-data-migration.json",
        action: expect.stringContaining("matching pre-cutover runtime"),
      },
    });
    const readiness = await inspectProjectReadiness(root, { operation: "context", package: packageIdentity });
    expect(readiness.recovery?.action).not.toMatch(/verified backup/iu);
  });

  test("preserves an unrecognized pending marker and refuses automated recovery", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    const pendingPath = join(root, ".projector", "pending-project-data-migration.json");
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "2.1.0"\n');
    await writeFile(pendingPath, "{unrecognized");

    await expect(inspectProjectReadiness(root, { operation: "verify", package: packageIdentity })).resolves.toMatchObject({
      status: "recovery-required",
      recovery: {
        code: "project-data-cutover-required",
        location: ".projector/pending-project-data-migration.json",
        action: expect.stringContaining("Inspect the retained operation"),
      },
    });
    expect(await readFile(pendingPath, "utf8")).toBe("{unrecognized");
  });

  test("does not treat an unsupported format, mixed or malformed marker as current", async () => {
    for (const fixture of [
      { name: "unsupported", files: { "config.toml": 'apiVersion = "projector.config/v4"\nenabled = true\nprojectorVersion = "3.0.0"\n' } },
      { name: "mixed", files: { "config.toml": 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "2.1.0"\n', "config.json": '{"apiVersion":"projector.config/v1","enabled":true}\n' } },
      { name: "malformed", files: { "config.toml": 'apiVersion = "projector.config/v3"\nenabled = "yes"\n' } },
    ] as const) {
      const root = await repository();
      await mkdir(join(root, ".projector"));
      for (const [name, contents] of Object.entries(fixture.files)) await writeFile(join(root, ".projector", name), contents);
      const readiness = await inspectProjectReadiness(root, { operation: "verify", package: packageIdentity });
      expect(readiness.status, fixture.name).toBe("unavailable");
    }
  });

  test("rejects activation metadata reached through a symlinked Projector directory", async () => {
    const root = await repository();
    const outside = await mkdtemp(join(tmpdir(), "projector-readiness-outside-"));
    roots.push(outside);
    await writeFile(join(outside, "config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "2.1.0"\n');
    await symlink(outside, join(root, ".projector"), "dir");

    await expect(inspectProjectReadiness(root, { operation: "status", package: packageIdentity })).resolves.toMatchObject({
      status: "unavailable",
      reason: expect.stringMatching(/symbolic|symlink/iu),
    });
  });

  test("honors cancellation before touching repository metadata", async () => {
    const root = await repository();
    const controller = new AbortController();
    controller.abort();
    await expect(inspectProjectReadiness(root, { operation: "context", package: packageIdentity, signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    await expect(stat(join(root, ".projector"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("invokes an ordinary operation only while current readiness has shared access", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "2.1.0"\n');

    const result = await withProjectOperationAccess(root, { operation: "context", package: packageIdentity }, async ({ readiness }) => {
      expect(readiness.status).toBe("ready");
      return 42;
    });

    expect(result).toMatchObject({ readiness: { status: "ready" }, value: 42 });
    expect(await readdir(join(root, ".projector", "runtime", "operation-access", "holders"))).toEqual([]);
  });

  test("collects interrupted disposable staging before a context operation acquires shared access", async () => {
    const root = await repository();
    const cache = join(root, ".projector", "runtime", "knowledge", "contexts");
    await mkdir(cache, { recursive: true });
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "2.1.0"\n');
    const stage = join(cache, `${"a".repeat(32)}.json.999999.abc.tmp`);
    await writeFile(stage, "interrupted disposable bytes");
    await withProjectOperationAccess(root, { operation: "context", package: packageIdentity }, async () => {
      await expect(stat(stage)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("does not invoke an ordinary operation when the repository is inactive", async () => {
    const root = await repository();
    let invoked = false;

    const result = await withProjectOperationAccess(root, { operation: "context", package: packageIdentity }, async () => {
      invoked = true;
    });

    expect(result.readiness.status).toBe("inactive");
    expect(invoked).toBe(false);
    await expect(stat(join(root, ".projector"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("returns a recovery route for corrupt cooperative access state", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector", "runtime", "operation-access", "holders"), { recursive: true });
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "2.1.0"\n');
    await writeFile(join(root, ".projector", "runtime", "operation-access", "holders", "bad.json"), "{broken");

    const result = await withProjectOperationAccess(root, { operation: "verify", package: packageIdentity }, async () => "unreachable");

    expect(result).toMatchObject({
      readiness: {
        status: "recovery-required",
        recovery: { code: "operation-access-corrupt", action: expect.any(String) },
      },
    });
    expect("value" in result).toBe(false);
  });

  test("lets explicit lifecycle recovery reclaim an expired claim from its exited process", async () => {
    const root = await repository();
    await initializePreparedProject(root, { package: packageIdentity });
    await withProjectOperationAccess(root, { operation: "context", package: packageIdentity }, async () => undefined);
    const access = join(root, ".projector", "runtime", "operation-access");
    const requestId = "00000000-0000-4000-8000-000000000003";
    const exited = spawn(process.execPath, ["--eval", ""]);
    const exitedProcessId = exited.pid!;
    await new Promise<void>((resolve) => exited.once("exit", () => resolve()));
    const timestamp = "2000-01-01T00:00:00.000Z";
    await writeFile(join(access, "holders", `${requestId}.json`), `${JSON.stringify({
      version: 1,
      requestId,
      ticket: 2,
      operation: "change.apply",
      mode: "shared",
      processId: exitedProcessId,
      createdAt: timestamp,
      heartbeatAt: timestamp,
    })}\n`);
    await writeFile(join(access, "next-ticket"), "2\n");

    const result = await withProjectOperationAccess(root, { operation: "change.recover", package: packageIdentity }, async () => "reached");

    expect(result).toMatchObject({ readiness: { status: "ready" }, value: "reached" });
    expect(await readdir(join(access, "holders"))).toEqual([]);
  });

  test("initializes schemas before publishing prepared configuration and is idempotent", async () => {
    const root = await repository();

    await expect(initializePreparedProject(root, { package: packageIdentity })).resolves.toMatchObject({
      created: true,
      readiness: { status: "ready", observed: { preparedProjectorVersion: "2.1.0" } },
    });
    await expect(initializePreparedProject(root, { package: packageIdentity })).resolves.toMatchObject({ created: false });
    expect(await readFile(join(root, ".projector", "config.toml"), "utf8")).toMatch(/^#:schema schemas\/projector-config-v3\.schema\.json\n/u);
    expect(JSON.parse(await readFile(join(root, ".projector", "schemas", "projector-config-v3.schema.json"), "utf8")))
      .toMatchObject({ $schema: "http://json-schema.org/draft-04/schema#" });
  });

  test("leaves configuration unpublished when schema staging fails", async () => {
    const root = await repository();
    const schemaPath = join(root, ".projector", "schemas", "canonical-concept-v3.schema.json");
    await mkdir(join(schemaPath, ".."), { recursive: true });
    await writeFile(schemaPath, "{}\n");

    await expect(initializePreparedProject(root, { package: packageIdentity })).rejects.toThrow(/differs from the installed Projector bundle/i);
    await expect(stat(join(root, ".projector", "config.toml"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
