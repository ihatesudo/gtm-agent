"""Role loader for the marketing agent.

A "role" is a YAML file under the top-level ``roles/`` folder describing one seat
on the marketing team — the Director (default base prompt) plus six switchable
specialists. Schema (see ``roles/director.yaml``)::

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


def _parse_role_yaml(path: Path) -> Role | None:
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
    )


# ---------------------------------------------------------------------------
# Listing / lookup
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _roles_tuple() -> tuple[Role, ...]:
    if not ROLES_DIR.is_dir():
        return ()
    roles = [r for r in (_parse_role_yaml(p) for p in sorted(ROLES_DIR.glob("*.yaml"))) if r]
    return tuple(sorted(roles, key=lambda r: r.name))


def refresh_roles() -> None:
    """Drop the cached role list (call after roles/ changes on disk)."""
    _roles_tuple.cache_clear()


def list_roles() -> list[Role]:
    """All roles, sorted by name. Empty list if roles/ is absent."""
    return list(_roles_tuple())


def find_role(query: str) -> Role | None:
    """Case-insensitive match on full name; falls back to a unique prefix.

    Returns None if there is no match, or if a prefix matches more than one role.
    """
    if not query:
        return None
    q = query.strip().lower()
    roles = list_roles()
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

def render_role_block(role: Role) -> str:
    """Render a role's persona + focus + toolkit as a prompt block.

    Appended after the Director base prompt when a specialist role is active.
    Compact on purpose — the deep playbooks still live in the skills themselves.
    """
    lines = [
        f"## 当前角色：{role.title}（`{role.name}`）",
        "",
        role.persona.strip(),
        "",
        f"**核心职责：** {role.core_focus}" if role.core_focus else "",
    ]
    lines = [ln for ln in lines if ln != "" or True]  # keep blank lines

    if role.owned_skills:
        lines.append("")
        lines.append("**主责技能（owned）：** " + ", ".join(role.owned_skills))
    if role.shared_skills:
        lines.append("**共享/通用技能：** " + ", ".join(role.shared_skills))
    if role.preferred_tools:
        lines.append(
            "**常用平台集成（需要 how-to 时用 read_tool_guide 拉取）：** "
            + ", ".join(role.preferred_tools)
        )
    if role.tags:
        lines.append("")
        lines.append("#" + " #".join(role.tags))
    if role.when_to_use:
        lines.append("")
        lines.append("**适用场景：**")
        lines.append(role.when_to_use.strip())
    # Drop empty strings while preserving intentional blank lines.
    return "\n".join(ln for ln in lines if ln).strip() + "\n"
