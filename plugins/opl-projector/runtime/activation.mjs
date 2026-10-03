import fs from 'node:fs/promises';
import path from 'node:path';

function markerPath(root) {
  return path.join(root, '.projector', 'active');
}

async function statIfPresent(file) {
  try {
    return await fs.stat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function isGitBoundary(root) {
  const entry = await statIfPresent(path.join(root, '.git'));
  return entry?.isFile() || entry?.isDirectory() || false;
}

export async function activeRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if ((await statIfPresent(markerPath(current)))?.isFile()) return current;
    if (await isGitBoundary(current)) return undefined;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export async function projectRoot(start) {
  const original = path.resolve(start);
  const active = await activeRoot(original);
  if (active) return active;
  let current = original;
  while (true) {
    if (await isGitBoundary(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return original;
    current = parent;
  }
}

export async function activate(root) {
  const resolved = path.resolve(root);
  const marker = markerPath(resolved);
  await fs.mkdir(path.dirname(marker), { recursive: true });
  await fs.writeFile(marker, '');
  return { status: 'active', root: resolved, marker };
}

export async function deactivate(root) {
  const resolved = path.resolve(root);
  const marker = markerPath(resolved);
  try {
    await fs.unlink(marker);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { status: 'inactive', root: resolved, marker };
}

export async function activationStatus(start) {
  const active = await activeRoot(start);
  const root = active ?? await projectRoot(start);
  return { status: active ? 'active' : 'inactive', root, marker: markerPath(root) };
}

export function inactive(root) {
  return {
    status: 'inactive',
    root: path.resolve(root),
    instruction: 'Activate this project with $opl-projector:enable-projector before using Projector.',
  };
}
