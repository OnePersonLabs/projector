import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILT_IN_QUERY_PROGRAM_IDS, InMemoryGraphReader, QueryDependencyRegistry } from "@projector/engine";
import { withObservationScope } from "@projector/runtime";
import { expect, it } from "vitest";
import { observeIndexedRepository } from "../change-lifecycle/indexed-observer.js";
import { runObservationTask } from "./task-runner.js";

it("executes addressed graph queries in a fresh compiled worker without transferring observation arrays", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-indexed-query-worker-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    await writeFile(join(root, "package.json"), '{"name":"indexed-worker","type":"module"}');
    await writeFile(join(root, "shared.ts"), "export const shared = 1;\n");
    await writeFile(join(root, "consumer.ts"), 'import { shared } from "./shared.js"; export const consumer = shared;\n');
    await withObservationScope({}, async (scope) => {
      const observation = await observeIndexedRepository(root);
      try {
        const subjectId = observation.store.populationAt(observation.descriptor.generation, "unit-path:shared.ts")[0]!;
        expect(subjectId).toBeDefined();
        const query = new QueryDependencyRegistry(new InMemoryGraphReader()).createSpec({ id: "shared-consumer", programId: BUILT_IN_QUERY_PROGRAM_IDS.exactReverseDerivation, input: { subjectId } });
        const input = { descriptor: observation.descriptor, query, context: { repositoryRoot: root, stateDigest: observation.descriptor.metadata.state, config: {} } };
        const first = await runObservationTask("indexed-graph-query", input, scope);
        expect(first.resultCount).toBe(1);
        expect(await runObservationTask("indexed-graph-query", input, scope)).toEqual(first);
        expect(observation.store.head()?.generation).toBe(observation.descriptor.generation);
      } finally { observation.close(); }
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
