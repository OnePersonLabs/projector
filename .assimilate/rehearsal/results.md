# Rehearsal result -- budget stop

The user stopped the evaluation for quota reasons before a paired result. This is an early termination, not a Projector-domain correctness finding.

## Completed evidence

| Arm | Completed work | Result |
|---|---|---|
| OpenSpec baseline | C1, C2, C3, and fixed independent review | C1: 23 tests, build, strict OpenSpec, browser exercise. C2: 27 tests and focused provenance browser exercise. C3: 32 tests, build, strict OpenSpec, focused Evidence-register browser exercise. Review: 78/80, `hard_fail: false`, 7/7 held-out oracle groups. |
| Projector candidate | C1 only | Build, strict typecheck, and 33 tests passed. Browser evidence observed gesture audio, preview isolation, recognition, and reload; later background-browser failures left pointer/replay/layout unproved. C2, C3, candidate review, and the required Projector-aware actual-diff review did not run. |

The baseline’s C3 pre-source dependency-delta commit is `3bd0496`; final C3 commit is `4b3c588`. Its independent report is external `logs/review-final.md`. Candidate C1 is preserved in host-side commit `13384af`; baseline C1 used the same host-side checkpoint mechanism in `e13bd32` after its participant sandbox could not create `.git/index.lock`.

## Candidate blocker observed

In the candidate participant sandbox, `projector context` returned `Projector: context: spawn EPERM`, and a valid `projector accept` capture returned `Projector: change.capture: spawn EPERM`. The later `projector check --json` returned `incomplete` with `spawn EPERM`. No context ID, preview hash, approval, or accepted canonical record exists. Exact invocation/result and the unaccepted proposal are retained in the candidate `REHEARSAL_CONTEXT.md`, `REHEARSAL_CHECKS.md`, `founding-proposal.json`, and `logs/checkpoint-1.jsonl`.

This is an environment-policy result in the restricted Codex participant process. Fresh release checks succeeded outside that sandbox, and the user’s normal environment is danger-full-access. It therefore does not prove Projector unusable in the user’s ordinary session. It does mean this trial established no installed Projector advantage for context, semantic acceptance, or post-change checking.

## Cost record

All reported input accounting is substantial and must not be treated as an output-only pass.

Cached input is a subset of input, not an additional amount to add to it. These
figures describe participant/reviewer sessions only. Parent integration,
redesign, model maintenance and auxiliary worker usage are not fully available
here, so they are not a complete campaign cost or a quota percentage. The
unfinished arms also make a cost-effectiveness ratio inappropriate.

| Run | Wall time | Input / cached / output |
|---|---:|---:|
| Baseline C1 | 24m57s | 3,616,608 / 3,490,944 / 37,137 |
| Baseline C2 | 9m31s | 1,244,311 / 1,057,408 / 14,130 |
| Baseline C3 | 8m21s | 1,124,490 / 1,024,768 / 13,456 |
| Baseline review | 4m41s | 508,207 / 425,216 / 7,894 |
| Candidate C1 | 22m46s | 1,838,702 / 1,736,064 / 36,930 |

Baseline C1 exceeded its original total-token ceiling. C2 and C3 met the later wall-time ceiling but exceeded the 12,000 generated-token target. Candidate C1 met its later 40,000 generated-token target but not a low total-accounting expectation. Exact logs remain in the external workspaces.

## Limits of the comparison

This small slice does not test a large codebase with a large specification set,
where Projector's intended context and consequence-management value could matter
most. The user therefore redirected work to finishing the software, without
further comparison runs. These observations establish integration successes and
failures, not a general winner. Do not restart evaluation without new direction.
