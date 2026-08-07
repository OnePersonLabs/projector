import { execFile } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  Artifact,
  Concept,
  StateQueryResultFingerprint,
  StructuredModelRequest,
  Surface,
  TransactionPhase,
} from "@projector/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CrashInjectedError,
  DeterministicClock,
  DeterministicIdProvider,
  FakeCommandSandbox,
  FakeGraphReader,
  FakeHostProcess,
  FakeModelProvider,
  FakeStateQueryReader,
  FakeSurfaceAdapter,
  applyFixtureMutations,
  createCrashInjector,
  createTempGitRepository,
  defineFixtureCase,
  mandatoryMisplacedRepositoryScriptContract,
  mandatoryMisplacedRepositoryScriptFixture,
  snapshotFilesystem,
  transactionCrashPhases,
} from "./index.js";

const hash = (character: string) => `sha256:v1:${character.repeat(64)}` as const;
const executeFile = promisify(execFile);

describe("deterministic providers", () => {
  it("advances time only when explicitly requested", () => {
    const clock = new DeterministicClock("2026-08-07T12:00:00.000Z");

    expect(clock.now()).toBe("2026-08-07T12:00:00.000Z");
    expect(clock.now()).toBe("2026-08-07T12:00:00.000Z");
    expect(clock.advance({ seconds: 2 })).toBe("2026-08-07T12:00:02.000Z");
  });

  it("allocates stable instance-local IDs", () => {
    const first = new DeterministicIdProvider("fixture", 7);
    const second = new DeterministicIdProvider("fixture", 7);

    expect([first.next("unit"), first.next("unit")]).toEqual(["fixture_unit_0007", "fixture_unit_0008"]);
    expect(second.next("unit")).toBe("fixture_unit_0007");
  });
});

describe("crash injection", () => {
  it("selects every mandatory journal phase independently", () => {
    expect(transactionCrashPhases).toEqual([
      "prepared",
      "workspace-mutating",
      "workspace-staged",
      "validating",
      "canonical-staging",
      "committing",
      "committed",
      "rolling-back",
      "rolled-back",
      "recovery-required",
    ]);
    for (const phase of transactionCrashPhases) {
      expect(() => createCrashInjector({ phase }).checkpoint(phase)).toThrowError(
        new CrashInjectedError(phase, 1),
      );
    }
  });

  it("throws only at the selected transaction phase and occurrence", () => {
    const injector = createCrashInjector({ phase: "validating", occurrence: 2 });
    const phases: TransactionPhase[] = ["prepared", "validating", "workspace-staged", "validating"];

    expect(() => phases.forEach((phase) => injector.checkpoint(phase))).toThrowError(
      new CrashInjectedError("validating", 2),
    );
    expect(injector.visited()).toEqual(phases);
  });
});

describe("mandatory misplaced repository script fixture", () => {
  const repositories: Array<{ dispose(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async (repository) => repository.dispose()));
  });

  it("matches the exact required file tree and role evidence", async () => {
    const snapshot = await snapshotFilesystem(mandatoryMisplacedRepositoryScriptFixture);

    expect(snapshot.map((entry) => entry.path)).toEqual([
      ".codex/hooks/lib/hook-state.mjs",
      ".codex/hooks/lib/validate-repo.mjs",
      ".codex/hooks/pre-tool.mjs",
      ".codex/hooks/validate-repo.mjs",
      ".codex/hooks/validate-repo.test.mjs",
      "package.json",
      "scripts/build-index.mjs",
      "scripts/build-index.test.mjs",
      "scripts/check-links.mjs",
      "scripts/check-links.test.mjs",
    ]);
    const manifest = JSON.parse(await readFile(path.join(mandatoryMisplacedRepositoryScriptFixture, "package.json"), "utf8"));
    expect(manifest.scripts["validate:repo"]).toBe("node .codex/hooks/validate-repo.mjs");
    expect(await readFile(path.join(mandatoryMisplacedRepositoryScriptFixture, ".codex/hooks/pre-tool.mjs"), "utf8"))
      .not.toContain("../validate-repo.mjs");
    expect(await readFile(path.join(mandatoryMisplacedRepositoryScriptFixture, ".codex/hooks/validate-repo.test.mjs"), "utf8"))
      .toContain("validateRepository");
    expect(mandatoryMisplacedRepositoryScriptContract).toMatchObject({
      packageScript: { name: "validate:repo", target: ".codex/hooks/validate-repo.mjs" },
      classification: {
        ".codex/hooks/pre-tool.mjs": "hook-entrypoint",
        ".codex/hooks/lib/hook-state.mjs": "hook-private-support",
        ".codex/hooks/lib/validate-repo.mjs": "hook-private-support",
        ".codex/hooks/validate-repo.mjs": "repository-automation",
        ".codex/hooks/validate-repo.test.mjs": "repository-automation-test",
      },
      expectedRepair: {
        moves: [
          { from: ".codex/hooks/validate-repo.mjs", to: "scripts/validate-repo.mjs" },
          { from: ".codex/hooks/validate-repo.test.mjs", to: "scripts/validate-repo.test.mjs" },
        ],
        packageScript: "node scripts/validate-repo.mjs",
        secondReconciliationMaterialDelta: false,
        unresolvedClusterWork: 0,
      },
    });
  });

  it("clones deterministically without executing repository scripts and isolates mutations", async () => {
    const first = await createTempGitRepository();
    const second = await createTempGitRepository();
    repositories.push(first, second);

    expect(first.initialRevision).toBe(second.initialRevision);
    expect(await first.snapshot()).toEqual(await second.snapshot());
    await expect(access(path.join(first.root, "repository-script-executed.marker"))).rejects.toThrow();
    await writeFile(path.join(first.root, "scripts/build-index.mjs"), "changed\n", "utf8");
    expect(await first.snapshot()).not.toEqual(await second.snapshot());
    expect(await readFile(path.join(second.root, "scripts/build-index.mjs"), "utf8")).toContain("buildIndex");

    await executeFile(process.execPath, [path.join(second.root, ".codex/hooks/validate-repo.mjs")], {
      cwd: second.root,
      env: { ...process.env, PROJECTOR_FIXTURE_EXECUTION_MARKER: "repository-script-executed.marker" },
    });
    expect(await readFile(path.join(second.root, "repository-script-executed.marker"), "utf8"))
      .toBe("validate:repo executed\n");
  });
});

describe("fixture mutation conventions", () => {
  it("applies declared mutations in order and refuses paths outside the fixture", async () => {
    const repository = await createTempGitRepository();
    try {
      const fixture = defineFixtureCase({
        name: "misplaced-script-near-miss",
        corpus: "held-out",
        source: mandatoryMisplacedRepositoryScriptFixture,
        mutations: [
          { id: "first", description: "seed content", apply: async (root) => writeFile(path.join(root, "variant.txt"), "first", "utf8") },
          { id: "second", description: "extend content", apply: async (root) => writeFile(path.join(root, "variant.txt"), `${await readFile(path.join(root, "variant.txt"), "utf8")}-second`, "utf8") },
        ],
      });

      await applyFixtureMutations(repository.root, fixture.mutations);
      expect(await readFile(path.join(repository.root, "variant.txt"), "utf8")).toBe("first-second");
      await expect(applyFixtureMutations(repository.root, [{
        id: "escape",
        description: "attempt escape",
        apply: async (_root, paths) => paths.writeText("../outside", "bad"),
      }])).rejects.toThrow(/outside/i);
    } finally {
      await repository.dispose();
    }
  });
});

describe("fake core ports and process substitutes", () => {
  it("serves cloned graph records so callers cannot mutate seeded state", () => {
    const concept: Concept = {
      id: "concept_fixture", key: "fixture", kind: "behavior", name: "Fixture", aliases: [], statement: "is isolated",
      status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: hash("a"), semanticHash: hash("b"),
    };
    const graph = new FakeGraphReader({ concepts: [concept], semanticSearchResults: { fixture: [concept.id] } });

    const returned = graph.getConcept(concept.id);
    returned?.aliases.push("mutated");
    expect(graph.getConcept(concept.id)?.aliases).toEqual([]);
    expect(graph.searchSemanticIdentities("fixture")).toEqual([concept.id]);
  });

  it("returns configured query/model/surface results without external work", async () => {
    const fingerprint: StateQueryResultFingerprint = {
      queryHash: hash("c"), resultHash: hash("d"), resultCount: 1, observability: "closed",
      assumptions: [], unavailableLanes: [], dependencyKeys: ["fixture"],
    };
    const queryReader = new FakeStateQueryReader({ fixture_query: fingerprint });
    const model = new FakeModelProvider([{ value: { role: "automation" }, rawResponseHash: hash("e") }]);
    const surface: Surface = {
      id: "surface_repo", key: "repo", kind: "repository", adapter: "fake", access: "read-only",
      enumeration: { observability: "closed", method: "fixture", assumptions: [], blindSpots: [], dynamicMechanisms: [] },
      capabilities: { read: true, write: false, watch: false, transactionalWrites: false, stableAnchors: true, humanApprovalRequired: false },
      boundary: { root: "." },
    };
    const artifact: Artifact = {
      id: "artifact_script", surfaceId: surface.id, locator: ".codex/hooks/validate-repo.mjs", mediaType: "text/javascript",
      contentHash: hash("f"), observedAt: "2026-08-07T12:00:00.000Z", observationRevision: "fixture",
      causalOrigin: { kind: "pre-projector" }, metadata: {},
    };
    const adapter = new FakeSurfaceAdapter({ surfaces: [surface], artifacts: { [surface.id]: [artifact] } });
    const context = { repositoryRoot: ".", stateDigest: { gitBase: "base", worktreeDigest: hash("1"), canonicalProjectorDigest: hash("2"), toolchainDigest: hash("3") }, config: {}, signal: new AbortController().signal };
    const request = {
      purpose: "classify fixture", role: "classify", programVersion: "1", schemaName: "role", schemaVersion: "1", schema: {}, input: {}, inputHash: hash("4"),
      risk: {
        class: "R0", inherentOperationRisk: 0, affectedUnitCount: 1, affectedSurfaceCount: 1,
        publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full",
        validationStrength: "exact", closureConfidence: "proven", unresolvedIdentityCount: 0,
        relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0,
        suspectDecisionCount: 0, compensationAvailable: true, reasons: [],
      },
    } satisfies StructuredModelRequest<{ role: string }>;

    expect(await queryReader.evaluate({ id: "fixture_query", kind: "custom", programId: "fixture", programVersion: "1", input: {}, semanticHash: hash("5") }, context)).toEqual(fingerprint);
    expect((await model.generateStructured(request)).value).toEqual({ role: "automation" });
    expect(await adapter.discover(context)).toEqual([surface]);
    expect(await adapter.inventory(surface, context)).toEqual([artifact]);
  });

  it("records declared commands and scripted host sessions without spawning processes", async () => {
    const commands = new FakeCommandSandbox({ validate: { exitCode: 0, stdout: "valid\n", stderr: "" } });
    const host = new FakeHostProcess([{ exitCode: 0, stdout: "complete\n", stderr: "", events: [{ type: "tool-call", name: "projector.validate" }] }]);

    expect(await commands.run({ id: "validate", argv: ["node", "validate.mjs"], cwd: ".", readScope: ["."], writeScope: [], network: "deny", environmentKeys: [], sideEffectClass: "read-only", timeoutMs: 1000 })).toMatchObject({ stdout: "valid\n" });
    expect(commands.calls()).toHaveLength(1);
    expect(await host.run({ argv: ["agent"], cwd: ".", instructions: "validate", environment: {} })).toMatchObject({ stdout: "complete\n" });
    expect(host.sessions()).toHaveLength(1);
  });
});
