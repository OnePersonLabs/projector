---
projectorDesign: 1
id: projector/documents
scope: src/documents
---
# Authored meaning and addresses

## Contract

The documents module extracts file-level Markdown and JavaScript/TypeScript records, resolves bracket addresses and populations, and applies exact addressed design deltas. It performs no filesystem watching, agent invocation or implementation repair. A resolved address identifies meaning; it does not prove that implementation conforms to it.

Applies: [[spec:projector/documents#Exact references]] | {"kind":"path","root":".","prefix":"src/documents/"} | One normalizer and resolver own all default and qualified address rules.
Applies: [[spec:projector/documents#Exact design deltas]] | {"kind":"path","root":".","prefix":"src/documents/"} | Design mutations preserve untouched bytes and validate the exact prior state.
Applies: [[spec:projector/documents#Explicit semantic limits]] | {"kind":"path","root":".","prefix":"src/documents/"} | Unknown extraction and topology must remain explicit through query results.

## Decision: established-parsers

Choice: Use mdast for Markdown structure, YAML for bounded frontmatter, TypeScript for source parsing and module resolution, and a pinned Unicode case-folding implementation.
Reason: Ad hoc text matching cannot establish Markdown nesting, language declarations, package exports or Unicode equivalence reliably.
Requires: [[spec:projector/documents#Exact references]] [[spec:projector/documents#Explicit semantic limits]]
Consequential: dependency
Alternative: Regular expressions and path-extension guessing.
Tradeoff: Parser dependencies increase installation bytes. File extraction, bounded dependency closure and cached records avoid recurring full-project programs.
Realizes: [[code:src/documents/index.ts]] [[code:src/documents/code.ts]] [[code:src/documents/markdown.ts]] [[code:src/documents/resolver.ts]] [[code:src/documents/common.ts]]
Evidence: Document tests cover Unicode normalization, duplicate owners, logical aliases, nested headings, package boundaries and unsupported topology.

## Decision: exact-part-splices

Choice: Compute a complete final design from addressed operations and byte ranges, with exact baseline and retry receipts.
Reason: Ambiguous edits and whole-document formatting passes obscure the intended semantic change.
Requires: [[spec:projector/documents#Exact design deltas]]
Consequential: strategy
Alternative: Reprint the whole Markdown tree or apply prose instructions directly.
Tradeoff: Renames need an explicit binding mapping and conflicting operations are rejected rather than assigned implicit precedence.
Realizes: [[code:src/documents/delta.ts]]
Evidence: Document tests exercise overlapping operations, stale baselines, untouched formatting and exact retries.
