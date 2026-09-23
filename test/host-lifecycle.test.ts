import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { install } from '../src/host/install.ts';
import { send } from '../src/host/client.ts';
import { settings, readCredential } from '../src/host/config.ts';
import { fixture, disposition, put, read, gitFixture } from './change-fixture.ts';

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address(); assert(address && typeof address === 'object');
  await new Promise<void>(done => server.close(() => done())); return address.port;
}
async function invoke(client: Client, name: string, arguments_: Record<string, unknown>) {
  const response = await client.callTool({ name, arguments: arguments_ });
  assert(!response.isError, JSON.stringify(response));
  return JSON.parse((response.content as { text: string }[])[0]!.text) as Record<string, unknown>;
}

test('T9 installed nested target plan, managed apply, revision, evidence, archive and settled repeat through two MCP clients', { timeout: 120000 }, async t => {
  const input = await fixture();
  const directory = await mkdtemp(join(tmpdir(), 'projector-lifecycle-install-'));
  const config = settings({ home: join(directory, 'state'), port: await freePort() });
  const clients: Client[] = []; let ownerStarted = false;
  t.after(async () => {
    await Promise.all(clients.map(client => client.close()));
    if (ownerStarted) await send(config, { op: 'shutdown' }, await readCredential(config));
    for (const location of [directory, input.root]) {
      assert(resolve(location).startsWith(resolve(tmpdir()) + sep));
      await rm(location, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  });
  const plugin = join(directory, 'plugin'); await install(plugin);
  const launch = JSON.parse(await readFile(join(plugin, 'mcp.json'), 'utf8')).mcpServers.projector as { type: string; command: string; args: string[] };
  assert.equal(launch.type, 'stdio'); assert.equal(launch.command, 'node');
  const launchArgs = launch.args.map(value => value.replaceAll('${PLUGIN_ROOT}', plugin));
  const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const connect = async (name: string) => {
    const client = new Client({ name, version: '1.0.0' }); clients.push(client);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: launchArgs, cwd: directory, env: { ...environment, PROJECTOR_HOME: config.home, PROJECTOR_PORT: String(config.port) }, stderr: 'pipe' }));
    return client;
  };
  const [a, b] = await Promise.all([connect('planner'), connect('implementer')]);
  const common = { root: input.root, change: input.change };
  const prepared = await invoke(a, 'prepareChange', common); ownerStarted = true;
  assert.notEqual(prepared.targetId, input.baseline);
  const uncovered = await invoke(a, 'validatePlan', common); assert.equal(uncovered.valid, false);
  assert((uncovered.obligations as string[]).some(item => item.includes('applicability')));
  const openRequest = { root: prepared.candidateRoot, profile: 'managed', candidate: prepared.candidateId };
  const [openedA, openedB] = await Promise.all([invoke(a, 'openRoot', openRequest), invoke(b, 'openRoot', openRequest)]);
  assert.equal(openedA.kernel, openedB.kernel); assert.equal(openedA.rootId, openedB.rootId);
  const rootId = String(openedA.rootId), candidate = String(prepared.candidateRoot);
  await invoke(a, 'checkpoint', { rootId });
  const oldView = await invoke(b, 'read', { rootId, view: 'current', reference: '[[replay]]' }); assert.equal(oldView.freshness, 'validated');
  const planned = await invoke(a, 'validatePlan', { ...common, ...disposition }); assert.equal(planned.valid, true, JSON.stringify(planned.obligations));
  await invoke(b, 'applyChange', common);
  const batch = await invoke(b, 'beginBatch', { rootId, writer: 'implementer', paths: ['src/player.js'] });
  await put(candidate, 'src/player.js', 'export function replay() { return 1; }\nexport function retainEvent() { return "user"; }\n');
  assert.equal((await invoke(a, 'read', { rootId, view: 'current', reference: '[[replay]]' })).freshness, 'pending');
  await invoke(b, 'completeBatch', { rootId, batchId: batch.batchId, actualPaths: ['src/player.js'] });
  assert.equal((await invoke(a, 'read', { rootId, view: 'current', reference: '[[replay]]' })).freshness, 'validated');
  const delta = `openspec/changes/${input.change}/designs/audio/preview/design.md`;
  await put(input.root, delta, (await read(input.root, delta)).replace('caller-owned event storage', 'caller-owned recorded event storage'));
  const revised = await invoke(a, 'reviseChange', common); assert.notEqual(revised.targetId, prepared.targetId);
  assert.equal(revised.previousTarget, prepared.targetId);
  assert.match(await read(candidate, 'src/player.js'), /return 1/);
  assert.equal((await invoke(b, 'read', { rootId, view: 'current', reference: '[[replay]]' })).freshness, 'unavailable');
  const reviewedPlan = await invoke(a, 'validatePlan', { ...common, ...disposition }); assert.equal(reviewedPlan.valid, true, JSON.stringify(reviewedPlan.obligations));
  const blockedFinish = await invoke(a, 'finishChange', common); assert.equal(blockedFinish.complete, false);
  assert((blockedFinish.obligations as string[]).some(item => item.includes('current executed evidence')));
  await invoke(b, 'checkpoint', { rootId });
  const barrier = createServer(); barrier.listen(0, '127.0.0.1'); await once(barrier, 'listening');
  const barrierAddress = barrier.address(); assert(barrierAddress && typeof barrierAddress === 'object');
  const arrived = once(barrier, 'connection');
  const runningEvidence = invoke(b, 'recordEvidence', { ...common, command: process.execPath, args: ['--input-type=module', '-e', `import assert from "node:assert/strict"; import {createConnection} from "node:net"; import {replay,retainEvent} from "./src/player.js"; assert.equal(replay(),1); assert.equal(retainEvent(),"user"); await new Promise(resolve=>{const socket=createConnection({host:"127.0.0.1",port:${barrierAddress.port}}); socket.on("error",error=>{throw error}); socket.write("ready"); socket.once("data",()=>{socket.end();resolve()})});`], scope: ['src/player.js'] });
  const [evidenceSocket] = await arrived;
  evidenceSocket.resume();
  t.after(() => { evidenceSocket.destroy(); barrier.close(); });
  try {
    const blockedWriter = await a.callTool({ name: 'beginBatch', arguments: { rootId, writer: 'conflicting-writer', paths: ['src/player.js'] } });
    assert.equal(blockedWriter.isError, true); assert.match(JSON.stringify(blockedWriter), /reserved|consequential|exclusion/i);
    const checkpointDuringEvidence = await invoke(a, 'checkpoint', { rootId }); assert.notEqual(checkpointDuringEvidence.freshness, 'validated');
  } finally { evidenceSocket.write('continue'); }
  const checked = await runningEvidence;
  await new Promise<void>(done => barrier.close(() => done()));
  assert.equal((checked.evidence as Record<string, unknown>).passed, true);
  // This exercises review-attestation validation; independent semantic review is
  // separate qualification evidence and is not claimed by this fixture string.
  await invoke(a, 'validatePlan', { ...common, review: { basis: reviewedPlan.basis, reviewer: 'simulated-review-attestation-for-protocol-test', findings: [], examined: ['src/player.js', 'openspec/designs/audio/preview/design.md'], alternative: 'The existing direct replay function satisfies this fixture; a strategy wrapper has no surviving responsibility.' } });
  assert.equal((await invoke(a, 'read', { rootId, view: 'current', reference: '[[replay]]' })).freshness, 'unavailable');
  const openWriter = await invoke(b, 'beginBatch', { rootId, writer: 'still-writing', paths: ['src/player.js'] });
  const finishDuringWrite = await a.callTool({ name: 'finishChange', arguments: common });
  assert.equal(finishDuringWrite.isError, true); assert.match(JSON.stringify(finishDuringWrite), /acknowledged writer|in flight/i);
  assert.equal(gitFixture(input.root, 'rev-parse', String(prepared.candidateBranch)), input.baseline);
  await invoke(b, 'completeBatch', { rootId, batchId: openWriter.batchId, actualPaths: [] });
  const finished = await invoke(a, 'finishChange', common); assert.equal(finished.complete, true, JSON.stringify(finished.obligations));
  assert.equal(gitFixture(input.root, 'rev-parse', 'main'), input.baseline);
  assert.equal(gitFixture(input.root, 'rev-parse', String(finished.candidateBranch)), finished.publication);
  assert.match(await readFile(join(candidate, 'openspec', 'specs', 'audio', 'preview', 'spec.md'), 'utf8'), /exactly once/);
  assert.match(await readFile(join(String(finished.archivePath), 'implementation-state.json'), 'utf8'), /previousSupport/);
  await a.close(); clients.splice(clients.indexOf(a), 1);
  const historical = await invoke(b, 'read', { rootId, view: 'revision', revision: finished.publication, reference: '[[spec:audio/preview#Immediate replay]]' }); assert.equal(historical.freshness, 'validated');
  const resumed = await invoke(b, 'resumeChange', common); assert.equal(resumed.publication, finished.publication); assert.equal(resumed.reused, true);
  const repeated = await invoke(b, 'finishChange', common); assert.equal(repeated.publication, finished.publication); assert.equal(repeated.reused, true);
  assert.equal(gitFixture(candidate, 'status', '--porcelain'), '');
  t.diagnostic(JSON.stringify({ installedVersion: '4.0.0', clients: 2, mainUnchanged: true, publication: finished.publication, archive: true, repeatedFinish: 'no-op', modelCalls: 0, semanticReview: 'separate from simulated protocol attestation' }));
});
