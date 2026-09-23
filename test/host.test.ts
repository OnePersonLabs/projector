import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, rm, readFile, realpath, lstat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { startOwner } from '../src/host/server.ts';
import { send, connectOwner, EndpointError } from '../src/host/client.ts';
import { settings, PROTOCOL, VERSION, MAX_BYTES, readCredential } from '../src/host/config.ts';

const execute = promisify(execFile);
async function port(): Promise<number> {
  const socket = createServer(); socket.listen({ host: '127.0.0.1', port: 0 }); await once(socket, 'listening');
  const address = socket.address(); assert(address && typeof address === 'object');
  await new Promise<void>((done, reject) => socket.close(error => error ? reject(error) : done())); return address.port;
}
async function workspace() {
  const path = await mkdtemp(join(tmpdir(), 'projector-host-'));
  return { path, async dispose() {
    assert(resolve(path).startsWith(resolve(tmpdir()) + sep));
    await rm(path, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  } };
}

test('exclusive loopback bind admits exactly one owner and authenticates before dispatch', async t => {
  const fixture = await workspace(); t.after(() => fixture.dispose());
  const config = settings({ home: join(fixture.path, 'state'), port: await port() });
  let initializations = 0, dispatches = 0;
  const factory = () => { initializations++; return { async handle() { dispatches++; return { count: dispatches }; }, async close() {} }; };
  const attempts = await Promise.allSettled(Array.from({ length: 16 }, () => startOwner(config, factory)));
  const winners = attempts.filter(result => result.status === 'fulfilled');
  assert.equal(winners.length, 1, JSON.stringify(attempts.filter(r => r.status === 'rejected').map(r => String(r.reason)))); assert.equal(initializations, 1);
  for (const result of attempts) if (result.status === 'rejected') assert.equal(result.reason.code, 'EADDRINUSE');
  const winner = winners[0]!; assert.equal(winner.status, 'fulfilled'); t.after(() => winner.value.close());
  await assert.rejects(startOwner({ ...config, port: await port() }, factory), /configured for port/);
  assert.equal(initializations, 1);
  const token = await readCredential(config); assert(token);
  const hello = await send(config, { op: 'hello', protocol: PROTOCOL, version: VERSION }, token) as Record<string, unknown>;
  assert.equal(hello.ownerId, winner.value.ownerId);
  await assert.rejects(send(config, { op: 'read' }, undefined), (error: unknown) => error instanceof EndpointError && error.status === 401);
  await assert.rejects(send(config, { op: 'read' }, 'a'.repeat(64)), (error: unknown) => error instanceof EndpointError && error.status === 401);
  await assert.rejects(send(config, { op: 'hello', protocol: 99, version: VERSION }, token), (error: unknown) => error instanceof EndpointError && error.status === 409);
  const browser = await fetch(`http://127.0.0.1:${config.port}`, { method: 'POST', headers: { origin: 'https://example.test', authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{"op":"read"}' });
  assert.equal(browser.status, 403);
  const oversized = await fetch(`http://127.0.0.1:${config.port}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ op: 'read', value: 'x'.repeat(MAX_BYTES) }) });
  assert.equal(oversized.status, 413);
  await assert.rejects(send(config, { op: 'read', source: 'a'.repeat(MAX_BYTES) }, token), /payload budget/);
  assert.equal(dispatches, 0);
  assert.deepEqual(await send(config, { op: 'inspectStatus' }, token), { count: 1 });
  if (process.platform === 'win32') {
    const command = '$a=[System.IO.Directory]::GetAccessControl($env:PROJECTOR_CHECK_DIRECTORY); [Console]::WriteLine($a.Access.Count); [Console]::WriteLine($a.Access[0].IsInherited); [Console]::WriteLine($a.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value)';
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { windowsHide: true, env: { ...process.env, PROJECTOR_CHECK_DIRECTORY: config.home } });
    assert.deepEqual(stdout.trim().split(/\r?\n/), ['1', 'False', 'True']);
  } else assert.equal((await lstat(config.home)).mode & 0o077, 0);
});

test('request admission and shutdown remain bounded while an operation is running', async t => {
  const fixture = await workspace();
  const config = settings({ home: join(fixture.path, 'state'), port: await port() });
  let resolveWork!: () => void, resolveStarted!: () => void, running = 0;
  const work = new Promise<void>(resolve => { resolveWork = resolve; });
  const started = new Promise<void>(resolve => { resolveStarted = resolve; });
  const owner = await startOwner(config, () => ({ async handle() { running++; if (running === 64) resolveStarted(); await work; return { settled: true }; }, async close() {} }));
  t.after(async () => { resolveWork(); await owner.close(); await fixture.dispose(); });
  const token = await readCredential(config);
  const pending = Array.from({ length: 64 }, () => send(config, { op: 'read' }, token));
  await started;
  await assert.rejects(send(config, { op: 'read' }, token), (error: unknown) => error instanceof EndpointError && error.status === 429);
  await assert.rejects(send(config, { op: 'shutdown' }, token), (error: unknown) => error instanceof EndpointError && error.status === 429);
  resolveWork(); const results = await Promise.all(pending); assert.equal(results.length, 64);
});

test('foreign configured endpoint is rejected without searching another port', async t => {
  const fixture = await workspace(); t.after(() => fixture.dispose());
  const config = settings({ home: join(fixture.path, 'state'), port: await port() });
  const foreign = createHttpServer((_request, response) => response.writeHead(200, { 'content-type': 'application/json' }).end('{"product":"foreign"}'));
  await new Promise<void>(done => foreign.listen(config.port, '127.0.0.1', done));
  t.after(async () => { foreign.closeAllConnections(); await new Promise<void>(done => foreign.close(() => done())); });
  await assert.rejects(connectOwner(config), /foreign or incompatible/);
});

test('node sqlite owns WAL connection in worker while coordinator can respond', async t => {
  const fixture = await workspace(); t.after(() => fixture.dispose());
  const db = join(fixture.path, 'index.sqlite');
  const source = `const {parentPort,workerData}=require('node:worker_threads'); const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(workerData); db.exec("PRAGMA journal_mode=WAL;CREATE TABLE evidence(value TEXT);INSERT INTO evidence VALUES ('worker')"); parentPort.postMessage({ready:true}); parentPort.once('message',()=>{const start=performance.now(); const result=db.prepare('WITH RECURSIVE x(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM x WHERE n<1000000) SELECT sum(n) total FROM x').get(); const row=db.prepare('SELECT value FROM evidence').get(); const wal=db.prepare('PRAGMA journal_mode').get(); db.close(); parentPort.postMessage({result,row,wal,elapsedMs:performance.now()-start});parentPort.close();});`;
  const worker = new Worker(source, { eval: true, workerData: db }); t.after(() => worker.terminate());
  await once(worker, 'message');
  const completion = once(worker, 'message'); worker.postMessage('run');
  let ticks = 0, done = false;
  const tick = () => { if (!done) { ticks++; setImmediate(tick); } }; setImmediate(tick);
  const [message] = await completion; done = true;
  assert.equal(message.result.total, 500000500000); assert.equal(message.row.value, 'worker'); assert.equal(message.wal.journal_mode, 'wal'); assert(ticks > 0);
  t.diagnostic(JSON.stringify({ sqliteElapsedMs: message.elapsedMs, coordinatorTurns: ticks, databaseBytes: (await lstat(db)).size }));
});

test('canonical Git identity separates real linked candidates and preserves alias identity', async t => {
  const fixture = await workspace(); t.after(() => fixture.dispose());
  const repository = join(fixture.path, 'source'), candidate = join(fixture.path, 'candidate'); await mkdir(repository);
  const git = (...args: string[]) => execute('git', args, { cwd: repository, windowsHide: true });
  await git('init', '--initial-branch=main'); await git('config', 'core.autocrlf', 'false'); await writeFile(join(repository, 'source.txt'), 'before\n'); await git('add', '.'); await git('-c', 'user.name=Projector Test', '-c', 'user.email=projector@example.invalid', 'commit', '-m', 'baseline');
  await git('worktree', 'add', '--detach', candidate, 'HEAD');
  assert.equal(await realpath(candidate), await realpath(join(candidate, '..', 'candidate')));
  const rootGit = (await git('rev-parse', '--absolute-git-dir')).stdout.trim();
  const candidateGit = (await execute('git', ['rev-parse', '--absolute-git-dir'], { cwd: candidate })).stdout.trim();
  assert.notEqual(rootGit, candidateGit);
  assert.equal((await execute('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: candidate })).stdout.trim(), rootGit);
  assert.equal(await readFile(join(candidate, 'source.txt'), 'utf8'), 'before\n');
});
