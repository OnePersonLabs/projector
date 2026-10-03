import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { playback, handwrittenPlayback, commitTranspose } from '../js/playback.mjs';
import { exportClip } from '../js/export.mjs';

const clip = JSON.parse(await readFile(new URL('../shared/clip.json', import.meta.url), 'utf8'));
const saved = structuredClone(clip);
for (const semitones of [-12, 0, 7]) {
  const projected = playback(clip, semitones);
  assert.deepEqual(handwrittenPlayback(clip, semitones), projected);
  assert.deepEqual(JSON.parse(exportClip(clip, semitones)).notes, projected);
  assert.deepEqual(projected.map(note => note.pitch), saved.notes.map(note => note.pitch + semitones));
  assert.deepEqual(clip, saved);
}
const edited = commitTranspose(structuredClone(clip), 7);
assert.notDeepEqual(edited, saved);
assert.deepEqual(clip, saved);
console.log('JS playback, handwritten alternative, export, and commit counterexample verified');
