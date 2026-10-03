import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'plugins', 'opl-projector');
const build = path.join(root, '.plugin-build');
const destination = path.join(build, 'opl-projector');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this preparation through npm run plugin:prepare-local.');
const npmEnvironment = { ...process.env };
// npm run serializes user policy into environment flags. npm 12 rejects those
// flags for a nested project install. These commands disable all scripts and
// let npm read the original package/.npmrc policy from its normal sources.
for (const key of Object.keys(npmEnvironment)) {
  if (key.toLowerCase().replaceAll('_', '-').startsWith('npm-config-allow-scripts')) delete npmEnvironment[key];
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root, windowsHide: true, encoding: 'utf8',
    env: npmEnvironment,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
  return result.stdout;
}

// npm owns the portable dependency closure; the installer copies this bundle.
run(process.execPath, [npm, 'ci', '--prefix', source, '--ignore-scripts']);
await fs.mkdir(build, { recursive: true });
const stage = await fs.mkdtemp(path.join(build, 'prepare-'));
try {
  const result = JSON.parse(run(process.execPath, [npm, 'pack', source, '--ignore-scripts', '--json', '--pack-destination', stage], true));
  // npm 12 keys JSON by package name; earlier versions return an array.
  const packed = Array.isArray(result) ? result[0] : result['opl-projector'];
  if (packed?.name !== 'opl-projector' || typeof packed.filename !== 'string' || path.basename(packed.filename) !== packed.filename) throw new Error('npm pack did not return the expected plugin archive.');
  const unpacked = path.join(stage, 'package');
  run('tar', ['-xzf', path.join(stage, packed.filename), '-C', stage]);
  const manifest = JSON.parse(await fs.readFile(path.join(unpacked, '.codex-plugin', 'plugin.json'), 'utf8'));
  if (manifest.name !== 'opl-projector') throw new Error('Prepared bundle has the wrong plugin identity.');
  // Both removal targets are fixed descendants of this checkout's build directory.
  if (await fs.realpath(build) !== build || path.dirname(destination) !== build || path.dirname(stage) !== build) throw new Error('Build cleanup escaped its workspace.');
  await fs.rm(destination, { recursive: true, force: true });
  await fs.rename(unpacked, destination);
  console.log(`Prepared ${manifest.name}@${manifest.version} at ${destination}`);
} finally {
  if (path.dirname(stage) !== build) throw new Error('Staging cleanup escaped its workspace.');
  await fs.rm(stage, { recursive: true, force: true });
}
