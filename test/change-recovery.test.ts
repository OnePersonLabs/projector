import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ChangeService } from '../src/change/index.ts';
import { disposition, fixture, planAndEvidence, put, read, gitFixture, sha } from './change-fixture.ts';

test('isolated scoped refresh preserves newer target commits during publication', async () => {
  const input = await fixture(); const service = new ChangeService();
  const state = await service.prepareChange({ ...input, workspaceMode: 'isolated' });
  await put(input.root, 'new-target.txt', 'committed after preparation\n');
  gitFixture(input.root, 'add', 'new-target.txt'); gitFixture(input.root, 'commit', '-m', 'Independent target progress');
  const refreshedHead = gitFixture(input.root, 'rev-parse', 'HEAD');
  await planAndEvidence(service, state);
  const finished = await service.finishChange(input);
  assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.equal(gitFixture(input.root, 'show', 'HEAD:new-target.txt'), 'committed after preparation');
  assert.equal(gitFixture(input.root, 'rev-parse', 'HEAD^'), refreshedHead);
});

test('unrelated live authority edits survive selected checkout publication', async () => {
  const input = await fixture(); const other = 'openspec/specs/other/spec.md';
  const accepted = await read(input.root, 'openspec/specs/audio/preview/spec.md');
  await put(input.root, other, accepted); gitFixture(input.root, 'add', other); gitFixture(input.root, 'commit', '-m', 'Other capability');
  await put(input.root, other, accepted + '\nStaged independent note.\n'); gitFixture(input.root, 'add', other);
  const dirty = accepted + '\nUnstaged independent note.\n'; await put(input.root, other, dirty);
  const service = new ChangeService(); const state = await service.prepareChange({ root: input.root, change: input.change });
  await planAndEvidence(service, state); const finished = await service.finishChange(input);
  assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.equal(await read(input.root, other), dirty);
  assert.match(gitFixture(input.root, 'show', `:${other}`), /Staged independent note/);
  assert.equal(gitFixture(input.root, 'show', `HEAD:${other}`), accepted.trim());
});

test('hook mutations can be reconciled and independently verified before retry', async () => {
  const input = await fixture(); const service = new ChangeService();
  const state = await service.prepareChange(input); await planAndEvidence(service, state);
  await put(input.root, '.git/hooks/pre-commit', '#!/bin/sh\nprintf "\\n// hook formatted\\n" >> src/player.js\nprintf "\\nHook spec edit\\n" >> openspec/specs/audio/preview/spec.md\ngit add src/player.js openspec/specs/audio/preview/spec.md\n');
  await chmod(path.join(input.root, '.git/hooks/pre-commit'), 0o755);
  gitFixture(input.root, 'config', 'core.hooksPath', path.join(input.root, '.git/hooks'));
  await assert.rejects(service.finishChange(input), /Hook changed/);
  assert.equal(gitFixture(input.root, 'rev-parse', 'HEAD'), input.baseline);
  const reopened = await service.resumeChange({ ...input, reconcileFinalization: true });
  assert.equal(reopened.phase, 'implementing'); assert.match(await read(input.root, 'src/player.js'), /hook formatted/);
  assert.equal(gitFixture(input.root, 'show', ':src/player.js').includes('hook formatted'), false);
  assert.equal((reopened.recoveryContexts as string[]).length, 1);
  await rm(`${input.root}/.git/hooks/pre-commit`);
  const unresolved = await service.validatePlan({ ...input, ...disposition });
  assert.equal(unresolved.valid, false);
  assert.ok((unresolved.obligations as string[]).some(item => item.includes('Unresolved finalization artifact')));
  const planned = await service.validatePlan({ ...input, ...disposition, finalizationDispositions: [{ path: 'openspec/specs/audio/preview/spec.md', reason: 'Discard the hook-added test note; it does not describe the replay contract.' }] });
  await service.recordEvidence({ ...input, command: process.execPath, args: ['--input-type=module', '-e', 'import{replay}from"./src/player.js";if(replay()!==1)throw Error("replay");'], scope: ['src/player.js'] });
  await service.validatePlan({ ...input, review: { basis: planned.basis, reviewer: 'independent-recovery-fixture', findings: [], examined: ['src/player.js'], alternative: 'Keep the formatter output and verify the unchanged replay behavior.' } });
  const finished = await service.finishChange(input); assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.match(gitFixture(input.root, 'show', 'HEAD:src/player.js'), /hook formatted/);
});

test('legacy candidate publication reopens for reviewed integration', async () => {
  const input = await fixture(); const service = new ChangeService();
  const state = await service.prepareChange({ ...input, workspaceMode: 'isolated' });
  await planAndEvidence(service, state); const synced = await service.syncChange(input);
  const candidate = String(state.candidateRoot);
  gitFixture(candidate, 'add', '.'); gitFixture(candidate, 'commit', '-m', 'Legacy candidate publication');
  const legacyHead = gitFixture(candidate, 'rev-parse', 'HEAD');
  await put(input.root, `.git/projector-changes/${input.change}.json`, JSON.stringify({ ...synced, version: 1, phase: 'published', publication: legacyHead, candidateHead: legacyHead }));
  const reopened = await service.resumeChange(input);
  assert.equal(reopened.phase, 'implementing'); assert.equal(reopened.publication, undefined);
  assert.equal((reopened.plan as { review?: unknown }).review, undefined);
  assert.equal(gitFixture(candidate, 'rev-parse', 'HEAD'), legacyHead);
  await planAndEvidence(service, reopened);
  const finished = await service.finishChange(input); assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.equal(gitFixture(input.root, 'rev-parse', 'HEAD'), finished.publication);
});

test('committed archive receipts establish prerequisites in a fresh clone', async () => {
  const input = await fixture(); const service = new ChangeService();
  const state = await service.prepareChange(input); await planAndEvidence(service, state);
  const finished = await service.finishChange(input); assert.equal(finished.complete, true);
  const clone = path.join(await mkdtemp(path.join(tmpdir(), 'projector-clone-')), 'repository');
  gitFixture(input.root, 'clone', '--no-local', input.root, clone);
  gitFixture(clone, 'config', 'user.name', 'Fresh clone'); gitFixture(clone, 'config', 'user.email', 'fixture@localhost');
  const change = 'followup-replay'; const active = `openspec/changes/${change}`;
  await cp(String(finished.archivePath), path.join(clone, active), { recursive: true });
  await rm(path.join(clone, active, 'implementation-state.json'));
  const delta = `${active}/designs/audio/preview/design.md`;
  await put(clone, delta, (await read(clone, delta)).replace(/baseline: [a-f0-9]+/, `baseline: ${sha(await read(clone, 'openspec/designs/audio/preview/design.md'))}`));
  const prepared = await service.prepareChange({ root: clone, change });
  const planned = await service.validatePlan({ root: clone, change, ...disposition, prerequisites: [input.change] });
  assert.equal(planned.valid, true, JSON.stringify(planned.obligations));
  assert.equal(prepared.baseline, finished.publication);
});

test('unselected dirty declarations cannot satisfy published realization bindings', async () => {
  const input = await fixture(); const service = new ChangeService();
  const source = 'src/player.js';
  await put(input.root, source, (await read(input.root, source)) + 'export function helper() { return "unselected"; }\n');
  const delta = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, delta, (await read(input.root, delta)).replace('Realizes: [[code:src/player.js#replay]]', 'Realizes: [[code:src/player.js#replay]], [[code:src/player.js#helper]]'));
  await service.prepareChange(input);
  await put(input.root, source, (await read(input.root, source)).replace('return 2;', 'return 1;'));
  const plan = await service.validatePlan({ ...input, ...disposition, contributions: [...disposition.contributions, { ...disposition.contributions[0], target: 'code:src/player.js#helper', reason: 'The proposed design explicitly names this helper.' }] });
  assert.equal(plan.valid, true, JSON.stringify(plan.obligations));
  await service.applyChange(input);
  await service.recordEvidence({ ...input, command: process.execPath, args: ['--input-type=module', '-e', 'import{replay}from"./src/player.js";if(replay()!==1)throw Error("replay");'], scope: [source] });
  await service.validatePlan({ ...input, review: { basis: plan.basis, reviewer: 'selected-tree-test', findings: [], examined: [source], alternative: 'The selected implementation must contain every current realization.' } });
  await assert.rejects(service.finishChange(input), /Selected implementation.*unresolved.*helper/);
  await assert.rejects(service.resumeChange(input), /Selected implementation.*unresolved.*helper/);
  assert.equal(gitFixture(input.root, 'rev-parse', 'HEAD'), input.baseline);
  assert.match(await read(input.root, source), /unselected/);
});
