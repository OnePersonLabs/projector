#!/usr/bin/env python3
from pathlib import Path
import json, re

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "spec.manifest.json").read_text(encoding="utf-8"))
ordered = [manifest["entrypoint"], manifest["index"]] + [m["path"] for m in manifest["modules"]]
known = set(ordered)

def anchor_for(rel: str) -> str:
    if rel == manifest["entrypoint"]:
        return "projector-spec-entry"
    if rel == manifest["index"]:
        return "projector-spec-index"
    slug = re.sub(r'[^a-z0-9]+', '-', rel.lower()).strip('-')
    return f"module-{slug}"

link_re = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')

def rewrite_links(text: str, source_rel: str) -> str:
    source_parent = Path(source_rel).parent
    def repl(m: re.Match[str]) -> str:
        label, target = m.group(1), m.group(2)
        if target.startswith(("http://", "https://", "#")):
            return m.group(0)
        path_part, sep, fragment = target.partition('#')
        if not path_part:
            return m.group(0)
        resolved = (source_parent / path_part).as_posix()
        # Normalize '.' and '..' without requiring the target to exist first.
        resolved = Path(resolved).as_posix()
        resolved_abs = (root / source_parent / path_part).resolve()
        try:
            resolved_rel = resolved_abs.relative_to(root.resolve()).as_posix()
        except ValueError:
            return m.group(0)
        if resolved_rel not in known:
            return m.group(0)
        # Current authoritative modules do not use heading fragments across files.
        # If that changes, preserve the fragment as a suffix only when explicitly supported.
        dest = f"#{anchor_for(resolved_rel)}"
        return f"[{label}]({dest})"
    return link_re.sub(repl, text)

parts = []
for rel in ordered:
    text = (root / rel).read_text(encoding="utf-8").rstrip()
    text = rewrite_links(text, rel)
    parts.append(f'<a id="{anchor_for(rel)}"></a>\n\n{text}')

header = "<!-- GENERATED FROM SPEC.md + spec.manifest.json. EDIT AUTHORITATIVE MODULES, NOT THIS BUNDLE. -->\n\n"
output = header + "\n\n---\n\n".join(parts) + "\n"
(root / manifest["bundle"]).write_text(output, encoding="utf-8")
print(manifest["bundle"])
