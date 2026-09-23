import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { ChangeService } from '../src/change/index.ts';

export const sha = (source: string) => createHash('sha256').update(source).digest('hex');
export const gitFixture = (root: string, ...args: string[]) => execFileSync('git', ['-c', 'core.longPaths=true', ...args], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
export async function put(root: string, name: string, value: string): Promise<void> { const file = path.join(root, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, value); }
export const liveDesign = `---
projectorDesign: 1
id: audio/preview
scope: src
---
# Preview playback

## Contract

Own playback of a requested preview and preserve caller responsibility for event storage.

## Decision: playback

Choice: Restart through the direct replay function.
Reason: Preview requests need an immediate replay path.
Requires: [[spec:audio/preview#Immediate replay]]
Realizes: [[code:src/player.js#replay]]
Evidence: A controlled replay checks the restart count.
`;
export const finalPart = `## Decision: playback

Choice: Restart exactly once through the direct replay function.
Reason: One request must not produce duplicate restarts.
Requires: [[spec:audio/preview#Immediate replay]]
Realizes: [[code:src/player.js#replay]]
Evidence: A controlled replay checks the restart count and preserves caller-owned event storage.
`;
export async function fixture(suffix = ''): Promise<{ root: string; baseline: string; change: string }> {
  const root = await mkdtemp(path.join(tmpdir(), `projector-change-${suffix}`));
  await put(root, '.gitignore', '.worktrees/\n');
  await put(root, 'package.json', '{"name":"playback-fixture","private":true,"type":"module"}\n');
  await put(root, 'src/player.js', 'export function replay() { return 2; }\nexport function retainEvent() { return "user"; }\n');
  await put(root, 'openspec/specs/audio/preview/spec.md', `# Preview playback

## Purpose

Define observable replay behavior while preserving the caller's event ownership.

## Requirements

### Requirement: Immediate replay
The player SHALL replay a preview when the user requests it.

#### Scenario: Replay
- **WHEN** the user requests replay
- **THEN** the preview restarts
`);
  await put(root, 'openspec/designs/audio/preview/design.md', liveDesign);
  gitFixture(root, 'init', '-b', 'main'); gitFixture(root, 'config', 'core.autocrlf', 'false'); gitFixture(root, 'config', 'user.name', 'Projector fixture'); gitFixture(root, 'config', 'user.email', 'fixture@localhost');
  gitFixture(root, 'add', '.'); gitFixture(root, 'commit', '-m', 'Accepted playback baseline');
  const baseline = gitFixture(root, 'rev-parse', 'HEAD'), change = 'single-replay';
  const prefix = `openspec/changes/${change}`;
  await put(root, `${prefix}/.openspec.yaml`, 'schema: projector\n');
  await put(root, `${prefix}/proposal.md`, `# Single replay

## Why
Duplicate restarts create incorrect playback behavior.

## What Changes
- Each user replay request causes exactly one restart.

## Capabilities
### Modified Capabilities
- audio/preview

## Impact
The preview replay function and its focused behavior check.
`);
  await put(root, `${prefix}/specs/audio/preview/spec.md`, `## MODIFIED Requirements

### Requirement: Immediate replay
The player SHALL restart a preview exactly once for each user replay request.

#### Scenario: Replay
- **WHEN** the user requests replay
- **THEN** the preview restarts exactly once
`);
  await put(root, `${prefix}/designs/audio/preview/design.md`, `---\ndesignDelta: 1\ntarget: audio/preview\nbaseline: ${sha(liveDesign)}\n---\n# Preview delta\n\n## Replace: decision:playback\n\n\`\`\`markdown\n${finalPart}\`\`\`\n`);
  await put(root, `${prefix}/tasks.md`, '# Work\n\n- [x] replay: Ensure each request restarts once; verify controlled playback.\n');
  return { root, baseline, change };
}
export const disposition = {
  applicability: [{ requirement: 'spec:audio/preview#Immediate replay', selectors: [{ kind: 'path', root: '.', prefix: 'src' }], reason: 'The preview concern owns replay requests in the inventoried source scope.' }],
  contributions: [{ path: 'src/player.js', target: 'code:src/player.js#replay', decision: 'design:audio/preview#decision:playback', action: 'revise', reason: 'Keep the direct function and remove only the duplicate restart.' }]
};
export async function planAndEvidence(service: ChangeService, state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const common = { root: state.root, change: state.change };
  const candidate = String(state.candidateRoot);
  await put(candidate, 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "user"; }\n');
  const planned = await service.validatePlan({ ...common, ...disposition });
  if (planned.valid !== true) throw new Error(JSON.stringify(planned.obligations));
  await service.applyChange(common);
  const evidence = await service.recordEvidence({ ...common, command: process.execPath, args: ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import {replay,retainEvent} from "./src/player.js"; assert.equal(replay(),1); assert.equal(retainEvent(),"user");'], scope: ['src/player.js'] });
  if (!(evidence.evidence as { passed: boolean }).passed) throw new Error('Controlled playback evidence failed');
  const reviewed = await service.validatePlan({ ...common, review: { basis: planned.basis, reviewer: 'fixture-review-attestation', findings: [], examined: ['src/player.js', 'openspec/designs/audio/preview/design.md'], alternative: 'Direct replay has no duplicate route; a replay strategy layer would add no current responsibility.' } });
  return reviewed;
}
export const read = (root: string, name: string) => readFile(path.join(root, name), 'utf8');
