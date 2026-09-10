import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const topLevelChildren = (source: string, key: string): string[] => {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) return [];
  const children: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[^\s]/u.test(line)) break;
    const match = /^  ([a-zA-Z0-9_-]+):/u.exec(line);
    if (match?.[1] !== undefined) children.push(match[1]);
  }
  return children;
};

describe("manual source-severed release workflow", () => {
  it("has only a manual trigger and accepts one uploaded candidate in a fresh no-checkout job", async () => {
    const workflow = await readFile(".github/workflows/projector-operations.yml", "utf8");
    const packedLifecycle = await readFile("scripts/packed-lifecycle-acceptance.mjs", "utf8");

    expect(topLevelChildren(workflow, "on")).toEqual(["workflow_dispatch"]);
    const buildCommands = [
      "pnpm acceptance:knowledge",
      "pnpm verify",
      "pnpm release:artifacts:check",
      "node scripts/build-source-severed-release-bundle.mjs \"${{ runner.temp }}/projector-release-candidate\"",
    ];
    const positions = buildCommands.map((command) => workflow.indexOf(`run: ${command}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(workflow.slice(0, workflow.indexOf("  source-severed-acceptance:"))).not.toContain("provision-ubuntu-sandbox");
    expect(workflow).not.toContain("probe-sandbox.mjs");
    const acceptanceJob = workflow.slice(workflow.indexOf("  source-severed-acceptance:"));
    expect(acceptanceJob).toContain("needs: build-candidate");
    expect(acceptanceJob).toContain("actions/download-artifact@v4");
    expect(workflow).not.toContain(".temp/release-candidate");
    expect(workflow).toContain("${{ runner.temp }}/projector-release-candidate");
    expect(acceptanceJob).not.toContain("actions/checkout");
    expect(acceptanceJob).toContain("ubuntu-24.04");
    expect(acceptanceJob).toContain("windows-2025");
    expect(acceptanceJob).not.toContain("provision-ubuntu-sandbox");
    expect(acceptanceJob).toContain("actions/upload-artifact@v4");
    expect(packedLifecycle).not.toMatch(/bwrap|bubblewrap|"sudo"|"unshare"|"nsenter"|namespaceProcessId|namespace keeper/iu);
  });
});
