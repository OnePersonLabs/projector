import type { ContentHash } from "@projector/core";
import { describe, expect, test } from "vitest";

import {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
  type ValidatedReleaseCandidateInventory,
} from "./project-data-format-owner.js";

const hash = (digit: string) => `sha256:v1:${digit.repeat(64)}` as ContentHash;

describe("release candidate project-data format owner", () => {
  test("binds each descriptor field to its exact live schema and candidate owner closure", () => {
    const candidate = inventory();
    const initial = createReleaseCandidateProjectDataFormat({ candidate });
    for (const [path, readHash] of [
      [preparedConfigOwnerModulePaths[0], (value: typeof initial) => value.preparedConfig.schemaHash],
      [canonicalOwnerModulePaths[0], (value: typeof initial) => value.canonical.schemaBundleHash],
      [runtimeEvidenceOwnerModulePaths[0], (value: typeof initial) => value.runtimeEvidence.schemaHash],
    ] as const) {
      const changed = createReleaseCandidateProjectDataFormat({
        candidate: { ...candidate, files: candidate.files.map((file) => file.path === path ? { ...file, digest: hash("f") } : file) },
      });
      expect(readHash(changed)).not.toBe(readHash(initial));
    }
  });

  test("rejects an incomplete or duplicate authenticated candidate inventory", () => {
    const candidate = inventory();
    expect(() => createReleaseCandidateProjectDataFormat({
      candidate: { ...candidate, files: candidate.files.slice(1) },
    })).toThrow(/omits .* owner module/iu);
    expect(() => createReleaseCandidateProjectDataFormat({
      candidate: { ...candidate, files: [...candidate.files, candidate.files[0]!] },
    })).toThrow(/repeats/iu);
  });

  test("changes canonical format identity when the authored-wire registry owner changes", () => {
    const candidate = inventory();
    const initial = createReleaseCandidateProjectDataFormat({ candidate });
    const registryPath = canonicalOwnerModulePaths.find((path) => path.endsWith("/schemas/registry.js"))!;
    const changed = createReleaseCandidateProjectDataFormat({
      candidate: { ...candidate, files: candidate.files.map((file) => file.path === registryPath ? { ...file, digest: hash("f") } : file) },
    });
    expect(changed.canonical.schemaBundleHash).not.toBe(initial.canonical.schemaBundleHash);
  });
});

function inventory(): ValidatedReleaseCandidateInventory {
  const paths = [...new Set([...preparedConfigOwnerModulePaths, ...canonicalOwnerModulePaths, ...runtimeEvidenceOwnerModulePaths])].sort();
  return {
    packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" },
    files: paths.map((path, index) => ({ path, digest: hash(String(index % 10)) })),
  };
}
