import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const directory = await mkdtemp(path.join(os.tmpdir(), 'clip-rust-'));
const output = path.join(directory, process.platform === 'win32' ? 'playback.exe' : 'playback');
try {
  await run('rustc', [fileURLToPath(new URL('../rust/playback.rs', import.meta.url)), '-o', output], { windowsHide: true });
  await run(output, [], { windowsHide: true });
  console.log('Rust playback isolation verified');
} finally {
  await rm(directory, { recursive: true, force: true });
}
