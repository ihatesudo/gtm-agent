"""Shared test fakes for LangGraph/LangChain agent tests.

The core challenge (documented in the LangChain community, verified on
langchain-core 0.3.x/1.x): ``create_react_agent`` calls ``model.bind_tools()``
at graph build time, but the stock ``GenericFakeChatModel`` inherits a
``BaseChatModel`` stub that raises ``NotImplementedError`` there. So any
tool-calling graph dies before a scripted message can replay.

``ToolBindingFakeChatModel`` fixes this with a no-op ``bind_tools`` that returns
``self``. Combined with the ``make_fake()`` factory (which rebuilds the one-shot
message iterator per test), this lets us drive the full ReAct loop — real tool
dispatch, real message history — with zero API calls.

Usage::

    from tests._fakes import make_fake, scripted_tool_call, scripted_answer

    fake = make_fake([
        scripted_tool_call("lookup_seth_post", {"concept": "trust"}),
        scripted_answer("Trust compounds."),
    ])
    agent = create_react_agent(fake, tools=ALL_TOOLS)
    result = agent.invoke({"messages": [HumanMessage(content="...")]})
"""

from __future__ import annotations

from collections.abc import Iterable

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langchain_core.messages.tool import ToolCall


class ToolBindingFakeChatModel(GenericFakeChatModel):
    """``GenericFakeChatModel`` that survives ``bind_tools()``.

    The stock fake raises ``NotImplementedError`` on ``bind_tools`` because
    tool-calling graphs call it at build time. This subclass makes it a no-op
    that returns ``self`` — the scripted ``AIMessage.tool_calls`` are what
    actually drive tool dispatch, not the tool schemas.
    """

    def bind_tools(self, tools, **kwargs):  # noqa: ARG002 — signature compat
        return self

    def with_structured_output(self, schema, **kwargs):  # noqa: ARG002
        return self


def make_fake(messages: Iterable) -> ToolBindingFakeChatModel:
    """Build a fresh fake model. Rebuild per test — the message iterator is one-shot."""
    return ToolBindingFakeChatModel(messages=iter(list(messages)))


def scripted_tool_call(name: str, args: dict, call_id: str = "call_1") -> AIMessage:
    """An AIMessage that triggers a tool call in the ReAct loop."""
    return AIMessage(
        content="",
        tool_calls=[ToolCall(name=name, args=args, id=call_id)],
    )


def scripted_answer(text: str) -> AIMessage:
    """An AIMessage with a final answer (no tool calls) — ends the ReAct loop."""
    return AIMessage(content=text)


def scripted_multi_tool_call(calls: list[tuple[str, dict]]) -> AIMessage:
    """An AIMessage that triggers multiple tool calls in one turn."""
    return AIMessage(
        content="",
        tool_calls=[
            ToolCall(name=name, args=args, id=f"call_{i}")
            for i, (name, args) in enumerate(calls)
        ],
    )
