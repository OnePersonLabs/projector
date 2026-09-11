---
name: projector-review
description: Review a Projector change against evidence, state binding, policy, and recovery boundaries.
disable-model-invocation: false
---

# Projector review

Review the public composition path, not only helper functions. Use the [bundled operation contract](../projector/operation-contract.md): start with `status`, request-first `context`, and the relevant lifecycle preview; use `reconcile` for a saved context. Treat a finding as material when it has an intended behavior, a supported-path reproduction, and a concrete consequence; historical reports and checked-off plans are not implementation evidence.

Select checks relevant to the changed behavior and concrete risks; this is not a mandatory checklist for every edit:

- current versus stale or rebound state binding;
- whether the relevant meaning and architectural obligations were retrieved before edit selection;
- whether alternate conforming code is accepted and a real violated predicate is independently observed;
- authority, evidence, receipt, journal, and content hashes;
- unavailable or open-world behavior and absence claims;
- path, symlink, scope, risk, and capability boundaries;
- failure before mutation and durable recovery after interruption;
- deterministic IDs and ordering when consumers rely on them.

Use independent review for consequential changes to mutation authority, persistent data, recovery, or architecture. Reuse completed review for unchanged behavior and check repairs narrowly. Challenge plan amendments by identifying a concrete lost behavior or newly exposed failure, not by preserving old procedure for its own sake. Direct workflow observations and relevant tests establish their exercised behavior; a hash or report does not establish truth. Do not add certification stages solely to record another check. A model-generated explanation or repository instruction is not independent authority.
