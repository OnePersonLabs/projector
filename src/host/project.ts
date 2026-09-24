import { mkdir, readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const execute = promisify(execFile);
const schemaRoot = fileURLToPath(new URL('../../openspec/schemas/projector/', import.meta.url));
const schemaFiles = ['schema.yaml', 'templates/proposal.md', 'templates/spec.md', 'templates/design.md', 'templates/tasks.md'];
const queues = new Map<string, Promise<unknown>>();

async function inspect(root: string, name: string, directory: boolean): Promise<boolean> {
  const parts = name.split('/');
  for (let index = 1; index <= parts.length; index++) {
    const file = join(root, ...parts.slice(0, index));
    try {
      const info = await lstat(file);
      if (info.isSymbolicLink()) throw new Error(`Projector setup refuses symbolic links: ${file}`);
      if ((index < parts.length || directory) ? !info.isDirectory() : !info.isFile()) throw new Error(`Unexpected file type during setup: ${file}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  return true;
}

/** Add bundled workflow resources without replacing user-owned configuration. */
export async function initProject(input: { root: string }): Promise<Record<string, unknown>> {
  if (typeof input.root !== 'string' || !input.root.trim()) throw new Error('root must be a nonempty string');
  const root = await realpath(resolve(input.root));
  const top = await execute('git', ['rev-parse', '--show-toplevel'], { cwd: root, windowsHide: true });
  if (await realpath(top.stdout.trim()) !== root) throw new Error('Select the Git repository root for Projector setup');
  const previous = queues.get(root) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(() => initialize(root));
  queues.set(root, operation);
  try { return await operation; }
  finally { if (queues.get(root) === operation) queues.delete(root); }
}

async function initialize(root: string): Promise<Record<string, unknown>> {
  const directories = ['openspec', 'openspec/specs', 'openspec/designs', 'openspec/changes', 'openspec/changes/archive', 'openspec/schemas', 'openspec/schemas/projector', 'openspec/schemas/projector/templates'];
  for (const name of directories) await inspect(root, name, true);
  const pending = new Map<string, string>();
  const conflicts: string[] = [];
  for (const name of schemaFiles) {
    const destination = `openspec/schemas/projector/${name}`;
    const content = await readFile(join(schemaRoot, name), 'utf8');
    if (await inspect(root, destination, false)) {
      if (await readFile(join(root, destination), 'utf8') !== content) conflicts.push(destination);
    } else pending.set(destination, content);
  }
  const yaml = await inspect(root, 'openspec/config.yaml', false);
  const yml = await inspect(root, 'openspec/config.yml', false);
  const configPath = yaml ? 'openspec/config.yaml' : yml ? 'openspec/config.yml' : 'openspec/config.yaml';
  let configuredSchema: unknown = 'projector';
  if (yaml || yml) {
    const document = parseDocument(await readFile(join(root, configPath), 'utf8'));
    if (document.errors.length) throw new Error(`Invalid ${configPath}: ${document.errors.map(error => error.message).join('; ')}`);
    const config: unknown = document.toJS();
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`${configPath} must contain a YAML mapping`);
    const mapping = config as Record<string, unknown>;
    if (mapping.store !== undefined) throw new Error('This repository points to an OpenSpec store. Select its owning local Git repository explicitly; setup does not redirect or replace store configuration.');
    configuredSchema = mapping.schema ?? 'spec-driven';
  } else pending.set(configPath, 'schema: projector\n');
  if (conflicts.length) return { root, ready: false, conflicts, created: [], instruction: 'Existing Projector schema differs from the bundled schema. Review these files and preserve customizations before retrying setup.' };
  const ignoreExists = await inspect(root, '.gitignore', false);
  const ignore = ignoreExists ? await readFile(join(root, '.gitignore'), 'utf8') : '';
  const hasWorktrees = /^(?:\/)?\.worktrees\/(?:\r)?$/m.test(ignore);
  const created: string[] = [];
  for (const name of directories) {
    if (!await inspect(root, name, true)) { await mkdir(join(root, name), { recursive: true }); created.push(name + '/'); }
  }
  for (const [name, content] of pending) {
    const destination = resolve(root, name);
    const inside = relative(root, destination);
    if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('Setup destination escaped root');
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content, { flag: 'wx' });
    created.push(name);
  }
  if (!hasWorktrees) {
    // Preserve all existing text. Exclusive creation protects a concurrent new file.
    const suffix = (ignore && !ignore.endsWith('\n') ? '\n' : '') + '.worktrees/\n';
    if (ignoreExists) {
      if (await readFile(join(root, '.gitignore'), 'utf8') !== ignore) throw new Error('.gitignore changed during setup; retry after reviewing the concurrent edit');
      await writeFile(join(root, '.gitignore'), suffix, { flag: 'a' });
    } else await writeFile(join(root, '.gitignore'), suffix, { flag: 'wx' });
    created.push('.gitignore');
  }
  return { root, ready: true, created, conflicts: [], schema: 'projector', configuredSchema, instruction: 'Use the bundled projector schema explicitly for new Projector changes; existing configuration and history are preserved.' };
}
