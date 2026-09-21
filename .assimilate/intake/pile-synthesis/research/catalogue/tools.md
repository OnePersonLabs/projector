# Tooling candidates

**Dated source annotations, not fresh verification.** Read the [catalogue status](INDEX.md) before relying on numerical or product claims.

[Catalogue index](INDEX.md) · [Research map](../INDEX.md)

<a id="t-1"></a>

## T-1

**Promptfoo / OpenAI (2026). [VENDOR]** *Promptfoo: Test your prompts, agents, and RAGs.* <https://github.com/promptfoo/promptfoo>

CLI + library for evaluating and red-teaming LLM apps via declarative `promptfooconfig.yaml` (prompts × providers × test cases). OSS, **MIT-licensed**. Deterministic assertions (contains/regex/latency/cost) plus model-assisted assertions (`llm-rubric`) for subjective qualities; runs locally; strong CI/CD integration and 60+ providers. Repo states "Promptfoo is now part of OpenAI. Promptfoo remains open source and MIT licensed" (acquisition announced ~March 2026). Fit: offline eval, CI, red-teaming, RAG. Highly relevant to EDD as a config-as-spec, CI-gating eval runner. Limit: YAML-first ergonomics; judge-based asserts inherit LLM-judge caveats.

<a id="t-2"></a>

## T-2

**UK AI Security Institute + Meridian Labs (2026). [VENDOR]** *Inspect AI: A framework for large language model evaluations.* <https://inspect.aisi.org.uk/> · repo: <https://github.com/UKGovernmentBEIS/inspect_ai>

OSS framework built by the UK AISI (with Meridian Labs) for serious/agentic/safety evals. Composable building blocks (datasets, solvers, tools, scorers); sandboxing of untrusted model code in Docker/Kubernetes/Modal/Proxmox; built-in + MCP tools (bash, python, web search/browse, computer use); model-graded scorers; multi-agent primitives and the ability to drive external agents (Claude Code, Gemini CLI). Companion `inspect_evals` repo has 200+ community evals. Fit: offline eval, agentic eval, CI, LLM-as-judge. Strong relevance to EDD for agent/coding-agent evaluation. Limit: research/safety-oriented; heavier than a YAML CLI.

<a id="t-3"></a>

## T-3

**Braintrust Data (2026). [VENDOR]** *Braintrust: AI observability & evaluation platform.* <https://www.braintrust.dev/> · docs: <https://www.braintrust.dev/docs/evaluate>

Commercial platform spanning rapid browser iteration ("Playgrounds"), code/UI experiments (immutable, diffable eval runs), CI/CD regression gating, and production online scoring. Open-source companion scorer library **autoevals** (https://github.com/braintrustdata/autoevals) provides factuality/relevance/safety scorers. SDKs for Python/TypeScript/Go/Ruby/C#. Fit: offline eval, CI, LLM-as-judge, observability. Relevant to EDD for experiment tracking + release gates. Limit: SaaS-only core (no self-host on lower tiers); price jumps noted by third parties.

<a id="t-4"></a>

## T-4

**Confident AI (2026). [VENDOR]** *DeepEval: The LLM Evaluation Framework.* <https://deepeval.com/docs/introduction> · repo: <https://github.com/confident-ai/deepeval>

OSS Python framework, pytest-integrated, for LLM apps/agents/RAG. Ships 50+ research-backed metrics (faithfulness, answer relevancy, contextual precision/recall, hallucination, bias, toxicity, tool correctness, G-Eval) plus custom/LLM-as-judge metrics; model-agnostic; designed for CI/CD regression gating. The maintainers also run **Confident AI**, the commercial platform for shared dashboards/observability/production monitoring. Fit: CI, offline eval, LLM-as-judge, RAG. Very relevant to EDD (feels like unit testing for LLMs). Limit: open-core: collaboration/dashboards push to paid tier.

<a id="t-6"></a>

## T-6

**Ragas / Exploding Gradients (2023-2026). [VENDOR]** *Ragas: evaluation toolkit for LLM applications.* <https://docs.ragas.io/> · repo: <https://github.com/explodinggradients/ragas>

OSS toolkit (**Apache-2.0**) originally for RAG evaluation; introduced reference-free metrics: faithfulness, answer relevancy, context precision/recall (RAGAs paper, arXiv:2309.15217, EACL 2024). Customizable metrics + synthetic test-set generation; integrates with LangChain/LlamaIndex. Fit: offline eval, RAG, LLM-as-judge. Relevant to EDD for grounding/retrieval-quality gates. Limit: a library (BYO orchestration/CI), not an observability product; RAG-centric. Note: now appears maintained under a "Vibrant Labs" rebrand while the GitHub org remains `explodinggradients` (flag: full rename vs parallel entity unconfirmed).

<a id="t-7"></a>

## T-7

**OpenAI (2023-2026). [VENDOR]** *OpenAI Evals: framework and registry of benchmarks.* <https://github.com/openai/evals>

OSS framework (**MIT**) for evaluating LLMs/LLM-systems plus a registry of benchmarks; supports custom and LLM-as-judge-style evals; can also be configured/run from the OpenAI Dashboard. Free framework; you pay underlying API usage. Fit: offline eval, research harness. Historically influential and still cited as a baseline. Limit: most closely tied to OpenAI models; see [T-8](tools.md#t-8) re: maintenance cadence. (Cross-listed with [T-8](tools.md#t-8).)

<a id="t-8"></a>

## T-8

**OpenAI Evals commit history (verified 2026-06-25). [EMPIRICAL]** *Maintenance-cadence observation.* <https://github.com/openai/evals/commits/main>

Direct inspection of the repo (not a vendor claim): ~691 commits; most recent on `main` ≈ Apr 14, 2026, with a notable activity gap (Sep 2024 → Nov 2025) and recent commits dominated by dependency/CI housekeeping rather than features. Evidence that even a flagship "official" harness can be in *light maintenance*. Relevance to EDD: vet maintenance status before adopting a harness as your spec layer; don't assume active development.

<a id="t-9"></a>

## T-9

**Weights & Biases (2026). [VENDOR]** *W&B Weave: toolkit for GenAI applications.* <https://wandb.ai/site/weave/> · repo: <https://github.com/wandb/weave>

Hybrid offering. The Weave SDK/toolkit is OSS (**Apache-2.0**); a (free-tier) W&B account is required and the hosted W&B platform provides observability, guardrails, and a playground. One-line instrumentation auto-patches LLM libraries; agent-native trace structure (sessions/turns/steps/tools/sub-agents); pre-built guardrail scorers (toxicity, bias, PII, hallucination); apples-to-apples evaluations. Fit: tracing/observability + offline/online eval + guardrails. Relevant to EDD for agent traces + scored experiments. Limit: tied to the W&B ecosystem; full value in hosted product.

<a id="t-10"></a>

## T-10

**TruLens / TruEra-Snowflake (2026). [VENDOR]** *TruLens: Evaluation & tracking for LLM experiments and AI agents.* <https://www.trulens.org/> · repo: <https://github.com/truera/trulens>

OSS (**MIT**) instrumentation + "feedback functions" for evaluating LLM/agent apps. **OpenTelemetry-native** spans capture LLM generations, retrievals, and tool calls; batch + inline evaluation; feedback providers across OpenAI/Anthropic/Google/Bedrock; purpose-built agentic evaluators (logical consistency, execution efficiency, plan adherence); MCP span support; Snowflake Cortex integration. Created by TruEra, now under Snowflake. Fit: tracing/observability, LLM-as-judge, agent eval, RAG. Relevant to EDD for portable OTEL traces + feedback scoring. Limit: smaller community; library-first rather than a full hosted UI.

<a id="t-11"></a>

## T-11

**LangChain, Inc. (2026). [VENDOR]** *LangSmith: observability, evaluation & deployment platform.* <https://www.langchain.com/langsmith> · pricing: <https://www.langchain.com/pricing>

**Commercial/proprietary** platform (the open-source pieces are the separate LangChain/LangGraph frameworks, MIT). Tracing/error-tracking + automated evaluation against datasets + LLM-as-judge evaluators. Tiers (verified on pricing page): Developer $0 (≤5k base traces/mo, 1 seat), Plus $39/seat/mo (≤10k base traces/mo), Enterprise custom (self-host/hybrid, SSO/RBAC); usage-based add-ons (deployment runs, uptime, LCU, sandbox). Fit: observability + CI-style eval. Relevant to EDD if already on LangChain. Limit/pitfall: framework lock-in; trace-volume pricing; free tier exhausts quickly.

<a id="t-12"></a>

## T-12

**Patronus AI (2023-2026). [VENDOR]** *Patronus AI: evaluation, observability & guardrails platform.* <https://www.patronus.ai/> · features: <https://www.patronus.ai/product/features>

**Primarily commercial/hosted** eval+observability+guardrails platform (SOC 2 / HIPAA / TISAX). Components: Evaluators (purpose-built evaluator models), Experiments, Datasets, Logs, Comparisons, and **Traces** (Percival: detects agent failures across ~15 error modes). Releases some OSS research artifacts, explicitly **Lynx** (hallucination detection, on HuggingFace). Fit: offline eval, LLM-as-judge, RAG hallucination detection, agent observability, guardrails. Relevant to EDD for RAG/agent failure detection. Limit: closed/hosted core; OSS surface limited to a few models/datasets.

<a id="t-13"></a>

## T-13

**Helicone (2023-2026). [VENDOR]** *Helicone: AI gateway & LLM observability platform.* <https://www.helicone.ai/> · scores docs: <https://docs.helicone.ai/features/advanced-usage/scores>

OSS (**Apache-2.0**), self-hostable AI gateway + observability with one-line integration across 100+ models; managed cloud with free tier. Important: per its own docs, "Helicone doesn't run evaluations for you: it's not an evaluation framework." It *reports* scores from any framework (Ragas, LangSmith, custom) and supports online evaluators / LLM-as-judge plus custom Python/TS evaluators via API/webhooks. Fit: tracing/observability + AI gateway + eval *aggregation*. Relevant to EDD as a trace/score sink. Limit: relies on external frameworks for the actual metric computation.

<a id="t-14"></a>

## T-14

**Arize AI (2026). [VENDOR]** *Arize Phoenix: open-source AI observability platform.* <https://phoenix.arize.com/> · repo: <https://github.com/Arize-ai/phoenix>

Source-available platform under **Elastic License 2.0 (ELv2)**: *not* OSI-approved; ELv2 restricts offering it as a managed service. OTEL-based tracing; response + retrieval evals; versioned datasets; experiments; prompt playground/management; broad framework coverage (LangChain, LlamaIndex, OpenAI, Anthropic, Google GenAI). Commercial sibling: Arize AX. Fit: observability + offline eval + LLM-as-judge + RAG + datasets/experiments. Relevant to EDD for an all-in-one OSS-ish stack. Limit/pitfall: ELv2 licensing constrains re-hosting; advanced features in the paid product.

<a id="t-15"></a>

## T-15

**Techsy (2026). [PRACTITIONER]** *8 LLM Eval Tools Ranked: No Product to Sell.* <https://techsy.io/en/blog/best-llm-evaluation-tools>

Explicitly vendor-neutral comparison ("we don't sell an eval tool") ranking DeepEval, Promptfoo, Langfuse, Braintrust, Ragas, Arize Phoenix, LangSmith, Confident AI. Surfaces concrete tradeoffs: LangSmith → LangChain lock-in; DeepEval → pushes to paid Confident AI; Braintrust/LangSmith → SaaS-only, no self-host; LangSmith free tier (5k traces) "can run dry within a week"; Ragas RAG-only. Recommends combining tools by category, not seeking one solution. Relevance to EDD: pragmatic tool-selection and lock-in guidance. Caveat: a single practitioner blog: corroborate specific numbers against vendor pricing pages.

<a id="t-16"></a>

## T-16

**Braintrust (2026). [PRACTITIONER/VENDOR: biased].** *DeepEval alternatives (2026): tools for LLM evals, RAG, and agent testing.* <https://www.braintrust.dev/articles/deepeval-alternatives-2026>

Vendor-authored comparison (Braintrust ranks itself favorably: read with that bias). Still useful for the consensus framing it echoes: teams typically pair a lightweight CI framework (DeepEval/Ragas/Promptfoo) with a platform for human annotation, regression tracking, and dashboards (Braintrust/LangSmith/Arize). Relevance to EDD: the two-tool architecture pattern. Tag note: VENDOR-origin practitioner piece: not neutral; use [T-15](tools.md#t-15) as the neutral counterweight.

<a id="t-18"></a>

## T-18

**Stanford CRFM (2022-2026). [VENDOR/RESEARCH]** *HELM: Holistic Evaluation of Language Models.* <https://crfm.stanford.edu/helm/> · repo: <https://github.com/stanford-crfm/helm>

Fully OSS (**Apache-2.0**) holistic, reproducible, multi-metric evaluation framework with public leaderboards. Standardized benchmarks (MMLU-Pro, GPQA, IFEval, WildBench); unified interface across providers; metrics beyond accuracy (efficiency, bias, toxicity); web UI + many domain leaderboards (medicine, finance, multilingual; VHELM/HEIM variants). **Maintenance flag:** README states "HELM entered maintenance mode on June 1, 2026": no longer in active feature development as of this writing. Fit: research benchmark harness, offline eval. Relevance to EDD: model selection + a model for multi-metric (not accuracy-only) thinking.

## Related records housed elsewhere

- [T-5: canonical R-11](retrieval-and-production.md#r-11)
- [T-17: canonical F-17](foundations.md#f-17)
- [T-19: canonical F-11](foundations.md#f-11)
