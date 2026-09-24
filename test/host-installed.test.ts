import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { install } from '../src/host/install.ts';
import { send } from '../src/host/client.ts';
import { readCredential, settings, VERSION } from '../src/host/config.ts';

const execute = promisify(execFile);
async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address(); assert(address && typeof address === 'object');
  await new Promise<void>(done => server.close(() => done())); return address.port;
}
async function bytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) total += entry.isDirectory() ? await bytes(join(directory, entry.name)) : (await stat(join(directory, entry.name))).size;
  return total;
}
function result(value: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> {
  assert(!value.isError, JSON.stringify(value)); const content = value.content as { type: string; text: string }[];
  return JSON.parse(content[0]!.text) as Record<string, unknown>;
}
test('fresh installed runtime serves two actual MCP clients and qualified managed interleaving', { timeout: 120000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'projector-installed-'));
  const repository = join(directory, 'source'), candidate = join(directory, 'candidate'), plugin = join(directory, 'plugin');
  const config = settings({ home: join(directory, 'user-state'), port: await freePort() });
  const clients: Client[] = []; let ownerStarted = false;
  t.after(async () => {
    await Promise.all(clients.map(client => client.close()));
    if (ownerStarted) await send(config, { op: 'shutdown' }, await readCredential(config));
    assert(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });
  await mkdir(repository);
  const git = (...args: string[]) => execute('git', args, { cwd: repository, windowsHide: true });
  await git('init', '--initial-branch=main'); await git('config', 'core.autocrlf', 'false');
  await writeFile(join(repository, 'source.ts'), 'export function Before() { return 1; }\n'); await git('add', '.');
  await git('-c', 'user.name=Projector Test', '-c', 'user.email=projector@example.invalid', 'commit', '-m', 'baseline');
  const revision = (await git('rev-parse', 'HEAD')).stdout.trim(); await git('worktree', 'add', '--detach', candidate, revision);
  const candidateGit = (await execute('git', ['rev-parse', '--absolute-git-dir'], { cwd: candidate })).stdout.trim();
  const canonical = await realpath(candidate);
  await writeFile(join(candidateGit, 'projector-candidate.json'), JSON.stringify({ version: 1, root: canonical, candidate: 'installed-test', writerContract: 'acknowledged-batches' }));
  const start = performance.now(); await install(plugin);
  const launch = JSON.parse(await readFile(join(plugin, 'mcp.json'), 'utf8')).mcpServers.projector as { type: string; command: string; args: string[] };
  assert.equal(launch.type, 'stdio'); assert.equal(launch.command, 'node');
  const launchArgs = launch.args.map(value => value.replaceAll('${PLUGIN_ROOT}', plugin));
  t.diagnostic(JSON.stringify({ installedVersion: VERSION, node: process.version, installMs: performance.now() - start, installedBytes: await bytes(plugin), nativePackaging: 'node:sqlite bundled with Node; no addon build' }));
  const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const connect = async (name: string) => {
    const client = new Client({ name, version: '1.0.0' }); clients.push(client);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: launchArgs, cwd: directory, env: { ...environment, PROJECTOR_HOME: config.home, PROJECTOR_PORT: String(config.port) }, stderr: 'pipe' }));
    return client;
  };
  const [a, b] = await Promise.all([connect('client-a'), connect('client-b')]);
  const [openedA, openedB] = await Promise.all([a, b].map(client => client.callTool({ name: 'openRoot', arguments: { root: candidate, profile: 'managed', candidate: 'installed-test' } }).then(result)));
  ownerStarted = true;
  const toolNames = (await a.listTools()).tools.map(tool => tool.name);
  assert.ok(toolNames.includes('initProject') && toolNames.includes('syncChange'));
  const initialized = result(await a.callTool({ name: 'initProject', arguments: { root: repository } }));
  assert.equal(initialized.ready, true);
  assert.equal(await readFile(join(repository, 'openspec/config.yaml'), 'utf8'), 'schema: projector\n');
  assert.deepEqual(result(await b.callTool({ name: 'initProject', arguments: { root: repository } })).created, []);
  const skills = (await readdir(join(plugin, 'skills'))).sort();
  assert.deepEqual(skills, ['apply', 'audit', 'continue', 'explore', 'finish', 'init', 'merge', 'propose', 'reconcile', 'revise', 'sync', 'verify'].sort());
  assert.equal(openedA.rootId, openedB.rootId); assert.equal(openedA.kernel, openedB.kernel);
  const rootId = String(openedA.rootId);
  const current = async () => result(await b.callTool({ name: 'read', arguments: { rootId, view: 'current', reference: '[[Before]]' } }));
  assert.equal((await current()).freshness, 'unavailable');
  await a.callTool({ name: 'checkpoint', arguments: { rootId } }).then(result);
  assert.equal((await current()).freshness, 'validated');
  const batch = result(await a.callTool({ name: 'beginBatch', arguments: { rootId, writer: 'writer-a', paths: ['source.ts'] } }));
  assert.equal(batch.acknowledged, true);
  const blockedSetup = await b.callTool({ name: 'initProject', arguments: { root: candidate } });
  assert.equal(blockedSetup.isError, true);
  assert.match(JSON.stringify(blockedSetup), /acknowledged writer|in flight/);
  await writeFile(join(candidate, 'source.ts'), 'export function Before(');
  const pending = await current(); assert.equal(pending.freshness, 'pending'); assert(!('data' in pending));
  await writeFile(join(candidate, 'source.ts'), 'export function Before() { return 2; }\n');
  result(await a.callTool({ name: 'completeBatch', arguments: { rootId, batchId: batch.batchId, actualPaths: ['source.ts'] } }));
  assert.equal((await current()).freshness, 'validated');
  await a.close(); clients.splice(clients.indexOf(a), 1);
  assert.equal((await current()).freshness, 'validated');
  const before = result(await b.callTool({ name: 'inspectStatus', arguments: { rootId } })).counters as Record<string, number>;
  await current();
  const after = result(await b.callTool({ name: 'inspectStatus', arguments: { rootId } })).counters as Record<string, number>;
  for (const name of ['sourceBytes', 'hashBytes', 'parsedFiles', 'extractions', 'subprocesses', 'transactions', 'modelCalls']) { assert(name in before); assert.equal(after[name], before[name]); }
  const paths = ['packages/private/package.json', 'packages/private/index.ts', 'packages/private/src/secret.ts', 'packages/client/main.ts', 'openspec/terms/before.md'];
  const population = result(await b.callTool({ name: 'beginBatch', arguments: { rootId, writer: 'writer-b', paths } }));
  await mkdir(join(candidate, 'packages/private/src'), { recursive: true }); await mkdir(join(candidate, 'packages/client'), { recursive: true }); await mkdir(join(candidate, 'openspec/terms'), { recursive: true });
  await writeFile(join(candidate, paths[0]!), '{"name":"private-package","type":"module","exports":{".":"./index.ts"}}\n');
  await writeFile(join(candidate, paths[1]!), 'export class PublicEntry {}\n');
  await writeFile(join(candidate, paths[2]!), 'class Secret {}\n');
  await writeFile(join(candidate, paths[3]!), 'export class Caller {}\n');
  await writeFile(join(candidate, paths[4]!), '# Before\nThe newly reviewed Markdown term.\n');
  result(await b.callTool({ name: 'completeBatch', arguments: { rootId, batchId: population.batchId, actualPaths: paths } }));
  const boundaryRequest = { rootId, view: 'current', reference: '[[code:packages/private/src/secret.ts#Secret]]', fromPath: 'packages/client/main.ts' };
  const denied = result(await b.callTool({ name: 'read', arguments: boundaryRequest })); assert.equal((denied.data as Record<string, unknown>).status, 'denied');
  const owned = result(await b.callTool({ name: 'read', arguments: { ...boundaryRequest, scope: 'packages/private' } })); assert.equal((owned.data as Record<string, unknown>).status, 'resolved');
  const observation = result(await b.callTool({ name: 'read', arguments: { ...boundaryRequest, edge: 'observation' } })); assert.equal((observation.data as Record<string, unknown>).status, 'resolved');
  const rebinding = (await current()).data as { status: string; candidates: { id: string }[] }; assert.equal(rebinding.status, 'rebind');
  const adopted = result(await b.callTool({ name: 'read', arguments: { rootId, view: 'current', reference: '[[Before]]', adoptBinding: rebinding.candidates[0]!.id } })); assert.equal((adopted.data as Record<string, unknown>).status, 'resolved');
  result(await b.callTool({ name: 'invalidateObservation', arguments: { rootId, reason: 'Unknown arbitrary shell writes' } }));
  await writeFile(join(candidate, 'source.ts'), 'export function Before() { return 3; }\n');
  assert.equal((await current()).freshness, 'unavailable');
  const historical = result(await b.callTool({ name: 'read', arguments: { rootId, view: 'revision', revision, reference: '[[Before]]' } }));
  assert.equal(historical.freshness, 'validated');
  t.diagnostic(JSON.stringify({ clients: 2, sharedKernel: openedA.kernel, nativePath: true, warmCountersBefore: before, warmCountersAfter: after }));
});
