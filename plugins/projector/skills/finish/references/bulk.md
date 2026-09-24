# Finish several selected changes

Bulk completion coordinates ordinary single-change finish; there is no special bypass API.

1. Resolve the explicit set. “All” means the active set you enumerate and report, excluding archives. Read each proposal, target, state, tasks, prerequisite declarations, and actual candidate diff.
2. Build a dependency order and compare touched requirement names, design IDs/parts, and implementation paths. A cycle, incompatible target, ambiguous selection, or conflicting ownership blocks the affected subset. Finish independent safe members without claiming the whole batch succeeded.
3. A prerequisite is usable only when its published commit is an ancestor of the dependent candidate's baseline. Merely finishing the prerequisite does not update an already-pinned dependent baseline. For dependent new changes, prepare on the published prerequisite commit through prepareChange's baseline argument. For existing candidates with an incompatible pinned baseline, preserve work and report a scoped reconstruction need; do not reset or secretly repin lifecycle state.
4. Overlapping changes on separate candidates can each archive against their own baselines yet still conflict when integrated. Check this explicitly. Do not silently choose the newest requirement, union contradictory designs, or combine independent candidate branches.
5. For each compatible change, follow $projector:verify then the single-change finish procedure. Maintain separate root/change, candidate identity, target, basis, evidence, and review records. Never reuse one candidate's evidence for another.
6. Report per-change result: finished with branch/archive, blocked with exact reason, or not attempted because of a dependency. Partial success is not atomic batch success. The user's working branch remains untouched until separately authorized integration.

Completion: every selected member has a truthful outcome, dependencies and overlaps are accounted for, and settled finished changes pass the no-op repeat.
