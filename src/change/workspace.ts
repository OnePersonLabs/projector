import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { git, runGit } from './io.ts';
import type { ChangeState } from './types.ts';

export function changeArtifact(change: string, name: string): boolean {
  if (/^openspec\/(specs|designs)\/.+\/(spec|design)\.md$/.test(name)) return true;
  return name.startsWith(`openspec/changes/${change}/`) || (name.startsWith('openspec/changes/archive/') && name.split('/')[3]?.endsWith(`-${change}`) === true);
}

export async function withIndex<T>(root: string, tree: string, operation: (env: NodeJS.ProcessEnv, file: string) => Promise<T>): Promise<T> {
  const directory = path.join(await git(root, ['rev-parse', '--absolute-git-dir']), 'projector-indexes');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, randomUUID());
  const env = { GIT_INDEX_FILE: file };
  try { await git(root, ['read-tree', tree], { env }); return await operation(env, file); }
  finally { await rm(file, { force: true }); await rm(`${file}.lock`, { force: true }); }
}

/** Git filters and executable modes are applied without modifying the user's index. */
export async function workingTree(root: string, change: string): Promise<string> {
  return withIndex(root, 'HEAD', async env => {
    await git(root, ['add', '--all', '--', '.'], { env });
    await git(root, ['update-index', '--force-remove', '--', `openspec/changes/${change}/implementation-state.json`], { env });
    return git(root, ['write-tree'], { env });
  });
}

export async function changedPaths(root: string, from: string, to: string): Promise<string[]> {
  return (await runGit(['diff', '--name-only', '--no-renames', '-z', from, to, '--'], root)).stdout.split('\0').filter(Boolean);
}

/** Replay only the selected binary-capable patch; genuine overlap remains a conflict. */
export async function replay(root: string, onto: string, from: string, to: string, names?: string[]): Promise<string> {
  if (names?.length === 0 || from === to) return git(root, ['rev-parse', `${onto}^{tree}`]);
  const differs = new Set(await changedPaths(root, onto, to));
  names = (names ?? await changedPaths(root, from, to)).filter(name => differs.has(name));
  if (!names.length) return git(root, ['rev-parse', `${onto}^{tree}`]);
  const patch = (await runGit(['diff', '--binary', '--full-index', '--no-renames', from, to, '--', ...(names ?? [])], root,
    { maxOutputBytes: 64 * 1024 * 1024 })).stdoutBytes;
  return applyPatch(root, onto, patch);
}

export async function applyPatch(root: string, onto: string, patch: string | Uint8Array): Promise<string> {
  if (patch.length === 0) return git(root, ['rev-parse', `${onto}^{tree}`]);
  return withIndex(root, onto, async env => {
    await git(root, ['apply', '--cached', '--3way', '--whitespace=nowarn', '--'], { env, input: patch, maxOutputBytes: 4 * 1024 * 1024 });
    return git(root, ['write-tree'], { env });
  });
}

export async function selectedTree(state: ChangeState): Promise<{ tree: string; working: string; changes: string[] }> {
  const working = await workingTree(state.candidateRoot, state.change);
  const initial = state.initialTree ?? state.baseline;
  const implementation = (await changedPaths(state.root, initial, working)).filter(name => !changeArtifact(state.change, name));
  const selected = await replay(state.root, state.selectionTree ?? state.baseline, initial, working, implementation);
  const base = state.integrationHead ?? state.baseline;
  const tree = await replay(state.root, base, state.baseline, selected, (await changedPaths(state.root, state.baseline, selected)).filter(name => !changeArtifact(state.change, name)));
  return { tree, working, changes: (await changedPaths(state.root, base, tree)).filter(name => !changeArtifact(state.change, name)) };
}
