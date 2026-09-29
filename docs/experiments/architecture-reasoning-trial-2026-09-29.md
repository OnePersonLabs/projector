# Architecture reasoning workflow trial

This experiment tested whether a proposed default architecture reasoning procedure improved Codex work enough to justify its cost. It did not. Both trial arms produced correct results at every sealed checkpoint, while the Projector arm used 2.84 times as many model tokens and took 2.34 times as long in the main workload. The candidate procedure was therefore removed from the default `$projector` skill.

The result applies to the tested procedure and workload. It does not establish that retained project meaning or Projector as a whole has no value. Deterministic product improvements developed alongside the trial remain because they address independently verified failures.

## Question and adoption rule

The candidate procedure asked the agent to trace architectural uncertainties through producers, state ownership, consumers, ordering, and cleanup; consult relevant design artifacts; construct a concrete failure trace; and recheck query membership when a consumer appeared after planning.

The trial compared that procedure, delivered through a real installed Projector MCP and skill, with ordinary Codex using the same source packet, model, reasoning effort, prompts, and sealed evaluator. At equal correctness, adoption required the Projector arm to reduce total model tokens by at least 10 percent while taking no more than 10 percent longer. A tie, an unknown result, or uncompensated overhead meant the procedure would not become a default.

## Fixture and controls

The fixture used 343 files and 3,025,892 bytes copied from the Psychord source tree. A later checkpoint introduced three more files totaling 22,512 bytes. Four narrow regressions were seeded across audio initialization, recognition lifecycle state, and duplicated session arranger behavior.

The sealed evaluator was qualified before either arm ran:

- Each seeded negative failed only its intended assertion.
- Corrected reference implementations passed 29 of 29, 43 of 43, and 73 of 73 assertions at the three qualification checkpoints.
- A legacy-only repair failed after the late consumer appeared, proving that the evaluator distinguished a partial fix from a complete one.
- The audio check exercised adapter lifecycle behavior with platform I/O replaced by a fake. It did not test physical hardware or an external audio provider.

Each arm ran in a separate Git repository. Every checkpoint started a fresh `codex exec` process using `gpt-6-sol` at medium reasoning effort. The Projector arm used actual installed MCP operations and the candidate skill text. Projector responses were not simulated.

## Results

Both arms passed every completed sealed checkpoint:

| Checkpoint | Ordinary Codex | Projector arm | Observed quality difference |
|---|---:|---:|---|
| Initial repair | 29/29 | 29/29 | None |
| Lifecycle repair | 46/46 | 46/46 | None |
| Late-consumer planning and repair | 77/77 | 77/77 | Both found and repaired the original and newly introduced consumers |

The completed main workload had these measured costs:

| Measure | Ordinary Codex | Projector arm | Projector difference |
|---|---:|---:|---:|
| Input tokens | 3,169,601 | 9,026,518 | +184.8% |
| Output tokens | 23,266 | 36,603 | +57.3% |
| Input plus output tokens | 3,192,867 | 9,063,121 | +183.9% |
| Elapsed time | 614.272 seconds | 1,439.563 seconds | +134.4% |
| Shell command calls | 94 | 102 | +8.5% |
| MCP calls | 0 | 47 | 47 additional calls |

The input-token totals already include cached input. Cached input is shown by the runtime as a subset of input and was not added a second time. These figures measure model tokens reported by the execution runtime, not dollar cost.

Two controls checked whether the added workflow imposed cost on work that should remain small:

| Control | Ordinary Codex | Projector arm | Projector difference |
|---|---:|---:|---:|
| Input plus output tokens | 527,262 | 1,620,484 | +207.3% |
| Elapsed time | 155.368 seconds | 363.140 seconds | +133.7% |

The controls consisted of a trivial heading edit and an already-correct task. Both arms avoided a false production repair in the already-correct task. Across the main workload and controls, ordinary Codex used 3,720,129 tokens and 769.640 seconds; the Projector arm used 10,683,605 tokens and 1,802.703 seconds.

The Projector arm sometimes added stronger local tests and deliberately checked that a reset-related mutation failed. Those choices did not produce a sealed correctness advantage in this trial. Neither arm required a repair after hidden evaluation.

## Adoption decision

The candidate default procedure failed the adoption rule. It matched ordinary Codex on observed correctness while exceeding both cost limits by a large margin. The procedure was removed from the default `$projector` skill.

The following product changes remain because they solve separate, measured problems:

- MCP tool schemas reuse shared definitions, reducing the advertised schema payload from 208,015 bytes to 124,838 bytes in the measured tool set. This is a byte measurement, not a billing-token claim.
- Retained contexts support exact paged inspection and full reconstruction without fixed repository-size or response-size cutoffs.
- Independent completion validates resolved validator evidence and rejects correlated or deterministic-transform substitutes.
- Change proposal prose no longer has implicit 4 KiB and 16 KiB limits.
- A narrow canonical-authority reconsideration path can repair an authority record whose unsupported historical evidence made the repair itself appear blocked.

## Limitations

This was one paired trial over a selected Psychord source packet. It did not run a full Psychord build, physical audio hardware, external services, or a completed workspace migration. The late game-owned consumer was a trial adaptation of real source rather than a production migration.

One initial Projector run stopped because the external account reached its usage limit. It produced no complete usage record and was excluded. The Projector arm was rebuilt from the same baseline and rerun successfully as checkpoint `1r`. The failed run remains part of the experiment evidence but does not contribute to the comparison totals.

The result is deliberately narrow: this default reasoning procedure did not earn its weight in this workload. A future procedure should be adopted only after it demonstrates a compensating quality or efficiency gain under another predeclared, discriminating trial.
