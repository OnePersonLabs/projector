# Strict change proposal

This guide and [change-proposal.schema.json](change-proposal.schema.json) are generated from the strict `ChangeProposalSchema` exported by `@projector/core`. Do not edit either generated file by hand.

Write one JSON document that validates against the generated schema. Unknown top-level or nested fields fail closed. Repository paths must be canonical, repository-relative, non-reserved paths. Exact edits cannot overlap independent validators. Requirement, scenario, alias, validator, and architecture-deferral constraints are enforced by the same core parser used by the installed lifecycle.

Validate the proposal by passing it to `projector change <request> --proposal <path>`. A proposal is interpretation evidence, not approval or mutation authority.

Existing requirement and scenario identities preserve their canonical payload without a rewrite when their title and meaning are unchanged. To revise existing meaning, supply `revision` with its stable `id`, current `expectedSemanticHash`, and a concrete `rationale`. Missing, mismatched, stale, and no-op revisions fail. Identity aliases locate existing meaning; they do not authorize renaming it. The plan's `preview.intentReview` shows preserved, added, and revised commitments plus related canonical obligations, including targets without current code. These checks do not prove that tests cover every commitment or that an implementation preserves the whole design.
