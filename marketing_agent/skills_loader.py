"""Skill + tool loader for the marketing agent.

This module is intentionally I/O-free beyond reading files: no prompts, no
prints. That keeps it reusable for both the current CLI REPL and a future web
front-end.

A "skill" is a directory under the top-level ``skills/`` folder containing a
``SKILL.md`` with YAML-like frontmatter::

    ---
    name: copywriting
    description: When the user wants ...
    metadata:
      version: 2.0.0
    ---

    # Copywriting
    ...playbook body...

We parse the frontmatter by hand (no PyYAML dependency) — every skill in this
collection uses single-line ``name`` / ``description`` values, optionally quoted.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# Repo root is the parent of the marketing_agent package.
_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = _ROOT / "skills"
TOOLS_DIR = _ROOT / "tools"
INTEGRATIONS_DIR = TOOLS_DIR / "integrations"


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    version: str
    skill_dir: Path
    skill_md_path: Path

    @property
    def references_dir(self) -> Path:
        return self.skill_dir / "references"


# ---------------------------------------------------------------------------
# Frontmatter parsing (hand-rolled, no PyYAML)
# ---------------------------------------------------------------------------

def _split_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Return (metadata, body). Frontmatter is delimited by leading ``---`` fences."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    meta: dict[str, str] = {}
    end = len(lines)
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end = idx
            break
    in_metadata = False
    for line in lines[1:end]:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "metadata:" or stripped.endswith(":") and ":" not in stripped[:-1]:
            # Heading-style key (e.g. "metadata:") — marks a nested block we
            # handle specially below.
            in_metadata = stripped == "metadata:"
            continue
        key, sep, value = line.partition(":")
        if not sep:
            continue
        key = key.strip()
        value = value.strip()
        # Strip a single layer of matching surrounding quotes.
        if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
            value = value[1:-1]
        if in_metadata and key == "version":
            meta["version"] = value
        elif key in ("name", "description"):
            meta[key] = value
    body = "\n".join(lines[end + 1 :]).lstrip("\n")
    return meta, body


def _parse_skill_md(path: Path) -> Skill | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    meta, _ = _split_frontmatter(text)
    name = meta.get("name") or path.parent.name
    return Skill(
        name=name,
        description=meta.get("description", "").strip(),
        version=meta.get("version", "").strip(),
        skill_dir=path.parent,
        skill_md_path=path,
    )


# ---------------------------------------------------------------------------
# Listing / lookup
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _skills_tuple() -> tuple[Skill, ...]:
    if not SKILLS_DIR.is_dir():
        return ()
    skills = [
        s for s in (_parse_skill_md(p) for p in sorted(SKILLS_DIR.glob("*/SKILL.md"))) if s
    ]
    return tuple(sorted(skills, key=lambda s: s.name))


def refresh_skills() -> None:
    """Drop the cached skill list (call after skills/ changes on disk)."""
    _skills_tuple.cache_clear()


def list_skills() -> list[Skill]:
    """All skills, sorted by name. Returns an empty list if skills/ is absent."""
    return list(_skills_tuple())


def find_skill(query: str) -> Skill | None:
    """Case-insensitive match on full name; falls back to a unique prefix.

    Returns None if there is no match, or if a prefix matches more than one
    skill (ambiguous).
    """
    if not query:
        return None
    q = query.strip().lower()
    skills = list_skills()
    for s in skills:
        if s.name.lower() == q:
            return s
    prefix_hits = [s for s in skills if s.name.lower().startswith(q)]
    if len(prefix_hits) == 1:
        return prefix_hits[0]
    return None


# ---------------------------------------------------------------------------
# Content loading (path-safe)
# ---------------------------------------------------------------------------

def _resolve_under(base: Path, *parts: str) -> Path:
    """Resolve ``base/parts`` and ensure it stays within ``base``."""
    candidate = (base.joinpath(*parts)).resolve()
    base_resolved = base.resolve()
    try:
        candidate.relative_to(base_resolved)
    except ValueError as exc:
        raise ValueError(f"Path escapes {base_resolved}: {'/'.join(parts)}") from exc
    return candidate


def load_skill_body(name: str) -> str:
    """Full SKILL.md body (after frontmatter) for the named skill."""
    skill = find_skill(name)
    if skill is None:
        raise KeyError(f"Unknown skill: {name!r}")
    _, body = _split_frontmatter(skill.skill_md_path.read_text(encoding="utf-8"))
    return body


def list_skill_references(name: str) -> list[str]:
    """Filenames (basenames) of reference playbooks available for a skill."""
    skill = find_skill(name)
    if skill is None or not skill.references_dir.is_dir():
        return []
    return sorted(p.name for p in skill.references_dir.glob("*") if p.is_file())


def load_skill_reference(name: str, filename: str) -> str:
    """Read ``skills/<name>/references/<filename>``. Rejects path traversal."""
    skill = find_skill(name)
    if skill is None:
        raise KeyError(f"Unknown skill: {name!r}")
    path = _resolve_under(skill.references_dir, Path(filename).name)
    if not path.is_file():
        raise FileNotFoundError(f"Reference not found: {filename!r}")
    return path.read_text(encoding="utf-8")


def list_tool_guides() -> list[str]:
    """Basenames of available ``tools/integrations/*.md`` guides."""
    if not INTEGRATIONS_DIR.is_dir():
        return []
    return sorted(p.name for p in INTEGRATIONS_DIR.glob("*.md") if p.is_file())


def load_tool_guide(filename: str) -> str:
    """Read ``tools/integrations/<filename>``. Rejects path traversal."""
    path = _resolve_under(INTEGRATIONS_DIR, Path(filename).name)
    if not path.is_file():
        raise FileNotFoundError(f"Tool guide not found: {filename!r}")
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Menu helpers (pure formatting; still no input reading)
# ---------------------------------------------------------------------------

# Best-effort category map. Keys are name substrings; used for menu readability
# only. Anything unmatched lands in "General".
_CATEGORIES: list[tuple[str, str]] = [
    ("seo", "SEO"),
    ("ai-seo", "AI / SEO"),
    ("schema", "SEO"),
    ("site-architecture", "SEO"),
    ("programmatic-seo", "SEO"),
    ("ads", "Paid Ads"),
    ("ad-creative", "Paid Ads"),
    ("aso", "Paid Ads"),
    ("copywriting", "Copywriting"),
    ("copy-editing", "Copywriting"),
    ("content-strategy", "Content"),
    ("emails", "Email / Lifecycle"),
    ("cold-email", "Email / Lifecycle"),
    ("sms", "Email / Lifecycle"),
    ("social", "Social"),
    ("video", "Content"),
    ("image", "Content"),
    ("analytics", "Analytics"),
    ("ab-testing", "Experimentation"),
    ("cro", "Experimentation"),
    ("popups", "Experimentation"),
    ("pricing", "Monetization"),
    ("paywalls", "Monetization"),
    ("churn-prevention", "Retention"),
    ("onboarding", "Retention"),
    ("referrals", "Retention"),
    ("community-marketing", "Retention"),
    ("customer-research", "Research"),
    ("competitor-profiling", "Research"),
    ("competitors", "Research"),
    ("prospecting", "Sales / RevOps"),
    ("sales-enablement", "Sales / RevOps"),
    ("revops", "Sales / RevOps"),
    ("lead-magnets", "Lead Gen"),
    ("free-tools", "Lead Gen"),
    ("directory-submissions", "Lead Gen"),
    ("launch", "Growth"),
    ("marketing-plan", "Growth"),
    ("marketing-ideas", "Growth"),
    ("co-marketing", "Growth"),
    ("product-marketing", "Positioning"),
    ("marketing-psychology", "Positioning"),
    ("signup", "Growth"),
]


def categorize(skills: list[Skill]) -> list[tuple[str, list[Skill]]]:
    """Group skills into (category, skills) pairs for menu display."""
    buckets: dict[str, list[Skill]] = {}
    for s in skills:
        cat = "General"
        for needle, label in _CATEGORIES:
            if needle in s.name:
                cat = label
                break
        buckets.setdefault(cat, []).append(s)
    # Stable category order: known categories first (in definition order), then General.
    order = []
    seen: set[str] = set()
    for _, label in _CATEGORIES:
        if label not in seen and label in buckets:
            order.append(label)
            seen.add(label)
    if "General" in buckets:
        order.append("General")
    return [(cat, buckets[cat]) for cat in order if cat in buckets]


def short_description(desc: str, width: int = 90) -> str:
    """First sentence of a description, trimmed to ``width`` for menu lines."""
    if not desc:
        return ""
    text = desc.strip()
    # Cut at the first period followed by a space+capital (end of opening sentence).
    for i, ch in enumerate(text):
        if ch == "." and i + 1 < len(text) and text[i + 1] in " \"" and i > 40:
            text = text[: i + 1]
            break
    if len(text) > width:
        text = text[: width - 1].rstrip() + "…"
    return text
