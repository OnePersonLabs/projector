import { describe, expect, it } from "vitest";

import { compileWriteAuthorization, hashFramedDomain, type StateBinding, type TransformContext } from "@projector/core";

import {
  ExactTextPatchTransform,
  TransformPreconditionError,
  TransformScopeError,
  type ExactTextPatchInput,
  type TransformMutationPort,
} from "./index.js";

const state = {
  gitBase: "base",
  worktreeDigest: hashFramedDomain("test", "worktree"),
  canonicalProjectorDigest: hashFramedDomain("test", "canonical"),
  toolchainDigest: hashFramedDomain("test", "toolchain"),
};
const binding: StateBinding = {
  compiledAgainst: state,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }),
};

function context(paths: readonly string[], forbidden: readonly string[] = []): TransformContext {
  return {
    repositoryRoot: "/repo",
    stateBinding: binding,
    allowedUnits: paths.map((path) => `unit:${path}`),
    dryRun: false,
    signal: new AbortController().signal,
    approvedBoundary: [...paths],
    writeAuthorization: compileWriteAuthorization({
      operation: "exact-text-patch",
      allowedWrites: paths.map((path) => ({
        selector: { op: "atom", field: "path", matcher: "equals", value: path },
        operations: ["exact-text-patch"],
        reason: "test exact patch",
      })),
      forbiddenWrites: forbidden.map((path) => ({
        selector: { op: "atom", field: "path", matcher: "equals", value: path },
        operations: ["exact-text-patch"],
        reason: "test forbidden patch",
      })),
    }),
  } as TransformContext;
}

class MemoryMutationPort implements TransformMutationPort {
  readonly events: string[] = [];

  constructor(readonly files: Map<string, string>, private readonly active = true) {}

  async readFile(path: string): Promise<string | undefined> { return this.files.get(path); }
  async assertWritable(path: string): Promise<void> {
    if (!this.active) throw new Error("mutation requires an active durable transaction");
    if (path.startsWith("outside/")) throw new Error("outside repository");
  }
  async moveFile(): Promise<void> { throw new Error("not used"); }
  async writeFile(path: string, content: string): Promise<void> {
    if (!this.active) throw new Error("mutation requires an active durable transaction");
    this.events.push(`write:${path}`);
    this.files.set(path, content);
  }
  async deleteFile(path: string): Promise<void> {
    if (!this.active) throw new Error("mutation requires an active durable transaction");
    this.events.push(`delete:${path}`);
    this.files.delete(path);
  }
  async checkpoint(id: string): Promise<void> { this.events.push(`checkpoint:${id}`); }
}

const input = (): ExactTextPatchInput => ({
  edits: [
    { unitId: "unit:created.txt", path: "created.txt", before: null, after: "created\n" },
    { unitId: "unit:deleted.txt", path: "deleted.txt", before: "delete me\n", after: null },
    { unitId: "unit:updated.txt", path: "updated.txt", before: "before\n", after: "after\n" },
  ],
});

describe("exact text patch transform", () => {
  it("previews, creates, replaces, deletes, and verifies exact UTF-8 content", async () => {
    const port = new MemoryMutationPort(new Map([
      ["deleted.txt", "delete me\n"],
      ["updated.txt", "before\n"],
    ]));
    const transform = new ExactTextPatchTransform(port, { now: () => "2026-08-26T00:00:00.000Z" });
    const request = input();

    const preview = await transform.preview(request, context(request.edits.map(({ path }) => path)));
    expect(preview).toMatchObject({ applicable: true, touchedUnitIds: ["unit:created.txt", "unit:deleted.txt", "unit:updated.txt"] });

    const result = await transform.apply(request, context(request.edits.map(({ path }) => path)));
    expect(result.changed).toBe(true);
    expect(port.files).toEqual(new Map([
      ["updated.txt", "after\n"],
      ["created.txt", "created\n"],
    ]));
    expect(port.events).toEqual([
      "checkpoint:exact-text-patch@1:before",
      "write:created.txt",
      "delete:deleted.txt",
      "write:updated.txt",
      "checkpoint:exact-text-patch@1:after",
    ]);
    expect(await transform.verify(result, context(request.edits.map(({ path }) => path)))).toMatchObject([{ status: "passed" }]);
  });

  it("rejects a stale before value before performing any mutation", async () => {
    const port = new MemoryMutationPort(new Map([["updated.txt", "third state\n"]]));
    const transform = new ExactTextPatchTransform(port);
    const request: ExactTextPatchInput = { edits: [{ unitId: "unit:updated.txt", path: "updated.txt", before: "before\n", after: "after\n" }] };

    await expect(transform.apply(request, context(["updated.txt"]))).rejects.toBeInstanceOf(TransformPreconditionError);
    expect(port.events).toEqual([]);
  });

  it("rejects duplicate, no-op, noncanonical, out-of-boundary, and forbidden edits", async () => {
    const port = new MemoryMutationPort(new Map([["safe.txt", "before\n"]]));
    const transform = new ExactTextPatchTransform(port);
    await expect(transform.preview({ edits: [
      { unitId: "unit:safe.txt", path: "safe.txt", before: "before\n", after: "one\n" },
      { unitId: "unit:safe.txt", path: "safe.txt", before: "before\n", after: "two\n" },
    ] }, context(["safe.txt"]))).rejects.toBeInstanceOf(TransformPreconditionError);
    await expect(transform.preview({ edits: [{ unitId: "unit:safe.txt", path: "safe.txt", before: "before\n", after: "before\n" }] }, context(["safe.txt"]))).rejects.toBeInstanceOf(TransformPreconditionError);
    await expect(transform.preview({ edits: [{ unitId: "unit:../escape", path: "../escape", before: null, after: "x" }] }, context(["safe.txt"]))).rejects.toBeInstanceOf(TransformScopeError);
    await expect(transform.preview({ edits: [{ unitId: "unit:safe.txt", path: "safe.txt", before: "before\n", after: "after\n" }] }, context(["other.txt"]))).rejects.toBeInstanceOf(TransformScopeError);
    await expect(transform.preview({ edits: [{ unitId: "unit:safe.txt", path: "safe.txt", before: "before\n", after: "after\n" }] }, context(["safe.txt"], ["safe.txt"]))).rejects.toBeInstanceOf(TransformScopeError);
  });

  it("refuses to execute without an active durable transaction", async () => {
    const port = new MemoryMutationPort(new Map([["updated.txt", "before\n"]]), false);
    const transform = new ExactTextPatchTransform(port);
    const request: ExactTextPatchInput = { edits: [{ unitId: "unit:updated.txt", path: "updated.txt", before: "before\n", after: "after\n" }] };

    await expect(transform.apply(request, context(["updated.txt"]))).rejects.toThrow(/active durable transaction/iu);
    expect(port.files.get("updated.txt")).toBe("before\n");
  });
});
