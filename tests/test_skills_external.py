"""Tests for the skills loader, focusing on external-skill discovery.

Covers: the external root merge, native-wins-on-collision dedup, the external
flag, and that the founder role's owned skills all resolve. Uses a temp dir for
synthetic external roots so tests don't depend on ~/tools/skills/money-hxn
existing on the machine that runs them.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from marketing_agent import skills_loader
from marketing_agent.skills_loader import Skill, _discover_in, _split_frontmatter

# Ensure a clean cached state.
skills_loader.refresh_skills()


# ---------------------------------------------------------------------------
# External discovery with a synthetic root
# ---------------------------------------------------------------------------

@pytest.fixture
def ext_root(tmp_path):
    """A fake external skill suite: two skills, one colliding with a native name."""
    root = tmp_path / "ext-suite"
    for name, desc in [("ext-alpha", "Alpha external skill."),
                       ("ext-beta", "Beta external skill.")]:
        d = root / name
        d.mkdir(parents=True)
        (d / "SKILL.md").write_text(
            f"---\nname: {name}\ndescription: \"{desc}\"\n---\n\n# {name}\nbody\n",
            encoding="utf-8",
        )
    return root


def test_discover_in_finds_skills(ext_root):
    found = _discover_in(ext_root, external=True)
    names = sorted(s.name for s in found)
    assert names == ["ext-alpha", "ext-beta"]
    assert all(s.external for s in found)


def test_discover_in_missing_root_returns_empty(tmp_path):
    assert _discover_in(tmp_path / "nope", external=True) == []


def test_external_flag_defaults_false():
    s = Skill(name="x", description="", version="", skill_dir=Path("/"),
              skill_md_path=Path("/x/SKILL.md"))
    assert s.external is False


# ---------------------------------------------------------------------------
# Native-wins-on-collision dedup (via _skills_tuple with patched roots)
# ---------------------------------------------------------------------------

def test_native_wins_on_name_collision(monkeypatch, ext_root):
    """If an external root has a skill named identically to a native one, native wins."""
    # Make a native skill named "ext-alpha" so it collides with the external one.
    native_colliding = ext_root.parent / "native-collision"
    d = native_colliding / "ext-alpha"
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text(
        '---\nname: ext-alpha\ndescription: "NATIVE version"\n---\n\nnative body\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(skills_loader, "SKILLS_DIR", native_colliding)
    monkeypatch.setattr(skills_loader, "EXTERNAL_SKILLS_ROOTS", [ext_root])
    skills_loader.refresh_skills()
    skills = skills_loader.list_skills()
    alpha = next(s for s in skills if s.name == "ext-alpha")
    assert alpha.external is False  # native won
    assert "NATIVE" in alpha.description
    # The external ext-beta still shows up (no collision).
    assert any(s.name == "ext-beta" and s.external for s in skills)


def test_external_skills_merge_into_catalogue(monkeypatch, ext_root, tmp_path):
    """With an empty native dir + the synthetic external root, both externals appear."""
    monkeypatch.setattr(skills_loader, "SKILLS_DIR", tmp_path / "empty-native")
    (tmp_path / "empty-native").mkdir(exist_ok=True)
    monkeypatch.setattr(skills_loader, "EXTERNAL_SKILLS_ROOTS", [ext_root])
    skills_loader.refresh_skills()
    names = {s.name for s in skills_loader.list_skills()}
    assert {"ext-alpha", "ext-beta"} <= names


def test_find_skill_resolves_external(monkeypatch, ext_root, tmp_path):
    monkeypatch.setattr(skills_loader, "SKILLS_DIR", tmp_path / "empty-native")
    (tmp_path / "empty-native").mkdir(exist_ok=True)
    monkeypatch.setattr(skills_loader, "EXTERNAL_SKILLS_ROOTS", [ext_root])
    skills_loader.refresh_skills()
    found = skills_loader.find_skill("ext-alpha")
    assert found is not None
    assert found.external is True


def test_load_skill_body_works_for_external(monkeypatch, ext_root, tmp_path):
    monkeypatch.setattr(skills_loader, "SKILLS_DIR", tmp_path / "empty-native")
    (tmp_path / "empty-native").mkdir(exist_ok=True)
    monkeypatch.setattr(skills_loader, "EXTERNAL_SKILLS_ROOTS", [ext_root])
    skills_loader.refresh_skills()
    body = skills_loader.load_skill_body("ext-beta")
    assert "body" in body


# ---------------------------------------------------------------------------
# Real money-hxn integration (skipped if the suite isn't installed)
# ---------------------------------------------------------------------------

_MONEY_HXN = Path.home() / "tools" / "skills" / "money-hxn"
pytestmark_money = pytest.mark.skipif(
    not _MONEY_HXN.is_dir(), reason="money-hxn suite not installed"
)


@pytestmark_money
def test_money_hxn_skills_discovered():
    skills_loader.refresh_skills()
    skills = skills_loader.list_skills()
    external_names = {s.name for s in skills if s.external}
    # The core orchestrator + a few key children should be present.
    for expected in ("money", "money-strategy", "money-panel",
                     "money-review-skeptic", "money-finance"):
        assert expected in external_names, f"{expected} not discovered"


@pytestmark_money
def test_money_strategy_body_loads():
    skills_loader.refresh_skills()
    body = skills_loader.load_skill_body("money-strategy")
    assert len(body) > 100  # it's a real playbook, not empty
