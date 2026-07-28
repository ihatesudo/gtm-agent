#!/usr/bin/env python3
"""Build a concept index + aphorism store from the Seth Godin blog corpus.

Reads the scraped markdown archive (one file per post, with ``---`` frontmatter
containing title / date / url / slug) and emits ``seth_index.json``:

  {
    "concepts": { "trust": [{title,date,url,slug,line}, ...], ... },
    "aphorisms": [{text,title,date,url,slug,score,concepts}, ...],
    "maxims": [ "Trust is worth more than attention.", ... ],
    "stats": { "posts": 9838, "concepts": 23, "aphorisms": 412 }
  }

The index is the backing store for the "Virtual Seth" mentor:
  - ``concepts`` backs the citation tool (every critique cites a real post).
  - ``aphorisms`` backs the daily-quote feature (scored + rotated by concept).
  - ``maxims`` is the fixed eight, always in the persona.

Zero dependencies beyond the stdlib — runs anywhere.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

# The conceptual backbone, distilled from corpus-wide mention counts.
# Each entry: id -> (display_name, [match_patterns])  patterns are regex, case-insensitive.
# Order matters: listed roughly by how load-bearing the idea is.
CONCEPTS: list[tuple[str, str, list[str]]] = [
    ("story",      "Story",        [r"\bstor(y|ies)\b"]),
    ("trust",      "Trust",        [r"\btrust\b"]),
    ("status",     "Status",       [r"\bstatus\b"]),
    ("connection", "Connection",   [r"\bconnect(ion|ed|ing)\b"]),
    ("permission", "Permission",   [r"\bpermission\b"]),
    ("art",        "Art",          [r"\bart(ist|ists)?\b"]),
    ("ship",       "Ship",         [r"\bship(ped|ping)?\b"]),
    ("tribe",      "Tribe",        [r"\btribes?\b"]),
    ("remarkable", "Remarkable",   [r"\bremarkab(le|ility)\b"]),
    ("people-like-us", "People Like Us", [r"people like us", r"\bus\b do things"]),
    ("empathy",    "Empathy",      [r"\bempath(y|ic)\b"]),
    ("generosity", "Generosity",   [r"\bgeneros(ity|ous)\b"]),
    ("dip",        "The Dip",      [r"\bthe dip\b", r"\bdips?\b"]),
    ("purple-cow", "Purple Cow",   [r"purple cow"]),
    ("freedom",    "Freedom",      [r"\bfreedoms?\b"]),
    ("practice",   "Practice",     [r"\bpracti[cs]e(d|s)?\b"]),
    ("smallest-viable", "Smallest Viable Market", [r"smallest viable", r"\bminimum viable (audience|market)\b"]),
    ("show-up",    "Show Up",      [r"\bshow up\b", r"\bshowing up\b"]),
    ("lizard",     "Resistance",   [r"\blizard brain\b", r"\bthe resistance\b", r"\bresistance\b"]),
    ("change",     "Change",       [r"\bchange\b"]),
    ("responsibility", "Responsibility", [r"\bresponsibilit(y|ies)\b"]),
    ("audience",   "Audience",     [r"\baudiences?\b"]),
    ("fear",       "Fear",         [r"\bfear(ful)?\b", r"\bafraid\b"]),
]

# Seth's eight marketing maxims (Dec 2023 post). The fixed constitution.
MAXIMS: list[str] = [
    "Trust is worth more than attention.",
    "Helping people get to where they seek to go is more effective than hustling people to persuade them to go where you're going.",
    "Choose your customers, choose your future.",
    "Tell ten people. If they don't tell the others, make a better product.",
    "Creating the conditions for the word to spread is the job of the marketer.",
    "Customer service is free.",
    "\"You'll pay a lot but get more than you paid for,\" is a useful motto.",
    "Act like people are watching. They are.",
]

# Heuristics for what counts as a quotable aphorism.
_MIN_WORDS = 6
_MAX_WORDS = 20
_BORING_STARTS = {"the", "a", "an", "it", "there", "here", "if", "when", "so",
                  "and", "but", "because", "while", "in", "on", "at", "for",
                  "to", "with"}
# Patterns that disqualify a line (links, self-promo, list-item fragments).
_DISQUALIFY = re.compile(r"https?://|http", re.I)

_FRONTMATTER_FENCE = "---"


def parse_post(path: Path) -> tuple[dict[str, str], str]:
    """Split a post into (frontmatter, body). Frontmatter is YAML-ish but we only need a few keys."""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0].strip() != _FRONTMATTER_FENCE:
        return {}, text
    end = len(lines)
    for i in range(1, len(lines)):
        if lines[i].strip() == _FRONTMATTER_FENCE:
            end = i
            break
    meta: dict[str, str] = {}
    for line in lines[1:end]:
        key, sep, val = line.partition(":")
        if sep:
            v = val.strip()
            if len(v) >= 2 and v[0] in "\"'" and v[-1] == v[0]:
                v = v[1:-1]
            meta[key.strip()] = v
    body = "\n".join(lines[end + 1:]).lstrip("\n")
    return meta, body


def detect_concepts(body: str) -> list[str]:
    """Return concept ids whose patterns match the body (lowercased)."""
    low = body.lower()
    hits = []
    for cid, _name, patterns in CONCEPTS:
        if any(re.search(p, low) for p in patterns):
            hits.append(cid)
    return hits


def sentence_words(s: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", s)


def is_aphorism(line: str) -> bool:
    """Is this line a standalone, quotable Seth-style one-liner?"""
    s = line.strip()
    if not s or not s.endswith("."):
        return False
    if _DISQUALIFY.search(s):
        return False
    # Skip markdown headers, list items, blockquotes.
    if s.startswith(("#", "-", "*", ">", "|")):
        return False
    words = sentence_words(s)
    if not (_MIN_WORDS <= len(words) <= _MAX_WORDS):
        return False
    if words[0].lower() in _BORING_STARTS:
        return False
    # Must contain at least one backbone concept to be "on theme".
    return True


def best_concept_line(body: str, concepts: list[str]) -> str | None:
    """From a post body, pick the single best concept-bearing sentence for citation.

    Preference order: a standalone aphorism; then a short concept sentence
    (<=30 words); then any concept sentence (<=40 words). Longer fragments are
    skipped so citations stay punchy and quotable.
    """
    # 1. Best: a standalone aphorism that's on-theme.
    for para in body.split("\n\n"):
        for line in para.splitlines():
            if is_aphorism(line) and detect_concepts(line):
                return line.strip()
    # 2. Short concept sentence (<=30 words, single line, no markdown noise).
    candidates: list[tuple[int, str]] = []
    for sentence in re.split(r"(?<=[.!?])\s+", body):
        s = sentence.strip()
        if not s or s.startswith(("#", "-", "*", ">", "|")):
            continue
        if _DISQUALIFY.search(s):
            continue
        wc = len(sentence_words(s))
        if wc > 40:
            continue
        if detect_concepts(s):
            candidates.append((wc, s))
    if not candidates:
        return None
    # Prefer the shortest punchy sentence.
    candidates.sort(key=lambda wc_s: wc_s[0])
    return candidates[0][1]


def score_aphorism(text: str, concepts: list[str], year: int) -> tuple[int, int]:
    """Return (score, recency_rank). Higher is better for daily-quote rotation."""
    words = sentence_words(text)
    length_score = 10 - abs(len(words) - 11)  # peak at ~11 words
    concept_score = len(concepts) * 3          # multi-concept lines are richer
    recency = max(0, year - 2002)              # bias to mature voice
    return length_score + concept_score, recency


def build_index(corpus_dir: Path) -> dict:
    concept_index: dict[str, list[dict]] = defaultdict(list)
    aphorisms: list[dict] = []
    post_count = 0
    years_seen: Counter = Counter()

    posts = sorted(corpus_dir.glob("[0-9][0-9][0-9][0-9]/*.md"))
    for path in posts:
        meta, body = parse_post(path)
        if not body.strip():
            continue
        post_count += 1
        year = int((meta.get("date", "2000")[:4]))
        years_seen[year] += 1

        entry_base = {
            "title": meta.get("title", path.stem),
            "date": meta.get("date", ""),
            "url": meta.get("url", ""),
            "slug": meta.get("slug", path.stem),
        }

        concepts = detect_concepts(body)
        citation_line = best_concept_line(body, concepts)

        # Index by concept: every post under every concept it touches.
        for cid in concepts:
            concept_index[cid].append({**entry_base, "line": citation_line or ""})

        # Mine aphorisms: every standalone punchy line.
        for line in body.splitlines():
            if is_aphorism(line):
                line_concepts = detect_concepts(line)
                if not line_concepts:
                    continue
                score, recency = score_aphorism(line, line_concepts, year)
                aphorisms.append({
                    "text": line.strip(),
                    **entry_base,
                    "concepts": line_concepts,
                    "score": score,
                    "year": year,
                })

    # Sort concept lists newest-first; cap each concept at 50 strong posts.
    for cid in concept_index:
        concept_index[cid].sort(key=lambda e: e["date"], reverse=True)
        concept_index[cid] = concept_index[cid][:50]

    # Deduplicate aphorisms by normalized text, keep highest-scored.
    seen: dict[str, dict] = {}
    for a in aphorisms:
        key = re.sub(r"\s+", " ", a["text"].lower().rstrip(".")).strip()
        if key not in seen or a["score"] > seen[key]["score"]:
            seen[key] = a
    aphorisms = sorted(seen.values(), key=lambda a: a["score"], reverse=True)

    return {
        "concepts": dict(sorted(concept_index.items())),
        "aphorisms": aphorisms,
        "maxims": MAXIMS,
        "stats": {
            "posts": post_count,
            "concepts": len(concept_index),
            "aphorisms": len(aphorisms),
            "years": dict(sorted(years_seen.items())),
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Build the Seth Godin concept index.")
    ap.add_argument(
        "--corpus",
        default=str(Path.home() / "Downloads/Seth_Godin_Blog"),
        help="Path to the scraped blog archive (dirs of YYYY/*.md).",
    )
    ap.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "seth_index.json"),
        help="Output path for seth_index.json.",
    )
    args = ap.parse_args()

    corpus_dir = Path(args.corpus).expanduser()
    if not corpus_dir.is_dir():
        raise SystemExit(f"Corpus dir not found: {corpus_dir}")

    index = build_index(corpus_dir)
    out_path = Path(args.out)
    out_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    s = index["stats"]
    print(f"Indexed {s['posts']} posts across {len(s['years'])} years.")
    print(f"Concepts: {s['concepts']}  |  Aphorisms: {s['aphorisms']}")
    print(f"Top concepts by post count:")
    for cid, posts in sorted(index["concepts"].items(), key=lambda kv: len(kv[1]), reverse=True)[:8]:
        print(f"  {cid:18} {len(posts):5}")
    print(f"\nWrote {out_path} ({out_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
