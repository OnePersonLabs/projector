import { activeRoot, inactive } from './activation.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { projectPath, physicalProjectPath, captureScope, writeText, optionalJson } from './state.mjs';

export function workId(id) { if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) throw new Error('Work ID must be a simple stable filename'); return id; }
export async function readCheckpoint(root, id) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  const file = await projectPath(root, `.projector/work/${workId(id)}.md`);
  const text = await fs.readFile(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error(`Invalid checkpoint: ${id}`);
  return { ...parse(match[1]), body: text.slice(match[0].length) };
}
export async function writeCheckpoint(root, request) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  workId(request.id);
  if (!request.goal) throw new Error('Checkpoint needs a goal');
  const owners = new Map();
  for (const assignment of request.ownership ?? []) {
    if (!assignment.owner) throw new Error('Ownership needs an owner');
    for (const file of assignment.paths ?? []) {
      const actual = await physicalProjectPath(root, file);
      const key = process.platform === 'win32' ? actual.toLowerCase() : actual;
      if (owners.has(key) && owners.get(key) !== assignment.owner) throw new Error(`Conflicting ownership of ${file}`);
      owners.set(key, assignment.owner);
    }
  }
  const snapshot = await captureScope(root, request.boundaries ?? []);
  const record = { ...request, body: undefined, status: 'active', snapshot };
  await writeText(await projectPath(root, `.projector/work/${request.id}.md`), `---\n${stringify(record)}---\n${request.body ?? request.goal}\n`);
  return record;
}
export async function updateCheckpoint(root, id, patch) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  const previous = await readCheckpoint(root, id);
  // Observation publication must not recapture a source baseline after a mutation.
  const next = { ...previous, ...patch };
  const { body, ...metadata } = next;
  await writeText(await projectPath(root, `.projector/work/${workId(id)}.md`), `---\n${stringify(metadata)}---\n${body ?? next.goal}\n`);
  return next;
}
export async function resume(root, id) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  const record = await readCheckpoint(root, id);
  const current = await captureScope(root, record.boundaries ?? []);
  const before = new Map((record.snapshot?.inputs ?? []).map(input => [input.path, input.hash]));
  const after = new Map(current.inputs.map(input => [input.path, input.hash]));
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(file => before.get(file) !== after.get(file));
  const mutations = [];
  for (const mutation of record.uncertainMutations ?? []) {
    const attempt = await optionalJson(await projectPath(root, `.projector/work/repairs/${workId(mutation)}/record.json`));
    mutations.push({ id: mutation, attempt, instruction: 'Inspect actual output bytes before continuing; no mutation replay occurred' });
  }
  return { ...record, currentSnapshot: current, changed, mutations, next: changed.length ? 'Refresh affected evidence and inspect actual diff' : 'Reuse applicable evidence; inspect native task state before continuing' };
}
export async function closeCheckpoint(root, id) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  const record = await readCheckpoint(root, id);
  if (record.uncertainMutations?.length) throw new Error('Inspect unresolved mutations before closing this checkpoint');
  const from = await projectPath(root, `.projector/work/${workId(id)}.md`);
  const to = await projectPath(root, `.projector/work/archive/${id}.md`);
  try { await fs.access(to); throw new Error(`Archive already contains ${id}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
  return { id, status: 'closed', file: `.projector/work/archive/${id}.md` };
}
