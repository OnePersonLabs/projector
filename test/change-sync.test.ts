import test from 'node:test';
import assert from 'node:assert/strict';
import { unlink, access } from 'node:fs/promises';
import path from 'node:path';
import { ChangeService } from '../src/change/index.ts';
import { initProject } from '../src/host/index.ts';
import { fixture, disposition, gitFixture, planAndEvidence, put, read } from './change-fixture.ts';

test('sync materializes exact authority, invalidates evidence, repeats safely, and finishes without reapplying deltas', async () => {
  const input = await fixture('sync-'), service = new ChangeService();
  // ADDED requirements fail if archive tries to apply their delta a second time.
  gitFixture(input.root, 'rm', 'openspec/specs/audio/preview/spec.md');
  gitFixture(input.root, 'commit', '-m', 'Start without the preview requirement');
  input.baseline = gitFixture(input.root, 'rev-parse', 'HEAD');
  const delta = `openspec/changes/${input.change}/specs/audio/preview/spec.md`;
  await put(input.root, delta, '## Purpose\n\nDefine observable replay behavior while preserving caller ownership of events.\n\n' + (await read(input.root, delta)).replace('MODIFIED Requirements', 'ADDED Requirements'));
  const state = await service.prepareChange(input);
  await planAndEvidence(service, state);
  const candidate = String(state.candidateRoot), implementation = await read(candidate, 'src/player.js');
  const synchronized = await service.syncChange(input);
  assert.equal(synchronized.synchronized, true);
  assert.deepEqual(synchronized.evidence, []);
  assert.equal((synchronized.plan as { review?: unknown }).review, undefined);
  assert.equal(await read(candidate, 'src/player.js'), implementation);
  assert.match(await read(candidate, 'openspec/specs/audio/preview/spec.md'), /exactly once/);
  assert.match(await read(candidate, 'openspec/designs/audio/preview/design.md'), /exactly once/);
  assert.equal(gitFixture(input.root, 'rev-parse', String(state.candidateBranch)), input.baseline);
  assert.equal(gitFixture(input.root, 'rev-parse', 'main'), input.baseline);
  assert.match(await read(candidate, `openspec/changes/${input.change}/proposal.md`), /Single replay/);
  const blocked = await service.finishChange(input);
  assert.equal(blocked.complete, false);
  assert.ok((blocked.obligations as string[]).some(item => item.includes('current executed evidence')));
  await planAndEvidence(service, synchronized);
  const repeated = await service.syncChange(input);
  assert.equal(repeated.reused, true);
  assert.equal((repeated.evidence as unknown[]).length, 1);
  const completed = await service.finishChange(input);
  assert.equal(completed.complete, true, JSON.stringify(completed.obligations));
  assert.equal(gitFixture(candidate, 'status', '--porcelain'), '');
});

test('sync then revise preserves implementation and replaces the previous synchronized target', async () => {
  const input = await fixture('sync-revise-'), service = new ChangeService(), state = await service.prepareChange(input);
  const synchronized = await service.syncChange(input);
  const candidate = String(state.candidateRoot);
  await put(candidate, 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "user"; }\n');
  const delta = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, delta, (await read(input.root, delta)).replace('caller-owned event storage', 'caller-owned durable event storage'));
  await assert.rejects(service.syncChange(input), /run reviseChange/);
  const revised = await service.reviseChange(input);
  assert.equal(revised.synchronizedTarget, synchronized.targetId);
  assert.notEqual(revised.targetId, synchronized.targetId);
  await service.syncChange(input);
  assert.match(await read(candidate, 'openspec/designs/audio/preview/design.md'), /durable event storage/);
  assert.match(await read(candidate, 'src/player.js'), /return 1/);
  await put(input.root, delta, (await read(input.root, delta)).replace('durable event storage', 'durable event ownership'));
  const finalRevision = await service.reviseChange(input);
  await planAndEvidence(service, finalRevision);
  assert.equal((await service.finishChange(input)).complete, true);
  assert.match(await read(candidate, 'openspec/designs/audio/preview/design.md'), /durable event ownership/);
});

test('manual authority edits, deletion and extra files block sync before any writes and block finish', async () => {
  const input = await fixture('sync-conflict-'), service = new ChangeService(), state = await service.prepareChange(input);
  const candidate = String(state.candidateRoot), specPath = 'openspec/specs/audio/preview/spec.md';
  const baselineSpec = await read(candidate, specPath);
  await put(candidate, specPath, baselineSpec + '\nUnexpected edit.\n');
  await assert.rejects(service.syncChange(input), /Live authority changed/);
  await put(candidate, specPath, baselineSpec);
  await service.syncChange(input);
  const expected = await read(candidate, specPath);
  await unlink(path.join(candidate, specPath));
  await assert.rejects(service.syncChange(input), /Live authority changed/);
  await put(candidate, specPath, expected);
  await put(candidate, 'openspec/designs/unplanned/design.md', '# Unplanned authority\n');
  await assert.rejects(service.syncChange(input), /Live authority changed/);
  const planned = await service.validatePlan(input);
  assert.ok((planned.obligations as string[]).some(item => item.includes('Live authority') && item.includes('unplanned')));
});

test('interrupted sync recovers its exact target and refuses unrelated edits during recovery', async () => {
  const input = await fixture('sync-recovery-');
  let crash = true;
  const service = new ChangeService({ fault: point => { if (point === 'after-sync-file' && crash) { crash = false; throw new Error('interrupted synchronization'); } } });
  const state = await service.prepareChange(input);
  await assert.rejects(service.syncChange(input), /interrupted synchronization/);
  await assert.rejects(service.reviseChange(input), /Synchronization was interrupted/);
  const candidate = String(state.candidateRoot);
  await put(candidate, 'openspec/specs/unplanned/spec.md', '# Unexpected\n');
  await assert.rejects(new ChangeService().syncChange(input), /Live authority changed/);
  await unlink(path.join(candidate, 'openspec/specs/unplanned/spec.md'));
  const recovered = await new ChangeService().syncChange(input);
  assert.equal(recovered.synchronizedTarget, state.targetId);
  assert.equal(recovered.pendingSynchronization, undefined);
  await planAndEvidence(service, recovered);
  assert.equal((await service.finishChange(input)).complete, true);
});

test('interrupted sync recovers its stored target despite newer source edits, then permits revision', async () => {
  const input = await fixture('sync-source-recovery-');
  let crash = true;
  const service = new ChangeService({ fault: point => { if (point === 'after-sync-file' && crash) { crash = false; throw new Error('interrupted synchronization'); } } });
  const state = await service.prepareChange(input);
  await assert.rejects(service.syncChange(input), /interrupted synchronization/);
  const delta = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, delta, (await read(input.root, delta)).replace('caller-owned event storage', 'caller-owned revised event storage'));
  const recovered = await new ChangeService().syncChange(input);
  assert.equal(recovered.requiresRevision, true);
  assert.equal(recovered.synchronizedTarget, state.targetId);
  assert.equal(recovered.pendingSynchronization, undefined);
  assert.doesNotMatch(await read(String(state.candidateRoot), 'openspec/designs/audio/preview/design.md'), /revised event storage/);
  const revised = await service.reviseChange(input);
  assert.notEqual(revised.targetId, state.targetId);
  await planAndEvidence(service, revised);
  assert.equal((await service.finishChange(input)).complete, true);
  assert.match(await read(String(state.candidateRoot), 'openspec/designs/audio/preview/design.md'), /revised event storage/);
});

test('yml configuration survives initialize, prepare, synchronize and finish without a shadow yaml', async () => {
  const input = await fixture('yml-adoption-');
  const config = 'schema: spec-driven\ncontext: Preserve caller-owned playback context\n';
  await put(input.root, 'openspec/config.yml', config);
  assert.equal((await initProject({ root: input.root })).ready, true);
  assert.equal(await read(input.root, 'openspec/config.yml'), config);
  await assert.rejects(access(path.join(input.root, 'openspec/config.yaml')), { code: 'ENOENT' });
  gitFixture(input.root, 'add', 'openspec/config.yml', 'openspec/schemas');
  gitFixture(input.root, 'commit', '-m', 'Adopt existing yml configuration');
  input.baseline = gitFixture(input.root, 'rev-parse', 'HEAD');
  const service = new ChangeService(), state = await service.prepareChange(input), candidate = String(state.candidateRoot);
  assert.equal(await read(candidate, 'openspec/config.yml'), config);
  await assert.rejects(access(path.join(candidate, 'openspec/config.yaml')), { code: 'ENOENT' });
  await service.syncChange(input);
  await planAndEvidence(service, state);
  assert.equal((await service.finishChange(input)).complete, true);
  assert.equal(await read(candidate, 'openspec/config.yml'), config);
  await assert.rejects(access(path.join(candidate, 'openspec/config.yaml')), { code: 'ENOENT' });
});

test('synchronized authority survives multiple revisions and pruning unreachable Git objects', async () => {
  const input = await fixture('sync-prune-'), service = new ChangeService(), state = await service.prepareChange(input);
  await service.syncChange(input);
  const delta = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  for (const label of ['first', 'second']) {
    await put(input.root, delta, (await read(input.root, delta)).replace('event storage', `${label} event storage`));
    await service.reviseChange(input);
  }
  assert.equal(gitFixture(input.root, 'rev-parse', `refs/projector/${input.change}/synchronized/${state.targetId}`), state.targetId);
  gitFixture(input.root, 'reflog', 'expire', '--expire=now', '--all');
  gitFixture(input.root, 'prune', '--expire=now');
  const synchronized = await service.syncChange(input);
  assert.notEqual(synchronized.synchronizedTarget, state.targetId);
  assert.match(await read(String(state.candidateRoot), 'openspec/designs/audio/preview/design.md'), /first second event storage/);
});

test('deleting an unbound baseline file requires a current decision but no dangling realization', async () => {
  const input = await fixture('remove-unbound-');
  await put(input.root, 'obsolete.md', '# Obsolete playback instructions\n');
  gitFixture(input.root, 'add', 'obsolete.md');
  gitFixture(input.root, 'commit', '-m', 'Existing unbound instructions');
  input.baseline = gitFixture(input.root, 'rev-parse', 'HEAD');
  const service = new ChangeService(), state = await service.prepareChange(input), candidate = String(state.candidateRoot);
  await unlink(path.join(candidate, 'obsolete.md'));
  await put(candidate, 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "user"; }\n');
  const removal = { path: 'obsolete.md', decision: 'design:audio/preview#decision:playback', action: 'remove', reason: 'Remove superseded playback instructions under the current playback decision.' };
  const invalid = await service.validatePlan({ ...input, ...disposition, contributions: [...disposition.contributions, { ...removal, decision: 'design:audio/preview#decision:missing' }] });
  assert.ok((invalid.obligations as string[]).some(item => item.includes('no current decision')));
  const planned = await service.validatePlan({ ...input, ...disposition, contributions: [...disposition.contributions, removal] });
  assert.equal(planned.valid, true, JSON.stringify(planned.obligations));
  await service.recordEvidence({ ...input, command: process.execPath, args: ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import {existsSync} from "node:fs"; import {replay} from "./src/player.js"; assert.equal(replay(),1); assert.equal(existsSync("obsolete.md"),false);'], scope: ['src/player.js', 'obsolete.md'] });
  await service.validatePlan({ ...input, review: { basis: planned.basis, reviewer: 'fixture-review-attestation', findings: [], examined: ['src/player.js', 'obsolete.md'], alternative: 'Keeping superseded instructions would preserve misleading playback guidance.' } });
  assert.equal((await service.finishChange(input)).complete, true);
  await assert.rejects(access(path.join(candidate, 'obsolete.md')), { code: 'ENOENT' });
});

test('prepare provisions missing schema files while revision preserves repository-owned template edits', async () => {
  const input = await fixture('schema-preservation-');
  const templatePath = 'openspec/schemas/projector/templates/spec.md';
  const baselineTemplate = '# Repository-owned requirements template\n';
  await put(input.root, templatePath, baselineTemplate);
  gitFixture(input.root, 'add', templatePath);
  gitFixture(input.root, 'commit', '-m', 'Own requirements template');
  input.baseline = gitFixture(input.root, 'rev-parse', 'HEAD');
  const service = new ChangeService(), state = await service.prepareChange(input), candidate = String(state.candidateRoot);
  assert.equal(await read(candidate, templatePath), baselineTemplate);
  await access(path.join(candidate, 'openspec/schemas/projector/schema.yaml'));
  const editedTemplate = '# Improved repository requirements template\n\n## Purpose\nExplain the capability.\n';
  await put(candidate, templatePath, editedTemplate);
  const proposalPath = `openspec/changes/${input.change}/proposal.md`;
  await put(input.root, proposalPath, (await read(input.root, proposalPath)) + '\nClarify replay requirements using the improved template.\n');
  await service.reviseChange(input);
  assert.equal(await read(candidate, templatePath), editedTemplate);
  await planAndEvidence(service, state);
  assert.equal((await service.finishChange(input)).complete, true);
  assert.equal(await read(candidate, templatePath), editedTemplate);
});
