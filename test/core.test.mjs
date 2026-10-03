import { activate, deactivate } from '../plugins/opl-projector/runtime/activation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { stringify } from 'yaml';
import { focus, revisit, reconcile, writeCheckpoint, resume, closeCheckpoint, repair } from '../plugins/opl-projector/runtime/projector.mjs';
import { hash, projectPath, writeText } from '../plugins/opl-projector/runtime/state.mjs';
import { updateCheckpoint } from '../plugins/opl-projector/runtime/work.mjs';
const run = promisify(execFile);
const cli = path.resolve('plugins/opl-projector/runtime/cli.mjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v5-core-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await activate(root);
  await fs.mkdir(path.join(root, 'src'));
  await fs.mkdir(path.join(root, 'checks'));
  await fs.writeFile(path.join(root, 'src/a.mjs'), 'export const answer = 42;\n');
  await fs.writeFile(path.join(root, 'checks/pass.mjs'), 'console.log("verified");\n');
  await meaning(root, 'concept', { id: 'idea', kind: 'concept', title: 'Distinctive Idea', status: 'accepted', conditions: [{ id: 'behavior', text: 'Preserve the intended behavior, including its exception.', evidence: 'runtime' }] }, 'Reason: preserve the exception.\nReopen if the user changes the purpose.');
  const lens = { id: 'lens', kind: 'lens', title: 'Observe the idea', status: 'accepted', conditions: ['idea#behavior'], selectors: [{ id: 'population', patterns: ['src/*.mjs'] }], checks: [{ id: 'native', command: process.execPath, args: ['checks/pass.mjs'], selectors: ['population'], conditions: ['idea#behavior'], evidence: 'runtime', coverage: ['src/a.mjs'], inputs: ['checks/*.mjs'] }] };
  await meaning(root, 'lens', lens);
  return { root, lens };
}
async function meaning(root, name, metadata, body = 'Reasons and examples remain readable without Projector.') {
  await writeText(path.join(root, `.projector/meaning/${name}.md`), `---\n${stringify(metadata)}---\n${body}\n`);
}
async function checkpoint(root) { return writeCheckpoint(root, { id: 'directive', goal: 'Retain meaningful progress', ownership: [{ owner: 'worker', paths: ['src/a.mjs', 'src/b.mjs'] }], boundaries: ['src/**'], completed: ['A useful native edit'], questions: ['Check current evidence'], uncertainMutations: [] }); }

test('inactive entrypoints bypass invalid requests and preserve existing state', async t => {
  const { root } = await fixture(t);
  await checkpoint(root);
  await deactivate(root);
  const before = await fs.readFile(path.join(root, '.projector/work/directive.md'));
  for (const operation of [focus, revisit, reconcile, writeCheckpoint, resume, closeCheckpoint, repair, updateCheckpoint]) {
    assert.equal((await operation(root, undefined)).status, 'inactive');
  }
  assert.deepEqual(await fs.readFile(path.join(root, '.projector/work/directive.md')), before);
  await assert.rejects(fs.access(path.join(root, '.projector/cache')), { code: 'ENOENT' });
  const result = await run(process.execPath, [cli, 'repair', '--root', root, '--request', path.join(root, 'does-not-exist.json')]);
  assert.equal(JSON.parse(result.stdout).status, 'inactive');
});

test('focus selects meaning without hydrating cycles or old checkpoint archives', async t => {
  const { root } = await fixture(t);
  await meaning(root, 'other', { id: 'other', kind: 'concept', title: 'Another idea', status: 'accepted', relations: [{ type: 'depends-on', target: 'idea', status: 'observed' }] });
  await checkpoint(root);
  const index = await focus(root);
  assert.ok(index.index.every(item => !Object.hasOwn(item, 'body')));
  const packet = await focus(root, { concepts: ['idea'] });
  assert.deepEqual(packet.meaning.map(item => item.id), ['idea']);
  assert.ok(packet.related.some(item => item.id === 'lens'));
  const lensPacket = await focus(root, { lenses: ['lens'] });
  assert.deepEqual(lensPacket.meaning.map(item => item.id), ['lens']);
  const closed = await closeCheckpoint(root, 'directive');
  assert.equal(closed.status, 'closed');
  assert.ok((await fs.readFile(path.join(root, closed.file), 'utf8')).includes('A useful native edit'));
  assert.equal((await focus(root, { concepts: ['idea'] })).checkpoint, undefined);
});

test('missing Lens and missing required population are unresolved; allowed absence is explicit', async t => {
  const { root, lens } = await fixture(t);
  lens.selectors[0] = { id: 'population', patterns: ['missing/*.mjs'] };
  await meaning(root, 'lens', lens);
  assert.equal((await reconcile(root, { lenses: ['lens'], runChecks: true })).status, 'unresolved');
  await meaning(root, 'concept', { id: 'idea', kind: 'concept', title: 'Idea', status: 'accepted', conditions: [{ id: 'behavior', text: 'There may be no realizations in this scope.', evidence: 'runtime', allowsAbsence: true }] });
  assert.equal((await reconcile(root, { lenses: ['lens'] })).status, 'supported');
  lens.status = 'retired';
  await meaning(root, 'lens', lens);
  assert.equal((await reconcile(root, { concepts: ['idea'] })).status, 'unresolved');
});

test('new consumer, stale body, changed check, and static evidence cannot inherit runtime support', async t => {
  const { root, lens } = await fixture(t);
  assert.equal((await reconcile(root, { lenses: ['lens'], runChecks: true })).status, 'supported');
  await fs.writeFile(path.join(root, 'src/b.mjs'), 'export const unsafe = true;\n');
  const discovery = await revisit(root, { lenses: ['lens'] });
  assert.ok(discovery.selections[0].added.includes('src/b.mjs'));
  const next = await reconcile(root, { lenses: ['lens'], runChecks: true });
  assert.equal(next.verdicts[0].participants.find(item => item.unit.path === 'src/b.mjs').status, 'unresolved');
  await fs.appendFile(path.join(root, 'src/a.mjs'), '// same declaration, changed body inputs\n');
  assert.equal((await reconcile(root, { lenses: ['lens'] })).verdicts[0].participants[0].status, 'unresolved');
  lens.checks[0].coverage = 'selection';
  lens.checks[0].evidence = 'static';
  await meaning(root, 'lens', lens);
  assert.equal((await reconcile(root, { lenses: ['lens'], runChecks: true })).status, 'unresolved');
});

test('unrelated drift retains evidence while target and meaning revisions stale it', async t => {
  const { root, lens } = await fixture(t);
  await reconcile(root, { lenses: ['lens'], runChecks: true });
  await fs.writeFile(path.join(root, 'unrelated.txt'), 'independent native work');
  assert.equal((await reconcile(root, { lenses: ['lens'] })).status, 'supported');
  lens.checks[0].target = 'another-target';
  await meaning(root, 'lens', lens);
  assert.equal((await reconcile(root, { lenses: ['lens'] })).status, 'unresolved');
});

test('moved implementations retain meaning identity; a candidate Lens needs explicit acceptance', async t => {
  const { root, lens } = await fixture(t);
  await reconcile(root, {lenses:['lens'],runChecks:true});
  const before = (await focus(root, {concepts:['idea']})).meaning[0];
  await fs.rename(path.join(root, 'src/a.mjs'), path.join(root, 'src/moved.mjs'));
  const moved = await revisit(root, {lenses:['lens']});
  assert.ok(moved.selections[0].added.includes('src/moved.mjs'));
  assert.ok(moved.selections[0].removed.includes('src/a.mjs'));
  assert.equal((await reconcile(root, {lenses:['lens']})).status, 'unresolved');
  lens.status = 'candidate';
  lens.checks[0].coverage = ['src/moved.mjs'];
  await meaning(root, 'lens', lens);
  const candidate = {id:'approach',kind:'pattern',title:'A scoped approach',status:'candidate',concepts:['idea'],lens:'lens',examples:['Observe the transient use'],counterexamples:['An explicit committed edit changes authority'],alternatives:['Use another valid handwritten implementation']};
  await meaning(root, 'pattern', candidate, 'Reason: preserve the exception.\nReopen when projection cost changes.');
  const original = (await focus(root, {query:'approach'})).meaning.find(item => item.id === 'approach');
  assert.equal((await reconcile(root, {concepts:['idea'],runChecks:true})).status, 'unresolved');
  // An explicit meaning decision changes only acceptance and the scoped Lens.
  candidate.status = 'accepted';
  lens.status = 'accepted';
  await meaning(root, 'pattern', candidate, original.body.trimEnd());
  await meaning(root, 'lens', lens);
  assert.equal((await reconcile(root, {lenses:['lens'],runChecks:true})).status, 'supported');
  const after = (await focus(root, {concepts:['idea'],query:'approach'})).meaning;
  assert.equal(after.find(item => item.id === 'idea').hash, before.hash);
  assert.equal(after.find(item => item.id === 'approach').body, original.body);
  assert.deepEqual(after.find(item => item.id === 'approach').counterexamples, original.counterexamples);
});

test('checks that mutate their observed source cannot publish current support', async t => {
  const { root } = await fixture(t);
  await fs.writeFile(path.join(root, 'checks/pass.mjs'), 'import fs from "node:fs"; fs.appendFileSync("src/a.mjs", "// changed\\n");\n');
  assert.equal((await reconcile(root, { lenses: ['lens'], runChecks: true })).status, 'unresolved');
});

test('later checks cannot leave earlier evidence current after its configuration or authority changes', async t => {
  const { root, lens } = await fixture(t);
  await fs.writeFile(path.join(root, 'settings.json'), '{"behavior":"original"}\n');
  lens.checks[0].inputs.push('settings.json');
  await fs.writeFile(path.join(root, 'checks/mutate.mjs'), 'import fs from "node:fs"; fs.writeFileSync("settings.json", "changed");\n');
  lens.checks.push({ id: 'later', command: process.execPath, args: ['checks/mutate.mjs'], selectors: ['population'], conditions: ['idea#behavior'], evidence: 'static', coverage: ['src/a.mjs'] });
  await meaning(root, 'lens', lens);
  const result = await reconcile(root, { lenses: ['lens'], runChecks: true });
  assert.equal(result.status, 'unresolved');
  assert.equal(result.receipts[0].observedStatus, 'supported');
  assert.equal(result.receipts[0].current, false);
  await fs.writeFile(path.join(root, 'checks/mutate.mjs'), 'import fs from "node:fs"; fs.appendFileSync(".projector/meaning/concept.md", "Changed reason.\\n");\n');
  assert.equal((await reconcile(root, { lenses: ['lens'], runChecks: true })).status, 'unresolved');
});

test('shared check runs once for multiple conditions and retains the first mismatch', async t => {
  const { root, lens } = await fixture(t);
  await checkpoint(root);
  await meaning(root, 'concept', { id: 'idea', kind: 'concept', title: 'Idea', status: 'accepted', conditions: [{ id: 'behavior', text: 'A', evidence: 'runtime' }, { id: 'other', text: 'B', evidence: 'runtime' }] });
  lens.conditions.push('idea#other');
  lens.checks[0].conditions.push('idea#other');
  await meaning(root, 'lens', lens);
  const failed = await reconcile(root, { lenses: ['lens'], work: 'directive', runChecks: true });
  assert.equal(failed.receipts.length, 1);
  await fs.writeFile(path.join(root, 'checks/pass.mjs'), 'process.exitCode=1;\n');
  await reconcile(root, { lenses: ['lens'], work: 'directive', runChecks: true });
  lens.checks = [];
  await meaning(root, 'lens', lens);
  await reconcile(root, { lenses: ['lens'], work: 'directive' });
  const restored = await resume(root, 'directive');
  assert.equal(restored.mismatches.length, 2);
  assert.ok(restored.lastReconciliation.changes.every(item => item.lensOrCheckerChanged));
});

test('final publication rechecks earlier Lenses and retains original mismatch after cache deletion', async t => {
  const { root, lens } = await fixture(t);
  await checkpoint(root);
  await fs.writeFile(path.join(root, 'settings.json'), 'original');
  lens.checks[0].inputs.push('settings.json');
  await meaning(root, 'lens', lens);
  const other = structuredClone(lens);
  other.id = 'other-lens';
  other.checks[0].id = 'mutator';
  other.checks[0].args = ['checks/mutate.mjs'];
  other.checks[0].inputs = ['checks/mutate.mjs'];
  await fs.writeFile(path.join(root, 'checks/mutate.mjs'), 'import fs from "node:fs"; fs.writeFileSync("settings.json", "later");\n');
  await meaning(root, 'other-lens', other);
  const first = await reconcile(root, { lenses: ['lens', 'other-lens'], runChecks: true });
  assert.equal(first.verdicts.find(verdict => verdict.lens === 'lens').status, 'unresolved');
  await fs.writeFile(path.join(root, 'checks/pass.mjs'), 'process.exitCode = 1;\n');
  await fs.writeFile(path.join(root, 'settings.json'), 'original-again');
  await reconcile(root, { lenses: ['lens', 'other-lens'], work: 'directive', runChecks: true });
  await fs.rm(path.join(root, '.projector/cache'), { recursive: true });
  const restored = await resume(root, 'directive');
  const original = restored.mismatches.find(verdict => verdict.lens === 'lens');
  assert.equal(original.receipt.exitCode, 1);
  assert.ok(original.receipt.scope.inputs.some(input => input.path === 'settings.json' && input.hash === hash('original-again')));
});

test('revisit refreshes directive boundaries and literal queries beyond saved selectors', async t => {
  const { root, lens } = await fixture(t);
  lens.selectors[0].patterns = ['src/a.mjs'];
  await meaning(root, 'lens', lens);
  await checkpoint(root);
  await fs.writeFile(path.join(root, 'src/new-export.mjs'), 'export const useIdea = true;\n');
  const result = await revisit(root, { lenses: ['lens'], work: 'directive', query: 'useIdea' });
  assert.ok(result.discoveryQuestions.some(question => question.path === 'src/new-export.mjs'));
  assert.ok(result.observations.some(observation => observation.facts.some(fact => fact.kind === 'literal-occurrence' && fact.path === 'src/new-export.mjs')));
});

test('owned repair is inspectable/idempotent and refuses stale or overlapping writers', async t => {
  const { root } = await fixture(t);
  await checkpoint(root);
  await assert.rejects(writeCheckpoint(root, { id: 'conflict', goal: 'No silent writer overlap', ownership: [{ owner: 'one', paths: ['src/a.mjs'] }, { owner: 'two', paths: ['src/a.mjs'] }] }), /Conflicting ownership/);
  const before = await fs.readFile(path.join(root, 'src/a.mjs'));
  const request = { id: 'repair-one', work: 'directive', owner: 'worker', condition: 'idea#behavior', explanation: 'Restore known behavior', outputs: [{ path: 'src/a.mjs', expectedHash: hash(before), content: 'fixed\n' }] };
  await repair(root, request);
  assert.equal((await repair(root, request)).states[0].state, 'after');
  assert.ok((await resume(root, 'directive')).changed.includes('src/a.mjs'));
  await repair(root, { id: request.id, mode: 'rollback' });
  assert.deepEqual(await fs.readFile(path.join(root, 'src/a.mjs')), before);
  await assert.rejects(repair(root, { ...request, id: 'stale', outputs: [{ ...request.outputs[0], expectedHash: 'wrong' }] }), /Stale expected/);
});

test('rollback preflight preserves all outputs when one has unrelated bytes; aliases cannot split ownership', async t => {
  const { root } = await fixture(t);
  await checkpoint(root);
  await fs.writeFile(path.join(root, 'src/b.mjs'), 'before-b');
  const beforeA = await fs.readFile(path.join(root, 'src/a.mjs'));
  await repair(root, { id: 'two-files', work: 'directive', owner: 'worker', outputs: [{path:'src/a.mjs',expectedHash:hash(beforeA),content:'after-a'}, {path:'src/b.mjs',expectedHash:hash('before-b'),content:'after-b'}] });
  await fs.writeFile(path.join(root, 'src/b.mjs'), 'unrelated');
  await assert.rejects(repair(root, { id: 'two-files', mode: 'rollback' }), /unrelated edits/);
  assert.equal(await fs.readFile(path.join(root, 'src/a.mjs'), 'utf8'), 'after-a');
  await fs.writeFile(path.join(root, 'src/b.mjs'), 'after-b');
  const nativeRename = fs.rename;
  fs.rename = async (from, to) => { if (to === path.join(root, 'src/b.mjs')) throw new Error('Injected second restore failure'); return nativeRename(from, to); };
  try { await assert.rejects(repair(root, {id:'two-files',mode:'rollback'}), /interrupted/); }
  finally { fs.rename = nativeRename; }
  const interrupted = await resume(root, 'directive');
  assert.deepEqual(interrupted.uncertainMutations, ['two-files']);
  assert.equal(interrupted.mutations[0].attempt.status, 'rollback-interrupted');
  assert.deepEqual(await fs.readFile(path.join(root, 'src/a.mjs')), beforeA);
  await repair(root, {id:'two-files',mode:'rollback'});
  assert.deepEqual((await resume(root, 'directive')).uncertainMutations, []);
  await fs.writeFile(path.join(root, 'src/a.mjs'), 'after-a');
  await fs.symlink(path.join(root, 'src'), path.join(root, 'alias'), 'junction');
  await assert.rejects(writeCheckpoint(root, {id:'aliases',goal:'Own actual files',ownership:[{owner:'one',paths:['src/not-created.mjs']},{owner:'two',paths:['alias/not-created.mjs']}]}), /Conflicting ownership/);
  await assert.rejects(repair(root, {id:'alias-outputs',work:'directive',owner:'worker',outputs:[{path:'src/a.mjs',expectedHash:hash('after-a'),content:'next'},{path:'alias/a.mjs',expectedHash:hash('after-a'),content:'next'}]}), /Duplicate repair output/);
});

test('prior-state repair and two failed strategies stop locally without losing unrelated work', async t => {
  const { root } = await fixture(t);
  await checkpoint(root);
  const before = await fs.readFile(path.join(root, 'src/a.mjs'));
  await repair(root, { id: 'first', work: 'directive', owner: 'worker', condition: 'idea#behavior', explanation: 'Try once', outputs: [{ path: 'src/a.mjs', expectedHash: hash(before), content: 'new\n' }] });
  const repeated = await repair(root, { id: 'cycle', work: 'directive', owner: 'worker', condition: 'idea#behavior', outputs: [{ path: 'src/a.mjs', expectedHash: hash('new\n'), content: before.toString() }] });
  assert.equal(repeated.status, 'stopped');
  await fs.symlink(path.join(root, 'src'), path.join(root, 'alias'), 'junction');
  const aliasCycle = await repair(root, {id:'alias-cycle',work:'directive',owner:'worker',condition:'idea#behavior',outputs:[{path:'alias/a.mjs',expectedHash:hash('new\n'),content:before.toString()}]});
  assert.equal(aliasCycle.status, 'stopped');
  await repair(root, {id:'group',work:'directive',owner:'worker',condition:'idea#behavior',outputs:[{path:'src/a.mjs',expectedHash:hash('new\n'),content:'group-a'},{path:'src/b.mjs',expectedHash:null,content:'group-b'}]});
  const reorderedCycle = await repair(root, {id:'reordered-cycle',work:'directive',owner:'worker',condition:'idea#behavior',outputs:[{path:'src/b.mjs',expectedHash:hash('group-b'),delete:true},{path:'src/a.mjs',expectedHash:hash('group-a'),content:'new\n'}]});
  assert.equal(reorderedCycle.status, 'stopped');
  await updateCheckpoint(root, 'directive', { repairHistory: [{ condition: 'idea#behavior', explanation: 'same', outcome: 'mismatch' }, { condition: 'idea#behavior', explanation: 'same', outcome: 'mismatch' }] });
  const stopped = await repair(root, { id: 'failed-again', work: 'directive', owner: 'worker', condition: 'idea#behavior', explanation: 'same', outputs: [{ path: 'src/a.mjs', expectedHash: hash('group-a'), content: 'different\n' }] });
  assert.equal(stopped.status, 'stopped');
  assert.equal((await resume(root, 'directive')).completed[0], 'A useful native edit');
});

test('cache deletion preserves meaning/checkpoint and CLI exposes unsupported results', async t => {
  const { root } = await fixture(t);
  await checkpoint(root);
  await reconcile(root, { lenses: ['lens'], runChecks: true });
  await fs.rm(path.join(root, '.projector/cache'), { recursive: true });
  assert.ok((await focus(root, { concepts: ['idea'] })).meaning[0].body.includes('exception'));
  assert.deepEqual((await resume(root, 'directive')).changed, []);
  const request = path.join(root, 'request.json');
  await fs.writeFile(request, JSON.stringify({ lenses: ['lens'] }));
  await assert.rejects(run(process.execPath, [cli, 'reconcile', '--root', root, '--request', request]), error => error.code === 2 && JSON.parse(error.stdout).status === 'unresolved');
});

test('outside-root paths and escaped symlinks are refused before source reads', async t => {
  const { root } = await fixture(t);
  await assert.rejects(projectPath(root, '../outside'), /escapes/);
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'v5-external-'));
  t.after(() => fs.rm(external, { recursive: true, force: true }));
  await fs.symlink(external, path.join(root, 'link'), 'junction');
  await assert.rejects(projectPath(root, 'link/source'), /Symlink escapes/);
});
