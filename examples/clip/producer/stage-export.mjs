import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { exportClip } from '../js/export.mjs';

const clip = JSON.parse(await readFile(new URL('../shared/clip.json', import.meta.url), 'utf8'));
const output = new URL('../staged/clip-export.json', import.meta.url);
await mkdir(new URL('../staged/', import.meta.url), { recursive: true });
await writeFile(output, `${exportClip(clip, 7)}\n`);
console.log('Staged staged/clip-export.json; published/clip-export.json is unchanged');
