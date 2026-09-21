# Foundations and statistical interpretation

**Dated source annotations, not fresh verification.** Read the [catalogue status](INDEX.md) before relying on numerical or product claims.

[Catalogue index](INDEX.md) · [Research map](../INDEX.md)

<a id="f-1"></a>

## F-1

**Multiple practitioner guides (2024-2026). [PRACTITIONER]** *LLM benchmarks, evals and tests: a mental model* and adjacent guides (Thoughtworks; Braintrust; Adaline). <https://thoughtworks.medium.com/llm-benchmarks-evals-and-tests-9bf2826f6c55> · <https://www.braintrust.dev/articles/llm-evaluation-guide>

Establishes the working taxonomy used throughout EDD: metric (single measurement) vs benchmark (standardized dataset+metric+protocol for comparison) vs eval (application-specific: dataset + success criterion + evaluator) vs test (deterministic assertion). Worked: a crisp shared vocabulary. Limit: secondary/practitioner sources, not peer-reviewed; definitions vary slightly by vendor. Relevance: EDD treats the eval, not the benchmark, as the spec/guardrail.

<a id="f-2"></a>

## F-2

**Various (2024-2026). [PRACTITIONER]** *LLM evaluation guides distinguishing benchmarks vs application evals* (Turing; Codecademy; Aisera). <https://www.turing.com/resources/understanding-llm-evaluation-and-benchmarks>

Reinforces that public benchmarks measure general capability while evals measure your app in its full stack (prompts, retrieval, tools). What failed historically: teams shipped on benchmark numbers and were surprised by production failures. Relevance: motivates moving the eval into the dev loop rather than relying on leaderboards.

<a id="f-3"></a>

## F-3

**Liang, Percy, et al. (CRFM, Stanford) (2022/2023). [EMPIRICAL]** *Holistic Evaluation of Language Models (HELM)*. arXiv:2211.09110; published in TMLR. <https://arxiv.org/abs/2211.09110>

Large-scale standardized benchmarking of ~30 models across 16 core scenarios, measuring 7 metrics (accuracy, calibration, robustness, fairness, bias, toxicity, efficiency); raised scenario coverage from ~17.9% to ~96% under uniform conditions. Worked: multi-metric, transparent, reproducible, exposes trade-offs. Limit: heavy to run; living-benchmark scope means moving target. Relevance: the canonical argument against single-number evals: directly informs multi-dimensional EDD guardrails.

<a id="f-4"></a>

## F-4

**Chen, Mark, et al. (OpenAI) (2021). [EMPIRICAL]** *Evaluating Large Language Models Trained on Code* (Codex; HumanEval). arXiv:2107.03374. <https://arxiv.org/abs/2107.03374>

**Consolidated identifiers:** F-4, C-1.

HumanEval supplies 164 handwritten Python problems with executable tests. The source reports an average of about 7.7 tests per problem and Codex results of 28.8% pass@1 and 70.2% pass@100. The key methodological object is the estimator 1 − C(n−c,k)/C(n,k), averaged across problems, with n≥k sampled completions and c passing completions; at k=1 it reduces to c/n. This differs from estimating success by plugging an empirical p into 1−(1−p)^k. The lesson is execution-grounded grading and explicit accounting for repeated sampling. Reliable tests remain essential, and a small public dataset is vulnerable to contamination. Passing its tests does not establish all intended behavior.

<a id="f-5"></a>

## F-5

**Gema, Aryo Pradipta, et al. (2024, rev. 2025). [EMPIRICAL]** *Are We Done with MMLU?* (introduces MMLU-Redux). arXiv:2406.04127. <https://arxiv.org/abs/2406.04127>

Manual re-annotation (error protocol: bad question/option clarity; no correct answer; multiple correct; wrong ground truth) of MMLU; reports overall error rate ~6.49% (paper abstract), with per-subject rates far higher (~57% of analyzed Virology questions, ~26% Logical Fallacies). MMLU-Redux = ~5,700 corrected questions across 57 subjects. Re-scoring shifts model rankings (e.g., Palmyra X v3 1st vs 4th on Virology depending on inclusion). Worked: quantifies label-quality risk. Limit/flag: secondary summaries also cited a ~9% figure for a subject-level estimate: The source treats ~6.49% as the headline number from the abstract. Relevance: golden sets must be audited before they gate releases.

<a id="f-6"></a>

## F-6

**Sclar, Melanie; Choi, Yejin; Tsvetkov, Yulia; Suhr, Alane (2023/2024). [EMPIRICAL]** *Quantifying Language Models' Sensitivity to Spurious Features in Prompt Design (FormatSpread)*. arXiv:2310.11324; ICLR 2024. <https://arxiv.org/abs/2310.11324>

**Consolidated identifiers:** F-6, P-13.

FormatSpread examines performance variation across semantically equivalent prompt formats. The source annotations report swings of up to 76 accuracy points on LLaMA-2-13B and sensitivity that does not disappear simply with scale, more examples, or instruction tuning. Format preference need not transfer across models. Report ranges or distributions across plausible formats, and pin the actual prompt and harness when comparing runs. The study's task and model scope does not establish equally large effects in every application.

<a id="f-7"></a>

## F-7

**Survey/analysis sources on NLG metrics (2020-2025). [EMPIRICAL]/[POSITION]** *Critiques of BLEU/ROUGE for generation* (Evaluation of Text Generation: A Survey, arXiv:2006.14799; LLM-based NLG Evaluation survey, arXiv:2402.01383). <https://arxiv.org/abs/2006.14799> · <https://arxiv.org/html/2402.01383v2>

Documents that n-gram overlap metrics correlate weakly with human judgment on adequacy/fluency, miss semantic equivalence in a majority of paraphrase cases, handle morphologically rich languages poorly, and are gameable. Worked: cheap, deterministic, reproducible. Failed: poor construct validity for open-ended quality. Relevance: for generative AI features, prefer execution checks / validated judges over BLEU/ROUGE in EDD gates.

<a id="f-8"></a>

## F-8

**Calibration / proper-scoring-rule literature (synthesis, 2017-2025). [EMPIRICAL]** *Brier score & log-loss as proper scoring rules; ECE is not proper.* (e.g., Calibration and Correctness of Language Models for Code, ICSE 2025, <https://www.software-lab.org/publications/icse2025_calibration.pdf)>. <https://www.software-lab.org/publications/icse2025_calibration.pdf>

Brier score / log-loss are strictly proper (minimized only at true probabilities); ECE/MCE are popular but not proper: degenerate predictors can score well, so they can mislead. Worked: principled confidence evaluation. Limit: proper scores need probability outputs, which black-box LLMs may not expose. Relevance: EDD guardrails that gate on confidence should use proper scoring, not ECE alone.

<a id="f-9"></a>

## F-9

**Practitioner platform guides (2024-2026). [PRACTITIONER]/[VENDOR]** *Offline vs online LLM evaluation* (Label Studio; Deepchecks; Arize; Freeplay). <https://labelstud.io/learningcenter/offline-evaluation-vs-online-evaluation-when-to-use-each/> · <https://arize.com/llm-evaluation/>

Offline = pre-deployment vs fixed golden/synthetic set (controlled, granular metrics, CI gating); online = scoring live traffic, A/B tests, canaries (catches drift, novel failures). The two form a loop: online failures augment the offline set. Worked: clear operational division. Limit: vendor framing; definitions are practitioner-driven. Relevance: positions EDD's offline/CI evals and shows why they need an online feedback channel.

<a id="f-10"></a>

## F-10

**Zheng, Lianmin, et al. (2023). [EMPIRICAL]** *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*. arXiv:2306.05685; NeurIPS 2023 Datasets & Benchmarks. <https://arxiv.org/abs/2306.05685>

**Consolidated identifiers:** F-10, J-1, R-16.

MT-Bench and Chatbot Arena study scalable model judgment and pairwise human preferences. The source reports GPT-4 agreement above 80% in the studied comparisons, alongside position, verbosity, self-enhancement, and reasoning limitations. Proposed mitigations include swapping candidate order, averaging appropriate judgments, and reference-guided assessment. The implication is to validate the judge in the receiving application, including retrieval and online evaluation, rather than interpreting one agreement figure as universal evaluator accuracy.

<a id="f-11"></a>

## F-11

**Position-bias and self-preference follow-ups (2024). [EMPIRICAL]** *Judging the Judges: Position Bias in LLM-as-a-Judge* (arXiv:2406.07791); *Self-Preference Bias in LLM-as-a-Judge* (arXiv:2410.21819). <https://arxiv.org/abs/2406.07791> · <https://arxiv.org/pdf/2410.21819>

**Consolidated identifiers:** F-11, T-19.

The retained annotations identify a position-bias study using 15 judges and approximately 150,000 instances across two benchmarks. They report systematic effects related to judge, candidate, task, and quality gap, rather than random placement noise. One annotation also attributes self-generated-content preference to this reference; that attribution is not independently confirmed here and should not be treated as established by this paper. Evaluate order sensitivity, counterbalance comparisons, and calibrate against independent judgments. Prompt settings alone do not certify an unbiased judge.

<a id="f-12"></a>

## F-12

**Miller, Evan (Anthropic) (2024). [EMPIRICAL]/[VENDOR]** *Adding Error Bars to Evals: A Statistical Approach to Language Model Evaluations*. arXiv:2411.00640. <https://arxiv.org/abs/2411.00640>

**Consolidated identifiers:** F-12, M-18.

Treat evaluations as experiments sampling from a larger population of questions. The source recommends standard errors, clustering for related questions, repeated samples and variance reduction where appropriate, paired comparisons, and power analysis. Report sample count and uncertainty, not just a favorable point estimate. One annotation reports clustered standard errors exceeding naive estimates by more than three times in examples; that is not a universal correction factor. The practical contribution is interpretable evidence for regression and model-comparison decisions.

<a id="f-13"></a>

## F-13

**Liang, Shanchao; Garg, Spandan; Zilouchian Moghaddam, Roshanak (2025). [EMPIRICAL]** *The SWE-Bench Illusion: When State-of-the-Art LLMs Remember Instead of Reason*. arXiv:2506.12286. <https://arxiv.org/abs/2506.12286>

Evidence that high SWE-Bench scores partly reflect memorization: o3 recovers buggy file paths at ~76% without context that should be required; verbatim n-gram overlap is much higher on SWE-Bench than comparable benchmarks; outside-repo task performance drops (~53%). Worked: concrete contamination diagnostics. Limit: a few models/tasks. Relevance: warns EDD adopters not to gate on contaminated agent benchmarks; use held-out/fresh tasks.

<a id="f-14"></a>

## F-14

**Jimenez, Carlos, et al.; with OpenAI SWE-bench Verified (2024). [EMPIRICAL]/[VENDOR]** *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* and *Introducing SWE-bench Verified*. <https://openai.com/index/introducing-swe-bench-verified/>

**Consolidated identifiers:** F-14, C-5.

SWE-bench Verified is described as a 500-instance human-screened subset of repository tasks, intended to reduce ambiguous issues, invalid tests, and unsolvable cases. The source reports involvement of roughly 93 professional developers. It illustrates both execution-based evaluation and the importance of dataset curation. Public-code contamination and residual test defects remain concerns. A later-status/deprecation date in the supplied annotation is explicitly unverified; no present maintenance or reporting status is asserted here.

<a id="f-15"></a>

## F-15

**Husain, Hamel (2024). [PRACTITIONER]** *Your AI Product Needs Evals*. <https://hamel.dev/blog/posts/evals/>

**Consolidated identifiers:** F-15, R-15, M-1.

A practitioner evaluate-debug-iterate workflow grounded in application experience, including the Rechat/Lucy case. It combines cheap assertions, human and model assessment of logged traces, and production A/B testing when appropriate. Error analysis and easy access to real data drive the useful cases; examples include detecting leaked identifiers. The contribution is a practical improvement loop, not controlled evidence that all AI-product failures have one cause. Fine-tuning and prompt work should follow the observed failure distribution rather than substitute for it.

<a id="f-16"></a>

## F-16

**Interdisciplinary critique (2025). [POSITION]/[EMPIRICAL]** *Can We Trust AI Benchmarks? An Interdisciplinary Review of Current Issues in AI Evaluation*. arXiv:2502.06559. <https://arxiv.org/pdf/2502.06559>

Synthesizes construct-validity, reliability, and methodological problems across AI benchmarks: many "do not measure what they claim to measure." Worked: frames eval quality in measurement-theory terms (validity/reliability). Limit: review/position, not new experiments. Relevance: gives EDD a checklist for designing evals that actually measure the intended capability before they become guardrails.

<a id="f-17"></a>

## F-17

**EleutherAI (2021-present). [VENDOR]/[EMPIRICAL]** *lm-evaluation-harness* (framework for few-shot LM evaluation). <https://github.com/EleutherAI/lm-evaluation-harness>

**Consolidated identifiers:** F-17, T-17.

A research harness for model-capability evaluation with versioned prompts, task configuration, and code revision. The source describes broad model/backend support and a public benchmark ecosystem. Reproducibility requires matching settings; a harness does not remove prompt sensitivity. It is primarily a research/model-selection tool rather than an application's production-observability system. The annotation's license, release v0.4.12 dated May 11, 2026, and maintenance claims are source-time metadata, not freshly checked dependency advice.

<a id="f-18"></a>

## F-18

**Hendrycks, Dan, et al. (2020/2021). [EMPIRICAL]** *Measuring Massive Multitask Language Understanding (MMLU)*. arXiv:2009.03300; ICLR 2021. <https://arxiv.org/abs/2009.03300>

57-subject, ~15.9k multiple-choice benchmark requiring broad world knowledge; became one of the most-used LLM benchmarks. Worked: broad capability coverage in one number. Failed/limit: label errors [F-5](foundations.md#f-5), answer-order and prompt-format sensitivity, and contamination undermine its reliability as a sole metric. Relevance: a foundational benchmark whose well-documented weaknesses motivate the rigor (clean data, multi-prompt, error bars) that EDD requires.

