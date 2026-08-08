import { createHostAdapter, type HostAdapter, type HostAdapterDependencies } from "../codex/adapter.js";

export function createClaudeHostAdapter(dependencies: HostAdapterDependencies): HostAdapter {
  return createHostAdapter("claude", "claude", dependencies);
}
