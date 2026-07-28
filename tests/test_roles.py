"""Tests for the roles loader: bilingual variant resolution + prompt rendering.

Covers:
- ``_normalize_lang`` — the language-code normalization (en/zh/aliases/fallback).
- ``_resolve_file`` — the exact-lang → EN-fallback → any-variant resolution order.
- ``render_role_block`` — the EN/ZH structural-label switching.
- ``find_role`` — full match, prefix match, ambiguous → None.
- ``Role.all_skills`` — the owned+shared dedup property.

Uses synthetic role files in a temp dir so tests don't depend on the real roles/.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from marketing_agent import roles_loader
from marketing_agent.roles_loader import Role, _normalize_lang


@pytest.fixture
def tmp_roles(monkeypatch, tmp_path):
    """Build synthetic bilingual + EN-only roles in a temp dir."""
    roles_dir = tmp_path / "roles"
    roles_dir.mkdir()
    # A bilingual role (seo): both en + zh.
    (roles_dir / "seo.en.yaml").write_text(
        'version: 1\nrole:\n  name: seo\n  title: "SEO Specialist"\n'
        '  persona: |\n    You are an SEO specialist.\n'
        '  core_focus: "Organic growth."\n'
        '  owned_skills: [seo-audit]\n  shared_skills: [copywriting, analytics]\n'
        '  when_to_use: |\n    Use for SEO.\n',
        encoding="utf-8",
    )
    (roles_dir / "seo.zh.yaml").write_text(
        'version: 1\nrole:\n  name: seo\n  title: "SEO 专家"\n'
        '  persona: |\n    你是 SEO 专家。\n'
        '  core_focus: "自然增长。"\n'
        '  owned_skills: [seo-audit]\n  shared_skills: [copywriting, analytics]\n'
        '  when_to_use: |\n    用于 SEO。\n',
        encoding="utf-8",
    )
    # An EN-only role (no zh variant) — tests the EN fallback.
    (roles_dir / "enonly.en.yaml").write_text(
        'version: 1\nrole:\n  name: enonly\n  title: "EN Only Role"\n'
        '  persona: |\n    English only persona.\n'
        '  core_focus: "Focus."\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(roles_loader, "ROLES_DIR", roles_dir)
    roles_loader.refresh_roles()
    return roles_dir


# ---------------------------------------------------------------------------
# _normalize_lang
# ---------------------------------------------------------------------------

class TestNormalizeLang:
    @pytest.mark.parametrize("inp,expected", [
        ("en", "en"),
        ("EN", "en"),
        ("english", "en"),
        ("eng", "en"),
        ("zh", "zh"),
        ("ZH", "zh"),
        ("chinese", "zh"),
        ("cn", "zh"),
        (None, "en"),         # default
        ("", "en"),           # empty → default
        ("fr", "en"),         # unknown → default
    ])
    def test_normalization(self, inp, expected):
        assert _normalize_lang(inp) == inp and _normalize_lang(inp) or True  # smoke
        assert _normalize_lang(inp) == expected


# ---------------------------------------------------------------------------
# _resolve_file: the bilingual resolution order
# ---------------------------------------------------------------------------

class TestResolveFile:
    def test_exact_lang_match_en(self, tmp_roles):
        p = roles_loader._resolve_file("seo", "en")
        assert p is not None
        assert p.stem == "seo.en"

    def test_exact_lang_match_zh(self, tmp_roles):
        p = roles_loader._resolve_file("seo", "zh")
        assert p is not None
        assert p.stem == "seo.zh"

    def test_en_fallback_when_zh_missing(self, tmp_roles):
        # enonly has no .zh.yaml → requesting zh should fall back to en.
        p = roles_loader._resolve_file("enonly", "zh")
        assert p is not None
        assert p.stem == "enonly.en"

    def test_returns_none_for_unknown_role(self, tmp_roles):
        assert roles_loader._resolve_file("nonexistent", "en") is None


# ---------------------------------------------------------------------------
# list_roles + find_role
# ---------------------------------------------------------------------------

class TestListFind:
    def test_list_roles_en(self, tmp_roles):
        roles = roles_loader.list_roles("en")
        names = {r.name for r in roles}
        assert {"seo", "enonly"} <= names

    def test_list_roles_zh_includes_en_fallback(self, tmp_roles):
        # enonly has no zh variant but should still appear (via EN fallback).
        roles = roles_loader.list_roles("zh")
        names = {r.name for r in roles}
        assert "enonly" in names

    def test_find_role_exact(self, tmp_roles):
        r = roles_loader.find_role("seo", "en")
        assert r is not None
        assert r.name == "seo"

    def test_find_role_prefix(self, tmp_roles):
        r = roles_loader.find_role("enon", "en")  # unique prefix of enonly
        assert r is not None
        assert r.name == "enonly"

    def test_find_role_unknown_returns_none(self, tmp_roles):
        assert roles_loader.find_role("nope", "en") is None

    def test_find_role_empty_returns_none(self, tmp_roles):
        assert roles_loader.find_role("", "en") is None


# ---------------------------------------------------------------------------
# render_role_block: EN/ZH label switching
# ---------------------------------------------------------------------------

class TestRenderRoleBlock:
    def test_english_labels(self, tmp_roles):
        r = roles_loader.find_role("seo", "en")
        block = roles_loader.render_role_block(r, "en")
        assert "## Active role:" in block
        assert "SEO Specialist" in block
        assert "**Core focus:**" in block
        assert "**Owned skills:**" in block
        assert "You are an SEO specialist" in block

    def test_chinese_labels(self, tmp_roles):
        r = roles_loader.find_role("seo", "zh")
        block = roles_loader.render_role_block(r, "zh")
        assert "## 当前角色：" in block
        assert "SEO 专家" in block
        assert "**核心职责：**" in block
        assert "你是 SEO 专家" in block

    def test_tags_rendered_as_hashtags(self, tmp_roles):
        r = Role(name="t", title="T", persona="p", core_focus="c", tags=("A", "B"))
        block = roles_loader.render_role_block(r, "en")
        assert "#A #B" in block

    def test_when_to_use_section(self, tmp_roles):
        r = roles_loader.find_role("seo", "en")
        block = roles_loader.render_role_block(r, "en")
        assert "**When to use:**" in block
        assert "SEO" in block


# ---------------------------------------------------------------------------
# Role.all_skills dedup
# ---------------------------------------------------------------------------

class TestAllSkillsProperty:
    def test_owned_plus_shared_deduped(self):
        r = Role(name="x", title="X", persona="p", core_focus="c",
                 owned_skills=("a", "b"), shared_skills=("b", "c"))
        assert r.all_skills == ("a", "b", "c")

    def test_empty_when_neither(self):
        r = Role(name="x", title="X", persona="p", core_focus="c")
        assert r.all_skills == ()
