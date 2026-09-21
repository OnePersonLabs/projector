# Fixed independent-review rubric

Use this unchanged for baseline and candidate. The evaluator receives the completed isolated repository, command logs, participant-visible briefs, and hidden oracle. It must not receive the arm name, implementation transcript, or a claimed score.

## Procedure

1. Read each historical `REHEARSAL_CONTEXT.md`; confirm the checkpoint 3 dependency-delta commit precedes application-source edits.
2. Run documented headless tests/build and exercise the public facade with the oracle scenarios. Inspect browser-preview observation but do not call it acoustic certification.
3. Trace each material edge in code: producer module → persisted representation/codec → consumer module. Cite one concrete location for each edge and test.
4. Score against the oracle. Do not repair implementation.

## Scorecard

| Dimension | Score | Rule |
| --- | --- | --- |
| Applicable meaning | 0--26 | Two points for O1--O13 when relevant checkpoint retrieval identifies it and final behavior supports it; one for only one. |
| Unknown discipline | 0--6 | Two points each for U1--U3 when output/behavior keeps it unknown. Deduct two for every invented capability claim. |
| Producer/persistence/consumer trace | 0--12 | Four points each for evidence/update, audio provenance, and register edges when code, persistence, consumer, and test are all traceable. |
| Coupled-change reasoning | 0--8 | Four points each for follow-ons when the pre-edit report predicts affected edges/tests and implementation supports it. |
| Materialization/retrieval | 0--8 | Default report is compact, cited, and separates unavailable from false; a fresh reader can answer relevant facts without transcript dump. |
| Verification/recovery | 0--8 | Oracle scenarios/tests/build pass; actual browser limits are honest; no unavailable result is relabeled proof. |

Report `hard_fail: true` for any disqualifying oracle error. Also report default-context word count, durable artifact count outside dependencies/build output, human-stopping events, failed recovery attempts, and unavailable measurements.

## Persistent-specialist-knowledge probe

Before checkpoint 3 edits, score the fresh agent's fixed eight-answer report: player vs system-preview vs replay provenance; evidence/update ownership; exactly-once key; early interruption; durable-before-update recovery; restart/replay preservation; unknown-origin treatment; audio limit. Require correct answer or explicit unknown plus a repository/retained-context citation. This tests retained project knowledge, not trained weights or a learning system.

An independent agent can measure source traceability and bounded reader experience. It cannot prove human comprehension or hear browser audio. Same evaluator model, prompt, and input cap apply to both arms.
