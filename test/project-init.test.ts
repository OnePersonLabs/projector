import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initProject } from '../src/host/index.ts';
import { applyDesignDelta, parseDesignDelta } from '../src/documents/index.ts';
import { fixture } from './helpers.ts';

test('legitimate no-delta refactor has available concrete task instructions without a fabricated design', async t => {
  const project = await fixture({
    'openspec/changes/refactor-only/.openspec.yaml': 'schema: projector\nskip_specs: true\n',
    'openspec/changes/refactor-only/proposal.md': '# Simplify module loading\n\nPreserve current observable behavior.\n',
  });
  t.after(project.cleanup);
  await initProject({ root: project.root });
  const cli = fileURLToPath(new URL('../node_modules/@fission-ai/openspec/bin/openspec.js', import.meta.url));
  const result = await promisify(execFile)(process.execPath, [cli, 'status', '--change', 'refactor-only', '--json'], { cwd: project.root, windowsHide: true });
  const status = JSON.parse(result.stdout) as { artifacts: { id: string; status: string }[] };
  assert.equal(status.artifacts.find(item => item.id === 'tasks')?.status, 'ready');
  await assert.rejects(access(join(project.root, 'openspec/changes/refactor-only/designs')), { code: 'ENOENT' });
});

test('known stock task template upgrades while a customization prevents all upgrades', async t => {
  const oldTasks = '# Implementation tasks\n\n## Change and verify\n\n- [ ] implement: Apply the reviewed decisions within their scopes and verify their changed contracts.\n- [ ] reconcile: Account for previous contributions and verify removal of obsolete consumers, registrations, dependencies, and routes.\n- [ ] evidence: Execute the required checks, obtain independent review for material choices, and verify the settled result.\n';
  const project = await fixture({ 'openspec/schemas/projector/templates/tasks.md': oldTasks });
  t.after(project.cleanup);
  const result = await initProject({ root: project.root });
  assert.equal(result.ready, true);
  assert.deepEqual(result.upgraded, ['openspec/schemas/projector/templates/tasks.md']);
  assert.equal(await readFile(join(project.root, 'openspec/schemas/projector/templates/tasks.md'), 'utf8'), '# Implementation tasks\n');
  await writeFile(join(project.root, 'openspec/schemas/projector/templates/tasks.md'), oldTasks);
  await writeFile(join(project.root, 'openspec/schemas/projector/schema.yaml'), 'name: custom\n');
  const conflict = await initProject({ root: project.root });
  assert.equal(conflict.ready, false);
  assert.equal(await readFile(join(project.root, 'openspec/schemas/projector/templates/tasks.md'), 'utf8'), oldTasks);
  await writeFile(join(project.root, 'openspec/schemas/projector/templates/tasks.md'), '# My custom tasks\n');
  assert.equal((await initProject({ root: project.root })).ready, false);
});

test('installed schema setup preserves existing configuration and is repeatable', async t => {
  const project = await fixture({ 'openspec/config.yml': 'schema: spec-driven\ncontext: Keep this context\n', 'openspec/specs/old/spec.md': '# Existing requirements\n', '.gitignore': 'build/\n' });
  t.after(project.cleanup);
  const result = await initProject({ root: project.root });
  assert.equal(result.ready, true);
  assert.equal(result.configuredSchema, 'spec-driven');
  assert.equal(await readFile(join(project.root, 'openspec/config.yml'), 'utf8'), 'schema: spec-driven\ncontext: Keep this context\n');
  await assert.rejects(access(join(project.root, 'openspec/config.yaml')), { code: 'ENOENT' });
  assert.equal(await readFile(join(project.root, 'openspec/specs/old/spec.md'), 'utf8'), '# Existing requirements\n');
  assert.equal(await readFile(join(project.root, '.gitignore'), 'utf8'), 'build/\n.worktrees/\n');
  assert.deepEqual((await initProject({ root: project.root })).created, []);
});

test('schema conflict is reported before any scaffolding is written', async t => {
  const project = await fixture({ 'openspec/schemas/projector/schema.yaml': 'name: customized\n' });
  t.after(project.cleanup);
  const result = await initProject({ root: project.root });
  assert.equal(result.ready, false);
  assert.deepEqual(result.conflicts, ['openspec/schemas/projector/schema.yaml']);
  await assert.rejects(access(join(project.root, 'openspec/config.yaml')), { code: 'ENOENT' });
  await assert.rejects(access(join(project.root, '.gitignore')), { code: 'ENOENT' });
});

test('fresh setup creates a ready local schema and concurrent repeats settle', async t => {
  const project = await fixture();
  t.after(project.cleanup);
  const results = await Promise.all([initProject({ root: project.root }), initProject({ root: project.root })]);
  assert.ok(results.every(result => result.ready === true));
  assert.equal(results.filter(result => (result.created as string[]).length === 0).length, 1);
  assert.equal(await readFile(join(project.root, 'openspec/config.yaml'), 'utf8'), 'schema: projector\n');
  const template = await readFile(join(project.root, 'openspec/schemas/projector/templates/design.md'), 'utf8');
  const created = applyDesignDelta('', parseDesignDelta('design.md', template));
  assert.equal(created.status, 'applied', JSON.stringify(created.diagnostics));
  assert.match(created.source, /projectorDesign: 1/);
  for (const directory of ['specs', 'designs', 'changes/archive']) await access(join(project.root, 'openspec', directory));
});

test('setup rejects invalid configuration and external directory links without writes', async t => {
  const project = await fixture({ 'openspec/config.yaml': 'schema: [\n' });
  t.after(project.cleanup);
  await assert.rejects(initProject({ root: project.root }), /Invalid openspec/);
  await writeFile(join(project.root, 'openspec/config.yaml'), 'store: shared\n');
  await assert.rejects(initProject({ root: project.root }), /OpenSpec store/);
  await writeFile(join(project.root, 'openspec/config.yaml'), 'schema: projector\n');
  const outside = join(project.directory, 'outside');
  await mkdir(outside);
  await symlink(outside, join(project.root, 'openspec/schemas'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(initProject({ root: project.root }), /symbolic links/);
  await assert.rejects(access(join(outside, 'projector')), { code: 'ENOENT' });
});
