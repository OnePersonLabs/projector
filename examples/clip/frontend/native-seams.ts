import { Clip, projectedNotes } from './ClipView';

// NativeScript and React Native callers can pass this result to their view layer.
export function nativeNoteLabels(clip: Clip, semitones: number): string[] {
  return projectedNotes(clip, semitones).map(note => `Pitch ${note.pitch}, beat ${note.beat}`);
}
