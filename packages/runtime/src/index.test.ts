import { describe, expect, it } from "vitest";

import {
  CanonicalFileRepository,
  FileTransactionJournal,
  MoveReferenceTransform,
  RepositoryPathService,
  SqliteDerivedStore,
  StateBoundCommandExecutor,
  WriterLeaseManager,
  assertSupportedCanonicalVersions,
  currentSqliteSchemaVersion,
  executePacketPlan,
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
  });
});
