"""CLI entry point: interactive REPL + streamed thinking, toggleable at any time.

Usage:
    # Single task (args joined), thinking stream on by default
    uv run python -m marketing_agent "Write 3 versions of Xiaohongshu copy for an AI note-taking app"

    # Disable the thinking stream (only stream the final answer + tool calls)
    uv run python -m marketing_agent --no-thinking "Write a cold-outreach email"

    # Interactive REPL (no args); toggle thinking mid-session with /think
    uv run python -m marketing_agent

REPL commands:
    /think        toggle the thinking stream (on <-> off)
    /think-on     turn the thinking stream on
    /think-off    turn the thinking stream off
    /help         help
    /quit         quit
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

from langchain_core.messages import HumanMessage

from .agent import build_agent

# ANSI styling (enabled only on a TTY and when NO_COLOR is unset).
_DIM = "\033[2;3m"
_RESET = "\033[0m"


def _supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _iter_blocks(chunk) -> list[tuple[str, str]]:
    """Split a streaming chunk into (type, text) pairs.

    The type is "thinking" (the model's reasoning) or "text" (the formal answer).
    A Gemini thinking block's content is a list whose dict elements have type
    "thinking"/"reasoning"; a normal answer has type "text" or is a plain string.
    """
    content = getattr(chunk, "content", "")
    out: list[tuple[str, str]] = []
    if isinstance(content, str):
        if content:
            out.append(("text", content))
        return out
    if isinstance(content, list):
        for block in content:
            if isinstance(block, str):
                if block:
                    out.append(("text", block))
                continue
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype in ("thinking", "reasoning"):
                txt = block.get("thinking") or block.get("reasoning") or ""
                if txt:
                    out.append(("thinking", txt))
            elif btype == "text":
                txt = block.get("text", "")
                if txt:
                    out.append(("text", txt))
    return out


async def _stream_run(agent, user_input: str, show_thinking: bool, color: bool) -> None:
    """Stream output token by token via astream_events(v2).

    - Thinking stream on: the model's reasoning streams live in dim/italic (💭),
      followed by the formal answer (🤖).
    - Thinking stream off: thinking blocks are skipped; only the final answer and
      tool-call progress stream live.
    Tool calls are always shown (🔧 calls / ↳ returns).
    """
    so = sys.stdout
    # role: the type of segment currently being written — used to print prefixes
    # and switch ANSI styles on demand.
    state = {"role": None}

    def close_think() -> None:
        if state["role"] == "think":
            so.write("\n" + (_RESET if color else ""))
            so.flush()
            state["role"] = None

    def open_think() -> None:
        so.write("\n" + (_DIM if color else "") + "💭 ")
        so.flush()
        state["role"] = "think"

    def open_text() -> None:
        so.write("\n🤖 ")
        so.flush()
        state["role"] = "text"

    async for ev in agent.astream_events(
        {"messages": [HumanMessage(content=user_input)]},
        version="v2",
    ):
        kind = ev["event"]

        if kind == "on_chat_model_stream":
            chunk = ev["data"].get("chunk")
            if chunk is None:
                continue
            for btype, txt in _iter_blocks(chunk):
                if btype == "thinking":
                    if not show_thinking:
                        continue
                    if state["role"] != "think":
                        open_think()
                    so.write(txt)
                    so.flush()
                else:  # text
                    if state["role"] != "text":
                        close_think()
                        open_text()
                    so.write(txt)
                    so.flush()

        elif kind == "on_tool_start":
            close_think()
            name = ev.get("name", "")
            tool_input = ev["data"].get("input", "")
            so.write(f"\n🔧 call tool {name}({tool_input})\n")
            so.flush()

        elif kind == "on_tool_end":
            close_think()
            raw = str(ev["data"].get("output", ""))
            preview = raw if len(raw) <= 200 else raw[:200] + " …"
            so.write(f"   ↳ returned: {preview}\n")
            so.flush()

    close_think()
    so.write("\n")
    so.flush()


def run_once(user_input: str, show_thinking: bool, color: bool) -> None:
    """Run one task: build the agent per the current toggle and stream the output."""
    agent = build_agent(include_thoughts=show_thinking)
    so = sys.stdout
    so.write("\n🤖 agent starting...\n")
    so.flush()
    asyncio.run(_stream_run(agent, user_input, show_thinking, color))


def _print_thinking_status(show: bool) -> None:
    print(f"  → streamed thinking {'on 💭' if show else 'off'}\n")


def repl(default_thinking: bool, color: bool) -> None:
    show = default_thinking
    print("Marketing agent interactive mode. Type a task and press Enter; Ctrl-D/Ctrl-C to exit.")
    print(
        f"  streamed thinking: {'on' if show else 'off'}   "
        "(/think toggles · /think-on · /think-off · /help)\n"
    )
    while True:
        try:
            line = input("📝 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nbye 👋")
            break
        if not line:
            continue

        if line.startswith("/"):
            cmd = line.lower()
            if cmd in ("/think", "/thinking"):
                show = not show
                _print_thinking_status(show)
            elif cmd == "/think-on":
                show = True
                _print_thinking_status(show)
            elif cmd == "/think-off":
                show = False
                _print_thinking_status(show)
            elif cmd in ("/help", "/?"):
                print("  /think toggles thinking · /think-on · /think-off · /quit to exit\n")
            elif cmd in ("/quit", "/exit"):
                print("bye 👋")
                break
            else:
                print(f"  unknown command: {line}  (try /help)\n")
            continue

        run_once(line, show, color)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="marketing_agent",
        description="Marketing agent (streamed output, thinking toggleable)",
    )
    parser.add_argument(
        "task",
        nargs="*",
        help="Task text; if omitted, enters the interactive REPL",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--thinking",
        dest="thinking",
        action="store_true",
        help="Turn the thinking stream on (default)",
    )
    group.add_argument(
        "--no-thinking",
        dest="thinking",
        action="store_false",
        help="Turn the thinking stream off; only stream the final answer",
    )
    parser.set_defaults(thinking=None)
    args = parser.parse_args()

    show_thinking = True if args.thinking is None else args.thinking
    color = _supports_color()

    if args.task:
        run_once(" ".join(args.task), show_thinking, color)
    else:
        repl(show_thinking, color)


if __name__ == "__main__":
    main()
