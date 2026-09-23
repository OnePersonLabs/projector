import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTrial, comparePair, evaluateTrial } from '../evaluation/index.ts';
import { installAuthoredControl, seedBadCandidate, seedNames, expectedCode } from '../evaluation/qualification.ts';

test('coupled evaluator accepts authored controls across three pairs; these are oracle qualification, not hosted evidence', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'projector-evolution-controls-'));
  try {
    for (const trajectory of ['preview', 'shared', 'ownership'] as const) {
      const evolved = await createTrial(path.join(directory, `${trajectory}-evolved`), trajectory, 'evolved');
      const direct = await createTrial(path.join(directory, `${trajectory}-direct`), trajectory, 'direct');
      assert.match(evolved.brief, /previously|originally|partial/);
      assert.equal((await evaluateTrial(direct.root, trajectory, { authoredControl: true })).passed, false, 'unfinished starting world must fail');
      await installAuthoredControl(evolved.root); await installAuthoredControl(direct.root);
      const result = await comparePair(evolved.root, direct.root, trajectory, { authoredControl: true });
      assert.equal(result.equivalent, true, JSON.stringify(result));
      assert.ok(result.evolved.checks.includes('changed inputs invalidate no-op basis'));
    }
  } finally { assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); }
});

test('seeded bad candidates are rejected for their intended causes before hosted trials count', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'projector-evolution-seeds-'));
  try {
    for (const [index, seed] of seedNames.entries()) {
      const trial = await createTrial(path.join(directory, String(index)), 'preview', 'direct'); await installAuthoredControl(trial.root); await seedBadCandidate(trial.root, seed);
      const before = await readFile(path.join(trial.root, 'consumers.json'), 'utf8');
      const result = await evaluateTrial(trial.root, 'preview', { authoredControl: true });
      assert.equal(result.passed, false, seed); assert.ok(result.findings.some(finding => finding.code === expectedCode[seed]), JSON.stringify({ seed, result }));
      assert.equal(await readFile(path.join(trial.root, 'consumers.json'), 'utf8'), before, 'oracle must restore injected inputs');
    }
  } finally { assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); }
});
