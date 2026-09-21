# Retrieval and production evaluation

**Dated source annotations, not fresh verification.** Read the [catalogue status](INDEX.md) before relying on numerical or product claims.

[Catalogue index](INDEX.md) · [Research map](../INDEX.md)

<a id="r-1"></a>

## R-1

**Es, S., James, J., Espinosa-Anke, L., Schockaert, S. (2023). [EMPIRICAL]** *RAGAS: Automated Evaluation of Retrieval Augmented Generation*. arXiv:2309.15217 (EACL 2024 demo). <https://arxiv.org/abs/2309.15217>

Introduces reference-free RAG metrics: faithfulness (decompose answer into statements, verify each against context), answer relevance, context relevance: computed via LLM prompting without ground-truth answers. Worked: enables fast eval cycles and synthetic test-set generation; widely adopted. Limits: relies on LLM-judge reliability (see R-6). EDD relevance: the canonical "evals as spec" decomposition for RAG acceptance criteria.

<a id="r-2"></a>

## R-2

**Saad-Falcon, J., Khattab, O., Potts, C., Zaharia, M. (2023/2024). [EMPIRICAL]** *ARES: An Automated Evaluation Framework for Retrieval-Augmented Generation Systems*. arXiv:2311.09476 (NAACL 2024). <https://arxiv.org/abs/2311.09476>

Fine-tunes lightweight LM judges on synthetic queries for context relevance, answer faithfulness, answer relevance; uses prediction-powered inference (PPI) with ~150 human-annotated points to produce statistically bounded estimates. Worked: accurate across 8 KILT/SuperGLUE/AIS tasks and robust to domain shift with only hundreds of annotations. EDD relevance: shows how to make automated evals trustworthy with a small human anchor: a template for cost-bounded eval pipelines.

<a id="r-3"></a>

## R-3

**Rebedea, T., Dinu, R., Sreedhar, M., Parisien, C., Cohen, J. (2023). [VENDOR/EMPIRICAL]** *NeMo Guardrails: A Toolkit for Controllable and Safe LLM Applications with Programmable Rails*. arXiv:2310.10501 (EMNLP 2023 demo). <https://arxiv.org/abs/2310.10501>

Runtime toolkit (NVIDIA) using a dialogue-management runtime and Colang to define programmable input/dialog/retrieval/output rails that are independent of the underlying LLM and interpretable. Worked: usable across multiple LLM providers to block off-topic/unsafe outputs and enforce RAG retrieval checks at request time. EDD relevance: reifies "guardrails as runtime evals": the same checks you'd run offline, executed inline as a runtime gate.

<a id="r-4"></a>

## R-4

**Guardrails AI (2023-2026). [VENDOR]** *Guardrails AI: Validators / Guards (docs + repo)*. <https://github.com/guardrails-ai/guardrails> ; <https://guardrailsai.com/docs/concepts/validators>

Open-source library wrapping LLM calls with input/output Guards composed of field-level validators (Guardrails Hub); supports structured-output enforcement and `reask`/`fix` on failure so the model retries against a typed schema. Worked: turns "validate the output" into reusable, composable runtime checks. Limits: validator quality varies; structured-output constraints don't catch semantic errors. EDD relevance: assertion-style evals applied at runtime with automatic remediation.

<a id="r-5"></a>

## R-5

**Yan, E. (2024). [PRACTITIONER]** *Task-Specific LLM Evals that Do & Don't Work*. eugeneyan.com. <https://eugeneyan.com/writing/evals/>

Practitioner survey of which metrics actually work per task (classification: PR-AUC/ROC-AUC over accuracy; summarization factuality via fine-tuned NLI on 100-1,000 samples; translation: COMET/chrF over BLEU). Warns G-Eval-style LLM judges can be "unreliable (low recall), costly, poor sensitivity." EDD relevance: argues evals must be task-specific (annotate ~30-100 examples) and risk-calibrated, not borrowed from generic leaderboards.

<a id="r-6"></a>

## R-6

**Muller, S., Loison, A., Omrani, B., Viaud, G. (Illuin) (2024). [EMPIRICAL]** *GroUSE: A Benchmark to Evaluate Evaluators in Grounded Question Answering*. arXiv:2409.06595. <https://arxiv.org/html/2409.06595v3>

Meta-evaluation: 144 hand-curated unit tests over 7 grounded-QA failure modes (irrelevant info, failure to refuse unanswerable, missing info, wrong citations, distorted claims, etc.). Key finding: RAGAS and DeepEval "often overlook important failure modes even with GPT-4 as judge"; high correlation with GPT-4 (~0.60 Spearman) did NOT predict unit-test pass rate (52.78% vs 81.37%). Fine-tuning Llama-3-8B on GPT-4 traces raised pass rate 40%→83%. EDD relevance: the strongest evidence that you must meta-evaluate (test) your evaluators before trusting them: a core anti-pattern warning.

<a id="r-7"></a>

## R-7

**TruLens / TruEra (2023-2024). [VENDOR/PRACTITIONER]** *The RAG Triad (Context Relevance, Groundedness, Answer Relevance)*. trulens.org. <https://www.trulens.org/getting_started/core_concepts/rag_triad/>

Frames RAG quality as three feedback functions: context relevance (retrieval), groundedness (claims attributable to retrieved text, checked claim-by-claim), answer relevance (helpfully answers the question). Worked: clean conceptual model widely reused; LLM-as-judge implementation scales without gold data. Limit: explicitly notes answer relevance ≠ correctness. EDD relevance: a ready-made rubric for RAG acceptance evals.

<a id="r-8"></a>

## R-8

**Kamradt, G.; via Arize AI (2023-2024). [PRACTITIONER/VENDOR]** *The Needle In a Haystack Test: Evaluating the Performance of LLM RAG Systems*. arize.com (summarizing Kamradt's test). <https://arize.com/blog-course/the-needle-in-a-haystack-test-evaluating-the-performance-of-llm-rag-systems/>

Embeds a target fact ("needle") at varying depths in long context and tests retrieval. Findings: GPT-4 degraded sharply past ~64k and again past ~100k tokens; both GPT-4 and Claude 2.1 struggled when the needle sat early in the document; a 10-word prompt change cut Claude failures 165→74. Limit: synthetic single-fact recall, not full RAG semantics (hence multi-needle extensions). EDD relevance: cheap, repeatable long-context/retrieval regression eval.

<a id="r-9"></a>

## R-9

**Statsig Team (2025). [VENDOR/POSITION]** *Online vs Offline Validation: Validating Test Sets*. statsig.com (Oct 31, 2025). <https://www.statsig.com/perspectives/online-vs-offline-validation>

Argues offline and online evals form a tight loop: offline for fast iteration on historical data, online A/B for causal validation on real users ("use offline to go fast; use online to be right"). Recommends A/A tests, clean validation/test boundaries, and refreshing offline sets to avoid drift. EDD relevance: positions evals as a two-tier gate (CI + production experiment).

<a id="r-10"></a>

## R-10

**Arize AI (2024-2026). [VENDOR]** *Phoenix: AI Observability & Evaluation (docs)*. arize.com/docs/phoenix. <https://arize.com/docs/phoenix>

Open-source platform built on OpenTelemetry/OpenInference; ingests traces and lets you score spans/traces with LLM-based evaluators, code checks, or human labels, integrating external evaluators (RAGAS, DeepEval, Cleanlab). EDD relevance: shows tracing as the substrate for production evals: you score the captured execution graph, not just final text.

<a id="r-11"></a>

## R-11

**Langfuse (2024-2026). [VENDOR]** *Evaluation of LLM Applications: Online & Offline (docs)*. langfuse.com. <https://langfuse.com/docs/evaluation/overview>

**Consolidated identifiers:** R-11, T-5.

The source describes a platform combining tracing, prompts, datasets, and online/offline evaluation using model graders, code checks, human annotations, and feedback. Its score model can attach judgments to traces, observations, or sessions, enabling retrieval and generation to be assessed separately. Source-time metadata describes an MIT core with enterprise exceptions and hosted/self-hosted options; exact feature licensing and present support need rechecking. Useful as an observability/experiment candidate, not evidence that a platform replaces a valid application-specific oracle.

<a id="r-12"></a>

## R-12

**Statsig (2025). [VENDOR/PRACTITIONER]** *Beyond Prompts: A Data-Driven Approach to LLM Optimization (Online Experimentation)*. statsig.com. <https://www.statsig.com/blog/llm-optimization-online-experimentation>

Makes the case that offline test sets are often unrepresentative and that A/B testing prompt/model changes on live traffic is the decisive eval; offline catches known failures, online catches novel ones and distribution shift. EDD relevance: frames production experimentation as the highest-authority eval in the loop.

<a id="r-13"></a>

## R-13

**Nebuly / practitioner syntheses (2024-2026). [PRACTITIONER]** *Explicit and Implicit LLM User Feedback: A Quick Guide*. nebuly.com. <https://www.nebuly.com/blog/explicit-implicit-llm-user-feedback-quick-guide>

Catalogs explicit (thumbs, ratings) vs implicit (retries, regenerate, copy/paste, follow-up query, post-edit distance, escalation) signals; notes only ~1-3% of users give explicit feedback, so implicit behavior is the scalable quality signal. Worked as a design pattern: sample corrected outputs daily, compute edit distance to triage failure causes. Limit: implicit signals are noisy proxies, easily confounded. EDD relevance: turns production behavior into continuously refreshed eval data and labels.

<a id="r-14"></a>

## R-14

**Commey, D. (2026). [EMPIRICAL/POSITION]** *When Generic Prompt Improvements Hurt: Evaluation-Driven Iteration for LLM Applications*. arXiv:2601.22025. <https://arxiv.org/abs/2601.22025>

Argues "generic" prompt improvements can raise aggregate metrics while regressing specific inputs; advocates evaluation-driven iteration with per-input monitoring, human rubrics, and compatibility checklists rather than blanket best-practice edits. Caveat: recent preprint (June 2026), single-author, not peer-reviewed: treat as position/early-empirical. EDD relevance: direct argument that evals (not intuition) must gate prompt changes.

<a id="r-17"></a>

## R-17

**Huang, D., Reini, J., Datta, A., Snowflake AI Research (2025). [VENDOR/EMPIRICAL]** *Benchmarking LLM-as-a-Judge for the RAG Triad Metrics*. snowflake.com engineering blog (Jan 31, 2025). <https://www.snowflake.com/en/engineering-blog/benchmarking-LLM-as-a-judge-RAG-triad-metrics/>

Benchmarks GPT-4o judges on public datasets: groundedness (LLM-AggreFact): F1 81%, κ 0.54; context relevance (TREC-DL): F1 64%, κ 0.48, precision only 51%; answer relevance (HotpotQA): F1 79%, κ 0.61, but flags "answer relevance ≠ answer correctness." Worked: judges reach moderate-to-substantial human agreement and beat some fine-tuned baselines. Limit: context relevance is the weakest/lowest-precision axis; public RAG benchmarks are scarce. EDD relevance: quantifies how far to trust each RAG-triad eval metric in practice.

## Related records housed elsewhere

- [R-15: canonical F-15](foundations.md#f-15)
- [R-16: canonical F-10](foundations.md#f-10)
