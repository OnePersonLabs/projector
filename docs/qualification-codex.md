# Actual Codex plugin qualification

The Windows qualification uses Codex CLI **0.155.1**, Node **24.19.0**, and Projector **4.0.0**. It invokes the real Codex app-server control protocol without starting a model turn. Production installation, marketplace registration, and MCP initialization are distinct checks.

The production installer generated a complete package outside the source checkout. A user-local marketplace named `projector-v4-local` contains one local `projector` entry with `source: { source: "local", path: "./final-plugin-longpaths" }`. Supported commands register and install it:

```powershell
node dist/host/cli.js install C:/Users/zethj/AppData/Local/Projector/v4-qualified-1790123817732/final-plugin-longpaths
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

After active trial clients released the original installation, the production installer prepared a fresh external package containing the Windows Git long-path correction. The marketplace entry was updated to that package, and `codex plugin add projector@projector-v4-local --json` refreshed the production package at the same version and installed path. No cache files were edited manually, and no uninstall was required.

At **2026-09-23 01:15 UTC**, a fresh actual app-server initialized and discovered all 15 tools in **2.092 seconds**, with no custom MCP control server enabled. The installed CLI reports `projector 4.0.0`. All **72 compiled files**, **5 schema files**, **3 shipped plugin files**, and the runtime package manifest and lockfile match their current source artifacts byte-for-byte. The SHA-256 evidence is:

| Artifact | SHA-256 |
| --- | --- |
| Compiled `dist` tree | `afd3e62ecb47ac96bdbd413702298ad867aafde7734deb4611dd51025cd20666` |
| Schema tree | `143944913883415de4317783b33b2145fd3dd966a68d15d853a5eaaff5588fe4` |
| Shipped plugin files | `2f0c234269d7b3174bae7f0d69f2bec7e61bc5e5a7a99357a1242f22cc529e5e` |
| Installed CLI | `eecfd42956e03d955056c56261bd49da12e28b2390c71e3bf6d2a7795d62f5ae` |
| Installed MCP manifest | `fe3950bf9c7f53d3296ecb1a325e808f176430318afced48809139ccb6f45ede` |

Tree digests hash sorted records of each relative path, a NUL separator, its file SHA-256, and a newline. The complete tree comparison covers runtime changes even when the CLI entry point itself is unchanged. Codex logs `Method not found` for the optional resource and resource-template listing methods; these do not affect the successful MCP initialization or tool discovery.

The installed SDK-client tests also execute the package's declared `mcp.json` launch arguments. They pass the complete lifecycle through two clients and the independent managed-interleaving test. They do not replace actual Codex discovery. Before and after the final refresh, the entire Codex configuration SHA-256 remained `77e21f8a380abc74366211e15733d6816dd6e592ded803e7e62b6cb267db8e89`, and every plugin's enabled state and version remained unchanged. The user-disabled `opl-openspec` plugin and test-driven-development skill remain disabled throughout qualification; no plugin hooks are required by Projector.
