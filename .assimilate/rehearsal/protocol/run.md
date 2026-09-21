# Rehearsal run protocol

## Frozen fairness conditions

Use a new external Git repository per arm. It contains only participant-visible briefs, generated OpenSpec setup for baseline, source, and run logs. Never copy `oracle/` or `reviewer/` into it.

Both arms use the same briefs/facade, `gpt-6-astra`, `model_reasoning_effort="high"`, local Node/npm/pnpm, browser automation availability, retry limit, and headless/build expectations. Foundation has a 30-minute wall-time ceiling. Checkpoints 2 and 3 each have a 10-minute wall-time ceiling and a target of no more than 12,000 generated tokens. One independent review has an 8-minute wall-time ceiling. Record generated tokens, uncached input, cached input, and wall time whenever Codex exposes them; do not silently reinterpret an exceeded ceiling as a pass or substitute weaker routes.

The baseline foundation run exceeded the original 60,000 total-token ceiling in reported input accounting. Preserve that overrun as comparison cost. The later candidate foundation run retains the original 30-minute allocation but is instructed to target no more than 40,000 generated tokens and to use concise inspection/output. This correction changes neither facts nor oracle conditions.

Baseline OpenSpec is installed `1.13.1`. Initialize with `openspec init --tools codex --no-copilot-cloud`. The observed freeze profile is `custom` with `explore,new,continue,apply,ff,sync,archive,bulk-archive,verify,onboard`; record actual project instructions. Candidate does not install/read OpenSpec unless its accepted candidate design independently requires it.

## Setup

1. Create an empty external directory and `git init`; never place it under Projector checkout.
2. Copy all three public briefs into `briefs/`. Copy the active brief to `PARTICIPANT.md` for each checkpoint. Future briefs remain visible shared facts, but each participant prompt authorizes implementation only of its active brief.
3. Baseline only: initialize OpenSpec, then commit initialization and briefs as `trial: initialize baseline`.
4. Write stdout/stderr and Codex `--output-last-message` to `logs/` for every checkpoint.

## Fresh checkpoints

Run three separate `codex exec` invocations -- never resume/fork:

1. foundation uses `01-foundation.md`;
2. replace `PARTICIPANT.md` with `10-follow-on-provenance.md`, use `02-provenance.md`;
3. replace `PARTICIPANT.md` with `20-follow-on-replay-consumer.md`, use `03-replay-monitor.md`.

```powershell
Get-Content -LiteralPath '<prompt-path>' -Raw |
  codex exec -m gpt-6-astra -c 'model_reasoning_effort="high"' -C '<external-workspace>' -s workspace-write --json --output-last-message '<external-workspace>\logs\checkpoint-N-final.md' - |
  Tee-Object -FilePath '<external-workspace>\logs\checkpoint-N.jsonl'
```

`codex exec` 0.155.1 rejects the top-level `-a` approval flag; do not pass it. Preserve the `exec_command` session ID when the host returns one and poll that same process with `write_stdin`; do not start or resume a second writer while the first remains active. If host transport ends before the process, record it neutrally and continue polling the original writer. If model/configuration is rejected, record error and stop the arm. Do not substitute. If a command needs more than one retry or a browser preview is unavailable, record it and continue only when behavior can be verified honestly. Do not hand-repair code between checkpoints. For checkpoints 2 and 3, keep tool output terse and run browser checks only for the changed behavior or a previously failing case.

## Measurement/review

Extract only usage fields present in Codex JSON logs into `logs/usage.md`; otherwise write `unavailable`. At end use the fixed reviewer on each arm with same reviewer model/prompt/input cap. Keep review to concrete diffs, producer/consumer/persistence traces, and held-out facade cases. Preserve scorecard, test/build logs, artifact count, per-checkpoint context word count, dependency-delta commit, and human-stopping/recovery count.

No arm wins by fewer tokens, smaller artifacts, or hidden information. It passes only with no reviewer hard fail, preserved obligations, explicit unknowns, materially useful default context, and a demonstrated advantage in consequence detection, continuation/recovery, or independent review.
