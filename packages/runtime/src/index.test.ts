import { describe, expect, it } from "vitest";

import {
  CanonicalFileRepository,
  FileTransactionJournal,
  MoveReferenceTransform,
  RepositoryPathService,
  SqliteDerivedStore,
  StateBoundCommandExecutor,
  WriterLeaseManager,
  createProjectBackup,
  hashProjectBackupManifest,
  assertSupportedCanonicalVersions,
  currentSqliteSchemaVersion,
  executePacketPlan,
  initializeProjectActivation,
  inspectProjectActivation,
} from "./index.js";

describe("runtime public entrypoint", () => {
  it("exports the Slice 0 persistence primitives", () => {
    expect(CanonicalFileRepository).toBeTypeOf("function");
    expect(SqliteDerivedStore).toBeTypeOf("function");
    expect(RepositoryPathService).toBeTypeOf("function");
    expect(StateBoundCommandExecutor).toBeTypeOf("function");
    expect(FileTransactionJournal).toBeTypeOf("function");
    expect(WriterLeaseManager).toBeTypeOf("function");
    expect(MoveReferenceTransform).toBeTypeOf("function");
    expect(assertSupportedCanonicalVersions).toBeTypeOf("function");
    expect(currentSqliteSchemaVersion).toBe(1);
    expect(executePacketPlan).toBeTypeOf("function");
    expect(inspectProjectActivation).toBeTypeOf("function");
    expect(initializeProjectActivation).toBeTypeOf("function");
    expect(createProjectBackup).toBeTypeOf("function");
    expect(hashProjectBackupManifest).toBeTypeOf("function");
  });
});
