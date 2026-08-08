import { describe, expect, it } from "vitest";

import { FileExternalOperationJournal, FileSurfaceSnapshotStore, captureSurfaceSnapshot, executeSurfacePlan } from "./index.js";

describe("integrations public entrypoint", () => {
  it("exports the snapshot and surface execution composition", () => {
    expect(captureSurfaceSnapshot).toBeTypeOf("function");
    expect(executeSurfacePlan).toBeTypeOf("function");
    expect(FileSurfaceSnapshotStore).toBeTypeOf("function");
    expect(FileExternalOperationJournal).toBeTypeOf("function");
  });
});
