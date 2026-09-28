# Projector V3: Multi-Language Semantic Code Graph Handoff

## Purpose

This document captures the technical conclusions from a discussion about whether Codex uses ASTs/code graphs, whether Projector should use a graph database, and how Projector V3 should evolve to support rich multi-language repository intelligence across TypeScript/JavaScript, Python, Rust, C/C++, Java-family languages, C#, and others.

The key conclusion changed after inspecting the actual `OnePersonLabs/projector` **`v3` branch**:

> Projector V3 already contains most of the higher-level graph, relevance, provenance, query-binding, and scoped invalidation architecture that would otherwise need to be invented.  
> The main missing capability is a rich, language-neutral semantic code-intelligence ingestion layer.

The recommended direction is therefore:

> **Use SCIP as the language-neutral semantic interchange layer, compiler/language-server-backed indexers per language, Tree-sitter as a lower-assurance fallback, and feed those results into Projector’s existing graph/query/impact architecture.**

A graph database may still be useful as a derived index or optional visualization/debugging backend, but it should **not** become Projector’s canonical source of truth.

---

# 1. Original Question: Does Codex Use ASTs / Tree-sitter / Code Graphs?

The discussion began with whether Codex itself maintains a persistent semantic model of a repository.

The useful mental model was:

- Codex does use AST-ish / Tree-sitter-style parsing in some internal contexts.
- That does **not** imply that vanilla Codex maintains a persistent compiler-grade semantic graph of an entire repository.
- Codex generally reasons over code it has discovered through file search, reads, grep/ripgrep-style navigation, tests, language tooling, connectors, and whatever repository-intelligence tools are exposed to it.
- Therefore, a repository-local semantic graph can substantially improve the questions Codex is able to ask.

The motivating shape was:

```text
repo
  ↓
semantic extraction
  ↓
symbols / imports / references / calls / inheritance / tests
  ↓
persistent derived index
  ↓
small deterministic query interface
  ↓
Codex
```

The important principle was:

> Don’t merely give the agent more files. Give it better questions it can ask about the repository.

---

# 2. Initial Substrate Comparison

The discussion compared these possible code-intelligence substrates:

| Substrate | Syntax | Types | Symbol resolution | Cross-file refs | Persistent | Multi-language | Best role |
|---|---:|---:|---:|---:|---:|---:|---|
| Tree-sitter | Excellent | No | Limited | Limited | If added | Excellent | Structural fallback |
| LSP | Excellent | Excellent | Excellent | Excellent | Usually no | Excellent | Precision query interface |
| SCIP | Excellent | Compiler/indexer dependent | Excellent | Excellent | Yes | Excellent | Persistent semantic interchange |
| TS Compiler / Language Service | Excellent | Excellent | Excellent | Excellent | In-memory/cacheable | TS/JS only | TS semantic authority |
| LSIF | Good | Good | Good | Good | Yes | Multi-language | Older persistent format |

### Tree-sitter

Strengths:

- fast incremental parsing
- resilient to broken/incomplete files
- huge language coverage
- useful for structure, declarations, imports, syntax-pattern extraction

Weakness:

- syntax is not semantics
- it cannot reliably resolve which `save()` method, imported alias, implementation, or indirect call a syntax node refers to

### LSP

Strengths:

- definition
- references
- implementation
- type definition
- call hierarchy
- workspace symbols
- diagnostics
- rename

Weakness:

- query-oriented, not naturally a durable graph store
- awkward for repeated transitive graph traversal
- can force the agent into many sequential calls to reconstruct topology

### SCIP

Strengths:

- designed as a language-neutral code-intelligence index
- represents symbols, definitions, references, implementations, relationships
- persistent
- suitable as a common interchange format across different language-specific semantic engines

### TypeScript compiler / language service

Excellent semantic authority for TS/JS, but unsuitable as the architectural center if Python, Rust, C++, Java, etc. are first-class requirements.

---

# 3. Why a Graph Database Looked Attractive

The graph-DB question came up because the intended queries are naturally graph-shaped:

```text
changed symbol
→ transitive callers
→ owning packages
→ runtime-observed tests
→ interfaces implemented
→ generated artifacts
→ historical failures
→ architectural boundaries
→ likely blast radius
```

Cypher-style traversal is pleasant for this class of question.

For example:

```cypher
MATCH (s:Symbol {fqName: $symbol})
MATCH p=(s)<-[:CALLS|REFERENCES|IMPLEMENTS|IMPORTS*1..4]-(dependent)
OPTIONAL MATCH (t:Test)-[:OBSERVED_EXECUTION]->(dependent)
RETURN dependent, t, length(p)
```

The initial instinct was that Memgraph or Neo4j Community could be useful because:

- both provide graph-native traversal
- Neo4j Community is free/self-hosted
- Memgraph Community is free/self-hosted
- graph visualization is valuable
- the repository-intelligence problem is genuinely graph-shaped

However, that recommendation changed after inspecting Projector V3.

---

# 4. What Projector V3 Already Contains

Inspection focused on the actual `OnePersonLabs/projector` repository, branch `v3`.

Important files inspected:

```text
README.md
package.json

packages/analyzers/src/local-repository.ts
packages/analyzers/src/typescript/facts.ts
packages/analyzers/src/typescript/semantic-index.test.ts
packages/analyzers/src/topology/index.ts
packages/analyzers/src/topology/repository.ts

packages/control-plane/src/knowledge/graph.ts
packages/control-plane/src/knowledge/store.ts
packages/control-plane/src/knowledge/types.ts
packages/control-plane/src/impact/service.ts
packages/control-plane/src/knowledge/realizations.ts
packages/control-plane/src/observation/change-query.ts

packages/engine/src/query/index.ts
packages/engine/src/relevance/index.ts
packages/engine/src/invalidation/index.ts

packages/core/src/domain/contracts.ts
packages/core/src/observation.ts

.projector/model/requirements/determine-relevance-before-choosing-edits.md
.projector/model/requirements/reuse-knowledge-with-scoped-invalidation.md

.projector/model/scenarios/contract-topology-discovers-consumers.md
.projector/model/scenarios/event-topology-discovers-non-obvious-consumers.md
.projector/model/scenarios/relevance-is-not-impact.md
```

## Architectural shape already present

Projector V3 already has:

```text
canonical meaning
      ↓
relations
      ↓
projection units
      ↓
repository observation
      ↓
topology
      ↓
relevance closure
      ↓
derivation graph
      ↓
impact closure
      ↓
scoped invalidation
```

This is not a blank slate.

Projector already distinguishes:

- accepted meaning
- repository observations
- relevance
- impact
- derivation dependencies
- query dependencies
- observability
- assurance
- unknowns
- scoped invalidation
- rebuildable derived state

That is the correct conceptual skeleton.

---

# 5. Existing Graph Abstraction

Projector already defines a graph abstraction in `packages/core/src/domain/contracts.ts`:

```ts
export interface GraphReader {
  getConcept(id: EntityId): Concept | undefined;
  getRequirement(id: EntityId): Requirement | undefined;
  getBehavioralScenario(id: EntityId): BehavioralScenario | undefined;
  getProjectionUnit(id: EntityId): ProjectionUnit | undefined;
  getRelations(id: EntityId, direction: "in" | "out" | "both"): Relation[];
  reverseDerivationDependents(subjectId: EntityId | string): EntityId[];
  getDerivationInputs(unitId: EntityId): DerivationInput[];
  querySelectorDependencies(selectorHash: ContentHash): EntityId[];
  searchSemanticIdentities(
    query: string,
    kinds?: Array<"concept" | "requirement" | "scenario">
  ): EntityId[];
}
```

And the engine currently supplies:

```text
InMemoryGraphReader
```

Its own documentation describes it as:

> A deterministic, bounded graph primitive for adapters, tests, and small repositories.

That means the seam for a more scalable derived graph implementation already exists conceptually.

---

# 6. Crucial Finding: Current “TypeScript Semantic” Analysis Is Not Compiler-Grade

The most important repo-specific finding:

`packages/analyzers/src/typescript/facts.ts` is a **custom lexer/token-based analyzer**.

The analyzer package itself does not depend on the TypeScript compiler API.

The declared analyzer capability includes:

```text
projector.typescript-semantic
```

but its own capability description says its observation method is:

```text
bounded static syntax inventory
```

and its blind spots include:

```text
full TypeScript type semantics
computed event and contract names
dynamic module resolution
```

The current JS/TS analyzer is useful, deterministic, and deliberately no-exec, but it is not equivalent to:

- TypeScript `Program`
- `TypeChecker`
- language-service symbol resolution
- compiler-backed references
- compiler-backed implementation relationships

So the current Projector source intelligence is closer to:

```text
JS / TS
   ↓
useful custom syntax-level facts

Python / Rust / Go / C++ / ...
   ↓
file-level observation
   ↓
unsupported dependency semantics / uncertainty
```

This is the highest-leverage place to improve V3.

---

# 7. Explicit Multi-Language Requirement

The desired system should support as many languages as practical, explicitly including:

- TypeScript / JavaScript
- Python
- Rust
- C / C++
- Java / Kotlin / Scala
- C#
- others where possible

This means **the TypeScript compiler should not become Projector’s architectural center**.

Instead, Projector needs a language-neutral semantic interchange layer.

---

# 8. Recommended Semantic Backbone: SCIP

The revised recommendation is:

> **Use SCIP as Projector’s common semantic code-intelligence interchange format.**

Conceptually:

```text
                       REPOSITORY
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
         TS              Python             Rust
          │                │                 │
   scip-typescript    scip-python     rust-analyzer
          │                │                 │
          └────────────────┼─────────────────┘
                           │
                          SCIP
                           │
                 Projector SCIP adapter
                           │
                 normalized code facts
                           │
                 ┌─────────┴─────────┐
                 │                   │
            symbol graph       Projector units
                 │                   │
                 └─────────┬─────────┘
                           │
                    Knowledge Graph
                           │
                     Impact Engine
```

Typical language lanes:

```text
TypeScript / JavaScript → scip-typescript
Python                  → scip-python / Pyright
Rust                    → rust-analyzer SCIP support / scip-rust wrapper
C / C++                 → scip-clang
Java / Kotlin / Scala   → SCIP Java-family tooling
C# / VB                 → SCIP .NET tooling
```

SCIP becomes the **lingua franca**, while language-specific engines remain responsible for actual semantics.

---

# 9. Tree-sitter Still Has an Important Role

Do **not** discard Tree-sitter.

Use it as the fallback lane for:

- languages without suitable SCIP/compiler indexers
- partially broken code
- syntactic structure
- comments/docstrings
- config/template languages
- very cheap structural pre-indexing
- unsupported or incomplete semantic situations

But Projector should preserve the difference in evidence quality.

Example:

```text
compiler-backed SCIP definition edge
    sourceClass: derived
    assurance: validated/exact-ish
    observability: bounded/closed depending on indexer

Tree-sitter inferred call
    sourceClass: derived
    assurance: heuristic

dynamic reflection/import
    observability: open

failed semantic indexer
    observability: unavailable
```

Projector’s existing assurance/observability model is unusually well suited to this.

---

# 10. Preserve the Canonical vs Derived Boundary

Do **not** dump every source symbol into Projector’s canonical accepted-meaning graph.

Preserve the existing philosophical separation.

Recommended model:

```text
             PROJECTOR CANONICAL GRAPH

 Concept ──requires──► Requirement
    │
    │ REALIZED_BY
    ▼
 ProjectionUnit

================================================
              derived observation boundary
================================================

 ProjectionUnit
       │
       ├── CONTAINS ──► Symbol
       │                  │
       │                  ├── CALLS ──► Symbol
       │                  ├── REFERENCES ──► Symbol
       │                  ├── IMPLEMENTS ──► Symbol
       │                  └── TYPE_OF ──► Symbol
       │
       └── VERIFIED_BY ──► Test
```

Top half:

- accepted meaning
- durable authored records
- concepts
- requirements
- scenarios
- decisions
- governance

Bottom half:

- rebuildable repository reality
- symbols
- references
- call edges
- imports
- implementations
- tests
- runtime evidence
- derived dependency facts

This keeps Projector’s strongest design invariant intact.

---

# 11. Projection Units Should Remain, But Symbols Should Become Finer-Grained Analysis Units

Current Projector behavior is strongly file-oriented.

Once compiler-grade semantic indexing exists, use two levels:

```text
ProjectionUnit = mutation / ownership / governance unit

CodeSymbol = semantic analysis / dependency / impact unit
```

Example:

```text
packages/foo/src/service.ts
        │
        └── ProjectionUnit
              │
              ├── contains → FooService
              │                 │
              │                 ├── method → save()
              │                 └── method → load()
              │
              └── contains → createFoo()
```

Impact can then work symbol-first:

```text
changed lines
     ↓
changed symbols
     ↓
semantic graph traversal
     ↓
affected symbols
     ↓
owning ProjectionUnits
     ↓
Projector impact rules
     ↓
requirements / scenarios / tests
```

That gives substantially finer precision than file-level import propagation.

---

# 12. Revised View on Neo4j / Memgraph

After inspecting V3, the recommendation changed.

## Do not make Neo4j/Memgraph the canonical Projector substrate

Reasons:

Projector explicitly values:

- readable canonical project artifacts
- rebuildable derived state
- host independence
- deterministic query semantics
- bounded observation
- explicit state/query bindings
- scoped invalidation
- provenance

A graph database should not become the source of truth for those concepts.

The canonical `.projector/` records should remain authoritative.

## A graph database can still be useful as derived infrastructure

Potential roles:

- large derived symbol/reference graph
- exploratory traversal
- visualization
- debugging
- human inspection
- optional backend behind a graph/index abstraction

Neo4j-style usage could be excellent for optional exploration:

```cypher
MATCH p =
  (r:Requirement)
  -[:REALIZED_BY]->(:ProjectionUnit)
  -[:CONTAINS]->(:Symbol)
  <-[:CALLS*1..5]-(caller)
RETURN p
```

That would be very useful for humans and diagnostics.

But Codex does not need unrestricted Cypher as its normal interface.

---

# 13. Why Projector Query Programs Are Better for Codex Than Raw Cypher

Projector already has versioned query programs that can bind:

- what query was performed
- the query semantics
- the state it depended on
- the prior result
- whether the result can be rebound
- observability
- assumptions
- unavailable lanes

This is extremely valuable.

Arbitrary raw Cypher would lose some of that structure.

The agent-facing layer should therefore remain something like:

```text
projector query callers <symbol>
projector query impact <symbol>
projector query implementations <symbol>
projector query tests <symbol>
projector query neighborhood <symbol> --depth 3
```

or their existing QueryProgram equivalents.

Internally, those queries may be satisfied by:

- in-memory maps
- SQLite
- Neo4j
- another graph engine

but Projector should preserve its versioned semantic query boundary.

---

# 14. Recommended Persistence Strategy

The current `InMemoryGraphReader` is appropriate for small canonical graphs but will become less attractive if Projector ingests hundreds of thousands of symbol/reference edges.

Recommended shape:

```text
GraphReader
     │
     ├── InMemoryGraphReader
     │
     └── IndexedGraphReader
```

For the default installed plugin, **SQLite is still a strong default** because:

- it is local
- embeddable
- no daemon
- no Docker requirement
- easy plugin distribution
- sufficient for indexed adjacency and recursive traversal
- works well for rebuildable derived state

For example, derived tables might be:

```sql
symbols(
  id,
  language,
  fq_name,
  kind,
  file,
  start_line,
  end_line,
  provenance,
  assurance
)

edges(
  source,
  target,
  kind,
  provenance,
  assurance,
  evidence_hash
)

files(
  path,
  hash,
  language
)
```

Indexes should support:

- source → outgoing edges
- target → incoming edges
- symbol lookup
- file → symbols
- symbol → owning ProjectionUnit
- test → observed symbols
- semantic identity / stable key lookup

Neo4j/Memgraph may still be optional alternative/export backends.

---

# 15. Runtime/Test Evidence Is a High-Leverage Extension

The semantic graph becomes significantly more useful if it includes runtime or test observations.

Example edge classes:

```text
STATICALLY_REFERENCED_BY
CALLED_BY
IMPORTED_BY
IMPLEMENTED_BY
OBSERVED_DURING_TEST
FAILED_WITH
CHANGED_IN
```

Then targeted-test selection becomes:

```text
changed symbols
      ↓
static impact graph
      +
historical test execution graph
      ↓
minimal high-confidence test set
```

This directly supports the desired testing workflow:

```text
proposed change
      ↓
semantic affected-symbol closure
      ↓
existing affected tests
      ↓
agent independently proposes expected tests
      ↓
diff those sets
      ↓
write/modify tests
      ↓
implementation
      ↓
targeted verification
```

This is one of the strongest downstream payoffs of the semantic graph.

---

# 16. Projector’s Existing Requirements Already Support This Direction

The V3 model already contains explicit ideas aligned with this architecture:

- pre-edit relevance
- event topology discovering non-obvious consumers
- public contract topology discovering consumers
- relevance is not impact
- scoped invalidation
- reuse of unaffected knowledge
- unknown/open populations remain unknown
- exact derivation dependencies before broader heuristic impact
- repository observations are bounded and provenance-aware

This means the semantic-code-graph work should be framed as:

> **improving repository observation and semantic dependency evidence**

not:

> replacing Projector’s conceptual model.

---

# 17. Recommended End-State Architecture

```text
                    ACCEPTED MEANING
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
     Concepts        Requirements         Decisions
        │                 │                  │
        └─────────────────┼──────────────────┘
                          │
                    Realization bindings
                          │
                    Projection Units
                          │
══════════════════════════╪════════════════════════════
            REBUILDABLE OBSERVED REALITY
                          │
                  semantic code index
                          │
             ┌────────────┴────────────┐
             │                         │
            SCIP                  Tree-sitter
       high assurance                 │
             │                   fallback facts
             └────────────┬────────────┘
                          │
                      CodeGraph
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
    DEFINES             CALLS            REFERENCES
    IMPORTS          IMPLEMENTS            TESTS
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                indexed derived store
                    SQLite default
                          │
                          ▼
                    GraphReader
                          │
                          ▼
               versioned QueryPrograms
                          │
          ┌───────────────┴────────────────┐
          │                                │
     Relevance Closure                Impact Closure
          │                                │
          └───────────────┬────────────────┘
                          ▼
                         Codex
```

---

# 18. Recommended Technology Choices

| Layer | Recommendation |
|---|---|
| Cross-language semantic interchange | **SCIP** |
| TypeScript / JavaScript | **scip-typescript** |
| Python | **scip-python / Pyright** |
| Rust | **rust-analyzer SCIP support / scip-rust wrapper** |
| C / C++ | **scip-clang** |
| Java / Kotlin / Scala | **SCIP Java-family tooling** |
| C# / VB | **SCIP .NET tooling** |
| Unsupported languages | **Tree-sitter fallback** |
| Canonical Projector data | existing human-readable `.projector/` model |
| Semantic derived facts | rebuildable index |
| Default persistence | SQLite / indexed local store |
| Optional graph visualization | Neo4j or Memgraph export/adapter |
| Agent interface | Projector QueryPrograms / deterministic CLI surface |
| Impact granularity | symbols first, then owning ProjectionUnits |
| Test intelligence | combine static semantic graph + runtime test evidence |

---

# 19. Suggested Implementation Direction for Codex

Codex should **not** immediately rewrite V3 around a new graph database.

A better staged design task:

## Phase A: Define a language-neutral semantic observation model

Introduce types roughly like:

```ts
interface CodeSymbolFact {
  id: string;
  language: string;
  kind: string;
  name: string;
  fullyQualifiedName?: string;
  path: string;
  range: SourceRange;
  semanticIdentity: string;
  assurance: TopologyAssurance | equivalent;
  evidenceIds: string[];
}

interface CodeRelationFact {
  fromId: string;
  toId: string;
  kind:
    | "contains"
    | "defines"
    | "references"
    | "calls"
    | "imports"
    | "exports"
    | "implements"
    | "extends"
    | "overrides"
    | "type-of"
    | "tests";
  assurance: string;
  evidenceIds: string[];
}
```

Do not overfit exact names yet.

## Phase B: Add a semantic-index adapter seam

Something like:

```text
SemanticCodeIndexer
  ├── SCIPSemanticIndexer
  └── TreeSitterFallbackIndexer
```

The rest of Projector should consume normalized language-neutral facts.

## Phase C: Add SCIP ingestion

Start with:

1. TypeScript/JavaScript
2. Python
3. Rust

These three provide strong proof that the model is genuinely language-neutral.

## Phase D: Map symbols to ProjectionUnits

Preserve file/project ownership and mutation boundaries while gaining symbol-level impact precision.

## Phase E: Integrate semantic edges into impact snapshots

Current `RepositoryImpactSnapshot` is heavily unit/file oriented.

Extend it carefully so semantic dependencies participate in:

- reverse dependency traversal
- known affected sets
- possible frontiers
- observability/unknown reporting

Do not let semantic similarity become exact impact authority.

## Phase F: Add persistent derived indexing

Only after the normalized graph model is correct.

Possible first implementation:

```text
IndexedGraphReader backed by SQLite
```

Keep it replaceable.

## Phase G: Optional Neo4j/Memgraph export

Useful for:

- visual exploration
- debugging
- graph inspection
- architecture analysis

Do not make it mandatory for normal plugin operation.

---

# 20. Important Design Guardrails

1. **Do not make language-specific compiler APIs leak into Projector core.**

   SCIP or another normalized semantic-fact boundary should isolate them.

2. **Do not promote derived code symbols into canonical accepted meaning automatically.**

   They are rebuildable observations.

3. **Preserve assurance and observability.**

   Compiler-backed fact, Tree-sitter heuristic, runtime observation, and model inference are not equivalent.

4. **Keep relevance separate from impact.**

   This is already a V3 invariant.

5. **Keep the graph database replaceable.**

   The graph semantics matter more than the storage engine.

6. **Do not expose raw Cypher as the primary Codex API.**

   Preserve Projector QueryPrograms and their dependency/version semantics.

7. **Use symbol-level analysis without destroying ProjectionUnit-level governance.**

8. **Prefer semantic facts over filename/path heuristics when reliable semantic evidence exists.**

9. **Unknown/open-world situations must remain explicit.**

10. **Runtime evidence should supplement, not overwrite, static semantic truth.**

---

# 21. Core Reassessment

The biggest change in thinking after inspecting V3 is this:

### Before inspecting V3

The architecture looked like it needed:

```text
AST / semantic extraction
→ graph DB
→ query layer
→ Codex
```

### After inspecting V3

Projector already has the upper three-quarters of the system:

```text
accepted meaning
→ graph abstractions
→ relevance
→ query binding
→ derivation
→ impact
→ invalidation
→ Codex integration
```

So the missing piece is much narrower:

```text
compiler-grade multi-language semantic repository observation
```

That suggests:

> **Do not build a new graph system beside Projector. Upgrade Projector’s repository-observation layer into a language-neutral semantic code-intelligence layer.**

---

# 22. Final Recommendation

For Projector V3:

> **SCIP + compiler/language-server-backed language indexers + Tree-sitter fallback + Projector’s existing provenance/relevance/impact machinery + a replaceable indexed derived store.**

Default persistence can remain local/embedded.

Neo4j/Memgraph should be treated as optional graph projection/exploration infrastructure unless concrete scale measurements prove they should become the primary derived index.

The conceptual centerpiece should remain Projector itself.

The cleanest summary:

> Projector already knows how to reason about meaning, relevance, impact, and stale knowledge.  
> Give it a compiler-grade, multi-language semantic nervous system rather than inventing another brain next to it.
