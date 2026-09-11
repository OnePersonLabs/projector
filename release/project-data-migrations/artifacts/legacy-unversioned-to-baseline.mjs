export const projectDataMigrationArtifact = Object.freeze({
  apiVersion: "projector.project-data-migration-artifact/v1",
  id: "migration-artifact:legacy-unversioned-to-baseline",
  kind: "transform",
  async run(context) {
    if (context.signal.aborted) throw context.signal.reason;
    if (context.source.kind !== "legacy-unversioned" || context.sourceAuthority.kind !== "legacy-unversioned") {
      throw new Error("Legacy ingress transform requires the authenticated legacy-unversioned source");
    }
    if (context.source.descriptor.sourceHash !== context.sourceAuthority.sourceHash) {
      throw new Error("Legacy ingress source observation does not match its source authority");
    }
    await context.prepareTarget();
    if (context.signal.aborted) throw context.signal.reason;
    return { apiVersion: "projector.project-data-migration-transform-result/v1", status: "prepared" };
  },
});
