import React from 'react';

export type Note = { pitch: number; beat: number; duration: number };
export type Clip = { id: string; notes: readonly Note[] };

export function projectedNotes(clip: Clip, semitones: number): Note[] {
  return clip.notes.map(note => ({ ...note, pitch: note.pitch + semitones }));
}

export function ClipView({ clip, semitones }: { clip: Clip; semitones: number }) {
  return <ol className="clip-notes" aria-label={`Playback notes for ${clip.id}`}>
    {projectedNotes(clip, semitones).map((note, index) =>
      <li key={index}><span>Pitch {note.pitch}</span><span>Beat {note.beat}</span></li>)}
  </ol>;
}
