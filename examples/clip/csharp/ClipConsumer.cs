using System;
using System.Linq;

public sealed record Note(int Pitch, double Beat, double Duration);
public sealed record Clip(string Id, Note[] Notes);

public static class ClipConsumer
{
    public static Note[] Playback(Clip clip, int semitones) =>
        clip.Notes.Select(note => note with { Pitch = note.Pitch + semitones }).ToArray();

    public static void Main()
    {
        var clip = new Clip("intro", new[] { new Note(60, 0, 1) });
        var projected = Playback(clip, 7);
        if (projected[0].Pitch != 67 || clip.Notes[0].Pitch != 60)
            throw new InvalidOperationException("Playback changed the source Clip.");
        Console.WriteLine(projected[0].Pitch);
    }
}
