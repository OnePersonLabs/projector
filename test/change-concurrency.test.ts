import test from 'node:test';
import assert from 'node:assert/strict';
import { exclusive } from '../src/change/io.ts';
import { ChangeService } from '../src/change/index.ts';
import { fixture, gitFixture } from './change-fixture.ts';

test('change exclusion serializes successors after failures and permits independent roots', async () => {
  let release!: () => void, announce!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { announce = resolve; });
  const order: number[] = []; let active = 0, maximum = 0;
  const first = exclusive('canonical-root-a', 'change', async () => {
    active++; maximum = Math.max(maximum, active); order.push(0); announce();
    await held; active--; throw new Error('injected first operation failure');
  });
  const rejected = assert.rejects(first, /injected first operation failure/);
  await entered;
  const successors = Array.from({ length: 32 }, (_, i) => exclusive('canonical-root-a', 'change', async () => {
    active++; maximum = Math.max(maximum, active); order.push(i + 1);
    await Promise.resolve(); active--; return i + 1;
  }));
  assert.deepEqual(order, [0]);
  assert.equal(await exclusive('canonical-root-b', 'change', async () => 'independent'), 'independent');
  release(); await rejected;
  assert.deepEqual(await Promise.all(successors), Array.from({ length: 32 }, (_, i) => i + 1));
  assert.equal(maximum, 1); assert.deepEqual(order, Array.from({ length: 33 }, (_, i) => i));
  assert.equal(await exclusive('canonical-root-a', 'change', async () => 'settled'), 'settled');
});

test('concurrent ChangeService instances allocate exactly one candidate in the shared owner', async () => {
  const input = await fixture();
  const states = await Promise.all(Array.from({ length: 3 }, () => new ChangeService().prepareChange(input)));
  assert.equal(new Set(states.map(item => item.candidateId)).size, 1);
  assert.equal(new Set(states.map(item => item.candidateBranch)).size, 1);
  assert.equal(states.filter(item => item.reused === true).length, 2);
  assert.equal(gitFixture(input.root, 'worktree', 'list', '--porcelain').match(/^worktree /gm)?.length, 2);
});
