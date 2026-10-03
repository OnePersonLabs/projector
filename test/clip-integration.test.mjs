import { activate } from '../plugins/opl-projector/runtime/activation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { parse, stringify } from 'yaml';
import { focus, revisit, reconcile, writeCheckpoint, resume, repair } from '../plugins/opl-projector/runtime/projector.mjs';
import { hash } from '../plugins/opl-projector/runtime/state.mjs';

const run = promisify(execFile);
const fixture = new URL('../examples/clip/', import.meta.url);
const lensPath = '.projector/meaning/lenses/clip-playback.md';

async function copyFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projector-clip-'));
  await fs.cp(fixture, root, { recursive: true });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await activate(root);
  await editLens(root, lens => {
    for (const check of lens.checks) if (check.command === 'node') check.command = process.execPath;
  });
  return root;
}

async function editLens(root, edit) {
  const file = path.join(root, lensPath);
  const source = await fs.readFile(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  const lens = parse(match[1]);
  edit(lens);
  await fs.writeFile(file, `---\n${stringify(lens)}---\n${source.slice(match[0].length)}`);
}

function participant(result, condition, source) {
  return result.verdicts.find(verdict => verdict.condition === condition)
    ?.participants.find(item => item.unit?.path === source);
}

async function checkpoint(root) {
  const request = JSON.parse(await fs.readFile(path.join(root, 'requests/checkpoint.json'), 'utf8'));
  return writeCheckpoint(root, request);
}

test('Clip runtime evidence preserves source meaning and distinguishes committed edits', async t => {
  const root = await copyFixture(t);
  await checkpoint(root);
  const conceptPath = path.join(root, '.projector/meaning/concepts/clip.md');
  const patternPath = path.join(root, '.projector/meaning/patterns/read-time-transform.md');
  const before = [await fs.readFile(conceptPath, 'utf8'), await fs.readFile(patternPath, 'utf8')];
  const packet = await focus(root, { concepts: ['clip'], work: 'clip-export' });
  assert.ok(packet.meaning.some(record => record.id === 'clip'));
  assert.ok(packet.related.some(record => record.id === 'read-time-transform'));
  const result = await reconcile(root, { lenses: ['clip-playback'], work: 'clip-export', runChecks: true });
  assert.equal(participant(result, 'clip#playback-isolation', 'js/playback.mjs').status, 'supported');
  assert.equal(participant(result, 'clip#playback-isolation', 'js/export.mjs').status, 'supported');
  assert.equal(participant(result, 'clip#persistence-source', 'python/persistence.py').status, 'supported');
  assert.equal(participant(result, 'clip#playback-isolation', 'rust/playback.rs').status, 'supported');
  assert.equal(participant(result, 'clip#playback-isolation', 'csharp/ClipConsumer.cs').status, 'unresolved');
  assert.equal(result.status, 'unresolved');
  for (const receipt of result.receipts.filter(item => item.status === 'supported')) {
    assert.equal(receipt.exitCode, 0);
    assert.ok((await fs.readFile(path.join(root, receipt.stdout), 'utf8')).includes('verified'));
  }
  assert.deepEqual([await fs.readFile(conceptPath, 'utf8'), await fs.readFile(patternPath, 'utf8')], before);
  const pattern = parse(before[1].split('---')[1]);
  assert.equal(pattern.status, 'candidate');
  assert.ok(pattern.counterexamples.some(item => item.includes('commitTranspose')));
  assert.deepEqual((await resume(root, 'clip-export')).changed, []);
});

test('new handwritten export refreshes Units and requires explicit evidence coverage', async t => {
  const root = await copyFixture(t);
  const first = await revisit(root, { lenses: ['clip-playback'] });
  const original = first.selections[0].selectors.find(item => item.id === 'js-playback').units;
  await fs.writeFile(path.join(root, 'js/handwritten-export.mjs'),
    'export function exportNotes(clip, offset) { return clip.notes.map(({pitch, ...timing}) => ({...timing, pitch: pitch + offset})); }\n');
  const refreshed = await revisit(root, { lenses: ['clip-playback'] });
  assert.ok(refreshed.selections[0].added.includes('js/handwritten-export.mjs'));
  assert.equal(refreshed.selections[0].selectors.find(item => item.id === 'js-playback').units.length, original.length + 1);
  const uncovered = await reconcile(root, { lenses: ['clip-playback'], runChecks: true });
  assert.equal(participant(uncovered, 'clip#playback-isolation', 'js/handwritten-export.mjs').status, 'unresolved');
  await fs.writeFile(path.join(root, 'checks/handwritten-export.mjs'),
    `import assert from 'node:assert/strict';
import { exportNotes } from '../js/handwritten-export.mjs';
const clip = { notes: [{pitch: 48, beat: 2, duration: 1}] };
const before = structuredClone(clip);
assert.deepEqual(exportNotes(clip, 5), [{pitch: 53, beat: 2, duration: 1}]);
assert.deepEqual(clip, before);
console.log('New handwritten export verified');\n`);
  await editLens(root, lens => lens.checks.push({ id: 'handwritten-export', command: process.execPath,
    args: ['checks/handwritten-export.mjs'], selectors: ['js-playback'], conditions: ['clip#playback-isolation'],
    evidence: 'runtime', coverage: ['js/handwritten-export.mjs'], inputs: ['checks/handwritten-export.mjs'] }));
  const covered = await reconcile(root, { lenses: ['clip-playback'], runChecks: true });
  assert.equal(participant(covered, 'clip#playback-isolation', 'js/handwritten-export.mjs').status, 'supported');
  const file = path.join(root, 'js/handwritten-export.mjs');
  await fs.appendFile(file, '// Updated source binding\n');
  const changed = await revisit(root, { lenses: ['clip-playback'] });
  const unit = changed.selections[0].selectors.flatMap(item => item.units).find(item => item.path === 'js/handwritten-export.mjs');
  assert.equal(unit.sourceHash, hash(await fs.readFile(file)));
  assert.notEqual(unit.sourceHash, covered.discovery.selections[0].selectors.flatMap(item => item.units).find(item => item.path === unit.path).sourceHash);
  const stale = await reconcile(root, { lenses: ['clip-playback'] });
  assert.equal(participant(stale, 'clip#playback-isolation', unit.path).status, 'unresolved');
});

test('failed observation retains supported evidence and original mismatch in checkpoint', async t => {
  const root = await copyFixture(t);
  await checkpoint(root);
  await editLens(root, lens => {
    lens.checks.find(check => check.id === 'python-save').command = 'projector-missing-python-executable';
    lens.observations.push({ provider: 'lsp', operation: 'references', files: ['rust/playback.rs'],
      position: { line: 15, character: 8 }, config: { command: 'projector-missing-lsp-executable', args: [] } });
  });
  const partial = await reconcile(root, { lenses: ['clip-playback'], work: 'clip-export', runChecks: true });
  assert.equal(participant(partial, 'clip#playback-isolation', 'js/playback.mjs').status, 'supported');
  assert.equal(participant(partial, 'clip#persistence-source', 'python/persistence.py').status, 'unresolved');
  assert.ok(partial.observations.some(item => item.provider.id === 'lsp' && item.status !== 'complete' && item.gaps.length));
  await fs.appendFile(path.join(root, 'checks/playback.mjs'), '\nthrow new Error("Deliberate failing evidence");\n');
  const failed = await reconcile(root, { lenses: ['clip-playback'], work: 'clip-export', runChecks: true });
  assert.equal(participant(failed, 'clip#playback-isolation', 'js/playback.mjs').status, 'mismatch');
  const resumed = await resume(root, 'clip-export');
  assert.ok(resumed.mismatches.some(item => item.condition === 'clip#playback-isolation'));
  const count = resumed.mismatches.length;
  await editLens(root, lens => lens.checks = lens.checks.filter(check => check.id !== 'js-behavior'));
  await reconcile(root, { lenses: ['clip-playback'], work: 'clip-export' });
  assert.equal((await resume(root, 'clip-export')).mismatches.length, count);
});

test('native staged producer and owned repair preserve unrelated changes on rollback', async t => {
  const root = await copyFixture(t);
  await checkpoint(root);
  const output = path.join(root, 'published/clip-export.json');
  const before = await fs.readFile(output);
  await run(process.execPath, ['producer/stage-export.mjs'], { cwd: root, windowsHide: true });
  assert.deepEqual(await fs.readFile(output), before);
  const request = { id: 'publish-export', work: 'clip-export', owner: 'export-worker',
    outputs: [{ path: 'published/clip-export.json', expectedHash: hash(before), fromFile: 'staged/clip-export.json' }] };
  await repair(root, request);
  assert.deepEqual(await fs.readFile(output), await fs.readFile(path.join(root, 'staged/clip-export.json')));
  assert.ok((await resume(root, 'clip-export')).changed.includes('published/clip-export.json'));
  await repair(root, { ...request, mode: 'inspect' });
  await fs.writeFile(output, 'unrelated native edit\n');
  await assert.rejects(repair(root, { ...request, mode: 'rollback' }), /unrelated edits/);
  assert.equal(await fs.readFile(output, 'utf8'), 'unrelated native edit\n');
  await assert.rejects(repair(root, { id: 'unowned', work: 'clip-export', owner: 'export-worker',
    outputs: [{ path: 'shared/clip.json', expectedHash: hash(await fs.readFile(path.join(root, 'shared/clip.json'))), content: '{}' }] }));
});
