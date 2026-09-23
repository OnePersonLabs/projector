import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, stat, writeFile, unlink, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { Trajectory } from './index.ts';
import { extractFile, resolveDependencies } from '../src/documents/index.ts';

export interface Finding { code: string; message: string }
export interface Evaluation { passed: boolean; findings: Finding[]; checks: string[]; behavior?: unknown }
export interface EvaluateOptions { authoredControl?: boolean }
interface Decision { id: string; reason: string; requires: string[]; files: string[] }
const execute = promisify(execFile);
const ids = ['evidence', 'late-consumer', 'ownership', 'playback', 'provenance'];
async function inventory(root: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (['.git', 'node_modules', '.worktrees'].includes(item.name)) continue;
    const name = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isSymbolicLink()) throw new Error(`Unsupported trial symlink ${name}`);
    if (item.isDirectory()) result.push(...await inventory(root, name)); else result.push(name);
    if (result.length > 200) throw new Error('Trial exceeds 200-file evaluation budget');
  }
  return result.sort();
}
async function contents(root: string): Promise<string> {
  const digest = createHash('sha256');
  for (const name of await inventory(root)) { const full = path.join(root, name); if ((await stat(full)).size > 1024 * 1024) throw new Error('Trial file exceeds evaluation budget'); digest.update(name); digest.update(await readFile(full)); }
  return digest.digest('hex');
}
async function run(root: string, args: string[]): Promise<string> { return (await execute(process.execPath, args, { cwd: root, windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 })).stdout.trim(); }
const behaviorProbe = `import assert from 'node:assert/strict'; import {pathToFileURL} from 'node:url'; import path from 'node:path';
const {createRuntime}=await import(pathToFileURL(path.join(process.cwd(),'src/index.js')));const r=createRuntime();
const first=r.play('alpha');assert.deepEqual(first,{id:'alpha',sequence:1,provenance:'live'});
r.play('beta',{preview:true});const external=r.events();external[0].id='tampered';assert.equal(r.events()[0].id,'alpha');
r.retain('proof','one');r.retain('proof','two');assert.equal(r.evidence('proof'),'two');assert.equal(r.evidence('missing'),null);
const received=[];const off=r.subscribe('late',e=>{received.push({...e});e.id='listener-mutation';});assert.equal(typeof off,'function');
assert.deepEqual(received.map(e=>e.id),['alpha','beta']);r.play('gamma');off();r.play('delta');assert.deepEqual(received.map(e=>e.id),['alpha','beta','gamma']);
assert.deepEqual(r.events().map(e=>e.id),['alpha','beta','gamma','delta']);
const {subscribe}=await import(pathToFileURL(path.join(process.cwd(),'src/recorder.js')));const recording=subscribe(r);assert.deepEqual(recording.events.map(e=>e.id),['alpha','beta','gamma','delta']);r.play('epsilon',{preview:true});assert.equal(recording.events.at(-1).id,'epsilon');recording.close();r.play('zeta');assert.equal(recording.events.length,5);
const nested=createRuntime(),copies=[];nested.subscribe('mutator',event=>{event.id.value='listener-mutation';});nested.subscribe('observer',event=>copies.push(event));const id={value:'original'};const returned=nested.play(id);id.value='caller-mutation';returned.id.value='return-mutation';assert.equal(nested.events()[0].id.value,'original');assert.equal(copies[0].id.value,'original');
console.log(JSON.stringify({events:r.events(),evidence:r.evidence('proof'),recorded:recording.events}));`;

export async function evaluateTrial(root: string, trajectory: Trajectory, options: EvaluateOptions = {}): Promise<Evaluation> {
  const findings: Finding[] = [], checks: string[] = []; let behavior: unknown;
  const fail = (code: string, message: string) => findings.push({ code, message });
  if (!options.authoredControl) {
    try {
      const original = await realpath(root);
      const config = JSON.parse(await readFile(path.join(root, 'trial.json'), 'utf8')) as { trajectory: string; mode: string };
      if (config.trajectory !== trajectory) throw new Error('Trajectory identity differs from the assigned trial');
      const state = JSON.parse(await readFile(path.join(root, 'openspec/changes/clean-evolution/implementation-state.json'), 'utf8')) as { baseline: string; candidateRoot: string; targetId: string; plan?: { targetId: string }; evidence: { passed: boolean; command: string; outputHash: string }[] };
      if (!path.resolve(state.candidateRoot).startsWith(path.resolve(original) + path.sep + '.worktrees' + path.sep)) throw new Error('Candidate is outside the allocated trial worktree');
      if (!state.plan || state.plan.targetId !== state.targetId) fail('projector-plan', 'No current Projector plan supports the final target.');
      if (!state.evidence.some(evidence => evidence.passed && evidence.command && evidence.outputHash)) fail('projector-evidence', 'The real Projector candidate lacks executed final evidence.');
      if (config.mode === 'evolved') {
        const stage = JSON.parse(await readFile(path.join(root, 'stage-evidence.json'), 'utf8')) as { checkpoint: string; priorTarget: string; nextTarget: string; evidence: { passed: boolean; command: string; outputHash: string } };
        if (!stage.evidence.passed || !stage.evidence.command || !stage.evidence.outputHash || stage.priorTarget === stage.nextTarget) fail('staged-history', 'Intermediate executed evidence and distinct target revisions were not preserved.');
        // Later realization refinements are legitimate target revisions. The
        // recorded transition must survive, but need not be the last revision.
        for (const revision of [stage.priorTarget, stage.nextTarget]) await execute('git', ['cat-file', '-e', `${revision}^{commit}`], { cwd: root, windowsHide: true });
        const ref = (await execute('git', ['rev-parse', 'refs/projector/evaluation/intermediate'], { cwd: root, windowsHide: true })).stdout.trim();
        if (ref !== stage.checkpoint) fail('staged-history', 'The verified intermediate Git checkpoint is missing or different.');
        const source = (await execute('git', ['show', `${stage.checkpoint}:src/index.js`], { cwd: root, windowsHide: true })).stdout;
        if (!source.includes('previewCount')) fail('staged-history', 'The intermediate checkpoint does not contain the implemented preview audit contribution.');
        if (trajectory === 'preview') {
          const previous = (await execute('git', ['ls-tree', '-r', '--name-only', state.baseline, '--', 'src/preview-strategy.js'], { cwd: root, windowsHide: true })).stdout.trim();
          if (previous) fail('staged-addition', 'The preview strategy already existed at baseline; this trajectory must implement its addition before withdrawal.');
          await execute('git', ['cat-file', '-e', `${stage.checkpoint}:src/preview-strategy.js`], { cwd: root, windowsHide: true });
        }
      }
      root = state.candidateRoot; checks.push('real Projector target, plan, executed evidence and staged checkpoint');
    } catch (error) { fail('projector-lifecycle', String(error)); return { passed: false, findings, checks }; }
  }
  let files: string[], decisions: Decision[], consumers: { name: string; path: string }[];
  try {
    files = await inventory(root);
    const requirements = JSON.parse(await readFile(path.join(root, 'requirements.json'), 'utf8')) as { id: string }[];
    if (JSON.stringify(requirements.map(item => item.id).sort()) !== JSON.stringify(ids)) fail('requirements-altered', 'The final legitimate requirement population changed.');
    decisions = JSON.parse(await readFile(path.join(root, 'design/decisions.json'), 'utf8')) as Decision[];
    consumers = JSON.parse(await readFile(path.join(root, 'consumers.json'), 'utf8')) as { name: string; path: string }[];
    if (!Array.isArray(decisions) || !Array.isArray(consumers)) throw new Error('Decision and consumer records must be arrays');
    for (const decision of decisions) {
      if (!decision.id || !decision.reason?.trim() || !decision.requires?.length || decision.requires.some(id => !ids.includes(id))) fail('invented-justification', `Decision ${decision.id} lacks a surviving, provided requirement reason.`);
      if (!Array.isArray(decision.files)) throw new Error('Decision files must be an array');
      for (const file of decision.files) if (!files.includes(file)) fail('orphan-ownership', `Decision ${decision.id} owns absent ${file}.`);
    }
    const owned = new Set(decisions.flatMap(decision => decision.files));
    for (const file of files.filter(file => /^src\/.+\.[cm]?js$/.test(file))) {
      const source = await readFile(path.join(root, file), 'utf8');
      if (!owned.has(file)) fail('unowned-source', `Actual source ${file} has no current responsibility.`);
      if (/PreviewStrategy|PreviewHistory|PreviewBuffer|oldPreview|legacyPreview/.test(source)) fail('obsolete-route', `Withdrawn preview structure survives in ${file}.`);
      if (/export\s+(?:async\s+)?function\s+subscribe\s*\(/.test(source) && !consumers.some(consumer => consumer.path === file)) fail('hidden-new-consumer', `Actual consumer ${file} is absent from current consumer declarations.`);
    }
    const records = await Promise.all(files.filter(file => /^src\/.+\.[cm]?js$/.test(file) || file === 'package.json').map(async file => extractFile(file, await readFile(path.join(root, file), 'utf8'))));
    const map = new Map(records.map(record => [record.path, record]));
    const reached = new Set<string>(), pending = ['src/index.js', ...consumers.map(consumer => consumer.path)];
    while (pending.length) {
      const name = pending.pop()!; if (reached.has(name)) continue; reached.add(name);
      const record = map.get(name); if (!record) { fail('missing-consumer', `Declared entry ${name} is absent.`); continue; }
      const dependencies = resolveDependencies(record, records, { fileMap: map });
      for (const dependency of dependencies.files) pending.push(dependency.path);
    }
    for (const record of records) if (record.path.startsWith('src/') && !reached.has(record.path)) fail('unused-source', `Source artifact ${record.path} has no path from the current runtime or a declared consumer.`);
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
    if (['dependencies', 'devDependencies', 'optionalDependencies'].some(key => Object.keys(pkg[key] as object ?? {}).length)) fail('unused-dependency', 'This dependency-free world contains unexplained external dependency/framework residue.');
    if (!consumers.some(consumer => consumer.name === 'recorder' && consumer.path === 'src/recorder.js')) fail('missing-late-consumer', 'The legitimate late recorder is undeclared.');
    if (!files.includes('design/reconciliation.md')) fail('missing-disposition', 'Previous contributions have no reconciliation explanation.');
    checks.push('independent source population and current ownership');
  } catch (error) { fail('invalid-artifacts', String(error)); return { passed: false, findings, checks }; }
  try { behavior = JSON.parse(await run(root, ['--input-type=module', '-e', behaviorProbe])); checks.push('held-out playback/provenance/evidence/late-consumer behavior'); }
  catch (error) { fail('behavior', String(error)); }
  try {
    await run(root, ['scripts/reconcile.js']);
    const before = await contents(root); const manifestPath = path.join(root, 'ownership.json'); const modified = (await stat(manifestPath)).mtimeMs;
    await run(root, ['scripts/reconcile.js']);
    if (before !== await contents(root) || modified !== (await stat(manifestPath)).mtimeMs) fail('not-settled', 'A settled reconciliation rewrites content or its derived manifest.');
    const expected = { requirements: ids, consumers: consumers.map(item => item.name).sort(), files: [...new Set(decisions.flatMap(item => item.files))].sort() };
    if (JSON.stringify(JSON.parse(await readFile(manifestPath, 'utf8'))) !== JSON.stringify(expected)) fail('ownership-manifest', 'Derived ownership does not match current requirement/consumer/decision inputs.');
    checks.push('settled content and write no-op');
    const changed = ['consumers.json', 'design/decisions.json', 'ownership.json'];
    const originals = await Promise.all(changed.map(file => readFile(path.join(root, file))));
    const newSource = path.join(root, 'src/evaluator-consumer.js');
    if (files.includes('src/evaluator-consumer.js')) throw new Error('Reserved evaluator probe path already exists');
    try {
      await writeFile(newSource, "export function subscribe(runtime) { return runtime.subscribe('audit', () => {}); }\n");
      await writeFile(path.join(root, changed[0]!), JSON.stringify([...consumers, { name: 'audit', path: 'src/evaluator-consumer.js' }]));
      await writeFile(path.join(root, changed[1]!), JSON.stringify([...decisions, { id: 'audit-consumer', reason: 'Another legitimate late consumer uses the event contract.', requires: ['late-consumer'], files: ['src/evaluator-consumer.js'] }]));
      await run(root, ['scripts/reconcile.js']);
      const actual = JSON.parse(await readFile(manifestPath, 'utf8')) as { consumers: string[]; files: string[] };
      if (!actual.consumers.includes('audit') || !actual.files.includes('src/evaluator-consumer.js')) fail('stale-noop-cache', 'Reconciliation ignored changed consumer and ownership inputs.');
      checks.push('changed inputs invalidate no-op basis');
    } finally { await unlink(newSource); for (const [i, file] of changed.entries()) await writeFile(path.join(root, file), originals[i]!); }
  } catch (error) { fail('reconciliation', String(error)); }
  return { passed: !findings.length, findings, checks, behavior };
}
