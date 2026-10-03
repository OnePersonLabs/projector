import json


def playback(clip, semitones):
    return [dict(note, pitch=note['pitch'] + semitones) for note in clip['notes']]


def save_clip(clip, path):
    with open(path, 'w', encoding='utf-8') as stream:
        json.dump(clip, stream, sort_keys=True)


def load_clip(path):
    with open(path, encoding='utf-8') as stream:
        return json.load(stream)


def commit_transpose(clip, semitones):
    for note in clip['notes']:
        note['pitch'] += semitones
    return clip
