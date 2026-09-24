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
| Integrate a finished branch | `$projector:merge` with the source branch |
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

A dependent change needs a baseline that contains its prerequisite result. Bulk finish does not silently merge branches or treat a published sibling branch as integrated.

## Integrate a finished branch

Merge selects one source branch and targets the branch checked out in your original working directory. The target must be clean and attached. Projector pins both commits, constructs the merge on a temporary branch in a linked worktree, runs applicable checks, and obtains an independent adversarial review before it advances the target.

Projector resolves a conflict only when repository evidence supports one coherent result. If a product or ownership choice remains, the original target stays unchanged. You receive one brief that explains the affected behavior, each branch intent, the available choices and their consequences. A changed or dirty target blocks publication instead of being repinned automatically.

## Audit and reconcile

Audits distinguish definite mismatches from unverified behavior. Reconciliation turns findings or existing edits into coherent artifacts. Corrected task checkboxes do not substitute for executed evidence.
