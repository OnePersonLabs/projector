# Evaluation engineering

**Evidence status:** consolidated research and practitioner guidance. Specific historical paper results and tool-status claims remain in the dated reference catalogue; the principles here are the design implications to test in use.

## Distinguish the objects

A metric is one measurement. A deterministic test asserts a property. An application eval combines inputs, success criteria, a captured run, and a grader. A benchmark standardizes a protocol for comparison. A strong public benchmark score is not evidence that an application satisfies its own goals.

Executable checks provide a strong oracle where the desired property can actually be expressed and observed. Tests are still a finite specification and can be wrong, incomplete, leaked, or gameable. “Tests are the spec” must not erase intent that the tests fail to capture.

## Begin with actual failure and purpose

Define a small number of meaningful outcomes, then collect representative inputs and expected behavior. Curate generated examples rather than treating them as automatic ground truth. Inspect real failures to discover which criteria matter.

Separate outcome, process, presentation, and efficiency. Grade an exact tool sequence only when that sequence is itself required; otherwise permit a different valid route to the same result.

A wrong answer can follow the right tool call. A right answer can arise from an invalid process. Multi-turn behavior may fail even when individual turns look acceptable.

## A layered evaluation stack

Use cheap deterministic assertions for exact properties. Add grounded model judgments for semantic or subjective questions. Reserve human judgment for ambiguous intent, high-consequence cases, and evaluator calibration.

Assess retrieval relevance, source support, answer relevance, tool effects, and final state separately when diagnosing failures. A single overall score can hide which layer is broken.

Capability cases explore what the system cannot yet do. Regression cases protect established behavior. Conflating the two can make a low capability score look like a release regression or a stable regression suite look like evidence of frontier capability.

## Reliability and statistics

“At least one of several attempts succeeds” measures something different from “all repeated attempts succeed.” Under an illustrative independent per-run success probability of 0.7, three attempts give about 0.973 probability of at least one success and 0.343 probability that all succeed. Real attempts need not be independent.

Report sample count, uncertainty, repeated trials, and task-family structure. Use paired comparisons when conditions share tasks. Related prompts and branches should not be counted as independent evidence merely because they occupy different files.

Confidence statements need calibration. Proper scoring rules such as Brier score or log loss address a different question from raw accuracy; a single calibration statistic does not establish useful uncertainty handling.

## Judge the judge

Model graders can be sensitive to order, verbosity, familiar style, and shared model preferences. Randomize or counterbalance order where appropriate, ground judgments in explicit criteria, and compare against independent human labels or executable truth.

Inspect false positives and false negatives. More reported issues are not automatically better review. A cheap grader that invents problems can create expensive repair and review loops.

Temperature settings, a larger model, or a carefully written rubric do not by themselves establish evaluator validity.

## Integrity and leakage

Separate development examples from held-out evaluation, including semantic families and near-duplicates. Inspect access to reference answers, environment artifacts, hidden tests, and prior traces. Do not permit a system to pass by reading the target or bypassing the intended work.

Public datasets may be contaminated. Private tests can also leak through repeated optimization. Rotate or refresh meaningful holdouts and inspect whether improvements reflect actual behavior or adaptation to the scoring surface.

A malformed harness, ambiguous requirement, or incorrect grader can dominate the result. Debug the evaluation system rather than attributing every failure to model capability.

## Production closes the loop

Capture enough trace to connect the original input, intermediate decisions, tool effects, output, and human correction. A correction can reflect an agent error, a changed preference, unsupported product behavior, or expected workflow variation. Classify it before turning it into a target.

Group recurring failures, create representative evaluation cases, investigate the responsible layer, make a scoped change, and run targeted plus regression checks. Retain the evidence that distinguishes a real product improvement from a flattering demo.

The supplied Tax AI case study reports practitioner corrections becoming structured findings and Codex engineering tasks. It reports 7,000 pilot returns and an increase from roughly one quarter to 86% of returns reaching at least 75% correct field completion over six weeks. These are case-study measurements of a particular workflow, not universal extraction accuracy or a clean isolated estimate of Codex's causal contribution. Task mix and product changes matter.

## Tooling is secondary to the contract

Choose the smallest tooling that versions data, captures runs, applies checks, and supports comparison. Offline evaluation, production tracing, retrieval diagnostics, and research benchmarking are distinct needs. A dashboard does not substitute for an oracle.

The catalogue preserves tool candidates and historical license or maintenance claims. Recheck those claims before adopting a dependency. Projector does not need two platforms merely because a survey grouped tools into two categories.

**Continue:** [annotated catalogue](catalogue/INDEX.md) for specific research leads; [evidence and review](../concepts/evidence-and-review.md) for Projector's authority boundaries.
