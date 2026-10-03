export function playback(clip, semitones) {
  return clip.notes.map(note => ({ ...note, pitch: note.pitch + semitones }));
}

// This implementation intentionally uses different control flow.
export function handwrittenPlayback(clip, semitones) {
  const notes = [];
  for (const note of clip.notes) {
    notes.push({ pitch: note.pitch + semitones, beat: note.beat, duration: note.duration });
  }
  return notes;
}

export function commitTranspose(clip, semitones) {
  for (const note of clip.notes) note.pitch += semitones;
  return clip;
}
