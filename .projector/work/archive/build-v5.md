---
id: build-v5
goal: Implement the approved V5 design in this separate workspace.
ownership:
  - owner: root
    paths:
      - plugins/projector-v5/runtime/cli.mjs
      - plugins/projector-v5/runtime/meaning.mjs
      - plugins/projector-v5/runtime/projector.mjs
      - plugins/projector-v5/runtime/providers/common.mjs
      - plugins/projector-v5/runtime/providers/direct.mjs
      - plugins/projector-v5/runtime/providers/import-index.mjs
      - plugins/projector-v5/runtime/providers/index.mjs
      - plugins/projector-v5/runtime/providers/lsp.mjs
      - plugins/projector-v5/runtime/repair.mjs
      - plugins/projector-v5/runtime/state.mjs
      - plugins/projector-v5/runtime/work.mjs
      - test/clip-integration.test.mjs
      - test/core.test.mjs
      - test/providers.test.mjs
      - plugins/projector-v5/.codex-plugin/plugin.json
      - plugins/projector-v5/package.json
      - plugins/projector-v5/package-lock.json
boundaries: &a1
  - plugins/projector-v5/runtime/**
  - test/**
  - docs/**
completed:
  - Readable meaning, three skills and native execution steering
  - Focus, discovery, reconciliation and source-bound provider adapters
  - Owned staged repair, recovery and local convergence stops
  - 31 deterministic tests and independent review resolved
  - Isolated package smoke and portable archive
questions:
  - C# and full framework runtime evidence require a suitable environment
  - Psychord maintenance benefit remains a hypothesis for actual use
uncertainMutations: []
status: active
snapshot:
  patterns: *a1
  inputs:
    - path: docs/approved-plan.md
      hash: bbe3d0db3807839e370c45d9a6ff5a5877115e281e1e4accb707823598ce2656
    - path: docs/implementation-report.md
      hash: a120b1084d1b83a2dd25a0f83d24320521456d8680084265b719da226026ab28
    - path: docs/interfaces.md
      hash: 0b02d23426b6d6d377d920358a3db7205e816f1c0f90c3ad5e1ccdd192789ac1
    - path: docs/verification.json
      hash: 371b5962dc133e2d7fc269fd22f31d43fa571141faed1198a3384b1f467aecf7
    - path: plugins/projector-v5/runtime/cli.mjs
      hash: 05d9539665d9eac27123f9ca94c8d4eaa18c1eb021b9eb8bbdc50b37f1875fa9
    - path: plugins/projector-v5/runtime/meaning.mjs
      hash: 7c91ed6cce7e2a7423c732fd251cf7ba4c06ef07b32c67ef446d5297a5592f98
    - path: plugins/projector-v5/runtime/projector.mjs
      hash: d01fa5c642a5491a8ecbef5927d9b3fcfa1c7a2d4f13cdf845afe71774a9d7f3
    - path: plugins/projector-v5/runtime/providers/common.mjs
      hash: d1a1e3a28a5ef01ebc23f77cf199e279bb445a309f690c908e42f9fe871801d6
    - path: plugins/projector-v5/runtime/providers/direct.mjs
      hash: 1fc57fcbf41b3b7a96bdc676a9383f52d1d9582ea79ea2df940feda5caf998c1
    - path: plugins/projector-v5/runtime/providers/import-index.mjs
      hash: 66c717a26f436844aad21acf277a43b0632c7dc8150f065619c74f156a85d1c0
    - path: plugins/projector-v5/runtime/providers/index.mjs
      hash: 5c59bb480290ee851cd63e6da78b244b01c3478fabd56bc179b6c0ef296ac7b5
    - path: plugins/projector-v5/runtime/providers/lsp.mjs
      hash: ca65840dac1ce8991b650d159d66e826e9bf2eb360595a5fb96bee62dccd537f
    - path: plugins/projector-v5/runtime/repair.mjs
      hash: 654991770a61bef04cebeb77e5c1db0a4f08cfd95296accf3ee2ca29901b03c1
    - path: plugins/projector-v5/runtime/state.mjs
      hash: e3a3e220f3255019a578db52f5e93d59d44b079772568bec6ed491d6fb5f8739
    - path: plugins/projector-v5/runtime/work.mjs
      hash: c8c136fbb04caa41ba1314e9084f151d703950438a431195424d6c2844059228
    - path: test/clip-integration.test.mjs
      hash: 48ae264f5fa90df4381c1bbbb2d6381117163fa556b87506fbf6fa173ce666a5
    - path: test/core.test.mjs
      hash: fc137528b42682013ec09ea2d9ca99985531a988ace5cfe226f06d0f2bede2b2
    - path: test/providers.test.mjs
      hash: 8b63c1d17c1f9bfd3f9cbe344dd61b8029bc52160d4add7db6de1dc1855b31f0
  fingerprint: b84721c2457dcafb0ea028d16903d27a5178f4650a0bc2511cbfa4336c71d486
---
The implementation is delivered. See docs/implementation-report.md for checks and remaining coverage gaps, docs/approved-plan.md for the baseline, README.md for use, and docs/verification.json for checked source identities. All writers and reviewers completed. V3 was not edited or enabled; no AI trial, activation, commit or publication occurred.
