# Representation Acceptance Scenarios

## Representation semantic-fidelity rejection

Create a canonical hard rule equivalent to: `MUST_NOT delete production data unless explicit user approval`. Generate a compact representation that says `Avoid deleting production data without approval`. Also seed cases where `A iff B` becomes `A when B`, and `exactly one` becomes `one or more`.

Expected: style/token compression may look good, but protected-dimension validation rejects each weakened/changed representation. The canonical rule remains untouched. A valid compact form may use a deterministic machine-invariant encoding such as `FORBID delete-production-data EXCEPT explicit-user-approval` when the normalized kernel can prove equivalence.


## Cross-projection consistency

Compile the same canonical semantic scope through `human-technical@1`, `agent-compact@1`, and `machine-invariant@1`.

Expected: texts/structures may differ substantially, but all valid projections bind to the same source semantic hash and compatible preservation fingerprints. Textual similarity is not required. Editing one derived rendering does not mutate the source semantic model. Reconciliation either regenerates it or treats an intentional semantic edit as a normal proposed semantic change.


## Net-negative compact-context fallback

Provide an already-terse Execution Capsule where the compact profile's own instructions/tokenizer overhead exceed its expected output savings.

Expected: the Context Compiler selects the source/less-compressed representation instead of paying extra tokens to say the same thing more tersely. A later larger capsule may select compact mode when measured net cost becomes favorable without lowering required fidelity.


## Representation-profile invalidation

Change only `agent-compact@1` to a new version while canonical concepts, rules, decisions, and predicates remain unchanged.

Expected: affected agent-context projections/capsules become suspect and regenerate. Human/machine projections that do not depend on the changed profile remain valid. Canonical semantic source hashes and architecture decisions do not dirty merely because the encoding profile changed.



## Authoritative specification human-technical conformance

Run the specification checker against `SPEC.md`, `INDEX.md`, and every authoritative module.

Expected:

- blocking `human-technical@1` errors are zero.
- prose linting does not rewrite code blocks or exact technical literals.
- passive-voice and nominalization heuristics remain review signals when a deterministic rewrite could change meaning.
- the style gate does not claim semantic equivalence or truth.


## Compact context preserves critical tokens and avoids false compression

Compile agent context that contains negation, scope limits, ordering, exact code symbols, paths, API names, numbers, units, and a standard acronym.

Seed a candidate compact rendering that drops narration but also invents prose abbreviations or weakens one protected semantic dimension.

Expected:

- the profile removes nonessential narration and repeated explanation when host policy permits it.
- exact technical literals, numbers, units, and protected semantic dimensions remain unchanged.
- invented prose abbreviations are rejected unless measured token savings justify them and clarity remains acceptable.
- the compiler uses a less compressed representation when compact output becomes ambiguous, semantically weaker, or net-negative after profile overhead.
