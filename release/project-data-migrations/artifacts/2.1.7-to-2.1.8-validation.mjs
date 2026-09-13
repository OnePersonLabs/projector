export const projectDataMigrationArtifact = Object.freeze({
  apiVersion: "projector.project-data-migration-artifact/v1",
  id: "validation:2.1.7-to-2.1.8",
  kind: "validation",
  async run(context) {
    if (context.signal.aborted) throw context.signal.reason;
    if (context.source.kind !== "release-format") throw new Error("This adapter requires an authenticated released-format source");
    await context.validateTarget();
    if (context.signal.aborted) throw context.signal.reason;
    return { apiVersion: "projector.project-data-migration-validation-result/v1", status: "passed" };
  },
});
