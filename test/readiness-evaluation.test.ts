import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createReadinessTrial, evaluateReadiness, installReadinessControl, readinessVariants, seedReadinessVariant } from '../evaluation/readiness.ts';

test('portable Psychord-shaped authored control qualifies mechanisms without claiming native execution', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'projector-readiness-'));
  try {
    const trial = await createReadinessTrial(path.join(directory, 'control')); await installReadinessControl(trial.root);
    const result = await evaluateReadiness(trial.root, { authoredControl: true });
    assert.equal(result.passed, true, JSON.stringify(result));
    assert.ok(result.checks.some(check => check.startsWith('static Tauri')));
    assert.deepEqual((result.behavior as { platform: { audio: unknown } }).platform.audio, { qualified: false, basis: 'dispatch-only' });
    await writeFile(path.join(trial.root, 'platform/native/src/lib.rs'), '#[tauri::command]\nfn model_available() -> bool { false }\n');
    const unregistered = await evaluateReadiness(trial.root, { authoredControl: true });
    assert.equal(unregistered.passed, false);
    assert.ok(unregistered.findings.some(finding => finding.code === 'platform-relationships'));
    const runtimePath = path.join(trial.root, 'platform/model.mjs');
    const runtime = await readFile(runtimePath, 'utf8');
    await writeFile(runtimePath, runtime.replace('isAvailable: async () => false', 'isAvailable: async () => true'));
    const dishonestAvailability = await evaluateReadiness(trial.root, { authoredControl: true });
    assert.ok(dishonestAvailability.findings.some(finding => finding.code === 'platform-contract'));
  } finally { assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); }
});

test('adversarial controls fail observable ownership, contract or evidence obligations', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'projector-readiness-negative-'));
  const expected = ['hidden-new-consumer', 'invented-justification', 'unused-dependency', 'obsolete-route', 'obsolete-route', 'platform-contract'];
  try {
    for (const [index, variant] of readinessVariants.entries()) {
      const trial = await createReadinessTrial(path.join(directory, String(index))); await installReadinessControl(trial.root);
      await seedReadinessVariant(trial.root, variant);
      const result = await evaluateReadiness(trial.root, { authoredControl: true });
      assert.equal(result.passed, false, variant);
      assert.ok(result.findings.some(finding => finding.code === expected[index]), JSON.stringify({ variant, result }));
    }
  } finally { assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); }
});
