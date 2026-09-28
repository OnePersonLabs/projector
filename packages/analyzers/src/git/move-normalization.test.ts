import { describe, expect, it } from "vitest";
import { DerivedObservationBudget } from "@projector/core";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InventoryContentStore, type LegacyInventoryContentDescriptor } from "../filesystem/inventory-content-store.js";
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

  it("disposes owned captures on early returns and errors while preserving borrowed captures", async () => {
    const directory=await mkdtemp(join(tmpdir(),"projector-git-capture-"));
    try {
      const createCapture=()=>{
        const store=InventoryContentStore.create(directory);
        store.put({path:"new.ts",kind:"file",mediaType:"text/plain",contentHash:"sha256:v1:test" as never,contentBytes:1,generated:false},"x");
        store.finish();store.close();return store.descriptor as LegacyInventoryContentDescriptor;
      };
      const owned=createCapture();
      finalizeGitFacts({availability:"available",revision:"head",identities:[],moves:[],failures:[],moveCandidateContent:{...owned,disposeAfterUse:true},
        pendingMoveCandidates:{deleted:[],untracked:[]}});
      await expect(readdir(directory)).resolves.toEqual([]);

      const ownedOnError=createCapture();
      expect(()=>finalizeGitFacts({availability:"available",revision:"head",identities:[],moves:[],failures:[],moveCandidateContent:{...ownedOnError,disposeAfterUse:true},
        pendingMoveCandidates:{deleted:[{path:"old.ts",content:"x"}],untracked:[{path:"new.ts",contentAddress:"new.ts"}]}},new DerivedObservationBudget(1))).toThrow();
      await expect(readdir(directory)).resolves.toEqual([]);

      const borrowed=createCapture();
      finalizeGitFacts({availability:"available",revision:"head",identities:[],moves:[],failures:[],moveCandidateContent:borrowed,
        pendingMoveCandidates:{deleted:[],untracked:[]}});
      await expect(readdir(directory)).resolves.toEqual([borrowed.path.split(/[\\/]/u).at(-1)]);
    } finally { await rm(directory,{recursive:true,force:true}); }
  });
});
