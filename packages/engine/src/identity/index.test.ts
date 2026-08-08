import type {
  ContentHash,
  SemanticIdentityCandidate,
  StateBinding,
  StateDigest,
} from "@projector/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  assertCanonicalCreationAllowed,
  resolveSemanticIdentity,
  type IdentityCandidateRecord,
} from "./index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;
const state: StateDigest = {
  gitBase: "base",
  worktreeDigest: hash("worktree"),
  canonicalProjectorDigest: hash("canonical"),
  toolchainDigest: hash("toolchain"),
};
const binding: StateBinding = {
  compiledAgainst: state,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hash("binding"),
};

const candidate = (entityId: string, score = 0.95): SemanticIdentityCandidate => ({
  entityId,
  entityKind: "concept",
  similarity: score,
  ownershipFit: score,
  boundaryFit: score,
  evidence: [{ evidenceId: `evidence-${entityId}`, stance: "supports" }],
  explanation: `${entityId} owns the requested behavior`,
});

const record = (
  entityId: string,
  lifecycle: IdentityCandidateRecord["lifecycle"] = "active",
  replacementIds: string[] = [],
): IdentityCandidateRecord => ({ candidate: candidate(entityId), lifecycle, replacementIds });

const base = {
  requestedMeaning: "wireless MIDI device enumeration",
  requestedKind: "concept" as const,
  durableEntity: true,
  records: [record("cap-midi-discovery")],
  boundState: binding,
  evidence: [{ evidenceId: "request", stance: "supports" as const }],
  unknowns: [],
};

describe("semantic identity resolution", () => {
  it.each([
    ["same", "reuse-existing", ["cap-midi-discovery"]],
    ["overlap", "coordinated-modification", ["cap-midi-discovery"]],
    ["split", "split-existing", ["cap-midi-discovery"]],
    ["replace", "replace-existing", ["cap-midi-discovery"]],
    ["distinct", "create-new", []],
    ["ambiguous", "unresolved", []],
  ] as const)("maps a %s assessment to %s", (assessment, outcome, selectedEntityIds) => {
    const resolution = resolveSemanticIdentity({
      ...base,
      assessment,
      ...(assessment === "distinct" ? {
        newBoundary: {
          owns: ["BLE-specific discovery"],
          excludes: ["wired device discovery"],
          nearestEntityIds: ["cap-midi-discovery"],
          rationale: "transport-specific obligations change independently",
        },
      } : {}),
    });

    expect(resolution.outcome).toBe(outcome);
    expect(resolution.selectedEntityIds).toEqual(selectedEntityIds);
  });

  it("uses coordinated modification for multiple owners and merge only for an explicit merge assessment", () => {
    const records = [record("cap-midi-discovery"), record("req-device-enumeration")];
    expect(resolveSemanticIdentity({ ...base, assessment: "overlap", records }).outcome)
      .toBe("coordinated-modification");
    expect(resolveSemanticIdentity({ ...base, assessment: "merge", records }).outcome)
      .toBe("merge-existing");
  });

  it("returns no durable entity without searching for a path-shaped identity", () => {
    const resolution = resolveSemanticIdentity({
      ...base,
      durableEntity: false,
      assessment: "distinct",
      records: [],
      incidental: { path: "packages/mobile/src/bluetooth.ts", aliases: ["BLE"] },
    });

    expect(resolution.outcome).toBe("no-durable-entity");
    expect(resolution.selectedEntityIds).toEqual([]);
  });

  it("follows superseded identity history to the surviving replacement instead of resurrecting a duplicate", () => {
    const resolution = resolveSemanticIdentity({
      ...base,
      assessment: "same",
      records: [record("old-midi-discovery", "superseded", ["cap-midi-discovery"])],
    });

    expect(resolution.outcome).toBe("reuse-existing");
    expect(resolution.selectedEntityIds).toEqual(["cap-midi-discovery"]);
  });

  it("blocks create-new when an active, deprecated, superseded, or tombstoned identity still overlaps", () => {
    for (const lifecycle of ["active", "deprecated", "superseded", "tombstone"] as const) {
      const resolution = resolveSemanticIdentity({ ...base, assessment: "distinct", records: [record("existing", lifecycle)] });
      expect(() => assertCanonicalCreationAllowed(resolution)).toThrow(/duplicate|overlap|unresolved/i);
    }
  });

  it("requires an inspectable owns/excludes boundary before a genuinely distinct identity can be created", () => {
    const resolution = resolveSemanticIdentity({ ...base, assessment: "distinct", records: [] });
    expect(resolution.outcome).toBe("unresolved");
    expect(resolution.unknowns).toContain("new semantic boundary is incomplete");
    expect(() => assertCanonicalCreationAllowed(resolution)).toThrow(/unresolved/i);
  });

  it("keeps a create-new resolution as derived evidence until user or policy acceptance authorizes canonical creation", () => {
    const resolution = resolveSemanticIdentity({
      ...base,
      assessment: "distinct",
      records: [],
      newBoundary: {
        owns: ["BLE-specific discovery"], excludes: ["wired discovery"],
        nearestEntityIds: ["cap-midi-discovery"], rationale: "independently governed transport behavior",
      },
    });

    expect(() => assertCanonicalCreationAllowed(resolution)).toThrow(/authority|accept/i);
    expect(() => assertCanonicalCreationAllowed(resolution, { acceptedBy: "user", evidenceIds: ["user-approval"] })).not.toThrow();
  });

  it("keeps stable resolution identity independent of candidate order and incidental paths", () => {
    fc.assert(fc.property(fc.shuffledSubarray([record("a"), record("b")], { minLength: 2, maxLength: 2 }), (records) => {
      const first = resolveSemanticIdentity({ ...base, assessment: "merge", records, incidental: { path: "old/place.ts" } });
      const second = resolveSemanticIdentity({ ...base, assessment: "merge", records: [...records].reverse(), incidental: { path: "new/place.ts" } });
      expect(first).toEqual(second);
    }));
  });
});
