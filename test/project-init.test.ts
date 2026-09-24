import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { initProject } from '../src/host/index.ts';
import { applyDesignDelta, parseDesignDelta } from '../src/documents/index.ts';
import { fixture } from './helpers.ts';

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
