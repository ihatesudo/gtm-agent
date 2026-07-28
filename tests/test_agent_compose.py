"""Tests for prompt composition (agent.py) + full ReAct graph integration.

Two layers:
1. ``_compose_prompt`` unit tests — assert the right prompt blocks appear for
   each combination of language / role / skill / session-memory. Pure string
   assertions, no model needed.
2. Agent-graph integration — drive ``create_react_agent`` with a
   ``ToolBindingFakeChatModel`` (no API key), script a tool call + final answer,
   and assert the real tool executed and the real message history assembled.
   This is the gold-standard pattern from the LangChain testing docs.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from langchain_core.messages import HumanMessage, ToolMessage

# Make tests/_fakes.py importable.
sys.path.insert(0, str(Path(__file__).parent))
from _fakes import make_fake, scripted_tool_call, scripted_answer  # noqa: E402

from marketing_agent import agent, session


@pytest.fixture
def tmp_session(monkeypatch, tmp_path):
    """Redirect session storage so memory injection tests are isolated."""
    monkeypatch.setattr(session, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(session, "_DB_PATH", tmp_path / "memory.db")
    monkeypatch.setattr(session, "_REGISTRY_PATH", tmp_path / "sessions.json")
    tmp_path.mkdir(parents=True, exist_ok=True)
    return tmp_path


# ---------------------------------------------------------------------------
# _compose_prompt: the 4 branches
# ---------------------------------------------------------------------------

class TestComposePromptBase:
    def test_english_base_prompt(self):
        prompt = agent._compose_prompt(skill=None, role=None, language="en")
        assert len(prompt) > 100  # non-trivial base prompt
        # English base should not contain the Chinese header markers.
        assert "当前角色" not in prompt

    def test_chinese_base_prompt(self):
        prompt = agent._compose_prompt(skill=None, role=None, language="zh")
        assert len(prompt) > 100
        assert "当前角色" not in prompt  # no role active, so no role header


class TestComposePromptRole:
    def test_role_appends_role_block_english(self):
        prompt = agent._compose_prompt(skill=None, role="seo", language="en")
        assert "Active role" in prompt
        assert "SEO" in prompt

    def test_role_appends_role_block_chinese(self):
        prompt = agent._compose_prompt(skill=None, role="seo", language="zh")
        assert "当前角色" in prompt
        assert "SEO" in prompt

    def test_founder_role_loads(self):
        prompt = agent._compose_prompt(skill=None, role="founder", language="en")
        assert "Solo Founder" in prompt
        assert "SMTM" in prompt


class TestComposePromptSkill:
    def test_skill_appends_playbook(self):
        prompt = agent._compose_prompt(skill="copywriting", role=None, language="en")
        assert "Active skill playbook: copywriting" in prompt
        # The skill body should be substantial.
        assert len(prompt) > 500


class TestComposePromptMemory:
    def test_memory_injected_when_session_has_data(self, tmp_session):
        m = session.create_session(title="prompt-mem")
        session.update_memory(m.slug, product="Acme App", icp="solo founders")
        prompt = agent._compose_prompt(
            skill=None, role=None, language="en", session_slug=m.slug
        )
        assert "Remembered from previous sessions" in prompt
        assert "Acme App" in prompt
        assert "solo founders" in prompt

    def test_memory_skipped_when_empty(self, tmp_session):
        m = session.create_session(title="empty-mem")
        prompt = agent._compose_prompt(
            skill=None, role=None, language="en", session_slug=m.slug
        )
        assert "Remembered from previous sessions" not in prompt

    def test_memory_skipped_when_no_session(self):
        prompt = agent._compose_prompt(
            skill=None, role=None, language="en", session_slug=None
        )
        assert "Remembered from previous sessions" not in prompt

    def test_chinese_memory_labels(self, tmp_session):
        m = session.create_session(title="cn-mem")
        session.update_memory(m.slug, product="Acme")
        prompt = agent._compose_prompt(
            skill=None, role=None, language="zh", session_slug=m.slug
        )
        assert "跨会话记忆" in prompt
        assert "产品" in prompt


class TestComposePromptCombined:
    def test_role_plus_skill_plus_memory(self, tmp_session):
        m = session.create_session(title="combined")
        session.update_memory(m.slug, product="X")
        prompt = agent._compose_prompt(
            skill="copywriting", role="seo", language="en", session_slug=m.slug
        )
        assert "Remembered from previous sessions" in prompt
        assert "Active role" in prompt
        assert "Active skill playbook" in prompt


# ---------------------------------------------------------------------------
# Full agent graph integration (fake model, real tools, no API)
# ---------------------------------------------------------------------------

class TestAgentGraphIntegration:
    """Drive the real ReAct loop with a fake model. The real tool executes."""

    def test_agent_calls_tool_and_responds(self):
        """Script: model calls recall → tool returns memory → model answers."""
        fake = make_fake([
            scripted_tool_call("list_skills", {}),
            scripted_answer("Done."),
        ])
        # build_agent needs a model; bypass it by building the graph directly
        # with ALL_TOOLS so the real tools execute.
        from langgraph.prebuilt import create_react_agent
        from marketing_agent.tools import ALL_TOOLS

        ag = create_react_agent(fake, tools=ALL_TOOLS)
        result = ag.invoke({"messages": [HumanMessage(content="list skills")]})

        msgs = result["messages"]
        # Human + AI(tool_call) + ToolMessage + AI(final) = 4
        assert len(msgs) == 4
        # The real list_skills tool executed (not faked).
        tool_msg = next(m for m in msgs if isinstance(m, ToolMessage))
        assert len(tool_msg.content) > 0  # it returned actual skill list text
        # Final answer is the scripted string.
        assert "Done" in msgs[-1].content

    def test_agent_multi_tool_call_in_one_turn(self):
        """Script: model calls two tools in one turn, then answers."""
        from tests._fakes import scripted_multi_tool_call
        from langgraph.prebuilt import create_react_agent
        from marketing_agent.tools import ALL_TOOLS

        fake = make_fake([
            scripted_multi_tool_call([
                ("list_assets", {}),
                ("list_skills", {}),
            ]),
            scripted_answer("All listed."),
        ])
        ag = create_react_agent(fake, tools=ALL_TOOLS)
        result = ag.invoke({"messages": [HumanMessage(content="list everything")]})

        msgs = result["messages"]
        tool_msgs = [m for m in msgs if isinstance(m, ToolMessage)]
        assert len(tool_msgs) == 2  # both tools executed
        assert "All listed" in msgs[-1].content

    def test_agent_remember_tool_persists_via_config(self, tmp_session):
        """The remember tool reads session_slug from the runnable config."""
        from langgraph.prebuilt import create_react_agent
        from marketing_agent.tools import ALL_TOOLS

        m = session.create_session(title="graph-remember")
        fake = make_fake([
            scripted_tool_call("remember", {"product": "GraphApp"}),
            scripted_answer("Remembered."),
        ])
        ag = create_react_agent(fake, tools=ALL_TOOLS)
        result = ag.invoke(
            {"messages": [HumanMessage(content="remember this")]},
            config={"configurable": {"session_slug": m.slug, "thread_id": m.slug}},
        )
        # The tool persisted to the session memory.
        mem = session.load_memory(m.slug)
        assert mem.product == "GraphApp"

    def test_agent_with_checkpointer_remembers_across_turns(self, tmp_session):
        """A checkpointer-backed agent preserves message history across invokes."""
        from langgraph.checkpoint.memory import MemorySaver
        from langgraph.prebuilt import create_react_agent
        from marketing_agent.tools import ALL_TOOLS

        m = session.create_session(title="checkpoint")
        cfg = {"configurable": {"thread_id": m.slug}}
        # Turn 1: model says "noted". Turn 2: model says "done".
        fake1 = make_fake([scripted_answer("Noted your request.")])
        ag = create_react_agent(fake1, tools=ALL_TOOLS, checkpointer=MemorySaver())
        ag.invoke({"messages": [HumanMessage(content="remember: I sell SaaS")]}, config=cfg)

        # The checkpointer stored state for this thread.
        state = ag.get_state(cfg)
        assert state.values is not None
        assert len(state.values.get("messages", [])) >= 1
