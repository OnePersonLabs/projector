# Projector north star

This file is a navigation projection for contributors and agents. The modular [Projector specification](PROJECTOR_SPEC/SPEC.md) remains the sole normative authority.

## Mission

Projector turns an ordinary software idea into a governed semantic transaction: it understands relevant intent, makes only necessary architecture commitments, executes safely, survives interruption, reconciles observed reality, and emits truthful evidence through installed public surfaces.

## Decision filter

Keep work that materially improves at least one of these outcomes:

- A user can move a non-fixture request through the public CLI and an agent-facing surface.
- Canonical semantics remain the single authority while prose, plans, and agent context remain projections.
- Mutation is state-bound, capability-proven, recoverable, and independently verifiable.
- Repeated reasoning becomes deterministic machinery when that lowers cost without weakening assurance.
- The product becomes easier to understand, operate, and extend.

Apply the deletion test: if removing a module, concept, document, or seam does not make required behavior harder to implement or verify, remove it. Prefer a deep module with one justified interface over coordinating shallow machinery.

## Read next

- [Vision and north-star behavior](PROJECTOR_SPEC/01-product/vision-and-north-star.md)
- [Normative principles and non-goals](PROJECTOR_SPEC/01-product/principles-and-non-goals.md)
- [Release definition and readiness gates](PROJECTOR_SPEC/12-delivery/release-and-directive.md)
- [CLI modes and security](PROJECTOR_SPEC/10-operation/cli-modes-and-security.md)

Real-project ready means one installed, held-out project can complete the governed lifecycle through both a documented command path and an operational agent-facing path. It does not mean Projector supports every platform, language, host, or arbitrary code transformation.
