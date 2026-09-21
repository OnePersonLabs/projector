# Code and repository evaluation

**Dated source annotations, not fresh verification.** Read the [catalogue status](INDEX.md) before relying on numerical or product claims.

[Catalogue index](INDEX.md) · [Research map](../INDEX.md)

<a id="c-2"></a>

## C-2

**Li, Y., et al. (Google DeepMind) (2022). [EMPIRICAL]** *Competition-Level Code Generation with AlphaCode*. Science (Dec 8, 2022); preprint/tech report. <https://storage.googleapis.com/deepmind-media/AlphaCode/competition_level_code_generation_with_alphacode.pdf> (blog: <https://deepmind.google/blog/competitive-programming-with-alphacode/)>

Introduces the CodeContests dataset (competitive-programming problems, human submissions, test cases) and a system that generates massive candidate samples then filters/clusters to ~10 submissions. Worked: reached ~median human (top 54.3%) across 10 Codeforces contests selected to post-date training data: the first AI to be competitive in programming contests, and a clean demonstration of sampling-plus-filtering against a contamination-controlled eval. Limits: enormous sample budgets; contest puzzles are a narrow proxy for real engineering. Relevance: shows both the power and the cost of inference-time scaling against execution-based evals.

<a id="c-3"></a>

## C-3

**Jimenez, C. E., Yang, J., Wettig, A., Yao, S., Pei, K., Press, O., Narasimhan, K. (Princeton) (2023/2024). [EMPIRICAL]** *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* ICLR 2024. arXiv:2310.06770. <https://arxiv.org/abs/2310.06770>

2,294 task instances from real GitHub issues + merged PRs across 12 popular Python repos; the model edits a codebase and is graded by running the repo's test suite (FAIL_TO_PASS fix tests + PASS_TO_PASS regression tests). Worked: moved code evals from isolated functions to repository-scale, multi-file engineering with execution-based grading. Failed/limits at launch: best model (Claude 2) resolved only 1.96%; even SOTA could handle only the simplest issues. Relevance: the canonical "evals as the spec/guardrail for agentic coding" benchmark; its scoring scheme is the template for harness-based patch evaluation.

<a id="c-4"></a>

## C-4

**Jain, N., Han, K., Gu, A., Li, W.-D., Yan, F., Zhang, T., Wang, S., Solar-Lezama, A., Sen, K., Stoica, I. (2024). [EMPIRICAL]** *LiveCodeBench: Holistic and Contamination-Free Evaluation of Large Language Models for Code*. arXiv:2403.07974. <https://arxiv.org/abs/2403.07974> (site: <https://livecodebench.github.io/)>

Continuously collects fresh problems (published May 2023-May 2024 at first) from LeetCode, AtCoder, and Codeforces, tagged with release dates, and evaluates beyond generation: self-repair, code execution, and test-output prediction. Worked: enables time-segmented evaluation: comparing problems before vs. after a model's cutoff exposes contamination/overfitting as a measurable performance drop. Relevance: the most transferable anti-contamination design for eval-driven development: a "live," held-out eval set rather than a frozen one.

<a id="c-6"></a>

## C-6

**Gauthier, P. / Aider (2024). [PRACTITIONER]** *o1 tops aider's new polyglot leaderboard*. aider.chat (Dec 21, 2024). <https://aider.chat/2024/12/21/polyglot.html> (leaderboard: <https://aider.chat/docs/leaderboards/)>

Introduces the Aider "polyglot" benchmark: 225 of the hardest Exercism problems across C++, Go, Java, JavaScript, Python, Rust (selected as those solved by ≤3 models). Models get two attempts, seeing unit-test failures from attempt 1 before retrying; the headline metric is pass_rate_2 (all hidden tests green after the 2nd try). Worked: deliberately re-calibrated to a 5-50% band after the old Python-only set saturated (top model solved 112/133). Relevance: a practitioner exemplar of benchmark-saturation management and test-feedback-in-the-loop evaluation: directly analogous to an iterative eval-driven dev loop.

<a id="c-7"></a>

## C-7

**SWE-bench project (2023-). [EMPIRICAL/DOCS]** *The Harness: SWE-bench reference; PASS_TO_PASS/FAIL_TO_PASS discussion*. <https://www.swebench.com/SWE-bench/reference/harness/> (issue: <https://github.com/swe-bench/SWE-bench/issues/257)>

Documents the evaluation mechanics: per-instance Docker images, apply the model's git-diff patch, run the prescribed test suite, and mark "resolved" only if both FAIL_TO_PASS (the fix) and PASS_TO_PASS (no regressions) invariants hold; primary metric is % Resolved. Worked: reproducible, containerized, execution-based grading that others (SWE-bench Verified/Multimodal, Multi-SWE-bench) build on. Limits: faithfulness depends entirely on test-suite quality (see C-8). Relevance: shows precisely how a coding-agent harness scores patches: the operational core of agentic eval-driven development.

<a id="c-8"></a>

## C-8

**Xue, H., Aleithan, R., Enan, N., Nnorom, E., Mohajer, M. M., Uddin, G., Wang, S. (2025). [EMPIRICAL]** *SWE-Bench+: Enhanced Coding Benchmark for LLMs*. OpenReview (2025). <https://openreview.net/forum?id=R40rS2afQ3>

Manually re-audits SWE-bench "resolved" cases. Findings: 60.83% of successfully resolved issues involved *solution leakage* (the fix was directly given or hinted in the issue/comments) and 47.93% were marked resolved only because weak test cases failed to reject incorrect patches. After filtering, resolution dropped from ~42.1%→21.8% (SWE-bench Lite) and ~51.7%→25.9% (SWE-bench Verified). Relevance: the sharpest empirical warning for eval-driven dev: "tests pass" is not "problem solved" unless tests are strong and the prompt doesn't contain the answer. (Note: an independent practitioner deep-dive [Runloop] reports analogous but different figures, e.g. ~32.67% leakage / ~31.08% weak tests / 12.47%→3.97%: treat exact percentages as study-specific.)

<a id="c-9"></a>

## C-9

**Matton, A., Sherborne, T., Aumiller, D., Tommasone, E., Alizadeh, M., He, J., Ma, R., Voisin, M., Gilsenan-McMahon, E., Gallé, M. (Cohere) (2024). [EMPIRICAL]** *On Leakage of Code Generation Evaluation Datasets*. arXiv:2407.07565. <https://arxiv.org/html/2407.07565v3>

Quantifies HumanEval/MBPP leakage three ways: direct GitHub prevalence (every prompt appears ≥43×), synthetic-data overlap (evol-instruct training sets are highly cosine-similar to HumanEval prompts), and prior corpora overlap (citing Riddell et al.: 12.2% of HumanEval in The Pile, 18.9% in The Stack). Introduces LBPP ("Less Basic Python Problems," 161 prompts) as a fresher alternative. Worked: documents that the field's most-cited benchmarks are heavily contaminated. Relevance: justifies why eval-driven dev should not rely solely on public benchmarks for selection decisions.

<a id="c-10"></a>

## C-10

**Miserendino, S., Wang, M., Patwardhan, T., Heidecke, J. (OpenAI) (2025). [VENDOR/EMPIRICAL]** *SWE-Lancer: Can Frontier LLMs Earn $1 Million from Real-World Freelance Software Engineering?* arXiv:2502.12115 (ICML 2025 poster). <https://arxiv.org/abs/2502.12115> (blog: <https://openai.com/index/swe-lancer/>; code: <https://github.com/openai/SWELancer-Benchmark)>

1,400+ real Upwork tasks ($50 bug fixes to $32,000 features) totaling $1M; independent coding tasks graded by triple-verified end-to-end (Playwright) tests, plus managerial tasks judged against the real hiring managers' choices. Worked: ties eval outcomes to economic value and uses end-to-end behavioral tests rather than unit tests. Failed/limits: frontier models solve a minority and capture only a fraction of the pool (Claude 3.5 Sonnet ~26.2% on independent coding tasks). Relevance: a "value-based" eval that exposes the gap between benchmark percentages and real software-engineering competence.

<a id="c-11"></a>

## C-11

**Zhou, X., et al. (2025). [EMPIRICAL]** *LessLeak-Bench: A First Investigation of Data Leakage in LLMs Across 83 Software Engineering Benchmarks*. arXiv:2502.06215. <https://arxiv.org/abs/2502.06215>

Uses MinHash+LSH near-duplicate detection plus manual labeling across 83 SE benchmarks. Findings: average leakage is modest (Python 4.8%, Java 2.8%, C/C++ 0.7%) but highly uneven: QuixBugs 100%, BigCloneBench 55.7%, APPS 10.8%, SWE-bench Verified 10.6%, SWE-bench 8.7%; and leakage materially inflates scores (StarCoder-7b ~4.9× higher pass@1 on leaked vs non-leaked APPS samples). Relevance: gives eval-driven dev a defensible, per-benchmark contamination map and a detection methodology rather than a blanket assumption.

<a id="c-12"></a>

## C-12

**Schmid, P. (2025). [PRACTITIONER]** *Pass@k vs Pass^k: Understanding Agent Reliability*. philschmid.de. <https://www.philschmid.de/agents-pass-at-k-pass-power-k>

Clarifies the distinction practitioners conflate: `pass@k` = probability ≥1 of k attempts succeeds (`1 − C(n−c,k)/C(n,k)`) measures capability; `pass^k = (c/n)^k` measures the probability *all* k attempts succeed: reliability. Worked example: a 70%-success agent reads as ~97% at pass@3 but only ~34.3% at pass^3, which better predicts human-escalation load. Relevance: tells eval-driven dev which metric to optimize for production agents (consistency), and why a headline pass@k can be dangerously optimistic.

<a id="c-13"></a>

## C-13

**Zhuo, T. Y., Vu, M. C., Chim, J., Hu, H., Yu, W., et al. (BigCode) (2024/2025). [EMPIRICAL]** *BigCodeBench: Benchmarking Code Generation with Diverse Function Calls and Complex Instructions*. ICLR 2025 (Oral). arXiv:2406.15877. <https://arxiv.org/abs/2406.15877> (repo: <https://github.com/bigcode-project/bigcodebench)>

1,140 tasks requiring composition of function calls from 139 libraries across 7 domains; two splits (Complete = full docstrings, Instruct = terse instructions); ~5.6 test cases per task with ~99% branch coverage. Worked: probes realistic tool/library use rather than self-contained algorithms. Failed/limits: across 60 LLMs, best ~60% vs human 97%: models still can't follow complex instructions to call functions precisely. Relevance: shows that high HumanEval-style pass rates don't transfer to compositional, library-heavy real-world tasks: eval coverage must match the target task distribution.

<a id="c-14"></a>

## C-14

**Du, X., et al. (2023). [EMPIRICAL]** *ClassEval: A Manually-Crafted Benchmark for Evaluating LLMs on Class-level Code Generation*. arXiv:2308.01861. <https://arxiv.org/abs/2308.01861>

First class-level code-generation benchmark: 100 Python class tasks hand-built over ~500 person-hours, evaluating generation of methods that share class state/dependencies. Worked: exposes that all LLMs perform substantially worse at class-level than at method-level (HumanEval) generation; GPT-4/GPT-3.5 lead but still struggle with cross-method dependencies. Relevance: a reminder that granularity of the eval (function vs class vs repo) changes the difficulty and the conclusions: eval-driven dev should test at the unit of work it actually cares about.

<a id="c-15"></a>

## C-15

**Yang, J., Jimenez, C. E., et al. (2024). [EMPIRICAL]** *SWE-bench Multimodal: Do AI Systems Generalize to Visual Software Domains?* arXiv:2410.03859 (ICLR 2025). <https://arxiv.org/abs/2410.03859> (site: <https://www.swebench.com/multimodal.html)>

617 task instances from 17 JavaScript libraries (UI design, diagramming, data-viz, syntax highlighting, mapping) where issues contain images/videos. Worked: extends execution-based issue-resolution evaluation to visual, user-facing software and a second language. Failed/limits: top systems resolve as low as ~12.2%: strong Python-issue agents do not generalize to visual reasoning. Relevance: demonstrates that benchmark scores are domain- and modality-specific; an eval suite must span the modalities your product actually ships.

<a id="c-16"></a>

## C-16

**Patel, S., Hou, B. L., Purohit, A., Xu, K., Pan, J., He, H., Chen, V. (2026). [EMPIRICAL]** *Is Agent Code Less Maintainable Than Human Code?* arXiv:2606.21804. <https://arxiv.org/html/2606.21804v1>

Introduces "CodeThread," turning single-task benchmarks into two-step PR chains to isolate authorship effects on downstream maintainability. Findings (4 models, 4 benchmarks, 1,377 instances): agents building on prior *agent* code underperform agents building on human code in 64.3% of discordant cases, with downstream resolve-rate drops up to 13.1% (refactoring worst, ~8.21 pp avg). Crucially, traditional metrics (cyclomatic complexity, verbosity) don't predict failures: subtle input-validation/error-handling contract changes do. Relevance: the core blind spot of test-pass evals for eval-driven dev: green tests today can hide maintainability/contract debt that breaks the *next* agent or developer.

## Related records housed elsewhere

- [C-1: canonical F-4](foundations.md#f-4)
- [C-5: canonical F-14](foundations.md#f-14)
