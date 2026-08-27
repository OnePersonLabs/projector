import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkAuthoritativeSpecification } from "./check-spec-human-technical.mjs";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("authoritative specification executable style check", () => {
  it("executes the human-technical checker across the entrypoint, index, and every manifest module", async () => {
    const report = await checkAuthoritativeSpecification();
    const manifest = JSON.parse(await (await import("node:fs/promises")).readFile("PROJECTOR_SPEC/spec.manifest.json", "utf8")) as { entrypoint: string; index: string; modules: Array<{ path: string }> };
    expect(report.files).toEqual([manifest.entrypoint, manifest.index, ...manifest.modules.map(({ path }) => path)]);
    expect(report.blocking).toEqual([]);
  });

  it("ignores exact technical literals and fenced examples but blocks nonconforming prose", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-spec-check-")); roots.push(root);
    await mkdir(join(root, "PROJECTOR_SPEC", "modules"), { recursive: true });
    await writeFile(join(root, "PROJECTOR_SPEC", "spec.manifest.json"), JSON.stringify({ schemaVersion: 1, entrypoint: "SPEC.md", index: "INDEX.md", modules: [{ path: "modules/one.md" }] }));
    await writeFile(join(root, "PROJECTOR_SPEC", "SPEC.md"), "Use `obviously` as an exact token.\n```ts\nconst clearly = true;\n```\n");
    await writeFile(join(root, "PROJECTOR_SPEC", "INDEX.md"), "This is stable.\n");
    await writeFile(join(root, "PROJECTOR_SPEC", "modules", "one.md"), "This is obviously correct.\n");
    await expect(checkAuthoritativeSpecification(root)).resolves.toMatchObject({ blocking: [{ path: "modules/one.md", rule: "modal-filler", count: 1 }] });
  });
});
