import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, copyFile, rm, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { applyDesignDelta, extractFile, parseDesignDelta } from '../documents/index.ts';
import { digest, exists, files, git, run, runGit, safePath, textFile } from './io.ts';
import type { ChangeServiceOptions, Support } from './types.ts';

const schemaRoot = fileURLToPath(new URL('../../openspec/schemas/projector/', import.meta.url));
export class OpenSpecAdapter {
  private entry: string;
  constructor(options: ChangeServiceOptions) {
    const packageRoot = path.resolve(path.dirname(createRequire(import.meta.url).resolve('@fission-ai/openspec')), '..');
    this.entry = options.openspecEntry ?? path.join(packageRoot, 'bin/openspec.js');
  }
  async invoke(root: string, args: string[]): Promise<Record<string, unknown>> {
    const result = await run(process.execPath, [this.entry, ...args], root);
    try { return JSON.parse(result.stdout) as Record<string, unknown>; }
    catch { throw new Error(`OpenSpec returned invalid JSON for ${args[0]}`); }
  }
  async version(root: string): Promise<void> {
    const version = (await run(process.execPath, [this.entry, '--version'], root)).stdout.trim();
    if (version !== '1.13.1') throw new Error(`OpenSpec 1.13.1 is required; found ${version}`);
  }
  async copyInputs(source: string, destination: string, change: string): Promise<void> {
    const from = safePath(source, `openspec/changes/${change}`);
    for (const name of await files(from)) {
      if (name === 'implementation-state.json') continue;
      const to = safePath(destination, `openspec/changes/${change}/${name}`);
      await mkdir(path.dirname(to), { recursive: true }); await copyFile(safePath(from, name), to);
    }
    for (const name of await files(schemaRoot)) {
      const to = safePath(destination, `openspec/schemas/projector/${name}`);
      // Provision the bundle in fresh target staging, but preserve repository-owned candidate schema edits.
      if (await exists(to)) continue;
      await mkdir(path.dirname(to), { recursive: true }); await copyFile(safePath(schemaRoot, name), to);
    }
    const config = safePath(destination, 'openspec/config.yaml');
    if (!await exists(config) && !await exists(safePath(destination, 'openspec/config.yml'))) await writeFile(config, 'schema: projector\n');
    const metadata = safePath(destination, `openspec/changes/${change}/.openspec.yaml`);
    const value = await exists(metadata) ? parse(await textFile(metadata)) as Record<string, unknown> : {};
    await writeFile(metadata, stringify({ ...value, schema: 'projector' }));
  }
  async inputHash(root: string, change: string): Promise<string> {
    const from = safePath(root, `openspec/changes/${change}`);
    const values: string[] = [];
    for (const name of await files(from)) {
      if (name === 'implementation-state.json' || name === 'tasks.md') continue;
      values.push(name, digest(await textFile(safePath(from, name))));
    }
    return digest(JSON.stringify(values));
  }
  async target(root: string, change: string, baseline: string, previousTarget?: string): Promise<{ targetId: string; previousSupport: Support[]; requirements: string[]; renames: Record<string, string> }> {
    await this.version(root);
    const temporary = safePath(root, `.worktrees/projector-target-${randomUUID()}`);
    await mkdir(temporary, { recursive: true });
    try {
      const originalPaths = (await git(root, ['ls-tree', '-r', '--name-only', baseline, '--', 'openspec/specs', 'openspec/designs', 'openspec/terms', 'openspec/config.yaml', 'openspec/config.yml'])).split('\n').filter(Boolean);
      for (const name of originalPaths) {
        const to = safePath(temporary, name); await mkdir(path.dirname(to), { recursive: true });
        await writeFile(to, (await runGit(['show', `${baseline}:${name}`], root)).stdout);
      }
      await this.copyInputs(root, temporary, change);
      const status = await this.invoke(temporary, ['status', '--change', change, '--json']);
      if (status.schemaName !== 'projector') throw new Error('Projector custom schema was not selected');
      await this.invoke(temporary, ['validate', change, '--strict', '--json']);
      const requirements: string[] = [];
      for (const name of await files(safePath(temporary, `openspec/changes/${change}/specs`))) {
        if (!name.endsWith('/spec.md') && name !== 'spec.md') continue;
        const relative = `openspec/changes/${change}/specs/${name}`;
        const record = extractFile(relative, await textFile(safePath(temporary, relative)));
        requirements.push(...record.units.filter(unit => unit.kind === 'requirement').map(unit => unit.address));
      }
      const renames = await this.applyDesigns(temporary, change);
      await this.invoke(temporary, ['archive', change, '--yes', '--json']);
      const targetFiles = (await files(safePath(temporary, 'openspec/specs'))).map(name => `openspec/specs/${name}`)
        .concat((await files(safePath(temporary, 'openspec/designs'))).map(name => `openspec/designs/${name}`));
      const index = safePath(temporary, 'git-index'); const environment = { GIT_INDEX_FILE: index };
      await git(root, ['read-tree', baseline], { env: environment });
      for (const removed of originalPaths.filter(name => /openspec\/(specs|designs)\//.test(name) && !targetFiles.includes(name))) {
        await git(root, ['update-index', '--force-remove', '--', removed], { env: environment });
      }
      for (const name of targetFiles) {
        const hash = await git(root, ['hash-object', '-w', '--stdin'], { input: await textFile(safePath(temporary, name)) });
        await git(root, ['update-index', '--add', '--cacheinfo', `100644,${hash},${name}`], { env: environment });
      }
      const tree = await git(root, ['write-tree'], { env: environment });
      let targetId = previousTarget;
      if (!previousTarget || tree !== await git(root, ['rev-parse', `${previousTarget}^{tree}`])) {
        targetId = await git(root, ['commit-tree', tree, '-p', baseline, '-m', `Projector target: ${change}`], { env: {
          GIT_AUTHOR_NAME: 'Projector', GIT_AUTHOR_EMAIL: 'projector@localhost', GIT_COMMITTER_NAME: 'Projector', GIT_COMMITTER_EMAIL: 'projector@localhost'
        } });
      }
      return { targetId: targetId!, previousSupport: await this.support(root, previousTarget ?? baseline), requirements: [...new Set(requirements)], renames };
    } finally {
      // This directory is allocated above, and containment is rechecked before removal.
      const owned = safePath(root, path.relative(root, temporary));
      if (path.dirname(owned) !== path.join(root, '.worktrees')) throw new Error('Target staging containment failed');
      await rm(owned, { recursive: true, force: true });
    }
  }
  async applyDesigns(root: string, change: string): Promise<Record<string, string>> {
    const renames: Record<string, string> = {};
    const designRoot = safePath(root, `openspec/changes/${change}/designs`);
    for (const name of await files(designRoot)) {
      if (!name.endsWith('design.md')) continue;
      const target = safePath(root, `openspec/designs/${name}`);
      const old = await exists(target) ? await textFile(target) : undefined;
      const delta = await textFile(safePath(designRoot, name));
      const result = applyDesignDelta(old ?? '', parseDesignDelta(`openspec/changes/${change}/designs/${name}`, delta), { path: `openspec/designs/${name}` });
      if (result.diagnostics.length) throw new Error(`Design delta rejected: ${result.diagnostics.map(item => item.message).join('; ')}`);
      Object.assign(renames, result.renames);
      if (result.source === '') { if (await exists(target)) await unlink(target); }
      else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, result.source); }
    }
    return renames;
  }
  async support(root: string, revision: string): Promise<Support[]> {
    const result: Support[] = [];
    const paths = (await git(root, ['ls-tree', '-r', '--name-only', revision, '--', 'openspec/designs'])).split('\n').filter(name => name.endsWith('design.md'));
    for (const name of paths) {
      const record = extractFile(name, (await runGit(['show', `${revision}:${name}`], root)).stdout);
      for (const unit of record.units.filter(unit => unit.kind === 'part')) {
        const fields = unit.data?.fields as Record<string, string[]> | undefined;
        for (const value of fields?.realizes ?? []) for (const reference of value.matchAll(/\[\[(code:([^\]#]+)(?:#[^\]]*)?)\]\]/g)) {
          result.push({ path: decodeURIComponent(reference[2]!), decision: unit.address, basis: unit.bodyHash, target: reference[1]! });
        }
      }
    }
    return result;
  }
}
