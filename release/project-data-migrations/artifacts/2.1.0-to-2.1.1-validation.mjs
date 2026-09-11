import { CanonicalFileRepository, parseTomlDocument } from "../../../exports/runtime.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const projectDataMigrationArtifact = Object.freeze({
  apiVersion: "projector.project-data-migration-artifact/v1",
  id: "validation:2.1.0-to-2.1.1",
  kind: "validation",
  async run(context) {
    if (context.signal.aborted) throw context.signal.reason;
    if (context.source.kind !== "release-format") {
      throw new Error("The 2.1.1 validation requires a released-format source observation");
    }
    const config = parseTomlDocument(
      await readFile(join(context.stagingRoot, ".projector", "config.toml"), "utf8"),
      "staged .projector/config.toml",
    );
    if (config.projectorVersion !== context.targetFormat.packageIdentity.version) {
      throw new Error("Staged config does not select the target Projector release");
    }
    await new CanonicalFileRepository(context.stagingRoot).snapshot();
    if (context.signal.aborted) throw context.signal.reason;
    return { apiVersion: "projector.project-data-migration-validation-result/v1", status: "passed" };
  },
});
