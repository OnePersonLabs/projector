import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain, type AdapterContext } from "@projector/core";
import { afterEach, describe, expect, it } from "vitest";

import { analyzeLocalRepository, createTopologyRelevanceAdapter, createTopologyRelevanceQueryStatePort } from "./index.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("broad analyzer public composition", () => {
  it("runs analyze -> topology -> relevance with cross-package and zero-consumer routes without execution", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-broad-analyzer-"));
    roots.push(root);
    await mkdir(join(root, "packages/events"), { recursive: true });
    await mkdir(join(root, "apps/client"), { recursive: true });
    await writeFile(join(root, "packages/events/package.json"), '{"name":"@demo/events"}');
    await writeFile(join(root, "packages/events/index.ts"), "import { writeFileSync } from 'node:fs';\nwriteFileSync('execution-marker', 'bad');\nbus.emit('order.created');\nbus.emit('order.unhandled');\nexport interface Order { id: string }\n");
    await writeFile(join(root, "apps/client/package.json"), '{"name":"@demo/client"}');
    await writeFile(join(root, "apps/client/index.ts"), "bus.on('order.created', handle);\nimport type { Order } from '@demo/events';\n");
    const analysis = await analyzeLocalRepository({ repositoryRoot: root });
    await expect(readFile(join(root, "execution-marker"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const route = analysis.topology.routes.find(({ semanticKey }) => semanticKey === "order.created")!;
    expect(route.consumerIds.length).toBe(1);
    const zero = analysis.topology.routes.find(({ semanticKey }) => semanticKey === "order.unhandled")!;
    expect(zero.consumerIds).toEqual([]);
    const queryBinding = { bind: async (subjectId: string, subjectKind: "event" | "contract", _context: AdapterContext) => {
      const selected = analysis.topology.routes.find(({ subjectId: id }) => id === subjectId)!;
      const kind = `${subjectKind}-topology` as "event-topology" | "contract-topology";
      const programId = `projector.topology.${subjectKind}-relevance`;
      const input = { subjectId };
      const queryHash = hashFramedDomain("state-query", { kind, programId, programVersion: selected.queryVersion, input });
      const snapshot = createTopologyRelevanceQueryStatePort(analysis.topology).inspect(subjectId, subjectKind);
      return { query: { id: `topology:${subjectId}`, kind, programId, programVersion: selected.queryVersion, input, semanticHash: queryHash }, priorResult: { queryHash, resultHash: hashFramedDomain("state-query-result", snapshot.results), resultCount: snapshot.results.length, observability: snapshot.observability, assumptions: snapshot.assumptions, unavailableLanes: snapshot.unavailableLanes, dependencyKeys: snapshot.dependencyKeys }, role: "topology consumers and negative space" };
    } };
    const adapter = createTopologyRelevanceAdapter(analysis.topology, queryBinding);
    const context = { repositoryRoot: root, stateDigest: { gitBase: "base", worktreeDigest: hashFramedDomain("state", "w"), canonicalProjectorDigest: hashFramedDomain("state", "c"), toolchainDigest: hashFramedDomain("state", "t") }, config: {}, signal: new AbortController().signal };
    expect((await adapter.discover(route.subjectId, 0, context)).edges.map(({ entityId }) => entityId)).toEqual(expect.arrayContaining(route.consumerIds));
    expect((await adapter.discover(zero.subjectId, 0, context)).dependency.priorResult.resultCount).toBe(0);
    expect(analysis.divergences.every(({ code }) => ["broken-static-import", "duplicate-public-export", "actions-needs-gap", "generated-source-drift"].includes(code))).toBe(true);
    expect(analysis.capabilities.every(({ executesRepositoryCode }) => executesRepositoryCode === false)).toBe(true);
  });
});
