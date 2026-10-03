import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { activate, deactivate, activeRoot, projectRoot, activationStatus, inactive } from '../plugins/opl-projector/runtime/activation.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projector-activation-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

const hook = fileURLToPath(new URL('../plugins/opl-projector/hooks/projector-context.mjs', import.meta.url));
function runHook(input, script = hook) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

test('activation resolves the nearest marker and deactivation preserves stored project data', async t => {
  const root = await fixture(t);
  const child = path.join(root, 'src', 'feature');
  await fs.mkdir(child, { recursive: true });
  assert.equal(await activeRoot(child), undefined);
  assert.equal(await projectRoot(child), child);
  const result = await activate(root);
  assert.equal(result.root, root);
  assert.equal(await fs.readFile(result.marker, 'utf8'), '');
  assert.equal(await activeRoot(child), root);
  assert.equal(await projectRoot(child), root);
  for (const folder of ['meaning', 'checkpoints', 'cache']) {
    await fs.mkdir(path.join(root, '.projector', folder));
    await fs.writeFile(path.join(root, '.projector', folder, 'keep'), folder);
  }
  await activate(path.join(root, 'src'));
  assert.equal(await activeRoot(child), path.join(root, 'src'));
  await deactivate(path.join(root, 'src'));
  assert.equal(await activeRoot(child), root);
  await deactivate(root);
  await deactivate(root);
  assert.equal((await activationStatus(child)).status, 'inactive');
  for (const folder of ['meaning', 'checkpoints', 'cache']) {
    assert.equal(await fs.readFile(path.join(root, '.projector', folder, 'keep'), 'utf8'), folder);
  }
  assert.equal(inactive(child).root, child);
});

test('Git directories and worktree files stop activation from leaking into another repository', async t => {
  const root = await fixture(t);
  await activate(root);
  for (const kind of ['directory', 'file']) {
    const nested = path.join(root, kind);
    const child = path.join(nested, 'src');
    await fs.mkdir(child, { recursive: true });
    if (kind === 'directory') await fs.mkdir(path.join(nested, '.git'));
    else await fs.writeFile(path.join(nested, '.git'), 'gitdir: ../worktree');
    assert.equal(await activeRoot(child), undefined);
    assert.equal(await projectRoot(child), nested);
    const status = await activationStatus(child);
    assert.equal(status.status, 'inactive');
    assert.equal(status.root, nested);
    await activate(nested);
    assert.equal(await activeRoot(child), nested);
    assert.equal((await activationStatus(child)).status, 'active');
    await deactivate(nested);
    assert.equal(await activeRoot(child), undefined);
  }
});

test('a directory at the marker path is inactive and mutation errors surface', async t => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, '.projector', 'active'), { recursive: true });
  assert.equal(await activeRoot(root), undefined);
  await assert.rejects(activate(root));
  await assert.rejects(deactivate(root));
  await assert.rejects(activeRoot(path.join(root, '\0')), { code: 'ERR_INVALID_ARG_VALUE' });
});

test('active hooks emit root and consumer guidance for both events; inactive hooks emit nothing', async t => {
  const root = await fixture(t);
  const child = path.join(root, 'src');
  await fs.mkdir(child);
  const guidance = await fs.readFile(new URL('../plugins/opl-projector/AGENTS.md', import.meta.url), 'utf8');
  for (const event of ['SessionStart', 'UserPromptSubmit']) {
    const off = await runHook({ cwd: child, hook_event_name: event });
    assert.equal(off.code, 0, off.stderr);
    assert.equal(off.stdout, '');
  }
  await activate(root);
  for (const event of ['SessionStart', 'UserPromptSubmit']) {
    const on = await runHook({ cwd: child, hook_event_name: event });
    assert.equal(on.code, 0, on.stderr);
    const output = JSON.parse(on.stdout).hookSpecificOutput;
    assert.equal(output.hookEventName, event);
    assert.ok(output.additionalContext.includes(JSON.stringify(root)));
    assert.ok(output.additionalContext.includes(guidance));
  }
  const nested = path.join(child, 'unrelated');
  await fs.mkdir(path.join(nested, '.git'), { recursive: true });
  const boundary = await runHook({ cwd: nested, event: 'UserPromptSubmit' });
  assert.equal(boundary.code, 0, boundary.stderr);
  assert.equal(boundary.stdout, '');
});

test('inactive hooks do not read consumer guidance; active hook failures surface', async t => {
  const root = await fixture(t);
  const plugin = path.join(root, 'plugin');
  await fs.mkdir(path.join(plugin, 'hooks'), { recursive: true });
  await fs.mkdir(path.join(plugin, 'runtime'));
  await fs.copyFile(hook, path.join(plugin, 'hooks', 'projector-context.mjs'));
  await fs.copyFile(new URL('../plugins/opl-projector/runtime/activation.mjs', import.meta.url), path.join(plugin, 'runtime', 'activation.mjs'));
  const script = path.join(plugin, 'hooks', 'projector-context.mjs');
  const project = path.join(root, 'project');
  await fs.mkdir(project);
  const off = await runHook({ cwd: project, event: 'SessionStart' }, script);
  assert.equal(off.code, 0, off.stderr);
  assert.equal(off.stdout, '');
  await activate(project);
  const on = await runHook({ cwd: project, event: 'SessionStart' }, script);
  assert.notEqual(on.code, 0);
  assert.match(on.stderr, /ENOENT/);
  assert.equal(on.stdout, '');
});
