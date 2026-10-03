#[derive(Clone, Debug, PartialEq)]
pub struct Note {
    pub pitch: i32,
    pub beat: f64,
    pub duration: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Clip {
    pub id: String,
    pub notes: Vec<Note>,
}

pub fn playback(clip: &Clip, semitones: i32) -> Vec<Note> {
    clip.notes.iter().map(|note| Note {
        pitch: note.pitch + semitones,
        beat: note.beat,
        duration: note.duration,
    }).collect()
}

// A Tauri command can call this seam with a decoded Clip and return its notes.
pub fn playback_command(clip: Clip, semitones: i32) -> Vec<Note> {
    playback(&clip, semitones)
}

fn main() {
    let clip = Clip { id: "intro".into(), notes: vec![Note { pitch: 60, beat: 0.0, duration: 1.0 }] };
    let original = clip.clone();
    for semitones in [-12, 0, 7] {
        let notes = playback_command(clip.clone(), semitones);
        assert_eq!(notes[0].pitch, original.notes[0].pitch + semitones);
        assert_eq!(clip, original);
    }
}
