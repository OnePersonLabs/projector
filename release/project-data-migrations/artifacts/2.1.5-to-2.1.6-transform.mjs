export const projectDataMigrationArtifact = Object.freeze({
  apiVersion: "projector.project-data-migration-artifact/v1",
  id: "transform:2.1.5-to-2.1.6",
  kind: "transform",
  async run(context) {
    if (context.signal.aborted) throw context.signal.reason;
    if (context.source.kind !== "release-format") throw new Error("This adapter requires an authenticated released-format source");
    // repository.check extends the operation owner; canonical data needs no rewrite.
    await context.prepareTarget();
    if (context.signal.aborted) throw context.signal.reason;
    return { apiVersion: "projector.project-data-migration-transform-result/v1", status: "prepared" };
  },
});
