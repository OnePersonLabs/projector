import { describe, expect, it } from "vitest";

import { FileExternalOperationJournal, FileSurfaceSnapshotStore, authenticateRepresentationBinding, captureSurfaceSnapshot, createCodexExecProvider, createHostSessionRecord, executeSurfacePlan, hostSessionSelector, loadAuthenticatedRepositorySession } from "./index.js";

describe("integrations public entrypoint", () => {
  it("exports the snapshot and surface execution composition", () => {
    expect(captureSurfaceSnapshot).toBeTypeOf("function");
    expect(executeSurfacePlan).toBeTypeOf("function");
    expect(FileSurfaceSnapshotStore).toBeTypeOf("function");
    expect(FileExternalOperationJournal).toBeTypeOf("function");
    expect(createCodexExecProvider).toBeTypeOf("function");
    expect(authenticateRepresentationBinding).toBeTypeOf("function");
    expect(createHostSessionRecord).toBeTypeOf("function");
    expect(hostSessionSelector).toBeTypeOf("function");
    expect(loadAuthenticatedRepositorySession).toBeTypeOf("function");
  });
});
