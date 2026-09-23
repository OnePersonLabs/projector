import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IndexPool } from '../src/index/index.ts';
import { Kernel } from '../src/kernel/index.ts';
import { fixture } from './helpers.ts';

type Status = { rootId: string; counters: Record<string, number> };
test('T8: local managed workload has the same source/extraction cost with 10 and 2000 untouched background files', async () => {
  const measurements: Record<string, number>[] = [];
  for (const size of [10, 2000]) {
    const files = Object.fromEntries(Array.from({ length: size }, (_, i) => [`background/file-${i}.ts`, `export const Value${i} = ${i};`]));
    const f = await fixture({ ...files, 'player.ts': 'export const Player = 1;' });
    const root = await f.candidate(); const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
    try {
      const { rootId } = await kernel.handle({ op: 'openRoot', root, profile: 'managed', candidate: 'fixture' }) as Status;
      await kernel.handle({ op: 'checkpoint', rootId });
      const before = await kernel.handle({ op: 'inspectStatus', rootId }) as Status;
      const { batchId } = await kernel.handle({ op: 'beginBatch', rootId, writer: 'benchmark', paths: ['player.ts'] }) as { batchId: string };
      await writeFile(path.join(root, 'player.ts'), 'export const Player = 2;');
      await kernel.handle({ op: 'completeBatch', rootId, batchId });
      await kernel.handle({ op: 'read', rootId, view: 'current', reference: '[[code:player.ts#Player]]' });
      const after = await kernel.handle({ op: 'inspectStatus', rootId }) as Status;
      const delta = Object.fromEntries(['sourceBytes', 'hashBytes', 'parsedFiles', 'extractions', 'dependencyVisits', 'subprocesses', 'transactions', 'modelCalls'].map(key => [key, after.counters[key]! - before.counters[key]!]));
      measurements.push(delta);
      console.log(JSON.stringify({ case: 'T8', backgroundFiles: size, cold: before.counters, local: delta }));
    } finally { await kernel.close(); await f.cleanup(); }
  }
  assert.deepEqual(measurements[0], measurements[1]);
  assert.equal(measurements[0]!.extractions, 1);
});

test('T4: a crashed worker rejects its publication and another root continues on the bounded pool', async () => {
  const f = await fixture({ 'a.ts': 'export const A = 1;' });
  const second = await fixture({ 'b.ts': 'export const B = 2;' });
  let starts = 0;
  const pool = new IndexPool(10_000, url => {
    starts++;
    if (starts === 1) return new Worker('process.exit(17)', { eval: true });
    return new Worker(url);
  });
  try {
    const jobs = await Promise.allSettled([
      pool.run({ root: f.root, database: path.join(f.directory, 'index.sqlite'), kind: 'revision', revision: f.revision }),
      pool.run({ root: second.root, database: path.join(second.directory, 'index.sqlite'), kind: 'revision', revision: second.revision })
    ]);
    assert.equal(jobs[0]!.status, 'rejected');
    assert.equal(jobs[1]!.status, 'fulfilled');
    const retry = await pool.run({ root: f.root, database: path.join(f.directory, 'index.sqlite'), kind: 'revision', revision: f.revision });
    assert.equal(retry.files[0]!.path, 'a.ts');
    assert.ok(starts <= 3);
  } finally { await pool.close(); await f.cleanup(); await second.cleanup(); }
});

test('T5: malformed declaration inventory cannot certify bare uniqueness; new Markdown ownership cannot silently rebind', async () => {
  const f = await fixture({ 'player.ts': 'export const Player = 1;', 'broken.ts': 'export function ???' }); const root = await f.candidate();
  const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
  try {
    const { rootId } = await kernel.handle({ op: 'openRoot', root, profile: 'managed', candidate: 'fixture' }) as Status;
    await kernel.handle({ op: 'checkpoint', rootId });
    const first = await kernel.handle({ op: 'read', rootId, view: 'current', reference: 'Player' }) as { data: { status: string } };
    assert.equal(first.data.status, 'unknown');
    const edit = async (file: string, source: string) => {
      const { batchId } = await kernel.handle({ op: 'beginBatch', rootId, writer: 'test', paths: [file] }) as { batchId: string };
      await writeFile(path.join(root, file), source); await kernel.handle({ op: 'completeBatch', rootId, batchId });
    };
    await edit('broken.ts', 'export const Other = 0;');
    const valid = await kernel.handle({ op: 'read', rootId, view: 'current', reference: 'Player' }) as { data: { status: string } }; assert.equal(valid.data.status, 'resolved');
    await edit('term.md', '# Player\n\nA Markdown definition.\n');
    const rebound = await kernel.handle({ op: 'read', rootId, view: 'current', reference: 'Player' }) as { data: { status: string } }; assert.equal(rebound.data.status, 'rebind');
  } finally { await kernel.close(); await f.cleanup(); }
});

test('T3: hidden tracked declarations are included in the global uniqueness population', async () => {
  const f = await fixture({ 'player.ts': 'export const Player = 1;', '.hidden/player.ts': 'export const Player = 2;' });
  const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
  try {
    const { rootId } = await kernel.handle({ op: 'openRoot', root: f.root }) as Status;
    const answer = await kernel.handle({ op: 'read', rootId, view: 'revision', revision: f.revision, reference: 'Player' }) as { data: { status: string } };
    assert.equal(answer.data.status, 'ambiguous');
  } finally { await kernel.close(); await f.cleanup(); }
});

test('T8: released idle roots surrender their admission and snapshot memory', async () => {
  const fixtures: Awaited<ReturnType<typeof fixture>>[] = []; const kernel = new Kernel();
  try {
    for (let i = 0; i < 9; i++) {
      const f = await fixture(); fixtures.push(f);
      const { rootId } = await kernel.handle({ op: 'openRoot', root: f.root }) as Status;
      const released = await kernel.handle({ op: 'releaseRoot', rootId }) as { released: boolean };
      assert.equal(released.released, true);
    }
  } finally { await kernel.close(); await Promise.all(fixtures.map(f => f.cleanup())); }
});
