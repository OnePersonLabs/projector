import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const execute = promisify(execFile);
export async function git(root: string, args: string[]): Promise<string> {
  const options = process.platform === 'win32' ? ['-c', 'core.longPaths=true'] : [];
  const { stdout } = await execute('git', [...options, '-C', root, ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
  return stdout;
}
export const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export function safePath(value: string): string {
  if (!value || value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value) || value.split('/').some(p => p === '..' || p === '.' || !p) || /^[A-Za-z]:/.test(value)) {
    throw new Error(`Invalid repository-relative path: ${value}`);
  }
  return value;
}
export async function rootIdentity(input: string): Promise<{ root: string; gitDir: string; id: string; incarnation: string }> {
  const root = await realpath((await git(input, ['rev-parse', '--show-toplevel'])).trim());
  const gitDir = await realpath((await git(root, ['rev-parse', '--absolute-git-dir'])).trim());
  const [rootStat, gitStat] = await Promise.all([stat(root), stat(gitDir)]);
  const id = hash(`${root}\0${gitDir}`);
  return { root, gitDir, id, incarnation: hash(`${id}:${rootStat.dev}:${rootStat.ino}:${rootStat.birthtimeMs}:${gitStat.ino}:${gitStat.birthtimeMs}`) };
}
