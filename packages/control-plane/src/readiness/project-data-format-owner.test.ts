import type { ContentHash } from "@projector/core";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

vi.mock("zod", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zod")>();
  return { ...actual, z: { ...actual.z, toJSONSchema: vi.fn(actual.z.toJSONSchema) } };
});

import {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
  type ValidatedReleaseCandidateInventory,
} from "./project-data-format-owner.js";

const hash = (digit: string) => `sha256:v1:${digit.repeat(64)}` as ContentHash;

describe("release candidate project-data format owner", () => {
  test("reuses schema generation while binding each candidate version and inventory afresh", () => {
    const candidate = inventory();
    const initial = createReleaseCandidateProjectDataFormat({ candidate });
    vi.mocked(z.toJSONSchema).mockClear();
    const changed = createReleaseCandidateProjectDataFormat({ candidate: {
      ...candidate,
      packageIdentity: { ...candidate.packageIdentity, version: "2.2.0" },
      files: candidate.files.map((file) => ({ ...file, digest: hash("f") })),
    } });
    expect(vi.mocked(z.toJSONSchema).mock.calls.length).toBe(0);
    expect(changed.packageIdentity.version).toBe("2.2.0");
    expect(changed.preparedConfig.projectorVersion).toBe("2.2.0");
    expect(changed.runtimeEvidence.schemaVersion).toBe("2.2.0");
    expect(changed.preparedConfig.schemaHash).not.toBe(initial.preparedConfig.schemaHash);
    expect(changed.canonical.schemaBundleHash).not.toBe(initial.canonical.schemaBundleHash);
    expect(changed.runtimeEvidence.schemaHash).not.toBe(initial.runtimeEvidence.schemaHash);
    expect(changed.snapshotHash).not.toBe(initial.snapshotHash);
    expect(createReleaseCandidateProjectDataFormat({ candidate })).toEqual(initial);
  });

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

  test("changes runtime format identity when the durable representation owner changes", () => {
    const candidate = inventory();
    const initial = createReleaseCandidateProjectDataFormat({ candidate });
    const ownerPath = runtimeEvidenceOwnerModulePaths.find((path) => path.endsWith("/schemas/representation-artifact.js"))!;
    const changed = createReleaseCandidateProjectDataFormat({
      candidate: { ...candidate, files: candidate.files.map((file) => file.path === ownerPath ? { ...file, digest: hash("f") } : file) },
    });
    expect(changed.runtimeEvidence.schemaHash).not.toBe(initial.runtimeEvidence.schemaHash);
  });
});

function inventory(): ValidatedReleaseCandidateInventory {
  const paths = [...new Set([...preparedConfigOwnerModulePaths, ...canonicalOwnerModulePaths, ...runtimeEvidenceOwnerModulePaths])].sort();
  return {
    packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" },
    files: paths.map((path, index) => ({ path, digest: hash(String(index % 10)) })),
  };
}
