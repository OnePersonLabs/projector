# Model judges and human alignment

**Dated source annotations, not fresh verification.** Read the [catalogue status](INDEX.md) before relying on numerical or product claims.

[Catalogue index](INDEX.md) · [Research map](../INDEX.md)

<a id="j-2"></a>

## J-2

**Liu, Iter, Xu, Wang, Xu, Zhu / Microsoft (2023). [EMPIRICAL]** *G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment*. EMNLP 2023. <https://arxiv.org/abs/2303.16634>

Defines the now-standard "G-Eval" pattern: chain-of-thought generated from the rubric + a form-filling paradigm + probability-weighted scoring to reduce ties. *Worked:* 0.514 Spearman with humans on summarization (SummEval), beating prior metrics "by a large margin." *Limits/failed:* the authors themselves flag bias toward LLM-generated text (the judge shares the generator's notion of quality); follow-ups note score sensitivity to prompt wording and run-to-run inconsistency. Relevance: the reference design for rubric-driven CoT grading in EDD pipelines.

<a id="j-3"></a>

## J-3

**Wang, Li, Chen, et al. / Peking U., Tencent (2023). [EMPIRICAL]** *Large Language Models are not Fair Evaluators*. ACL 2024. <https://arxiv.org/abs/2305.17926>

Definitive demonstration of position bias: reordering responses let Vicuna-13B "beat" ChatGPT on 66/80 queries; win rates swung from 2.5% to 82.5% by position alone. *Worked:* proposes three calibrations: Multiple Evidence Calibration (explain-then-score, ensembled), Balanced Position Calibration (score in both positions and average), and Human-in-the-Loop Calibration; MEC+BPC improved accuracy by ~9.8% (GPT-4) / ~14.3% (ChatGPT). Relevance: any EDD harness using pairwise judges must swap-and-average or results are unsound.

<a id="j-4"></a>

## J-4

**Wataoka, Takahashi, Ri / LY Corp. (2024). [EMPIRICAL]** *Self-Preference Bias in LLM-as-a-Judge*. NeurIPS 2024 (workshop/Safe GenAI). <https://arxiv.org/abs/2410.21819>

Quantifies self-preference bias and reframes it: GPT-4 shows significant self-preference, but the "essence of the bias lies in perplexity": judges over-score *low-perplexity / familiar* text relative to humans, regardless of whether they generated it. *Worked:* gives a clean metric and a mechanistic explanation. Relevance for EDD: explains why a judge inflates outputs from its own model family, and warns against using the same model to generate and grade.

<a id="j-5"></a>

## J-5

**Tripathi, Wadhwa, Durrett, Niekum / UT Austin (2025). [EMPIRICAL]** *Pairwise or Pointwise? Evaluating Feedback Protocols for Bias in LLM-Based Evaluation*. arXiv 2504.14716. <https://arxiv.org/abs/2504.14716>

Head-to-head of absolute vs comparative protocols. *Finding:* pairwise preferences flip in ~35% of cases vs ~9% for absolute scores, and pairwise is more exploitable via "distractor features" that inflate low-quality outputs; absolute scoring is more robust to manipulation. Recommends choosing protocol by task (absolute for correctness/instruction-following). Relevance: directly informs the pointwise-vs-pairwise design choice in an eval suite.

<a id="j-6"></a>

## J-6

**OpenAI (2024-2025). [VENDOR]** *Evaluation best practices / Graders*. OpenAI API docs. <https://developers.openai.com/api/docs/guides/evaluation-best-practices>

Vendor playbook for model-graded evals. *Recommends:* start with a strong judge model and validate agreement against human labels before optimizing cost; "show rather than tell" with score anchors (define what a 1/3/5 mean); reasoning-before-score; structured outputs; control for response length (judges bias toward longer answers); prefer pairwise or pass/fail over single-answer grading for reliability. Relevance: concrete, implementable rubric/grader conventions for EDD harnesses.

<a id="j-7"></a>

## J-7

**Anthropic (2024-2025). [VENDOR]** *Define success criteria and build evaluations*. Claude docs. <https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests>

Vendor guidance ranking grading methods: **code-based (fastest/most reliable) > human (best quality, slow) > LLM-based (flexible, test before scaling)**. For LLM-based grading: use detailed clear rubrics, be "empirical or specific" (output only correct/incorrect or a 1-5 scale), and encourage reasoning before the score (then discard it). Notes a different model should ideally grade than generated; and "prioritize volume over quality" of automated grading. Relevance: a decision tree for when an LLM judge is even the right tool in EDD.

<a id="j-8"></a>

## J-8

**Kim, Shin, Cho, et al. / KAIST, NAVER (2023). [EMPIRICAL]** *Prometheus: Inducing Fine-grained Evaluation Capability in Language Models*. ICLR 2024. <https://arxiv.org/abs/2310.08491>

Open 13B evaluator LM trained on the Feedback Collection (1K rubrics, 20K instructions, 100K GPT-4 feedback responses). *Worked:* with a reference answer + custom score rubric, Prometheus reaches Pearson 0.897 with humans: on par with GPT-4 (0.882) and far above ChatGPT (0.392) across 45 rubrics; feedback preferred over GPT-4's 58.6% of the time. *Motivation/limit it answers:* closed GPT-4 judges aren't reproducible, controllable, or affordable. Relevance: reference-based + rubric grading and reproducible/self-hosted judges for EDD.

<a id="j-9"></a>

## J-9

**Husain, Hamel (2024). [PRACTITIONER]** *Creating an LLM-as-a-Judge That Drives Business Results*. hamel.dev. <https://hamel.dev/blog/posts/llm-judge/>

**Consolidated identifiers:** J-9, M-6.

A practitioner method for aligning an LLM judge with a principal domain expert using binary judgments and written critiques. Refine the judge against actual disagreements, and use precision/recall when class imbalance makes raw agreement misleading. The source reports greater than 90% agreement after roughly three iterations in one Honeycomb example; this is a case result, not a generic convergence guarantee. The main value is disciplined inspection of data, not replacing judgment with arbitrary rating scales or many off-the-shelf metrics.

<a id="j-10"></a>

## J-10

**Tan, Zhuang, Montgomery, et al. / UC Berkeley (2024). [EMPIRICAL]** *JudgeBench: A Benchmark for Evaluating LLM-based Judges*. ICLR 2025. <https://arxiv.org/abs/2410.12784>

Builds response pairs with *objective* correctness labels (knowledge, reasoning, math, code): where crowd preference is a poor proxy for truth. *Finding (failure):* strong judges like GPT-4o perform near random (~56% with Arena-Hard-Judge prompting); the best model reaches only ~64%. Relevance: hard evidence that LLM judges should NOT gate objectively-verifiable correctness: use deterministic/code graders there; reserve the judge for subjective quality.

<a id="j-11"></a>

## J-11

**Doostmohammadi, Holmström, Kuhlmann / Linköping U. (2024). [EMPIRICAL]** *How Reliable Are Automatic Evaluation Methods for Instruction-Tuned LLMs?*. arXiv 2402.10770 (EMNLP 2024 Findings). <https://arxiv.org/abs/2402.10770>

Meta-evaluation across tasks/languages. *Findings:* automatic-eval validity is "highly context-dependent": ROUGE-L tracks humans well on short-answer English but is unreliable for free-form generation and cross-lingual; and GPT-4-as-judge effectiveness "diminishes significantly" without reference answers in the prompt. Relevance: argues against one-size-fits-all judging and for reference-grounded grading in EDD.

<a id="j-12"></a>

## J-12

**Wolfe, Cameron R. (2024). [PRACTITIONER]** *Using LLMs for Evaluation (LLM-as-a-Judge)*. Substack. <https://cameronrwolfe.substack.com/p/llm-as-a-judge>

Comprehensive practitioner survey. Frames LLM-as-judge as a reference-free, scalable approximation of human preference; covers pointwise (direct/Likert) vs pairwise vs reference-guided; recommends rationale-before-score CoT, position swap-and-average, and length debiasing (regression lifted AlpacaEval-Chatbot-Arena Spearman from 0.94→0.98). Notes human-LLM agreement mirrors inter-human (~80%) but judges struggle on complex reasoning and can be misled by wrong context; pairs cheap LLM eval with human eval pre-deploy. Relevance: a synthesis map of the design space for EDD.

<a id="j-13"></a>

## J-13

**Dubois, Galambosi, Liang, Hashimoto / Stanford (2024). [EMPIRICAL]** *Length-Controlled AlpacaEval: A Simple Way to Debias Automatic Evaluators*. (AlpacaEval 2.0). <https://arxiv.org/abs/2404.04475>

Targets verbosity/length bias directly: fit a GLM to predict the auto-annotator's preference from length difference (and features), then predict the counterfactual preference at zero length difference. *Worked:* length-controlling improved robustness to verbosity gaming and raised Spearman correlation with Chatbot Arena. Relevance: a concrete statistical debiasing recipe so an EDD judge can't be gamed by making outputs longer.

<a id="j-14"></a>

## J-14

**Shankar, Zamfirescu-Pereira, Hartmann, Parameswaran, Arawjo / UC Berkeley (2024). [EMPIRICAL]** *Who Validates the Validators? Aligning LLM-Assisted Evaluation of LLM Outputs with Human Preferences*. UIST 2024. <https://arxiv.org/abs/2404.12272>

**Consolidated identifiers:** J-14, M-9.

EvalGen is a mixed-initiative evaluator-authoring tool combining generated assertions or grader prompts with human grades. Its important finding is criteria drift: judging actual outputs can reveal what criteria people really intend, so the criteria cannot always be completely fixed in advance. Candidate evaluators still require human alignment and validation. Per-criterion binary checks are useful in the reported workflow; they are not a universal prohibition on other scoring schemes.

<a id="j-15"></a>

## J-15

**Raina, Liusie, Gales / U. Cambridge (2024). [EMPIRICAL]** *Is LLM-as-a-Judge Robust? Investigating Universal Adversarial Attacks on Zero-shot LLM Assessment*. EMNLP 2024. <https://aclanthology.org/2024.emnlp-main.427/>

First systematic adversarial study of judge LLMs. *Finding (failure):* short universal adversarial phrases appended to a response deceive judges into predicting inflated/maximum scores regardless of quality, and attack phrases learned on surrogate models transfer to unknown judges; absolute scoring is *more* vulnerable than comparative assessment. Relevance: an LLM judge that gates a pipeline is an attack surface and a reward-hacking target: a critical caveat for EDD guardrails in adversarial or high-stakes settings.

## Related records housed elsewhere

- [J-1: canonical F-10](foundations.md#f-10)
