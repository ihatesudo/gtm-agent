"""Tool set used by the marketing agent.

All tools are designed to be "actually usable, with no extra API keys":
- web_search: online search (DuckDuckGo, no API key required) for competitive /
  market research and SEO material gathering.
- save_asset / read_asset / list_assets: persist deliverables (copy, strategies,
  keyword lists, etc.) to ./output.
"""

from __future__ import annotations

import json
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


# --- Virtual Seth citation tool -----------------------------------------
# Backs the "seth" role: returns real Seth Godin blog posts matching a concept,
# so every critique in the seth-review skill cites a primary source. Reads from
# seth_index.json produced by scripts/build_seth_index.py.

_SETH_INDEX_PATH = OUTPUT_DIR.parent / "seth_index.json"
_seth_index_cache: dict | None = None


def _load_seth_index() -> dict:
    global _seth_index_cache
    if _seth_index_cache is None:
        if not _SETH_INDEX_PATH.is_file():
            raise FileNotFoundError(
                "seth_index.json not found. Run: python scripts/build_seth_index.py"
            )
        import json
        _seth_index_cache = json.loads(_SETH_INDEX_PATH.read_text(encoding="utf-8"))
    return _seth_index_cache


def _refresh_seth_index() -> None:
    """Drop the cached index (call after rebuilding seth_index.json)."""
    global _seth_index_cache
    _seth_index_cache = None


@tool
def lookup_seth_post(concept: str, limit: int = 3) -> str:
    """Find real Seth Godin blog posts about a marketing concept.

    Use this whenever you make a claim about how Seth thinks — ground it in a
    post he actually wrote. Returns the title, date, URL, and a quotable line
    from each matching post, newest-first.

    Valid concepts (pass the id, case-insensitive; unique prefixes allowed):
    trust, story, status, connection, permission, art, ship, tribe, remarkable,
    people-like-us, empathy, generosity, dip, purple-cow, freedom, practice,
    smallest-viable, show-up, resistance, change, responsibility, audience, fear.

    If unsure which concept fits, "trust" or "story" always have hits.

    Args:
        concept: A concept id from the list above, e.g. "trust" or "purple-cow".
        limit: Max posts to return (default 3, max 5).
    """
    try:
        index = _load_seth_index()
    except FileNotFoundError as exc:
        return f"[{exc}]"

    concepts = index.get("concepts", {})
    q = concept.strip().lower()
    # Exact match, then unique prefix.
    cid = q if q in concepts else next(
        (k for k in concepts if k.startswith(q)), None
    )
    if cid is None:
        valid = ", ".join(sorted(concepts))
        return f"[Unknown concept: {concept!r}. Valid: {valid}.]"
    posts = concepts[cid][: max(1, min(limit, 5))]
    if not posts:
        return f"[No posts indexed for concept '{cid}'.]"
    lines = [f"Concept: {cid} — {len(concepts[cid])} posts indexed, showing {len(posts)}."]
    for p in posts:
        line = p.get("line", "").strip()
        lines.append(
            f"- \"{line}\" — {p.get('title', '?')} ({p.get('date', '?')})\n  {p.get('url', '')}"
        )
    return "\n".join(lines)


@tool
def seth_quote_of_the_day() -> str:
    """Get today's Seth Godin aphorism with a one-line reframe for a marketing intern.

    Rotates deterministically by day (same quote for everyone on a given day)
    and balances concept coverage so the intern sees the whole framework over
    time, not the same idea three days running. Pairs the quote with a prompt
    that turns it into an action.

    No arguments — call it once at the start of a session, or when the intern
    asks for their daily Seth.
    """
    import datetime as _dt

    try:
        index = _load_seth_index()
    except FileNotFoundError as exc:
        return f"[{exc}]"
    aphorisms = index.get("aphorisms", [])
    if not aphorisms:
        return "[No aphorisms indexed yet. Run scripts/build_seth_index.py.]"

    # Deterministic daily pick: rotate through top-N, one per day.
    # Use a curated pool of the strongest 60 to keep quality high.
    pool = aphorisms[: min(60, len(aphorisms))]
    day_of_epoch = _dt.date.today().toordinal()
    chosen = pool[day_of_epoch % len(pool)]

    # Map the quote's concept to a one-line reframe (the "what this asks of you").
    _REFRAMES = {
        "trust": "Before you write any copy today: would a customer who took it literally feel respected?",
        "story": "What story does your prospect tell themselves about your product? That's the product.",
        "status": "Name one way using your product raises the user's status in their peer group.",
        "connection": "Does your work connect people to each other — or only to you?",
        "permission": "Are you earning attention, or renting it?",
        "art": "Where in your work today are you making art, and where are you just executing a brief?",
        "ship": "What's the one thing you can ship today that you've been polishing for too long?",
        "tribe": "Who are the 'people like us' for what you're making? Write the sentence.",
        "remarkable": "Would someone remark on what you shipped? If not, it's invisible.",
        "people-like-us": "Before any copy: name the 'us'. If you can't, you have a demographic, not a market.",
        "empathy": "What does your customer fear? Write it down before you write the headline.",
        "generosity": "What can you give away today that your competitors would charge for?",
        "dip": "Where are you in the dip — and is this a dip worth pushing through, or a cul-de-sac?",
        "purple-cow": "Find the one thing about your product that's genuinely remarkable. If there isn't one, that's the work.",
        "freedom": "What fear of failure is shaping your marketing? Name it.",
        "practice": "Marketing is a practice. What did you get reps on today?",
        "smallest-viable": "Shrink your target market until it's small enough to dominate.",
        "show-up": "Showing up beats brilliance. What did you consistently show up for this week?",
        "resistance": "The resistance is loudest right before you ship. Notice it, then ship anyway.",
        "change": "If your campaign doesn't change anything, it's not marketing — it's maintenance.",
        "responsibility": "Take responsibility for one outcome you've been blaming on the market.",
        "audience": "Your audience is not 'everyone.' Make it smaller and more specific.",
        "fear": "What's the fear underneath your prospect's objection? Speak to that, not the surface.",
    }
    primary_concept = chosen.get("concepts", ["trust"])[0]
    reframe = _REFRAMES.get(primary_concept, "What does this ask of you today, in one sentence?")
    return (
        f"Today's Seth ({chosen.get('date', '')}):\n"
        f"\"{chosen['text']}\"\n"
        f"— {chosen.get('title', '')}\n"
        f"{chosen.get('url', '')}\n\n"
        f"Today: {reframe}"
    )


# --- Session memory tools ------------------------------------------------
# Let the agent persist facts across turns and sessions. The active session slug
# is injected into the runtime config by the REPL; these tools read it from the
# configurable so the agent doesn't need to track it itself.

def _current_session_slug(config: dict | None) -> str | None:
    """Pull the session slug out of the LangGraph runnable config."""
    if not config:
        return None
    configurable = config.get("configurable", config)
    return configurable.get("session_slug") or configurable.get("thread_id")


@tool
def remember(product: str = "", icp: str = "", brand_voice: str = "",
             goal: str = "", decision: str = "", notes: str = "",
             config: dict | None = None) -> str:
    """Save a fact to long-term memory so it persists across sessions.

    Call this when the user states something worth remembering for later:
    what the product is, who it's for (ICP), the brand voice, a goal, or a
    decision they've made. Each field is optional — only set the ones you're
    recording. ``goal`` and ``decision`` append to lists; the others replace.

    Args:
        product: One-line description of the product/service.
        icp: The ideal customer / "people like us" — who it's for.
        brand_voice: Tone/style guidance for copy.
        goal: A single goal to add to the goals list.
        decision: A single decision to record (with rationale if useful).
        notes: Free-form notes that don't fit the other fields.
    """
    from . import session

    slug = _current_session_slug(config)
    if not slug:
        return "[remember: no active session — fact not saved]"
    fields = {}
    if product:
        fields["product"] = product
    if icp:
        fields["icp"] = icp
    if brand_voice:
        fields["brand_voice"] = brand_voice
    if goal:
        fields["goals"] = goal
    if decision:
        fields["decisions"] = decision
    if notes:
        fields["notes"] = notes
    if not fields:
        return "[remember: nothing to save — pass at least one field]"
    mem = session.update_memory(slug, **fields)
    saved = ", ".join(f"{k}={v}" for k, v in fields.items())
    return f"Saved to memory: {saved}. Current memory: {mem.to_dict()}"


@tool
def recall(config: dict | None = None) -> str:
    """Read everything remembered about the current session's project.

    Returns the full project memory (product, ICP, brand voice, goals,
    decisions, notes). Call this at the start of a task if the context seems
    relevant — or when the user asks "what do you remember about us?".
    """
    from . import session

    slug = _current_session_slug(config)
    if not slug:
        return "[recall: no active session]"
    mem = session.load_memory(slug)
    if mem.is_empty():
        return "[recall: nothing remembered yet for this session]"
    return json.dumps(mem.to_dict(), ensure_ascii=False, indent=2)


# Exported for the agent to use.
ALL_TOOLS = [web_search, save_asset, read_asset, list_assets, list_skills, read_skill_reference, read_tool_guide, lookup_seth_post, seth_quote_of_the_day, remember, recall]

