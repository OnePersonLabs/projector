import json
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'python'))
from persistence import playback, save_clip, load_clip, commit_transpose

clip = json.loads((pathlib.Path(__file__).resolve().parents[1] / 'shared/clip.json').read_text())
original = json.loads(json.dumps(clip))
with tempfile.TemporaryDirectory() as directory:
    path = pathlib.Path(directory) / 'clip.json'
    save_clip(clip, path)
    projected = playback(clip, 7)
    assert [note['pitch'] for note in projected] == [note['pitch'] + 7 for note in original['notes']]
    assert clip == original
    assert load_clip(path) == original
    commit_transpose(clip, 7)
    save_clip(clip, path)
    assert load_clip(path) == clip
    assert clip != original
print('Python persistence and explicit committed edit verified')
