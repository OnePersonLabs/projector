import { canonicalJson } from "../../../exports/core.js";
import { CanonicalFileRepository } from "../../../exports/runtime.js";

export const projectDataMigrationArtifact = Object.freeze({
  apiVersion: "projector.project-data-migration-artifact/v1",
  id: "migration-artifact:legacy-unversioned-baseline-validation",
  kind: "validation",
  async run(context) {
    if (context.signal.aborted) throw context.signal.reason;
    if (context.source.kind !== "legacy-unversioned") {
      throw new Error("Legacy ingress validation requires a legacy-unversioned source observation");
    }
    const snapshot = await new CanonicalFileRepository(context.stagingRoot).snapshot();
    if (canonicalJson(snapshot.documents) !== canonicalJson(context.source.documents)) {
      throw new Error("Prepared baseline does not preserve legacy canonical meaning, identity, and provenance");
    }
    if (context.signal.aborted) throw context.signal.reason;
    return { apiVersion: "projector.project-data-migration-validation-result/v1", status: "passed" };
  },
});
