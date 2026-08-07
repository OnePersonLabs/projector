import { describe, expect, it } from "vitest";

import {
  hashFramedDomain,
  type StateBinding,
  type Transform,
  type TransformContext,
  type TransformResult,
} from "@projector/core";

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

const context = (
  allowedUnits: string[],
  approvedBoundary: string[] = ["**"],
  forbiddenBoundary: string[] = [],
): TransformContext & { approvedBoundary: string[]; forbiddenBoundary: string[] } => ({
  repositoryRoot: "/repo",
  stateBinding: binding,
  allowedUnits,
  dryRun: false,
  signal: new AbortController().signal,
  approvedBoundary,
  forbiddenBoundary,
});

class MemoryMutationPort implements TransformMutationPort {
  readonly events: string[] = [];
  reads = 0;

  constructor(readonly files: Map<string, string>) {}

  async readFile(path: string): Promise<string | undefined> {
    this.reads += 1;
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
    {
      unitId: "unit:generated", from: "generated/client.mjs", to: "generated/moved.mjs", provenance: "generated",
      expectedContentHash: hashFramedDomain("transform-content", "generated\n"),
    },
    {
      unitId: "unit:source", from: ".codex/validate-repo.mjs", to: "scripts/validate-repo.mjs", provenance: "source",
      expectedContentHash: hashFramedDomain("transform-content", "export const validate = true;\n"),
    },
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
    const readsBeforeNoDeltaVerification = port.reads;
    expect((await transform.verify(second, transformContext)).map((validation) => validation.status)).toEqual(["passed"]);
    expect(port.reads).toBeGreaterThan(readsBeforeNoDeltaVerification);
  });

  it("fails closed when a unit or path is outside the granted scope", async () => {
    const port = new MemoryMutationPort(new Map([["outside/file.mjs", "x"]]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [{
        unitId: "unit:outside", from: "outside/file.mjs", to: "scripts/file.mjs", provenance: "source",
        expectedContentHash: hashFramedDomain("transform-content", "x"),
      }],
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
      moves: [{
        unitId: "unit:move", from: "source.mjs", to: "destination.mjs", provenance: "source",
        expectedContentHash: hashFramedDomain("transform-content", "source"),
      }],
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
      moves: [{
        unitId: "unit:move", from: "source.mjs", to: "destination.mjs", provenance: "source",
        expectedContentHash: hashFramedDomain("transform-content", "source"),
      }],
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

  it("refuses a missing move source without an approved destination content identity", async () => {
    const port = new MemoryMutationPort(new Map([["destination.mjs", "expected content"]]));
    const transform = new MoveReferenceTransform(port);
    const input = {
      moves: [{ unitId: "unit:move", from: "source.mjs", to: "destination.mjs", provenance: "source" }],
      references: [],
    } as unknown as MoveReferenceUpdateInput;

    await expect(transform.preview(input, context(["unit:move"]))).rejects.toThrow(/expected content identity/u);
  });

  it("accepts an already-applied move only when the destination matches the approved content identity", async () => {
    const port = new MemoryMutationPort(new Map([["destination.mjs", "unexpected content"]]));
    const transform = new MoveReferenceTransform(port);
    const input = {
      moves: [{
        unitId: "unit:move",
        from: "source.mjs",
        to: "destination.mjs",
        provenance: "source" as const,
        expectedContentHash: hashFramedDomain("transform-content", "expected content"),
      }],
      references: [],
    };

    await expect(transform.preview(input, context(["unit:move"]))).rejects.toThrow(/content identity/u);
    expect(port.events).toEqual([]);
  });

  it("rejects replacements that can match their own generated output", async () => {
    const port = new MemoryMutationPort(new Map([["package.json", "a"]]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [],
      references: [{
        unitId: "unit:ref", path: "package.json", from: "a", to: "aa",
        expectedOccurrences: 1, provenance: "source",
      }],
    };

    await expect(transform.preview(input, context(["unit:ref"]))).rejects.toThrow(/non-convergent replacement/u);
  });

  it("rejects duplicate source and reference claims before any mutation", async () => {
    const port = new MemoryMutationPort(new Map([
      ["source.mjs", "source"],
      ["package.json", "source.mjs"],
    ]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [
        {
          unitId: "unit:a", from: "source.mjs", to: "a.mjs", provenance: "source",
          expectedContentHash: hashFramedDomain("transform-content", "source"),
        },
        {
          unitId: "unit:b", from: "source.mjs", to: "b.mjs", provenance: "source",
          expectedContentHash: hashFramedDomain("transform-content", "source"),
        },
      ],
      references: [
        { unitId: "unit:ref-a", path: "package.json", from: "source.mjs", to: "a.mjs", expectedOccurrences: 1, provenance: "source" },
        { unitId: "unit:ref-b", path: "package.json", from: "source.mjs", to: "b.mjs", expectedOccurrences: 1, provenance: "source" },
      ],
    };

    await expect(transform.apply(input, context(["unit:a", "unit:b", "unit:ref-a", "unit:ref-b"])))
      .rejects.toThrow(/duplicate (move source|reference claim)/u);
    expect(port.events).toEqual([]);
  });

  it("enforces the approved path boundary independently of the mutation adapter", async () => {
    const port = new MemoryMutationPort(new Map([["private/source.mjs", "source"]]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [{
        unitId: "unit:move", from: "private/source.mjs", to: "private/destination.mjs", provenance: "source",
        expectedContentHash: hashFramedDomain("transform-content", "source"),
      }],
      references: [],
    };

    await expect(transform.preview(input, context(["unit:move"], ["scripts/**", "package.json"])))
      .rejects.toBeInstanceOf(TransformScopeError);
  });

  it("enforces capsule-forbidden paths inside the approved plan boundary", async () => {
    const port = new MemoryMutationPort(new Map([["scripts/private/source.mjs", "source"]]));
    const transform = new MoveReferenceTransform(port);
    const input: MoveReferenceUpdateInput = {
      moves: [{
        unitId: "unit:move", from: "scripts/private/source.mjs", to: "scripts/private/destination.mjs",
        provenance: "source", expectedContentHash: hashFramedDomain("transform-content", "source"),
      }],
      references: [],
    };

    await expect(transform.preview(input, context(["unit:move"], ["scripts/**"], ["scripts/private/**"])))
      .rejects.toBeInstanceOf(TransformScopeError);
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
        unitClaim: "exclusive",
        postconditions: ["references-resolve", "destination-present"],
        convergence: { kind: "idempotent" },
      },
    });

    expect(registry.get("move-reference-update", "1")?.metadata.preconditions).toEqual([
      "preview-complete",
      "state-current",
    ]);
    expect(() => registry.orderInvocations([
      { transformId: "move-reference-update", version: "1", unitIds: ["unit:same"] },
      { transformId: "move-reference-update", version: "1", unitIds: ["unit:same"] },
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
        unitClaim: "exclusive",
      },
    });
    registry.register({
      implementation: right,
      metadata: {
        preconditions: [], writeScope: [], predecessors: [], exclusions: [],
        commutativity: "never", postconditions: [], convergence: { kind: "idempotent" },
        unitClaim: "exclusive",
      },
    });

    expect(() => registry.orderInvocations([
      { transformId: "move-reference-update", version: "1", unitIds: ["unit:left"] },
      { transformId: "conflicting-transform", version: "1", unitIds: ["unit:right"] },
    ])).toThrow(/excludes/u);
  });

  it("derives exclusive unit claims from registered metadata rather than caller input", () => {
    const registry = new TransformRegistry();
    const transform = new MoveReferenceTransform(new MemoryMutationPort(new Map()));
    const metadata = {
      preconditions: [], writeScope: [], predecessors: [], exclusions: [],
      commutativity: "disjoint-units-only" as const, postconditions: [],
      convergence: { kind: "idempotent" as const },
      unitClaim: "exclusive" as const,
    };
    registry.register({ implementation: transform, metadata });

    expect(() => registry.orderInvocations([
      { transformId: transform.id, version: transform.version, unitIds: ["unit:same"] },
      { transformId: transform.id, version: transform.version, unitIds: ["unit:same"] },
    ])).toThrow(TransformClaimConflictError);
  });

  it("accepts declared bounded fixed-point cycles and converges them deterministically", async () => {
    const registry = new TransformRegistry();
    const port = new MemoryMutationPort(new Map());
    const left = Object.assign(new MoveReferenceTransform(port), { id: "left" as const });
    const right = Object.assign(new MoveReferenceTransform(port), { id: "right" as const });
    registry.register({
      implementation: left,
      metadata: {
        preconditions: [], writeScope: [], predecessors: ["right"], exclusions: [],
        commutativity: "never", postconditions: [], convergence: { kind: "bounded-fixed-point", maximumIterations: 3 },
        unitClaim: "exclusive",
      },
    });
    registry.register({
      implementation: right,
      metadata: {
        preconditions: [], writeScope: [], predecessors: ["left"], exclusions: [],
        commutativity: "never", postconditions: [], convergence: { kind: "bounded-fixed-point", maximumIterations: 3 },
        unitClaim: "exclusive",
      },
    });
    const invocations = [
      { transformId: "right", version: "1", unitIds: ["unit:right"] },
      { transformId: "left", version: "1", unitIds: ["unit:left"] },
    ];

    expect(registry.orderInvocations(invocations).map((invocation) => invocation.transformId)).toEqual(["left", "right"]);
    const convergenceRegistry = registry as unknown as {
      convergeInvocations(
        value: typeof invocations,
        execute: (invocation: typeof invocations[number], iteration: number) => Promise<{ changed: boolean }>,
      ): Promise<{ converged: boolean; iterations: number }>;
    };
    const result = await convergenceRegistry.convergeInvocations(
      invocations,
      async (_invocation, iteration) => ({ changed: iteration === 1 }),
    );
    expect(result).toEqual({ converged: true, iterations: 2 });
  });

  it("rejects a bounded fixed-point cycle that does not converge within its declared limit", async () => {
    const registry = new TransformRegistry();
    const port = new MemoryMutationPort(new Map());
    const left = Object.assign(new MoveReferenceTransform(port), { id: "left" as const });
    const right = Object.assign(new MoveReferenceTransform(port), { id: "right" as const });
    for (const [implementation, predecessor] of [[left, "right"], [right, "left"]] as const) {
      registry.register({
        implementation,
        metadata: {
          preconditions: [], writeScope: [], predecessors: [predecessor], exclusions: [],
          commutativity: "never", postconditions: [], convergence: { kind: "bounded-fixed-point", maximumIterations: 2 },
          unitClaim: "exclusive",
        },
      });
    }
    const invocations = [
      { transformId: "left", version: "1", unitIds: ["unit:left"] },
      { transformId: "right", version: "1", unitIds: ["unit:right"] },
    ];
    const convergenceRegistry = registry as unknown as {
      convergeInvocations(
        value: typeof invocations,
        execute: () => Promise<{ changed: boolean }>,
      ): Promise<unknown>;
    };

    await expect(convergenceRegistry.convergeInvocations(invocations, async () => ({ changed: true })))
      .rejects.toThrow(/did not converge within 2 iterations/u);
  });

  it("rejects registry implementation identity drift after registration", () => {
    let currentId = "drifting-transform";
    const implementation: Transform<unknown> = {
      get id() { return currentId; },
      version: "1",
      description: "drifting identity test transform",
      async applies() { return false; },
      async preview() { return { applicable: false, operations: [], touchedUnitIds: [], expectedDiff: "", warnings: [] }; },
      async apply(): Promise<TransformResult> { return { transformId: currentId, changed: false, touchedUnitIds: [], operations: [] }; },
      async verify() { return []; },
    };
    const registry = new TransformRegistry();
    registry.register({
      implementation,
      metadata: {
        preconditions: [], writeScope: [], predecessors: [], exclusions: [], commutativity: "always",
        postconditions: [], convergence: { kind: "idempotent" },
        unitClaim: "shared",
      },
    });

    currentId = "changed-after-registration";
    expect(() => registry.get("drifting-transform", "1")).toThrow(/implementation identity drift/u);
  });
});
