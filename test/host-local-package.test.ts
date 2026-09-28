import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('declared local marketplace bundle has a runnable MCP entry', { timeout: 120000 }, async () => {
  await execute(process.execPath, ['scripts/prepare-local.mjs'], { cwd: root, windowsHide: true });
  const marketplace = JSON.parse(await readFile(resolve(root, '.agents/plugins/marketplace.json'), 'utf8'));
  const packageVersion = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
  const source = marketplace.plugins.find((plugin: { name: string }) => plugin.name === 'projector').source.path;
  const bundle = resolve(root, source);
  const mcp = JSON.parse(await readFile(resolve(bundle, 'mcp.json'), 'utf8')).mcpServers.projector;
  assert.equal(mcp.type, 'stdio');
  assert.equal(mcp.command, 'node');
  const [entry, operation] = mcp.args.map((arg: string) => arg.replaceAll('${PLUGIN_ROOT}', bundle));
  await access(entry);
  assert.equal(operation, 'relay');
  const { stdout } = await execute(process.execPath, [entry, '--version'], { cwd: bundle, windowsHide: true });
  assert.equal(stdout.trim(), `projector ${packageVersion}`);
});
