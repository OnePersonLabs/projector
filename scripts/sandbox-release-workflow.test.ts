import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const topLevelChildren = (source: string, key: string): string[] => {
  const lines = source.split("\n");
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

describe("manual sandbox release workflow", () => {
  it("has only a manual trigger and proves isolation before governed release gates", async () => {
    const workflow = await readFile(".github/workflows/projector-operations.yml", "utf8");
    const provisioning = await readFile(".github/scripts/provision-ubuntu-sandbox.sh", "utf8");

    expect(topLevelChildren(workflow, "on")).toEqual(["workflow_dispatch"]);
    const orderedCommands = [
      "bash .github/scripts/provision-ubuntu-sandbox.sh",
      "node scripts/probe-sandbox.mjs",
      "node scripts/task19-dogfood.mjs",
      "pnpm verify",
      "pnpm release:artifacts:check",
      "pnpm release:acceptance",
    ];
    const positions = orderedCommands.map((command) => workflow.indexOf(`run: ${command}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(provisioning).toContain('restriction_before="$(sysctl -n "$restriction_key")"');
    expect(provisioning).toContain('restriction_after="$(sysctl -n "$restriction_key")"');
    expect(provisioning).toContain('if [[ "$restriction_after" != "$restriction_before" ]]');
    expect(provisioning).not.toMatch(/sysctl\s+(?:-w|--write)/u);
  });
});
