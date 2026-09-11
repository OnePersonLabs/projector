import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ProjectDataFormatSnapshotSchema } from "@projector/core";
import { afterEach, describe, expect, it } from "vitest";

import { selectPackagedProjectDataMigration } from "./project-data-migration-execution.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("packaged successor migration selection", () => {
  it("selects the sealed 2.1.1 edge from a chain rooted at the 2.1.0 baseline", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-successor-chain-")); roots.push(root);
    const packagedRoot = join(root, "package");
    const repositoryRoot = join(root, "repository");
    await mkdir(join(packagedRoot, "project-data"), { recursive: true });
    await mkdir(join(repositoryRoot, ".projector"), { recursive: true });
    await cp("release/project-data-format-baseline.json", join(packagedRoot, "project-data/format-baseline.json"));
    await cp("release/project-data-formats/2.1.2.json", join(packagedRoot, "project-data/format-target.json"));
    await cp("release/project-data-migrations", join(packagedRoot, "project-data/migrations"), { recursive: true });
    await cp("release/project-data-formats", join(packagedRoot, "project-data/formats"), { recursive: true });
    await writeFile(join(repositoryRoot, ".projector/config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "2.1.1"\n');
    const target = ProjectDataFormatSnapshotSchema.parse(JSON.parse(await readFile("release/project-data-formats/2.1.2.json", "utf8")));

    const selected = await selectPackagedProjectDataMigration(packagedRoot, repositoryRoot, target);

    expect(selected).toMatchObject({
      manifest: { id: "migration:2.1.1-to-2.1.2" },
      sourceAuthority: { kind: "release-format", snapshotHash: "sha256:v1:8d6b251cabba942656c730c1541e83c3a9d8582a0e429c63283ecb7b60a79ca4" },
      sourceFormat: { packageIdentity: { version: "2.1.1" } },
      steps: [{ targetFormat: { packageIdentity: { version: "2.1.2" } } }],
    });
  });
});
