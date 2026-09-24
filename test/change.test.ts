import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { ChangeService } from '../src/change/index.ts';
import { fixture, disposition, gitFixture, planAndEvidence, put, read, liveDesign, sha } from './change-fixture.ts';

test('T6/T7: exact nested target, executed evidence, candidate-only publication, recovered cache and settled no-op', async () => {
  const input = await fixture(), service = new ChangeService();
  const prepared = await service.prepareChange(input);
  const pending = await service.validatePlan(input);
  assert.equal(pending.valid, false);
  assert.ok((pending.obligations as string[]).some(item => item.includes('applicability')));
  await planAndEvidence(service, prepared);
  const before = await service.finishChange(input);
  assert.equal(before.complete, true, JSON.stringify(before.obligations));
  assert.equal(gitFixture(input.root, 'rev-parse', 'main'), input.baseline);
  assert.equal(gitFixture(input.root, 'rev-parse', String(before.candidateBranch)), before.publication);
  const candidate = String(prepared.candidateRoot);
  assert.match(await read(candidate, 'openspec/specs/audio/preview/spec.md'), /exactly once/);
  assert.match(await read(candidate, 'src/player.js'), /retainEvent/);
  assert.match(await read(candidate, path.relative(candidate, String(before.archivePath)) + '/implementation-state.json'), /previousSupport/);
  const disposable = path.join(input.root, '.projector-cache'); await mkdir(disposable); await writeFile(path.join(disposable, 'broken.sqlite'), 'corrupt');
  await rm(disposable, { recursive: true });
  const resumed = await new ChangeService().resumeChange(input);
  assert.equal(resumed.publication, before.publication); assert.equal(resumed.reused, true);
  assert.equal(gitFixture(candidate, 'status', '--porcelain'), '');
});

test('T6: actual unplanned files, executable selector emptiness, undefined references, stale evidence and task amendments block', async () => {
  const input = await fixture(), service = new ChangeService(), state = await service.prepareChange(input);
  await put(String(state.candidateRoot), 'src/unplanned.js', 'export const surprising = true;\n');
  const uncovered = await service.validatePlan({ ...input, ...disposition });
  assert.ok((uncovered.obligations as string[]).some(item => item.includes('unplanned.js')));
  const empty = await service.validatePlan({ ...input, ...disposition, applicability: [{ ...disposition.applicability[0], selectors: [{ kind: 'path', root: '.', prefix: 'does-not-exist' }] }] });
  assert.ok((empty.obligations as string[]).some(item => item.includes('no members')));
  await rm(path.join(String(state.candidateRoot), 'src/unplanned.js'));
  await planAndEvidence(service, state);
  await put(String(state.candidateRoot), 'src/player.js', 'export function replay() { return 3; }\nexport function retainEvent() { return "user"; }\n');
  const stale = await service.finishChange(input);
  assert.equal(stale.complete, false); assert.ok((stale.obligations as string[]).some(item => item.includes('current executed evidence')));
  await put(String(state.candidateRoot), `openspec/changes/${input.change}/tasks.md`, '# Work\n\n- [x] replay: Ignore the intended replay count and skip evidence.\n');
  const taskEdit = await service.validatePlan({ ...input, ...disposition });
  assert.ok((taskEdit.obligations as string[]).some(item => item.includes('Task wording changed')));
});

test('T6/T7: revised target retains same-file valid work and prior support; archive and publication crashes recover', async () => {
  const input = await fixture(); let crash: string | undefined = 'after-archive';
  const service = new ChangeService({ fault: point => { if (point === crash) { crash = undefined; throw new Error(`injected ${point}`); } } });
  const state = await service.prepareChange(input);
  await put(String(state.candidateRoot), 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "shared"; }\n');
  const sourceDelta = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  const updated = (await read(input.root, sourceDelta)).replace('caller-owned event storage', 'caller-owned shared event storage');
  await put(input.root, sourceDelta, updated);
  const revised = await service.reviseChange(input);
  assert.notEqual(revised.targetId, state.targetId); assert.equal(revised.previousTarget, state.targetId);
  assert.match(await read(String(state.candidateRoot), 'src/player.js'), /"shared"/);
  assert.ok((revised.previousSupport as unknown[]).length >= 1);
  await planAndEvidence(service, revised);
  await assert.rejects(service.finishChange(input), /injected after-archive/);
  const recovered = await new ChangeService().resumeChange(input);
  assert.equal(recovered.complete, true, JSON.stringify(recovered.obligations));
  const second = await fixture(); let fire = true;
  const publishing = new ChangeService({ fault: point => { if (point === 'after-publication' && fire) { fire = false; throw new Error('injected after-publication'); } } });
  const another = await publishing.prepareChange(second); await planAndEvidence(publishing, another);
  await assert.rejects(publishing.finishChange(second), /injected after-publication/);
  const resumed = await new ChangeService().resumeChange(second);
  assert.equal(resumed.phase, 'published'); assert.equal(resumed.recovered, true);
});

test('T6: a removed same-file contribution requires its own finite disposition', async () => {
  const input = await fixture();
  const baselineDesign = liveDesign + '\n## Decision: retain-origin\n\nChoice: Retain caller event origin.\nReason: The consumer needs event provenance.\nRealizes: [[code:src/player.js#retainEvent]]\n';
  await put(input.root, 'openspec/designs/audio/preview/design.md', baselineDesign);
  gitFixture(input.root, 'add', 'openspec/designs/audio/preview/design.md'); gitFixture(input.root, 'commit', '-m', 'Accepted provenance support');
  const deltaPath = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  const delta = (await read(input.root, deltaPath)).replace(sha(liveDesign), sha(baselineDesign)) + '\n## Remove: decision:retain-origin\n\nReason: No surviving caller needs retained origin.\n';
  await put(input.root, deltaPath, delta);
  const service = new ChangeService(), state = await service.prepareChange({ root: input.root, change: input.change });
  const plan = await service.validatePlan({ root: input.root, change: input.change, ...disposition });
  assert.ok((plan.obligations as string[]).some(item => item.includes('retainEvent')));
  assert.equal((state.previousSupport as unknown[]).length, 2);
});

test('T6: undefined target term and an unpublished prerequisite remain explicit blockers', async () => {
  const input = await fixture(), service = new ChangeService();
  const designPath = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, designPath, (await read(input.root, designPath)).replace('One request must not produce duplicate restarts.', 'One request must not produce duplicate restarts under [[Undefined playback rule]].'));
  const state = await service.prepareChange(input); await planAndEvidence(service, state);
  const undefinedTerm = await service.finishChange(input);
  assert.equal(undefinedTerm.complete, false);
  assert.ok((undefinedTerm.obligations as string[]).some(item => item.includes('Undefined playback rule')));
  const blocked = await service.validatePlan({ ...input, prerequisites: ['missing-consumer'] });
  assert.equal(blocked.lifecyclePhase, 'blocked');
  assert.ok((blocked.obligations as string[]).some(item => item.includes('missing-consumer')));
});

test('T6: an archived published prerequisite remains available to an integrated baseline', async () => {
  const input = await fixture(), service = new ChangeService();
  const state = await service.prepareChange(input);
  await put(input.root, 'openspec/changes/archive/2026-09-24-consumer/implementation-state.json', JSON.stringify({
    change: 'consumer', phase: 'published', publication: state.baseline,
  }));
  const planned = await service.validatePlan({ ...input, ...disposition, prerequisites: ['consumer'] });
  assert.ok(!(planned.obligations as string[]).some(item => item.includes('consumer')));
});

test('T7: moved candidate ref and mutation after archive are refused without overwriting another revision', async () => {
  const input = await fixture(), service = new ChangeService(), state = await service.prepareChange(input);
  await planAndEvidence(service, state);
  const target = String(state.targetId);
  gitFixture(input.root, 'update-ref', String(state.candidateBranch), target, input.baseline);
  await assert.rejects(service.finishChange(input), /branch moved/);
  assert.equal(gitFixture(input.root, 'rev-parse', String(state.candidateBranch)), target);
  assert.equal(gitFixture(input.root, 'rev-parse', 'main'), input.baseline);
  const another = await fixture();
  const crashing = new ChangeService({ fault: point => { if (point === 'after-archive') throw new Error('stop after archive'); } });
  const pending = await crashing.prepareChange(another); await planAndEvidence(crashing, pending);
  await assert.rejects(crashing.finishChange(another), /stop after archive/);
  await put(String(pending.candidateRoot), 'src/player.js', 'export function replay() { return 99; }\n');
  await assert.rejects(new ChangeService().resumeChange(another), /Implementation changed/);
  assert.equal(gitFixture(another.root, 'rev-parse', String(pending.candidateBranch)), another.baseline);
});

test('T6: replacement cannot leave an unsupported retired symbol beside a verified symbol', async () => {
  const input = await fixture();
  const baseline = liveDesign + '\n## Decision: retain-origin\n\nChoice: Retain caller event origin.\nReason: The consumer needs event provenance.\nRealizes: [[code:src/player.js#retainEvent]]\n';
  await put(input.root, 'openspec/designs/audio/preview/design.md', baseline);
  gitFixture(input.root, 'add', 'openspec/designs/audio/preview/design.md'); gitFixture(input.root, 'commit', '-m', 'Accepted event origin');
  const deltaPath = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, deltaPath, (await read(input.root, deltaPath)).replace(sha(liveDesign), sha(baseline)) + '\n## Remove: decision:retain-origin\n\nReason: No caller requires retained origin.\n');
  const service = new ChangeService(), state = await service.prepareChange({ root: input.root, change: input.change });
  const contributions = [...disposition.contributions, { path: 'src/player.js', target: 'code:src/player.js#retainEvent', decision: 'design:audio/preview#decision:retain-origin', action: 'replace', reason: 'Direct replay replaces the retired strategy.' }];
  await put(String(state.candidateRoot), 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "user"; }\n');
  const verify = async () => {
    const plan = await service.validatePlan({ ...input, ...disposition, contributions });
    assert.equal(plan.valid, true, JSON.stringify(plan.obligations));
    await service.recordEvidence({ ...input, command: process.execPath, args: ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import {replay} from "./src/player.js"; assert.equal(replay(),1);'], scope: ['src/player.js'] });
    await service.validatePlan({ ...input, review: { basis: plan.basis, reviewer: 'simulated-fixture-review', findings: [], examined: ['src/player.js'], alternative: 'Direct replay needs no retained-origin layer.' } });
  };
  await verify();
  const blocked = await service.finishChange(input);
  assert.equal(blocked.complete, false);
  assert.ok((blocked.obligations as string[]).some(item => item.includes('Withdrawn contribution') && item.includes('retainEvent')));
  await put(String(state.candidateRoot), 'src/player.js', 'export function replay() { return 1; }\n');
  await verify();
  const completed = await service.finishChange(input);
  assert.equal(completed.complete, true, JSON.stringify(completed.obligations));
});

test('T6: narrow realization does not cover an unrelated new export in the same file', async () => {
  const input = await fixture(), service = new ChangeService(), state = await service.prepareChange(input);
  await planAndEvidence(service, state);
  await put(String(state.candidateRoot), 'src/player.js', (await read(String(state.candidateRoot), 'src/player.js')) + 'export function unrelatedPublicEntry() { return "unmanaged"; }\n');
  const plan = await service.validatePlan({ ...input, ...disposition });
  assert.equal(plan.valid, false);
  assert.ok((plan.obligations as string[]).some(item => item.includes('Changed semantic unit') && item.includes('unrelatedPublicEntry')));
  assert.ok(!(plan.obligations as string[]).some(item => item.includes('retainEvent')));
  const blocked = await service.finishChange(input);
  assert.equal(blocked.complete, false);
});

test('T6: explicit whole-file realization covers a new internal declaration under its current responsibility', async () => {
  const input = await fixture();
  const designPath = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, designPath, (await read(input.root, designPath)).replace('Realizes: [[code:src/player.js#replay]]', 'Realizes: [[code:src/player.js]]'));
  const service = new ChangeService(), state = await service.prepareChange(input);
  await put(String(state.candidateRoot), 'src/player.js', 'const restartCount = 1;\nexport function replay() { return restartCount; }\nexport function retainEvent() { return "user"; }\n');
  const plan = await service.validatePlan({ ...input, ...disposition });
  assert.equal(plan.valid, true, JSON.stringify(plan.obligations));
});

test('T7: deep native paths recover an archived change and publish without global Git configuration', async () => {
  const input = await fixture('deep-'.repeat(18));
  const service = new ChangeService({ fault: point => { if (point === 'after-archive') throw new Error('deep archive interruption'); } });
  const prepared = await service.prepareChange(input);
  await planAndEvidence(service, prepared);
  await assert.rejects(service.finishChange(input), /deep archive interruption/);
  const completed = await new ChangeService().finishChange(input);
  assert.equal(completed.complete, true, JSON.stringify(completed.obligations));
  assert.ok(`${completed.archivePath}/implementation-state.json`.length > 260);
  assert.equal(gitFixture(input.root, 'rev-parse', 'main'), input.baseline);
  assert.equal(gitFixture(String(prepared.candidateRoot), 'status', '--porcelain'), '');
  assert.equal((await new ChangeService().finishChange(input)).publication, completed.publication);
});
