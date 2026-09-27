import test from 'node:test';
import assert from 'node:assert/strict';
import { ChangeService } from '../src/change/index.ts';
import { disposition, fixture, planAndEvidence, put, read, gitFixture, sha } from './change-fixture.ts';

const playbackArgs = ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import {replay,retainEvent} from "./src/player.js"; assert.equal(replay(),1); assert.equal(retainEvent(),"user");'];
type EvidenceRecord = { id: string; purpose: string; passed: boolean; executionRoot: string };
const records = (result: Record<string, unknown>) => result.evidence as EvidenceRecord[];
const missingPlayback = (result: Record<string, unknown>) => (result.obligations as string[]).includes('Missing current executed evidence: src/player.js');

async function reviewedPlayback(input: { root: string; change: string }, service: ChangeService): Promise<void> {
  await service.prepareChange(input);
  await put(input.root, 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "user"; }\n');
  await service.validatePlan({ ...input, ...disposition });
  await service.applyChange(input);
}

async function approvePlayback(input: { root: string; change: string }, service: ChangeService): Promise<void> {
  const planned = await service.validatePlan(input);
  await service.validatePlan({ ...input, review: { basis: planned.basis, reviewer: 'fixture-review-attestation', findings: [], examined: ['src/player.js', 'openspec/designs/audio/preview/design.md'], alternative: 'A direct replay preserves caller ownership without another playback strategy.' } });
}

test('baseline and red executions remain history and cannot authorize completion or selected-tree replay', async () => {
  const input = await fixture();
  const service = new ChangeService();
  await reviewedPlayback(input, service);
  const historical: string[] = [];
  for (const purpose of ['baseline', 'red']) {
    // This assertion is true in the authored checkout and false after archival.
    const result = await service.recordEvidence({ ...input, command: process.execPath, args: ['--input-type=module', '-e', `import assert from "node:assert/strict"; import {existsSync} from "node:fs"; assert.ok(existsSync("openspec/changes/${input.change}/tasks.md"));`], purpose, scope: ['src/player.js'] });
    const evidence = result.evidence as EvidenceRecord;
    assert.equal(evidence.passed, true);
    historical.push(evidence.id);
    assert.equal(missingPlayback(await service.finishChange(input)), true);
    assert.equal((await service.finishChange(input)).complete, false);
  }
  await service.recordEvidence({ ...input, command: process.execPath, args: playbackArgs, scope: ['src/player.js'] });
  await approvePlayback(input, service);
  const finished = await service.finishChange(input);
  assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  for (const id of historical) {
    const retained = records(finished).find(item => item.id === id);
    assert.equal(retained?.executionRoot, input.root);
    assert.equal(records(finished).filter(item => item.purpose === retained?.purpose).length, 1);
  }
  assert.ok(records(finished).some(item => item.purpose === 'verification' && item.executionRoot !== input.root && item.passed));
});

test('only current successful covering supersession retires evidence, and a failing rerun blocks older pass reuse', async () => {
  const input = await fixture();
  const service = new ChangeService();
  await reviewedPlayback(input, service);
  const original = (await service.recordEvidence({ ...input, command: process.execPath, args: playbackArgs, scope: ['src/player.js', 'package.json'], inputPaths: ['src/player.js'] })).evidence as EvidenceRecord;
  await assert.rejects(service.recordEvidence({ ...input, command: process.execPath, args: playbackArgs, scope: ['src/player.js'], supersedes: [original.id] }), /cover every path/);
  const failingArgs = ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import {replay} from "./src/player.js"; assert.equal(replay(),2);'];
  const failed = (await service.recordEvidence({ ...input, command: process.execPath, args: failingArgs, scope: ['src/player.js', 'package.json'], supersedes: [original.id] })).evidence as EvidenceRecord;
  assert.equal(failed.passed, false);
  assert.equal(missingPlayback(await service.finishChange(input)), false);
  const stale = (await service.recordEvidence({ ...input, command: process.execPath, args: [...playbackArgs, 'stale-check'], scope: ['src/player.js', 'package.json'], inputPaths: ['package.json'], supersedes: [original.id] })).evidence as EvidenceRecord;
  const manifest = await read(input.root, 'package.json');
  await put(input.root, 'package.json', manifest.trimEnd() + '\n\n');
  assert.equal(missingPlayback(await service.finishChange(input)), false);
  await put(input.root, 'package.json', manifest);
  const successful = (await service.recordEvidence({ ...input, command: process.execPath, args: ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import {readFileSync} from "node:fs"; import {replay,retainEvent} from "./src/player.js"; assert.equal(replay(),1); assert.equal(retainEvent(),"user"); assert.equal(JSON.parse(readFileSync("package.json")).private,true);'], scope: ['src/player.js', 'package.json'], supersedes: [original.id, stale.id] })).evidence as EvidenceRecord;
  assert.equal(successful.passed, true);
  const history = records(await service.validatePlan(input));
  for (const item of [original, failed, stale, successful]) assert.ok(history.some(record => record.id === item.id));
  await approvePlayback(input, service);
  const finished = await service.finishChange(input);
  assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.equal(records(finished).filter(item => item.executionRoot !== input.root).length, 1);

  const rerunInput = await fixture();
  const rerunService = new ChangeService();
  await reviewedPlayback(rerunInput, rerunService);
  const args = ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import {replay} from "./src/player.js"; assert.equal(replay(),1);'];
  await rerunService.recordEvidence({ ...rerunInput, command: process.execPath, args, scope: ['src/player.js'] });
  await put(rerunInput.root, 'src/player.js', 'export function replay() { return 2; }\nexport function retainEvent() { return "user"; }\n');
  const rerun = await rerunService.recordEvidence({ ...rerunInput, command: process.execPath, args, scope: ['src/player.js'] });
  assert.equal((rerun.evidence as EvidenceRecord).passed, false);
  await put(rerunInput.root, 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "user"; }\n');
  assert.equal(missingPlayback(await rerunService.finishChange(rerunInput)), true);
  assert.equal((await rerunService.finishChange(rerunInput)).complete, false);
});

test('declared source, test, transitive and configuration inputs stale scoped evidence while unrelated edits preserve eligibility', async () => {
  const input = await fixture();
  const extraInputs = {
    'checks/playback.mjs': 'import assert from "node:assert/strict"; import {replay} from "../src/player.js"; import {expected} from "../support/expected.mjs"; import {readFileSync} from "node:fs"; assert.equal(replay(),expected); assert.equal(JSON.parse(readFileSync("check-config.json")).expected,expected);\n',
    'support/expected.mjs': 'export const expected = 1;\n',
    'check-config.json': '{"expected":1}\n',
    'unrelated.txt': 'unchanged\n'
  };
  for (const [name, value] of Object.entries(extraInputs)) await put(input.root, name, value);
  gitFixture(input.root, 'add', ...Object.keys(extraInputs));
  gitFixture(input.root, 'commit', '-m', 'Playback check inputs');
  input.baseline = gitFixture(input.root, 'rev-parse', 'HEAD');
  const service = new ChangeService();
  await reviewedPlayback(input, service);
  const inputPaths = ['src/player.js', 'checks/playback.mjs', 'support/expected.mjs', 'check-config.json'];
  const recorded = await service.recordEvidence({ ...input, command: process.execPath, args: ['checks/playback.mjs'], scope: ['src/player.js'], inputPaths });
  assert.equal((recorded.evidence as EvidenceRecord).passed, true);
  for (const name of inputPaths) {
    const original = await read(input.root, name);
    await put(input.root, name, original + '\n');
    assert.equal(missingPlayback(await service.finishChange(input)), true, name);
    await put(input.root, name, original);
    assert.equal(missingPlayback(await service.finishChange(input)), false, name);
  }
  await put(input.root, 'unrelated.txt', 'edited outside declared inputs\n');
  assert.equal(missingPlayback(await service.finishChange(input)), false);
});

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
