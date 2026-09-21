# Archive workflow: external memory before agent multiplication

**Purpose:** turn a large, partly duplicated body of conversation and research into a concept-oriented Markdown workspace without loading it all into any one context.

**Execution status:** this delivered pack was produced by one assistant using archive inspection, indexing, exact-overlap scripts, bounded source reads, and editorial synthesis. It was not run as a Luna/Astra subagent benchmark. The workflow below describes how to implement the same division of work with native agents when available.

## The work shape

```text
Session model/effort and spending policy
                   +
Goal, corpus inventory, runtime capabilities
                   ↓
Deterministic inspection and source addressing
                   ↓
Shared-passage map and bounded evidence packets
                   ↓
Concept claims and unresolved distinctions
                   ↓
Cross-source reconciliation, by concept
                   ↓
Canonical pages and explicit frontier
                   ↓
Coverage, link, duplication, and fidelity checks
                   ↓
Progressive-disclosure Markdown pack
```

The initial inventory is a map, not the corpus itself. A large archive should first generate small information that determines the next useful reads.

## Mechanical intake

Validate the archive, reject unsafe extraction paths, and inventory file names, sizes, hashes, encoding, structure, and available timestamps. Assign stable source identifiers and original line ranges.

Detect empty, malformed, and unsupported material early. Do not spend a model call interpreting an empty file or treating unrelated scraped content as the article named by its title.

For this archive, there are 38 Markdown files and 177,664 whitespace-delimited words before cleaning. Two files lack usable substantive content. The complete inventory and definitions are in the [processing report](../audit/PROCESSING.md).

## Deduplicate at several levels

File hashes remove exact file duplicates. Normalized turn hashes identify copied messages when boundaries align. Rolling word fingerprints locate long copied passages even when wrappers and paragraph boundaries differ.

These methods identify exact reuse, not semantic equivalence. Shared text establishes a common passage; it does not by itself establish the ancestry or date order of whole conversations.

Preserve divergent suffixes and any scope-changing conditions. Use within-conversation order and explicit acceptance or correction as evidence. Where cross-branch supersession is not established, retain alternatives rather than invent a latest answer.

## Extract claim packets, not generic summaries

A bounded interpretation job should return claims or distinctions with source addresses, applicability conditions, status, relationships, and unresolved questions. It should not rewrite the whole file into a long summary.

Example result contract:

```text
Topic: materialization freshness
Claim: a plan depends on query membership, not only edited-file hashes
Condition: previously absent or newly introduced consumers affect retirement
Status: design requirement/proposal, not observed implementation proof
Evidence: stable source ID and original line range
Related concepts: impact, invalidation, materialization
Open question: which analyzers provide sufficiently complete membership?
```

Store the full packet outside the parent context. Return a small receipt with the artifact address, status, coverage interval, and exceptions. Exact bookkeeping belongs in a script, not in repeated model narration.

## Repartition before synthesis

Extraction may start from source ranges because that makes coverage inspectable. Synthesis should be partitioned by meaning. A concept such as freshness may appear across architecture, context delivery, learned-model updates, and refactoring sources.

Do not give every file an independent summarizer and then ask one parent to merge 38 long summaries. That recreates the context problem and repeats shared trunks.

Workers may process independent topic bundles. A reconciliation owner handles cross-topic contradictions and shared definitions. It reads the disputed evidence, not every worker's entire transcript. Tightly coupled decisions remain together even when source files differ.

## Keep state small and recoverable

A temporary manifest can track packet basis, covered source ranges, output handles, unresolved issues, and completion state. It need not become a permanent framework or repository verification ledger.

Use content hashes and source revisions to avoid redoing unchanged extraction. Re-run interpretation when governing conditions change, not merely because a file was renamed. Preserve enough provenance to revisit a consequential judgment.

Checkpoint canonical pages as they become coherent. The durable output is the conception and frontier; worker scratch and execution traces can remain disposable unless needed for audit.

## Verify the transformation

Mechanical checks can verify file accounting, reachable pages, working local links, exact repeated passages, accidental chat markers, missing referenced files, and package integrity.

Semantic checks require contrasting claims against source evidence. Sample high-consequence distinctions and specifically inspect rejected alternatives, changed premises, ambiguous chronology, and cases where compression could erase rationale.

A coverage map establishes where each source's material went. It does not prove that every nuance survived. Exact duplicate elimination does not prove semantic deduplication. Compression ratio is not a fidelity score.

## Model routing within this workflow

In a Luna-selected session, use tools for the mechanical stages and bounded Luna interpretation where supported and useful. Different effort levels can address different residual uncertainties without silently installing an Astra root.

Use sequential processing when tool support or coordination economics favor it. Use a small parallel pool when independent work earns the overhead. A worker does not need to be a recursive orchestrator to protect the parent's context.

Escalate only a specific unresolved conceptual knot, and only with the user's permission to cross the spending policy. A pile containing millions of easy-to-index words does not automatically justify a stronger model; one subtle contradiction might.
