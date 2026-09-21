import { describe, expect, it } from "vitest";
import { DerivedObservationBudget } from "@projector/core";
import { finalizeGitFacts } from "./facts.js";

describe("working-tree move normalization", () => {
  it("does not infer binary equality from replacement characters in decoded text", () => {
    const result = finalizeGitFacts({ availability: "available", revision: "head", identities: [], moves: [], failures: [],
      pendingMoveCandidates: { deleted: [{ path: "old.bin", content: "\u0000\ufffd" }], untracked: [{ path: "new.bin", content: "\u0000\ufffd" }] },
    });
    expect(result.moves).toEqual([]);
  });
  it("releases temporary source normalization while searching a large deletion set", () => {
    const source = (value: number) => `export const value = ${value};\n`.repeat(20);
    const budget = new DerivedObservationBudget(50_000);
    const result = finalizeGitFacts({ availability: "available", revision: "head", identities: [], moves: [], failures: [],
      pendingMoveCandidates: {
        deleted: Array.from({ length: 60 }, (_, index) => ({ path: `old-${index}.ts`, content: source(index) })),
        untracked: [{ path: "new.ts", content: source(59) }],
      },
    }, budget);
    expect(result.moves).toEqual([{ sourceClass: "derived", fromPath: "old-59.ts", toPath: "new.ts", status: "working-tree-rename" }]);
    expect(budget.usedBytes).toBeLessThan(1024);
  });

  it("does not choose between two equivalent new files", () => {
    const result = finalizeGitFacts({ availability: "available", revision: "head", identities: [], moves: [], failures: [],
      pendingMoveCandidates: { deleted: [{ path: "old.ts", content: "export const x=1;" }],
        untracked: ["a.ts", "b.ts"].map((path) => ({ path, content: "export const x = 1;" })) },
    });
    expect(result.moves).toEqual([]);
  });

  it("compares non-JavaScript files exactly without lexing them as code", () => {
    const content = JSON.stringify({ values: Array.from({ length: 4000 }, (_, index) => index) });
    const result = finalizeGitFacts({ availability: "available", revision: "head", identities: [], moves: [], failures: [],
      pendingMoveCandidates: { deleted: [{ path: "old.json", content }, { path: "old.md", content: "Meaning // keep this" }],
        untracked: [{ path: "new.json", content }, { path: "new.md", content: "Meaning // different meaning" }] },
    }, new DerivedObservationBudget(100_000));
    expect(result.moves).toEqual([{ sourceClass: "derived", fromPath: "old.json", toPath: "new.json", status: "working-tree-rename" }]);
  });
});
