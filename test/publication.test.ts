import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preparePublication, publishPublication } from '../src/change/publication.ts';
import { git } from '../src/change/io.ts';
import type { PublicationTransaction } from '../src/change/types.ts';

async function scenario() {
  const root = await mkdtemp(path.join(tmpdir(), 'projector-publication-test-'));
  const baselineText = ['before', ...Array.from({ length: 12 }, (_, i) => `context ${i}`), 'user'].join('\n') + '\n';
  await writeFile(path.join(root, 'file.txt'), baselineText);
  await git(root, ['init', '-b', 'main']); await git(root, ['config', 'user.name', 'Publication test']);
  await git(root, ['config', 'user.email', 'publication@example.test']); await git(root, ['config', 'core.autocrlf', 'false']);
  await git(root, ['add', '.']); await git(root, ['commit', '-m', 'Baseline']);
  const targetHead = await git(root, ['rev-parse', 'HEAD']);
  const directory = path.join(await mkdtemp(path.join(tmpdir(), 'projector-publication-final-')), 'worktree');
  await git(root, ['worktree', 'add', '--detach', directory, targetHead]);
  await writeFile(path.join(directory, 'file.txt'), baselineText.replace('before', 'after'));
  await mkdir(path.join(directory, 'specs')); await writeFile(path.join(directory, 'specs', 'accepted.md'), 'Accepted with code\n');
  await git(directory, ['add', '.']); await git(directory, ['commit', '-m', 'Selected result']);
  const commit = await git(directory, ['rev-parse', 'HEAD']);
  await writeFile(path.join(root, 'file.txt'), baselineText.replace('user', 'staged'));
  await git(root, ['add', 'file.txt']);
  await writeFile(path.join(root, 'file.txt'), baselineText.replace('before', 'after').replace('user', 'unstaged'));
  await writeFile(path.join(root, 'untracked.txt'), 'Unrelated content\n');
  return { root, directory, targetHead, commit, targetBranch: 'refs/heads/main', baselineText };
}

test('selected publication preserves disjoint staged and unstaged hunks in the same file', async () => {
  const input = await scenario();
  const transaction = await preparePublication(input);
  await publishPublication(input.root, transaction);
  assert.equal(await git(input.root, ['rev-parse', 'HEAD']), input.commit);
  assert.match(await git(input.root, ['show', ':file.txt']), /^after[\s\S]*staged$/);
  assert.match(await readFile(path.join(input.root, 'file.txt'), 'utf8'), /^after[\s\S]*unstaged\n$/);
  assert.equal(await readFile(path.join(input.root, 'untracked.txt'), 'utf8'), 'Unrelated content\n');
  assert.equal(await readFile(path.join(input.root, 'specs', 'accepted.md'), 'utf8'), 'Accepted with code\n');
});

test('publication recovers after branch advancement and protects intervening user edits', async () => {
  const input = await scenario(); const transaction = await preparePublication(input);
  await assert.rejects(publishPublication(input.root, transaction, { fault: point => { if (point === 'after-publication') throw new Error('injected power loss'); } }), /injected power loss/);
  assert.equal(await git(input.root, ['rev-parse', 'HEAD']), input.commit);
  await writeFile(path.join(input.root, 'specs'), 'A user file occupies the planned directory');
  await assert.rejects(publishPublication(input.root, transaction), /ENOTDIR|EEXIST/);
  assert.equal(await readFile(path.join(input.root, 'specs'), 'utf8'), 'A user file occupies the planned directory');
});

test('publication resumes already installed files after an interrupted checkout installation', async () => {
  const input = await scenario(); const transaction = await preparePublication(input);
  let crash = true;
  await assert.rejects(publishPublication(input.root, transaction, { fault: point => { if (point === 'after-checkout-file' && crash) { crash = false; throw new Error('injected checkout interruption'); } } }), /injected checkout interruption/);
  await publishPublication(input.root, transaction);
  assert.equal(transaction.phase, 'installed');
  assert.equal(await git(input.root, ['rev-parse', 'HEAD']), input.commit);
  assert.match(await git(input.root, ['show', ':file.txt']), /staged$/);
});

test('publication preserves staged and unstaged live authority, including disjoint owned-file hunks', async () => {
  const input = await scenario();
  const owned = 'openspec/specs/owned/spec.md'; const unrelated = 'openspec/specs/unrelated/spec.md';
  await mkdir(path.dirname(path.join(input.root, owned)), { recursive: true });
  await writeFile(path.join(input.root, owned), input.baselineText);
  await git(input.root, ['add', owned]); await git(input.root, ['commit', '--only', '-m', 'Authority baseline', '--', owned]);
  input.targetHead = await git(input.root, ['rev-parse', 'HEAD']);
  await git(input.directory, ['reset', '--hard', input.targetHead]);
  await writeFile(path.join(input.directory, 'file.txt'), input.baselineText.replace('before', 'after'));
  await mkdir(path.dirname(path.join(input.directory, owned)), { recursive: true });
  await writeFile(path.join(input.directory, owned), input.baselineText.replace('before', 'after'));
  await git(input.directory, ['add', '.']); await git(input.directory, ['commit', '-m', 'Selected code and authority']);
  input.commit = await git(input.directory, ['rev-parse', 'HEAD']);
  await writeFile(path.join(input.root, owned), input.baselineText.replace('user', 'staged authority'));
  await git(input.root, ['add', owned]);
  await writeFile(path.join(input.root, owned), input.baselineText.replace('user', 'unstaged authority'));
  await mkdir(path.dirname(path.join(input.root, unrelated)), { recursive: true });
  await writeFile(path.join(input.root, unrelated), 'Staged unrelated authority\n'); await git(input.root, ['add', unrelated]);
  await writeFile(path.join(input.root, unrelated), 'Unstaged unrelated authority\n');
  const transaction = await preparePublication({ ...input, change: 'owned-change' });
  await publishPublication(input.root, transaction);
  assert.match(await git(input.root, ['show', `HEAD:${owned}`]), /^after[\s\S]*user$/);
  assert.match(await git(input.root, ['show', `:${owned}`]), /^after[\s\S]*staged authority$/);
  assert.match(await readFile(path.join(input.root, owned), 'utf8'), /^after[\s\S]*unstaged authority\n$/);
  assert.equal(await git(input.root, ['show', `:${unrelated}`]), 'Staged unrelated authority');
  assert.equal(await readFile(path.join(input.root, unrelated), 'utf8'), 'Unstaged unrelated authority\n');
});

test('recovery roots raw index and file blobs through Git pruning after a crash', async () => {
  const input = await scenario(); const transaction = await preparePublication(input);
  await assert.rejects(publishPublication(input.root, transaction, { fault: point => { if (point === 'after-publication') throw new Error('crash before checkout'); } }), /crash before checkout/);
  const gitDir = await git(input.root, ['rev-parse', '--absolute-git-dir']);
  const resumed = JSON.parse(await readFile(path.join(gitDir, 'projector-publications', `${input.commit}.json`), 'utf8')) as PublicationTransaction;
  assert.ok(resumed.recoveryRef);
  await git(input.root, ['reflog', 'expire', '--expire=now', '--all']); await git(input.root, ['prune', '--expire=now']);
  await git(input.root, ['cat-file', '-e', resumed.afterIndex]);
  for (const file of resumed.files) if (file.after) await git(input.root, ['cat-file', '-e', file.after.blob]);
  await publishPublication(input.root, resumed);
  assert.equal(await git(input.root, ['rev-parse', 'HEAD']), input.commit);
  assert.equal(await git(input.root, ['for-each-ref', '--format=%(objectname)', resumed.recoveryRef!]), '');
});

test('held index lock precedes identity validation and a late staging write cannot be overwritten', async () => {
  const input = await scenario(); const transaction = await preparePublication(input);
  const gitDir = await git(input.root, ['rev-parse', '--absolute-git-dir']);
  const candidateGit = await git(input.directory, ['rev-parse', '--absolute-git-dir']);
  const newIndex = await readFile(path.join(candidateGit, 'index'));
  await assert.rejects(publishPublication(input.root, transaction, { fault: async point => {
    if (point !== 'before-publication') return;
    await readFile(path.join(gitDir, 'index.lock'));
    await writeFile(path.join(gitDir, 'index'), newIndex);
  } }), /User staging changed during publication/);
  assert.equal(await git(input.root, ['rev-parse', 'HEAD']), input.targetHead);
  assert.deepEqual(await readFile(path.join(gitDir, 'index')), newIndex);
});

test('installed journal resumes after cleanup and pruning without restoring retired recovery blobs', async () => {
  const input = await scenario(); const transaction = await preparePublication(input);
  await publishPublication(input.root, transaction);
  assert.equal(transaction.phase, 'installed');
  await git(input.root, ['reflog', 'expire', '--expire=now', '--all']); await git(input.root, ['prune', '--expire=now']);
  await assert.rejects(git(input.root, ['cat-file', '-e', transaction.beforeIndex]));
  await publishPublication(input.root, transaction);
  assert.equal(transaction.phase, 'installed');
  assert.equal(await git(input.root, ['rev-parse', 'HEAD']), input.commit);
});

test('revised authority subtracts prior managed synchronization while preserving staged and working user hunks', async () => {
  for (const stageManaged of [true, false]) {
    const input = await scenario(); const owned = 'openspec/specs/owned/spec.md';
    await mkdir(path.dirname(path.join(input.root, owned)), { recursive: true });
    await writeFile(path.join(input.root, owned), input.baselineText);
    await git(input.root, ['add', owned]); await git(input.root, ['commit', '--only', '-m', 'Authority baseline', '--', owned]);
    input.targetHead = await git(input.root, ['rev-parse', 'HEAD']);
    await git(input.directory, ['reset', '--hard', input.targetHead]);
    await writeFile(path.join(input.directory, 'file.txt'), input.baselineText.replace('before', 'after'));
    const old = input.baselineText.replace('before', 'synchronized');
    await writeFile(path.join(input.directory, owned), old);
    await git(input.directory, ['add', '.']); await git(input.directory, ['commit', '-m', 'Earlier synchronized target']);
    const synchronized = await git(input.directory, ['rev-parse', 'HEAD']);
    await writeFile(path.join(input.directory, owned), input.baselineText.replace('before', 'final'));
    await git(input.directory, ['add', owned]); await git(input.directory, ['commit', '-m', 'Revised accepted target']);
    input.commit = await git(input.directory, ['rev-parse', 'HEAD']);
    await writeFile(path.join(input.root, owned), (stageManaged ? old : input.baselineText).replace('user', 'staged authority'));
    await git(input.root, ['add', owned]);
    await writeFile(path.join(input.root, owned), old.replace('user', 'unstaged authority'));
    const transaction = await preparePublication({ ...input, change: 'owned-change', materializedAuthority: { tree: synchronized, paths: [owned] } });
    await publishPublication(input.root, transaction);
    assert.match(await git(input.root, ['show', `HEAD:${owned}`]), /^final[\s\S]*user$/);
    assert.match(await git(input.root, ['show', `:${owned}`]), /^final[\s\S]*staged authority$/);
    assert.match(await readFile(path.join(input.root, owned), 'utf8'), /^final[\s\S]*unstaged authority\n$/);
  }
});

test('newly synchronized authority uses its managed baseline for later user hunks', async () => {
  const input = await scenario(); const owned = 'openspec/specs/new/spec.md';
  const old = input.baselineText.replace('before', 'synchronized');
  await mkdir(path.dirname(path.join(input.directory, owned)), { recursive: true });
  await writeFile(path.join(input.directory, owned), old); await git(input.directory, ['add', owned]);
  await git(input.directory, ['commit', '-m', 'Earlier new capability']);
  const synchronized = await git(input.directory, ['rev-parse', 'HEAD']);
  await writeFile(path.join(input.directory, owned), input.baselineText.replace('before', 'final'));
  await git(input.directory, ['add', owned]); await git(input.directory, ['commit', '-m', 'Revised new capability']);
  input.commit = await git(input.directory, ['rev-parse', 'HEAD']);
  await mkdir(path.dirname(path.join(input.root, owned)), { recursive: true });
  await writeFile(path.join(input.root, owned), old.replace('user', 'staged authority')); await git(input.root, ['add', owned]);
  await writeFile(path.join(input.root, owned), old.replace('user', 'unstaged authority'));
  const transaction = await preparePublication({ ...input, change: 'owned-change', materializedAuthority: { tree: synchronized, paths: [owned] } });
  await publishPublication(input.root, transaction);
  assert.match(await git(input.root, ['show', `:${owned}`]), /^final[\s\S]*staged authority$/);
  assert.match(await readFile(path.join(input.root, owned), 'utf8'), /^final[\s\S]*unstaged authority\n$/);
});
