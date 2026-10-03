import { playback } from './playback.mjs';

export function exportClip(clip, semitones) {
  return JSON.stringify({ id: clip.id, notes: playback(clip, semitones) });
}
