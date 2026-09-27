import { mkdir, writeFile, rename, unlink, lstat, chmod, copyFile, open, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { atomicJson, exists, git, runGit, safePath } from './io.ts';
import { changedPaths, replay, workingTree, withIndex } from './workspace.ts';
import type { ChangeServiceOptions, PublicationTransaction, StoredFile } from './types.ts';

async function storedFile(root: string, name: string): Promise<StoredFile | undefined> {
  const full = safePath(root, name);
  if (!await exists(full)) return undefined;
  const info = await lstat(full);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Publication cannot replace a special file: ${name}`);
  return { blob: await git(root, ['hash-object', '-w', '--no-filters', '--', full]), mode: info.mode & 0o111 ? '100755' : '100644' };
}
function equal(a?: StoredFile, b?: StoredFile): boolean {
  return a?.blob === b?.blob && (process.platform === 'win32' || a?.mode === b?.mode);
}
async function blobToFile(root: string, args: string[], destination: string): Promise<void> {
  const child = spawn('git', ['-C', root, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let errorText = '';
  child.stderr.on('data', chunk => { errorText = (errorText + String(chunk)).slice(-4096); });
  const completion = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Publication blob read failed (${code}): ${errorText}`)));
  });
  void completion.catch(() => {});
  try { await pipeline(child.stdout, createWriteStream(destination, { flags: 'wx' })); await completion; }
  finally { if (child.exitCode === null) child.kill(); }
}
async function treeEntries(root: string, tree: string): Promise<Map<string, StoredFile>> {
  const entries = new Map<string, StoredFile>();
  for (const value of (await runGit(['ls-tree', '-rz', tree], root)).stdout.split('\0').filter(Boolean)) {
    const match = /^(\d+) blob ([a-f0-9]+)\t([\s\S]+)$/.exec(value);
    if (!match || match[1] === '120000') throw new Error('Selected publication contains an unsupported Git entry');
    entries.set(match[3]!, { mode: match[1]!, blob: match[2]! });
  }
  return entries;
}
export interface PublicationInput { root: string; targetBranch: string; targetHead: string; commit: string; directory: string; change?: string; materializedAuthority?: { tree: string; paths: string[] } }

async function retainRecovery(root: string, transaction: PublicationTransaction): Promise<void> {
  if (transaction.recoveryRef) return;
  const empty = await git(root, ['mktree'], { input: '' });
  const tree = await withIndex(root, empty, async env => {
    const entries = [`100644 ${transaction.beforeIndex}\tbefore-index`, `100644 ${transaction.afterIndex}\tafter-index`];
    for (const [i, file] of transaction.files.entries()) {
      if (file.before) entries.push(`100644 ${file.before.blob}\tfiles/${i}/before`);
      if (file.after) entries.push(`100644 ${file.after.blob}\tfiles/${i}/after`);
    }
    await git(root, ['update-index', '-z', '--index-info'], { env, input: entries.join('\0') + '\0' });
    return git(root, ['write-tree'], { env });
  });
  const retained = await git(root, ['-c', 'user.name=Projector recovery', '-c', 'user.email=recovery@localhost', 'commit-tree', tree, '-p', transaction.commit, '-m', `Publication recovery ${randomUUID()}`]);
  transaction.recoveryRef = `refs/projector/publications/${retained}`;
  await git(root, ['update-ref', transaction.recoveryRef, retained, '']);
}
async function releaseRecovery(root: string, transaction: PublicationTransaction): Promise<void> {
  if (!transaction.recoveryRef) return;
  const expected = /^refs\/projector\/publications\/([a-f0-9]{40,64})$/.exec(transaction.recoveryRef)?.[1];
  if (!expected) throw new Error('Publication recovery reference is outside its private namespace');
  const current = await git(root, ['for-each-ref', '--format=%(objectname)', transaction.recoveryRef]);
  if (current) await git(root, ['update-ref', '-d', transaction.recoveryRef, expected]);
}

/** Prepare a recoverable installation without changing the selected checkout or its index. */
export async function preparePublication(input: PublicationInput): Promise<PublicationTransaction> {
  const { root, targetBranch, targetHead, commit, directory, change = '' } = input;
  if (await git(root, ['symbolic-ref', 'HEAD']) !== targetBranch || await git(root, ['rev-parse', 'HEAD']) !== targetHead) throw new Error('Target branch moved before publication preparation');
  if (await git(directory, ['rev-parse', 'HEAD']) !== commit || await git(directory, ['status', '--porcelain', '--untracked-files=normal'])) throw new Error('Finalization commit or post-hook working state differs from the reviewed result');
  const staged = await git(root, ['write-tree']);
  const current = await workingTree(root, change);
  // Live authority follows the same three-way residual replay as source. Only
  // this change's active/archive mirrors are consumed by finalization.
  const residual = (names: string[]) => names.filter(name => !change ||
    !(name.startsWith(`openspec/changes/${change}/`) || name.startsWith('openspec/changes/archive/') && name.split('/')[3]?.endsWith(`-${change}`)));
  const managed = new Set(input.materializedAuthority?.paths ?? []);
  for (const name of managed) safePath(root, name);
  let afterStaged = await replay(root, commit, targetHead, staged, residual(await changedPaths(root, targetHead, staged)).filter(name => !managed.has(name)));
  let afterWorking = await replay(root, commit, targetHead, current, residual(await changedPaths(root, targetHead, current)).filter(name => !managed.has(name)));
  if (input.materializedAuthority) {
    const synchronized = input.materializedAuthority.tree;
    afterWorking = await replay(root, afterWorking, synchronized, current, residual(await changedPaths(root, synchronized, current)).filter(name => managed.has(name)));
    const baselineEntries = await treeEntries(root, targetHead), synchronizedEntries = await treeEntries(root, synchronized), stagedEntries = await treeEntries(root, staged);
    for (const name of managed) {
      const entry = stagedEntries.get(name), baseline = baselineEntries.get(name), materialized = synchronizedEntries.get(name);
      const sameEntry = (a?: StoredFile, b?: StoredFile) => a?.blob === b?.blob && a?.mode === b?.mode;
      if (sameEntry(entry, baseline) || sameEntry(entry, materialized)) continue;
      if (baseline && materialized) {
        const normalized = await replay(root, synchronized, targetHead, staged, [name]);
        afterStaged = await replay(root, afterStaged, synchronized, normalized, [name]);
      } else if (materialized) afterStaged = await replay(root, afterStaged, synchronized, staged, [name]);
      else afterStaged = await replay(root, afterStaged, targetHead, staged, [name]);
    }
  }
  const beforeEntries = await treeEntries(root, current), afterEntries = await treeEntries(root, afterWorking);
  const gitDir = await git(root, ['rev-parse', '--absolute-git-dir']);
  const scratch = path.join(gitDir, `projector-publication-${randomUUID()}`); await mkdir(scratch);
  const indexPath = path.join(gitDir, 'index');
  try {
    const beforeIndex = await git(root, ['hash-object', '-w', '--no-filters', '--', indexPath]);
    const afterIndex = await withIndex(root, afterStaged, async (_env, file) => {
      // Preserve flags and metadata on unrelated index entries.
      const copy = path.join(scratch, 'index'); await copyFile(indexPath, copy);
      const env = { GIT_INDEX_FILE: copy };
      if (await git(root, ['hash-object', '--no-filters', '--', copy]) !== beforeIndex || await git(root, ['write-tree'], { env }) !== staged) throw new Error('User staging changed while preparing publication');
      const finalEntries = await treeEntries(root, afterStaged);
      for (const name of await changedPaths(root, staged, afterStaged)) {
        const entry = finalEntries.get(name);
        if (entry) await git(root, ['update-index', '--add', '--cacheinfo', `${entry.mode},${entry.blob},${name}`], { env });
        else await git(root, ['update-index', '--force-remove', '--', name], { env });
      }
      // The generated index must describe exactly the prepared staging tree.
      if (await git(root, ['write-tree'], { env }) !== await git(root, ['write-tree'], { env: { GIT_INDEX_FILE: file } })) throw new Error('Prepared publication index differs from selected staging');
      return git(root, ['hash-object', '-w', '--no-filters', '--', copy]);
    });
    const files: PublicationTransaction['files'] = [];
    for (const name of new Set([...beforeEntries.keys(), ...afterEntries.keys()])) {
      const before = beforeEntries.get(name), after = afterEntries.get(name);
      if (before?.blob === after?.blob && before?.mode === after?.mode) continue;
      const actual = await storedFile(root, name);
      let storedAfter: StoredFile | undefined;
      if (after) {
        const file = path.join(scratch, randomUUID());
        await blobToFile(directory, ['cat-file', '--filters', `${afterWorking}:${name}`], file);
        storedAfter = { blob: await git(root, ['hash-object', '-w', '--no-filters', '--', file]), mode: after.mode };
      }
      files.push({ path: name, before: actual, after: storedAfter });
    }
    // The runtime state is private recovery data; remove only this active mirror.
    if (change) {
      const name = `openspec/changes/${change}/implementation-state.json`;
      const before = await storedFile(root, name);
      if (before && !files.some(file => file.path === name)) files.push({ path: name, before });
    }
    const transaction: PublicationTransaction = { version: 1, directory, targetBranch, targetHead, commit, beforeIndex, afterIndex, files, installed: [], phase: 'prepared' };
    await retainRecovery(root, transaction);
    return transaction;
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

export async function publishPublication(root: string, transaction: PublicationTransaction, options: {
  save?: () => Promise<void>; fault?: ChangeServiceOptions['fault'];
} = {}): Promise<void> {
  const gitDir = await git(root, ['rev-parse', '--absolute-git-dir']);
  const journal = path.join(gitDir, 'projector-publications', `${transaction.commit}.json`);
  const save = options.save ?? (() => atomicJson(journal, transaction));
  if (transaction.phase !== 'installed') await retainRecovery(root, transaction);
  await save();
  const indexPath = path.join(gitDir, 'index');
  const indexLock = `${indexPath}.lock`;
  const lock = await open(indexLock, 'wx'); await lock.close();
  try {
    if (transaction.phase === 'installed') {
      // A crash may leave higher-level state behind this completed journal.
      // Recovery must not resurrect pruned pre-publication objects.
      if (await git(root, ['symbolic-ref', 'HEAD']) !== transaction.targetBranch || await git(root, ['rev-parse', transaction.targetBranch]) !== transaction.commit || await git(root, ['hash-object', '--no-filters', '--', indexPath]) !== transaction.afterIndex) throw new Error('Installed publication branch/index differs; preserve later user changes');
      for (const file of transaction.files) if (!equal(await storedFile(root, file.path), file.after)) throw new Error(`Installed publication differs: ${file.path}`);
      await releaseRecovery(root, transaction);
      return;
    }
    // index.lock excludes cooperating Git writers through ref and checkout installation.
    await options.fault?.('before-publication');
    if (await git(root, ['symbolic-ref', 'HEAD']) !== transaction.targetBranch) throw new Error('Selected checkout switched branches during publication');
    const head = await git(root, ['rev-parse', transaction.targetBranch]);
    if (head !== transaction.targetHead && head !== transaction.commit) throw new Error('Target branch moved; preserve the prepared publication and reconcile');
    const indexBlob = await git(root, ['hash-object', '--no-filters', '--', indexPath]);
    if (indexBlob !== transaction.beforeIndex && indexBlob !== transaction.afterIndex) throw new Error('User staging changed during publication; preserve it and reconcile');
    for (const file of transaction.files) {
      const current = await storedFile(root, file.path);
      if (!equal(current, file.before) && !equal(current, file.after)) throw new Error(`User edits overlap publication recovery: ${file.path}`);
    }
    if (head !== transaction.commit) await git(root, ['update-ref', transaction.targetBranch, transaction.commit, transaction.targetHead]);
    transaction.phase = 'advanced'; await save(); await options.fault?.('after-publication');
    for (const file of transaction.files) {
      const current = await storedFile(root, file.path);
      if (equal(current, file.after)) continue;
      if (!equal(current, file.before)) throw new Error(`User edits overlap publication recovery: ${file.path}`);
      const destination = safePath(root, file.path);
      if (!file.after) await unlink(destination);
      else {
        await mkdir(path.dirname(destination), { recursive: true });
        const temporary = `${destination}.${randomUUID()}.projector-new`;
        try {
          await blobToFile(root, ['cat-file', 'blob', file.after.blob], temporary);
          if (process.platform !== 'win32') await chmod(temporary, file.after.mode === '100755' ? 0o755 : 0o644);
          await rename(temporary, destination);
        } finally { await rm(temporary, { force: true }); }
      }
      transaction.installed.push(file.path); await save(); await options.fault?.('after-checkout-file');
    }
    if (indexBlob === transaction.afterIndex) await copyFile(indexPath, indexLock);
    else {
      const indexBytes = (await runGit(['cat-file', 'blob', transaction.afterIndex], root, { maxOutputBytes: 64 * 1024 * 1024 })).stdoutBytes;
      await writeFile(indexLock, indexBytes);
    }
    const settledIndex = await git(root, ['hash-object', '--no-filters', '--', indexPath]);
    if (settledIndex !== indexBlob && settledIndex !== transaction.afterIndex) throw new Error('User staging changed during checkout installation; preserve it and reconcile');
    await rename(indexLock, indexPath);
    transaction.phase = 'installed'; await save();
  } finally { await rm(indexLock, { force: true }); }
  for (const file of transaction.files) if (!equal(await storedFile(root, file.path), file.after)) throw new Error(`Publication verification differs: ${file.path}`);
  if (await git(root, ['rev-parse', transaction.targetBranch]) !== transaction.commit || await git(root, ['hash-object', '--no-filters', '--', indexPath]) !== transaction.afterIndex) throw new Error('Publication verification differs from prepared branch/index');
  await releaseRecovery(root, transaction);
}
