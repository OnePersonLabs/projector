# Operational MCP registry design

## Goal

Make MCP advertisement truthful without losing Projector's canonical tool inventory or mutation guarantees.

## Problem

`createBuiltProjectorMcpServer()` expands every declared read and mutation name into a callable registry entry. The CLI composition has real behavior for only a subset. Generic reads return `unavailable`, and four mutation handlers always throw. MCP clients therefore see tools that look operational but cannot perform their advertised work.

The wrapper is shallow: deleting it removes false behavior and moves no necessary complexity to callers. The generic MCP server already accepts explicit read and controlled-handler maps.

## Design

The integrations package owns one canonical catalog of all specified names and mutation classes. The catalog preserves existing names and generated schemas. It does not imply runtime availability.

The CLI composition passes only operational handlers to `createProjectorMcpServer()`:

- without an authenticated session: `projector.status`, `projector.audit`, and `projector.list_divergences`;
- with an authenticated session: the three repository reads plus `projector.preview_representation`, `projector.validate_representation`, and `projector.apply_transform`.

`projector.status` returns the complete canonical catalog with an `operational` flag and a reason for every unavailable tool. This is the inspection surface for declared-but-unavailable behavior. Calling an unadvertised name returns the existing unknown-tool JSON-RPC error and cannot consume a mutation capability.

The shallow built-server wrapper is deleted. The generic server remains the deep module: explicit handlers in, schema-bearing registry and sanitized JSON-RPC behavior out.

## Compatibility

- All 21 specified names remain canonical and inspectable.
- Read and controlled input-schema shapes remain unchanged.
- Existing operational tool behavior and JSON-RPC result shapes remain unchanged.
- `tools/list` intentionally narrows to operational tools. This is the required correction to the characterized baseline.
- Capability issuance narrows to registered controlled tools. No unavailable mutation name receives authority.

## Acceptance

1. A sessionless built composition lists exactly the three operational repository reads.
2. An authenticated composition lists those reads, both representation tools, and `apply_transform`.
3. Status accounts for all 21 canonical names with truthful availability.
4. An unadvertised call fails as unknown and performs no controlled mutation.
5. `apply_transform` still requires and atomically consumes its state-bound capability.
6. Read and controlled schemas retain their existing public shapes.
7. Installed plugin and packed-release MCP paths observe the narrowed operational list.

## Authority

- [Host and MCP Integration](../../../PROJECTOR_SPEC/08-agents/hosts-and-mcp.md)
- [Projector north star](../../../NORTH_STAR.md)
