# Agent trajectories and tool use

**Dated source annotations, not fresh verification.** Read the [catalogue status](INDEX.md) before relying on numerical or product claims.

[Catalogue index](INDEX.md) · [Research map](../INDEX.md)

<a id="a-1"></a>

## A-1

**Anthropic Applied AI / Engineering (2026). [VENDOR]** *Demystifying evals for AI agents*. Anthropic Engineering blog. <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents>

**Consolidated identifiers:** A-1, M-5.

The supplied vendor guidance defines tasks, trials, graders, transcripts, and harnesses; recommends grading outcomes rather than prescribing paths unnecessarily; distinguishes capability from repeatability; and combines code, model, and human checks. It suggests beginning with a manageable set of real failures, separating capability from regression cases, and inspecting transcripts to debug both agents and graders. The cited CORE-Bench example changes substantially after correcting evaluation/scaffolding defects; the annotations vary in how they describe the cause, so the exact causal attribution should be rechecked. This is engineering guidance with illustrative cases, not a controlled comparison proving one harness universally superior.

<a id="a-2"></a>

## A-2

**Yao, Shinn, Razavi, Narasimhan (2024). [EMPIRICAL]** *τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains*. arXiv:2406.12045. <https://arxiv.org/abs/2406.12045>

Sierra/Princeton benchmark of dynamic agent↔simulated-user conversations with domain APIs and policy docs (retail, airline). Two evaluation innovations: (1) grade by comparing final *database state* to an annotated goal state; (2) the `pass^k` reliability metric. Findings: GPT-4o <50% success; `pass^8` <25% in retail (severe inconsistency). Relevance to EDD: a template for evals-as-spec: encode policy + goal state, then test consistency, not just a single pass.

<a id="a-3"></a>

## A-3

**LangChain: AgentEvals / LangSmith docs (2024-2025). [PRACTITIONER]** *How to evaluate your agent with trajectory evaluations*. LangChain docs. <https://docs.langchain.com/langsmith/trajectory-evals>  (and repo: <https://github.com/langchain-ai/agentevals)>

Concrete tooling for trajectory/tool-call evaluation. Trajectory-match modes: `strict`, `unordered`, `superset`, `subset`: plus `tool_args_match_mode`/overrides for argument equality, and an LLM-as-judge trajectory evaluator (with/without reference). Worked: deterministic, cheap process checks for well-defined workflows. Limits: strict matching is brittle (echoes A-1's warning); LLM-judge is non-deterministic and costs a call. Relevance to EDD: ready-made primitives for asserting tool-call correctness in CI-style agent tests.

<a id="a-4"></a>

## A-4

**Barres, Dong, Ray, Si, Narasimhan (2025). [EMPIRICAL]** *τ²-Bench: Evaluating Conversational Agents in a Dual-Control Environment*. arXiv:2506.07982. <https://arxiv.org/abs/2506.07982> (Sierra writeup: <https://sierra.ai/blog/benchmarking-agents-in-collaborative-real-world-scenarios)>

Extends τ-bench to *dual control*, where agent and user both act on a shared environment (domains: Mock, Airline, Retail, Telecom). Uses a *compositional task generator* over verifiable atomic actions (e.g. "toggle mobile data") to scale task complexity with automatic checking. Finding: up to ~25-point task-success drop moving from solo to interactive/guiding mode (incl. GPT-4.1, o4-mini): guiding a human is the hard part. Relevance to EDD: shows process/interaction quality, not just final state, must be in the spec for human-in-the-loop agents.

<a id="a-5"></a>

## A-5

**Zhou, Xu, Zhu, et al. (2023/ICLR 2024). [EMPIRICAL]** *WebArena: A Realistic Web Environment for Building Autonomous Agents*. arXiv:2307.13854. <https://arxiv.org/abs/2307.13854>

812 long-horizon tasks across self-hosted Shopping, Reddit, GitLab, CMS, and Map sites; natural-language intents graded by programmatic success checks on the resulting environment state. Result: best GPT-4 agent 14.41% vs 78.24% human. Relevance to EDD: gold-standard pattern of *execution-based* outcome grading on a real, stateful environment rather than string matching.

<a id="a-6"></a>

## A-6

**Koh, Lo, et al. (2024). [EMPIRICAL]** *VisualWebArena: Evaluating Multimodal Agents on Realistic Visual Web Tasks*. arXiv:2401.13649. <https://arxiv.org/abs/2401.13649>

910 visually-grounded web tasks (Classifieds, Shopping, Reddit) requiring image-text comprehension and spatial reasoning. Best multimodal agent ~16.4% success: OCR/grounding are the bottleneck. Relevance to EDD: extends execution-based agent eval to multimodal/GUI tasks where the "output" is a sequence of grounded actions.

<a id="a-7"></a>

## A-7

**Xie, Zhang, Chen, et al. (2024/NeurIPS 2024). [EMPIRICAL]** *OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments*. arXiv:2404.07972. <https://arxiv.org/abs/2404.07972>

369 real-computer tasks (Ubuntu/Windows/macOS apps, file I/O, multi-app workflows) each with an initial state and an *automated execution-based verification script*. Best model 12.24% vs 72.36% human; failures dominated by GUI grounding and operational knowledge. Relevance to EDD: demonstrates per-task verifier scripts as reusable, deterministic graders for open-ended computer-use agents.

<a id="a-8"></a>

## A-8

**Mialon, Fourrier, Swift, Wolf, LeCun, Scialom (2023). [EMPIRICAL]** *GAIA: a benchmark for General AI Assistants*. arXiv:2311.12983. <https://arxiv.org/abs/2311.12983>

466 multi-step questions (300 held out for leaderboard) needing reasoning + multimodality + web browsing + tool use, with short factual answers gradable by quasi-exact match. Design philosophy: conceptually simple for humans (92%), hard for AI (GPT-4+plugins 15%): robustness on easy-for-humans tasks as an AGI signal. Relevance to EDD: cheap-to-grade outcome checks (string answers) layered on top of hard multi-step tool-use trajectories.

<a id="a-9"></a>

## A-9

**Kwa, West, Becker, Deng, et al.: METR (2025/NeurIPS 2025). [EMPIRICAL]** *Measuring AI Ability to Complete Long (Software) Tasks*. arXiv:2503.14499; blog <https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/>

Introduces the *50%-task-completion time horizon*: the human task-length a model completes with 50% probability: measured by timing human experts on HCAST + RE-Bench + 66 short tasks (SWAA). Finding: ~7-month doubling 2019-2025 (possibly accelerating post-2024); Claude 3.7 Sonnet ≈59 min; ≈100% success under 4 min, <10% over ~4 hr. Explicitly discusses autonomy/dangerous-capability implications. Limits: authors flag external validity as the dominant uncertainty and that "messiness"/codebase familiarization affects estimates. Relevance to EDD: capability evals as a forward-looking guardrail: a quantitative way to bound how long an agent should be trusted to run unsupervised.

<a id="a-10"></a>

## A-10

**Ma, Zhang, et al.: HKUST-NLP (2024/NeurIPS 2024 Oral). [EMPIRICAL]** *AgentBoard: An Analytical Evaluation Board of Multi-turn LLM Agents*. arXiv:2401.13178. <https://arxiv.org/abs/2401.13178>

Benchmark + open evaluation toolkit for partially-observable, multi-round agent tasks. Key contribution: a fine-grained *progress rate* metric plus breakdowns by sub-skill, difficulty, grounding accuracy, and long-range interaction: going beyond final success. Relevance to EDD: operationalizes partial credit / process visibility, letting eval-driven loops target *where* an agent stalls rather than only whether it passed.

<a id="a-11"></a>

## A-11

**Authors of AgentPRM (2025/WWW 2026). [EMPIRICAL]** *AgentPRM: Process Reward Models for LLM Agents via Step-Wise Promise and Progress*. arXiv:2511.08325. <https://arxiv.org/abs/2511.08325>

Adapts Process Reward Models to agents. Core insight: unlike math reasoning, agent actions have no clean per-step "correctness," so steps are scored by proximity/progress to the goal ("promise and progress") rather than binary labels. Relevance to EDD: a principled basis for step-level / rubric grading of agent trajectories and for process-reward signals in training and gating. (arXiv ID and exact author list not fully cross-checked beyond search metadata: flagged.)

<a id="a-12"></a>

## A-12

**Mohammadi, Li, Lo, Yip (2025/KDD 2025). [POSITION/EMPIRICAL survey]** *Evaluation and Benchmarking of LLM Agents: A Survey*. arXiv:2507.21504; ACM DOI 10.1145/3711896.3736570. <https://arxiv.org/abs/2507.21504>

Survey organizing agent eval along two axes: objectives (behavior, capability, reliability, safety) and process (interaction modes, datasets/benchmarks, metric computation, tooling): and distinguishing outcome vs trajectory evaluation and outcome vs process rewards. Flags under-tested enterprise needs: role-based data access, reliability guarantees, long-horizon interaction, compliance. Relevance to EDD: a map for choosing which eval type matches which guardrail; useful for structuring an eval suite as a spec.

<a id="a-13"></a>

## A-13

**Cao et al. (2026). [EMPIRICAL]** *Beyond Task Completion: Revealing Corrupt Success in LLM Agents through Procedure-Aware Evaluation*. arXiv:2603.03116. <https://arxiv.org/abs/2603.03116>

Introduces Procedure-Aware Evaluation (Utility, Efficiency, Interaction Quality, Procedural Integrity) with multi-dimensional gating that disqualifies "corrupt successes." Finding: 27-78% of reported benchmark successes conceal policy/interaction/integrity violations, traced to task-scope gaps, contradictory reward signals, and simulator artifacts producing accidental passes. Per-model failure signatures differ. Relevance to EDD: hard evidence that outcome-only grading over-credits agents: the strongest argument for adding procedure/trajectory checks to the spec. (2026 preprint; arguments verified, results not independently reproduced: treat as emerging.)

<a id="a-14"></a>

## A-14

**Liu, Yu, Zhang, et al. (2023/ICLR 2024). [EMPIRICAL]** *AgentBench: Evaluating LLMs as Agents*. arXiv:2308.03688. <https://arxiv.org/abs/2308.03688>

First broad LLM-as-agent benchmark across 8 environments (OS, database, knowledge graph, card game, lateral-thinking puzzles, web shopping, web browsing, household), multi-turn and open-ended. Finding: large commercial-vs-open-source gap; principal failure modes are poor long-term reasoning, decision-making, and instruction following. Relevance to EDD: establishes that agent capability is environment-specific, so an eval suite must span multiple stateful task types rather than a single benchmark.

