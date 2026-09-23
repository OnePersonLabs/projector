import { parentPort } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir, rename, rm, stat, lstat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { extractFile } from '../documents/index.ts';
import type { FileRecord } from '../documents/index.ts';
import { git, hash, safePath } from './git.ts';
import { emptyCounters, LIMITS } from './types.ts';
import type { Indexed, IndexJob, Counters } from './types.ts';

const VERSION = 'projector-extraction-1';
let firstJob = true;
const visible = (file: string) => !file.startsWith('node_modules/') && !file.startsWith('dist/');

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
    CREATE TABLE IF NOT EXISTS revisions (revision TEXT NOT NULL, path TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(revision,path));
    CREATE TABLE IF NOT EXISTS units (revision TEXT NOT NULL, id TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(revision,id));
    CREATE INDEX IF NOT EXISTS names ON units(revision,name);
    CREATE TABLE IF NOT EXISTS revision_access (revision TEXT PRIMARY KEY, used INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS edges (revision TEXT NOT NULL, path TEXT NOT NULL, ordinal INTEGER NOT NULL, record TEXT NOT NULL, PRIMARY KEY(revision,path,ordinal));`);
  return db;
}

async function revisionBytes(root: string, revision: string, counters: Counters): Promise<Map<string, Buffer>> {
  counters.subprocesses++;
  const entries = (await git(root, ['ls-tree', '-rz', '--full-tree', revision])).split('\0').filter(Boolean);
  const blobs: { file: string; oid: string }[] = [];
  for (const entry of entries) {
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('Malformed Git tree record');
    const [, mode, type, oid, file] = match;
    if (!file || !visible(file)) continue;
    if (type !== 'blob' || mode === '120000') throw new Error(`Unsupported Git entry (submodule/symlink): ${file}`);
    blobs.push({ file: safePath(file), oid: oid! });
  }
  if (blobs.length > LIMITS.files) throw new Error('Revision file population exceeds configured budget');
  counters.subprocesses++;
  const platformOptions = process.platform === 'win32' ? ['-c', 'core.longPaths=true'] : [];
  const output = await new Promise<Buffer>((resolve, reject) => {
    const process = spawn('git', [...platformOptions, '-C', root, 'cat-file', '--batch'], { windowsHide: true });
    const chunks: Buffer[] = []; let bytes = 0; let stderr = '';
    process.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > LIMITS.snapshotBytes * 2) { process.kill(); reject(new Error('Git snapshot byte budget exceeded')); } else chunks.push(chunk); });
    process.stderr.on('data', chunk => { stderr += String(chunk); });
    process.on('error', reject); process.on('exit', code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`git cat-file failed (${code}): ${stderr}`)));
    process.stdin.on('error', reject); process.stdin.end(blobs.map(blob => blob.oid).join('\n') + '\n');
  });
  const result = new Map<string, Buffer>(); let offset = 0;
  for (const blob of blobs) {
    const end = output.indexOf(10, offset); const header = output.subarray(offset, end).toString();
    const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
    if (!match || match[1] !== blob.oid) throw new Error(`Git object identity mismatch for ${blob.file}`);
    const size = Number(match[2]);
    if (size > LIMITS.fileBytes) throw new Error(`File byte budget exceeded: ${blob.file}`);
    const bytes = output.subarray(end + 1, end + 1 + size);
    if (bytes.length !== size) throw new Error('Truncated Git object');
    result.set(blob.file, bytes); offset = end + size + 2;
  }
  return result;
}

async function run(job: IndexJob): Promise<Indexed> {
  const counters = emptyCounters(); const warnings: string[] = []; const deleted: string[] = [];
  if (firstJob) { counters.workerStarts++; firstJob = false; }
  let revision: string; let inventory: string[]; let bytes: Map<string, Buffer>;
  if (job.kind === 'revision') {
    counters.subprocesses++;
    revision = (await git(job.root, ['rev-parse', '--verify', '--end-of-options', `${job.revision ?? 'HEAD'}^{commit}`])).trim();
    bytes = await revisionBytes(job.root, revision, counters); inventory = [...bytes.keys()];
  } else {
    revision = 'working';
    if (job.paths) inventory = [...new Set(job.paths.map(safePath))];
    else { counters.subprocesses++; inventory = [...new Set((await git(job.root, ['ls-files', '-co', '--exclude-standard', '-z'])).split('\0').filter(file => file && visible(file)))]; }
    if (inventory.length > LIMITS.files) throw new Error('Working file population exceeds configured budget');
    bytes = new Map();
    for (const file of inventory) {
      const full = path.join(job.root, file);
      try {
        const info = await lstat(full);
        if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsupported source entry: ${file}`);
        if (info.size > LIMITS.fileBytes) throw new Error(`File byte budget exceeded: ${file}`);
        bytes.set(file, await readFile(full));
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') deleted.push(file); else throw error;
      }
    }
  }
  const db = await openDatabase(job.database, warnings);
  try {
    const get = db.prepare('SELECT record FROM extraction WHERE key=?');
    const put = db.prepare('INSERT OR REPLACE INTO extraction VALUES(?,?,?,?)');
    const files: FileRecord[] = []; const writes: { key: string; record: FileRecord }[] = [];
    let total = 0;
    for (const [file, content] of bytes) {
      counters.sourceBytes += content.length; counters.hashBytes += content.length; total += content.length;
      if (total > LIMITS.snapshotBytes) throw new Error('Snapshot source byte budget exceeded');
      const key = hash(`${VERSION}:${file}:${hash(content)}`); const cached = get.get(key);
      const record = cached ? JSON.parse(String(cached.record)) as FileRecord : extractFile(file, content.toString('utf8'));
      if (!cached) { counters.parsedFiles++; counters.extractions++; writes.push({ key, record }); }
      files.push(record);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const { key, record } of writes) put.run(key, record.path, JSON.stringify(record), Date.now());
      const putRevision = db.prepare('INSERT OR REPLACE INTO revisions VALUES(?,?,?)');
      const delUnits = db.prepare('DELETE FROM units WHERE revision=? AND path=?');
      const delEdges = db.prepare('DELETE FROM edges WHERE revision=? AND path=?');
      const putUnit = db.prepare('INSERT OR REPLACE INTO units VALUES(?,?,?,?,?,?)');
      const putEdge = db.prepare('INSERT INTO edges VALUES(?,?,?,?)');
      for (const record of files) {
        putRevision.run(revision, record.path, record.hash); delUnits.run(revision, record.path); delEdges.run(revision, record.path);
        for (const unit of record.units) putUnit.run(revision, unit.id, record.path, unit.kind, unit.key, JSON.stringify(unit));
        for (const [i, reference] of record.references.entries()) putEdge.run(revision, record.path, i, JSON.stringify(reference));
      }
      for (const file of deleted) { db.prepare('DELETE FROM revisions WHERE revision=? AND path=?').run(revision, file); delUnits.run(revision, file); delEdges.run(revision, file); }
      db.prepare('INSERT OR REPLACE INTO revision_access VALUES(?,?)').run(revision, Date.now());
      for (const old of db.prepare('SELECT revision FROM revision_access ORDER BY used DESC LIMIT -1 OFFSET 4').all()) {
        for (const table of ['revisions', 'units', 'edges', 'revision_access']) db.prepare(`DELETE FROM ${table} WHERE revision=?`).run(old.revision!);
      }
      db.exec('DELETE FROM extraction WHERE key IN (SELECT key FROM extraction ORDER BY used DESC LIMIT -1 OFFSET 20000)');
      db.exec('COMMIT'); counters.transactions++;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    counters.cacheBytes = (await stat(job.database)).size;
    return { revision, files, deleted, inventory, counters, warnings };
  } finally { db.close(); }
}

parentPort?.on('message', (job: IndexJob) => { void run(job).then(result => parentPort!.postMessage({ result }), error => parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error) })); });
