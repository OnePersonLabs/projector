import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IndexPool, git, hash, rootIdentity } from '../src/index/index.ts';
import { Kernel } from '../src/kernel/index.ts';
import { fixture } from './helpers.ts';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { LIMITS } from '../src/index/index.ts';

test('working and revision inventories own large and invalid UTF-8 assets by raw bytes', async () => {
  const f = await fixture({ '.gitignore': 'ignored/\n', 'dist/owned.ts': 'export const Owned = 1;' });
  const pool = new IndexPool();
  try {
    const large = Buffer.alloc(34 * 1024 * 1024, 255); const invalid = Buffer.from([255, 254, 0, 128]);
    await writeFile(path.join(f.root, 'large.bank'), large); await writeFile(path.join(f.root, 'invalid.bin'), invalid);
    await mkdir(path.join(f.root, 'ignored')); await writeFile(path.join(f.root, 'ignored', 'excluded.bin'), invalid);
    await git(f.root, ['add', 'large.bank', 'invalid.bin']); await git(f.root, ['commit', '-m', 'Assets']);
    const database = path.join(f.directory, 'index.sqlite');
    const working = await pool.run({ root: f.root, database, kind: 'working' });
    const revision = await pool.run({ root: f.root, database, kind: 'revision', revision: 'HEAD' });
    for (const indexed of [working, revision]) {
      assert.ok(indexed.counters.sourceBytes > 32 * 1024 * 1024);
      assert.ok(indexed.inventory.includes('dist/owned.ts'));
      assert.ok(!indexed.inventory.includes('ignored/excluded.bin'));
      const asset = indexed.files.find(file => file.path === 'large.bank')!;
      assert.equal(asset.hash, hash(large)); assert.equal(asset.byteLength, large.length);
      assert.equal(asset.source, ''); assert.equal(asset.units[0]!.body, '');
      assert.equal(indexed.files.find(file => file.path === 'invalid.bin')!.hash, hash(invalid));
    }
    assert.ok(working.counters.parsedFiles < working.counters.extractions);
    const warm = await pool.run({ root: f.root, database, kind: 'working' });
    assert.equal(warm.counters.extractions, 0);
  } finally { await pool.close(); await f.cleanup(); }
});

test('explicit checkout allocation supports cooperating batches without another worktree', async () => {
  const f = await fixture({ 'player.ts': 'export const Player = 1;' });
  const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
  try {
    const identity = await rootIdentity(f.root);
    await writeFile(path.join(identity.gitDir, 'projector-candidate.json'), JSON.stringify({ version: 1, mode: 'checkout', candidate: 'direct', root: identity.root, baseline: f.revision, writerContract: 'acknowledged-batches' }));
    const { rootId } = await kernel.handle({ op: 'openRoot', root: f.root, profile: 'managed', candidate: 'direct' }) as { rootId: string };
    await kernel.handle({ op: 'checkpoint', rootId });
    const { batchId } = await kernel.handle({ op: 'beginBatch', rootId, writer: 'test', paths: ['player.ts'] }) as { batchId: string };
    await writeFile(path.join(f.root, 'player.ts'), 'export const Player = 2;');
    await kernel.handle({ op: 'completeBatch', rootId, batchId });
    const answer = await kernel.handle({ op: 'read', rootId, view: 'current', reference: '[[code:player.ts#Player]]' }) as { data: { status: string } };
    assert.equal(answer.data.status, 'resolved');
  } finally { await kernel.close(); await f.cleanup(); }
});

test('deadline discards the stalled worker and a replacement can publish', async () => {
  const f = await fixture({ 'a.ts': 'export const A = 1;' }); let starts = 0;
  const pool = new IndexPool(2000, url => ++starts === 1 ? new Worker('setInterval(() => {}, 1000)', { eval: true }) : new Worker(url));
  try {
    const job = { root: f.root, database: path.join(f.directory, 'index.sqlite'), kind: 'revision' as const, revision: f.revision };
    await assert.rejects(pool.run(job), /deadline exceeded/);
    const result = await pool.run(job); assert.equal(result.files[0]!.path, 'a.ts'); assert.equal(starts, 2);
  } finally { await pool.close(); await f.cleanup(); }
});

test('artifact addresses resolve precisely and a repository import follows incremental edits', async () => {
  const f = await fixture({ 'main.py': 'import first\n', 'first.py': 'def first():\n    return 1\n', 'second.py': 'def second():\n    return 2\n', 'theme.css': '.Player { color: red; }', 'player.ts': 'export const Player = 1;' });
  const root = await f.candidate(); const kernel = new Kernel({ stateDir: path.join(f.directory, 'state') });
  try {
    const { rootId } = await kernel.handle({ op: 'openRoot', root, profile: 'managed', candidate: 'fixture' }) as { rootId: string };
    await kernel.handle({ op: 'checkpoint', rootId });
    const bare = await kernel.handle({ op: 'read', rootId, view: 'current', reference: 'Player' }) as { data: { status: string } };
    assert.equal(bare.data.status, 'resolved');
    const style = await kernel.handle({ op: 'read', rootId, view: 'current', reference: '[[artifact:style:theme.css#Player]]' }) as { data: { status: string } };
    assert.equal(style.data.status, 'resolved');
    const imports = async () => (await kernel.handle({ op: 'read', rootId, view: 'current', selector: { kind: 'imports', id: 'file:main.py' } }) as { data: { status: string; units: { path: string }[] } }).data;
    assert.deepEqual((await imports()).units.map(unit => unit.path), ['first.py']);
    const { batchId } = await kernel.handle({ op: 'beginBatch', rootId, writer: 'test', paths: ['main.py'] }) as { batchId: string };
    await writeFile(path.join(root, 'main.py'), 'import second\n'); await kernel.handle({ op: 'completeBatch', rootId, batchId });
    assert.deepEqual((await imports()).units.map(unit => unit.path), ['second.py']);
  } finally { await kernel.close(); await f.cleanup(); }
});

test('cache evicts by serialized bytes before source duplication can exhaust SQLite', async () => {
  const source = 'A'.repeat(900_000);
  const f = await fixture(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`text/file-${i}.txt`, source])));
  const pool = new IndexPool();
  try {
    const database = path.join(f.directory, 'index.sqlite');
    const indexed = await pool.run({ root: f.root, database, kind: 'working' });
    assert.equal(indexed.files.length, 30);
    const db = new DatabaseSync(database);
    try {
      const row = db.prepare('SELECT count(*) AS count, sum(length(CAST(record AS BLOB))) AS bytes FROM extraction').get()!;
      assert.ok(Number(row.bytes) <= LIMITS.cachePayloadBytes);
      assert.ok(Number(row.count) < 30, 'eviction must include entries written earlier in this transaction');
      assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name), ['extraction']);
    } finally { db.close(); }
  } finally { await pool.close(); await f.cleanup(); }
});
