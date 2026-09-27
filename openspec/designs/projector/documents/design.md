---
projectorDesign: 1
id: projector/documents
scope: src/documents
---
# Authored meaning and addresses

## Contract

The documents module extracts Markdown, source, markup, styles, configuration, and framework records, resolves domain-specific addresses and repository relationships, and applies exact addressed design deltas. It performs no filesystem watching, agent invocation or implementation repair. A resolved address identifies meaning; it does not prove that implementation conforms to it.

Applies: [[spec:projector/documents#Exact references]] | {"kind":"path","root":".","prefix":"src/documents/"} | One normalizer and resolver own all default and qualified address rules.
Applies: [[spec:projector/documents#Exact design deltas]] | {"kind":"path","root":".","prefix":"src/documents/"} | Design mutations preserve untouched bytes and validate the exact prior state.
Applies: [[spec:projector/documents#Explicit semantic limits]] | {"kind":"path","root":".","prefix":"src/documents/"} | Unknown extraction and topology must remain explicit through query results.
## Decision: established-parsers

Choice: Keep mdast, YAML, TypeScript, and Unicode case folding for their existing contracts. Use the pinned Tree-sitter WASM package for C#, Rust, and Python; parse5 for HTML; PostCSS, postcss-scss, and postcss-selector-parser for styles; fast-xml-parser and toml for supported project configuration. Initialize providers asynchronously and preserve synchronous extractFile compatibility.
Reason: Ad hoc text matching cannot establish Markdown nesting, language declarations, package exports or Unicode equivalence reliably.
Requires: [[spec:projector/documents#Exact references]] [[spec:projector/documents#Explicit semantic limits]]
Consequential: dependency
Alternative: Regular expressions and path-extension guessing.
Tradeoff: Published parsers increase installation bytes and require compatible grammar adapters. Pin dependencies and adapter identity; initialize once per worker, cancel bounded parsing, delete trees after extraction, and test installed assets.
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

## Decision: composed-intelligence

Choice: Build an asynchronous createDocumentIntelligence service with one primary and additive supplemental providers, explicit capability completeness, and stable provider fingerprints.
Reason: Syntax extraction, repository resolution, and cross-domain relationships have different evidence and completeness boundaries.
Requires: [[spec:projector/documents#Composed document providers]] [[spec:projector/documents#Useful language resolution]] [[spec:projector/documents#Explicit semantic limits]]
Consequential: boundary
Alternative: Add extension switches and framework special cases throughout the kernel.
Tradeoff: Providers centralize incomplete semantics but require explicit conflict checks, repository facts, and adapter/cache versioning. Built-ins compose in source; no repository provider manifest or dynamic loading is introduced.
Realizes: [[code:src/documents/providers.ts]] [[code:src/documents/queries.ts]] [[code:src/documents/types.ts]] [[code:src/documents/index.ts]] [[code:src/documents/resolver.ts]] [[code:test/provider-intelligence.test.ts]] [[code:test/provider-cold.test.ts]]
Evidence: Provider tests exercise native-language declarations, project/module resolution, ambiguity, dynamic unknowns, primary conflicts, supplement order, and installed grammar assets.

## Decision: domain-specific-framework-facts

Choice: Keep markup, styles, framework styles, configuration, and framework occurrences in qualified artifact domains. Supplement source facts with static Tauri registration/invocation and React Native style/platform/native/configuration relationships.
Reason: A style name or frontend declaration cannot establish code-symbol ownership or native runtime wiring.
Requires: [[spec:projector/documents#Exact references]] [[spec:projector/documents#Framework relationships]]
Consequential: strategy
Alternative: Treat non-code occurrences as bare symbols and infer native registration from declarations.
Tradeoff: Static relationships are useful but dynamic wrappers, macro expansion, and native integration remain explicit incomplete boundaries.
Realizes: [[code:src/documents/providers.ts]] [[code:src/documents/common.ts]] [[code:src/documents/resolver.ts]]
Evidence: Tests distinguish registered commands from declarations, resolve supported injected invokes, identify static style composition, and keep unproven native bindings unknown.

## Decision: byte-identity-and-derivation

Choice: Expose metadataFile and raw-byte inventory for every tracked artifact, retain semantic text only within parsing budgets, and parse explicit Generated records on owning decisions.
Reason: Binary banks and generated outputs need ownership without being decoded or mistaken for semantic proof.
Requires: [[spec:projector/documents#Universal artifact inventory]] [[spec:projector/changes#Generated contribution provenance]]
Consequential: boundary
Alternative: Decode every file as UTF-8 and reject all files larger than the parser budget.
Tradeoff: Byte metadata cannot resolve text symbols by itself. Relevant generation inputs and output identity must be checked through current execution evidence.
Realizes: [[code:src/documents/providers.ts]] [[code:src/documents/markdown.ts]] [[code:src/index/worker.ts]]
Evidence: Inventory tests include oversized binary assets, changed generated inputs, retired producers, and scoped unknown provenance.
