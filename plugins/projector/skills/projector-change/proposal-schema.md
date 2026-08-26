# Strict change proposal

This guide and [change-proposal.schema.json](change-proposal.schema.json) are generated from the strict `ChangeProposalSchema` exported by `@projector/core`. Do not edit either generated file by hand.

Write one JSON document that validates against the generated schema. Unknown top-level or nested fields fail closed. Repository paths must be canonical, repository-relative, non-reserved paths. Exact edits cannot overlap independent validators. Requirement, scenario, alias, validator, and architecture-deferral constraints are enforced by the same core parser used by the installed lifecycle.

Validate the proposal by passing it to `projector change <request> --proposal <path>`. A proposal is interpretation evidence, not approval or mutation authority.
