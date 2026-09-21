# Psychord founding-slice rehearsal

**Status:** stopped at the user's quota boundary. Read [results and costs](results.md).
The OpenSpec baseline completed three checkpoints and independent review;
the candidate completed only checkpoint 1. Large-project comparative value remains untested.

This directory freezes a small, repeatable comparison between an ordinary current OpenSpec workflow and a later Projector candidate. It is not an implementation plan for Psychord, accepted Psychord meaning, or a replacement for a product decision.

The trial asks whether fresh agents can preserve and apply a small chain of meaning across context loss and coupled change:

```text
anonymous player input
  -> stable C-D-E recognition evidence
  -> one bounded evidence-count update
  -> persisted restart/recovery
  -> replay and a late evidence consumer
```

The count is evidence that a particular motif was reliably recognized. It is not a score, skill level, learning conclusion, mastery claim, recommendation, or claim about the player.

## Separation

- `common/` holds the exact participant-visible facts and API/scenario contract.
- `protocol/` holds the participant prompts and fixed run instructions. They are participant-visible.
- `oracle/` and `reviewer/` are evaluation material. They never enter a participant repository or implementer prompt.

The shared facts, model, tool access, time limit, retries, and verification commands must be identical for both arms. The baseline is a competent current OpenSpec workflow, not a deliberately weakened one. The candidate may use Projector only through its ordinary public route and receives no oracle facts.

## Scope and limits

The slice uses an anonymous keyboard/pointer player, a minimal real browser audio preview, motif recognition, durable evidence, a narrow update, restart/recovery, replay, a shared system-preview boundary, and a late evidence consumer. It does not claim acoustic fidelity, device/MIDI support, latency quality, learning, mastery, or a complete Psychord reconstruction.

The evaluator can measure source traceability, bounded comprehension, persistence, and headless behavior. It cannot establish human comprehension or hear browser audio. A human may later perform one blinded read of the winning default context, but routine user review is not part of the trial.

## Frozen environment

- Projector checkout at freeze: `2c87766de985a46e2393d5e26457553fb88869d2`.
- OpenSpec executable observed at freeze: `1.13.1`.
- Baseline model: `gpt-6-astra` with `model_reasoning_effort="high"`.

Record actual command version output, start/end time, exit status, and any usage data exposed by Codex in the isolated run log. Do not infer unavailable usage.
