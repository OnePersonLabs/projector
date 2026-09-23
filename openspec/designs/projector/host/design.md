---
projectorDesign: 1
id: projector/host
scope: src/host
---
# Shared local owner and installed clients

## Contract

The host exposes kernel queries and change operations through CLI and individual MCP tools. All clients use one authenticated loopback owner. It selects the owner before initializing derived state, keeps relay lifetime independent, and bounds transport admission, payloads, responses and waiting. Before candidate mutation, each lifecycle request acquires a kernel exclusion lease and invalidates observation. An active writer blocks acquisition; new writers and checkpoint qualification stay blocked until the request releases its lease. Only an independent checkpoint restores currentness afterward. The installed runtime carries its code, production dependencies and OpenSpec schema outside the source checkout.

Applies: [[spec:projector/observation#Shared owner and bounded workers]] | {"kind":"path","root":".","prefix":"src/host/"} | The transport owns exclusive process selection, client lifetime and admission limits.
Applies: [[spec:projector/observation#Honest read modes]] | {"kind":"path","root":".","prefix":"src/host/"} | Change callbacks must invalidate observations before uncertain writes.
Applies: [[spec:projector/documents#External design ownership]] | {"kind":"path","root":".","prefix":"plugins/projector/"} | Plugin integration stays outside ordinary application source and runtime dependencies.

## Decision: exclusive-loopback-owner

Choice: Use a fixed configured IPv4 loopback port with an exclusive OS socket bind, a private current-user credential and a versioned handshake. The default namespace does not change across package versions. Reject a foreign or incompatible endpoint without port searching.
Reason: Simultaneous host sessions need one index owner whose lifetime cannot be duplicated by stale process or timestamp files.
Requires: [[spec:projector/observation#Shared owner and bounded workers]]
Consequential: strategy
Alternative: A platform-specific named-pipe broker or a manual background service.
Tradeoff: Loopback requires explicit credential protection and browser-origin rejection; its tested bind primitive avoids a second transport or installed service. Windows DACLs are necessary because POSIX file modes do not remove inherited permissions.
Realizes: [[code:src/host/server.ts#startOwner]] [[code:src/host/client.ts#connectOwner]] [[code:src/host/config.ts#privateDirectory]]
Evidence: Host tests select one owner from sixteen contenders, reject foreign/origin/unauthenticated calls, inspect Windows ACLs, and enforce request budgets. Installed tests keep the owner usable after one relay closes.

## Decision: thin-installed-clients

Choice: Ship an SDK stdio relay and CLI that call the same bounded protocol; install compiled runtime, locked production dependencies and the custom OpenSpec schema into a self-contained native Agent Plugins package. Root manifests use schema 1.0.0 and `${PLUGIN_ROOT}` launch expansion.
Reason: Host-launched MCP processes must share existing work and operate independently of the development checkout.
Requires: [[spec:projector/documents#External design ownership]] [[spec:projector/observation#Shared owner and bounded workers]]
Consequential: boundary
Alternative: Let each relay open its own SQLite index or run directly from a developer checkout.
Tradeoff: A fresh installation pays dependency download and disk costs once; clients do not own competing caches or require application imports.
Realizes: [[code:src/host/relay.ts#relay]] [[code:src/host/cli.ts]] [[code:src/host/install.ts#install]] [[code:plugins/projector/mcp.json]] [[code:plugins/projector/plugin.json]]
Evidence: Installed two-client tests execute the declared launch arguments and exercise native paths, queries, nested target preparation, plan/apply/revision, real executed evidence, archive, candidate-only publication and a settled repeat. Actual Codex app-server qualification verifies native plugin discovery and the server handshake separately.

## Realization

[[code:src/host/index.ts]] exports the supported adapter entry points. [[code:src/host/server.ts#productDispatcher]] retains one lifecycle service and connects its mutation callbacks to request-local kernel leases; `finally` releases every lease. Regression evidence lives in [[code:test/host.test.ts]], [[code:test/host-installed.test.ts]] and [[code:test/host-lifecycle.test.ts]].
