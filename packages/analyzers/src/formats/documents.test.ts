import { hashFramedDomain } from "@projector/core";
import { describe, expect, it } from "vitest";

import type { InventoryEntry } from "../filesystem/inventory.js";
import { analyzeDocuments } from "./documents.js";

const entry = (path: string, content: string): InventoryEntry => ({ path, kind: "file", mediaType: "text/plain", content, contentHash: hashFramedDomain("fixture", content), generated: false });

describe("bounded structured document, Actions, and Markdown extraction", () => {
  it("parses JSON/YAML/TOML stable paths and localizes duplicate/custom syntax failures", () => {
    const result = analyzeDocuments([
      entry("bad.json", '{"name":"a","name":"b"}'),
      entry("multi.yaml", "service:\n  port: 80\n---\nservice:\n  port: 81\ncustom: !Thing inert\nalias: &base value"),
      entry("project.toml", "title = \"demo\"\n[database]\nport = 5432\n[[workers]]\nname = \"one\"\n[[workers]]\nname = \"two\""),
    ]);
    expect(result.failures).toContainEqual(expect.objectContaining({ scope: "bad.json", capability: "duplicate-key" }));
    expect(result.documents.find(({ path }) => path === "multi.yaml")?.units.map(({ stablePath }) => stablePath)).toEqual(expect.arrayContaining(["/0/service/port", "/1/service/port"]));
    expect(result.documents.find(({ path }) => path === "multi.yaml")?.unknowns.join(" ")).toMatch(/custom tag|anchor/iu);
    expect(result.documents.find(({ path }) => path === "project.toml")?.units.map(({ stablePath }) => stablePath)).toEqual(expect.arrayContaining(["/database/port", "/workers/0/name", "/workers/1/name"]));
  });

  it("extracts inert Actions structure and Markdown references without executing fenced examples", () => {
    const result = analyzeDocuments([
      entry(".github/workflows/ci.yml", [
        "on:", "  pull_request:", "    paths: ['src/**']", "permissions:", "  contents: read", "jobs:", "  build:", "    strategy:", "      matrix:", "        node: [20, 22]", "    steps:", "      - uses: actions/checkout@v4", "      - run: echo ${{ matrix.node }}", "  verify:", "    needs: [build]", "    uses: ./.github/workflows/reusable.yml", "    with:", "      mode: strict",
      ].join("\n")),
      entry("README.md", "# API\n[Contract](docs/contract.md)\n[ref]: https://example.invalid\ncontract:Checkout@1\n```ts\nbus.emit('must.not.execute')\ncontract:Fake@9\n```"),
    ]);
    const workflow = result.actions[0]!;
    expect(workflow).toMatchObject({ triggers: ["pull_request"], permissions: [{ key: "contents", value: "read" }] });
    expect(workflow.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "build", uses: [], steps: expect.arrayContaining([expect.objectContaining({ uses: "actions/checkout@v4" })]) }),
      expect.objectContaining({ id: "verify", needs: ["build"], uses: ["./.github/workflows/reusable.yml"] }),
    ]));
    expect(workflow.unknowns.join(" ")).toMatch(/expression|remote action/iu);
    const markdown = result.markdown[0]!;
    expect(markdown.headings).toEqual([expect.objectContaining({ text: "API", level: 1 })]);
    expect(markdown.contractReferences.map(({ key }) => key)).toEqual(["Checkout@1"]);
    expect(markdown.contractReferences.some(({ key }) => key.includes("Fake"))).toBe(false);
    expect(markdown.fences).toEqual([expect.objectContaining({ info: "ts" })]);
    expect(markdown.references).toEqual([expect.objectContaining({ key: "ref", target: "https://example.invalid" })]);
  });

  it("keeps duplicate JSON keys scope-local and captures fuller literal Actions structure", () => {
    const result = analyzeDocuments([
      entry("siblings.json", '{"left":{"name":"a"},"right":{"name":"b"}}'),
      entry(".github/workflows/reusable.yml", [
        "on:", "  pull_request:", "    paths: ['src/**']", "    paths-ignore: ['docs/**']", "  workflow_call:", "    inputs:", "      mode:", "    outputs:", "      result:",
        "jobs:", "  build:", "    environment: production", "    strategy:", "      matrix:", "        node: [20, 22]", "    with:", "      mode: strict", "    outputs:", "      artifact: ${{ steps.pack.outputs.name }}", "    steps:", "      - run: pnpm test",
      ].join("\n")),
    ]);
    expect(result.failures.some(({ scope, capability }) => scope === "siblings.json" && capability === "duplicate-key")).toBe(false);
    expect(result.actions[0]).toMatchObject({
      triggers: ["pull_request", "workflow_call"],
      pathFilters: [expect.objectContaining({ trigger: "pull_request", include: ["src/**"], exclude: ["docs/**"] })],
      inputs: [expect.objectContaining({ key: "mode", value: "" })], outputs: [expect.objectContaining({ key: "result", value: "" })],
      jobs: [expect.objectContaining({ environment: "production", matrix: [expect.objectContaining({ key: "node", values: ["20", "22"] })], inputs: [expect.objectContaining({ key: "mode", value: "strict" })], outputs: [expect.objectContaining({ key: "artifact", value: "${{ steps.pack.outputs.name }}" })] })],
    });
  });
});
