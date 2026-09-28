import { describe, expect, it } from "vitest";
import { TreeSitterCodeProvider } from "./tree-sitter-provider.js";

describe("Tree-sitter syntax fallback", () => {
  it("parses a Python declaration but does not invent resolved calls", async () => {
    const provider = new TreeSitterCodeProvider();
    try {
      const snapshot = await provider.update([{path:"main.py",content:"def greet(name):\n    return name\ngreet('Ada')\n",contentHash:"test"}],{binding:{checkoutId:"checkout",worktreeDigest:"tree",projectKey:"python"}});
      const staged: typeof snapshot.partitions = [];
      const streamed = await provider.update([{path:"main.py",content:"def greet(name):\n    return name\ngreet('Ada')\n",contentHash:"test"}],{binding:{checkoutId:"checkout",worktreeDigest:"tree",projectKey:"python"}}, partition => { staged.push(partition); });
      expect({ ...streamed, partitions: staged }).toEqual(snapshot);
      expect(snapshot.partitions[0]?.symbols).toEqual(expect.arrayContaining([expect.objectContaining({name:"greet",kind:"function_definition"})]));
      expect(snapshot.partitions[0]?.edges).toEqual([]);
      expect(snapshot.partitions[0]?.coverage.capabilities.find(capability => capability.kind === "call")?.status).toBe("unavailable");
    } finally { provider.close(); }
  });
});
