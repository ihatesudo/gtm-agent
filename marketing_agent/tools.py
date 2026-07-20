"""Tool set used by the marketing agent.

All tools are designed to be "actually usable, with no extra API keys":
- web_search: online search (DuckDuckGo, no API key required) for competitive /
  market research and SEO material gathering.
- save_asset / read_asset / list_assets: persist deliverables (copy, strategies,
  keyword lists, etc.) to ./output.
"""

from __future__ import annotations

from pathlib import Path

from langchain.tools import tool

# Deliverable output directory (relative to the repo root); created if missing.
OUTPUT_DIR = Path("output").resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _safe_path(filename: str) -> Path:
    """Prevent path traversal: only allow writing to a bare filename under OUTPUT_DIR."""
    # Keep only the file-name part, discarding any directory prefix.
    name = Path(filename).name
    if not name:
        raise ValueError(f"Invalid filename: {filename!r}")
    p = (OUTPUT_DIR / name).resolve()
    if not str(p).startswith(str(OUTPUT_DIR)):
        raise ValueError(f"Path escapes output dir: {filename!r}")
    return p


@tool
def web_search(query: str) -> str:
    """Search the web for the latest pages and return a few result summaries.

    Use this for scenarios that need real-time information: competitive research,
    market trends, keyword popularity, industry data, etc. Pass a concrete
    natural-language query, e.g. "Notion 2026 pricing plans".

    Args:
        query: The search keywords.
    """
    # Lazy import so the module still loads if DDG is rate-limiting or the network fails.
    from langchain_community.tools import DuckDuckGoSearchRun

    try:
        return DuckDuckGoSearchRun().invoke(query)
    except Exception as exc:  # noqa: BLE001 — tool-level fallback, hand the error back to the agent to decide
        return f"[web_search failed: {exc}. Please answer from existing knowledge, or retry with a different query.]"


@tool
def save_asset(filename: str, content: str) -> str:
    """Save a piece of marketing output (copy, strategy doc, keyword list, etc.) to a file.

    The file is written to the project's output/ directory. A .md suffix is
    recommended. Call this once after producing the complete output — don't save
    each paragraph separately.

    Args:
        filename: The file name, e.g. "launch-copy.md". A bare name only — no path.
        content: The full content to write.
    """
    path = _safe_path(filename)
    path.write_text(content, encoding="utf-8")
    return f"Saved to {path} ({len(content)} chars)"


@tool
def read_asset(filename: str) -> str:
    """Read the contents of a previously saved marketing asset file.

    Args:
        filename: A file name under the output/ directory.
    """
    path = _safe_path(filename)
    if not path.exists():
        return f"[File not found: {filename}]"
    return path.read_text(encoding="utf-8")


@tool
def list_assets() -> str:
    """List all saved marketing asset file names in the output/ directory."""
    files = sorted(p.name for p in OUTPUT_DIR.glob("*") if p.is_file())
    if not files:
        return "(no saved assets yet)"
    return "\n".join(files)


# --- Skill & tool-reference tools -----------------------------------------
# These let the agent pull in a deeper playbook or platform-integration guide
# on demand. The selected skill's main SKILL.md is already injected into the
# system prompt; use these when the skill points you to a references/ file or
# when you need how-to details for a specific marketing platform.

@tool
def list_skills() -> str:
    """List every available marketing skill by name.

    Each line is `name — short description`. Useful to discover what playbooks
    exist before asking the user, or to confirm a skill name. The active skill's
    playbook is already loaded into context, so you usually only call this to
    explore alternatives.

    Returns:
        A newline-separated list of skill names and one-line summaries.
    """
    from . import skills_loader

    lines = [
        f"{s.name} — {skills_loader.short_description(s.description)}"
        for s in skills_loader.list_skills()
    ]
    return "\n".join(lines) if lines else "(no skills installed)"


@tool
def read_skill_reference(skill_name: str, filename: str) -> str:
    """Read a deeper playbook file for a skill.

    A skill's SKILL.md often links to files under its references/ folder (e.g.
    `references/b2b-paid-playbook.md`). Call this to load one of those deeper
    playbooks when the top-level skill guidance points you to it. Pass the bare
    filename only (no path); the reference must belong to the named skill.

    Args:
        skill_name: The skill whose reference to read (e.g. "ads").
        filename: A bare filename from that skill's references/ folder.
    """
    from . import skills_loader

    try:
        return skills_loader.load_skill_reference(skill_name, filename)
    except KeyError:
        avail = skills_loader.list_skill_references(skill_name) or skills_loader.list_skills()
        hint = "Available references: " + ", ".join(
            skills_loader.list_skill_references(skill_name)
        ) if skills_loader.find_skill(skill_name) else "Unknown skill."
        return f"[Unknown skill: {skill_name!r}. {hint}]"
    except FileNotFoundError as exc:
        avail = skills_loader.list_skill_references(skill_name)
        hint = "Available: " + ", ".join(avail) if avail else ""
        return f"[{exc}. {hint}]"


@tool
def read_tool_guide(filename: str) -> str:
    """Read a marketing-platform integration guide.

    The tools/integrations folder holds how-to guides for platforms like
    klaviyo, ahrefs, meta-ads, hubspot, etc. Call this when you need details on
    how a platform is set up or integrated. Pass a bare filename (with the .md
    suffix), e.g. "klaviyo.md". This returns reference text only — it does not
    execute the JS CLI wrappers.

    Args:
        filename: A bare filename from tools/integrations, e.g. "ahrefs.md".
    """
    from . import skills_loader

    try:
        return skills_loader.load_tool_guide(filename)
    except FileNotFoundError as exc:
        avail = skills_loader.list_tool_guides()
        hint = "Available guides: " + ", ".join(avail[:25]) + (" …" if len(avail) > 25 else "")
        return f"[{exc}. {hint}]"


# Exported for the agent to use.
ALL_TOOLS = [web_search, save_asset, read_asset, list_assets, list_skills, read_skill_reference, read_tool_guide]
