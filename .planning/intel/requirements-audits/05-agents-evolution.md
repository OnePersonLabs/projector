# Requirements Audit — Agents and Evolution

## Scope

Audited `.planning/intel/requirements-parts/05-agents-evolution.md` against:

- `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md`
- `PROJECTOR_SPEC/08-agents/orchestration-and-models.md`
- `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md`
- `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md`
- `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md`

The review covered host/MCP operations and capability bindings; logical roles,
routing, validation independence, authority, completion, model-provider
contracts, exact request/response types and role literals, replay/cache and
promotion rules; modernization triggers/decision machinery; surface adapter
types and optional mutation methods; snapshot pinning; SQLite tables, revision
atomicity, rebuild and upgrade behavior; analyzer stages/capabilities/no-exec
and partial-failure behavior; required analyzer products and rollout order;
historical/metamorphic evaluation; research triggers, source priority,
provenance, freshness, and offline behavior; conditions, exceptions, order,
non-goals, and source-heading coverage.

## Result

- **135/135** requirement entries were checked (all have a `Source:` locator).
- **0** duplicate IDs; every prefix is contiguous from `001` through its
  current maximum (`AGNT-017`, `EVOL-018`, `HOST-018`, `MCP-006`,
  `MODEL-021`, `OBSV-019`, `PERS-015`, `RSCH-008`, `SURF-013`). No new ID was
  needed after the audit fixes.
- **9** precision/coverage defects were fixed in the fragment; no requirement
  was deleted or renumbered.
- All five referenced source files exist. The source files contain **5 H1s,
  38 H2s, and 0 H3 headings**. The `## Projector` heading is inside the
  generated-instruction example code block; it remains documented as
  context/example-only in the source-coverage table.
- Source coverage rows account for every H1/H2 heading. Normative source
  clauses are represented by the v1, locked-constraint, or explicit-non-goal
  entries; grouping headings are explicitly marked `CONTEXT`.

## Fixes applied

| Priority | Evidence | Fix and risk reduction |
|---|---|---|
| High | The `SurfaceAdapter` contract in `modernization-and-surfaces.md:62-76` declares exact field types and method signatures. The prior SURF-002/003 only said “matching the source type contract.” | SURF-002/003 now carry `id: string`, `Surface["kind"]`, `SurfaceCapabilities`, `EnumerationContract`, all required method parameter/result types, and the three optional mutation signatures. This prevents adapter implementations from silently drifting from the contract. |
| High | `orchestration-and-models.md:77-120` specifies concrete `StructuredModelRequest<T>` and `StructuredModelResponse<T>` field types/optional markers. | MODEL-005/007 now preserve those exact types (`ContentHash`, `RiskAssessment`, `ExecutionCapsule`, `Record<string, unknown>`, `T`, `number`, and optional `?` fields), with MODEL-005/006 carrying the exact role literal union. This closes schema/provider compatibility ambiguity. |
| Medium | `persistence-and-observation.md:7-31` lists exact logical table names, including `behavioral_scenarios`, `semantic_identity_resolutions`, `relevance_closures`, and `planning_surprises`. | PERS-001 now reproduces the complete source list rather than converting several names to loose prose. This protects persistence-schema coverage. |
| Medium | `persistence-and-observation.md:101-113` requires inventory of ownership/instruction files and their untrusted treatment. | OBSV-006 now includes ownership/instruction files in the discovery list (with untrusted-data qualification); OBSV-007 retains the explicit MUST treatment rule. |
| Medium | `historical-evaluation-and-research.md:18-20` limits possible-band seeding to relationships that repeatedly connect semantic neighborhoods unexplained by deterministic topology. | EVOL-011 now preserves both the repeated-connection condition and the semantic-neighborhood target, preventing over-broad historical adjacency. |
| Medium | `orchestration-and-models.md:137-141` says candidate output is accepted **into canonical state** only at the promotion boundary. | MODEL-013 now retains the canonical-state destination, preventing inferred output from being mistaken for merely accepted metadata. |
| Medium | `modernization-and-surfaces.md:53` identifies the linked Progressive Architecture Commitment document as the decision-governance machinery source. | EVOL-007 now retains the canonical `PROJECTOR_SPEC/03-knowledge/architecture-decisions.md` path without introducing a relative-link dangling reference. |
| Medium | `historical-evaluation-and-research.md:29-38` scopes the architecture-concern trigger to a material decision whose **viable options** depend on current external facts. | RSCH-001 now preserves both “decision” and “viable options,” avoiding an over-broad research trigger. |
| Low | `persistence-and-observation.md:91-97` enumerates package scripts, build tools, generated-code commands, **or** tests as execution-gated items. | OBSV-003 now preserves the source’s disjunctive “or tests” list. |

## Coverage and semantic checks

- Host capability names, three integration levels, wrapper stage order,
  capability-bound mutation rules, read-first/mutation MCP operation names,
  root-digest rebinding exception, and secret/context policy are all present
  in HOST-001–015 and MCP-001–006.
- All 14 logical roles and their source-table purposes are covered by
  AGNT-001–006; provider neutrality and silent-authority limits are captured
  by AGNT-016/017.
- Routing’s eight factors, four-level default hierarchy, deterministic-first
  representation rule, validation evidence fields/causal independence,
  authority restrictions, and completion contract are covered by
  MODEL-001–003 and AGNT-007–015.
- Request/response types, all 13 model role literals, typed provider method,
  cache-key dimensions, bounded retry/explicit failure, candidate promotion,
  and fake/recorded-provider test boundary are covered by MODEL-004–015.
- Modernization’s 12 triggers, 13 recommendation fields, all six rejection
  conditions, decision-governance reuse, surface contracts/signatures,
  rollout order, snapshot pinning/invalidation, and open-world frontier rule
  are covered by EVOL-001–007 and SURF-001–013.
- Persistence table inventory, canonical authority/rebuild invariant, graph
  revision and journal-phase atomicity, schema/version migration obligations,
  and recovery behavior are covered by PERS-001–015.
- Initialization stage order, analyzer capability declarations, no-exec gate,
  partial-failure widening, deterministic inventory, semantic adapter products,
  rollout sequence, clustering/outlier handling, bounded model context, and
  pre-serialization redaction are covered by OBSV-001–019 and MODEL-016–019.
- Historical/metamorphic checks, exogenous/endogenous separation,
  possible-band restriction, Planning Surprise signal, uncertainty reporting,
  research trigger conditions/source priority/provenance/freshness, and
  offline lower-authority behavior are covered by EVOL-008–018 and RSCH-001–008.

## Residual risk and validation

- This was a document-to-document audit; no runtime host, MCP, adapter,
  SQLite, model-provider, or research integration was available to execute.
- The generated `## Projector` example is intentionally classified as
  illustrative context in the coverage table. Its six instruction themes are
  already represented by the wrapper, MCP capability, validator/completion,
  transform, and authority requirements; if the example is later promoted to
  a normative contract, it should receive new HOST IDs after HOST-018.
- The main residual risk is implementation drift from the now-explicit type
  signatures and from canonical SQLite/table naming. Follow-up should add
  contract tests for `SurfaceAdapter`, `StructuredModelRequest/Response`, and
  rebuild/schema migration checks before claiming runtime conformance.
