#!/usr/bin/env python3
from pathlib import Path
import json, re, sys, subprocess

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "spec.manifest.json").read_text(encoding="utf-8"))
paths = [manifest["entrypoint"], manifest["index"]] + [m["path"] for m in manifest["modules"]]
errors=[]
warnings=[]

for rel in paths:
    p=root/rel
    if not p.exists(): errors.append(f"missing manifest file: {rel}")


# Progressive-disclosure module size budget.
max_module_bytes = manifest.get("maxModuleBytes")
if max_module_bytes is not None:
    for module in manifest["modules"]:
        rel = module["path"]
        p = root / rel
        if p.exists():
            size = p.stat().st_size
            if size > max_module_bytes:
                errors.append(f"module exceeds progressive-disclosure budget: {rel} {size}>{max_module_bytes} bytes")

# Local Markdown links.
link_re=re.compile(r'\[[^\]]+\]\(([^)]+)\)')
for rel in paths:
    p=root/rel
    if not p.exists(): continue
    text=p.read_text(encoding='utf-8')
    for target in link_re.findall(text):
        if target.startswith(('http://','https://','#')): continue
        target=target.split('#',1)[0]
        if not target: continue
        dest=(p.parent/target).resolve()
        try: dest.relative_to(root.resolve())
        except ValueError:
            errors.append(f"out-of-root link: {rel} -> {target}")
            continue
        if not dest.exists(): errors.append(f"broken link: {rel} -> {target}")

# Public normative TS declarations must not have duplicate canonical definitions.
joined='\n'.join((root/p).read_text(encoding='utf-8') for p in paths if (root/p).exists())
decls=re.findall(r'export\s+(?:interface|type)\s+(\w+)',joined)
for name in sorted(set(decls)):
    if decls.count(name)>1: errors.append(f"duplicate exported normative declaration: {name} x{decls.count(name)}")

# Known migration hazards must not survive.
for pattern,label in [
    (r'\bmodel\.json\b','monolithic model.json reference'),
    (r'\bSection\s+\d+(?:\.\d+)?\b','numeric cross-reference'),
    (r'PROJECTOR_SPEC_DELTA','delta/history reference'),
    (r'PROJECTOR_SPEC_V1','legacy-spec reference')
]:
    if re.search(pattern, joined): errors.append(label)

# No inherited numbered H2/H3 headings.
if re.search(r'^##+\s+\d+(?:\.\d+)*\s+', joined, flags=re.M):
    errors.append('numbered inherited section heading remains')

# Authoritative prose must pass Projector human-technical@1 mechanical lint.
lint_proc = subprocess.run(
    [sys.executable, str(root / 'scripts/lint_human_technical.py'), '--json'],
    cwd=root, capture_output=True, text=True
)
try:
    lint_result = json.loads(lint_proc.stdout)
except json.JSONDecodeError:
    errors.append('human-technical lint did not return valid JSON')
else:
    for issue in lint_result.get('errors', []):
        errors.append(
            f"human-technical lint: {issue['path']}:{issue['line']} "
            f"[{issue['category']}] {issue['message']}"
        )
    for issue in lint_result.get('warnings', []):
        warnings.append(
            f"human-technical lint warning: {issue['path']}:{issue['line']} "
            f"[{issue['category']}] {issue['message']}"
        )

# Ensure bundle is deterministic/current.
subprocess.run([sys.executable, str(root/'scripts/bundle_spec.py')], cwd=root, check=True, stdout=subprocess.DEVNULL)
bundle_path = root / manifest['bundle']
bundle = bundle_path.read_bytes()
subprocess.run([sys.executable, str(root/'scripts/bundle_spec.py')], cwd=root, check=True, stdout=subprocess.DEVNULL)
if bundle_path.read_bytes() != bundle:
    errors.append('bundle generation is nondeterministic')
bundle_text = bundle.decode('utf-8')
if not bundle_text.startswith('<!-- GENERATED FROM SPEC.md + spec.manifest.json.'):
    errors.append('bundle header missing')

if errors:
    print('SPEC CHECK FAILED')
    for e in errors: print('-',e)
    raise SystemExit(1)
print(
    f"SPEC CHECK PASSED: {len(paths)} authoritative/index files, "
    f"{len(set(decls))} exported normative declarations, "
    f"human-technical@1 blocking errors=0, review warnings={len(warnings)}"
)
