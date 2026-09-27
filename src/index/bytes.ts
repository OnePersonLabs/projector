import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { LIMITS } from './types.ts';

export interface SourceBytes { hash: string; size: number; content?: Buffer }
export async function workingBytes(file: string): Promise<SourceBytes> {
  const digest = createHash('sha256'); let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(file)) {
    const bytes = chunk as Buffer; digest.update(bytes); size += bytes.length;
    if (size <= LIMITS.fileBytes) chunks.push(bytes); else chunks.length = 0;
  }
  return { hash: digest.digest('hex'), size, content: size <= LIMITS.fileBytes ? Buffer.concat(chunks) : undefined };
}

/** Consume one Git blob at a time. Large assets are hashed without retained bodies. */
export async function* revisionSources(root: string, blobs: { file: string; oid: string }[]): AsyncGenerator<[string, SourceBytes]> {
  const options = process.platform === 'win32' ? ['-c', 'core.longPaths=true'] : [];
  const child = spawn('git', [...options, '-C', root, 'cat-file', '--batch'], { windowsHide: true });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-4096); });
  const completion = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`git cat-file failed (${code}): ${stderr}`)));
  });
  // Attach rejection immediately, including while the generator is parsing stdout.
  void completion.catch(() => {});
  child.stdin.on('error', () => {});
  const iterator = child.stdout[Symbol.asyncIterator](); let pending = Buffer.alloc(0);
  const fill = async () => {
    const next = await iterator.next();
    if (next.done) throw new Error('Truncated Git object stream');
    pending = Buffer.concat([pending, next.value as Buffer]);
  };
  try {
    for (const blob of blobs) {
      child.stdin.write(`${blob.oid}\n`);
      while (pending.indexOf(10) < 0) { if (pending.length > 256) throw new Error('Malformed Git object header'); await fill(); }
      const end = pending.indexOf(10); const header = pending.subarray(0, end).toString('ascii'); pending = pending.subarray(end + 1);
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
      if (!match || match[1] !== blob.oid) throw new Error(`Git object identity mismatch for ${blob.file}`);
      const size = Number(match[2]); const digest = createHash('sha256'); const chunks: Buffer[] = []; let remaining = size;
      while (remaining) {
        if (!pending.length) await fill();
        const length = Math.min(remaining, pending.length); const bytes = pending.subarray(0, length);
        digest.update(bytes); if (size <= LIMITS.fileBytes) chunks.push(Buffer.from(bytes));
        pending = pending.subarray(length); remaining -= length;
      }
      if (!pending.length) await fill();
      if (pending[0] !== 10) throw new Error('Malformed Git object terminator'); pending = pending.subarray(1);
      yield [blob.file, { hash: digest.digest('hex'), size, content: size <= LIMITS.fileBytes ? Buffer.concat(chunks) : undefined }];
    }
    child.stdin.end(); await completion;
  } finally { if (child.exitCode === null) child.kill(); }
}
