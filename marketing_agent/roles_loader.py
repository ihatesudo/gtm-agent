"""Role loader for the marketing agent.

A "role" is a YAML file under the top-level ``roles/`` folder describing one seat
on the marketing team — the Director (default base prompt) plus switchable
specialists. Each role exists in **two language variants**, one file per language::

    roles/<name>.<lang>.yaml      e.g. roles/seo.en.yaml, roles/seo.zh.yaml

The loader resolves which variant to read based on a ``language`` argument
("en" / "zh"), defaulting to English. Schema (see ``roles/director.en.yaml``)::

    version: 1
    role:
      name: paid-search
      title: "Paid Search Specialist (SEM / Google Ads)"
      persona: |
        ...
      core_focus: "..."
      tags: [GoogleAds, PPC, ...]
      owned_skills: [ads]
      shared_skills: [analytics, ab-testing, cro]
      preferred_tools: [google-ads, ga4]
      when_to_use: |
        ...

PyYAML is already a transitive dependency in this project, so we use it for robust
parsing (the role files use multiline scalars and nested lists).

Like ``skills_loader``, this module is I/O-only: no prompts, no prints.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

_ROOT = Path(__file__).resolve().parent.parent
ROLES_DIR = _ROOT / "roles"

# Supported languages, in preference order for fallback. English is the default
# and the canonical fallback (every role must ship an .en.yaml).
_DEFAULT_LANG = "en"


def _normalize_lang(language: str | None) -> str:
    if not language:
        return _DEFAULT_LANG
    low = language.strip().lower()
    # Accept "english"/"eng" -> "en", "chinese"/"zhongwen"/"cn" -> "zh".
    if low.startswith("en"):
        return "en"
    if low.startswith("zh") or low in ("cn", "chinese"):
        return "zh"
    return _DEFAULT_LANG


@dataclass(frozen=True)
class Role:
    name: str
    title: str
    persona: str
    core_focus: str
    tags: tuple[str, ...] = ()
    orchestrates: tuple[str, ...] = ()
    owned_skills: tuple[str, ...] = ()
    shared_skills: tuple[str, ...] = ()
    preferred_tools: tuple[str, ...] = ()
    when_to_use: str = ""
    yaml_path: Path = field(default_factory=lambda: Path())
    language: str = _DEFAULT_LANG

    @property
    def all_skills(self) -> tuple[str, ...]:
        """owned + shared, de-duplicated, order-preserving."""
        seen: set[str] = set()
        out: list[str] = []
        for s in (*self.owned_skills, *self.shared_skills):
            if s not in seen:
                seen.add(s)
                out.append(s)
        return tuple(out)


def _as_str(val: object) -> str:
    return str(val).strip() if val is not None else ""


def _as_tuple(val: object) -> tuple[str, ...]:
    if not val:
        return ()
    if isinstance(val, str):
        # Allow a comma/space separated string fallback.
        return tuple(p.strip() for p in val.replace(",", " ").split() if p.strip())
    if isinstance(val, (list, tuple)):
        return tuple(str(v).strip() for v in val if str(v).strip())
    return ()


def _parse_role_yaml(path: Path, language: str) -> Role | None:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return None
    block = data.get("role") if isinstance(data, dict) else None
    if not isinstance(block, dict):
        return None
    name = _as_str(block.get("name")) or path.stem
    return Role(
        name=name,
        title=_as_str(block.get("title")) or name,
        persona=_as_str(block.get("persona")),
        core_focus=_as_str(block.get("core_focus")),
        tags=_as_tuple(block.get("tags")),
        orchestrates=_as_tuple(block.get("orchestrates")),
        owned_skills=_as_tuple(block.get("owned_skills")),
        shared_skills=_as_tuple(block.get("shared_skills")),
        preferred_tools=_as_tuple(block.get("preferred_tools")),
        when_to_use=_as_str(block.get("when_to_use")),
        yaml_path=path,
        language=language,
    )


# ---------------------------------------------------------------------------
# Discovery + variant resolution
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _all_role_files() -> tuple[Path, ...]:
    """Every ``roles/*.yaml`` file, sorted."""
    if not ROLES_DIR.is_dir():
        return ()
    return tuple(sorted(p for p in ROLES_DIR.glob("*.yaml") if p.is_file()))


def _role_names() -> tuple[str, ...]:
    """Distinct role names (the ``<name>`` before the language suffix)."""
    names: list[str] = []
    seen: set[str] = set()
    for p in _all_role_files():
        stem = p.stem  # e.g. "seo.en" or "seo.zh"
        name = stem.rsplit(".", 1)[0] if "." in stem else stem
        if name not in seen:
            seen.add(name)
            names.append(name)
    return tuple(names)


def _resolve_file(name: str, language: str) -> Path | None:
    """Pick the YAML file for ``name`` in ``language``, with EN fallback.

    Resolution order: exact language -> English (canonical fallback) -> any variant.
    """
    lang = _normalize_lang(language)
    files = _all_role_files()
    # Exact language match.
    for p in files:
        if p.stem == f"{name}.{lang}":
            return p
    # Fallback to English (every role is expected to ship an .en.yaml).
    if lang != "en":
        for p in files:
            if p.stem == f"{name}.en":
                return p
    # Last resort: any variant of this role.
    for p in files:
        stem = p.stem
        parsed_name = stem.rsplit(".", 1)[0] if "." in stem else stem
        if parsed_name == name:
            return p
    return None


# ---------------------------------------------------------------------------
# Listing / lookup
# ---------------------------------------------------------------------------

@lru_cache(maxsize=8)
def _roles_tuple(language: str = _DEFAULT_LANG) -> tuple[Role, ...]:
    roles: list[Role] = []
    for name in _role_names():
        path = _resolve_file(name, language)
        if path is None:
            continue
        r = _parse_role_yaml(path, _normalize_lang(language))
        if r is not None:
            roles.append(r)
    return tuple(sorted(roles, key=lambda r: r.name))


def refresh_roles() -> None:
    """Drop the cached role list (call after roles/ changes on disk)."""
    _all_role_files.cache_clear()
    _roles_tuple.cache_clear()


def list_roles(language: str = _DEFAULT_LANG) -> list[Role]:
    """All roles for ``language`` (default English), sorted by name."""
    return list(_roles_tuple(language))


def find_role(query: str, language: str = _DEFAULT_LANG) -> Role | None:
    """Case-insensitive match on full name; falls back to a unique prefix.

    Returns None if there is no match, or if a prefix matches more than one role.
    """
    if not query:
        return None
    q = query.strip().lower()
    roles = list_roles(language)
    for r in roles:
        if r.name.lower() == q:
            return r
    prefix_hits = [r for r in roles if r.name.lower().startswith(q)]
    if len(prefix_hits) == 1:
        return prefix_hits[0]
    return None


# ---------------------------------------------------------------------------
# Prompt composition
# ---------------------------------------------------------------------------

def render_role_block(role: Role, language: str = _DEFAULT_LANG) -> str:
    """Render a role's persona + focus + toolkit as a prompt block.

    Appended after the Director base prompt when a specialist role is active.
    Compact on purpose — the deep playbooks still live in the skills themselves.

    Structural labels (section headers) switch language; the persona / core_focus
    / when_to_use body comes from the role's own YAML variant and is already in
    the right language.
    """
    is_english = _normalize_lang(language) == "en"
    persona = role.persona.strip()
    core_focus = role.core_focus.strip()
    when_to_use = role.when_to_use.strip()
    lines = [
        (f"## Active role: {role.title} (`{role.name}`)" if is_english
         else f"## 当前角色：{role.title}（`{role.name}`）"),
        "",
        persona,
    ]
    if core_focus:
        lines.append("")
        lines.append(
            (f"**Core focus:** {core_focus}" if is_english
             else f"**核心职责：** {core_focus}")
        )
    if role.owned_skills:
        lines.append("")
        lines.append(
            ("**Owned skills:** " if is_english else "**主责技能（owned）：** ")
            + ", ".join(role.owned_skills)
        )
    if role.shared_skills:
        lines.append(
            ("**Shared skills:** " if is_english else "**共享/通用技能：** ")
            + ", ".join(role.shared_skills)
        )
    if role.preferred_tools:
        lines.append(
            ("**Preferred platform integrations (use `read_tool_guide` for setup details):** "
             if is_english
             else "**常用平台集成（需要 how-to 时用 read_tool_guide 拉取）：** ")
            + ", ".join(role.preferred_tools)
        )
    if role.tags:
        lines.append("")
        lines.append("#" + " #".join(role.tags))
    if when_to_use:
        lines.append("")
        lines.append("**When to use:**" if is_english else "**适用场景：**")
        lines.append(when_to_use)
    return "\n".join(ln for ln in lines if ln).strip() + "\n"
