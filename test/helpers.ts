import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { git, rootIdentity } from '../src/index/index.ts';

export async function fixture(files: Record<string, string> = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'projector-test-'));
  const root = path.join(directory, 'repository'); await mkdir(root);
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'user.email', 'test@localhost']); await git(root, ['config', 'user.name', 'Projector test']);
  for (const [file, source] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), source); }
  await git(root, ['add', '--all']); await git(root, ['commit', '--allow-empty', '-m', 'Fixture baseline']);
  const revision = (await git(root, ['rev-parse', 'HEAD'])).trim();
  return { directory, root, revision, cleanup: () => rm(directory, { recursive: true, force: true, maxRetries: 3 }),
    async candidate() {
      const candidate = path.join(directory, 'candidate'); await git(root, ['worktree', 'add', '-b', 'candidate', candidate]);
      const identity = await rootIdentity(candidate);
      await writeFile(path.join(identity.gitDir, 'projector-candidate.json'), JSON.stringify({ version: 1, candidate: 'fixture', root: identity.root, baseline: revision, writerContract: 'acknowledged-batches' }));
      return identity.root;
    }
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
