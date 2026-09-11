export const projectDataMigrationArtifact = Object.freeze({
  apiVersion: "projector.project-data-migration-artifact/v1",
  id: "migration-artifact:legacy-unversioned-baseline-validation",
  kind: "validation",
  async run(context) {
    if (context.signal.aborted) throw context.signal.reason;
    if (context.source.kind !== "legacy-unversioned") {
      throw new Error("Legacy ingress validation requires a legacy-unversioned source observation");
    }
    await context.validateTarget();
    if (context.signal.aborted) throw context.signal.reason;
    return { apiVersion: "projector.project-data-migration-validation-result/v1", status: "passed" };
  },
});
