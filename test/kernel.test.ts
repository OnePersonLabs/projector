import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Kernel } from '../src/kernel/index.ts';
import { IndexPool } from '../src/index/index.ts';
import { fixture, deferred } from './helpers.ts';

type Status = { rootId: string; revision: string; counters: Record<string, number>; workingCurrent: string; batches: { id: string }[] };
type Read = { freshness: string; data?: { status: string; unit?: { body: string }; units?: unknown[] }; token?: Record<string, unknown>; reason?: string };
const call = (kernel: Kernel, request: Record<string, unknown>) => kernel.handle(request) as Promise<Status>;
const read = (kernel: Kernel, request: Record<string, unknown>) => kernel.handle({ op: 'read', ...request }) as Promise<Read>;

test('T2: 100 undemanded managed edits and 32 readers extract the final version once; warm read performs no source work', async () => {
  const f = await fixture({ 'src/player.ts': 'export function Player() { return 0; }' });
  const root = await f.candidate(); const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
  try {
    const opened = await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' });
    const request = { rootId: opened.rootId, view: 'current', reference: '[[Player]]' };
    assert.equal((await read(kernel, request)).freshness, 'unavailable');
    await call(kernel, { op: 'checkpoint', rootId: opened.rootId });
    const before = await call(kernel, { op: 'inspectStatus', rootId: opened.rootId });
    for (let i = 1; i <= 100; i++) {
      const batch = await kernel.handle({ op: 'beginBatch', rootId: opened.rootId, writer: 'test', paths: ['src/player.ts'] }) as { batchId: string };
      await writeFile(path.join(root, 'src/player.ts'), `export function Player() { return ${i}; }`);
      await call(kernel, { op: 'completeBatch', rootId: opened.rootId, batchId: batch.batchId });
    }
    const readers = await Promise.all(Array.from({ length: 32 }, () => read(kernel, request)));
    assert.ok(readers.every(result => result.freshness === 'validated' && result.data?.status === 'resolved'));
    assert.match(readers[0]!.data!.unit!.body, /100/);
    const after = await call(kernel, { op: 'inspectStatus', rootId: opened.rootId });
    assert.equal(after.counters.extractions! - before.counters.extractions!, 1);
    assert.equal(after.counters.parsedFiles! - before.counters.parsedFiles!, 1);
    await read(kernel, request);
    const warm = await call(kernel, { op: 'inspectStatus', rootId: opened.rootId });
    for (const counter of ['sourceBytes', 'hashBytes', 'parsedFiles', 'extractions', 'subprocesses', 'modelCalls', 'dependencyVisits']) assert.equal(warm.counters[counter], after.counters[counter], counter);
    assert.equal(warm.counters.barriers! - after.counters.barriers!, 1);
    console.log(JSON.stringify({ case: 'T2', edits: 100, readers: 32, delta: Object.fromEntries(Object.keys(after.counters).map(key => [key, after.counters[key]! - before.counters[key]!])) }));
  } finally { await kernel.close(); await f.cleanup(); }
});

test('T3/T5: empty population gains members, collision blocks uniqueness, unknown writes need checkpoint, prior revision survives', async () => {
  const f = await fixture({ 'src/player.ts': 'export function Player() { return 1; }' });
  const root = await f.candidate(); const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
  try {
    const { rootId } = await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' });
    const sealed = await call(kernel, { op: 'checkpoint', rootId });
    assert.equal((await read(kernel, { rootId, view: 'current', selector: { kind: 'path', root: '.', prefix: 'new/' } })).data?.units?.length, 0);
    const { batchId } = await kernel.handle({ op: 'beginBatch', rootId, writer: 'test', paths: ['new/player.ts'] }) as { batchId: string };
    await mkdir(path.join(root, 'new')); await writeFile(path.join(root, 'new/player.ts'), 'export function Player() { return 2; }');
    assert.equal((await read(kernel, { rootId, view: 'current', reference: 'Player' })).freshness, 'pending');
    await call(kernel, { op: 'completeBatch', rootId, batchId });
    assert.equal((await read(kernel, { rootId, view: 'current', reference: 'Player' })).data?.status, 'ambiguous');
    assert.ok((await read(kernel, { rootId, view: 'current', selector: { kind: 'path', root: '.', prefix: 'new/' } })).data!.units!.length > 0);
    assert.equal((await read(kernel, { rootId, view: 'revision', revision: sealed.revision, reference: 'Player' })).data?.status, 'resolved');
    await call(kernel, { op: 'invalidateObservation', rootId, reason: 'Unknown shell writer escaped declared outputs' });
    assert.equal((await read(kernel, { rootId, view: 'current', reference: 'Player' })).freshness, 'unavailable');
    assert.equal((await read(kernel, { rootId, view: 'revision', revision: sealed.revision, reference: 'Player' })).freshness, 'validated');
  } finally { await kernel.close(); await f.cleanup(); }
});

test('T4: racing extraction cannot publish stale content or clear newer dirtiness', async () => {
  const f = await fixture({ 'player.ts': 'export const Player = 1;' }); const root = await f.candidate();
  const entered = deferred<void>(); const released = deferred<void>(); let hold = true;
  const kernel = new Kernel({ stateDir: path.join(f.directory, 'state'), beforePublish: async () => { if (hold) { entered.resolve(); await released.promise; } } });
  try {
    const { rootId } = await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' }); await call(kernel, { op: 'checkpoint', rootId });
    const mutate = async (value: number) => {
      const { batchId } = await kernel.handle({ op: 'beginBatch', rootId, writer: 'test', paths: ['player.ts'] }) as { batchId: string };
      await writeFile(path.join(root, 'player.ts'), `export const Player = ${value};`); await call(kernel, { op: 'completeBatch', rootId, batchId });
    };
    await mutate(2); const first = read(kernel, { rootId, view: 'current', reference: 'Player' }); await entered.promise;
    await mutate(3); hold = false; released.resolve(); assert.equal((await first).freshness, 'pending');
    const final = await read(kernel, { rootId, view: 'current', reference: 'Player' }); assert.equal(final.freshness, 'validated'); assert.match(final.data!.unit!.body, /3/);
  } finally { released.resolve(); await kernel.close(); await f.cleanup(); }
});

test('T4/T7: interrupted writer journal survives owner restart and deletion/corruption of disposable index', async () => {
  const f = await fixture({ 'player.ts': 'export const Player = 1;' }); const root = await f.candidate(); const stateDir = path.join(f.directory, 'state');
  let kernel = new Kernel({ stateDir });
  try {
    const { rootId } = await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' }); await call(kernel, { op: 'checkpoint', rootId });
    await call(kernel, { op: 'beginBatch', rootId, writer: 'owner', paths: ['player.ts'] }); await writeFile(path.join(root, 'player.ts'), 'export const Player = 2;');
    await kernel.close();
    await writeFile(path.join(stateDir, rootId, 'index.sqlite'), 'not a sqlite database');
    kernel = new Kernel({ stateDir }); await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' });
    assert.notEqual((await read(kernel, { rootId, view: 'current', reference: 'Player' })).freshness, 'validated');
    const other = await kernel.handle({ op: 'checkpoint', rootId, writer: 'other' }) as Read; assert.equal(other.freshness, 'pending');
    const recovered = await call(kernel, { op: 'checkpoint', rootId, writer: 'owner' }); assert.equal(recovered.workingCurrent, 'available');
    assert.match((await read(kernel, { rootId, view: 'current', reference: 'Player' })).data!.unit!.body, /2/);
    assert.equal(await readFile(path.join(root, 'player.ts'), 'utf8'), 'export const Player = 2;');
    await kernel.close(); await rm(path.join(stateDir, rootId, 'index.sqlite'));
    kernel = new Kernel({ stateDir }); await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' });
    assert.equal((await read(kernel, { rootId, view: 'revision', revision: f.revision, reference: 'Player' })).data?.status, 'resolved');
  } finally { await kernel.close(); await f.cleanup(); }
});

test('T5: a lost observation interval during checkpoint cannot publish prior extracted bytes as current', async () => {
  const f = await fixture({ 'player.ts': 'export const Player = 1;' }); const root = await f.candidate();
  const extracted = deferred<void>(); const release = deferred<void>(); const pool = new IndexPool(); let hold = true;
  const kernel = new Kernel({ stateDir: path.join(f.directory, 'state'), backend: {
    async run(job) { const result = await pool.run(job); if (hold && job.kind === 'working') { extracted.resolve(); await release.promise; } return result; },
    close: () => pool.close()
  } });
  try {
    const { rootId } = await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' });
    const checkpoint = kernel.handle({ op: 'checkpoint', rootId }) as Promise<Read>; await extracted.promise;
    await kernel.handle({ op: 'invalidateObservation', rootId, reason: 'Observer interval lost' });
    await writeFile(path.join(root, 'player.ts'), 'export const Player = 2;'); hold = false; release.resolve();
    assert.equal((await checkpoint).freshness, 'pending');
    assert.equal((await read(kernel, { rootId, view: 'current', reference: 'Player' })).freshness, 'unavailable');
    await call(kernel, { op: 'checkpoint', rootId });
    assert.match((await read(kernel, { rootId, view: 'current', reference: 'Player' })).data!.unit!.body, /2/);
  } finally { release.resolve(); await kernel.close(); await f.cleanup(); }
});

test('T5: exact checkpoint bytes come from Git normalization and match another kernel', async () => {
  const f = await fixture({ '.gitattributes': '*.ts text eol=lf\n', 'player.ts': 'export const Player = 1;\n' }); const root = await f.candidate();
  const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') }); const other = new Kernel({ stateDir: path.join(f.directory, 'other-state') });
  try {
    const { rootId } = await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' });
    await writeFile(path.join(root, 'player.ts'), 'export const Player = 1;\r\n');
    const { revision } = await call(kernel, { op: 'checkpoint', rootId });
    const same = await read(kernel, { rootId, view: 'revision', revision, reference: 'code:player.ts' });
    const { rootId: otherId } = await call(other, { op: 'openRoot', root });
    const fresh = await read(other, { rootId: otherId, view: 'revision', revision, reference: 'code:player.ts' });
    assert.equal(same.data!.unit!.body, 'export const Player = 1;\n'); assert.deepEqual(same.data, fresh.data);
  } finally { await kernel.close(); await other.close(); await f.cleanup(); }
});

test('T3: transitive renamed aliases and resolver configuration remain in the cached factual basis', async () => {
  const f = await fixture({
    'barrel.ts': "export { Value as Player } from './middle.js';",
    'middle.ts': "export { Value } from './target.js';",
    'target.ts': 'export const Value = 1;',
    'alternate.ts': 'export const Value = 9;',
    'configured.ts': "import './target.js'; import './alternate.js'; export { Value as Player } from 'alias';",
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { alias: ['./target.ts'] } } })
  });
  const root = await f.candidate(); const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
  try {
    const { rootId } = await call(kernel, { op: 'openRoot', root, profile: 'managed', candidate: 'fixture' }); await call(kernel, { op: 'checkpoint', rootId });
    const query = (file: string) => read(kernel, { rootId, view: 'current', reference: `code:${file}#Player` });
    assert.match((await query('barrel.ts')).data!.unit!.body, /1/); assert.match((await query('configured.ts')).data!.unit!.body, /1/);
    const edit = async (file: string, source: string) => {
      const { batchId } = await kernel.handle({ op: 'beginBatch', rootId, writer: 'test', paths: [file] }) as { batchId: string };
      await writeFile(path.join(root, file), source); await call(kernel, { op: 'completeBatch', rootId, batchId });
    };
    await edit('target.ts', 'export const Value = 2;'); assert.match((await query('barrel.ts')).data!.unit!.body, /2/);
    await edit('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { alias: ['./alternate.ts'] } } }));
    assert.equal((await query('configured.ts')).data?.status, 'rebind');
  } finally { await kernel.close(); await f.cleanup(); }
});
