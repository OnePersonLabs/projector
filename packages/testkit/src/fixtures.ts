import { fileURLToPath } from "node:url";

import { createFixturePaths, type FixturePaths } from "./filesystem.js";

export const mandatoryMisplacedRepositoryScriptFixture = fileURLToPath(
  new URL("../../../fixtures/misplaced-repository-script", import.meta.url),
);

export const repositoryScriptExecutionMarker = "repository-script-executed.marker";

export const mandatoryMisplacedRepositoryScriptContract = {
  inventoryExecutesRepositoryCode: false,
  packageScript: {
    name: "validate:repo",
    target: ".codex/hooks/validate-repo.mjs",
  },
  classification: {
    ".codex/hooks/pre-tool.mjs": "hook-entrypoint",
    ".codex/hooks/lib/hook-state.mjs": "hook-private-support",
    ".codex/hooks/lib/validate-repo.mjs": "hook-private-support",
    ".codex/hooks/validate-repo.mjs": "repository-automation",
    ".codex/hooks/validate-repo.test.mjs": "repository-automation-test",
    "scripts/build-index.mjs": "repository-automation",
    "scripts/build-index.test.mjs": "repository-automation-test",
    "scripts/check-links.mjs": "repository-automation",
    "scripts/check-links.test.mjs": "repository-automation-test",
  },
  evidence: {
    hookEntrypoints: [".codex/hooks/pre-tool.mjs"],
    hookPrivateImports: [
      ".codex/hooks/lib/hook-state.mjs",
      ".codex/hooks/lib/validate-repo.mjs",
    ],
    repositoryAutomationTests: {
      ".codex/hooks/validate-repo.mjs": ".codex/hooks/validate-repo.test.mjs",
      "scripts/build-index.mjs": "scripts/build-index.test.mjs",
      "scripts/check-links.mjs": "scripts/check-links.test.mjs",
    },
    misplacedModuleHasHookLifecycleSignature: false,
    hookCodeImportsMisplacedModule: false,
    proximityIsMisleadingCounterevidence: true,
  },
  expectedRepair: {
    riskClass: "R1",
    moves: [
      { from: ".codex/hooks/validate-repo.mjs", to: "scripts/validate-repo.mjs" },
      { from: ".codex/hooks/validate-repo.test.mjs", to: "scripts/validate-repo.test.mjs" },
    ],
    packageScript: "node scripts/validate-repo.mjs",
    secondReconciliationMaterialDelta: false,
    unresolvedClusterWork: 0,
    requiresWriterLease: true,
    requiresJournal: true,
    requiresReceipt: true,
    requiresCertificate: true,
    canonicalRebuildMustPreserveSemantics: true,
  },
} as const;

export type FixtureCorpus = "golden" | "held-out" | "mutation";

export interface FixtureMutation {
  id: string;
  description: string;
  apply(root: string, paths: FixturePaths): Promise<void> | void;
}

export interface FixtureCase {
  name: string;
  corpus: FixtureCorpus;
  source: string;
  mutations: readonly FixtureMutation[];
}

export function defineFixtureCase(fixture: FixtureCase): FixtureCase {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fixture.name)) {
    throw new TypeError("Fixture names must use lowercase kebab-case");
  }
  const identifiers = new Set<string>();
  for (const mutation of fixture.mutations) {
    if (identifiers.has(mutation.id)) {
      throw new Error(`Duplicate fixture mutation ID: ${mutation.id}`);
    }
    identifiers.add(mutation.id);
  }
  return {
    ...fixture,
    mutations: [...fixture.mutations],
  };
}

export async function applyFixtureMutations(
  root: string,
  mutations: readonly FixtureMutation[],
): Promise<void> {
  const paths = createFixturePaths(root);
  for (const mutation of mutations) {
    await mutation.apply(root, paths);
  }
}
