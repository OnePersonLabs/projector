import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discover } from '../plugins/opl-projector/runtime/state.mjs';

async function fixture(t, files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v5-discovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), 'source');
  }
  return root;
}

test('deeply nested brace patterns cannot exhaust the parser stack', async t => {
  const root = await fixture(t, ['src/a.ts']);
  // This input reaches the old recursive walker before its character limit.
  const nested = '{'.repeat(4900) + 'a,b' + '}'.repeat(4900);
  try { assert.deepEqual(await discover(root, [nested, 'src/a.ts']), ['src/a.ts']); }
  catch (error) {
    // Some filesystems reject the remaining literal path instead of reporting
    // it missing. Preserve that explicit error rather than hiding a scan failure.
    assert.equal(error.code, 'ENAMETOOLONG');
  }
  assert.deepEqual(await discover(root, ['src/a.ts']), ['src/a.ts']);
});

test('discovery preserves file populations, glob syntax, exclusions, and path formatting', async t => {
  const root = await fixture(t, [
    'src/a.ts', 'src/b.tsx', 'src/10.ts', 'src/20.ts', 'src/.hidden.ts',
    'src/nested/c.ts', 'src/skip/c.ts', '.projector/meaning/current.md',
    '.projector/meaning/archive/old.md', '.projector/cache/receipt.json',
    '.projector/work/directive.md', '.git/config', 'vendor/.git/config',
    'node_modules/package/source.ts', 'vendor/node_modules/package/source.ts'
  ]);
  assert.deepEqual(await discover(root, ['src/**', 'src/a.ts', '!src/skip/**']), [
    'src/.hidden.ts', 'src/10.ts', 'src/20.ts', 'src/a.ts', 'src/b.tsx', 'src/nested/c.ts'
  ]);
  assert.deepEqual(await discover(root, ['src/*.{ts,tsx}']), [
    'src/.hidden.ts', 'src/10.ts', 'src/20.ts', 'src/a.ts', 'src/b.tsx'
  ]);
  assert.deepEqual(await discover(root, ['src/{10..20..10}.ts']), ['src/10.ts', 'src/20.ts']);
  assert.deepEqual(await discover(root, ['src/@(a|b).{ts,tsx}']), ['src/a.ts', 'src/b.tsx']);
  assert.deepEqual(await discover(root, ['**/*', '!src/**', '!.projector/meaning/archive/**']), [
    '.projector/meaning/current.md'
  ]);
  assert.deepEqual(await discover(root, ['src']), []);
  assert.deepEqual(await discover(root, ['missing/**']), []);
  assert.deepEqual(await discover(root, ['!src/**']), []);
  assert.deepEqual(await discover(root, []), []);
});

test('a filesystem failure is an error rather than an incomplete population', async t => {
  const root = await fixture(t, ['src/a.ts', 'blocked/b.ts']);
  const nativeRead = fs.readdir;
  const denied = Object.assign(new Error('Cannot scan blocked directory'), { code: 'EACCES' });
  fs.readdir = async (target, ...args) => {
    if (path.resolve(target) === path.join(root, 'blocked')) throw denied;
    return nativeRead(target, ...args);
  };
  try { await assert.rejects(discover(root, ['**/*']), error => error === denied); }
  finally { fs.readdir = nativeRead; }
});

test('discovery excludes symbolic links and retains project confinement', async t => {
  const root = await fixture(t, ['src/a.ts']);
  const outside = await fixture(t, ['secret.ts']);
  await fs.symlink(path.join(root, 'src'), path.join(root, 'alias'), 'junction');
  await fs.symlink(outside, path.join(root, 'escape'), 'junction');
  assert.deepEqual(await discover(root, ['**/*']), ['src/a.ts']);
  await assert.rejects(discover(root, ['escape/*.ts']), /Symlink escapes project/);
  for (const pattern of ['../*.ts', '/absolute/*.ts', 'C:/absolute/*.ts']) {
    await assert.rejects(discover(root, [pattern]), /remain inside the project/);
  }
});
