import { parentPort } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { isUtf8 } from 'node:buffer';
import { mkdir, rename, rm, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createDocumentIntelligence, metadataFile } from '../documents/index.ts';
import type { FileRecord } from '../documents/index.ts';
import { git, hash, safePath } from './git.ts';
import { emptyCounters, LIMITS } from './types.ts';
import type { Indexed, IndexJob, Counters } from './types.ts';
import { revisionSources, workingBytes } from './bytes.ts';
import type { SourceBytes } from './bytes.ts';

const intelligence = createDocumentIntelligence();
let firstJob = true;

async function openDatabase(file: string, warnings: string[]): Promise<DatabaseSync> {
  await mkdir(path.dirname(file), { recursive: true });
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(file);
    const check = db.prepare('PRAGMA quick_check').get();
    if (check?.quick_check !== 'ok') throw Object.assign(new Error('SQLite integrity failure'), { errcode: 11 });
  } catch (error) {
    db?.close();
    if (!(error instanceof Error) || !('errcode' in error) || ![11, 26].includes(Number(error.errcode))) throw error;
    await rm(`${file}.corrupt`, { force: true });
    await rename(file, `${file}.corrupt`);
    await rm(`${file}-wal`, { force: true }); await rm(`${file}-shm`, { force: true });
    warnings.push('Disposable index was corrupt; rebuilding from authored and Git data');
    db = new DatabaseSync(file);
  }
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;
    PRAGMA max_page_count=16384; PRAGMA wal_autocheckpoint=512; PRAGMA journal_size_limit=8388608;
    CREATE TABLE IF NOT EXISTS extraction (key TEXT PRIMARY KEY, path TEXT NOT NULL, record TEXT NOT NULL, used INTEGER NOT NULL);
    DROP TABLE IF EXISTS revisions; DROP TABLE IF EXISTS units;
    DROP TABLE IF EXISTS revision_access; DROP TABLE IF EXISTS edges;`);
  return db;
}

async function* revisionBytes(root: string, revision: string, counters: Counters): AsyncGenerator<[string, SourceBytes]> {
  counters.subprocesses++;
  const entries = (await git(root, ['ls-tree', '-rz', '--full-tree', revision])).split('\0').filter(Boolean);
  const blobs: { file: string; oid: string }[] = [];
  for (const entry of entries) {
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('Malformed Git tree record');
    const [, mode, type, oid, file] = match;
    if (!file) continue;
    if (type !== 'blob' || mode === '120000') throw new Error(`Unsupported Git entry (submodule/symlink): ${file}`);
    blobs.push({ file: safePath(file), oid: oid! });
  }
  if (blobs.length > LIMITS.files) throw new Error('Revision file population exceeds configured budget');
  counters.subprocesses++;
  yield* revisionSources(root, blobs);
}

async function* workingSources(root: string, inventory: string[], deleted: string[]): AsyncGenerator<[string, SourceBytes]> {
  for (const file of inventory) {
    const full = path.join(root, file);
    try {
      const info = await lstat(full);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsupported source entry: ${file}`);
      yield [file, await workingBytes(full)];
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') deleted.push(file); else throw error;
    }
  }
}

async function run(job: IndexJob): Promise<Indexed> {
  const counters = emptyCounters(); const warnings: string[] = []; const deleted: string[] = [];
  if (firstJob) { counters.workerStarts++; firstJob = false; }
  const host = await intelligence;
  let revision: string; let inventory: string[] = []; let bytes: AsyncIterable<[string, SourceBytes]>;
  if (job.kind === 'revision') {
    counters.subprocesses++;
    revision = (await git(job.root, ['rev-parse', '--verify', '--end-of-options', `${job.revision ?? 'HEAD'}^{commit}`])).trim();
    bytes = revisionBytes(job.root, revision, counters);
  } else {
    revision = 'working';
    if (job.paths) inventory = [...new Set(job.paths.map(safePath))];
    else { counters.subprocesses++; inventory = [...new Set((await git(job.root, ['ls-files', '-co', '--exclude-standard', '-z'])).split('\0').filter(Boolean))]; }
    if (inventory.length > LIMITS.files) throw new Error('Working file population exceeds configured budget');
    bytes = workingSources(job.root, inventory, deleted);
  }
  const db = await openDatabase(job.database, warnings);
  try {
    const get = db.prepare('SELECT record FROM extraction WHERE key=?');
    const put = db.prepare('INSERT OR REPLACE INTO extraction VALUES(?,?,?,?)');
    const files: FileRecord[] = []; const writes: { key: string; record: FileRecord }[] = [];
    let total = 0;
    for await (const [file, input] of bytes) {
      if (job.kind === 'revision') inventory.push(file);
      counters.sourceBytes += input.size; counters.hashBytes += input.size;
      const textual = input.content && !input.content.includes(0) && isUtf8(input.content);
      const content = textual && total + input.content!.length <= LIMITS.snapshotBytes ? input.content : undefined;
      const key = hash(`${host.fingerprint}:${file}:${input.hash}:${content ? 'parsed' : 'metadata'}`); const cached = get.get(key);
      const record = cached ? JSON.parse(String(cached.record)) as FileRecord : content ? await host.extract(file, content) : metadataFile(file, input.hash, input.size);
      total += Buffer.byteLength(record.source);
      if (!cached) { if (content) counters.parsedFiles++; counters.extractions++; writes.push({ key, record }); }
      files.push(record);
    }
    if (!job.paths) {
      const resolved = host.resolveRepository(new Map(files.map(file => [file.path, file])));
      files.splice(0, files.length, ...resolved.values());
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      // Only extraction is consumed by this cache. Persisting a second copy of
      // every unit/reference multiplied source bodies without a reader.
      const byteCount = 'length(CAST(record AS BLOB))';
      let retained = Number(db.prepare(`SELECT coalesce(sum(${byteCount}),0) AS bytes FROM extraction`).get()!.bytes);
      const oldest = db.prepare(`SELECT key, ${byteCount} AS bytes FROM extraction ORDER BY used ASC`).all();
      let evicted = 0;
      const remove = db.prepare('DELETE FROM extraction WHERE key=?');
      for (const { key, record } of writes) {
        const serialized = JSON.stringify(record); const size = Buffer.byteLength(serialized);
        if (size > LIMITS.cachePayloadBytes) continue;
        while (retained + size > LIMITS.cachePayloadBytes && evicted < oldest.length) {
          const entry = oldest[evicted++]!; remove.run(entry.key!); retained -= Number(entry.bytes);
        }
        put.run(key, record.path, serialized, Date.now()); retained += size; oldest.push({ key, bytes: size });
      }
      db.exec('DELETE FROM extraction WHERE key IN (SELECT key FROM extraction ORDER BY used DESC LIMIT -1 OFFSET 20000)');
      db.exec('COMMIT'); counters.transactions++;
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    counters.cacheBytes = (await stat(job.database)).size;
    return { revision, files, deleted, inventory, counters, warnings };
  } finally { db.close(); }
}

parentPort?.on('message', (job: IndexJob) => { void run(job).then(result => parentPort!.postMessage({ result }), error => parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error) })); });
