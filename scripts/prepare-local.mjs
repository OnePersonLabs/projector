import { cp, lstat, mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { install } from '../dist/host/install.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = join(root, '.plugin-build');
const bundle = join(buildRoot, 'projector');
const id = randomUUID();
const incoming = join(buildRoot, `.projector-incoming-${id}`);
const previous = join(buildRoot, `.projector-previous-${id}`);

function assertWithin(parent, target) {
  const path = relative(resolve(parent), resolve(target));
  if (!path || path === '..' || path.startsWith(`..${sep}`) || resolve(path) === path) {
    throw new Error(`Refusing recursive cleanup outside ${parent}: ${target}`);
  }
}

async function removeWithin(parent, target) {
  assertWithin(parent, target);
  await rm(target, { recursive: true, force: true });
}

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'projector-plugin-'));
let movedPrevious = false;
let published = false;
try {
  await install(join(temporaryRoot, 'plugin'));
  if (await exists(buildRoot)) {
    if (!(await lstat(buildRoot)).isDirectory()) throw new Error('Local plugin build path must be a directory.');
  } else await mkdir(buildRoot);
  await cp(join(temporaryRoot, 'plugin'), incoming, { recursive: true });
  if (await exists(bundle)) {
    await rename(bundle, previous);
    movedPrevious = true;
  }
  try {
    await rename(incoming, bundle);
    published = true;
  } catch (error) {
    if (movedPrevious) { await rename(previous, bundle); movedPrevious = false; }
    throw error;
  }
  if (movedPrevious) await removeWithin(buildRoot, previous);
} finally {
  if (!published) await removeWithin(buildRoot, incoming);
  await removeWithin(tmpdir(), temporaryRoot);
}
