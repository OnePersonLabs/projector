# OpenSpec workflow replacement map

Projector replaces the local `opl-openspec` user workflow while retaining bundled OpenSpec requirement semantics.

| Previous capability | Projector owner |
| --- | --- |
| Explore | `$projector:explore` |
| New change; propose; fast-forward | `$projector:propose`, incremental or complete |
| Continue artifact creation | `$projector:continue` |
| Update a change | `$projector:revise` |
| Apply | `$projector:apply` |
| Verify | `$projector:verify` |
| Sync without archive | `$projector:sync`, specs and designs in the candidate |
| Archive; end-to-end finish | `$projector:finish` |
| Bulk archive | `$projector:finish` with explicit selection/dependency checks |
| Semantic audit | `$projector:audit` |
| Reverse tasks | `$projector:reconcile` task mode |
| Reverse uncommitted edits | `$projector:reconcile` patch mode |
| Repository setup | `$projector:init` |

Sync targets the candidate instead of changing accepted requirements ahead of implementation. Finish owns validation, archive, and candidate publication; there is no second generic archive pipeline.

Skills share artifact and lifecycle procedures. Review precedes implementation by default; explicit end-to-end requests authorize continuation. OpenSpec stores and cross-repository scheduling remain outside the qualified local runtime.
