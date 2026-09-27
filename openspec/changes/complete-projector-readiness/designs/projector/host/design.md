---
designDelta: 1
target: projector/host
baseline: 70fe7ad4ed46c5280a08ef46b4cd262eb7c966532c2f7a33d41f0c9e3ebb05c8
---
# Projector readiness design delta

## Replace: contract

```markdown
## Contract

The host exposes kernel queries and change operations through CLI and individual MCP tools. All clients use one authenticated loopback owner. It selects the owner before initializing derived state, keeps relay lifetime independent, and bounds transport admission, payloads, responses and waiting. Evidence requests use the selected child deadline plus bounded settlement time; ordinary operations retain their default deadline. MCP caller timeouts remain caller-owned, and progress is emitted only for supplied tokens. Before candidate mutation, each lifecycle request acquires a kernel exclusion lease and invalidates observation. An active writer blocks acquisition; new writers and checkpoint qualification stay blocked until the request releases its lease. Only an independent checkpoint restores currentness afterward. The installed runtime carries its code, production dependencies and OpenSpec schema outside the source checkout.

Applies: [[spec:projector/observation#Shared owner and bounded workers]] | {"kind":"path","root":".","prefix":"src/host/"} | The transport owns exclusive process selection, client lifetime and admission limits.
Applies: [[spec:projector/observation#Honest read modes]] | {"kind":"path","root":".","prefix":"src/host/"} | Change callbacks must invalidate observations before uncertain writes.
Applies: [[spec:projector/documents#External design ownership]] | {"kind":"path","root":".","prefix":"plugins/projector/"} | Plugin integration stays outside ordinary application source and runtime dependencies.
```

## Replace: decision:thin-installed-clients

```markdown
## Decision: thin-installed-clients

Choice: Ship an SDK stdio relay and CLI that call the same bounded protocol; install compiled runtime, locked production dependencies and the custom OpenSpec schema into a self-contained native Agent Plugins package. Root manifests use schema 1.0.0 and `${PLUGIN_ROOT}` launch expansion.
Reason: Host-launched MCP processes must share existing work and operate independently of the development checkout.
Requires: [[spec:projector/documents#External design ownership]] [[spec:projector/observation#Shared owner and bounded workers]]
Consequential: boundary
Alternative: Let each relay open its own SQLite index or run directly from a developer checkout.
Tradeoff: A fresh installation pays dependency download and disk costs once; clients do not own competing caches or require application imports.
Realizes: [[code:src/host/relay.ts#relay]] [[code:src/host/cli.ts]] [[code:src/host/install.ts#install]] [[code:plugins/projector/mcp.json]] [[code:plugins/projector/plugin.json]]
Evidence: Installed two-client tests execute the declared launch arguments and exercise native paths, queries, nested target preparation, plan/apply/revision, real executed evidence, archive, integrated publication, preservation of unrelated changes, a long evidence check, and a settled repeat. Actual Codex app-server qualification verifies native plugin discovery and the server handshake separately.
```
