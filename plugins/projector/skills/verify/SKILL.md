---
name: verify
description: Verify a Projector implementation against its requirements and designs with executed checks and independent review before completion.
---

Read [the runtime contract](../apply/references/runtime.md).

1. Recover the selected candidate and inspect the current target, actual diff, tasks, applicability, and previous contributions. Reconcile authority/task edits before gathering final evidence.
2. Choose checks that discriminate the changed behavior, affected integration, and any removed architecture. Run required repository checks and focused realistic tests, using `recordEvidence({root,change,command,args,scope,timeoutMs})`. Scope lists exact affected paths the check meaningfully covers, not an arbitrary blanket population.
3. Inspect real outcomes. Failed checks need a causal fix or a precise blocker. Any subsequent implementation/task change can stale evidence; revalidate and rerun affected checks against the final basis.
4. Obtain a real independent reviewer through a native subagent or separate reviewer environment. Supply current target, actual diff, contribution dispositions, and executed evidence. Ask for missing concerns, unsupported retained structure, counterexamples, and the strongest simpler alternative. Never simulate independence or invent review provenance.
5. Call `validatePlan` with `review:{basis,reviewer,examined,alternative,findings}`. Use the current returned basis; record unresolved findings faithfully. Resolve findings, obtain review of material fixes, and refresh evidence when its basis changed.
6. Report checks actually run, failures/unverified behavior, and review provenance. Verification alone does not archive. Continue to $projector:finish only when that action is authorized.

Completion: current executed evidence and an attributed independent review support the current implementation, or explicit obligations prevent completion.
