# Projector V5 implementation

Implemented in `C:/dev/projects/projector-v5` on 2026-10-02 and 2026-10-03. The baseline is [the approved plan](approved-plan.md). The initial implementation preserved V3 and ran no AI-consuming trials. The later user request authorized renaming, activation, local installation, old-plugin removal, and publication on branch `v5`.

## Delivered design

| Approved commitment | Implementation |
| --- | --- |
| Recover intent and original vocabulary | Readable Concept, Lens, and Pattern pages; typed Relations; source-bound Projection Units. Reasons, exceptions, alternatives, and reopening assumptions remain in authored Markdown. |
| Native execution and coordinated throughput | Short consumer AGENTS.md plus four skills and project-scoped hooks. The native root owns meaning and checkpoints; workers own actual output surfaces. No Projector scheduler or global observation lock. |
| Selective context | `focus` returns a thin index or a selected packet and links. Related records do not recursively hydrate the graph. |
| Refresh discovery | `revisit` refreshes selected populations, explicit observations, directive boundaries, and literal queries. Changed files outside saved selectors become discovery questions. |
| Agreement with current code | `reconcile` combines source snapshots, authored coverage, native check receipts, and provider observations. Each condition retains participant-specific supported, mismatch, or unresolved results. |
| Source and evidence currentness | File content and membership hashes; condition/Lens/check revisions; native environment, target, and configuration binding. Final publication rechecks earlier evidence after all selected Lenses finish. |
| Language-neutral observations | Generic explicit stdio LSP; packaged HTML/CSS/SCSS services; source-bound index import; literal discovery for framework seams. No custom language engine or TypeScript refresh path. |
| Recovery without replay | Durable directive checkpoint; expected output hashes; staged producer output; before images; inspectable apply and rollback records. Physical ownership prevents aliases from splitting a write surface. |
| Local convergence stops | Two matching failed explanations or recurrence of an earlier owned-output state stop that strategy. The native root handles conflicting accepted obligations. Independent work can continue. |
| Maintenance that earns its cost | Conditional meaning updates, candidate learning, explicit scoped Pattern-to-Lens acceptance, recoverable closed work, and disposable caches. Distillation preserves authority and counterexamples. |
| Exit from Projector | Application code and meaning are ordinary files. Native checks run directly. Plain OpenSpec and hand-checked development remain available. |

The helper currently discovers Units at file granularity. A Unit can represent a coordinated implementation group; provider symbol and location facts guide investigation inside it. File participation does not establish behavior for every symbol. Discovery globs and check input/coverage declarations are authored evidence boundaries; they do not prove arbitrary check code is complete.

## Verification

`npm.cmd test` passed **42 tests, 0 failed, 0 skipped**, with exit code zero. The integrated run took about four seconds. Activation checks cover Git boundaries, quiet inactive hooks, inactive runtime calls, preserved recovery data, and same-session disable handling. The suite covers core behavior, provider protocols and direct services, source-bound imports, file discovery, and the shared Clip integration scenario. The four discovery tests also passed in WSL.

The Clip checks actually execute JavaScript playback/export, Python persistence, and Rust playback. They exercise alternate handwritten implementations and the explicit committed-edit counterexample. Other checks cover moved source, a new consumer without coverage, static versus runtime evidence, relevant versus unrelated drift, failed observations, and stale dependencies across Lenses. They also cover preserved original mismatch, local repair stops, cache removal, and recoverable closed work.

Recovery tests include an injected failure during the second rollback write. Resume retains the interrupted rollback and mixed output state. Explicit recovery completes it. A known unrelated edit causes preflight refusal before any restoration. Aliases and reordered outputs cannot bypass ownership or prior-state recurrence.

The portable npm archive includes the six direct dependencies and their runtime dependency closure: **15 dependency packages**, about **2.4 MB compressed**. An isolated temporary-directory smoke verified that all six imports resolve inside the unpacked package. The attack-shaped glob input, subsequent ordinary discovery, CLI help, checkpoint creation, selective focus, native Clip checks, and SCSS symbols passed. Full Clip reconciliation correctly returned unresolved with exit code 2 because some runtime participants remain unverified.

An independent `opl-reviewer` used source review, in-memory filesystem/process probes, and actual HTML/CSS observations. All material findings and the shutdown regression finding were resolved. Current checked source identities are recorded in [verification.json](verification.json). The activation/publication delta also received independent review.

## Local installation

`opl-projector@opl-projector` is installed and enabled in Windows and WSL user-level Codex homes. The native installer verified trust for both installed hooks in each environment. V5 is activated in its own checkout. Other projects require their own explicit activation; V3 and V4 source checkouts remain intact.

The marketplace source is the locally prepared `.plugin-build/opl-projector` bundle. A raw GitHub marketplace checkout requires preparation before native installation. The npm archive is portable and contains the dependency closure. Preparation preserves the no-dependency-scripts policy and accounts for npm 12's pack JSON and inherited allow-scripts configuration behavior.

Native installer enablement and hook trust were verified. Child-process probes verify hook output; delivery from a fresh native session and model skill selection have no AI trial evidence. Open a fresh session to load installed components.

## Reviewable commit policy

The later user request adds reviewable local commits to the activated-project workflow. Conditional consumer guidance declares the default; the execution skill defines coherent units and messages; its routed reference handles shared-index and mixed-edit cases. Activation explains the default. More specific user and repository rules take precedence. Publication and history changes remain separate actions.

The policy keeps dependent implementation, consumers, checks, and necessary meaning together. It allows broad units when artificial splitting would make intermediate states misleading. It preserves other staged and working changes, and leaves a unit uncommitted when safe isolation is unavailable. There is no commit daemon, fixed size limit, additional lock, or separate history ledger.

Validation for the commit-policy instruction change used skill metadata, reference resolution, prose review, and independent review. That change left runtime source unchanged, with 38 deterministic runtime checks as baseline evidence. The later discovery security fix has separate runtime verification. No skill-invocation test or AI trial establishes future model compliance with this policy.

## Discovery security fix

The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) had no patched release. Discovery now uses `glob` 13.0.6 through its public `glob/raw` entrypoint, with locked `minimatch` 10.2.6 and `brace-expansion` 5.0.12. The default minified entrypoint embeds an older parser that reproduced a stack overflow even with a clean npm audit. The unbundled entrypoint uses the patched dependency closure. Projector adds no pattern-depth quota.

The filesystem adapter preserves non-ENOENT scan errors that the glob library otherwise suppresses. Selection checks cover negation, brace alternatives and numeric ranges, extglobs, dotfiles, deduplication, ignored directories, file-only populations, symlinks, and project confinement. The former parser failed on a 4,900-level brace pattern below its input-length cap. The current runtime and unpacked archive complete parsing without stack exhaustion. WSL reports ENAMETOOLONG for the resulting literal path; that error remains visible, and subsequent ordinary discovery works. `npm audit --prefix plugins/opl-projector --json` reports **0 vulnerabilities**.

## Real language-server evidence

| Engine and setup | Observed result |
| --- | --- |
| Rust Analyzer 1.98.1, native executable with no arguments | Symbols complete/current; four symbol facts; advertised engine version; graceful shutdown without gaps. The definition request at the smoke position returned no location, so Rust definition behavior is not established by that request. |
| Pyright 1.1.414 through Node and its actual entrypoint | Five symbols and two definition locations, current source. Final results are partial solely because the server did not report its version through initialization. |
| TypeScript Language Server 6.0.1 with an explicit existing TypeScript 5.9.3 `tsserver.js` path | TS: five symbols and two definitions. TSX: five symbols and one definition. Current source; partial due missing standard initialization version metadata. |
| Packaged HTML 5.6.2 and CSS 6.3.10 services | Actual direct service observations and deterministic symbols/navigation/validation checks passed within their declared capabilities. HTML diagnostics and cross-file HTML references remain gaps. |

Windows npm wrappers were avoided by using Node and the installed server entrypoints. Rust Analyzer defaults to stdio and rejects `--stdio`. The generic adapter sends zero-parameter shutdown correctly. TypeScript setup reused an existing library file from V3 without editing that checkout; V5 does not depend on that path. Consuming repositories supply their own explicit language-server setup.

Missing server-version metadata remains a provenance gap. V5 does not add a TypeScript-specific protocol branch to make that gap disappear. Real smoke requests used a 30-second caller resource budget. A budget did not establish correctness or trigger tuning. Each adapter call awaited its child close event; an unrelated pre-existing Rust Analyzer process was left intact.

## Limits and next use

C# runtime and a real C# language server were not exercised because this machine has no .NET SDK. C# and all requested source-language IDs have protocol-boundary checks. Full Tauri, NativeScript, React Native, TSX rendering, and browser interaction were not exercised. The examples expose these seams and keep their runtime claims unresolved. Indented `.sass` is outside the approved scope.

This workspace is a Git checkout connected to `https://github.com/OnePersonLabs/projector`, with V4 retained as the parent of branch `v5`. Meaning in a consuming Git repository can use its ordinary history. No automatic distillation quality, long-project economics, or eventual convergence has been established by these deterministic checks. Agent interpretation, check completeness, and framework delivery still need evidence from actual work.

Use the [README](../README.md) to try the helper. Use [the plugin reference](../plugins/opl-projector/references/guide.md) for request formats. Keep the first Psychord directive's actual friction and benefit in its checkpoint. If upkeep dominates that work, revise or suspend the costly Lens while continuing native development.
