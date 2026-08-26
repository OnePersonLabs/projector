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
- with an authenticated session carrying a representation: the three repository reads plus `projector.preview_representation` and `projector.validate_representation`.

`projector.status` returns the complete canonical catalog with an `operational` flag and a reason for every unavailable tool. This is the inspection surface for declared-but-unavailable behavior. Calling an unadvertised name returns the existing unknown-tool JSON-RPC error and cannot consume a mutation capability.

No controlled mutation tool is currently operational. In particular, `projector.apply_transform` directly writes without the required transaction coordinator, writer lease, journal, and capsule-operation intersection. This slice removes that unsafe advertisement and does not issue a mutation capability. A later lifecycle slice may advertise a controlled tool only after its handler uses the governed transaction path and derives allowed operations from the approved capsule.

The shallow built-server wrapper is deleted. The generic server remains the deep module: explicit handlers in, schema-bearing registry and sanitized JSON-RPC behavior out.

## Compatibility

- All 21 specified names remain canonical and inspectable.
- Read and controlled input-schema shapes remain unchanged.
- Existing operational tool behavior and JSON-RPC result shapes remain unchanged.
- `tools/list` intentionally narrows to operational tools. This is the required correction to the characterized baseline.
- No mutation capability is issued while the operational controlled map is empty.

## Acceptance

1. A sessionless built composition lists exactly the three operational repository reads.
2. An authenticated composition lists those reads and both representation tools only when its capsule carries a valid representation reference.
3. Status accounts for all 21 canonical names with truthful availability.
4. An unadvertised call fails as unknown and performs no controlled mutation.
5. No mutation capability is issued for the current composition.
6. Read and controlled schemas retain their existing public shapes.
7. Installed plugin and packed-release MCP paths assert the exact narrowed operational list.

## Authority

- [Host and MCP Integration](../../../PROJECTOR_SPEC/08-agents/hosts-and-mcp.md)
- [Projector north star](../../../NORTH_STAR.md)
