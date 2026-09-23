import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, chmod, lstat, readdir } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

export const VERSION = '4.0.0';
export const PROTOCOL = 1;
export const MAX_BYTES = 1024 * 1024;
export interface HostSettings { home: string; port: number; timeoutMs: number; startupMs: number }
export function settings(overrides: Partial<HostSettings> = {}): HostSettings {
  const userHash = createHash('sha256').update(homedir()).digest().readUInt16BE();
  const value = {
    home: resolve(process.env.PROJECTOR_HOME ?? join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'projector')),
    port: Number(process.env.PROJECTOR_PORT ?? (42000 + userHash % 10000)),
    timeoutMs: 30000, startupMs: 15000, ...overrides,
  };
  if (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) throw new Error('PROJECTOR_PORT must be an integer from 1024 through 65535.');
  return value;
}
export async function privateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('Projector home must not be a symbolic link.');
  const entries = await readdir(directory);
  if (entries.length && !entries.includes('credential')) throw new Error('PROJECTOR_HOME must be an empty application directory or an existing Projector home.');
  if (process.platform === 'win32') {
    // Node chmod does not remove inherited Windows ACL entries. Replace the DACL
    // on this application directory before creating any credentials or databases.
    const script = '$ErrorActionPreference="Stop"; $p=$env:PROJECTOR_PRIVATE_DIRECTORY; $a=[System.Security.AccessControl.DirectorySecurity]::new(); $a.SetAccessRuleProtection($true,$false); $s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $a.SetOwner($s); $r=[System.Security.AccessControl.FileSystemAccessRule]::new($s,"FullControl","ContainerInherit,ObjectInherit","None","Allow"); $a.AddAccessRule($r); [System.IO.Directory]::SetAccessControl($p,$a)';
    await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, env: { ...process.env, PROJECTOR_PRIVATE_DIRECTORY: directory } });
  } else {
    await chmod(directory, 0o700);
    const stat = await lstat(directory);
    if (stat.uid !== userInfo().uid || (stat.mode & 0o077) !== 0) throw new Error('Projector home must be private and owned by the current user.');
  }
}
export async function ownerCredential(config: HostSettings): Promise<string> {
  await privateDirectory(config.home);
  const path = join(config.home, 'credential');
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Projector credential must not be a symbolic link.');
    if (process.platform !== 'win32') await chmod(path, 0o600);
    const token = (await readFile(path, 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Projector credential is invalid; inspect the private Projector home.');
    return token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const token = randomBytes(32).toString('hex');
  await writeFile(path, token, { flag: 'wx', mode: 0o600 });
  return token;
}
export async function readCredential(config: HostSettings): Promise<string | undefined> {
  try { return (await readFile(join(config.home, 'credential'), 'utf8')).trim(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
export async function claimConfiguredEndpoint(config: HostSettings): Promise<void> {
  const path = join(config.home, 'endpoint.json');
  try { await writeFile(path, JSON.stringify({ port: config.port }), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  const endpoint = JSON.parse(await readFile(path, 'utf8')) as { port?: unknown };
  if (endpoint.port !== config.port) throw new Error(`This Projector home is configured for port ${String(endpoint.port)}; use that port or an explicitly separate Projector home.`);
  // This immutable routing configuration is not lifetime ownership. Only the
  // exclusive OS socket grants that; stale configuration never admits a second owner.
}
