import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { evaluateTrial, type EvaluateOptions } from './oracle.ts';
import { stageArtifacts, functionalHistoricalWorld, projectorAdapter } from './stages.ts';

export type Trajectory = 'preview' | 'shared' | 'ownership';
export type TrialMode = 'evolved' | 'direct';
export interface Trial { root: string; trajectory: Trajectory; mode: TrialMode; brief: string }
export const requirements = [
  { id: 'playback', text: 'play(id, {preview}) publishes one event with monotonically increasing sequence and provenance live or preview; preview uses the same event route.' },
  { id: 'provenance', text: 'events() returns detached event records; each has id, sequence, provenance. Previously published records never change.' },
  { id: 'evidence', text: 'retain(id, text) retains evidence independent of preview state; evidence(id) returns the most recently retained text or null. A later recording consumer legitimately shares retained events.' },
  { id: 'late-consumer', text: 'subscribe(name, callback) immediately replays all prior events exactly once in order and receives each future event once. Unsubscribe stops future delivery. Subscriber mutation cannot change the retained event or other subscribers.' },
  { id: 'ownership', text: 'Current decision records map actual source files to surviving requirements. Consumer modules are explicitly declared. Reconcile generates ownership.json from current decisions and consumers, rejects unowned source, and is a content-preserving no-op when settled.' }
] as const;

export async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [name, source] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), source); }
}
const baseline = `export function createRuntime() {
 const records = [], retained = new Map();
 return { play(id, options = {}) { const event = {id, sequence: records.length + 1, provenance: options.preview ? 'preview' : 'live'}; records.push(event); return {...event}; },
 events() { return records.map(event => ({...event})); }, retain(id, text) { retained.set(id, text); }, evidence(id) { return retained.get(id) ?? null; },
 subscribe(_name, _callback) { throw new Error('Late-consumer behavior is not implemented yet'); } };
}
`;
export async function createTrial(directory: string, trajectory: Trajectory, mode: TrialMode): Promise<Trial> {
  await mkdir(directory, { recursive: true });
  if ((await readdir(directory)).length) throw new Error('Trial directory must be empty');
  const history = trajectory === 'preview'
    ? 'A preview-specific buffering strategy was previously added. It is now withdrawn: playback and preview must use one route, while general evidence retention survives.'
    : trajectory === 'shared'
      ? 'The preview strategy originally motivated retained events. Preview-specific strategy is withdrawn, but a recorder now legitimately requires the shared event history and evidence. Preserve the shared artifact with a current reason; remove preview-only mechanisms.'
      : 'A partial ownership move from PreviewHistory to general event ownership has begun. Complete the bound rename, migrate internal users, remove the old route, and support a late recording consumer without losing events or evidence.';
  const stages = stageArtifacts(mode, trajectory);
  const stageInstructions = `## Actual Projector change loop\n\nPROJECTOR_EVAL_RUNTIME is supplied by the host and names the installed runtime. From this original trial root run node scripts/projector.js prepare. Work in the returned candidateRoot for implementation edits; keep adapter commands running from the original root. Target refinements belong in the ORIGINAL root openspec/changes/clean-evolution artifacts, followed by adapter revise. Add precise Realizes bindings for any legitimate supporting tests, reconciliation scripts, consumer/design records and evidence notes you introduce; those files also need current contribution dispositions and executed evidence scope. The nested live and target OpenSpec/design artifacts are already provided. Do not invoke disabled OpenSpec skills; this adapter calls production Projector directly.\n\nUse node scripts/projector.js plan '<JSON>' to submit applicability and contribution dispositions, then node scripts/projector.js apply. Example applicability: {requirement:"spec:playback/events#Playback lifecycle",selectors:[{kind:"path",root:".",prefix:"src"}],reason:"The event concern owns the affected runtime"}. Contributions have path, decision:"design:playback/events#decision:event-owner", action:retain/remove/replace/revise, and current reason. Account for actual changed files and previous source contributions. Inspect returned obligations and resolve them. JSON is one command argument.\n\n${mode === 'evolved' ? 'Stage 1: The current prospective target temporarily adds createRuntime().previewCount(). Implement it using the existing functional strategy; preserve the live/preview event sequence and retained evidence. Validate and apply this intermediate plan, then run node scripts/projector.js advance. The adapter runs actual stage assertions, stores evidence and a Git checkpoint, and revises the SAME active target to the final intent. Do not jump directly to final implementation. Stage 2: Re-plan against the changed target, retaining legitimate shared contributions and migrating ownership as described below. Implement the final contract and remove the now-withdrawn preview counter/strategy. The saved intermediate checkpoint must remain inspectable.' : 'This direct run starts with the final target. Plan and implement that target without manufacturing intermediate preview architecture.'}\n\nAfter final tests, call node scripts/projector.js evidence '<JSON>' with command (absolute Node executable or node), args for a real check, and exact checked source paths in scope. Revalidate the final plan. Stop ready for independent review; do not supply a self-review, call finish directly, or claim independent review happened. The parent performs the independent review, publication and repeated-finish no-op check. The fixture ownership reconcile below is an additional observation and does not prove Projector itself is settled.\n\n`;
  const brief = `# Coupled clean-evolution trial\n\nTrajectory: ${trajectory}; start: ${mode}.\n\n${history}\n\n${stageInstructions}Implement the final requirements in requirements.json in ordinary JS ESM. Public entry src/index.js exports createRuntime() with play(id, {preview}), events(), retain(id,text), evidence(id), subscribe(name,callback), whose return value is an unsubscribe function. No dependencies are required. Supply src/recorder.js exporting subscribe(runtime), returning an object with an events array and close() method; it registers as recorder and collects detached replay/live events. consumers.json declares {name:"recorder",path:"src/recorder.js"}.\n\nKeep design/decisions.json as an array of {id,reason,requires:string[],files:string[]}; requires must cite surviving requirement IDs, and every src JS artifact needs a current decision. Explain retained shared responsibilities and removed preview-only choices in design/reconciliation.md. No PreviewStrategy, PreviewHistory, PreviewBuffer, oldPreview, legacyPreview or preview-specific flag/dependency may survive. Other names and module structure are your choice.\n\nProvide npm test and npm run reconcile. Reconcile writes ownership.json with exactly {requirements:[sorted requirement IDs],consumers:[sorted declared consumer names],files:[sorted decision-owned src paths]}; it must use current input contents on every invocation, reject missing requirement IDs and unowned src files, and avoid rewriting unchanged output. Reconcile is the fixture's derived ownership observation, not product runtime behavior. New declared consumers and their decisions must be reflected on the next invocation.\n\nFinish by running tests and reconcile twice; the second pass must make no net file changes. Do not open external evaluation files or parent directories. Do not add dependencies or preserve withdrawn behavior just because it existed. Use only this repository and legitimate facts above. Record actual commands/results in EVALUATION.md.\n`;
  const decisions = [{ id: 'ordinary-playback', reason: 'Publish playback events and preserve provenance.', requires: ['playback', 'provenance', 'evidence'], files: ['src/index.js'] }];
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: `projector-evaluation-${trajectory}-${mode}`, private: true, type: 'module', scripts: { test: 'node --test test/*.test.js', reconcile: 'node scripts/reconcile.js' } }, null, 2) + '\n',
    'requirements.json': JSON.stringify(requirements, null, 2) + '\n', 'consumers.json': '[]\n',
    'design/decisions.json': JSON.stringify(decisions, null, 2) + '\n', 'PARTICIPANT.md': brief,
    'src/index.js': baseline,
    ...stages.baseline,
    'scripts/projector.js': projectorAdapter,
    'trial.json': JSON.stringify({ version: 1, trajectory, mode, finalTarget: stages.final }, null, 2) + '\n',
    'test/playback.test.js': "import test from 'node:test'; import assert from 'node:assert/strict'; import {createRuntime} from '../src/index.js'; test('ordinary playback',()=>{const r=createRuntime();assert.equal(r.play('one').sequence,1);assert.equal(r.events()[0].provenance,'live');});\n"
  };
  if (mode === 'evolved') {
    Object.assign(files, functionalHistoricalWorld(trajectory));
    files['design/decisions.json'] = JSON.stringify([{ id: 'accepted-preview-owner', reason: 'The accepted intermediate preview strategy publishes preview events while retained history owns provenance and evidence.', requires: ['playback', 'provenance', 'evidence'], files: ['src/index.js', 'src/preview-strategy.js', `src/${trajectory === 'ownership' ? 'preview-history' : 'retained-events'}.js`] }], null, 2) + '\n';
    files['design/previous-contribution.md'] = `# Previous contribution\n\nThe prior preview-only decision created src/preview-strategy.js and its registration in src/index.js. This decision is withdrawn. ${history}\n`;
  }
  await writeFiles(directory, files);
  const execute = promisify(execFile);
  for (const args of [['init', '-b', 'main'], ['config', 'core.autocrlf', 'false'], ['add', '--all'], ['-c', 'user.name=Projector evaluation', '-c', 'user.email=evaluation@localhost', 'commit', '-m', 'Legitimate trial starting world']]) await execute('git', args, { cwd: directory, windowsHide: true });
  await writeFiles(directory, stages.initial);
  return { root: directory, trajectory, mode, brief };
}
export { evaluateTrial } from './oracle.ts';
export async function comparePair(left: string, right: string, trajectory: Trajectory, options: EvaluateOptions = {}) {
  const [evolved, direct] = await Promise.all([evaluateTrial(left, trajectory, options), evaluateTrial(right, trajectory, options)]);
  return { equivalent: evolved.passed && direct.passed && JSON.stringify(evolved.behavior) === JSON.stringify(direct.behavior), evolved, direct };
}
export async function trialBrief(root: string): Promise<string> { return readFile(path.join(root, 'PARTICIPANT.md'), 'utf8'); }
