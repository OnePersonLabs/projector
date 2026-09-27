# Glossary

These terms describe Projector 4's workflow. Exact runtime fields and operations are in the [runtime reference](reference/runtime.md).

| Term | Meaning |
| --- | --- |
| Requirement | An observable behavior the software must provide, with scenarios that clarify it. |
| Capability | The project-specific path used to organize requirements. |
| Concern design | A document that owns an implementation responsibility and explains its contract, decisions, and realization. |
| Decision | An implementation choice with a reason, alternatives, and tradeoffs. |
| Realization binding | A reference to the code or supporting artifact that implements a design contribution. |
| Applicability | The declared population to which a requirement or design obligation applies. |
| Selector | A bounded executable query for paths, units, dependencies, or another supported population. |
| Delta | A proposed addition, modification, removal, or rename against accepted requirements or designs. |
| Change | A named proposed unit of work containing a proposal, deltas, and tasks. |
| Baseline | The pinned Git revision against which a prepared change is interpreted. |
| Target | The exact proposed requirements and design that implementation must satisfy. |
| Source checkout | The repository working directory containing the authored change. |
| Managed candidate | The enrolled implementation checkout and identity; optional isolated mode uses a linked worktree. |
| Contribution | A part of actual implementation that is accounted for when the target changes. |
| Evidence basis | The input identity to which an executed check or review applies. |
| Independent review | An attributed examination by a separate reviewer of the actual target and implementation. |
| Observation checkpoint | An independent boundary that qualifies a managed candidate's observed state. |
| Mutation batch | An acknowledged cooperating edit interval used by managed observation. |
| Working-current | A conditional observed view of a managed candidate; pending or unavailable state cannot return a purported current payload. |
| Historical revision | An explicitly requested immutable Git revision, separate from working-current observation. |
| Sync | Materialize the target requirements and design in the candidate without archive or publication. |
| Finish | Verify completion, archive, and integrate reviewed code and authority together. |
| Publication | Conditional branch advancement and recoverable checkout/index installation of the reviewed commit. |
| Integration | Landing a reviewed result on the selected branch; finish includes this, while merge handles another selected source branch. |
| Settled no-op | Repeating a completed operation reuses its exact result without a substantive document or code change. |
| Skill invocation | A request to the host agent to follow a named workflow, such as `$projector:propose`. |
| CLI operation | A terminal request to the deterministic runtime, such as `openRoot --json ...`. |

Start with [the overview](overview.md) to see these relationships, or [skill invocations](skills.md) to choose an action.
