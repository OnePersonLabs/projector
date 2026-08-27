import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { initializeProjectActivation, inspectProjectActivation } from "./project-activation.js";

const roots: string[] = [];
async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "projector-runtime-activation-"));
  roots.push(value);
  await mkdir(join(value, ".git"));
  return value;
}
afterEach(async () => Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true }))));

describe("project activation authority", () => {
  it("creates one strict marker and is idempotent", async () => {
    const repositoryRoot = await root();
    expect(await inspectProjectActivation(repositoryRoot)).toMatchObject({ status: "disabled", failure: "missing" });
    expect(await initializeProjectActivation(repositoryRoot)).toMatchObject({ created: true });
    expect(await initializeProjectActivation(repositoryRoot)).toMatchObject({ created: false });
    expect(await inspectProjectActivation(repositoryRoot)).toMatchObject({ status: "enabled" });
    expect(await readFile(join(repositoryRoot, ".projector", "config.json"), "utf8")).toBe('{"apiVersion":"projector.config/v1","enabled":true}\n');
  });

  it("never replaces invalid or unsupported configuration", async () => {
    const repositoryRoot = await root();
    const path = join(repositoryRoot, ".projector", "config.json");
    await mkdir(join(repositoryRoot, ".projector"));
    const original = '{"apiVersion":"projector.config/v2","enabled":true}\n';
    await writeFile(path, original);

    await expect(initializeProjectActivation(repositoryRoot)).rejects.toThrow(/unsupported/iu);
    expect(await readFile(path, "utf8")).toBe(original);
  });

  it("rejects symlink escape at the marker directory", async () => {
    const repositoryRoot = await root();
    const outside = await root();
    await symlink(outside, join(repositoryRoot, ".projector"), "dir");

    expect(await inspectProjectActivation(repositoryRoot)).toMatchObject({ status: "disabled", failure: "unsafe" });
    await expect(initializeProjectActivation(repositoryRoot)).rejects.toThrow(/symbolic|symlink/iu);
    await expect(readFile(join(outside, "config.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
