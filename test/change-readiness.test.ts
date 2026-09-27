import test from 'node:test';
import assert from 'node:assert/strict';
import { ChangeService } from '../src/change/index.ts';
import { disposition, fixture, planAndEvidence, put, read, gitFixture, sha } from './change-fixture.ts';

test('preparation uses the selected checkout and finishes code and authority on its branch', async () => {
  const input = await fixture();
  const service = new ChangeService();
  const prepared = await service.prepareChange(input);
  assert.equal(prepared.workspaceMode, 'checkout');
  assert.equal(prepared.candidateRoot, input.root);
  assert.equal(gitFixture(input.root, 'branch', '--list', 'projector/*'), '');
  await planAndEvidence(service, prepared);
  const finished = await service.finishChange(input);
  assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.equal(gitFixture(input.root, 'rev-parse', 'HEAD'), finished.publication);
  assert.match(await read(input.root, 'openspec/specs/audio/preview/spec.md'), /exactly once/);
  assert.equal((await service.resumeChange(input)).complete, true);
});

test('checkbox progress preserves check eligibility and does not rewrite fenced task examples', async () => {
  const input = await fixture();
  const taskPath = `openspec/changes/${input.change}/tasks.md`;
  await put(input.root, taskPath, (await read(input.root, taskPath)) + '\n```markdown\n- [ ] This is an example, not pending work.\n```\n');
  const service = new ChangeService();
  const state = await service.prepareChange(input);
  await planAndEvidence(service, state);
  const before = await service.validatePlan(input);
  assert.equal(typeof before.verificationBasis, 'string');
  const original = await read(String(state.candidateRoot), taskPath);
  await put(String(state.candidateRoot), taskPath, original.replace('[x]', '[ ]'));
  const pending = await service.validatePlan(input);
  assert.equal(pending.verificationBasis, before.verificationBasis);
  assert.ok(((await service.finishChange(input)).obligations as string[]).some(item => /incomplete/i.test(item)));
  await put(String(state.candidateRoot), taskPath, original);
  const after = await service.validatePlan(input);
  assert.equal(after.verificationBasis, before.verificationBasis);
  assert.equal((after.evidence as { passed: boolean }[]).some(item => item.passed), true);
  assert.match(await read(input.root, taskPath), /```markdown\n- \[ \] This is an example/);
  const finished = await service.finishChange(input);
  assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
});

test('unrelated staged and unstaged edits survive direct publication', async () => {
  const input = await fixture();
  await put(input.root, 'notes.txt', 'base\n');
  gitFixture(input.root, 'add', 'notes.txt'); gitFixture(input.root, 'commit', '-m', 'notes');
  await put(input.root, 'notes.txt', 'staged\n'); gitFixture(input.root, 'add', 'notes.txt');
  await put(input.root, 'notes.txt', 'unstaged\n');
  await put(input.root, 'unrelated.txt', 'keep me\n');
  const service = new ChangeService();
  const state = await service.prepareChange({ root: input.root, change: input.change });
  await planAndEvidence(service, state);
  const finished = await service.finishChange({ root: input.root, change: input.change });
  assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.equal(gitFixture(input.root, 'rev-parse', 'HEAD'), finished.publication);
  assert.equal(await read(input.root, 'notes.txt'), 'unstaged\n');
  assert.equal(gitFixture(input.root, 'show', ':notes.txt'), 'staged');
  assert.equal(gitFixture(input.root, 'show', 'HEAD:notes.txt'), 'base');
  assert.equal(await read(input.root, 'unrelated.txt'), 'keep me\n');
});

test('recordEvidence captures real generator provenance without calling its mutation a passing verification', async () => {
  const input = await fixture();
  await put(input.root, 'generate.mjs', 'import{readFile,writeFile}from"node:fs/promises";await writeFile("generated.txt",await readFile("seed.txt"));\n');
  await put(input.root, 'seed.txt', 'generated from declared input\n'); await put(input.root, 'generated.txt', 'old\n');
  gitFixture(input.root, 'add', 'generate.mjs', 'seed.txt', 'generated.txt'); gitFixture(input.root, 'commit', '-m', 'Generator baseline');
  const delta = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, delta, (await read(input.root, delta)).replace('Realizes: [[code:src/player.js#replay]]', 'Realizes: [[code:src/player.js#replay]], [[code:generated.txt]]\nGenerated: {"output":"generated.txt","producer":"code:generate.mjs","inputs":["code:seed.txt"],"retention":"tracked"}'));
  const service = new ChangeService(); await service.prepareChange({ root: input.root, change: input.change });
  await service.validatePlan({ ...input, ...disposition });
  const result = await service.recordEvidence({ ...input, command: process.execPath, args: ['generate.mjs'], purpose: 'generation', scope: ['generated.txt'], generatedOutputs: ['generated.txt'] });
  const evidence = result.evidence as { passed: boolean; generated: { outputHash: string; inputs: Record<string, string> }[] };
  assert.equal(evidence.passed, false); assert.equal(result.changedDuringRun, true);
  assert.equal(evidence.generated.length, 1);
  assert.equal(evidence.generated[0]!.outputHash, sha(await read(input.root, 'generated.txt')));
  assert.equal(evidence.generated[0]!.inputs['code:seed.txt'], sha(await read(input.root, 'seed.txt')));
});
