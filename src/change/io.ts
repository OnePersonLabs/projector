import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
export function safePath(root: string, name: string): string {
  if (!name || path.isAbsolute(name) || /^[A-Za-z]:/.test(name) || name.includes('\0')) throw new Error(`Unsafe relative path: ${name}`);
  const result = path.resolve(root, name);
  const relative = path.relative(root, result);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path escapes selected root: ${name}`);
  return result;
}
export async function exists(file: string): Promise<boolean> {
  try { await lstat(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
export async function textFile(file: string): Promise<string> { return readFile(file, 'utf8'); }
export async function files(root: string): Promise<string[]> {
  if (!await exists(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are unsupported in change artifacts: ${path.join(root, entry.name)}`);
    if (entry.isDirectory()) result.push(...(await files(path.join(root, entry.name))).map(item => `${entry.name}/${item}`));
    else if (entry.isFile()) result.push(entry.name);
  }
  return result;
}
export async function atomicJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.new`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, file);
}
export interface ProcessResult { stdout: string; stderr: string; code: number | null; durationMs: number }
export async function run(command: string, args: string[], cwd: string, options: { input?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; allowFailure?: boolean } = {}): Promise<ProcessResult> {
  const started = performance.now();
  const result = await new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...options.env }, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; const errors: Buffer[] = [];
    let bytes = 0; let failure: Error | undefined;
    const timer = setTimeout(() => { failure = new Error(`Command timed out: ${command}`); child.kill(); }, options.timeoutMs ?? 60_000);
    const collect = (into: Buffer[]) => (data: Buffer) => {
      bytes += data.length;
      if (bytes > 2 * 1024 * 1024) { failure = new Error(`Command output exceeded 2 MiB: ${command}`); child.kill(); }
      else into.push(data);
    };
    child.stdout.on('data', collect(chunks)); child.stderr.on('data', collect(errors));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) return reject(failure);
      resolve({ stdout: Buffer.concat(chunks).toString('utf8'), stderr: Buffer.concat(errors).toString('utf8'), code, durationMs: performance.now() - started });
    });
    child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') failure = error; });
    child.stdin.end(options.input);
  });
  if (result.code !== 0 && !options.allowFailure) throw new Error(`${command} ${args.join(' ')} failed (${result.code}): ${result.stderr || result.stdout}`);
  return result;
}
export async function git(root: string, args: string[], options: Parameters<typeof run>[3] = {}): Promise<string> { return (await run('git', args, root, options)).stdout.trim(); }
export async function canonicalRoot(root: string): Promise<string> {
  const canonical = await realpath(root);
  const top = await realpath(await git(canonical, ['rev-parse', '--show-toplevel']));
  if (top !== canonical) throw new Error('root must be the selected repository or worktree root');
  return canonical;
}
// The host's OS-held endpoint establishes one process owner. Direct library users
// must provide that same single-owner boundary; a PID file is not an OS lock.
// The module-level queue also serializes separate ChangeService instances in it.
const changeQueues = new Map<string, Promise<void>>();
export async function exclusive<T>(root: string, change: string, operation: () => Promise<T>): Promise<T> {
  const key = `${root}\0${change}`;
  const previous = changeQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const settled = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => settled);
  changeQueues.set(key, tail);
  await previous;
  try { return await operation(); }
  finally {
    release();
    // A finishing predecessor must not remove a successor's queued exclusion.
    if (changeQueues.get(key) === tail) changeQueues.delete(key);
  }
}
