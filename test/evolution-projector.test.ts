import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTrial } from '../evaluation/index.ts';

test('evolved fixture adapter preserves a real tested intermediate checkpoint while revising the production Projector target', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'projector-evolution-lifecycle-'));
  try {
    const trial = await createTrial(directory, 'shared', 'evolved');
    const execute = promisify(execFile);
    const command = async (operation: string, input?: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const { stdout } = await execute(process.execPath, ['scripts/projector.js', operation, ...(input ? [JSON.stringify(input)] : [])], { cwd: trial.root, windowsHide: true, timeout: 45000, env: { ...process.env, PROJECTOR_EVAL_RUNTIME: fileURLToPath(new URL('../src/change/index.ts', import.meta.url)) } });
      return JSON.parse(stdout) as Record<string, unknown>;
    };
    const prepared = await command('prepare'); const candidate = String(prepared.candidateRoot);
    const source = path.join(candidate, 'src/index.js');
    await writeFile(source, (await readFile(source, 'utf8')).replace('return {play', 'return {previewCount(){return strategy.previewCalls.length;},play'));
    const plan = await command('plan', {
      applicability: [{ requirement: 'spec:playback/events#Playback lifecycle', selectors: [{ kind: 'path', root: '.', prefix: 'src' }], reason: 'Preview audit counting is owned by the current playback event concern.' }],
      contributions: ['src/index.js', 'src/preview-strategy.js', 'src/retained-events.js'].map(file => ({ path: file, decision: 'design:playback/events#decision:event-owner', action: file === 'src/index.js' ? 'revise' : 'retain', reason: 'Preserve actual event provenance and evidence while implementing the currently required preview audit count.' }))
    });
    assert.equal(plan.valid, true, JSON.stringify(plan)); await command('apply');
    const revised = await command('advance'); assert.notEqual(revised.targetId, prepared.targetId);
    const evidence = JSON.parse(await readFile(path.join(trial.root, 'stage-evidence.json'), 'utf8')) as { checkpoint: string; evidence: { passed: boolean }; nextTarget: string };
    assert.equal(evidence.evidence.passed, true); assert.equal(evidence.nextTarget, revised.targetId);
    const { stdout } = await execute('git', ['show', `${evidence.checkpoint}:src/index.js`], { cwd: trial.root, windowsHide: true }); assert.match(stdout, /previewCount/);
    const { stdout: current } = await execute('git', ['rev-parse', 'HEAD'], { cwd: candidate, windowsHide: true }); assert.equal(current.trim(), prepared.baseline, 'checkpoint must not move the guarded candidate publication ref');
  } finally { assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); }
});
