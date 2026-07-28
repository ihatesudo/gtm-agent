"""Tests for the session + memory module.

Uses a temp directory so tests never touch the real .sessions/ state.
The checkpointer (langgraph) is tested separately — here we cover the
session registry and project-memory logic, which is the agent-editable surface.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from marketing_agent import session


@pytest.fixture
def tmp_sessions(monkeypatch, tmp_path):
    """Redirect the session module's storage into a temp dir."""
    monkeypatch.setattr(session, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(session, "_DB_PATH", tmp_path / "memory.db")
    monkeypatch.setattr(session, "_REGISTRY_PATH", tmp_path / "sessions.json")
    (tmp_path).mkdir(parents=True, exist_ok=True)
    return tmp_path


# ---------------------------------------------------------------------------
# Session registry
# ---------------------------------------------------------------------------

class TestSessionRegistry:
    def test_create_returns_meta_with_slug(self, tmp_sessions):
        m = session.create_session(title="Q3 Launch")
        assert m.slug == "q3-launch"
        assert m.title == "Q3 Launch"
        assert m.created > 0
        assert m.last_used > 0

    def test_create_slugifies_special_chars(self, tmp_sessions):
        m = session.create_session(title="My App: 2026!!!")
        assert m.slug == "my-app-2026"
        assert all(c not in m.slug for c in ":!")

    def test_create_empty_title_uses_timestamp(self, tmp_sessions):
        m = session.create_session()
        assert m.slug.startswith("session-")

    def test_list_returns_most_recent_first(self, tmp_sessions):
        a = session.create_session(title="oldest")
        # Force a.time forward by editing registry directly.
        import time
        session._load_registry()[a.slug].last_used = time.time() - 100
        session._save_registry(session._load_registry())
        b = session.create_session(title="newest")
        listed = session.list_sessions()
        assert listed[0].slug == b.slug

    def test_get_session(self, tmp_sessions):
        session.create_session(title="findme")
        assert session.get_session("findme") is not None
        assert session.get_session("nonexistent") is None

    def test_touch_updates_last_used(self, tmp_sessions):
        m = session.create_session(title="touch")
        original = session.get_session(m.slug).last_used
        import time
        time.sleep(0.01)
        session.touch_session(m.slug)
        assert session.get_session(m.slug).last_used > original

    def test_rename(self, tmp_sessions):
        m = session.create_session(title="old name")
        assert session.rename_session(m.slug, "new name")
        assert session.get_session(m.slug).title == "new name"
        assert not session.rename_session("nope", "x")

    def test_delete_removes_registry_and_memory(self, tmp_sessions):
        m = session.create_session(title="deleteme")
        session.update_memory(m.slug, product="X")
        assert session.memory_path(m.slug).is_file()
        assert session.delete_session(m.slug)
        assert session.get_session(m.slug) is None
        assert not session.memory_path(m.slug).is_file()
        assert not session.delete_session(m.slug)


# ---------------------------------------------------------------------------
# Project memory
# ---------------------------------------------------------------------------

class TestProjectMemory:
    def test_load_empty_when_no_file(self, tmp_sessions):
        mem = session.load_memory("never-created")
        assert mem.is_empty()
        assert mem.product == ""

    def test_update_and_load_roundtrip(self, tmp_sessions):
        m = session.create_session(title="mem")
        session.update_memory(m.slug, product="Acme", icp="founders", brand_voice="bold")
        mem = session.load_memory(m.slug)
        assert mem.product == "Acme"
        assert mem.icp == "founders"
        assert mem.brand_voice == "bold"

    def test_goals_append_not_replace(self, tmp_sessions):
        m = session.create_session(title="goals")
        session.update_memory(m.slug, goals="goal one")
        session.update_memory(m.slug, goals="goal two")
        mem = session.load_memory(m.slug)
        assert mem.goals == ["goal one", "goal two"]

    def test_decisions_append_not_replace(self, tmp_sessions):
        m = session.create_session(title="dec")
        session.update_memory(m.slug, decisions="dec A")
        session.update_memory(m.slug, decisions="dec B")
        mem = session.load_memory(m.slug)
        assert mem.decisions == ["dec A", "dec B"]

    def test_duplicate_goal_not_appended(self, tmp_sessions):
        m = session.create_session(title="dup")
        session.update_memory(m.slug, goals="same")
        session.update_memory(m.slug, goals="same")
        assert session.load_memory(m.slug).goals == ["same"]

    def test_product_replaces_not_appends(self, tmp_sessions):
        m = session.create_session(title="rep")
        session.update_memory(m.slug, product="v1")
        session.update_memory(m.slug, product="v2")
        assert session.load_memory(m.slug).product == "v2"

    def test_unknown_field_ignored(self, tmp_sessions):
        m = session.create_session(title="unknown")
        session.update_memory(m.slug, nonsense="x", product="real")
        mem = session.load_memory(m.slug)
        assert mem.product == "real"
        assert not hasattr(mem, "nonsense")


class TestFormatMemoryContext:
    def test_empty_returns_empty_string(self, tmp_sessions):
        session.create_session(title="empty")
        assert session.format_memory_context("empty") == ""

    def test_english_labels(self, tmp_sessions):
        m = session.create_session(title="ctx")
        session.update_memory(m.slug, product="Acme", icp="solo founders")
        ctx = session.format_memory_context(m.slug, "en")
        assert "Product" in ctx
        assert "Acme" in ctx
        assert "ICP" in ctx

    def test_chinese_labels(self, tmp_sessions):
        m = session.create_session(title="ctxzh")
        session.update_memory(m.slug, product="Acme", goals=["grow"])
        ctx = session.format_memory_context(m.slug, "zh")
        assert "产品" in ctx
        assert "目标" in ctx

    def test_goals_rendered_as_semicolon_list(self, tmp_sessions):
        m = session.create_session(title="goalsfmt")
        session.update_memory(m.slug, goals="a", )
        session.update_memory(m.slug, goals="b")
        ctx = session.format_memory_context(m.slug, "en")
        assert "a; b" in ctx


class TestProjectMemoryDataclass:
    def test_is_empty_true_for_defaults(self):
        assert session.ProjectMemory().is_empty()

    def test_is_empty_false_with_product(self):
        assert not session.ProjectMemory(product="x").is_empty()

    def test_to_from_dict_roundtrip(self):
        m = session.ProjectMemory(product="p", icp="i", goals=["g"], decisions=["d"], notes="n")
        d = m.to_dict()
        assert session.ProjectMemory.from_dict(d) == m
