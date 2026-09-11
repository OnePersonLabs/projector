import { describe, expect, it } from "vitest";
import * as core from "@projector/core";
import * as engine from "@projector/engine";
import * as testkit from "@projector/testkit";
// @ts-expect-error release entrypoint is an executable JavaScript module
import { observeRepresentationClosure } from "./run-release-acceptance.mjs";

const id = "scenario:verify-representation-end-to-end-closure";
const owner = { id, title: "Preserve representation closure", steps: [
  { role: "precondition", statement: "An approved canonical owner exists." },
  { role: "trigger", statement: "Compile the owner's complete conditions." },
  { role: "expected-outcome", statement: "Preserve every required outcome." },
  { role: "forbidden-outcome", statement: "Do not weaken the authorization boundary." },
] };
const inventory = [{ id, owner, title: owner.title, semanticHash: core.hashFramedDomain("fixture-owner", owner), legacyIds: ["scenario:56:representation"] }];
const input = { core, engine, testkit, inventory, sourceRevision: "fixture-revision", worktreeDigest: core.hashFramedDomain("fixture-worktree", "test") };

describe("release representation observations", () => {
  it("exercises owner authority and fidelity but leaves unsupported installed links open", async () => {
    const result = await observeRepresentationClosure(input);
    expect(result.fidelityFailure.rejected).toBe(true);
    expect(result.receipt.observations.map((item: {stage: string}) => item.stage)).toEqual(["authority", "observability"]);
    expect(result.evaluation.status).toBe("open");
    for (const stage of ["public-composition", "downstream-consumer", "invalidation-recovery", "dogfood", "packed-release"]) expect(result.evaluation.blockers.join(" ")).toContain(stage);
    const changed = await observeRepresentationClosure({ ...input, inventory: [{ ...inventory[0], owner: { ...owner, steps: [...owner.steps, { role: "expected-outcome", statement: "Retain the explicit exception." }] } }] });
    expect(changed.receipt.observations[0].observedOutputHash).not.toBe(result.receipt.observations[0].observedOutputHash);
  });
  it("rejects a missing canonical owner instead of using historical headings", async () => {
    await expect(observeRepresentationClosure({ ...input, inventory: [] })).rejects.toThrow("accepted canonical closure scenario missing");
  });
  it("refuses to certify a negative control that unexpectedly succeeds", async () => {
    class BrokenValidator extends engine.RepresentationCompiler {
      override async validateCandidate(input: Parameters<engine.RepresentationCompiler["validateCandidate"]>[0]) {
        if (input.candidate === "") return {} as Awaited<ReturnType<engine.RepresentationCompiler["validateCandidate"]>>;
        return super.validateCandidate(input);
      }
    }
    await expect(observeRepresentationClosure({ ...input, engine: { ...engine, RepresentationCompiler: BrokenValidator } })).rejects.toThrow("negative control unexpectedly passed");
  });
});
