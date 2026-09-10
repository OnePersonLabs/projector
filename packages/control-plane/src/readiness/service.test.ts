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

  test("recognizes only the bounded legacy JSON marker as requiring one-time preparation", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
    const readiness = await inspectProjectReadiness(root, { operation: "context", package: packageIdentity });
    expect(readiness).toMatchObject({ status: "upgrade-required", observed: { configApiVersion: "projector.config/v1" } });
    expect(await readFile(join(root, ".projector", "config.json"), "utf8")).toBe('{"apiVersion":"projector.config/v1","enabled":true}\n');
  });

  test("reports a current prepared TOML marker as ready", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.toml"), [
      '#:schema schemas/projector-config-v1.schema.json',
      'apiVersion = "projector.config/v1"',
      "enabled = true",
      'projectorVersion = "2.1.0"',
      "",
    ].join("\n"));
    await expect(inspectProjectReadiness(root, { operation: "coverage", package: packageIdentity })).resolves.toMatchObject({
      status: "ready",
      package: packageIdentity,
      observed: { configApiVersion: "projector.config/v1", preparedProjectorVersion: "2.1.0" },
    });
  });

  test("requires recovery without claiming an absent marker-declared backup is verified", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "2.1.0"\n');
    await writeFile(join(root, ".projector", "pending-project-data-migration.json"), JSON.stringify({
      apiVersion: "projector.pending-project-data-migration/v1",
      migrationId: "migration:prepared-data",
      sourceSnapshotHash: `sha256:v1:${"1".repeat(64)}`,
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
        code: "project-data-migration-pending",
        location: ".projector/pending-project-data-migration.json",
        action: expect.stringMatching(/migration:prepared-data.*marker-declared backup backup:prepared-data.*codex-data-relative:projector\/backups\/published\/backup-prepared-data.*verify its existence.*manifest hash/iu),
      },
    });
    const readiness = await inspectProjectReadiness(root, { operation: "context", package: packageIdentity });
    expect(readiness.recovery?.action).not.toMatch(/verified backup/iu);
  });

  test("preserves an unrecognized pending marker and refuses automated recovery", async () => {
    const root = await repository();
    await mkdir(join(root, ".projector"));
    const pendingPath = join(root, ".projector", "pending-project-data-migration.json");
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "2.1.0"\n');
    await writeFile(pendingPath, "{unrecognized");

    await expect(inspectProjectReadiness(root, { operation: "verify", package: packageIdentity })).resolves.toMatchObject({
      status: "unavailable",
      recovery: {
        code: "project-data-migration-unrecognized",
        location: ".projector/pending-project-data-migration.json",
        action: expect.stringMatching(/preserve.*inspect/iu),
      },
    });
    expect(await readFile(pendingPath, "utf8")).toBe("{unrecognized");
  });

  test("does not treat a newer, mixed, or malformed marker as current", async () => {
    for (const fixture of [
      { name: "newer", files: { "config.toml": 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "3.0.0"\n' } },
      { name: "mixed", files: { "config.toml": 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "2.1.0"\n', "config.json": '{"apiVersion":"projector.config/v1","enabled":true}\n' } },
      { name: "malformed", files: { "config.toml": 'apiVersion = "projector.config/v1"\nenabled = "yes"\n' } },
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
    await writeFile(join(outside, "config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "2.1.0"\n');
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
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "2.1.0"\n');

    const result = await withProjectOperationAccess(root, { operation: "context", package: packageIdentity }, async ({ readiness }) => {
      expect(readiness.status).toBe("ready");
      return 42;
    });

    expect(result).toMatchObject({ readiness: { status: "ready" }, value: 42 });
    expect(await readdir(join(root, ".projector", "runtime", "operation-access", "holders"))).toEqual([]);
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
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "2.1.0"\n');
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

  test("initializes schemas before publishing prepared configuration and is idempotent", async () => {
    const root = await repository();

    await expect(initializePreparedProject(root, { package: packageIdentity })).resolves.toMatchObject({
      created: true,
      readiness: { status: "ready", observed: { preparedProjectorVersion: "2.1.0" } },
    });
    await expect(initializePreparedProject(root, { package: packageIdentity })).resolves.toMatchObject({ created: false });
    expect(await readFile(join(root, ".projector", "config.toml"), "utf8")).toMatch(/^#:schema schemas\/projector-config-v1\.schema\.json\n/u);
    expect(JSON.parse(await readFile(join(root, ".projector", "schemas", "projector-config-v1.schema.json"), "utf8")))
      .toMatchObject({ $schema: "https://json-schema.org/draft/2020-12/schema" });
  });

  test("leaves configuration unpublished when schema staging fails", async () => {
    const root = await repository();
    const schemaPath = join(root, ".projector", "schemas", "canonical-document-v2.schema.json");
    await mkdir(join(schemaPath, ".."), { recursive: true });
    await writeFile(schemaPath, "{}\n");

    await expect(initializePreparedProject(root, { package: packageIdentity })).rejects.toThrow(/differs from the installed Projector bundle/i);
    await expect(stat(join(root, ".projector", "config.toml"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
