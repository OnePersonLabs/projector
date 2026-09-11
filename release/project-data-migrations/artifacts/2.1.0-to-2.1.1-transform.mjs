import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { installProjectorEditorSchemaBundle, stringifyTomlDocument } from "../../../exports/runtime.js";

export const projectDataMigrationArtifact = Object.freeze({
  apiVersion: "projector.project-data-migration-artifact/v1",
  id: "transform:2.1.0-to-2.1.1",
  kind: "transform",
  async run(context) {
    if (context.signal.aborted) throw context.signal.reason;
    if (context.source.kind !== "release-format" || context.sourceAuthority.kind !== "release-format") {
      throw new Error("The 2.1.1 transform requires an authenticated released-format source");
    }
    if (context.source.snapshot.snapshotHash !== context.sourceAuthority.snapshotHash) {
      throw new Error("Released source observation does not match its source authority");
    }
    await installProjectorEditorSchemaBundle(context.stagingRoot);
    await writeFile(
      join(context.stagingRoot, ".projector", "config.toml"),
      stringifyTomlDocument({
        apiVersion: context.targetFormat.preparedConfig.apiVersion,
        enabled: true,
        projectorVersion: context.targetFormat.packageIdentity.version,
      }, { schemaPath: "schemas/projector-config-v1.schema.json" }),
      "utf8",
    );
    if (context.signal.aborted) throw context.signal.reason;
    return { apiVersion: "projector.project-data-migration-transform-result/v1", status: "prepared" };
  },
});
