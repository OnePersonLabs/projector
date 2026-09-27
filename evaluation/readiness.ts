/** Portable qualification fixtures. Authored controls are not hosted implementation evidence. */
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createTrial, evaluateTrial, writeFiles } from './index.ts';
import { installAuthoredControl, seedBadCandidate } from './qualification.ts';
import type { EvaluateOptions, Evaluation } from './oracle.ts';
import { createDocumentIntelligence } from '../src/documents/index.ts';

const execute = promisify(execFile);
export const readinessVariants = ['missing-consumer', 'invented-rationale', 'unnecessary-abstraction', 'incomplete-migration', 'retired-artifact', 'false-audio-evidence'] as const;
export type ReadinessVariant = typeof readinessVariants[number];
export const platformFiles = {
  'platform/native/Cargo.toml': '[package]\nname = "readiness-native"\nversion = "0.1.0"\n',
  'platform/native/src/lib.rs': '#[tauri::command]\nfn model_available() -> bool { false }\nfn main() { let handlers = tauri::generate_handler![model_available]; }\n',
  'platform/native/tauri.conf.json': '{"build":{"frontendDist":"../web"}}\n',
  'platform/web/bridge.ts': 'import { invoke as nativeInvoke } from "@tauri-apps/api/core"; export const available = () => nativeInvoke<boolean>("model_available");\n',
  'platform/mobile/styles.ts': 'import { StyleSheet } from "react-native"; export const styles = StyleSheet.create({ status: { color: "red" } });\n',
  'platform/mobile/Status.tsx': 'import { styles } from "./styles"; export const Status = () => <View style={[styles.status, { opacity: 0.5 }]} />;\n',
  'platform/web/status.css': '.status { color: red; }\n',
  'platform/assets/tone.bank': 'Authored opaque asset fixture; no audio output qualification.\n'
};
const runtimeControl = `export function createUnwiredRuntime() {
 const missing = async () => { throw new Error('Model runtime wiring is missing'); };
 return { isAvailable: async () => false, load: missing, infer: missing, warmUp: missing, unload: missing };
}
export function createConsumer(runtime, dispatch) {
 let available = false;
 const ready = runtime.isAvailable().then(value => { available = value; });
 return { ready, note(id) { dispatch(id); return { model: available ? 'ready' : 'unavailable' }; } };
}
export function qualifyAudio(observation) {
 return { qualified: observation.nativeCapture !== null && observation.nativeCapture.frames > 0,
   basis: observation.nativeCapture === null ? 'dispatch-only' : 'native-capture' };
}
`;
const probe = `import assert from 'node:assert/strict';
import { createUnwiredRuntime, createConsumer, qualifyAudio } from './model.mjs';
const runtime = createUnwiredRuntime(); assert.equal(await runtime.isAvailable(), false);
for (const operation of ['load','infer','warmUp','unload']) await assert.rejects(runtime[operation](), /runtime wiring is missing/);
const dispatch = []; let release;
const consumer = createConsumer({isAvailable: () => new Promise(resolve => { release = resolve; })}, id => dispatch.push(id));
assert.deepEqual(consumer.note('first'), {model:'unavailable'}); assert.deepEqual(dispatch, ['first']);
release(false); await consumer.ready; assert.deepEqual(consumer.note('second'), {model:'unavailable'});
const audio = qualifyAudio({dispatch:true,nativeCapture:null}); assert.equal(audio.qualified, false); assert.equal(audio.basis, 'dispatch-only');
console.log(JSON.stringify({availability:false,unwiredFailures:4,immediateDispatch:dispatch,audio}));
`;

export async function createReadinessTrial(directory: string) {
  const trial = await createTrial(directory, 'preview', 'direct');
  await writeFiles(directory, { ...platformFiles,
    'platform/probe.mjs': probe,
    'platform/CONTRACT.md': '# Platform boundary rehearsal\n\nImplement model.mjs with createUnwiredRuntime, createConsumer and qualifyAudio. Availability resolves false when unwired; load, infer, warmUp and unload name missing runtime wiring. Consumer note dispatches immediately while readiness is pending and reports unavailable. Dispatch observations without native capture do not qualify audio playback. Native fixture relationships must preserve command registration and invocation, imported styles, and asset ownership. These fixtures do not provide a real model or native playback implementation.\n' });
  await execute('git', ['add', '--', 'platform'], { cwd: directory, windowsHide: true });
  await execute('git', ['-c', 'user.name=Projector evaluation', '-c', 'user.email=evaluation@localhost', 'commit', '-m', 'Platform boundary starting world'], { cwd: directory, windowsHide: true });
  return trial;
}
export async function installReadinessControl(root: string): Promise<void> {
  await installAuthoredControl(root); await writeFiles(root, { 'platform/model.mjs': runtimeControl });
}
export async function seedReadinessVariant(root: string, variant: ReadinessVariant): Promise<void> {
  if (variant === 'missing-consumer') await seedBadCandidate(root, 'hidden-new-consumer');
  if (variant === 'invented-rationale') await seedBadCandidate(root, 'invented-justification');
  if (variant === 'unnecessary-abstraction') await seedBadCandidate(root, 'unused-framework/dependency');
  if (variant === 'incomplete-migration') await seedBadCandidate(root, 'duplicate-old-new-route');
  if (variant === 'retired-artifact') await writeFiles(root, { 'src/retired-owner.js': 'export function oldPreview(id) { return {id,preview:true}; }\n' });
  if (variant === 'false-audio-evidence') {
    const source = await readFile(path.join(root, 'platform/model.mjs'), 'utf8');
    await writeFiles(root, { 'platform/model.mjs': source.replace('observation.nativeCapture !== null && observation.nativeCapture.frames > 0', 'observation.dispatch === true') });
  }
}
export async function evaluateReadiness(root: string, options: EvaluateOptions = {}): Promise<Evaluation> {
  const result = await evaluateTrial(root, 'preview', options);
  try {
    const probeResult = await execute(process.execPath, ['platform/probe.mjs'], { cwd: root, windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
    result.checks.push('model unavailability, explicit unwired errors, immediate consumer dispatch and dispatch-only audio evidence');
    result.behavior = { evolution: result.behavior, platform: JSON.parse(probeResult.stdout.trim()) as unknown };
  } catch (error) {
    result.findings.push({ code: 'platform-contract', message: error instanceof Error ? error.message.slice(0, 2000) : String(error) });
  }
  const host = await createDocumentIntelligence();
  const extracted = await Promise.all(Object.keys(platformFiles).map(async name => [name, await host.extract(name, await readFile(path.join(root, name)))] as const));
  const files = host.resolveRepository(new Map(extracted));
  const native = files.get('platform/native/src/lib.rs')!;
  const bridge = files.get('platform/web/bridge.ts')!;
  const mobile = files.get('platform/mobile/Status.tsx')!;
  if (!native.units.some(unit => unit.data?.operation === 'registration') || !bridge.references.some(reference => reference.text.startsWith('artifact:framework:')) || !mobile.references.some(reference => reference.text.startsWith('artifact:framework-style:'))) result.findings.push({ code: 'platform-relationships', message: 'Static command registration/invocation or imported style relationship is incomplete.' });
  else result.checks.push('static Tauri registration/invocation and React Native imported style relationships');
  result.passed = result.findings.length === 0; return result;
}
