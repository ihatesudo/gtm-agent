"""Tests for all @tool functions in marketing_agent/tools.py.

Three mocking layers, each used where appropriate:
- ``monkeypatch`` of module constants (OUTPUT_DIR, _seth_index_cache) for
  file/index-backed tools.
- ``unittest.mock.patch`` at the library boundary for network tools (DuckDuckGo).
- ``unittest.mock.patch`` of the loader functions for skill/tool-guide tools.

Tools are invoked two ways:
- ``.func(...)`` — the original unwrapped callable, for typed positional calls.
- ``.invoke({...})`` — the full LangChain tool dispatch path (what the agent uses).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from marketing_agent import tools


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_output(monkeypatch, tmp_path):
    """Redirect OUTPUT_DIR to a temp dir so save/read/list never touch real files."""
    monkeypatch.setattr(tools, "OUTPUT_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def fake_seth_index(monkeypatch):
    """Inject a minimal seth_index so the Seth tools don't need the real file."""
    index = {
        "concepts": {
            "trust": [
                {"title": "On Trust", "date": "2024-01-01", "url": "https://seths.blog/x",
                 "slug": "on-trust", "line": "Trust is the only compounding asset."},
                {"title": "More Trust", "date": "2023-06-01", "url": "https://seths.blog/y",
                 "slug": "more-trust", "line": "Without trust, nothing else works."},
            ],
            "purple-cow": [
                {"title": "Be Remarkable", "date": "2020-01-01", "url": "https://seths.blog/z",
                 "slug": "be-remarkable", "line": "Be remarkable or be invisible."},
            ],
        },
        "aphorisms": [
            {"text": "Trust compounds.", "title": "On Trust", "date": "2024-01-01",
             "url": "https://seths.blog/x", "concepts": ["trust"], "score": 15},
            {"text": "Ship the work.", "title": "The Practice", "date": "2020-11-01",
             "url": "https://seths.blog/p", "concepts": ["ship"], "score": 14},
        ],
        "maxims": ["Trust is worth more than attention."],
    }
    monkeypatch.setattr(tools, "_seth_index_cache", index)
    return index


# ---------------------------------------------------------------------------
# _safe_path (internal path-traversal guard)
# ---------------------------------------------------------------------------

class TestSafePath:
    def test_strips_directory_prefix(self, tmp_output):
        p = tools._safe_path("../../etc/passwd")
        assert p.parent == tmp_output
        assert p.name == "passwd"

    def test_empty_name_raises(self, tmp_output):
        with pytest.raises(ValueError):
            tools._safe_path("")


# ---------------------------------------------------------------------------
# save_asset / read_asset / list_assets
# ---------------------------------------------------------------------------

class TestAssetTools:
    def test_save_writes_file_and_returns_message(self, tmp_output):
        result = tools.save_asset.invoke({"filename": "copy.md", "content": "hello"})
        assert "Saved" in result
        assert "copy.md" in result
        assert (tmp_output / "copy.md").read_text() == "hello"

    def test_save_via_func_typed(self, tmp_output):
        tools.save_asset.func("strategy.md", "content here")
        assert (tmp_output / "strategy.md").exists()

    def test_read_returns_content(self, tmp_output):
        tools.save_asset.invoke({"filename": "x.md", "content": "data"})
        assert tools.read_asset.invoke({"filename": "x.md"}) == "data"

    def test_read_missing_returns_not_found(self, tmp_output):
        result = tools.read_asset.invoke({"filename": "nope.md"})
        assert "not found" in result.lower()

    def test_list_empty(self, tmp_output):
        result = tools.list_assets.invoke({})
        assert "no saved assets" in result.lower()

    def test_list_sorted(self, tmp_output):
        tools.save_asset.invoke({"filename": "b.md", "content": "1"})
        tools.save_asset.invoke({"filename": "a.md", "content": "2"})
        result = tools.list_assets.invoke({})
        lines = result.strip().split("\n")
        assert lines[0] == "a.md"
        assert lines[1] == "b.md"

    def test_save_rejects_path_traversal(self, tmp_output):
        # The _safe_path guard means "../../etc/evil" lands safely in OUTPUT_DIR.
        tools.save_asset.invoke({"filename": "../../evil.txt", "content": "x"})
        assert (tmp_output / "evil.txt").exists()
        assert not Path("/evil.txt").exists()


# ---------------------------------------------------------------------------
# web_search (mock DuckDuckGo at the boundary)
# ---------------------------------------------------------------------------

class TestWebSearch:
    @patch("langchain_community.tools.DuckDuckGoSearchRun")
    def test_returns_results_on_success(self, mock_ddg_cls):
        mock_instance = MagicMock()
        mock_instance.invoke.return_value = "Gemini is a Google AI model."
        mock_ddg_cls.return_value = mock_instance

        result = tools.web_search.invoke({"query": "gemini"})
        assert "Gemini" in result
        mock_instance.invoke.assert_called_once_with("gemini")

    @patch("langchain_community.tools.DuckDuckGoSearchRun")
    def test_returns_fallback_on_exception(self, mock_ddg_cls):
        mock_instance = MagicMock()
        mock_instance.invoke.side_effect = RuntimeError("rate limited")
        mock_ddg_cls.return_value = mock_instance

        result = tools.web_search.invoke({"query": "anything"})
        assert "web_search failed" in result
        assert "rate limited" in result


# ---------------------------------------------------------------------------
# list_skills / read_skill_reference / read_tool_guide (mock the loaders)
# ---------------------------------------------------------------------------

class TestSkillGuideTools:
    # These tools do `from . import skills_loader` inside the function body,
    # so we must patch the actual skills_loader module, not tools.skills_loader.

    def test_list_skills_formats_output(self):
        from marketing_agent import skills_loader
        from marketing_agent.skills_loader import Skill
        fake_skill = Skill(name="ads", description="Write ad copy.", version="1.0.0",
                           skill_dir=Path("/tmp"), skill_md_path=Path("/tmp/SKILL.md"))
        with patch.object(skills_loader, "list_skills", return_value=[fake_skill]), \
             patch.object(skills_loader, "short_description", side_effect=lambda d, **k: d):
            result = tools.list_skills.invoke({})
        assert "ads" in result
        assert "Write ad copy" in result

    def test_list_skills_empty(self):
        from marketing_agent import skills_loader
        with patch.object(skills_loader, "list_skills", return_value=[]):
            result = tools.list_skills.invoke({})
        assert "no skills" in result.lower()

    def test_read_skill_reference_success(self):
        from marketing_agent import skills_loader
        with patch.object(skills_loader, "load_skill_reference", return_value="playbook content"):
            result = tools.read_skill_reference.invoke({"skill_name": "ads", "filename": "x.md"})
        assert result == "playbook content"

    def test_read_skill_reference_unknown_skill(self):
        from marketing_agent import skills_loader
        with patch.object(skills_loader, "load_skill_reference", side_effect=KeyError("ads")), \
             patch.object(skills_loader, "find_skill", return_value=None):
            result = tools.read_skill_reference.invoke({"skill_name": "ads", "filename": "x.md"})
        assert "Unknown skill" in result

    def test_read_skill_reference_missing_file(self):
        from marketing_agent import skills_loader
        with patch.object(skills_loader, "load_skill_reference", side_effect=FileNotFoundError("not found")), \
             patch.object(skills_loader, "list_skill_references", return_value=["a.md", "b.md"]), \
             patch.object(skills_loader, "find_skill", return_value=MagicMock()):
            result = tools.read_skill_reference.invoke({"skill_name": "ads", "filename": "x.md"})
        assert "not found" in result.lower() or "Available" in result

    def test_read_tool_guide_success(self):
        from marketing_agent import skills_loader
        with patch.object(skills_loader, "load_tool_guide", return_value="setup guide"):
            result = tools.read_tool_guide.invoke({"filename": "postal.md"})
        assert result == "setup guide"

    def test_read_tool_guide_missing_truncates_hint(self):
        from marketing_agent import skills_loader
        with patch.object(skills_loader, "load_tool_guide", side_effect=FileNotFoundError("nope")), \
             patch.object(skills_loader, "list_tool_guides", return_value=[f"tool{i}.md" for i in range(30)]):
            result = tools.read_tool_guide.invoke({"filename": "missing.md"})
        assert "…" in result  # truncation marker for >25 items


# ---------------------------------------------------------------------------
# lookup_seth_post
# ---------------------------------------------------------------------------

class TestLookupSethPost:
    def test_exact_concept_match(self, fake_seth_index):
        result = tools.lookup_seth_post.invoke({"concept": "trust", "limit": 2})
        assert "trust" in result
        assert "On Trust" in result
        assert "compounding" in result

    def test_prefix_match(self, fake_seth_index):
        result = tools.lookup_seth_post.invoke({"concept": "purple", "limit": 1})
        assert "purple-cow" in result
        assert "Remarkable" in result

    def test_unknown_concept_lists_valid(self, fake_seth_index):
        result = tools.lookup_seth_post.invoke({"concept": "nonexistent", "limit": 3})
        assert "Unknown concept" in result
        assert "trust" in result  # valid list includes known concepts

    def test_limit_clamped_to_max_5(self, fake_seth_index):
        result = tools.lookup_seth_post.invoke({"concept": "trust", "limit": 100})
        # Should say "showing 2" (only 2 in fake index), not attempt 100.
        assert "showing 2" in result

    def test_limit_clamped_to_min_1(self, fake_seth_index):
        result = tools.lookup_seth_post.invoke({"concept": "trust", "limit": 0})
        assert "showing 1" in result

    def test_missing_index_returns_error(self, monkeypatch):
        # Force the index to be unloaded and the path to not exist.
        monkeypatch.setattr(tools, "_seth_index_cache", None)
        monkeypatch.setattr(tools, "_SETH_INDEX_PATH", Path("/nonexistent/seth_index.json"))
        result = tools.lookup_seth_post.invoke({"concept": "trust"})
        assert "not found" in result.lower() or "Run:" in result


# ---------------------------------------------------------------------------
# seth_quote_of_the_day
# ---------------------------------------------------------------------------

class TestSethQuoteOfTheDay:
    def test_returns_quote_and_reframe(self, fake_seth_index):
        result = tools.seth_quote_of_the_day.invoke({})
        assert "Today's Seth" in result
        assert "Today:" in result  # the reframe line

    def test_includes_url(self, fake_seth_index):
        result = tools.seth_quote_of_the_day.invoke({})
        assert "seths.blog" in result

    def test_deterministic_same_day(self, fake_seth_index):
        r1 = tools.seth_quote_of_the_day.invoke({})
        r2 = tools.seth_quote_of_the_day.invoke({})
        # Same day → same quote.
        assert r1 == r2

    def test_empty_aphorisms(self, monkeypatch):
        monkeypatch.setattr(tools, "_seth_index_cache", {"concepts": {}, "aphorisms": []})
        result = tools.seth_quote_of_the_day.invoke({})
        assert "No aphorisms" in result


# ---------------------------------------------------------------------------
# remember / recall (session memory tools)
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_sessions_for_tools(monkeypatch, tmp_path):
    """Redirect session storage for the memory tools."""
    from marketing_agent import session
    monkeypatch.setattr(session, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(session, "_DB_PATH", tmp_path / "memory.db")
    monkeypatch.setattr(session, "_REGISTRY_PATH", tmp_path / "sessions.json")
    tmp_path.mkdir(parents=True, exist_ok=True)
    return tmp_path


class TestRememberRecall:
    def test_remember_requires_session(self):
        result = tools.remember.invoke(
            {"product": "X"}, config={"configurable": {}}
        )
        assert "no active session" in result

    def test_remember_saves_and_reports(self, tmp_sessions_for_tools):
        from marketing_agent import session
        m = session.create_session(title="test")
        result = tools.remember.invoke(
            {"product": "Acme", "icp": "founders"},
            config={"configurable": {"session_slug": m.slug}},
        )
        assert "Saved to memory" in result
        mem = session.load_memory(m.slug)
        assert mem.product == "Acme"
        assert mem.icp == "founders"

    def test_remember_goal_maps_to_goals_list(self, tmp_sessions_for_tools):
        from marketing_agent import session
        m = session.create_session(title="test")
        tools.remember.invoke(
            {"goal": "100 signups"},
            config={"configurable": {"session_slug": m.slug}},
        )
        mem = session.load_memory(m.slug)
        assert "100 signups" in mem.goals

    def test_remember_nothing_to_save(self, tmp_sessions_for_tools):
        from marketing_agent import session
        m = session.create_session(title="test")
        result = tools.remember.invoke(
            {}, config={"configurable": {"session_slug": m.slug}}
        )
        assert "nothing to save" in result

    def test_remember_reads_thread_id_fallback(self, tmp_sessions_for_tools):
        """If session_slug is absent, fall back to thread_id."""
        from marketing_agent import session
        m = session.create_session(title="thread")
        result = tools.remember.invoke(
            {"product": "via-thread"},
            config={"configurable": {"thread_id": m.slug}},  # no session_slug key
        )
        assert "Saved" in result
        assert session.load_memory(m.slug).product == "via-thread"

    def test_recall_returns_json(self, tmp_sessions_for_tools):
        from marketing_agent import session
        m = session.create_session(title="recall")
        session.update_memory(m.slug, product="X", icp="Y")
        result = tools.recall.invoke(
            {}, config={"configurable": {"session_slug": m.slug}}
        )
        data = json.loads(result)
        assert data["product"] == "X"
        assert data["icp"] == "Y"

    def test_recall_no_session(self):
        result = tools.recall.invoke({}, config={"configurable": {}})
        assert "no active session" in result

    def test_recall_empty_memory(self, tmp_sessions_for_tools):
        from marketing_agent import session
        m = session.create_session(title="empty")
        result = tools.recall.invoke(
            {}, config={"configurable": {"session_slug": m.slug}}
        )
        assert "nothing remembered" in result


# ---------------------------------------------------------------------------
# ALL_TOOLS export sanity
# ---------------------------------------------------------------------------

class TestAllTools:
    def test_all_expected_tools_present(self):
        names = {t.name for t in tools.ALL_TOOLS}
        expected = {"web_search", "save_asset", "read_asset", "list_assets",
                    "list_skills", "read_skill_reference", "read_tool_guide",
                    "lookup_seth_post", "seth_quote_of_the_day",
                    "remember", "recall"}
        assert expected <= names

    def test_tool_count(self):
        assert len(tools.ALL_TOOLS) >= 11
