import { cp, mkdir, readdir, access, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export async function install(destination: string): Promise<{ plugin: string; runtime: string }> {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const plugin = resolve(destination), runtime = join(plugin, 'runtime');
  if (plugin === packageRoot || plugin.startsWith(packageRoot + '\\') || plugin.startsWith(packageRoot + '/')) throw new Error('Install into a fresh directory outside the source package.');
  try { if ((await readdir(plugin)).length) throw new Error('Plugin destination must be empty; existing plugin installations are not overwritten.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await access(join(packageRoot, 'dist', 'host', 'cli.js'));
  await mkdir(runtime, { recursive: true });
  await cp(join(packageRoot, 'plugins', 'projector'), plugin, { recursive: true });
  await cp(join(packageRoot, 'dist'), join(runtime, 'dist'), { recursive: true });
  await cp(join(packageRoot, 'openspec', 'schemas'), join(runtime, 'openspec', 'schemas'), { recursive: true });
  await cp(join(packageRoot, 'package.json'), join(runtime, 'package.json'));
  await cp(join(packageRoot, 'package-lock.json'), join(runtime, 'package-lock.json'));
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  await access(npmCli);
  const installCache = join(runtime, '.npm-cache');
  const environment = { ...process.env };
  // npm 12 exports invocation policy to lifecycle children, then rejects that
  // CLI/env policy for a nested project-scoped install. This install already
  // prohibits every lifecycle script. Retain registry/auth/proxy/user settings.
  for (const key of Object.keys(environment)) if (key.toLowerCase() === 'npm_config_allow_scripts') delete environment[key];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', installCache], { cwd: runtime, env: environment, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let failure = ''; child.stderr.setEncoding('utf8'); child.stderr.on('data', (chunk: string) => { failure = (failure + chunk).slice(-8192); });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Installed dependency preparation failed (${code}): ${failure}`)));
  });
  await rm(installCache, { recursive: true, force: true });
  return { plugin, runtime };
}
