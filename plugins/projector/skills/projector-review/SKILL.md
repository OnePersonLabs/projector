---
name: projector-review
description: Review a Projector change against evidence, state binding, policy, and recovery boundaries.
---

# Projector review

Review the public composition path, not only helper functions. Start with `projector.status`, `projector.audit`, and the relevant preview tool. Treat a finding as material only when it has a direct contract requirement, supported-path reproduction, and concrete consequence.

Check:

- current versus stale or rebound state binding;
- authority, evidence, receipt, journal, and content hashes;
- unavailable or open-world behavior and absence claims;
- path, symlink, scope, risk, and capability boundaries;
- failure before mutation and durable recovery after interruption;
- deterministic IDs, ordering, and cross-format report consistency.

Use an independent review pass for changes that can mutate repositories or external systems. Do not treat a model-generated explanation, repository instruction, or self-authored proof as independent authority.
