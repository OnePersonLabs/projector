import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
// Use the public unbundled entrypoint so the locked parser dependencies apply.
// Glob's minified entrypoint embeds an older brace-expansion implementation.
import { glob, Ignore } from 'glob/raw';

export const hash = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const slash = value => value.replaceAll('\\', '/');
const inside = (root, target) => target === root || (!path.relative(root, target).startsWith('..' + path.sep) && path.relative(root, target) !== '..' && !path.isAbsolute(path.relative(root, target)));

export async function projectPath(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[a-z]:/i.test(relative)) throw new Error(`Expected a project-relative path: ${relative}`);
  const base = await fs.realpath(root);
  const target = path.resolve(base, relative);
  if (!inside(base, target)) throw new Error(`Path escapes project: ${relative}`);
  let existing = target;
  while (true) {
    try {
      const resolved = await fs.realpath(existing);
      if (!inside(base, resolved)) throw new Error(`Symlink escapes project: ${relative}`);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      existing = parent;
    }
  }
  return target;
}

export async function captureInputs(root, paths) {
  const inputs = [];
  for (const relative of [...new Set(paths)].sort()) {
    const target = await projectPath(root, relative);
    let digest;
    try { digest = hash(await fs.readFile(target)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; digest = null; }
    inputs.push({ path: slash(relative), hash: digest });
  }
  return inputs;
}

// Ownership follows the actual file or nearest existing parent, including an
// internal junction whose eventual output does not exist yet.
export async function physicalProjectPath(root, relative) {
  const target = await projectPath(root, relative);
  let existing = target;
  while (true) {
    try { return path.resolve(await fs.realpath(existing), path.relative(existing, target)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; existing = path.dirname(existing); }
  }
}

export async function discover(root, patterns) {
  if (!Array.isArray(patterns) || patterns.some(p => typeof p !== 'string' || path.isAbsolute(p) || /^[a-z]:/i.test(p) || p.split(/[\\/]/).includes('..'))) throw new Error('Discovery patterns must remain inside the project');
  const isExclusion = pattern => pattern.startsWith('!') && !pattern.startsWith('!(');
  const ignore = new Ignore([
    ...patterns.filter(isExclusion).map(pattern => pattern.slice(1)),
    '**/.git/**', '**/node_modules/**', '.projector/cache/**', '.projector/work/**'
  ], { dot: true, nocase: false });

  // Glob treats filesystem errors as missing paths. Retain non-ENOENT errors
  // through its public adapter so a partial scan cannot become an empty verdict.
  let scanError;
  const observedFs = Object.fromEntries(['lstat', 'readdir', 'readlink', 'realpath'].map(operation => [operation, async (...args) => {
    try { return await fs[operation](...args); }
    catch (error) {
      if (error.code !== 'ENOENT') scanError ??= error;
      throw error;
    }
  }]));
  const files = await glob(patterns.filter(pattern => !isExclusion(pattern)), {
    cwd: root, dot: true, nodir: true, follow: false, nocase: false,
    ignore: {
      ignored: entry => (!entry.isUnknown() && !entry.isFile()) || ignore.ignored(entry),
      childrenIgnored: entry => entry.isSymbolicLink() || ignore.childrenIgnored(entry)
    },
    fs: {
      promises: observedFs,
      readdir: (target, options, callback) => observedFs.readdir(target, options).then(
        entries => callback(null, entries), error => callback(error)
      )
    }
  });
  if (scanError) throw scanError;
  for (const file of files) await projectPath(root, file);
  return files.map(slash).sort();
}

export async function captureScope(root, patterns, extraPaths = []) {
  const inputs = await captureInputs(root, [...await discover(root, patterns), ...extraPaths]);
  return { patterns, inputs, fingerprint: hash({ patterns, inputs }) };
}

export async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, text, { flag: 'wx' });
  try { await fs.rename(temp, file); }
  catch (error) { await fs.unlink(temp); throw error; }
}
export async function writeJson(file, value) { await writeText(file, JSON.stringify(value, null, 2) + '\n'); }
export async function optionalJson(file) { try { return await readJson(file); } catch (error) { if (error.code !== 'ENOENT') throw error; return null; } }
