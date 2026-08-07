import { describe, expect, it } from "vitest";

import { hashFramedDomain, type StateBinding, type TransformContext } from "@projector/core";

import {
  MoveReferenceTransform,
  TransformClaimConflictError,
  TransformRegistry,
  TransformScopeError,
  type MoveReferenceUpdateInput,
  type TransformMutationPort,
} from "./index.js";

const digest = {
  gitBase: "base",
  worktreeDigest: hashFramedDomain("test", "worktree"),
  canonicalProjectorDigest: hashFramedDomain("test", "canonical"),
  toolchainDigest: hashFramedDomain("test", "toolchain"),
};

const binding: StateBinding = {
  compiledAgainst: digest,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hashFramedDomain("state-binding-dependencies", {
    valueDependencies: [],
    queryDependencies: [],
  }),
};

const context = (allowedUnits: string[]): TransformContext => ({
  repositoryRoot: "/repo",
  stateBinding: binding,
  allowedUnits,
  dryRun: false,
  signal: new AbortController().signal,
});

class MemoryMutationPort implements TransformMutationPort {
  readonly events: string[] = [];

  constructor(readonly files: Map<string, string>) {}

  async readFile(path: string): Promise<string | undefined> {
    return this.files.get(path);
  }

  async assertWritable(path: string): Promise<void> {
    if (path.startsWith("outside/")) throw new Error("outside repository");
  }

  async moveFile(from: string, to: string): Promise<void> {
    this.events.push(`move:${from}->${to}`);
    const content = this.files.get(from);
    if (content === undefined) throw new Error(`missing ${from}`);
    this.files.delete(from);
    this.files.set(to, content);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.events.push(`write:${path}`);
    this.files.set(path, content);
  }

  async checkpoint(id: string): Promise<void> {
    this.events.push(`checkpoint:${id}`);
  }
}

const moveInput = (): MoveReferenceUpdateInput => ({
  moves: [
    { unitId: "unit:generated", from: "generated/client.mjs", to: "generated/moved.mjs", provenance: "generated" },
    { unitId: "unit:source", from: ".codex/validate-repo.mjs", to: "scripts/validate-repo.mjs", provenance: "source" },
  ],
  references: [
    {
      unitId: "unit:generated-ref",
      path: "generated/index.mjs",
      from: "./client.mjs",
      to: "./moved.mjs",
      expectedOccurrences: 1,
      provenance: "generated",
    },
    {
      unitId: "unit:source-ref",
      path: "package.json",
      from: ".codex/validate-repo.mjs",
      to: "scripts/validate-repo.mjs",
      expectedOccurrences: 1,
      provenance: "source",
    },
  ],
});

describe("move/reference transform", () => {
  it("previews, applies, verifies, and converges with source operations before generated operations", async () => {
    const port = new MemoryMutationPort(new Map([
      [".codex/validate-repo.mjs", "export const validate = true;\n"],
      ["generated/client.mjs", "generated\n"],
      ["package.json", "{\"validate\":\".codex/validate-repo.mjs\"}\n"],
      ["generated/index.mjs", "export * from './client.mjs';\n"],
    ]));
    const transform = new MoveReferenceTransform(port);
    const input = moveInput();
    const transformContext = context([
      "unit:source",
      "unit:source-ref",
      "unit:generated",
      "unit:generated-ref",
    ]);

    const preview = await transform.preview(input, transformContext);
    expect(preview.applicable).toBe(true);
    expect(preview.operations.map((operation) => `${operation.provenance}:${operation.kind}`)).toEqual([
      "source:move",
      "source:update-reference",
      "generated:move",
      "generated:update-reference",
    ]);

    const first = await transform.apply(input, transformContext);
    expect(first.changed).toBe(true);
    expect((await transform.verify(first, transformContext)).map((validation) => validation.status)).toEqual(["passed"]);
    expect(port.events).toEqual([
      "checkpoint:move-reference-update@1:before",
      "move:.codex/validate-repo.mjs->scripts/validate-repo.mjs",
      "write:package.json",
      "move:generated/client.mjs->generated/moved.mjs",
      "write:generated/index.mjs",
      "checkpoint:move-reference-update@1:after",
    ]);

    const second = await transform.apply(input, transformContext);
    expect(second).toMatchObject({ changed: false, operations: [] });
    expect((await transform.verify(second, transformContext)).map((validation) => validation.status)).toEqual(["passed"]);
  });

  it("fails closed when a unit or path is outside the granted scope", async () => {
    const port = new MemoryMutationPort(new Map([["outside/file.mjs", "x"]]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [{ unitId: "unit:outside", from: "outside/file.mjs", to: "scripts/file.mjs", provenance: "source" }],
      references: [],
    };

    await expect(transform.preview(input, context([]))).rejects.toBeInstanceOf(TransformScopeError);
    await expect(transform.preview(input, context(["unit:outside"]))).rejects.toThrow("outside repository");
  });

  it("blocks unresolved anchors and destination collisions before mutation", async () => {
    const port = new MemoryMutationPort(new Map([
      ["source.mjs", "source"],
      ["destination.mjs", "different"],
      ["package.json", "{}"],
    ]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [{ unitId: "unit:move", from: "source.mjs", to: "destination.mjs", provenance: "source" }],
      references: [{
        unitId: "unit:ref",
        path: "package.json",
        from: "source.mjs",
        to: "destination.mjs",
        expectedOccurrences: 1,
        provenance: "source",
      }],
    };

    await expect(transform.apply(input, context(["unit:move", "unit:ref"]))).rejects.toThrow(/collision|anchor/u);
    expect(port.events).toEqual([]);
  });

  it("reports partial evidence when a later mutation fails after an earlier move", async () => {
    class FailingMutationPort extends MemoryMutationPort {
      override async writeFile(path: string, content: string): Promise<void> {
        await super.writeFile(path, content);
        throw new Error("durable write interrupted");
      }
    }
    const port = new FailingMutationPort(new Map([
      ["source.mjs", "source"],
      ["package.json", "source.mjs"],
    ]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [{ unitId: "unit:move", from: "source.mjs", to: "destination.mjs", provenance: "source" }],
      references: [{
        unitId: "unit:ref",
        path: "package.json",
        from: "source.mjs",
        to: "destination.mjs",
        expectedOccurrences: 1,
        provenance: "source",
      }],
    };

    const caught = await transform.apply(input, context(["unit:move", "unit:ref"]))
      .then(() => undefined, (error: Error & { partialResult?: { changed: boolean; operations: unknown[] } }) => error);
    expect(caught?.message).toBe("durable write interrupted");
    expect(caught?.partialResult).toMatchObject({ changed: true });
    expect(caught?.partialResult?.operations).toHaveLength(1);
  });

  it("composes multiple registered reference updates to the same file without losing an earlier update", async () => {
    const port = new MemoryMutationPort(new Map([
      ["package.json", "{\"one\":\"old-a\",\"two\":\"old-b\"}"],
    ]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [],
      references: [
        { unitId: "unit:b", path: "package.json", from: "old-b", to: "new-b", expectedOccurrences: 1, provenance: "source" },
        { unitId: "unit:a", path: "package.json", from: "old-a", to: "new-a", expectedOccurrences: 1, provenance: "source" },
      ],
    };

    await transform.apply(input, context(["unit:a", "unit:b"]));
    expect(port.files.get("package.json")).toBe("{\"one\":\"new-a\",\"two\":\"new-b\"}");
  });
});

describe("transform registry", () => {
  it("normalizes deterministic metadata and rejects overlapping exclusive claims", () => {
    const registry = new TransformRegistry();
    const transform = new MoveReferenceTransform(new MemoryMutationPort(new Map()));
    registry.register({
      implementation: transform,
      metadata: {
        preconditions: ["state-current", "preview-complete", "state-current"],
        writeScope: ["input-paths"],
        predecessors: [],
        exclusions: [],
        commutativity: "disjoint-units-only",
        postconditions: ["references-resolve", "destination-present"],
        convergence: { kind: "idempotent" },
      },
    });

    expect(registry.get("move-reference-update", "1")?.metadata.preconditions).toEqual([
      "preview-complete",
      "state-current",
    ]);
    expect(() => registry.orderInvocations([
      { transformId: "move-reference-update", version: "1", unitIds: ["unit:same"], exclusiveUnitClaim: true },
      { transformId: "move-reference-update", version: "1", unitIds: ["unit:same"], exclusiveUnitClaim: true },
    ])).toThrow(TransformClaimConflictError);
  });

  it("enforces declared exclusions during composition", () => {
    const registry = new TransformRegistry();
    const port = new MemoryMutationPort(new Map());
    const left = new MoveReferenceTransform(port);
    const right = Object.assign(new MoveReferenceTransform(port), { id: "conflicting-transform" as const });
    registry.register({
      implementation: left,
      metadata: {
        preconditions: [], writeScope: [], predecessors: [], exclusions: ["conflicting-transform"],
        commutativity: "never", postconditions: [], convergence: { kind: "idempotent" },
      },
    });
    registry.register({
      implementation: right,
      metadata: {
        preconditions: [], writeScope: [], predecessors: [], exclusions: [],
        commutativity: "never", postconditions: [], convergence: { kind: "idempotent" },
      },
    });

    expect(() => registry.orderInvocations([
      { transformId: "move-reference-update", version: "1", unitIds: ["unit:left"], exclusiveUnitClaim: true },
      { transformId: "conflicting-transform", version: "1", unitIds: ["unit:right"], exclusiveUnitClaim: true },
    ])).toThrow(/excludes/u);
  });
});
