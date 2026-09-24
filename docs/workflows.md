# Workflows

Invoke a skill explicitly or ask your agent to use Projector in ordinary language.

| You want to… | Use |
| --- | --- |
| Set up a repository | `$projector:init` |
| Explore an idea or investigate a problem | `$projector:explore` |
| Draft a complete proposal | `$projector:propose` |
| Draft one artifact at a time | `$projector:propose` and request incremental planning |
| Resume drafting or implementation | `$projector:continue` |
| Revise the plan after implementation starts | `$projector:revise` |
| Implement the accepted plan | `$projector:apply` |
| Check work without archiving | `$projector:verify` |
| Preview specs and designs in the candidate | `$projector:sync` |
| Verify and archive | `$projector:finish` |
| Finish several selected changes | `$projector:finish` with the change names |
| Find mismatches between documents and code | `$projector:audit` |
| Recover existing edits or repair task drift | `$projector:reconcile` |

## Explore, then decide

Exploration reads code and discusses alternatives without implementing. When ready, request a proposal. Ask for incremental planning to review one artifact at a time, or ask continue to complete the remaining draft.

## Authorize the whole run

> Use Projector to fix duplicate replay. Draft the plan, implement it, run the checks, and finish it.

This authorizes the full workflow. Material ambiguity still needs your input. Otherwise, proposal pauses for review.

## Synchronize without finishing

Sync makes the planned requirements and designs visible inside the isolated candidate. It does not update the accepted branch or archive. Revisions afterward invalidate affected checks and review.

## Complete several changes

Name the changes, or explicitly request all eligible changes. The agent checks dependencies and overlapping requirements/designs, then reports completed and blocked changes separately.

A dependent change needs a baseline containing its prerequisite's result. Bulk finish does not silently merge branches or treat a published sibling branch as integrated.

## Audit and reconcile

Audits distinguish definite mismatches from unverified behavior. Reconciliation turns findings or existing edits into coherent artifacts. Corrected task checkboxes do not substitute for executed evidence.
