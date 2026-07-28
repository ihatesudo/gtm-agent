"""Session + memory for the marketing agent.

Two layers of persistence, on purpose:

1. **Conversation memory** (within + across sessions) — a SQLite-backed
   LangGraph ``checkpointer``. Each session gets a stable ``thread_id``; the
   agent reads/writes the full message history per turn, so multi-turn dialogue
   works and survives restarts. SQLite (not in-memory) so it persists across
   process exits, per the requirement to save sessions to disk.

2. **Project memory** (cross-session, agent-editable context) — a small JSON
   file per session holding the facts worth remembering between sessions:
   product, ICP, brand voice, decisions, goals. The agent can read and update
   it via tools; new sessions auto-load it so context carries over.

Design goals: simple, no external services, no new hard dependencies beyond
``langgraph`` (already present). The SQLite saver ships inside langgraph's
stdlib checkpoint backend; we fall back to ``MemorySaver`` (in-process) if the
SQLite backend isn't importable in a given environment, so the agent always
runs — persistence is best-effort, never a hard failure.

Storage layout::

    .sessions/
      memory.db                 <- SQLite checkpointer (conversation turns)
      <session-slug>.json       <- one project-memory file per session
      sessions.json             <- registry: slug -> {created, title, last_used}
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

from langgraph.checkpoint.memory import MemorySaver

_ROOT = Path(__file__).resolve().parent.parent
SESSIONS_DIR = _ROOT / ".sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

_DB_PATH = SESSIONS_DIR / "memory.db"
_REGISTRY_PATH = SESSIONS_DIR / "sessions.json"


# ---------------------------------------------------------------------------
# Checkpointer (conversation persistence)
# ---------------------------------------------------------------------------

def get_checkpointer():
    """Return a persistent checkpointer if SQLite is available, else in-memory.

    The agent always gets a working checkpointer; only the *storage backend*
    degrades. SQLite is preferred because it survives process restarts, which
    is what "save sessions to memory files" requires.
    """
    # langgraph's sqlite saver is an optional extra; try it, fall back gracefully.
    try:
        # Async SqliteSaver requires a conn factory; the sync SqliteSaver is simpler
        # for our astream_events path (LangGraph handles async internally).
        from langgraph.checkpoint.sqlite import SqliteSaver

        return SqliteSaver.from_conn_string(str(_DB_PATH))
    except Exception:
        # Optional dep missing, or sqlite issues — never block the agent from running.
        return MemorySaver()


# ---------------------------------------------------------------------------
# Session registry (which sessions exist, metadata)
# ---------------------------------------------------------------------------

@dataclass
class SessionMeta:
    slug: str
    title: str = ""
    created: float = 0.0
    last_used: float = 0.0
    language: str = "en"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "SessionMeta":
        return cls(
            slug=d.get("slug", ""),
            title=d.get("title", ""),
            created=d.get("created", 0.0),
            last_used=d.get("last_used", 0.0),
            language=d.get("language", "en"),
        )


def _load_registry() -> dict[str, SessionMeta]:
    if not _REGISTRY_PATH.is_file():
        return {}
    try:
        data = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {slug: SessionMeta.from_dict(v) for slug, v in data.items()}


def _save_registry(sessions: dict[str, SessionMeta]) -> None:
    payload = {slug: m.to_dict() for slug, m in sessions.items()}
    _REGISTRY_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _slugify(text: str) -> str:
    """Turn a title into a filesystem-safe, URL-friendly slug."""
    text = re.sub(r"[^\w\s-]", "", text.lower().strip())
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")[:60] or "session"


def list_sessions() -> list[SessionMeta]:
    """All known sessions, most-recently-used first."""
    sessions = _load_registry()
    return sorted(sessions.values(), key=lambda m: m.last_used, reverse=True)


def create_session(title: str = "", language: str = "en") -> SessionMeta:
    """Register a new session and return its metadata."""
    slug = _slugify(title) if title else f"session-{int(time.time())}"
    # Guarantee uniqueness against existing slugs.
    sessions = _load_registry()
    if slug in sessions:
        slug = f"{slug}-{int(time.time()) % 100000}"
    now = time.time()
    meta = SessionMeta(slug=slug, title=title or slug, created=now, last_used=now, language=language)
    sessions[slug] = meta
    _save_registry(sessions)
    # Touch the memory file so it exists.
    memory_path(slug).touch()
    return meta


def get_session(slug: str) -> SessionMeta | None:
    return _load_registry().get(slug)


def touch_session(slug: str) -> None:
    """Mark a session as used now (call on each turn)."""
    sessions = _load_registry()
    if slug in sessions:
        sessions[slug].last_used = time.time()
        _save_registry(sessions)


def rename_session(slug: str, title: str) -> bool:
    sessions = _load_registry()
    if slug not in sessions:
        return False
    sessions[slug].title = title
    _save_registry(sessions)
    return True


def delete_session(slug: str) -> bool:
    """Remove a session from the registry and delete its memory file."""
    sessions = _load_registry()
    if slug not in sessions:
        return False
    del sessions[slug]
    _save_registry(sessions)
    path = memory_path(slug)
    if path.is_file():
        path.unlink()
    return True


# ---------------------------------------------------------------------------
# Project memory (cross-session context, agent-editable)
# ---------------------------------------------------------------------------

@dataclass
class ProjectMemory:
    """Facts worth carrying across sessions. The agent reads + updates via tools."""

    product: str = ""
    icp: str = ""  # ideal customer profile / "people like us"
    brand_voice: str = ""
    goals: list[str] = field(default_factory=list)
    decisions: list[str] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "ProjectMemory":
        return cls(
            product=d.get("product", ""),
            icp=d.get("icp", ""),
            brand_voice=d.get("brand_voice", ""),
            goals=list(d.get("goals", [])),
            decisions=list(d.get("decisions", [])),
            notes=d.get("notes", ""),
        )

    def is_empty(self) -> bool:
        return not (self.product or self.icp or self.brand_voice or self.goals
                    or self.decisions or self.notes)


def memory_path(slug: str) -> Path:
    """Filesystem path for a session's project-memory JSON."""
    return SESSIONS_DIR / f"{slug}.json"


def load_memory(slug: str) -> ProjectMemory:
    path = memory_path(slug)
    if not path.is_file():
        return ProjectMemory()
    try:
        return ProjectMemory.from_dict(json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError):
        return ProjectMemory()


def save_memory(slug: str, mem: ProjectMemory) -> None:
    path = memory_path(slug)
    path.write_text(json.dumps(mem.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")


def update_memory(slug: str, **fields) -> ProjectMemory:
    """Patch one or more fields on a session's project memory. Lists append."""
    mem = load_memory(slug)
    list_fields = {"goals", "decisions"}
    for key, value in fields.items():
        if not hasattr(mem, key):
            continue
        if key in list_fields and isinstance(value, str):
            # Append to list fields when given a string; replace when given a list.
            current = getattr(mem, key)
            if value not in current:
                current.append(value)
        else:
            setattr(mem, key, value)
    save_memory(slug, mem)
    touch_session(slug)
    return mem


def format_memory_context(slug: str, language: str = "en") -> str:
    """Render the project memory as a prompt block (empty if nothing remembered)."""
    mem = load_memory(slug)
    if mem.is_empty():
        return ""
    is_en = language.lower().startswith("en")
    lines = []
    if mem.product:
        lines.append(f"- **{'Product' if is_en else '产品'}:** {mem.product}")
    if mem.icp:
        lines.append(f"- **{'ICP / who it is for' if is_en else '目标人群 (ICP)'}:** {mem.icp}")
    if mem.brand_voice:
        lines.append(f"- **{'Brand voice' if is_en else '品牌调性'}:** {mem.brand_voice}")
    if mem.goals:
        label = "Goals" if is_en else "目标"
        lines.append(f"- **{label}:** " + "; ".join(mem.goals))
    if mem.decisions:
        label = "Past decisions" if is_en else "已定决策"
        lines.append(f"- **{label}:** " + "; ".join(mem.decisions))
    if mem.notes:
        label = "Notes" if is_en else "备注"
        lines.append(f"- **{label}:** {mem.notes}")
    header = "## Remembered from previous sessions" if is_en else "## 跨会话记忆（来自之前的对话）"
    return header + "\n\n" + "\n".join(lines) + "\n"
