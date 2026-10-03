# A shared Clip with per-use transpose

The fixture has one saved Clip and several uses of it. Playback adds semitones to copied notes. Persistence still writes the source notes. An explicit commit transform changes the source on purpose; it is the counterexample to the read-time Pattern Candidate.

The implementations use ordinary language code. JS includes two handwritten playback implementations and an export consumer. Python saves and loads the Clip. Rust has a playback command seam suitable for a Tauri adapter. TSX renders projected notes, and `native-seams.ts` supplies labels for NativeScript or React Native callers. C# projects a new note array. HTML provides a complete browser view with CSS; SCSS shows the same presentation seam. These source examples do not install their frameworks.

From this directory, run `node checks/playback.mjs`, `python -B checks/persistence.py`, and `node checks/rust-playback.mjs` (requires `rustc`). Those checks verify JS, Python, and Rust behavior. They do not prove C#, TSX, mobile integration, or browser interaction. Serve this directory over HTTP to use `frontend/index.html`; opening it as a local file can block the JSON fetch.

The meaning files explain the invariant, its exception, and why it exists. The Lens selects each role separately. Inventory observations locate source candidates, while native runtime checks establish scoped behavior. A new file in `js/` changes Lens discovery; the checks still need to exercise its behavior before claiming coverage.

Activate this example before using the Projector helper. Native checks work independently of activation. For a staged output workflow, create the example checkpoint with `requests/checkpoint.json`, then run `node producer/stage-export.mjs`. Inspect `staged/clip-export.json`. Build an owned repair request for `published/clip-export.json`, using its current hash as `expectedHash` and `staged/clip-export.json` as `fromFile`. The native host runs the producer; the helper records before images and applies the reviewed output. See [the plugin reference](../../plugins/opl-projector/references/guide.md) for exact requests.

Use `requests/focus.json` to find the relevant authority and `requests/reconcile.json` to request current checks. A root agent writes the shared checkpoint. Workers can own disjoint files; the plugin does not schedule them. A resumed checkpoint compares source and discovery snapshots before further action.
