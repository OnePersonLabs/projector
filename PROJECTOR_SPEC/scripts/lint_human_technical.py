#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import re
import sys
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]

# Projector human-technical@1 mechanical profile.
# The profile uses controlled-technical-English discipline without claiming
# certification against any external controlled-language standard.
MAX_SENTENCE_WORDS = 25
MAX_PARAGRAPH_SENTENCES = 6

MARKETING = {
    "seamless", "seamlessly", "robust", "powerful", "cutting-edge",
    "effortless", "effortlessly", "world-class", "next-generation",
    "revolutionary", "blazing", "lightning-fast", "elegant", "delightful",
    "turnkey", "best-in-class", "state-of-the-art", "game-changing",
    "first-class", "battle-tested", "enterprise-grade", "supercharge",
    "unlock", "unleash", "empower", "empowers",
}

DISCOURAGED = {
    "begin", "begins", "commence", "commences", "initiate", "initiates",
    "originate", "utilize", "utilizes", "utilizing", "leverage",
    "leverages", "leveraging", "facilitate", "facilitates", "ensure",
    "ensures", "ensuring", "prior to", "subsequent to", "obtain", "obtains",
    "acquire", "acquires", "demonstrate", "demonstrates", "additionally",
    "furthermore", "moreover", "comprehensive", "comprehensively",
    "utilization", "aforementioned", "henceforth", "therein", "whilst",
    "amongst", "numerous", "myriad", "plethora", "in order to",
    "a variety of", "in the event that", "due to the fact that",
    "it is important to note",
}

PHRASAL = {
    "spin up", "spin down", "reach out", "dive into", "dives into",
    "diving into", "kick off", "kicks off", "roll out", "rolls out",
    "tear down", "ramp up", "circle back", "drill down", "spun up",
    "reaching out",
}

MODAL_HEDGE = {
    "it is important to note", "it should be noted", "it is worth noting",
    "please note that", "as mentioned", "as noted above",
}

BE = r"(?:am|is|are|was|were|be|been|being)"
PP_IRREG = r"(?:done|made|sent|read|built|kept|held|set|put|run|written|shown|given|taken|found|got|gotten|seen|known|thrown|drawn)"

# These participles usually describe a semantic state rather than hide a useful actor.
PASSIVE_STATE_EXEMPT = {
    "required", "known", "unchanged", "derived", "authored", "reused",
    "resolved", "justified", "closed", "scoped", "allowed", "supported",
    "unavailable", "blocked", "stale", "valid", "invalid", "bound",
    "selected", "accepted", "rejected", "deprecated", "retired",
    "superseded", "included", "excluded", "preserved", "defined",
}


@dataclass(frozen=True)
class Issue:
    severity: str
    category: str
    path: str
    line: int
    message: str
    text: str


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-/]*", text))


def strip_inline_code(text: str) -> str:
    # Preserve one neutral token per inline-code span so sentence length remains
    # representative without linting identifiers, commands, or exact literals.
    return re.sub(r"`[^`]*`", "CODE", text)


def phrase_hits(text: str, phrases: Iterable[str]) -> list[str]:
    low = text.lower()
    hits: list[str] = []
    for phrase in phrases:
        if re.search(r"(?<![a-z])" + re.escape(phrase) + r"(?![a-z])", low):
            hits.append(phrase)
    return hits


def normalize_line_for_sentences(line: str) -> str:
    s = line.strip()
    s = re.sub(r"^#{1,6}\s*", "", s)
    s = re.sub(r"^(?:[-*+]|\d+[.)])\s+", "", s)
    if s.startswith(">"):
        s = s[1:].lstrip()
    return strip_inline_code(s)


def split_sentences(line: str) -> list[str]:
    raw = line.strip()
    if raw.startswith("|"):
        cells = [cell.strip() for cell in raw.strip("|").split("|") if cell.strip()]
        parts: list[str] = []
        for cell in cells:
            parts.extend(split_sentences(cell))
        return parts

    s = normalize_line_for_sentences(line)
    if not s:
        return []
    return [
        part.strip()
        for part in re.split(r"(?<=[.!?:])\s+(?=[A-Z0-9\"'\-])", s)
        if part.strip()
    ]


def lint_file(path: Path, rel: str) -> list[Issue]:
    issues: list[Issue] = []
    lines = path.read_text(encoding="utf-8").splitlines()
    in_code = False

    # Paragraph tracking excludes fenced code and Markdown tables.
    paragraph_sentences = 0
    paragraph_start = 0

    def close_paragraph() -> None:
        nonlocal paragraph_sentences, paragraph_start
        if paragraph_sentences > MAX_PARAGRAPH_SENTENCES:
            issues.append(Issue(
                "error", "paragraph-length", rel, paragraph_start,
                f"paragraph has {paragraph_sentences} sentences; max is {MAX_PARAGRAPH_SENTENCES}", ""
            ))
        paragraph_sentences = 0
        paragraph_start = 0

    for lineno, raw in enumerate(lines, 1):
        stripped = raw.strip()
        if stripped.startswith("```"):
            close_paragraph()
            in_code = not in_code
            continue
        if in_code:
            continue
        if not stripped:
            close_paragraph()
            continue

        # Headings and list items define their own paragraph units.
        is_structural = bool(re.match(r"^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)", stripped))
        if is_structural:
            close_paragraph()

        prose = strip_inline_code(raw)
        # Exact code/identifier literals are now neutral CODE tokens.
        semicolon_count = prose.count(";")
        if semicolon_count:
            issues.append(Issue("error", "semicolon", rel, lineno, "semicolon in prose", stripped))

        contractions = re.findall(r"\b(?:\w+n['’]t|(?:I|i)['’](?:m|d|ll|ve)|(?:you|we|they|he|she|it)['’](?:re|ve|ll|d))\b", prose, re.I)
        if contractions:
            issues.append(Issue("error", "contraction", rel, lineno, f"contraction(s): {', '.join(contractions)}", stripped))

        for category, phrases in [
            ("marketing-word", MARKETING),
            ("discouraged-word", DISCOURAGED),
            ("modal-hedge", MODAL_HEDGE),
        ]:
            hits = phrase_hits(prose, phrases)
            if hits:
                issues.append(Issue("error", category, rel, lineno, f"use plainer wording: {', '.join(sorted(set(hits)))}", stripped))

        phrasal = phrase_hits(prose, PHRASAL)
        if phrasal:
            issues.append(Issue("warning", "phrasal-verb", rel, lineno, f"consider a plain verb: {', '.join(sorted(set(phrasal)))}", stripped))

        # Style heuristics are advisory because technical prose can validly use
        # passive constructions when the actor is unknown or irrelevant.
        passive = []
        for match in re.finditer(rf"\b{BE}\s+(?P<part>\w+ed|{PP_IRREG})\b", prose, re.I):
            if match.group("part").lower() not in PASSIVE_STATE_EXEMPT:
                passive.append(match.group(0))
        if passive:
            issues.append(Issue("warning", "passive-voice", rel, lineno, f"review passive construction(s): {len(passive)}", stripped))

        ing = re.findall(rf"\b{BE}\s+\w+ing\b", prose, re.I)
        if ing:
            issues.append(Issue("warning", "ing-main-verb", rel, lineno, f"review -ing main verb(s): {len(ing)}", stripped))

        nominal = len(re.findall(r"\b(?:perform(?:s|ed)?\s+(?:an?\s+)?(?:analysis|review|validation|verification|evaluation)|conduct(?:s|ed)?\s+(?:an?\s+)?(?:analysis|review|validation|verification|evaluation)|carry out|carries out|make use of|makes use of)\b", prose, re.I))
        if nominal:
            issues.append(Issue("warning", "nominalization", rel, lineno, f"review nominalization(s): {nominal}", stripped))

        sentence_parts = split_sentences(raw)
        if paragraph_start == 0 and not is_structural and not stripped.startswith('|'):
            paragraph_start = lineno
        if not stripped.startswith('|'):
            paragraph_sentences += len(sentence_parts)

        for sentence in sentence_parts:
            words = word_count(sentence)
            if words > MAX_SENTENCE_WORDS:
                issues.append(Issue(
                    "error", "sentence-length", rel, lineno,
                    f"sentence has {words} words; max is {MAX_SENTENCE_WORDS}", sentence
                ))

        if is_structural or raw.rstrip("\n").endswith("  "):
            close_paragraph()

    close_paragraph()
    return issues


def authoritative_paths() -> list[str]:
    manifest = json.loads((ROOT / "spec.manifest.json").read_text(encoding="utf-8"))
    return [manifest["entrypoint"], manifest["index"]] + [m["path"] for m in manifest["modules"]]


def main() -> int:
    paths = authoritative_paths()
    issues: list[Issue] = []
    for rel in paths:
        issues.extend(lint_file(ROOT / rel, rel))

    errors = [i for i in issues if i.severity == "error"]
    warnings = [i for i in issues if i.severity == "warning"]

    if "--json" in sys.argv:
        print(json.dumps({
            "errors": [i.__dict__ for i in errors],
            "warnings": [i.__dict__ for i in warnings],
            "summary": {
                "files": len(paths),
                "errors": len(errors),
                "warnings": len(warnings),
            },
        }, indent=2))
    else:
        for issue in errors + warnings:
            marker = "ERROR" if issue.severity == "error" else "WARN"
            print(f"{marker} {issue.path}:{issue.line} [{issue.category}] {issue.message}")
            if issue.text:
                print(f"  {issue.text}")
        print(f"human-technical@1: {len(errors)} errors, {len(warnings)} warnings across {len(paths)} files")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
