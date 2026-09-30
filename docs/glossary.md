# Glossary

**Accepted meaning**: Canonical project intent and rationale stored under `.projector/`.

**Assimilation topic note**: A Markdown unit in the `.assimilate/` working synthesis. It is not a Projector record.

**Canonical record**: One authored Projector fact with stable identity and its schema-defined content and relationships.

**Concept**: An accepted domain boundary or capability with a stable ID. In the [clip use example](examples/clip-use.md), `concept:clip` owns shared notes reused by arrangements.

**Context packet**: A task-specific bounded retrieval of accepted meaning, with disclosure about selection, omissions, and unknowns.

**Context ID**: The actual identifier for retained context that Projector can resume or check.

**Controlled write**: A Projector-managed canonical mutation with a reviewed plan, exact state checks, and retained recovery evidence.

**Currentness**: Whether the dependencies and source evidence bound to retained context still match the observed repository state.

**Identity**: A stable identifier stored with a canonical record. The filename is only its path.

**Requirement**: An accepted obligation that governs behavior. `requirement:independent-transposition-per-use` says each use of a clip has its own transpose value and reload preserves it.

**Scenario**: An observable case that tests an obligation. `scenario:two-uses-of-one-clip-save-reload` uses one C4 clip twice; the uses play C4 and D4 before and after reload.

**Open query**: A source query whose result does not prove complete absence when it finds no matching source.

**Reconciliation**: Investigation of how changed source, dependencies, assumptions, or query membership affect retained meaning.

**Source query**: A declared query that binds accepted meaning to relevant source locations or constructs.

**Typed relationship**: A schema-defined edge between records, such as a requirement demonstrated by a scenario.

**Working synthesis**: The complete assimilation-owned set of index, topic notes, intake, and frontier. It may be durable without being accepted Projector meaning.

Continue with [Concepts](concepts.md) or the [documentation home](README.md).
