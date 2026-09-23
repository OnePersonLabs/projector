/** Authored controls qualify the evaluator only. They are never hosted participant evidence. */
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { writeFiles } from './index.ts';

export const seedNames = ['hidden-new-consumer', 'invented-justification', 'duplicate-old-new-route', 'unused-framework/dependency', 'no-op-cache-ignores-inputs'] as const;
export type Seed = typeof seedNames[number];
export const expectedCode: Record<Seed, string> = {
  'hidden-new-consumer': 'hidden-new-consumer', 'invented-justification': 'invented-justification',
  'duplicate-old-new-route': 'obsolete-route', 'unused-framework/dependency': 'unused-dependency', 'no-op-cache-ignores-inputs': 'stale-noop-cache'
};
const implementation = `export function createRuntime() {
 const records = [], retained = new Map(), subscribers = new Map(); let serial = 0;
 return {
  play(id, options = {}) { const event = {id, sequence: ++serial, provenance: options.preview ? 'preview' : 'live'}; records.push(event); for(const callback of subscribers.values()) callback({...event}); return {...event}; },
  events() { return records.map(event=>({...event})); },
  retain(id, text) { retained.set(id,text); }, evidence(id) { return retained.get(id) ?? null; },
  subscribe(name, callback) { const token=Symbol(name); subscribers.set(token,callback); for(const event of records) callback({...event}); return ()=>subscribers.delete(token); }
 };
}
`;
const reconciliation = `import {readFile,writeFile,readdir} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const requirements=await read('requirements.json'), consumers=await read('consumers.json'), decisions=await read('design/decisions.json');
const ids=requirements.map(item=>item.id).sort(), files=[...new Set(decisions.flatMap(item=>item.files))].sort();
for(const decision of decisions) if(!decision.requires.length || decision.requires.some(id=>!ids.includes(id))) throw new Error('Unjustified decision');
async function inventory(root){const result=[];for(const item of await readdir(root,{withFileTypes:true})){const name=root+'/'+item.name;if(item.isDirectory())result.push(...await inventory(name));else if(/\\.[cm]?js$/.test(name))result.push(name);}return result;}
for(const file of await inventory('src')) if(!files.includes(file)) throw new Error('Unowned source '+file);
const output=JSON.stringify({requirements:ids,consumers:consumers.map(item=>item.name).sort(),files})+'\\n';
let previous;try{previous=await readFile('ownership.json','utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
if(previous!==output)await writeFile('ownership.json',output);
`;
export async function installAuthoredControl(root: string): Promise<void> {
  for (const file of ['src/preview-strategy.js', 'src/preview-history.js', 'src/retained-events.js']) {
    try { await unlink(path.join(root, file)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  await writeFiles(root, {
    'src/index.js': implementation,
    'src/recorder.js': "export function subscribe(runtime) { const events=[]; const close=runtime.subscribe('recorder',event=>events.push({...event})); return {events,close}; }\n",
    'consumers.json': JSON.stringify([{ name: 'recorder', path: 'src/recorder.js' }]) + '\n',
    'design/decisions.json': JSON.stringify([
      { id: 'event-owner', reason: 'One route retains playback events, provenance, and independently retained evidence for late consumers.', requires: ['playback', 'provenance', 'evidence', 'late-consumer'], files: ['src/index.js'] },
      { id: 'recording-consumer', reason: 'The later recorder consumes retained and future playback events.', requires: ['late-consumer'], files: ['src/recorder.js'] }
    ]) + '\n',
    'design/reconciliation.md': '# Contribution disposition\n\nRemove the preview-only strategy and its registration. Retain event history for provenance and late recording consumers, and independent evidence for the surviving evidence requirement. One event route replaces withdrawn preview-only ownership.\n',
    'scripts/reconcile.js': reconciliation
  });
}
export async function seedBadCandidate(root: string, seed: Seed): Promise<void> {
  if (seed === 'hidden-new-consumer') await writeFiles(root, { 'src/hidden.js': "export function subscribe(runtime) { return runtime.subscribe('hidden',()=>{}); }\n" });
  if (seed === 'invented-justification') {
    const file = 'design/decisions.json'; const decisions = JSON.parse(await readFile(path.join(root, file), 'utf8')) as { requires: string[] }[];
    decisions[0]!.requires = ['future-speculative-platform']; await writeFiles(root, { [file]: JSON.stringify(decisions) });
  }
  if (seed === 'duplicate-old-new-route') await writeFiles(root, { 'src/legacy-preview.js': 'export function oldPreview(id) { return {id,preview:true}; }\n' });
  if (seed === 'unused-framework/dependency') {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
    pkg.dependencies = { 'unused-preview-framework': '1.0.0' }; await writeFiles(root, { 'package.json': JSON.stringify(pkg) });
  }
  if (seed === 'no-op-cache-ignores-inputs') await writeFiles(root, { 'scripts/reconcile.js': "import {existsSync} from 'node:fs'; if(existsSync('ownership.json')) process.exit(0);\n" + reconciliation });
}
