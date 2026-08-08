import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain } from "@projector/core";
import { afterEach, describe, expect, it } from "vitest";

import { analyzeDocuments } from "./formats/documents.js";
import type { InventoryEntry } from "./filesystem/inventory.js";
import { analyzeLocalRepository } from "./local-repository.js";
import { createTopologyRelevanceQueryStatePort } from "./topology/index.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
const entry = (path: string, content: string): InventoryEntry => ({ path, kind: "file", mediaType: "application/yaml", content, contentHash: hashFramedDomain("fixture", content), generated: false });

describe("Task 14 consolidated repair regressions", () => {
  it("widens dynamic event siblings, converges re-export aliases, and avoids exact supported-TS divergences", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-analyzer-repair-")); roots.push(root);
    await mkdir(join(root, "packages/a"), { recursive: true }); await mkdir(join(root, "packages/b"), { recursive: true });
    await writeFile(join(root, "packages/a/package.json"), '{"name":"@demo/a"}');
    await writeFile(join(root, "packages/a/schema.ts"), "export interface Schema { value: string }\n");
    await writeFile(join(root, "packages/a/index.ts"), [
      "import type { Schema } from './schema.js';",
      "export interface InternalPayload { schema: Schema }",
      "export { InternalPayload as PublicPayload };",
      "export function format(value: string): string;",
      "export function format(value: string) { return value; }",
      "bus.emit('changed');",
      "bus.on(eventName, handler);",
    ].join("\n"));
    await writeFile(join(root, "packages/b/package.json"), '{"name":"@demo/b"}');
    await writeFile(join(root, "packages/b/index.ts"), "import type { PublicPayload } from '@demo/a';\nexport const use = (value: PublicPayload) => value;\n");

    const analysis = await analyzeLocalRepository({ repositoryRoot: root });
    const eventRoute = analysis.topology.routes.find(({ semanticKey }) => semanticKey === "changed")!;
    expect(eventRoute.observability).toBe("open");
    const eventSnapshot = createTopologyRelevanceQueryStatePort(analysis.topology).inspect(eventRoute.subjectId, "event");
    expect(eventSnapshot).toMatchObject({ observability: "open", results: [] });
    expect(eventSnapshot.assumptions.join(" ")).toMatch(/blind-spot|dynamic:/u);
    expect(analysis.topology.routes.find(({ semanticKey }) => semanticKey === "PublicPayload")?.consumerIds).toHaveLength(1);
    expect(analysis.divergences.some(({ code }) => code === "broken-static-import" || code === "duplicate-public-export")).toBe(false);
  });

  it("preserves block-list path filters and scalar permissions and marks unsupported shapes uncertain", () => {
    const result = analyzeDocuments([entry(".github/workflows/ci.yml", [
      "on:", "  pull_request:", "    paths:", "      - src/**", "      - '!docs/**'", "permissions: read-all", "jobs:", "  build:", "    permissions: { contents: read }", "    steps:", "      - run: pnpm test",
    ].join("\n"))]);
    expect(result.actions[0]).toMatchObject({
      pathFilters: [expect.objectContaining({ trigger: "pull_request", include: ["src/**"], exclude: ["docs/**"] })],
      permissions: [expect.objectContaining({ key: "*", value: "read-all" })],
    });
    expect(result.actions[0]?.unknowns.join(" ")).toMatch(/unsupported.*permission/iu);
  });
});
