# Evaluation-driven practice

**Dated source annotations, not fresh verification.** Read the [catalogue status](INDEX.md) before relying on numerical or product claims.

[Catalogue index](INDEX.md) · [Research map](../INDEX.md)

<a id="m-2"></a>

## M-2

**Braintrust (2026). [VENDOR]** *What is eval-driven development: How to ship high-quality agents without guessing*. braintrust.dev (Feb 18, 2026). <https://www.braintrust.dev/articles/eval-driven-development>

**Consolidated identifiers:** M-2, M-3.

A vendor framing of eval-driven development as a release discipline: define desired behavior, optimize, refine, and gate changes with versioned cases and criteria. The source discusses golden sets and judge drift. One repeated source annotation attaches a detailed qualitative error-analysis procedure to this same URL; that procedure is retained under M-4, where the archive supplies its specific methodological reference, rather than counted as independent support here. Platform-specific recommendations are vendor claims, not a requirement to use that platform.

<a id="m-4"></a>

## M-4

**Hamel Husain & Shreya Shankar (2026). [PRACTITIONER]** *Evals: Doing Error Analysis Before Writing Tests / error-analysis FAQ*. hamel.dev (errata in evals-faq, May 5 2026 for the dedicated error-analysis FAQ). <https://hamel.dev/blog/posts/evals-faq/why-is-error-analysis-so-important-in-llm-evals-and-how-is-it-performed.html>

**Consolidated identifiers:** M-4, M-8.

Build the first useful evaluation set from real traces. A domain expert writes observations through open coding, groups them into a failure taxonomy through axial coding, counts recurring problems, and iterates until further sampling yields few new categories. An LLM can help organize notes without replacing the initial inspection. Source-time suggestions about starting with at least 100 traces or observing about 20 without a new category are heuristics, not general sample-size or statistical-saturation guarantees.

<a id="m-7"></a>

## M-7

**Zoya Bylinskii (n.d.). [PRACTITIONER/POSITION]** *Evals are the new unit tests*. Medium. <https://medium.com/@zoya.gavr/evals-are-the-new-unit-tests-2c91f51399d6>

Practitioner essay crystallizing the slogan that anchors the TDD analogy (a unit test checks a specific behavior; an eval checks a probabilistic one). Useful as a citation for the meme itself; lighter on empirical rigor, so treat as position/framing rather than evidence.

<a id="m-10"></a>

## M-10

**LangChain / LangSmith (2025-2026). [VENDOR]** *LangSmith: Evaluation: Continuously improve agents*. langchain.com. <https://www.langchain.com/langsmith/evaluation>

Vendor articulation of the "agent reliability loop": trace every run → turn real failures into datasets → run repeatable experiments with evaluators (plus humans) → promote only the best versioned changes. Frames offline dataset evals as "unit tests for your LLM application" run in CI to catch regressions. Relevance: concrete EDD tooling workflow; treat capability claims as vendor-sourced.

<a id="m-11"></a>

## M-11

**Microsoft (2026). [VENDOR]** *Observability in Generative AI: Microsoft Foundry* (and "Evaluate your AI agents"). learn.microsoft.com (updated Jun 2, 2026). <https://learn.microsoft.com/en-us/azure/foundry/concepts/observability>

Official docs that explicitly recommend treating evaluation "like test-driven development": each new capability/bug/failure mode adds a test case so the dataset grows with the agent. Three eval modes: on-demand, event-driven (CI/CD on every change or sampled prod traffic), scheduled (drift detection): plus acceptance thresholds (e.g., 85% task adherence) and binary-from-threshold grader scoring. Strong vendor evidence for CI/regression and the TDD framing.

<a id="m-12"></a>

## M-12

**Vitor Sousa (2025). [PRACTITIONER]** *Beyond the Vibe Check: A Systematic Approach to LLM Evaluation*. vitorsousa.com (Nov 5, 2025). <https://www.vitorsousa.com/blog/beyond-the-vibe-check-a-systematic-approach-to-llm-evaluation/>

Best single source for the "vibe check → eval suite" maturity progression: stages from subjective spot-checks → code-based deterministic checks → single-pass LLM judge → calibrated systematic eval (weekly human sampling, monthly Cohen's κ ≥0.60, statistical before/after). Explicitly defines EDD as writing evals before building, with transition triggers (e.g., automate once evaluating >100 outputs). Synthesizes others' numbers (0.30-0.60 judge-human agreement) so cross-check against M-17.

<a id="m-13"></a>

## M-13

**Kent Beck (2003) / Martin Fowler. [POSITION: analogy anchor]** *Test-Driven Development by Example* (Beck, 2003); *Test Driven Development* bliki (Fowler). martinfowler.com. <https://martinfowler.com/bliki/TestDrivenDevelopment.html>

The original TDD red-green-refactor rhythm (write a failing test; make it pass minimally; refactor) that every "evals are the new unit tests" claim borrows from. Included as the historical anchor so the analogy is grounded in the primary source rather than secondhand. Limit: about deterministic software, hence the partial-fit caveat threaded through M-2/M-3.

<a id="m-14"></a>

## M-14

**Hamel Husain & Shreya Shankar (2026). [PRACTITIONER]** *LLM Evals: Everything You Need to Know (FAQ)*. hamel.dev (Jan 15, 2026). <https://hamel.dev/blog/posts/evals-faq/>

Comprehensive FAQ that both endorses evals-as-practice and *pushes back on literal EDD*: "writing evaluators before implementing features… creates more problems than it solves: write evaluators for errors you discover, not errors you imagine." Reinforces binary over Likert, custom over generic, and 20-50-trace review cadence. Critical for the nuanced anti-pattern bullet: the spec-first ideal must be tempered by error-analysis-first reality.

<a id="m-15"></a>

## M-15

**(survey of recent literature, 2024-2025). [EMPIRICAL]** *Generator-Verifier Gap*: e.g., "UQ: Assessing Language Models on Unsolved Questions" (arXiv:2508.17580) and related verification-dynamics work. <https://arxiv.org/abs/2508.17580>

Evidence for the asymmetry underpinning EDD: verification is generally easier than generation, validation accuracy improves faster than generation accuracy as models scale, and verifiers can be weaker than frontier generators yet still flag errors. This is the theoretical "why" for using evals/verifiers as the spec. Caveat: I retrieved this via aggregated search summaries of multiple arXiv papers rather than reading each in full: treat the specific framing as well-supported but verify individual paper claims before quoting numbers.

<a id="m-16"></a>

## M-16

**OpenAI: Kwatra, Wimberly, Marker, Siegel (2025). [VENDOR/EMPIRICAL]** *Eval-Driven System Design: From Prototype to Production* (receipt inspection). OpenAI Cookbook (Jun 2, 2025). <https://developers.openai.com/cookbook/examples/partners/eval_driven_system_design/receipt_inspection>

A worked, end-to-end EDD case study: build a V0 skeleton, design graders against expert-labeled ground truth, tie eval metrics to dollar impact, and improve via measured iteration. Worked: discovered merchant-name extraction at 15% accuracy was *irrelevant* (zero correlation with the final audit decision), so they de-prioritized it: a vivid example of evals redirecting effort. Also demonstrates step-conditioned evaluation and prototype→production progression. Among the most concrete EDD walkthroughs available.

<a id="m-17"></a>

## M-17

**Eugene Yan (2024). [PRACTITIONER/EMPIRICAL survey]** *Evaluating the Effectiveness of LLM-Evaluators (aka LLM-as-Judge)*. eugeneyan.com (Aug 18, 2024). <https://eugeneyan.com/writing/llm-evaluators/>

Survey of ~two dozen papers on LLM-judges. Supplies the hard numbers behind the "validate your judge" anti-pattern: GPT-4 ~85% agreement with experts on MT-Bench but only 0.3-0.6 correlation on summarization; position bias (50-70% first-position preference), verbosity bias (>90% prefer longer), self-enhancement (~10% own-output bump); finetuned judges fail out-of-domain. Conclusion: judges are cost-effective supplements, not replacements for human judgment. Essential calibration evidence for any eval loop using model graders.

## Related records housed elsewhere

- [M-1: canonical F-15](foundations.md#f-15)
- [M-5: canonical A-1](agents.md#a-1)
- [M-6: canonical J-9](judges.md#j-9)
- [M-9: canonical J-14](judges.md#j-14)
- [M-18: canonical F-12](foundations.md#f-12)
