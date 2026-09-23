# Actual Codex plugin qualification

The Windows qualification uses Codex CLI **0.155.1**, Node **24.19.0**, and Projector **4.0.0**. It invokes the real Codex app-server control protocol without starting a model turn. Production installation, marketplace registration, and MCP initialization are distinct checks.

The production installer generated a complete package outside the source checkout. A user-local marketplace named `projector-v4-local` contains one local `projector` entry with `source: { source: "local", path: "./final-plugin" }`. Supported commands register and install it:

```powershell
node dist/host/cli.js install C:/Users/zethj/AppData/Local/Projector/v4-qualified-1790123817732/final-plugin
codex plugin marketplace add C:/Users/zethj/AppData/Local/Projector/v4-qualified-1790123817732 --json
codex plugin add projector@projector-v4-local --json
```

Codex reports the installed package at `C:/Users/zethj/.codex/plugins/cache/projector-v4-local/projector/4.0.0`. Windows application virtualization resolves the marketplace source under the Codex package's LocalCache directory. The registered source is independent of the development checkout. Installed caches are written exclusively by Codex's supported installer.

## Observed launch correction

The initial compatibility manifest used `${CLAUDE_PLUGIN_ROOT}` in its MCP arguments. `codex plugin add` registered it successfully, but actual `mcpServerStatus/list` returned empty tools, no server information, and `handshaking with MCP server failed: connection closed: initialize response`. In the same app-server, a process-local control server with the exact installed CLI path initialized as Projector 4.0.0 and exposed 15 tools. Registration alone had concealed a real launch defect.

A separately registered native-format probe using root Agent Plugins `plugin.json` and `mcp.json`, schema 1.0.0, `type: "stdio"`, and `${PLUGIN_ROOT}` succeeded in that same Codex host. The shipped package adopts precisely that format. The disposable probe registration was removed through `codex plugin remove`; the production plugin remains registered. The [official package documentation](https://developers.openai.com/plugins/build/plugins) describes the native manifest and fixed root MCP path; the real host probe establishes this platform's argument expansion behavior.

## Host protocol and scope

`codex app-server generate-json-schema --experimental` supplies the protocol definitions. The control client sends `initialize` with an experimental-capable client identity, then `initialized`, followed by `mcpServerStatus/list` with `detail: "full"`. Per-process configuration disables unrelated configured MCP servers and plugins while leaving the actual registered Projector enabled. It adds no persistent custom MCP substitute. No model turn is started, and no unrelated connector tools are called.

Both the native probe and the final production registration report `serverInfo.name: "projector"`, `serverInfo.version: "4.0.0"`, and `toolsError: null`. The final response identifies `pluginId: "projector@projector-v4-local"`. Its 15 discovered tools are `openRoot`, `read`, `inspectStatus`, `releaseRoot`, `beginBatch`, `completeBatch`, `checkpoint`, `invalidateObservation`, `prepareChange`, `validatePlan`, `recordEvidence`, `applyChange`, `reviseChange`, `finishChange`, and `resumeChange`.

After active trial clients released the original installation, `codex plugin remove projector@projector-v4-local --json` and `codex plugin add projector@projector-v4-local --json` refreshed the production package at the same version and installed path. A fresh actual app-server initialized and discovered all 15 tools in 2.21 seconds, with no custom MCP control server enabled. The installed CLI reports `projector 4.0.0`; the CLI and MCP manifest SHA-256 hashes match their current source artifacts. The installed CLI hash is `eecfd42956e03d955056c56261bd49da12e28b2390c71e3bf6d2a7795d62f5ae`.

The installed SDK-client tests also execute the package's declared `mcp.json` launch arguments. They pass the complete lifecycle through two clients and the independent managed-interleaving test. They do not replace actual Codex discovery. The user-disabled `opl-openspec` plugin and test-driven-development skill remain disabled throughout qualification; no plugin hooks are required by Projector.
